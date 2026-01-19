/**
 * Printing Service Interface
 * Platform-agnostic abstraction for thermal printing
 */

export interface PrinterInfo {
  name: string;
  address: string;
  type: 'bluetooth' | 'usb' | 'network' | 'none';
  connected: boolean;
}

export interface PrintJob {
  id: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  error?: string;
}

export interface PrintServiceInterface {
  // Initialization
  initialize(): Promise<boolean>;
  
  // Printer discovery
  discoverPrinters(): Promise<PrinterInfo[]>;
  getConnectedPrinter(): Promise<PrinterInfo | null>;
  
  // Connection management
  connect(address: string): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // Printing
  printReceipt(content: string): Promise<boolean>;
  printRaw(data: string): Promise<boolean>;
  openCashDrawer(): Promise<boolean>;
  
  // Status
  isPrintingSupported(): boolean;
  getLastError(): string | null;
  
  // Queue management (optional)
  getPendingJobs?(): PrintJob[];
  cancelJob?(jobId: string): Promise<boolean>;
}

/**
 * Receipt content builder interface
 */
export interface ReceiptBuilder {
  addHeader(businessName: string): this;
  addLine(text: string, align?: 'left' | 'center' | 'right'): this;
  addDivider(): this;
  addBlankLine(): this;
  addItem(name: string, qty: number, price: number): this;
  addTotal(label: string, amount: number, bold?: boolean): this;
  addQRCode?(data: string): this;
  addBarcode?(data: string): this;
  build(): string;
}
