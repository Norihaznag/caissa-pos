import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, Alert, TextInput, ActivityIndicator, useWindowDimensions, Modal, Platform, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Image } from 'react-native';
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
  Search,
  Receipt,
  Printer,
  Pause,
  Play,
  Users,
  BarChart3,
  Settings,
  Coffee,
  Bell,
  Package,
  Wallet,
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Crypto from 'expo-crypto';
import { useAppStore } from '../lib/store';
import { colors, spacing, borderRadius, fontSize, shadows } from '../lib/theme';
import { 
  initOfflineDatabase, 
  offlineCategoryService, 
  offlineProductService, 
  offlineOrderService,
  offlineExpenseService,
  Expense,
  EXPENSE_CATEGORIES,
  OfflineOrder,
  OfflineOrderItem,
  clearInvalidSyncQueueItems,
} from '../lib/offline-db';
import { loadPrinterConfig, printReceipt, ReceiptData } from '../lib/printing';
import AdminPanel from '../components/AdminPanel';

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
  imageUrl?: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  stockQuantity: number;
  lowStockThreshold: number;
  categoryName?: string;
}

interface StockProduct {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName?: string;
  isActive: boolean;
  imageUrl?: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

// Quick Tables (reduced for simplicity)
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CashierSimpleScreen() {
  const router = useRouter();
  const logout = useAppStore((state) => state.logout);
  const user = useAppStore((state) => state.user);
  
  // Responsive dimensions
  const { width, height } = useWindowDimensions();
  const isPhone = width < 768;
  const numColumns = isPhone ? 2 : 4;
  const [showCartModal, setShowCartModal] = useState(false);
  
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [todayOrders, setTodayOrders] = useState<OfflineOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Table & Order Management
  const [selectedTable, setSelectedTable] = useState<number>(0);
  const [showTableModal, setShowTableModal] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<OfflineOrder[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  
  // Daily Report
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Printing
  const [printing, setPrinting] = useState(false);
  
  // Admin Panel
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  // Stock & Expenses
  const [showStockModal, setShowStockModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [allStockProducts, setAllStockProducts] = useState<StockProduct[]>([]);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockViewMode, setStockViewMode] = useState<'all' | 'low'>('all');
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState('');
  const [todayExpenses, setTodayExpenses] = useState<Expense[]>([]);
  const [todayExpenseTotal, setTodayExpenseTotal] = useState(0);
  
  // Notifications
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; type: 'low_stock' | 'expense'; title: string; message: string; data?: any }[]>([]);
  
  // Expense form
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<typeof EXPENSE_CATEGORIES[number]>(EXPENSE_CATEGORIES[0]);
  const [expenseDescription, setExpenseDescription] = useState('');
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  
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

  // Initialize database and load data - FULLY OFFLINE
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Initialize SQLite database
        await initOfflineDatabase();
        
        // Clear any old sync queue items with invalid UUID format
        await clearInvalidSyncQueueItems();
        
        // Load data from local database only - no network needed
        await loadLocalData();
        await loadTodayOrders();
        await loadPendingOrders();
        await loadLowStockProducts();
        await loadAllStockProducts();
        await loadTodayExpenses();
        
      } catch (error) {
        console.error('Init error:', error);
        Alert.alert('Erreur', 'Impossible d\'initialiser la base de données');
      } finally {
        setLoading(false);
      }
    };
    
    init();
    
    // Refresh pending orders periodically (no network check)
    const interval = setInterval(async () => {
      await loadPendingOrders();
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

  const loadPendingOrders = async () => {
    const orders = await offlineOrderService.getPendingOrders();
    setPendingOrders(orders);
  };

  const loadLowStockProducts = async () => {
    const lowStock = await offlineProductService.getLowStockProducts();
    setLowStockProducts(lowStock);
    
    // Update notifications
    if (lowStock.length > 0) {
      const stockNotifications = lowStock.map(p => ({
        id: `stock-${p.id}`,
        type: 'low_stock' as const,
        title: 'Stock bas',
        message: `${p.name}: ${p.stockQuantity} restant(s)`,
        data: p,
      }));
      setNotifications(prev => {
        const otherNotifs = prev.filter(n => n.type !== 'low_stock');
        return [...stockNotifications, ...otherNotifs];
      });
    }
  };

  const loadAllStockProducts = async () => {
    const products = await offlineProductService.getAllWithStock();
    setAllStockProducts(products);
  };

  const adjustProductStock = async (productId: string, delta: number) => {
    try {
      await offlineProductService.adjustStock(productId, delta);
      await loadAllStockProducts();
      await loadLowStockProducts();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le stock');
    }
  };

  const setProductStock = async (productId: string, value: number) => {
    try {
      await offlineProductService.updateStock(productId, value);
      await loadAllStockProducts();
      await loadLowStockProducts();
      setEditingStockId(null);
      setEditingStockValue('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le stock');
    }
  };

  const setProductThreshold = async (productId: string, threshold: number) => {
    try {
      await offlineProductService.setLowStockThreshold(productId, threshold);
      await loadAllStockProducts();
      await loadLowStockProducts();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le seuil');
    }
  };

  const loadTodayExpenses = async () => {
    const expenses = await offlineExpenseService.getTodayExpenses();
    const total = await offlineExpenseService.getTodayTotal();
    setTodayExpenses(expenses);
    setTodayExpenseTotal(total);
  };

  const addExpense = async () => {
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    
    try {
      await offlineExpenseService.create({
        amount,
        category: expenseCategory,
        description: expenseDescription.trim() || undefined,
        createdBy: user?.name,
      });
      
      await loadTodayExpenses();
      setExpenseAmount('');
      setExpenseDescription('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la dépense');
    }
  };

  const deleteExpense = async (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette dépense?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await offlineExpenseService.delete(id);
          await loadTodayExpenses();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  // Cart operations - simplified
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
    setSelectedTable(0);
    setCurrentOrderId(null);
  };

  // Hold current order (save without paying)
  const holdOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de mettre en attente');
      return;
    }
    
    try {
      const orderId = currentOrderId || Crypto.randomUUID();
      const now = new Date();
      const items: OfflineOrderItem[] = cart.map((item) => ({
        id: Crypto.randomUUID(),
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
      }));
      
      await offlineOrderService.create({
        id: orderId,
        tableNumber: selectedTable,
        status: 'PENDING',
        totalAmount: total,
        discount: 0,
        discountType: 'amount',
        createdAt: now,
        items,
      });
      
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      
      clearCart();
      await loadPendingOrders();
      await loadTodayOrders();
      
      Alert.alert('✅ En attente', `Table ${selectedTable === 0 ? 'Comptoir' : selectedTable} - ${total.toFixed(0)} DH`);
      
    } catch (error) {
      console.error('Hold order error:', error);
      Alert.alert('Erreur', 'Erreur lors de la mise en attente');
    }
  };

  // Recall a pending order
  const recallOrder = (order: OfflineOrder) => {
    setCart(order.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      quantity: item.quantity,
    })));
    setSelectedTable(order.tableNumber || 0);
    setCurrentOrderId(order.id);
    setShowPendingModal(false);
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  };

  // Cancel a pending order
  const cancelOrder = async (orderId: string) => {
    Alert.alert(
      'Annuler la commande',
      'Êtes-vous sûr de vouloir annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            await offlineOrderService.deleteOrder(orderId);
            await loadPendingOrders();
            await loadTodayOrders();
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {}
          },
        },
      ]
    );
  };

  // Print receipt
  const handlePrintReceipt = async (order: OfflineOrder) => {
    setPrinting(true);
    try {
      const config = await loadPrinterConfig();
      if (!config.enabled || config.type === 'none') {
        Alert.alert('Imprimante non configurée', 'Allez dans Paramètres > Imprimante pour configurer');
        return;
      }
      
      const receiptData: ReceiptData = {
        restaurantName: 'CaissaPro',
        address: '',
        city: 'Maroc',
        phone: '',
        taxId: '',
        orderId: order.id,
        tableNumber: order.tableNumber || 0,
        waiterName: user?.name || 'Caissier',
        date: order.createdAt.toLocaleString('fr-FR'),
        items: order.items.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        })),
        subtotal: order.totalAmount + order.discount,
        discount: order.discount,
        tax: 0,
        total: order.totalAmount,
        paymentMethod: order.paymentMethod === 'cash' ? 'Espèces' : (order.paymentMethod === 'card' ? 'Carte' : ''),
        amountReceived: order.amountReceived || 0,
        change: order.changeAmount || 0,
      };
      
      await printReceipt(config, receiptData);
      await offlineOrderService.markPrinted(order.id);
      
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Erreur d\'impression', 'Vérifiez la connexion de l\'imprimante');
    } finally {
      setPrinting(false);
    }
  };

  // Calculate totals - simplified for speed
  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
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
      Alert.alert('Montant insuffisant', `Reçu: ${received.toFixed(0)} DH < Total: ${total.toFixed(0)} DH`);
      return;
    }
    
    try {
      // If recalling a pending order, delete it first
      if (currentOrderId) {
        await offlineOrderService.deleteOrder(currentOrderId);
      }
      
      const orderId = Crypto.randomUUID();
      const now = new Date();
      const items: OfflineOrderItem[] = cart.map((item) => ({
        id: Crypto.randomUUID(),
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
      }));
      
      await offlineOrderService.create({
        id: orderId,
        tableNumber: selectedTable,
        status: 'PAID',
        totalAmount: total,
        paymentMethod,
        discount: 0,
        discountType: 'amount',
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
      setSelectedTable(0);
      setCurrentOrderId(null);
      setShowPaymentModal(false);
      
      // Reload stats
      await loadTodayOrders();
      await loadPendingOrders();
      
      // Simple success message
      Alert.alert('✅ Payé!', `${total.toFixed(0)} DH - ${paymentMethod === 'cash' ? 'Espèces' : 'Carte'}`);
      
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

  // Filter products - memoized for performance
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Smart quick amounts based on total (rounded up to common bills)
  const getSmartQuickAmounts = () => {
    const amounts: number[] = [];
    const roundedTotal = Math.ceil(total);
    
    // Always include exact amount
    if (roundedTotal > 0 && roundedTotal <= 1000) {
      amounts.push(roundedTotal);
    }
    
    // Add common bill amounts above total
    [20, 50, 100, 200, 500].forEach(amt => {
      if (amt >= roundedTotal && amounts.length < 4 && !amounts.includes(amt)) {
        amounts.push(amt);
      }
    });
    
    // Fill remaining slots with standard amounts
    [50, 100, 200, 500].forEach(amt => {
      if (amounts.length < 4 && !amounts.includes(amt)) {
        amounts.push(amt);
      }
    });
    
    return amounts.slice(0, 4).sort((a, b) => a - b);
  };

  // Quick amount buttons
  const quickAmounts = getSmartQuickAmounts();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Coffee size={32} color={colors.white} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, fontSize: fontSize.md }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header - Facebook Lite Style */}
      <View style={{ 
        backgroundColor: colors.primary,
        paddingBottom: spacing.sm,
      }}>
        {/* Top Row - Logo, Search-like area, and Actions */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
        }}>
          {/* Left - Logo & Brand */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.md,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Coffee size={20} color={colors.white} />
            </View>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>
              CaissaPro
            </Text>
          </View>
          
          {/* Right - Action Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {/* Stock */}
            <TouchableOpacity
              onPress={() => setShowStockModal(true)}
              style={{ 
                width: 38, 
                height: 38, 
                borderRadius: 19, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: 'rgba(255,255,255,0.15)',
                position: 'relative',
              }}
            >
              <Package size={20} color={colors.white} />
              {lowStockProducts.length > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10, color: colors.white, fontWeight: '700' }}>
                    {lowStockProducts.length > 9 ? '9+' : lowStockProducts.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Expenses */}
            <TouchableOpacity
              onPress={() => setShowExpensesModal(true)}
              style={{ 
                width: 38, 
                height: 38, 
                borderRadius: 19, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Wallet size={20} color={colors.white} />
            </TouchableOpacity>
            
            {/* Notifications */}
            <TouchableOpacity
              onPress={() => setShowNotificationPanel(true)}
              style={{ 
                width: 38, 
                height: 38, 
                borderRadius: 19, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: 'rgba(255,255,255,0.15)',
                position: 'relative',
              }}
            >
              <Bell size={20} color={colors.white} />
              {notifications.length > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10, color: colors.white, fontWeight: '700' }}>
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Report */}
            <TouchableOpacity
              onPress={() => setShowReportModal(true)}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <BarChart3 size={20} color={colors.white} />
            </TouchableOpacity>
            
            {/* Settings */}
            <TouchableOpacity
              onPress={() => setShowAdminPanel(true)}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <Settings size={20} color={colors.white} />
            </TouchableOpacity>
            
            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <LogOut size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Stats Bar - Revenue & Quick Actions */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
        }}>
          {/* Daily Stats */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <View>
              <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.white }}>
                {Math.round(dailyStats.totalRevenue)} DH
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' }}>
                {dailyStats.paidOrders} commandes • {todayExpenseTotal > 0 ? `-${todayExpenseTotal} DH dépenses` : 'Aucune dépense'}
              </Text>
            </View>
          </View>
          
          {/* Quick Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {/* Pending Orders */}
            {pendingOrders.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowPendingModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.warning,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.full,
                  gap: spacing.xs,
                }}
              >
                <Pause size={14} color={colors.white} />
                <Text style={{ fontSize: fontSize.sm, color: colors.white, fontWeight: '700' }}>{pendingOrders.length}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Table Selector Bar */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: colors.white,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      }}>
        <TouchableOpacity
          onPress={() => setShowTableModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: selectedTable > 0 ? colors.primary : colors.background,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.full,
            gap: spacing.sm,
          }}
        >
          <Users size={18} color={selectedTable > 0 ? colors.white : colors.textSecondary} />
          <Text style={{ 
            fontSize: fontSize.md, 
            fontWeight: '600', 
            color: selectedTable > 0 ? colors.white : colors.textPrimary 
          }}>
            {selectedTable === 0 ? 'Comptoir' : `Table ${selectedTable}`}
          </Text>
        </TouchableOpacity>
        
        {/* Quick totals */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.success, fontWeight: '600' }}>Esp: {Math.round(dailyStats.cashRevenue)}</Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' }}>CB: {Math.round(dailyStats.cardRevenue)}</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: isPhone ? 'column' : 'row' }}>
        {/* Products Section */}
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          {/* Search */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.white,
            borderRadius: borderRadius.full,
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.md,
          }}>
            <Search size={20} color={colors.textMuted} />
            <TextInput
              style={{ 
                flex: 1, 
                paddingVertical: spacing.md, 
                paddingHorizontal: spacing.md, 
                fontSize: fontSize.md, 
                color: colors.textPrimary 
              }}
              placeholder="Rechercher..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textMuted}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: spacing.sm }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Categories - Simple Pills */}
          <View style={{ height: 44, marginBottom: spacing.md }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            >
              <TouchableOpacity
                onPress={() => setSelectedCategory('all')}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.full,
                  backgroundColor: selectedCategory === 'all' ? colors.primary : colors.white,
                  ...shadows.sm,
                }}
              >
                <Text style={{
                  fontSize: fontSize.sm,
                  fontWeight: '600',
                  color: selectedCategory === 'all' ? colors.white : colors.textPrimary,
                }}>
                  Tous
                </Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderRadius: borderRadius.full,
                    backgroundColor: selectedCategory === cat.id ? colors.primary : colors.white,
                    ...shadows.sm,
                  }}
                >
                  <Text style={{
                    fontSize: fontSize.sm,
                    fontWeight: '600',
                    color: selectedCategory === cat.id ? colors.white : colors.textPrimary,
                  }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Products Grid - Simple & Fast */}
          <FlatList
            data={filteredProducts}
            key={numColumns}
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: isPhone ? 120 : spacing.xl }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => addToCart(item)}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  margin: spacing.xs,
                  backgroundColor: colors.white,
                  borderRadius: borderRadius.lg,
                  overflow: 'hidden',
                  maxWidth: isPhone ? '48%' : '24%',
                }}
              >
                {/* Product Image */}
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{
                      width: '100%',
                      height: 100,
                      backgroundColor: colors.background,
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ 
                    width: '100%', 
                    height: 100, 
                    backgroundColor: colors.primaryLight, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Coffee size={32} color={colors.primary} />
                  </View>
                )}
                
                {/* Product Info */}
                <View style={{ padding: spacing.md }}>
                  <Text 
                    style={{ 
                      fontSize: fontSize.sm, 
                      fontWeight: '600', 
                      color: colors.textPrimary,
                      marginBottom: spacing.xs,
                    }}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.primary }}>
                    {item.price.toFixed(0)} <Text style={{ fontSize: fontSize.xs, fontWeight: '500' }}>DH</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                <Search size={48} color={colors.textMuted} />
                <Text style={{ fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.md }}>Aucun produit trouvé</Text>
              </View>
            )}
          />
        </View>

        {/* Cart Section - Side panel on tablet */}
        {!isPhone && (
          <View style={{ 
            width: 340, 
            backgroundColor: colors.white,
            borderLeftWidth: 1,
            borderLeftColor: colors.borderLight,
            ...shadows.sm,
          }}>
            {/* Cart Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              backgroundColor: colors.primary,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ShoppingCart size={22} color={colors.white} />
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>
                  Panier
                </Text>
                <View style={{ 
                  backgroundColor: 'rgba(255,255,255,0.25)', 
                  paddingHorizontal: spacing.md, 
                  paddingVertical: spacing.xs, 
                  borderRadius: borderRadius.full 
                }}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.white }}>
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </Text>
                </View>
              </View>
              {cart.length > 0 && (
                <TouchableOpacity onPress={clearCart} style={{ padding: spacing.xs }}>
                  <Trash2 size={20} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Cart Items */}
            <ScrollView style={{ flex: 1 }}>
              {cart.length === 0 ? (
                <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                  <ShoppingCart size={48} color={colors.borderLight} />
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.md }}>Panier vide</Text>
                </View>
              ) : (
                cart.map((item) => (
                  <View
                    key={item.productId}
                    style={{
                      padding: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <Text style={{ fontSize: fontSize.sm, color: colors.primary }}>
                          {item.price.toFixed(0)} × {item.quantity} = {(item.price * item.quantity).toFixed(0)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, -1)}
                          style={{
                            width: 36,
                            height: 36,
                            backgroundColor: colors.background,
                            borderRadius: borderRadius.sm,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Minus size={18} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: fontSize.lg, fontWeight: '700', minWidth: 30, textAlign: 'center' }}>
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, 1)}
                          style={{
                            width: 36,
                            height: 36,
                            backgroundColor: colors.primary,
                            borderRadius: borderRadius.sm,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Plus size={18} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Cart Footer - Simple */}
            <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Total</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primary }}>
                  {total.toFixed(0)} DH
                </Text>
              </View>

              {/* Payment Buttons - Large & Simple */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
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
                    gap: spacing.sm,
                    backgroundColor: cart.length === 0 ? colors.border : colors.success,
                    paddingVertical: spacing.xl,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  <Banknote size={24} color={colors.white} />
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>Cash</Text>
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
                    gap: spacing.sm,
                    backgroundColor: cart.length === 0 ? colors.border : colors.primary,
                    paddingVertical: spacing.xl,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  <CreditCard size={24} color={colors.white} />
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>Carte</Text>
                </TouchableOpacity>
              </View>

              {/* Hold Button */}
              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={holdOrder}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    backgroundColor: colors.warningLight,
                    paddingVertical: spacing.lg,
                    borderRadius: borderRadius.lg,
                    marginTop: spacing.md,
                  }}
                >
                  <Pause size={20} color="#D97706" />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: '#D97706' }}>En attente</Text>
                </TouchableOpacity>
              )}
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
            bottom: spacing.xl,
            left: spacing.xl,
            right: spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: cart.length > 0 ? colors.primary : colors.textMuted,
            paddingVertical: spacing.lg,
            borderRadius: borderRadius.lg,
            gap: spacing.md,
            ...shadows.lg,
          }}
        >
          <ShoppingCart size={22} color={colors.white} />
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>
            {cart.reduce((sum, i) => sum + i.quantity, 0)} article{cart.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? 's' : ''}
          </Text>
          {total > 0 && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md }}>
              <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.white }}>
                {total.toFixed(0)} DH
              </Text>
            </View>
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
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: colors.white,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            maxHeight: height * 0.85,
          }}>
            {/* Cart Modal Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              backgroundColor: colors.primary,
              borderTopLeftRadius: borderRadius.xl,
              borderTopRightRadius: borderRadius.xl,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ShoppingCart size={24} color={colors.white} />
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.white }}>
                  Panier
                </Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.lg }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.white }}>
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {cart.length > 0 && (
                  <TouchableOpacity onPress={clearCart} style={{ padding: spacing.xs }}>
                    <Trash2 size={22} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowCartModal(false)} style={{ padding: spacing.xs }}>
                  <X size={26} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Cart Items */}
            <ScrollView style={{ maxHeight: height * 0.4 }}>
              {cart.length === 0 ? (
                <View style={{ padding: spacing.xxxl, alignItems: 'center' }}>
                  <ShoppingCart size={48} color={colors.borderLight} />
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.md }}>Panier vide</Text>
                </View>
              ) : (
                cart.map((item) => (
                  <View
                    key={item.productId}
                    style={{
                      padding: spacing.lg,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <Text style={{ fontSize: fontSize.sm, color: colors.primary, marginTop: 2 }}>
                          {item.price.toFixed(0)} × {item.quantity} = {(item.price * item.quantity).toFixed(0)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, -1)}
                          style={{
                            width: 44,
                            height: 44,
                            backgroundColor: colors.background,
                            borderRadius: borderRadius.md,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Minus size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: fontSize.lg, fontWeight: '700', minWidth: 36, textAlign: 'center' }}>
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, 1)}
                          style={{
                            width: 44,
                            height: 44,
                            backgroundColor: colors.primary,
                            borderRadius: borderRadius.md,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Plus size={20} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Cart Footer - Simple */}
            <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Total</Text>
                <Text style={{ fontSize: 32, fontWeight: '700', color: colors.primary }}>{total.toFixed(0)} DH</Text>
              </View>
              {/* Payment Buttons */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
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
                    gap: spacing.sm,
                    backgroundColor: cart.length === 0 ? colors.border : colors.success,
                    paddingVertical: spacing.xl,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  <Banknote size={24} color={colors.white} />
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>Cash</Text>
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
                    gap: spacing.sm,
                    backgroundColor: cart.length === 0 ? colors.border : colors.primary,
                    paddingVertical: spacing.xl,
                    borderRadius: borderRadius.lg,
                  }}
                >
                  <CreditCard size={24} color={colors.white} />
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>Carte</Text>
                </TouchableOpacity>
              </View>

              {/* Hold Button */}
              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setShowCartModal(false);
                    holdOrder();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    backgroundColor: colors.warningLight,
                    paddingVertical: spacing.lg,
                    borderRadius: borderRadius.lg,
                    marginTop: spacing.md,
                  }}
                >
                  <Pause size={20} color="#D97706" />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: '#D97706' }}>Mettre en attente</Text>
                </TouchableOpacity>
              )}
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
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%', maxWidth: 400 }}
            >
              <View style={{
                backgroundColor: colors.white,
                borderRadius: borderRadius.xl,
                width: '100%',
                overflow: 'hidden',
              }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing.lg,
              backgroundColor: paymentMethod === 'cash' ? colors.success : colors.primary,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {paymentMethod === 'cash' ? (
                  <Banknote size={24} color={colors.white} />
                ) : (
                  <CreditCard size={24} color={colors.white} />
                )}
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>
                  {paymentMethod === 'cash' ? 'Paiement Espèces' : 'Paiement Carte'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 24 }}>
              {/* Total */}
              <View style={{
                backgroundColor: '#F8F9FA',
                borderRadius: 16,
                padding: 24,
                alignItems: 'center',
                marginBottom: 24,
              }}>
                <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>💰 À payer</Text>
                <Text style={{ fontSize: 40, fontWeight: '700', color: '#111827' }}>
                  {Math.round(total)} MAD
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
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    {quickAmounts.map(amt => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setAmountReceived(amt.toString())}
                        style={{
                          flex: 1,
                          backgroundColor: '#F8F9FA',
                          paddingVertical: 14,
                          borderRadius: 12,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
                          {amt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setAmountReceived(Math.ceil(total).toString())}
                      style={{
                        flex: 1,
                        backgroundColor: '#10B981',
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>
                        ✓ Exact
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
                  backgroundColor: paymentMethod === 'cash' && received < total ? '#D1D5DB' : '#4F46E5',
                  paddingVertical: 18,
                  borderRadius: 14,
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
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
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
              padding: 20,
              backgroundColor: '#4F46E5',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Receipt size={26} color="#FFFFFF" />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
                  Commandes payées ({todayOrders.filter(o => o.status === 'PAID').length})
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowOrdersModal(false)}
                style={{ padding: 4 }}
              >
                <X size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={todayOrders.filter(o => o.status === 'PAID')}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={{
                  backgroundColor: '#F8F9FA',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        backgroundColor: '#4F46E5',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                          #{item.orderNumber}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: item.paymentMethod === 'cash' ? '#DCFCE7' : '#DBEAFE',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}>
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: item.paymentMethod === 'cash' ? '#166534' : '#1D4ED8',
                        }}>
                          {item.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#4F46E5' }}>
                      {Math.round(item.totalAmount)} MAD
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>
                        {item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#9CA3AF' }}>•</Text>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>
                        {item.tableNumber === 0 ? 'Comptoir' : `Table ${item.tableNumber}`}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#9CA3AF' }}>•</Text>
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>
                        {item.items.reduce((sum, i) => sum + i.quantity, 0)} articles
                      </Text>
                    </View>
                    {/* Print Button */}
                    <TouchableOpacity
                      onPress={() => handlePrintReceipt(item)}
                      disabled={printing}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: item.printed ? '#E5E7EB' : '#4F46E5',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                    >
                      <Printer size={16} color={item.printed ? '#6B7280' : '#FFFFFF'} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: item.printed ? '#6B7280' : '#FFFFFF' }}>
                        {item.printed ? 'Réimprimer' : 'Imprimer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
                  <Text style={{ fontSize: 16, color: '#9CA3AF' }}>Aucune commande aujourd&apos;hui</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Table Selection Modal - Facebook Lite Style */}
      <Modal
        visible={showTableModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTableModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: spacing.lg, 
            backgroundColor: colors.white, 
            borderBottomWidth: 1, 
            borderBottomColor: colors.borderLight,
            ...shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Users size={24} color={colors.primary} />
              <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Choisir Table</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTableModal(false)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {/* Counter option */}
            <TouchableOpacity
              onPress={() => {
                setSelectedTable(0);
                setShowTableModal(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.lg,
                marginBottom: spacing.lg,
                backgroundColor: selectedTable === 0 ? colors.primary : colors.white,
                borderRadius: borderRadius.xl,
                ...shadows.sm,
              }}
            >
              <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: borderRadius.lg, 
                backgroundColor: selectedTable === 0 ? 'rgba(255,255,255,0.2)' : colors.primaryLight, 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: spacing.md,
              }}>
                <Coffee size={24} color={selectedTable === 0 ? colors.white : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: fontSize.lg, 
                  fontWeight: '600', 
                  color: selectedTable === 0 ? colors.white : colors.textPrimary 
                }}>
                  Comptoir
                </Text>
                <Text style={{ 
                  fontSize: fontSize.sm, 
                  color: selectedTable === 0 ? 'rgba(255,255,255,0.7)' : colors.textSecondary 
                }}>
                  Vente à emporter
                </Text>
              </View>
              {selectedTable === 0 && (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={16} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
            
            {/* Table section title */}
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tables
            </Text>
            
            {/* Table grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {TABLES.map(table => (
                <TouchableOpacity
                  key={table}
                  onPress={() => {
                    setSelectedTable(table);
                    setShowTableModal(false);
                  }}
                  style={{
                    width: '22%',
                    aspectRatio: 1,
                    backgroundColor: selectedTable === table ? colors.primary : colors.white,
                    borderRadius: borderRadius.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: fontSize.lg, 
                    fontWeight: '700', 
                    color: selectedTable === table ? colors.white : colors.textPrimary 
                  }}>
                    {table}
                  </Text>
                  <Text style={{ 
                    fontSize: fontSize.xs, 
                    color: selectedTable === table ? 'rgba(255,255,255,0.7)' : colors.textMuted 
                  }}>
                    Table
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Pending Orders Modal */}
      <Modal
        visible={showPendingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPendingModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            width: '100%',
            maxWidth: 500,
            maxHeight: '80%',
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 20,
              backgroundColor: '#F59E0B',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pause size={26} color="#FFFFFF" />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#FFFFFF' }}>
                  ⏸️ En attente ({pendingOrders.length})
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowPendingModal(false)}
                style={{ padding: 4 }}
              >
                <X size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pendingOrders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                // Calculate time elapsed since order was created
                const createdAt = new Date(item.createdAt);
                const now = new Date();
                const minutesElapsed = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
                const timeDisplay = minutesElapsed < 60 
                  ? `${minutesElapsed}m` 
                  : `${Math.floor(minutesElapsed / 60)}h${minutesElapsed % 60}m`;
                const isUrgent = minutesElapsed > 15;
                
                return (
                <View style={{
                  backgroundColor: isUrgent ? '#FEE2E2' : '#FEF3C7',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: isUrgent ? 2 : 0,
                  borderColor: isUrgent ? '#EF4444' : 'transparent',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        backgroundColor: '#F59E0B',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                          #{item.orderNumber}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400E' }}>
                          {item.tableNumber === 0 ? 'Comptoir' : `Table ${item.tableNumber}`}
                        </Text>
                      </View>
                      {/* Time elapsed indicator */}
                      <View style={{
                        backgroundColor: isUrgent ? '#EF4444' : '#FCD34D',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isUrgent ? '#FFFFFF' : '#78350F' }}>
                          {timeDisplay}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#92400E' }}>
                      {Math.round(item.totalAmount)} MAD
                    </Text>
                  </View>
                  
                  {/* Items preview */}
                  <View style={{ marginTop: 10 }}>
                    {item.items.slice(0, 3).map((orderItem, idx) => (
                      <Text key={idx} style={{ fontSize: 13, color: '#78350F' }}>
                        • {orderItem.quantity}x {orderItem.productName}
                        {orderItem.note ? ` (${orderItem.note})` : ''}
                      </Text>
                    ))}
                    {item.items.length > 3 && (
                      <Text style={{ fontSize: 13, color: '#92400E', fontStyle: 'italic' }}>
                        +{item.items.length - 3} autres...
                      </Text>
                    )}
                  </View>
                  
                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                      onPress={() => recallOrder(item)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: '#10B981',
                        paddingVertical: 14,
                        borderRadius: 12,
                      }}
                    >
                      <Play size={18} color="#FFFFFF" />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Reprendre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => cancelOrder(item.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: '#EF4444',
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                      }}
                    >
                      <Trash2 size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );}}
              ListEmptyComponent={() => (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>⏸️</Text>
                  <Text style={{ fontSize: 16, color: '#9CA3AF' }}>
                    Aucune commande en attente
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Daily Report Modal - Facebook Lite Style */}
      <Modal
        visible={showReportModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            width: '100%',
            maxWidth: 380,
            overflow: 'hidden',
          }}>
            {/* Header - Clean Facebook Lite style */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.borderLight,
            }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary }}>
                Rapport du jour
              </Text>
              <TouchableOpacity 
                onPress={() => setShowReportModal(false)}
                style={{ 
                  padding: spacing.sm,
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.full,
                }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <View style={{ padding: spacing.lg }}>
              {/* Date badge */}
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: colors.textSecondary, 
                textAlign: 'center',
                marginBottom: spacing.lg,
              }}>
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
              
              {/* Main Total - Hero number */}
              <View style={{ 
                backgroundColor: colors.successLight,
                borderRadius: borderRadius.lg,
                padding: spacing.xl,
                alignItems: 'center',
                marginBottom: spacing.lg,
              }}>
                <Text style={{ fontSize: fontSize.sm, color: colors.success, marginBottom: spacing.xs }}>
                  Total des ventes
                </Text>
                <Text style={{ fontSize: 36, fontWeight: '700', color: colors.success }}>
                  {Math.round(dailyStats.totalRevenue)}
                </Text>
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.success }}>
                  MAD
                </Text>
              </View>
              
              {/* Payment breakdown - Simple row */}
              <View style={{ 
                flexDirection: 'row', 
                gap: spacing.md,
                marginBottom: spacing.lg,
              }}>
                <View style={{ 
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Espèces</Text>
                  <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>
                    {Math.round(dailyStats.cashRevenue)}
                  </Text>
                </View>
                
                <View style={{ 
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Carte</Text>
                  <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>
                    {Math.round(dailyStats.cardRevenue)}
                  </Text>
                </View>
              </View>
              
              {/* Stats row - Orders count */}
              <View style={{ 
                flexDirection: 'row', 
                gap: spacing.md,
                marginBottom: spacing.lg,
              }}>
                <View style={{ 
                  flex: 1,
                  backgroundColor: colors.primaryLight,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: fontSize.xs, color: colors.primary }}>Commandes</Text>
                  <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.primary }}>
                    {dailyStats.paidOrders}
                  </Text>
                </View>
                
                <View style={{ 
                  flex: 1,
                  backgroundColor: colors.warningLight,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: fontSize.xs, color: '#92400E' }}>En attente</Text>
                  <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.warning }}>
                    {pendingOrders.length}
                  </Text>
                </View>
                
                <View style={{ 
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Moy.</Text>
                  <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary }}>
                    {dailyStats.paidOrders > 0 
                      ? Math.round(dailyStats.totalRevenue / dailyStats.paidOrders) 
                      : 0}
                  </Text>
                </View>
              </View>
              
              {/* Close button */}
              <TouchableOpacity
                onPress={() => setShowReportModal(false)}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: spacing.md,
                  borderRadius: borderRadius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.white }}>
                  Fermer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin Panel */}
      <AdminPanel
        visible={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        onDataChanged={loadLocalData}
      />

      {/* Stock Management Modal */}
      <Modal visible={showStockModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStockModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: spacing.lg, 
              backgroundColor: colors.white, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.borderLight,
              ...shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Package size={24} color={colors.primary} />
                <View>
                  <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Gestion du Stock</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                    {allStockProducts.filter(p => p.stockQuantity >= 0).length} produits suivis
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowStockModal(false)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Search and Filter */}
            <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: colors.white, 
                borderRadius: borderRadius.lg, 
                paddingHorizontal: spacing.md,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <Search size={18} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, padding: spacing.md, fontSize: fontSize.md, color: colors.textPrimary }}
                  value={stockSearchQuery}
                  onChangeText={setStockSearchQuery}
                  placeholder="Rechercher un produit..."
                  placeholderTextColor={colors.textMuted}
                />
                {stockSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setStockSearchQuery('')}>
                    <X size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* View Mode Toggle */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <TouchableOpacity
                  onPress={() => setStockViewMode('all')}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: borderRadius.md,
                    backgroundColor: stockViewMode === 'all' ? colors.primary : colors.white,
                    alignItems: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: fontSize.sm, 
                    fontWeight: '600', 
                    color: stockViewMode === 'all' ? colors.white : colors.textPrimary 
                  }}>
                    Tous ({allStockProducts.filter(p => p.stockQuantity >= 0).length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStockViewMode('low')}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: borderRadius.md,
                    backgroundColor: stockViewMode === 'low' ? colors.warning : colors.white,
                    alignItems: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: fontSize.sm, 
                    fontWeight: '600', 
                    color: stockViewMode === 'low' ? colors.white : colors.textPrimary 
                  }}>
                    Stock Bas ({lowStockProducts.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Low Stock Alert Banner */}
            {lowStockProducts.length > 0 && stockViewMode === 'all' && (
              <TouchableOpacity 
                onPress={() => setStockViewMode('low')}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: colors.warningLight, 
                  padding: spacing.md, 
                  marginHorizontal: spacing.lg,
                  borderRadius: borderRadius.lg,
                  gap: spacing.sm,
                }}
              >
                <AlertTriangle size={18} color={colors.warning} />
                <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.warning, fontWeight: '500' }}>
                  {lowStockProducts.length} produit(s) en stock bas - Appuyez pour voir
                </Text>
                <ChevronRight size={18} color={colors.warning} />
              </TouchableOpacity>
            )}
            
            <FlatList
              data={
                (stockViewMode === 'low' ? lowStockProducts : allStockProducts.filter(p => p.stockQuantity >= 0))
                  .filter(p => p.name.toLowerCase().includes(stockSearchQuery.toLowerCase()))
              }
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: spacing.lg }}
              renderItem={({ item }) => {
                const isLowStock = item.stockQuantity <= item.lowStockThreshold;
                const isOutOfStock = item.stockQuantity === 0;
                const isEditing = editingStockId === item.id;
                
                return (
                  <View style={{
                    backgroundColor: colors.white,
                    padding: spacing.lg,
                    borderRadius: borderRadius.lg,
                    marginBottom: spacing.md,
                    borderLeftWidth: 4,
                    borderLeftColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success,
                    ...shadows.sm,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>{item.name}</Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                          {item.categoryName} • Seuil: {item.lowStockThreshold}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: borderRadius.full,
                        backgroundColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success,
                      }}>
                        <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.white }}>
                          {isOutOfStock ? 'RUPTURE' : isLowStock ? 'BAS' : 'OK'}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Stock Controls */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: colors.background, 
                      borderRadius: borderRadius.md, 
                      padding: spacing.sm,
                    }}>
                      <TouchableOpacity
                        onPress={() => adjustProductStock(item.id, -1)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.error,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Minus size={20} color={colors.white} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        onPress={() => {
                          setEditingStockId(item.id);
                          setEditingStockValue(item.stockQuantity.toString());
                        }}
                        style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.md }}
                      >
                        {isEditing ? (
                          <TextInput
                            style={{
                              fontSize: fontSize.xxl,
                              fontWeight: '700',
                              color: colors.textPrimary,
                              textAlign: 'center',
                              minWidth: 80,
                              padding: spacing.xs,
                              backgroundColor: colors.white,
                              borderRadius: borderRadius.sm,
                            }}
                            value={editingStockValue}
                            onChangeText={setEditingStockValue}
                            keyboardType="number-pad"
                            autoFocus
                            onBlur={() => {
                              const val = parseInt(editingStockValue);
                              if (!isNaN(val) && val >= 0) {
                                setProductStock(item.id, val);
                              } else {
                                setEditingStockId(null);
                              }
                            }}
                            onSubmitEditing={() => {
                              const val = parseInt(editingStockValue);
                              if (!isNaN(val) && val >= 0) {
                                setProductStock(item.id, val);
                              } else {
                                setEditingStockId(null);
                              }
                            }}
                          />
                        ) : (
                          <>
                            <Text style={{ 
                              fontSize: fontSize.xxl, 
                              fontWeight: '700', 
                              color: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.textPrimary 
                            }}>
                              {item.stockQuantity}
                            </Text>
                            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Appuyez pour modifier</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => adjustProductStock(item.id, 1)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.success,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Plus size={20} color={colors.white} />
                      </TouchableOpacity>
                      
                      {/* Quick add buttons */}
                      <View style={{ flexDirection: 'row', marginLeft: spacing.sm, gap: spacing.xs }}>
                        {[5, 10, 20].map(n => (
                          <TouchableOpacity
                            key={n}
                            onPress={() => adjustProductStock(item.id, n)}
                            style={{
                              paddingHorizontal: spacing.sm,
                              paddingVertical: spacing.xs,
                              borderRadius: borderRadius.sm,
                              backgroundColor: colors.primaryLight,
                            }}
                          >
                            <Text style={{ fontSize: fontSize.xs, fontWeight: '600', color: colors.primary }}>+{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                  {stockViewMode === 'low' ? (
                    <>
                      <Package size={48} color={colors.success} />
                      <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.success, marginTop: spacing.lg }}>Stock OK!</Text>
                      <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}>
                        Tous les produits sont bien approvisionnés
                      </Text>
                    </>
                  ) : (
                    <>
                      <Package size={48} color={colors.textMuted} />
                      <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.lg }}>Aucun produit</Text>
                      <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}>
                        Ajoutez des produits avec suivi de stock dans l&apos;admin
                      </Text>
                    </>
                  )}
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Expenses Modal */}
      <Modal visible={showExpensesModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowExpensesModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: spacing.lg, 
              backgroundColor: colors.white, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.borderLight,
              ...shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Wallet size={24} color={colors.error} />
                <View>
                  <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Dépenses</Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Total aujourd&apos;hui: {todayExpenseTotal} DH
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowExpensesModal(false)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Add Expense Form */}
            <View style={{ backgroundColor: colors.white, padding: spacing.lg, margin: spacing.lg, borderRadius: borderRadius.xl, ...shadows.sm }}>
              <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md }}>
                Nouvelle dépense
              </Text>
              
              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.lg,
                    fontWeight: '600',
                    color: colors.textPrimary,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={{ alignSelf: 'center', fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary }}>DH</Text>
              </View>
              
              <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setExpenseCategory(cat)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: borderRadius.full,
                        backgroundColor: expenseCategory === cat ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: expenseCategory === cat ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text style={{ 
                        fontSize: fontSize.sm, 
                        fontWeight: '500', 
                        color: expenseCategory === cat ? colors.white : colors.textPrimary 
                      }}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  fontSize: fontSize.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  marginBottom: spacing.md,
                }}
                value={expenseDescription}
                onChangeText={setExpenseDescription}
                placeholder="Description (optionnel)"
                placeholderTextColor={colors.textMuted}
              />
              
              <TouchableOpacity
                onPress={addExpense}
                style={{
                  backgroundColor: colors.error,
                  paddingVertical: spacing.md,
                  borderRadius: borderRadius.md,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <TrendingDown size={18} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: '600', fontSize: fontSize.md }}>Ajouter Dépense</Text>
              </TouchableOpacity>
            </View>
            
            {/* Today's Expenses List */}
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
              Dépenses du jour
            </Text>
            <FlatList
              data={todayExpenses}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
              renderItem={({ item }) => (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.white,
                  padding: spacing.lg,
                  borderRadius: borderRadius.lg,
                  marginBottom: spacing.md,
                  ...shadows.sm,
                }}>
                  <View style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: borderRadius.md, 
                    backgroundColor: colors.errorLight, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Wallet size={20} color={colors.error} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>{item.category}</Text>
                    {item.description && (
                      <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 }}>{item.description}</Text>
                    )}
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                      {item.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.error, marginRight: spacing.md }}>
                    -{item.amount} DH
                  </Text>
                  <TouchableOpacity onPress={() => deleteExpense(item.id)} style={{ padding: spacing.sm }}>
                    <Trash2 size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Wallet size={40} color={colors.border} />
                  <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.md }}>Aucune dépense aujourd&apos;hui</Text>
                </View>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification Panel Modal */}
      <Modal visible={showNotificationPanel} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotificationPanel(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: spacing.lg, 
            backgroundColor: colors.white, 
            borderBottomWidth: 1, 
            borderBottomColor: colors.borderLight,
            ...shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Bell size={24} color={colors.primary} />
              <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Notifications</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowNotificationPanel(false)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => {
                  if (item.type === 'low_stock') {
                    setShowNotificationPanel(false);
                    setShowStockModal(true);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.white,
                  padding: spacing.lg,
                  borderRadius: borderRadius.lg,
                  marginBottom: spacing.md,
                  ...shadows.sm,
                }}
              >
                <View style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: borderRadius.md, 
                  backgroundColor: item.type === 'low_stock' ? colors.warningLight : colors.errorLight, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  {item.type === 'low_stock' ? (
                    <AlertTriangle size={20} color={colors.warning} />
                  ) : (
                    <Wallet size={20} color={colors.error} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>{item.title}</Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 }}>{item.message}</Text>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Bell size={48} color={colors.border} />
                <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.lg }}>Tout est en ordre!</Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }}>
                  Aucune notification pour le moment.{'\n'}Nous vous alerterons en cas de stock bas.
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
