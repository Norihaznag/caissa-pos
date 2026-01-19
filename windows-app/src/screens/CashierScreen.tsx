/**
 * CaissaPro Windows - Cashier Screen (Simplified)
 * Main POS interface for Windows desktop
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { databaseService } from '@shared/database/database.windows';
import { printService } from '@shared/printing/printing.windows';

type CashierRouteProp = RouteProp<RootStackParamList, 'Cashier'>;

interface Product {
  id: number;
  name: string;
  price: number;
  category_id: number;
  is_available: number;
}

interface Category {
  id: number;
  name: string;
  color: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

interface Order {
  id?: number;
  order_number: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: 'cash' | 'card';
  amount_received: number;
  change: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  user_id: number;
}

export default function CashierScreen() {
  const route = useRoute<CashierRouteProp>();
  const navigation = useNavigation();
  const { userId, userName, userRole } = route.params;

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');

  // Computed values
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal; // No discount in simplified version
  const change = parseFloat(amountReceived || '0') - total;

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cats, prods] = await Promise.all([
        databaseService.query<Category>('SELECT * FROM categories ORDER BY display_order, name'),
        databaseService.query<Product>('SELECT * FROM products WHERE is_available = 1 ORDER BY name'),
      ]);
      setCategories(cats);
      setProducts(prods);
      if (cats.length > 0) {
        setSelectedCategory(cats[0].id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === null || p.category_id === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Cart operations
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Payment handling
  const openPaymentModal = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to the cart first');
      return;
    }
    if (total <= 0) {
      Alert.alert('Invalid Total', 'Order total must be greater than zero');
      return;
    }
    setAmountReceived(total.toFixed(2));
    setPaymentModalVisible(true);
  };

  const handlePayment = async (paymentMethod: 'cash' | 'card') => {
    if (paymentProcessing) return;
    
    const received = parseFloat(amountReceived || '0');
    if (paymentMethod === 'cash' && received < total) {
      Alert.alert('Insufficient Amount', 'Amount received is less than total');
      return;
    }

    setPaymentProcessing(true);

    try {
      // Generate order number
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const orderCount = await databaseService.query<{ count: number }>(
        `SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now', 'localtime')`
      );
      const orderNumber = `${today}-${String((orderCount[0]?.count || 0) + 1).padStart(4, '0')}`;

      // Create order
      const orderData = {
        order_number: orderNumber,
        subtotal,
        discount: 0,
        total,
        payment_method: paymentMethod,
        amount_received: received,
        change_amount: paymentMethod === 'cash' ? Math.max(0, received - total) : 0,
        status: 'completed',
        user_id: userId,
      };

      const orderId = await databaseService.execute(
        `INSERT INTO orders (order_number, subtotal, discount, total, payment_method, amount_received, change_amount, status, user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
        [
          orderData.order_number,
          orderData.subtotal,
          orderData.discount,
          orderData.total,
          orderData.payment_method,
          orderData.amount_received,
          orderData.change_amount,
          orderData.status,
          orderData.user_id,
        ]
      );

      // Insert order items
      for (const item of cart) {
        await databaseService.execute(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.product.id,
            item.product.name,
            item.quantity,
            item.product.price,
            item.product.price * item.quantity,
          ]
        );
      }

      // Show success and change
      const changeAmount = paymentMethod === 'cash' ? Math.max(0, received - total) : 0;
      
      Alert.alert(
        '✅ Payment Complete',
        `Order #${orderNumber}\n` +
        `Total: ${total.toFixed(2)} DH\n` +
        (paymentMethod === 'cash' ? `Change: ${changeAmount.toFixed(2)} DH` : 'Card Payment'),
        [{ text: 'OK' }]
      );

      // Note about printing
      if (!printService.isPrintingSupported()) {
        console.log('Printing not available on Windows - order saved to database');
      }

      // Reset state
      setCart([]);
      setPaymentModalVisible(false);
      setAmountReceived('');
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] })
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>CaissaPro</Text>
          <Text style={styles.userName}>{userName} ({userRole})</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* Left Side - Products */}
        <View style={styles.productsSection}>
          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Categories */}
          <ScrollView horizontal style={styles.categoriesContainer} showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.categoryButton, selectedCategory === null && styles.categoryButtonActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryText, selectedCategory === null && styles.categoryTextActive]}>All</Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === cat.id && styles.categoryButtonActive,
                  { borderColor: cat.color }
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Products Grid */}
          <FlatList
            data={filteredProducts}
            numColumns={4}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.productsGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => addToCart(item)}
              >
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.price.toFixed(2)} DH</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No products found</Text>
              </View>
            }
          />
        </View>

        {/* Right Side - Cart */}
        <View style={styles.cartSection}>
          <Text style={styles.cartTitle}>Current Order</Text>
          
          {/* Cart Items */}
          <ScrollView style={styles.cartItems}>
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Text style={styles.emptyCartText}>Cart is empty</Text>
                <Text style={styles.emptyCartSubtext}>Tap products to add</Text>
              </View>
            ) : (
              cart.map(item => (
                <View key={item.product.id} style={styles.cartItem}>
                  <View style={styles.cartItemInfo}>
                    <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.cartItemPrice}>
                      {item.product.price.toFixed(2)} × {item.quantity} = {(item.product.price * item.quantity).toFixed(2)} DH
                    </Text>
                  </View>
                  <View style={styles.cartItemActions}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQuantity(item.product.id, -1)}
                    >
                      <Text style={styles.qtyButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQuantity(item.product.id, 1)}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFromCart(item.product.id)}
                    >
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Cart Summary */}
          <View style={styles.cartSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>{cart.reduce((sum, i) => sum + i.quantity, 0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>TOTAL:</Text>
              <Text style={styles.totalValue}>{total.toFixed(2)} DH</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.cartActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={clearCart}
              disabled={cart.length === 0}
            >
              <Text style={styles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.payButton, cart.length === 0 && styles.buttonDisabled]}
              onPress={openPaymentModal}
              disabled={cart.length === 0}
            >
              <Text style={styles.payButtonText}>Pay {total.toFixed(2)} DH</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !paymentProcessing && setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Payment</Text>
            <Text style={styles.modalTotal}>Total: {total.toFixed(2)} DH</Text>

            <View style={styles.amountInputContainer}>
              <Text style={styles.amountLabel}>Amount Received:</Text>
              <TextInput
                style={styles.amountInput}
                value={amountReceived}
                onChangeText={setAmountReceived}
                keyboardType="decimal-pad"
                editable={!paymentProcessing}
                selectTextOnFocus
              />
              {change >= 0 && (
                <Text style={styles.changeText}>Change: {change.toFixed(2)} DH</Text>
              )}
            </View>

            <View style={styles.paymentMethods}>
              <TouchableOpacity
                style={[styles.paymentMethodButton, styles.cashButton]}
                onPress={() => handlePayment('cash')}
                disabled={paymentProcessing}
              >
                {paymentProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.paymentMethodText}>💵 Cash</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethodButton, styles.cardButton]}
                onPress={() => handlePayment('card')}
                disabled={paymentProcessing}
              >
                {paymentProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.paymentMethodText}>💳 Card</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setPaymentModalVisible(false)}
              disabled={paymentProcessing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  userName: {
    fontSize: 14,
    color: '#888',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  productsSection: {
    flex: 2,
    padding: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  categoriesContainer: {
    flexGrow: 0,
    marginBottom: 16,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#444',
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  categoryText: {
    color: '#ccc',
    fontSize: 14,
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  productsGrid: {
    paddingBottom: 20,
  },
  productCard: {
    flex: 1,
    margin: 6,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    minHeight: 100,
    justifyContent: 'space-between',
    maxWidth: '23%',
  },
  productName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  productPrice: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
  },
  cartSection: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderLeftWidth: 1,
    borderLeftColor: '#333',
    padding: 16,
    minWidth: 320,
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  cartItems: {
    flex: 1,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCartText: {
    color: '#666',
    fontSize: 18,
  },
  emptyCartSubtext: {
    color: '#555',
    fontSize: 14,
    marginTop: 8,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  cartItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cartItemPrice: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  qtyText: {
    color: '#fff',
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  cartSummary: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
  },
  totalLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cartActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#333',
  },
  payButton: {
    backgroundColor: '#4CAF50',
    flex: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 24,
    minWidth: 400,
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalTotal: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 24,
  },
  amountInputContainer: {
    marginBottom: 24,
  },
  amountLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  amountInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
  },
  changeText: {
    color: '#2196F3',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  paymentMethodButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  cashButton: {
    backgroundColor: '#4CAF50',
  },
  cardButton: {
    backgroundColor: '#2196F3',
  },
  paymentMethodText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
});
