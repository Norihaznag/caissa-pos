import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, CreditCard, MessageSquare, Search, X } from 'lucide-react-native';
import { useAppStore, Order, OrderItem } from '../lib/store';
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

  useEffect(() => {
    // Initialize mock data if empty
    if (categories.length === 0) {
      setCategories([
        { id: '1', name: 'Boissons Chaudes', order: 1 },
        { id: '2', name: 'Boissons Froides', order: 2 },
        { id: '3', name: 'Jus', order: 3 },
        { id: '4', name: 'Pâtisserie', order: 4 },
        { id: '5', name: 'Sandwichs', order: 5 },
        { id: '6', name: 'Salades', order: 6 },
      ]);
    }
    if (products.length === 0) {
      setProducts([
        { id: '1', name: 'Café Noir', price: 5, categoryId: '1', isActive: true },
        { id: '2', name: 'Café au Lait', price: 7, categoryId: '1', isActive: true },
        { id: '3', name: 'Noisette', price: 6, categoryId: '1', isActive: true },
        { id: '4', name: 'Cappuccino', price: 12, categoryId: '1', isActive: true },
        { id: '5', name: 'Thé à la Menthe', price: 5, categoryId: '1', isActive: true },
        { id: '6', name: 'Thé Vert', price: 5, categoryId: '1', isActive: true },
        { id: '7', name: 'Coca Cola', price: 8, categoryId: '2', isActive: true },
        { id: '8', name: 'Fanta', price: 8, categoryId: '2', isActive: true },
        { id: '9', name: 'Sprite', price: 8, categoryId: '2', isActive: true },
        { id: '10', name: 'Eau Minérale', price: 5, categoryId: '2', isActive: true },
        { id: '11', name: 'Schweppes', price: 8, categoryId: '2', isActive: true },
        { id: '12', name: 'Jus d\'Orange', price: 15, categoryId: '3', isActive: true },
        { id: '13', name: 'Jus de Pomme', price: 15, categoryId: '3', isActive: true },
        { id: '14', name: 'Jus d\'Avocat', price: 20, categoryId: '3', isActive: true },
        { id: '15', name: 'Jus de Fraise', price: 18, categoryId: '3', isActive: true },
        { id: '16', name: 'Croissant', price: 8, categoryId: '4', isActive: true },
        { id: '17', name: 'Pain au Chocolat', price: 8, categoryId: '4', isActive: true },
        { id: '18', name: 'Msemen', price: 3, categoryId: '4', isActive: true },
        { id: '19', name: 'Harcha', price: 3, categoryId: '4', isActive: true },
        { id: '20', name: 'Baghrir', price: 10, categoryId: '4', isActive: true },
        { id: '21', name: 'Sandwich Thon', price: 18, categoryId: '5', isActive: true },
        { id: '22', name: 'Sandwich Poulet', price: 20, categoryId: '5', isActive: true },
        { id: '23', name: 'Sandwich Fromage', price: 15, categoryId: '5', isActive: true },
        { id: '24', name: 'Tacos Poulet', price: 25, categoryId: '5', isActive: true },
        { id: '25', name: 'Salade Marocaine', price: 15, categoryId: '6', isActive: true },
        { id: '26', name: 'Salade Verte', price: 12, categoryId: '6', isActive: true },
        { id: '27', name: 'Salade Mixte', price: 18, categoryId: '6', isActive: true },
      ]);
    }

    // Load existing order if editing
    if (orderId) {
      const existingOrder = orders.find(o => o.id === orderId);
      if (existingOrder && existingOrder.items) {
        const cartItems: CartItem[] = existingOrder.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          note: item.note,
        }));
        setCart(cartItems);
      }
    }
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || '1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
  const sendToKitchen = () => {
    if (cart.length === 0) {
      Alert.alert('Panier Vide', 'Ajoutez des produits avant d\'envoyer.');
      return;
    }

    if (orderId) {
      // Edit existing order - convert cart items to order items
      const orderItems: OrderItem[] = cart.map((item, index) => ({
        id: item.productId + '-' + index,
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        note: item.note,
      }));
      
      useAppStore.getState().updateOrder(orderId, {
        items: orderItems,
        totalAmount: total,
        updatedAt: new Date()
      });
      Alert.alert('Commande Modifiée', 'La commande a été mise à jour.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } else {
      // Create new order
      const waiterName = user?.name || 'Serveur';
      const newOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      // Convert cart items to order items
      const orderItems: OrderItem[] = cart.map((item, index) => ({
        id: item.productId + '-' + index,
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        note: item.note,
      }));
      
      const newOrder: Order = {
        id: newOrderId,
        tableId: tableId || `table-${tableNumber}`,
        tableNumber: tableNumber,
        items: orderItems,
        status: 'NEW',
        totalAmount: total,
        createdAt: new Date(),
        updatedAt: new Date(),
        waiterId: user?.id,
        waiterName: waiterName,
      };
      
      useAppStore.getState().createOrderAndOccupyTable(newOrder, tableId || `table-${tableNumber}`);
      
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
                      <Text className="text-sm text-yellow-700 bg-yellow-50 px-2 py-1 rounded mb-2">
                        📝 {item.note}
                      </Text>
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