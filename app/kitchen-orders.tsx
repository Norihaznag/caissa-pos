import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RefreshCw, LogOut, Clock, ChefHat, CreditCard } from 'lucide-react-native';
import { useAppStore, Order, OrderStatus } from '../lib/store';
import { orderService, orderItemService, tableService } from '../lib/services';
import * as Haptics from 'expo-haptics';

export default function KitchenOrdersScreen() {
  const router = useRouter();
  const orders = useAppStore((state) => state.orders);
  const setOrders = useAppStore((state) => state.setOrders);
  const updateOrderStatus = useAppStore((state) => state.updateOrderStatus);
  const markOrderServed = useAppStore((state) => state.markOrderServed);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter only active orders (not served yet)
  const activeOrders = orders.filter(o => !o.isServed && o.status !== 'CANCELLED');

  const loadOrders = useCallback(async () => {
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
            items: itemsDb.map(i => ({
              id: i.id,
              productId: i.product_id,
              productName: i.product_name,
              price: i.price,
              quantity: i.quantity,
            })),
            status: o.status,
            isServed: o.is_served,
            totalAmount: o.total_amount,
            createdAt: new Date(o.created_at),
            updatedAt: new Date(o.updated_at),
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
            // TODO: Clear session from Zustand store
            router.replace('/');
          },
        },
      ]
    );
  };

  const getTimeSince = (date: Date | string | undefined): string => {
    if (!date) return "À l'instant";
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const minutes = Math.floor((Date.now() - dateObj.getTime()) / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes === 1) return '1 min';
    return `${minutes} min`;
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
      return (
        <TouchableOpacity
          style={{
            backgroundColor: '#3B82F6',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 4,
          }}
          onPress={() => handleMarkServed(order.id)}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
            ✓ Servir
          </Text>
        </TouchableOpacity>
      );
    }

    // PAID orders still in kitchen (waiting to be served)
    return (
      <TouchableOpacity
        style={{
          backgroundColor: '#8B5CF6',
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 4,
        }}
        onPress={() => handleMarkServed(order.id)}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>
          ✓ Servir (Payée)
        </Text>
      </TouchableOpacity>
    );
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
        {(order.items || []).map((item) => (
          <View
            key={item.id}
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
                    {item.quantity}
                  </Text>
                </View>
                <Text style={{ fontSize: 15, color: '#000000', flex: 1 }}>
                  {item.productName}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '500' }}>
                {item.price} MAD
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
        ))}
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
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#000000' }}>
            Cuisine - Commandes
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={onRefresh}
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RefreshCw size={22} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleLogout}
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
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
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
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
            <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
              Les nouvelles commandes apparaîtront ici
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}