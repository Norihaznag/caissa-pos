import React, { useState, useEffect, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  RefreshCw,
  Coffee,
  Camera,
  ImageIcon,
  List,
  LayoutGrid,
  Search,
  Printer,
  Bluetooth,
  Wifi,
  Usb,
  AlertTriangle,
  Minus,
  BluetoothConnected,
  Zap,
} from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, borderRadius, fontSize, shadows } from '../lib/theme';
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
  BluetoothPrinterService,
  UnifiedPrinterService,
} from '../lib/printing';
import UnifiedPrinterModal from './UnifiedPrinterModal';

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
  onDataChanged: () => void;
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

export default function AdminPanel({ visible, onClose, onDataChanged }: AdminPanelProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  
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
  const [printerType, setPrinterType] = useState<'bluetooth' | 'wifi' | 'usb' | 'none'>('none');
  const [printerAddress, setPrinterAddress] = useState('');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  
  // Bluetooth Discovery
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  
  // Receipt Design
  const [showReceiptDesignModal, setShowReceiptDesignModal] = useState(false);
  const [receiptDesign, setReceiptDesign] = useState<ReceiptDesign>({
    showLogo: true,
    restaurantName: 'CaissaPro',
    address: '',
    city: '',
    phone: '',
    taxId: '',
    footerMessage: 'Merci de votre visite!',
    footerMessageArabic: 'شكرا لزيارتكم',
    showTaxId: true,
    showOrderNumber: true,
    showTableNumber: true,
    showWaiterName: false,
    showDateTime: true,
    showPaymentDetails: true,
    fontSize: 'normal',
    paperWidth: 80,
  });

  // Load data when tab changes
  useEffect(() => {
    if (visible) {
      loadDataForTab(activeTab);
    }
  }, [activeTab, visible]);

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
    setPrinterType((allSettings['printer_type'] as any) || 'none');
    setPrinterAddress(allSettings['printer_address'] || '');
    setAutoPrintReceipt(allSettings['auto_print_receipt'] === 'true');
    
    // Load receipt design
    const savedDesign = await loadReceiptDesign();
    if (savedDesign) {
      setReceiptDesign(savedDesign);
    }
    
    // Check printer connection status
    const status = BluetoothPrinterService.getConnectionStatus();
    setPrinterConnected(status.isConnected);
    setConnectedPrinterName(status.device?.name || null);
  };

  // Bluetooth scanning
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
    Alert.alert('✅ Appareil sélectionné', `${device.name}\n${device.address}`);
  };

  // Save receipt design
  const handleSaveReceiptDesign = async () => {
    try {
      await saveReceiptDesign(receiptDesign);
      setShowReceiptDesignModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('✅ Sauvegardé', 'Le design du reçu a été sauvegardé.');
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
    // Don't allow deleting the last admin
    const admins = users.filter(u => u.role === 'admin');
    if (user.role === 'admin' && admins.length <= 1) {
      Alert.alert('Erreur', 'Vous ne pouvez pas supprimer le dernier admin');
      return;
    }

    Alert.alert('Supprimer', `Supprimer "${user.name}"?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await offlineUserService.delete(user.id);
          await loadUsers();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  // ==================== SETTINGS ====================

  const saveSettings = async () => {
    try {
      await offlineSettingsService.set('restaurant_name', restaurantName);
      await offlineSettingsService.set('restaurant_address', restaurantAddress);
      await offlineSettingsService.set('restaurant_phone', restaurantPhone);
      await offlineSettingsService.set('printer_type', printerType);
      await offlineSettingsService.set('printer_address', printerAddress);
      await offlineSettingsService.set('auto_print_receipt', autoPrintReceipt ? 'true' : 'false');
      Alert.alert('✅ Sauvegardé', 'Paramètres enregistrés');
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
    <View style={{ flex: 1, padding: spacing.xl, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
          ...shadows.md,
        }}>
          <Settings size={32} color={colors.white} />
        </View>
        <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>
          Administration
        </Text>
        <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs }}>
          Gérez votre point de vente
        </Text>
      </View>
      
      <View style={{ 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        gap: spacing.md,
        justifyContent: 'center',
      }}>
        <TouchableOpacity
          onPress={() => setActiveTab('categories')}
          style={{
            width: isTablet ? 180 : '47%',
            alignItems: 'center',
            backgroundColor: colors.white,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            ...shadows.sm,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Grid3x3 size={28} color={colors.primary} />
          </View>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' }}>Catégories</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>Organiser les produits</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('products')}
          style={{
            width: isTablet ? 180 : '47%',
            alignItems: 'center',
            backgroundColor: colors.white,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            ...shadows.sm,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Package size={28} color={colors.success} />
          </View>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' }}>Produits</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>Ajouter et modifier</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('users')}
          style={{
            width: isTablet ? 180 : '47%',
            alignItems: 'center',
            backgroundColor: colors.white,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            ...shadows.sm,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Users size={28} color={colors.warning} />
          </View>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' }}>Utilisateurs</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>Gérer les accès</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('settings')}
          style={{
            width: isTablet ? 180 : '47%',
            alignItems: 'center',
            backgroundColor: colors.white,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            ...shadows.sm,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: borderRadius.lg, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Coffee size={28} color="#9333EA" />
          </View>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' }}>Paramètres</Text>
          <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>Configuration</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCategoriesTab = () => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: spacing.lg, 
        backgroundColor: colors.white, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.borderLight,
        ...shadows.sm,
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: spacing.sm }}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, marginLeft: spacing.sm }}>Catégories</Text>
        <TouchableOpacity
          onPress={openAddCategory}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: colors.primary, 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.md, 
            borderRadius: borderRadius.full, 
            gap: spacing.xs 
          }}
        >
          <Plus size={18} color={colors.white} />
          <Text style={{ color: colors.white, fontWeight: '600', fontSize: fontSize.sm }}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
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
              <View style={{ width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                <Grid3x3 size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>{item.name}</Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 }}>{item.productCount || 0} produits</Text>
              </View>
              <TouchableOpacity onPress={() => openEditCategory(item)} style={{ padding: spacing.md }}>
                <Pencil size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCategory(item)} style={{ padding: spacing.md }}>
                <Trash2 size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Grid3x3 size={48} color={colors.border} />
              <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.lg }}>Aucune catégorie</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs }}>Appuyez sur + pour en créer une</Text>
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: spacing.lg, 
        backgroundColor: colors.white, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.borderLight,
        ...shadows.sm,
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: spacing.sm }}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, marginLeft: spacing.sm }}>Produits</Text>
        
        {/* View Mode Toggle */}
        <TouchableOpacity
          onPress={() => setProductViewMode(productViewMode === 'list' ? 'grid' : 'list')}
          style={{ 
            padding: spacing.md, 
            marginRight: spacing.sm,
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
          }}
        >
          {productViewMode === 'list' ? (
            <LayoutGrid size={20} color={colors.textSecondary} />
          ) : (
            <List size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={openAddProduct}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: colors.success, 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.md, 
            borderRadius: borderRadius.full, 
            gap: spacing.xs 
          }}
        >
          <Plus size={18} color={colors.white} />
          <Text style={{ color: colors.white, fontWeight: '600', fontSize: fontSize.sm }}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              fontSize: fontSize.md,
              color: colors.textPrimary,
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
          contentContainerStyle={{ padding: spacing.lg }}
          renderItem={({ item }) => {
            const isLowStock = item.stockQuantity >= 0 && item.stockQuantity <= item.lowStockThreshold;
            const isOutOfStock = item.stockQuantity === 0;
            
            return (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: item.isActive ? colors.white : colors.background,
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                marginBottom: spacing.md,
                opacity: item.isActive ? 1 : 0.7,
                borderLeftWidth: item.stockQuantity >= 0 ? 4 : 0,
                borderLeftColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success,
                ...shadows.sm,
              }}>
                {/* Product Image or Icon */}
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: borderRadius.md,
                    }}
                  />
                ) : (
                  <View style={{ width: 50, height: 50, borderRadius: borderRadius.md, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={24} color={colors.success} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>{item.name}</Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 }}>{item.categoryName} • {item.price.toFixed(0)} DH</Text>
                  {item.stockQuantity >= 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <Package size={12} color={isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.textMuted} />
                      <Text style={{ 
                        fontSize: fontSize.xs, 
                        color: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.textMuted,
                        fontWeight: isLowStock ? '600' : '400',
                      }}>
                        Stock: {item.stockQuantity} {isOutOfStock ? '(RUPTURE)' : isLowStock ? '(BAS)' : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => toggleProductActive(item)} style={{ padding: spacing.md }}>
                  {item.isActive ? <Eye size={18} color={colors.success} /> : <EyeOff size={18} color={colors.textMuted} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEditProduct(item)} style={{ padding: spacing.md }}>
                  <Pencil size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteProduct(item)} style={{ padding: spacing.md }}>
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Package size={48} color={colors.border} />
              <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.lg }}>Aucun produit</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs }}>Appuyez sur + pour en créer un</Text>
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
                  backgroundColor: item.isActive ? colors.white : colors.background,
                  borderRadius: borderRadius.lg,
                  marginBottom: GRID_GAP,
                  opacity: item.isActive ? 1 : 0.7,
                  overflow: 'hidden',
                  borderWidth: item.stockQuantity >= 0 ? 2 : 0,
                  borderColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.successLight,
                  ...shadows.sm,
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
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: isOutOfStock ? colors.error : isLowStock ? colors.warning : colors.success,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.white }}>
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
                      height: 120,
                      backgroundColor: colors.background,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ 
                  width: '100%', 
                  height: 120, 
                  backgroundColor: colors.successLight, 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Package size={40} color={colors.success} />
                </View>
              )}
              
              {/* Product Info */}
              <View style={{ padding: spacing.md }}>
                <Text 
                  style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
                  {item.categoryName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: colors.success }}>
                    {item.price.toFixed(0)} DH
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <TouchableOpacity 
                      onPress={() => toggleProductActive(item)} 
                      style={{ padding: 4 }}
                    >
                      {item.isActive ? <Eye size={16} color={colors.success} /> : <EyeOff size={16} color={colors.textMuted} />}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => deleteProduct(item)} 
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, flex: 1 }}>
              <Package size={48} color={colors.border} />
              <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.lg }}>Aucun produit</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs }}>Appuyez sur + pour en créer un</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderUsersTab = () => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: spacing.lg, 
        backgroundColor: colors.white, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.borderLight,
        ...shadows.sm,
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: spacing.sm }}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, marginLeft: spacing.sm }}>Utilisateurs</Text>
        <TouchableOpacity
          onPress={openAddUser}
          style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            backgroundColor: colors.warning, 
            paddingHorizontal: spacing.lg, 
            paddingVertical: spacing.md, 
            borderRadius: borderRadius.full, 
            gap: spacing.xs 
          }}
        >
          <Plus size={18} color={colors.white} />
          <Text style={{ color: colors.white, fontWeight: '600', fontSize: fontSize.sm }}>Ajouter</Text>
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
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}>
              <View style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 20, 
                backgroundColor: item.role === 'admin' ? '#FEF3C7' : item.role === 'waiter' ? '#DBEAFE' : '#F3F4F6', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Text style={{ fontSize: 18 }}>{item.role === 'admin' ? '👑' : item.role === 'waiter' ? '🍽️' : '💰'}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{item.name}</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  {item.role === 'admin' ? 'Administrateur' : item.role === 'waiter' ? 'Serveur' : 'Caissier'} • PIN: ****
                </Text>
              </View>
              <TouchableOpacity onPress={() => openEditUser(item)} style={{ padding: 10 }}>
                <Pencil size={18} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteUser(item)} style={{ padding: 10 }}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Users size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 16 }}>Aucun utilisateur</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderSettingsTab = () => (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: spacing.lg, 
        backgroundColor: colors.white, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.borderLight,
        ...shadows.sm,
      }}>
        <TouchableOpacity onPress={() => setActiveTab('menu')} style={{ padding: spacing.sm }}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, marginLeft: spacing.sm }}>Paramètres</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {/* Restaurant Info */}
        <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg, ...shadows.sm }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.lg }}>🏪 Informations du restaurant</Text>
          
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Nom</Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: fontSize.md,
              color: colors.textPrimary,
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
              color: colors.textPrimary,
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
              color: colors.textPrimary,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
            value={restaurantPhone}
            onChangeText={setRestaurantPhone}
            placeholder="Téléphone"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            onPress={saveSettings}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              borderRadius: borderRadius.md,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            <Save size={18} color={colors.white} />
            <Text style={{ color: colors.white, fontWeight: '600', fontSize: fontSize.md }}>Sauvegarder</Text>
          </TouchableOpacity>
        </View>

        {/* Database Info */}
        <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg, ...shadows.sm }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.lg }}>🗄️ Base de données</Text>
          
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
                backgroundColor: colors.warningLight,
                paddingVertical: spacing.md,
                borderRadius: borderRadius.md,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              <Trash2 size={16} color={colors.warning} />
              <Text style={{ color: colors.warning, fontWeight: '600' }}>Vider la file de sync</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Printer Settings */}
        <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg, ...shadows.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm }}>
            <Printer size={20} color={colors.primary} />
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary }}>Imprimante de reçus</Text>
          </View>
          
          {/* Bluetooth Connection Status Banner */}
          {printerType === 'bluetooth' && (
            <TouchableOpacity
              onPress={() => setShowBluetoothModal(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: spacing.md,
                backgroundColor: printerConnected ? '#D1FAE5' : '#FEF3C7',
                borderRadius: borderRadius.lg,
                gap: spacing.md,
                marginBottom: spacing.lg,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: printerConnected ? colors.success : colors.warning,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {printerConnected ? (
                  <BluetoothConnected size={20} color={colors.white} />
                ) : (
                  <Bluetooth size={20} color={colors.white} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: fontSize.sm, 
                  fontWeight: '600', 
                  color: printerConnected ? '#065F46' : '#92400E' 
                }}>
                  {printerConnected ? '✓ Imprimante connectée' : '⚡ Connexion rapide'}
                </Text>
                <Text style={{ 
                  fontSize: fontSize.xs, 
                  color: printerConnected ? '#047857' : '#B45309',
                  marginTop: 2,
                }}>
                  {printerConnected 
                    ? connectedPrinterName || 'Connectée' 
                    : 'Appuyez pour connecter'}
                </Text>
              </View>
              <View style={{
                backgroundColor: printerConnected ? colors.success : colors.primary,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.md,
              }}>
                <Text style={{ color: colors.white, fontSize: fontSize.xs, fontWeight: '600' }}>
                  {printerConnected ? 'Gérer' : 'Connecter'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          {/* Printer Type Selection */}
          <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>Type de connexion</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
            {[
              { value: 'none', label: 'Aucune', icon: X, color: colors.textMuted },
              { value: 'bluetooth', label: 'Bluetooth', icon: Bluetooth, color: '#3B82F6' },
              { value: 'wifi', label: 'WiFi', icon: Wifi, color: colors.success },
              { value: 'usb', label: 'USB', icon: Usb, color: colors.warning },
            ].map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setPrinterType(type.value as any)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.sm,
                  borderRadius: borderRadius.lg,
                  backgroundColor: printerType === type.value ? colors.primaryLight : colors.background,
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: printerType === type.value ? colors.primary : 'transparent',
                }}
              >
                <type.icon size={20} color={printerType === type.value ? colors.primary : type.color} />
                <Text style={{ 
                  fontSize: fontSize.xs, 
                  color: printerType === type.value ? colors.primary : colors.textSecondary,
                  marginTop: 4,
                  fontWeight: printerType === type.value ? '600' : '400',
                }}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Printer Address (only show for wifi) */}
          {printerType === 'wifi' && (
            <>
              <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>
                Adresse IP
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                  }}
                  value={printerAddress}
                  onChangeText={setPrinterAddress}
                  placeholder="192.168.1.100"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </>
          )}
          
          {/* Auto Print Toggle */}
          <TouchableOpacity
            onPress={() => setAutoPrintReceipt(!autoPrintReceipt)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: autoPrintReceipt ? colors.successLight : colors.background,
              borderRadius: borderRadius.lg,
              gap: spacing.md,
              marginBottom: spacing.md,
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
              <Text style={{ fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' }}>
                Impression automatique
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.textSecondary }}>
                Imprimer le reçu après chaque paiement
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* Receipt Design Button */}
          <TouchableOpacity
            onPress={() => setShowReceiptDesignModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: colors.primaryLight,
              borderRadius: borderRadius.lg,
              gap: spacing.md,
              marginBottom: spacing.md,
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
          
          {/* Printer Test Button */}
          <TouchableOpacity
            onPress={() => {
              onClose();
              setTimeout(() => router.push('/printer-test' as any), 300);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              backgroundColor: '#7C3AED',
              borderRadius: borderRadius.lg,
              gap: spacing.md,
            }}
          >
            <Zap size={20} color={colors.white} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.white, fontWeight: '600' }}>
                🔧 Test Avancé Imprimante
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)' }}>
                USB, Bluetooth, WiFi - Test complet
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.xxl, ...shadows.sm }}>
          <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.lg }}>📱 Application</Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>Version</Text>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary }}>1.0.0</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>Mode</Text>
            <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.success }}>Hors ligne</Text>
          </View>
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Close button */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'flex-end', 
          paddingTop: spacing.lg, 
          paddingRight: spacing.lg,
          paddingBottom: spacing.sm,
          backgroundColor: activeTab === 'menu' ? colors.background : colors.white,
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {renderContent()}

        {/* Category Modal */}
        <Modal visible={showCategoryModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
            <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 400 }}>
              <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xl }}>
                {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
              </Text>
              
              <TextInput
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
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
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveCategory}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' }}
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
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 }}>
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
                          backgroundColor: colors.error,
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
                        borderRadius: borderRadius.full,
                        gap: spacing.xs,
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
                        borderRadius: borderRadius.full,
                        gap: spacing.xs,
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
                    borderRadius: 12,
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
                    borderRadius: 12,
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
                          borderRadius: 20,
                          backgroundColor: productCategoryId === cat.id ? '#4F46E5' : '#F3F4F6',
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
                  borderRadius: 12, 
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
                              backgroundColor: colors.errorLight,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Minus size={18} color={colors.error} />
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
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveProduct}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center' }}
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
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20 }}>
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </Text>
              
              <TextInput
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
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
                  { value: 'admin', label: '👑 Admin', color: '#FEF3C7' },
                  { value: 'cashier', label: '💰 Caissier', color: '#F3F4F6' },
                  { value: 'waiter', label: '🍽️ Serveur', color: '#DBEAFE' },
                ].map(role => (
                  <TouchableOpacity
                    key={role.value}
                    onPress={() => setUserRole(role.value as any)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: userRole === role.value ? '#4F46E5' : role.color,
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
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveUser}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F59E0B', alignItems: 'center' }}
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
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
            <View style={{ backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 450, maxHeight: '90%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary }}>
                  Design du reçu
                </Text>
                <TouchableOpacity onPress={() => setShowReceiptDesignModal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ maxHeight: '80%' }} showsVerticalScrollIndicator={false}>
                {/* Restaurant Info */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                  INFORMATIONS RESTAURANT
                </Text>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    marginBottom: spacing.sm,
                  }}
                  value={receiptDesign.restaurantName}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, restaurantName: text }))}
                  placeholder="Nom du restaurant"
                />
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    marginBottom: spacing.sm,
                  }}
                  value={receiptDesign.address}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, address: text }))}
                  placeholder="Adresse"
                />
                
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: colors.background,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                      fontSize: fontSize.md,
                      color: colors.textPrimary,
                    }}
                    value={receiptDesign.city}
                    onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, city: text }))}
                    placeholder="Ville"
                  />
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: colors.background,
                      borderRadius: borderRadius.md,
                      padding: spacing.md,
                      fontSize: fontSize.md,
                      color: colors.textPrimary,
                    }}
                    value={receiptDesign.phone}
                    onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, phone: text }))}
                    placeholder="Téléphone"
                  />
                </View>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    marginBottom: spacing.lg,
                  }}
                  value={receiptDesign.taxId}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, taxId: text }))}
                  placeholder="N° ICE / IF"
                />
                
                {/* Footer Messages */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                  MESSAGES DE PIED DE PAGE
                </Text>
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    marginBottom: spacing.sm,
                  }}
                  value={receiptDesign.footerMessage}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, footerMessage: text }))}
                  placeholder="Message de remerciement"
                />
                
                <TextInput
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    fontSize: fontSize.md,
                    color: colors.textPrimary,
                    marginBottom: spacing.lg,
                    textAlign: 'right',
                  }}
                  value={receiptDesign.footerMessageArabic}
                  onChangeText={(text) => setReceiptDesign(prev => ({ ...prev, footerMessageArabic: text }))}
                  placeholder="شكرا لزيارتكم"
                />
                
                {/* Paper Size */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                  TAILLE DU PAPIER
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
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
                      }}
                    >
                      <Text style={{ 
                        fontSize: fontSize.md, 
                        fontWeight: '600', 
                        color: receiptDesign.paperWidth === size ? colors.white : colors.textPrimary 
                      }}>
                        {size}mm
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Toggle Options */}
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                  OPTIONS D'AFFICHAGE
                </Text>
                
                {[
                  { key: 'showOrderNumber', label: 'Numéro de commande' },
                  { key: 'showTableNumber', label: 'Numéro de table' },
                  { key: 'showDateTime', label: 'Date et heure' },
                  { key: 'showPaymentDetails', label: 'Détails du paiement' },
                  { key: 'showTaxId', label: 'N° ICE / IF' },
                ].map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setReceiptDesign(prev => ({ ...prev, [key]: !prev[key as keyof ReceiptDesign] }))}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing.sm,
                      marginBottom: spacing.xs,
                    }}
                  >
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      backgroundColor: receiptDesign[key as keyof ReceiptDesign] ? colors.success : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: spacing.md,
                    }}>
                      {receiptDesign[key as keyof ReceiptDesign] && <Check size={16} color={colors.white} />}
                    </View>
                    <Text style={{ fontSize: fontSize.sm, color: colors.textPrimary }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Save Button */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
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
        </Modal>
      </View>
    </Modal>
  );
}
