import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Printer, Share2, Download, CheckCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore } from '../lib/store';
import { loadPrinterConfig, printReceipt, ReceiptData } from '../lib/printing';
import { orderService, orderItemService, tableService, userService } from '../lib/services';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function ReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId ? String(params.orderId) : '';
  
  const orders = useAppStore((state) => state.orders);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReceiptData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // First try to find order in local store
        let order = orders?.find(o => o && o.id === orderId);
        
        // If not found in store, fetch from Supabase
        if (!order) {
          const orderDb = await orderService.getById(orderId);
          if (orderDb) {
            const itemsDb = await orderItemService.getByOrderId(orderId);
            const tablesDb = await tableService.getAll();
            const usersDb = await userService.getAll();
            
            const table = tablesDb.find(t => t.id === orderDb.table_id);
            const waiter = usersDb.find(u => u.id === orderDb.waiter_id);
            
            order = {
              id: orderDb.id,
              tableId: orderDb.table_id,
              tableNumber: table?.number || 0,
              items: itemsDb.map(i => ({
                id: i.id,
                productId: i.product_id,
                productName: i.product_name,
                price: i.price,
                quantity: i.quantity,
              })),
              status: orderDb.status as any,
              isServed: orderDb.is_served,
              totalAmount: orderDb.total_amount,
              createdAt: orderDb.created_at ? new Date(orderDb.created_at) : new Date(),
              updatedAt: orderDb.updated_at ? new Date(orderDb.updated_at) : new Date(),
              waiterId: orderDb.waiter_id || undefined,
              waiterName: waiter?.name || 'Serveur',
              paymentMethod: orderDb.payment_method as 'cash' | 'card' | undefined,
            };
          }
        }
        
        if (!order) {
          setError('Commande introuvable');
          setLoading(false);
          return;
        }
        
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
          waiterName: order.waiterName || 'Serveur',
          date: order.paidAt || order.createdAt,
          items,
          subtotal: order.totalAmount + (order.discount || 0),
          discount: order.discount || 0,
          discountPercent: order.discountType === 'percent' ? order.discount : 0,
          tax: 0,
          total: order.totalAmount,
          paymentMethod: order.paymentMethod === 'cash' ? 'Espèces' : 'Carte',
          amountReceived: order.amountReceived || order.totalAmount,
          change: order.change || 0,
          isPaid: order.status === 'PAID',
        });
      } catch (err) {
        console.error('Error loading receipt data:', err);
        setError('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };
    
    loadReceiptData();
  }, [orderId, orders]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: '#6B7280', marginTop: 12 }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (error || !receiptData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#EF4444', fontSize: 16 }}>{error || 'Erreur inconnue'}</Text>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={{ marginTop: 16, padding: 12, backgroundColor: '#3B82F6', borderRadius: 8 }}
        >
          <Text style={{ color: '#FFFFFF' }}>Retour</Text>
        </TouchableOpacity>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Reçu / Ticket</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Table {receiptData.tableNumber}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={handleShare}
              style={{
                width: 40,
                height: 40,
                backgroundColor: '#DBEAFE',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePrint}
              style={{
                width: 40,
                height: 40,
                backgroundColor: '#DCFCE7',
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Printer size={20} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Receipt Card */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}>
          {/* Header */}
          <View style={{ backgroundColor: '#111827', paddingVertical: 24, paddingHorizontal: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              {receiptData.restaurantName}
            </Text>
            <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 4, fontSize: 14 }}>{receiptData.address}</Text>
            <Text style={{ color: '#9CA3AF', textAlign: 'center', fontSize: 14 }}>{receiptData.city}</Text>
            <Text style={{ color: '#6B7280', textAlign: 'center', fontSize: 13, marginTop: 8 }}>{receiptData.phone}</Text>
          </View>

          {/* Order Info */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: '#D1D5DB' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Ticket N°</Text>
              <Text style={{ fontFamily: 'monospace', color: '#111827', fontSize: 14 }}>{receiptData.orderId}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Table</Text>
              <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }}>{receiptData.tableNumber}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Serveur</Text>
              <Text style={{ color: '#111827', fontSize: 14 }}>{receiptData.waiterName}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Date</Text>
              <Text style={{ color: '#111827', fontSize: 14 }}>{currentDate}</Text>
            </View>
          </View>

          {/* Items */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: '#D1D5DB' }}>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' }}>ARTICLES</Text>
            {receiptData.items.map((item, index) => (
              <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ color: '#6B7280', width: 28, fontSize: 14 }}>{item.quantity}x</Text>
                  <Text style={{ color: '#111827', flex: 1, fontSize: 14 }}>{item.name}</Text>
                </View>
                <Text style={{ fontWeight: '500', color: '#111827', fontSize: 14 }}>{item.total} MAD</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Sous-total</Text>
              <Text style={{ color: '#111827', fontSize: 14 }}>{receiptData.subtotal} MAD</Text>
            </View>
            {receiptData.discount > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: '#22C55E', fontSize: 14 }}>Remise ({receiptData.discountPercent}%)</Text>
                <Text style={{ color: '#22C55E', fontSize: 14 }}>-{receiptData.discount} MAD</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>TOTAL</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>{receiptData.total} MAD</Text>
            </View>
          </View>

          {/* Payment Info */}
          <View style={{ marginHorizontal: 16, marginBottom: 16, padding: 14, backgroundColor: '#F0FDF4', borderRadius: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircle size={18} color="#22C55E" />
              <Text style={{ fontWeight: '600', color: '#15803D', fontSize: 15 }}>PAYÉ</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#22C55E', fontSize: 14 }}>Mode</Text>
              <Text style={{ color: '#15803D', fontWeight: '500', fontSize: 14 }}>{receiptData.paymentMethod}</Text>
            </View>
            {receiptData.paymentMethod === 'Espèces' && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ color: '#22C55E', fontSize: 14 }}>Reçu</Text>
                  <Text style={{ color: '#15803D', fontSize: 14 }}>{receiptData.amountReceived} MAD</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ color: '#22C55E', fontSize: 14 }}>Rendu</Text>
                  <Text style={{ color: '#15803D', fontWeight: '500', fontSize: 14 }}>{receiptData.change} MAD</Text>
                </View>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={{ backgroundColor: '#F9FAFB', paddingVertical: 16, paddingHorizontal: 16 }}>
            <Text style={{ textAlign: 'center', color: '#374151', fontWeight: '500', fontSize: 15 }}>
              Merci de votre visite!
            </Text>
            <Text style={{ textAlign: 'center', color: '#6B7280', fontSize: 18, marginTop: 4 }}>
              شكرا لزيارتكم
            </Text>
            <Text style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
              {receiptData.taxId}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={{
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        flexDirection: 'row',
        gap: 12,
      }}>
        <TouchableOpacity
          onPress={handleShare}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            backgroundColor: '#3B82F6',
            borderRadius: 10,
          }}
          activeOpacity={0.8}
        >
          <Share2 size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handlePrint}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            backgroundColor: '#22C55E',
            borderRadius: 10,
          }}
          activeOpacity={0.8}
        >
          <Printer size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Imprimer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
