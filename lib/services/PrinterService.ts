/**
 * PrinterService - Unified Production-Ready Printing Service
 * 
 * Single source of truth for all printing operations.
 * Uses ThermalPrinterModule (native Kotlin) for reliable ESC/POS printing.
 * 
 * @version 3.0.0 - Added print lock, improved connection verification
 */

import { NativeModules, NativeEventEmitter, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type PrinterConnectionType = 'bluetooth' | 'wifi' | 'usb' | 'none';

export type PrinterStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface PrinterDevice {
  id: string;
  name: string;
  address: string;
  type: PrinterConnectionType;
}

export interface PrinterConfig {
  type: PrinterConnectionType;
  deviceName: string;
  deviceAddress: string;
  paperWidth: 58 | 80;
  autoPrint: boolean;
  autoCut: boolean;
  openDrawer: boolean;
}

export interface PrinterState {
  status: PrinterStatus;
  device: PrinterDevice | null;
  error: string | null;
  isInitialized: boolean;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  // Header
  restaurantName: string;
  address?: string;
  phone?: string;
  city?: string;
  taxId?: string;
  
  // Order info
  orderId: string;
  orderNumber?: number;
  tableNumber?: number;
  waiterName?: string;
  date: string;
  
  // Items
  items: ReceiptItem[];
  
  // Totals
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  
  // Payment
  paymentMethod?: string;
  amountReceived?: number;
  change?: number;
  
  // Footer
  footerMessage?: string;
  
  // Display options (from receipt design settings)
  showOrderNumber?: boolean;
  showTableNumber?: boolean;
  showWaiterName?: boolean;
  showDateTime?: boolean;
  showPaymentDetails?: boolean;
  showSubtotal?: boolean;
  showTotal?: boolean;
  showFooter?: boolean;
  
  // Formatting options
  paperWidth?: 58 | 80;
  boldTotal?: boolean;
  separatorStyle?: 'dash' | 'equal' | 'dot';
  centerHeader?: boolean;
  autoCut?: boolean;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  PRINTER_CONFIG: '@caissapro_printer_config',
  LAST_DEVICE: '@caissapro_last_printer_device',
};

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: PrinterConfig = {
  type: 'none',
  deviceName: '',
  deviceAddress: '',
  paperWidth: 80,
  autoPrint: false,
  autoCut: true,
  openDrawer: false,
};

// ============================================================================
// NATIVE MODULE
// ============================================================================

const ThermalPrinterModule = NativeModules.ThermalPrinterModule;
let eventEmitter: NativeEventEmitter | null = null;

if (ThermalPrinterModule && Platform.OS === 'android') {
  eventEmitter = new NativeEventEmitter(ThermalPrinterModule);
}

// ============================================================================
// PRINTER SERVICE CLASS
// ============================================================================

interface PrintQueueItem {
  data: ReceiptData;
  resolve: (value: boolean) => void;
  reject: (reason: any) => void;
}

class PrinterServiceClass {
  private state: PrinterState = {
    status: 'disconnected',
    device: null,
    error: null,
    isInitialized: false,
  };

  private config: PrinterConfig = { ...DEFAULT_CONFIG };
  private listeners: ((state: PrinterState) => void)[] = [];
  private eventSubscriptions: any[] = [];
  
  // Print lock to prevent duplicate/concurrent prints
  private printLock: boolean = false;
  private printQueue: PrintQueueItem[] = [];
  private lastPrintTime: number = 0;
  private readonly MIN_PRINT_INTERVAL = 1000; // 1 second between prints

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async initialize(): Promise<boolean> {
    if (this.state.isInitialized) return true;

    try {
      // Load saved config
      await this.loadConfig();

      // Setup native event listeners
      this.setupEventListeners();

      // Check current connection status
      if (ThermalPrinterModule) {
        const status = await ThermalPrinterModule.getConnectionStatus();
        if (status.isConnected) {
          this.state.status = 'connected';
          this.state.device = {
            id: this.config.deviceAddress,
            name: this.config.deviceName || 'Imprimante',
            address: this.config.deviceAddress,
            type: status.transport || this.config.type,
          };
        }
      }

      this.state.isInitialized = true;
      this.notifyListeners();

      console.log('[PrinterService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[PrinterService] Init error:', error);
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!eventEmitter) return;

    // Clean up old subscriptions
    this.eventSubscriptions.forEach(sub => sub.remove());
    this.eventSubscriptions = [];

    // Connection events
    const connectedSub = eventEmitter.addListener('onConnected', (data: any) => {
      console.log('[PrinterService] Connected:', data);
      this.state.status = 'connected';
      this.state.error = null;
      this.notifyListeners();
    });
    this.eventSubscriptions.push(connectedSub);

    const disconnectedSub = eventEmitter.addListener('onDisconnected', () => {
      console.log('[PrinterService] Disconnected');
      this.state.status = 'disconnected';
      this.state.device = null;
      this.notifyListeners();
    });
    this.eventSubscriptions.push(disconnectedSub);

    const errorSub = eventEmitter.addListener('onError', (error: any) => {
      console.error('[PrinterService] Error:', error);
      this.state.status = 'error';
      this.state.error = error?.message || 'Erreur inconnue';
      this.notifyListeners();
    });
    this.eventSubscriptions.push(errorSub);
  }

  // ==========================================================================
  // CONFIG MANAGEMENT
  // ==========================================================================

  async loadConfig(): Promise<PrinterConfig> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PRINTER_CONFIG);
      if (data) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('[PrinterService] Load config error:', error);
    }
    return this.config;
  }

  async saveConfig(config: Partial<PrinterConfig>): Promise<void> {
    try {
      this.config = { ...this.config, ...config };
      await AsyncStorage.setItem(STORAGE_KEYS.PRINTER_CONFIG, JSON.stringify(this.config));
      console.log('[PrinterService] Config saved:', this.config);
    } catch (error) {
      console.error('[PrinterService] Save config error:', error);
    }
  }

  getConfig(): PrinterConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // DEVICE DISCOVERY
  // ==========================================================================

  async getBluetoothDevices(): Promise<PrinterDevice[]> {
    if (!ThermalPrinterModule) {
      console.warn('[PrinterService] Native module not available');
      return [];
    }

    try {
      const devices = await ThermalPrinterModule.getPairedBluetoothDevices();
      return devices.map((d: any) => ({
        id: d.address,
        name: d.name || 'Appareil inconnu',
        address: d.address,
        type: 'bluetooth' as PrinterConnectionType,
      }));
    } catch (error) {
      console.error('[PrinterService] Get BT devices error:', error);
      return [];
    }
  }

  async getUsbDevices(): Promise<PrinterDevice[]> {
    if (!ThermalPrinterModule) return [];

    try {
      const devices = await ThermalPrinterModule.getUsbDevices();
      return devices.map((d: any) => ({
        id: d.deviceId,
        name: d.productName || d.deviceName || 'USB Printer',
        address: d.deviceId,
        type: 'usb' as PrinterConnectionType,
      }));
    } catch (error) {
      console.error('[PrinterService] Get USB devices error:', error);
      return [];
    }
  }

  // ==========================================================================
  // CONNECTION
  // ==========================================================================

  async connect(device: PrinterDevice): Promise<boolean> {
    if (!ThermalPrinterModule) {
      this.state.error = 'Module d\'impression non disponible';
      this.state.status = 'error';
      this.notifyListeners();
      return false;
    }

    this.state.status = 'connecting';
    this.state.error = null;
    this.notifyListeners();

    try {
      let success = false;

      switch (device.type) {
        case 'bluetooth':
          success = await ThermalPrinterModule.connectBluetooth(device.address);
          break;
        case 'usb':
          success = await ThermalPrinterModule.connectUsb(device.address);
          break;
        case 'wifi':
          const [ip, portStr] = device.address.split(':');
          const port = parseInt(portStr) || 9100;
          success = await ThermalPrinterModule.connectWifi(ip, port);
          break;
        default:
          throw new Error('Type de connexion non supporté');
      }

      if (success) {
        this.state.status = 'connected';
        this.state.device = device;
        this.state.error = null;

        // Save as last connected device
        await this.saveConfig({
          type: device.type,
          deviceName: device.name,
          deviceAddress: device.address,
        });

        await AsyncStorage.setItem(STORAGE_KEYS.LAST_DEVICE, JSON.stringify(device));

        console.log('[PrinterService] Connected to:', device.name);
      } else {
        this.state.status = 'error';
        this.state.error = 'Échec de connexion';
      }

      this.notifyListeners();
      return success;
    } catch (error: any) {
      console.error('[PrinterService] Connect error:', error);
      this.state.status = 'error';
      this.state.error = error.message || 'Erreur de connexion';
      this.notifyListeners();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!ThermalPrinterModule) return;

    try {
      await ThermalPrinterModule.disconnect();
      this.state.status = 'disconnected';
      this.state.device = null;
      this.state.error = null;
      this.notifyListeners();
      console.log('[PrinterService] Disconnected');
    } catch (error) {
      console.error('[PrinterService] Disconnect error:', error);
    }
  }

  async reconnect(): Promise<boolean> {
    try {
      const lastDevice = await AsyncStorage.getItem(STORAGE_KEYS.LAST_DEVICE);
      if (lastDevice) {
        const device = JSON.parse(lastDevice) as PrinterDevice;
        return this.connect(device);
      }
    } catch (error) {
      console.error('[PrinterService] Reconnect error:', error);
    }
    return false;
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  getState(): PrinterState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.status === 'connected';
  }

  async checkConnection(): Promise<boolean> {
    if (!ThermalPrinterModule) return false;

    try {
      const status = await ThermalPrinterModule.getConnectionStatus();
      const isConnected = status.isConnected;

      if (isConnected && this.state.status !== 'connected') {
        this.state.status = 'connected';
        this.notifyListeners();
      } else if (!isConnected && this.state.status === 'connected') {
        this.state.status = 'disconnected';
        this.state.device = null;
        this.notifyListeners();
      }

      return isConnected;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify native module connection state
   * More thorough check than checkConnection - queries the actual socket state
   */
  async verifyNativeConnection(): Promise<boolean> {
    if (!ThermalPrinterModule) {
      console.log('[PrinterService] Native module not available');
      return false;
    }

    try {
      const status = await ThermalPrinterModule.getConnectionStatus();
      console.log('[PrinterService] Native connection status:', status);
      
      const isConnected = status.isConnected === true;
      const transport = status.transport || 'none';
      const address = status.address || '';
      
      // Update local state to match native state
      if (isConnected) {
        this.state.status = 'connected';
        if (!this.state.device && address) {
          this.state.device = {
            id: address,
            name: this.config.deviceName || 'Imprimante',
            address: address,
            type: transport as PrinterConnectionType,
          };
        }
      } else {
        this.state.status = 'disconnected';
        this.state.device = null;
      }
      
      this.notifyListeners();
      return isConnected;
    } catch (error) {
      console.error('[PrinterService] verifyNativeConnection error:', error);
      this.state.status = 'disconnected';
      this.state.device = null;
      this.notifyListeners();
      return false;
    }
  }

  // ==========================================================================
  // PRINTING
  // ==========================================================================

  async printText(text: string): Promise<boolean> {
    if (!ThermalPrinterModule) {
      this.showError('Module d\'impression non disponible');
      return false;
    }

    // Check connection
    const isConnected = await this.checkConnection();
    if (!isConnected) {
      // Try to reconnect
      const reconnected = await this.reconnect();
      if (!reconnected) {
        this.showError('Imprimante non connectée', 'Connectez une imprimante dans les paramètres.');
        return false;
      }
    }

    try {
      const bytesWritten = await ThermalPrinterModule.printText(text);
      console.log('[PrinterService] Printed', bytesWritten, 'bytes');
      return bytesWritten > 0;
    } catch (error: any) {
      console.error('[PrinterService] Print error:', error);
      this.showError('Erreur d\'impression', error.message);
      return false;
    }
  }

  /**
   * Print a full receipt using the native module's byte-based printing
   * This ensures proper ESC/POS encoding for all control codes
   * Includes print lock to prevent duplicate/concurrent prints
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    // Check for rapid duplicate prints (debounce)
    const now = Date.now();
    if (now - this.lastPrintTime < this.MIN_PRINT_INTERVAL) {
      console.log('[PrinterService] Print debounced - too soon after last print');
      return false;
    }

    // If already printing, queue this request
    if (this.printLock) {
      console.log('[PrinterService] Print lock active - queuing print request');
      return new Promise((resolve, reject) => {
        this.printQueue.push({ data, resolve, reject });
      });
    }

    // Acquire lock
    this.printLock = true;
    this.lastPrintTime = now;
    console.log('[PrinterService] Print lock acquired');

    try {
      const result = await this._executePrint(data);
      return result;
    } finally {
      // Release lock
      this.printLock = false;
      console.log('[PrinterService] Print lock released');

      // Process next item in queue
      if (this.printQueue.length > 0) {
        const next = this.printQueue.shift();
        if (next) {
          console.log('[PrinterService] Processing queued print');
          this.printReceipt(next.data).then(next.resolve).catch(next.reject);
        }
      }
    }
  }

  /**
   * Internal print execution - called by printReceipt after acquiring lock
   */
  private async _executePrint(data: ReceiptData): Promise<boolean> {
    if (!ThermalPrinterModule) {
      this.showError('Module d\'impression non disponible');
      return false;
    }

    // Verify connection with native module (not just cached state)
    const isConnected = await this.verifyNativeConnection();
    if (!isConnected) {
      const reconnected = await this.reconnect();
      if (!reconnected) {
        this.showError('Imprimante non connectée', 'Connectez une imprimante dans les paramètres.');
        return false;
      }
    }

    // Log receipt data for debugging
    console.log('[PrinterService][FORMAT_RECEIPT] orderId:', data.orderId);
    console.log('[PrinterService][FORMAT_RECEIPT] itemsCount:', data.items?.length || 0);
    
    // Validate receipt data
    if (!data.items || data.items.length === 0) {
      console.warn('[PrinterService] No items in receipt - printing anyway with warning');
    }

    try {
      // Build the receipt data object for native module
      // Paper width determines character count per line (58mm = 32 chars, 80mm = 48 chars)
      const paperWidth = data.paperWidth || this.config.paperWidth || 80;
      const lineWidth = paperWidth === 58 ? 32 : 48;
      
      const nativeReceiptData = {
        // Header
        header: data.restaurantName || 'CaissaPro',
        subheader: data.address || '',
        phone: data.phone || '',
        
        // Order info
        orderId: data.orderId,
        orderNumber: data.orderNumber?.toString() || '0',
        tableNumber: data.tableNumber || 0,
        waiterName: data.waiterName || '',
        date: data.date,
        
        // Items
        items: (data.items || []).map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.total,
        })),
        
        // Totals
        subtotal: data.subtotal,
        discount: data.discount || 0,
        tax: data.tax || 0,
        total: data.total,
        
        // Payment
        paymentMethod: data.paymentMethod || '',
        amountReceived: data.amountReceived || 0,
        change: data.change || 0,
        
        // Footer
        footerMessage: data.footerMessage || 'Merci de votre visite!',
        
        // Display options
        showOrderNumber: data.showOrderNumber !== false,
        showTableNumber: data.showTableNumber !== false,
        showWaiterName: data.showWaiterName !== false,
        showDateTime: data.showDateTime !== false,
        showPaymentDetails: data.showPaymentDetails !== false,
        showSubtotal: data.showSubtotal !== false,
        showTotal: data.showTotal !== false,
        showFooter: data.showFooter !== false,
        
        // Formatting options
        lineWidth: lineWidth,
        paperWidth: paperWidth,
        boldTotal: data.boldTotal !== false,
        separatorStyle: data.separatorStyle || 'dash',
        centerHeader: data.centerHeader !== false,
        autoCut: data.autoCut !== false && this.config.autoCut,
      };

      console.log('[PrinterService][PRINT_RECEIPT] Sending to native module:', {
        header: nativeReceiptData.header,
        orderNumber: nativeReceiptData.orderNumber,
        itemsCount: nativeReceiptData.items.length,
        total: nativeReceiptData.total,
        lineWidth: nativeReceiptData.lineWidth,
      });
      
      const bytesWritten = await ThermalPrinterModule.printReceipt(nativeReceiptData);
      console.log('[PrinterService][PRINT_RECEIPT] Printed', bytesWritten, 'bytes - SUCCESS');
      
      // Open cash drawer if configured
      if (bytesWritten > 0 && this.config.openDrawer) {
        await this.openCashDrawer();
      }

      return bytesWritten > 0;
    } catch (error: any) {
      console.error('[PrinterService][PRINT_RECEIPT] Error:', error);
      this.showError('Erreur d\'impression', error.message);
      return false;
    }
  }

  async printTestPage(): Promise<boolean> {
    if (!ThermalPrinterModule) {
      this.showError('Module d\'impression non disponible');
      return false;
    }

    const isConnected = await this.checkConnection();
    if (!isConnected) {
      const reconnected = await this.reconnect();
      if (!reconnected) {
        this.showError('Imprimante non connectée', 'Connectez une imprimante pour tester.');
        return false;
      }
    }

    try {
      const bytesWritten = await ThermalPrinterModule.printTestPage();
      return bytesWritten > 0;
    } catch (error: any) {
      console.error('[PrinterService] Test print error:', error);
      this.showError('Erreur d\'impression', error.message);
      return false;
    }
  }

  async openCashDrawer(): Promise<boolean> {
    if (!ThermalPrinterModule) return false;

    try {
      await ThermalPrinterModule.openCashDrawer();
      return true;
    } catch (error) {
      console.error('[PrinterService] Open drawer error:', error);
      return false;
    }
  }

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  private showError(title: string, message?: string): void {
    Alert.alert(
      `🖨️ ${title}`,
      message || 'Vérifiez la connexion de l\'imprimante.',
      [{ text: 'OK' }]
    );
  }

  // ==========================================================================
  // LISTENERS
  // ==========================================================================

  subscribe(listener: (state: PrinterState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const PrinterService = new PrinterServiceClass();
export default PrinterService;