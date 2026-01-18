/**
 * shiftService.ts
 * v2.3 - Complete shift management for CaissaPro
 * Handles opening, closing shifts, calculating totals, and staff accountability
 */

import { getDatabase } from '../offline-db';
import * as Crypto from 'expo-crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface Shift {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  openedAt: Date;
  closedAt?: Date;
  openingAmount: number;
  closingAmount?: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  totalOrders: number;
  totalDiscounts: number;
  totalChangeGiven: number;
  cancelledOrders: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  // Computed fields
  duration?: number; // in minutes
  expectedCash?: number;
  cashDifference?: number;
  avgBasket?: number;
}

export interface ShiftSummary {
  shift: Shift;
  orderBreakdown: {
    total: number;
    paid: number;
    cancelled: number;
    pending: number;
  };
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  hourlyBreakdown: Array<{
    hour: number;
    orders: number;
    revenue: number;
  }>;
}

export interface OpenShiftParams {
  userId: string;
  openingAmount?: number;
  notes?: string;
}

export interface CloseShiftParams {
  shiftId: string;
  closingAmount: number;
  notes?: string;
}

// ============================================================================
// SHIFT SERVICE
// ============================================================================

export const shiftService = {
  /**
   * Open a new shift for a user
   * Enforces: Only ONE open shift per user at a time
   */
  async openShift(params: OpenShiftParams): Promise<Shift> {
    const database = await getDatabase();
    const { userId, openingAmount = 0, notes } = params;
    
    console.log('[SHIFT] Opening shift for user:', userId);
    
    // Check if user already has an open shift
    const existingShift = await database.getFirstAsync<{ id: string }>(
      `SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN'`,
      [userId]
    );
    
    if (existingShift) {
      throw new Error('Cet utilisateur a déjà un shift ouvert. Fermez-le d\'abord.');
    }
    
    // Create new shift
    const shiftId = await Crypto.randomUUID();
    const now = new Date().toISOString();
    
    await database.runAsync(
      `INSERT INTO shifts (id, user_id, opened_at, opening_amount, status, notes)
       VALUES (?, ?, ?, ?, 'OPEN', ?)`,
      [shiftId, userId, now, openingAmount, notes || null]
    );
    
    console.log('[SHIFT] Shift opened:', shiftId);
    
    return {
      id: shiftId,
      userId,
      openedAt: new Date(now),
      openingAmount,
      totalSales: 0,
      cashSales: 0,
      cardSales: 0,
      totalOrders: 0,
      totalDiscounts: 0,
      totalChangeGiven: 0,
      cancelledOrders: 0,
      status: 'OPEN',
      notes,
    };
  },
  
  /**
   * Close a shift and calculate all totals
   */
  async closeShift(params: CloseShiftParams): Promise<Shift> {
    const database = await getDatabase();
    const { shiftId, closingAmount, notes } = params;
    
    console.log('[SHIFT] Closing shift:', shiftId);
    
    // Get the shift
    const shift = await database.getFirstAsync<{
      id: string;
      user_id: string;
      opened_at: string;
      opening_amount: number;
      status: string;
    }>(
      `SELECT * FROM shifts WHERE id = ?`,
      [shiftId]
    );
    
    if (!shift) {
      throw new Error('Shift non trouvé');
    }
    
    if (shift.status !== 'OPEN') {
      throw new Error('Ce shift est déjà fermé');
    }
    
    const now = new Date();
    const openedAt = new Date(shift.opened_at);
    
    // Calculate totals from orders during shift period
    const stats = await database.getFirstAsync<{
      total_sales: number;
      cash_sales: number;
      card_sales: number;
      total_orders: number;
      total_discounts: number;
      total_change: number;
      cancelled_count: number;
    }>(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as total_orders,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN discount ELSE 0 END), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN change_amount ELSE 0 END), 0) as total_change,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_count
      FROM orders
      WHERE (shift_id = ? OR (cashier_id = ? AND paid_at >= ? AND paid_at <= ?))
    `, [shiftId, shift.user_id, shift.opened_at, now.toISOString()]);
    
    const totalSales = stats?.total_sales || 0;
    const cashSales = stats?.cash_sales || 0;
    const cardSales = stats?.card_sales || 0;
    const totalOrders = stats?.total_orders || 0;
    const totalDiscounts = stats?.total_discounts || 0;
    const totalChangeGiven = stats?.total_change || 0;
    const cancelledOrders = stats?.cancelled_count || 0;
    
    // Calculate expected cash
    // expectedCash = opening_amount + cashSales - changeGiven
    const expectedCash = shift.opening_amount + cashSales - totalChangeGiven;
    const cashDifference = closingAmount - expectedCash;
    
    // Update shift record
    await database.runAsync(
      `UPDATE shifts SET 
        closed_at = ?,
        closing_amount = ?,
        total_sales = ?,
        cash_sales = ?,
        card_sales = ?,
        total_orders = ?,
        total_discounts = ?,
        total_change_given = ?,
        cancelled_orders = ?,
        status = 'CLOSED',
        notes = COALESCE(?, notes)
      WHERE id = ?`,
      [
        now.toISOString(),
        closingAmount,
        totalSales,
        cashSales,
        cardSales,
        totalOrders,
        totalDiscounts,
        totalChangeGiven,
        cancelledOrders,
        notes || null,
        shiftId,
      ]
    );
    
    console.log('[SHIFT] Shift closed. Sales:', totalSales, 'Expected cash:', expectedCash, 'Actual:', closingAmount, 'Diff:', cashDifference);
    
    // Get user info
    const user = await database.getFirstAsync<{ name: string; role: string }>(
      `SELECT name, role FROM users WHERE id = ?`,
      [shift.user_id]
    );
    
    return {
      id: shiftId,
      userId: shift.user_id,
      userName: user?.name,
      userRole: user?.role,
      openedAt,
      closedAt: now,
      openingAmount: shift.opening_amount,
      closingAmount,
      totalSales,
      cashSales,
      cardSales,
      totalOrders,
      totalDiscounts,
      totalChangeGiven,
      cancelledOrders,
      status: 'CLOSED',
      notes,
      duration: Math.round((now.getTime() - openedAt.getTime()) / 60000),
      expectedCash,
      cashDifference,
      avgBasket: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
    };
  },
  
  /**
   * Get currently open shifts
   */
  async getOpenShifts(): Promise<Shift[]> {
    const database = await getDatabase();
    
    const shifts = await database.getAllAsync<{
      id: string;
      user_id: string;
      opened_at: string;
      opening_amount: number;
      notes: string | null;
      user_name: string;
      user_role: string;
    }>(`
      SELECT s.*, u.name as user_name, u.role as user_role
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'OPEN'
      ORDER BY s.opened_at DESC
    `);
    
    return shifts.map(s => ({
      id: s.id,
      userId: s.user_id,
      userName: s.user_name,
      userRole: s.user_role,
      openedAt: new Date(s.opened_at),
      openingAmount: s.opening_amount,
      totalSales: 0,
      cashSales: 0,
      cardSales: 0,
      totalOrders: 0,
      totalDiscounts: 0,
      totalChangeGiven: 0,
      cancelledOrders: 0,
      status: 'OPEN',
      notes: s.notes || undefined,
      duration: Math.round((Date.now() - new Date(s.opened_at).getTime()) / 60000),
    }));
  },
  
  /**
   * Get shift by ID with full details
   */
  async getShiftById(shiftId: string): Promise<Shift | null> {
    const database = await getDatabase();
    
    const shift = await database.getFirstAsync<{
      id: string;
      user_id: string;
      opened_at: string;
      closed_at: string | null;
      opening_amount: number;
      closing_amount: number | null;
      total_sales: number;
      cash_sales: number;
      card_sales: number;
      total_orders: number;
      total_discounts: number;
      total_change_given: number;
      cancelled_orders: number;
      status: string;
      notes: string | null;
      user_name: string;
      user_role: string;
    }>(`
      SELECT s.*, u.name as user_name, u.role as user_role
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [shiftId]);
    
    if (!shift) return null;
    
    const openedAt = new Date(shift.opened_at);
    const closedAt = shift.closed_at ? new Date(shift.closed_at) : undefined;
    
    const expectedCash = shift.opening_amount + shift.cash_sales - shift.total_change_given;
    const cashDifference = shift.closing_amount ? shift.closing_amount - expectedCash : undefined;
    
    return {
      id: shift.id,
      userId: shift.user_id,
      userName: shift.user_name,
      userRole: shift.user_role,
      openedAt,
      closedAt,
      openingAmount: shift.opening_amount,
      closingAmount: shift.closing_amount || undefined,
      totalSales: shift.total_sales,
      cashSales: shift.cash_sales,
      cardSales: shift.card_sales,
      totalOrders: shift.total_orders,
      totalDiscounts: shift.total_discounts,
      totalChangeGiven: shift.total_change_given,
      cancelledOrders: shift.cancelled_orders,
      status: shift.status as 'OPEN' | 'CLOSED',
      notes: shift.notes || undefined,
      duration: closedAt 
        ? Math.round((closedAt.getTime() - openedAt.getTime()) / 60000)
        : Math.round((Date.now() - openedAt.getTime()) / 60000),
      expectedCash,
      cashDifference,
      avgBasket: shift.total_orders > 0 ? Math.round((shift.total_sales / shift.total_orders) * 100) / 100 : 0,
    };
  },
  
  /**
   * Get shifts for a date range
   */
  async getShifts(startDate: Date, endDate: Date, userId?: string): Promise<Shift[]> {
    const database = await getDatabase();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    let query = `
      SELECT s.*, u.name as user_name, u.role as user_role
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.opened_at >= ? AND s.opened_at <= ?
    `;
    const params: any[] = [startDate.toISOString(), endDate.toISOString()];
    
    if (userId) {
      query += ` AND s.user_id = ?`;
      params.push(userId);
    }
    
    query += ` ORDER BY s.opened_at DESC`;
    
    const shifts = await database.getAllAsync<{
      id: string;
      user_id: string;
      opened_at: string;
      closed_at: string | null;
      opening_amount: number;
      closing_amount: number | null;
      total_sales: number;
      cash_sales: number;
      card_sales: number;
      total_orders: number;
      total_discounts: number;
      total_change_given: number;
      cancelled_orders: number;
      status: string;
      notes: string | null;
      user_name: string;
      user_role: string;
    }>(query, params);
    
    return shifts.map(s => {
      const openedAt = new Date(s.opened_at);
      const closedAt = s.closed_at ? new Date(s.closed_at) : undefined;
      const expectedCash = s.opening_amount + s.cash_sales - s.total_change_given;
      
      return {
        id: s.id,
        userId: s.user_id,
        userName: s.user_name,
        userRole: s.user_role,
        openedAt,
        closedAt,
        openingAmount: s.opening_amount,
        closingAmount: s.closing_amount || undefined,
        totalSales: s.total_sales,
        cashSales: s.cash_sales,
        cardSales: s.card_sales,
        totalOrders: s.total_orders,
        totalDiscounts: s.total_discounts,
        totalChangeGiven: s.total_change_given,
        cancelledOrders: s.cancelled_orders,
        status: s.status as 'OPEN' | 'CLOSED',
        notes: s.notes || undefined,
        duration: closedAt 
          ? Math.round((closedAt.getTime() - openedAt.getTime()) / 60000)
          : Math.round((Date.now() - openedAt.getTime()) / 60000),
        expectedCash,
        cashDifference: s.closing_amount ? s.closing_amount - expectedCash : undefined,
        avgBasket: s.total_orders > 0 ? Math.round((s.total_sales / s.total_orders) * 100) / 100 : 0,
      };
    });
  },
  
  /**
   * Get user's open shift (if any)
   */
  async getUserOpenShift(userId: string): Promise<Shift | null> {
    const database = await getDatabase();
    
    const shift = await database.getFirstAsync<{ id: string }>(
      `SELECT id FROM shifts WHERE user_id = ? AND status = 'OPEN'`,
      [userId]
    );
    
    if (!shift) return null;
    
    return this.getShiftById(shift.id);
  },
  
  /**
   * Get shift summary with detailed breakdown
   */
  async getShiftSummary(shiftId: string): Promise<ShiftSummary | null> {
    const shift = await this.getShiftById(shiftId);
    if (!shift) return null;
    
    const database = await getDatabase();
    
    // Get order breakdown
    const orderStats = await database.getFirstAsync<{
      total: number;
      paid: number;
      cancelled: number;
      pending: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status IN ('NEW', 'PENDING', 'PREPARING', 'READY') THEN 1 END) as pending
      FROM orders
      WHERE shift_id = ? OR (cashier_id = ? AND created_at >= ? AND created_at <= ?)
    `, [
      shiftId, 
      shift.userId, 
      shift.openedAt.toISOString(), 
      (shift.closedAt || new Date()).toISOString()
    ]);
    
    // Get top products
    const topProducts = await database.getAllAsync<{
      product_name: string;
      quantity: number;
      revenue: number;
    }>(`
      SELECT 
        oi.product_name,
        SUM(oi.quantity) as quantity,
        SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'PAID' 
        AND (o.shift_id = ? OR (o.cashier_id = ? AND o.paid_at >= ? AND o.paid_at <= ?))
      GROUP BY oi.product_name
      ORDER BY quantity DESC
      LIMIT 5
    `, [
      shiftId,
      shift.userId,
      shift.openedAt.toISOString(),
      (shift.closedAt || new Date()).toISOString()
    ]);
    
    // Get hourly breakdown
    const hourlyStats = await database.getAllAsync<{
      hour: number;
      orders: number;
      revenue: number;
    }>(`
      SELECT 
        CAST(strftime('%H', paid_at) AS INTEGER) as hour,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE status = 'PAID'
        AND (shift_id = ? OR (cashier_id = ? AND paid_at >= ? AND paid_at <= ?))
      GROUP BY hour
      ORDER BY hour
    `, [
      shiftId,
      shift.userId,
      shift.openedAt.toISOString(),
      (shift.closedAt || new Date()).toISOString()
    ]);
    
    return {
      shift,
      orderBreakdown: {
        total: orderStats?.total || 0,
        paid: orderStats?.paid || 0,
        cancelled: orderStats?.cancelled || 0,
        pending: orderStats?.pending || 0,
      },
      topProducts: topProducts.map(p => ({
        productName: p.product_name,
        quantity: p.quantity,
        revenue: p.revenue,
      })),
      hourlyBreakdown: hourlyStats.map(h => ({
        hour: h.hour,
        orders: h.orders,
        revenue: h.revenue,
      })),
    };
  },
  
  /**
   * Check for anomalies in shifts
   */
  async checkAnomalies(threshold: number = 50): Promise<{
    cashDifferenceWarnings: Shift[];
    longShifts: Shift[];
    highDiscountShifts: Shift[];
  }> {
    const openShifts = await this.getOpenShifts();
    
    // Get today's closed shifts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayShifts = await this.getShifts(today, new Date());
    
    const allShifts = [...openShifts, ...todayShifts];
    
    return {
      // Cash difference exceeds threshold
      cashDifferenceWarnings: allShifts.filter(
        s => s.cashDifference !== undefined && Math.abs(s.cashDifference) > threshold
      ),
      // Shifts longer than 12 hours
      longShifts: allShifts.filter(
        s => s.duration !== undefined && s.duration > 720 // 12 hours in minutes
      ),
      // High discount percentage (> 10% of sales)
      highDiscountShifts: allShifts.filter(
        s => s.totalSales > 0 && (s.totalDiscounts / s.totalSales) > 0.1
      ),
    };
  },
};

export default shiftService;
