/**
 * scheduleService.ts
 * v2.3 - Simple shift planning/scheduling for CaissaPro
 * Lightweight weekly planning without complex calendar
 */

import { getDatabase } from '../offline-db';
import * as Crypto from 'expo-crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface PlannedShift {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  role?: string;
  notes?: string;
}

export interface WeekSchedule {
  weekStart: Date;
  weekEnd: Date;
  days: Array<{
    date: string;
    dayName: string;
    shifts: PlannedShift[];
  }>;
}

// ============================================================================
// SCHEDULE SERVICE
// ============================================================================

export const scheduleService = {
  /**
   * Create a planned shift
   */
  async createPlannedShift(
    userId: string,
    date: string,
    startTime: string,
    endTime: string,
    role?: string,
    notes?: string
  ): Promise<PlannedShift> {
    const database = await getDatabase();
    
    console.log('[SCHEDULE] Creating planned shift:', userId, date, startTime, '-', endTime);
    
    const id = await Crypto.randomUUID();
    
    await database.runAsync(
      `INSERT INTO planned_shifts (id, user_id, date, start_time, end_time, role, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, date, startTime, endTime, role || null, notes || null, new Date().toISOString()]
    );
    
    // Get user info
    const user = await database.getFirstAsync<{ name: string; role: string }>(
      `SELECT name, role FROM users WHERE id = ?`,
      [userId]
    );
    
    return {
      id,
      userId,
      userName: user?.name,
      userRole: user?.role,
      date,
      startTime,
      endTime,
      role,
      notes,
    };
  },
  
  /**
   * Update a planned shift
   */
  async updatePlannedShift(
    shiftId: string,
    updates: Partial<Omit<PlannedShift, 'id' | 'userName' | 'userRole'>>
  ): Promise<PlannedShift | null> {
    const database = await getDatabase();
    
    console.log('[SCHEDULE] Updating planned shift:', shiftId);
    
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.userId !== undefined) {
      fields.push('user_id = ?');
      values.push(updates.userId);
    }
    if (updates.date !== undefined) {
      fields.push('date = ?');
      values.push(updates.date);
    }
    if (updates.startTime !== undefined) {
      fields.push('start_time = ?');
      values.push(updates.startTime);
    }
    if (updates.endTime !== undefined) {
      fields.push('end_time = ?');
      values.push(updates.endTime);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    
    if (fields.length === 0) return null;
    
    values.push(shiftId);
    
    await database.runAsync(
      `UPDATE planned_shifts SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    
    return this.getPlannedShiftById(shiftId);
  },
  
  /**
   * Delete a planned shift
   */
  async deletePlannedShift(shiftId: string): Promise<void> {
    const database = await getDatabase();
    
    console.log('[SCHEDULE] Deleting planned shift:', shiftId);
    
    await database.runAsync(
      `DELETE FROM planned_shifts WHERE id = ?`,
      [shiftId]
    );
  },
  
  /**
   * Get a planned shift by ID
   */
  async getPlannedShiftById(shiftId: string): Promise<PlannedShift | null> {
    const database = await getDatabase();
    
    const shift = await database.getFirstAsync<{
      id: string;
      user_id: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string | null;
      notes: string | null;
      user_name: string;
      user_role: string;
    }>(`
      SELECT ps.*, u.name as user_name, u.role as user_role
      FROM planned_shifts ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.id = ?
    `, [shiftId]);
    
    if (!shift) return null;
    
    return {
      id: shift.id,
      userId: shift.user_id,
      userName: shift.user_name,
      userRole: shift.user_role,
      date: shift.date,
      startTime: shift.start_time,
      endTime: shift.end_time,
      role: shift.role || undefined,
      notes: shift.notes || undefined,
    };
  },
  
  /**
   * Get planned shifts for a date
   */
  async getShiftsForDate(date: string): Promise<PlannedShift[]> {
    const database = await getDatabase();
    
    const shifts = await database.getAllAsync<{
      id: string;
      user_id: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string | null;
      notes: string | null;
      user_name: string;
      user_role: string;
    }>(`
      SELECT ps.*, u.name as user_name, u.role as user_role
      FROM planned_shifts ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.date = ?
      ORDER BY ps.start_time
    `, [date]);
    
    return shifts.map(s => ({
      id: s.id,
      userId: s.user_id,
      userName: s.user_name,
      userRole: s.user_role,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      role: s.role || undefined,
      notes: s.notes || undefined,
    }));
  },
  
  /**
   * Get planned shifts for a user
   */
  async getShiftsForUser(userId: string, startDate?: string, endDate?: string): Promise<PlannedShift[]> {
    const database = await getDatabase();
    
    let query = `
      SELECT ps.*, u.name as user_name, u.role as user_role
      FROM planned_shifts ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.user_id = ?
    `;
    const params: any[] = [userId];
    
    if (startDate) {
      query += ` AND ps.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND ps.date <= ?`;
      params.push(endDate);
    }
    
    query += ` ORDER BY ps.date, ps.start_time`;
    
    const shifts = await database.getAllAsync<{
      id: string;
      user_id: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string | null;
      notes: string | null;
      user_name: string;
      user_role: string;
    }>(query, params);
    
    return shifts.map(s => ({
      id: s.id,
      userId: s.user_id,
      userName: s.user_name,
      userRole: s.user_role,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      role: s.role || undefined,
      notes: s.notes || undefined,
    }));
  },
  
  /**
   * Get weekly schedule
   */
  async getWeekSchedule(weekStartDate?: Date): Promise<WeekSchedule> {
    const database = await getDatabase();
    
    // Calculate week start (Monday)
    const now = weekStartDate || new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const days: WeekSchedule['days'] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const shifts = await this.getShiftsForDate(dateStr);
      
      days.push({
        date: dateStr,
        dayName: dayNames[i],
        shifts,
      });
    }
    
    return {
      weekStart: monday,
      weekEnd: sunday,
      days,
    };
  },
  
  /**
   * Copy schedule from one week to another
   */
  async copyWeekSchedule(fromWeekStart: Date, toWeekStart: Date): Promise<number> {
    const database = await getDatabase();
    
    // Get source week schedule
    const sourceSchedule = await this.getWeekSchedule(fromWeekStart);
    
    let copiedCount = 0;
    
    for (let i = 0; i < 7; i++) {
      const sourceDay = sourceSchedule.days[i];
      const targetDate = new Date(toWeekStart);
      targetDate.setDate(toWeekStart.getDate() + i);
      const targetDateStr = targetDate.toISOString().split('T')[0];
      
      for (const shift of sourceDay.shifts) {
        await this.createPlannedShift(
          shift.userId,
          targetDateStr,
          shift.startTime,
          shift.endTime,
          shift.role,
          shift.notes
        );
        copiedCount++;
      }
    }
    
    console.log('[SCHEDULE] Copied', copiedCount, 'shifts to new week');
    
    return copiedCount;
  },
  
  /**
   * Get today's planned shifts
   */
  async getTodaySchedule(): Promise<PlannedShift[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getShiftsForDate(today);
  },
  
  /**
   * Check if user has a planned shift for a specific date
   */
  async hasPlannedShift(userId: string, date: string): Promise<boolean> {
    const database = await getDatabase();
    
    const result = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM planned_shifts WHERE user_id = ? AND date = ?`,
      [userId, date]
    );
    
    return (result?.count || 0) > 0;
  },
};

export default scheduleService;
