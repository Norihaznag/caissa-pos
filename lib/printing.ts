import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';

// Printer configuration storage key
const PRINTER_CONFIG_KEY = 'pos_printer_config';

// Printer types
export type PrinterType = 'bluetooth' | 'network' | 'usb' | 'none';

export interface PrinterConfig {
  type: PrinterType;
  name: string;
  address: string; // MAC address for Bluetooth, IP:port for network
  paperWidth: 58 | 80; // mm
  enabled: boolean;
}

// Default printer config
const defaultPrinterConfig: PrinterConfig = {
  type: 'none',
  name: '',
  address: '',
  paperWidth: 80,
  enabled: false,
};

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

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

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

// Print via network (ESC/POS over TCP)
export const printToNetworkPrinter = async (
  address: string, 
  data: string
): Promise<boolean> => {
  // Note: For React Native, you would use react-native-tcp-socket or similar
  // This is a placeholder implementation
  try {
    console.log('Printing to network printer:', address);
    console.log('Data:', data);
    
    // In a real implementation:
    // const socket = TcpSocket.createConnection({ host, port }, () => {
    //   socket.write(data);
    //   socket.end();
    // });
    
    Alert.alert(
      'Impression Réseau',
      `Envoi vers ${address}...\n\nNote: L'impression réseau nécessite une configuration supplémentaire.`
    );
    
    return true;
  } catch (error) {
    console.error('Network print error:', error);
    return false;
  }
};

// Print via Bluetooth
export const printToBluetoothPrinter = async (
  macAddress: string,
  data: string
): Promise<boolean> => {
  // Note: For React Native, you would use react-native-bluetooth-escpos-printer
  // This is a placeholder implementation
  try {
    console.log('Printing to Bluetooth printer:', macAddress);
    
    // In a real implementation:
    // await BluetoothEscposPrinter.printText(data, {});
    
    Alert.alert(
      'Impression Bluetooth',
      `Envoi vers ${macAddress}...\n\nNote: L'impression Bluetooth nécessite la bibliothèque react-native-bluetooth-escpos-printer.`
    );
    
    return true;
  } catch (error) {
    console.error('Bluetooth print error:', error);
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
      return printToNetworkPrinter(config.address, commands);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, commands);
    case 'usb':
      Alert.alert('USB', 'L\'impression USB n\'est pas encore supportée sur mobile.');
      return false;
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
      return printToNetworkPrinter(config.address, commands);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, commands);
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
      return printToNetworkPrinter(config.address, command);
    case 'bluetooth':
      return printToBluetoothPrinter(config.address, command);
    default:
      return false;
  }
};
