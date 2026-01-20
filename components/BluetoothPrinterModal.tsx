/**
 * BluetoothPrinterModal - Professional POS Printer Connection UI
 * 
 * Features:
 * - One-tap quick connect to last device
 * - Real-time connection status
 * - Device scanning with loading states
 * - Auto-reconnect toggle
 * - Test print functionality
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  X,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw,
  CheckCircle,
  Printer,
  Settings,
  Zap,
  Signal,
  AlertTriangle,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import BluetoothPrinterService from '../lib/BluetoothPrinterService';
import type { 
  BluetoothDevice, 
  ConnectionStatus, 
  PrinterConnection 
} from '../lib/BluetoothPrinterService';

// ============================================================================
// TYPES
// ============================================================================

interface BluetoothPrinterModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected?: (device: BluetoothDevice) => void;
}

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

export function BluetoothPrinterModal({
  visible,
  onClose,
  onConnected,
}: BluetoothPrinterModalProps) {
  // State
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<PrinterConnection>(
    BluetoothPrinterService.getConnectionStatus()
  );
  const [lastDevice, setLastDevice] = useState<BluetoothDevice | null>(null);
  const [autoConnect, setAutoConnect] = useState(false);
  const [testing, setTesting] = useState(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (visible) {
      loadInitialData();
      
      // Subscribe to connection status changes
      const unsubscribe = BluetoothPrinterService.onConnectionStatusChange(
        (status: ConnectionStatus) => {
          setConnectionStatus(BluetoothPrinterService.getConnectionStatus());
          
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
      BluetoothPrinterService.getLastConnectedDevice(),
      BluetoothPrinterService.getAutoConnect(),
    ]);
    setLastDevice(last);
    setAutoConnect(auto);
    setConnectionStatus(BluetoothPrinterService.getConnectionStatus());
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleScan = async () => {
    setScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const foundDevices = await BluetoothPrinterService.scanDevices();
      setDevices(foundDevices);
      
      if (foundDevices.length === 0) {
        Alert.alert(
          '🔍 Aucun appareil trouvé',
          'Assurez-vous que:\n• Le Bluetooth est activé\n• L\'imprimante est allumée\n• L\'imprimante est appairée',
          [
            { text: 'OK' },
            {
              text: 'Paramètres Bluetooth',
              onPress: openBluetoothSettings,
            },
          ]
        );
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Erreur', 'Impossible de scanner les appareils Bluetooth.');
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (device: BluetoothDevice) => {
    setConnecting(device.address);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const success = await BluetoothPrinterService.connect(device);
      
      if (success) {
        setLastDevice(device);
        onConnected?.(device);
        
        Alert.alert(
          '✅ Connecté!',
          `Imprimante "${device.name}" connectée avec succès.`,
          [{ text: 'Super!' }]
        );
      } else {
        Alert.alert(
          '❌ Échec de connexion',
          `Impossible de se connecter à "${device.name}".\nVérifiez que l'imprimante est allumée et à portée.`,
          [
            { text: 'OK' },
            { text: 'Réessayer', onPress: () => handleConnect(device) },
          ]
        );
      }
    } catch (error) {
      console.error('Connect error:', error);
    } finally {
      setConnecting(null);
    }
  };

  const handleQuickConnect = async () => {
    if (!lastDevice) {
      Alert.alert(
        'Pas d\'imprimante enregistrée',
        'Scannez et connectez-vous à une imprimante pour activer la connexion rapide.'
      );
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConnecting(lastDevice.address);
    
    try {
      const success = await BluetoothPrinterService.connect(lastDevice);
      
      if (success) {
        onConnected?.(lastDevice);
      } else {
        Alert.alert(
          '❌ Échec de connexion rapide',
          'L\'imprimante n\'est peut-être pas disponible. Essayez de scanner les appareils.',
          [
            { text: 'OK' },
            { text: 'Scanner', onPress: handleScan },
          ]
        );
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await BluetoothPrinterService.disconnect();
  };

  const handleTestPrint = async () => {
    setTesting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const success = await BluetoothPrinterService.printTestPage();
      
      if (success) {
        Alert.alert('✅ Test réussi', 'Le ticket de test a été imprimé avec succès!');
      } else {
        Alert.alert('❌ Échec du test', 'Impossible d\'imprimer le ticket de test.');
      }
    } catch {
      Alert.alert('Erreur', 'Une erreur s\'est produite pendant l\'impression test.');
    } finally {
      setTesting(false);
    }
  };

  const handleAutoConnectToggle = async () => {
    const newValue = !autoConnect;
    setAutoConnect(newValue);
    await BluetoothPrinterService.setAutoConnect(newValue);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openBluetoothSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
        Linking.openSettings();
      });
    } else {
      Linking.openURL('App-Prefs:Bluetooth');
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderConnectionStatus = () => {
    const { isConnected, isConnecting, device, lastError } = connectionStatus;

    if (isConnecting) {
      return (
        <View style={{
          backgroundColor: colors.warningLight,
          padding: spacing.lg,
          borderRadius: 8,
          marginBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}>
          <ActivityIndicator color={colors.warning} size="small" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.gray800, fontWeight: '600', fontSize: 15 }}>
              Connexion en cours...
            </Text>
            <Text style={{ color: colors.gray600, fontSize: 13, marginTop: 2 }}>
              {device?.name || 'Imprimante'}
            </Text>
          </View>
        </View>
      );
    }

    if (isConnected && device) {
      return (
        <View style={{
          backgroundColor: colors.successLight,
          padding: spacing.lg,
          borderRadius: 8,
          marginBottom: spacing.lg,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BluetoothConnected size={24} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.gray800, fontWeight: '700', fontSize: 16 }}>
                ✓ Connectée
              </Text>
              <Text style={{ color: colors.gray600, fontSize: 14, marginTop: 2 }}>
                {device.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDisconnect}
              style={{
                backgroundColor: colors.white,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: colors.error, fontWeight: '600', fontSize: 13 }}>
                Déconnecter
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons when connected */}
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <TouchableOpacity
              onPress={handleTestPrint}
              disabled={testing}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                backgroundColor: colors.white,
                paddingVertical: spacing.md,
                borderRadius: 10,
              }}
            >
              {testing ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <Printer size={18} color={colors.success} />
              )}
              <Text style={{ color: colors.success, fontWeight: '600', fontSize: 13 }}>
                {testing ? 'Impression...' : 'Test impression'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (lastError) {
      return (
        <View style={{
          backgroundColor: colors.errorLight,
          padding: spacing.lg,
          borderRadius: 8,
          marginBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}>
          <AlertTriangle size={24} color={colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>
              Erreur de connexion
            </Text>
            <Text style={{ color: colors.gray600, fontSize: 13, marginTop: 2 }}>
              {lastError}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={{
        backgroundColor: colors.gray100,
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}>
        <BluetoothOff size={24} color={colors.gray500} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.gray800, fontWeight: '600', fontSize: 15 }}>
            Aucune imprimante connectée
          </Text>
          <Text style={{ color: colors.gray500, fontSize: 13, marginTop: 2 }}>
            Scannez ou utilisez la connexion rapide
          </Text>
        </View>
      </View>
    );
  };

  const renderQuickConnect = () => {
    if (!lastDevice) return null;

    return (
      <TouchableOpacity
        onPress={handleQuickConnect}
        disabled={connecting !== null || connectionStatus.isConnected}
        style={{
          backgroundColor: connectionStatus.isConnected 
            ? colors.gray200 
            : colors.primary,
          padding: spacing.lg,
          borderRadius: 8,
          marginBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: connectionStatus.isConnected ? 0.6 : 1,
        }}
      >
        <View style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: connectionStatus.isConnected 
            ? colors.gray300 
            : 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {connecting === lastDevice.address ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Zap size={26} color={colors.white} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ 
            color: colors.white, 
            fontWeight: '700', 
            fontSize: 17,
          }}>
            ⚡ Connexion Rapide
          </Text>
          <Text style={{ 
            color: 'rgba(255,255,255,0.8)', 
            fontSize: 14, 
            marginTop: 2 
          }}>
            {lastDevice.name}
          </Text>
        </View>
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 8,
        }}>
          <Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>
            1 TAP
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDevice = ({ item }: { item: BluetoothDevice }) => {
    const isConnecting = connecting === item.address;
    const isCurrentDevice = connectionStatus.device?.address === item.address;
    const isConnected = isCurrentDevice && connectionStatus.isConnected;

    return (
      <TouchableOpacity
        onPress={() => handleConnect(item)}
        disabled={isConnecting || isConnected}
        style={{
          backgroundColor: isConnected ? colors.successLight : colors.white,
          padding: spacing.lg,
          borderRadius: 8,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          borderWidth: 1,
          borderColor: isConnected ? colors.success : colors.gray200,
        }}
      >
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: isConnected ? colors.success : colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isConnecting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isConnected ? (
            <CheckCircle size={22} color={colors.white} />
          ) : (
            <Printer size={22} color={colors.primary} />
          )}
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{ 
            color: colors.gray800, 
            fontWeight: '600', 
            fontSize: 15,
          }}>
            {item.name || 'Appareil inconnu'}
          </Text>
          <Text style={{ 
            color: colors.gray500, 
            fontSize: 12, 
            marginTop: 2,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          }}>
            {item.address}
          </Text>
        </View>

        {item.paired && !isConnected && (
          <View style={{
            backgroundColor: colors.primaryLight,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 6,
          }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
              APPAIRÉ
            </Text>
          </View>
        )}

        {isConnected && (
          <View style={{
            backgroundColor: colors.success,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 6,
          }}>
            <Text style={{ color: colors.white, fontSize: 11, fontWeight: '600' }}>
              CONNECTÉ
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
      <View style={{ flex: 1, backgroundColor: colors.gray50 }}>
        {/* Header - macOS Style */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#F5F5F5',
          borderBottomWidth: 1,
          borderBottomColor: '#D0D0D0',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#007AFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bluetooth size={16} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: '600', 
                color: '#1C1C1E' 
              }}>
                Imprimante Bluetooth
              </Text>
              <Text style={{ 
                fontSize: 12, 
                color: '#8E8E93',
                marginTop: 1,
              }}>
                Connexion rapide POS
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              backgroundColor: '#E8E8E8',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#C8C8C8',
            }}
          >
            <X size={18} color="#666666" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={{ flex: 1, padding: spacing.lg }}>
          {/* Connection Status */}
          {renderConnectionStatus()}

          {/* Quick Connect */}
          {renderQuickConnect()}

          {/* Auto-reconnect Toggle */}
          <TouchableOpacity
            onPress={handleAutoConnectToggle}
            style={{
              backgroundColor: colors.white,
              padding: spacing.lg,
              borderRadius: 8,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: colors.gray200,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Signal size={20} color={colors.gray600} />
              <View>
                <Text style={{ color: colors.gray800, fontWeight: '600', fontSize: 14 }}>
                  Reconnexion automatique
                </Text>
                <Text style={{ color: colors.gray500, fontSize: 12, marginTop: 2 }}>
                  Se reconnecter au démarrage
                </Text>
              </View>
            </View>
            <View style={{
              width: 50,
              height: 28,
              borderRadius: 14,
              backgroundColor: autoConnect ? colors.success : colors.gray300,
              padding: 2,
            }}>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.white,
                transform: [{ translateX: autoConnect ? 22 : 0 }],
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {autoConnect && <Check size={14} color={colors.success} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* Scan Section */}
          <View style={{
            backgroundColor: colors.white,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.gray200,
            overflow: 'hidden',
            flex: 1,
          }}>
            {/* Scan Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.gray100,
            }}>
              <Text style={{ 
                fontSize: 15, 
                fontWeight: '600', 
                color: colors.gray800 
              }}>
                Appareils disponibles
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={openBluetoothSettings}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    backgroundColor: colors.gray100,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 8,
                  }}
                >
                  <Settings size={16} color={colors.gray600} />
                  <Text style={{ color: colors.gray600, fontSize: 12, fontWeight: '500' }}>
                    Paramètres
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleScan}
                  disabled={scanning}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    backgroundColor: colors.primary,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 8,
                  }}
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <RefreshCw size={16} color={colors.white} />
                  )}
                  <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600' }}>
                    {scanning ? 'Scan...' : 'Scanner'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Device List */}
            {devices.length > 0 ? (
              <FlatList
                data={devices}
                renderItem={renderDevice}
                keyExtractor={item => item.address}
                contentContainerStyle={{ padding: spacing.md }}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.xxl,
              }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.gray100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.lg,
                }}>
                  <Bluetooth size={36} color={colors.gray400} />
                </View>
                <Text style={{ 
                  color: colors.gray600, 
                  fontSize: 15, 
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  Aucun appareil trouvé
                </Text>
                <Text style={{ 
                  color: colors.gray500, 
                  fontSize: 13, 
                  textAlign: 'center',
                  marginTop: spacing.xs,
                  paddingHorizontal: spacing.xl,
                }}>
                  {'Appuyez sur "Scanner" pour rechercher des imprimantes Bluetooth appairées'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Help Section */}
        <View style={{
          backgroundColor: colors.primaryLight,
          padding: spacing.lg,
          margin: spacing.lg,
          marginTop: 0,
          borderRadius: 8,
        }}>
          <Text style={{ 
            color: colors.primaryDark, 
            fontWeight: '600', 
            fontSize: 13,
            marginBottom: spacing.xs,
          }}>
            💡 Conseil
          </Text>
          <Text style={{ color: colors.primary, fontSize: 12, lineHeight: 18 }}>
            {"Pour une connexion rapide, appairez d'abord votre imprimante dans les paramètres Bluetooth de l'appareil, puis scannez ici."}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default BluetoothPrinterModal;
