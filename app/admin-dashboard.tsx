import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Package, Grid3x3, Table2, FileText, LogOut, RefreshCw, Users, Settings } from 'lucide-react-native';
import { useAppStore } from '../lib/store';
import { productService, categoryService, tableService, orderService, userService } from '../lib/services';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    productsCount: 0,
    categoriesCount: 0,
    tablesCount: 0,
    usersCount: 0,
    todayOrders: 0,
    todayRevenue: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      // Fetch counts from Supabase
      const [products, categories, tables, users, todayOrders] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
        tableService.getAll(),
        userService.getAll(),
        orderService.getToday(),
      ]);
      
      // Calculate today's revenue
      const todayRevenue = todayOrders
        .filter(o => o.status === 'PAID')
        .reduce((sum, o) => sum + o.total_amount, 0);
      
      setStats({
        productsCount: products.length,
        categoriesCount: categories.length,
        tablesCount: tables.length,
        usersCount: users.length,
        todayOrders: todayOrders.length,
        todayRevenue,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter?',
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

  const menuItems = [
    {
      id: 'products',
      title: 'Produits',
      description: 'Gérer les produits',
      icon: Package,
      count: stats.productsCount,
      route: '/admin-products',
      color: '#3B82F6',
    },
    {
      id: 'categories',
      title: 'Catégories',
      description: 'Gérer les catégories',
      icon: Grid3x3,
      count: stats.categoriesCount,
      route: '/admin-categories',
      color: '#10B981',
    },
    {
      id: 'tables',
      title: 'Tables',
      description: 'Gérer les tables',
      icon: Table2,
      count: stats.tablesCount,
      route: '/admin-tables',
      color: '#F59E0B',
    },
    {
      id: 'reports',
      title: 'Rapport du Jour',
      description: 'Commandes et revenus',
      icon: FileText,
      count: stats.todayOrders,
      route: '/admin-reports',
      color: '#8B5CF6',
    },
    {
      id: 'users',
      title: 'Utilisateurs',
      description: 'Gérer le personnel',
      icon: Users,
      count: stats.usersCount,
      route: '/admin-users',
      color: '#EC4899',
    },
    {
      id: 'settings',
      title: 'Paramètres',
      description: 'Configuration',
      icon: Settings,
      route: '/admin-settings',
      color: '#6B7280',
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-gray-500">Bienvenue</Text>
            <Text className="text-xl font-bold text-gray-900">{user?.name || 'Admin'}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={onRefresh}
              className="w-10 h-10 items-center justify-center"
            >
              <RefreshCw size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              className="w-10 h-10 items-center justify-center"
            >
              <LogOut size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Summary */}
        <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <Text className="text-sm font-semibold text-gray-900 mb-3">Aujourd&apos;hui</Text>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-gray-500">Commandes</Text>
              <Text className="text-2xl font-bold text-gray-900">{stats.todayOrders}</Text>
            </View>
            <View className="h-10 w-px bg-gray-200" />
            <View>
              <Text className="text-xs text-gray-500">Revenu</Text>
              <Text className="text-2xl font-bold text-blue-600">{stats.todayRevenue} MAD</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route as any)}
                className="bg-white border border-gray-200 rounded-lg active:bg-gray-50"
              >
                <View className="flex-row items-center p-4">
                  <View
                    className="w-12 h-12 items-center justify-center rounded-lg mr-4"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <Icon size={24} color={item.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{item.title}</Text>
                    <Text className="text-xs text-gray-500 mt-1">{item.description}</Text>
                  </View>
                  <View className="items-end">
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <Text className="text-sm font-bold" style={{ color: item.color }}>
                        {item.count}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Info */}
        <View className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Text className="text-xs font-semibold text-blue-900 mb-1">ADMINISTRATION</Text>
          <Text className="text-xs text-blue-800">
            Gérez vos produits, catégories, tables et consultez les rapports quotidiens.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}