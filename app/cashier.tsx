import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert, TextInput, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  LogOut, Plus, Minus, Trash2, Search, X, Receipt, RefreshCw, LayoutGrid, List, Package
} from 'lucide-react-native';
import { useAppStore, Order, Table as TableType } from '../lib/store';
import { 
  categoryService, productService, orderService, orderItemService, tableService 
} from '../lib/services';
import * as Haptics from 'expo-haptics';

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
};

type ViewMode = 'orders' | 'new-order';
type ProductViewMode = 'grid' | 'list';

export default function CashierScreen() {
  const router = useRouter();
  
  // Store
  const categories = useAppStore((state) => state.categories);
  const products = useAppStore((state) => state.products);
  const tables = useAppStore((state) => state.tables);
  const orders = useAppStore((state) => state.orders);
  const user = useAppStore((state) => state.user);
  const setCategories = useAppStore((state) => state.setCategories);
  const setProducts = useAppStore((state) => state.setProducts);
  const setTables = useAppStore((state) => state.setTables);
  const setOrders = useAppStore((state) => state.setOrders);
  const logout = useAppStore((state) => state.logout);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('orders');
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>('grid');
  const [selectedTable, setSelectedTable] = useState<TableType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const isLoadingRef = useRef(false);

  // Load all data
  const loadData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      const [categoriesDb, productsDb, tablesDb, ordersDb] = await Promise.all([
        categoryService.getAll(),
        productService.getAll(),
        tableService.getAll(),
        orderService.getPending(),
      ]);

      // Transform categories
      const categoriesData = categoriesDb.map(c => ({
        id: c.id,
        name: c.name,
        order: c.display_order,
      }));
      setCategories(categoriesData);
      if (categoriesData.length > 0 && !selectedCategory) {
        setSelectedCategory(categoriesData[0].id);
      }

      // Transform products
      const productsData = productsDb.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        categoryId: p.category_id,
        isActive: p.is_active,
        imageUrl: p.image_url,
      }));
      setProducts(productsData);

      // Transform tables with validation
      const pendingOrderIds = new Set(ordersDb.map(o => o.id));
      const tablesData: TableType[] = tablesDb.map(t => {
        let validOrderId = t.current_order_id;
        let tableStatus = t.status;
        
        if (t.current_order_id && !pendingOrderIds.has(t.current_order_id)) {
          validOrderId = undefined;
          tableStatus = 'open';
          tableService.setOpen(t.id).catch(console.error);
        }
        
        return {
          id: t.id,
          number: t.number,
          status: tableStatus,
          currentOrderId: validOrderId || undefined,
        };
      });
      setTables(tablesData);

      // Transform orders with items
      const ordersData: Order[] = await Promise.all(
        ordersDb.map(async (o) => {
          const itemsDb = await orderItemService.getByOrderId(o.id);
          const table = tablesDb.find(t => t.id === o.table_id);
          return {
            id: o.id,
            tableId: o.table_id,
            tableNumber: table?.number || 0,
            items: Array.isArray(itemsDb) ? itemsDb.filter(i => i).map(i => ({
              id: i.id || '',
              productId: i.product_id || '',
              productName: i.product_name || 'Produit',
              price: i.price || 0,
              quantity: i.quantity || 0,
            })) : [],
            status: o.status,
            isServed: o.is_served,
            totalAmount: o.total_amount,
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
            updatedAt: o.updated_at ? new Date(o.updated_at) : new Date(),
          };
        })
      );
      
      // Filter out orders with no items
      const validOrders = ordersData.filter(o => o.items && o.items.length > 0);
      setOrders(validOrders);

    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [setCategories, setProducts, setTables, setOrders, selectedCategory]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Filter products
  const filteredProducts = Array.isArray(products) 
    ? products.filter(p => {
        if (!p || !p.name || p.isActive === false) return false;
        const matchesCategory = (searchQuery?.length || 0) > 0 || p.categoryId === selectedCategory;
        const matchesSearch = (searchQuery?.length || 0) === 0 || 
          (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
        return matchesCategory && matchesSearch;
      })
    : [];

  // Cart functions
  const addToCart = (product: { id: string; name: string; price: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        productName: product.name, 
        price: product.price, 
        quantity: 1 
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prev => prev
      .map(item => item.productId === productId 
        ? { ...item, quantity: item.quantity + delta }
        : item
      )
      .filter(item => item.quantity > 0)
    );
  };

  const cartTotal = Array.isArray(cart) 
    ? cart.reduce((sum, item) => {
        if (!item) return sum;
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + (price * qty);
      }, 0)
    : 0;

  // Create order and process immediately
  const createAndProcessOrder = async (payNow: boolean = false) => {
    if (cart.length === 0) {
      Alert.alert('Panier Vide', 'Ajoutez des produits');
      return;
    }
    if (!selectedTable) {
      Alert.alert('Table Requise', 'Sélectionnez une table');
      return;
    }

    setProcessing(true);
    try {
      // Create order
      const newOrder = await orderService.create({
        table_id: selectedTable.id,
        waiter_id: user?.id || null,
        status: payNow ? 'PAID' : 'NEW',
        is_served: payNow,
        total_amount: cartTotal,
        payment_method: payNow ? 'cash' : undefined,
        paid_at: payNow ? new Date().toISOString() : undefined,
      });

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: newOrder.id,
        product_id: item.productId,
        product_name: item.productName,
        price: item.price,
        quantity: item.quantity,
      }));
      await orderItemService.createMany(orderItems);

      // Update table
      if (payNow) {
        await tableService.setOpen(selectedTable.id);
      } else {
        await tableService.setOccupied(selectedTable.id, newOrder.id);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        payNow ? 'Paiement Effectué ✓' : 'Commande Créée ✓',
        `Table ${selectedTable.number}\nTotal: ${cartTotal} MAD`,
        [{ text: 'OK' }]
      );

      // Reset
      setCart([]);
      setSelectedTable(null);
      setViewMode('orders');
      loadData();

    } catch (error) {
      console.error('Error creating order:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de créer la commande');
    } finally {
      setProcessing(false);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await orderService.updateStatus(orderId, newStatus);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour');
    }
  };

  // Complete payment for existing order
  const completePayment = async (order: Order) => {
    setProcessing(true);
    try {
      await orderService.update(order.id, {
        status: 'PAID',
        is_served: true,
        payment_method: 'cash',
        paid_at: new Date().toISOString(),
      });
      await tableService.setOpen(order.tableId);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Paiement Effectué ✓', `Table ${order.tableNumber}\nTotal: ${order.totalAmount} MAD`);
      loadData();
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Erreur', 'Impossible de traiter le paiement');
    } finally {
      setProcessing(false);
    }
  };

  // Cancel order
  const cancelOrder = async (order: Order) => {
    Alert.alert(
      'Annuler Commande?',
      `Table ${order.tableNumber} - ${order.totalAmount} MAD`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, Annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await orderService.cancelOrder(order.id, 'Annulé par caissier');
              await tableService.setOpen(order.tableId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadData();
            } catch {
              Alert.alert('Erreur', 'Impossible d\'annuler');
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => { logout(); router.replace('/'); } }
    ]);
  };

  // Active orders - sorted by status priority (NEW -> PREPARING -> READY)
  const statusOrder = { 'NEW': 0, 'PREPARING': 1, 'READY': 2 };
  const activeOrders = Array.isArray(orders) 
    ? orders
        .filter(o => o && o.status && !['PAID', 'CANCELLED'].includes(o.status))
        .sort((a, b) => {
          const orderA = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
          const orderB = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
          return orderA - orderB;
        })
    : [];

  // Available tables (for new order)
  const availableTables = Array.isArray(tables)
    ? tables.filter(t => t.status === 'open')
    : [];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  // Render order card
  const renderOrderCard = (order: Order) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      NEW: { bg: '#FEE2E2', text: '#DC2626' },
      PREPARING: { bg: '#FEF3C7', text: '#D97706' },
      READY: { bg: '#DCFCE7', text: '#16A34A' },
    };
    const color = statusColors[order.status || 'NEW'] || statusColors.NEW;

    return (
      <View 
        key={order.id}
        style={{ 
          backgroundColor: '#FFFFFF', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 12,
          borderLeftWidth: 4,
          borderLeftColor: color.text,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ 
              width: 40, height: 40, borderRadius: 8, 
              backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' 
            }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: color.text }}>
                {order.tableNumber}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
                Table {order.tableNumber}
              </Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {order.items?.length || 0} articles
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: color.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: color.text }}>
              {order.status === 'NEW' ? 'NOUVELLE' : order.status === 'PREPARING' ? 'EN COURS' : 'PRÊTE'}
            </Text>
          </View>
        </View>

        {/* Items */}
        <View style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          {(order.items || []).slice(0, 3).map((item, idx) => (
            <Text key={idx} style={{ fontSize: 14, color: '#374151', marginBottom: 2 }}>
              {item.quantity}x {item.productName}
            </Text>
          ))}
          {(order.items?.length || 0) > 3 && (
            <Text style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>
              +{(order.items?.length || 0) - 3} autres...
            </Text>
          )}
        </View>

        {/* Total */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
          {order.totalAmount} MAD
        </Text>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {order.status === 'NEW' && (
            <TouchableOpacity
              onPress={() => updateOrderStatus(order.id, 'PREPARING')}
              style={{ flex: 1, backgroundColor: '#F59E0B', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>🍳 Préparer</Text>
            </TouchableOpacity>
          )}
          {order.status === 'PREPARING' && (
            <TouchableOpacity
              onPress={() => updateOrderStatus(order.id, 'READY')}
              style={{ flex: 1, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>✓ Prête</Text>
            </TouchableOpacity>
          )}
          {order.status === 'READY' && (
            <TouchableOpacity
              onPress={() => completePayment(order)}
              disabled={processing}
              style={{ flex: 1, backgroundColor: '#3B82F6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>💳 Encaisser</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => cancelOrder(order)}
            style={{ width: 44, backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
          >
            <Trash2 size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{ 
        backgroundColor: '#FFFFFF', 
        paddingHorizontal: 16, 
        paddingVertical: 12,
        borderBottomWidth: 1, 
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
            Mode Caissier
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280' }}>
            {user?.name || 'Caissier'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            onPress={loadData}
            style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleLogout}
            style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}
          >
            <LogOut size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Toggle */}
      <View style={{ flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#F3F4F6' }}>
        <TouchableOpacity
          onPress={() => setViewMode('orders')}
          style={{ 
            flex: 1, 
            paddingVertical: 14, 
            borderRadius: 10, 
            backgroundColor: viewMode === 'orders' ? '#FFFFFF' : 'transparent',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            shadowColor: viewMode === 'orders' ? '#000' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: viewMode === 'orders' ? 2 : 0,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: viewMode === 'orders' ? '#10B981' : '#6B7280' }}>
            📋 Commandes
          </Text>
          {activeOrders.length > 0 && (
            <View style={{ backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode('new-order')}
          style={{ 
            flex: 1, 
            paddingVertical: 14, 
            borderRadius: 10, 
            backgroundColor: viewMode === 'new-order' ? '#FFFFFF' : 'transparent',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            shadowColor: viewMode === 'new-order' ? '#000' : 'transparent',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: viewMode === 'new-order' ? 2 : 0,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: viewMode === 'new-order' ? '#10B981' : '#6B7280' }}>
            ➕ Nouvelle
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders View */}
      {viewMode === 'orders' && (
        <ScrollView 
          style={{ flex: 1, padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
        >
          {activeOrders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Receipt size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 16, color: '#9CA3AF', marginTop: 12 }}>Aucune commande active</Text>
              <TouchableOpacity 
                onPress={() => setViewMode('new-order')}
                style={{ marginTop: 16, backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Créer une commande</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeOrders.map(order => renderOrderCard(order))
          )}
        </ScrollView>
      )}

      {/* New Order View */}
      {viewMode === 'new-order' && (
        <View style={{ flex: 1 }}>
          {/* Table Selection - Compact */}
          <View style={{ 
            paddingHorizontal: 12, 
            paddingVertical: 10, 
            backgroundColor: '#FFFFFF', 
            borderBottomWidth: 1, 
            borderBottomColor: '#E5E7EB',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>
              Table:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {availableTables.map(table => (
                  <TouchableOpacity
                    key={table.id}
                    onPress={() => setSelectedTable(table)}
                    style={{
                      width: 42, height: 42, borderRadius: 10,
                      backgroundColor: selectedTable?.id === table.id ? '#10B981' : '#F3F4F6',
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: selectedTable?.id === table.id ? 0 : 1,
                      borderColor: '#E5E7EB',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 15, fontWeight: '700', 
                      color: selectedTable?.id === table.id ? '#FFFFFF' : '#374151' 
                    }}>
                      {table.number}
                    </Text>
                  </TouchableOpacity>
                ))}
                {availableTables.length === 0 && (
                  <Text style={{ color: '#9CA3AF', fontStyle: 'italic', paddingVertical: 8, fontSize: 13 }}>
                    Toutes occupées
                  </Text>
                )}
              </View>
            </ScrollView>
            {selectedTable && (
              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: '#16A34A', fontWeight: '600', fontSize: 13 }}>T{selectedTable.number} ✓</Text>
              </View>
            )}
          </View>

          {/* Search + Categories Combined */}
          <View style={{ backgroundColor: '#FFFFFF', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            {/* Search + View Toggle */}
            <View style={{ paddingHorizontal: 12, paddingTop: 10, flexDirection: 'row', gap: 8 }}>
              <View style={{ 
                flex: 1,
                flexDirection: 'row', alignItems: 'center', 
                backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12,
                borderWidth: 1, borderColor: '#E5E7EB',
              }}>
                <Search size={18} color="#9CA3AF" />
                <TextInput
                  placeholder="Rechercher produit..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15, color: '#111827' }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={18} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
              {/* Grid/List Toggle */}
              <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4 }}>
                <TouchableOpacity
                  onPress={() => setProductViewMode('grid')}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: productViewMode === 'grid' ? '#FFFFFF' : 'transparent',
                  }}
                >
                  <LayoutGrid size={20} color={productViewMode === 'grid' ? '#10B981' : '#9CA3AF'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setProductViewMode('list')}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: productViewMode === 'list' ? '#FFFFFF' : 'transparent',
                  }}
                >
                  <List size={20} color={productViewMode === 'list' ? '#10B981' : '#9CA3AF'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Categories */}
            {searchQuery.length === 0 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 10 }}
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={{
                      paddingHorizontal: 16, 
                      paddingVertical: 8, 
                      borderRadius: 20,
                      marginRight: 8,
                      backgroundColor: selectedCategory === cat.id ? '#10B981' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: selectedCategory === cat.id ? '#10B981' : '#D1D5DB',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '500', 
                      color: selectedCategory === cat.id ? '#FFFFFF' : '#374151' 
                    }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Products - Grid or List View */}
          {productViewMode === 'grid' ? (
            <FlatList
              data={filteredProducts}
              numColumns={2}
              key="grid"
              contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 200 : 12 }}
              columnWrapperStyle={{ gap: 10 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const inCart = cart.find(c => c.productId === item.id);
                return (
                  <TouchableOpacity
                    onPress={() => addToCart(item)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      backgroundColor: inCart ? '#F0FDF4' : '#FFFFFF',
                      borderRadius: 12,
                      padding: 10,
                      borderWidth: inCart ? 2 : 1,
                      borderColor: inCart ? '#10B981' : '#E5E7EB',
                      minHeight: 140,
                    }}
                  >
                    {/* Product Image */}
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={{
                          width: '100%',
                          height: 60,
                          borderRadius: 8,
                          backgroundColor: '#F3F4F6',
                          marginBottom: 6,
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{
                        width: '100%',
                        height: 60,
                        borderRadius: 8,
                        backgroundColor: '#F3F4F6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                      }}>
                        <Package size={24} color="#D1D5DB" />
                      </View>
                    )}
                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#111827', lineHeight: 18 }} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#10B981', marginTop: 4 }}>
                      {item.price} MAD
                    </Text>
                    {inCart && (
                      <View style={{ 
                        position: 'absolute', top: -8, right: -8,
                        backgroundColor: '#10B981', 
                        minWidth: 26, height: 26, borderRadius: 13,
                        alignItems: 'center', justifyContent: 'center',
                        paddingHorizontal: 6,
                        borderWidth: 2, borderColor: '#FFFFFF',
                      }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>{inCart.quantity}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          ) : (
            <FlatList
              data={filteredProducts}
              key="list"
              contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 200 : 12 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const inCart = cart.find(c => c.productId === item.id);
                return (
                  <TouchableOpacity
                    onPress={() => addToCart(item)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: inCart ? '#F0FDF4' : '#FFFFFF',
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: inCart ? 2 : 1,
                      borderColor: inCart ? '#10B981' : '#E5E7EB',
                    }}
                  >
                    {/* Product Image */}
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          backgroundColor: '#F3F4F6',
                          marginRight: 12,
                        }}
                      />
                    ) : (
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        backgroundColor: '#F3F4F6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}>
                        <Package size={20} color="#D1D5DB" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '500', color: '#111827' }} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#10B981', marginRight: 12 }}>
                      {item.price} MAD
                    </Text>
                    {inCart ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity 
                          onPress={(e) => { e.stopPropagation(); updateQuantity(item.id, -1); }}
                          style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={16} color="#DC2626" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#10B981', minWidth: 24, textAlign: 'center' }}>
                          {inCart.quantity}
                        </Text>
                        <TouchableOpacity 
                          onPress={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                          style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={16} color="#16A34A" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={18} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Cart Summary - Fixed at Bottom */}
          {cart.length > 0 && (
            <View style={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#FFFFFF', 
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
              borderTopWidth: 1, 
              borderTopColor: '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 10,
            }}>
              {/* Cart Items - Compact */}
              <ScrollView style={{ maxHeight: 100, marginBottom: 10 }} showsVerticalScrollIndicator={false}>
                {cart.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ flex: 1, fontSize: 13, color: '#374151' }} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity 
                        onPress={() => updateQuantity(item.productId, -1)}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus size={14} color="#6B7280" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 14, fontWeight: '600', minWidth: 20, textAlign: 'center' }}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => updateQuantity(item.productId, 1)}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={14} color="#6B7280" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', minWidth: 55, textAlign: 'right' }}>
                        {item.price * item.quantity} DH
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Total + Actions */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setCart([])}
                  style={{ width: 44, height: 44, backgroundColor: '#FEE2E2', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Trash2 size={18} color="#DC2626" />
                </TouchableOpacity>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>Total</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{cartTotal} MAD</Text>
                </View>
                
                <TouchableOpacity
                  onPress={() => createAndProcessOrder(false)}
                  disabled={processing || !selectedTable}
                  style={{ 
                    paddingHorizontal: 16,
                    paddingVertical: 12, 
                    backgroundColor: !selectedTable ? '#D1D5DB' : '#F59E0B', 
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                    📋 Cmd
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => createAndProcessOrder(true)}
                  disabled={processing || !selectedTable}
                  style={{ 
                    paddingHorizontal: 20,
                    paddingVertical: 12, 
                    backgroundColor: !selectedTable ? '#D1D5DB' : '#10B981', 
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                    💳 Payer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
