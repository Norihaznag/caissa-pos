import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, Alert, TextInput, ActivityIndicator, useWindowDimensions, Modal, Platform, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Image, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
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
  CheckCircle,
  Clock,
  ShoppingBag,
  Lock,
  Bluetooth,
  BluetoothConnected,
  Inbox,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Crypto from 'expo-crypto';
import { useAppStore } from '../lib/store';
import { spacing, fontSize, shadows } from '../lib/theme';
import { useAppTheme } from '../lib/themes/ThemeContext';
import { 
  initOfflineDatabase, 
  offlineCategoryService, 
  offlineProductService, 
  offlineOrderService,
  offlineExpenseService,
  offlineSettingsService,
  Expense,
  EXPENSE_CATEGORIES,
  OfflineOrder,
  OfflineOrderItem,
  clearInvalidSyncQueueItems,
} from '../lib/offline-db';
import { loadPrinterConfig, printDailyReport, DailyReportData, BluetoothPrinterService, UnifiedPrinterService, loadReceiptDesign, openCashDrawerNative } from '../lib/printing';
import { PrinterService, type ReceiptData as PrinterReceiptData } from '../lib/services/PrinterService';
import { hasPermission, type UserRole } from '../lib/permissions';
import AdminPanel from '../components/AdminPanel';
import { UnifiedPrinterModal } from '../components/UnifiedPrinterModal';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { shiftService, Shift } from '../lib/shifts/shiftService';
import { MacOSAppLoading } from '../components/ui/MacOSButton';
import { OnboardingTutorial } from '../components/OnboardingTutorial';

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

// ==================== ANIMATED COMPONENTS ====================

/**
 * AnimatedProductCard - macOS style product card with smooth press animation
 * Fast, smooth animations that don't affect performance
 */
interface AnimatedProductCardProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  width: number;
  height: number;
}

function AnimatedProductCard({ children, onPress, disabled = false, width, height }: AnimatedProductCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scaleAnim]);
  
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);
  
  const handlePress = useCallback(() => {
    if (!disabled) {
      onPress();
    }
  }, [disabled, onPress]);
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width, height }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * AnimatedCartItem - smooth cart item interactions
 */
interface AnimatedCartItemProps {
  children: React.ReactNode;
  onPress?: () => void;
}

function AnimatedCartItem({ children, onPress }: AnimatedCartItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scaleAnim]);
  
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 3,
    }).start();
  }, [scaleAnim]);
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * AnimatedButton - macOS style button with smooth press animation
 */
interface AnimatedButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
}

