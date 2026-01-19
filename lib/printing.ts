/**
 * ⚠️ DEPRECATED - Legacy Printing Module
 * 
 * This file is kept for backward compatibility only.
 * All printing operations should use lib/services/PrinterService.ts instead.
 * 
 * @deprecated Use PrinterService from 'lib/services/PrinterService' instead
 * @version 3.0.0 - Marked as deprecated
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, PermissionsAndroid, Linking, NativeModules, NativeEventEmitter } from 'react-native';
import BluetoothPrinterService from './BluetoothPrinterService';
import UnifiedPrinterService, { PrinterDevice, PrinterType as UnifiedPrinterType } from './UnifiedPrinterService';
import { thermalPrinterService, ReceiptData as ThermalReceiptData } from './ThermalPrinterService';

// ============================================================================
// ⚠️ DEPRECATION NOTICE
// ============================================================================
// 
// This module is DEPRECATED. Use PrinterService instead:
// 
// import { PrinterService } from '@/lib/services/PrinterService';
// await PrinterService.printReceipt(receiptData);
// 
// The functions in this file are kept for backward compatibility but will
// log deprecation warnings when used.
// 
// ============================================================================

// Storage keys
const PRINTER_CONFIG_KEY = 'pos_printer_config';
const RECEIPT_DESIGN_KEY = 'pos_receipt_design';
const AUTO_PRINT_KEY = 'pos_auto_print_enabled';

// Printer types (keeping backward compatibility)
export type PrinterType = 'bluetooth' | 'network' | 'wifi' | 'usb' | 'none';

export interface PrinterConfig {
  type: PrinterType;
  name: string;
  address: string; // MAC address for Bluetooth, IP:port for network
  paperWidth: 58 | 80; // mm
  enabled: boolean;
}

// Receipt design configuration
export interface ReceiptDesign {
  // Shop Identity
  showLogo: boolean;
  restaurantName: string;
  address: string;
  city: string;
  phone: string;
  taxId: string;  // ICE / IF / RC
  
  // Footer
  footerMessage: string;
  footerMessageArabic: string;
  
  // Toggle options - what to show/hide
  showTaxId: boolean;
  showOrderNumber: boolean;
  showTableNumber: boolean;
  showWaiterName: boolean;
  showDateTime: boolean;
  showPaymentDetails: boolean;
  showSubtotal: boolean;
  showTotal: boolean;
  showFooter: boolean;
  
  // Formatting options
  fontSize: 'small' | 'normal' | 'large';
  paperWidth: 58 | 80;
  boldTotal: boolean;
  separatorStyle: 'dash' | 'equal' | 'dot';
  centerHeader: boolean;
  autoCut: boolean;
}

// Default receipt design
const defaultReceiptDesign: ReceiptDesign = {
  showLogo: false,
  restaurantName: 'CaissaPro',
  address: '',
  city: '',
  phone: '',
  taxId: '',
  footerMessage: 'Merci de votre visite!',
  footerMessageArabic: '',
  showTaxId: false,
  showOrderNumber: true,
  showTableNumber: true,
  showWaiterName: true,
  showDateTime: true,
  showPaymentDetails: true,
  showSubtotal: true,
  showTotal: true,
  showFooter: true,
  fontSize: 'normal',
  paperWidth: 80,
  boldTotal: true,
  separatorStyle: 'dash',
  centerHeader: true,
  autoCut: true,
};

// Default printer config
const defaultPrinterConfig: PrinterConfig = {
  type: 'none',
  name: '',
  address: '',
  paperWidth: 80,
  enabled: false,
};

// ============================================================================
// RECEIPT DESIGN MANAGEMENT
// ============================================================================

export const saveReceiptDesign = async (design: ReceiptDesign): Promise<void> => {
  try {
    await AsyncStorage.setItem(RECEIPT_DESIGN_KEY, JSON.stringify(design));
  } catch (error) {
    console.error('Error saving receipt design:', error);
  }
};

export const loadReceiptDesign = async (): Promise<ReceiptDesign> => {
  try {
    const data = await AsyncStorage.getItem(RECEIPT_DESIGN_KEY);
    return data ? { ...defaultReceiptDesign, ...JSON.parse(data) } : defaultReceiptDesign;
  } catch (error) {
    console.error('Error loading receipt design:', error);
    return defaultReceiptDesign;
  }
};

// ============================================================================
// PRINTER CONFIGURATION
// ============================================================================

// Save printer configuration
export const savePrinterConfig = async (config: PrinterConfig): Promise<void> => {
  try {
    await AsyncStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving printer config:', error);
  }
};

// Load printer configuration
export const loadPrinterConfig = async (): Promise<PrinterConfig> => {
  try {
    const data = await AsyncStorage.getItem(PRINTER_CONFIG_KEY);
    return data ? JSON.parse(data) : defaultPrinterConfig;
  } catch (error) {
    console.error('Error loading printer config:', error);
    return defaultPrinterConfig;
  }
};

// ============================================================================
// BLUETOOTH DEVICE DISCOVERY (Platform-specific)
// ============================================================================

export interface BluetoothDevice {
  name: string;
  address: string;
  paired: boolean;
}

// Request Bluetooth permissions - must be called before scanning
export const requestBluetoothPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const apiLevel = Platform.Version;
      
      // Android 12+ (API 31+) requires new Bluetooth permissions
      if (typeof apiLevel === 'number' && apiLevel >= 31) {
        const bluetoothScanGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: 'Permission Bluetooth Scan',
            message: 'CaissaPro a besoin de scanner les appareils Bluetooth pour trouver des imprimantes.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        
        const bluetoothConnectGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: 'Permission Bluetooth Connect',
            message: 'CaissaPro a besoin de se connecter aux imprimantes Bluetooth.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        
        // Still need location for some devices
        const locationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permission Localisation',
            message: 'La localisation est nécessaire pour détecter les appareils Bluetooth à proximité.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        
        const allGranted = 
          bluetoothScanGranted === PermissionsAndroid.RESULTS.GRANTED &&
          bluetoothConnectGranted === PermissionsAndroid.RESULTS.GRANTED &&
          locationGranted === PermissionsAndroid.RESULTS.GRANTED;
        
        if (!allGranted) {
          Alert.alert(
            'Permissions requises',
            'Veuillez autoriser le Bluetooth et la localisation dans les paramètres de l\'application pour utiliser l\'imprimante.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Paramètres', onPress: () => Linking.openSettings() }
            ]
          );
          return false;
        }
        
        return true;
      } else {
        // Android 11 and below - need location permission for Bluetooth scanning
        const locationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permission Localisation',
            message: 'La localisation est nécessaire pour détecter les appareils Bluetooth à proximité.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        
        if (locationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission requise',
            'Veuillez autoriser la localisation pour scanner les appareils Bluetooth.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Paramètres', onPress: () => Linking.openSettings() }
            ]
          );
          return false;
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error requesting Bluetooth permissions:', error);
      return false;
    }
  }
  
  // iOS handles permissions through Info.plist
  return true;
};

// Check if Bluetooth is enabled
export const checkBluetoothEnabled = async (): Promise<boolean> => {
  // This would require a native module to check Bluetooth state
  // For now, we'll show a message asking user to enable Bluetooth
  if (Platform.OS === 'android') {
    Alert.alert(
      'Bluetooth',
      'Assurez-vous que le Bluetooth est activé sur votre appareil.',
      [
        { text: 'OK' },
        { text: 'Paramètres Bluetooth', onPress: () => Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => Linking.openSettings()) }
      ]
    );
  }
  return true;
};

// Discover Bluetooth devices
export const discoverBluetoothDevices = async (): Promise<BluetoothDevice[]> => {
  const hasPermissions = await requestBluetoothPermissions();
  if (!hasPermissions) {
    return [];
  }
  
  if (Platform.OS === 'android') {
    // Show instructions for manual pairing since we don't have a full Bluetooth library
    Alert.alert(
      '📱 Recherche Bluetooth',
      'Pour connecter une imprimante Bluetooth:\n\n' +
      '1. Activez le Bluetooth sur votre appareil\n' +
      '2. Allumez votre imprimante en mode appairage\n' +
      '3. Allez dans Paramètres → Bluetooth\n' +
      '4. Appairez votre imprimante\n' +
      '5. Notez l\'adresse MAC (ex: XX:XX:XX:XX:XX:XX)\n' +
      '6. Entrez cette adresse dans CaissaPro',
      [
        { text: 'OK' },
        { 
          text: 'Ouvrir Bluetooth', 
          onPress: () => {
            Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS')
              .catch(() => Linking.openSettings());
          }
        }
      ]
    );
    
    // Return previously paired devices if available
    // Note: For full device list, integrate react-native-bluetooth-escpos-printer
    try {
      // Get saved printer address as a "known" device
      const config = await loadPrinterConfig();
      if (config.address && config.type === 'bluetooth') {
        return [{
          name: config.name || 'Imprimante sauvegardée',
          address: config.address,
          paired: true,
        }];
      }
    } catch (error) {
      console.error('Error loading saved printer:', error);
    }
    
    return [];
  }
  
  // iOS - show similar instructions
  if (Platform.OS === 'ios') {
    Alert.alert(
      '📱 Recherche Bluetooth',
      'Pour connecter une imprimante Bluetooth:\n\n' +
      '1. Activez le Bluetooth sur votre iPhone/iPad\n' +
      '2. Allumez votre imprimante en mode appairage\n' +
      '3. Allez dans Réglages → Bluetooth\n' +
      '4. Appairez votre imprimante\n' +
      '5. Revenez dans CaissaPro pour la configurer',
      [
        { text: 'OK' },
        { text: 'Ouvrir Réglages', onPress: () => Linking.openURL('App-Prefs:Bluetooth') }
      ]
    );
  }
  
  return [];
};

// ESC/POS Control Characters
const ESC = '\x1B';  // Escape character
const GS = '\x1D';   // Group Separator
const LF = '\x0A';   // Line Feed

export const ESC_POS = {
  // Initialize printer
  INIT: ESC + '@',
  
  // Text formatting
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF: ESC + '-' + '\x00',
  
  // Text alignment
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  
  // Text size
  SIZE_NORMAL: GS + '!' + '\x00',
  SIZE_DOUBLE_HEIGHT: GS + '!' + '\x01',
  SIZE_DOUBLE_WIDTH: GS + '!' + '\x10',
  SIZE_DOUBLE: GS + '!' + '\x11',
  
  // Paper
  CUT_PAPER: GS + 'V' + '\x00',
  PARTIAL_CUT: GS + 'V' + '\x01',
  FEED_LINE: LF,
  FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n),
  
  // Cash drawer
  OPEN_DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',
};

// Receipt data interface
export interface ReceiptData {
  restaurantName: string;
  address: string;
  city: string;
  phone: string;
  taxId: string;
  orderId: string;
  tableNumber: number;
  waiterName: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  discountPercent?: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountReceived?: number;
  change?: number;
}

// Generate ESC/POS receipt commands
export const generateReceiptCommands = (data: ReceiptData): string => {
  let cmd = '';
  
  // Initialize
  cmd += ESC_POS.INIT;
  
  // Header - Restaurant name (centered, double size)
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += ESC_POS.SIZE_DOUBLE;
  cmd += data.restaurantName + LF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += data.address + LF;
  cmd += data.city + LF;
  cmd += 'Tél: ' + data.phone + LF;
  cmd += data.taxId + LF;
  cmd += '================================' + LF;
  
  // Order info (left aligned)
  cmd += ESC_POS.ALIGN_LEFT;
  cmd += 'Ticket N°: ' + data.orderId.substring(0, 8) + LF;
  cmd += 'Table: ' + data.tableNumber + LF;
  cmd += 'Serveur: ' + data.waiterName + LF;
  cmd += 'Date: ' + data.date + LF;
  cmd += '--------------------------------' + LF;
  
  // Items
  data.items.forEach(item => {
    const qty = item.quantity.toString().padStart(2, ' ');
    const name = item.name.substring(0, 20).padEnd(20, ' ');
    const total = item.total.toFixed(0).padStart(6, ' ');
    cmd += qty + 'x ' + name + total + ' MAD' + LF;
  });
  
  cmd += '--------------------------------' + LF;
  
  // Totals
  cmd += 'Sous-total:'.padEnd(20, ' ') + data.subtotal.toFixed(2).padStart(10, ' ') + ' MAD' + LF;
  
  if (data.discount > 0) {
    const discountLabel = data.discountPercent 
      ? `Remise (${data.discountPercent}%):` 
      : 'Remise:';
    cmd += discountLabel.padEnd(20, ' ') + ('-' + data.discount.toFixed(2)).padStart(10, ' ') + ' MAD' + LF;
  }
  
  cmd += '================================' + LF;
  cmd += ESC_POS.BOLD_ON;
  cmd += ESC_POS.SIZE_DOUBLE_HEIGHT;
  cmd += 'TOTAL:'.padEnd(10, ' ') + data.total.toFixed(2).padStart(10, ' ') + ' MAD' + LF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += ESC_POS.BOLD_OFF;
  cmd += '================================' + LF;
  
  // Payment info
  cmd += LF;
  cmd += 'Paiement: ' + data.paymentMethod + LF;
  if (data.amountReceived && data.paymentMethod === 'Espèces') {
    cmd += 'Reçu: ' + data.amountReceived.toFixed(2) + ' MAD' + LF;
    cmd += 'Rendu: ' + (data.change || 0).toFixed(2) + ' MAD' + LF;
  }
  
  // Footer
  cmd += LF;
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += 'Merci de votre visite!' + LF;
  cmd += 'شكرا لزيارتكم' + LF;
  cmd += LF;
  cmd += ESC_POS.FEED_LINES(3);
  cmd += ESC_POS.PARTIAL_CUT;
  
  return cmd;
};

// Generate kitchen ticket commands
export const generateKitchenTicketCommands = (data: {
  tableNumber: number;
  orderId: string;
  items: Array<{
    name: string;
    quantity: number;
    note?: string;
  }>;
  time: string;
}): string => {
  let cmd = '';
  
  cmd += ESC_POS.INIT;
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += ESC_POS.SIZE_DOUBLE;
  cmd += '*** CUISINE ***' + LF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += '================================' + LF;
  cmd += ESC_POS.SIZE_DOUBLE;
  cmd += 'TABLE ' + data.tableNumber + LF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += '================================' + LF;
  cmd += ESC_POS.ALIGN_LEFT;
  cmd += 'Heure: ' + data.time + LF;
  cmd += '--------------------------------' + LF;
  
  // Items with quantities
  data.items.forEach(item => {
    cmd += ESC_POS.SIZE_DOUBLE_HEIGHT;
    cmd += ESC_POS.BOLD_ON;
    cmd += item.quantity + 'x ' + item.name + LF;
    cmd += ESC_POS.BOLD_OFF;
    cmd += ESC_POS.SIZE_NORMAL;
    if (item.note) {
      cmd += '   → ' + item.note + LF;
    }
  });
  
  cmd += '--------------------------------' + LF;
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += 'N°: ' + data.orderId.substring(0, 8) + LF;
  cmd += ESC_POS.FEED_LINES(3);
  cmd += ESC_POS.PARTIAL_CUT;
  
  return cmd;
};

// Print via network/WiFi (ESC/POS over TCP) - Uses ThermalPrinterModule or UnifiedPrinterService
export const printToNetworkPrinter = async (
  address: string, 
  data: string
): Promise<boolean> => {
  try {
    console.log('Printing to network/WiFi printer:', address);
    
    // Get native ThermalPrinterModule directly (most reliable)
    const { ThermalPrinterModule } = NativeModules;
    
    if (ThermalPrinterModule) {
      try {
        // Parse IP and port
        const [ip, portStr] = address.split(':');
        const port = parseInt(portStr) || 9100;
        
        // Check if ThermalPrinterModule is connected
        const tpmStatus = await ThermalPrinterModule.getConnectionStatus();
        console.log('ThermalPrinterModule status:', tpmStatus);
        
        if (tpmStatus.isConnected && tpmStatus.transport === 'wifi') {
          // Already connected - print directly
          await ThermalPrinterModule.printText(data);
          console.log('✅ Printed via ThermalPrinterModule WiFi (already connected)');
          return true;
        }
        
        // Not connected - try to connect
        console.log('Connecting to WiFi:', ip, port);
        const connected = await ThermalPrinterModule.connectWifi(ip, port);
        
        if (connected) {
          await ThermalPrinterModule.printText(data);
          console.log('✅ Printed via ThermalPrinterModule WiFi (new connection)');
          return true;
        }
      } catch (tpmError: any) {
        console.error('ThermalPrinterModule WiFi print error:', tpmError);
        // Don't return - fall through to UnifiedPrinterService
      }
    }
    
    // Fallback: Check if already connected to a WiFi printer via UnifiedPrinterService
    const status = UnifiedPrinterService.getConnectionStatus();
    
    if (status.isConnected && status.type === 'wifi') {
      return await UnifiedPrinterService.print(data);
    }
    
    // Try to connect to the WiFi printer
    const [ip, portStr] = address.split(':');
    const port = parseInt(portStr) || 9100;
    
    const device: PrinterDevice = {
      id: `wifi_${ip}_${port}`,
      name: `WiFi Printer (${ip})`,
      address: address,
      type: 'wifi',
    };
    
    const connected = await UnifiedPrinterService.connect(device);
    if (!connected) {
      Alert.alert(
        '🌐 Imprimante WiFi non accessible',
        `Impossible de se connecter à ${address}.\nVérifiez l'adresse IP et que l'imprimante est allumée.`,
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return await UnifiedPrinterService.print(data);
  } catch (error) {
    console.error('Network print error:', error);
    Alert.alert('Erreur d\'impression', 'Impossible d\'imprimer via WiFi.');
    return false;
  }
};

// Print via Bluetooth - Uses ThermalPrinterModule (native Kotlin) or UnifiedPrinterService
export const printToBluetoothPrinter = async (
  macAddress: string,
  data: string
): Promise<boolean> => {
  try {
    console.log('Printing to Bluetooth printer:', macAddress);
    
    // Get native ThermalPrinterModule directly (most reliable)
    const { ThermalPrinterModule } = NativeModules;
    
    if (ThermalPrinterModule) {
      try {
        // Check if ThermalPrinterModule is connected
        const tpmStatus = await ThermalPrinterModule.getConnectionStatus();
        console.log('ThermalPrinterModule status:', tpmStatus);
        
        if (tpmStatus.isConnected) {
          // Already connected - print directly
          await ThermalPrinterModule.printText(data);
          console.log('✅ Printed via ThermalPrinterModule (already connected)');
          return true;
        }
        
        // Not connected - try to connect
        console.log('Connecting to Bluetooth:', macAddress);
        const connected = await ThermalPrinterModule.connectBluetooth(macAddress);
        
        if (connected) {
          await ThermalPrinterModule.printText(data);
          console.log('✅ Printed via ThermalPrinterModule (new connection)');
          return true;
        }
      } catch (tpmError: any) {
        console.error('ThermalPrinterModule print error:', tpmError);
        // Don't return - fall through to other methods
      }
    }
    
    // Fallback: Check if already connected via UnifiedPrinterService
    const status = UnifiedPrinterService.getConnectionStatus();
    
    if (status.isConnected && status.type === 'bluetooth') {
      return await UnifiedPrinterService.printWithRetry(data, 2);
    }
    
    // Try to quick connect via UnifiedPrinterService
    const lastDevice = await UnifiedPrinterService.getActivePrinter();
    
    if (lastDevice && lastDevice.address === macAddress && lastDevice.type === 'bluetooth') {
      const connected = await UnifiedPrinterService.connect(lastDevice);
      if (connected) {
        return await UnifiedPrinterService.printWithRetry(data, 2);
      }
    }
    
    // Last resort: Try legacy BluetoothPrinterService
    const legacyConnected = BluetoothPrinterService.isConnected();
    
    if (!legacyConnected) {
      const legacyDevice = await BluetoothPrinterService.getLastConnectedDevice();
      
      if (legacyDevice && legacyDevice.address === macAddress) {
        const connected = await BluetoothPrinterService.connect(legacyDevice);
        if (!connected) {
          Alert.alert(
            '🖨️ Imprimante non connectée',
            'Impossible de se connecter à l\'imprimante.\nVérifiez qu\'elle est allumée et à portée.',
            [
              { text: 'OK' },
              { 
                text: 'Paramètres Bluetooth', 
                onPress: () => {
                  if (Platform.OS === 'android') {
                    Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
                      Linking.openSettings();
                    });
                  }
                }
              }
            ]
          );
          return false;
        }
      } else {
        Alert.alert(
          '🖨️ Connectez l\'imprimante',
          'Veuillez connecter une imprimante Bluetooth via les paramètres.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    
    // Print with retry via BluetoothPrinterService
    const success = await BluetoothPrinterService.printWithRetry(data, 2);
    return success;
    
  } catch (error) {
    console.error('Bluetooth print error:', error);
    Alert.alert('Erreur d\'impression', 'Impossible d\'imprimer. Vérifiez la connexion.');
    return false;
  }
};

// Print via USB - Uses ThermalPrinterModule or UnifiedPrinterService
export const printToUSBPrinter = async (
  devicePath: string,
  data: string
): Promise<boolean> => {
  try {
    console.log('Printing to USB printer:', devicePath);
    
    // Get native ThermalPrinterModule directly (most reliable)
    const { ThermalPrinterModule } = NativeModules;
    
    if (ThermalPrinterModule) {
      try {
        // Check if ThermalPrinterModule is connected via USB
        const tpmStatus = await ThermalPrinterModule.getConnectionStatus();
        console.log('ThermalPrinterModule status:', tpmStatus);
        
        if (tpmStatus.isConnected && tpmStatus.transport === 'usb') {
          // Already connected - print directly
          await ThermalPrinterModule.printText(data);
          console.log('✅ Printed via ThermalPrinterModule USB (already connected)');
          return true;
        }
        
        // Not connected - try to connect
        console.log('Connecting to USB:', devicePath);
        const connected = await ThermalPrinterModule.connectUsb(devicePath);
        
        if (connected) {
          await ThermalPrinterModule.printText(data);
          console.log('✅ Printed via ThermalPrinterModule USB (new connection)');
          return true;
        }
      } catch (tpmError: any) {
        console.error('ThermalPrinterModule USB print error:', tpmError);
        // Don't return - fall through to UnifiedPrinterService
      }
    }
    
    // Fallback: Check via UnifiedPrinterService
    const status = UnifiedPrinterService.getConnectionStatus();
    
    if (status.isConnected && status.type === 'usb') {
      return await UnifiedPrinterService.print(data);
    }
    
    // Try to connect to USB device
    const device: PrinterDevice = {
      id: `usb_${devicePath}`,
      name: 'USB Printer',
      address: devicePath,
      type: 'usb',
    };
    
    const connected = await UnifiedPrinterService.connect(device);
    if (!connected) {
      Alert.alert(
        '🔌 Imprimante USB non détectée',
        'Vérifiez que l\'imprimante est connectée via USB OTG.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return await UnifiedPrinterService.print(data);
  } catch (error) {
    console.error('USB print error:', error);
    Alert.alert('Erreur d\'impression', 'Impossible d\'imprimer via USB.');
    return false;
  }
};

// Main print function
export const printReceipt = async (
  config: PrinterConfig,
  receiptData: ReceiptData
): Promise<boolean> => {
  if (!config.enabled || config.type === 'none') {
    Alert.alert(
      'Imprimante non configurée',
      'Veuillez configurer une imprimante dans les paramètres.'
    );
    return false;
  }
  
  const commands = generateReceiptCommands(receiptData);
  
  switch (config.type) {
    case 'network':
    case 'wifi':
      return printToNetworkPrinter(config.address, commands);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, commands);
    case 'usb':
      return printToUSBPrinter(config.address, commands);
    default:
      return false;
  }
};

// Print kitchen ticket
export const printKitchenTicket = async (
  config: PrinterConfig,
  ticketData: Parameters<typeof generateKitchenTicketCommands>[0]
): Promise<boolean> => {
  if (!config.enabled || config.type === 'none') {
    return false;
  }
  
  const commands = generateKitchenTicketCommands(ticketData);
  
  switch (config.type) {
    case 'network':
    case 'wifi':
      return printToNetworkPrinter(config.address, commands);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, commands);
    case 'usb':
      return printToUSBPrinter(config.address, commands);
    default:
      return false;
  }
};

// Open cash drawer
export const openCashDrawer = async (config: PrinterConfig): Promise<boolean> => {
  if (!config.enabled || config.type === 'none') {
    return false;
  }
  
  const command = ESC_POS.OPEN_DRAWER;
  
  switch (config.type) {
    case 'network':
    case 'wifi':
      return printToNetworkPrinter(config.address, command);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, command);
    case 'usb':
      return printToUSBPrinter(config.address, command);
    default:
      return false;
  }
};

// ============================================================================
// DAILY REPORT PRINTING
// ============================================================================

export interface DailyReportData {
  date: string;
  restaurantName: string;
  cashierName: string;
  // Sales
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  totalOrders: number;
  paidOrders: number;
  averageOrderValue: number;
  // Expenses
  totalExpenses: number;
  expenses: Array<{ category: string; amount: number; description?: string }>;
  // Net
  netProfit: number;
  // Orders breakdown
  orders: Array<{
    orderNumber: number;
    time: string;
    total: number;
    paymentMethod: string;
    items: Array<{ name: string; quantity: number; total: number }>;
  }>;
  // Stock alerts
  lowStockProducts: Array<{ name: string; quantity: number }>;
  outOfStockProducts: Array<{ name: string }>;
  // Pending
  pendingOrdersCount: number;
}

export const generateDailyReportCommands = (data: DailyReportData): string => {
  let cmd = '';
  const width = 48; // characters for 80mm paper
  
  // Initialize
  cmd += ESC_POS.INIT;
  
  // ========== HEADER ==========
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += ESC_POS.SIZE_DOUBLE;
  cmd += 'RAPPORT JOURNALIER' + LF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += '================================' + LF;
  cmd += ESC_POS.SIZE_DOUBLE_HEIGHT;
  cmd += data.restaurantName + LF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += LF;
  cmd += 'Date: ' + data.date + LF;
  cmd += 'Caissier: ' + data.cashierName + LF;
  cmd += '================================' + LF;
  cmd += LF;
  
  // ========== RÉSUMÉ DES VENTES ==========
  cmd += ESC_POS.BOLD_ON;
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += '*** RÉSUMÉ DES VENTES ***' + LF;
  cmd += ESC_POS.BOLD_OFF;
  cmd += ESC_POS.ALIGN_LEFT;
  cmd += '--------------------------------' + LF;
  
  cmd += 'Total des ventes:'.padEnd(24) + (data.totalRevenue.toFixed(2) + ' MAD').padStart(16) + LF;
  cmd += '  - Espèces:'.padEnd(24) + (data.cashRevenue.toFixed(2) + ' MAD').padStart(16) + LF;
  cmd += '  - Carte:'.padEnd(24) + (data.cardRevenue.toFixed(2) + ' MAD').padStart(16) + LF;
  cmd += '--------------------------------' + LF;
  cmd += 'Commandes payées:'.padEnd(24) + String(data.paidOrders).padStart(16) + LF;
  cmd += 'Panier moyen:'.padEnd(24) + (data.averageOrderValue.toFixed(2) + ' MAD').padStart(16) + LF;
  cmd += LF;
  
  // ========== DÉPENSES ==========
  if (data.expenses.length > 0) {
    cmd += ESC_POS.BOLD_ON;
    cmd += ESC_POS.ALIGN_CENTER;
    cmd += '*** DÉPENSES ***' + LF;
    cmd += ESC_POS.BOLD_OFF;
    cmd += ESC_POS.ALIGN_LEFT;
    cmd += '--------------------------------' + LF;
    
    data.expenses.forEach(exp => {
      const label = exp.category + (exp.description ? ` (${exp.description.substring(0, 15)})` : '');
      cmd += label.substring(0, 28).padEnd(28) + ('-' + exp.amount.toFixed(0)).padStart(12) + LF;
    });
    
    cmd += '--------------------------------' + LF;
    cmd += ESC_POS.BOLD_ON;
    cmd += 'Total dépenses:'.padEnd(24) + ('-' + data.totalExpenses.toFixed(2) + ' MAD').padStart(16) + LF;
    cmd += ESC_POS.BOLD_OFF;
    cmd += LF;
  }
  
  // ========== BÉNÉFICE NET ==========
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += '================================' + LF;
  cmd += ESC_POS.SIZE_DOUBLE;
  cmd += ESC_POS.BOLD_ON;
  cmd += 'BÉNÉFICE NET' + LF;
  cmd += data.netProfit.toFixed(2) + ' MAD' + LF;
  cmd += ESC_POS.BOLD_OFF;
  cmd += ESC_POS.SIZE_NORMAL;
  cmd += '================================' + LF;
  cmd += LF;
  
  // ========== DÉTAIL DES COMMANDES ==========
  if (data.orders.length > 0) {
    cmd += ESC_POS.BOLD_ON;
    cmd += ESC_POS.ALIGN_CENTER;
    cmd += '*** DÉTAIL COMMANDES ***' + LF;
    cmd += ESC_POS.BOLD_OFF;
    cmd += ESC_POS.ALIGN_LEFT;
    cmd += '--------------------------------' + LF;
    
    data.orders.forEach((order, idx) => {
      cmd += ESC_POS.BOLD_ON;
      cmd += `#${order.orderNumber} - ${order.time} - ${order.paymentMethod}` + LF;
      cmd += ESC_POS.BOLD_OFF;
      
      order.items.forEach(item => {
        const itemLine = `  ${item.quantity}x ${item.name.substring(0, 20)}`;
        cmd += itemLine.padEnd(32) + item.total.toFixed(0).padStart(8) + LF;
      });
      
      cmd += '  Total:'.padEnd(32) + order.total.toFixed(0).padStart(8) + ' MAD' + LF;
      if (idx < data.orders.length - 1) {
        cmd += '- - - - - - - - - - - - - - - - ' + LF;
      }
    });
    cmd += '--------------------------------' + LF;
    cmd += LF;
  }
  
  // ========== ALERTES STOCK ==========
  if (data.outOfStockProducts.length > 0 || data.lowStockProducts.length > 0) {
    cmd += ESC_POS.BOLD_ON;
    cmd += ESC_POS.ALIGN_CENTER;
    cmd += '*** ALERTES STOCK ***' + LF;
    cmd += ESC_POS.BOLD_OFF;
    cmd += ESC_POS.ALIGN_LEFT;
    cmd += '--------------------------------' + LF;
    
    if (data.outOfStockProducts.length > 0) {
      cmd += ESC_POS.BOLD_ON;
      cmd += 'RUPTURE DE STOCK:' + LF;
      cmd += ESC_POS.BOLD_OFF;
      data.outOfStockProducts.forEach(p => {
        cmd += '  ! ' + p.name + LF;
      });
    }
    
    if (data.lowStockProducts.length > 0) {
      cmd += ESC_POS.BOLD_ON;
      cmd += 'STOCK BAS:' + LF;
      cmd += ESC_POS.BOLD_OFF;
      data.lowStockProducts.forEach(p => {
        cmd += `  - ${p.name}: ${p.quantity} restant(s)` + LF;
      });
    }
    cmd += '--------------------------------' + LF;
    cmd += LF;
  }
  
  // ========== FOOTER ==========
  cmd += ESC_POS.ALIGN_CENTER;
  cmd += '================================' + LF;
  cmd += 'Rapport généré le ' + new Date().toLocaleString('fr-FR') + LF;
  cmd += 'CaissaPro - Système de caisse' + LF;
  cmd += '================================' + LF;
  
  cmd += ESC_POS.FEED_LINES(4);
  cmd += ESC_POS.PARTIAL_CUT;
  
  return cmd;
};

// Print daily report
export const printDailyReport = async (
  config: PrinterConfig,
  reportData: DailyReportData
): Promise<boolean> => {
  if (!config.enabled || config.type === 'none') {
    Alert.alert(
      'Imprimante non configurée',
      'Veuillez configurer une imprimante dans les paramètres pour imprimer le rapport.'
    );
    return false;
  }
  
  const commands = generateDailyReportCommands(reportData);
  
  switch (config.type) {
    case 'network':
    case 'wifi':
      return printToNetworkPrinter(config.address, commands);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, commands);
    case 'usb':
      return printToUSBPrinter(config.address, commands);
    default:
      return false;
  }
};

// ============================================================================
// AUTO-PRINT CONFIGURATION
// ============================================================================

export const setAutoPrintEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTO_PRINT_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving auto-print setting:', error);
  }
};

export const getAutoPrintEnabled = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(AUTO_PRINT_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error loading auto-print setting:', error);
    return false;
  }
};

// ============================================================================
// QUICK PRINT FUNCTION (uses UnifiedPrinterService for all printer types)
// ============================================================================

export const quickPrintReceipt = async (receiptData: ReceiptData): Promise<boolean> => {
  try {
    // First check if UnifiedPrinterService is already connected
    const status = UnifiedPrinterService.getConnectionStatus();
    const commands = generateReceiptCommands(receiptData);
    
    if (status.isConnected) {
      // Use the already connected printer
      return await UnifiedPrinterService.print(commands);
    }
    
    // Fallback to config-based printing
    const config = await loadPrinterConfig();
    
    if (!config.enabled || config.type === 'none') {
      console.log('Printer not configured, skipping print');
      return false;
    }
    
    switch (config.type) {
      case 'bluetooth':
        // Try UnifiedPrinterService first
        const btConnected = await UnifiedPrinterService.quickConnect();
        if (btConnected) {
          return await UnifiedPrinterService.print(commands);
        }
        // Fallback to BluetoothPrinterService
        const legacyConnected = BluetoothPrinterService.isConnected();
        if (!legacyConnected) {
          const connected = await BluetoothPrinterService.quickConnect();
          if (!connected) {
            console.log('Could not quick connect to Bluetooth printer');
            return false;
          }
        }
        return await BluetoothPrinterService.print(commands);
        
      case 'network':
      case 'wifi':
        return await printToNetworkPrinter(config.address, commands);
        
      case 'usb':
        return await printToUSBPrinter(config.address, commands);
        
      default:
        return false;
    }
  } catch (error) {
    console.error('Quick print error:', error);
    return false;
  }
};

// ============================================================================
// NATIVE THERMAL PRINTER SERVICE - Direct Printing via Kotlin Module
// ============================================================================

/**
 * Print using the native ThermalPrinterService (USB/Bluetooth/WiFi)
 * This uses the Kotlin native module for direct hardware access
 */
