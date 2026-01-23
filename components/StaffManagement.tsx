/**
 * StaffManagement.tsx
 * v2.3 - Complete staff management UI for CaissaPro Admin
 * Includes: Shifts, Planning, Salaires, Performance
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Users,
  Clock,
  Calendar,
  Wallet,
  TrendingUp,
  Play,
  Square,
  ChevronRight,
  AlertTriangle,
  Plus,
  Edit3,
  Printer,
  DollarSign,
  Award,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, fontSize, shadows } from '../lib/theme';
import { shiftService, Shift, ShiftSummary } from '../lib/shifts/shiftService';
import { staffAnalyticsService, StaffPerformance, TeamOverview } from '../lib/analytics/staffAnalytics';
import { payrollService, PayrollEntry, StaffCompensation } from '../lib/payroll/payrollService';
import { scheduleService, PlannedShift, WeekSchedule } from '../lib/schedule/scheduleService';
import { getDatabase } from '../lib/offline-db';

// ============================================================================
// TYPES
// ============================================================================

interface StaffManagementProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'shifts' | 'planning' | 'salaires' | 'performance';

interface User {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const StaffManagement: React.FC<StaffManagementProps> = ({ visible, onClose }) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [openShifts, setOpenShifts] = useState<Shift[]>([]);
  const [todayShifts, setTodayShifts] = useState<Shift[]>([]);
  const [teamOverview, setTeamOverview] = useState<TeamOverview | null>(null);
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<PayrollEntry[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<StaffPerformance[]>([]);
  const [compensations, setCompensations] = useState<StaffCompensation[]>([]);
  
  // Modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState(false);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showCompensationModal, setShowCompensationModal] = useState(false);
  
  // Form states
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  
  // Date range for analytics
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setDate(new Date().getDate() - 7)),
    end: new Date(),
  });
  
  // ============================================================================
  // DATA LOADING
  // ============================================================================
  
  const loadUsers = async () => {
    const database = await getDatabase();
    const result = await database.getAllAsync<{
      id: string;
      name: string;
      role: string;
      is_active: number;
    }>(`SELECT id, name, role, is_active FROM users WHERE is_active = 1 ORDER BY name`);
    
    setUsers(result.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      isActive: u.is_active === 1,
    })));
  };
  
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      await loadUsers();
      
      // Load based on active tab
      const [open, overview, compensationsList] = await Promise.all([
        shiftService.getOpenShifts(),
        staffAnalyticsService.getTodayOverview(),
        payrollService.getAllCompensations(),
      ]);
      
      setOpenShifts(open);
      setTeamOverview(overview);
      setCompensations(compensationsList);
      
      // Load today's shifts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const shifts = await shiftService.getShifts(today, new Date());
      setTodayShifts(shifts);
      
      // Load week schedule
      const schedule = await scheduleService.getWeekSchedule();
      setWeekSchedule(schedule);
      
      // Load payroll history
      const payroll = await payrollService.getPayrollHistory();
      setPayrollHistory(payroll);
      
      // Load team performance
      const performance = await staffAnalyticsService.getTeamPerformance(dateRange.start, dateRange.end);
      setTeamPerformance(performance);
      
    } catch (error) {
      console.error('Error loading staff data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange]);
  
  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);
  
  // ============================================================================
  // SHIFT ACTIONS
  // ============================================================================
  
  const handleOpenShift = async () => {
    if (!selectedUserId) {
      Alert.alert('Erreur', 'Sélectionnez un employé');
      return;
    }
    
    try {
      await shiftService.openShift({
        userId: selectedUserId,
        openingAmount: parseFloat(openingAmount) || 0,
        notes: shiftNotes || undefined,
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOpenShiftModal(false);
      setSelectedUserId('');
      setOpeningAmount('');
      setShiftNotes('');
      loadData();
      
      Alert.alert('Shift ouvert', 'Le shift a été ouvert avec succès');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ouvrir le shift');
    }
  };
  
  const handleCloseShift = async () => {
    if (!selectedShift) return;
    
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    
    Alert.alert(
      'Clôturer le shift',
      `Confirmez-vous la clôture du shift de ${selectedShift.userName}?\n\nMontant en caisse: ${amount.toFixed(2)} DH`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              const closedShift = await shiftService.closeShift({
                shiftId: selectedShift.id,
                closingAmount: amount,
                notes: shiftNotes || undefined,
              });
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowCloseShiftModal(false);
              setSelectedShift(null);
              setClosingAmount('');
              setShiftNotes('');
              
              // Show summary
              const summary = await shiftService.getShiftSummary(closedShift.id);
              if (summary) {
                setShiftSummary(summary);
                setShowShiftSummaryModal(true);
              }
              
              loadData();
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de fermer le shift');
            }
          },
        },
      ]
    );
  };
  
  const viewShiftSummary = async (shift: Shift) => {
    const summary = await shiftService.getShiftSummary(shift.id);
    if (summary) {
      setShiftSummary(summary);
      setShowShiftSummaryModal(true);
    }
  };
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };
  
  const formatMoney = (amount: number): string => {
    return `${amount.toFixed(2)} DH`;
  };
  
  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin': return colors.primary;
      case 'cashier': return colors.success;
      case 'waiter': return colors.warning;
      default: return colors.textSecondary;
    }
  };
  
  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'cashier': return 'Caissier';
      case 'waiter': return 'Serveur';
      default: return role;
    }
  };
  
  // ============================================================================
  // TAB CONTENT RENDERERS
  // ============================================================================
  
  const renderOverviewTab = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      {/* Today Stats Cards */}
      <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md }}>
        Vue d'ensemble - Aujourd'hui
      </Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl }}>
        {/* Total Sales */}
        <View style={{
          flex: 1,
          minWidth: 150,
          backgroundColor: colors.primary,
          borderRadius: borderRadius.xl,
          padding: spacing.lg,
          ...shadows.md,
        }}>
          <DollarSign size={24} color="rgba(255,255,255,0.8)" />
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.white, marginTop: spacing.sm }}>
            {formatMoney(teamOverview?.totalSalesToday || 0)}
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' }}>
            Ventes aujourd'hui
          </Text>
        </View>
        
        {/* Open Shifts */}
        <View style={{
          flex: 1,
          minWidth: 150,
          backgroundColor: openShifts.length > 0 ? colors.success : colors.background,
          borderRadius: borderRadius.xl,
          padding: spacing.lg,
          ...shadows.md,
        }}>
          <Users size={24} color={openShifts.length > 0 ? colors.white : colors.success} />
          <Text style={{ 
            fontSize: 28, 
            fontWeight: '800', 
            color: openShifts.length > 0 ? colors.white : colors.success,
            marginTop: spacing.sm,
          }}>
            {openShifts.length}
          </Text>
          <Text style={{ 
            fontSize: fontSize.sm, 
            color: openShifts.length > 0 ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
          }}>
            Shifts ouverts
          </Text>
        </View>
        
        {/* Avg per staff */}
        <View style={{
          flex: 1,
          minWidth: 150,
          backgroundColor: colors.white,
          borderRadius: borderRadius.xl,
          padding: spacing.lg,
          ...shadows.md,
        }}>
          <TrendingUp size={24} color={colors.warning} />
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.warning, marginTop: spacing.sm }}>
            {formatMoney(teamOverview?.avgSalesPerStaff || 0)}
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
            Moy. par employé
          </Text>
        </View>
      </View>
      
      {/* Top Performer */}
      {teamOverview?.topPerformer && (
        <View style={{
          backgroundColor: '#FEF3C7',
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          marginBottom: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}>
          <Award size={32} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.sm, color: '#92400E' }}>Meilleur vendeur</Text>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: '#78350F' }}>
              {teamOverview.topPerformer.userName}
            </Text>
          </View>
          <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: '#D97706' }}>
            {formatMoney(teamOverview.topPerformer.revenue)}
          </Text>
        </View>
      )}
      
      {/* Open Shifts List */}
      <View style={{ marginBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Clock size={18} color={colors.textPrimary} />
            <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>
              Shifts en cours
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowOpenShiftModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: '#007AFF',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#006AE6',
            }}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={{ fontSize: fontSize.sm, fontWeight: '500', color: '#FFFFFF' }}>
              Ouvrir shift
            </Text>
          </TouchableOpacity>
        </View>
        
        {openShifts.length === 0 ? (
          <View style={{
            backgroundColor: colors.background,
            borderRadius: borderRadius.lg,
            padding: spacing.xl,
            alignItems: 'center',
          }}>
            <Clock size={40} color={colors.textMuted} />
            <Text style={{ fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.md }}>
              Aucun shift ouvert
            </Text>
          </View>
        ) : (
          openShifts.map(shift => (
            <View
              key={shift.id}
              style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginBottom: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                ...shadows.sm,
              }}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.successLight,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.success }}>
                  {shift.userName?.charAt(0) || '?'}
                </Text>
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>
                  {shift.userName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{
                    backgroundColor: getRoleColor(shift.userRole || ''),
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}>
                    <Text style={{ fontSize: fontSize.xs, color: colors.white, fontWeight: '600' }}>
                      {getRoleLabel(shift.userRole || '')}
                    </Text>
                  </View>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Depuis {formatDuration(shift.duration || 0)}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                onPress={() => {
                  setSelectedShift(shift);
                  setShowCloseShiftModal(true);
                }}
                style={{
                  backgroundColor: colors.error,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Square size={14} color={colors.white} />
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.white }}>
                  Clôturer
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
      
      {/* Recent Closed Shifts */}
      <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md }}>
        Shifts d'aujourd'hui
      </Text>
      
      {todayShifts.filter(s => s.status === 'CLOSED').length === 0 ? (
        <View style={{
          backgroundColor: colors.background,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: fontSize.md, color: colors.textMuted }}>
            Aucun shift clôturé aujourd'hui
          </Text>
        </View>
      ) : (
        todayShifts.filter(s => s.status === 'CLOSED').map(shift => (
          <TouchableOpacity
            key={shift.id}
            onPress={() => viewShiftSummary(shift)}
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.sm,
              ...shadows.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>
                  {shift.userName}
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                  {shift.openedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {shift.closedAt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {' • '}{formatDuration(shift.duration || 0)}
                </Text>
              </View>
              
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.success }}>
                  {formatMoney(shift.totalSales)}
                </Text>
                {shift.cashDifference !== undefined && Math.abs(shift.cashDifference) > 10 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <AlertTriangle size={14} color={colors.error} />
                    <Text style={{ fontSize: fontSize.xs, color: colors.error }}>
                      Écart: {formatMoney(shift.cashDifference)}
                    </Text>
                  </View>
                )}
              </View>
              
              <ChevronRight size={20} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
  
  const renderPerformanceTab = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md }}>
        Performance de l'équipe (7 derniers jours)
      </Text>
      
      {teamPerformance.length === 0 ? (
        <View style={{
          backgroundColor: colors.background,
          borderRadius: borderRadius.lg,
          padding: spacing.xl,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: fontSize.md, color: colors.textMuted }}>
            Aucune donnée de performance
          </Text>
        </View>
      ) : (
        teamPerformance.map((perf, index) => (
          <View
            key={perf.userId}
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
              ...shadows.sm,
            }}
          >
            {/* Rank & Name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : colors.background,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: spacing.md,
              }}>
                <Text style={{ 
                  fontSize: fontSize.md, 
                  fontWeight: '700', 
                  color: index < 3 ? colors.white : colors.textSecondary 
                }}>
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>
                  {perf.userName}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: getRoleColor(perf.userRole) }}>
                  {getRoleLabel(perf.userRole)}
                </Text>
              </View>
              <Text style={{ fontSize: fontSize.xl, fontWeight: '800', color: colors.success }}>
                {formatMoney(perf.totalRevenue)}
              </Text>
            </View>
            
            {/* Stats Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 80, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>{perf.ordersCount}</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Commandes</Text>
              </View>
              <View style={{ flex: 1, minWidth: 80, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>{formatMoney(perf.avgBasket)}</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Panier moy.</Text>
              </View>
              <View style={{ flex: 1, minWidth: 80, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.background, borderRadius: borderRadius.md }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>{perf.totalShiftHours.toFixed(1)}h</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Heures</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
  
  const renderPlanningTab = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>
          Planning de la semaine
        </Text>
        <TouchableOpacity
          onPress={() => setShowAddScheduleModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: '#007AFF',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#006AE6',
          }}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={{ fontSize: fontSize.sm, fontWeight: '500', color: '#FFFFFF' }}>
            Ajouter
          </Text>
        </TouchableOpacity>
      </View>
      
      {weekSchedule?.days.map(day => (
        <View
          key={day.date}
          style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            marginBottom: spacing.md,
            ...shadows.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ 
              fontSize: fontSize.md, 
              fontWeight: '700', 
              color: day.date === new Date().toISOString().split('T')[0] ? colors.primary : colors.textPrimary,
              flex: 1,
            }}>
              {day.dayName} {new Date(day.date).getDate()}
            </Text>
            {day.date === new Date().toISOString().split('T')[0] && (
              <View style={{
                backgroundColor: colors.primaryLight,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: 10,
              }}>
                <Text style={{ fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' }}>
                  Aujourd'hui
                </Text>
              </View>
            )}
          </View>
          
          {day.shifts.length === 0 ? (
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' }}>
              Aucun shift planifié
            </Text>
          ) : (
            day.shifts.map(shift => (
              <View
                key={shift.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  padding: spacing.sm,
                  borderRadius: borderRadius.md,
                  marginBottom: spacing.xs,
                }}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, flex: 1 }}>
                  {shift.userName}
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                  {shift.startTime} - {shift.endTime}
                </Text>
              </View>
            ))
          )}
        </View>
      ))}
    </ScrollView>
  );
  
  const renderSalairesTab = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md }}>
        Gestion des salaires
      </Text>
      
      {/* Quick Actions */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
        <TouchableOpacity
          onPress={() => setShowCompensationModal(true)}
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            alignItems: 'center',
          }}
        >
          <Edit3 size={24} color={colors.white} />
          <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.white, marginTop: spacing.sm }}>
            Règles salaires
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setShowPayrollModal(true)}
          style={{
            flex: 1,
            backgroundColor: colors.success,
            borderRadius: borderRadius.lg,
            padding: spacing.lg,
            alignItems: 'center',
          }}
        >
          <Wallet size={24} color={colors.white} />
          <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.white, marginTop: spacing.sm }}>
            Générer paie
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Payroll History */}
      <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md }}>
        Historique des fiches de paie
      </Text>
      
      {payrollHistory.length === 0 ? (
        <View style={{
          backgroundColor: colors.background,
          borderRadius: borderRadius.lg,
          padding: spacing.xl,
          alignItems: 'center',
        }}>
          <Wallet size={40} color={colors.textMuted} />
          <Text style={{ fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.md }}>
            Aucune fiche de paie
          </Text>
        </View>
      ) : (
        payrollHistory.map(entry => (
          <View
            key={entry.id}
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              marginBottom: spacing.md,
              ...shadows.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>
                {entry.userName}
              </Text>
              <View style={{
                backgroundColor: entry.paymentStatus === 'paid' ? colors.successLight : 
                               entry.paymentStatus === 'partial' ? colors.warningLight : colors.errorLight,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: 10,
              }}>
                <Text style={{
                  fontSize: fontSize.xs,
                  fontWeight: '600',
                  color: entry.paymentStatus === 'paid' ? colors.success :
                         entry.paymentStatus === 'partial' ? colors.warning : colors.error,
                }}>
                  {entry.paymentStatus === 'paid' ? 'Payé' : entry.paymentStatus === 'partial' ? 'Partiel' : 'Non payé'}
                </Text>
              </View>
            </View>
            
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>
              Période: {entry.periodStart.toLocaleDateString('fr-FR')} - {entry.periodEnd.toLocaleDateString('fr-FR')}
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                Base: {formatMoney(entry.baseSalary)}
                {entry.advances > 0 && ` • Avances: -${formatMoney(entry.advances)}`}
              </Text>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.primary }}>
                {formatMoney(entry.totalPayable)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
  
  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header - macOS Style */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#F5F5F5',
          borderBottomWidth: 1,
          borderBottomColor: '#D0D0D0',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#FF9500',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Users size={16} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>
                Gestion Équipe
              </Text>
              <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                Shifts, Planning & Salaires
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: '#E8E8E8',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#C8C8C8',
            }}
          >
            <X size={18} color="#666666" />
          </TouchableOpacity>
        </View>
        
        {/* Tabs */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: colors.white,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        }}>
          {[
            { key: 'overview' as TabType, label: 'Vue générale', icon: Users },
            { key: 'shifts' as TabType, label: 'Shifts', icon: Clock },
            { key: 'planning' as TabType, label: 'Planning', icon: Calendar },
            { key: 'salaires' as TabType, label: 'Salaires', icon: Wallet },
            { key: 'performance' as TabType, label: 'Performance', icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? colors.primary : 'transparent',
                }}
              >
                <Icon size={20} color={isActive ? colors.primary : colors.textMuted} />
                {isTablet && (
                  <Text style={{
                    fontSize: fontSize.xs,
                    color: isActive ? colors.primary : colors.textMuted,
                    marginTop: 2,
                  }}>
                    {tab.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Content */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>
              Chargement...
            </Text>
          </View>
        ) : (
          <>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'shifts' && renderOverviewTab()} {/* Use same view for now */}
            {activeTab === 'planning' && renderPlanningTab()}
            {activeTab === 'salaires' && renderSalairesTab()}
            {activeTab === 'performance' && renderPerformanceTab()}
          </>
        )}
        
        {/* ============ MODALS ============ */}
        
        {/* Open Shift Modal */}
        <Modal visible={showOpenShiftModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
            <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 400 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
                <Play size={18} color={colors.textPrimary} />
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>
                  Ouvrir un shift
                </Text>
              </View>
              
              {/* User Selection */}
              <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>
                Employé
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {users.filter(u => u.role !== 'admin').map(user => (
                    <TouchableOpacity
                      key={user.id}
                      onPress={() => setSelectedUserId(user.id)}
                      style={{
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        borderRadius: borderRadius.lg,
                        backgroundColor: selectedUserId === user.id ? colors.primary : colors.background,
                      }}
                    >
                      <Text style={{
                        fontSize: fontSize.md,
                        fontWeight: '600',
                        color: selectedUserId === user.id ? colors.white : colors.textPrimary,
                      }}>
                        {user.name}
                      </Text>
                      <Text style={{
                        fontSize: fontSize.xs,
                        color: selectedUserId === user.id ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                      }}>
                        {getRoleLabel(user.role)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              
              {/* Opening Amount */}
              <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>
                Montant d'ouverture (DH)
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: fontSize.lg,
                  color: colors.textPrimary,
                  marginBottom: spacing.md,
                }}
                value={openingAmount}
                onChangeText={setOpeningAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              
              {/* Notes */}
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: fontSize.md,
                  color: colors.textPrimary,
                  marginBottom: spacing.lg,
                }}
                value={shiftNotes}
                onChangeText={setShiftNotes}
                placeholder="Notes (optionnel)"
                placeholderTextColor={colors.textMuted}
              />
              
              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowOpenShiftModal(false);
                    setSelectedUserId('');
                    setOpeningAmount('');
                    setShiftNotes('');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: borderRadius.lg,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary }}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleOpenShift}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: borderRadius.lg,
                    backgroundColor: colors.success,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.white }}>
                    Ouvrir
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Close Shift Modal */}
        <Modal visible={showCloseShiftModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
            <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 400 }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md }}>
                Clôturer le shift
              </Text>
              
              {selectedShift && (
                <View style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>
                    {selectedShift.userName}
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Ouvert depuis {formatDuration(selectedShift.duration || 0)}
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                    Montant d'ouverture: {formatMoney(selectedShift.openingAmount)}
                  </Text>
                </View>
              )}
              
              {/* Closing Amount */}
              <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>
                Montant en caisse (DH) *
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: fontSize.xl,
                  fontWeight: '700',
                  color: colors.textPrimary,
                  marginBottom: spacing.md,
                  textAlign: 'center',
                }}
                value={closingAmount}
                onChangeText={setClosingAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                autoFocus
              />
              
              {/* Notes */}
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: fontSize.md,
                  color: colors.textPrimary,
                  marginBottom: spacing.lg,
                }}
                value={shiftNotes}
                onChangeText={setShiftNotes}
                placeholder="Notes (optionnel)"
                placeholderTextColor={colors.textMuted}
              />
              
              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowCloseShiftModal(false);
                    setSelectedShift(null);
                    setClosingAmount('');
                    setShiftNotes('');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: borderRadius.lg,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary }}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCloseShift}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: borderRadius.lg,
                    backgroundColor: colors.error,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.white }}>
                    Clôturer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Shift Summary Modal */}
        <Modal visible={showShiftSummaryModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
            <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 450, maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>
                  Rapport de Shift
                </Text>
                <TouchableOpacity onPress={() => setShowShiftSummaryModal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              {shiftSummary && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header Info */}
                  <View style={{
                    backgroundColor: colors.primaryLight,
                    borderRadius: borderRadius.lg,
                    padding: spacing.lg,
                    marginBottom: spacing.lg,
                  }}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.primary }}>
                      {shiftSummary.shift.userName}
                    </Text>
                    <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                      {shiftSummary.shift.openedAt.toLocaleString('fr-FR')} - {shiftSummary.shift.closedAt?.toLocaleString('fr-FR')}
                    </Text>
                    <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                      Durée: {formatDuration(shiftSummary.shift.duration || 0)}
                    </Text>
                  </View>
                  
                  {/* Sales Summary */}
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
                      Ventes
                    </Text>
                    <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.textSecondary }}>Total ventes</Text>
                        <Text style={{ fontWeight: '700', color: colors.success }}>{formatMoney(shiftSummary.shift.totalSales)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.textSecondary }}>Espèces</Text>
                        <Text style={{ color: colors.textPrimary }}>{formatMoney(shiftSummary.shift.cashSales)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.textSecondary }}>Carte</Text>
                        <Text style={{ color: colors.textPrimary }}>{formatMoney(shiftSummary.shift.cardSales)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: colors.textSecondary }}>Commandes</Text>
                        <Text style={{ color: colors.textPrimary }}>{shiftSummary.shift.totalOrders}</Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Cash Summary */}
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
                      Caisse
                    </Text>
                    <View style={{ backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.textSecondary }}>Ouverture</Text>
                        <Text style={{ color: colors.textPrimary }}>{formatMoney(shiftSummary.shift.openingAmount)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.textSecondary }}>+ Espèces</Text>
                        <Text style={{ color: colors.success }}>+{formatMoney(shiftSummary.shift.cashSales)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ color: colors.textSecondary }}>- Monnaie rendue</Text>
                        <Text style={{ color: colors.error }}>-{formatMoney(shiftSummary.shift.totalChangeGiven)}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Attendu</Text>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{formatMoney(shiftSummary.shift.expectedCash || 0)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Déclaré</Text>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{formatMoney(shiftSummary.shift.closingAmount || 0)}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Écart</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          {shiftSummary.shift.cashDifference !== undefined && Math.abs(shiftSummary.shift.cashDifference) > 10 && (
                            <AlertTriangle size={16} color={colors.error} />
                          )}
                          <Text style={{
                            fontWeight: '700',
                            fontSize: fontSize.lg,
                            color: shiftSummary.shift.cashDifference === 0 ? colors.success :
                                   Math.abs(shiftSummary.shift.cashDifference || 0) > 10 ? colors.error : colors.warning,
                          }}>
                            {(shiftSummary.shift.cashDifference || 0) >= 0 ? '+' : ''}{formatMoney(shiftSummary.shift.cashDifference || 0)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  
                  {/* Top Products */}
                  {shiftSummary.topProducts.length > 0 && (
                    <View style={{ marginBottom: spacing.lg }}>
                      <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm }}>
                        Top produits
                      </Text>
                      {shiftSummary.topProducts.map((prod, i) => (
                        <View key={i} style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          paddingVertical: spacing.xs,
                        }}>
                          <Text style={{ color: colors.textSecondary }}>{prod.productName}</Text>
                          <Text style={{ color: colors.textPrimary }}>{prod.quantity}x • {formatMoney(prod.revenue)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* Print Button */}
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Impression', 'Impression du rapport en cours...');
                    }}
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: borderRadius.lg,
                      padding: spacing.md,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <Printer size={20} color={colors.white} />
                    <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.white }}>
                      Imprimer le rapport
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
        
      </SafeAreaView>
    </Modal>
  );
};

export default StaffManagement;
