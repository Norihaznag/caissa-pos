/**
 * staffAnalytics.ts
 * v2.3 - Staff performance analytics for CaissaPro
 * All queries are offline-first using SQLite
 */

import { getDatabase } from '../offline-db';

// ============================================================================
// TYPES
// ============================================================================

export interface StaffPerformance {
  userId: string;
  userName: string;
  userRole: string;
  ordersCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  avgBasket: number;
  totalDiscounts: number;
  cancelledOrders: number;
  totalShiftHours: number;
  shiftsCount: number;
}

export interface StaffTopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export interface StaffHourlyStats {
  hour: number;
  orders: number;
  revenue: number;
}

export interface StaffDetailedPerformance extends StaffPerformance {
  topProducts: StaffTopProduct[];
  hourlyStats: StaffHourlyStats[];
  performanceRating: 'excellent' | 'good' | 'average' | 'needs_improvement';
}

export interface TeamOverview {
  totalStaff: number;
  activeToday: number;
  openShifts: number;
  totalSalesToday: number;
  avgSalesPerStaff: number;
  topPerformer?: {
    userId: string;
    userName: string;
    revenue: number;
  };
}

// ============================================================================
// STAFF ANALYTICS SERVICE
// ============================================================================

export const staffAnalyticsService = {
  /**
   * Get performance for all staff in a date range
   */
  async getTeamPerformance(
    startDate: Date,
    endDate: Date,
    role?: 'admin' | 'cashier' | 'waiter'
  ): Promise<StaffPerformance[]> {
    const database = await getDatabase();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    console.log('[STAFF_ANALYTICS] Getting team performance:', startDate.toISOString(), 'to', endDate.toISOString());
    
    let query = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.role as user_role,
        COUNT(DISTINCT CASE WHEN o.status = 'PAID' THEN o.id END) as orders_count,
        COALESCE(SUM(CASE WHEN o.status = 'PAID' THEN o.total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'PAID' AND o.payment_method = 'cash' THEN o.total_amount ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'PAID' AND o.payment_method = 'card' THEN o.total_amount ELSE 0 END), 0) as card_revenue,
        COALESCE(SUM(CASE WHEN o.status = 'PAID' THEN o.discount ELSE 0 END), 0) as total_discounts,
        COUNT(DISTINCT CASE WHEN o.status = 'CANCELLED' THEN o.id END) as cancelled_orders
      FROM users u
      LEFT JOIN orders o ON (o.cashier_id = u.id OR o.waiter_id = u.id)
        AND o.paid_at >= ? AND o.paid_at <= ?
      WHERE u.is_active = 1
    `;
    
    const params: any[] = [startDate.toISOString(), endDate.toISOString()];
    
    if (role) {
      query += ` AND u.role = ?`;
      params.push(role);
    }
    
    query += ` GROUP BY u.id, u.name, u.role ORDER BY total_revenue DESC`;
    
    const results = await database.getAllAsync<{
      user_id: string;
      user_name: string;
      user_role: string;
      orders_count: number;
      total_revenue: number;
      cash_revenue: number;
      card_revenue: number;
      total_discounts: number;
      cancelled_orders: number;
    }>(query, params);
    
    // Get shift hours for each user
    const performance: StaffPerformance[] = [];
    
    for (const r of results) {
      // Get shift data
      const shiftStats = await database.getFirstAsync<{
        total_hours: number;
        shifts_count: number;
      }>(`
        SELECT 
          COALESCE(SUM(
            CAST((julianday(COALESCE(closed_at, datetime('now'))) - julianday(opened_at)) * 24 AS REAL)
          ), 0) as total_hours,
          COUNT(*) as shifts_count
        FROM shifts
        WHERE user_id = ? AND opened_at >= ? AND opened_at <= ?
      `, [r.user_id, startDate.toISOString(), endDate.toISOString()]);
      
      performance.push({
        userId: r.user_id,
        userName: r.user_name,
        userRole: r.user_role,
        ordersCount: r.orders_count,
        totalRevenue: r.total_revenue,
        cashRevenue: r.cash_revenue,
        cardRevenue: r.card_revenue,
        avgBasket: r.orders_count > 0 ? Math.round((r.total_revenue / r.orders_count) * 100) / 100 : 0,
        totalDiscounts: r.total_discounts,
        cancelledOrders: r.cancelled_orders,
        totalShiftHours: Math.round((shiftStats?.total_hours || 0) * 100) / 100,
        shiftsCount: shiftStats?.shifts_count || 0,
      });
    }
    
    return performance;
  },
  
  /**
   * Get detailed performance for a single staff member
   */
  async getStaffDetailedPerformance(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StaffDetailedPerformance | null> {
    const database = await getDatabase();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    console.log('[STAFF_ANALYTICS] Getting detailed performance for:', userId);
    
    // Get basic performance
    const teamPerformance = await this.getTeamPerformance(startDate, endDate);
    const staffPerf = teamPerformance.find(p => p.userId === userId);
    
    if (!staffPerf) return null;
    
    // Get top products for this staff
    const topProducts = await database.getAllAsync<{
      product_id: string;
      product_name: string;
      quantity: number;
      revenue: number;
    }>(`
      SELECT 
        oi.product_id,
        oi.product_name,
        SUM(oi.quantity) as quantity,
        SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'PAID'
        AND (o.cashier_id = ? OR o.waiter_id = ?)
        AND o.paid_at >= ? AND o.paid_at <= ?
      GROUP BY oi.product_id, oi.product_name
      ORDER BY quantity DESC
      LIMIT 10
    `, [userId, userId, startDate.toISOString(), endDate.toISOString()]);
    
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
        AND (cashier_id = ? OR waiter_id = ?)
        AND paid_at >= ? AND paid_at <= ?
      GROUP BY hour
      ORDER BY hour
    `, [userId, userId, startDate.toISOString(), endDate.toISOString()]);
    
    // Calculate performance rating
    let performanceRating: 'excellent' | 'good' | 'average' | 'needs_improvement' = 'average';
    
    // Compare to team average
    const avgRevenue = teamPerformance.reduce((sum, p) => sum + p.totalRevenue, 0) / teamPerformance.length;
    const avgOrders = teamPerformance.reduce((sum, p) => sum + p.ordersCount, 0) / teamPerformance.length;
    
    if (staffPerf.totalRevenue > avgRevenue * 1.3 && staffPerf.ordersCount > avgOrders * 1.2) {
      performanceRating = 'excellent';
    } else if (staffPerf.totalRevenue > avgRevenue && staffPerf.ordersCount > avgOrders) {
      performanceRating = 'good';
    } else if (staffPerf.totalRevenue < avgRevenue * 0.7 || staffPerf.cancelledOrders > staffPerf.ordersCount * 0.1) {
      performanceRating = 'needs_improvement';
    }
    
    return {
      ...staffPerf,
      topProducts: topProducts.map(p => ({
        productId: p.product_id,
        productName: p.product_name,
        quantity: p.quantity,
        revenue: p.revenue,
      })),
      hourlyStats: hourlyStats.map(h => ({
        hour: h.hour,
        orders: h.orders,
        revenue: h.revenue,
      })),
      performanceRating,
    };
  },
  
  /**
   * Get team overview for today
   */
  async getTodayOverview(): Promise<TeamOverview> {
    const database = await getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    
    console.log('[STAFF_ANALYTICS] Getting today overview');
    
    // Get total active staff
    const staffCount = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM users WHERE is_active = 1`
    );
    
    // Get open shifts
    const openShifts = await database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM shifts WHERE status = 'OPEN'`
    );
    
    // Get unique staff who worked today
    const activeStaff = await database.getFirstAsync<{ count: number }>(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM shifts
      WHERE opened_at >= ?
    `, [today.toISOString()]);
    
    // Get total sales today
    const salesStats = await database.getFirstAsync<{
      total_sales: number;
    }>(`
      SELECT COALESCE(SUM(total_amount), 0) as total_sales
      FROM orders
      WHERE status = 'PAID' AND paid_at >= ?
    `, [today.toISOString()]);
    
    // Get top performer today
    const topPerformer = await database.getFirstAsync<{
      user_id: string;
      user_name: string;
      revenue: number;
    }>(`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        COALESCE(SUM(o.total_amount), 0) as revenue
      FROM users u
      JOIN orders o ON (o.cashier_id = u.id OR o.waiter_id = u.id)
      WHERE o.status = 'PAID' AND o.paid_at >= ?
      GROUP BY u.id, u.name
      ORDER BY revenue DESC
      LIMIT 1
    `, [today.toISOString()]);
    
    const totalStaff = staffCount?.count || 0;
    const activeToday = activeStaff?.count || 0;
    const totalSalesToday = salesStats?.total_sales || 0;
    
    return {
      totalStaff,
      activeToday,
      openShifts: openShifts?.count || 0,
      totalSalesToday,
      avgSalesPerStaff: activeToday > 0 ? Math.round((totalSalesToday / activeToday) * 100) / 100 : 0,
      topPerformer: topPerformer?.revenue > 0 ? {
        userId: topPerformer.user_id,
        userName: topPerformer.user_name,
        revenue: topPerformer.revenue,
      } : undefined,
    };
  },
  
  /**
   * Get comparison between two staff members
   */
  async compareStaff(
    userId1: string,
    userId2: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    staff1: StaffPerformance | null;
    staff2: StaffPerformance | null;
    comparison: {
      revenueLeader: string;
      ordersLeader: string;
      avgBasketLeader: string;
    };
  }> {
    const performance = await this.getTeamPerformance(startDate, endDate);
    const staff1 = performance.find(p => p.userId === userId1) || null;
    const staff2 = performance.find(p => p.userId === userId2) || null;
    
    return {
      staff1,
      staff2,
      comparison: {
        revenueLeader: staff1 && staff2 
          ? (staff1.totalRevenue >= staff2.totalRevenue ? staff1.userName : staff2.userName)
          : 'N/A',
        ordersLeader: staff1 && staff2
          ? (staff1.ordersCount >= staff2.ordersCount ? staff1.userName : staff2.userName)
          : 'N/A',
        avgBasketLeader: staff1 && staff2
          ? (staff1.avgBasket >= staff2.avgBasket ? staff1.userName : staff2.userName)
          : 'N/A',
      },
    };
  },
  
  /**
   * Get staff ranking for gamification
   */
  async getStaffRanking(
    startDate: Date,
    endDate: Date,
    metric: 'revenue' | 'orders' | 'avgBasket' = 'revenue'
  ): Promise<Array<StaffPerformance & { rank: number }>> {
    const performance = await this.getTeamPerformance(startDate, endDate);
    
    // Sort by chosen metric
    const sorted = [...performance].sort((a, b) => {
      switch (metric) {
        case 'orders': return b.ordersCount - a.ordersCount;
        case 'avgBasket': return b.avgBasket - a.avgBasket;
        default: return b.totalRevenue - a.totalRevenue;
      }
    });
    
    return sorted.map((p, index) => ({
      ...p,
      rank: index + 1,
    }));
  },
};

export default staffAnalyticsService;
