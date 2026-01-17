/**
 * UnifiedPrinterModal - Professional Multi-Protocol Printer Connection UI
 * 
 * Features:
 * - Support for Bluetooth, WiFi/Network, and USB printers
 * - One-tap quick connect
 * - Device scanning with tabs
 * - Test print functionality
 * - Connection status monitoring
 * - Add WiFi printer manually
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Wifi,
  WifiOff,
  Usb,
  RefreshCw,
  CheckCircle,
  Printer,
  Settings,
  Zap,
  Signal,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  TestTube,
  Play,
  CircleDot,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import UnifiedPrinterService, {
  PrinterDevice,
  PrinterType,
  ConnectionStatus,
  PrinterConnection,
  TestPrintResult,
} from '../lib/UnifiedPrinterService';

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedPrinterModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected?: (device: PrinterDevice) => void;
}

type TabType = 'bluetooth' | 'wifi' | 'usb';

// ============================================================================
// COLORS & STYLES
// ============================================================================

const colors = {
  primary: '#3B82F6',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  white: '#FFFFFF',
  black: '#111827',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  bluetooth: '#3B82F6',
  wifi: '#10B981',
  usb: '#8B5CF6',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function UnifiedPrinterModal({
  visible,
  onClose,
  onConnected,
}: UnifiedPrinterModalProps) {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('bluetooth');
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<PrinterConnection>(
    UnifiedPrinterService.getConnectionStatus()
  );
  const [lastDevice, setLastDevice] = useState<PrinterDevice | null>(null);
  const [autoConnect, setAutoConnect] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestPrintResult | null>(null);
  
  // WiFi form state
  const [showWifiForm, setShowWifiForm] = useState(false);
  const [wifiName, setWifiName] = useState('');
  const [wifiIp, setWifiIp] = useState('');
  const [wifiPort, setWifiPort] = useState('9100');

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (visible) {
      loadInitialData();

      const unsubscribe = UnifiedPrinterService.onConnectionStatusChange(
        (status: ConnectionStatus, device) => {
          setConnectionStatus(UnifiedPrinterService.getConnectionStatus());

          if (status === 'connected') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (status === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [visible]);

  const loadInitialData = async () => {
    const [last, auto] = await Promise.all([
      UnifiedPrinterService.getActivePrinter(),
      UnifiedPrinterService.getAutoConnect(),
    ]);
    setLastDevice(last);
    setAutoConnect(auto);
    setConnectionStatus(UnifiedPrinterService.getConnectionStatus());
    
    // Auto-scan based on active printer type or default to bluetooth
    if (last) {
      setActiveTab(last.type as TabType);
    }
    handleScan(last?.type as TabType || 'bluetooth');
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleScan = async (type?: TabType) => {
    const scanType = type || activeTab;
    setScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      let foundDevices: PrinterDevice[] = [];

      switch (scanType) {
        case 'bluetooth':
          foundDevices = await UnifiedPrinterService.discoverBluetoothDevices();
          break;
        case 'wifi':
          foundDevices = await UnifiedPrinterService.discoverWiFiPrinters();
          break;
        case 'usb':
          foundDevices = await UnifiedPrinterService.discoverUSBDevices();
          break;
      }

      setDevices(foundDevices);
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Erreur', 'Impossible de scanner les appareils.');
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (device: PrinterDevice) => {
    setConnecting(device.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const success = await UnifiedPrinterService.connect(device);

      if (success) {
        setLastDevice(device);
        onConnected?.(device);

        Alert.alert(
          '✅ Connecté!',
          `Imprimante "${device.name}" connectée avec succès.`,
          [{ text: 'Super!' }]
        );
      } else {
        const error = UnifiedPrinterService.getConnectionStatus().lastError;
        Alert.alert(
          '❌ Échec de connexion',
          error || 'Impossible de se connecter à l\'imprimante.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Connect error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la connexion.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await UnifiedPrinterService.disconnect();
    setConnectionStatus(UnifiedPrinterService.getConnectionStatus());
  };

  const handleQuickConnect = async () => {
    if (!lastDevice) {
      Alert.alert('Info', 'Aucune imprimante sauvegardée. Sélectionnez-en une d\'abord.');
      return;
    }

    setConnecting(lastDevice.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await UnifiedPrinterService.connect(lastDevice);
    setConnecting(null);

    if (success) {
      onConnected?.(lastDevice);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Échec', 'Impossible de se connecter à la dernière imprimante.');
    }
  };

  const handleTestPrint = async () => {
    setTesting(true);
    setTestResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await UnifiedPrinterService.printTestPage();
      setTestResult(result);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Test print error:', error);
      setTestResult({
        success: false,
        message: 'Erreur lors du test',
        duration: 0,
        printerType: connectionStatus.type,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await UnifiedPrinterService.testConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Erreur de test',
        duration: 0,
        printerType: 'none',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleAutoConnect = async () => {
    const newValue = !autoConnect;
    setAutoConnect(newValue);
    await UnifiedPrinterService.setAutoConnect(newValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddWifiPrinter = async () => {
    if (!wifiIp.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse IP.');
      return;
    }

    const port = parseInt(wifiPort) || 9100;
    const device = await UnifiedPrinterService.addWiFiPrinter(
      wifiName.trim() || `WiFi (${wifiIp})`,
      wifiIp.trim(),
      port
    );

    setDevices((prev) => [device, ...prev.filter((d) => d.id !== device.id)]);
    setShowWifiForm(false);
    setWifiName('');
    setWifiIp('');
    setWifiPort('9100');

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveWifiPrinter = async (deviceId: string) => {
    Alert.alert(
      'Supprimer l\'imprimante',
      'Voulez-vous supprimer cette imprimante WiFi?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await UnifiedPrinterService.removeWiFiPrinter(deviceId);
            setDevices((prev) => prev.filter((d) => d.id !== deviceId));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const openSettings = () => {
    UnifiedPrinterService.openBluetoothSettings();
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getTypeIcon = (type: PrinterType, size = 24, color = colors.gray500) => {
    switch (type) {
      case 'bluetooth':
        return <Bluetooth size={size} color={color} />;
      case 'wifi':
        return <Wifi size={size} color={color} />;
      case 'usb':
        return <Usb size={size} color={color} />;
      default:
        return <Printer size={size} color={color} />;
    }
  };

  const getTypeColor = (type: PrinterType) => {
    switch (type) {
      case 'bluetooth':
        return colors.bluetooth;
      case 'wifi':
        return colors.wifi;
      case 'usb':
        return colors.usb;
      default:
        return colors.gray500;
    }
  };

  const renderTab = (type: TabType, label: string) => {
    const isActive = activeTab === type;
    const color = getTypeColor(type);

    return (
      <TouchableOpacity
        key={type}
        onPress={() => {
          setActiveTab(type);
          handleScan(type);
        }}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.md,
          backgroundColor: isActive ? color + '20' : 'transparent',
          borderBottomWidth: 2,
          borderBottomColor: isActive ? color : 'transparent',
          gap: spacing.xs,
        }}
      >
        {getTypeIcon(type, 18, isActive ? color : colors.gray500)}
        <Text
          style={{
            fontSize: 13,
            fontWeight: isActive ? '600' : '500',
            color: isActive ? color : colors.gray500,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDeviceItem = ({ item }: { item: PrinterDevice }) => {
    const isConnected =
      connectionStatus.isConnected && connectionStatus.device?.id === item.id;
    const isConnecting = connecting === item.id;
    const typeColor = getTypeColor(item.type);

    return (
      <TouchableOpacity
        onPress={() => handleConnect(item)}
        disabled={isConnecting || isConnected}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.lg,
          backgroundColor: isConnected ? colors.successLight : colors.white,
          borderRadius: 12,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: isConnected ? colors.success : colors.gray200,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: typeColor + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}
        >
          {isConnected ? (
            <CheckCircle size={24} color={colors.success} />
          ) : (
            getTypeIcon(item.type, 24, typeColor)
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.gray800,
            }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.gray500,
              marginTop: 2,
            }}
          >
            {item.address}
          </Text>
          {item.manufacturer && (
            <Text
              style={{
                fontSize: 12,
                color: colors.gray400,
                marginTop: 2,
              }}
            >
              {item.manufacturer}
            </Text>
          )}
        </View>

        {isConnecting ? (
          <ActivityIndicator size="small" color={typeColor} />
        ) : isConnected ? (
          <View
            style={{
              backgroundColor: colors.success,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600' }}>
              Connecté
            </Text>
          </View>
        ) : item.type === 'wifi' ? (
          <TouchableOpacity
            onPress={() => handleRemoveWifiPrinter(item.id)}
            style={{ padding: spacing.sm }}
          >
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderWifiForm = () => (
    <View
      style={{
        backgroundColor: colors.gray50,
        padding: spacing.lg,
        borderRadius: 12,
        marginBottom: spacing.lg,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: colors.gray800,
          marginBottom: spacing.md,
        }}
      >
        ➕ Ajouter une imprimante WiFi
      </Text>

      <TextInput
        placeholder="Nom (optionnel)"
        value={wifiName}
        onChangeText={setWifiName}
        style={{
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.gray200,
          borderRadius: 8,
          padding: spacing.md,
          fontSize: 16,
          marginBottom: spacing.sm,
        }}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          placeholder="Adresse IP (ex: 192.168.1.100)"
          value={wifiIp}
          onChangeText={setWifiIp}
          keyboardType="numeric"
          style={{
            flex: 2,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.gray200,
            borderRadius: 8,
            padding: spacing.md,
            fontSize: 16,
          }}
        />

        <TextInput
          placeholder="Port"
          value={wifiPort}
          onChangeText={setWifiPort}
          keyboardType="number-pad"
          style={{
            flex: 1,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.gray200,
            borderRadius: 8,
            padding: spacing.md,
            fontSize: 16,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity
          onPress={() => setShowWifiForm(false)}
          style={{
            flex: 1,
            padding: spacing.md,
            backgroundColor: colors.gray200,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.gray700, fontWeight: '600' }}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAddWifiPrinter}
          style={{
            flex: 1,
            padding: spacing.md,
            backgroundColor: colors.wifi,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.white, fontWeight: '600' }}>Ajouter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTestSection = () => (
    <View
      style={{
        backgroundColor: colors.gray50,
        padding: spacing.lg,
        borderRadius: 12,
        marginTop: spacing.lg,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: colors.gray800,
          marginBottom: spacing.md,
        }}
      >
        🧪 Test d'impression
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity
          onPress={handleTestConnection}
          disabled={!connectionStatus.isConnected || testing}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            backgroundColor: connectionStatus.isConnected
              ? colors.primary
              : colors.gray300,
            borderRadius: 8,
            opacity: testing ? 0.7 : 1,
            gap: spacing.xs,
          }}
        >
          {testing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Signal size={18} color={colors.white} />
          )}
          <Text style={{ color: colors.white, fontWeight: '600' }}>
            Test Connexion
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTestPrint}
          disabled={!connectionStatus.isConnected || testing}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            backgroundColor: connectionStatus.isConnected
              ? colors.success
              : colors.gray300,
            borderRadius: 8,
            opacity: testing ? 0.7 : 1,
            gap: spacing.xs,
          }}
        >
          {testing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Printer size={18} color={colors.white} />
          )}
          <Text style={{ color: colors.white, fontWeight: '600' }}>
            Test Impression
          </Text>
        </TouchableOpacity>
      </View>

      {testResult && (
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: testResult.success ? colors.successLight : colors.errorLight,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          {testResult.success ? (
            <CheckCircle size={20} color={colors.success} />
          ) : (
            <AlertTriangle size={20} color={colors.error} />
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: testResult.success ? colors.success : colors.error,
                fontWeight: '600',
              }}
            >
              {testResult.message}
            </Text>
            <Text
              style={{
                color: testResult.success ? colors.success : colors.error,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Durée: {testResult.duration}ms • Type: {testResult.printerType.toUpperCase()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.white }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.gray200,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Printer size={24} color={colors.primary} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.gray800 }}>
              Imprimantes
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: spacing.sm }}>
            <X size={24} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        {/* Quick Connect Banner */}
        {lastDevice && !connectionStatus.isConnected && (
          <TouchableOpacity
            onPress={handleQuickConnect}
            disabled={!!connecting}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryLight,
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.gray200,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: colors.primary }}>
                Connexion rapide
              </Text>
              <Text style={{ fontSize: 13, color: colors.primary }}>
                {lastDevice.name} ({lastDevice.type.toUpperCase()})
              </Text>
            </View>
            {connecting === lastDevice.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Play size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}

        {/* Connected Banner */}
        {connectionStatus.isConnected && connectionStatus.device && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.successLight,
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.gray200,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.success,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', color: colors.success }}>
                Connecté
              </Text>
              <Text style={{ fontSize: 13, color: colors.success }}>
                {connectionStatus.device.name} ({connectionStatus.type.toUpperCase()})
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDisconnect}
              style={{
                backgroundColor: colors.error,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>
                Déconnecter
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.gray200,
          }}
        >
          {renderTab('bluetooth', 'Bluetooth')}
          {renderTab('wifi', 'WiFi')}
          {renderTab('usb', 'USB')}
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Action Bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.gray500 }}>
              {devices.length} appareil(s) trouvé(s)
            </Text>
            
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {activeTab === 'wifi' && (
                <TouchableOpacity
                  onPress={() => setShowWifiForm(!showWifiForm)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.wifi,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 8,
                    gap: spacing.xs,
                  }}
                >
                  <Plus size={16} color={colors.white} />
                  <Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>
                    Ajouter
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => handleScan()}
                disabled={scanning}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: getTypeColor(activeTab),
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 8,
                  gap: spacing.xs,
                  opacity: scanning ? 0.7 : 1,
                }}
              >
                <RefreshCw
                  size={16}
                  color={colors.white}
                  style={scanning ? { transform: [{ rotate: '360deg' }] } : undefined}
                />
                <Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>
                  {scanning ? 'Recherche...' : 'Scanner'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* WiFi Form */}
          {activeTab === 'wifi' && showWifiForm && renderWifiForm()}

          {/* Device List */}
          {scanning ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={getTypeColor(activeTab)} />
              <Text style={{ color: colors.gray500, marginTop: spacing.md }}>
                Recherche en cours...
              </Text>
            </View>
          ) : devices.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              {getTypeIcon(activeTab, 48, colors.gray300)}
              <Text
                style={{
                  color: colors.gray500,
                  marginTop: spacing.lg,
                  fontSize: 16,
                  fontWeight: '500',
                }}
              >
                Aucune imprimante {activeTab.toUpperCase()} trouvée
              </Text>
              <Text
                style={{
                  color: colors.gray400,
                  marginTop: spacing.sm,
                  textAlign: 'center',
                  paddingHorizontal: spacing.xl,
                }}
              >
                {activeTab === 'bluetooth' &&
                  'Assurez-vous que le Bluetooth est activé et l\'imprimante appairée.'}
                {activeTab === 'wifi' &&
                  'Ajoutez une imprimante manuellement avec son adresse IP.'}
                {activeTab === 'usb' &&
                  'Connectez une imprimante via câble USB OTG.'}
              </Text>
              
              {activeTab === 'bluetooth' && (
                <TouchableOpacity
                  onPress={openSettings}
                  style={{
                    marginTop: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.primary,
                    paddingHorizontal: spacing.xl,
                    paddingVertical: spacing.md,
                    borderRadius: 8,
                    gap: spacing.sm,
                  }}
                >
                  <Settings size={18} color={colors.white} />
                  <Text style={{ color: colors.white, fontWeight: '600' }}>
                    Paramètres Bluetooth
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={devices}
              renderItem={renderDeviceItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}

          {/* Test Section */}
          {connectionStatus.isConnected && renderTestSection()}

          {/* Auto-connect toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.gray50,
              padding: spacing.lg,
              borderRadius: 12,
              marginTop: spacing.lg,
            }}
          >
            <View>
              <Text style={{ fontWeight: '600', color: colors.gray800 }}>
                Connexion automatique
              </Text>
              <Text style={{ fontSize: 13, color: colors.gray500, marginTop: 2 }}>
                Se connecter au démarrage
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleToggleAutoConnect}
              style={{
                width: 52,
                height: 32,
                borderRadius: 16,
                backgroundColor: autoConnect ? colors.success : colors.gray300,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.white,
                  alignSelf: autoConnect ? 'flex-end' : 'flex-start',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                }}
              />
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default UnifiedPrinterModal;
