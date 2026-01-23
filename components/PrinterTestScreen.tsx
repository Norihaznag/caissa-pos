/**
 * PrinterTestScreen - Comprehensive Printer Testing & Setup Component
 * 
 * Features:
 * - USB, Bluetooth, WiFi printer discovery
 * - Connection testing
 * - Print test page
 * - Receipt preview and printing
 * - Auto-connect configuration
 * 
 * @version 2.1.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Switch,
  Platform,
  NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  thermalPrinterService,
  UsbDevice,
  BluetoothDevice,
  WifiPrinter,
  ConnectionStatus,
} from '../lib/ThermalPrinterService';

// Theme colors (matching app theme)
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  border: '#e2e8f0',
};

type TabType = 'usb' | 'bluetooth' | 'wifi';

interface Props {
  visible?: boolean;
  onClose?: () => void;
}

export const PrinterTestScreen: React.FC<Props> = ({ visible = true, onClose }) => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('usb');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    transport: null,
  });
  
  // Device lists
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [wifiPrinters, setWifiPrinters] = useState<WifiPrinter[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  
  // WiFi form
  const [showWifiForm, setShowWifiForm] = useState(false);
  const [wifiName, setWifiName] = useState('');
  const [wifiIp, setWifiIp] = useState('');
  const [wifiPort, setWifiPort] = useState('9100');
  
  // Settings
  const [autoConnect, setAutoConnect] = useState(false);
  
  // Initialize
  useEffect(() => {
    if (visible) {
      initialize();
    }
    return () => {
      thermalPrinterService.stopBluetoothDiscovery();
    };
  }, [visible]);

  const initialize = async () => {
    setIsLoading(true);
    try {
      await thermalPrinterService.initialize();
      await refreshAll();
      
      const autoConnectEnabled = await thermalPrinterService.getAutoConnect();
      setAutoConnect(autoConnectEnabled);
    } catch (error) {
      console.error('Initialize error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      // Get connection status
      const status = await thermalPrinterService.getConnectionStatus();
      setConnectionStatus(status);

      // Refresh based on active tab
      if (activeTab === 'usb') {
        const devices = await thermalPrinterService.getUsbDevices();
        setUsbDevices(devices);
      } else if (activeTab === 'bluetooth') {
        const paired = await thermalPrinterService.getPairedBluetoothDevices();
        setBluetoothDevices(paired);
      } else if (activeTab === 'wifi') {
        const saved = await thermalPrinterService.getWifiPrinters();
        setWifiPrinters(saved);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh when tab changes
  useEffect(() => {
    if (visible) {
      refreshAll();
    }
  }, [activeTab]);

  // USB handlers
  const handleConnectUsb = async (device: UsbDevice) => {
    setIsLoading(true);
    try {
      const success = await thermalPrinterService.connectUsb(device.deviceId);
      if (success) {
        Alert.alert('Succès', `Connecté à ${device.productName || 'imprimante USB'}`);
        await refreshAll();
      } else {
        Alert.alert('Erreur', 'Impossible de connecter à l\'imprimante USB');
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Bluetooth handlers
  const handleConnectBluetooth = async (device: BluetoothDevice) => {
    setIsLoading(true);
    try {
      const success = await thermalPrinterService.connectBluetooth(device.address);
      if (success) {
        Alert.alert('Succès', `Connecté à ${device.name}`);
        await refreshAll();
      } else {
        Alert.alert('Erreur', 'Impossible de connecter. Assurez-vous que l\'imprimante est allumée et appairée.');
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveredDevices([]);
    
    const success = await thermalPrinterService.startBluetoothDiscovery(
      (device) => {
        setDiscoveredDevices((prev) => {
          if (prev.find((d) => d.address === device.address)) return prev;
          return [...prev, device];
        });
      },
      () => {
        setIsDiscovering(false);
      }
    );

    if (!success) {
      setIsDiscovering(false);
      Alert.alert('Erreur', 'Impossible de démarrer la recherche Bluetooth');
    }

    // Auto-stop after 15 seconds
    setTimeout(() => {
      thermalPrinterService.stopBluetoothDiscovery();
      setIsDiscovering(false);
    }, 15000);
  };

  const handleStopDiscovery = async () => {
    await thermalPrinterService.stopBluetoothDiscovery();
    setIsDiscovering(false);
  };

  // WiFi handlers
  const handleConnectWifi = async (printer: WifiPrinter) => {
    setIsLoading(true);
    try {
      const success = await thermalPrinterService.connectWifi(printer.ipAddress, printer.port);
      if (success) {
        Alert.alert('Succès', `Connecté à ${printer.name}`);
        await refreshAll();
      } else {
        Alert.alert('Erreur', `Impossible de connecter à ${printer.ipAddress}:${printer.port}`);
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWifiPrinter = async () => {
    if (!wifiName.trim() || !wifiIp.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom et l\'adresse IP');
      return;
    }

    try {
      await thermalPrinterService.saveWifiPrinter({
        name: wifiName.trim(),
        ipAddress: wifiIp.trim(),
        port: parseInt(wifiPort, 10) || 9100,
      });
      
      setShowWifiForm(false);
      setWifiName('');
      setWifiIp('');
      setWifiPort('9100');
      await refreshAll();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ajouter l\'imprimante');
    }
  };

  const handleDeleteWifiPrinter = async (printer: WifiPrinter) => {
    Alert.alert(
      'Supprimer',
      `Supprimer ${printer.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await thermalPrinterService.deleteWifiPrinter(printer.id);
            await refreshAll();
          },
        },
      ]
    );
  };

  // Print handlers
  const handleTestPrint = async () => {
    if (!connectionStatus.isConnected) {
      Alert.alert('Non connecté', 'Veuillez d\'abord connecter une imprimante');
      return;
    }

    setIsLoading(true);
    try {
      const success = await thermalPrinterService.printTestPage();
      if (success) {
        Alert.alert('Succès', 'Page de test imprimée!');
      } else {
        Alert.alert('Erreur', 'Échec de l\'impression');
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintSampleReceipt = async () => {
    if (!connectionStatus.isConnected) {
      Alert.alert('Non connecté', 'Veuillez d\'abord connecter une imprimante');
      return;
    }

    setIsLoading(true);
    try {
      const success = await thermalPrinterService.printReceipt({
        header: 'CaissaPro',
        subheader: 'Café Restaurant Test',
        items: [
          { name: 'Café Express', quantity: 2, price: 15, total: 30 },
          { name: 'Croissant', quantity: 1, price: 12, total: 12 },
          { name: 'Jus d\'orange', quantity: 1, price: 20, total: 20 },
        ],
        subtotal: 62,
        total: 62,
        footer: 'Merci de votre visite!',
        date: new Date().toLocaleString('fr-FR'),
      });

      if (success) {
        Alert.alert('Succès', 'Ticket exemple imprimé!');
      } else {
        Alert.alert('Erreur', 'Échec de l\'impression');
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCashDrawer = async () => {
    if (!connectionStatus.isConnected) {
      Alert.alert('Non connecté', 'Veuillez d\'abord connecter une imprimante');
      return;
    }

    setIsLoading(true);
    try {
      const success = await thermalPrinterService.openCashDrawer();
      if (success) {
        Alert.alert('Succès', 'Commande tiroir-caisse envoyée');
      } else {
        Alert.alert('Info', 'Commande envoyée (vérifiez si le tiroir-caisse est connecté)');
      }
    } catch (error) {
      Alert.alert('Erreur', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await thermalPrinterService.disconnect();
      await refreshAll();
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoConnectChange = async (value: boolean) => {
    setAutoConnect(value);
    await thermalPrinterService.setAutoConnect(value);
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'usb':
        return renderUsbTab();
      case 'bluetooth':
        return renderBluetoothTab();
      case 'wifi':
        return renderWifiTab();
    }
  };

  const renderUsbTab = () => (
    <View style={styles.tabContent}>
      {usbDevices.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="hardware-chip-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Aucun périphérique USB détecté</Text>
          <Text style={styles.emptySubtext}>
            Branchez votre imprimante USB et actualisez
          </Text>
        </View>
      ) : (
        usbDevices.map((device) => (
          <TouchableOpacity
            key={device.deviceId}
            style={[
              styles.deviceCard,
              connectionStatus.transport === 'usb' && styles.deviceCardConnected,
            ]}
            onPress={() => handleConnectUsb(device)}
          >
            <View style={styles.deviceIcon}>
              <Ionicons name="print" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{device.productName || 'Imprimante USB'}</Text>
              <Text style={styles.deviceDetails}>
                {device.manufacturerName} • VID:{device.vendorId} PID:{device.productId}
              </Text>
            </View>
            <View style={styles.deviceStatus}>
              {device.hasPermission ? (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              ) : (
                <Ionicons name="lock-closed" size={20} color={COLORS.warning} />
              )}
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderBluetoothTab = () => (
    <View style={styles.tabContent}>
      {/* Paired devices */}
      <Text style={styles.sectionTitle}>Appareils appairés</Text>
      {bluetoothDevices.length === 0 ? (
        <Text style={styles.emptySubtext}>Aucun appareil appairé</Text>
      ) : (
        bluetoothDevices.map((device) => (
          <TouchableOpacity
            key={device.address}
            style={[
              styles.deviceCard,
              connectionStatus.transport === 'bluetooth' && styles.deviceCardConnected,
            ]}
            onPress={() => handleConnectBluetooth(device)}
          >
            <View style={styles.deviceIcon}>
              <Ionicons
                name={device.isProbablyPrinter ? 'print' : 'bluetooth'}
                size={24}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{device.name || 'Appareil inconnu'}</Text>
              <Text style={styles.deviceDetails}>{device.address}</Text>
            </View>
            {device.isProbablyPrinter && (
              <View style={styles.printerBadge}>
                <Text style={styles.printerBadgeText}>Imprimante</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}

      {/* Discovery */}
      <View style={styles.discoverySection}>
        <Text style={styles.sectionTitle}>Rechercher</Text>
        <TouchableOpacity
          style={[styles.discoveryButton, isDiscovering && styles.discoveryButtonActive]}
          onPress={isDiscovering ? handleStopDiscovery : handleStartDiscovery}
        >
          {isDiscovering ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="search" size={20} color="#fff" />
          )}
          <Text style={styles.discoveryButtonText}>
            {isDiscovering ? 'Arrêter' : 'Rechercher'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discovered devices */}
      {discoveredDevices.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Appareils trouvés</Text>
          {discoveredDevices.map((device) => (
            <TouchableOpacity
              key={device.address}
              style={styles.deviceCard}
              onPress={() => handleConnectBluetooth(device)}
            >
              <View style={styles.deviceIcon}>
                <Ionicons name="bluetooth" size={24} color={COLORS.textSecondary} />
              </View>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name || 'Appareil inconnu'}</Text>
                <Text style={styles.deviceDetails}>{device.address}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );

  const renderWifiTab = () => (
    <View style={styles.tabContent}>
      {/* Saved printers */}
      {wifiPrinters.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wifi" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Aucune imprimante WiFi</Text>
          <Text style={styles.emptySubtext}>
            Ajoutez l'adresse IP de votre imprimante réseau
          </Text>
        </View>
      ) : (
        wifiPrinters.map((printer) => (
          <TouchableOpacity
            key={printer.id}
            style={[
              styles.deviceCard,
              connectionStatus.transport === 'wifi' && styles.deviceCardConnected,
            ]}
            onPress={() => handleConnectWifi(printer)}
            onLongPress={() => handleDeleteWifiPrinter(printer)}
          >
            <View style={styles.deviceIcon}>
              <Ionicons name="print" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{printer.name}</Text>
              <Text style={styles.deviceDetails}>
                {printer.ipAddress}:{printer.port}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteWifiPrinter(printer)}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}

      {/* Add button */}
      <TouchableOpacity
        style={styles.addWifiButton}
        onPress={() => setShowWifiForm(true)}
      >
        <Ionicons name="add-circle" size={24} color={COLORS.primary} />
        <Text style={styles.addWifiButtonText}>Ajouter une imprimante WiFi</Text>
      </TouchableOpacity>
    </View>
  );

  // WiFi form modal
  const renderWifiFormModal = () => (
    <Modal visible={showWifiForm} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Nouvelle imprimante WiFi</Text>
          
          <Text style={styles.inputLabel}>Nom</Text>
          <TextInput
            style={styles.input}
            value={wifiName}
            onChangeText={setWifiName}
            placeholder="Ex: Imprimante cuisine"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.inputLabel}>Adresse IP</Text>
          <TextInput
            style={styles.input}
            value={wifiIp}
            onChangeText={setWifiIp}
            placeholder="Ex: 192.168.1.100"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Port (défaut: 9100)</Text>
          <TextInput
            style={styles.input}
            value={wifiPort}
            onChangeText={setWifiPort}
            placeholder="9100"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowWifiForm(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleAddWifiPrinter}
            >
              <Text style={styles.confirmButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Check if running in Expo Go (native module won't be available)
  const isNativeModuleAvailable = !!NativeModules.ThermalPrinterModule;
  const router = useRouter();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  if (!visible) return null;

  // Show message when running in Expo Go
  if (!isNativeModuleAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Configuration Imprimante</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="alert-circle" size={80} color={COLORS.warning} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: COLORS.text, marginTop: 24, textAlign: 'center' }}>
            Module Natif Non Disponible
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
            Cette fonctionnalité nécessite l'APK compilé.{'\n\n'}
            L'impression USB, Bluetooth et WiFi ne fonctionne pas avec Expo Go.{'\n\n'}
            Installez l'APK pour tester l'impression :
          </Text>
          <View style={{ 
            backgroundColor: COLORS.primary + '15', 
            padding: 16, 
            borderRadius: 8, 
            marginTop: 20,
            width: '100%',
          }}>
            <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600', textAlign: 'center' }}>
              CaissaPro-v2.1.1-release.apk
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 16, textAlign: 'center' }}>
            Chemin: c:\\Users\\pc\\drive\\Bureau\\codes\\poss\\
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Configuration Imprimante</Text>
        <View style={styles.placeholder} />
      </View>

        {/* Connection Status */}
        <View
          style={[
            styles.statusBar,
            connectionStatus.isConnected ? styles.statusConnected : styles.statusDisconnected,
          ]}
        >
          <Ionicons
            name={connectionStatus.isConnected ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color="#fff"
          />
          <Text style={styles.statusText}>
            {connectionStatus.isConnected
              ? `Connecté via ${connectionStatus.transport?.toUpperCase()}`
              : 'Non connecté'}
          </Text>
          {connectionStatus.isConnected && (
            <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectButton}>
              <Text style={styles.disconnectText}>Déconnecter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['usb', 'bluetooth', 'wifi'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === 'usb' ? 'hardware-chip' : tab === 'bluetooth' ? 'bluetooth' : 'wifi'}
                size={20}
                color={activeTab === tab ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshAll} />
          }
        >
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
          {renderTabContent()}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, !connectionStatus.isConnected && styles.actionButtonDisabled]}
            onPress={handleTestPrint}
            disabled={!connectionStatus.isConnected}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Page Test</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, !connectionStatus.isConnected && styles.actionButtonDisabled]}
            onPress={handlePrintSampleReceipt}
            disabled={!connectionStatus.isConnected}
          >
            <Ionicons name="receipt" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Ticket Demo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.drawerButton,
              !connectionStatus.isConnected && styles.actionButtonDisabled,
            ]}
            onPress={handleOpenCashDrawer}
            disabled={!connectionStatus.isConnected}
          >
            <Ionicons name="cash" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Tiroir</Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.settings}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Connexion automatique</Text>
            <Switch
              value={autoConnect}
              onValueChange={handleAutoConnectChange}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {renderWifiFormModal()}
      </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 36,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  statusConnected: {
    backgroundColor: COLORS.success,
  },
  statusDisconnected: {
    backgroundColor: COLORS.textSecondary,
  },
  statusText: {
    flex: 1,
    color: '#fff',
    fontWeight: '500',
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  disconnectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  loadingOverlay: {
    padding: 40,
    alignItems: 'center',
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deviceCardConnected: {
    borderColor: COLORS.success,
    backgroundColor: '#f0fdf4',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  deviceDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  deviceStatus: {
    marginLeft: 8,
  },
  printerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  printerBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  discoverySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  discoveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  discoveryButtonActive: {
    backgroundColor: COLORS.danger,
  },
  discoveryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  addWifiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    gap: 8,
  },
  addWifiButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  drawerButton: {
    backgroundColor: COLORS.success,
  },
  settings: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default PrinterTestScreen;
