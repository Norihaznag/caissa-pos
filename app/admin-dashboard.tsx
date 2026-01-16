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
      // Fetch counts from Supabase with partial failure handling
      const results = await Promise.allSettled([
        productService.getAll(),
        categoryService.getAll(),
        tableService.getAll(),
        userService.getAll(),
        orderService.getToday(),
      ]);
      
      const products = results[0].status === 'fulfilled' ? results[0].value : [];
      const categories = results[1].status === 'fulfilled' ? results[1].value : [];
      const tables = results[2].status === 'fulfilled' ? results[2].value : [];
      const users = results[3].status === 'fulfilled' ? results[3].value : [];
      const todayOrders = results[4].status === 'fulfilled' ? results[4].value : [];
      
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
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>Bienvenue</Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }} numberOfLines={1}>{user?.name || 'Admin'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={onRefresh}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
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
                borderRadius: 10,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} tintColor="#3B82F6" />
        }
      >
        {/* Stats Summary */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 }}>Aujourd&apos;hui</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Commandes</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 2 }}>{stats.todayOrders}</Text>
            </View>
            <View style={{ width: 1, height: 48, backgroundColor: '#E5E7EB' }} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Revenu</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#3B82F6', marginTop: 2 }}>{stats.todayRevenue} MAD</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={{ gap: 10 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route as any)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                    backgroundColor: `${item.color}15`,
                  }}
                >
                  <Icon size={24} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{item.title}</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{item.description}</Text>
                </View>
                {item.count !== undefined && (
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: `${item.color}15`,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: item.color }}>
                      {item.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Info */}
        <View style={{
          marginTop: 20,
          padding: 16,
          backgroundColor: '#EFF6FF',
          borderWidth: 1,
          borderColor: '#DBEAFE',
          borderRadius: 12,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E40AF', marginBottom: 4 }}>ADMINISTRATION</Text>
          <Text style={{ fontSize: 13, color: '#1D4ED8', lineHeight: 18 }}>
            Gérez vos produits, catégories, tables et consultez les rapports quotidiens.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}