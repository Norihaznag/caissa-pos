import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, TrendingUp, ShoppingCart, Clock, History, Banknote, CreditCard, FileText, X } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { orderService, orderItemService, tableService, reportsService } from '../lib/services';

interface OrderSummary {
  id: string;
  tableNumber: number;
  totalAmount: number;
  itemsCount: number;
  status: 'PAID' | 'READY' | 'NEW' | 'PREPARING' | 'CANCELLED';
  createdAt: Date;
  paymentMethod?: 'cash' | 'card';
}

interface EndOfDayReport {
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  totalDiscounts: number;
  avgOrderValue: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState(new Date());
  const [endOfDayReport, setEndOfDayReport] = useState<EndOfDayReport | null>(null);
  const [showEndOfDay, setShowEndOfDay] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch today's orders from Supabase
      const [ordersDb, tablesDb] = await Promise.all([
        orderService.getToday(),
        tableService.getAll(),
      ]);
      
      // Transform orders with item counts
      const ordersData: OrderSummary[] = await Promise.all(
        ordersDb.map(async (o) => {
          const items = await orderItemService.getByOrderId(o.id);
          const table = tablesDb.find(t => t.id === o.table_id);
          const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);
          
          return {
            id: o.id,
            tableNumber: table?.number || 0,
            totalAmount: o.total_amount,
            itemsCount,
            status: o.status,
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
            paymentMethod: o.payment_method,
          };
        })
      );
      
      // Sort by creation time (newest first)
      ordersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEndOfDayReport = useCallback(async () => {
    try {
      const report = await reportsService.getEndOfDayReport(selectedDate);
      setEndOfDayReport(report);
      setShowEndOfDay(true);
    } catch (error) {
      console.error('Error loading end of day report:', error);
      Alert.alert('Erreur', 'Impossible de charger le rapport de fin de journée');
    }
  }, [selectedDate]);

  const shareEndOfDayReport = async () => {
    if (!endOfDayReport) return;
    
    const dateStr = format(selectedDate, 'dd/MM/yyyy', { locale: fr });
    const reportText = `
📊 RAPPORT DE FIN DE JOURNÉE
${dateStr}
================================

💰 RECETTES
Total: ${endOfDayReport.totalRevenue.toFixed(2)} MAD
Espèces: ${endOfDayReport.cashRevenue.toFixed(2)} MAD
Carte: ${endOfDayReport.cardRevenue.toFixed(2)} MAD

📋 COMMANDES
Total: ${endOfDayReport.totalOrders}
Payées: ${endOfDayReport.paidOrders}
Annulées: ${endOfDayReport.cancelledOrders}

📈 STATISTIQUES
Panier moyen: ${endOfDayReport.avgOrderValue.toFixed(2)} MAD
Remises totales: ${endOfDayReport.totalDiscounts.toFixed(2)} MAD

🏆 TOP PRODUITS
${(endOfDayReport.topProducts || []).slice(0, 5).map((p, i) => 
  `${i + 1}. ${p.name || 'Produit'}: ${p.quantity || 0} vendus (${(p.revenue || 0).toFixed(0)} MAD)`
).join('\n')}
================================
    `.trim();
    
    try {
      await Share.share({ message: reportText });
    } catch (error) {
      console.error('Error sharing report:', error);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Calculate stats
  const paidOrders = Array.isArray(orders) ? orders.filter(o => o && o.status === 'PAID') : [];
  const cashOrders = paidOrders.filter(o => o.paymentMethod === 'cash');
  const cardOrders = paidOrders.filter(o => o.paymentMethod === 'card');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o?.totalAmount || 0), 0);
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  const getStatusBadge = (status: OrderSummary['status']) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      PAID: { bg: '#DCFCE7', text: '#166534', label: 'Payée' },
      READY: { bg: '#DBEAFE', text: '#1D4ED8', label: 'Prête' },
      PREPARING: { bg: '#FEF3C7', text: '#92400E', label: 'En cours' },
      NEW: { bg: '#F3F4F6', text: '#374151', label: 'Nouvelle' },
      CANCELLED: { bg: '#FEE2E2', text: '#991B1B', label: 'Annulée' },
    };
    return styles[status] || { bg: '#F3F4F6', text: '#374151', label: status || 'Inconnu' };
  };

  const renderOrder = ({ item }: { item: OrderSummary }) => {
    const statusStyle = getStatusBadge(item.status);
    
    return (
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 48,
              height: 48,
              backgroundColor: '#F3F4F6',
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#4B5563' }}>{item.tableNumber}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
                Table {item.tableNumber}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Clock size={12} color="#9CA3AF" />
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {item.createdAt && !isNaN(item.createdAt.getTime()) 
                    ? format(item.createdAt, 'HH:mm', { locale: fr })
                    : '--:--'}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>•</Text>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {item.itemsCount} articles
                </Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{item.totalAmount} MAD</Text>
            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
              backgroundColor: statusStyle.bg,
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '500',
                color: statusStyle.text,
              }}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
                borderRadius: 10,
              }}
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Rapport du Jour</Text>
              <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={1}>
                {format(selectedDate, 'EEE d MMM yyyy', { locale: fr })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={loadOrders}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
                borderRadius: 10,
              }}
            >
              <RefreshCw size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/order-history')}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#DBEAFE',
                borderRadius: 10,
              }}
            >
              <History size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Total Revenue */}
          <View style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <TrendingUp size={16} color="#10B981" />
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Revenu Total</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827' }}>{totalRevenue} MAD</Text>
          </View>

          {/* Orders Count */}
          <View style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ShoppingCart size={16} color="#3B82F6" />
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Commandes</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827' }}>{paidOrders.length}</Text>
          </View>
        </View>

        {/* Cash vs Card breakdown */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{
            flex: 1,
            backgroundColor: '#F0FDF4',
            borderWidth: 1,
            borderColor: '#BBF7D0',
            borderRadius: 12,
            padding: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Banknote size={14} color="#16A34A" />
              <Text style={{ fontSize: 11, color: '#16A34A' }}>Espèces</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#166534' }}>
              {cashOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)} MAD
            </Text>
            <Text style={{ fontSize: 11, color: '#16A34A' }}>{cashOrders.length} commandes</Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: '#EFF6FF',
            borderWidth: 1,
            borderColor: '#BFDBFE',
            borderRadius: 12,
            padding: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <CreditCard size={14} color="#2563EB" />
              <Text style={{ fontSize: 11, color: '#2563EB' }}>Carte</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E40AF' }}>
              {cardOrders.reduce((s, o) => s + (o.totalAmount || 0), 0)} MAD
            </Text>
            <Text style={{ fontSize: 11, color: '#2563EB' }}>{cardOrders.length} commandes</Text>
          </View>
        </View>

        {/* Average Order Value + End of Day Button */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            padding: 16,
          }}>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Panier Moyen</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
              {avgOrderValue.toFixed(0)} MAD
            </Text>
          </View>
          <TouchableOpacity
            onPress={loadEndOfDayReport}
            style={{
              flex: 1,
              backgroundColor: '#7C3AED',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileText size={20} color="#FFFFFF" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF', marginTop: 4 }}>
              Fin de Journée
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Orders List Header */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
      }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
          Commandes du jour ({orders.length})
        </Text>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshing={loading}
        onRefresh={loadOrders}
      />

      {/* End of Day Modal */}
      {showEndOfDay && endOfDayReport && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxHeight: '90%',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
              backgroundColor: '#7C3AED',
            }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>Rapport Fin de Journée</Text>
                <Text style={{ fontSize: 12, color: '#E9D5FF' }}>
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowEndOfDay(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Revenue Summary */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>💰 RECETTES</Text>
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16 }}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#166534', textAlign: 'center' }}>
                    {endOfDayReport.totalRevenue.toFixed(2)} MAD
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>Espèces</Text>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#166534' }}>
                        {endOfDayReport.cashRevenue.toFixed(0)} MAD
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>Carte</Text>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1D4ED8' }}>
                        {endOfDayReport.cardRevenue.toFixed(0)} MAD
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Orders Summary */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>📋 COMMANDES</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>{endOfDayReport.totalOrders}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Total</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 8, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#166534' }}>{endOfDayReport.paidOrders}</Text>
                    <Text style={{ fontSize: 11, color: '#16A34A' }}>Payées</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#DC2626' }}>{endOfDayReport.cancelledOrders}</Text>
                    <Text style={{ fontSize: 11, color: '#DC2626' }}>Annulées</Text>
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>📈 STATISTIQUES</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Panier moyen</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E40AF' }}>
                      {endOfDayReport.avgOrderValue.toFixed(0)} MAD
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Remises totales</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#92400E' }}>
                      {endOfDayReport.totalDiscounts.toFixed(0)} MAD
                    </Text>
                  </View>
                </View>
              </View>

              {/* Top Products */}
              {Array.isArray(endOfDayReport.topProducts) && endOfDayReport.topProducts.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 }}>🏆 TOP PRODUITS</Text>
                  {endOfDayReport.topProducts.slice(0, 5).map((product, index) => (
                    <View key={product?.name || index} style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderBottomWidth: index < 4 ? 1 : 0,
                      borderBottomColor: '#F3F4F6',
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: index === 0 ? '#FEF3C7' : '#F3F4F6',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: index === 0 ? '#D97706' : '#6B7280' }}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#111827' }}>{product.name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{product.quantity} vendus</Text>
                        <Text style={{ fontSize: 11, color: '#6B7280' }}>{product.revenue.toFixed(0)} MAD</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
            }}>
              <TouchableOpacity
                onPress={() => setShowEndOfDay(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareEndOfDayReport}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: '#7C3AED',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#FFFFFF' }}>Partager</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
