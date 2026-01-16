import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RefreshCw, LogOut, Clock, ChefHat, CreditCard, Volume2, LayoutGrid, List } from 'lucide-react-native';
import { useAppStore, Order, OrderStatus } from '../lib/store';
import { orderService, orderItemService, tableService } from '../lib/services';
import * as Haptics from 'expo-haptics';
import { useNewOrderNotification } from '../lib/sounds';

export default function KitchenOrdersScreen() {
  const router = useRouter();
  const orders = useAppStore((state) => state.orders);
  const setOrders = useAppStore((state) => state.setOrders);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const markOrderServed = useAppStore((state) => state.markOrderServed);
  const logout = useAppStore((state) => state.logout);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [orderViewMode, setOrderViewMode] = useState<'list' | 'grid'>('list');
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const isLoadingRef = useRef(false);

  // Enable sound notifications for new orders
  useNewOrderNotification();

  // Filter only active orders (not served yet)
  const activeOrders = Array.isArray(orders) 
    ? orders.filter(o => o && o.status && !o.isServed && o.status !== 'CANCELLED')
    : [];
  
  // Apply status filter
  const filteredOrders = statusFilter === 'ALL' 
    ? activeOrders 
    : activeOrders.filter(o => o.status === statusFilter);

  const loadOrders = useCallback(async () => {
    // Prevent overlapping requests
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      setRefreshing(true);
      
      // Fetch kitchen orders from Supabase (not served, not cancelled)
      const ordersDb = await orderService.getForKitchen();
      const tablesDb = await tableService.getAll();
      
      // Transform orders and fetch order items
      const ordersData: Order[] = await Promise.all(
        ordersDb.map(async (o) => {
          const itemsDb = await orderItemService.getByOrderId(o.id);
          const table = tablesDb.find(t => t.id === o.table_id);
          
          return {
            id: o.id,
            tableId: o.table_id,
            tableNumber: table?.number || 0,
            items: Array.isArray(itemsDb) ? itemsDb.map(i => ({
              id: i.id,
              productId: i.product_id,
              productName: i.product_name,
              price: i.price || 0,
              quantity: i.quantity || 0,
            })) : [],
            status: o.status || 'NEW',
            isServed: o.is_served || false,
            totalAmount: o.total_amount || 0,
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
            updatedAt: o.updated_at ? new Date(o.updated_at) : new Date(),
            waiterId: o.waiter_id || undefined,
          };
        })
      );
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [setOrders]);

  useEffect(() => {
    loadOrders();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const onRefresh = () => {
    loadOrders();
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (updatingOrders.has(orderId)) return; // Prevent double-click
    
    setUpdatingOrders(prev => new Set(prev).add(orderId));
    try {
      // Update in Supabase
      await orderService.updateStatus(orderId, newStatus);
      
      // Update local store
      updateOrderStatus(orderId, newStatus);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const statusText = newStatus === 'PREPARING' ? 'En préparation' : 'Prête';
      Alert.alert('Statut mis à jour', `Commande marquée comme "${statusText}"`);
    } catch (error) {
      console.error('Error updating status:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleMarkServed = async (orderId: string) => {
    try {
      // Mark as served in Supabase
      await orderService.markServed(orderId);
      
      // Update local store
      markOrderServed(orderId);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Commande Servie', 'La commande a été livrée au client.');
    } catch (error) {
      console.error('Error marking served:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de marquer comme servie');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const getTimeSince = (date: Date | string | undefined): string => {
    if (!date) return "À l'instant";
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return "À l'instant";
      const minutes = Math.floor((Date.now() - dateObj.getTime()) / 60000);
      if (minutes < 1) return "À l'instant";
      if (minutes === 1) return '1 min';
      return `${minutes} min`;
    } catch {
      return "À l'instant";
    }
  };

  const getStatusColor = (status: OrderStatus): string => {
    switch (status) {
      case 'NEW':
        return '#EF4444'; // Red
      case 'PREPARING':
        return '#F59E0B'; // Orange
      case 'READY':
        return '#10B981'; // Green
      case 'PAID':
        return '#6B7280'; // Gray
      case 'CANCELLED':
        return '#6B7280'; // Gray
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: OrderStatus): string => {
    switch (status) {
      case 'NEW':
        return 'NOUVELLE';
      case 'PREPARING':
        return 'EN PRÉPARATION';
      case 'READY':
        return 'PRÊTE';
      case 'PAID':
        return 'PAYÉE';
      case 'CANCELLED':
        return 'ANNULÉE';
      default:
        return status;
    }
  };

  const renderStatusButtons = (order: Order) => {
    if (order.status === 'NEW') {
      return (
        <TouchableOpacity
          style={{
            backgroundColor: '#F59E0B',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 4,
          }}
          onPress={() => handleStatusChange(order.id, 'PREPARING')}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            Commencer
          </Text>
        </TouchableOpacity>
      );
    }

    if (order.status === 'PREPARING') {
      return (
        <TouchableOpacity
          style={{
            backgroundColor: '#10B981',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 4,
          }}
          onPress={() => handleStatusChange(order.id, 'READY')}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            Marquer Prête
          </Text>
        </TouchableOpacity>
      );
    }

    if (order.status === 'READY') {
      // Kitchen already marked as ready - show waiting indicator
      // The waiter will pick up the order and serve it
      return (
        <View
          style={{
            backgroundColor: '#D1FAE5',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text style={{ color: '#065F46', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            ✓ Prête - En attente serveur
          </Text>
        </View>
      );
    }

    // For any other status, show nothing
    return null;
  };

  const renderOrderItem = ({ item: order }: { item: Order }) => (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        marginBottom: 12,
        padding: 16,
      }}
    >
      {/* Header: Table + Status + Time */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#000000' }}>
            Table {order.tableNumber}
          </Text>
          <View
            style={{
              backgroundColor: getStatusColor(order.status),
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 3,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
              {getStatusText(order.status)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={14} color="#6B7280" />
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            {getTimeSince(order.createdAt)}
          </Text>
        </View>
      </View>

      {/* Items List */}
      <View style={{ marginBottom: 12 }}>
        {(order.items || []).map((item, index) => {
          if (!item) return null;
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          return (
            <View
              key={item.id || `order-item-${index}`}
              style={{
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View
                    style={{
                      backgroundColor: '#3B82F6',
                      width: 24,
                      height: 24,
                      borderRadius: 3,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                      {qty}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, color: '#000000', flex: 1 }}>
                    {item.productName || 'Article'}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '500' }}>
                  {price} MAD
                </Text>
              </View>
              {item.note && (
                <View style={{ marginLeft: 32, marginTop: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                  <Text style={{ fontSize: 13, color: '#92400E', fontStyle: 'italic' }}>
                    📝 {item.note}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Total */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: 8,
          marginBottom: 12,
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#000000' }}>Total</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#3B82F6' }}>
          {order.totalAmount} MAD
        </Text>
      </View>

      {/* Action Button */}
      {renderStatusButtons(order)}
    </View>
  );

  // Group orders by status
  const newOrders = activeOrders.filter(o => o.status === 'NEW');
  const preparingOrders = activeOrders.filter(o => o.status === 'PREPARING');
  const readyOrders = activeOrders.filter(o => o.status === 'READY');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#000000', flexShrink: 1 }} numberOfLines={1}>
            Cuisine - Commandes
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={onRefresh}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RefreshCw size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleLogout}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            <Text style={{ fontWeight: '700', color: '#EF4444' }}>{newOrders.length}</Text> nouvelles
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{preparingOrders.length}</Text> en cours
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            <Text style={{ fontWeight: '700', color: '#10B981' }}>{readyOrders.length}</Text> prêtes
          </Text>
        </View>

        {/* Status Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {[  
              { key: 'ALL', label: 'Toutes', count: activeOrders.length },
              { key: 'NEW', label: 'Nouvelles', count: newOrders.length, color: '#EF4444' },
              { key: 'PREPARING', label: 'En cours', count: preparingOrders.length, color: '#F59E0B' },
              { key: 'READY', label: 'Prêtes', count: readyOrders.length, color: '#10B981' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setStatusFilter(tab.key as typeof statusFilter)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: statusFilter === tab.key ? (tab.color || '#3B82F6') : '#F3F4F6',
                }}
              >
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: '600', 
                  color: statusFilter === tab.key ? '#FFFFFF' : '#6B7280' 
                }}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            ))}
            {/* Grid/List Toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 20, padding: 2, marginLeft: 8 }}>
              <TouchableOpacity
                onPress={() => setOrderViewMode('list')}
                style={{
                  padding: 6,
                  borderRadius: 16,
                  backgroundColor: orderViewMode === 'list' ? '#FFFFFF' : 'transparent',
                }}
              >
                <List size={16} color={orderViewMode === 'list' ? '#3B82F6' : '#9CA3AF'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOrderViewMode('grid')}
                style={{
                  padding: 6,
                  borderRadius: 16,
                  backgroundColor: orderViewMode === 'grid' ? '#FFFFFF' : 'transparent',
                }}
              >
                <LayoutGrid size={16} color={orderViewMode === 'grid' ? '#3B82F6' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Orders - List or Grid */}
      {orderViewMode === 'list' ? (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
              <ChefHat size={64} color="#D1D5DB" />
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', textAlign: 'center', marginTop: 16 }}>
                Aucune commande
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredOrders}
          numColumns={2}
          key="grid"
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
          renderItem={({ item: order }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: 12,
                borderWidth: 2,
                borderColor: getStatusColor(order.status),
              }}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#000000' }}>T{order.tableNumber}</Text>
                <View style={{ backgroundColor: getStatusColor(order.status), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                    {order.status === 'NEW' ? 'NEW' : order.status === 'PREPARING' ? 'PREP' : 'OK'}
                  </Text>
                </View>
              </View>
              {/* Items count */}
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                {order.items?.length || 0} articles • {getTimeSince(order.createdAt)}
              </Text>
              {/* Quick items preview */}
              {(order.items || []).slice(0, 2).map((item, idx) => (
                <Text key={idx} style={{ fontSize: 12, color: '#374151' }} numberOfLines={1}>
                  {item.quantity}x {item.productName}
                </Text>
              ))}
              {(order.items?.length || 0) > 2 && (
                <Text style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>+{(order.items?.length || 0) - 2} autres</Text>
              )}
              {/* Action */}
              <View style={{ marginTop: 10 }}>
                {renderStatusButtons(order)}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <ChefHat size={64} color="#D1D5DB" />
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>Aucune commande</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}