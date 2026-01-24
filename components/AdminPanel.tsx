import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  useWindowDimensions,
  Image,
} from 'react-native';
import {
  X,
  Package,
  Grid3x3,
  Users,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronLeft,
  Eye,
  EyeOff,
  Check,
  Database,
  Coffee,
  Camera,
  ImageIcon,
  List,
  LayoutGrid,
  Search,
  Printer,
  Bluetooth,
  AlertTriangle,
  Minus,
  BluetoothConnected,
  Zap,
  Store,
  Smartphone,
  Crown,
  UtensilsCrossed,
  Wallet,
  CheckCircle,
  XCircle,
  Loader,
  CalendarDays,
  DollarSign,
  Percent,
  Bell,
  Volume2,
  VolumeX,
  Lock,
  Clock,
  Globe,
  ShieldCheck,
  Receipt,
  Banknote,
  Timer,
  Hash,
  Download,
  Upload,
  HardDrive,
  Share2,
} from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { spacing, borderRadius, fontSize } from '../lib/theme';
import { useAppTheme } from '../lib/themes/ThemeContext';
import {
  offlineCategoryService,
  offlineProductService,
  offlineUserService,
  offlineSettingsService,
  getSyncQueueCount,
  clearSyncQueue,
  OfflineUser,
} from '../lib/offline-db';
import { 
  discoverBluetoothDevices, 
  requestBluetoothPermissions,
  type BluetoothDevice,
  loadReceiptDesign,
  saveReceiptDesign,
  type ReceiptDesign,
} from '../lib/printing';
import { getDeviceFingerprint, LicenseService, LicenseState } from '../lib/license/index';
import { PrinterService, type PrinterState, type PrinterDevice } from '../lib/services/PrinterService';
import { UnifiedPrinterModal } from './UnifiedPrinterModal';
import { HistoryCalendar } from './HistoryCalendar';
import { LiveReceiptPreview } from './LiveReceiptPreview';
import { resetOnboarding } from './OnboardingTutorial';
import { BackupService } from '../lib/backup/BackupService';
import Constants from 'expo-constants';
// StaffManagement removed - shifts feature disabled

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  currentUserId?: string; // ID of the currently logged-in user
}

type AdminTab = 'menu' | 'products' | 'categories' | 'users' | 'settings';

interface Category {
  id: string;
  name: string;
  displayOrder: number;
  productCount?: number;
}

interface Product {
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

export default function AdminPanel({ visible, onClose, onDataChanged, currentUserId }: AdminPanelProps) {
  const { width } = useWindowDimensions();
  
  // Get dynamic theme colors
  const { colors } = useAppTheme();
  
  // Calculate responsive grid columns and card width
  const CARD_MIN_WIDTH = 150;
  const GRID_PADDING = 16;
  const GRID_GAP = 12;
  const availableWidth = width - (GRID_PADDING * 2);
  const numColumns = Math.max(2, Math.floor((availableWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)));
  const cardWidth = (availableWidth - (GRID_GAP * (numColumns - 1))) / numColumns;
  
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');
  const [loading, setLoading] = useState(false);
  
  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  
  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategoryId, setProductCategoryId] = useState('');
  const [productActive, setProductActive] = useState(true);
  const [productImageUrl, setProductImageUrl] = useState('');
  const [productStockQuantity, setProductStockQuantity] = useState('-1');
  const [productLowStockThreshold, setProductLowStockThreshold] = useState('10');
  const [trackStock, setTrackStock] = useState(false);
  const [productViewMode, setProductViewMode] = useState<'list' | 'grid'>('list');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Users
  const [users, setUsers] = useState<OfflineUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<OfflineUser | null>(null);
  const [userName, setUserName] = useState('');
  const [userPin, setUserPin] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | 'waiter'>('cashier');
  const [showPin, setShowPin] = useState(false);
  
  // Settings
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(true);
  
  // Business Settings
  const [currency, setCurrency] = useState('DH');
  const [taxRate, setTaxRate] = useState('0');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [serviceChargeRate, setServiceChargeRate] = useState('0');
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  
  // Order Settings
  const [requireTable, setRequireTable] = useState(true);
  const [requireWaiter, setRequireWaiter] = useState(false);
  const [allowDiscounts, setAllowDiscounts] = useState(true);
  const [maxDiscountPercent, setMaxDiscountPercent] = useState('100');
  const [orderNumberPrefix, setOrderNumberPrefix] = useState('');
  
  // Security Settings
  const [requirePinForRefund, setRequirePinForRefund] = useState(true);
  const [requirePinForDiscount, setRequirePinForDiscount] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  
  // Sound & Notification Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [newOrderSound, setNewOrderSound] = useState(true);
  const [paymentSound, setPaymentSound] = useState(true);
  
