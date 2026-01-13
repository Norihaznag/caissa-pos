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
  const tableNumber = params.tableNumber || '1';
  const tableId = params.tableId as string;
  const orderId = params.orderId as string;
  
  const orders = useAppStore((state) => state.orders);
  const completePaymentAndFreeTable = useAppStore((state) => state.completePaymentAndFreeTable);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentTableId, setCurrentTableId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  // Load order data
  useEffect(() => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setOrderItems(order.items || []);
      setCurrentTableId(order.tableId || tableId || `table-${tableNumber}`);
    }
  }, [orderId, orders, tableId, tableNumber]);

  // Calculate subtotal
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Calculate discount
  const discountValue = discountPercent 
    ? (subtotal * parseFloat(discountPercent || '0')) / 100
    : parseFloat(discountAmount || '0');

  // Calculate total
  const total = Math.max(0, subtotal - discountValue);

  // Calculate change
  const received = parseFloat(amountReceived || '0');
  const change = received - total;

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
      // Update order status in Supabase
      await orderService.updateStatus(orderId, 'PAID');
      
      // Free the table in Supabase
      await tableService.setOpen(currentTableId);
      
      // Success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Get discount info
      const discount = discountValue;
      const discountType: 'percent' | 'amount' = discountPercent ? 'percent' : 'amount';

      // Complete payment and free table in local store
      completePaymentAndFreeTable(orderId, currentTableId, {
        method: paymentMethod,
        discount: discount,
        discountType: discountType,
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

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-900">Paiement</Text>
            <Text className="text-sm text-gray-500">Table {tableNumber}</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Order Summary */}
        <View className="bg-white border border-gray-200 rounded-lg mb-4">
          <View className="p-4 border-b border-gray-100">
            <Text className="text-sm font-semibold text-gray-700">RÉSUMÉ DE LA COMMANDE</Text>
          </View>
          <View className="p-4">
            {orderItems.map((item) => (
              <View key={item.id} className="flex-row justify-between items-center py-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-gray-500">{item.quantity}x</Text>
                  <Text className="text-gray-900">{item.productName}</Text>
                </View>
                <Text className="font-medium text-gray-900">
                  {(item.price * item.quantity)} MAD
                </Text>
              </View>
            ))}
            
            <View className="border-t border-gray-200 mt-3 pt-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500">Sous-total</Text>
                <Text className="font-medium text-gray-900">{subtotal} MAD</Text>
              </View>
              {discountValue > 0 && (
                <View className="flex-row justify-between items-center mt-1">
                  <Text className="text-green-600">Remise</Text>
                  <Text className="font-medium text-green-600">-{discountValue.toFixed(2)} MAD</Text>
                </View>
              )}
              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-lg font-bold text-gray-900">Total</Text>
                <Text className="text-xl font-bold text-blue-600">{total.toFixed(2)} MAD</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Discount Section */}
        <View className="bg-white border border-gray-200 rounded-lg mb-4 p-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Percent size={18} color="#6B7280" />
            <Text className="text-sm font-semibold text-gray-700">REMISE (OPTIONNEL)</Text>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">Pourcentage (%)</Text>
              <TextInput
                value={discountPercent}
                onChangeText={(v) => {
                  setDiscountPercent(v);
                  setDiscountAmount('');
                }}
                placeholder="0"
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-3 py-2 text-center"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">Montant (MAD)</Text>
              <TextInput
                value={discountAmount}
                onChangeText={(v) => {
                  setDiscountAmount(v);
                  setDiscountPercent('');
                }}
                placeholder="0"
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-3 py-2 text-center"
              />
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View className="bg-white border border-gray-200 rounded-lg mb-4 p-4">
          <Text className="text-sm font-semibold text-gray-700 mb-3">MODE DE PAIEMENT</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setPaymentMethod('cash')}
              className={`flex-1 flex-row items-center justify-center gap-2 py-4 rounded-lg border-2 ${
                paymentMethod === 'cash' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Banknote size={24} color={paymentMethod === 'cash' ? '#22C55E' : '#6B7280'} />
              <Text className={`font-semibold ${paymentMethod === 'cash' ? 'text-green-700' : 'text-gray-600'}`}>
                Espèces
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPaymentMethod('card')}
              className={`flex-1 flex-row items-center justify-center gap-2 py-4 rounded-lg border-2 ${
                paymentMethod === 'card' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              <CreditCard size={24} color={paymentMethod === 'card' ? '#3B82F6' : '#6B7280'} />
              <Text className={`font-semibold ${paymentMethod === 'card' ? 'text-blue-700' : 'text-gray-600'}`}>
                Carte
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cash Payment - Amount Received */}
        {paymentMethod === 'cash' && (
          <View className="bg-white border border-gray-200 rounded-lg mb-4 p-4">
            <Text className="text-sm font-semibold text-gray-700 mb-3">MONTANT REÇU</Text>
            <TextInput
              value={amountReceived}
              onChangeText={setAmountReceived}
              placeholder={total.toFixed(2)}
              keyboardType="numeric"
              className="border border-gray-300 rounded-lg px-4 py-3 text-xl text-center font-bold"
            />
            
            {/* Quick Amount Buttons */}
            <View className="flex-row flex-wrap gap-2 mt-3">
              {quickAmounts.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setAmountReceived(amount.toString())}
                  className="flex-1 min-w-[70px] py-3 bg-gray-100 rounded-lg"
                >
                  <Text className="text-center font-semibold text-gray-700">{amount} MAD</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setAmountReceived(total.toFixed(0))}
                className="flex-1 min-w-[70px] py-3 bg-blue-100 rounded-lg"
              >
                <Text className="text-center font-semibold text-blue-700">Exact</Text>
              </TouchableOpacity>
            </View>

            {/* Change Display */}
            {received > 0 && (
              <View className={`mt-4 p-4 rounded-lg ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <Text className={`text-center text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change >= 0 ? 'Monnaie à rendre' : 'Montant insuffisant'}
                </Text>
                <Text className={`text-center text-2xl font-bold ${change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {Math.abs(change).toFixed(2)} MAD
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <TouchableOpacity
          onPress={handlePayment}
          className="bg-green-500 py-4 rounded-lg flex-row items-center justify-center gap-2"
        >
          <CheckCircle size={24} color="#FFFFFF" />
          <Text className="text-white font-bold text-lg">
            Confirmer Paiement ({total.toFixed(2)} MAD)
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
