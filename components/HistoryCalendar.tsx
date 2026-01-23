/**
 * HistoryCalendar.tsx
 * Calendar-based history view for orders, sales, and daily logs
 * v2.3 - CaissaPro
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Clock,
  CreditCard,
  Banknote,
  ReceiptText,
  Package,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getDatabase } from '../lib/offline-db';
import { colors, spacing } from '../lib/theme';

// ============================================================================
// TYPES
// ============================================================================

interface HistoryCalendarProps {
  visible: boolean;
  onClose: () => void;
}

interface DayData {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  expenses: number;
  netProfit: number;
  avgBasket: number;
}

interface OrderSummary {
  id: string;
  orderNumber: number;
  totalAmount: number;
  paymentMethod: string;
  itemCount: number;
  paidAt: string;
  cashierName?: string;
}

interface DayDetails {
  date: string;
  orders: OrderSummary[];
  totalRevenue: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  expenses: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  hourlyBreakdown: { hour: number; orders: number; revenue: number }[];
}

// ============================================================================
// CALENDAR COMPONENT
// ============================================================================

export function HistoryCalendar({ visible, onClose }: HistoryCalendarProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
  // State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthData, setMonthData] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<DayDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Calendar helpers
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  
  // Get days in month
  const getDaysInMonth = useCallback((year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  }, []);
  
  // Get first day of month (0 = Sunday)
  const getFirstDayOfMonth = useCallback((year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  }, []);
  
  // Format date as YYYY-MM-DD
  const formatDate = (year: number, month: number, day: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  
  // Load month data
  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const database = await getDatabase();
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      const startDate = formatDate(year, month, 1);
      const endDate = formatDate(year, month, getDaysInMonth(year, month));
      
      // Get orders grouped by date
      const orders = await database.getAllAsync<{
        date: string;
        total_revenue: number;
        order_count: number;
        cash_sales: number;
        card_sales: number;
      }>(`
        SELECT 
          DATE(paid_at) as date,
          SUM(total_amount) as total_revenue,
          COUNT(*) as order_count,
          SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END) as cash_sales,
          SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END) as card_sales
        FROM orders 
        WHERE status = 'PAID' 
          AND DATE(paid_at) >= ? 
          AND DATE(paid_at) <= ?
        GROUP BY DATE(paid_at)
      `, [startDate, endDate]);
      
      // Get expenses grouped by date
      const expenses = await database.getAllAsync<{
        date: string;
        total_expenses: number;
      }>(`
        SELECT 
          DATE(date) as date,
          SUM(amount) as total_expenses
        FROM expenses
        WHERE DATE(date) >= ? AND DATE(date) <= ?
        GROUP BY DATE(date)
      `, [startDate, endDate]);
      
      // Build month data map
      const dataMap = new Map<string, DayData>();
      
      for (const order of orders) {
        const expense = expenses.find(e => e.date === order.date);
        const expenseAmount = expense?.total_expenses || 0;
        
        dataMap.set(order.date, {
          date: order.date,
          totalRevenue: order.total_revenue || 0,
          totalOrders: order.order_count || 0,
          cashSales: order.cash_sales || 0,
          cardSales: order.card_sales || 0,
          expenses: expenseAmount,
          netProfit: (order.total_revenue || 0) - expenseAmount,
          avgBasket: order.order_count > 0 ? (order.total_revenue || 0) / order.order_count : 0,
        });
      }
      
      // Add days with only expenses
      for (const expense of expenses) {
        if (!dataMap.has(expense.date)) {
          dataMap.set(expense.date, {
            date: expense.date,
            totalRevenue: 0,
            totalOrders: 0,
            cashSales: 0,
            cardSales: 0,
            expenses: expense.total_expenses || 0,
            netProfit: -(expense.total_expenses || 0),
            avgBasket: 0,
          });
        }
      }
      
      setMonthData(dataMap);
    } catch (error) {
      console.error('[HISTORY] Error loading month data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, getDaysInMonth]);
  
  // Load day details
  const loadDayDetails = useCallback(async (date: string) => {
    setLoadingDetails(true);
    try {
      const database = await getDatabase();
      
      // Get all orders for the day
      const orders = await database.getAllAsync<{
        id: string;
        order_number: number;
        total_amount: number;
        payment_method: string;
        paid_at: string;
        cashier_name: string | null;
        item_count: number;
      }>(`
        SELECT 
          o.id, 
          o.order_number, 
          o.total_amount, 
          o.payment_method, 
          o.paid_at,
          u.name as cashier_name,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        LEFT JOIN users u ON o.cashier_id = u.id
        WHERE o.status = 'PAID' AND DATE(o.paid_at) = ?
        ORDER BY o.paid_at DESC
      `, [date]);
      
      // Get top products
      const topProducts = await database.getAllAsync<{
        name: string;
        quantity: number;
        revenue: number;
      }>(`
        SELECT 
          oi.product_name as name,
          SUM(oi.quantity) as quantity,
          SUM(oi.price * oi.quantity) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'PAID' AND DATE(o.paid_at) = ?
        GROUP BY oi.product_name
        ORDER BY quantity DESC
        LIMIT 10
      `, [date]);
      
      // Get hourly breakdown
      const hourlyBreakdown = await database.getAllAsync<{
        hour: number;
        orders: number;
        revenue: number;
      }>(`
        SELECT 
          CAST(strftime('%H', paid_at) AS INTEGER) as hour,
          COUNT(*) as orders,
          SUM(total_amount) as revenue
        FROM orders
        WHERE status = 'PAID' AND DATE(paid_at) = ?
        GROUP BY strftime('%H', paid_at)
        ORDER BY hour
      `, [date]);
      
      // Calculate totals
      const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
      const cashSales = orders.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + o.total_amount, 0);
      const cardSales = orders.filter(o => o.payment_method === 'card').reduce((sum, o) => sum + o.total_amount, 0);
      
      // Get expenses
      const expenseResult = await database.getFirstAsync<{ total: number }>(`
        SELECT SUM(amount) as total FROM expenses WHERE DATE(date) = ?
      `, [date]);
      
      setDayDetails({
        date,
        orders: orders.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          totalAmount: o.total_amount,
          paymentMethod: o.payment_method,
          itemCount: o.item_count,
          paidAt: o.paid_at,
          cashierName: o.cashier_name || undefined,
        })),
        totalRevenue,
        totalOrders: orders.length,
        cashSales,
        cardSales,
        expenses: expenseResult?.total || 0,
        topProducts,
        hourlyBreakdown,
      });
    } catch (error) {
      console.error('[HISTORY] Error loading day details:', error);
    } finally {
      setLoadingDetails(false);
    }
  }, []);
  
  // Effects
  useEffect(() => {
    if (visible) {
      loadMonthData();
    }
  }, [visible, loadMonthData]);
  
  useEffect(() => {
    if (selectedDate) {
      loadDayDetails(selectedDate);
    }
  }, [selectedDate, loadDayDetails]);
  
  // Navigation
  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDate(null);
    setDayDetails(null);
  };
  
  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDate(null);
    setDayDetails(null);
  };
  
  // Calculate month summary
  const monthSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalExpenses = 0;
    let activeDays = 0;
    
    monthData.forEach(day => {
      totalRevenue += day.totalRevenue;
      totalOrders += day.totalOrders;
      totalExpenses += day.expenses;
      if (day.totalOrders > 0) activeDays++;
    });
    
    return {
      totalRevenue,
      totalOrders,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      activeDays,
      avgDailyRevenue: activeDays > 0 ? totalRevenue / activeDays : 0,
    };
  }, [monthData]);
  
  // Render calendar day
  const renderCalendarDay = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={{ width: `${100/7}%`, aspectRatio: 1 }} />;
    }
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateStr = formatDate(year, month, day);
    const data = monthData.get(dateStr);
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    const isSelected = dateStr === selectedDate;
    const hasData = data && data.totalOrders > 0;
    
    return (
      <TouchableOpacity
        key={dateStr}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedDate(dateStr);
        }}
        style={{
          width: `${100/7}%`,
          aspectRatio: 1,
          padding: 2,
        }}
      >
        <View style={{
          flex: 1,
          borderRadius: 8,
          backgroundColor: isSelected ? colors.primary : isToday ? colors.primaryLight : hasData ? '#F0FDF4' : '#FAFAFA',
          borderWidth: isToday && !isSelected ? 2 : 0,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        }}>
          <Text style={{
            fontSize: isTablet ? 14 : 12,
            fontWeight: isToday || isSelected ? '700' : '500',
            color: isSelected ? colors.white : isToday ? colors.primary : colors.textPrimary,
          }}>
            {day}
          </Text>
          {hasData && (
            <Text style={{
              fontSize: isTablet ? 10 : 8,
              fontWeight: '600',
              color: isSelected ? colors.white : colors.success,
              marginTop: 2,
            }}>
              {data.totalRevenue >= 1000 ? `${(data.totalRevenue/1000).toFixed(1)}k` : Math.round(data.totalRevenue)}
            </Text>
          )}
          {data && data.totalOrders > 0 && (
            <View style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isSelected ? colors.white : colors.success,
            }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: (number | null)[] = [];
    
    // Add empty cells for days before first of month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  }, [currentMonth, getDaysInMonth, getFirstDayOfMonth]);
  
  // Format time
  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };
  
  // Format date display
  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };
  
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#E8E8E8',
          borderBottomWidth: 1,
          borderBottomColor: '#CFCFCF',
        }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8, marginRight: 8 }}>
            <X size={20} color="#555555" />
          </TouchableOpacity>
          <Calendar size={20} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>
            Historique des Ventes
          </Text>
        </View>
        
        <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
          {/* Calendar Section */}
          <View style={{ flex: isTablet ? 1 : undefined, padding: spacing.md }}>
            {/* Month Navigation */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing.md,
              backgroundColor: colors.white,
              borderRadius: 12,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}>
              <TouchableOpacity onPress={goToPreviousMonth} style={{ padding: 8 }}>
                <ChevronLeft size={24} color={colors.primary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} style={{ padding: 8 }}>
                <ChevronRight size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {/* Month Summary */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginBottom: spacing.md,
            }}>
              <View style={{
                flex: 1,
                minWidth: 100,
                backgroundColor: colors.white,
                borderRadius: 10,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: '#CFCFCF',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <DollarSign size={14} color={colors.success} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>CA Mois</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.success }}>
                  {monthSummary.totalRevenue.toFixed(0)} DH
                </Text>
              </View>
              
              <View style={{
                flex: 1,
                minWidth: 100,
                backgroundColor: colors.white,
                borderRadius: 10,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: '#CFCFCF',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShoppingCart size={14} color={colors.primary} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Commandes</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>
                  {monthSummary.totalOrders}
                </Text>
              </View>
              
              <View style={{
                flex: 1,
                minWidth: 100,
                backgroundColor: colors.white,
                borderRadius: 10,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: '#CFCFCF',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <TrendingUp size={14} color={monthSummary.netProfit >= 0 ? colors.success : colors.error} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Bénéfice</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: monthSummary.netProfit >= 0 ? colors.success : colors.error }}>
                  {monthSummary.netProfit.toFixed(0)} DH
                </Text>
              </View>
            </View>
            
            {/* Calendar Grid */}
            <View style={{
              backgroundColor: colors.white,
              borderRadius: 12,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ paddingVertical: 40 }} />
              ) : (
                <>
                  {/* Day headers */}
                  <View style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
                    {dayNames.map(day => (
                      <View key={day} style={{ width: `${100/7}%`, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                          {day}
                        </Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Calendar days */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {calendarDays.map((day, index) => renderCalendarDay(day, index))}
                  </View>
                </>
              )}
            </View>
          </View>
          
          {/* Day Details Section */}
          {(isTablet || selectedDate) && (
            <View style={{
              flex: isTablet ? 1.2 : 1,
              backgroundColor: colors.white,
              borderLeftWidth: isTablet ? 1 : 0,
              borderTopWidth: isTablet ? 0 : 1,
              borderColor: '#CFCFCF',
            }}>
              {selectedDate && dayDetails ? (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {/* Date Header */}
                  <View style={{
                    padding: spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: '#ECECEC',
                  }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, textTransform: 'capitalize' }}>
                      {formatDateDisplay(selectedDate)}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                      {dayDetails.totalOrders} commandes • {dayDetails.totalRevenue.toFixed(0)} DH
                    </Text>
                  </View>
                  
                  {loadingDetails ? (
                    <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
                  ) : (
                    <>
                      {/* Stats Cards */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm }}>
                        <View style={{
                          flex: 1,
                          minWidth: 120,
                          backgroundColor: '#E8F8EB',
                          borderRadius: 10,
                          padding: spacing.md,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Banknote size={16} color={colors.success} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Espèces</Text>
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.success, marginTop: 4 }}>
                            {dayDetails.cashSales.toFixed(0)} DH
                          </Text>
                        </View>
                        
                        <View style={{
                          flex: 1,
                          minWidth: 120,
                          backgroundColor: '#E5F1FF',
                          borderRadius: 10,
                          padding: spacing.md,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <CreditCard size={16} color={colors.primary} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Carte</Text>
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: 4 }}>
                            {dayDetails.cardSales.toFixed(0)} DH
                          </Text>
                        </View>
                        
                        {dayDetails.expenses > 0 && (
                          <View style={{
                            flex: 1,
                            minWidth: 120,
                            backgroundColor: '#FFF5F5',
                            borderRadius: 10,
                            padding: spacing.md,
                          }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <TrendingDown size={16} color={colors.error} />
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Dépenses</Text>
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.error, marginTop: 4 }}>
                              -{dayDetails.expenses.toFixed(0)} DH
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Top Products */}
                      {dayDetails.topProducts.length > 0 && (
                        <View style={{ padding: spacing.md, paddingTop: 0 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
                            <Package size={14} color={colors.primary} /> Top Produits
                          </Text>
                          {dayDetails.topProducts.slice(0, 5).map((product, index) => (
                            <View key={index} style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 8,
                              borderBottomWidth: index < 4 ? 1 : 0,
                              borderBottomColor: '#ECECEC',
                            }}>
                              <View style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: colors.primaryLight,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: spacing.sm,
                              }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                                  {index + 1}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textPrimary }} numberOfLines={1}>
                                  {product.name}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                                  {product.quantity} vendus
                                </Text>
                              </View>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.success }}>
                                {product.revenue.toFixed(0)} DH
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      
                      {/* Hourly Chart (Simple text version) */}
                      {dayDetails.hourlyBreakdown.length > 0 && (
                        <View style={{ padding: spacing.md, paddingTop: 0 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
                            <Clock size={14} color={colors.primary} /> Par Heure
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {dayDetails.hourlyBreakdown.map((hour, index) => (
                              <View key={index} style={{
                                backgroundColor: colors.primaryLight,
                                borderRadius: 8,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                              }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>
                                  {hour.hour}h: {hour.orders} cmd
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                      
                      {/* Orders List */}
                      <View style={{ padding: spacing.md, paddingTop: 0 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
                          <ReceiptText size={14} color={colors.primary} /> Commandes ({dayDetails.orders.length})
                        </Text>
                        
                        {dayDetails.orders.length === 0 ? (
                          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                            <ReceiptText size={40} color={colors.textMuted} />
                            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12 }}>
                              Aucune commande ce jour
                            </Text>
                          </View>
                        ) : (
                          dayDetails.orders.map((order, index) => (
                            <View key={order.id} style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12,
                              borderBottomWidth: index < dayDetails.orders.length - 1 ? 1 : 0,
                              borderBottomColor: '#ECECEC',
                            }}>
                              <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: order.paymentMethod === 'cash' ? '#E8F8EB' : '#E5F1FF',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: spacing.sm,
                              }}>
                                {order.paymentMethod === 'cash' ? (
                                  <Banknote size={18} color={colors.success} />
                                ) : (
                                  <CreditCard size={18} color={colors.primary} />
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                                  Commande #{order.orderNumber}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                  {formatTime(order.paidAt)} • {order.itemCount} article{order.itemCount > 1 ? 's' : ''}
                                  {order.cashierName ? ` • ${order.cashierName}` : ''}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.success }}>
                                {order.totalAmount.toFixed(0)} DH
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    </>
                  )}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
                  <Calendar size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
                    Sélectionnez un jour{'\n'}pour voir les détails
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default HistoryCalendar;
