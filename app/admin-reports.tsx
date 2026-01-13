import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, TrendingUp, ShoppingCart, Clock, History } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OrderSummary {
  id: string;
  tableNumber: number;
  totalAmount: number;
  itemsCount: number;
  status: 'PAID' | 'READY' | 'NEW' | 'PREPARING';
  createdAt: Date;
}

// Mock data
const generateMockOrders = (): OrderSummary[] => {
  const statuses: OrderSummary['status'][] = ['PAID', 'READY', 'PAID', 'PAID', 'READY'];
  return Array.from({ length: 15 }, (_, i) => ({
    id: (i + 1).toString(),
    tableNumber: Math.floor(Math.random() * 12) + 1,
    totalAmount: Math.floor(Math.random() * 150) + 20,
    itemsCount: Math.floor(Math.random() * 6) + 1,
    status: statuses[i % statuses.length],
    createdAt: new Date(Date.now() - Math.random() * 8 * 60 * 60 * 1000), // Random time today
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate] = useState(new Date());

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    // TODO: Replace with Supabase query
    await new Promise(resolve => setTimeout(resolve, 500));
    setOrders(generateMockOrders());
    setLoading(false);
  };

  // Calculate stats
  const paidOrders = orders.filter(o => o.status === 'PAID');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  const getStatusBadge = (status: OrderSummary['status']) => {
    const styles = {
      PAID: { bg: 'bg-green-100', text: 'text-green-700', label: 'Payée' },
      READY: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Prête' },
      PREPARING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En cours' },
      NEW: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Nouvelle' },
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
                  {format(item.createdAt, 'HH:mm', { locale: fr })}
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
