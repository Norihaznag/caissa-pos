/**
 * UnifiedPrinterService - Professional Multi-Protocol POS Printing
 * 
 * Supports:
 * - Bluetooth (ESC/POS thermal printers)
 * - WiFi/Network (TCP/IP ESC/POS printers)
 * - USB (via OTG/Android USB API)
 * 
 * Features:
 * - Auto-discovery for all printer types
 * - Connection management with auto-reconnect
 * - Print queue with retry logic
 * - Test print functionality
 * - Connection status monitoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform, PermissionsAndroid, Linking, NativeModules, NativeEventEmitter } from 'react-native';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type PrinterType = 'bluetooth' | 'wifi' | 'usb' | 'none';

export interface PrinterDevice {
  id: string;
  name: string;
  address: string;  // MAC for Bluetooth, IP:port for WiFi, device path for USB
  type: PrinterType;
  paired?: boolean;
  connected?: boolean;
  lastConnected?: number;
  manufacturer?: string;
  model?: string;
}

export interface PrinterConnection {
  device: PrinterDevice | null;
  type: PrinterType;
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
  printerType: PrinterType;
}

export interface PrinterSettings {
  paperWidth: 58 | 80;
  autoCut: boolean;
  openDrawer: boolean;
  printDensity: 1 | 2 | 3;  // Light, Normal, Dark
  charset: 'UTF-8' | 'CP437' | 'CP850' | 'CP866';
}

export interface WiFiPrinterConfig {
  ip: string;
  port: number;
  timeout: number;
}

export interface TestPrintResult {
  success: boolean;
  message: string;
  duration: number;
  printerType: PrinterType;
  bytesWritten?: number;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  ACTIVE_PRINTER: 'pos_active_printer',
  SAVED_PRINTERS: 'pos_saved_printers',
  PRINTER_SETTINGS: 'pos_printer_settings',
  AUTO_CONNECT: 'pos_printer_auto_connect',
  LAST_WIFI_PRINTERS: 'pos_wifi_printers',
  LAST_USB_PRINTERS: 'pos_usb_printers',
};

// ============================================================================
// ESC/POS COMMANDS
// ============================================================================

const ESC = '\x1B';
const GS = '\x1D';
const FS = '\x1C';
const LF = '\x0A';
const NULL = '\x00';
const DLE = '\x10';
const EOT = '\x04';

export const ESC_POS = {
  // Initialize
  INIT: ESC + '@',
  
  // Text formatting
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_2_ON: ESC + '-' + '\x02',
  UNDERLINE_OFF: ESC + '-' + '\x00',
  ITALIC_ON: ESC + '4',
  ITALIC_OFF: ESC + '5',
  DOUBLE_HEIGHT_ON: ESC + '!' + '\x10',
  DOUBLE_WIDTH_ON: ESC + '!' + '\x20',
  DOUBLE_SIZE_ON: ESC + '!' + '\x30',
  NORMAL_SIZE: ESC + '!' + '\x00',
  INVERT_ON: GS + 'B' + '\x01',
  INVERT_OFF: GS + 'B' + '\x00',
  
  // Alignment
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  
  // Feed and cut
  FEED_LINE: LF,
  FEED_LINES: (n: number) => LF.repeat(n),
  FEED_N: (n: number) => ESC + 'd' + String.fromCharCode(n),
  PARTIAL_CUT: GS + 'V' + '\x01',
  FULL_CUT: GS + 'V' + '\x00',
  CUT_FEED: GS + 'V' + 'A' + '\x03',  // Cut with 3 lines feed
  
  // Cash drawer
  OPEN_DRAWER_PIN2: ESC + 'p' + '\x00' + '\x19' + '\xFA',
  OPEN_DRAWER_PIN5: ESC + 'p' + '\x01' + '\x19' + '\xFA',
  
  // Beep
  BEEP: ESC + 'B' + '\x05' + '\x09',
  BEEP_CUSTOM: (n: number, t: number) => ESC + 'B' + String.fromCharCode(n) + String.fromCharCode(t),
  
  // Paper status
  STATUS_PAPER: DLE + EOT + '\x01',
  
  // Print density
  DENSITY_LIGHT: GS + '|' + '\x01' + '\x01',
  DENSITY_NORMAL: GS + '|' + '\x01' + '\x02',
  DENSITY_DARK: GS + '|' + '\x01' + '\x03',
  
  // Character set
  CHARSET_USA: ESC + 'R' + '\x00',
  CHARSET_FRANCE: ESC + 'R' + '\x01',
  CHARSET_ARABIC: ESC + 'R' + '\x25',
  
  // Code page
  CODEPAGE_UTF8: ESC + 't' + '\x30',
  CODEPAGE_CP437: ESC + 't' + '\x00',
  CODEPAGE_CP850: ESC + 't' + '\x02',
  CODEPAGE_CP866: ESC + 't' + '\x11',
  
  // Barcode
  BARCODE_HEIGHT: (n: number) => GS + 'h' + String.fromCharCode(n),
  BARCODE_WIDTH: (n: number) => GS + 'w' + String.fromCharCode(n),
  BARCODE_TEXT_BELOW: GS + 'H' + '\x02',
  BARCODE_CODE128: (data: string) => GS + 'k' + '\x49' + String.fromCharCode(data.length) + data,
  
  // QR Code
  QR_MODEL: GS + '(' + 'k' + '\x04' + '\x00' + '\x31' + '\x41' + '\x32' + '\x00',
  QR_SIZE: (n: number) => GS + '(' + 'k' + '\x03' + '\x00' + '\x31' + '\x43' + String.fromCharCode(n),
  QR_ERROR: GS + '(' + 'k' + '\x03' + '\x00' + '\x31' + '\x45' + '\x31',  // L level
  QR_STORE: (data: string) => {
    const len = data.length + 3;
    return GS + '(' + 'k' + String.fromCharCode(len % 256) + String.fromCharCode(Math.floor(len / 256)) + 
           '\x31' + '\x50' + '\x30' + data;
  },
  QR_PRINT: GS + '(' + 'k' + '\x03' + '\x00' + '\x31' + '\x51' + '\x30',
};

// Default settings
const DEFAULT_SETTINGS: PrinterSettings = {
  paperWidth: 80,
  autoCut: true,
  openDrawer: false,
  printDensity: 2,
  charset: 'UTF-8',
};

// ============================================================================
// UNIFIED PRINTER SERVICE CLASS
// ============================================================================

class UnifiedPrinterServiceClass {
  private connection: PrinterConnection = {
    device: null,
    type: 'none',
    isConnected: false,
    isConnecting: false,
    lastError: null,
    autoReconnect: true,
  };

  private settings: PrinterSettings = { ...DEFAULT_SETTINGS };
  private printQueue: PrintJob[] = [];
  private isProcessingQueue = false;
  private connectionListeners: ((status: ConnectionStatus, device?: PrinterDevice | null) => void)[] = [];
  
  // Native modules (when available)
  private ThermalPrinterModule: any = null;  // Our custom native module
  private BluetoothManager: any = null;
  private BluetoothEscposPrinter: any = null;
  private TcpSocket: any = null;
  private UsbSerial: any = null;
  private eventEmitter: NativeEventEmitter | null = null;
  
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private isInitialized = false;
  
  // Active WiFi socket
  private wifiSocket: any = null;
  private wifiTimeout: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Load saved settings
      await this.loadSettings();

      // Try to load native modules - PRIORITY: ThermalPrinterModule (our Kotlin module)
      const { 
        ThermalPrinterModule: TPM,
        BluetoothManager: BM, 
        BluetoothEscposPrinter: BEP,
        TcpSockets: TCP,
        UsbSerialManager: USB,
      } = NativeModules;

      // Use our custom ThermalPrinterModule FIRST (supports USB, BT, WiFi)
      if (TPM) {
        this.ThermalPrinterModule = TPM;
        this.eventEmitter = new NativeEventEmitter(TPM);
        this.setupThermalPrinterEventListeners();
        console.log('✅ ThermalPrinterModule (native) initialized - USB/BT/WiFi');
      } else if (BM && BEP) {
        // Fallback to legacy react-native-bluetooth-escpos-printer
        this.BluetoothManager = BM;
        this.BluetoothEscposPrinter = BEP;
        this.eventEmitter = new NativeEventEmitter(BM);
        this.setupBluetoothEventListeners();
        console.log('✅ Legacy Bluetooth module initialized');
      } else {
        console.log('⚠️ Bluetooth modules not available - simulation mode');
      }

      if (TCP) {
        this.TcpSocket = TCP;
        console.log('✅ TCP/IP module initialized');
      } else {
        console.log('⚠️ TCP module not available - WiFi printing limited');
      }

      if (USB) {
        this.UsbSerial = USB;
        console.log('✅ USB module initialized');
      } else {
        console.log('⚠️ USB module not available');
      }

      this.isInitialized = true;

      // Auto-connect to saved printer
      this.autoConnectToSavedDevice();

      return true;
    } catch (error) {
      console.error('UnifiedPrinterService init error:', error);
      this.isInitialized = true;
      return false;
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PRINTER_SETTINGS);
      if (data) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Load settings error:', error);
    }
  }

  async saveSettings(settings: Partial<PrinterSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.PRINTER_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Save settings error:', error);
    }
  }

  getSettings(): PrinterSettings {
    return { ...this.settings };
  }

  // ============================================================================
  // THERMAL PRINTER MODULE EVENT LISTENERS (our native Kotlin module)
  // ============================================================================

  private setupThermalPrinterEventListeners(): void {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('onBluetoothDeviceFound', (device: any) => {
      console.log('🔍 BT device found:', device.name);
    });

    this.eventEmitter.addListener('onDiscoveryFinished', () => {
      console.log('🔍 BT discovery finished');
    });

    this.eventEmitter.addListener('onConnected', (data: any) => {
      console.log('✅ ThermalPrinterModule connected:', data);
      this.connection.isConnected = true;
      this.connection.isConnecting = false;
      this.connection.type = data?.transport || 'bluetooth';
      this.connection.lastError = null;
      this.reconnectAttempts = 0;
      this.notifyListeners('connected', this.connection.device);
      this.processQueue();
    });

    this.eventEmitter.addListener('onDisconnected', () => {
      console.log('⚠️ ThermalPrinterModule disconnected');
      this.connection.isConnected = false;
      this.notifyListeners('disconnected');
    });

    this.eventEmitter.addListener('onError', (error: any) => {
      console.error('❌ ThermalPrinterModule error:', error);
      this.connection.lastError = error?.message || 'Erreur d\'impression';
      this.notifyListeners('error');
    });
  }

  // Check actual connection status from ThermalPrinterModule
  async checkConnectionStatus(): Promise<boolean> {
    if (this.ThermalPrinterModule) {
      try {
        const status = await this.ThermalPrinterModule.getConnectionStatus();
        this.connection.isConnected = status.isConnected;
        if (status.transport) {
          this.connection.type = status.transport as PrinterType;
        }
        return status.isConnected;
      } catch (error) {
        console.error('Error checking connection status:', error);
      }
    }
    return this.connection.isConnected;
  }

  // ============================================================================
  // BLUETOOTH EVENT LISTENERS (legacy react-native-bluetooth-escpos-printer)
  // ============================================================================

  private setupBluetoothEventListeners(): void {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('EVENT_BLUETOOTH_NOT_SUPPORT', () => {
      this.connection.lastError = 'Bluetooth non supporté';
      this.notifyListeners('error');
    });

    this.eventEmitter.addListener('EVENT_CONNECTED', () => {
      this.connection.isConnected = true;
      this.connection.isConnecting = false;
      this.connection.lastError = null;
      this.reconnectAttempts = 0;
      this.notifyListeners('connected', this.connection.device);
      console.log('✅ Bluetooth printer connected');
      this.processQueue();
    });

    this.eventEmitter.addListener('EVENT_UNABLE_CONNECT', () => {
      this.handleConnectionFailure('Impossible de se connecter');
    });

    this.eventEmitter.addListener('EVENT_CONNECTION_LOST', () => {
      this.connection.isConnected = false;
      this.notifyListeners('disconnected');
      console.log('⚠️ Bluetooth connection lost');
      if (this.connection.autoReconnect && this.connection.device) {
        this.attemptReconnect();
      }
    });
  }

  // ============================================================================
  // DEVICE DISCOVERY
  // ============================================================================

  async discoverBluetoothDevices(): Promise<PrinterDevice[]> {
    const hasPermission = await this.requestBluetoothPermissions();
    if (!hasPermission) return [];

    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const paired = await this.ThermalPrinterModule.getPairedBluetoothDevices();
        const devices: PrinterDevice[] = paired.map((d: any) => ({
          id: `bt_${d.address}`,
          name: d.name || 'Appareil inconnu',
          address: d.address,
          type: 'bluetooth' as PrinterType,
          paired: true,
          connected: d.address === this.connection.device?.address && this.connection.isConnected,
        }));

        // Cache for later
        await this.savePrinters(devices, 'bluetooth');
        return devices;
      } catch (error) {
        console.error('ThermalPrinterModule scan error:', error);
        return await this.getSavedPrinters('bluetooth');
      }
    }

    // Fallback to legacy BluetoothManager
    if (!this.BluetoothManager) {
      // Simulation mode - return cached + dummy devices
      const cached = await this.getSavedPrinters('bluetooth');
      if (cached.length === 0) {
        // Show instructions
        this.showBluetoothInstructions();
      }
      return cached;
    }

    try {
      const paired = await this.BluetoothManager.scanDevices();
      const devices: PrinterDevice[] = [];

      if (paired && typeof paired === 'string') {
        const pairedList = JSON.parse(paired);
        for (const d of pairedList) {
          devices.push({
            id: `bt_${d.address}`,
            name: d.name || 'Appareil inconnu',
            address: d.address,
            type: 'bluetooth',
            paired: true,
            connected: d.address === this.connection.device?.address && this.connection.isConnected,
          });
        }
      }

      // Cache for later
      await this.savePrinters(devices, 'bluetooth');
      return devices;
    } catch (error) {
      console.error('Bluetooth scan error:', error);
      return await this.getSavedPrinters('bluetooth');
    }
  }

  async discoverWiFiPrinters(): Promise<PrinterDevice[]> {
    // For WiFi printers, we typically use manual configuration
    // Some printers support mDNS/Bonjour discovery
    
    const savedPrinters = await this.getSavedPrinters('wifi');
    
    // Common printer ports to check
    const commonPorts = [9100, 9101, 9102, 515, 631];
    
    // Show manual add dialog since auto-discovery is limited
    if (savedPrinters.length === 0) {
      Alert.alert(
        '🌐 Imprimante WiFi',
        'Pour ajouter une imprimante WiFi:\n\n' +
        '1. Connectez l\'imprimante au même réseau WiFi\n' +
        '2. Trouvez son adresse IP dans ses paramètres\n' +
        '3. Le port par défaut est généralement 9100\n\n' +
        'Entrez l\'adresse IP:port (ex: 192.168.1.100:9100)',
        [{ text: 'OK' }]
      );
    }

    return savedPrinters;
  }

  async discoverUSBDevices(): Promise<PrinterDevice[]> {
    // Use ThermalPrinterModule (our native Kotlin module) for USB
    if (this.ThermalPrinterModule) {
      try {
        const usbDevices = await this.ThermalPrinterModule.getUsbDevices();
        const devices: PrinterDevice[] = usbDevices.map((d: any) => ({
          id: `usb_${d.deviceId}`,
          name: d.productName || d.manufacturerName || 'Imprimante USB',
          address: d.deviceId,
          type: 'usb' as PrinterType,
          manufacturer: d.manufacturerName,
          model: d.productName,
        }));

        await this.savePrinters(devices, 'usb');
        return devices;
      } catch (error) {
        console.error('ThermalPrinterModule USB error:', error);
        return await this.getSavedPrinters('usb');
      }
    }

    if (!this.UsbSerial) {
      const cached = await this.getSavedPrinters('usb');
      if (cached.length === 0) {
        Alert.alert(
          '🔌 Imprimante USB',
          'Pour utiliser une imprimante USB:\n\n' +
          '1. Connectez l\'imprimante via câble USB OTG\n' +
          '2. Autorisez l\'accès USB quand demandé\n' +
          '3. L\'imprimante apparaîtra dans la liste\n\n' +
          'Note: Nécessite un adaptateur USB OTG',
          [{ text: 'OK' }]
        );
      }
      return cached;
    }

    try {
      const devices = await this.UsbSerial.list();
      const printers: PrinterDevice[] = devices.map((d: any) => ({
        id: `usb_${d.deviceId}`,
        name: d.productName || d.manufacturerName || 'Imprimante USB',
        address: d.deviceId.toString(),
        type: 'usb' as PrinterType,
        manufacturer: d.manufacturerName,
        model: d.productName,
      }));

      await this.savePrinters(printers, 'usb');
      return printers;
    } catch (error) {
      console.error('USB scan error:', error);
      return [];
    }
  }

  async discoverAllPrinters(): Promise<PrinterDevice[]> {
    const [bluetooth, wifi, usb] = await Promise.all([
      this.discoverBluetoothDevices(),
      this.discoverWiFiPrinters(),
      this.discoverUSBDevices(),
    ]);

    return [...bluetooth, ...wifi, ...usb];
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  async connect(device: PrinterDevice): Promise<boolean> {
    if (this.connection.isConnecting) {
      console.log('Already connecting...');
      return false;
    }

    // Disconnect current if different
    if (this.connection.device && this.connection.device.id !== device.id) {
      await this.disconnect();
    }

    this.connection.isConnecting = true;
    this.connection.device = device;
    this.connection.type = device.type;
    this.notifyListeners('connecting', device);

    let success = false;

    switch (device.type) {
      case 'bluetooth':
        success = await this.connectBluetooth(device);
        break;
      case 'wifi':
        success = await this.connectWiFi(device);
        break;
      case 'usb':
        success = await this.connectUSB(device);
        break;
    }

    this.connection.isConnecting = false;

    if (success) {
      this.connection.isConnected = true;
      this.connection.lastError = null;
      this.reconnectAttempts = 0;
      this.notifyListeners('connected', device);
      await this.saveActivePrinter(device);
      console.log(`✅ Connected to ${device.type} printer: ${device.name}`);
    } else {
      this.connection.isConnected = false;
      this.notifyListeners('error', device);
    }

    return success;
  }

  private async connectBluetooth(device: PrinterDevice): Promise<boolean> {
    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const success = await this.ThermalPrinterModule.connectBluetooth(device.address);
        if (success) {
          console.log(`✅ ThermalPrinterModule BT connected: ${device.name}`);
          return true;
        }
        return false;
      } catch (error: any) {
        this.connection.lastError = error.message || 'Échec connexion Bluetooth';
        console.error('ThermalPrinterModule BT connect error:', error);
        return false;
      }
    }

    // Fallback to legacy BluetoothManager
    if (!this.BluetoothManager) {
      // Simulation mode
      console.log(`[SIM] Connecting to Bluetooth: ${device.name}`);
      return true;
    }

    try {
      const connectionPromise = this.BluetoothManager.connect(device.address);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );

      await Promise.race([connectionPromise, timeoutPromise]);
      return true;
    } catch (error: any) {
      this.connection.lastError = error.message || 'Échec connexion Bluetooth';
      console.error('Bluetooth connect error:', error);
      return false;
    }
  }

  private async connectWiFi(device: PrinterDevice): Promise<boolean> {
    // Parse IP:port
    const [ip, portStr] = device.address.split(':');
    const port = parseInt(portStr) || 9100;

    if (!ip) {
      this.connection.lastError = 'Adresse IP invalide';
      return false;
    }

    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const success = await this.ThermalPrinterModule.connectWifi(ip, port);
        if (success) {
          console.log(`✅ ThermalPrinterModule WiFi connected: ${ip}:${port}`);
          return true;
        }
        return false;
      } catch (error: any) {
        this.connection.lastError = error.message || 'Échec connexion WiFi';
        console.error('ThermalPrinterModule WiFi connect error:', error);
        return false;
      }
    }

    // For simulation or when TcpSocket not available
    if (!this.TcpSocket) {
      console.log(`[SIM] Connecting to WiFi printer: ${ip}:${port}`);
      return true;
    }

    try {
      return new Promise((resolve) => {
        const socket = this.TcpSocket.createConnection({ host: ip, port }, () => {
          console.log(`✅ WiFi connected to ${ip}:${port}`);
          this.wifiSocket = socket;
          resolve(true);
        });

        socket.on('error', (err: Error) => {
          console.error('WiFi socket error:', err);
          this.connection.lastError = err.message;
          resolve(false);
        });

        socket.on('close', () => {
          console.log('WiFi socket closed');
          if (this.connection.type === 'wifi' && this.connection.isConnected) {
            this.connection.isConnected = false;
            this.notifyListeners('disconnected');
            if (this.connection.autoReconnect) {
              this.attemptReconnect();
            }
          }
        });

        // Timeout
        this.wifiTimeout = setTimeout(() => {
          socket.destroy();
          this.connection.lastError = 'Connexion WiFi timeout';
          resolve(false);
        }, 10000);

        socket.on('connect', () => {
          if (this.wifiTimeout) {
            clearTimeout(this.wifiTimeout);
            this.wifiTimeout = null;
          }
        });
      });
    } catch (error: any) {
      this.connection.lastError = error.message || 'Échec connexion WiFi';
      return false;
    }
  }

  private async connectUSB(device: PrinterDevice): Promise<boolean> {
    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const success = await this.ThermalPrinterModule.connectUsb(device.address);
        if (success) {
          console.log(`✅ ThermalPrinterModule USB connected: ${device.name}`);
          return true;
        }
        return false;
      } catch (error: any) {
        this.connection.lastError = error.message || 'Échec connexion USB';
        console.error('ThermalPrinterModule USB connect error:', error);
        return false;
      }
    }

    if (!this.UsbSerial) {
      console.log(`[SIM] Connecting to USB: ${device.name}`);
      return true;
    }

    try {
      await this.UsbSerial.open(device.address, { baudRate: 9600 });
      return true;
    } catch (error: any) {
      this.connection.lastError = error.message || 'Échec connexion USB';
      console.error('USB connect error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Use ThermalPrinterModule if available
    if (this.ThermalPrinterModule) {
      try {
        await this.ThermalPrinterModule.disconnect();
      } catch (error) {
        console.error('ThermalPrinterModule disconnect error:', error);
      }
    }

    switch (this.connection.type) {
      case 'bluetooth':
        if (this.BluetoothManager) {
          try {
            await this.BluetoothManager.disconnect();
          } catch (error) {
            console.error('Bluetooth disconnect error:', error);
          }
        }
        break;
      case 'wifi':
        if (this.wifiSocket) {
          this.wifiSocket.destroy();
          this.wifiSocket = null;
        }
        break;
      case 'usb':
        if (this.UsbSerial) {
          try {
            await this.UsbSerial.close();
          } catch (error) {
            console.error('USB disconnect error:', error);
          }
        }
        break;
    }

    this.connection.isConnected = false;
    this.connection.device = null;
    this.connection.type = 'none';
    this.notifyListeners('disconnected');
  }

  async quickConnect(): Promise<boolean> {
    // First, check if ThermalPrinterModule is already connected
    if (this.ThermalPrinterModule) {
      try {
        const status = await this.ThermalPrinterModule.getConnectionStatus();
        if (status.isConnected) {
          // Sync our state with actual native module state
          this.connection.isConnected = true;
          this.connection.type = (status.transport as PrinterType) || 'bluetooth';
          console.log('✅ ThermalPrinterModule already connected:', status.transport);
          return true;
        }
      } catch (error) {
        console.error('Error checking ThermalPrinterModule status:', error);
      }
    }

    const lastDevice = await this.getActivePrinter();
    if (!lastDevice) return false;
    return this.connect(lastDevice);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.connection.lastError = 'Reconnexion impossible après plusieurs tentatives';
      this.notifyListeners('error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

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
    try {
      const autoConnect = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT);
      if (autoConnect !== 'true') return;

      const device = await this.getActivePrinter();
      if (device) {
        console.log('Auto-connecting to:', device.name);
        setTimeout(() => this.connect(device), 2000);
      }
    } catch (error) {
      console.error('Auto-connect error:', error);
    }
  }

  // ============================================================================
  // PRINTING
  // ============================================================================

  async print(data: string): Promise<boolean> {
    // First, sync with ThermalPrinterModule's actual connection status
    if (this.ThermalPrinterModule) {
      try {
        const status = await this.ThermalPrinterModule.getConnectionStatus();
        if (status.isConnected) {
          // Sync our state
          this.connection.isConnected = true;
          this.connection.type = (status.transport as PrinterType) || 'bluetooth';
        } else {
          this.connection.isConnected = false;
        }
      } catch (error) {
        console.error('Error checking connection status:', error);
      }
    }

    if (!this.connection.isConnected) {
      const connected = await this.quickConnect();
      if (!connected) {
        Alert.alert(
          '🖨️ Imprimante non connectée',
          'Veuillez connecter une imprimante.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    let success = false;

    switch (this.connection.type) {
      case 'bluetooth':
        success = await this.printBluetooth(data);
        break;
      case 'wifi':
        success = await this.printWiFi(data);
        break;
      case 'usb':
        success = await this.printUSB(data);
        break;
    }

    if (!success && this.connection.isConnected) {
      // Add to queue for retry
      this.addToQueue(data);
    }

    return success;
  }

  private async printBluetooth(data: string): Promise<boolean> {
    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const bytesWritten = await this.ThermalPrinterModule.printText(data);
        console.log(`✅ ThermalPrinterModule BT printed ${bytesWritten} bytes`);
        return bytesWritten > 0;
      } catch (error) {
        console.error('ThermalPrinterModule BT print error:', error);
        return false;
      }
    }

    // Fallback to legacy BluetoothEscposPrinter
    if (!this.BluetoothEscposPrinter) {
      console.log('[SIM] Bluetooth print:', data.substring(0, 100));
      return true;
    }

    try {
      await this.BluetoothEscposPrinter.printerInit();
      await this.BluetoothEscposPrinter.printText(data, {
        encoding: 'UTF-8',
        codepage: 0,
        widthtimes: 0,
        heigthtimes: 0,
        fonttype: 1,
      });
      return true;
    } catch (error) {
      console.error('Bluetooth print error:', error);
      return false;
    }
  }

  private async printWiFi(data: string): Promise<boolean> {
    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const bytesWritten = await this.ThermalPrinterModule.printText(data);
        console.log(`✅ ThermalPrinterModule WiFi printed ${bytesWritten} bytes`);
        return bytesWritten > 0;
      } catch (error) {
        console.error('ThermalPrinterModule WiFi print error:', error);
        return false;
      }
    }

    if (!this.wifiSocket) {
      if (!this.TcpSocket) {
        console.log('[SIM] WiFi print:', data.substring(0, 100));
        return true;
      }
      return false;
    }

    return new Promise((resolve) => {
      try {
        this.wifiSocket.write(data, 'binary', (err: Error | null) => {
          if (err) {
            console.error('WiFi print error:', err);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        console.error('WiFi print exception:', error);
        resolve(false);
      }
    });
  }

  private async printUSB(data: string): Promise<boolean> {
    // Use ThermalPrinterModule (our native Kotlin module) FIRST
    if (this.ThermalPrinterModule) {
      try {
        const bytesWritten = await this.ThermalPrinterModule.printText(data);
        console.log(`✅ ThermalPrinterModule USB printed ${bytesWritten} bytes`);
        return bytesWritten > 0;
      } catch (error) {
        console.error('ThermalPrinterModule USB print error:', error);
        return false;
      }
    }

    if (!this.UsbSerial) {
      console.log('[SIM] USB print:', data.substring(0, 100));
      return true;
    }

    try {
      await this.UsbSerial.write(data);
      return true;
    } catch (error) {
      console.error('USB print error:', error);
      return false;
    }
  }

  async printWithRetry(data: string, maxRetries = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const success = await this.print(data);
      if (success) return true;

      console.log(`Print attempt ${attempt}/${maxRetries} failed`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    Alert.alert(
      '❌ Échec d\'impression',
      'Impossible d\'imprimer après plusieurs tentatives.',
      [{ text: 'OK' }]
    );
    return false;
  }

  async openCashDrawer(): Promise<boolean> {
    // Use ThermalPrinterModule if available
    if (this.ThermalPrinterModule) {
      try {
        await this.ThermalPrinterModule.openCashDrawer();
        return true;
      } catch (error) {
        console.error('ThermalPrinterModule openCashDrawer error:', error);
        return false;
      }
    }
    return this.print(ESC_POS.OPEN_DRAWER_PIN2);
  }

  // ============================================================================
  // TEST PRINTING
  // ============================================================================

  async printTestPage(): Promise<TestPrintResult> {
    const startTime = Date.now();
    const printerType = this.connection.type;
    const deviceName = this.connection.device?.name || 'Inconnu';

    // Use ThermalPrinterModule test page if available (better formatting)
    if (this.ThermalPrinterModule && this.connection.isConnected) {
      try {
        const bytesWritten = await this.ThermalPrinterModule.printTestPage();
        const duration = Date.now() - startTime;
        return {
          success: bytesWritten > 0,
          message: bytesWritten > 0 ? 'Test imprimé avec succès' : 'Échec impression test',
          duration,
          bytesWritten,
          printerType,
        };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        return {
          success: false,
          message: error.message || 'Erreur test impression',
          duration,
          bytesWritten: 0,
          printerType,
        };
      }
    }

    const testData =
      ESC_POS.INIT +
      ESC_POS.ALIGN_CENTER +
      ESC_POS.DOUBLE_SIZE_ON +
      'TEST IMPRESSION\n' +
      ESC_POS.NORMAL_SIZE +
      '================================\n' +
      ESC_POS.ALIGN_LEFT +
      'Date: ' + new Date().toLocaleString('fr-FR') + '\n' +
      'Imprimante: ' + deviceName + '\n' +
      'Type: ' + printerType.toUpperCase() + '\n' +
      'Adresse: ' + (this.connection.device?.address || 'N/A') + '\n' +
      '================================\n\n' +
      ESC_POS.ALIGN_CENTER +
      'Verification caracteres:\n' +
      ESC_POS.ALIGN_LEFT +
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ\n' +
      'abcdefghijklmnopqrstuvwxyz\n' +
      '0123456789\n' +
      '!@#$%^&*()_+-=[]{}|;:\'",.<>?\n' +
      'àéèùêëïôûç ÀÉÈÙÊËÏÔÛÇ\n' +
      '================================\n\n' +
      ESC_POS.ALIGN_CENTER +
      ESC_POS.BOLD_ON +
      'CaissaPro v2.1.0\n' +
      ESC_POS.BOLD_OFF +
      'Impression reussie ✓\n\n' +
      ESC_POS.FEED_LINES(3) +
      (this.settings.autoCut ? ESC_POS.PARTIAL_CUT : '');

    const success = await this.print(testData);
    const duration = Date.now() - startTime;

    return {
      success,
      message: success
        ? `Test réussi sur ${deviceName} (${printerType})`
        : `Échec du test sur ${deviceName}`,
      duration,
      printerType,
    };
  }

  async testConnection(): Promise<TestPrintResult> {
    const startTime = Date.now();

    if (!this.connection.isConnected) {
      return {
        success: false,
        message: 'Aucune imprimante connectée',
        duration: 0,
        printerType: 'none',
      };
    }

    // Just send init command to check connection
    const success = await this.print(ESC_POS.INIT + ESC_POS.BEEP);
    const duration = Date.now() - startTime;

    return {
      success,
      message: success ? 'Connexion OK' : 'Échec de communication',
      duration,
      printerType: this.connection.type,
    };
  }

  // ============================================================================
  // PRINT QUEUE
  // ============================================================================

  private addToQueue(data: string): void {
    const job: PrintJob = {
      id: Date.now().toString(),
      data,
      retries: 0,
      maxRetries: 3,
      timestamp: Date.now(),
      printerType: this.connection.type,
    };
    this.printQueue.push(job);
    console.log('Print job queued:', job.id);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.printQueue.length === 0) return;

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
          console.log('Print job failed max retries:', job.id);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000));
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
  // PERSISTENCE
  // ============================================================================

  private async saveActivePrinter(device: PrinterDevice): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PRINTER, JSON.stringify({
        ...device,
        lastConnected: Date.now(),
      }));
    } catch (error) {
      console.error('Save active printer error:', error);
    }
  }

  async getActivePrinter(): Promise<PrinterDevice | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PRINTER);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Get active printer error:', error);
      return null;
    }
  }

  private async savePrinters(devices: PrinterDevice[], type: PrinterType): Promise<void> {
    try {
      const key = type === 'bluetooth' ? STORAGE_KEYS.SAVED_PRINTERS :
                  type === 'wifi' ? STORAGE_KEYS.LAST_WIFI_PRINTERS :
                  STORAGE_KEYS.LAST_USB_PRINTERS;
      await AsyncStorage.setItem(key, JSON.stringify(devices));
    } catch (error) {
      console.error('Save printers error:', error);
    }
  }

  private async getSavedPrinters(type: PrinterType): Promise<PrinterDevice[]> {
    try {
      const key = type === 'bluetooth' ? STORAGE_KEYS.SAVED_PRINTERS :
                  type === 'wifi' ? STORAGE_KEYS.LAST_WIFI_PRINTERS :
                  STORAGE_KEYS.LAST_USB_PRINTERS;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  }

  async addWiFiPrinter(name: string, ip: string, port: number = 9100): Promise<PrinterDevice> {
    const device: PrinterDevice = {
      id: `wifi_${ip}_${port}`,
      name: name || `WiFi Printer (${ip})`,
      address: `${ip}:${port}`,
      type: 'wifi',
    };

    const existing = await this.getSavedPrinters('wifi');
    const filtered = existing.filter((d) => d.id !== device.id);
    await this.savePrinters([device, ...filtered], 'wifi');

    return device;
  }

  async removeWiFiPrinter(deviceId: string): Promise<void> {
    const existing = await this.getSavedPrinters('wifi');
    const filtered = existing.filter((d) => d.id !== deviceId);
    await this.savePrinters(filtered, 'wifi');
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

  getConnectedDevice(): PrinterDevice | null {
    return this.connection.device;
  }

  getConnectionType(): PrinterType {
    return this.connection.type;
  }

  onConnectionStatusChange(
    listener: (status: ConnectionStatus, device?: PrinterDevice | null) => void
  ): () => void {
    this.connectionListeners.push(listener);
    return () => {
      const index = this.connectionListeners.indexOf(listener);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(status: ConnectionStatus, device?: PrinterDevice | null): void {
    this.connectionListeners.forEach((listener) => listener(status, device));
  }

  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  async requestBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      const apiLevel = Platform.Version;

      if (typeof apiLevel === 'number' && apiLevel >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(results).every(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            '🔓 Permissions requises',
            'Autorisez Bluetooth et localisation pour utiliser l\'imprimante.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Paramètres', onPress: () => Linking.openSettings() },
            ]
          );
          return false;
        }
        return true;
      } else {
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
      console.error('Permission error:', error);
      return false;
    }
  }

  private showBluetoothInstructions(): void {
    Alert.alert(
      '📱 Configuration Bluetooth',
      'Pour connecter une imprimante Bluetooth:\n\n' +
        '1. Activez le Bluetooth\n' +
        '2. Allumez l\'imprimante (mode appairage)\n' +
        '3. Paramètres → Bluetooth → Appairer\n' +
        '4. Revenez ici et sélectionnez-la',
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
          },
        },
      ]
    );
  }

  openBluetoothSettings(): void {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
        Linking.openSettings();
      });
    } else {
      Linking.openURL('App-Prefs:Bluetooth').catch(() => {
        Linking.openSettings();
      });
    }
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

    if (this.wifiSocket) {
      this.wifiSocket.destroy();
      this.wifiSocket = null;
    }

    if (this.wifiTimeout) {
      clearTimeout(this.wifiTimeout);
      this.wifiTimeout = null;
    }

    this.connectionListeners = [];
    this.printQueue = [];
    this.connection = {
      device: null,
      type: 'none',
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

export const UnifiedPrinterService = new UnifiedPrinterServiceClass();

// Initialize on import
UnifiedPrinterService.initialize().catch(console.error);

export default UnifiedPrinterService;
