import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, Alert, TextInput, ActivityIndicator, useWindowDimensions, Modal, Platform, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  LogOut, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  X, 
  RefreshCw,
  Wifi,
  WifiOff,
  Search,
  Clock,
  Receipt,
  Percent,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Crypto from 'expo-crypto';
import { useAppStore } from '../lib/store';
import { 
  initOfflineDatabase, 
  offlineCategoryService, 
  offlineProductService, 
  offlineOrderService,
  OfflineOrder,
  OfflineOrderItem,
  getSyncQueueCount,
  clearInvalidSyncQueueItems,
} from '../lib/offline-db';
import { syncFromServer, syncToSupabase, checkConnectivity, performFullSync } from '../lib/sync-manager';

// Types
interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  note?: string;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName?: string;
  isActive: boolean;
}

export default function CashierSimpleScreen() {
  const router = useRouter();
  const logout = useAppStore((state) => state.logout);
  const user = useAppStore((state) => state.user);
  
  // Responsive dimensions
  const { width, height } = useWindowDimensions();
  const isPhone = width < 768;
  const isLandscape = width > height;
  const numColumns = isPhone ? 2 : 4;
  const [showCartModal, setShowCartModal] = useState(false);
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [todayOrders, setTodayOrders] = useState<OfflineOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  
  // Stats
  const [dailyStats, setDailyStats] = useState({
    totalOrders: 0,
    paidOrders: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    cardRevenue: 0,
  });

  // Allow auto-rotation based on user's device settings
  useEffect(() => {
    const enableAutoRotate = async () => {
      // Unlock orientation to follow device auto-rotate setting
      await ScreenOrientation.unlockAsync();
    };
    enableAutoRotate();
    
    return () => {
      // Reset to portrait when leaving the screen
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Initialize database and load data
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Initialize SQLite database
        await initOfflineDatabase();
        
        // Clear any old sync queue items with invalid UUID format
        await clearInvalidSyncQueueItems();
        
        // Check connectivity
        const online = await checkConnectivity();
        setIsOnline(online);
        
        // Sync from server if online
        if (online) {
          await syncFromServer();
        }
        
        // Load data from local database
        await loadLocalData();
        await loadTodayOrders();
        await updatePendingCount();
        
      } catch (error) {
        console.error('Init error:', error);
        Alert.alert('Erreur', 'Impossible d\'initialiser la base de données');
      } finally {
        setLoading(false);
      }
    };
    
    init();
    
    // Check connectivity periodically
    const interval = setInterval(async () => {
      const online = await checkConnectivity();
      setIsOnline(online);
      await updatePendingCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadLocalData = async () => {
    const [cats, prods] = await Promise.all([
      offlineCategoryService.getAll(),
      offlineProductService.getAll(),
    ]);
    
    setCategories(cats.map(c => ({ id: c.id, name: c.name })));
    setProducts(prods.filter(p => p.isActive));
  };

  const loadTodayOrders = async () => {
    const orders = await offlineOrderService.getTodayOrders();
    setTodayOrders(orders);
    
    const stats = await offlineOrderService.getDailyStats();
    setDailyStats(stats);
  };

  const updatePendingCount = async () => {
    const count = await getSyncQueueCount();
    setPendingSyncCount(count);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await performFullSync();
      
      if (result.downloadResult.success) {
        await loadLocalData();
        await loadTodayOrders();
      }
      
      await updatePendingCount();
      
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      Alert.alert(
        'Synchronisation',
        `✅ Téléchargé: ${result.downloadResult.categoriesCount} catégories, ${result.downloadResult.productsCount} produits\n` +
        `📤 Envoyé: ${result.uploadResult.synced} éléments\n` +
        `⏳ En attente: ${result.uploadResult.pending} éléments`
      );
    } catch {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Erreur', 'Erreur de synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  // Cart operations
  const addToCart = (product: Product) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    
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
        quantity: 1,
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    
    setCart(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    setCart([]);
    setDiscountPercent('');
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = discountPercent ? (subtotal * parseFloat(discountPercent || '0')) / 100 : 0;
  const total = Math.max(0, subtotal - discount);
  const received = parseFloat(amountReceived || '0') || 0;
  const change = Math.max(0, received - total);

  // Payment
  const handlePayment = async () => {
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de payer');
      return;
    }
    
    if (paymentMethod === 'cash' && received < total) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Montant insuffisant', `Le montant reçu (${received.toFixed(2)} MAD) est inférieur au total (${total.toFixed(2)} MAD)`);
      return;
    }
    
    try {
      const orderId = Crypto.randomUUID();
      const now = new Date();
      const items: OfflineOrderItem[] = cart.map((item) => ({
        id: Crypto.randomUUID(),
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        note: item.note,
      }));
      
      await offlineOrderService.create({
        id: orderId,
        status: 'PAID',
        totalAmount: total,
        paymentMethod,
        discount: discount,
        discountType: discountPercent ? 'percent' : 'amount',
        amountReceived: paymentMethod === 'cash' ? received : total,
        changeAmount: paymentMethod === 'cash' ? change : 0,
        createdAt: now,
        paidAt: now,
        items,
      });
      
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      
      // Reset
      setCart([]);
      setAmountReceived('');
      setDiscountPercent('');
      setShowPaymentModal(false);
      
      // Reload stats
      await loadTodayOrders();
      await updatePendingCount();
      
      // Try to sync if online
      if (isOnline) {
        syncToSupabase().catch(console.error);
      }
      
      Alert.alert('✅ Paiement effectué', `Total: ${total.toFixed(2)} MAD\nMode: ${paymentMethod === 'cash' ? 'Espèces' : 'Carte'}`);
      
    } catch (error) {
      console.error('Payment error:', error);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Erreur', 'Erreur lors du paiement');
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
          onPress: async () => {
            // Reset to portrait before leaving
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Quick amount buttons
  const quickAmounts = [50, 100, 200, 500];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {/* Header - Facebook Lite Style */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
      }}>
        {/* Left - Title */}
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#7C3AED' }}>Caisse</Text>
        
        {/* Right - Action Icons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {/* Connection status pill */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            gap: 4,
          }}>
            {isOnline ? (
              <Wifi size={18} color="#10B981" />
            ) : (
              <WifiOff size={18} color="#EF4444" />
            )}
            {pendingSyncCount > 0 && (
              <View style={{ 
                backgroundColor: '#F59E0B', 
                borderRadius: 10, 
                minWidth: 18, 
                height: 18, 
                alignItems: 'center', 
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}>
                <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: '700' }}>
                  {pendingSyncCount}
                </Text>
              </View>
            )}
          </View>
          
          {/* Sync button */}
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncing}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={22} color={syncing ? '#9CA3AF' : '#4B5563'} />
          </TouchableOpacity>
          
          {/* Orders button */}
          <TouchableOpacity
            onPress={() => setShowOrdersModal(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Receipt size={22} color="#4B5563" />
          </TouchableOpacity>
          
          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut size={22} color="#4B5563" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar - Compact horizontal strip */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
      }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>Total:</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7C3AED' }}>
              {dailyStats.totalRevenue.toFixed(0)} MAD
            </Text>
          </View>
          <View style={{ width: 1, height: 16, backgroundColor: '#E5E7EB' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Banknote size={14} color="#10B981" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#10B981' }}>
              {dailyStats.cashRevenue.toFixed(0)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <CreditCard size={14} color="#3B82F6" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#3B82F6' }}>
              {dailyStats.cardRevenue.toFixed(0)}
            </Text>
          </View>
          <View style={{ width: 1, height: 16, backgroundColor: '#E5E7EB' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Receipt size={14} color="#6B7280" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
              {dailyStats.paidOrders}
            </Text>
          </View>
        </ScrollView>
      </View>

      <View style={{ flex: 1, flexDirection: isPhone ? 'column' : 'row' }}>
        {/* Products Section */}
        <View style={{ flex: 1, padding: 10 }}>
          {/* Search */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#EEEEEE',
            borderRadius: 20,
            paddingHorizontal: 14,
            marginBottom: 10,
          }}>
            <Search size={18} color="#9CA3AF" />
            <TextInput
              style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, fontSize: 14 }}
              placeholder="Rechercher..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Categories - Compact chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
            contentContainerStyle={{ paddingRight: 10 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedCategory('all')}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: selectedCategory === 'all' ? '#7C3AED' : '#FFFFFF',
                marginRight: 8,
                borderWidth: selectedCategory === 'all' ? 0 : 1,
                borderColor: '#E0E0E0',
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: selectedCategory === 'all' ? '600' : '500',
                color: selectedCategory === 'all' ? '#FFFFFF' : '#4B5563',
              }}>
                Tous
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: selectedCategory === cat.id ? '#7C3AED' : '#FFFFFF',
                  marginRight: 8,
                  borderWidth: selectedCategory === cat.id ? 0 : 1,
                  borderColor: '#E0E0E0',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: selectedCategory === cat.id ? '600' : '500',
                  color: selectedCategory === cat.id ? '#FFFFFF' : '#4B5563',
                }}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Products Grid - Responsive columns */}
          <FlatList
            data={filteredProducts}
            key={numColumns} // Force re-render when columns change
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: isPhone ? 100 : 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => addToCart(item)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  margin: 5,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 0,
                  minHeight: isPhone ? 90 : 80,
                  maxWidth: isPhone ? '46%' : '23%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Text 
                  style={{ 
                    fontSize: isPhone ? 14 : 13, 
                    fontWeight: '500', 
                    color: '#1F2937',
                    textAlign: 'center',
                    marginBottom: 4,
                    lineHeight: isPhone ? 18 : 16,
                  }}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text style={{ fontSize: isPhone ? 15 : 14, fontWeight: '700', color: '#7C3AED' }}>
                  {item.price.toFixed(0)} MAD
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
                <Text style={{ fontSize: 16, color: '#9CA3AF' }}>Aucun produit trouvé</Text>
              </View>
            )}
          />
        </View>

        {/* Cart Section - Side panel on tablet, Modal on phone */}
        {!isPhone && (
          <View style={{ 
            width: 300, 
            backgroundColor: '#FFFFFF',
            borderLeftWidth: 1,
            borderLeftColor: '#E5E7EB',
          }}>
            {/* Cart Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
              backgroundColor: '#F9FAFB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={20} color="#7C3AED" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                  Panier ({cart.reduce((sum, i) => sum + i.quantity, 0)})
                </Text>
              </View>
              {cart.length > 0 && (
                <TouchableOpacity onPress={clearCart}>
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>

            {/* Cart Items */}
            <ScrollView style={{ flex: 1 }}>
              {cart.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Panier vide</Text>
                </View>
              ) : (
                cart.map((item) => (
                  <View
                    key={item.productId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F3F4F6',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                        {item.productName}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#7C3AED' }}>
                        {item.price.toFixed(0)} × {item.quantity} = {(item.price * item.quantity).toFixed(0)} MAD
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.productId, -1)}
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: '#F3F4F6',
                          borderRadius: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Minus size={14} color="#374151" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 14, fontWeight: '600', minWidth: 24, textAlign: 'center' }}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.productId, 1)}
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: '#7C3AED',
                          borderRadius: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Plus size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Cart Footer */}
            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              {/* Discount */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F9FAFB',
                borderRadius: 8,
                paddingHorizontal: 10,
                marginBottom: 10,
              }}>
                <Percent size={16} color="#9CA3AF" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, fontSize: 14 }}
                  placeholder="Remise %"
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Totals */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>Sous-total</Text>
                  <Text style={{ fontSize: 13, color: '#374151' }}>{subtotal.toFixed(2)} MAD</Text>
                </View>
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: '#EF4444' }}>Remise</Text>
                    <Text style={{ fontSize: 13, color: '#EF4444' }}>-{discount.toFixed(2)} MAD</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Total</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#7C3AED' }}>{total.toFixed(2)} MAD</Text>
                </View>
              </View>

              {/* Payment Buttons */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('cash');
                    setAmountReceived('');
                    setShowPaymentModal(true);
                  }}
                  disabled={cart.length === 0}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: cart.length === 0 ? '#E5E7EB' : '#10B981',
                    paddingVertical: 14,
                    borderRadius: 10,
                  }}
                >
                  <Banknote size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Espèces</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('card');
                    setAmountReceived(total.toString());
                    setShowPaymentModal(true);
                  }}
                  disabled={cart.length === 0}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: cart.length === 0 ? '#E5E7EB' : '#3B82F6',
                    paddingVertical: 14,
                    borderRadius: 10,
                  }}
                >
                  <CreditCard size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>Carte</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Floating Cart Button for Phone */}
      {isPhone && (
        <TouchableOpacity
          onPress={() => setShowCartModal(true)}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#7C3AED',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 30,
            shadowColor: '#7C3AED',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            gap: 8,
          }}
        >
          <ShoppingCart size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            {cart.reduce((sum, i) => sum + i.quantity, 0)}
          </Text>
          {total > 0 && (
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#E9D5FF' }}>
              • {total.toFixed(0)} MAD
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Cart Modal for Phone */}
      <Modal
        visible={showCartModal && isPhone}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: height * 0.85,
          }}>
            {/* Cart Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ShoppingCart size={24} color="#7C3AED" />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                  Panier ({cart.reduce((sum, i) => sum + i.quantity, 0)})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {cart.length > 0 && (
                  <TouchableOpacity onPress={clearCart}>
                    <Trash2 size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowCartModal(false)}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Cart Items */}
            <ScrollView style={{ maxHeight: height * 0.4 }}>
              {cart.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ShoppingCart size={48} color="#E5E7EB" />
                  <Text style={{ color: '#9CA3AF', fontSize: 16, marginTop: 12 }}>Panier vide</Text>
                </View>
              ) : (
                cart.map((item) => (
                  <View
                    key={item.productId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F3F4F6',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                        {item.productName}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#7C3AED', marginTop: 2 }}>
                        {item.price.toFixed(0)} × {item.quantity} = {(item.price * item.quantity).toFixed(0)} MAD
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.productId, -1)}
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: '#F3F4F6',
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Minus size={18} color="#374151" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 16, fontWeight: '700', minWidth: 30, textAlign: 'center' }}>
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => updateQuantity(item.productId, 1)}
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: '#7C3AED',
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Plus size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Cart Footer */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              {/* Discount */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F9FAFB',
                borderRadius: 10,
                paddingHorizontal: 12,
                marginBottom: 12,
              }}>
                <Percent size={18} color="#9CA3AF" />
                <TextInput
                  style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 16 }}
                  placeholder="Remise %"
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Totals */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: '#6B7280' }}>Sous-total</Text>
                  <Text style={{ fontSize: 14, color: '#374151' }}>{subtotal.toFixed(2)} MAD</Text>
                </View>
                {discount > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, color: '#EF4444' }}>Remise</Text>
                    <Text style={{ fontSize: 14, color: '#EF4444' }}>-{discount.toFixed(2)} MAD</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Total</Text>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#7C3AED' }}>{total.toFixed(2)} MAD</Text>
                </View>
              </View>

              {/* Payment Buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('cash');
                    setAmountReceived('');
                    setShowCartModal(false);
                    setShowPaymentModal(true);
                  }}
                  disabled={cart.length === 0}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: cart.length === 0 ? '#E5E7EB' : '#10B981',
                    paddingVertical: 16,
                    borderRadius: 12,
                  }}
                >
                  <Banknote size={22} color="#FFFFFF" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Espèces</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('card');
                    setAmountReceived(total.toString());
                    setShowCartModal(false);
                    setShowPaymentModal(true);
                  }}
                  disabled={cart.length === 0}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: cart.length === 0 ? '#E5E7EB' : '#3B82F6',
                    paddingVertical: 16,
                    borderRadius: 12,
                  }}
                >
                  <CreditCard size={22} color="#FFFFFF" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Carte</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%', maxWidth: 400 }}
            >
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                width: '100%',
                overflow: 'hidden',
              }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              backgroundColor: paymentMethod === 'cash' ? '#10B981' : '#3B82F6',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {paymentMethod === 'cash' ? (
                  <Banknote size={24} color="#FFFFFF" />
                ) : (
                  <CreditCard size={24} color="#FFFFFF" />
                )}
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>
                  {paymentMethod === 'cash' ? 'Paiement Espèces' : 'Paiement Carte'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              {/* Total */}
              <View style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 4 }}>À payer</Text>
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#111827' }}>
                  {total.toFixed(2)} MAD
                </Text>
              </View>

              {/* Cash payment specific */}
              {paymentMethod === 'cash' && (
                <>
                  {/* Amount received */}
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                    Montant reçu
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: '#F9FAFB',
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 20,
                      fontWeight: '700',
                      textAlign: 'center',
                      marginBottom: 12,
                    }}
                    value={amountReceived}
                    onChangeText={setAmountReceived}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Quick amounts */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {quickAmounts.map(amt => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setAmountReceived(amt.toString())}
                        style={{
                          flex: 1,
                          backgroundColor: '#F3F4F6',
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                          {amt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setAmountReceived(total.toFixed(2))}
                      style={{
                        flex: 1,
                        backgroundColor: '#10B981',
                        paddingVertical: 10,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                        Exact
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Change */}
                  {received >= total && (
                    <View style={{
                      backgroundColor: '#FEF3C7',
                      borderRadius: 10,
                      padding: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}>
                      <Text style={{ fontSize: 14, color: '#92400E' }}>Monnaie à rendre</Text>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: '#92400E' }}>
                        {change.toFixed(2)} MAD
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Confirm Button */}
              <TouchableOpacity
                onPress={handlePayment}
                disabled={paymentMethod === 'cash' && received < total}
                style={{
                  backgroundColor: paymentMethod === 'cash' && received < total ? '#E5E7EB' : '#7C3AED',
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                  Confirmer le paiement
                </Text>
              </TouchableOpacity>
            </View>
          </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Orders Modal */}
      <Modal
        visible={showOrdersModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowOrdersModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxWidth: 500,
            maxHeight: '80%',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              backgroundColor: '#7C3AED',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Receipt size={24} color="#FFFFFF" />
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>
                  Commandes du jour ({todayOrders.length})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowOrdersModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={todayOrders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <View style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 8,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        backgroundColor: '#7C3AED',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                          #{item.orderNumber}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: item.paymentMethod === 'cash' ? '#DCFCE7' : '#DBEAFE',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}>
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: item.paymentMethod === 'cash' ? '#166534' : '#1D4ED8',
                        }}>
                          {item.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#7C3AED' }}>
                      {item.totalAmount.toFixed(2)} MAD
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Clock size={12} color="#9CA3AF" />
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>
                      {item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>•</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>
                      {item.items.reduce((sum, i) => sum + i.quantity, 0)} articles
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#9CA3AF' }}>Aucune commande aujourd&apos;hui</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
