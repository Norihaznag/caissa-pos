import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, CreditCard, MessageSquare, Search, X } from 'lucide-react-native';
import { useAppStore, Order, OrderItem } from '../lib/store';
import { categoryService, productService, orderService, orderItemService, tableService } from '../lib/services';
import * as Haptics from 'expo-haptics';

type CartItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  note?: string;
};

export default function WaiterOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tableNumber = params.tableNumber ? Number(params.tableNumber) : 1;
  const tableId = params.tableId as string;
  const orderId = params.orderId as string | undefined;

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

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || '1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load data from Supabase
  const loadData = useCallback(async () => {
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
  }, [orderId, setCategories, setProducts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter products by selected category and search
  const filteredProducts = products.filter(p => {
    const matchesCategory = searchQuery.length > 0 || p.categoryId === selectedCategory;
    const matchesSearch = searchQuery.length === 0 || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isActive = p.isActive;
    return matchesCategory && matchesSearch && isActive;
  });

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
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Get cart item count
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Send order to kitchen
  const sendToKitchen = async () => {
    if (cart.length === 0) {
      Alert.alert('Panier Vide', 'Ajoutez des produits avant d\'envoyer.');
      return;
    }

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
        }));
        await orderItemService.createMany(orderItems);
        
        // Update order total
        await orderService.updateStatus(orderId, 'NEW');
        
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
          createdAt: new Date(newOrderDb.created_at),
          updatedAt: new Date(newOrderDb.updated_at),
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
    }
  };

  // Navigate to payment
  const goToPayment = () => {
    if (cart.length === 0) {
      Alert.alert('Panier Vide', 'Ajoutez des produits avant de procéder au paiement.');
      return;
    }
    router.push({
      pathname: '/waiter-payment',
      params: { tableNumber, orderId: `ORD-${Date.now()}` }
    });
  };

  // Get quantity for a product in cart
  const getProductQuantity = (productId: string): number => {
    const item = cart.find(item => item.productId === productId);
    return item ? item.quantity : 0;
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="border-b border-gray-300">
        <View className="flex-row items-center justify-between px-4 py-3">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft color="#000" size={24} />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-black">
              Table {tableNumber}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCart(!showCart)}
            className="relative"
          >
            <ShoppingCart color="#3B82F6" size={24} />
            {cartItemCount > 0 && (
              <View className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">{cartItemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <View className="flex-row items-center bg-white border border-gray-200 rounded-lg px-3 py-2">
            <Search size={18} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un produit..."
              className="flex-1 ml-2 text-gray-900"
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Tabs */}
        {searchQuery.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="border-t border-gray-300"
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                className={`px-4 py-3 border-r border-gray-300 ${
                  selectedCategory === category.id ? 'bg-blue-50' : ''
                }`}
              >
              <Text
                className={`text-base ${
                  selectedCategory === category.id
                    ? 'text-blue-600 font-bold'
                    : 'text-gray-700'
                }`}
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
        // Product List
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            const quantity = getProductQuantity(item.id);
            return (
              <TouchableOpacity
                onPress={() => addToCart(item.id, item.name, item.price)}
                className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200"
              >
                <View className="flex-1">
                  <Text className="text-base text-black font-medium">
                    {item.name}
                  </Text>
                  <Text className="text-lg text-blue-600 font-bold mt-1">
                    {item.price} MAD
                  </Text>
                </View>
                {quantity > 0 && (
                  <View className="bg-blue-50 px-3 py-1 rounded">
                    <Text className="text-blue-600 font-bold">x{quantity}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        // Cart View
        <View className="flex-1">
          {cart.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <ShoppingCart color="#D1D5DB" size={64} />
              <Text className="text-gray-500 text-lg mt-4 text-center">
                Panier Vide
              </Text>
              <Text className="text-gray-400 text-center mt-2">
                Ajoutez des produits pour commencer
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={(item) => item.productId}
                contentContainerStyle={{ paddingBottom: 120 }}
                renderItem={({ item }) => (
                  <View className="px-4 py-4 border-b border-gray-200">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-base text-black font-medium flex-1">
                        {item.productName}
                      </Text>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => openNoteEditor(item.productId, item.note || '')}
                          className={`${item.note ? 'bg-yellow-100' : 'bg-gray-100'} p-1 rounded`}
                        >
                          <MessageSquare color={item.note ? '#CA8A04' : '#6B7280'} size={18} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeFromCart(item.productId)}
                        >
                          <Trash2 color="#EF4444" size={20} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {item.note && (
                      <View className="bg-yellow-50 px-2 py-1 rounded mb-2">
                        <Text className="text-sm text-yellow-700">
                          📝 {item.note}
                        </Text>
                      </View>
                    )}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, -1)}
                          className="w-8 h-8 border border-gray-300 items-center justify-center rounded"
                        >
                          <Minus color="#000" size={16} />
                        </TouchableOpacity>
                        <Text className="text-lg font-bold text-black min-w-[30px] text-center">
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, 1)}
                          className="w-8 h-8 border border-gray-300 items-center justify-center rounded"
                        >
                          <Plus color="#000" size={16} />
                        </TouchableOpacity>
                      </View>
                      <Text className="text-lg text-blue-600 font-bold">
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
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 px-4 py-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg text-gray-700 font-medium">Total</Text>
            <Text className="text-2xl text-blue-600 font-bold">{total} MAD</Text>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={sendToKitchen}
              className="flex-1 bg-blue-600 py-4 rounded items-center"
            >
              <Text className="text-white text-base font-bold">
                Envoyer Cuisine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={goToPayment}
              className="flex-1 bg-green-500 py-4 rounded items-center flex-row justify-center gap-2"
            >
              <CreditCard size={20} color="#FFFFFF" />
              <Text className="text-white text-base font-bold">
                Payer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Note Editor Modal */}
      {editingNoteFor && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-4">
          <View className="bg-white rounded-lg w-full max-w-sm p-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">
              Note pour la cuisine
            </Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Ex: Sans sucre, bien cuit, allergies..."
              multiline
              numberOfLines={3}
              className="border border-gray-300 rounded-lg p-3 text-gray-900 min-h-[80px]"
              textAlignVertical="top"
            />
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => {
                  setEditingNoteFor(null);
                  setNoteText('');
                }}
                className="flex-1 py-3 bg-gray-200 rounded-lg"
              >
                <Text className="text-center font-semibold text-gray-700">Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveNote}
                className="flex-1 py-3 bg-blue-500 rounded-lg"
              >
                <Text className="text-center font-semibold text-white">Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}