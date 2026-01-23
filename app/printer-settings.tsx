import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Printer, Bluetooth, Wifi, Usb, Check, RefreshCw, Settings, Info } from 'lucide-react-native';
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#CFCFCF',
        }}>
          <Printer size={28} color="#007AFF" />
        </View>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={{ marginTop: 12, fontSize: 13, fontWeight: '500', color: '#8E8E93' }}>
          Chargement...
        </Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
                borderRadius: 10,
              }}
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Imprimante</Text>
              <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={1}>Configuration ESC/POS</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: '#3B82F6',
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Printer Type Selection */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          marginBottom: 16,
          overflow: 'hidden',
        }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>TYPE D&apos;IMPRIMANTE</Text>
          </View>
          <View style={{ padding: 8 }}>
            {PRINTER_TYPES.map((printer) => (
              <TouchableOpacity
                key={printer.type}
                onPress={() => setConfig(prev => ({ ...prev, type: printer.type }))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 10,
                  marginBottom: 4,
                  backgroundColor: config.type === printer.type ? '#EFF6FF' : 'transparent',
                  borderWidth: config.type === printer.type ? 1 : 0,
                  borderColor: config.type === printer.type ? '#BFDBFE' : 'transparent',
                }}
              >
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: config.type === printer.type ? '#DBEAFE' : '#F3F4F6',
                }}>
                  {printer.icon}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{
                    fontWeight: '600',
                    color: config.type === printer.type ? '#1D4ED8' : '#111827',
                    fontSize: 15,
                  }}>
                    {printer.label}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{printer.description}</Text>
                </View>
                {config.type === printer.type && (
                  <Check size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>
            ))}
            
            {/* None option */}
            <TouchableOpacity
              onPress={() => setConfig(prev => ({ ...prev, type: 'none', enabled: false }))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 10,
                backgroundColor: config.type === 'none' ? '#F3F4F6' : 'transparent',
                borderWidth: config.type === 'none' ? 1 : 0,
                borderColor: config.type === 'none' ? '#D1D5DB' : 'transparent',
              }}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
              }}>
                <Printer size={24} color="#9CA3AF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '600', color: '#4B5563', fontSize: 15 }}>Aucune</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Désactiver l&apos;impression</Text>
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
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              marginBottom: 16,
              overflow: 'hidden',
            }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>CONNEXION</Text>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 13, color: '#4B5563', marginBottom: 8 }}>Nom de l&apos;imprimante</Text>
                <TextInput
                  value={config.name}
                  onChangeText={(text) => setConfig(prev => ({ ...prev, name: text }))}
                  placeholder="Ex: Imprimante Cuisine"
                  style={{
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: '#111827',
                    marginBottom: 16,
                    fontSize: 15,
                  }}
                  placeholderTextColor="#9CA3AF"
                />
                
                <Text style={{ fontSize: 13, color: '#4B5563', marginBottom: 8 }}>
                  {config.type === 'bluetooth' ? 'Adresse MAC' : 'Adresse IP:Port'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={config.address}
                    onChangeText={(text) => setConfig(prev => ({ ...prev, address: text }))}
                    placeholder={config.type === 'bluetooth' ? 'XX:XX:XX:XX:XX:XX' : '192.168.1.100:9100'}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      borderRadius: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      color: '#111827',
                      fontSize: 15,
                    }}
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                  />
                  {config.type === 'bluetooth' && (
                    <TouchableOpacity
                      onPress={handleScanBluetooth}
                      style={{
                        width: 48,
                        height: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#DBEAFE',
                        borderRadius: 10,
                      }}
                    >
                      <RefreshCw size={20} color="#3B82F6" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {config.type === 'bluetooth' && (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                    Trouvez l&apos;adresse MAC dans les paramètres Bluetooth de votre téléphone
                  </Text>
                )}
                {config.type === 'network' && (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                    Port par défaut: 9100 pour la plupart des imprimantes ESC/POS
                  </Text>
                )}
              </View>
            </View>

            {/* Paper Settings */}
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              marginBottom: 16,
              overflow: 'hidden',
            }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>PAPIER</Text>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 13, color: '#4B5563', marginBottom: 12 }}>Largeur du papier</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {PAPER_WIDTHS.map((width) => (
                    <TouchableOpacity
                      key={width.value}
                      onPress={() => setConfig(prev => ({ ...prev, paperWidth: width.value as 58 | 80 }))}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: config.paperWidth === width.value ? '#3B82F6' : '#E5E7EB',
                        backgroundColor: config.paperWidth === width.value ? '#EFF6FF' : '#FFFFFF',
                      }}
                    >
                      <Text style={{
                        textAlign: 'center',
                        fontWeight: '600',
                        color: config.paperWidth === width.value ? '#1D4ED8' : '#374151',
                        fontSize: 15,
                      }}>
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
              style={{
                backgroundColor: '#22C55E',
                paddingVertical: 16,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Printer size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                {testing ? 'Test en cours...' : 'Imprimer un ticket test'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Advanced Printer Test - Native Module */}
        <TouchableOpacity
          onPress={() => router.push('/printer-test' as any)}
          style={{
            backgroundColor: '#7C3AED',
            paddingVertical: 16,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Settings size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
            Test Avancé (USB / Bluetooth / WiFi)
          </Text>
        </TouchableOpacity>

        {/* Help Section */}
        <View style={{
          backgroundColor: '#EFF6FF',
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: '#BFDBFE',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Info size={16} color="#1E40AF" />
            <Text style={{ color: '#1E40AF', fontWeight: '600', fontSize: 14 }}>Conseils</Text>
          </View>
          <Text style={{ color: '#1D4ED8', fontSize: 13, lineHeight: 20 }}>
            • Pour Bluetooth: Appairez d&apos;abord l&apos;imprimante dans les paramètres du téléphone{'\n'}
            • Pour Réseau: Utilisez une IP statique pour l&apos;imprimante{'\n'}
            • La plupart des imprimantes thermiques utilisent le protocole ESC/POS{'\n'}
            • Le port par défaut est généralement 9100
          </Text>
        </View>
        
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
