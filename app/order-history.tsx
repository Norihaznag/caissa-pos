import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, Calendar, Filter, Receipt, Clock } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { orderService, orderItemService, tableService, userService } from '../lib/services';

type OrderStatus = 'PAID' | 'CANCELLED' | 'PENDING';

interface OrderHistoryItem {
  id: string;
  tableNumber: number;
  waiterName: string;
  createdAt: Date;
  completedAt?: Date;
  status: OrderStatus;
  itemsCount: number;
  total: number;
  paymentMethod?: 'cash' | 'card';
  cancellationReason?: string;
}

export default function OrderHistoryScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');

  const loadOrders = useCallback(async () => {
    try {
      // Fetch all orders from Supabase
      const [ordersDb, tablesDb, usersDb] = await Promise.all([
        orderService.getAll(),
        tableService.getAll(),
        userService.getAll(),
      ]);
      
      // Transform orders
      const ordersData: OrderHistoryItem[] = await Promise.all(
        (ordersDb || []).filter(o => o && o.id).map(async (o) => {
          const items = await orderItemService.getByOrderId(o.id).catch(() => []);
          const table = tablesDb.find(t => t.id === o.table_id);
          const waiter = usersDb.find(u => u.id === o.waiter_id);
          const itemsCount = Array.isArray(items) 
            ? (items as any[]).reduce((sum, i) => sum + (i?.quantity || 0), 0)
            : 0;
          
          // Map status to simpler type
          let status: OrderStatus = 'PENDING';
          if (o.status === 'PAID') status = 'PAID';
          else if (o.status === 'CANCELLED') status = 'CANCELLED';
          
          return {
            id: o.id,
            tableNumber: table?.number || 0,
            waiterName: waiter?.name || 'Serveur',
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
            completedAt: (o.status === 'PAID' && o.updated_at) ? new Date(o.updated_at) : undefined,
            status,
            itemsCount: itemsCount || 0,
            total: o.total_amount || 0,
            paymentMethod: o.payment_method,
            cancellationReason: o.cancellation_reason,
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

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }, [loadOrders]);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'PAID':
        return { bg: '#DCFCE7', text: '#166534' };
      case 'CANCELLED':
        return { bg: '#FEE2E2', text: '#991B1B' };
      case 'PENDING':
        return { bg: '#FEF3C7', text: '#92400E' };
    }
  };

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'PAID':
        return 'Payée';
      case 'CANCELLED':
        return 'Annulée';
      case 'PENDING':
        return 'En cours';
    }
  };

  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    if (!order) return false;
    const matchesSearch = 
      (order.id || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (order.waiterName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      String(order.tableNumber || '').includes(searchQuery || '');
    
    const matchesFilter = filterStatus === 'ALL' || order.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  }) : [];

  const renderOrder = ({ item }: { item: OrderHistoryItem }) => {
    const statusColors = getStatusColor(item.status);
    
    return (
      <TouchableOpacity
        onPress={() => router.push(`/receipt?orderId=${item.id}&tableNumber=${item.tableNumber}`)}
        style={{
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
              Table {item.tableNumber}
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{item.waiterName}</Text>
          </View>
          <View
            style={{
              backgroundColor: statusColors.bg,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: statusColors.text, fontSize: 11, fontWeight: '600' }}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={14} color="#6B7280" />
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {item.createdAt && !isNaN(item.createdAt.getTime()) 
                ? format(item.createdAt, 'HH:mm', { locale: fr })
                : '--:--'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            {item.itemsCount} articles
          </Text>
          {item.paymentMethod && (
            <Text style={{ fontSize: 13, color: '#6B7280' }}>
              {item.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
            </Text>
          )}
        </View>

        {/* Cancellation Reason */}
        {item.status === 'CANCELLED' && item.cancellationReason && (
          <View style={{ 
            backgroundColor: '#FEF2F2', 
            padding: 8, 
            borderRadius: 6, 
            marginBottom: 8,
            borderLeftWidth: 3,
            borderLeftColor: '#EF4444',
          }}>
            <Text style={{ fontSize: 12, color: '#991B1B', fontWeight: '500' }}>
              Raison: {item.cancellationReason}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{item.id}</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#2563EB' }}>{item.total} MAD</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const todayTotal = filteredOrders
    .filter(o => o.status === 'PAID')
    .reduce((sum, o) => sum + o.total, 0);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
          <View style={{ flex: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Historique</Text>
            <Text style={{ fontSize: 13, color: '#6B7280' }} numberOfLines={1}>
              {filteredOrders.length} commandes • {todayTotal} MAD
            </Text>
          </View>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        padding: 16,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#F3F4F6',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 12,
        }}>
          <Search size={18} color="#6B7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher par table, serveur, ID..."
            style={{
              flex: 1,
              color: '#111827',
              fontSize: 14,
            }}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['ALL', 'PAID', 'PENDING', 'CANCELLED'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setFilterStatus(status)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: filterStatus === status ? '#3B82F6' : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: filterStatus === status ? '#FFFFFF' : '#4B5563',
                }}
              >
                {status === 'ALL' ? 'Toutes' : getStatusText(status as OrderStatus)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
          />
        }
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Receipt size={48} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
              Aucune commande trouvée
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
}
