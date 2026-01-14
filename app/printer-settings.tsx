import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Printer, Bluetooth, Wifi, Usb, Check, RefreshCw } from 'lucide-react-native';
import { 
  PrinterConfig, 
  PrinterType, 
  loadPrinterConfig, 
  savePrinterConfig,
  generateReceiptCommands,
  ReceiptData
} from '../lib/printing';

const PRINTER_TYPES: { type: PrinterType; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    type: 'bluetooth', 
    label: 'Bluetooth', 
    icon: <Bluetooth size={24} color="#3B82F6" />,
    description: 'Imprimante thermique Bluetooth'
  },
  { 
    type: 'network', 
    label: 'Réseau', 
    icon: <Wifi size={24} color="#10B981" />,
    description: 'Imprimante réseau (ESC/POS sur TCP)'
  },
  { 
    type: 'usb', 
    label: 'USB', 
    icon: <Usb size={24} color="#F59E0B" />,
    description: 'Imprimante USB (non supporté sur mobile)'
  },
];

const PAPER_WIDTHS = [
  { value: 58, label: '58mm' },
  { value: 80, label: '80mm' },
];

export default function PrinterSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [config, setConfig] = useState<PrinterConfig>({
    type: 'none',
    name: '',
    address: '',
    paperWidth: 80,
    enabled: false,
  });

  // Load saved config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await loadPrinterConfig();
        setConfig(savedConfig);
      } catch (error) {
        console.error('Error loading printer config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (config.type !== 'none' && !config.address.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer l\'adresse de l\'imprimante');
      return;
    }
    
    setSaving(true);
    try {
      await savePrinterConfig({
        ...config,
        enabled: config.type !== 'none',
      });
      Alert.alert('Succès', 'Configuration de l\'imprimante sauvegardée');
      router.back();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder la configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    if (!config.address.trim()) {
      Alert.alert('Erreur', 'Veuillez d\'abord configurer l\'adresse de l\'imprimante');
      return;
    }
    
    setTesting(true);
    
    // Generate test receipt
    const testData: ReceiptData = {
      restaurantName: 'Café Marocain',
      address: '123 Avenue Mohammed V',
      city: 'Casablanca, Maroc',
      phone: '+212 5XX-XXXXXX',
      taxId: 'IF: 12345678',
      orderId: 'TEST-001',
      tableNumber: 1,
      waiterName: 'Test',
      date: new Date().toLocaleString('fr-FR'),
      items: [
        { name: 'Café Noir', quantity: 2, unitPrice: 10, total: 20 },
        { name: 'Croissant', quantity: 1, unitPrice: 15, total: 15 },
      ],
      subtotal: 35,
      discount: 0,
      tax: 0,
      total: 35,
      paymentMethod: 'Espèces',
      amountReceived: 50,
      change: 15,
    };
    
    try {
      const commands = generateReceiptCommands(testData);
      console.log('Test receipt commands:', commands);
      
      // Show what would be printed
      Alert.alert(
        'Test d\'impression',
        `Type: ${config.type}\nAdresse: ${config.address}\nPapier: ${config.paperWidth}mm\n\nLes données ESC/POS ont été générées.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le ticket de test');
    } finally {
      setTesting(false);
    }
  };

  const handleScanBluetooth = () => {
    Alert.alert(
      'Scan Bluetooth',
      'Pour utiliser le scan Bluetooth, vous devez :\n\n1. Installer react-native-bluetooth-escpos-printer\n2. Activer les permissions Bluetooth\n3. Appairer l\'imprimante dans les paramètres du téléphone\n\nEntrez l\'adresse MAC manuellement pour l\'instant.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
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
              <Text className="text-xl font-bold text-gray-900">Imprimante</Text>
              <Text className="text-sm text-gray-500">Configuration ESC/POS</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 rounded-lg"
          >
            <Text className="text-white font-semibold">
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Printer Type Selection */}
        <View className="bg-white rounded-lg border border-gray-200 mb-4">
          <View className="p-4 border-b border-gray-100">
            <Text className="text-sm font-semibold text-gray-700">TYPE D&apos;IMPRIMANTE</Text>
          </View>
          <View className="p-2">
            {PRINTER_TYPES.map((printer) => (
              <TouchableOpacity
                key={printer.type}
                onPress={() => setConfig(prev => ({ ...prev, type: printer.type }))}
                className={`flex-row items-center p-3 rounded-lg mb-1 ${
                  config.type === printer.type ? 'bg-blue-50 border border-blue-200' : ''
                }`}
              >
                <View className={`w-12 h-12 rounded-lg items-center justify-center ${
                  config.type === printer.type ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  {printer.icon}
                </View>
                <View className="flex-1 ml-3">
                  <Text className={`font-semibold ${
                    config.type === printer.type ? 'text-blue-700' : 'text-gray-900'
                  }`}>
                    {printer.label}
                  </Text>
                  <Text className="text-sm text-gray-500">{printer.description}</Text>
                </View>
                {config.type === printer.type && (
                  <Check size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>
            ))}
            
            {/* None option */}
            <TouchableOpacity
              onPress={() => setConfig(prev => ({ ...prev, type: 'none', enabled: false }))}
              className={`flex-row items-center p-3 rounded-lg ${
                config.type === 'none' ? 'bg-gray-100 border border-gray-300' : ''
              }`}
            >
              <View className="w-12 h-12 rounded-lg items-center justify-center bg-gray-100">
                <Printer size={24} color="#9CA3AF" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-semibold text-gray-600">Aucune</Text>
                <Text className="text-sm text-gray-500">Désactiver l&apos;impression</Text>
              </View>
              {config.type === 'none' && (
                <Check size={20} color="#6B7280" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Connection Settings */}
        {config.type !== 'none' && (
          <>
            <View className="bg-white rounded-lg border border-gray-200 mb-4">
              <View className="p-4 border-b border-gray-100">
                <Text className="text-sm font-semibold text-gray-700">CONNEXION</Text>
              </View>
              <View className="p-4">
                <Text className="text-sm text-gray-600 mb-2">Nom de l&apos;imprimante</Text>
                <TextInput
                  value={config.name}
                  onChangeText={(text) => setConfig(prev => ({ ...prev, name: text }))}
                  placeholder="Ex: Imprimante Cuisine"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-gray-900 mb-4"
                  placeholderTextColor="#9CA3AF"
                />
                
                <Text className="text-sm text-gray-600 mb-2">
                  {config.type === 'bluetooth' ? 'Adresse MAC' : 'Adresse IP:Port'}
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    value={config.address}
                    onChangeText={(text) => setConfig(prev => ({ ...prev, address: text }))}
                    placeholder={config.type === 'bluetooth' ? 'XX:XX:XX:XX:XX:XX' : '192.168.1.100:9100'}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                  />
                  {config.type === 'bluetooth' && (
                    <TouchableOpacity
                      onPress={handleScanBluetooth}
                      className="w-12 h-12 items-center justify-center bg-blue-100 rounded-lg"
                    >
                      <RefreshCw size={20} color="#3B82F6" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {config.type === 'bluetooth' && (
                  <Text className="text-xs text-gray-500 mt-2">
                    Trouvez l&apos;adresse MAC dans les paramètres Bluetooth de votre téléphone
                  </Text>
                )}
                {config.type === 'network' && (
                  <Text className="text-xs text-gray-500 mt-2">
                    Port par défaut: 9100 pour la plupart des imprimantes ESC/POS
                  </Text>
                )}
              </View>
            </View>

            {/* Paper Settings */}
            <View className="bg-white rounded-lg border border-gray-200 mb-4">
              <View className="p-4 border-b border-gray-100">
                <Text className="text-sm font-semibold text-gray-700">PAPIER</Text>
              </View>
              <View className="p-4">
                <Text className="text-sm text-gray-600 mb-3">Largeur du papier</Text>
                <View className="flex-row gap-3">
                  {PAPER_WIDTHS.map((width) => (
                    <TouchableOpacity
                      key={width.value}
                      onPress={() => setConfig(prev => ({ ...prev, paperWidth: width.value as 58 | 80 }))}
                      className={`flex-1 py-3 rounded-lg border-2 ${
                        config.paperWidth === width.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Text className={`text-center font-semibold ${
                        config.paperWidth === width.value ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        {width.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Test Print */}
            <TouchableOpacity
              onPress={handleTestPrint}
              disabled={testing}
              className="bg-green-500 py-4 rounded-lg flex-row items-center justify-center gap-2 mb-4"
            >
              <Printer size={20} color="#FFFFFF" />
              <Text className="text-white font-semibold text-base">
                {testing ? 'Test en cours...' : 'Imprimer un ticket test'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Help Section */}
        <View className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <Text className="text-blue-800 font-semibold mb-2">💡 Conseils</Text>
          <Text className="text-blue-700 text-sm leading-5">
            • Pour Bluetooth: Appairez d&apos;abord l&apos;imprimante dans les paramètres du téléphone{'\n'}
            • Pour Réseau: Utilisez une IP statique pour l&apos;imprimante{'\n'}
            • La plupart des imprimantes thermiques utilisent le protocole ESC/POS{'\n'}
            • Le port par défaut est généralement 9100
          </Text>
        </View>
        
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