  // Printer State (using new PrinterService)
  const [printerState, setPrinterState] = useState<PrinterState>({
    status: 'disconnected',
    device: null,
    error: null,
    isInitialized: false,
  });
  const [availablePrinters, setAvailablePrinters] = useState<PrinterDevice[]>([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  
  // Legacy state (for backward compatibility)
  const [printerType, setPrinterType] = useState<'bluetooth' | 'wifi' | 'usb' | 'none'>('none');
  const [printerAddress, setPrinterAddress] = useState('');
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  
  // Bluetooth Discovery (legacy)
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  
  // Receipt Design
  const [showReceiptDesignModal, setShowReceiptDesignModal] = useState(false);
  // History Calendar
  const [showHistoryCalendar, setShowHistoryCalendar] = useState(false);
  // Staff management removed
  
  // License & Device Info
  const [deviceId, setDeviceId] = useState<string>('Loading...');
  const [licenseInfo, setLicenseInfo] = useState<LicenseState | null>(null);
  
  const [receiptDesign, setReceiptDesign] = useState<ReceiptDesign>({
    showLogo: false,
    restaurantName: 'CaissaPro',
    address: '',
    city: '',
    phone: '',
    taxId: '',
    footerMessage: 'Merci de votre visite!',
    footerMessageArabic: '',
    wifiPassword: '',
    showWifi: false,
    showTaxId: false,
    showOrderNumber: true,
    showTableNumber: true,
    showWaiterName: true,
    showDateTime: true,
    showPaymentDetails: true,
    showSubtotal: true,
    showTotal: true,
    showFooter: true,
    fontSize: 'normal',
    paperWidth: 80,
    boldTotal: true,
    separatorStyle: 'dash',
    centerHeader: true,
    autoCut: true,
  });

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Load data when tab changes
  useEffect(() => {
    if (visible) {
      loadDataForTab(activeTab);
      // Load device ID and license info
      loadDeviceInfo();
    }
  }, [activeTab, visible]);

  const loadDeviceInfo = async () => {
    try {
      const id = await getDeviceFingerprint();
      setDeviceId(id);
      const license = await LicenseService.getCachedState();
      setLicenseInfo(license);
    } catch (error) {
      console.error('Failed to load device info:', error);
    }
  };

  const loadDataForTab = async (tab: AdminTab) => {
    setLoading(true);
    try {
      switch (tab) {
        case 'categories':
          await loadCategories();
          break;
        case 'products':
          await loadCategories();
          await loadProducts();
          break;
        case 'users':
          await loadUsers();
          break;
        case 'settings':
          await loadSettings();
          break;
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    const cats = await offlineCategoryService.getAll();
    const catsWithCount: Category[] = [];
    for (const cat of cats) {
      const count = await offlineCategoryService.getProductCount(cat.id);
      catsWithCount.push({ ...cat, productCount: count });
    }
    setCategories(catsWithCount);
  };

  const loadProducts = async () => {
    const prods = await offlineProductService.getAllWithStock();
    setProducts(prods);
  };

  const loadUsers = async () => {
    const userList = await offlineUserService.getAll();
    setUsers(userList);
  };

  const loadSettings = async () => {
    const count = await getSyncQueueCount();
    setPendingSyncCount(count);
    
    const allSettings = await offlineSettingsService.getAll();
    setSettings(allSettings);
    setRestaurantName(allSettings['restaurant_name'] || '');
    setRestaurantAddress(allSettings['restaurant_address'] || '');
    setRestaurantPhone(allSettings['restaurant_phone'] || '');
    setAutoPrintReceipt(allSettings['auto_print_receipt'] === 'true');
    setAutoOpenDrawer(allSettings['auto_open_drawer'] !== 'false');
    
    // Business settings
    setCurrency(allSettings['currency'] || 'DH');
    setTaxRate(allSettings['tax_rate'] || '0');
    setTaxEnabled(allSettings['tax_enabled'] === 'true');
    setServiceChargeRate(allSettings['service_charge_rate'] || '0');
    setServiceChargeEnabled(allSettings['service_charge_enabled'] === 'true');
    
    // Order settings
    setRequireTable(allSettings['require_table'] !== 'false');
    setRequireWaiter(allSettings['require_waiter'] === 'true');
    setAllowDiscounts(allSettings['allow_discounts'] !== 'false');
    setMaxDiscountPercent(allSettings['max_discount_percent'] || '100');
    setOrderNumberPrefix(allSettings['order_number_prefix'] || '');
    
    // Security settings
    setRequirePinForRefund(allSettings['require_pin_refund'] !== 'false');
    setRequirePinForDiscount(allSettings['require_pin_discount'] === 'true');
    setSessionTimeout(allSettings['session_timeout'] || '30');
    
    // Sound settings
    setSoundEnabled(allSettings['sound_enabled'] !== 'false');
    setVibrationEnabled(allSettings['vibration_enabled'] !== 'false');
    setNewOrderSound(allSettings['new_order_sound'] !== 'false');
    setPaymentSound(allSettings['payment_sound'] !== 'false');
    
    // Load receipt design
    const savedDesign = await loadReceiptDesign();
    if (savedDesign) {
      setReceiptDesign(savedDesign);
    }
    
    // Initialize PrinterService and get state
    await PrinterService.initialize();
    const state = PrinterService.getState();
    setPrinterState(state);
    setPrinterConnected(state.status === 'connected');
    setConnectedPrinterName(state.device?.name || null);
    
    // Get config for UI
    const config = PrinterService.getConfig();
    setPrinterType(config.type);
    setPrinterAddress(config.deviceAddress);
  };

  // Subscribe to printer state changes
  useEffect(() => {
    const unsubscribe = PrinterService.subscribe((state) => {
      setPrinterState(state);
      setPrinterConnected(state.status === 'connected');
      setConnectedPrinterName(state.device?.name || null);
    });
    return () => unsubscribe();
  }, []);

  // Scan for printers
  const scanForPrinters = async () => {
    setScanningPrinters(true);
    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert('Permission requise', 'Autorisez le Bluetooth pour scanner les imprimantes.');
        return;
      }
      
      const devices = await PrinterService.getBluetoothDevices();
      setAvailablePrinters(devices);
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Erreur', 'Impossible de scanner les imprimantes.');
    } finally {
      setScanningPrinters(false);
    }
  };

  // Connect to printer
  const connectToPrinter = async (device: PrinterDevice) => {
    const success = await PrinterService.connect(device);
    if (success) {
      setShowPrinterModal(false);
      Alert.alert('Connecté', `Imprimante ${device.name} connectée.`);
      
      // Save config
      await PrinterService.saveConfig({
        type: device.type,
        deviceName: device.name,
        deviceAddress: device.address,
        autoPrint: autoPrintReceipt,
      });
    } else {
      Alert.alert('Échec', 'Impossible de se connecter à l\'imprimante.');
    }
  };

  // Test print
  const handleTestPrint = async () => {
    const success = await PrinterService.printTestPage();
    if (success) {
      Alert.alert('Succès', 'Page de test imprimée!');
    }
  };

  // Bluetooth scanning (legacy)
  const scanForBluetoothDevices = async () => {
    setScanningBluetooth(true);
    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission requise',
          'Veuillez autoriser l\'accès au Bluetooth dans les paramètres de votre téléphone.'
        );
        return;
      }
      
      const devices = await discoverBluetoothDevices();
      setBluetoothDevices(devices);
      
      // The discoverBluetoothDevices function now shows helpful instructions
      // so we don't need to show another alert here
    } catch (error) {
      console.error('Bluetooth scan error:', error);
      Alert.alert('Erreur', 'Impossible de scanner les appareils Bluetooth');
    } finally {
      setScanningBluetooth(false);
    }
  };

  const selectBluetoothDevice = (device: BluetoothDevice) => {
    if (!device.address) {
      Alert.alert('Erreur', 'Cet appareil n\'a pas d\'adresse valide');
      return;
    }
    setPrinterAddress(device.address);
    setShowBluetoothModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Appareil sélectionné', `${device.name}\n${device.address}`);
  };

  // Save receipt design
  const handleSaveReceiptDesign = async () => {
    try {
      await saveReceiptDesign(receiptDesign);
      setShowReceiptDesignModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sauvegardé', 'Le design du reçu a été sauvegardé.');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le design');
    }
  };

  // ==================== CATEGORIES ====================

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom');
      return;
    }

    try {
      if (editingCategory) {
        await offlineCategoryService.update(editingCategory.id, { name: categoryName.trim() });
      } else {
        const id = await Crypto.randomUUID();
        await offlineCategoryService.create({
          id,
          name: categoryName.trim(),
          displayOrder: categories.length + 1,
        });
      }
      
      await loadCategories();
      setShowCategoryModal(false);
      onDataChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Save category error:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const deleteCategory = (cat: Category) => {
    if ((cat.productCount || 0) > 0) {
      Alert.alert('Erreur', `Cette catégorie contient ${cat.productCount} produits. Supprimez-les d'abord.`);
      return;
    }

    Alert.alert('Supprimer', `Supprimer "${cat.name}"?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await offlineCategoryService.delete(cat.id);
          await loadCategories();
          onDataChanged();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  // ==================== PRODUCTS ====================

  const openAddProduct = () => {
    if (categories.length === 0) {
      Alert.alert('Erreur', 'Créez d\'abord une catégorie');
      return;
    }
    setEditingProduct(null);
    setProductName('');
    setProductPrice('');
    setProductCategoryId(categories[0]?.id || '');
    setProductActive(true);
    setProductImageUrl('');
    setTrackStock(false);
    setProductStockQuantity('-1');
    setProductLowStockThreshold('10');
    setShowProductModal(true);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductName(prod.name);
    setProductPrice(String(prod.price));
    setProductCategoryId(prod.categoryId);
    setProductActive(prod.isActive);
    setProductImageUrl(prod.imageUrl || '');
    setTrackStock(prod.stockQuantity >= 0);
    setProductStockQuantity(prod.stockQuantity >= 0 ? String(prod.stockQuantity) : '-1');
    setProductLowStockThreshold(String(prod.lowStockThreshold));
    setShowProductModal(true);
  };

  const pickProductImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Autorisation d\'accès à la galerie nécessaire');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProductImageUrl(result.assets[0].uri);
    }
  };

  const takeProductPhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Autorisation d\'accès à la caméra nécessaire');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProductImageUrl(result.assets[0].uri);
    }
  };

  const saveProduct = async () => {
    if (!productName.trim() || !productPrice.trim() || !productCategoryId) {
      Alert.alert('Erreur', 'Remplissez tous les champs');
      return;
    }

    const price = parseFloat(productPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Erreur', 'Prix invalide');
      return;
    }

    const stockQuantity = trackStock ? parseInt(productStockQuantity) || 0 : -1;
    const lowStockThreshold = parseInt(productLowStockThreshold) || 10;

    try {
      if (editingProduct) {
        await offlineProductService.update(editingProduct.id, {
          name: productName.trim(),
          price,
          categoryId: productCategoryId,
          isActive: productActive,
          imageUrl: productImageUrl || undefined,
        });
        // Update stock separately
        await offlineProductService.updateStock(editingProduct.id, stockQuantity);
        await offlineProductService.setLowStockThreshold(editingProduct.id, lowStockThreshold);
      } else {
        const id = await Crypto.randomUUID();
        await offlineProductService.create({
          id,
          name: productName.trim(),
          price,
          categoryId: productCategoryId,
          isActive: productActive,
          imageUrl: productImageUrl || undefined,
        });
        // Set stock for new product
        await offlineProductService.updateStock(id, stockQuantity);
        await offlineProductService.setLowStockThreshold(id, lowStockThreshold);
      }
      
      await loadProducts();
      await loadCategories();
      setShowProductModal(false);
      onDataChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Save product error:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const deleteProduct = (prod: Product) => {
    Alert.alert('Supprimer', `Supprimer "${prod.name}"?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await offlineProductService.delete(prod.id);
          await loadProducts();
          await loadCategories();
          onDataChanged();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const toggleProductActive = async (prod: Product) => {
    const newStatus = await offlineProductService.toggleActive(prod.id);
    await loadProducts();
    onDataChanged();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ==================== USERS ====================

  const openAddUser = () => {
    setEditingUser(null);
    setUserName('');
    setUserPin('');
    setUserRole('cashier');
    setShowUserModal(true);
  };

  const openEditUser = (user: OfflineUser) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserPin(user.pin);
    setUserRole(user.role);
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userName.trim() || !userPin.trim()) {
      Alert.alert('Erreur', 'Remplissez tous les champs');
      return;
    }

    if (userPin.length < 4) {
      Alert.alert('Erreur', 'Le PIN doit avoir au moins 4 chiffres');
      return;
    }

    // Validate PIN is numeric only
    if (!/^\d+$/.test(userPin)) {
      Alert.alert('Erreur', 'Le PIN doit contenir uniquement des chiffres');
      return;
    }

    // Check if PIN is taken
    const pinTaken = await offlineUserService.isPinTaken(userPin, editingUser?.id);
    if (pinTaken) {
      Alert.alert('Erreur', 'Ce PIN est déjà utilisé');
      return;
    }

    try {
      if (editingUser) {
        await offlineUserService.update(editingUser.id, {
          name: userName.trim(),
          pin: userPin,
          role: userRole,
        });
      } else {
        const id = await Crypto.randomUUID();
        await offlineUserService.create({
          id,
          name: userName.trim(),
          pin: userPin,
          role: userRole,
        });
      }
      
      await loadUsers();
      setShowUserModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Save user error:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const deleteUser = (user: OfflineUser) => {
    // SECURITY: Prevent self-deletion - admin cannot delete their own account
    if (currentUserId && user.id === currentUserId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        '🚫 Action impossible',
        'Vous ne pouvez pas supprimer votre propre compte.\n\nPour supprimer ce compte, demandez à un autre administrateur de le faire.',
        [{ text: 'Compris', style: 'default' }]
      );
      return;
    }

    // Check if this is the last admin
    const admins = users.filter(u => u.role === 'admin');
    const isLastAdmin = user.role === 'admin' && admins.length <= 1;

    if (isLastAdmin) {
      // SECURITY: Never allow deletion of the last admin
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        '🚫 Action impossible',
        `"${user.name}" est le seul administrateur du système.\n\nVous devez créer un autre administrateur avant de pouvoir supprimer celui-ci.`,
        [{ text: 'Compris', style: 'default' }]
      );
      return;
    }

    Alert.alert('Supprimer', `Supprimer "${user.name}"?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await offlineUserService.delete(user.id);
            await loadUsers();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Succès', `"${user.name}" a été supprimé`);
          } catch (error: any) {
            console.error('[DELETE_USER] Error:', error);
            Alert.alert('Erreur', `Impossible de supprimer: ${error.message || 'Erreur inconnue'}`);
          }
        },
      },
    ]);
  };

  // ==================== SETTINGS ====================

  const saveSettings = async () => {
    try {
      // Restaurant info
      await offlineSettingsService.set('restaurant_name', restaurantName);
      await offlineSettingsService.set('restaurant_address', restaurantAddress);
      await offlineSettingsService.set('restaurant_phone', restaurantPhone);
      await offlineSettingsService.set('auto_print_receipt', autoPrintReceipt ? 'true' : 'false');
      await offlineSettingsService.set('auto_open_drawer', autoOpenDrawer ? 'true' : 'false');
      
      // Business settings
      await offlineSettingsService.set('currency', currency);
      await offlineSettingsService.set('tax_rate', taxRate);
      await offlineSettingsService.set('tax_enabled', taxEnabled ? 'true' : 'false');
      await offlineSettingsService.set('service_charge_rate', serviceChargeRate);
      await offlineSettingsService.set('service_charge_enabled', serviceChargeEnabled ? 'true' : 'false');
      
      // Order settings
      await offlineSettingsService.set('require_table', requireTable ? 'true' : 'false');
      await offlineSettingsService.set('require_waiter', requireWaiter ? 'true' : 'false');
      await offlineSettingsService.set('allow_discounts', allowDiscounts ? 'true' : 'false');
      await offlineSettingsService.set('max_discount_percent', maxDiscountPercent);
      await offlineSettingsService.set('order_number_prefix', orderNumberPrefix);
      
      // Security settings
      await offlineSettingsService.set('require_pin_refund', requirePinForRefund ? 'true' : 'false');
      await offlineSettingsService.set('require_pin_discount', requirePinForDiscount ? 'true' : 'false');
      await offlineSettingsService.set('session_timeout', sessionTimeout);
      
      // Sound settings
      await offlineSettingsService.set('sound_enabled', soundEnabled ? 'true' : 'false');
      await offlineSettingsService.set('vibration_enabled', vibrationEnabled ? 'true' : 'false');
      await offlineSettingsService.set('new_order_sound', newOrderSound ? 'true' : 'false');
      await offlineSettingsService.set('payment_sound', paymentSound ? 'true' : 'false');
      
      // Save printer config via PrinterService
      await PrinterService.saveConfig({
        autoPrint: autoPrintReceipt,
      });
      
      Alert.alert('Sauvegardé', 'Paramètres enregistrés');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    }
  };

  const handleClearSyncQueue = () => {
    Alert.alert('Vider la file de sync', 'Cette action supprimera les données en attente de synchronisation.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          await clearSyncQueue();
          await loadSettings();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  // ==================== RENDER ====================

  const renderMenuTab = () => (
    <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
      {/* Clean Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#E8E8E8',
        borderBottomWidth: 1,
        borderBottomColor: '#CFCFCF',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#8B7355',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Settings size={18} color="#FFFFFF" />
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>Administration</Text>
        </View>
        <TouchableOpacity 
          onPress={onClose}
          style={{ 
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#E8E8E8',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#C8C8C8',
          }}
        >
          <X size={16} color="#666666" />
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          flexGrow: 1,
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: spacing.xl,
        }}
      >
        <Text style={{ fontSize: 13, color: '#666666', marginBottom: 20 }}>
          Gérez votre point de vente
        </Text>
        
        {/* Menu Grid */}
        <View style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          gap: 12,
          justifyContent: 'center',
          maxWidth: 400,
        }}>
          <TouchableOpacity
            onPress={() => setActiveTab('categories')}
            style={{
              width: 110,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Grid3x3 size={22} color="#007AFF" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#1C1C1E', textAlign: 'center' }}>Catégories</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('products')}
            style={{
              width: 110,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E8F8EB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Package size={22} color="#34C759" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#1C1C1E', textAlign: 'center' }}>Produits</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('users')}
            style={{
              width: 110,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFF4E5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Users size={22} color="#FF9500" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#1C1C1E', textAlign: 'center' }}>Utilisateurs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('settings')}
            style={{
              width: 110,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Coffee size={22} color="#9333EA" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#1C1C1E', textAlign: 'center' }}>Paramètres</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowHistoryCalendar(true)}
            style={{
              width: 110,
              height: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <CalendarDays size={22} color="#007AFF" />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#1C1C1E', textAlign: 'center' }}>Historique</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );

  const renderCategoriesTab = () => (
    <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingVertical: 12, 
        backgroundColor: '#E8E8E8', 
        borderBottomWidth: 1, 
        borderBottomColor: '#CFCFCF',
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: 8, marginRight: 8 }}>
          <ChevronLeft size={20} color="#555555" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>Catégories</Text>
        <TouchableOpacity
          onPress={openAddCategory}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: '#007AFF', 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.sm, 
            borderRadius: 6, 
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: '#0066DD',
          }}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: fontSize.sm }}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              padding: 14,
              borderRadius: 10,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#E5F1FF', alignItems: 'center', justifyContent: 'center' }}>
                <Grid3x3 size={20} color="#007AFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1C1E' }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>{item.productCount || 0} produits</Text>
              </View>
              <TouchableOpacity 
                onPress={() => openEditCategory(item)} 
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  backgroundColor: '#F5F5F5', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                <Pencil size={16} color="#555555" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => deleteCategory(item)} 
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  backgroundColor: '#FFF5F5', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                <Trash2 size={16} color="#C62828" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Grid3x3 size={48} color="#CFCFCF" />
              <Text style={{ fontSize: 14, color: '#666666', marginTop: 16 }}>Aucune catégorie</Text>
              <Text style={{ fontSize: 12, color: '#888888', marginTop: 4 }}>Appuyez sur + pour en créer une</Text>
            </View>
          }
        />
      )}
    </View>
  );

  // Filter products by search query
  const filteredProducts = products.filter(prod => 
    productSearchQuery.trim() === '' || 
    prod.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    (prod.categoryName && prod.categoryName.toLowerCase().includes(productSearchQuery.toLowerCase()))
  );

  const renderProductsTab = () => (
    <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingVertical: 12, 
        backgroundColor: '#E8E8E8', 
        borderBottomWidth: 1, 
        borderBottomColor: '#CFCFCF',
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: 8, marginRight: 8 }}>
          <ChevronLeft size={20} color="#555555" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>Produits</Text>
        
        {/* View Mode Toggle */}
        <TouchableOpacity
          onPress={() => setProductViewMode(productViewMode === 'list' ? 'grid' : 'list')}
          style={{ 
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.sm,
            backgroundColor: '#F5F5F5',
            borderRadius: 8,
          }}
        >
          {productViewMode === 'list' ? (
            <LayoutGrid size={18} color="#555555" />
          ) : (
            <List size={18} color="#555555" />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={openAddProduct}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: '#34C759', 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.sm, 
            borderRadius: 6, 
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: '#2DB84D',
          }}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: fontSize.sm }}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F5F5F5',
          borderRadius: 8,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: '#D0D0D0',
        }}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              fontSize: fontSize.md,
              color: colors.text,
            }}
            value={productSearchQuery}
            onChangeText={setProductSearchQuery}
            placeholder="Rechercher un produit..."
            placeholderTextColor={colors.textMuted}
          />
          {productSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setProductSearchQuery('')}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.success} style={{ marginTop: 40 }} />
      ) : productViewMode === 'list' ? (
        <FlatList
          key="list"
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const isLowStock = item.stockQuantity >= 0 && item.stockQuantity <= item.lowStockThreshold;
            const isOutOfStock = item.stockQuantity === 0;
            
            return (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: item.isActive ? '#FFFFFF' : '#F5F5F5',
                padding: 14,
                borderRadius: 10,
                marginBottom: 10,
                opacity: item.isActive ? 1 : 0.7,
                borderWidth: 1,
                borderColor: '#CFCFCF',
                borderLeftWidth: item.stockQuantity >= 0 ? 4 : 1,
                borderLeftColor: isOutOfStock ? colors.danger : isLowStock ? colors.warning : item.stockQuantity >= 0 ? colors.success : '#CFCFCF',
              }}>
                {/* Product Image or Icon */}
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#E8F8EB', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={22} color="#34C759" />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1C1E' }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>{item.categoryName} • {item.price.toFixed(0)} DH</Text>
                  {item.stockQuantity >= 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <Package size={11} color={isOutOfStock ? colors.danger : isLowStock ? colors.warning : '#888888'} />
                      <Text style={{ 
                        fontSize: 11, 
                        color: isOutOfStock ? colors.danger : isLowStock ? colors.warning : '#888888',
                        fontWeight: isLowStock ? '600' : '400',
                      }}>
                        Stock: {item.stockQuantity} {isOutOfStock ? '(RUPTURE)' : isLowStock ? '(BAS)' : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => toggleProductActive(item)} 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 8, 
                    backgroundColor: '#F5F5F5', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginLeft: 8,
                  }}
                >
                  {item.isActive ? <Eye size={16} color="#34C759" /> : <EyeOff size={16} color="#888888" />}
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => openEditProduct(item)} 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 8, 
                    backgroundColor: '#F5F5F5', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginLeft: 8,
                  }}
                >
                  <Pencil size={16} color="#555555" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => deleteProduct(item)} 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 8, 
                    backgroundColor: '#FFF5F5', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginLeft: 8,
                  }}
                >
                  <Trash2 size={16} color="#C62828" />
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Package size={48} color="#CFCFCF" />
              <Text style={{ fontSize: 14, color: '#666666', marginTop: 16 }}>Aucun produit</Text>
              <Text style={{ fontSize: 12, color: '#888888', marginTop: 4 }}>Appuyez sur + pour en créer un</Text>
            </View>
          }
        />
      ) : (
        /* Grid View */
        <FlatList
          key={`grid-${numColumns}`}
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={{ padding: GRID_PADDING }}
          columnWrapperStyle={{ gap: GRID_GAP }}
          renderItem={({ item }) => {
            const isLowStock = item.stockQuantity >= 0 && item.stockQuantity <= item.lowStockThreshold;
            const isOutOfStock = item.stockQuantity === 0;
            
            return (
              <TouchableOpacity
                onPress={() => openEditProduct(item)}
                style={{
                  width: cardWidth,
                  backgroundColor: item.isActive ? '#FFFFFF' : '#F5F5F5',
                  borderRadius: 10,
                  marginBottom: GRID_GAP,
                  opacity: item.isActive ? 1 : 0.7,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#CFCFCF',
                }}
              >
                {/* Stock Badge */}
                {item.stockQuantity >= 0 && (
                  <View style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: isOutOfStock ? colors.danger : isLowStock ? colors.warning : colors.success,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFFFFF' }}>
                      {item.stockQuantity}
                    </Text>
                  </View>
                )}
                
                {/* Product Image */}
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
                  justifyContent: 'center' 
                }}>
                  <Package size={36} color="#34C759" />
                </View>
              )}
              
              {/* Product Info */}
              <View style={{ padding: 10 }}>
                <Text 
                  style={{ fontSize: 13, fontWeight: '600', color: '#1C1C1E' }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={{ fontSize: 11, color: '#666666', marginTop: 2 }}>
                  {item.categoryName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#34C759' }}>
                    {item.price.toFixed(0)} DH
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity 
                      onPress={() => toggleProductActive(item)} 
                      style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: 6, 
                        backgroundColor: '#F5F5F5', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                      }}
                    >
                      {item.isActive ? <Eye size={14} color="#34C759" /> : <EyeOff size={14} color="#888888" />}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => deleteProduct(item)} 
                      style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: 6, 
                        backgroundColor: '#FFF5F5', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={14} color="#C62828" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, flex: 1 }}>
              <Package size={48} color="#CFCFCF" />
              <Text style={{ fontSize: 14, color: '#666666', marginTop: 16 }}>Aucun produit</Text>
              <Text style={{ fontSize: 12, color: '#888888', marginTop: 4 }}>Appuyez sur + pour en créer un</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderUsersTab = () => (
    <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingVertical: 12, 
        backgroundColor: '#E8E8E8', 
        borderBottomWidth: 1, 
        borderBottomColor: '#CFCFCF',
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: 8, marginRight: 8 }}>
          <ChevronLeft size={20} color="#555555" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>Utilisateurs</Text>
        <TouchableOpacity
          onPress={openAddUser}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: '#FF9500', 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.sm, 
            borderRadius: 6, 
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: '#E68600',
          }}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '500', fontSize: fontSize.sm }}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.warning} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              padding: 14,
              borderRadius: 10,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: '#CFCFCF',
            }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 10, 
                backgroundColor: item.role === 'admin' ? '#FFF4E5' : item.role === 'waiter' ? '#E5F1FF' : '#F5F5F5', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {item.role === 'admin' ? <Crown size={18} color="#E65100" /> : item.role === 'waiter' ? <UtensilsCrossed size={18} color="#007AFF" /> : <Wallet size={18} color="#555555" />}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1C1C1E' }}>{item.name}</Text>
                  {currentUserId === item.id && (
                    <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#1565C0' }}>VOUS</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                  {item.role === 'admin' ? 'Administrateur' : item.role === 'waiter' ? 'Serveur' : 'Caissier'} • PIN: ****
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => openEditUser(item)} 
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  backgroundColor: '#F5F5F5', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                <Pencil size={16} color="#555555" />
              </TouchableOpacity>
              {/* Disable delete button for current user */}
              <TouchableOpacity 
                onPress={() => deleteUser(item)} 
                disabled={currentUserId === item.id}
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  backgroundColor: currentUserId === item.id ? '#F0F0F0' : '#FFF5F5', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginLeft: 8,
                  opacity: currentUserId === item.id ? 0.4 : 1,
                }}
              >
                <Trash2 size={16} color={currentUserId === item.id ? '#999999' : '#C62828'} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Users size={48} color="#CFCFCF" />
              <Text style={{ fontSize: 14, color: '#666666', marginTop: 16 }}>Aucun utilisateur</Text>
              <Text style={{ fontSize: 12, color: '#888888', marginTop: 4 }}>Appuyez sur + pour en créer un</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderSettingsTab = () => (
    <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
      {/* Header with Save Button */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingVertical: 12, 
        backgroundColor: '#E8E8E8', 
        borderBottomWidth: 1, 
        borderBottomColor: '#CFCFCF',
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: 8, marginRight: 8 }}>
          <ChevronLeft size={20} color="#555555" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#1C1C1E' }}>Paramètres</Text>
        
        {/* Save Button in Header - macOS Style */}
        <TouchableOpacity
          onPress={saveSettings}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1,
            borderColor: '#006AE6',
          }}
        >
          <Save size={14} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {/* Restaurant Info */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Store size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Informations du restaurant</Text>
          </View>
          
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Nom</Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: fontSize.md,
              color: colors.text,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
            value={restaurantName}
            onChangeText={setRestaurantName}
            placeholder="Nom du restaurant"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Adresse</Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: fontSize.md,
              color: colors.text,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
            value={restaurantAddress}
            onChangeText={setRestaurantAddress}
            placeholder="Adresse"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Téléphone</Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: fontSize.md,
              color: colors.text,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
            value={restaurantPhone}
            onChangeText={setRestaurantPhone}
            placeholder="Téléphone"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        {/* Database Info */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Database size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Base de données</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>Éléments en attente de sync</Text>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: pendingSyncCount > 0 ? colors.warning : colors.success }}>
              {pendingSyncCount}
            </Text>
          </View>

          {pendingSyncCount > 0 && (
            <TouchableOpacity
              onPress={handleClearSyncQueue}
              style={{
                backgroundColor: '#FFF5F0',
                paddingVertical: spacing.md,
                borderRadius: 10,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.sm,
                borderWidth: 1,
                borderColor: '#FFCCBC',
              }}
            >
              <Trash2 size={16} color="#E65100" />
              <Text style={{ color: '#E65100', fontWeight: '600' }}>Vider la file de sync</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Printer Settings - Clean Unified Design */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm }}>
            <Printer size={20} color={colors.primary} />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Imprimante de reçus</Text>
          </View>
          
          {/* Connection Status Banner */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            backgroundColor: printerState.status === 'connected' ? '#D1FAE5' : 
                           printerState.status === 'connecting' ? '#FEF3C7' :
                           printerState.status === 'error' ? '#FEE2E2' : '#F3F4F6',
            borderRadius: borderRadius.lg,
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: printerState.status === 'connected' ? colors.success : 
                             printerState.status === 'connecting' ? colors.warning :
                             printerState.status === 'error' ? colors.danger : colors.textMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {printerState.status === 'connected' ? (
                <BluetoothConnected size={20} color={colors.white} />
              ) : printerState.status === 'connecting' ? (
                <Bluetooth size={20} color={colors.white} />
              ) : (
                <Printer size={20} color={colors.white} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {printerState.status === 'connected' ? <CheckCircle size={14} color="#065F46" /> : 
                 printerState.status === 'connecting' ? <Loader size={14} color="#92400E" /> :
                 printerState.status === 'error' ? <XCircle size={14} color="#991B1B" /> : 
                 <AlertTriangle size={14} color="#6B7280" />}
                <Text style={{ 
                  fontSize: fontSize.sm, 
                  fontWeight: '600', 
                  color: printerState.status === 'connected' ? '#065F46' : 
                         printerState.status === 'connecting' ? '#92400E' :
                         printerState.status === 'error' ? '#991B1B' : '#6B7280'
                }}>
                  {printerState.status === 'connected' ? 'Imprimante connectée' : 
                   printerState.status === 'connecting' ? 'Connexion en cours...' :
                   printerState.status === 'error' ? 'Erreur de connexion' : 
                   'Aucune imprimante'}
                </Text>
              </View>
              <Text style={{ 
                fontSize: fontSize.xs, 
                color: printerState.status === 'connected' ? '#047857' : '#6B7280',
                marginTop: 2,
              }}>
                {printerState.device?.name || 'Scannez pour trouver une imprimante'}
              </Text>
            </View>
            {printerState.status === 'connected' && (
              <TouchableOpacity
                onPress={() => PrinterService.disconnect()}
                style={{
                  backgroundColor: colors.danger,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.md,
                }}
              >
                <Text style={{ color: colors.white, fontSize: fontSize.xs, fontWeight: '600' }}>
                  Déconnecter
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Scan for Printers Button */}
          <TouchableOpacity
            onPress={scanForPrinters}
            disabled={scanningPrinters}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              backgroundColor: scanningPrinters ? '#F5F5F5' : colors.primary,
              borderRadius: 10,
              gap: spacing.sm,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: scanningPrinters ? '#CFCFCF' : '#006AE6',
            }}
          >
            {scanningPrinters ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Bluetooth size={18} color={colors.white} />
            )}
            <Text style={{ 
              fontSize: fontSize.sm, 
              fontWeight: '600', 
              color: scanningPrinters ? colors.primary : colors.white 
            }}>
              {scanningPrinters ? 'Recherche en cours...' : 'Rechercher imprimantes Bluetooth'}
            </Text>
          </TouchableOpacity>

          {/* Available Printers List */}
          {availablePrinters.length > 0 && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>
                Imprimantes trouvées ({availablePrinters.length})
              </Text>
              {availablePrinters.map((device) => (
                <TouchableOpacity
                  key={device.address}
                  onPress={() => connectToPrinter(device)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    backgroundColor: printerState.device?.address === device.address ? '#E8F5E9' : '#FFFFFF',
                    borderRadius: 10,
                    marginBottom: spacing.sm,
                    gap: spacing.sm,
                    borderWidth: 1,
                    borderColor: printerState.device?.address === device.address ? '#4CAF50' : '#CFCFCF',
                  }}
                >
                  <Printer size={18} color={printerState.device?.address === device.address ? colors.success : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: '500', color: colors.text }}>
                      {device.name || 'Imprimante inconnue'}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
                      {device.address}
                    </Text>
                  </View>
                  {printerState.device?.address === device.address ? (
                    <Check size={18} color={colors.success} />
                  ) : (
                    <Text style={{ fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' }}>
                      Connecter
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Auto Print Toggle */}
          <TouchableOpacity
            onPress={() => setAutoPrintReceipt(!autoPrintReceipt)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: autoPrintReceipt ? '#E8F5E9' : '#FFFFFF',
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: autoPrintReceipt ? '#4CAF50' : '#CFCFCF',
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: autoPrintReceipt ? colors.success : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {autoPrintReceipt && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>
                Impression automatique
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                Imprimer le reçu après chaque paiement
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* Auto Open Cash Drawer Toggle */}
          <TouchableOpacity
            onPress={() => setAutoOpenDrawer(!autoOpenDrawer)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: autoOpenDrawer ? '#FFF3E0' : '#FFFFFF',
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: autoOpenDrawer ? '#E65100' : '#CFCFCF',
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: autoOpenDrawer ? '#E65100' : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {autoOpenDrawer && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>
                Ouvrir tiroir-caisse
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                Ouvrir automatiquement lors d'un paiement espèces
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* Test Print Button */}
          <TouchableOpacity
            onPress={handleTestPrint}
            disabled={printerState.status !== 'connected'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.md,
              backgroundColor: printerState.status === 'connected' ? '#7C3AED' : '#F5F5F5',
              borderRadius: 10,
              gap: spacing.sm,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: printerState.status === 'connected' ? '#6D28D9' : '#CFCFCF',
            }}
          >
            <Zap size={18} color={printerState.status === 'connected' ? colors.white : colors.textMuted} />
            <Text style={{ 
              fontSize: fontSize.sm, 
              fontWeight: '600', 
              color: printerState.status === 'connected' ? colors.white : colors.textMuted 
            }}>
              Imprimer page de test
            </Text>
          </TouchableOpacity>

          {/* Receipt Design Button */}
          <TouchableOpacity
            onPress={() => setShowReceiptDesignModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: '#E3F2FD',
              borderRadius: 10,
              gap: spacing.md,
              borderWidth: 1,
              borderColor: '#007AFF',
            }}
          >
            <Printer size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' }}>
                Personnaliser le reçu
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                Logo, texte, taille de papier...
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ===================== BUSINESS SETTINGS ===================== */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Banknote size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Facturation & Taxes</Text>
          </View>
          
          {/* Currency */}
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Devise</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {['DH', 'MAD', '€', '$'].map((curr) => (
              <TouchableOpacity
                key={curr}
                onPress={() => setCurrency(curr)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: 10,
                  backgroundColor: currency === curr ? colors.primary : colors.background,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: currency === curr ? '#006AE6' : colors.borderLight,
                }}
              >
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: currency === curr ? colors.white : colors.text }}>
                  {curr}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Tax Toggle */}
          <TouchableOpacity
            onPress={() => setTaxEnabled(!taxEnabled)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: taxEnabled ? '#E8F5E9' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: taxEnabled ? '#4CAF50' : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: taxEnabled ? colors.success : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {taxEnabled && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Activer la TVA</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Appliquer la taxe aux commandes</Text>
            </View>
          </TouchableOpacity>
          
          {/* Tax Rate Input */}
          {taxEnabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Taux de TVA (%)</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                  value={taxRate}
                  onChangeText={setTaxRate}
                  placeholder="20"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                <Percent size={24} color={colors.primary} />
              </View>
            </View>
          )}
          
          {/* Service Charge Toggle */}
          <TouchableOpacity
            onPress={() => setServiceChargeEnabled(!serviceChargeEnabled)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: serviceChargeEnabled ? '#FFF3E0' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: serviceChargeEnabled ? '#FF9800' : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: serviceChargeEnabled ? '#FF9800' : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {serviceChargeEnabled && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Frais de service</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Ajouter un pourboire automatique</Text>
            </View>
          </TouchableOpacity>
          
          {/* Service Charge Rate */}
          {serviceChargeEnabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Frais de service (%)</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                  value={serviceChargeRate}
                  onChangeText={setServiceChargeRate}
                  placeholder="10"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                <Percent size={24} color="#FF9800" />
              </View>
            </View>
          )}
        </View>

        {/* ===================== ORDER SETTINGS ===================== */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Receipt size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Commandes</Text>
          </View>
          
          {/* Order Number Prefix */}
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Préfixe des commandes</Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: fontSize.md,
              color: colors.text,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
            value={orderNumberPrefix}
            onChangeText={setOrderNumberPrefix}
            placeholder="Ex: CMD-"
            placeholderTextColor={colors.textMuted}
          />
          
          {/* Require Table Toggle */}
          <TouchableOpacity
            onPress={() => setRequireTable(!requireTable)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: requireTable ? '#E3F2FD' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: requireTable ? colors.primary : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: requireTable ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {requireTable && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Table obligatoire</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Sélectionner une table pour chaque commande</Text>
            </View>
          </TouchableOpacity>
          
          {/* Require Waiter Toggle */}
          <TouchableOpacity
            onPress={() => setRequireWaiter(!requireWaiter)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: requireWaiter ? '#E3F2FD' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: requireWaiter ? colors.primary : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: requireWaiter ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {requireWaiter && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Serveur obligatoire</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Attribuer un serveur à chaque commande</Text>
            </View>
          </TouchableOpacity>
          
          {/* Allow Discounts Toggle */}
          <TouchableOpacity
            onPress={() => setAllowDiscounts(!allowDiscounts)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: allowDiscounts ? '#E8F5E9' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: allowDiscounts ? '#4CAF50' : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: allowDiscounts ? colors.success : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {allowDiscounts && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Autoriser les remises</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Permettre d'appliquer des réductions</Text>
            </View>
          </TouchableOpacity>
          
          {/* Max Discount */}
          {allowDiscounts && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Remise maximale (%)</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                  value={maxDiscountPercent}
                  onChangeText={setMaxDiscountPercent}
                  placeholder="100"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                <Percent size={24} color={colors.success} />
              </View>
            </View>
          )}
        </View>

        {/* ===================== SECURITY SETTINGS ===================== */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <ShieldCheck size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Sécurité</Text>
          </View>
          
          {/* Session Timeout */}
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Expiration de session (minutes)</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {['15', '30', '60', '120'].map((time) => (
              <TouchableOpacity
                key={time}
                onPress={() => setSessionTimeout(time)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: 10,
                  backgroundColor: sessionTimeout === time ? colors.primary : colors.background,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: sessionTimeout === time ? '#006AE6' : colors.borderLight,
                }}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: sessionTimeout === time ? colors.white : colors.text }}>
                  {time}min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Require PIN for Refund */}
          <TouchableOpacity
            onPress={() => setRequirePinForRefund(!requirePinForRefund)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: requirePinForRefund ? '#FFF3E0' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: requirePinForRefund ? '#E65100' : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: requirePinForRefund ? '#E65100' : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {requirePinForRefund && <Lock size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>PIN pour remboursement</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Exiger le PIN admin pour rembourser</Text>
            </View>
          </TouchableOpacity>
          
          {/* Require PIN for Discount */}
          <TouchableOpacity
            onPress={() => setRequirePinForDiscount(!requirePinForDiscount)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: requirePinForDiscount ? '#FFF3E0' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              borderWidth: 1,
              borderColor: requirePinForDiscount ? '#E65100' : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: requirePinForDiscount ? '#E65100' : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {requirePinForDiscount && <Lock size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>PIN pour remise</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Exiger le PIN admin pour les remises</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ===================== SOUND SETTINGS ===================== */}
        <View style={{ backgroundColor: colors.white, borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Bell size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Sons & Notifications</Text>
          </View>
          
          {/* Master Sound Toggle */}
          <TouchableOpacity
            onPress={() => setSoundEnabled(!soundEnabled)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: soundEnabled ? '#E8F5E9' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: soundEnabled ? '#4CAF50' : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: soundEnabled ? colors.success : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {soundEnabled ? <Volume2 size={16} color={colors.white} /> : <VolumeX size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Activer les sons</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Sons de notification de l'application</Text>
            </View>
          </TouchableOpacity>
          
          {/* Vibration Toggle */}
          <TouchableOpacity
            onPress={() => setVibrationEnabled(!vibrationEnabled)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: vibrationEnabled ? '#E3F2FD' : colors.background,
              borderRadius: 10,
              gap: spacing.md,
              marginBottom: spacing.md,
              borderWidth: 1,
              borderColor: vibrationEnabled ? colors.primary : colors.borderLight,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              backgroundColor: vibrationEnabled ? colors.primary : colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {vibrationEnabled && <Check size={16} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Vibration</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Retour haptique sur les actions</Text>
            </View>
          </TouchableOpacity>
          
          {soundEnabled && (
            <>
              {/* New Order Sound */}
              <TouchableOpacity
                onPress={() => setNewOrderSound(!newOrderSound)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  backgroundColor: newOrderSound ? '#FFF3E0' : colors.background,
                  borderRadius: 10,
                  gap: spacing.md,
                  marginBottom: spacing.md,
                  borderWidth: 1,
                  borderColor: newOrderSound ? '#FF9800' : colors.borderLight,
                }}
              >
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: newOrderSound ? '#FF9800' : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {newOrderSound && <Check size={16} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Son nouvelle commande</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Bip à la réception d'une commande</Text>
                </View>
              </TouchableOpacity>
              
              {/* Payment Sound */}
              <TouchableOpacity
                onPress={() => setPaymentSound(!paymentSound)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: spacing.md,
                  backgroundColor: paymentSound ? '#E8F5E9' : colors.background,
                  borderRadius: 10,
                  gap: spacing.md,
                  borderWidth: 1,
                  borderColor: paymentSound ? colors.success : colors.borderLight,
                }}
              >
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: paymentSound ? colors.success : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {paymentSound && <Check size={16} color={colors.white} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.sm, color: colors.text, fontWeight: '500' }}>Son paiement</Text>
                  <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>Son de confirmation de paiement</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Backup & Restore Section */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <HardDrive size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Sauvegarde & Restauration</Text>
          </View>
          
          <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 }}>
            Sauvegardez vos données pour les restaurer sur un nouvel appareil en cas de perte ou de changement de tablette.
          </Text>
          
          {/* Create Backup Button */}
          <TouchableOpacity
            onPress={async () => {
              if (isBackingUp) return;
              
              setIsBackingUp(true);
              try {
                const result = await BackupService.createAndShareBackup();
                if (result.success) {
                  Alert.alert(
                    '✅ Sauvegarde créée',
                    'Votre sauvegarde a été créée avec succès. Envoyez-la par email ou stockez-la dans le cloud (Google Drive, etc.) pour la récupérer plus tard.',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert('Erreur', result.error || 'Échec de la sauvegarde');
                }
              } catch (error) {
                Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde');
              } finally {
                setIsBackingUp(false);
              }
            }}
            disabled={isBackingUp}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              backgroundColor: isBackingUp ? colors.border : '#E8F5E9',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isBackingUp ? colors.borderLight : '#4CAF50',
              marginBottom: spacing.md,
            }}
          >
            {isBackingUp ? (
              <Loader size={18} color={colors.textMuted} />
            ) : (
              <Share2 size={18} color="#4CAF50" />
            )}
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: isBackingUp ? colors.textMuted : '#4CAF50' }}>
              {isBackingUp ? 'Création en cours...' : 'Créer une sauvegarde'}
            </Text>
          </TouchableOpacity>
          
          {/* Restore Backup Button */}
          <TouchableOpacity
            onPress={async () => {
              if (isRestoring) return;
              
              Alert.alert(
                '⚠️ Restauration',
                'Cette action remplacera toutes vos données actuelles par celles de la sauvegarde. Êtes-vous sûr de vouloir continuer ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Restaurer',
                    style: 'destructive',
                    onPress: async () => {
                      setIsRestoring(true);
                      try {
                        const result = await BackupService.restoreFromFile();
                        if (result.success && result.stats) {
                          Alert.alert(
                            '✅ Restauration réussie',
                            `Données restaurées:\n• ${result.stats.categories} catégories\n• ${result.stats.products} produits\n• ${result.stats.orders} commandes\n• ${result.stats.users} utilisateurs\n\nRedémarrez l'application pour appliquer les changements.`,
                            [{ text: 'OK' }]
                          );
                          // Reload data
                          await loadCategories();
                          await loadProducts();
                          await loadUsers();
                        } else {
                          Alert.alert('Erreur', result.error || 'Échec de la restauration');
                        }
                      } catch (error) {
                        Alert.alert('Erreur', 'Une erreur est survenue lors de la restauration');
                      } finally {
                        setIsRestoring(false);
                      }
                    },
                  },
                ]
              );
            }}
            disabled={isRestoring}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              backgroundColor: isRestoring ? colors.border : '#FFF3E0',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: isRestoring ? colors.borderLight : '#FF9800',
            }}
          >
            {isRestoring ? (
              <Loader size={18} color={colors.textMuted} />
            ) : (
              <Download size={18} color="#FF9800" />
            )}
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: isRestoring ? colors.textMuted : '#FF9800' }}>
              {isRestoring ? 'Restauration en cours...' : 'Restaurer une sauvegarde'}
            </Text>
          </TouchableOpacity>
          
          <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: '#F5F5F7', borderRadius: 8 }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' }}>
              💡 Conseil: Envoyez la sauvegarde à votre email ou stockez-la sur Google Drive pour la récupérer facilement sur un nouvel appareil.
            </Text>
          </View>
        </View>

        {/* App Info */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: '#CFCFCF' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <Smartphone size={18} color="#007AFF" />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.text }}>Application</Text>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>Version</Text>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.text }}>
              {Constants.expoConfig?.version || '2.3.0'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>Mode</Text>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.success }}>Hors ligne</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>Impression</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {printerState.status === 'connected' ? <CheckCircle size={12} color={colors.success} /> : <AlertTriangle size={12} color={colors.textMuted} />}
              <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: printerState.status === 'connected' ? colors.success : colors.textMuted }}>
                {printerState.status === 'connected' ? 'Prête' : 'Non configurée'}
              </Text>
            </View>
          </View>
          
          {/* Device ID */}
          <View style={{ 
            backgroundColor: '#F5F5F7', 
            borderRadius: 8, 
            padding: spacing.md, 
            marginTop: spacing.sm,
            marginBottom: spacing.lg,
          }}>
            <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 }}>
              Device ID (for support)
            </Text>
            <Text style={{ 
              fontSize: fontSize.sm, 
              fontWeight: '600', 
              color: colors.text,
              fontFamily: 'monospace',
              letterSpacing: 1,
            }}>
              {deviceId}
            </Text>
            {licenseInfo && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 6 }}>
                {licenseInfo.status === 'licensed' ? (
                  <>
                    <CheckCircle size={14} color={colors.success} />
                    <Text style={{ fontSize: fontSize.xs, color: colors.success, fontWeight: '600' }}>
                      Licensed ({licenseInfo.licensePlan})
                    </Text>
                  </>
                ) : licenseInfo.status === 'trial_active' ? (
                  <>
                    <Clock size={14} color="#F59E0B" />
                    <Text style={{ fontSize: fontSize.xs, color: '#F59E0B', fontWeight: '600' }}>
                      Trial: {licenseInfo.trialDaysRemaining} min remaining
                    </Text>
                  </>
                ) : null}
              </View>
            )}
          </View>

          {/* Replay Tutorial Button */}
          <TouchableOpacity
            onPress={async () => {
              await resetOnboarding();
              Alert.alert(
                'Tutoriel réinitialisé',
                'Le tutoriel s\'affichera lors du prochain lancement de l\'application.',
                [{ text: 'OK' }]
              );
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.md,
              backgroundColor: '#F0F9FF',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#BAE6FD',
            }}
          >
            <Coffee size={16} color="#0284C7" />
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: '#0284C7' }}>
              Revoir le tutoriel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'menu': return renderMenuTab();
      case 'categories': return renderCategoriesTab();
      case 'products': return renderProductsTab();
      case 'users': return renderUsersTab();
      case 'settings': return renderSettingsTab();

      default: return renderMenuTab();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#ECECEC' }}>
        {renderContent()}

        {/* Category Modal */}
        <Modal visible={showCategoryModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
            <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 400 }}>
              <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xl }}>
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </Text>
              
              <TextInput
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 6,
                  padding: 16,
                  fontSize: 16,
                  color: '#111827',
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Nom de la catégorie"
                autoFocus
              />
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowCategoryModal(false)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveCategory}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: '#007AFF', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Sauvegarder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Product Modal */}
        <Modal visible={showProductModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <ScrollView 
              style={{ maxHeight: '90%', width: '100%' }} 
              contentContainerStyle={{ alignItems: 'center' }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 24, width: '100%', maxWidth: 400 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 }}>
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </Text>
                
                {/* Product Image */}
                <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                  {productImageUrl ? (
                    <View style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: productImageUrl }}
                        style={{
                          width: 120,
                          height: 120,
                          borderRadius: borderRadius.lg,
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => setProductImageUrl('')}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: colors.danger,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={16} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{
                      width: 120,
                      height: 120,
                      borderRadius: borderRadius.lg,
                      backgroundColor: colors.background,
                      borderWidth: 2,
                      borderColor: colors.borderLight,
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <ImageIcon size={32} color={colors.textMuted} />
                      <Text style={{ fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs }}>
                        Pas d&apos;image
                      </Text>
                    </View>
                  )}
                  
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                    <TouchableOpacity
                      onPress={pickProductImage}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        backgroundColor: colors.primaryLight,
                        borderRadius: 6,
                        gap: spacing.xs,
                        borderWidth: 1,
                        borderColor: '#D0E3FF',
                      }}
                    >
                      <ImageIcon size={16} color={colors.primary} />
                      <Text style={{ fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' }}>Galerie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={takeProductPhoto}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        backgroundColor: colors.successLight,
                        borderRadius: 6,
                        gap: spacing.xs,
                        borderWidth: 1,
                        borderColor: '#C6F0D2',
                      }}
                    >
                      <Camera size={16} color={colors.success} />
                      <Text style={{ fontSize: fontSize.sm, color: colors.success, fontWeight: '500' }}>Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TextInput
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 6,
                    padding: 16,
                    fontSize: 16,
                    color: '#111827',
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="Nom du produit"
                />
                
                <TextInput
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 6,
                    padding: 16,
                    fontSize: 16,
                    color: '#111827',
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                  value={productPrice}
                  onChangeText={setProductPrice}
                  placeholder="Prix (MAD)"
                  keyboardType="decimal-pad"
                />
                
                {/* Category selector */}
                <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {categories.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setProductCategoryId(cat.id)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 6,
                          backgroundColor: productCategoryId === cat.id ? '#007AFF' : '#F3F4F6',
                        }}
                      >
                        <Text style={{ color: productCategoryId === cat.id ? '#FFFFFF' : '#374151', fontWeight: '500' }}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                
                {/* Active toggle */}
                <TouchableOpacity
                  onPress={() => setProductActive(!productActive)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: productActive ? '#ECFDF5' : '#F3F4F6',
                    borderRadius: 12,
                    marginBottom: 12,
                    gap: 12,
                  }}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    backgroundColor: productActive ? '#10B981' : '#D1D5DB',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {productActive && <Check size={16} color="#FFFFFF" />}
                  </View>
                  <Text style={{ fontSize: 15, color: '#374151' }}>Produit actif (visible en caisse)</Text>
                </TouchableOpacity>
                
                {/* Stock Management Section */}
                <View style={{ 
                  backgroundColor: '#F9FAFB', 
                  borderRadius: 8, 
                  padding: 16, 
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: trackStock ? colors.primary : '#E5E7EB',
                }}>
                  <TouchableOpacity
                    onPress={() => setTrackStock(!trackStock)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: trackStock ? 16 : 0,
                    }}
                  >
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      backgroundColor: trackStock ? colors.primary : '#D1D5DB',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {trackStock && <Check size={16} color="#FFFFFF" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, color: '#374151', fontWeight: '500' }}>Suivi du stock</Text>
                      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Activer pour recevoir des alertes de stock bas</Text>
                    </View>
                    <Package size={20} color={trackStock ? colors.primary : '#9CA3AF'} />
                  </TouchableOpacity>
                  
                  {trackStock && (
                    <View style={{ gap: 12 }}>
                      <View>
                        <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>Quantité en stock</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => {
                              const val = parseInt(productStockQuantity) || 0;
                              if (val > 0) setProductStockQuantity(String(val - 1));
                            }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              backgroundColor: colors.dangerLight,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Minus size={18} color={colors.danger} />
                          </TouchableOpacity>
                          <TextInput
                            style={{
                              flex: 1,
                              backgroundColor: '#FFFFFF',
                              borderRadius: 8,
                              padding: 12,
                              fontSize: 18,
                              fontWeight: '700',
                              color: '#111827',
                              textAlign: 'center',
                              borderWidth: 1,
                              borderColor: '#E5E7EB',
                            }}
                            value={productStockQuantity === '-1' ? '0' : productStockQuantity}
                            onChangeText={(val) => setProductStockQuantity(val.replace(/[^0-9]/g, '') || '0')}
                            keyboardType="number-pad"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const val = parseInt(productStockQuantity) || 0;
                              setProductStockQuantity(String(val + 1));
                            }}
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              backgroundColor: colors.successLight,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Plus size={18} color={colors.success} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View>
                        <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 6 }}>
                          Seuil d&apos;alerte (stock bas)
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <AlertTriangle size={18} color={colors.warning} />
                          <TextInput
                            style={{
                              flex: 1,
                              backgroundColor: '#FFFFFF',
                              borderRadius: 8,
                              padding: 12,
                              fontSize: 16,
                              color: '#111827',
                              borderWidth: 1,
                              borderColor: '#E5E7EB',
                            }}
                            value={productLowStockThreshold}
                            onChangeText={(val) => setProductLowStockThreshold(val.replace(/[^0-9]/g, '') || '10')}
                            keyboardType="number-pad"
                            placeholder="10"
                          />
                          <Text style={{ fontSize: 13, color: '#9CA3AF' }}>unités</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setShowProductModal(false)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveProduct}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: '#34C759', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Sauvegarder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* User Modal */}
        <Modal visible={showUserModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 24, width: '100%', maxWidth: 400 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 }}>
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </Text>
              
              <TextInput
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 6,
                  padding: 16,
                  fontSize: 16,
                  color: '#111827',
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                value={userName}
                onChangeText={setUserName}
                placeholder="Nom"
              />
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: '#F9FAFB',
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: '#111827',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                  }}
                  value={userPin}
                  onChangeText={(text) => setUserPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="Code PIN (4-6 chiffres)"
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  maxLength={6}
                />
                <TouchableOpacity onPress={() => setShowPin(!showPin)} style={{ padding: 12, marginLeft: 8 }}>
                  {showPin ? <EyeOff size={20} color="#6B7280" /> : <Eye size={20} color="#6B7280" />}
                </TouchableOpacity>
              </View>
              
              {/* Role selector */}
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Rôle</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {[
                  { value: 'admin', label: 'Admin', color: '#FEF3C7' },
                  { value: 'cashier', label: 'Caissier', color: '#F3F4F6' },
                  { value: 'waiter', label: 'Serveur', color: '#DBEAFE' },
                ].map(role => (
                  <TouchableOpacity
                    key={role.value}
                    onPress={() => setUserRole(role.value as any)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 6,
                      backgroundColor: userRole === role.value ? '#007AFF' : role.color,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 13, 
                      fontWeight: '600', 
                      color: userRole === role.value ? '#FFFFFF' : '#374151' 
                    }}>
                      {role.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowUserModal(false)}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveUser}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 6, backgroundColor: '#FF9500', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Sauvegarder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Unified Printer Modal - Professional Multi-Protocol Connection UI */}
        <UnifiedPrinterModal
          visible={showBluetoothModal}
          onClose={() => setShowBluetoothModal(false)}
          onConnected={(device) => {
            setPrinterAddress(device.address);
            setPrinterConnected(true);
            setConnectedPrinterName(device.name);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />

        {/* Receipt Design Modal */}
        <Modal visible={showReceiptDesignModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.md }}>
            <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.text }}>
                  Design du Ticket
                </Text>
                <TouchableOpacity onPress={() => setShowReceiptDesignModal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              {/* Scrollable Form Content */}
              <ScrollView 
                style={{ flex: 1 }} 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
              >
                {/* ========== SHOP IDENTITY ========== */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.md }}>
                  IDENTITÉ DU COMMERCE
                </Text>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    marginBottom: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                  value={receiptDesign.restaurantName}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, restaurantName: text }))}
                  placeholder="Nom du commerce (ex: CaissaPro)"
                  placeholderTextColor={colors.textMuted}
                />
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    marginBottom: spacing.sm,
                  }}
                  value={receiptDesign.address}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, address: text }))}
                  placeholder="Adresse (ex: 123 Rue Mohammed V)"
                  placeholderTextColor={colors.textMuted}
                />
                
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: colors.background,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                      fontSize: fontSize.md,
                      color: colors.text,
                    }}
                    value={receiptDesign.city}
                    onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, city: text }))}
                    placeholder="Ville"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: colors.background,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                      fontSize: fontSize.md,
                      color: colors.text,
                    }}
                    value={receiptDesign.phone}
                    onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, phone: text }))}
                    placeholder="Téléphone"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    marginBottom: spacing.md,
                  }}
                  value={receiptDesign.taxId}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, taxId: text }))}
                  placeholder="N° ICE / IF / RC (optionnel)"
                  placeholderTextColor={colors.textMuted}
                />
                
                {/* ========== FOOTER MESSAGE ========== */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.md }}>
                  MESSAGE DE REMERCIEMENT
                </Text>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    marginBottom: spacing.md,
                  }}
                  value={receiptDesign.footerMessage}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, footerMessage: text }))}
                  placeholder="Merci de votre visite!"
                  placeholderTextColor={colors.textMuted}
                />
                
                {/* ========== WIFI PASSWORD ========== */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.md }}>
                  MOT DE PASSE WIFI
                </Text>
                
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: spacing.sm, 
                  marginBottom: spacing.sm 
                }}>
                  <TouchableOpacity
                    onPress={() => setReceiptDesign(prev => ({ ...prev, showWifi: !prev.showWifi }))}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: receiptDesign.showWifi ? colors.success : colors.borderLight,
                      justifyContent: 'center',
                      padding: 2,
                    }}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.white,
                      transform: [{ translateX: receiptDesign.showWifi ? 20 : 0 }],
                    }} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>
                    Afficher le WiFi sur le ticket
                  </Text>
                </View>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.text,
                    marginBottom: spacing.md,
                    opacity: receiptDesign.showWifi ? 1 : 0.5,
                  }}
                  value={receiptDesign.wifiPassword}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, wifiPassword: text }))}
                  placeholder="Ex: MonWiFi123"
                  placeholderTextColor={colors.textMuted}
                  editable={receiptDesign.showWifi}
                />
                
                {/* ========== PAPER & FORMATTING ========== */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.md }}>
                  FORMAT DU PAPIER
                </Text>
                
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  {([58, 80] as const).map((size) => (
                    <TouchableOpacity
                      key={size}
                      onPress={() => setReceiptDesign(prev => ({ ...prev, paperWidth: size }))}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.md,
                        borderRadius: borderRadius.md,
                        backgroundColor: receiptDesign.paperWidth === size ? colors.primary : colors.background,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: receiptDesign.paperWidth === size ? colors.primary : colors.borderLight,
                      }}
                    >
                      <Text style={{ 
                        fontSize: fontSize.md, 
                        fontWeight: '600', 
                        color: receiptDesign.paperWidth === size ? colors.white : colors.text 
                      }}>
                        {size}mm {size === 58 ? '(petit)' : '(standard)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Separator Style */}
                <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs }}>
                  Style de séparateur
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  {([
                    { value: 'dash', label: '------' },
                    { value: 'equal', label: '======' },
                    { value: 'dot', label: '......' },
                  ] as const).map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setReceiptDesign(prev => ({ ...prev, separatorStyle: value }))}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.sm,
                        borderRadius: borderRadius.md,
                        backgroundColor: receiptDesign.separatorStyle === value ? colors.primaryLight : colors.background,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ 
                        fontSize: fontSize.sm, 
                        fontFamily: 'monospace',
                        color: receiptDesign.separatorStyle === value ? colors.primary : colors.textSecondary 
                      }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* ========== DISPLAY OPTIONS ========== */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.md }}>
                  ÉLÉMENTS À AFFICHER
                </Text>
                
                {[
                  { key: 'showOrderNumber', label: 'Numéro de commande' },
                  { key: 'showTableNumber', label: 'Numéro de table' },
                  { key: 'showWaiterName', label: 'Nom du serveur' },
                  { key: 'showDateTime', label: 'Date et heure' },
                  { key: 'showSubtotal', label: 'Sous-total' },
                  { key: 'showTotal', label: 'Total' },
                  { key: 'showPaymentDetails', label: 'Détails du paiement' },
                  { key: 'showTaxId', label: 'N° ICE / IF' },
                  { key: 'showFooter', label: 'Message de remerciement' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setReceiptDesign(prev => ({ ...prev, [key]: !prev[key as keyof ReceiptDesign] }))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.xs,
                    }}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      backgroundColor: receiptDesign[key as keyof ReceiptDesign] ? colors.success : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing.sm,
                    }}>
                      {receiptDesign[key as keyof ReceiptDesign] && <Check size={14} color={colors.white} />}
                    </View>
                    <Text style={{ fontSize: fontSize.sm, color: colors.text }}>{label}</Text>
                  </TouchableOpacity>
                ))}
                
                {/* ========== FORMATTING OPTIONS ========== */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.lg }}>
                  OPTIONS DE MISE EN FORME
                </Text>
                
                {[
                  { key: 'boldTotal', label: 'Total en gras et grand' },
                  { key: 'centerHeader', label: 'Centrer l\'en-tête' },
                  { key: 'autoCut', label: 'Couper le papier automatiquement' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setReceiptDesign(prev => ({ ...prev, [key]: !prev[key as keyof ReceiptDesign] }))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.xs,
                    }}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      backgroundColor: receiptDesign[key as keyof ReceiptDesign] ? colors.success : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing.sm,
                    }}>
                      {receiptDesign[key as keyof ReceiptDesign] && <Check size={14} color={colors.white} />}
                    </View>
                    <Text style={{ fontSize: fontSize.sm, color: colors.text }}>{label}</Text>
                  </TouchableOpacity>
                ))}
                
              </ScrollView>
              
              {/* Action Buttons */}
              <View style={{ marginTop: spacing.md }}>
                {/* Test Print Button */}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      // Save first then print test
                      await saveReceiptDesign(receiptDesign);
                      const PrinterService = (await import('../lib/services/PrinterService')).default;
                      await PrinterService.initialize();
                      const connected = await PrinterService.checkConnection();
                      if (!connected) {
                        Alert.alert('Imprimante non connectée', 'Connectez une imprimante d\'abord.');
                        return;
                      }
                      // Print a test receipt with sample data
                      const testData = {
                        restaurantName: receiptDesign.restaurantName || 'CaissaPro',
                        address: receiptDesign.address,
                        phone: receiptDesign.phone,
                        orderId: 'TEST-001',
                        orderNumber: 1,
                        tableNumber: 5,
                        waiterName: 'Serveur Test',
                        date: new Date().toLocaleString('fr-FR'),
                        items: [
                          { name: 'Cappuccino', quantity: 2, unitPrice: 15, total: 30 },
                          { name: 'Croissant', quantity: 1, unitPrice: 12, total: 12 },
                        ],
                        subtotal: 42,
                        discount: 0,
                        tax: 0,
                        total: 42,
                        paymentMethod: 'Espèces',
                        amountReceived: 50,
                        change: 8,
                        footerMessage: receiptDesign.footerMessage,
                        showOrderNumber: receiptDesign.showOrderNumber,
                        showTableNumber: receiptDesign.showTableNumber,
                        showWaiterName: receiptDesign.showWaiterName,
                        showDateTime: receiptDesign.showDateTime,
                        showPaymentDetails: receiptDesign.showPaymentDetails,
                        showSubtotal: receiptDesign.showSubtotal,
                        showTotal: receiptDesign.showTotal,
                        showFooter: receiptDesign.showFooter,
                        wifiPassword: receiptDesign.wifiPassword,
                        showWifi: receiptDesign.showWifi,
                        paperWidth: receiptDesign.paperWidth,
                        boldTotal: receiptDesign.boldTotal,
                        separatorStyle: receiptDesign.separatorStyle,
                        centerHeader: receiptDesign.centerHeader,
                        autoCut: receiptDesign.autoCut,
                      };
                      const success = await PrinterService.printReceipt(testData);
                      if (success) {
                        Alert.alert('Test réussi', 'Le ticket test a été imprimé.');
                      }
                    } catch (error) {
                      console.error('Test print error:', error);
                      Alert.alert('Erreur', 'Échec de l\'impression test.');
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.md,
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.successLight,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Printer size={18} color={colors.success} />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.success }}>
                    Imprimer un Test
                  </Text>
                </TouchableOpacity>
                
                {/* Save / Cancel */}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <TouchableOpacity
                    onPress={() => setShowReceiptDesignModal(false)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.background,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textSecondary }}>
                      Annuler
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveReceiptDesign}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.white }}>
                      Sauvegarder
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* History Calendar */}
        <HistoryCalendar 
          visible={showHistoryCalendar} 
          onClose={() => setShowHistoryCalendar(false)} 
        />

        {/* Staff Management removed */}
      </View>
    </Modal>
  );
}
