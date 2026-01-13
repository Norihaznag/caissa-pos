import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, TrendingUp, ShoppingCart, Clock, History } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { orderService, orderItemService, tableService } from '../lib/services';

interface OrderSummary {
  id: string;
  tableNumber: number;
  totalAmount: number;
  itemsCount: number;
  status: 'PAID' | 'READY' | 'NEW' | 'PREPARING' | 'CANCELLED';
  createdAt: Date;
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState(new Date());

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
            createdAt: new Date(o.created_at),
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

  // Calculate stats
  const paidOrders = Array.isArray(orders) ? orders.filter(o => o && o.status === 'PAID') : [];
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o?.totalAmount || 0), 0);
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  const getStatusBadge = (status: OrderSummary['status']) => {
    const styles = {
      PAID: { bg: 'bg-green-100', text: 'text-green-700', label: 'Payée' },
      READY: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Prête' },
      PREPARING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En cours' },
      NEW: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Nouvelle' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Annulée' },
    };
    return styles[status];
  };

  const renderOrder = ({ item }: { item: OrderSummary }) => {
    const statusStyle = getStatusBadge(item.status);
    
    return (
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-gray-100 rounded-lg items-center justify-center">
              <Text className="text-lg font-bold text-gray-600">{item.tableNumber}</Text>
            </View>
            <View>
              <Text className="text-base font-semibold text-gray-900">
                Table {item.tableNumber}
              </Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Clock size={12} color="#9CA3AF" />
                <Text className="text-xs text-gray-500">
                  {item.createdAt && !isNaN(item.createdAt.getTime()) 
                    ? format(item.createdAt, 'HH:mm', { locale: fr })
                    : '--:--'}
                </Text>
                <Text className="text-xs text-gray-400">•</Text>
                <Text className="text-xs text-gray-500">
                  {item.itemsCount} articles
                </Text>
              </View>
            </View>
          </View>
          <View className="items-end gap-2">
            <Text className="text-base font-bold text-gray-900">{item.totalAmount} MAD</Text>
            <View className={`px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
              <Text className={`text-xs font-medium ${statusStyle.text}`}>
                {statusStyle.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-gray-900">Rapport du Jour</Text>
              <Text className="text-sm text-gray-500">
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={loadOrders}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
          >
            <RefreshCw size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/order-history')}
            className="w-10 h-10 items-center justify-center bg-blue-100 rounded-lg"
          >
            <History size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View className="p-4 gap-3">
        <View className="flex-row gap-3">
          {/* Total Revenue */}
          <View className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <TrendingUp size={16} color="#10B981" />
              <Text className="text-xs text-gray-500">Revenu Total</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">{totalRevenue} MAD</Text>
          </View>

          {/* Orders Count */}
          <View className="flex-1 bg-white border border-gray-200 rounded-lg p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <ShoppingCart size={16} color="#3B82F6" />
              <Text className="text-xs text-gray-500">Commandes</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">{paidOrders.length}</Text>
          </View>
        </View>

        {/* Average Order Value */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-blue-600 mb-1">Panier Moyen</Text>
              <Text className="text-xl font-bold text-blue-900">
                {avgOrderValue.toFixed(0)} MAD
              </Text>
            </View>
            <View className="bg-blue-100 px-3 py-1 rounded-full">
              <Text className="text-sm font-semibold text-blue-700">
                {orders.length} total
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Orders List Header */}
      <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <Text className="text-sm font-semibold text-gray-700">
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
    </SafeAreaView>
  );
}
