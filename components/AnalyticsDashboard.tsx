/**
 * AnalyticsDashboard.tsx
 * v2.2 Production Polish - Visual analytics with charts
 * Fully offline-first with SQLite data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Banknote,
  Clock,
  ChevronLeft,
  ChevronRight,
  Percent,
  BarChart3,
} from 'lucide-react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { colors, spacing, borderRadius, fontSize, shadows } from '../lib/theme';
import {
  analyticsService,
  DailyStatsExtended,
  TopProduct,
  HourlyStats,
  WeeklyTrend,
} from '../lib/offline-db';

interface AnalyticsDashboardProps {
  visible: boolean;
  onClose: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  visible,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyStats, setDailyStats] = useState<DailyStatsExtended | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  
  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load all analytics in parallel
      const [stats, weekly, hourly, products] = await Promise.all([
        analyticsService.getDailyStatsForDate(selectedDate),
        analyticsService.getWeeklyTrend(),
        analyticsService.getHourlyStats(selectedDate),
        analyticsService.getTopProducts(selectedDate, selectedDate, 5),
      ]);
      
      setDailyStats(stats);
      setWeeklyTrend(weekly);
      setHourlyStats(hourly);
      setTopProducts(products);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);
  
  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);
  
  // Navigate dates
  const goToPreviousDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };
  
  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    if (next <= new Date()) {
      setSelectedDate(next);
    }
  };
  
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  
  // Format number for display
  const formatNumber = (n: number) => {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k`;
    }
    return Math.round(n).toString();
  };
  
  // Prepare chart data
  const weeklyChartData = weeklyTrend.map((day, i) => ({
    value: day.revenue,
    label: day.dayName,
    frontColor: i === weeklyTrend.length - 1 ? colors.primary : colors.primaryLight,
    topLabelComponent: () => (
      <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>
        {formatNumber(day.revenue)}
      </Text>
    ),
  }));
  
  // Hourly chart data (prepared for future use)
  // const hourlyChartData = hourlyStats
  //   .filter(h => h.hour >= 8 && h.hour <= 22)
  //   .map(h => ({ value: h.orders, dataPointText: h.orders > 0 ? h.orders.toString() : '' }));
  
  const paymentPieData = dailyStats ? [
    {
      value: dailyStats.cashRevenue,
      color: colors.success,
      text: 'Espèces',
      focused: dailyStats.cashRevenue > dailyStats.cardRevenue,
    },
    {
      value: dailyStats.cardRevenue,
      color: colors.primary,
      text: 'Carte',
      focused: dailyStats.cardRevenue > dailyStats.cashRevenue,
    },
  ].filter(d => d.value > 0) : [];
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ECECEC' }}>
        {/* Header - macOS style */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: '#E8E8E8',
          borderBottomWidth: 1,
          borderBottomColor: '#CFCFCF',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={22} color="#007AFF" />
            </View>
            <View>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: '#333333' }}>
                Tableau de Bord
              </Text>
              <Text style={{ fontSize: fontSize.sm, color: '#666666' }}>
                Statistiques et Analyses
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={onClose}
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              backgroundColor: '#E8E8E8',
              borderWidth: 1,
              borderColor: '#C8C8C8',
              alignItems: 'center', 
              justifyContent: 'center',
            }}
          >
            <X size={16} color="#666666" />
          </TouchableOpacity>
        </View>
        
        {/* Date Navigator */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: colors.white,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        }}>
          <TouchableOpacity onPress={goToPreviousDay} style={{ padding: spacing.sm }}>
            <ChevronLeft size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary }}>
              {isToday ? "Aujourd'hui" : selectedDate.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </Text>
            {!isToday && (
              <TouchableOpacity onPress={() => setSelectedDate(new Date())}>
                <Text style={{ fontSize: fontSize.xs, color: colors.primary }}>
                  ← Retour à aujourd'hui
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            onPress={goToNextDay} 
            style={{ padding: spacing.sm, opacity: isToday ? 0.3 : 1 }}
            disabled={isToday}
          >
            <ChevronRight size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>
              Chargement des statistiques...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => {
                setRefreshing(true);
                loadData();
              }} />
            }
          >
            {/* ========== KPI CARDS ========== */}
            <View style={{ 
              flexDirection: 'row', 
              flexWrap: 'wrap', 
              gap: spacing.md,
              marginBottom: spacing.xl,
            }}>
              {/* Total Revenue */}
              <View style={{
                flex: 1,
                minWidth: isTablet ? 200 : 150,
                backgroundColor: colors.primary,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                ...shadows.md,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Banknote size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)' }}>
                    Chiffre d'affaires
                  </Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white }}>
                  {dailyStats?.totalRevenue.toFixed(0) || '0'} <Text style={{ fontSize: 16 }}>DH</Text>
                </Text>
              </View>
              
              {/* Orders Count */}
              <View style={{
                flex: 1,
                minWidth: isTablet ? 200 : 150,
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                ...shadows.md,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <ShoppingBag size={20} color={colors.success} />
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Commandes payées
                  </Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.success }}>
                  {dailyStats?.paidOrders || 0}
                </Text>
              </View>
              
              {/* Average Order Value */}
              <View style={{
                flex: 1,
                minWidth: isTablet ? 200 : 150,
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                ...shadows.md,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <TrendingUp size={20} color={colors.warning} />
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Panier moyen
                  </Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.warning }}>
                  {dailyStats?.avgOrderValue.toFixed(0) || '0'} <Text style={{ fontSize: 16 }}>DH</Text>
                </Text>
              </View>
              
              {/* Peak Hour */}
              <View style={{
                flex: 1,
                minWidth: isTablet ? 200 : 150,
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                ...shadows.md,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Clock size={20} color={colors.error} />
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Heure de pointe
                  </Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '800', color: colors.error }}>
                  {dailyStats?.peakHour !== null ? `${dailyStats.peakHour}h` : '-'}
                </Text>
                {dailyStats?.peakHourOrders ? (
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                    {dailyStats.peakHourOrders} commandes
                  </Text>
                ) : null}
              </View>
            </View>
            
            {/* ========== WEEKLY TREND CHART ========== */}
            <View style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.xl,
              padding: spacing.lg,
              marginBottom: spacing.xl,
              ...shadows.md,
            }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg }}>
                Tendance des 7 derniers jours
              </Text>
              {weeklyChartData.length > 0 ? (
                <BarChart
                  data={weeklyChartData}
                  barWidth={isTablet ? 40 : 28}
                  spacing={isTablet ? 30 : 20}
                  noOfSections={4}
                  yAxisThickness={0}
                  xAxisThickness={1}
                  xAxisColor={colors.borderLight}
                  hideRules
                  barBorderRadius={6}
                  frontColor={colors.primaryLight}
                  isAnimated
                  animationDuration={500}
                />
              ) : (
                <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.xl }}>
                  Pas de données disponibles
                </Text>
              )}
            </View>
            
            {/* ========== PAYMENT BREAKDOWN & TOP PRODUCTS ========== */}
            <View style={{ 
              flexDirection: isTablet ? 'row' : 'column', 
              gap: spacing.lg,
              marginBottom: spacing.xl,
            }}>
              {/* Payment Methods Pie Chart */}
              <View style={{
                flex: 1,
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                ...shadows.md,
              }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg }}>
                  Modes de paiement
                </Text>
                {paymentPieData.length > 0 ? (
                  <View style={{ alignItems: 'center' }}>
                    <PieChart
                      data={paymentPieData}
                      donut
                      radius={70}
                      innerRadius={45}
                      centerLabelComponent={() => (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                            {dailyStats?.totalRevenue.toFixed(0)}
                          </Text>
                          <Text style={{ fontSize: 10, color: colors.textMuted }}>DH</Text>
                        </View>
                      )}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success }} />
                        <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                          Espèces: {dailyStats?.cashRevenue.toFixed(0)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />
                        <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                          Carte: {dailyStats?.cardRevenue.toFixed(0)} DH
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.xl }}>
                    Aucune vente
                  </Text>
                )}
              </View>
              
              {/* Top Products */}
              <View style={{
                flex: 1,
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
                ...shadows.md,
              }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg }}>
                  Top 5 Produits
                </Text>
                {topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <View 
                      key={product.productId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: spacing.sm,
                        borderBottomWidth: index < topProducts.length - 1 ? 1 : 0,
                        borderBottomColor: colors.borderLight,
                      }}
                    >
                      <View style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : colors.background,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: spacing.sm,
                      }}>
                        <Text style={{ 
                          fontSize: fontSize.sm, 
                          fontWeight: '700', 
                          color: index < 3 ? colors.white : colors.textSecondary 
                        }}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                          {product.productName}
                        </Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                          {product.totalQuantity} vendus
                        </Text>
                      </View>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.success }}>
                        {product.totalRevenue.toFixed(0)} DH
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.xl }}>
                    Aucun produit vendu
                  </Text>
                )}
              </View>
            </View>
            
            {/* ========== EXTRA STATS ========== */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.md,
              marginBottom: spacing.xl,
            }}>
              {/* Total Discounts */}
              <View style={{
                flex: 1,
                minWidth: 150,
                backgroundColor: colors.white,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.warningLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Percent size={22} color={colors.warning} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Remises accordées</Text>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.warning }}>
                    {dailyStats?.totalDiscount.toFixed(0) || '0'} DH
                  </Text>
                </View>
              </View>
              
              {/* Cancelled Orders */}
              <View style={{
                flex: 1,
                minWidth: 150,
                backgroundColor: colors.white,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.errorLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <TrendingDown size={22} color={colors.error} />
                </View>
                <View>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Commandes annulées</Text>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.error }}>
                    {dailyStats?.cancelledOrders || 0}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Footer spacing */}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default AnalyticsDashboard;
