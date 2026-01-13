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
        ordersDb.map(async (o) => {
          const items = await orderItemService.getByOrderId(o.id);
          const table = tablesDb.find(t => t.id === o.table_id);
          const waiter = usersDb.find(u => u.id === o.waiter_id);
          const itemsCount = items.reduce((sum, i) => sum + i.quantity, 0);
          
          // Map status to simpler type
          let status: OrderStatus = 'PENDING';
          if (o.status === 'PAID') status = 'PAID';
          else if (o.status === 'CANCELLED') status = 'CANCELLED';
          
          return {
            id: o.id,
            tableNumber: table?.number || 0,
            waiterName: waiter?.name || 'Serveur',
            createdAt: new Date(o.created_at),
            completedAt: o.status === 'PAID' ? new Date(o.updated_at) : undefined,
            status,
            itemsCount,
            total: o.total_amount,
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
        className="bg-white border-b border-gray-100 px-4 py-4"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View>
            <Text className="text-base font-semibold text-gray-900">
              Table {item.tableNumber}
            </Text>
            <Text className="text-sm text-gray-500">{item.waiterName}</Text>
          </View>
          <View
            style={{ backgroundColor: statusColors.bg }}
            className="px-2 py-1 rounded"
          >
            <Text style={{ color: statusColors.text }} className="text-xs font-semibold">
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-4 mb-2">
          <View className="flex-row items-center gap-1">
            <Clock size={14} color="#6B7280" />
            <Text className="text-sm text-gray-500">
              {item.createdAt && !isNaN(item.createdAt.getTime()) 
                ? format(item.createdAt, 'HH:mm', { locale: fr })
                : '--:--'}
            </Text>
          </View>
          <Text className="text-sm text-gray-500">
            {item.itemsCount} articles
          </Text>
          {item.paymentMethod && (
            <Text className="text-sm text-gray-500">
              {item.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
            </Text>
          )}
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-xs text-gray-400 font-mono">{item.id}</Text>
          <Text className="text-lg font-bold text-blue-600">{item.total} MAD</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const todayTotal = filteredOrders
    .filter(o => o.status === 'PAID')
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">Historique</Text>
            <Text className="text-sm text-gray-500">
              {filteredOrders.length} commandes • {todayTotal} MAD
            </Text>
          </View>
        </View>
      </View>

      {/* Search & Filter */}
      <View className="bg-white border-b border-gray-200 p-4">
        <View className="flex-row items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 mb-3">
          <Search size={18} color="#6B7280" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher par table, serveur, ID..."
            className="flex-1 text-gray-900"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View className="flex-row gap-2">
          {(['ALL', 'PAID', 'PENDING', 'CANCELLED'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setFilterStatus(status)}
              className={`px-3 py-2 rounded-lg ${
                filterStatus === status ? 'bg-blue-500' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  filterStatus === status ? 'text-white' : 'text-gray-600'
                }`}
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
          <View className="flex-1 items-center justify-center py-20">
            <Receipt size={48} color="#D1D5DB" />
            <Text className="text-gray-400 mt-4 text-center">
              Aucune commande trouvée
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
}
