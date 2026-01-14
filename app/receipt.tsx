import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer, Share2, Download, CheckCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore } from '../lib/store';
import { loadPrinterConfig, printReceipt, ReceiptData } from '../lib/printing';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;
  
  const orders = useAppStore((state) => state.orders);
  const [receiptData, setReceiptData] = useState<any>(null);

  useEffect(() => {
    try {
      if (!orders || !Array.isArray(orders)) return;
      const order = orders.find(o => o && o.id === orderId);
      if (order) {
        const orderItems = Array.isArray(order.items) ? order.items : [];
        const items: ReceiptItem[] = orderItems.map(item => ({
          name: item?.productName || 'Produit',
          quantity: Number(item?.quantity) || 1,
          unitPrice: Number(item?.price) || 0,
          total: (Number(item?.price) || 0) * (Number(item?.quantity) || 1)
        }));

      setReceiptData({
        restaurantName: 'Café Marocain',
        address: '123 Avenue Mohammed V',
        city: 'Casablanca, Maroc',
        phone: '+212 5XX-XXXXXX',
        taxId: 'IF: 12345678',
        orderId: order.id,
        tableNumber: order.tableNumber,
        waiterName: order.waiterName || 'Ahmed',
        date: order.paidAt || order.createdAt,
        items,
        subtotal: order.totalAmount + (order.discount || 0),
        discount: order.discount || 0,
        discountPercent: order.discountType === 'percent' ? order.discount : 0,
        tax: 0,
        total: order.totalAmount,
        paymentMethod: order.paymentMethod === 'cash' ? 'Espèces' : 'Carte',
        amountReceived: 0, // TODO: Store this
        change: 0,
        isPaid: order.status === 'PAID',
      });
      }
    } catch (error) {
      console.error('Error loading receipt data:', error);
    }
  }, [orderId, orders]);

  if (!receiptData) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Chargement...</Text>
      </SafeAreaView>
    );
  }

  // Safe date parsing
  let currentDate = '';
  try {
    const dateObj = receiptData.date 
      ? (typeof receiptData.date === 'string' ? new Date(receiptData.date) : receiptData.date) 
      : new Date();
    if (!isNaN(dateObj.getTime())) {
      currentDate = format(dateObj, "dd/MM/yyyy 'à' HH:mm", { locale: fr });
    } else {
      currentDate = format(new Date(), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
    }
  } catch {
    currentDate = new Date().toLocaleString('fr-FR');
  }

  const generateReceiptText = () => {
    let text = '';
    text += '================================\n';
    text += `     ${receiptData.restaurantName}\n`;
    text += `     ${receiptData.address}\n`;
    text += `     ${receiptData.city}\n`;
    text += `     Tél: ${receiptData.phone}\n`;
    text += `     ${receiptData.taxId}\n`;
    text += '================================\n\n';
    text += `Ticket N°: ${receiptData.orderId}\n`;
    text += `Table: ${receiptData.tableNumber}\n`;
    text += `Serveur: ${receiptData.waiterName}\n`;
    text += `Date: ${currentDate}\n`;
    text += '--------------------------------\n';
    
    receiptData.items.forEach(item => {
      const line = `${item.quantity}x ${item.name}`;
      const price = `${item.total} MAD`;
      text += `${line.padEnd(24)} ${price}\n`;
    });
    
    text += '--------------------------------\n';
    text += `Sous-total:            ${receiptData.subtotal} MAD\n`;
    if (receiptData.discount > 0) {
      text += `Remise (${receiptData.discountPercent}%):       -${receiptData.discount} MAD\n`;
    }
    text += '================================\n';
    text += `TOTAL:                ${receiptData.total} MAD\n`;
    text += '================================\n\n';
    text += `Paiement: ${receiptData.paymentMethod}\n`;
    if (receiptData.paymentMethod === 'Espèces') {
      text += `Reçu:    ${receiptData.amountReceived} MAD\n`;
      text += `Rendu:   ${receiptData.change} MAD\n`;
    }
    text += '\n        Merci de votre visite!\n';
    text += '      شكرا لزيارتكم\n';
    text += '================================\n';
    
    return text;
  };

  const handleShare = async () => {
    try {
      const receiptText = generateReceiptText();
      await Share.share({
        message: receiptText,
        title: `Ticket - Table ${receiptData.tableNumber}`,
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de partager le reçu');
    }
  };

  const handlePrint = async () => {
    try {
      const config = await loadPrinterConfig();
      
      if (!config.enabled || config.type === 'none') {
        Alert.alert(
          'Imprimante non configurée',
          'Voulez-vous configurer une imprimante maintenant?',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Configurer', onPress: () => router.push('/printer-settings') }
          ]
        );
        return;
      }
      
      const printData: ReceiptData = {
        restaurantName: receiptData.restaurantName,
        address: receiptData.address,
        city: receiptData.city,
        phone: receiptData.phone,
        taxId: receiptData.taxId,
        orderId: receiptData.orderId,
        tableNumber: receiptData.tableNumber,
        waiterName: receiptData.waiterName,
        date: currentDate,
        items: receiptData.items,
        subtotal: receiptData.subtotal,
        discount: receiptData.discount,
        discountPercent: receiptData.discountPercent,
        tax: receiptData.tax,
        total: receiptData.total,
        paymentMethod: receiptData.paymentMethod,
        amountReceived: receiptData.amountReceived,
        change: receiptData.change,
      };
      
      await printReceipt(config, printData);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'imprimer le reçu');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-gray-900">Reçu / Ticket</Text>
              <Text className="text-sm text-gray-500">Table {receiptData.tableNumber}</Text>
            </View>
          </View>
          
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleShare}
              className="w-10 h-10 items-center justify-center bg-blue-100 rounded-lg"
            >
              <Share2 size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePrint}
              className="w-10 h-10 items-center justify-center bg-green-100 rounded-lg"
            >
              <Printer size={20} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Receipt Card */}
        <View className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Header */}
          <View className="bg-gray-900 py-6 px-4">
            <Text className="text-white text-2xl font-bold text-center">
              {receiptData.restaurantName}
            </Text>
            <Text className="text-gray-300 text-center mt-1">{receiptData.address}</Text>
            <Text className="text-gray-300 text-center">{receiptData.city}</Text>
            <Text className="text-gray-400 text-center text-sm mt-2">{receiptData.phone}</Text>
          </View>

          {/* Order Info */}
          <View className="px-4 py-3 border-b border-dashed border-gray-300">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Ticket N°</Text>
              <Text className="font-mono text-gray-900">{receiptData.orderId}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-500">Table</Text>
              <Text className="font-bold text-gray-900">{receiptData.tableNumber}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-500">Serveur</Text>
              <Text className="text-gray-900">{receiptData.waiterName}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-gray-500">Date</Text>
              <Text className="text-gray-900">{currentDate}</Text>
            </View>
          </View>

          {/* Items */}
          <View className="px-4 py-3 border-b border-dashed border-gray-300">
            <Text className="text-xs text-gray-500 mb-2 font-semibold">ARTICLES</Text>
            {receiptData.items.map((item, index) => (
              <View key={index} className="flex-row justify-between items-center py-2">
                <View className="flex-row items-center gap-2 flex-1">
                  <Text className="text-gray-500 w-6">{item.quantity}x</Text>
                  <Text className="text-gray-900 flex-1">{item.name}</Text>
                </View>
                <Text className="font-medium text-gray-900">{item.total} MAD</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View className="px-4 py-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-500">Sous-total</Text>
              <Text className="text-gray-900">{receiptData.subtotal} MAD</Text>
            </View>
            {receiptData.discount > 0 && (
              <View className="flex-row justify-between items-center mt-1">
                <Text className="text-green-600">Remise ({receiptData.discountPercent}%)</Text>
                <Text className="text-green-600">-{receiptData.discount} MAD</Text>
              </View>
            )}
            <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-200">
              <Text className="text-lg font-bold text-gray-900">TOTAL</Text>
              <Text className="text-2xl font-bold text-gray-900">{receiptData.total} MAD</Text>
            </View>
          </View>

          {/* Payment Info */}
          <View className="mx-4 mb-4 p-3 bg-green-50 rounded-lg">
            <View className="flex-row items-center justify-center gap-2 mb-2">
              <CheckCircle size={18} color="#22C55E" />
              <Text className="font-semibold text-green-700">PAYÉ</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-green-600">Mode</Text>
              <Text className="text-green-700 font-medium">{receiptData.paymentMethod}</Text>
            </View>
            {receiptData.paymentMethod === 'Espèces' && (
              <>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-green-600">Reçu</Text>
                  <Text className="text-green-700">{receiptData.amountReceived} MAD</Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-green-600">Rendu</Text>
                  <Text className="text-green-700 font-medium">{receiptData.change} MAD</Text>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View className="bg-gray-50 py-4 px-4">
            <Text className="text-center text-gray-600 font-medium">
              Merci de votre visite!
            </Text>
            <Text className="text-center text-gray-500 text-lg mt-1">
              شكرا لزيارتكم
            </Text>
            <Text className="text-center text-xs text-gray-400 mt-3">
              {receiptData.taxId}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View className="p-4 bg-white border-t border-gray-200 flex-row gap-3">
        <TouchableOpacity
          onPress={handleShare}
          className="flex-1 flex-row items-center justify-center gap-2 py-4 bg-blue-500 rounded-lg"
        >
          <Share2 size={20} color="#FFFFFF" />
          <Text className="text-white font-semibold">Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePrint}
          className="flex-1 flex-row items-center justify-center gap-2 py-4 bg-green-500 rounded-lg"
        >
          <Printer size={20} color="#FFFFFF" />
          <Text className="text-white font-semibold">Imprimer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
