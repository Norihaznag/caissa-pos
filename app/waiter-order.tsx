import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert, TextInput, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, CreditCard, MessageSquare, Search, X, LayoutGrid, List, Package } from 'lucide-react-native';
import { useAppStore, Order, OrderItem } from '../lib/store';
import { categoryService, productService, orderService, orderItemService, tableService } from '../lib/services';
import * as Haptics from 'expo-haptics';

// Quick cancellation reasons
const CANCEL_REASONS = [
  { id: 'client_changed_mind', label: 'Client a changé d\'avis', icon: '🔄' },
  { id: 'too_long_wait', label: 'Attente trop longue', icon: '⏰' },
  { id: 'wrong_order', label: 'Erreur de commande', icon: '❌' },
  { id: 'out_of_stock', label: 'Produit indisponible', icon: '📦' },
  { id: 'client_left', label: 'Client parti', icon: '🚪' },
  { id: 'duplicate_order', label: 'Commande en double', icon: '📋' },
];

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  note?: string;
};

type ProductViewMode = 'list' | 'grid';

export default function WaiterOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tableNumber = params.tableNumber ? Number(Array.isArray(params.tableNumber) ? params.tableNumber[0] : params.tableNumber) : 1;
  const tableId = Array.isArray(params.tableId) ? params.tableId[0] : params.tableId;
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId as string | undefined;
  const showCancelOnMount = params.showCancel === 'true';

  // Get from store
  const categories = useAppStore((state) => state.categories);
  const products = useAppStore((state) => state.products);
  const user = useAppStore((state) => state.user);
  const createOrderAndOccupyTable = useAppStore((state) => state.createOrderAndOccupyTable);
  const updateOrder = useAppStore((state) => state.updateOrder);
  const updateTable = useAppStore((state) => state.updateTable);
  const orders = useAppStore((state) => state.orders);
  const setCategories = useAppStore((state) => state.setCategories);
  const setProducts = useAppStore((state) => state.setProducts);
  const cancelOrderAndFreeTable = useAppStore((state) => state.cancelOrderAndFreeTable);

  const [selectedCategory, setSelectedCategory] = useState<string>((Array.isArray(categories) && categories[0]?.id) || '1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productViewMode, setProductViewMode] = useState<ProductViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [sending, setSending] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    if (!tableId) return; // Skip if no tableId
    try {
      setLoading(true);
      
      // Fetch categories and products from Supabase
      const [categoriesDb, productsDb] = await Promise.all([
        categoryService.getAll(),
        productService.getAll(),
      ]);
      
      // Transform and set categories
      const categoriesData = categoriesDb.map(c => ({
        id: c.id,
        name: c.name,
        order: c.display_order,
      }));
      setCategories(categoriesData);
      
      // Transform and set products
      const productsData = productsDb.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        categoryId: p.category_id,
        isActive: p.is_active,
        imageUrl: p.image_url,
      }));
      setProducts(productsData);
      
      // Set initial category
      if (categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].id);
      }
      
      // Load existing order if editing
      if (orderId) {
        const itemsDb = await orderItemService.getByOrderId(orderId);
        const cartItems: CartItem[] = itemsDb.map(item => ({
          productId: item.product_id,
          productName: item.product_name,
          price: item.price,
          quantity: item.quantity,
        }));
        setCart(cartItems);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, [orderId, setCategories, setProducts, tableId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show cancel modal if coming from tables with showCancel param
  useEffect(() => {
    if (showCancelOnMount && orderId) {
      setShowCancelModal(true);
    }
  }, [showCancelOnMount, orderId]);

  // Filter products by selected category and search
  const filteredProducts = Array.isArray(products) 
    ? products.filter(p => {
        if (!p) return false;
        const matchesCategory = (searchQuery?.length || 0) > 0 || p.categoryId === selectedCategory;
        const matchesSearch = (searchQuery?.length || 0) === 0 || 
          (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
        const isActive = p.isActive !== false;
        return matchesCategory && matchesSearch && isActive;
      })
    : [];

  // Add product to cart
  const addToCart = (productId: string, productName: string, price: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === productId);
      if (existingItem) {
        return prevCart.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          productId,
          productName,
          price,
          quantity: 1,
        }];
      }
    });
  };

  // Update quantity
  const updateQuantity = (productId: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart(prevCart => {
      return prevCart
        .map(item => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + delta;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(item => item.quantity > 0);
    });
  };

  // Remove item from cart
  const removeFromCart = (productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  // Add or update note for cart item
  const updateItemNote = (productId: string, note: string) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId ? { ...item, note } : item
      )
    );
  };

  // Save note and close
  const saveNote = () => {
    if (editingNoteFor) {
      updateItemNote(editingNoteFor, noteText);
      setEditingNoteFor(null);
      setNoteText('');
    }
  };

  // Open note editor
  const openNoteEditor = (productId: string, currentNote: string = '') => {
    setEditingNoteFor(productId);
    setNoteText(currentNote);
  };

  // Calculate total
  const total = Array.isArray(cart) 
    ? cart.reduce((sum, item) => {
        if (!item) return sum;
        return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0));
      }, 0)
    : 0;

  // Get cart item count
  const cartItemCount = Array.isArray(cart) 
    ? cart.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)
    : 0;

  // Send order to kitchen
  const sendToKitchen = async () => {
    if (sending) return; // Prevent double-submission
    if (cart.length === 0) {
      Alert.alert('Panier Vide', 'Ajoutez des produits avant d\'envoyer.');
      return;
    }

    setSending(true);
    try {
      if (orderId) {
        // Edit existing order - update items in Supabase
        // First delete old items, then add new ones
        const existingItems = await orderItemService.getByOrderId(orderId);
        for (const item of existingItems) {
          await orderItemService.delete(item.id);
        }
        
        // Add new items
        const orderItems = cart.map(item => ({
          order_id: orderId,
          product_id: item.productId,
          product_name: item.productName,
          price: item.price,
          quantity: item.quantity,
          note: item.note || undefined,
        }));
        await orderItemService.createMany(orderItems);
        
        // Update order status and total in Supabase
        await orderService.updateStatus(orderId, 'NEW');
        await orderService.update(orderId, { total_amount: total });
        
        // Update local store
        const storeItems: OrderItem[] = cart.map((item, index) => ({
          id: item.productId + '-' + index,
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
        }));
        
        useAppStore.getState().updateOrder(orderId, {
          items: storeItems,
          totalAmount: total,
          updatedAt: new Date()
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Commande Modifiée', 'La commande a été mise à jour.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        // Create new order in Supabase
        const newOrderDb = await orderService.create({
          table_id: tableId,
          waiter_id: user?.id || null,
          status: 'NEW',
          is_served: false,
          total_amount: total,
        });
        
        // Create order items
        const orderItems = cart.map(item => ({
          order_id: newOrderDb.id,
          product_id: item.productId,
          product_name: item.productName,
          price: item.price,
          quantity: item.quantity,
          note: item.note || undefined,
        }));
        await orderItemService.createMany(orderItems);
        
        // Update table status
        await tableService.setOccupied(tableId, newOrderDb.id);
        
        // Update local store
        const storeItems: OrderItem[] = cart.map((item, index) => ({
          id: item.productId + '-' + index,
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
        }));
        
        const newOrder: Order = {
          id: newOrderDb.id,
          tableId: tableId,
          tableNumber: tableNumber,
          items: storeItems,
          status: 'NEW',
          isServed: false,
          totalAmount: total,
          createdAt: newOrderDb.created_at ? new Date(newOrderDb.created_at) : new Date(),
          updatedAt: newOrderDb.updated_at ? new Date(newOrderDb.updated_at) : new Date(),
          waiterId: user?.id,
          waiterName: user?.name || 'Serveur',
        };
        
        useAppStore.getState().createOrderAndOccupyTable(newOrder, tableId);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Commande Envoyée',
          `Table ${tableNumber}\nTotal: ${total} MAD\n\nLa commande a été envoyée à la cuisine.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCart([]);
                router.back();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error saving order:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la commande. Vérifiez votre connexion.');
    } finally {
      setSending(false);
    }
  };

  // Navigate to payment
  const goToPayment = () => {
    if (cart.length === 0) {
      Alert.alert('Panier Vide', 'Ajoutez des produits avant de procéder au paiement.');
      return;
    }
    
    // If editing an existing order, use that orderId
    if (orderId) {
      router.push({
        pathname: '/waiter-payment',
        params: { tableNumber, tableId, orderId }
      });
    } else {
      // For new orders, need to send to kitchen first to create the order
      Alert.alert(
        'Envoyer à la cuisine',
        'Vous devez d\'abord envoyer la commande en cuisine avant de procéder au paiement.',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Envoyer', 
            onPress: async () => {
              await sendToKitchen();
            }
          }
        ]
      );
    }
  };

  // Cancel the current order
  const cancelOrder = () => {
    if (!orderId) {
      // Just clearing cart for new orders
      if (cart.length === 0) {
        router.back();
        return;
      }
      Alert.alert(
        'Annuler la commande?',
        'Voulez-vous vraiment annuler et vider le panier?',
        [
          { text: 'Non', style: 'cancel' },
          {
            text: 'Oui, Annuler',
            style: 'destructive',
            onPress: () => {
              setCart([]);
              router.back();
            }
          }
        ]
      );
      return;
    }

    // For existing orders - show reason modal
    setCancelReason('');
    setCustomReason('');
    setShowCancelModal(true);
  };

  // Confirm cancellation with reason
  const confirmCancellation = async () => {
    if (!orderId) {
      Alert.alert('Erreur', 'ID de commande manquant');
      setShowCancelModal(false);
      return;
    }
    
    const finalReason = cancelReason === 'custom' ? customReason : 
      CANCEL_REASONS.find(r => r.id === cancelReason)?.label || cancelReason;
    
    if (!finalReason.trim()) {
      Alert.alert('Raison requise', 'Veuillez sélectionner ou saisir une raison d\'annulation.');
      return;
    }

    try {
      // Update order status in Supabase with reason
      await orderService.cancelOrder(orderId, finalReason);
      
      // Free the table in Supabase
      await tableService.setOpen(tableId);
      
      // Update local store
      cancelOrderAndFreeTable(orderId, tableId, finalReason);
      
      setShowCancelModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Commande Annulée',
        `La commande de la Table ${tableNumber} a été annulée.\n\nRaison: ${finalReason}`,
        [{ text: 'OK', onPress: () => router.replace('/waiter-tables') }]
      );
    } catch (error) {
      console.error('Error cancelling order:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible d\'annuler la commande. Réessayez.');
    }
  };

  // Get quantity for a product in cart
  const getProductQuantity = (productId: string): number => {
    const item = cart.find(item => item.productId === productId);
    return item ? item.quantity : 0;
  };

  // Show error if tableId is missing (after all hooks)
  if (!tableId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#EF4444', fontSize: 16, marginBottom: 16 }}>ID de table manquant</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 12, backgroundColor: '#3B82F6', borderRadius: 8 }}>
          <Text style={{ color: '#FFFFFF' }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft color="#374151" size={20} />
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                Table {tableNumber}
              </Text>
              {orderId && (
                <Text style={{ fontSize: 13, color: '#6B7280' }}>Modifier commande</Text>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Cancel Order Button */}
            <TouchableOpacity
              onPress={cancelOrder}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X color="#EF4444" size={22} />
            </TouchableOpacity>
            {/* Cart Toggle Button */}
            <TouchableOpacity
              onPress={() => setShowCart(!showCart)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: showCart ? '#3B82F6' : '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShoppingCart color={showCart ? '#FFFFFF' : '#3B82F6'} size={22} />
              {cartItemCount > 0 && (
                <View style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: '#EF4444',
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{cartItemCount}</Text>
              </View>
            )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar + View Toggle */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F9FAFB', flexDirection: 'row', gap: 8 }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 44,
          }}>
            <Search size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un produit..."
              style={{ flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' }}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          {/* Grid/List Toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: 2 }}>
            <TouchableOpacity
              onPress={() => setProductViewMode('list')}
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: productViewMode === 'list' ? '#EFF6FF' : 'transparent',
              }}
            >
              <List size={20} color={productViewMode === 'list' ? '#3B82F6' : '#9CA3AF'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setProductViewMode('grid')}
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: productViewMode === 'grid' ? '#EFF6FF' : 'transparent',
              }}
            >
              <LayoutGrid size={20} color={productViewMode === 'grid' ? '#3B82F6' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Tabs */}
        {searchQuery.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: selectedCategory === category.id ? '#EFF6FF' : 'transparent',
                  borderBottomWidth: 2,
                  borderBottomColor: selectedCategory === category.id ? '#3B82F6' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: selectedCategory === category.id ? '600' : '500',
                    color: selectedCategory === category.id ? '#3B82F6' : '#6B7280',
                  }}
                >
                  {category.name}
                </Text>
            </TouchableOpacity>
          ))}
          </ScrollView>
        )}
      </View>

      {/* Main Content */}
      {!showCart ? (
        // Product List or Grid
        productViewMode === 'list' ? (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
            renderItem={({ item }) => {
              const quantity = getProductQuantity(item.id);
              return (
                <TouchableOpacity
                  onPress={() => addToCart(item.id, item.name, item.price)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: '#FFFFFF',
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                  }}
                  activeOpacity={0.7}
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
                    <Text style={{ fontSize: 15, color: '#111827', fontWeight: '500' }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 16, color: '#3B82F6', fontWeight: '700', marginTop: 4 }}>
                      {item.price} MAD
                    </Text>
                  </View>
                  {quantity > 0 && (
                    <View style={{
                      backgroundColor: '#EFF6FF',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#DBEAFE',
                    }}>
                      <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 14 }}>x{quantity}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 16, color: '#9CA3AF' }}>Aucun produit trouvé</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={filteredProducts}
            numColumns={2}
            key="grid"
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12, flexGrow: 1 }}
            columnWrapperStyle={{ gap: 10 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => {
              const quantity = getProductQuantity(item.id);
              return (
                <TouchableOpacity
                  onPress={() => addToCart(item.id, item.name, item.price)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: quantity > 0 ? '#EFF6FF' : '#FFFFFF',
                    borderRadius: 12,
                    padding: 10,
                    borderWidth: quantity > 0 ? 2 : 1,
                    borderColor: quantity > 0 ? '#3B82F6' : '#E5E7EB',
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B82F6' }}>
                      {item.price} MAD
                    </Text>
                    {quantity > 0 && (
                      <View style={{ 
                        backgroundColor: '#3B82F6', 
                        paddingHorizontal: 6, 
                        paddingVertical: 3, 
                        borderRadius: 6 
                      }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>x{quantity}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Text style={{ fontSize: 16, color: '#9CA3AF' }}>Aucun produit trouvé</Text>
              </View>
            }
          />
        )
      ) : (
        // Cart View
        <View style={{ flex: 1 }}>
          {cart.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <ShoppingCart color="#D1D5DB" size={64} />
              <Text style={{ fontSize: 18, color: '#6B7280', fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
                Panier Vide
              </Text>
              <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                Ajoutez des produits pour commencer
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={(item) => item.productId}
                contentContainerStyle={{ paddingBottom: 16 }}
                renderItem={({ item }) => (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ flex: 1, fontSize: 15, color: '#111827', fontWeight: '500' }}>
                        {item.productName}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => openNoteEditor(item.productId, item.note || '')}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            backgroundColor: item.note ? '#FEF3C7' : '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MessageSquare color={item.note ? '#CA8A04' : '#6B7280'} size={16} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeFromCart(item.productId)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            backgroundColor: '#FEE2E2',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Trash2 color="#EF4444" size={16} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {item.note && (
                      <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginBottom: 10 }}>
                        <Text style={{ fontSize: 13, color: '#92400E' }}>
                          📝 {item.note}
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, -1)}
                          style={{
                            width: 36,
                            height: 36,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <Minus color="#374151" size={16} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', minWidth: 30, textAlign: 'center' }}>
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, 1)}
                          style={{
                            width: 36,
                            height: 36,
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <Plus color="#374151" size={16} />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: 17, color: '#3B82F6', fontWeight: '700' }}>
                        {item.price * item.quantity} MAD
                      </Text>
                    </View>
                  </View>
                )}
              />
            </>
          )}
        </View>
      )}

      {/* Bottom Bar */}
      {cart.length > 0 && (
        <View style={{
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingHorizontal: 16,
          paddingVertical: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '500' }}>Total</Text>
            <Text style={{ fontSize: 24, color: '#3B82F6', fontWeight: '700' }}>{total} MAD</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={sendToKitchen}
              style={{
                flex: 1,
                backgroundColor: '#3B82F6',
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                Envoyer Cuisine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={goToPayment}
              style={{
                flex: 1,
                backgroundColor: '#22C55E',
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              activeOpacity={0.8}
            >
              <CreditCard size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                Payer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Note Editor Modal */}
      {editingNoteFor && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            width: '100%',
            maxWidth: 360,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 16,
            elevation: 10,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 }}>
              Note pour la cuisine
            </Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Ex: Sans sucre, bien cuit, allergies..."
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 10,
                padding: 12,
                fontSize: 15,
                color: '#111827',
                minHeight: 90,
                backgroundColor: '#F9FAFB',
              }}
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  setEditingNoteFor(null);
                  setNoteText('');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#6B7280', fontSize: 15 }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveNote}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: '#3B82F6',
                  borderRadius: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#FFFFFF', fontSize: 15 }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Cancel Order Modal */}
      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                Annuler la commande
              </Text>
              <TouchableOpacity
                onPress={() => setShowCancelModal(false)}
                style={{ padding: 8 }}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
              Table {tableNumber} • Sélectionnez une raison d'annulation
            </Text>

            {/* Quick Reasons */}
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {CANCEL_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  onPress={() => {
                    setCancelReason(reason.id);
                    setCustomReason('');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    backgroundColor: cancelReason === reason.id ? '#FEE2E2' : '#F9FAFB',
                    borderRadius: 10,
                    marginBottom: 8,
                    borderWidth: 2,
                    borderColor: cancelReason === reason.id ? '#EF4444' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{reason.icon}</Text>
                  <Text style={{ fontSize: 15, color: cancelReason === reason.id ? '#B91C1C' : '#374151', fontWeight: cancelReason === reason.id ? '600' : '400' }}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Custom Reason */}
              <TouchableOpacity
                onPress={() => setCancelReason('custom')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  backgroundColor: cancelReason === 'custom' ? '#FEE2E2' : '#F9FAFB',
                  borderRadius: 10,
                  marginBottom: 8,
                  borderWidth: 2,
                  borderColor: cancelReason === 'custom' ? '#EF4444' : 'transparent',
                }}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>✏️</Text>
                <Text style={{ fontSize: 15, color: cancelReason === 'custom' ? '#B91C1C' : '#374151', fontWeight: cancelReason === 'custom' ? '600' : '400' }}>
                  Autre raison...
                </Text>
              </TouchableOpacity>

              {cancelReason === 'custom' && (
                <TextInput
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Saisir la raison..."
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 15,
                    color: '#111827',
                    backgroundColor: '#FFFFFF',
                    marginBottom: 8,
                  }}
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                />
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <TouchableOpacity
                onPress={() => setShowCancelModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#6B7280', fontSize: 15 }}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancellation}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  backgroundColor: '#EF4444',
                  borderRadius: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#FFFFFF', fontSize: 15 }}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}