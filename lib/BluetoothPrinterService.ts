/**
 * BluetoothPrinterService - Professional POS Bluetooth Thermal Printing
 * 
 * Features:
 * - Auto-reconnect with saved devices
 * - Fast device discovery with caching
 * - Connection status monitoring
 * - Retry logic for failed prints
 * - Background auto-connect on app start
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, PermissionsAndroid, Linking, NativeModules, NativeEventEmitter, DeviceEventEmitter } from 'react-native';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BluetoothDevice {
  name: string;
  address: string;
  paired: boolean;
  connected?: boolean;
  lastConnected?: number;
}

export interface PrinterConnection {
  device: BluetoothDevice | null;
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  autoReconnect: boolean;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PrintJob {
  id: string;
  data: string;
  retries: number;
  maxRetries: number;
  timestamp: number;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  SAVED_PRINTER: 'pos_saved_printer',
  PAIRED_DEVICES: 'pos_paired_devices_cache',
  AUTO_CONNECT: 'pos_auto_connect_enabled',
  LAST_CONNECTED_DEVICE: 'pos_last_connected_device',
};

// ============================================================================
// ESC/POS COMMANDS
// ============================================================================

const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';
const NULL = '\x00';

export const ESC_POS = {
  // Initialize
  INIT: ESC + '@',
  
  // Text formatting
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF: ESC + '-' + '\x00',
  DOUBLE_HEIGHT_ON: ESC + '!' + '\x10',
  DOUBLE_WIDTH_ON: ESC + '!' + '\x20',
  DOUBLE_SIZE_ON: ESC + '!' + '\x30',
  NORMAL_SIZE: ESC + '!' + '\x00',
  
  // Alignment
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  
  // Feed and cut
  FEED_LINE: LF,
  FEED_LINES: (n: number) => LF.repeat(n),
  PARTIAL_CUT: GS + 'V' + '\x01',
  FULL_CUT: GS + 'V' + '\x00',
  
  // Cash drawer
  OPEN_DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',
  
  // Beep
  BEEP: ESC + 'B' + '\x05' + '\x09',
};

// ============================================================================
// BLUETOOTH PRINTER SERVICE CLASS
// ============================================================================

class BluetoothPrinterServiceClass {
  private connection: PrinterConnection = {
    device: null,
    isConnected: false,
    isConnecting: false,
    lastError: null,
    autoReconnect: true,
  };
  
  private printQueue: PrintJob[] = [];
  private isProcessingQueue = false;
  private connectionListeners: ((status: ConnectionStatus) => void)[] = [];
  private BluetoothManager: any = null;
  private BluetoothEscposPrinter: any = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private isInitialized = false;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Try to load the native Bluetooth module
      const { BluetoothManager: BM, BluetoothEscposPrinter: BEP } = NativeModules;
      
      if (BM && BEP) {
        this.BluetoothManager = BM;
        this.BluetoothEscposPrinter = BEP;
        this.eventEmitter = new NativeEventEmitter(BM);
        
        // Set up event listeners
        this.setupEventListeners();
        
        this.isInitialized = true;
        console.log('✅ BluetoothPrinterService initialized with native module');
        
        // Auto-connect to last device
        this.autoConnectToSavedDevice();
        
        return true;
      } else {
        console.warn('⚠️ Bluetooth modules not available - using simulation mode');
        this.isInitialized = true;
        return true;
      }
    } catch (error) {
      console.error('Bluetooth init error:', error);
      this.isInitialized = true; // Still mark as initialized for graceful degradation
      return false;
    }
  }

  private setupEventListeners(): void {
    if (!this.eventEmitter) return;
    
    // Listen for connection state changes
    this.eventEmitter.addListener('EVENT_BLUETOOTH_NOT_SUPPORT', () => {
      this.updateConnectionStatus('disconnected');
      this.connection.lastError = 'Bluetooth non supporté sur cet appareil';
      this.notifyListeners('error');
    });

    this.eventEmitter.addListener('EVENT_CONNECTED', () => {
      this.connection.isConnected = true;
      this.connection.isConnecting = false;
      this.connection.lastError = null;
      this.reconnectAttempts = 0;
      this.notifyListeners('connected');
      console.log('✅ Printer connected');
      
      // Save as last connected device
      if (this.connection.device) {
        this.saveLastConnectedDevice(this.connection.device);
      }
      
      // Process pending print jobs
      this.processQueue();
    });

    this.eventEmitter.addListener('EVENT_UNABLE_CONNECT', () => {
      this.handleConnectionFailure('Impossible de se connecter à l\'imprimante');
    });

    this.eventEmitter.addListener('EVENT_CONNECTION_LOST', () => {
      this.connection.isConnected = false;
      this.notifyListeners('disconnected');
      console.log('⚠️ Printer connection lost');
      
      // Auto-reconnect
      if (this.connection.autoReconnect && this.connection.device) {
        this.attemptReconnect();
      }
    });
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // iOS handles permissions differently
    }

    try {
      const apiLevel = Platform.Version;

      if (typeof apiLevel === 'number' && apiLevel >= 31) {
        // Android 12+
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            '🔓 Permissions requises',
            'CaissaPro a besoin des permissions Bluetooth et localisation pour se connecter à l\'imprimante.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Paramètres', onPress: () => Linking.openSettings() }
            ]
          );
          return false;
        }
        return true;
      } else {
        // Android 11 and below
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permission Localisation',
            message: 'Nécessaire pour détecter les appareils Bluetooth.',
            buttonPositive: 'Autoriser',
            buttonNegative: 'Refuser',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  async isBluetoothEnabled(): Promise<boolean> {
    if (!this.BluetoothManager) {
      return false;
    }

    try {
      const isEnabled = await this.BluetoothManager.isBluetoothEnabled();
      return isEnabled;
    } catch (error) {
      console.error('Check Bluetooth enabled error:', error);
      return false;
    }
  }

  async enableBluetooth(): Promise<boolean> {
    if (!this.BluetoothManager) {
      // Fallback: open Bluetooth settings
      if (Platform.OS === 'android') {
        Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
          Linking.openSettings();
        });
      }
      return false;
    }

    try {
      await this.BluetoothManager.enableBluetooth();
      return true;
    } catch (error) {
      console.error('Enable Bluetooth error:', error);
      return false;
    }
  }

  async scanDevices(): Promise<BluetoothDevice[]> {
    const hasPermission = await this.requestBluetoothPermissions();
    if (!hasPermission) {
      return [];
    }

    // Check if Bluetooth is enabled
    const isEnabled = await this.isBluetoothEnabled();
    if (!isEnabled) {
      const enabled = await this.enableBluetooth();
      if (!enabled) {
        Alert.alert(
          '📶 Bluetooth désactivé',
          'Veuillez activer le Bluetooth pour rechercher des imprimantes.',
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
        return [];
      }
    }

    if (!this.BluetoothManager) {
      // No native module - return cached devices + show instructions
      const cachedDevices = await this.getCachedDevices();
      
      Alert.alert(
        '📱 Scanner les imprimantes',
        'Pour connecter une imprimante:\n\n' +
        '1. Allumez votre imprimante\n' +
        '2. Mettez-la en mode appairage\n' +
        '3. Allez dans Paramètres → Bluetooth\n' +
        '4. Appairez l\'imprimante\n' +
        '5. Revenez ici et sélectionnez-la',
        [
          { text: 'OK' },
          {
            text: 'Ouvrir Bluetooth',
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
      
      return cachedDevices;
    }

    try {
      // Get paired devices (faster than full scan)
      const paired = await this.BluetoothManager.scanDevices();
      const devices: BluetoothDevice[] = [];

      if (paired && typeof paired === 'string') {
        const pairedDevices = JSON.parse(paired);
        for (const device of pairedDevices) {
          devices.push({
            name: device.name || 'Appareil inconnu',
            address: device.address,
            paired: true,
            connected: device.address === this.connection.device?.address && this.connection.isConnected,
          });
        }
      }

      // Cache devices for quick access
      await this.cacheDevices(devices);

      return devices;
    } catch (error) {
      console.error('Scan devices error:', error);
      return await this.getCachedDevices();
    }
  }

  async connect(device: BluetoothDevice): Promise<boolean> {
    if (this.connection.isConnecting) {
      console.log('Already connecting...');
      return false;
    }

    this.connection.isConnecting = true;
    this.connection.device = device;
    this.notifyListeners('connecting');

    if (!this.BluetoothManager) {
      // Simulation mode
      this.connection.isConnecting = false;
      this.connection.isConnected = true;
      this.connection.lastError = null;
      this.notifyListeners('connected');
      await this.saveLastConnectedDevice(device);
      console.log('✅ [SIM] Connected to:', device.name);
      return true;
    }

    try {
      // Set timeout for connection
      const connectionPromise = this.BluetoothManager.connect(device.address);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);

      this.connection.isConnecting = false;
      this.connection.isConnected = true;
      this.connection.lastError = null;
      this.reconnectAttempts = 0;
      this.notifyListeners('connected');

      // Save device for auto-reconnect
      await this.saveLastConnectedDevice(device);

      console.log('✅ Connected to:', device.name);
      return true;
    } catch (error: any) {
      this.handleConnectionFailure(error.message || 'Échec de connexion');
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.BluetoothManager) {
      this.connection.isConnected = false;
      this.connection.device = null;
      this.notifyListeners('disconnected');
      return;
    }

    try {
      await this.BluetoothManager.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      this.connection.isConnected = false;
      this.notifyListeners('disconnected');
    }
  }

  async quickConnect(): Promise<boolean> {
    // Quick connect to last saved device
    const lastDevice = await this.getLastConnectedDevice();
    if (!lastDevice) {
      return false;
    }

    return this.connect(lastDevice);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.connection.lastError = 'Impossible de se reconnecter après plusieurs tentatives';
      this.notifyListeners('error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

    if (this.connection.device) {
      const success = await this.connect(this.connection.device);
      if (!success && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect();
      }
    }
  }

  private handleConnectionFailure(message: string): void {
    this.connection.isConnecting = false;
    this.connection.isConnected = false;
    this.connection.lastError = message;
    this.notifyListeners('error');
    console.error('Connection failure:', message);
  }

  private async autoConnectToSavedDevice(): Promise<void> {
    const autoConnectEnabled = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT);
    if (autoConnectEnabled !== 'true') {
      return;
    }

    const lastDevice = await this.getLastConnectedDevice();
    if (lastDevice) {
      console.log('Auto-connecting to saved device:', lastDevice.name);
      // Delay to let app fully initialize
      setTimeout(() => {
        this.connect(lastDevice);
      }, 2000);
    }
  }

  // ============================================================================
  // PRINTING
  // ============================================================================

  async print(data: string): Promise<boolean> {
    // Check connection
    if (!this.connection.isConnected) {
      // Try quick connect
      const connected = await this.quickConnect();
      if (!connected) {
        Alert.alert(
          '🖨️ Imprimante non connectée',
          'Veuillez connecter une imprimante Bluetooth.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    if (!this.BluetoothEscposPrinter) {
      // Simulation mode - just log
      console.log('📄 [SIM] Printing:', data.substring(0, 100) + '...');
      Alert.alert('✅ Impression simulée', 'Mode simulation - données envoyées à la console.');
      return true;
    }

    try {
      // Convert string to proper encoding for thermal printer
      await this.BluetoothEscposPrinter.printerInit();
      await this.BluetoothEscposPrinter.printText(data, {
        encoding: 'UTF-8',
        codepage: 0, // Default codepage
        widthtimes: 0,
        heigthtimes: 0,
        fonttype: 1,
      });
      
      console.log('✅ Print successful');
      return true;
    } catch (error: any) {
      console.error('Print error:', error);
      
      // Add to queue for retry if connection lost
      if (error.message?.includes('not connected')) {
        this.addToQueue(data);
        this.attemptReconnect();
      }
      
      return false;
    }
  }

  async printReceipt(receiptData: any): Promise<boolean> {
    const commands = this.generateReceiptCommands(receiptData);
    return this.print(commands);
  }

  async printWithRetry(data: string, maxRetries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const success = await this.print(data);
      if (success) return true;
      
      console.log(`Print attempt ${attempt}/${maxRetries} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    Alert.alert(
      '❌ Échec d\'impression',
      'Impossible d\'imprimer après plusieurs tentatives.\nVérifiez la connexion de l\'imprimante.',
      [{ text: 'OK' }]
    );
    return false;
  }

  async printRaw(rawBytes: Uint8Array): Promise<boolean> {
    if (!this.connection.isConnected || !this.BluetoothEscposPrinter) {
      return false;
    }

    try {
      await this.BluetoothEscposPrinter.printRawData(Array.from(rawBytes));
      return true;
    } catch (error) {
      console.error('Print raw error:', error);
      return false;
    }
  }

  async openCashDrawer(): Promise<boolean> {
    return this.print(ESC_POS.OPEN_DRAWER);
  }

  async printTestPage(): Promise<boolean> {
    const testReceipt = 
      ESC_POS.INIT +
      ESC_POS.ALIGN_CENTER +
      ESC_POS.DOUBLE_SIZE_ON +
      'TEST IMPRESSION\n' +
      ESC_POS.NORMAL_SIZE +
      '================================\n' +
      ESC_POS.ALIGN_LEFT +
      'Date: ' + new Date().toLocaleString('fr-FR') + '\n' +
      'Appareil: ' + (this.connection.device?.name || 'Inconnu') + '\n' +
      'Adresse: ' + (this.connection.device?.address || 'N/A') + '\n' +
      '================================\n' +
      ESC_POS.ALIGN_CENTER +
      'CaissaPro v2.0\n' +
      'Imprimante fonctionnelle ✓\n' +
      ESC_POS.FEED_LINES(3) +
      ESC_POS.PARTIAL_CUT;

    return this.print(testReceipt);
  }

  // ============================================================================
  // RECEIPT GENERATION
  // ============================================================================

  generateReceiptCommands(data: {
    restaurantName: string;
    address?: string;
    phone?: string;
    orderId: string;
    orderNumber?: number;
    tableNumber?: number;
    waiterName?: string;
    date: string;
    items: Array<{ name: string; quantity: number; unitPrice: number; total: number }>;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    paymentMethod?: string;
    amountReceived?: number;
    change?: number;
    footerMessage?: string;
    paperWidth?: 58 | 80;
  }): string {
    const divider = data.paperWidth === 58 ? '------------------------' : '================================';
    const halfDivider = data.paperWidth === 58 ? '------------' : '================';

    let cmd = ESC_POS.INIT;
    
    // Header
    cmd += ESC_POS.ALIGN_CENTER;
    cmd += ESC_POS.DOUBLE_SIZE_ON;
    cmd += data.restaurantName + '\n';
    cmd += ESC_POS.NORMAL_SIZE;
    
    if (data.address) {
      cmd += data.address + '\n';
    }
    if (data.phone) {
      cmd += 'Tél: ' + data.phone + '\n';
    }
    
    cmd += divider + '\n';
    
    // Order info
    cmd += ESC_POS.ALIGN_LEFT;
    cmd += ESC_POS.BOLD_ON;
    if (data.orderNumber) {
      cmd += 'Commande N°: ' + data.orderNumber + '\n';
    }
    cmd += ESC_POS.BOLD_OFF;
    
    if (data.tableNumber) {
      cmd += 'Table: ' + data.tableNumber + '\n';
    }
    if (data.waiterName) {
      cmd += 'Serveur: ' + data.waiterName + '\n';
    }
    cmd += 'Date: ' + data.date + '\n';
    cmd += divider + '\n';
    
    // Items
    cmd += ESC_POS.BOLD_ON;
    cmd += 'Article                   Total\n';
    cmd += ESC_POS.BOLD_OFF;
    cmd += halfDivider + halfDivider + '\n';
    
    for (const item of data.items) {
      const nameLine = item.name.substring(0, 20).padEnd(20, ' ');
      const qtyPrice = `${item.quantity}x${item.unitPrice}`;
      const total = item.total.toFixed(2);
      cmd += nameLine + total.padStart(12, ' ') + '\n';
      cmd += `  ${qtyPrice}\n`;
    }
    
    cmd += divider + '\n';
    
    // Totals
    cmd += ESC_POS.ALIGN_RIGHT;
    cmd += 'Sous-total: ' + data.subtotal.toFixed(2) + ' DH\n';
    
    if (data.discount && data.discount > 0) {
      cmd += 'Remise: -' + data.discount.toFixed(2) + ' DH\n';
    }
    if (data.tax && data.tax > 0) {
      cmd += 'TVA: ' + data.tax.toFixed(2) + ' DH\n';
    }
    
    cmd += ESC_POS.BOLD_ON;
    cmd += ESC_POS.DOUBLE_HEIGHT_ON;
    cmd += 'TOTAL: ' + data.total.toFixed(2) + ' DH\n';
    cmd += ESC_POS.NORMAL_SIZE;
    cmd += ESC_POS.BOLD_OFF;
    
    cmd += divider + '\n';
    
    // Payment
    cmd += ESC_POS.ALIGN_LEFT;
    if (data.paymentMethod) {
      cmd += 'Paiement: ' + data.paymentMethod + '\n';
    }
    if (data.amountReceived && data.amountReceived > 0) {
      cmd += 'Reçu: ' + data.amountReceived.toFixed(2) + ' DH\n';
    }
    if (data.change && data.change > 0) {
      cmd += 'Rendu: ' + data.change.toFixed(2) + ' DH\n';
    }
    
    // Footer
    cmd += '\n';
    cmd += ESC_POS.ALIGN_CENTER;
    if (data.footerMessage) {
      cmd += data.footerMessage + '\n';
    }
    cmd += 'Merci de votre visite!\n';
    cmd += '\n';
    cmd += 'N°: ' + data.orderId.substring(0, 8) + '\n';
    
    cmd += ESC_POS.FEED_LINES(3);
    cmd += ESC_POS.PARTIAL_CUT;
    
    return cmd;
  }

  // ============================================================================
  // PRINT QUEUE MANAGEMENT
  // ============================================================================

  private addToQueue(data: string): void {
    const job: PrintJob = {
      id: Date.now().toString(),
      data,
      retries: 0,
      maxRetries: 3,
      timestamp: Date.now(),
    };
    this.printQueue.push(job);
    console.log('Print job added to queue:', job.id);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.printQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.printQueue.length > 0 && this.connection.isConnected) {
      const job = this.printQueue[0];
      
      const success = await this.print(job.data);
      
      if (success) {
        this.printQueue.shift();
        console.log('Print job completed:', job.id);
      } else {
        job.retries++;
        if (job.retries >= job.maxRetries) {
          this.printQueue.shift();
          console.log('Print job failed after max retries:', job.id);
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  getQueueLength(): number {
    return this.printQueue.length;
  }

  clearQueue(): void {
    this.printQueue = [];
  }

  // ============================================================================
  // DEVICE CACHING & PERSISTENCE
  // ============================================================================

  private async cacheDevices(devices: BluetoothDevice[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(devices));
    } catch (error) {
      console.error('Cache devices error:', error);
    }
  }

  private async getCachedDevices(): Promise<BluetoothDevice[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Get cached devices error:', error);
      return [];
    }
  }

  private async saveLastConnectedDevice(device: BluetoothDevice): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CONNECTED_DEVICE, JSON.stringify({
        ...device,
        lastConnected: Date.now(),
      }));
    } catch (error) {
      console.error('Save last connected device error:', error);
    }
  }

  async getLastConnectedDevice(): Promise<BluetoothDevice | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CONNECTED_DEVICE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Get last connected device error:', error);
      return null;
    }
  }

  async setAutoConnect(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, enabled ? 'true' : 'false');
      this.connection.autoReconnect = enabled;
    } catch (error) {
      console.error('Set auto connect error:', error);
    }
  }

  async getAutoConnect(): Promise<boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT);
      return data === 'true';
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // STATUS & LISTENERS
  // ============================================================================

  getConnectionStatus(): PrinterConnection {
    return { ...this.connection };
  }

  isConnected(): boolean {
    return this.connection.isConnected;
  }

  getConnectedDevice(): BluetoothDevice | null {
    return this.connection.device;
  }

  onConnectionStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.push(listener);
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(status: ConnectionStatus): void {
    this.connectionListeners.forEach(listener => listener(status));
  }

  private updateConnectionStatus(status: ConnectionStatus): void {
    switch (status) {
      case 'connected':
        this.connection.isConnected = true;
        this.connection.isConnecting = false;
        break;
      case 'connecting':
        this.connection.isConnected = false;
        this.connection.isConnecting = true;
        break;
      case 'disconnected':
      case 'error':
        this.connection.isConnected = false;
        this.connection.isConnecting = false;
        break;
    }
    this.notifyListeners(status);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  destroy(): void {
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('EVENT_BLUETOOTH_NOT_SUPPORT');
      this.eventEmitter.removeAllListeners('EVENT_CONNECTED');
      this.eventEmitter.removeAllListeners('EVENT_UNABLE_CONNECT');
      this.eventEmitter.removeAllListeners('EVENT_CONNECTION_LOST');
    }
    this.connectionListeners = [];
    this.printQueue = [];
    this.connection = {
      device: null,
      isConnected: false,
      isConnecting: false,
      lastError: null,
      autoReconnect: true,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const BluetoothPrinterService = new BluetoothPrinterServiceClass();

// Initialize on import (async)
BluetoothPrinterService.initialize().catch(console.error);

export default BluetoothPrinterService;