function AnimatedButton({ children, onPress, disabled = false, style }: AnimatedButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  
  const handlePressIn = useCallback(() => {
    setPressed(true);
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }, [scaleAnim]);
  
  const handlePressOut = useCallback(() => {
    setPressed(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);
  
  const handlePress = useCallback(() => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [disabled, onPress]);
  
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, pressed && { opacity: 0.9 }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ==================== MAIN COMPONENT ====================

export default function CashierSimpleScreen() {
  const router = useRouter();
  const logout = useAppStore((state) => state.logout);
  const user = useAppStore((state) => state.user);
  
  // Get dynamic theme colors
  const { colors } = useAppTheme();
  
  // Responsive dimensions
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isLargeTablet = width >= 1024;
  
  // Professional POS grid layout
  // Goal: Large, easily tappable cards with clear visual hierarchy
  const CARD_GAP = 12;
  const GRID_PADDING = 16;
  
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
      xxl: isPhone ? 28 : 34,
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
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
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
  const [printerConnected, setPrinterConnected] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  
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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  
  // Stats
  const [dailyStats, setDailyStats] = useState({
    totalOrders: 0,
    paidOrders: 0,
    totalRevenue: 0,
    cashRevenue: 0,
    cardRevenue: 0,
  });
  
  // Session / Caisse (Open/Close)
  const [currentSession, setCurrentSession] = useState<Shift | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionOpeningAmount, setSessionOpeningAmount] = useState('');
  const [sessionClosingAmount, setSessionClosingAmount] = useState('');

  // Mode-specific header colors - Uses theme primary color
  const modeConfig = useMemo(() => {
    const role = user?.role || 'cashier';
    switch (role) {
      case 'admin':
        return {
          color: colors.primary, // Theme primary color
          title: 'Mode Admin',
          subtitle: 'Configuration & Paramètres',
        };
      case 'waiter':
        return {
          color: colors.warning || colors.primary, // Use warning or fallback to primary
          title: 'Mode Serveur',
          subtitle: 'Prise de commandes',
        };
      case 'cashier':
      default:
        return {
          color: colors.success || colors.primary, // Use success or fallback to primary
          title: 'Mode Caisse',
          subtitle: 'Ventes & Encaissements',
        };
    }
  }, [user?.role, colors]);

  // Lock to landscape mode for tablets
  useEffect(() => {
    const lockLandscape = async () => {
      // Lock to landscape for tablet horizontal mode
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    };
    lockLandscape();
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
        await loadCurrentSession();
        
        // Check printer connection status (try UnifiedPrinterService first, fallback to Bluetooth)
        const unifiedStatus = UnifiedPrinterService.getConnectionStatus();
        if (unifiedStatus.isConnected) {
          setPrinterConnected(true);
        } else {
          const printerStatus = BluetoothPrinterService.getConnectionStatus();
          setPrinterConnected(printerStatus.isConnected);
        }
        
      } catch (error) {
        console.error('Init error:', error);
        Alert.alert('Erreur', 'Impossible d\'initialiser la base de données');
      } finally {
        setLoading(false);
      }
    };
    
    init();
    
    // Subscribe to printer connection status (both services)
    const unsubscribeUnified = UnifiedPrinterService.onConnectionStatusChange((status) => {
      setPrinterConnected(status === 'connected');
    });
    
    const unsubscribeBluetooth = BluetoothPrinterService.onConnectionStatusChange((status) => {
      // Only update if unified is not connected
      if (!UnifiedPrinterService.isConnected()) {
        setPrinterConnected(status === 'connected');
      }
    });
    
    // Refresh pending orders periodically (no network check)
    const interval = setInterval(async () => {
      await loadPendingOrders();
    }, 30000);
    
    return () => {
      clearInterval(interval);
      unsubscribeUnified();
      unsubscribeBluetooth();
    };
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

  // Open cash drawer manually
  const handleOpenCashDrawer = async () => {
    try {
      const connected = await PrinterService.checkConnection();
      if (!connected) {
        Alert.alert('Imprimante non connectée', 'Connectez l\'imprimante pour ouvrir le tiroir-caisse.');
        return;
      }
      
      console.log('[CASH_DRAWER] Manual drawer open requested...');
      const success = await openCashDrawerNative();
      
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[CASH_DRAWER] ✅ Drawer opened manually');
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le tiroir-caisse');
      }
    } catch (error) {
      console.error('[CASH_DRAWER] Manual open error:', error);
      Alert.alert('Erreur', 'Erreur lors de l\'ouverture du tiroir-caisse');
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
        cashierName: user?.name || 'Admin',
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
        Alert.alert('Rapport imprimé', 'Le rapport journalier a été envoyé à l\'imprimante.');
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
        title: 'Rupture de stock',
        message: `${p.name} est épuisé`,
        data: { ...p, critical: true },
      });
    });
    
    // Add low stock warnings
    lowStockItems.forEach(p => {
      stockNotifications.push({
        id: `stock-${p.id}`,
        type: 'low_stock' as const,
        title: 'Stock bas',
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
          title: 'Dépenses du jour',
          message: `Total: ${Math.round(total)} DH (${expenses.length} dépense${expenses.length > 1 ? 's' : ''})`,
          data: { total, count: expenses.length },
        }];
      });
    }
  };

  // ========== SESSION / CAISSE MANAGEMENT ==========
  const loadCurrentSession = async () => {
    if (!user?.id) return;
    try {
      const session = await shiftService.getUserOpenShift(user.id);
      setCurrentSession(session);
    } catch (error) {
      console.log('No open session found');
      setCurrentSession(null);
    }
  };

  const handleOpenSession = async () => {
    if (!user?.id) return;
    const amount = parseFloat(sessionOpeningAmount) || 0;
    
    try {
      const session = await shiftService.openShift({
        userId: user.id,
        openingAmount: amount,
        notes: `Ouvert par ${user.name}`,
      });
      setCurrentSession(session);
      setSessionOpeningAmount('');
      setShowSessionModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Caisse Ouverte', `Fond de caisse: ${amount.toFixed(0)} DH`);
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'ouvrir la caisse');
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession?.id) return;
    const closingAmount = parseFloat(sessionClosingAmount) || 0;
    
    try {
      const closedSession = await shiftService.closeShift({
        shiftId: currentSession.id,
        closingAmount,
        notes: `Fermé par ${user?.name}`,
      });
      
      // Calculate expected cash
      const expectedCash = (closedSession.openingAmount || 0) + (closedSession.cashSales || 0) - (closedSession.totalChangeGiven || 0) - todayExpenseTotal;
      const difference = closingAmount - expectedCash;
      
      setCurrentSession(null);
      setSessionClosingAmount('');
      setShowSessionModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show detailed closing report
      Alert.alert(
        'Caisse Fermée',
        `RAPPORT DE CLÔTURE\n\n` +
        `Fond ouverture: ${(closedSession.openingAmount || 0).toFixed(0)} DH\n` +
        `Ventes espèces: ${(closedSession.cashSales || 0).toFixed(0)} DH\n` +
        `Ventes carte: ${(closedSession.cardSales || 0).toFixed(0)} DH\n` +
        `Dépenses: -${todayExpenseTotal.toFixed(0)} DH\n` +
        `Monnaie rendue: -${(closedSession.totalChangeGiven || 0).toFixed(0)} DH\n\n` +
        `Attendu: ${expectedCash.toFixed(0)} DH\n` +
        `Compté: ${closingAmount.toFixed(0)} DH\n\n` +
        `Écart: ${difference >= 0 ? '+' : ''}${difference.toFixed(0)} DH\n\n` +
        `${closedSession.totalOrders || 0} commandes`
      );
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de fermer la caisse');
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
        category: expenseCategory.id,
        description: expenseDescription.trim() || undefined,
        createdBy: user?.name,
      });
      
      await loadTodayExpenses();
      setExpenseAmount('');
      setExpenseDescription('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show success with updated total
      const newTotal = await offlineExpenseService.getTodayTotal();
      Alert.alert('Dépense ajoutée', `${amount.toFixed(0)} DH - Total du jour: ${Math.round(newTotal)} DH`);
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

  // Update note for a specific cart item
  const updateItemNote = (productId: string, note: string) => {
    setCart(prev => prev.map(item => 
      item.productId === productId ? { ...item, note } : item
    ));
  };

  const clearCart = () => {
    // Safety confirmation for non-empty cart
    if (cart.length === 0) return;
    
    Alert.alert(
      'Vider le panier',
      `Voulez-vous vraiment vider le panier ? (${cart.reduce((s, i) => s + i.quantity, 0)} articles)`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, vider',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch {}
            setCart([]);
            setSelectedTable(0);
            setCurrentOrderId(null);
          },
        },
      ]
    );
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
        note: item.note || undefined,
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
      
      // Reset cart state directly (don't use clearCart which has confirmation)
      setCart([]);
      setSelectedTable(0);
      setCurrentOrderId(null);
      
      await loadPendingOrders();
      await loadTodayOrders();
      
      Alert.alert('En attente', `Table ${selectedTable === 0 ? 'Comptoir' : selectedTable} - ${total.toFixed(0)} DH`);
      
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
      note: item.note || '',
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
  const handlePrintReceipt = async (order: OfflineOrder): Promise<boolean> => {
    console.log('[PRINT_RECEIPT] Starting for order:', order.id);
    
    // P0 FIX: Block printing empty orders
    if (!order.items || order.items.length === 0) {
      Alert.alert('Erreur', 'Impossible d\'imprimer un reçu sans articles.');
      return false;
    }
    
    // P0 FIX: Block printing zero-amount orders
    if (order.totalAmount <= 0) {
      Alert.alert('Erreur', 'Impossible d\'imprimer un reçu avec un montant de 0 DH.');
      return false;
    }
    
    setPrinting(true);
    try {
      // Initialize PrinterService and check connection
      console.log('[PRINT_RECEIPT] Initializing PrinterService...');
      await PrinterService.initialize();
      const status = await PrinterService.checkConnection();
      console.log('[PRINT_RECEIPT] Connection status:', status);
      
      if (!status) {
        Alert.alert('Imprimante non configurée', 'Allez dans Paramètres > Imprimante pour scanner et connecter une imprimante.');
        return false;
      }
      
      // Load saved receipt design settings
      const design = await loadReceiptDesign();
      console.log('[PRINT_RECEIPT] Design loaded:', design.restaurantName);
      
      // Use the order's actual order_number from SQLite (same as UI shows)
      const orderNumber = order.orderNumber || 0;
      
      const receiptData: PrinterReceiptData = {
        // Header - use design settings
        restaurantName: design.restaurantName || 'CaissaPro',
        address: design.address || '',
        city: design.city || '',
        phone: design.phone || '',
        taxId: design.showTaxId ? design.taxId : '',
        
        // Order info
        orderId: order.id,
        orderNumber: orderNumber,
        tableNumber: order.tableNumber || 0,
        waiterName: user?.name || 'Caissier',
        date: order.createdAt.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        
        // Items
        items: order.items.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
          note: item.note || undefined,
        })),
        
        // Totals
        subtotal: order.totalAmount + order.discount,
        discount: order.discount,
        tax: 0,
        total: order.totalAmount,
        
        // Payment
        paymentMethod: order.paymentMethod === 'cash' ? 'Espèces' : (order.paymentMethod === 'card' ? 'Carte' : ''),
        amountReceived: order.amountReceived || 0,
        change: order.changeAmount || 0,
        
        // Footer
        footerMessage: design.footerMessage || 'Merci de votre visite!',
        
        // Display options from design settings
        showOrderNumber: design.showOrderNumber,
        showTableNumber: design.showTableNumber,
        showWaiterName: design.showWaiterName,
        showDateTime: design.showDateTime,
        showPaymentDetails: design.showPaymentDetails,
        showSubtotal: design.showSubtotal !== false,
        showTotal: design.showTotal !== false,
        showFooter: design.showFooter !== false,
        
        // Formatting options from design settings
        paperWidth: design.paperWidth,
        boldTotal: design.boldTotal !== false,
        separatorStyle: design.separatorStyle || 'dash',
        centerHeader: design.centerHeader !== false,
        autoCut: design.autoCut !== false,
      };
      
      console.log('[PRINT_RECEIPT] Receipt data prepared:', {
        restaurantName: receiptData.restaurantName,
        orderId: receiptData.orderId,
        itemsCount: receiptData.items.length,
        total: receiptData.total,
        tableNumber: receiptData.tableNumber,
      });
      
      console.log('[PRINT_RECEIPT] Calling PrinterService.printReceipt()...');
      const success = await PrinterService.printReceipt(receiptData);
      console.log('[PRINT_RECEIPT] Print result:', success ? 'SUCCESS' : 'FAILED');
      
      if (success) {
        await offlineOrderService.markPrinted(order.id);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        return true;
      } else {
        Alert.alert('Erreur d\'impression', 'Échec de l\'impression. Vérifiez la connexion.');
        return false;
      }
      
    } catch (error) {
      console.error('[PRINT_RECEIPT] ❌ Error:', error);
      Alert.alert('Erreur d\'impression', 'Vérifiez la connexion de l\'imprimante');
      return false;
    } finally {
      setPrinting(false);
    }
  };

  // Calculate totals - simplified for speed
  const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const received = parseFloat(amountReceived || '0') || 0;
  const change = Math.max(0, received - total);

  // Quick Exact Cash Payment - bypasses state timing issues
  const handleExactCashPayment = async () => {
    if (paymentProcessing || cart.length === 0 || total <= 0) return;
    
    // Directly process payment with exact amount
    setPaymentProcessing(true);
    
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
            setPaymentProcessing(false);
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
        note: item.note || undefined,
      }));
      
      const newOrder = await offlineOrderService.create({
        id: orderId,
        tableNumber: selectedTable,
        status: 'PAID',
        totalAmount: total,
        paymentMethod: 'cash',
        discount: 0,
        discountType: 'amount',
        amountReceived: total,
        changeAmount: 0,
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
      
      // Open cash drawer
      try {
        const autoOpenDrawer = await offlineSettingsService.get('auto_open_drawer');
        const printerConnected = await PrinterService.checkConnection();
        
        if (autoOpenDrawer !== 'false' && printerConnected) {
          await openCashDrawerNative();
        }
      } catch (drawerError) {
        console.error('[CASH_DRAWER] Error:', drawerError);
      }
      
      // Auto-print receipt if enabled
      try {
        const autoPrintEnabled = await offlineSettingsService.get('auto_print_receipt');
        const printerConnected = await PrinterService.checkConnection();
        
        if (autoPrintEnabled === 'true' && printerConnected) {
          await handlePrintReceipt(newOrder);
        }
      } catch (printError) {
        console.error('[AUTO_PRINT] Error:', printError);
      }
      
      // Reset
      setCart([]);
      setAmountReceived('');
      setSelectedTable(0);
      setCurrentOrderId(null);
      setShowPaymentModal(false);
      
      // Reload data
      await loadTodayOrders();
      await loadPendingOrders();
      await reloadProducts();
      
      Alert.alert('Paiement réussi', `${total.toFixed(0)} DH - Montant exact`);
      
    } catch (error) {
      console.error('Exact payment error:', error);
      Alert.alert('Erreur', 'Erreur lors du paiement');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Quick Card Payment - one tap card payment
  const handleQuickCardPayment = async () => {
    if (paymentProcessing || cart.length === 0 || total <= 0) return;
    
    setPaymentProcessing(true);
    
    try {
      // Validate stock
      for (const cartItem of cart) {
        const product = products.find(p => p.id === cartItem.productId);
        if (product && product.stockQuantity !== undefined && product.stockQuantity >= 0) {
          if (cartItem.quantity > product.stockQuantity) {
            Alert.alert(
              'Stock insuffisant',
              `${cartItem.productName}: demandé ${cartItem.quantity}, disponible ${product.stockQuantity}`,
            );
            setPaymentProcessing(false);
            return;
          }
        }
      }
      
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
        note: item.note || undefined,
      }));
      
      const newOrder = await offlineOrderService.create({
        id: orderId,
        tableNumber: selectedTable,
        status: 'PAID',
        totalAmount: total,
        paymentMethod: 'card',
        discount: 0,
        discountType: 'amount',
        amountReceived: total,
        changeAmount: 0,
        createdAt: now,
        paidAt: now,
        items,
      });
      
      // Deduct stock
      for (const cartItem of cart) {
        const product = products.find(p => p.id === cartItem.productId);
        if (product && product.stockQuantity !== undefined && product.stockQuantity >= 0) {
          await offlineProductService.adjustStock(cartItem.productId, -cartItem.quantity);
        }
      }
      
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      
      // Auto-print receipt
      try {
        const autoPrintEnabled = await offlineSettingsService.get('auto_print_receipt');
        const printerConnected = await PrinterService.checkConnection();
        
        if (autoPrintEnabled === 'true' && printerConnected) {
          await handlePrintReceipt(newOrder);
        }
      } catch (printError) {
        console.error('[AUTO_PRINT] Error:', printError);
      }
      
      // Reset
      setCart([]);
      setAmountReceived('');
      setSelectedTable(0);
      setCurrentOrderId(null);
      setShowPaymentModal(false);
      
      await loadTodayOrders();
      await loadPendingOrders();
      await reloadProducts();
      
      Alert.alert('Paiement réussi', `${total.toFixed(0)} DH - Carte`);
      
    } catch (error) {
      console.error('Card payment error:', error);
      Alert.alert('Erreur', 'Erreur lors du paiement');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Payment
  const handlePayment = async () => {
    // P0 FIX: Prevent double-click payment
    if (paymentProcessing) {
      console.log('[PAYMENT] Blocked - already processing');
      return;
    }
    
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de payer');
      return;
    }
    
    // P0 FIX: Block zero-amount orders
    if (total <= 0) {
      Alert.alert('Montant invalide', 'Le total doit être supérieur à 0 DH');
      return;
    }
    
    if (paymentMethod === 'cash' && received < total) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      Alert.alert('Montant insuffisant', `Reçu: ${received.toFixed(0)} DH < Total: ${total.toFixed(0)} DH`);
      return;
    }
    
    // Lock payment processing
    setPaymentProcessing(true);
    
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
        note: item.note || undefined,
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
      
      // Open cash drawer for cash payments
      if (paymentMethod === 'cash') {
        try {
          const autoOpenDrawer = await offlineSettingsService.get('auto_open_drawer');
          const printerConnected = await PrinterService.checkConnection();
          
          if (autoOpenDrawer !== 'false' && printerConnected) {
            console.log('[CASH_DRAWER] Opening drawer for cash payment...');
            await openCashDrawerNative();
            console.log('[CASH_DRAWER] ✅ Drawer opened');
          }
        } catch (drawerError) {
          console.error('[CASH_DRAWER] Error opening drawer:', drawerError);
        }
      }
      
      // Auto-print receipt if enabled AND printer is connected
      try {
        const autoPrintEnabled = await offlineSettingsService.get('auto_print_receipt');
        console.log('[AUTO_PRINT] Setting auto_print_receipt =', autoPrintEnabled);
        
        const printerConnected = await PrinterService.checkConnection();
        console.log('[AUTO_PRINT] Printer connected =', printerConnected);
        console.log('[AUTO_PRINT] Order ID =', newOrder.id);
        console.log('[AUTO_PRINT] Items count =', newOrder.items.length);
        console.log('[AUTO_PRINT] Total =', newOrder.totalAmount);
        
        // Check both: user wants auto-print AND printer is connected
        if (autoPrintEnabled === 'true' && printerConnected) {
          console.log('[AUTO_PRINT] ✅ Starting auto-print for order:', newOrder.id);
          const printResult = await handlePrintReceipt(newOrder);
          console.log('[AUTO_PRINT] Print result =', printResult ? 'SUCCESS' : 'FAILED');
        } else {
          console.log('[AUTO_PRINT] ⏭️ Skipped:', { 
            autoPrintEnabled, 
            printerConnected,
            reason: !autoPrintEnabled || autoPrintEnabled !== 'true' 
              ? 'Auto-print disabled' 
              : 'Printer not connected'
          });
        }
      } catch (printError) {
        console.error('[AUTO_PRINT] ❌ Error:', printError);
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
        'Paiement réussi', 
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
    } finally {
      // P0 FIX: Always unlock payment processing
      setPaymentProcessing(false);
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
            // Keep landscape mode
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
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
      <SafeAreaView style={{ flex: 1 }}>
        <MacOSAppLoading
          appName="CaissaPro"
          icon={<Coffee size={40} color="#FFFFFF" />}
          message="Chargement des produits..."
          accentColor={colors.primary}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EDEDED' }}>
      {/* Unified Header - macOS Style */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#E8E8E8',
        borderBottomWidth: 1,
        borderBottomColor: '#C0C0C0',
        minHeight: 44,
      }}>
        {/* Left - Sales Stats */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#333333' }}>
              {Math.round(dailyStats.totalRevenue)} DH
            </Text>
            <Text style={{ fontSize: 10, color: '#666666' }}>
              {dailyStats.paidOrders} cmd
            </Text>
          </View>
          {todayExpenseTotal > 0 && (
            <View style={{ 
              backgroundColor: '#FAFAFA',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#D0D0D0',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#666666' }}>
                Net: {Math.round(dailyStats.totalRevenue - todayExpenseTotal)}
              </Text>
            </View>
          )}
          {/* Table Selector */}
          <TouchableOpacity
            onPress={() => setShowTableModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: selectedTable > 0 ? '#007AFF' : '#FFFFFF',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 4,
              gap: 4,
              borderWidth: 1,
              borderColor: selectedTable > 0 ? '#0066DD' : '#B8B8B8',
            }}
          >
            <Users size={12} color={selectedTable > 0 ? '#FFFFFF' : '#666666'} />
            <Text style={{ fontSize: 11, fontWeight: '500', color: selectedTable > 0 ? '#FFFFFF' : '#333333' }}>
              {selectedTable === 0 ? 'Comptoir' : `T${selectedTable}`}
            </Text>
          </TouchableOpacity>
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowPendingModal(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FF9500',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                gap: 4,
                borderWidth: 1,
                borderColor: '#E08600',
              }}
            >
              <Pause size={12} color="#FFFFFF" />
              <Text style={{ fontSize: 11, color: '#FFFFFF', fontWeight: '600' }}>
                {pendingOrders.length}
              </Text>
            </TouchableOpacity>
          )}
          {lowStockProducts.length > 0 && (
            <View style={{
              backgroundColor: '#FFF3CD',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#FFE69C',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '500', color: '#856404' }}>
                {lowStockProducts.length}
              </Text>
            </View>
          )}
        </View>
        
        {/* Center - Brand */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#4D4D4D' }}>
            CaissaPro
          </Text>
        </View>
        
        {/* Right - Toolbar Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
            {/* Session Button - macOS push button */}
            <TouchableOpacity
              onPress={() => setShowSessionModal(true)}
              style={{ 
                paddingHorizontal: 14,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: currentSession ? '#5CB85C' : '#FAFAFA',
                borderWidth: 1,
                borderColor: currentSession ? '#4CAE4C' : '#B0B0B0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 0.5 },
                shadowOpacity: 0.1,
                shadowRadius: 0.5,
              }}
            >
              <Text style={{ 
                fontSize: 12, 
                color: currentSession ? '#FFFFFF' : '#333333', 
                fontWeight: '400' 
              }}>
                {currentSession ? 'Caisse Ouverte' : 'Ouvrir Caisse'}
              </Text>
            </TouchableOpacity>
            
            {/* Stock - macOS icon button */}
            {hasPermission(user?.role as UserRole, 'view_stock') && (
              <TouchableOpacity
                onPress={() => setShowStockModal(true)}
                style={{ 
                  width: 32, 
                  height: 26, 
                  borderRadius: 4, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#FAFAFA',
                  borderWidth: 1,
                  borderColor: '#B0B0B0',
                  position: 'relative',
                }}
              >
                <Package size={16} color="#4D4D4D" />
                {lowStockProducts.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#FF3B30',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 9, color: '#FFFFFF', fontWeight: '700' }}>
                      {lowStockProducts.length > 9 ? '9+' : lowStockProducts.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* Expenses - macOS icon button */}
            {hasPermission(user?.role as UserRole, 'manage_expenses') && (
              <TouchableOpacity
                onPress={() => setShowExpensesModal(true)}
                style={{ 
                  width: 32, 
                  height: 26, 
                  borderRadius: 4, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#FAFAFA',
                  borderWidth: 1,
                  borderColor: '#B0B0B0',
                }}
              >
                <Wallet size={16} color="#4D4D4D" />
              </TouchableOpacity>
            )}
            
            {/* Notifications - macOS icon button */}
            <TouchableOpacity
              onPress={() => setShowNotificationPanel(true)}
              style={{ 
                width: 32, 
                height: 26, 
                borderRadius: 4, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: '#FAFAFA',
                borderWidth: 1,
                borderColor: '#B0B0B0',
                position: 'relative',
              }}
            >
              <Bell size={16} color="#4D4D4D" />
              {notifications.length > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: '#FF3B30',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 9, color: '#FFFFFF', fontWeight: '700' }}>
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Orders - macOS icon button */}
            {hasPermission(user?.role as UserRole, 'view_all_orders') && (
              <TouchableOpacity
                onPress={() => setShowOrdersModal(true)}
                style={{ 
                  width: 32, 
                  height: 26, 
                  borderRadius: 4, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#FAFAFA',
                  borderWidth: 1,
                  borderColor: '#B0B0B0',
                  position: 'relative',
                }}
              >
                <ClipboardList size={16} color="#4D4D4D" />
                {todayOrders.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    minWidth: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#007AFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 9, color: '#FFFFFF', fontWeight: '700' }}>
                      {todayOrders.length > 99 ? '99+' : todayOrders.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            
            {/* Report - macOS icon button */}
            {hasPermission(user?.role as UserRole, 'view_daily_report') && (
              <TouchableOpacity
                onPress={() => setShowAnalyticsDashboard(true)}
                style={{ 
                  width: 32, 
                  height: 26, 
                  borderRadius: 4, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#FAFAFA',
                  borderWidth: 1,
                  borderColor: '#B0B0B0',
                }}
              >
                <BarChart3 size={16} color="#4D4D4D" />
              </TouchableOpacity>
            )}
            
            {/* Settings - macOS icon button */}
            {hasPermission(user?.role as UserRole, 'access_admin_panel') && (
              <TouchableOpacity
                onPress={() => setShowAdminPanel(true)}
                style={{ 
                  width: 32, 
                  height: 26, 
                  borderRadius: 4, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#FAFAFA',
                  borderWidth: 1,
                  borderColor: '#B0B0B0',
                }}
              >
                <Settings size={16} color="#4D4D4D" />
              </TouchableOpacity>
            )}
            
            {/* Cash Drawer - macOS icon button */}
            {printerConnected && (
              <TouchableOpacity
                onPress={handleOpenCashDrawer}
                style={{ 
                  width: 32, 
                  height: 26, 
                  borderRadius: 4, 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#FAFAFA',
                  borderWidth: 1,
                  borderColor: '#B0B0B0',
                }}
              >
                <Inbox size={16} color="#4D4D4D" />
              </TouchableOpacity>
            )}
            
            {/* Printer Status - macOS style */}
            <TouchableOpacity
              onPress={() => setShowPrinterModal(true)}
              style={{ 
                width: 32, 
                height: 26, 
                borderRadius: 4, 
                alignItems: 'center', 
                justifyContent: 'center', 
                backgroundColor: printerConnected ? '#5CB85C' : '#FAFAFA',
                borderWidth: 1,
                borderColor: printerConnected ? '#4CAE4C' : '#B0B0B0',
              }}
            >
              {printerConnected ? (
                <BluetoothConnected size={16} color="#FFFFFF" />
              ) : (
                <Bluetooth size={16} color="#888888" />
              )}
            </TouchableOpacity>
            
            {/* Logout - macOS push button */}
            <TouchableOpacity
              onPress={handleLogout}
              style={{ 
                paddingHorizontal: 14,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: '#FAFAFA',
                borderWidth: 1,
                borderColor: '#B0B0B0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 0.5 },
                shadowOpacity: 0.1,
                shadowRadius: 0.5,
              }}
            >
              <Text style={{ fontSize: 12, color: '#333333', fontWeight: '400' }}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>

      <View style={{ flex: 1, flexDirection: isPhone ? 'column' : 'row' }}>
        {/* Products Section */}
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          {/* Search - macOS search field style */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 6,
            paddingHorizontal: 12,
            minHeight: isPhone ? 32 : 36,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: '#B8B8B8',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 1,
          }}>
            <Search size={14} color="#999999" />
            <TextInput
              style={{ 
                flex: 1, 
                paddingVertical: 8, 
                paddingHorizontal: 8, 
                fontSize: 13, 
                color: '#333333',
              }}
              placeholder="Rechercher..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999999"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
                <X size={14} color="#666666" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Categories - macOS segmented control style */}
          <View style={{ marginBottom: spacing.md }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 0, paddingRight: spacing.lg }}
            >
              {/* Segmented control container - macOS style */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: '#E0E0E0',
                borderRadius: 6,
                padding: 2,
                borderWidth: 1,
                borderColor: '#C8C8C8',
              }}>
              <TouchableOpacity
                onPress={() => setSelectedCategory('all')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 4,
                  backgroundColor: selectedCategory === 'all' ? '#FFFFFF' : 'transparent',
                  shadowColor: selectedCategory === 'all' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: selectedCategory === 'all' ? 0.15 : 0,
                  shadowRadius: 1,
                  gap: 4,
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: selectedCategory === 'all' ? '#333333' : '#666666',
                }}>
                  Tous
                </Text>
                <View style={{
                  backgroundColor: selectedCategory === 'all' ? '#E8E8E8' : '#D0D0D0',
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 8,
                }}>
                  <Text style={{ 
                    fontSize: 10, 
                    fontWeight: '600', 
                    color: '#666666',
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
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 4,
                      backgroundColor: selectedCategory === cat.id ? '#FFFFFF' : 'transparent',
                      shadowColor: selectedCategory === cat.id ? '#000' : 'transparent',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: selectedCategory === cat.id ? 0.15 : 0,
                      shadowRadius: 1,
                      gap: 4,
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: selectedCategory === cat.id ? '#333333' : '#666666',
                    }}>
                      {cat.name}
                    </Text>
                    <View style={{
                      backgroundColor: selectedCategory === cat.id ? '#E8E8E8' : '#D0D0D0',
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                      borderRadius: 8,
                    }}>
                      <Text style={{ 
                        fontSize: 10, 
                        fontWeight: '600', 
                        color: '#666666',
                      }}>
                        {catProductCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              </View>
            </ScrollView>
          </View>

          {/* Products Grid - macOS card style */}
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
              const stockColor = isOutOfStock ? '#FF3B30' : isLowStock ? '#FF9500' : '#34C759';
              
              return (
                <AnimatedProductCard
                  onPress={() => addToCart(item)}
                  disabled={isOutOfStock}
                  width={ui.cardWidth}
                  height={ui.cardHeight}
                >
                  {/* Admin-style product card */}
                  <View style={{
                    flex: 1,
                    backgroundColor: isOutOfStock ? '#F5F5F5' : '#FFFFFF',
                    borderRadius: 10,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#CFCFCF',
                    opacity: isOutOfStock ? 0.7 : 1,
                  }}>
                    {/* Stock Badge - Top Right */}
                    {hasStockTracking && (
                      <View style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 10,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        backgroundColor: stockColor,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF' }}>
                          {isOutOfStock ? 'Épuisé' : item.stockQuantity}
                        </Text>
                      </View>
                    )}

                    {/* Product Image - Admin style */}
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={{
                          width: '100%',
                          height: 100,
                          backgroundColor: '#F5F5F5',
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ 
                        width: '100%', 
                        height: 100, 
                        backgroundColor: '#E8F8EB', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                      }}>
                        <Coffee size={36} color="#34C759" />
                      </View>
                    )}

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                      <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 100,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <View style={{
                          backgroundColor: colors.danger,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 4,
                        }}>
                          <Text style={{ 
                            color: '#FFFFFF', 
                            fontWeight: '700', 
                            fontSize: 11,
                          }}>
                            RUPTURE
                          </Text>
                        </View>
                      </View>
                    )}
                    
                    {/* Product Info - Admin style */}
                    <View style={{ padding: 10 }}>
                      <Text 
                        style={{ 
                          fontSize: 13, 
                          fontWeight: '600', 
                          color: '#1C1C1E',
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666666', marginTop: 2 }}>
                        {item.categoryName || 'Sans catégorie'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#34C759' }}>
                          {item.price.toFixed(0)} DH
                        </Text>
                        {isLowStock && !isOutOfStock && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <TrendingDown size={12} color="#FF9500" />
                            <Text style={{ fontSize: 10, color: '#FF9500', fontWeight: '600' }}>Stock bas</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </AnimatedProductCard>
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
            borderLeftColor: '#CFCFCF',
          }}>
            {/* Cart Header - macOS Style */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: '#E8E8E8',
              borderBottomWidth: 1,
              borderBottomColor: '#CFCFCF',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: '#007AFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ShoppingCart size={16} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>
                  Panier
                </Text>
                <View style={{ 
                  backgroundColor: '#007AFF', 
                  paddingHorizontal: 8, 
                  paddingVertical: 2, 
                  borderRadius: 10,
                  minWidth: 24,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </Text>
                </View>
              </View>
              {cart.length > 0 && (
                <TouchableOpacity 
                  onPress={clearCart} 
                  style={{ 
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: '#FFF5F5',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#E0B8B8',
                  }}
                >
                  <Trash2 size={16} color="#C62828" />
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
                          <Text style={{ fontSize: ui.text.sm, fontWeight: '600', color: colors.text }} numberOfLines={1}>
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
                                  <AlertTriangle size={14} color={colors.danger} />
                                  <Text style={{ fontSize: ui.text.xs, color: colors.danger, fontWeight: '600' }}>
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
                                  Stock: {product!.stockQuantity}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.productId, -1)}
                            style={{
                              width: 36,
                              height: 36,
                              backgroundColor: '#F5F5F5',
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: '#CFCFCF',
                            }}
                          >
                            <Minus size={16} color="#555555" />
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, fontWeight: '600', minWidth: 32, textAlign: 'center', color: '#1C1C1E' }}>
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.productId, 1)}
                            style={{
                              width: 36,
                              height: 36,
                              backgroundColor: '#F5F5F5',
                              borderRadius: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: '#CFCFCF',
                            }}
                          >
                            <Plus size={16} color="#007AFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {/* Per-item note input */}
                      <TextInput
                        value={item.note || ''}
                        onChangeText={(text) => updateItemNote(item.productId, text)}
                        placeholder="📝 Note (sans sucre, bien cuit...)"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          backgroundColor: colors.bgSecondary,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: item.note ? colors.warning : colors.borderLight,
                          padding: spacing.sm,
                          marginTop: spacing.sm,
                          fontSize: fontSize.xs,
                          color: colors.text,
                        }}
                      />
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
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.text }}>Total</Text>
                <Text style={{ fontSize: 32, fontWeight: '800', color: colors.primary }}>
                  {total.toFixed(0)} <Text style={{ fontSize: 20, fontWeight: '600' }}>DH</Text>
                </Text>
              </View>

              {/* Quick Payment Buttons - One Tap */}
              {cart.length > 0 && !paymentProcessing && (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  {/* Quick Exact Cash - One tap payment */}
                  <TouchableOpacity
                    onPress={handleExactCashPayment}
                    disabled={paymentProcessing}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#E8F5E9',
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#81C784',
                    }}
                  >
                    <Check size={18} color="#2E7D32" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#2E7D32' }}>Exact {total.toFixed(0)}</Text>
                  </TouchableOpacity>
                  
                  {/* Quick Card Payment - One tap */}
                  <TouchableOpacity
                    onPress={handleQuickCardPayment}
                    disabled={paymentProcessing}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#E3F2FD',
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: '#90CAF9',
                    }}
                  >
                    <CreditCard size={18} color="#1565C0" />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#1565C0' }}>Carte</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Detailed Payment - Opens modal for custom amount */}
              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setPaymentMethod('cash');
                    setAmountReceived('');
                    setShowPaymentModal(true);
                  }}
                  disabled={cart.length === 0}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: '#F5F5F5',
                    paddingVertical: 12,
                    borderRadius: 10,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: '#CFCFCF',
                  }}
                >
                  <Banknote size={16} color="#666666" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#666666' }}>Autre montant espèces...</Text>
                </TouchableOpacity>
              )}
              
              {/* Hold Button */}
              {cart.length > 0 && (
                <TouchableOpacity
                  onPress={holdOrder}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: '#FFF3E0',
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#FFCC80',
                  }}
                >
                  <Pause size={16} color="#E65100" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#E65100' }}>Mettre en attente</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Floating Cart Button for Phone - macOS Style */}
      {isPhone && (
        <TouchableOpacity
          onPress={() => setShowCartModal(true)}
          activeOpacity={0.9}
          style={{
            position: 'absolute',
            bottom: 24,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: cart.length > 0 ? '#007AFF' : '#65676B',
            paddingVertical: 14,
            paddingHorizontal: 20,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: cart.length > 0 ? '#006AE6' : '#555555',
            // Enhanced shadow for floating effect
            shadowColor: cart.length > 0 ? '#007AFF' : '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              width: 32, 
              height: 32, 
              borderRadius: 6, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ShoppingCart size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                {cart.length === 0 ? 'Panier vide' : `${cart.reduce((sum, i) => sum + i.quantity, 0)} article${cart.reduce((sum, i) => sum + i.quantity, 0) !== 1 ? 's' : ''}`}
              </Text>
              {cart.length > 0 && (
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                  Appuyez pour voir
                </Text>
              )}
            </View>
          </View>
          {total > 0 && (
            <View style={{ 
              backgroundColor: 'rgba(255,255,255,0.95)', 
              paddingHorizontal: 14, 
              paddingVertical: 6, 
              borderRadius: 6 
            }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#007AFF' }}>
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
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: height * 0.85,
          }}>
            {/* Cart Modal Header - macOS Style */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#E8E8E8',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#D0D0D0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: '#007AFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ShoppingCart size={16} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>
                  Panier
                </Text>
                <View style={{ 
                  backgroundColor: '#007AFF', 
                  paddingHorizontal: 8, 
                  paddingVertical: 2, 
                  borderRadius: 10,
                  minWidth: 24,
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {cart.length > 0 && (
                  <TouchableOpacity 
                    onPress={clearCart} 
                    style={{ 
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      backgroundColor: '#FFEBEB',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#FFCDD2',
                    }}
                  >
                    <Trash2 size={16} color="#FF3B30" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={() => setShowCartModal(false)} 
                  style={{ 
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    backgroundColor: '#E8E8E8',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#C8C8C8',
                  }}
                >
                  <X size={18} color="#666666" />
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
                  <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: '600' }}>Panier vide</Text>
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
                          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }} numberOfLines={1}>
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
                                  <AlertTriangle size={14} color={colors.danger} />
                                  <Text style={{ fontSize: fontSize.xs, color: colors.danger, fontWeight: '600' }}>
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
                                  Stock: {product!.stockQuantity}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.productId, -1)}
                            style={{
                              width: 36,
                              height: 36,
                              backgroundColor: '#E8E8E8',
                              borderRadius: 6,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: '#D0D0D0',
                            }}
                          >
                            <Minus size={18} color="#666666" />
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, fontWeight: '600', minWidth: 32, textAlign: 'center', color: '#1C1C1E' }}>
                            {item.quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => updateQuantity(item.productId, 1)}
                            style={{
                              width: 36,
                              height: 36,
                              backgroundColor: '#007AFF',
                              borderRadius: 6,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: '#006AE6',
                            }}
                          >
                            <Plus size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {/* Per-item note input for phone */}
                      <TextInput
                        value={item.note || ''}
                        onChangeText={(text) => updateItemNote(item.productId, text)}
                        placeholder="📝 Note (sans sucre, bien cuit...)"
                        placeholderTextColor="#999999"
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: item.note ? '#FFB74D' : '#D0D0D0',
                          padding: 8,
                          marginTop: 8,
                          fontSize: 12,
                          color: '#1C1C1E',
                        }}
                      />
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Cart Footer - macOS Style */}
            <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#D0D0D0', backgroundColor: '#F9F9F9' }}>
              {/* Total */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#1C1C1E' }}>Total</Text>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#007AFF' }}>{total.toFixed(0)} DH</Text>
              </View>
              
              {/* Quick Payment Row - Exact Cash & Quick Card */}
              {cart.length > 0 && !paymentProcessing && (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCartModal(false);
                      handleExactCashPayment();
                    }}
                    disabled={paymentProcessing}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#E8F5E9',
                      paddingVertical: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#81C784',
                    }}
                  >
                    <Check size={18} color="#2E7D32" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#2E7D32' }}>Exact {total.toFixed(0)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShowCartModal(false);
                      handleQuickCardPayment();
                    }}
                    disabled={paymentProcessing}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#E3F2FD',
                      paddingVertical: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#90CAF9',
                    }}
                  >
                    <CreditCard size={18} color="#1565C0" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1565C0' }}>Carte</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Detailed Payment Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
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
                    backgroundColor: cart.length === 0 ? '#D0D0D0' : '#F5F5F5',
                    paddingVertical: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#CFCFCF',
                  }}
                >
                  <Banknote size={18} color={cart.length === 0 ? '#999999' : '#2E7D32'} />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: cart.length === 0 ? '#999999' : '#2E7D32' }}>Espèces...</Text>
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
                    backgroundColor: cart.length === 0 ? '#D0D0D0' : '#F5F5F5',
                    paddingVertical: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#CFCFCF',
                  }}
                >
                  <CreditCard size={18} color={cart.length === 0 ? '#999999' : '#1565C0'} />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: cart.length === 0 ? '#999999' : '#1565C0' }}>Carte...</Text>
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
                    gap: 8,
                    backgroundColor: '#FFF3E0',
                    paddingVertical: 12,
                    borderRadius: 8,
                    marginTop: 12,
                    borderWidth: 1,
                    borderColor: '#FFCC80',
                  }}
                >
                  <Pause size={16} color="#E65100" />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#E65100' }}>Mettre en attente</Text>
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
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                width: '100%',
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#CFCFCF',
              }}>
            {/* Modal Header - macOS Style */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#E8E8E8',
              borderBottomWidth: 1,
              borderBottomColor: '#D0D0D0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: paymentMethod === 'cash' ? '#34C759' : '#007AFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {paymentMethod === 'cash' ? (
                    <Banknote size={16} color="#FFFFFF" />
                  ) : (
                    <CreditCard size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>
                  {paymentMethod === 'cash' ? 'Paiement Espèces' : 'Paiement Carte'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowPaymentModal(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#CFCFCF',
                }}
              >
                <X size={16} color="#666666" />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              {/* Total */}
              <View style={{
                backgroundColor: '#F8F8F8',
                borderRadius: 10,
                padding: 20,
                alignItems: 'center',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: '#E8E8E8',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Wallet size={16} color="#8E8E93" />
                  <Text style={{ fontSize: 14, color: '#8E8E93', fontWeight: '500' }}>À payer</Text>
                </View>
                <Text style={{ fontSize: 36, fontWeight: '700', color: '#1C1C1E' }}>
                  {Math.round(total)} <Text style={{ fontSize: 20, fontWeight: '600' }}>DH</Text>
                </Text>
              </View>

              {/* Cash payment specific */}
              {paymentMethod === 'cash' && (
                <>
                  {/* Amount received */}
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 }}>
                    Montant reçu
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#CFCFCF',
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 18,
                      fontWeight: '600',
                      textAlign: 'center',
                      marginBottom: 12,
                      color: '#1C1C1E',
                    }}
                    value={amountReceived}
                    onChangeText={setAmountReceived}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#C7C7CC"
                  />

                  {/* Quick amounts */}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {quickAmounts.map(amt => (
                      <TouchableOpacity
                        key={amt}
                        onPress={() => setAmountReceived(amt.toString())}
                        style={{
                          flex: 1,
                          backgroundColor: '#FFFFFF',
                          paddingVertical: 12,
                          borderRadius: 8,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: '#CFCFCF',
                        }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1C1C1E' }}>
                          {amt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => setAmountReceived(Math.ceil(total).toString())}
                      style={{
                        flex: 1,
                        backgroundColor: '#34C759',
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#2DB84D',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                        Exact
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Change */}
                  {received >= total && (
                    <View style={{
                      backgroundColor: '#FFF9E6',
                      borderRadius: 8,
                      padding: 12,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: '#FFD60A',
                    }}>
                      <Text style={{ fontSize: 14, color: '#996B00', fontWeight: '500' }}>Monnaie à rendre</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#996B00' }}>
                        {change.toFixed(0)} DH
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Confirm Button - macOS Style */}
              <TouchableOpacity
                onPress={handlePayment}
                disabled={paymentProcessing || (paymentMethod === 'cash' && received < total)}
                style={{
                  backgroundColor: paymentProcessing || (paymentMethod === 'cash' && received < total) ? '#E8E8E8' : '#007AFF',
                  paddingVertical: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: paymentProcessing || (paymentMethod === 'cash' && received < total) ? '#CFCFCF' : '#006AE6',
                }}
              >
                {paymentProcessing && (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                )}
                <Text style={{ 
                  fontSize: 15, 
                  fontWeight: '600', 
                  color: paymentProcessing || (paymentMethod === 'cash' && received < total) ? '#999999' : '#FFFFFF' 
                }}>
                  {paymentProcessing ? 'Traitement...' : 'Confirmer le paiement'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  </Modal>

      {/* Orders Tracking Modal - macOS Style Design */}
      <Modal
        visible={showOrdersModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowOrdersModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EDEDED' }}>
          {/* Header - macOS style */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            backgroundColor: '#E8E8E8',
            borderBottomWidth: 1,
            borderBottomColor: '#D0D0D0',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={22} color="#FF3B30" />
              </View>
              <View>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: '#333333' }}>
                  Commandes
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: '#666666' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setShowOrdersModal(false)}
              style={{ 
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: '#E8E8E8',
                borderWidth: 1,
                borderColor: '#C8C8C8',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} color="#666666" />
            </TouchableOpacity>
          </View>
          
          {/* Stats Cards Row - macOS card style */}
          <View style={{ 
            flexDirection: 'row', 
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            gap: spacing.md,
          }}>
            <TouchableOpacity 
              onPress={() => setOrdersFilter('paid')}
              style={{ 
                flex: 1, 
                backgroundColor: ordersFilter === 'paid' ? '#34C759' : '#FFFFFF',
                borderRadius: 6,
                padding: spacing.lg,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: ordersFilter === 'paid' ? '#2DB84D' : '#D0D0D0',
              }}
            >
              <View style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 22, 
                backgroundColor: ordersFilter === 'paid' ? 'rgba(255,255,255,0.3)' : '#E8F8EB', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
                <CheckCircle size={22} color={ordersFilter === 'paid' ? '#FFFFFF' : '#34C759'} />
              </View>
              <Text style={{ 
                fontSize: 26, 
                fontWeight: '700', 
                color: ordersFilter === 'paid' ? '#FFFFFF' : '#34C759' 
              }}>
                {todayOrders.filter(o => o.status === 'PAID').length}
              </Text>
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: ordersFilter === 'paid' ? 'rgba(255,255,255,0.9)' : '#666666',
                marginTop: 2,
              }}>
                Payées
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setOrdersFilter('pending')}
              style={{ 
                flex: 1, 
                backgroundColor: ordersFilter === 'pending' ? '#FF9500' : '#FFFFFF',
                borderRadius: 6,
                padding: spacing.lg,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: ordersFilter === 'pending' ? '#E68600' : '#D0D0D0',
              }}
            >
              <View style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 22, 
                backgroundColor: ordersFilter === 'pending' ? 'rgba(255,255,255,0.3)' : '#FFF4E5', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
                <Clock size={22} color={ordersFilter === 'pending' ? '#FFFFFF' : '#FF9500'} />
              </View>
              <Text style={{ 
                fontSize: 26, 
                fontWeight: '700', 
                color: ordersFilter === 'pending' ? '#FFFFFF' : '#FF9500' 
              }}>
                {pendingOrders.length}
              </Text>
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: ordersFilter === 'pending' ? 'rgba(255,255,255,0.9)' : '#666666',
                marginTop: 2,
              }}>
                En attente
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setOrdersFilter('all')}
              style={{ 
                flex: 1, 
                backgroundColor: ordersFilter === 'all' ? '#007AFF' : '#FFFFFF',
                borderRadius: 6,
                padding: spacing.lg,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: ordersFilter === 'all' ? '#0066DD' : '#D0D0D0',
              }}
            >
              <View style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 22, 
                backgroundColor: ordersFilter === 'all' ? 'rgba(255,255,255,0.3)' : '#E5F1FF', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: spacing.sm,
              }}>
                <Banknote size={22} color={ordersFilter === 'all' ? '#FFFFFF' : '#007AFF'} />
              </View>
              <Text style={{ 
                fontSize: 26, 
                fontWeight: '700', 
                color: ordersFilter === 'all' ? '#FFFFFF' : '#007AFF' 
              }}>
                {Math.round(dailyStats.totalRevenue).toLocaleString('fr-FR')}
              </Text>
              <Text style={{ 
                fontSize: fontSize.sm, 
                color: ordersFilter === 'all' ? 'rgba(255,255,255,0.9)' : '#666666',
                marginTop: 2,
              }}>
                DH Total
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Orders Grid Content */}
          <View style={{ flex: 1, backgroundColor: '#EDEDED' }}>
            {/* Search Bar - macOS style */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              marginHorizontal: spacing.lg,
              marginTop: spacing.lg,
              marginBottom: spacing.sm,
              borderRadius: 8,
              paddingHorizontal: spacing.md,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}>
              <Search size={18} color="#8E8E93" />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: spacing.sm,
                  fontSize: 14,
                  color: '#1C1C1E',
                }}
                placeholder="Rechercher par n° commande, table ou montant..."
                placeholderTextColor="#C7C7CC"
                value={ordersSearchQuery}
                onChangeText={setOrdersSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {ordersSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setOrdersSearchQuery('')}>
                  <X size={18} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
            
            <FlatList
              data={(() => {
                let orders = ordersFilter === 'pending' 
                  ? pendingOrders 
                  : ordersFilter === 'paid' 
                    ? todayOrders.filter(o => o.status === 'PAID')
                    : [...todayOrders, ...pendingOrders.filter(p => !todayOrders.find(t => t.id === p.id))];
                
                // 🔍 Apply search filter
                if (ordersSearchQuery.trim()) {
                  const query = ordersSearchQuery.toLowerCase().trim();
                  orders = orders.filter(order => {
                    // Search by order number
                    if (order.orderNumber?.toString().includes(query)) return true;
                    // Search by table number
                    if (order.tableNumber?.toString().includes(query)) return true;
                    // Search by amount
                    if (order.totalAmount.toString().includes(query)) return true;
                    // Search by product names
                    if (order.items.some(item => item.productName.toLowerCase().includes(query))) return true;
                    return false;
                  });
                }
                
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
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#CFCFCF',
                }}>
                  {/* Order Header */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    backgroundColor: item.status === 'PAID' ? '#E8F8EB' : '#FFF4E5',
                    borderBottomWidth: 1,
                    borderBottomColor: item.status === 'PAID' ? '#C8E6C9' : '#FFE0B2',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: item.status === 'PAID' ? '#81C784' : '#FFB74D',
                      }}>
                        <Text style={{ 
                          fontSize: 15, 
                          fontWeight: '700', 
                          color: item.status === 'PAID' ? '#2E7D32' : '#F57C00' 
                        }}>
                          {item.orderNumber || '-'}
                        </Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {item.tableNumber === 0 ? (
                            <Coffee size={14} color="#666666" />
                          ) : (
                            <Users size={14} color="#666666" />
                          )}
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1C1E' }}>
                            {item.tableNumber === 0 ? 'Comptoir' : `Table ${item.tableNumber}`}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                          {item.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    {item.status === 'PAID' ? (
                      <CheckCircle size={22} color="#34C759" />
                    ) : (
                      <Clock size={22} color="#FF9500" />
                    )}
                  </View>
                  
                  {/* Order Details */}
                  <View style={{ padding: spacing.md }}>
                    {/* Amount */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm }}>
                      <Text style={{ fontSize: 13, color: '#666666' }}>
                        {item.items.reduce((s, i) => s + i.quantity, 0)} article{item.items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''}
                      </Text>
                      <Text style={{ fontSize: 24, fontWeight: '700', color: '#1C1C1E' }}>
                        {Math.round(item.totalAmount)} <Text style={{ fontSize: 14, fontWeight: '600' }}>DH</Text>
                      </Text>
                    </View>
                    
                    {/* Payment Method */}
                    {item.paymentMethod && (
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: spacing.sm,
                        marginBottom: spacing.sm,
                      }}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: item.paymentMethod === 'cash' ? '#E8F8EB' : '#E5F1FF',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: item.paymentMethod === 'cash' ? '#C8E6C9' : '#90CAF9',
                        }}>
                          {item.paymentMethod === 'cash' ? (
                            <Banknote size={13} color="#2E7D32" />
                          ) : (
                            <CreditCard size={13} color="#1565C0" />
                          )}
                          <Text style={{ 
                            fontSize: 12, 
                            fontWeight: '600', 
                            color: item.paymentMethod === 'cash' ? '#2E7D32' : '#1565C0' 
                          }}>
                            {item.paymentMethod === 'cash' ? 'Espèces' : 'Carte'}
                          </Text>
                        </View>
                        {item.printed && (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#F5F5F5',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#E0E0E0',
                          }}>
                            <Printer size={13} color="#8E8E93" />
                            <Text style={{ fontSize: 12, color: '#8E8E93' }}>Imprimé</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  
                  {/* Action Buttons - macOS Style */}
                  <View style={{ 
                    flexDirection: 'row', 
                    borderTopWidth: 1, 
                    borderTopColor: '#E8E8E8',
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
                        gap: 6,
                        paddingVertical: 12,
                        minHeight: 48,
                        backgroundColor: '#FAFAFA',
                      }}
                    >
                      <Eye size={18} color="#007AFF" />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#007AFF' }}>Détails</Text>
                    </TouchableOpacity>
                    
                    <View style={{ width: 1, backgroundColor: '#E8E8E8' }} />
                    
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
                          gap: 6,
                          paddingVertical: 12,
                          minHeight: 48,
                          backgroundColor: item.printed ? '#FAFAFA' : '#E8F8EB',
                        }}
                      >
                        <Printer size={18} color={item.printed ? '#8E8E93' : '#34C759'} />
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '600', 
                          color: item.printed ? '#8E8E93' : '#34C759' 
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
                        gap: 6,
                        paddingVertical: 12,
                        minHeight: 48,
                        backgroundColor: '#F5F5F5',
                      }}>
                        <Lock size={16} color="#C7C7CC" />
                        <Text style={{ fontSize: 13, color: '#C7C7CC' }}>Admin</Text>
                      </View>
                    )}
                    
                    {/* Resume Button for Pending Orders */}
                    {item.status === 'PENDING' && (
                      <>
                        <View style={{ width: 1, backgroundColor: '#E8E8E8' }} />
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
                            gap: 6,
                            paddingVertical: 12,
                            minHeight: 48,
                            backgroundColor: '#FFF4E5',
                          }}
                        >
                          <Play size={18} color="#FF9500" />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#F57C00' }}>Reprendre</Text>
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
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    backgroundColor: '#F5F5F5',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.lg,
                    borderWidth: 1,
                    borderColor: '#E8E8E8',
                  }}>
                    <ClipboardList size={32} color="#C7C7CC" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '600', color: '#1C1C1E' }}>
                    Aucune commande
                  </Text>
                  <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 4 }}>
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
                borderRadius: 8, 
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
                        paddingVertical: isPhone ? 12 : 16,
                        borderBottomWidth: index < selectedOrderForReceipt.items.length - 1 ? 1 : 0,
                        borderBottomColor: '#F0F2F5',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      
                      {/* Item Note (if any) */}
                      {item.note && item.note.trim() && (
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          gap: 6, 
                          marginTop: 6, 
                          marginLeft: isPhone ? 36 : 48,
                        }}>
                          <Text style={{ fontSize: ui.text.xs, color: '#B8860B' }}>📝</Text>
                          <Text style={{ fontSize: ui.text.xs, color: '#8B7355', fontStyle: 'italic' }}>
                            {item.note}
                          </Text>
                        </View>
                      )}
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
          {/* Header - macOS Style */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingVertical: isPhone ? 12 : 16,
            paddingHorizontal: isPhone ? 16 : 24, 
            backgroundColor: '#E8E8E8', 
            borderBottomWidth: 1, 
            borderBottomColor: '#D0D0D0',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: '#007AFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Users size={18} color="#FFFFFF" />
              </View>
              <Text style={{ fontSize: ui.text.xl, fontWeight: '600', color: colors.text }}>Choisir Table</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTableModal(false)}
              style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 6, 
                backgroundColor: '#E8E8E8', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#D0D0D0',
              }}
            >
              <X size={16} color="#666666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: isPhone ? 16 : 24 }}>
            {/* Counter option - macOS Style Card */}
            <TouchableOpacity
              onPress={() => {
                setSelectedTable(0);
                setShowTableModal(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: isPhone ? 12 : 16,
                marginBottom: isPhone ? 16 : 20,
                backgroundColor: selectedTable === 0 ? '#007AFF' : '#FFFFFF',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: selectedTable === 0 ? '#0066DD' : '#D0D0D0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 2,
              }}
            >
              <View style={{ 
                width: isPhone ? 36 : 40, 
                height: isPhone ? 36 : 40, 
                borderRadius: 6, 
                backgroundColor: selectedTable === 0 ? 'rgba(255,255,255,0.2)' : '#E8F4FF', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Coffee size={isPhone ? 18 : 20} color={selectedTable === 0 ? '#FFFFFF' : '#007AFF'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: isPhone ? 15 : 16, 
                  fontWeight: '600', 
                  color: selectedTable === 0 ? '#FFFFFF' : colors.text 
                }}>
                  Comptoir
                </Text>
                <Text style={{ 
                  fontSize: isPhone ? 12 : 13, 
                  color: selectedTable === 0 ? 'rgba(255,255,255,0.8)' : colors.textSecondary 
                }}>
                  Vente à emporter
                </Text>
              </View>
              {selectedTable === 0 && (
                <View style={{ 
                  width: 24, 
                  height: 24, 
                  borderRadius: 6, 
                  backgroundColor: '#FFFFFF', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Check size={14} color="#007AFF" />
                </View>
              )}
            </TouchableOpacity>
            
            {/* Table section title */}
            <Text style={{ fontSize: ui.text.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tables
            </Text>
            
            {/* Table grid - macOS Style Cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isPhone ? 8 : 10 }}>
              {TABLES.map(table => (
                <TouchableOpacity
                  key={table}
                  onPress={() => {
                    setSelectedTable(table);
                    setShowTableModal(false);
                  }}
                  style={{
                    width: isPhone ? 70 : 80,
                    height: isPhone ? 70 : 80,
                    backgroundColor: selectedTable === table ? '#007AFF' : '#FFFFFF',
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: selectedTable === table ? '#0066DD' : '#D0D0D0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                  }}
                >
                  <Text style={{ 
                    fontSize: isPhone ? 20 : 24, 
                    fontWeight: '700', 
                    color: selectedTable === table ? '#FFFFFF' : colors.text 
                  }}>
                    {table}
                  </Text>
                  <Text style={{ 
                    fontSize: 10, 
                    color: selectedTable === table ? 'rgba(255,255,255,0.8)' : colors.textMuted,
                    marginTop: 2,
                  }}>
                    Table
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Pending Orders Modal - macOS Design */}
      <Modal
        visible={showPendingModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowPendingModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: isPhone ? 16 : 40,
        }}>
          <View style={{
            backgroundColor: '#F5F5F7',
            borderRadius: 12,
            width: '100%',
            maxWidth: isLargeTablet ? 680 : 520,
            maxHeight: '90%',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12,
          }}>
            {/* macOS Unified Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: isPhone ? 16 : 20,
              paddingVertical: isPhone ? 14 : 16,
              backgroundColor: '#FFFFFF',
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0,0,0,0.08)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ 
                  width: 38, 
                  height: 38, 
                  borderRadius: 10, 
                  backgroundColor: '#FFF2E0', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,149,0,0.2)',
                }}>
                  <Pause size={18} color="#FF9500" />
                </View>
                <View>
                  <Text style={{ fontSize: isPhone ? 17 : 18, fontWeight: '600', color: '#1D1D1F', letterSpacing: -0.3 }}>
                    En attente
                  </Text>
                  <Text style={{ fontSize: isPhone ? 12 : 13, color: '#86868B', marginTop: 1 }}>
                    {pendingOrders.length} commande{pendingOrders.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setShowPendingModal(false)}
                style={{ 
                  width: 28, 
                  height: 28, 
                  borderRadius: 14,
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={14} color="#86868B" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pendingOrders}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: isPhone ? 12 : 16 }}
              ItemSeparatorComponent={() => <View style={{ height: isPhone ? 10 : 12 }} />}
              showsVerticalScrollIndicator={false}
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
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  padding: isPhone ? 14 : 16,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.08)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  // Left accent border
                  borderLeftWidth: 4,
                  borderLeftColor: isUrgent ? '#FF453A' : '#FF9F0A',
                }}>
                  {/* Order Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPhone ? 8 : 10, flexWrap: 'wrap' }}>
                      {/* Order Number Badge */}
                      <View style={{
                        backgroundColor: isUrgent ? '#FF453A' : '#FF9F0A',
                        paddingHorizontal: isPhone ? 10 : 12,
                        paddingVertical: isPhone ? 5 : 6,
                        borderRadius: 6,
                      }}>
                        <Text style={{ fontSize: isPhone ? 13 : 14, fontWeight: '700', color: '#FFFFFF' }}>
                          #{item.orderNumber}
                        </Text>
                      </View>
                      {/* Table Badge */}
                      <View style={{
                        backgroundColor: '#F5F5F7',
                        paddingHorizontal: isPhone ? 10 : 12,
                        paddingVertical: isPhone ? 5 : 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: 'rgba(0,0,0,0.06)',
                      }}>
                        <Text style={{ fontSize: isPhone ? 12 : 13, fontWeight: '600', color: '#1D1D1F' }}>
                          {item.tableNumber === 0 ? 'Comptoir' : `Table ${item.tableNumber}`}
                        </Text>
                      </View>
                      {/* Time Badge */}
                      <View style={{
                        backgroundColor: isUrgent ? '#FFEBE9' : '#FFF4E5',
                        paddingHorizontal: isPhone ? 8 : 10,
                        paddingVertical: isPhone ? 4 : 5,
                        borderRadius: 5,
                      }}>
                        <Text style={{ 
                          fontSize: isPhone ? 11 : 12, 
                          fontWeight: '600', 
                          color: isUrgent ? '#FF453A' : '#C77800',
                        }}>
                          {timeDisplay}
                        </Text>
                      </View>
                    </View>
                    {/* Total Amount */}
                    <Text style={{ 
                      fontSize: isPhone ? 20 : 22, 
                      fontWeight: '700', 
                      color: '#1D1D1F',
                      letterSpacing: -0.5,
                    }}>
                      {Math.round(item.totalAmount)} <Text style={{ fontSize: isPhone ? 14 : 15, fontWeight: '600', color: '#86868B' }}>DH</Text>
                    </Text>
                  </View>
                  
                  {/* Items List */}
                  <View style={{ 
                    marginTop: isPhone ? 12 : 14, 
                    paddingTop: isPhone ? 12 : 14,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(0,0,0,0.05)',
                  }}>
                    {item.items.slice(0, 3).map((orderItem, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: isPhone ? 13 : 14, color: '#86868B', marginRight: 6 }}>•</Text>
                        <Text style={{ fontSize: isPhone ? 13 : 14, color: '#1D1D1F' }}>
                          {orderItem.quantity}x {orderItem.productName}
                        </Text>
                        {orderItem.note && (
                          <Text style={{ fontSize: isPhone ? 11 : 12, color: '#86868B', marginLeft: 6, fontStyle: 'italic' }}>
                            ({orderItem.note})
                          </Text>
                        )}
                      </View>
                    ))}
                    {item.items.length > 3 && (
                      <Text style={{ fontSize: isPhone ? 12 : 13, color: '#86868B', fontStyle: 'italic', marginTop: 2 }}>
                        +{item.items.length - 3} autres articles...
                      </Text>
                    )}
                  </View>
                  
                  {/* Action Buttons - macOS Style */}
                  <View style={{ flexDirection: 'row', gap: isPhone ? 8 : 10, marginTop: isPhone ? 14 : 16 }}>
                    {/* Encaisser - Primary Action */}
                    <TouchableOpacity
                      onPress={() => {
                        recallOrder(item);
                        setShowPendingModal(false);
                        setPaymentMethod('cash');
                        setAmountReceived(item.totalAmount.toString());
                        setShowPaymentModal(true);
                      }}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: '#007AFF',
                        paddingVertical: isPhone ? 11 : 13,
                        borderRadius: 8,
                        shadowColor: '#007AFF',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                      }}
                    >
                      <Banknote size={isPhone ? 16 : 18} color="#FFFFFF" />
                      <Text style={{ fontSize: isPhone ? 14 : 15, fontWeight: '600', color: '#FFFFFF' }}>Encaisser</Text>
                    </TouchableOpacity>
                    {/* Add More Items */}
                    <TouchableOpacity
                      onPress={() => recallOrder(item)}
                      activeOpacity={0.7}
                      style={{
                        width: isPhone ? 44 : 48,
                        height: isPhone ? 44 : 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#34C759',
                        borderRadius: 8,
                        shadowColor: '#34C759',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                      }}
                    >
                      <Plus size={isPhone ? 18 : 20} color="#FFFFFF" strokeWidth={2.5} />
                    </TouchableOpacity>
                    {/* Delete */}
                    <TouchableOpacity
                      onPress={() => cancelOrder(item.id)}
                      activeOpacity={0.7}
                      style={{
                        width: isPhone ? 44 : 48,
                        height: isPhone ? 44 : 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#FF453A',
                        borderRadius: 8,
                        shadowColor: '#FF453A',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                      }}
                    >
                      <Trash2 size={isPhone ? 16 : 18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              );}}
              ListEmptyComponent={() => (
                <View style={{ padding: isPhone ? 48 : 64, alignItems: 'center' }}>
                  <View style={{
                    width: isPhone ? 72 : 88,
                    height: isPhone ? 72 : 88,
                    borderRadius: 22,
                    backgroundColor: '#FFF2E0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,149,0,0.15)',
                  }}>
                    <Pause size={isPhone ? 32 : 40} color="#FF9500" />
                  </View>
                  <Text style={{ fontSize: isPhone ? 16 : 17, fontWeight: '600', color: '#1D1D1F', marginBottom: 6 }}>
                    Aucune commande
                  </Text>
                  <Text style={{ fontSize: isPhone ? 13 : 14, color: '#86868B' }}>
                    Les commandes en attente apparaîtront ici
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EDEDED' }}>
          {/* Header - macOS style */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: '#E8E8E8',
            borderBottomWidth: 1,
            borderBottomColor: '#D0D0D0',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={22} color="#007AFF" />
              </View>
              <View>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: '#333333' }}>
                  Rapport du jour
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: '#666666' }}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setShowReportModal(false)}
              style={{ 
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: '#E8E8E8',
                borderWidth: 1,
                borderColor: '#C8C8C8',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} color="#666666" />
            </TouchableOpacity>
          </View>
          
          {/* Hero Revenue Card - macOS card style */}
          <View style={{
            marginHorizontal: spacing.lg,
            marginVertical: spacing.md,
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            padding: spacing.xl,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#D0D0D0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
          }}>
            <Text style={{ fontSize: fontSize.sm, color: '#666666', marginBottom: spacing.xs }}>
              Chiffre d'affaires
            </Text>
            <Text style={{ fontSize: 48, fontWeight: '700', color: '#007AFF' }}>
              {Math.round(dailyStats.totalRevenue).toLocaleString('fr-FR')}
            </Text>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: '#666666' }}>
              DH
            </Text>
            
            {/* Quick stats row */}
            <View style={{ 
              flexDirection: 'row', 
              marginTop: spacing.lg,
              gap: spacing.xl,
            }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.xs, color: '#999999' }}>Commandes</Text>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: '#333333' }}>
                  {dailyStats.paidOrders}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: '#E0E0E0' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.xs, color: '#999999' }}>Panier moyen</Text>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: '#333333' }}>
                  {dailyStats.paidOrders > 0 ? Math.round(dailyStats.totalRevenue / dailyStats.paidOrders) : 0}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: '#E0E0E0' }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.xs, color: '#999999' }}>En attente</Text>
                <Text style={{ fontSize: fontSize.xxl, fontWeight: '700', color: pendingOrders.length > 0 ? '#FF9500' : '#333333' }}>
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
                borderRadius: 8,
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
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.text }}>
                  {Math.round(dailyStats.cashRevenue).toLocaleString('fr-FR')} <Text style={{ fontSize: fontSize.sm }}>DH</Text>
                </Text>
              </View>
              
              <View style={{ 
                flex: 1,
                backgroundColor: colors.white,
                borderRadius: 8,
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
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.text }}>
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
              borderRadius: 8,
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
                <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: colors.danger }}>
                  -{Math.round(todayExpenseTotal).toLocaleString('fr-FR')} DH
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: colors.text }}>Bénéfice net</Text>
                <Text style={{ 
                  fontSize: fontSize.xxl, 
                  fontWeight: '800', 
                  color: (dailyStats.totalRevenue - todayExpenseTotal) >= 0 ? colors.success : colors.danger 
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
                  borderRadius: 8,
                  padding: spacing.lg,
                  marginBottom: spacing.xl,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.warning,
                  ...shadows.sm,
                }}>
                  {lowStockProducts.filter(p => p.stockQuantity === 0).length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
                      <Text style={{ fontSize: fontSize.md, color: colors.danger, fontWeight: '600' }}>
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
                  borderRadius: 6,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  borderWidth: 1,
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
                borderRadius: 6,
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
        currentUserId={user?.id}
      />

      {/* Analytics Dashboard */}
      <AnalyticsDashboard
        visible={showAnalyticsDashboard}
        onClose={() => setShowAnalyticsDashboard(false)}
      />

      {/* Unified Printer Modal - Bluetooth/WiFi/USB */}
      <UnifiedPrinterModal
        visible={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
        onConnected={(device) => {
          setPrinterConnected(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* Stock Management Modal - macOS style */}
      <Modal visible={showStockModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowStockModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: '#EDEDED' }}>
            {/* Header - macOS style */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              paddingVertical: isPhone ? 14 : 18,
              paddingHorizontal: isPhone ? 16 : 24, 
              backgroundColor: '#E8E8E8', 
              borderBottomWidth: 1, 
              borderBottomColor: '#D0D0D0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={18} color="#007AFF" />
                </View>
                <View>
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: '#333333' }}>Gestion du Stock</Text>
                  <Text style={{ fontSize: ui.text.xs, color: '#666666' }}>
                    {allStockProducts.filter(p => p.stockQuantity >= 0).length} produits suivis
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowStockModal(false)}
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 6, 
                  backgroundColor: '#E8E8E8',
                  borderWidth: 1,
                  borderColor: '#C8C8C8', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <X size={16} color="#666666" />
              </TouchableOpacity>
            </View>
            
            {/* Search and Filter */}
            <View style={{ padding: isPhone ? 16 : 24, paddingBottom: 0 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: colors.white, 
                borderRadius: 8, 
                paddingHorizontal: isPhone ? 12 : 16,
                minHeight: isPhone ? 48 : 56,
                marginBottom: isPhone ? 12 : 16,
                ...shadows.sm,
              }}>
                <Search size={ui.iconSm} color={colors.textMuted} />
                <TextInput
                  style={{ flex: 1, padding: isPhone ? 12 : 16, fontSize: ui.text.md, color: colors.text }}
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
                    borderRadius: 6,
                    backgroundColor: stockViewMode === 'all' ? colors.primary : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: ui.text.sm, 
                    fontWeight: '600', 
                    color: stockViewMode === 'all' ? colors.white : colors.text 
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
                    borderRadius: 6,
                    backgroundColor: stockViewMode === 'low' ? colors.warning : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ 
                    fontSize: ui.text.sm, 
                    fontWeight: '600', 
                    color: stockViewMode === 'low' ? colors.white : colors.text 
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
                  borderRadius: 8,
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
                    borderRadius: 8,
                    borderLeftWidth: 4,
                    borderLeftColor: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.success,
                    ...shadows.sm,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isPhone ? 12 : 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.text }}>{item.name}</Text>
                        <Text style={{ fontSize: ui.text.xs, color: colors.textSecondary, marginTop: 2 }}>
                          {item.categoryName} • Seuil: {item.lowStockThreshold}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: isPhone ? 12 : 16,
                        paddingVertical: isPhone ? 4 : 6,
                        borderRadius: 10,
                        backgroundColor: isOutOfStock ? '#FF3B30' : isLowStock ? '#FF9500' : '#34C759',
                      }}>
                        <Text style={{ fontSize: ui.text.xs, fontWeight: '600', color: '#FFFFFF' }}>
                          {isOutOfStock ? 'RUPTURE' : isLowStock ? 'BAS' : 'OK'}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Stock Controls */}
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: '#E8E8E8', 
                      borderRadius: 8, 
                      padding: isPhone ? 8 : 12,
                      borderWidth: 1,
                      borderColor: '#E0E0E0',
                    }}>
                      <TouchableOpacity
                        onPress={() => adjustProductStock(item.id, -1)}
                        style={{
                          width: isPhone ? 40 : 48,
                          height: isPhone ? 40 : 48,
                          borderRadius: 8,
                          backgroundColor: '#FF3B30',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: '#E62E25',
                        }}
                      >
                        <Minus size={ui.iconSm} color="#FFFFFF" />
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
                              color: colors.text,
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
                              color: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.text 
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
                          width: isPhone ? 40 : 48,
                          height: isPhone ? 40 : 48,
                          borderRadius: 8,
                          backgroundColor: '#34C759',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: '#2DB84D',
                        }}
                      >
                        <Plus size={ui.iconSm} color="#FFFFFF" />
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
                              borderRadius: 6,
                              backgroundColor: '#E5F1FF',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: '#CCE0FF',
                            }}
                          >
                            <Text style={{ fontSize: ui.text.xs, fontWeight: '600', color: '#007AFF' }}>+{n}</Text>
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
                      <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: colors.text, marginTop: 16 }}>Aucun produit</Text>
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

      {/* Expenses Modal - macOS style */}
      <Modal visible={showExpensesModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowExpensesModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: '#EDEDED' }}>
            {/* Header - macOS style */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              paddingVertical: isPhone ? 14 : 18,
              paddingHorizontal: isPhone ? 16 : 24, 
              backgroundColor: '#E8E8E8', 
              borderBottomWidth: 1, 
              borderBottomColor: '#D0D0D0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FFE5E5', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} color="#FF3B30" />
                </View>
                <View>
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: '#333333' }}>Dépenses</Text>
                  <Text style={{ fontSize: ui.text.sm, color: '#666666' }}>
                    Total aujourd&apos;hui: {todayExpenseTotal} DH
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowExpensesModal(false)}
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 6, 
                  backgroundColor: '#E8E8E8',
                  borderWidth: 1,
                  borderColor: '#C8C8C8', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <X size={16} color="#666666" />
              </TouchableOpacity>
            </View>
            
            {/* Add Expense Form - macOS Style */}
            <View style={{ 
              backgroundColor: colors.white, 
              padding: isPhone ? 16 : 24, 
              margin: isPhone ? 16 : 24, 
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#D0D0D0', 
            }}>
              <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.text, marginBottom: isPhone ? 12 : 16 }}>
                Nouvelle dépense
              </Text>
              
              <View style={{ flexDirection: 'row', gap: isPhone ? 12 : 16, marginBottom: isPhone ? 12 : 16 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    padding: isPhone ? 12 : 16,
                    fontSize: ui.text.lg,
                    fontWeight: '600',
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: '#C0C0C0',
                    minHeight: isPhone ? 44 : 48,
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
                      key={cat.id}
                      onPress={() => setExpenseCategory(cat)}
                      style={{
                        paddingHorizontal: isPhone ? 12 : 16,
                        paddingVertical: isPhone ? 8 : 10,
                        minHeight: isPhone ? 36 : 40,
                        borderRadius: 6,
                        backgroundColor: expenseCategory.id === cat.id ? '#007AFF' : colors.background,
                        borderWidth: 1,
                        borderColor: expenseCategory.id === cat.id ? '#0066DD' : '#C0C0C0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ 
                        fontSize: ui.text.sm, 
                        fontWeight: '500', 
                        color: expenseCategory.id === cat.id ? '#FFFFFF' : colors.text 
                      }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 6,
                  padding: isPhone ? 12 : 16,
                  fontSize: ui.text.md,
                  color: colors.text,
                  borderWidth: 1,
                  borderColor: '#C0C0C0',
                  marginBottom: isPhone ? 12 : 16,
                  minHeight: isPhone ? 44 : 48,
                }}
                value={expenseDescription}
                onChangeText={setExpenseDescription}
                placeholder="Description (optionnel)"
                placeholderTextColor={colors.textMuted}
              />
              
              <TouchableOpacity
                onPress={addExpense}
                style={{
                  backgroundColor: '#FF3B30',
                  paddingVertical: isPhone ? 12 : 14,
                  minHeight: isPhone ? 44 : 48,
                  borderRadius: 6,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <TrendingDown size={ui.iconSm} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: ui.text.md }}>Ajouter Dépense</Text>
              </TouchableOpacity>
            </View>
            
            {/* Today's Expenses List */}
            <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.text, marginHorizontal: isPhone ? 16 : 24, marginBottom: isPhone ? 12 : 16 }}>
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
                  padding: isPhone ? 14 : 18,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#D0D0D0',
                }}>
                  <View style={{ 
                    width: isPhone ? 40 : 48, 
                    height: isPhone ? 40 : 48, 
                    borderRadius: 8, 
                    backgroundColor: '#FFE5E5', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    <Wallet size={ui.iconSm} color="#FF3B30" />
                  </View>
                  <View style={{ flex: 1, marginLeft: isPhone ? 12 : 16 }}>
                    <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.text }}>{item.category}</Text>
                    {item.description && (
                      <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 2 }}>{item.description}</Text>
                    )}
                    <Text style={{ fontSize: ui.text.xs, color: colors.textMuted, marginTop: 2 }}>
                      {item.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: colors.danger, marginRight: isPhone ? 12 : 16 }}>
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

      {/* Notification Panel Modal - macOS style */}
      <Modal visible={showNotificationPanel} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotificationPanel(false)}>
        <View style={{ flex: 1, backgroundColor: '#EDEDED' }}>
          {/* Header - macOS style */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingVertical: isPhone ? 14 : 18,
            paddingHorizontal: isPhone ? 16 : 24, 
            backgroundColor: '#E8E8E8', 
            borderBottomWidth: 1, 
            borderBottomColor: '#D0D0D0',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FFF4E5', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={18} color="#FF9500" />
              </View>
              <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: '#333333' }}>Notifications</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowNotificationPanel(false)}
              style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 6, 
                backgroundColor: '#E8E8E8',
                borderWidth: 1,
                borderColor: '#C8C8C8', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <X size={16} color="#666666" />
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
                  padding: isPhone ? 14 : 18,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#D0D0D0',
                }}
              >
                <View style={{ 
                  width: isPhone ? 40 : 48, 
                  height: isPhone ? 40 : 48, 
                  borderRadius: 8, 
                  backgroundColor: item.type === 'low_stock' ? '#FFF4E5' : '#FFE5E5', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  {item.type === 'low_stock' ? (
                    <AlertTriangle size={ui.iconSm} color="#FF9500" />
                  ) : (
                    <Wallet size={ui.iconSm} color="#FF3B30" />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: isPhone ? 12 : 16 }}>
                  <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.text }}>{item.title}</Text>
                  <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 2 }}>{item.message}</Text>
                </View>
                <ChevronRight size={ui.iconSm} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: isPhone ? 60 : 80 }}>
                <Bell size={ui.iconLg + 16} color={colors.border} />
                <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: colors.text, marginTop: 16 }}>Tout est en ordre!</Text>
                <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>
                  Aucune notification pour le moment.{'\n'}Nous vous alerterons en cas de stock bas.
                </Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Session / Caisse Modal - macOS style */}
      <Modal visible={showSessionModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSessionModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, backgroundColor: '#EDEDED' }}>
            {/* Header - macOS style */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              paddingVertical: isPhone ? 14 : 18,
              paddingHorizontal: isPhone ? 16 : 24, 
              backgroundColor: '#E8E8E8', 
              borderBottomWidth: 1, 
              borderBottomColor: '#D0D0D0',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  backgroundColor: currentSession ? '#E8F8EB' : '#E5F1FF', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  {currentSession ? <Lock size={18} color="#34C759" /> : <Inbox size={18} color="#007AFF" />}
                </View>
                <View>
                  <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: '#333333' }}>
                    {currentSession ? 'Clôturer Caisse' : 'Ouvrir Caisse'}
                  </Text>
                  <Text style={{ fontSize: ui.text.sm, color: '#666666' }}>
                    {currentSession 
                      ? `Ouverte depuis ${new Date(currentSession.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Aucune session active'
                    }
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowSessionModal(false)}
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 6, 
                  backgroundColor: '#E8E8E8',
                  borderWidth: 1,
                  borderColor: '#C8C8C8', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <X size={16} color="#666666" />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isPhone ? 16 : 24 }}>
              {currentSession ? (
                /* CLOSE SESSION VIEW */
                <View>
                  {/* Current Session Info - macOS Style */}
                  <View style={{ 
                    backgroundColor: '#E8F5E9', 
                    borderRadius: 8, 
                    padding: isPhone ? 14 : 18, 
                    marginBottom: isPhone ? 16 : 20,
                    borderWidth: 1,
                    borderColor: '#A5D6A7',
                  }}>
                    <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: '#1B5E20', marginBottom: 12 }}>
                      Résumé de la Session
                    </Text>
                    
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: ui.text.md, color: '#388E3C' }}>Fond d'ouverture:</Text>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#1B5E20' }}>
                          {(currentSession.openingAmount || 0).toFixed(0)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: ui.text.md, color: '#388E3C' }}>Ventes du jour:</Text>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#1B5E20' }}>
                          {Math.round(dailyStats.totalRevenue)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: ui.text.md, color: '#388E3C' }}>├─ Espèces:</Text>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#1B5E20' }}>
                          {Math.round(dailyStats.cashRevenue)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: ui.text.md, color: '#388E3C' }}>└─ Carte:</Text>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#1B5E20' }}>
                          {Math.round(dailyStats.cardRevenue)} DH
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: ui.text.md, color: '#FF3B30' }}>Dépenses:</Text>
                        <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: '#FF3B30' }}>
                          -{Math.round(todayExpenseTotal)} DH
                        </Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: '#C8E6C9', marginVertical: 8 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: '#1B5E20' }}>Attendu en caisse:</Text>
                        <Text style={{ fontSize: ui.text.lg, fontWeight: '700', color: '#1B5E20' }}>
                          {Math.round((currentSession.openingAmount || 0) + dailyStats.cashRevenue - todayExpenseTotal)} DH
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Closing Amount Input - macOS Style */}
                  <View style={{ 
                    backgroundColor: colors.white, 
                    borderRadius: 8, 
                    padding: isPhone ? 14 : 18,
                    borderWidth: 1,
                    borderColor: '#D0D0D0', 
                  }}>
                    <Text style={{ fontSize: ui.text.lg, fontWeight: '600', color: colors.text, marginBottom: 16 }}>
                      Comptez votre caisse
                    </Text>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <TextInput
                        style={{
                          flex: 1,
                          backgroundColor: colors.background,
                          borderRadius: 6,
                          padding: isPhone ? 14 : 18,
                          fontSize: ui.text.xxl,
                          fontWeight: '700',
                          color: colors.text,
                          borderWidth: 1,
                          borderColor: '#007AFF',
                          textAlign: 'center',
                        }}
                        value={sessionClosingAmount}
                        onChangeText={setSessionClosingAmount}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                      <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.textSecondary }}>DH</Text>
                    </View>
                    
                    {/* Quick Amount Buttons - macOS Style */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[500, 1000, 1500, 2000, 2500, 3000, 5000].map((amount) => (
                          <TouchableOpacity
                            key={amount}
                            onPress={() => setSessionClosingAmount(amount.toString())}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 6,
                              backgroundColor: sessionClosingAmount === amount.toString() ? '#007AFF' : colors.background,
                              borderWidth: 1,
                              borderColor: sessionClosingAmount === amount.toString() ? '#0066DD' : '#C0C0C0',
                            }}
                          >
                            <Text style={{ 
                              fontSize: ui.text.md, 
                              fontWeight: '600', 
                              color: sessionClosingAmount === amount.toString() ? '#FFFFFF' : colors.text 
                            }}>
                              {amount}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    
                    <TouchableOpacity
                      onPress={handleCloseSession}
                      style={{
                        backgroundColor: '#FF3B30',
                        paddingVertical: isPhone ? 12 : 16,
                        borderRadius: 6,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 10,
                      }}
                    >
                      <Lock size={ui.iconSm} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: ui.text.lg }}>
                        Clôturer la Caisse
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* OPEN SESSION VIEW - macOS Style */
                <View style={{ 
                  backgroundColor: colors.white, 
                  borderRadius: 8, 
                  padding: isPhone ? 16 : 24,
                  borderWidth: 1,
                  borderColor: '#D0D0D0', 
                }}>
                  <Text style={{ fontSize: ui.text.xl, fontWeight: '600', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
                    Ouvrir la Caisse
                  </Text>
                  <Text style={{ fontSize: ui.text.sm, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' }}>
                    Entrez le montant en caisse pour commencer la journée
                  </Text>
                  
                  <Text style={{ fontSize: ui.text.md, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Fond de caisse (DH)
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: colors.background,
                        borderRadius: 6,
                        padding: isPhone ? 14 : 18,
                        fontSize: ui.text.xxl,
                        fontWeight: '700',
                        color: colors.text,
                        borderWidth: 1,
                        borderColor: '#007AFF',
                        textAlign: 'center',
                      }}
                      value={sessionOpeningAmount}
                      onChangeText={setSessionOpeningAmount}
                      placeholder="500"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <Text style={{ fontSize: ui.text.xl, fontWeight: '700', color: colors.textSecondary }}>DH</Text>
                  </View>
                  
                  {/* Quick Amount Buttons - macOS Style */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                    {[0, 200, 300, 500, 1000].map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        onPress={() => setSessionOpeningAmount(amount.toString())}
                        style={{
                          paddingHorizontal: 18,
                          paddingVertical: 10,
                          borderRadius: 6,
                          backgroundColor: sessionOpeningAmount === amount.toString() ? '#007AFF' : colors.background,
                          borderWidth: 1,
                          borderColor: sessionOpeningAmount === amount.toString() ? '#0066DD' : '#C0C0C0',
                          minWidth: 64,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ 
                          fontSize: ui.text.md, 
                          fontWeight: '600', 
                          color: sessionOpeningAmount === amount.toString() ? '#FFFFFF' : colors.text 
                        }}>
                          {amount === 0 ? '0' : amount}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <TouchableOpacity
                    onPress={handleOpenSession}
                    style={{
                      backgroundColor: '#34C759',
                      paddingVertical: isPhone ? 12 : 16,
                      borderRadius: 6,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                  >
                    <Inbox size={ui.iconSm} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: ui.text.lg }}>
                      Ouvrir la Caisse
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* First-time user onboarding tutorial */}
      <OnboardingTutorial />
    </SafeAreaView>
  );
}
