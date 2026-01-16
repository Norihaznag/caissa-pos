import { supabase } from './supabase';

export interface Shift {
  id: string;
  userId: string;
  userName?: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'scheduled' | 'active' | 'completed' | 'absent' | 'cancelled';
  notes?: string;
}

export interface ShiftTemplate {
  id: string;
  userId: string;
  userName?: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  startTime: string;
  endTime: string;
  isActive: boolean;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const shiftService = {
  // Get day name in French
  getDayName: (dayOfWeek: number): string => {
    return DAY_NAMES[dayOfWeek] || '';
  },

  // Check if user has an active shift right now
  async checkActiveShift(userId: string): Promise<{ 
    hasShift: boolean; 
    shift?: Shift; 
    message: string;
    canWork: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    try {
      // First check if there's a shift scheduled for today
      const { data: shift, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', userId)
        .eq('shift_date', today)
        .single();

      if (error || !shift) {
        // No shift scheduled - check if there's a template for this day
        const dayOfWeek = now.getDay();
        const { data: template } = await supabase
          .from('shift_templates')
          .select('*')
          .eq('user_id', userId)
          .eq('day_of_week', dayOfWeek)
          .eq('is_active', true)
          .single();

        if (template) {
          // Auto-create shift from template
          const { data: newShift } = await supabase
            .from('shifts')
            .insert({
              user_id: userId,
              shift_date: today,
              start_time: template.start_time,
              end_time: template.end_time,
              status: 'scheduled'
            })
            .select()
            .single();

          if (newShift) {
            return shiftService.checkActiveShift(userId); // Recheck with new shift
          }
        }

        return {
          hasShift: false,
          message: "Vous n'avez pas de service prévu aujourd'hui.",
          canWork: false
        };
      }

      // Check if shift is cancelled or absent
      if (shift.status === 'cancelled') {
        return {
          hasShift: false,
          message: "Votre service a été annulé aujourd'hui.",
          canWork: false
        };
      }

      if (shift.status === 'absent') {
        return {
          hasShift: false,
          message: "Vous êtes marqué absent aujourd'hui.",
          canWork: false
        };
      }

      if (shift.status === 'completed') {
        return {
          hasShift: true,
          shift: shiftService.mapShift(shift),
          message: "Votre service est terminé pour aujourd'hui.",
          canWork: false
        };
      }

      // Check if current time is within shift hours
      const shiftStart = shift.start_time.slice(0, 5);
      const shiftEnd = shift.end_time.slice(0, 5);

      if (currentTime < shiftStart) {
        return {
          hasShift: true,
          shift: shiftService.mapShift(shift),
          message: `Votre service commence à ${shiftStart}.`,
          canWork: false
        };
      }

      if (currentTime > shiftEnd) {
        // Auto-complete the shift
        await supabase
          .from('shifts')
          .update({ status: 'completed', actual_end: now.toISOString() })
          .eq('id', shift.id);

        return {
          hasShift: true,
          shift: shiftService.mapShift(shift),
          message: "Votre service est terminé pour aujourd'hui.",
          canWork: false
        };
      }

      // Within shift hours - allow work
      // If not already active, mark as active
      if (shift.status === 'scheduled') {
        await supabase
          .from('shifts')
          .update({ status: 'active', actual_start: now.toISOString() })
          .eq('id', shift.id);
      }

      return {
        hasShift: true,
        shift: shiftService.mapShift(shift),
        message: `Service actif jusqu'à ${shiftEnd}.`,
        canWork: true
      };

    } catch (error) {
      console.error('Error checking shift:', error);
      // In case of error, allow work to not block operations
      return {
        hasShift: true,
        message: "Erreur de vérification - accès autorisé.",
        canWork: true
      };
    }
  },

  // Clock in
  async clockIn(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('shifts')
      .update({ status: 'active', actual_start: now })
      .eq('user_id', userId)
      .eq('shift_date', today);

    return !error;
  },

  // Clock out
  async clockOut(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('shifts')
      .update({ status: 'completed', actual_end: now })
      .eq('user_id', userId)
      .eq('shift_date', today);

    return !error;
  },

  // Get today's shifts for all users
  async getTodayShifts(): Promise<Shift[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        users (name)
      `)
      .eq('shift_date', today)
      .order('start_time');

    if (error || !data) return [];

    return data.map(s => ({
      ...shiftService.mapShift(s),
      userName: s.users?.name || 'Unknown'
    }));
  },

  // Get shifts for a date range
  async getShifts(startDate: string, endDate: string): Promise<Shift[]> {
    const { data, error } = await supabase
      .from('shifts')
      .select(`
        *,
        users (name)
      `)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date')
      .order('start_time');

    if (error || !data) return [];

    return data.map(s => ({
      ...shiftService.mapShift(s),
      userName: s.users?.name || 'Unknown'
    }));
  },

  // Create or update a shift
  async saveShift(shift: Partial<Shift> & { userId: string; shiftDate: string }): Promise<boolean> {
    const payload = {
      user_id: shift.userId,
      shift_date: shift.shiftDate,
      start_time: shift.startTime || '08:00',
      end_time: shift.endTime || '16:00',
      status: shift.status || 'scheduled',
      notes: shift.notes
    };

    const { error } = await supabase
      .from('shifts')
      .upsert(payload, { onConflict: 'user_id,shift_date' });

    return !error;
  },

  // Delete a shift
  async deleteShift(shiftId: string): Promise<boolean> {
    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', shiftId);

    return !error;
  },

  // Get shift templates for a user
  async getTemplates(userId?: string): Promise<ShiftTemplate[]> {
    let query = supabase
      .from('shift_templates')
      .select(`
        *,
        users (name)
      `)
      .order('day_of_week');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map(t => ({
      id: t.id,
      userId: t.user_id,
      userName: t.users?.name || 'Unknown',
      dayOfWeek: t.day_of_week,
      startTime: t.start_time?.slice(0, 5) || '08:00',
      endTime: t.end_time?.slice(0, 5) || '16:00',
      isActive: t.is_active
    }));
  },

  // Save shift template
  async saveTemplate(template: Partial<ShiftTemplate> & { userId: string; dayOfWeek: number }): Promise<boolean> {
    const payload = {
      user_id: template.userId,
      day_of_week: template.dayOfWeek,
      start_time: template.startTime || '08:00',
      end_time: template.endTime || '16:00',
      is_active: template.isActive !== false
    };

    const { error } = await supabase
      .from('shift_templates')
      .upsert(payload, { onConflict: 'user_id,day_of_week' });

    return !error;
  },

  // Generate shifts from templates for a week
  async generateWeekShifts(startDate: Date): Promise<number> {
    const templates = await shiftService.getTemplates();
    let created = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];

      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek && t.isActive);

      for (const template of dayTemplates) {
        const success = await shiftService.saveShift({
          userId: template.userId,
          shiftDate: dateStr,
          startTime: template.startTime,
          endTime: template.endTime,
          status: 'scheduled'
        });
        if (success) created++;
      }
    }

    return created;
  },

  // Map DB shift to app shift
  mapShift(s: any): Shift {
    return {
      id: s.id,
      userId: s.user_id,
      shiftDate: s.shift_date,
      startTime: s.start_time?.slice(0, 5) || '08:00',
      endTime: s.end_time?.slice(0, 5) || '16:00',
      actualStart: s.actual_start,
      actualEnd: s.actual_end,
      status: s.status || 'scheduled',
      notes: s.notes
    };
  }
};