export const printWithNativeService = async (receiptData: ReceiptData): Promise<boolean> => {
  try {
    // Check if native service is available and connected
    const status = await thermalPrinterService.getConnectionStatus();
    
    if (!status.isConnected) {
      console.log('Native printer not connected, falling back to legacy service');
      return false;
    }
    
    // Convert ReceiptData to ThermalReceiptData format
    const thermalData: ThermalReceiptData = {
      header: receiptData.restaurantName,
      subheader: receiptData.address ? `${receiptData.address}, ${receiptData.city}` : receiptData.city,
      items: receiptData.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.total,
      })),
      subtotal: receiptData.subtotal,
      tax: receiptData.tax,
      discount: receiptData.discount,
      total: receiptData.total,
      footer: '',
      date: receiptData.date,
    };
    
    return await thermalPrinterService.printReceipt(thermalData);
  } catch (error) {
    console.error('Native print error:', error);
    return false;
  }
};

/**
 * Test print using native service
 */
export const testPrintNative = async (): Promise<boolean> => {
  try {
    return await thermalPrinterService.printTestPage();
  } catch (error) {
    console.error('Native test print error:', error);
    return false;
  }
};

/**
 * Open cash drawer using native service
 */
export const openCashDrawerNative = async (): Promise<boolean> => {
  try {
    return await thermalPrinterService.openCashDrawer();
  } catch (error) {
    console.error('Native cash drawer error:', error);
    return false;
  }
};

// ============================================================================
// UNIFIED PRINTER SERVICE - Direct Access for new UI
// ============================================================================

export { UnifiedPrinterService };

// ============================================================================
// BLUETOOTH SERVICE EXPORT (for legacy/backward compatibility)
// ============================================================================

export { BluetoothPrinterService };

// ============================================================================
// NATIVE THERMAL PRINTER SERVICE EXPORT
// ============================================================================

export { thermalPrinterService };
