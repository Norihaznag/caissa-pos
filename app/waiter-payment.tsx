import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CreditCard, Banknote, CheckCircle, Percent } from 'lucide-react-native';
import { useAppStore, OrderItem } from '../lib/store';
import { orderService, tableService } from '../lib/services';
import * as Haptics from 'expo-haptics';

type PaymentMethod = 'cash' | 'card';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tableNumber = params.tableNumber ? String(params.tableNumber) : '1';
  const tableId = params.tableId ? String(params.tableId) : '';
  const orderId = params.orderId ? String(params.orderId) : '';
  
  const orders = useAppStore((state) => state.orders);
  const completePaymentAndFreeTable = useAppStore((state) => state.completePaymentAndFreeTable);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentTableId, setCurrentTableId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paramsValid, setParamsValid] = useState(true);

  // Validate params on mount
  useEffect(() => {
    if (!orderId || !tableId) {
      setParamsValid(false);
    }
  }, [orderId, tableId]);

  // Load order data
  useEffect(() => {
    try {
      if (!orders || !Array.isArray(orders)) return;
      const order = orders.find(o => o && o.id === orderId);
      if (order) {
        setOrderItems(Array.isArray(order.items) ? order.items : []);
        setCurrentTableId(order.tableId || tableId || `table-${tableNumber}`);
      }
    } catch (error) {
      console.error('Error loading order data:', error);
      setOrderItems([]);
    }
  }, [orderId, orders, tableId, tableNumber]);

  // Calculate subtotal
  const subtotal = Array.isArray(orderItems) 
    ? orderItems.reduce((sum, item) => {
        if (!item) return sum;
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return sum + (price * quantity);
      }, 0)
    : 0;

  // Calculate discount
  const parsedDiscountPercent = parseFloat(discountPercent || '0');
  const parsedDiscountAmount = parseFloat(discountAmount || '0');
  const discountValue = discountPercent 
    ? (subtotal * (isNaN(parsedDiscountPercent) ? 0 : parsedDiscountPercent)) / 100
    : (isNaN(parsedDiscountAmount) ? 0 : parsedDiscountAmount);

  // Calculate total
  const total = Math.max(0, subtotal - discountValue);

  // Calculate change
  const received = parseFloat(amountReceived || '0') || 0;
  const change = Math.max(0, received - total);

  // Quick amount buttons
  const quickAmounts = [50, 100, 200, 500];

  const handlePayment = async () => {
    if (paymentMethod === 'cash' && received < total) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Montant Insuffisant', `Le montant reçu (${received} MAD) est inférieur au total (${total} MAD)`);
      return;
    }

    if (!orderId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'ID de commande manquant');
      return;
    }

    setProcessing(true);
    
    try {
      // Get discount info
      const discount = discountValue;
      const discountType: 'percent' | 'amount' = discountPercent ? 'percent' : 'amount';
      const finalAmountReceived = paymentMethod === 'cash' ? received : total;
      const finalChange = paymentMethod === 'cash' ? Math.max(0, change) : 0;

      // Update order in Supabase with payment details
      await orderService.update(orderId, {
        status: 'PAID',
        payment_method: paymentMethod,
        discount: discount > 0 ? discount : undefined,
        discount_type: discount > 0 ? discountType : undefined,
        amount_received: finalAmountReceived,
        change_amount: finalChange,
        paid_at: new Date().toISOString(),
        total_amount: total,
      });
      
      // Free the table in Supabase
      await tableService.setOpen(currentTableId);
      
      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Complete payment and free table in local store
      completePaymentAndFreeTable(orderId, currentTableId, {
        method: paymentMethod,
        discount: discount,
        discountType: discountType,
        amountReceived: finalAmountReceived,
        change: finalChange,
      });

      Alert.alert(
        'Paiement Réussi ✓',
        `Table ${tableNumber}\nTotal: ${total} MAD\n${paymentMethod === 'cash' ? `Rendu: ${change.toFixed(2)} MAD` : 'Payé par carte'}`,
        [
          {
            text: 'Voir Reçu',
            onPress: () => {
              router.replace({
                pathname: '/receipt',
                params: { orderId }
              });
            }
          },
          {
            text: 'Terminer',
            onPress: () => router.replace('/waiter-tables')
          }
        ]
      );
    } catch (error) {
      console.error('Payment error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Impossible de traiter le paiement. Réessayez.');
    } finally {
      setProcessing(false);
    }
  };

  // Invalid params - show error
  if (!paramsValid) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#EF4444', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          Paramètres de commande manquants
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/waiter-tables')}
          style={{ padding: 12, backgroundColor: '#3B82F6', borderRadius: 8 }}
        >
          <Text style={{ color: '#FFFFFF' }}>Retour aux tables</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              backgroundColor: '#F3F4F6',
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Paiement</Text>
            <Text style={{ fontSize: 13, color: '#6B7280' }}>Table {tableNumber}</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 12,
          marginBottom: 16,
        }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>RÉSUMÉ DE LA COMMANDE</Text>
          </View>
          <View style={{ padding: 16 }}>
            {orderItems.map((item, index) => {
              if (!item) return null;
              const price = Number(item.price) || 0;
              const qty = Number(item.quantity) || 0;
              return (
                <View key={item.id || `item-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>{qty}x</Text>
                    <Text style={{ color: '#111827', fontSize: 15 }}>{item.productName || 'Article'}</Text>
                  </View>
                  <Text style={{ fontWeight: '500', color: '#111827', fontSize: 15 }}>
                    {(price * qty).toFixed(2)} MAD
                  </Text>
                </View>
              );
            })}
            
            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 12, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#6B7280', fontSize: 14 }}>Sous-total</Text>
                <Text style={{ fontWeight: '500', color: '#111827', fontSize: 15 }}>{subtotal} MAD</Text>
              </View>
              {discountValue > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={{ color: '#22C55E', fontSize: 14 }}>Remise</Text>
                  <Text style={{ fontWeight: '500', color: '#22C55E', fontSize: 15 }}>-{discountValue.toFixed(2)} MAD</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Total</Text>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#3B82F6' }}>{total.toFixed(2)} MAD</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Discount Section */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 12,
          marginBottom: 16,
          padding: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Percent size={18} color="#6B7280" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>REMISE (OPTIONNEL)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Pourcentage (%)</Text>
              <TextInput
                value={discountPercent}
                onChangeText={(v) => {
                  setDiscountPercent(v);
                  setDiscountAmount('');
                }}
                placeholder="0"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  textAlign: 'center',
                  fontSize: 16,
                  color: '#111827',
                  backgroundColor: '#F9FAFB',
                }}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Montant (MAD)</Text>
              <TextInput
                value={discountAmount}
                onChangeText={(v) => {
                  setDiscountAmount(v);
                  setDiscountPercent('');
                }}
                placeholder="0"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  textAlign: 'center',
                  fontSize: 16,
                  color: '#111827',
                  backgroundColor: '#F9FAFB',
                }}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 12,
          marginBottom: 16,
          padding: 16,
        }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 12 }}>MODE DE PAIEMENT</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setPaymentMethod('cash')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 16,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: paymentMethod === 'cash' ? '#22C55E' : '#E5E7EB',
                backgroundColor: paymentMethod === 'cash' ? '#F0FDF4' : '#FFFFFF',
              }}
            >
              <Banknote size={24} color={paymentMethod === 'cash' ? '#22C55E' : '#6B7280'} />
              <Text style={{ fontWeight: '600', color: paymentMethod === 'cash' ? '#15803D' : '#6B7280', fontSize: 15 }}>
                Espèces
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPaymentMethod('card')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 16,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: paymentMethod === 'card' ? '#3B82F6' : '#E5E7EB',
                backgroundColor: paymentMethod === 'card' ? '#EFF6FF' : '#FFFFFF',
              }}
            >
              <CreditCard size={24} color={paymentMethod === 'card' ? '#3B82F6' : '#6B7280'} />
              <Text style={{ fontWeight: '600', color: paymentMethod === 'card' ? '#1D4ED8' : '#6B7280', fontSize: 15 }}>
                Carte
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cash Payment - Amount Received */}
        {paymentMethod === 'cash' && (
          <View style={{
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E5E7EB',
            borderRadius: 12,
            marginBottom: 16,
            padding: 16,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 12 }}>MONTANT REÇU</Text>
            <TextInput
              value={amountReceived}
              onChangeText={setAmountReceived}
              placeholder={total.toFixed(2)}
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 22,
                textAlign: 'center',
                fontWeight: '700',
                color: '#111827',
                backgroundColor: '#F9FAFB',
              }}
              placeholderTextColor="#9CA3AF"
            />
            
            {/* Quick Amount Buttons */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {quickAmounts.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setAmountReceived(amount.toString())}
                  style={{
                    flex: 1,
                    minWidth: 70,
                    paddingVertical: 12,
                    backgroundColor: '#F3F4F6',
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '600', color: '#374151', fontSize: 14 }}>{amount} MAD</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setAmountReceived(total.toFixed(0))}
                style={{
                  flex: 1,
                  minWidth: 70,
                  paddingVertical: 12,
                  backgroundColor: '#DBEAFE',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '600', color: '#1D4ED8', fontSize: 14 }}>Exact</Text>
              </TouchableOpacity>
            </View>

            {/* Change Display */}
            {received > 0 && (
              <View style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 10,
                backgroundColor: change >= 0 ? '#F0FDF4' : '#FEF2F2',
              }}>
                <Text style={{
                  textAlign: 'center',
                  fontSize: 14,
                  color: change >= 0 ? '#15803D' : '#DC2626',
                }}>
                  {change >= 0 ? 'Monnaie à rendre' : 'Montant insuffisant'}
                </Text>
                <Text style={{
                  textAlign: 'center',
                  fontSize: 28,
                  fontWeight: '700',
                  color: change >= 0 ? '#15803D' : '#DC2626',
                  marginTop: 4,
                }}>
                  {Math.abs(change).toFixed(2)} MAD
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={{
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 4,
      }}>
        <TouchableOpacity
          onPress={handlePayment}
          disabled={processing}
          style={{
            backgroundColor: processing ? '#9CA3AF' : '#22C55E',
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
          activeOpacity={0.8}
        >
          <CheckCircle size={22} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>
            {processing ? 'Traitement...' : `Confirmer (${total.toFixed(2)} MAD)`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
