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
  ClipboardList,
  Eye,
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle,
  Clock,
  List,
  ShoppingBag,
  Lock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Crypto from 'expo-crypto';
import { useAppStore } from '../lib/store';
import { colors, spacing, borderRadius, fontSize, fontSizeTablet, shadows, touchTargets } from '../lib/theme';
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
import { loadPrinterConfig, printReceipt, ReceiptData, printDailyReport, DailyReportData } from '../lib/printing';
import { hasPermission, type UserRole } from '../lib/permissions';
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
  const isLandscape = width > height;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isLargeTablet = width >= 1024;
  
  // Professional POS grid layout
  // Goal: Large, easily tappable cards with clear visual hierarchy
  const CARD_GAP = 10;
  const GRID_PADDING = 12;
  
  // Calculate optimal columns based on screen and cart visibility
  const cartPanelWidth = !isPhone ? (isLargeTablet ? 400 : 340) : 0;
  const availableWidth = width - cartPanelWidth - (GRID_PADDING * 2);
  
  // Target minimum card width for good touch targets (min 140px)
  const getNumColumns = () => {
    if (isPhone) {
      // Phone: 2 columns portrait, 3 landscape
      return isLandscape ? 3 : 2;
    }
    if (isTablet) {
      // Tablet: 3 columns portrait, 4 landscape  
      return isLandscape ? 4 : 3;
    }
    // Large tablet: 4 columns
    return 4;
  };
  const numColumns = getNumColumns();
  
  // Calculate actual card width
  const cardWidth = (availableWidth - (CARD_GAP * (numColumns - 1))) / numColumns;
  const [showCartModal, setShowCartModal] = useState(false);
  
  // Tablet-optimized sizing for touch targets and fonts
  const ui = {
    // Touch targets
    iconBtn: isPhone ? 44 : 52,
    actionBtn: isPhone ? 44 : 52,
    cartBtn: isPhone ? 40 : 48,
    // Font sizes - optimized for readability
    text: {
      xs: isPhone ? 11 : 13,
      sm: isPhone ? 13 : 15,
      md: isPhone ? 15 : 17,
      lg: isPhone ? 18 : 20,
      xl: isPhone ? 22 : 26,
    },
    // Card dimensions
    cardWidth: cardWidth,
    cardHeight: cardWidth * 1.15, // Slightly taller than wide (professional look)
    // Cart panel
    cartWidth: isLargeTablet ? 400 : 340,
    // Icon sizes
    iconSm: isPhone ? 18 : 22,
    iconMd: isPhone ? 20 : 24,
    iconLg: isPhone ? 24 : 28,
  };
  
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
  
  // Orders Tracking
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'paid' | 'pending' | 'cancelled'>('all');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OfflineOrder | null>(null);
  const [showReceiptPreviewModal, setShowReceiptPreviewModal] = useState(false);
  
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
      offlineProductService.getAllWithStock(),
    ]);
    
    setCategories(cats.map(c => ({ id: c.id, name: c.name })));
    setProducts(prods.filter(p => p.isActive));
  };

  // Reload products to sync stock after changes
  const reloadProducts = async () => {
    const prods = await offlineProductService.getAllWithStock();
    setProducts(prods.filter(p => p.isActive));
    await loadLowStockProducts();
    await loadAllStockProducts();
  };

  // Master refresh function - syncs everything
  const refreshAllData = async () => {
    try {
      await Promise.all([
        loadLocalData(),
        loadTodayOrders(),
        loadPendingOrders(),
        loadLowStockProducts(),
        loadAllStockProducts(),
        loadTodayExpenses(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    }
  };

  // Print daily report with full day data
  const handlePrintDailyReport = async () => {
    try {
      const config = await loadPrinterConfig();
      if (!config || !config.enabled || config.type === 'none') {
        Alert.alert(
          'Imprimante non configurée',
          'Veuillez configurer une imprimante dans les paramètres admin pour imprimer le rapport.'
        );
        return;
      }

      // Get all paid orders from today
      const paidOrders = todayOrders.filter(o => o.status === 'PAID');
      
      // Build detailed order list
      const ordersData = paidOrders.map(order => ({
        orderNumber: order.orderNumber || 0,
        time: new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        total: order.totalAmount,
        paymentMethod: order.paymentMethod === 'card' ? 'Carte' : 'Espèces',
        items: order.items?.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          total: item.price * item.quantity,
        })) || [],
      }));

      // Build expenses list
      const expensesData = todayExpenses.map(exp => ({
        category: EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.label || exp.category,
        amount: exp.amount,
        description: exp.description,
      }));

      // Stock data
      const outOfStock = lowStockProducts.filter(p => p.stockQuantity === 0);
      const lowStock = lowStockProducts.filter(p => p.stockQuantity > 0);

      const reportData: DailyReportData = {
        date: new Date().toLocaleDateString('fr-FR', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        }),
        restaurantName: 'CaissaPro',
        cashierName: currentUser?.name || 'Admin',
        // Sales
        totalRevenue: dailyStats.totalRevenue,
        cashRevenue: dailyStats.cashRevenue,
        cardRevenue: dailyStats.cardRevenue,
        totalOrders: todayOrders.length,
        paidOrders: dailyStats.paidOrders,
        averageOrderValue: dailyStats.paidOrders > 0 ? dailyStats.totalRevenue / dailyStats.paidOrders : 0,
        // Expenses
        totalExpenses: todayExpenseTotal,
        expenses: expensesData,
        // Net
        netProfit: dailyStats.totalRevenue - todayExpenseTotal,
        // Orders
        orders: ordersData,
        // Stock alerts
        lowStockProducts: lowStock.map(p => ({ name: p.name, quantity: p.stockQuantity })),
        outOfStockProducts: outOfStock.map(p => ({ name: p.name })),
        // Pending
        pendingOrdersCount: pendingOrders.length,
      };

      const success = await printDailyReport(config, reportData);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('✅ Rapport imprimé', 'Le rapport journalier a été envoyé à l\'imprimante.');
      }
    } catch (error) {
      console.error('Print daily report error:', error);
      Alert.alert('Erreur', 'Impossible d\'imprimer le rapport');
    }
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
    
    // Update notifications with prioritized alerts
    const stockNotifications: typeof notifications = [];
    
    // Separate out-of-stock (critical) from low stock (warning)
    const outOfStock = lowStock.filter(p => p.stockQuantity === 0);
    const lowStockItems = lowStock.filter(p => p.stockQuantity > 0);
    
    // Add critical out-of-stock notifications first
    outOfStock.forEach(p => {
      stockNotifications.push({
        id: `outofstock-${p.id}`,
        type: 'low_stock' as const,
        title: '🚨 Rupture de stock!',
        message: `${p.name} est épuisé`,
        data: { ...p, critical: true },
      });
    });
    
    // Add low stock warnings
    lowStockItems.forEach(p => {
      stockNotifications.push({
        id: `stock-${p.id}`,
        type: 'low_stock' as const,
        title: '⚠️ Stock bas',
        message: `${p.name}: ${p.stockQuantity} restant(s)`,
        data: p,
      });
    });
    
    setNotifications(prev => {
      const otherNotifs = prev.filter(n => n.type !== 'low_stock');
      return [...stockNotifications, ...otherNotifs];
    });
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
      await reloadProducts(); // Sync main product list
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
      await reloadProducts(); // Sync main product list
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
      await reloadProducts(); // Sync main product list
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le seuil');
    }
  };

  const loadTodayExpenses = async () => {
    const expenses = await offlineExpenseService.getTodayExpenses();
    const total = await offlineExpenseService.getTodayTotal();
    setTodayExpenses(expenses);
    setTodayExpenseTotal(total);
    
    // Add expense notification if expenses are high
    if (total > 0) {
      setNotifications(prev => {
        const otherNotifs = prev.filter(n => n.type !== 'expense');
        return [...otherNotifs, {
          id: 'expense-today',
          type: 'expense' as const,
          title: '💰 Dépenses du jour',
          message: `Total: ${Math.round(total)} DH (${expenses.length} dépense${expenses.length > 1 ? 's' : ''})`,
          data: { total, count: expenses.length },
        }];
      });
    }
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
      
      // Show success with updated total
      const newTotal = await offlineExpenseService.getTodayTotal();
      Alert.alert('✅ Dépense ajoutée', `${amount.toFixed(0)} DH - Total du jour: ${Math.round(newTotal)} DH`);
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

  // Cart operations - with stock validation
  const addToCart = (product: Product) => {
    // Immediate haptic feedback for responsiveness
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    
    // Check stock availability
    const hasStockTracking = product.stockQuantity !== undefined && product.stockQuantity >= 0;
    
    if (hasStockTracking) {
      // Get current quantity in cart
      const existingCartItem = cart.find(item => item.productId === product.id);
      const currentCartQty = existingCartItem?.quantity || 0;
      
      // Check if we can add more
      if (currentCartQty >= product.stockQuantity) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        Alert.alert(
          'Stock insuffisant', 
          `${product.name}\n\nStock disponible: ${product.stockQuantity}\nDans le panier: ${currentCartQty}`,
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
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
    // Check stock if increasing quantity
    if (delta > 0) {
      const product = products.find(p => p.id === productId);
      if (product && product.stockQuantity !== undefined && product.stockQuantity >= 0) {
        const existingCartItem = cart.find(item => item.productId === productId);
        const currentCartQty = existingCartItem?.quantity || 0;
        
        if (currentCartQty >= product.stockQuantity) {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch {}
          Alert.alert('Stock insuffisant', `Stock disponible: ${product.stockQuantity}`);
          return;
        }
      }
    }
    
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
      // Validate stock before payment
      for (const cartItem of cart) {
        const product = products.find(p => p.id === cartItem.productId);
        if (product && product.stockQuantity !== undefined && product.stockQuantity >= 0) {
          if (cartItem.quantity > product.stockQuantity) {
            Alert.alert(
              'Stock insuffisant',
              `${cartItem.productName}: demandé ${cartItem.quantity}, disponible ${product.stockQuantity}`,
            );
            return;
          }
        }
      }
      
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
      
      const newOrder = await offlineOrderService.create({
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
      
      // Deduct stock for all items with stock tracking
      for (const cartItem of cart) {
        const product = products.find(p => p.id === cartItem.productId);
        if (product && product.stockQuantity !== undefined && product.stockQuantity >= 0) {
          await offlineProductService.adjustStock(cartItem.productId, -cartItem.quantity);
        }
      }
      
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      
      // Auto-print receipt if printer is configured
      try {
        const printerConfig = await loadPrinterConfig();
        if (printerConfig.enabled && printerConfig.type !== 'none') {
          await handlePrintReceipt(newOrder);
        }
      } catch (printError) {
        console.log('Auto-print skipped:', printError);
      }
      
      // Reset
      setCart([]);
      setAmountReceived('');
      setSelectedTable(0);
      setCurrentOrderId(null);
      setShowPaymentModal(false);
      
      // Reload stats and products (to update stock display)
      await loadTodayOrders();
      await loadPendingOrders();
      await reloadProducts();
      
      // Quick toast-style feedback (less intrusive)
      const changeText = paymentMethod === 'cash' && parseFloat(amountReceived) > total 
        ? ` • Monnaie: ${(parseFloat(amountReceived) - total).toFixed(0)} DH` 
        : '';
      Alert.alert(
        '✅ Paiement réussi', 
        `${total.toFixed(0)} DH${changeText}`,
        [{ text: 'OK', style: 'default' }],
        { cancelable: true }
      );
      
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <Coffee size={40} color={colors.white} />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700', color: colors.white, marginBottom: 8 }}>CaissaPro</Text>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" style={{ marginTop: 16 }} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{
              width: isPhone ? 40 : 48,
              height: isPhone ? 40 : 48,
              borderRadius: borderRadius.lg,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Coffee size={ui.iconMd} color={colors.white} />
            </View>
            <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.white }}>
              CaissaPro
            </Text>
          </View>
          
          {/* Right - Action Icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {/* Stock - visible to all but manage requires permission */}
            {hasPermission(user?.role as UserRole, 'view_stock') && (
              <TouchableOpacity
                onPress={() => setShowStockModal(true)}
                style={{ 
                  width: ui.iconBtn, 
                  height: ui.iconBtn, 
                  borderRadius: ui.iconBtn / 2, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  position: 'relative',
                }}
              >
                <Package size={ui.iconMd} color={colors.white} />
                {lowStockProducts.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.error,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ fontSize: ui.text.xs, color: colors.white, fontWeight: '700' }}>
                      {lowStockProducts.length > 9 ? '9+' : lowStockProducts.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* Expenses - Admin only */}
            {hasPermission(user?.role as UserRole, 'manage_expenses') && (
              <TouchableOpacity
                onPress={() => setShowExpensesModal(true)}
                style={{ 
                  width: ui.iconBtn, 
                  height: ui.iconBtn, 
                  borderRadius: ui.iconBtn / 2, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}
              >
                <Wallet size={ui.iconMd} color={colors.white} />
              </TouchableOpacity>
            )}
            
            {/* Notifications */}
            <TouchableOpacity
              onPress={() => setShowNotificationPanel(true)}
              style={{ 
                width: ui.iconBtn, 
                height: ui.iconBtn, 
                borderRadius: ui.iconBtn / 2, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: 'rgba(255,255,255,0.15)',
                position: 'relative',
              }}
            >
              <Bell size={ui.iconMd} color={colors.white} />
              {notifications.length > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: colors.error,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ fontSize: ui.text.xs, color: colors.white, fontWeight: '700' }}>
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Orders Tracking */}
            {hasPermission(user?.role as UserRole, 'view_all_orders') && (
              <TouchableOpacity
                onPress={() => setShowOrdersModal(true)}
                style={{ 
                  width: ui.iconBtn, 
                  height: ui.iconBtn, 
                  borderRadius: ui.iconBtn / 2, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  position: 'relative',
                }}
              >
                <ClipboardList size={ui.iconMd} color={colors.white} />
                {todayOrders.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: colors.success,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ fontSize: ui.text.xs, color: colors.white, fontWeight: '700' }}>
                      {todayOrders.length > 99 ? '99+' : todayOrders.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* Report - only for users with permission */}
            {hasPermission(user?.role as UserRole, 'view_daily_report') && (
              <TouchableOpacity
                onPress={() => setShowReportModal(true)}
                style={{ width: ui.iconBtn, height: ui.iconBtn, borderRadius: ui.iconBtn / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <BarChart3 size={ui.iconMd} color={colors.white} />
              </TouchableOpacity>
            )}
            
            {/* Settings - Admin only */}
            {hasPermission(user?.role as UserRole, 'access_admin_panel') && (
              <TouchableOpacity
                onPress={() => setShowAdminPanel(true)}
                style={{ width: ui.iconBtn, height: ui.iconBtn, borderRadius: ui.iconBtn / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <Settings size={ui.iconMd} color={colors.white} />
              </TouchableOpacity>
            )}
            
            {/* Logout */}
            <TouchableOpacity
              onPress={handleLogout}
              style={{ width: ui.iconBtn, height: ui.iconBtn, borderRadius: ui.iconBtn / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <LogOut size={ui.iconMd} color={colors.white} />
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
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.white }}>
                  {Math.round(dailyStats.totalRevenue)} DH
                </Text>
                {todayExpenseTotal > 0 && (
                  <Text style={{ 
                    fontSize: fontSize.md, 
                    fontWeight: '600', 
                    color: (dailyStats.totalRevenue - todayExpenseTotal) >= 0 ? '#86EFAC' : '#FCA5A5',
                  }}>
                    (Net: {Math.round(dailyStats.totalRevenue - todayExpenseTotal)} DH)
                  </Text>
                )}
              </View>
              <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' }}>
                {dailyStats.paidOrders} commandes • {todayExpenseTotal > 0 ? `${Math.round(todayExpenseTotal)} DH dépenses` : 'Aucune dépense'}
                {lowStockProducts.length > 0 && ` • ⚠️ ${lowStockProducts.length} stock${lowStockProducts.length > 1 ? 's' : ''} bas`}
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
            minHeight: isPhone ? 48 : 56,
            marginBottom: spacing.md,
          }}>
            <Search size={ui.iconSm} color={colors.textMuted} />
            <TextInput
              style={{ 
                flex: 1, 
                paddingVertical: isPhone ? spacing.md : spacing.lg, 
                paddingHorizontal: spacing.md, 
                fontSize: ui.text.md, 
                color: colors.textPrimary 
              }}
              placeholder="Rechercher..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textMuted}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: spacing.md }}>
                <X size={ui.iconSm} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Categories - Compact Pills with count */}
          <View style={{ marginBottom: spacing.md }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            >
              <TouchableOpacity
                onPress={() => setSelectedCategory('all')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: borderRadius.full,
                  backgroundColor: selectedCategory === 'all' ? colors.primary : colors.white,
                  gap: spacing.sm,
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
                <View style={{
                  backgroundColor: selectedCategory === 'all' ? 'rgba(255,255,255,0.25)' : colors.background,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: borderRadius.full,
                }}>
                  <Text style={{ 
                    fontSize: 11, 
                    fontWeight: '700', 
                    color: selectedCategory === 'all' ? colors.white : colors.textSecondary 
                  }}>
                    {products.filter(p => p.isActive).length}
                  </Text>
                </View>
              </TouchableOpacity>
              {categories.map(cat => {
                const catProductCount = products.filter(p => p.categoryId === cat.id && p.isActive).length;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      borderRadius: borderRadius.full,
                      backgroundColor: selectedCategory === cat.id ? colors.primary : colors.white,
                      gap: spacing.sm,
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
                    <View style={{
                      backgroundColor: selectedCategory === cat.id ? 'rgba(255,255,255,0.25)' : colors.background,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: borderRadius.full,
                    }}>
                      <Text style={{ 
                        fontSize: 11, 
                        fontWeight: '700', 
                        color: selectedCategory === cat.id ? colors.white : colors.textSecondary 
                      }}>
                        {catProductCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Products Grid - Simple & Fast */}
          <FlatList
            data={filteredProducts}
            key={`${numColumns}-${width}`}
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              paddingBottom: isPhone ? 100 : spacing.xl, 
              paddingHorizontal: GRID_PADDING,
              paddingTop: spacing.sm,
            }}
            columnWrapperStyle={{ 
              gap: CARD_GAP,
              marginBottom: CARD_GAP,
            }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item }) => {
              // Stock status calculation
              const hasStockTracking = item.stockQuantity !== undefined && item.stockQuantity >= 0;
              const isOutOfStock = hasStockTracking && item.stockQuantity === 0;
              const isLowStock = hasStockTracking && item.stockQuantity > 0 && item.stockQuantity <= (item.lowStockThreshold || 10);
              const stockColor = isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success;
              
              return (
                <TouchableOpacity
                  onPress={() => addToCart(item)}
                  activeOpacity={isOutOfStock ? 1 : 0.8}
                  disabled={isOutOfStock}
                  style={{
                    width: ui.cardWidth,
                    height: ui.cardHeight,
                  }}
                >
                  <View style={{
                    flex: 1,
                    backgroundColor: colors.white,
                    borderRadius: 12,
                    overflow: 'hidden',
                    // Subtle shadow for depth
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 3,
                    // Low stock border
                    borderWidth: isLowStock ? 2 : 0,
                    borderColor: isLowStock ? colors.warning : 'transparent',
                  }}>
                    {/* Product Image Area - 65% of card */}
                    <View style={{ 
                      flex: 0.65, 
                      backgroundColor: isOutOfStock ? '#F5F5F5' : colors.primaryLight,
                      position: 'relative',
                    }}>
                      {item.imageUrl ? (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={{
                            width: '100%',
                            height: '100%',
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ 
                          flex: 1,
                          alignItems: 'center', 
                          justifyContent: 'center',
                        }}>
                          <Coffee 
                            size={isPhone ? 32 : 40} 
                            color={isOutOfStock ? colors.textMuted : colors.primary} 
                          />
                        </View>
                      )}
                      
                      {/* Stock Badge - Top Right */}
                      {hasStockTracking && (
                        <View style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: stockColor,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 3,
                        }}>
                          {isOutOfStock && <AlertTriangle size={11} color={colors.white} />}
                          {isLowStock && !isOutOfStock && <TrendingDown size={11} color={colors.white} />}
                          <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '700', 
                            color: colors.white,
                          }}>
                            {isOutOfStock ? 'Épuisé' : item.stockQuantity}
                          </Text>
                        </View>
                      )}
                      
                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <View style={{
                          ...StyleSheet.absoluteFillObject,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <View style={{
                            backgroundColor: colors.error,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                          }}>
                            <Text style={{ 
                              color: colors.white, 
                              fontWeight: '800', 
                              fontSize: 12,
                              letterSpacing: 0.5,
                            }}>
                              RUPTURE
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                    
                    {/* Product Info - 35% of card */}
                    <View style={{ 
                      flex: 0.35, 
                      padding: 10,
                      justifyContent: 'center',
                      backgroundColor: isOutOfStock ? '#FAFAFA' : colors.white,
                    }}>
                      <Text 
                        style={{ 
                          fontSize: ui.text.sm, 
                          fontWeight: '600', 
                          color: isOutOfStock ? colors.textMuted : colors.textPrimary,
                          marginBottom: 4,
                        }}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text style={{ 
                        fontSize: ui.text.lg, 
                        fontWeight: '800', 
                        color: isOutOfStock ? colors.textMuted : colors.primary,
                      }}>
                        {item.price.toFixed(0)} <Text style={{ fontSize: ui.text.sm, fontWeight: '600' }}>DH</Text>
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Search size={isPhone ? 48 : 64} color={colors.textMuted} />
                <Text style={{ fontSize: ui.text.md, color: colors.textMuted, marginTop: spacing.lg }}>Aucun produit trouvé</Text>
              </View>
            )}
          />
        </View>

        {/* Cart Section - Side panel on tablet */}
        {!isPhone && (
          <View style={{ 
            width: ui.cartWidth, 
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
              minHeight: 60,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <ShoppingCart size={ui.iconMd} color={colors.white} />
                <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: colors.white }}>
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
                  <ShoppingCart size={56} color={colors.borderLight} />
                  <Text style={{ color: colors.textMuted, fontSize: ui.text.md, marginTop: spacing.lg }}>Panier vide</Text>
                </View>
              ) : (
                cart.map((item) => {
                  // Get product stock info
                  const product = products.find(p => p.id === item.productId);
                  const hasStockTracking = product?.stockQuantity !== undefined && product.stockQuantity >= 0;
                  const stockRemaining = hasStockTracking ? product!.stockQuantity - item.quantity : -1;
                  const isStockWarning = hasStockTracking && stockRemaining <= (product?.lowStockThreshold || 10);
                  const isOverStock = hasStockTracking && item.quantity > product!.stockQuantity;
                  
                  return (
                    <View
                      key={item.productId}
                      style={{
                        padding: spacing.lg,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                        backgroundColor: isOverStock ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: ui.text.sm, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                            {item.productName}
                          </Text>
                          <Text style={{ fontSize: ui.text.sm, color: colors.primary, marginTop: 2 }}>
                            {item.price.toFixed(0)} × {item.quantity} = {(item.price * item.quantity).toFixed(0)} DH
                          </Text>
                          {/* Stock warning in cart */}
                          {hasStockTracking && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                              {isOverStock ? (
                                <>
                                  <AlertTriangle size={14} color={colors.error} />
                                  <Text style={{ fontSize: ui.text.xs, color: colors.error, fontWeight: '600' }}>
                                    Stock insuffisant! ({product!.stockQuantity} dispo)
                                  </Text>
                                </>
                              ) : isStockWarning ? (
                                <>
                                  <AlertTriangle size={14} color={colors.warning} />
                                  <Text style={{ fontSize: ui.text.xs, color: colors.warning }}>
                                    Reste: {stockRemaining}
                                  </Text>
                                </>
                              ) : (
                                <Text style={{ fontSize: ui.text.xs, color: colors.success }}>
                                  ✓ Stock: {product!.stockQuantity}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.productId, -1)}
                            style={{
                              width: ui.cartBtn,
                              height: ui.cartBtn,
                              backgroundColor: colors.background,
                              borderRadius: borderRadius.md,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Minus size={ui.iconSm} color={colors.textPrimary} />
                          </TouchableOpacity>
                          <Text style={{ fontSize: ui.text.lg, fontWeight: '700', minWidth: 36, textAlign: 'center' }}>
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.productId, 1)}
                            style={{
                              width: ui.cartBtn,
                              height: ui.cartBtn,
                              backgroundColor: colors.primary,
                              borderRadius: borderRadius.md,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Plus size={ui.iconSm} color={colors.white} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Cart Footer - Enhanced with item count */}
            <View style={{ 
              padding: spacing.lg, 
              borderTopWidth: 1, 
              borderTopColor: colors.borderLight,
              backgroundColor: colors.white,
            }}>
              {/* Subtotal row */}
              {cart.length > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    {cart.reduce((sum, i) => sum + i.quantity, 0)} article{cart.reduce((sum, i) => sum + i.quantity, 0) > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              
              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>Total</Text>
                <Text style={{ fontSize: 32, fontWeight: '800', color: colors.primary }}>
                  {total.toFixed(0)} <Text style={{ fontSize: 20, fontWeight: '600' }}>DH</Text>
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
                    paddingVertical: spacing.xxl,
                    borderRadius: borderRadius.lg,
                    minHeight: 60,
                  }}
                >
                  <Banknote size={ui.iconLg} color={colors.white} />
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: colors.white }}>Espèces</Text>
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
                    paddingVertical: spacing.xxl,
                    borderRadius: borderRadius.lg,
                    minHeight: 60,
                  }}
                >
                  <CreditCard size={ui.iconLg} color={colors.white} />
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: colors.white }}>Carte</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Pay & Hold Row */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                {/* Quick Exact Cash - One tap payment */}
                {cart.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setPaymentMethod('cash');
                      setAmountReceived(total.toString());
                      handlePayment();
                    }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.sm,
                      backgroundColor: '#E6F4EA',
                      paddingVertical: spacing.lg,
                      borderRadius: borderRadius.lg,
                      borderWidth: 1,
                      borderColor: colors.success,
                    }}
                  >
                    <Check size={18} color={colors.success} />
                    <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.success }}>Exact</Text>
                  </TouchableOpacity>
                )}
                
                {/* Hold Button */}
                {cart.length > 0 && (
                  <TouchableOpacity
                    onPress={holdOrder}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing.sm,
                      backgroundColor: colors.warningLight,
                      paddingVertical: spacing.lg,
                      borderRadius: borderRadius.lg,
                      borderWidth: 1,
                      borderColor: colors.warning,
                    }}
                  >
                    <Pause size={18} color="#D97706" />
                    <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: '#D97706' }}>Attente</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Floating Cart Button for Phone - Pro Design */}
      {isPhone && (
        <TouchableOpacity
          onPress={() => setShowCartModal(true)}
          activeOpacity={0.9}
          style={{
            position: 'absolute',
            bottom: spacing.xl,
            left: spacing.lg,
            right: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: cart.length > 0 ? colors.primary : '#65676B',
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xl,
            borderRadius: borderRadius.xl,
            // Enhanced shadow for floating effect
            shadowColor: cart.length > 0 ? colors.primary : '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              width: 36, 
              height: 36, 
              borderRadius: 18, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ShoppingCart size={20} color={colors.white} />
            </View>
            <View>
              <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.white }}>
                {cart.length === 0 ? 'Panier vide' : `${cart.reduce((sum, i) => sum + i.quantity, 0)} article${cart.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? 's' : ''}`}
              </Text>
              {cart.length > 0 && (
                <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                  Appuyez pour voir
                </Text>
              )}
            </View>
          </View>
          {total > 0 && (
            <View style={{ 
              backgroundColor: 'rgba(255,255,255,0.95)', 
              paddingHorizontal: spacing.lg, 
              paddingVertical: spacing.sm, 
              borderRadius: borderRadius.lg 
            }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '800', color: colors.primary }}>
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
                  <View style={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: 40, 
                    backgroundColor: colors.background, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginBottom: spacing.md,
                  }}>
                    <ShoppingCart size={36} color={colors.textMuted} />
                  </View>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '600' }}>Panier vide</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs, textAlign: 'center' }}>
                    Appuyez sur un produit pour l'ajouter
                  </Text>
                </View>
              ) : (
                cart.map((item) => {
                  // Get product stock info for phone modal
                  const product = products.find(p => p.id === item.productId);
                  const hasStockTracking = product?.stockQuantity !== undefined && product.stockQuantity >= 0;
                  const stockRemaining = hasStockTracking ? product!.stockQuantity - item.quantity : -1;
                  const isStockWarning = hasStockTracking && stockRemaining <= (product?.lowStockThreshold || 10);
                  const isOverStock = hasStockTracking && item.quantity > product!.stockQuantity;
                  
                  return (
                    <View
                      key={item.productId}
                      style={{
                        padding: spacing.lg,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                        backgroundColor: isOverStock ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
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
                          {/* Stock warning in phone cart */}
                          {hasStockTracking && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                              {isOverStock ? (
                                <>
                                  <AlertTriangle size={14} color={colors.error} />
                                  <Text style={{ fontSize: fontSize.xs, color: colors.error, fontWeight: '600' }}>
                                    Stock insuffisant! ({product!.stockQuantity} dispo)
                                  </Text>
                                </>
                              ) : isStockWarning ? (
                                <>
                                  <AlertTriangle size={14} color={colors.warning} />
                                  <Text style={{ fontSize: fontSize.xs, color: colors.warning }}>
                                    Reste: {stockRemaining} après vente
                                  </Text>
                                </>
                              ) : (
                                <Text style={{ fontSize: fontSize.xs, color: colors.success }}>
                                  ✓ Stock: {product!.stockQuantity}
                                </Text>
                              )}
                            </View>
                          )}
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
                  );
                })
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

      {/* Orders Tracking Modal - Professional Tablet Grid Design */}
      <Modal
        visible={showOrdersModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowOrdersModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <ClipboardList size={28} color={colors.white} />
              <View>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.white }}>
                  Commandes
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setShowOrdersModal(false)}
              style={{ 
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
          
          {/* Stats Cards Row */}
          <View style={{ 
            flexDirection: 'row', 
            paddingHorizontal: spacing.xl,
            marginBottom: spacing.lg,
            gap: spacing.md,
          }}>
            <TouchableOpacity 
              onPress={() => setOrdersFilter('paid')}
              style={{ 
                flex: 1, 
                backgroundColor: ordersFilter === 'paid' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
                borderRadius: 16,
                padding: spacing.lg,
                alignItems: 'center',
              }}
            >
              <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 24, 
                backgroundColor: ordersFilter === 'paid' ? colors.successLight : 'rgba(255,255,255,0.2)', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
                <CheckCircle size={24} color={ordersFilter === 'paid' ? colors.success : colors.white} />
              </View>
              <Text style={{ 
                fontSize: 28, 
                fontWeight: '800', 
                color: ordersFilter === 'paid' ? colors.success : colors.white 
              }}>
                {todayOrders.filter(o => o.status === 'PAID').length}
              </Text>
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: ordersFilter === 'paid' ? colors.textSecondary : 'rgba(255,255,255,0.7)',
                marginTop: 2,
              }}>
                Payées
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setOrdersFilter('pending')}
              style={{ 
                flex: 1, 
                backgroundColor: ordersFilter === 'pending' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
                borderRadius: 16,
                padding: spacing.lg,
                alignItems: 'center',
              }}
            >
              <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 24, 
                backgroundColor: ordersFilter === 'pending' ? colors.warningLight : 'rgba(255,255,255,0.2)', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
                <Clock size={24} color={ordersFilter === 'pending' ? colors.warning : colors.white} />
              </View>
              <Text style={{ 
                fontSize: 28, 
                fontWeight: '800', 
                color: ordersFilter === 'pending' ? colors.warning : colors.white 
              }}>
                {pendingOrders.length}
              </Text>
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: ordersFilter === 'pending' ? colors.textSecondary : 'rgba(255,255,255,0.7)',
                marginTop: 2,
              }}>
                En attente
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setOrdersFilter('all')}
              style={{ 
                flex: 1, 
                backgroundColor: ordersFilter === 'all' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
                borderRadius: 16,
                padding: spacing.lg,
                alignItems: 'center',
              }}
            >
              <View style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 24, 
                backgroundColor: ordersFilter === 'all' ? colors.primaryLight : 'rgba(255,255,255,0.2)', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
                <Banknote size={24} color={ordersFilter === 'all' ? colors.primary : colors.white} />
              </View>
              <Text style={{ 
                fontSize: 28, 
                fontWeight: '800', 
                color: ordersFilter === 'all' ? colors.primary : colors.white 
              }}>
                {Math.round(dailyStats.totalRevenue).toLocaleString('fr-FR')}
              </Text>
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: ordersFilter === 'all' ? colors.textSecondary : 'rgba(255,255,255,0.7)',
                marginTop: 2,
              }}>
                DH Total
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Orders Grid Content */}
          <View style={{ flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <FlatList
              data={(() => {
                let orders = ordersFilter === 'pending' 
                  ? pendingOrders 
                  : ordersFilter === 'paid' 
                    ? todayOrders.filter(o => o.status === 'PAID')
                    : [...todayOrders, ...pendingOrders.filter(p => !todayOrders.find(t => t.id === p.id))];
                return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              })()}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
              columnWrapperStyle={{ gap: spacing.md }}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              renderItem={({ item }) => (
                <View style={{
                  flex: 1,
                  backgroundColor: colors.white,
                  borderRadius: 16,
                  overflow: 'hidden',
                  ...shadows.md,
                }}>
                  {/* Order Header */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: spacing.lg,
                    backgroundColor: item.status === 'PAID' ? colors.successLight : colors.warningLight,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: colors.white,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Text style={{ 
                          fontSize: fontSize.lg, 
                          fontWeight: '800', 
                          color: item.status === 'PAID' ? colors.success : colors.warning 
                        }}>
                          {item.orderNumber || '-'}
                        </Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          {item.tableNumber === 0 ? (
                            <Coffee size={16} color={colors.textSecondary} />
                          ) : (
                            <Users size={16} color={colors.textSecondary} />
                          )}
                          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>
                            {item.tableNumber === 0 ? 'Comptoir' : `Table ${item.tableNumber}`}
                          </Text>
                        </View>
                        <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
                          {item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    {item.status === 'PAID' ? (
                      <CheckCircle size={24} color={colors.success} />
                    ) : (
                      <Clock size={24} color={colors.warning} />
                    )}
                  </View>
                  
                  {/* Order Details */}
                  <View style={{ padding: spacing.lg }}>
                    {/* Amount */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md }}>
                      <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                        {item.items.reduce((s, i) => s + i.quantity, 0)} article{item.items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}
                      </Text>
                      <Text style={{ fontSize: 28, fontWeight: '800', color: colors.textPrimary }}>
                        {Math.round(item.totalAmount)} <Text style={{ fontSize: fontSize.md, fontWeight: '600' }}>DH</Text>
                      </Text>
                    </View>
                    
                    {/* Payment Method */}
                    {item.paymentMethod && (
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: spacing.sm,
                        marginBottom: spacing.md,
                      }}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.xs,
                          backgroundColor: item.paymentMethod === 'cash' ? colors.successLight : colors.primaryLight,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.xs,
                          borderRadius: borderRadius.full,
                        }}>
                          {item.paymentMethod === 'cash' ? (
                            <Banknote size={14} color={colors.success} />
                          ) : (
                            <CreditCard size={14} color={colors.primary} />
                          )}
                          <Text style={{ 
                            fontSize: fontSize.xs, 
                            fontWeight: '600', 
                            color: item.paymentMethod === 'cash' ? colors.success : colors.primary 
                          }}>
                            {item.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
                          </Text>
                        </View>
                        {item.printed && (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.xs,
                            backgroundColor: colors.background,
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.xs,
                            borderRadius: borderRadius.full,
                          }}>
                            <Printer size={14} color={colors.textMuted} />
                            <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>Imprimé</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {/* Action Buttons - Large for easy tapping */}
                  <View style={{ 
                    flexDirection: 'row', 
                    borderTopWidth: 1, 
                    borderTopColor: colors.borderLight,
                  }}>
                    {/* View Button */}
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedOrderForReceipt(item);
                        setShowReceiptPreviewModal(true);
                      }}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.lg,
                        minHeight: 56,
                      }}
                    >
                      <Eye size={20} color={colors.primary} />
                      <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.primary }}>Détails</Text>
                    </TouchableOpacity>
                    
                    <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                    
                    {/* Print Button - Admin Only */}
                    {hasPermission(user?.role as UserRole, 'print_daily_report') ? (
                      <TouchableOpacity
                        onPress={() => handlePrintReceipt(item)}
                        disabled={printing}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spacing.sm,
                          paddingVertical: spacing.lg,
                          minHeight: 56,
                          backgroundColor: item.printed ? colors.background : colors.successLight,
                        }}
                      >
                        <Printer size={20} color={item.printed ? colors.textMuted : colors.success} />
                        <Text style={{ 
                          fontSize: fontSize.md, 
                          fontWeight: '600', 
                          color: item.printed ? colors.textMuted : colors.success 
                        }}>
                          {item.printed ? 'Réimpr.' : 'Imprimer'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      /* Cashier sees disabled print indicator */
                      <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.lg,
                        minHeight: 56,
                        backgroundColor: colors.background,
                      }}>
                        <Lock size={18} color={colors.textMuted} />
                        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}>Admin</Text>
                      </View>
                    )}
                    
                    {/* Resume Button for Pending Orders */}
                    {item.status === 'PENDING' && (
                      <>
                        <View style={{ width: 1, backgroundColor: colors.borderLight }} />
                        <TouchableOpacity
                          onPress={() => {
                            recallOrder(item);
                            setShowOrdersModal(false);
                          }}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: spacing.sm,
                            paddingVertical: spacing.lg,
                            minHeight: 56,
                            backgroundColor: colors.warningLight,
                          }}
                        >
                          <Play size={20} color={colors.warning} />
                          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: '#B45309' }}>Reprendre</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={{ 
                  flex: 1, 
                  paddingVertical: 80, 
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <View style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: colors.borderLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.lg,
                  }}>
                    <ClipboardList size={36} color={colors.textMuted} />
                  </View>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary }}>
                    Aucune commande
                  </Text>
                  <Text style={{ fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs }}>
                    Les commandes apparaîtront ici
                  </Text>
                </View>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Receipt Preview Modal - Pro Design */}
      <Modal
        visible={showReceiptPreviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReceiptPreviewModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#F0F2F5' }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingVertical: isPhone ? 14 : 18, 
            paddingHorizontal: isPhone ? 16 : 24, 
            backgroundColor: colors.white, 
            borderBottomWidth: 1, 
            borderBottomColor: '#E4E6EB',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Receipt size={ui.iconMd} color="#1877F2" />
              <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: '#1C1E21' }}>
                Reçu #{selectedOrderForReceipt?.orderNumber || '---'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowReceiptPreviewModal(false)}
              style={{ 
                width: ui.iconBtn, 
                height: ui.iconBtn, 
                borderRadius: ui.iconBtn / 2, 
                backgroundColor: '#E4E6EB', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <X size={ui.iconSm} color="#65676B" />
            </TouchableOpacity>
          </View>
          
          {selectedOrderForReceipt && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isPhone ? 12 : 20 }}>
              {/* Receipt Card */}
              <View style={{ 
                backgroundColor: colors.white, 
                borderRadius: 12, 
                overflow: 'hidden',
                marginBottom: isPhone ? 12 : 16,
              }}>
                {/* Header Section */}
                <View style={{ alignItems: 'center', paddingVertical: isPhone ? 20 : 28, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E4E6EB' }}>
                  <View style={{
                    width: isPhone ? 48 : 64,
                    height: isPhone ? 48 : 64,
                    borderRadius: isPhone ? 24 : 32,
                    backgroundColor: '#EBF5FF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}>
                    <Coffee size={ui.iconLg} color="#1877F2" />
                  </View>
                  <Text style={{ fontSize: ui.text.xl, fontWeight: '800', color: '#1C1E21' }}>CaissaPro</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                    <Calendar size={ui.iconSm} color="#8A8D91" />
                    <Text style={{ fontSize: ui.text.sm, color: '#8A8D91' }}>
                      {new Date(selectedOrderForReceipt.createdAt).toLocaleDateString('fr-FR', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      })} à {new Date(selectedOrderForReceipt.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                
                {/* Order Info Row */}
                <View style={{ 
                  flexDirection: 'row', 
                  borderBottomWidth: 1, 
                  borderBottomColor: '#E4E6EB', 
                }}>
                  <View style={{ flex: 1, alignItems: 'center', paddingVertical: isPhone ? 14 : 18, borderRightWidth: 1, borderRightColor: '#E4E6EB' }}>
                    <Text style={{ fontSize: ui.text.xl, fontWeight: '800', color: '#1877F2' }}>
                      #{selectedOrderForReceipt.orderNumber}
                    </Text>
                    <Text style={{ fontSize: ui.text.xs, color: '#8A8D91', fontWeight: '500', marginTop: 2 }}>COMMANDE</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', paddingVertical: isPhone ? 14 : 18, borderRightWidth: 1, borderRightColor: '#E4E6EB' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {selectedOrderForReceipt.tableNumber === 0 ? (
                        <Coffee size={ui.iconMd} color="#1C1E21" />
                      ) : (
                        <Text style={{ fontSize: ui.text.xl, fontWeight: '800', color: '#1C1E21' }}>
                          {selectedOrderForReceipt.tableNumber}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: ui.text.xs, color: '#8A8D91', fontWeight: '500', marginTop: 2 }}>
                      {selectedOrderForReceipt.tableNumber === 0 ? 'COMPTOIR' : 'TABLE'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', paddingVertical: isPhone ? 14 : 18 }}>
                    {selectedOrderForReceipt.status === 'PAID' ? (
                      <CheckCircle size={ui.iconMd} color="#00A884" />
                    ) : (
                      <Clock size={ui.iconMd} color="#F59E0B" />
                    )}
                    <Text style={{ fontSize: ui.text.xs, color: '#8A8D91', fontWeight: '500', marginTop: 2 }}>
                      {selectedOrderForReceipt.status === 'PAID' ? 'PAYÉE' : 'ATTENTE'}
                    </Text>
                  </View>
                </View>
                
                {/* Items List */}
                <View style={{ paddingHorizontal: isPhone ? 16 : 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: isPhone ? 12 : 16, borderBottomWidth: 1, borderBottomColor: '#E4E6EB' }}>
                    <ShoppingBag size={ui.iconSm} color="#8A8D91" />
                    <Text style={{ fontSize: ui.text.xs, fontWeight: '600', color: '#8A8D91', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Articles ({selectedOrderForReceipt.items.reduce((s, i) => s + i.quantity, 0)})
                    </Text>
                  </View>
                  {selectedOrderForReceipt.items.map((item, index) => (
                    <View 
                      key={index} 
                      style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        paddingVertical: isPhone ? 12 : 16,
                        borderBottomWidth: index < selectedOrderForReceipt.items.length - 1 ? 1 : 0,
                        borderBottomColor: '#F0F2F5',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 10 : 14, flex: 1 }}>
                        <View style={{
                          width: isPhone ? 26 : 34,
                          height: isPhone ? 26 : 34,
                          borderRadius: 8,
                          backgroundColor: '#F0F2F5',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: ui.text.sm, fontWeight: '700', color: '#1C1E21' }}>
                            {item.quantity}
                          </Text>
                        </View>
                        <Text style={{ fontSize: ui.text.md, color: '#1C1E21', flex: 1 }} numberOfLines={1}>
                          {item.productName}
                        </Text>
                      </View>
                      <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#1C1E21' }}>
                        {(item.quantity * item.price).toFixed(0)} DH
                      </Text>
                    </View>
                  ))}
                </View>
                
                {/* Total Section */}
                <View style={{ 
                  backgroundColor: '#F7F8FA', 
                  padding: isPhone ? 16 : 24,
                  marginTop: 8,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#65676B' }}>TOTAL</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontSize: isPhone ? 28 : 36, fontWeight: '800', color: '#00A884' }}>
                        {Math.round(selectedOrderForReceipt.totalAmount)}
                      </Text>
                      <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#65676B' }}>MAD</Text>
                    </View>
                  </View>
                  
                  {selectedOrderForReceipt.paymentMethod && (
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginTop: isPhone ? 14 : 18,
                      paddingTop: isPhone ? 14 : 18,
                      borderTopWidth: 1,
                      borderTopColor: '#E4E6EB',
                      gap: 10,
                    }}>
                      {selectedOrderForReceipt.paymentMethod === 'cash' ? (
                        <Banknote size={ui.iconMd} color="#166534" />
                      ) : (
                        <CreditCard size={ui.iconMd} color="#1D4ED8" />
                      )}
                      <Text style={{ fontSize: ui.text.sm, color: '#65676B', fontWeight: '500' }}>
                        Payé par {selectedOrderForReceipt.paymentMethod === 'cash' ? 'espèces' : 'carte'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Print Button - Admin Only */}
              {hasPermission(user?.role as UserRole, 'print_daily_report') ? (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedOrderForReceipt) {
                      handlePrintReceipt(selectedOrderForReceipt);
                    }
                  }}
                  disabled={printing}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    backgroundColor: '#00A884',
                    paddingVertical: isPhone ? 14 : 18,
                    minHeight: isPhone ? 52 : 60,
                    borderRadius: 10,
                  }}
                >
                  {printing ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Printer size={ui.iconMd} color={colors.white} />
                  )}
                  <Text style={{ fontSize: ui.text.md, fontWeight: '700', color: colors.white }}>
                    {printing ? 'Impression...' : 'Imprimer le reçu'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  backgroundColor: colors.borderLight,
                  paddingVertical: isPhone ? 14 : 18,
                  minHeight: isPhone ? 52 : 60,
                  borderRadius: 10,
                }}>
                  <Lock size={20} color={colors.textMuted} />
                  <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textMuted }}>
                    Impression réservée aux admins
                  </Text>
                </View>
              )}
              
              {/* Footer */}
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 13, color: '#8A8D91' }}>Merci de votre visite</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Table Selection Modal */}
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
            paddingVertical: isPhone ? 16 : 20,
            paddingHorizontal: isPhone ? 16 : 24, 
            backgroundColor: colors.white, 
            borderBottomWidth: 1, 
            borderBottomColor: colors.borderLight,
            ...shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Users size={ui.iconMd} color={colors.primary} />
              <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.textPrimary }}>Choisir Table</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTableModal(false)}
              style={{ 
                width: ui.iconBtn, 
                height: ui.iconBtn, 
                borderRadius: ui.iconBtn / 2, 
                backgroundColor: colors.border, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <X size={ui.iconSm} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: isPhone ? 16 : 24 }}>
            {/* Counter option */}
            <TouchableOpacity
              onPress={() => {
                setSelectedTable(0);
                setShowTableModal(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: isPhone ? 16 : 20,
                marginBottom: isPhone ? 16 : 24,
                minHeight: isPhone ? 72 : 88,
                backgroundColor: selectedTable === 0 ? colors.primary : colors.white,
                borderRadius: 16,
                ...shadows.sm,
              }}
            >
              <View style={{ 
                width: isPhone ? 48 : 60, 
                height: isPhone ? 48 : 60, 
                borderRadius: 14, 
                backgroundColor: selectedTable === 0 ? 'rgba(255,255,255,0.2)' : colors.primaryLight, 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 14,
              }}>
                <Coffee size={ui.iconMd} color={selectedTable === 0 ? colors.white : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: ui.text.lg, 
                  fontWeight: '600', 
                  color: selectedTable === 0 ? colors.white : colors.textPrimary 
                }}>
                  Comptoir
                </Text>
                <Text style={{ 
                  fontSize: ui.text.sm, 
                  color: selectedTable === 0 ? 'rgba(255,255,255,0.7)' : colors.textSecondary 
                }}>
                  Vente à emporter
                </Text>
              </View>
              {selectedTable === 0 && (
                <View style={{ 
                  width: isPhone ? 24 : 32, 
                  height: isPhone ? 24 : 32, 
                  borderRadius: isPhone ? 12 : 16, 
                  backgroundColor: colors.white, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Check size={ui.iconSm} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
            
            {/* Table section title */}
            <Text style={{ fontSize: ui.text.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tables
            </Text>
            
            {/* Table grid - responsive */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isPhone ? 10 : 16 }}>
              {TABLES.map(table => (
                <TouchableOpacity
                  key={table}
                  onPress={() => {
                    setSelectedTable(table);
                    setShowTableModal(false);
                  }}
                  style={{
                    width: isLargeTablet ? '14%' : (isPhone ? '22%' : '18%'),
                    aspectRatio: 1,
                    minWidth: isPhone ? 70 : 85,
                    minHeight: isPhone ? 70 : 85,
                    backgroundColor: selectedTable === table ? colors.primary : colors.white,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: ui.text.xl, 
                    fontWeight: '700', 
                    color: selectedTable === table ? colors.white : colors.textPrimary 
                  }}>
                    {table}
                  </Text>
                  <Text style={{ 
                    fontSize: ui.text.xs, 
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
          padding: isPhone ? 20 : 32,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            width: '100%',
            maxWidth: isLargeTablet ? 700 : 500,
            maxHeight: '85%',
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: isPhone ? 20 : 24,
              backgroundColor: '#F59E0B',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pause size={ui.iconMd} color="#FFFFFF" />
                <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: '#FFFFFF' }}>
                  En attente ({pendingOrders.length})
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowPendingModal(false)}
                style={{ 
                  width: ui.iconBtn, 
                  height: ui.iconBtn, 
                  borderRadius: ui.iconBtn / 2,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={ui.iconSm} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pendingOrders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: isPhone ? 16 : 24 }}
              ItemSeparatorComponent={() => <View style={{ height: isPhone ? 12 : 16 }} />}
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
                  padding: isPhone ? 16 : 20,
                  borderWidth: isUrgent ? 2 : 0,
                  borderColor: isUrgent ? '#EF4444' : 'transparent',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 10 : 14 }}>
                      <View style={{
                        backgroundColor: '#F59E0B',
                        paddingHorizontal: isPhone ? 12 : 16,
                        paddingVertical: isPhone ? 6 : 8,
                        borderRadius: 10,
                      }}>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '700', color: '#FFFFFF' }}>
                          #{item.orderNumber}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: isPhone ? 10 : 14,
                        paddingVertical: isPhone ? 4 : 6,
                        borderRadius: 8,
                      }}>
                        <Text style={{ fontSize: ui.text.sm, fontWeight: '600', color: '#92400E' }}>
                          {item.tableNumber === 0 ? 'Comptoir' : `Table ${item.tableNumber}`}
                        </Text>
                      </View>
                      {/* Time elapsed indicator */}
                      <View style={{
                        backgroundColor: isUrgent ? '#EF4444' : '#FCD34D',
                        paddingHorizontal: isPhone ? 8 : 12,
                        paddingVertical: isPhone ? 4 : 6,
                        borderRadius: 8,
                      }}>
                        <Text style={{ fontSize: ui.text.xs, fontWeight: '700', color: isUrgent ? '#FFFFFF' : '#78350F' }}>
                          {timeDisplay}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: '#92400E' }}>
                      {Math.round(item.totalAmount)} MAD
                    </Text>
                  </View>
                  
                  {/* Items preview */}
                  <View style={{ marginTop: isPhone ? 10 : 14 }}>
                    {item.items.slice(0, 3).map((orderItem, idx) => (
                      <Text key={idx} style={{ fontSize: ui.text.sm, color: '#78350F', lineHeight: isPhone ? 20 : 24 }}>
                        • {orderItem.quantity}x {orderItem.productName}
                        {orderItem.note ? ` (${orderItem.note})` : ''}
                      </Text>
                    ))}
                    {item.items.length > 3 && (
                      <Text style={{ fontSize: ui.text.sm, color: '#92400E', fontStyle: 'italic' }}>
                        +{item.items.length - 3} autres...
                      </Text>
                    )}
                  </View>
                  
                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: isPhone ? 10 : 14, marginTop: isPhone ? 14 : 18 }}>
                    <TouchableOpacity
                      onPress={() => recallOrder(item)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        backgroundColor: '#10B981',
                        paddingVertical: isPhone ? 14 : 16,
                        minHeight: isPhone ? 48 : 56,
                        borderRadius: 14,
                      }}
                    >
                      <Play size={ui.iconSm} color="#FFFFFF" />
                      <Text style={{ fontSize: ui.text.md, fontWeight: '700', color: '#FFFFFF' }}>Reprendre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => cancelOrder(item.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: '#EF4444',
                        paddingVertical: isPhone ? 14 : 16,
                        paddingHorizontal: isPhone ? 16 : 20,
                        minHeight: isPhone ? 48 : 56,
                        borderRadius: 14,
                      }}
                    >
                      <Trash2 size={ui.iconSm} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );}}
              ListEmptyComponent={() => (
                <View style={{ padding: isPhone ? 40 : 60, alignItems: 'center' }}>
                  <View style={{
                    width: isPhone ? 64 : 80,
                    height: isPhone ? 64 : 80,
                    borderRadius: isPhone ? 32 : 40,
                    backgroundColor: '#FEF3C7',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <Pause size={ui.iconLg} color="#F59E0B" />
                  </View>
                  <Text style={{ fontSize: ui.text.md, color: '#9CA3AF' }}>
                    Aucune commande en attente
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Daily Report Modal - Professional POS Design */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowReportModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <BarChart3 size={24} color={colors.white} />
              <View>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.white }}>
                  Rapport du jour
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setShowReportModal(false)}
              style={{ 
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
          
          {/* Hero Revenue Card */}
          <View style={{
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 20,
            padding: spacing.xl,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.xs }}>
              Chiffre d'affaires
            </Text>
            <Text style={{ fontSize: 52, fontWeight: '800', color: colors.white }}>
              {Math.round(dailyStats.totalRevenue).toLocaleString('fr-FR')}
            </Text>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>
              DH
            </Text>
            
            {/* Quick stats row */}
            <View style={{ 
              flexDirection: 'row', 
              marginTop: spacing.lg,
              gap: spacing.xl,
            }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' }}>Commandes</Text>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.white }}>
                  {dailyStats.paidOrders}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' }}>Panier moyen</Text>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.white }}>
                  {dailyStats.paidOrders > 0 ? Math.round(dailyStats.totalRevenue / dailyStats.paidOrders) : 0}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' }}>En attente</Text>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: pendingOrders.length > 0 ? '#FCD34D' : colors.white }}>
                  {pendingOrders.length}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Content Area */}
          <ScrollView 
            style={{ flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            contentContainerStyle={{ padding: spacing.lg }}
          >
            {/* Payment Methods */}
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Moyens de paiement
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
              <View style={{ 
                flex: 1,
                backgroundColor: colors.white,
                borderRadius: 16,
                padding: spacing.lg,
                alignItems: 'center',
                ...shadows.sm,
              }}>
                <View style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 22, 
                  backgroundColor: colors.successLight, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: spacing.sm,
                }}>
                  <Banknote size={22} color={colors.success} />
                </View>
                <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Espèces</Text>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>
                  {Math.round(dailyStats.cashRevenue).toLocaleString('fr-FR')} <Text style={{ fontSize: fontSize.sm }}>DH</Text>
                </Text>
              </View>
              
              <View style={{ 
                flex: 1,
                backgroundColor: colors.white,
                borderRadius: 16,
                padding: spacing.lg,
                alignItems: 'center',
                ...shadows.sm,
              }}>
                <View style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 22, 
                  backgroundColor: colors.primaryLight, 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: spacing.sm,
                }}>
                  <CreditCard size={22} color={colors.primary} />
                </View>
                <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Carte</Text>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>
                  {Math.round(dailyStats.cardRevenue).toLocaleString('fr-FR')} <Text style={{ fontSize: fontSize.sm }}>DH</Text>
                </Text>
              </View>
            </View>
            
            {/* Profit Section */}
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Rentabilité
            </Text>
            <View style={{ 
              backgroundColor: colors.white,
              borderRadius: 16,
              padding: spacing.lg,
              marginBottom: spacing.xl,
              ...shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <Text style={{ fontSize: fontSize.md, color: colors.textSecondary }}>Revenus</Text>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.success }}>
                  +{Math.round(dailyStats.totalRevenue).toLocaleString('fr-FR')} DH
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <Text style={{ fontSize: fontSize.md, color: colors.textSecondary }}>Dépenses</Text>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.error }}>
                  -{Math.round(todayExpenseTotal).toLocaleString('fr-FR')} DH
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary }}>Bénéfice net</Text>
                <Text style={{ 
                  fontSize: fontSize.xxl, 
                  fontWeight: '800', 
                  color: (dailyStats.totalRevenue - todayExpenseTotal) >= 0 ? colors.success : colors.error 
                }}>
                  {Math.round(dailyStats.totalRevenue - todayExpenseTotal).toLocaleString('fr-FR')} DH
                </Text>
              </View>
            </View>
            
            {/* Stock Alerts */}
            {lowStockProducts.length > 0 && (
              <>
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Alertes stock
                </Text>
                <View style={{ 
                  backgroundColor: colors.white,
                  borderRadius: 16,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.warning,
                  ...shadows.sm,
                }}>
                  {lowStockProducts.filter(p => p.stockQuantity === 0).length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error }} />
                      <Text style={{ fontSize: fontSize.md, color: colors.error, fontWeight: '600' }}>
                        {lowStockProducts.filter(p => p.stockQuantity === 0).length} produit(s) épuisé(s)
                      </Text>
                    </View>
                  )}
                  {lowStockProducts.filter(p => p.stockQuantity > 0).length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning }} />
                      <Text style={{ fontSize: fontSize.md, color: '#92400E' }}>
                        {lowStockProducts.filter(p => p.stockQuantity > 0).length} produit(s) stock bas
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
            
            {/* Bottom padding for buttons */}
            <View style={{ height: 80 }} />
          </ScrollView>
          
          {/* Fixed Bottom Actions */}
          <View style={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.white,
            padding: spacing.lg,
            paddingBottom: spacing.xl,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
            flexDirection: 'row',
            gap: spacing.md,
          }}>
            {hasPermission(user?.role as UserRole, 'print_daily_report') && (
              <TouchableOpacity
                onPress={handlePrintDailyReport}
                style={{
                  flex: 1,
                  backgroundColor: colors.white,
                  paddingVertical: spacing.lg,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  borderWidth: 2,
                  borderColor: colors.primary,
                }}
              >
                <Printer size={20} color={colors.primary} />
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.primary }}>
                  Imprimer
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              onPress={() => setShowReportModal(false)}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                paddingVertical: spacing.lg,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.white }}>
                Fermer
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Admin Panel */}
      <AdminPanel
        visible={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        onDataChanged={refreshAllData}
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
              paddingVertical: isPhone ? 16 : 20,
              paddingHorizontal: isPhone ? 16 : 24, 
              backgroundColor: colors.white, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.borderLight,
              ...shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Package size={ui.iconMd} color={colors.primary} />
                <View>
                  <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.textPrimary }}>Gestion du Stock</Text>
                  <Text style={{ fontSize: ui.text.xs, color: colors.textSecondary }}>
                    {allStockProducts.filter(p => p.stockQuantity >= 0).length} produits suivis
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowStockModal(false)}
                style={{ 
                  width: ui.iconBtn, 
                  height: ui.iconBtn, 
                  borderRadius: ui.iconBtn / 2, 
                  backgroundColor: colors.border, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <X size={ui.iconSm} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Search and Filter */}
            <View style={{ padding: isPhone ? 16 : 24, paddingBottom: 0 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: colors.white, 
                borderRadius: 14, 
                paddingHorizontal: isPhone ? 12 : 16,
                minHeight: isPhone ? 48 : 56,
                marginBottom: isPhone ? 12 : 16,
                ...shadows.sm,
              }}>
                <Search size={ui.iconSm} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, padding: isPhone ? 12 : 16, fontSize: ui.text.md, color: colors.textPrimary }}
                  value={stockSearchQuery}
                  onChangeText={setStockSearchQuery}
                  placeholder="Rechercher un produit..."
                  placeholderTextColor={colors.textMuted}
                />
                {stockSearchQuery.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => setStockSearchQuery('')}
                    style={{ padding: 8 }}
                  >
                    <X size={ui.iconSm} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* View Mode Toggle */}
              <View style={{ flexDirection: 'row', gap: isPhone ? 8 : 12, marginBottom: isPhone ? 12 : 16 }}>
                <TouchableOpacity
                  onPress={() => setStockViewMode('all')}
                  style={{
                    flex: 1,
                    paddingVertical: isPhone ? 10 : 14,
                    minHeight: isPhone ? 44 : 52,
                    borderRadius: 12,
                    backgroundColor: stockViewMode === 'all' ? colors.primary : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: ui.text.sm, 
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
                    paddingVertical: isPhone ? 10 : 14,
                    minHeight: isPhone ? 44 : 52,
                    borderRadius: 12,
                    backgroundColor: stockViewMode === 'low' ? colors.warning : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: ui.text.sm, 
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
                  padding: isPhone ? 12 : 16, 
                  marginHorizontal: isPhone ? 16 : 24,
                  minHeight: isPhone ? 48 : 56,
                  borderRadius: 14,
                  gap: 10,
                }}
              >
                <AlertTriangle size={ui.iconSm} color={colors.warning} />
                <Text style={{ flex: 1, fontSize: ui.text.sm, color: colors.warning, fontWeight: '500' }}>
                  {lowStockProducts.length} produit(s) en stock bas - Appuyez pour voir
                </Text>
                <ChevronRight size={ui.iconSm} color={colors.warning} />
              </TouchableOpacity>
            )}
            
            <FlatList
              data={
                (stockViewMode === 'low' ? lowStockProducts : allStockProducts.filter(p => p.stockQuantity >= 0))
                  .filter(p => p.name.toLowerCase().includes(stockSearchQuery.toLowerCase()))
              }
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: isPhone ? 16 : 24 }}
              ItemSeparatorComponent={() => <View style={{ height: isPhone ? 10 : 14 }} />}
              renderItem={({ item }) => {
                const isLowStock = item.stockQuantity <= item.lowStockThreshold;
                const isOutOfStock = item.stockQuantity === 0;
                const isEditing = editingStockId === item.id;
                
                return (
                  <View style={{
                    backgroundColor: colors.white,
                    padding: isPhone ? 16 : 20,
                    borderRadius: 14,
                    borderLeftWidth: 4,
                    borderLeftColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success,
                    ...shadows.sm,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isPhone ? 12 : 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textPrimary }}>{item.name}</Text>
                        <Text style={{ fontSize: ui.text.xs, color: colors.textSecondary, marginTop: 2 }}>
                          {item.categoryName} • Seuil: {item.lowStockThreshold}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: isPhone ? 12 : 16,
                        paddingVertical: isPhone ? 4 : 6,
                        borderRadius: 20,
                        backgroundColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success,
                      }}>
                        <Text style={{ fontSize: ui.text.xs, fontWeight: '600', color: colors.white }}>
                          {isOutOfStock ? 'RUPTURE' : isLowStock ? 'BAS' : 'OK'}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Stock Controls */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: colors.background, 
                      borderRadius: 12, 
                      padding: isPhone ? 8 : 12,
                    }}>
                      <TouchableOpacity
                        onPress={() => adjustProductStock(item.id, -1)}
                        style={{
                          width: isPhone ? 44 : 52,
                          height: isPhone ? 44 : 52,
                          borderRadius: 12,
                          backgroundColor: colors.error,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Minus size={ui.iconSm} color={colors.white} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        onPress={() => {
                          setEditingStockId(item.id);
                          setEditingStockValue(item.stockQuantity.toString());
                        }}
                        style={{ flex: 1, alignItems: 'center', paddingHorizontal: isPhone ? 12 : 16 }}
                      >
                        {isEditing ? (
                          <TextInput
                            style={{
                              fontSize: isPhone ? 22 : 28,
                              fontWeight: '700',
                              color: colors.textPrimary,
                              textAlign: 'center',
                              minWidth: isPhone ? 80 : 100,
                              padding: isPhone ? 4 : 8,
                              backgroundColor: colors.white,
                              borderRadius: 8,
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
                              fontSize: isPhone ? 22 : 28, 
                              fontWeight: '700', 
                              color: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.textPrimary 
                            }}>
                              {item.stockQuantity}
                            </Text>
                            <Text style={{ fontSize: ui.text.xs, color: colors.textMuted }}>Appuyez pour modifier</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => adjustProductStock(item.id, 1)}
                        style={{
                          width: isPhone ? 44 : 52,
                          height: isPhone ? 44 : 52,
                          borderRadius: 12,
                          backgroundColor: colors.success,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Plus size={ui.iconSm} color={colors.white} />
                      </TouchableOpacity>
                      
                      {/* Quick add buttons */}
                      <View style={{ flexDirection: 'row', marginLeft: isPhone ? 8 : 12, gap: isPhone ? 4 : 6 }}>
                        {[5, 10, 20].map(n => (
                          <TouchableOpacity
                            key={n}
                            onPress={() => adjustProductStock(item.id, n)}
                            style={{
                              paddingHorizontal: isPhone ? 8 : 12,
                              paddingVertical: isPhone ? 4 : 6,
                              minHeight: isPhone ? 32 : 40,
                              borderRadius: 8,
                              backgroundColor: colors.primaryLight,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: ui.text.xs, fontWeight: '600', color: colors.primary }}>+{n}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: isPhone ? 60 : 80 }}>
                  {stockViewMode === 'low' ? (
                    <>
                      <Package size={ui.iconLg + 16} color={colors.success} />
                      <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: colors.success, marginTop: 16 }}>Stock OK!</Text>
                      <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                        Tous les produits sont bien approvisionnés
                      </Text>
                    </>
                  ) : (
                    <>
                      <Package size={ui.iconLg + 16} color={colors.textMuted} />
                      <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>Aucun produit</Text>
                      <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
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
              paddingVertical: isPhone ? 16 : 20,
              paddingHorizontal: isPhone ? 16 : 24, 
              backgroundColor: colors.white, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.borderLight,
              ...shadows.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Wallet size={ui.iconMd} color={colors.error} />
                <View>
                  <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.textPrimary }}>Dépenses</Text>
                  <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary }}>
                    Total aujourd&apos;hui: {todayExpenseTotal} DH
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowExpensesModal(false)}
                style={{ 
                  width: ui.iconBtn, 
                  height: ui.iconBtn, 
                  borderRadius: ui.iconBtn / 2, 
                  backgroundColor: colors.border, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <X size={ui.iconSm} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Add Expense Form */}
            <View style={{ 
              backgroundColor: colors.white, 
              padding: isPhone ? 16 : 24, 
              margin: isPhone ? 16 : 24, 
              borderRadius: 16, 
              ...shadows.sm 
            }}>
              <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textPrimary, marginBottom: isPhone ? 12 : 16 }}>
                Nouvelle dépense
              </Text>
              
              <View style={{ flexDirection: 'row', gap: isPhone ? 12 : 16, marginBottom: isPhone ? 12 : 16 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    padding: isPhone ? 12 : 16,
                    fontSize: ui.text.lg,
                    fontWeight: '600',
                    color: colors.textPrimary,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                    minHeight: isPhone ? 48 : 56,
                  }}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={{ alignSelf: 'center', fontSize: ui.text.lg, fontWeight: '600', color: colors.textSecondary }}>DH</Text>
              </View>
              
              <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginBottom: isPhone ? 8 : 10 }}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: isPhone ? 12 : 16 }}>
                <View style={{ flexDirection: 'row', gap: isPhone ? 8 : 10 }}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setExpenseCategory(cat)}
                      style={{
                        paddingHorizontal: isPhone ? 12 : 16,
                        paddingVertical: isPhone ? 8 : 10,
                        minHeight: isPhone ? 40 : 48,
                        borderRadius: 20,
                        backgroundColor: expenseCategory === cat ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: expenseCategory === cat ? colors.primary : colors.borderLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ 
                        fontSize: ui.text.sm, 
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
                  borderRadius: 12,
                  padding: isPhone ? 12 : 16,
                  fontSize: ui.text.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.borderLight,
                  marginBottom: isPhone ? 12 : 16,
                  minHeight: isPhone ? 48 : 56,
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
                  paddingVertical: isPhone ? 14 : 16,
                  minHeight: isPhone ? 48 : 56,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <TrendingDown size={ui.iconSm} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: '600', fontSize: ui.text.md }}>Ajouter Dépense</Text>
              </TouchableOpacity>
            </View>
            
            {/* Today's Expenses List */}
            <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textPrimary, marginHorizontal: isPhone ? 16 : 24, marginBottom: isPhone ? 12 : 16 }}>
              Dépenses du jour
            </Text>
            <FlatList
              data={todayExpenses}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: isPhone ? 16 : 24, paddingBottom: 40 }}
              ItemSeparatorComponent={() => <View style={{ height: isPhone ? 10 : 14 }} />}
              renderItem={({ item }) => (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.white,
                  padding: isPhone ? 16 : 20,
                  borderRadius: 14,
                  ...shadows.sm,
                }}>
                  <View style={{ 
                    width: isPhone ? 44 : 52, 
                    height: isPhone ? 44 : 52, 
                    borderRadius: 12, 
                    backgroundColor: colors.errorLight, 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Wallet size={ui.iconSm} color={colors.error} />
                  </View>
                  <View style={{ flex: 1, marginLeft: isPhone ? 12 : 16 }}>
                    <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textPrimary }}>{item.category}</Text>
                    {item.description && (
                      <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 2 }}>{item.description}</Text>
                    )}
                    <Text style={{ fontSize: ui.text.xs, color: colors.textMuted, marginTop: 2 }}>
                      {item.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: colors.error, marginRight: isPhone ? 12 : 16 }}>
                    -{item.amount} DH
                  </Text>
                  <TouchableOpacity 
                    onPress={() => deleteExpense(item.id)} 
                    style={{ 
                      width: isPhone ? 40 : 48, 
                      height: isPhone ? 40 : 48, 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}
                  >
                    <Trash2 size={ui.iconSm} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: isPhone ? 40 : 60 }}>
                  <Wallet size={ui.iconLg + 8} color={colors.border} />
                  <Text style={{ fontSize: ui.text.md, color: colors.textSecondary, marginTop: 12 }}>Aucune dépense aujourd&apos;hui</Text>
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
            paddingVertical: isPhone ? 16 : 20,
            paddingHorizontal: isPhone ? 16 : 24, 
            backgroundColor: colors.white, 
            borderBottomWidth: 1, 
            borderBottomColor: colors.borderLight,
            ...shadows.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bell size={ui.iconMd} color={colors.primary} />
              <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.textPrimary }}>Notifications</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowNotificationPanel(false)}
              style={{ 
                width: ui.iconBtn, 
                height: ui.iconBtn, 
                borderRadius: ui.iconBtn / 2, 
                backgroundColor: colors.border, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <X size={ui.iconSm} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: isPhone ? 16 : 24 }}
            ItemSeparatorComponent={() => <View style={{ height: isPhone ? 10 : 14 }} />}
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
                  padding: isPhone ? 16 : 20,
                  borderRadius: 14,
                  ...shadows.sm,
                }}
              >
                <View style={{ 
                  width: isPhone ? 44 : 52, 
                  height: isPhone ? 44 : 52, 
                  borderRadius: 12, 
                  backgroundColor: item.type === 'low_stock' ? colors.warningLight : colors.errorLight, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  {item.type === 'low_stock' ? (
                    <AlertTriangle size={ui.iconSm} color={colors.warning} />
                  ) : (
                    <Wallet size={ui.iconSm} color={colors.error} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isPhone ? 12 : 16 }}>
                  <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textPrimary }}>{item.title}</Text>
                  <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 2 }}>{item.message}</Text>
                </View>
                <ChevronRight size={ui.iconSm} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: isPhone ? 60 : 80 }}>
                <Bell size={ui.iconLg + 16} color={colors.border} />
                <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: colors.textPrimary, marginTop: 16 }}>Tout est en ordre!</Text>
                <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
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
