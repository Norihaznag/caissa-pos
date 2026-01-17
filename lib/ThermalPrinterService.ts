/**
 * ThermalPrinterService - React Native Bridge to Native Kotlin Module
 * 
 * Provides unified printing across USB, Bluetooth, and WiFi thermal printers
 * Uses ESC/POS commands for 58mm/80mm thermal printers
 * 
 * @version 2.1.0
 * @author CaissaPro
 */

import { NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Native module interface
interface ThermalPrinterNativeModule {
  // Constants
  TRANSPORT_USB: string;
  TRANSPORT_BLUETOOTH: string;
  TRANSPORT_WIFI: string;
  
  // Permissions
  checkBluetoothPermissions(): Promise<boolean>;
  isBluetoothEnabled(): Promise<boolean>;
  
  // USB
  getUsbDevices(): Promise<UsbDevice[]>;
  requestUsbPermission(deviceId: string): Promise<boolean>;
  connectUsb(deviceId: string): Promise<boolean>;
  
  // Bluetooth
  getPairedBluetoothDevices(): Promise<BluetoothDevice[]>;
  startBluetoothDiscovery(): Promise<boolean>;
  stopBluetoothDiscovery(): Promise<void>;
  connectBluetooth(address: string): Promise<boolean>;
  
  // WiFi
  connectWifi(ipAddress: string, port: number): Promise<boolean>;
  
  // Printing
  printRaw(data: number[]): Promise<number>;
  printText(text: string): Promise<number>;
  printReceipt(receiptData: ReceiptData): Promise<number>;
  printTestPage(): Promise<number>;
  openCashDrawer(): Promise<number>;
  
  // Connection
  getConnectionStatus(): Promise<ConnectionStatus>;
  disconnect(): Promise<boolean>;
  
  // Events
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

// Types
export interface UsbDevice {
  deviceId: string;
  deviceName: string;
  vendorId: number;
  productId: number;
  productName: string;
  manufacturerName: string;
  hasPermission: boolean;
}

export interface BluetoothDevice {
  address: string;
  name: string;
  type: number;
  bondState?: number;
  isProbablyPrinter?: boolean;
}

export interface WifiPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  isDefault?: boolean;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  header: string;
  subheader?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  footer?: string;
  date?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  transport: 'usb' | 'bluetooth' | 'wifi' | null;
}

export type TransportType = 'usb' | 'bluetooth' | 'wifi';

// Storage keys
const STORAGE_KEYS = {
  LAST_USB_DEVICE: '@printer_last_usb',
  LAST_BT_DEVICE: '@printer_last_bt',
  WIFI_PRINTERS: '@printer_wifi_list',
  DEFAULT_TRANSPORT: '@printer_default_transport',
  AUTO_CONNECT: '@printer_auto_connect',
};

// Check if native module is available
const ThermalPrinterNative = NativeModules.ThermalPrinterModule as ThermalPrinterNativeModule | undefined;

// Create event emitter only if module exists
let printerEventEmitter: NativeEventEmitter | null = null;
if (ThermalPrinterNative && Platform.OS === 'android') {
  printerEventEmitter = new NativeEventEmitter(NativeModules.ThermalPrinterModule);
}

/**
 * Main Thermal Printer Service
 */
class ThermalPrinterService {
  private isInitialized = false;
  private discoveryCallback: ((device: BluetoothDevice) => void) | null = null;
  private discoveryFinishedCallback: (() => void) | null = null;
  private eventSubscriptions: any[] = [];

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Check if native module is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && ThermalPrinterNative !== undefined;
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<boolean> {
    if (!this.isAvailable()) {
      console.warn('ThermalPrinterService: Native module not available');
      return false;
    }

    if (this.isInitialized) return true;

    try {
      // Check and request permissions
      const hasPermissions = await this.ensurePermissions();
      if (!hasPermissions) {
        console.warn('ThermalPrinterService: Permissions not granted');
        return false;
      }

      this.isInitialized = true;
      console.log('ThermalPrinterService: Initialized successfully');

      // Try auto-connect if enabled
      const autoConnect = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT);
      if (autoConnect === 'true') {
        this.autoConnect().catch(console.warn);
      }

      return true;
    } catch (error) {
      console.error('ThermalPrinterService: Initialization error', error);
      return false;
    }
  }

  /**
   * Setup native event listeners
   */
  private setupEventListeners(): void {
    if (!printerEventEmitter) return;

    const deviceFoundSub = printerEventEmitter.addListener(
      'onBluetoothDeviceFound',
      (device: BluetoothDevice) => {
        if (this.discoveryCallback) {
          this.discoveryCallback(device);
        }
      }
    );

    const discoveryFinishedSub = printerEventEmitter.addListener(
      'onDiscoveryFinished',
      () => {
        if (this.discoveryFinishedCallback) {
          this.discoveryFinishedCallback();
        }
      }
    );

    this.eventSubscriptions = [deviceFoundSub, discoveryFinishedSub];
  }

  /**
   * Ensure all required permissions
   */
  async ensurePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      // Request Bluetooth permissions for Android 12+
      if (Platform.Version >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);

        const allGranted = Object.values(results).every(
          (result) => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          console.warn('Bluetooth permissions not fully granted:', results);
          return false;
        }
      } else {
        // For older Android, request location permission
        const locationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permission de localisation',
            message: 'Nécessaire pour découvrir les imprimantes Bluetooth à proximité',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );

        if (locationGranted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  }

  // ============================================================================
  // USB Methods
  // ============================================================================

  /**
   * Get list of connected USB devices
   */
  async getUsbDevices(): Promise<UsbDevice[]> {
    if (!ThermalPrinterNative) return [];
    try {
      return await ThermalPrinterNative.getUsbDevices();
    } catch (error) {
      console.error('getUsbDevices error:', error);
      return [];
    }
  }

  /**
   * Request permission for a USB device
   */
  async requestUsbPermission(deviceId: string): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      return await ThermalPrinterNative.requestUsbPermission(deviceId);
    } catch (error) {
      console.error('requestUsbPermission error:', error);
      return false;
    }
  }

  /**
   * Connect to a USB printer
   */
  async connectUsb(deviceId: string): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    
    try {
      // First request permission if needed
      const devices = await this.getUsbDevices();
      const device = devices.find((d) => d.deviceId === deviceId);
      
      if (!device) {
        console.error('USB device not found:', deviceId);
        return false;
      }

      if (!device.hasPermission) {
        const granted = await this.requestUsbPermission(deviceId);
        if (!granted) {
          console.error('USB permission denied');
          return false;
        }
      }

      const connected = await ThermalPrinterNative.connectUsb(deviceId);
      
      if (connected) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_USB_DEVICE, deviceId);
        console.log('USB connected:', device.productName);
      }

      return connected;
    } catch (error) {
      console.error('connectUsb error:', error);
      return false;
    }
  }

  // ============================================================================
  // Bluetooth Methods
  // ============================================================================

  /**
   * Check if Bluetooth is enabled
   */
  async isBluetoothEnabled(): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      return await ThermalPrinterNative.isBluetoothEnabled();
    } catch (error) {
      console.error('isBluetoothEnabled error:', error);
      return false;
    }
  }

  /**
   * Get paired Bluetooth devices
   */
  async getPairedBluetoothDevices(): Promise<BluetoothDevice[]> {
    if (!ThermalPrinterNative) return [];
    try {
      return await ThermalPrinterNative.getPairedBluetoothDevices();
    } catch (error) {
      console.error('getPairedBluetoothDevices error:', error);
      return [];
    }
  }

  /**
   * Start Bluetooth discovery
   */
  async startBluetoothDiscovery(
    onDeviceFound: (device: BluetoothDevice) => void,
    onFinished?: () => void
  ): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    
    this.discoveryCallback = onDeviceFound;
    this.discoveryFinishedCallback = onFinished || null;

    try {
      return await ThermalPrinterNative.startBluetoothDiscovery();
    } catch (error) {
      console.error('startBluetoothDiscovery error:', error);
      return false;
    }
  }

  /**
   * Stop Bluetooth discovery
   */
  async stopBluetoothDiscovery(): Promise<void> {
    if (!ThermalPrinterNative) return;
    try {
      await ThermalPrinterNative.stopBluetoothDiscovery();
      this.discoveryCallback = null;
      this.discoveryFinishedCallback = null;
    } catch (error) {
      console.error('stopBluetoothDiscovery error:', error);
    }
  }

  /**
   * Connect to a Bluetooth printer
   */
  async connectBluetooth(address: string): Promise<boolean> {
    if (!ThermalPrinterNative) return false;

    try {
      // Ensure Bluetooth is enabled
      const enabled = await this.isBluetoothEnabled();
      if (!enabled) {
        console.error('Bluetooth is not enabled');
        return false;
      }

      const connected = await ThermalPrinterNative.connectBluetooth(address);
      
      if (connected) {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_BT_DEVICE, address);
        console.log('Bluetooth connected:', address);
      }

      return connected;
    } catch (error) {
      console.error('connectBluetooth error:', error);
      return false;
    }
  }

  // ============================================================================
  // WiFi Methods
  // ============================================================================

  /**
   * Get saved WiFi printers
   */
  async getWifiPrinters(): Promise<WifiPrinter[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WIFI_PRINTERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('getWifiPrinters error:', error);
      return [];
    }
  }

  /**
   * Save a WiFi printer
   */
  async saveWifiPrinter(printer: Omit<WifiPrinter, 'id'>): Promise<WifiPrinter> {
    try {
      const printers = await this.getWifiPrinters();
      const newPrinter: WifiPrinter = {
        ...printer,
        id: `wifi_${Date.now()}`,
      };
      printers.push(newPrinter);
      await AsyncStorage.setItem(STORAGE_KEYS.WIFI_PRINTERS, JSON.stringify(printers));
      return newPrinter;
    } catch (error) {
      console.error('saveWifiPrinter error:', error);
      throw error;
    }
  }

  /**
   * Delete a WiFi printer
   */
  async deleteWifiPrinter(id: string): Promise<void> {
    try {
      const printers = await this.getWifiPrinters();
      const filtered = printers.filter((p) => p.id !== id);
      await AsyncStorage.setItem(STORAGE_KEYS.WIFI_PRINTERS, JSON.stringify(filtered));
    } catch (error) {
      console.error('deleteWifiPrinter error:', error);
    }
  }

  /**
   * Connect to a WiFi printer
   */
  async connectWifi(ipAddress: string, port: number = 9100): Promise<boolean> {
    if (!ThermalPrinterNative) return false;

    try {
      const connected = await ThermalPrinterNative.connectWifi(ipAddress, port);
      
      if (connected) {
        console.log('WiFi connected:', `${ipAddress}:${port}`);
      }

      return connected;
    } catch (error) {
      console.error('connectWifi error:', error);
      return false;
    }
  }

  // ============================================================================
  // Printing Methods
  // ============================================================================

  /**
   * Print raw ESC/POS bytes
   */
  async printRaw(data: number[]): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      const bytesWritten = await ThermalPrinterNative.printRaw(data);
      return bytesWritten > 0;
    } catch (error) {
      console.error('printRaw error:', error);
      return false;
    }
  }

  /**
   * Print plain text
   */
  async printText(text: string): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      const bytesWritten = await ThermalPrinterNative.printText(text);
      return bytesWritten > 0;
    } catch (error) {
      console.error('printText error:', error);
      return false;
    }
  }

  /**
   * Print a formatted receipt
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      const bytesWritten = await ThermalPrinterNative.printReceipt(data);
      return bytesWritten > 0;
    } catch (error) {
      console.error('printReceipt error:', error);
      return false;
    }
  }

  /**
   * Print a test page
   */
  async printTestPage(): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      const bytesWritten = await ThermalPrinterNative.printTestPage();
      return bytesWritten > 0;
    } catch (error) {
      console.error('printTestPage error:', error);
      return false;
    }
  }

  /**
   * Open cash drawer
   */
  async openCashDrawer(): Promise<boolean> {
    if (!ThermalPrinterNative) return false;
    try {
      const bytesWritten = await ThermalPrinterNative.openCashDrawer();
      return bytesWritten > 0;
    } catch (error) {
      console.error('openCashDrawer error:', error);
      return false;
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Get current connection status
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (!ThermalPrinterNative) {
      return { isConnected: false, transport: null };
    }
    try {
      return await ThermalPrinterNative.getConnectionStatus();
    } catch (error) {
      console.error('getConnectionStatus error:', error);
      return { isConnected: false, transport: null };
    }
  }

  /**
   * Disconnect from current printer
   */
  async disconnect(): Promise<boolean> {
    if (!ThermalPrinterNative) return true;
    try {
      return await ThermalPrinterNative.disconnect();
    } catch (error) {
      console.error('disconnect error:', error);
      return false;
    }
  }

  /**
   * Auto-connect to last used printer
   */
  async autoConnect(): Promise<boolean> {
    try {
      const status = await this.getConnectionStatus();
      if (status.isConnected) {
        console.log('Already connected to printer');
        return true;
      }

      // Try USB first
      const usbDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.LAST_USB_DEVICE);
      if (usbDeviceId) {
        const devices = await this.getUsbDevices();
        if (devices.find((d) => d.deviceId === usbDeviceId)) {
          console.log('Auto-connecting to USB:', usbDeviceId);
          if (await this.connectUsb(usbDeviceId)) {
            return true;
          }
        }
      }

      // Try Bluetooth
      const btAddress = await AsyncStorage.getItem(STORAGE_KEYS.LAST_BT_DEVICE);
      if (btAddress) {
        const devices = await this.getPairedBluetoothDevices();
        if (devices.find((d) => d.address === btAddress)) {
          console.log('Auto-connecting to Bluetooth:', btAddress);
          if (await this.connectBluetooth(btAddress)) {
            return true;
          }
        }
      }

      console.log('No suitable printer for auto-connect');
      return false;
    } catch (error) {
      console.error('autoConnect error:', error);
      return false;
    }
  }

  /**
   * Set auto-connect preference
   */
  async setAutoConnect(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, enabled ? 'true' : 'false');
  }

  /**
   * Get auto-connect preference
   */
  async getAutoConnect(): Promise<boolean> {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT);
    return value === 'true';
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub?.remove?.());
    this.eventSubscriptions = [];
    this.discoveryCallback = null;
    this.discoveryFinishedCallback = null;
  }
}

// Export singleton instance
export const thermalPrinterService = new ThermalPrinterService();

// Export class for testing
export { ThermalPrinterService };

// Export types
export type { ThermalPrinterNativeModule };
