/**
 * payrollService.ts
 * v2.3 - Payroll and salary management for CaissaPro
 * Handles salary rules, payroll generation, advances, and payments
 */

import { getDatabase } from '../offline-db';
import * as Crypto from 'expo-crypto';

// ============================================================================
// TYPES
// ============================================================================

export type SalaryType = 'monthly' | 'hourly' | 'daily' | 'per_shift';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface StaffCompensation {
  id: string;
  userId: string;
  userName?: string;
  salaryType: SalaryType;
  baseSalary: number;
  hourlyRate: number;
  overtimeRate: number;
}

export interface PayrollEntry {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  periodStart: Date;
  periodEnd: Date;
  salaryType: SalaryType;
  baseSalary: number;
  hourlyRate?: number;
  overtimeRate?: number;
  totalHours?: number;
  overtimeHours?: number;
  bonuses: number;
  deductions: number;
  advances: number;
  totalPayable: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt: Date;
  paidAt?: Date;
}

export interface GeneratePayrollParams {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  bonuses?: number;
  deductions?: number;
  notes?: string;
}

// ============================================================================
// PAYROLL SERVICE
// ============================================================================

export const payrollService = {
  /**
   * Set or update compensation rules for a staff member
   */
  async setCompensation(
    userId: string,
    salaryType: SalaryType,
    baseSalary: number,
    hourlyRate: number = 0,
    overtimeRate: number = 0
  ): Promise<StaffCompensation> {
    const database = await getDatabase();
    
    console.log('[PAYROLL] Setting compensation for user:', userId);
    
    // Check if exists
    const existing = await database.getFirstAsync<{ id: string }>(
      `SELECT id FROM staff_compensation WHERE user_id = ?`,
      [userId]
    );
    
    const now = new Date().toISOString();
    
    if (existing) {
      await database.runAsync(
        `UPDATE staff_compensation SET 
          salary_type = ?, base_salary = ?, hourly_rate = ?, overtime_rate = ?, updated_at = ?
         WHERE user_id = ?`,
        [salaryType, baseSalary, hourlyRate, overtimeRate, now, userId]
      );
      
      return {
        id: existing.id,
        userId,
        salaryType,
        baseSalary,
        hourlyRate,
        overtimeRate,
      };
    }
    
    const id = await Crypto.randomUUID();
    await database.runAsync(
      `INSERT INTO staff_compensation (id, user_id, salary_type, base_salary, hourly_rate, overtime_rate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, salaryType, baseSalary, hourlyRate, overtimeRate, now]
    );
    
    return {
      id,
      userId,
      salaryType,
      baseSalary,
      hourlyRate,
      overtimeRate,
    };
  },
  
  /**
   * Get compensation rules for a staff member
   */
  async getCompensation(userId: string): Promise<StaffCompensation | null> {
    const database = await getDatabase();
    
    const comp = await database.getFirstAsync<{
      id: string;
      user_id: string;
      salary_type: string;
      base_salary: number;
      hourly_rate: number;
      overtime_rate: number;
      user_name?: string;
    }>(`
      SELECT sc.*, u.name as user_name
      FROM staff_compensation sc
      JOIN users u ON sc.user_id = u.id
      WHERE sc.user_id = ?
    `, [userId]);
    
    if (!comp) return null;
    
    return {
      id: comp.id,
      userId: comp.user_id,
      userName: comp.user_name,
      salaryType: comp.salary_type as SalaryType,
      baseSalary: comp.base_salary,
      hourlyRate: comp.hourly_rate,
      overtimeRate: comp.overtime_rate,
    };
  },
  
  /**
   * Get all staff compensation rules
   */
  async getAllCompensations(): Promise<StaffCompensation[]> {
    const database = await getDatabase();
    
    const comps = await database.getAllAsync<{
      id: string;
      user_id: string;
      salary_type: string;
      base_salary: number;
      hourly_rate: number;
      overtime_rate: number;
      user_name: string;
    }>(`
      SELECT sc.*, u.name as user_name
      FROM staff_compensation sc
      JOIN users u ON sc.user_id = u.id
      ORDER BY u.name
    `);
    
    return comps.map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user_name,
      salaryType: c.salary_type as SalaryType,
      baseSalary: c.base_salary,
      hourlyRate: c.hourly_rate,
      overtimeRate: c.overtime_rate,
    }));
  },
  
  /**
   * Generate payroll for a staff member based on their compensation rules and shifts
   */
  async generatePayroll(params: GeneratePayrollParams): Promise<PayrollEntry> {
    const database = await getDatabase();
    const { userId, periodStart, periodEnd, bonuses = 0, deductions = 0, notes } = params;
    
    console.log('[PAYROLL] Generating payroll for:', userId, 'Period:', periodStart.toISOString(), 'to', periodEnd.toISOString());
    
    // Get compensation rules
    const compensation = await this.getCompensation(userId);
    
    if (!compensation) {
      throw new Error('Aucune règle de salaire définie pour cet employé');
    }
    
    // Calculate based on salary type
    let totalPayable = 0;
    let totalHours = 0;
    let overtimeHours = 0;
    
    const startISO = periodStart.toISOString();
    const endISO = periodEnd.toISOString();
    
    switch (compensation.salaryType) {
      case 'monthly':
        // Fixed monthly salary
        totalPayable = compensation.baseSalary;
        break;
        
      case 'hourly':
        // Calculate hours from shifts
        const shiftHours = await database.getFirstAsync<{
          total_hours: number;
        }>(`
          SELECT COALESCE(SUM(
            CAST((julianday(COALESCE(closed_at, datetime('now'))) - julianday(opened_at)) * 24 AS REAL)
          ), 0) as total_hours
          FROM shifts
          WHERE user_id = ? AND status = 'CLOSED'
            AND opened_at >= ? AND opened_at <= ?
        `, [userId, startISO, endISO]);
        
        totalHours = Math.round((shiftHours?.total_hours || 0) * 100) / 100;
        
        // Standard work month = 176 hours (22 days x 8 hours)
        const standardHours = 176;
        if (totalHours > standardHours) {
          overtimeHours = totalHours - standardHours;
          totalPayable = (standardHours * compensation.hourlyRate) + 
                        (overtimeHours * (compensation.overtimeRate || compensation.hourlyRate * 1.5));
        } else {
          totalPayable = totalHours * compensation.hourlyRate;
        }
        break;
        
      case 'daily':
        // Calculate days worked
        const daysWorked = await database.getFirstAsync<{ count: number }>(`
          SELECT COUNT(DISTINCT date(opened_at)) as count
          FROM shifts
          WHERE user_id = ? AND status = 'CLOSED'
            AND opened_at >= ? AND opened_at <= ?
        `, [userId, startISO, endISO]);
        
        totalPayable = (daysWorked?.count || 0) * compensation.baseSalary;
        break;
        
      case 'per_shift':
        // Calculate number of shifts
        const shiftsCount = await database.getFirstAsync<{ count: number }>(`
          SELECT COUNT(*) as count
          FROM shifts
          WHERE user_id = ? AND status = 'CLOSED'
            AND opened_at >= ? AND opened_at <= ?
        `, [userId, startISO, endISO]);
        
        totalPayable = (shiftsCount?.count || 0) * compensation.baseSalary;
        break;
    }
    
    // Get existing advances (سلف) for this period
    const advancesSum = await database.getFirstAsync<{ total: number }>(`
      SELECT COALESCE(SUM(advances), 0) as total
      FROM payroll
      WHERE user_id = ? AND period_start = ? AND period_end = ?
    `, [userId, startISO, endISO]);
    
    const advances = advancesSum?.total || 0;
    
    // Calculate final payable
    totalPayable = Math.round((totalPayable + bonuses - deductions - advances) * 100) / 100;
    
    // Create payroll entry
    const id = await Crypto.randomUUID();
    const now = new Date();
    
    await database.runAsync(
      `INSERT INTO payroll (
        id, user_id, period_start, period_end, salary_type, base_salary,
        hourly_rate, overtime_rate, total_hours, overtime_hours,
        bonuses, deductions, advances, total_payable, paid_amount,
        payment_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)`,
      [
        id, userId, startISO, endISO,
        compensation.salaryType, compensation.baseSalary,
        compensation.hourlyRate, compensation.overtimeRate,
        totalHours, overtimeHours,
        bonuses, deductions, advances, totalPayable,
        notes || null, now.toISOString()
      ]
    );
    
    // Get user info
    const user = await database.getFirstAsync<{ name: string; role: string }>(
      `SELECT name, role FROM users WHERE id = ?`,
      [userId]
    );
    
    console.log('[PAYROLL] Payroll generated:', id, 'Total:', totalPayable);
    
    return {
      id,
      userId,
      userName: user?.name,
      userRole: user?.role,
      periodStart,
      periodEnd,
      salaryType: compensation.salaryType,
      baseSalary: compensation.baseSalary,
      hourlyRate: compensation.hourlyRate,
      overtimeRate: compensation.overtimeRate,
      totalHours,
      overtimeHours,
      bonuses,
      deductions,
      advances,
      totalPayable,
      paidAmount: 0,
      paymentStatus: 'unpaid',
      notes,
      createdAt: now,
    };
  },
  
  /**
   * Record a payment (full or partial)
   */
  async recordPayment(payrollId: string, amount: number, notes?: string): Promise<PayrollEntry> {
    const database = await getDatabase();
    
    console.log('[PAYROLL] Recording payment:', payrollId, 'Amount:', amount);
    
    // Get current payroll
    const payroll = await this.getPayrollById(payrollId);
    if (!payroll) {
      throw new Error('Fiche de paie non trouvée');
    }
    
    const newPaidAmount = Math.round((payroll.paidAmount + amount) * 100) / 100;
    let newStatus: PaymentStatus = 'partial';
    
    if (newPaidAmount >= payroll.totalPayable) {
      newStatus = 'paid';
    } else if (newPaidAmount === 0) {
      newStatus = 'unpaid';
    }
    
    const now = new Date().toISOString();
    
    await database.runAsync(
      `UPDATE payroll SET 
        paid_amount = ?, 
        payment_status = ?,
        paid_at = ?,
        notes = COALESCE(? || ' | ' || notes, notes)
      WHERE id = ?`,
      [newPaidAmount, newStatus, newStatus === 'paid' ? now : null, notes, payrollId]
    );
    
    return {
      ...payroll,
      paidAmount: newPaidAmount,
      paymentStatus: newStatus,
      paidAt: newStatus === 'paid' ? new Date() : undefined,
    };
  },
  
  /**
   * Record an advance (سلف)
   */
  async recordAdvance(userId: string, amount: number, notes?: string): Promise<void> {
    const database = await getDatabase();
    
    console.log('[PAYROLL] Recording advance for user:', userId, 'Amount:', amount);
    
    // Get current period (this month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Check if payroll exists for this period
    const existing = await database.getFirstAsync<{ id: string; advances: number }>(
      `SELECT id, advances FROM payroll 
       WHERE user_id = ? AND period_start = ? AND period_end = ?`,
      [userId, periodStart.toISOString(), periodEnd.toISOString()]
    );
    
    if (existing) {
      // Update existing payroll
      const newAdvances = existing.advances + amount;
      await database.runAsync(
        `UPDATE payroll SET 
          advances = ?,
          total_payable = base_salary + bonuses - deductions - ?,
          notes = COALESCE(notes || ' | Avance: ' || ?, 'Avance: ' || ?)
        WHERE id = ?`,
        [newAdvances, newAdvances, amount.toString(), amount.toString(), existing.id]
      );
    } else {
      // Create a new payroll entry just for the advance
      const id = await Crypto.randomUUID();
      const compensation = await this.getCompensation(userId);
      
      await database.runAsync(
        `INSERT INTO payroll (
          id, user_id, period_start, period_end, salary_type, base_salary,
          advances, total_payable, paid_amount, payment_status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'unpaid', ?, ?)`,
        [
          id, userId, periodStart.toISOString(), periodEnd.toISOString(),
          compensation?.salaryType || 'monthly',
          compensation?.baseSalary || 0,
          amount,
          (compensation?.baseSalary || 0) - amount,
          notes || `Avance: ${amount} DH`,
          now.toISOString()
        ]
      );
    }
  },
  
  /**
   * Get payroll entry by ID
   */
  async getPayrollById(payrollId: string): Promise<PayrollEntry | null> {
    const database = await getDatabase();
    
    const p = await database.getFirstAsync<{
      id: string;
      user_id: string;
      period_start: string;
      period_end: string;
      salary_type: string;
      base_salary: number;
      hourly_rate: number | null;
      overtime_rate: number | null;
      total_hours: number | null;
      overtime_hours: number | null;
      bonuses: number;
      deductions: number;
      advances: number;
      total_payable: number;
      paid_amount: number;
      payment_status: string;
      notes: string | null;
      created_at: string;
      paid_at: string | null;
      user_name: string;
      user_role: string;
    }>(`
      SELECT p.*, u.name as user_name, u.role as user_role
      FROM payroll p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [payrollId]);
    
    if (!p) return null;
    
    return {
      id: p.id,
      userId: p.user_id,
      userName: p.user_name,
      userRole: p.user_role,
      periodStart: new Date(p.period_start),
      periodEnd: new Date(p.period_end),
      salaryType: p.salary_type as SalaryType,
      baseSalary: p.base_salary,
      hourlyRate: p.hourly_rate || undefined,
      overtimeRate: p.overtime_rate || undefined,
      totalHours: p.total_hours || undefined,
      overtimeHours: p.overtime_hours || undefined,
      bonuses: p.bonuses,
      deductions: p.deductions,
      advances: p.advances,
      totalPayable: p.total_payable,
      paidAmount: p.paid_amount,
      paymentStatus: p.payment_status as PaymentStatus,
      notes: p.notes || undefined,
      createdAt: new Date(p.created_at),
      paidAt: p.paid_at ? new Date(p.paid_at) : undefined,
    };
  },
  
  /**
   * Get all payroll entries for a period
   */
  async getPayrollHistory(
    startDate?: Date,
    endDate?: Date,
    userId?: string,
    status?: PaymentStatus
  ): Promise<PayrollEntry[]> {
    const database = await getDatabase();
    
    let query = `
      SELECT p.*, u.name as user_name, u.role as user_role
      FROM payroll p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (startDate) {
      query += ` AND p.period_start >= ?`;
      params.push(startDate.toISOString());
    }
    if (endDate) {
      query += ` AND p.period_end <= ?`;
      params.push(endDate.toISOString());
    }
    if (userId) {
      query += ` AND p.user_id = ?`;
      params.push(userId);
    }
    if (status) {
      query += ` AND p.payment_status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY p.created_at DESC`;
    
    const results = await database.getAllAsync<{
      id: string;
      user_id: string;
      period_start: string;
      period_end: string;
      salary_type: string;
      base_salary: number;
      hourly_rate: number | null;
      overtime_rate: number | null;
      total_hours: number | null;
      overtime_hours: number | null;
      bonuses: number;
      deductions: number;
      advances: number;
      total_payable: number;
      paid_amount: number;
      payment_status: string;
      notes: string | null;
      created_at: string;
      paid_at: string | null;
      user_name: string;
      user_role: string;
    }>(query, params);
    
    return results.map(p => ({
      id: p.id,
      userId: p.user_id,
      userName: p.user_name,
      userRole: p.user_role,
      periodStart: new Date(p.period_start),
      periodEnd: new Date(p.period_end),
      salaryType: p.salary_type as SalaryType,
      baseSalary: p.base_salary,
      hourlyRate: p.hourly_rate || undefined,
      overtimeRate: p.overtime_rate || undefined,
      totalHours: p.total_hours || undefined,
      overtimeHours: p.overtime_hours || undefined,
      bonuses: p.bonuses,
      deductions: p.deductions,
      advances: p.advances,
      totalPayable: p.total_payable,
      paidAmount: p.paid_amount,
      paymentStatus: p.payment_status as PaymentStatus,
      notes: p.notes || undefined,
      createdAt: new Date(p.created_at),
      paidAt: p.paid_at ? new Date(p.paid_at) : undefined,
    }));
  },
  
  /**
   * Get unpaid payroll summary
   */
  async getUnpaidSummary(): Promise<{
    totalUnpaid: number;
    totalPartial: number;
    entries: PayrollEntry[];
  }> {
    const entries = await this.getPayrollHistory(undefined, undefined, undefined, 'unpaid');
    const partialEntries = await this.getPayrollHistory(undefined, undefined, undefined, 'partial');
    
    const allEntries = [...entries, ...partialEntries];
    
    return {
      totalUnpaid: entries.reduce((sum, e) => sum + e.totalPayable, 0),
      totalPartial: partialEntries.reduce((sum, e) => sum + (e.totalPayable - e.paidAmount), 0),
      entries: allEntries,
    };
  },
};

export default payrollService;
