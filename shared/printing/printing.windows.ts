/**
 * Windows Printing Service - Stub Implementation
 * 
 * Thermal printing is not available on Windows desktop.
 * This stub provides graceful degradation.
 */

import { 
  PrintServiceInterface, 
  PrinterInfo, 
  PrintJob,
  ReceiptBuilder 
} from './printing.interface';

class WindowsPrintService implements PrintServiceInterface {
  private lastError: string | null = null;

  async initialize(): Promise<boolean> {
    console.log('[WindowsPrint] Printing not supported on Windows desktop');
    return true;
  }

  async discoverPrinters(): Promise<PrinterInfo[]> {
    // No thermal printers on Windows version
    return [];
  }

  async getConnectedPrinter(): Promise<PrinterInfo | null> {
    return null;
  }

  async connect(_address: string): Promise<boolean> {
    this.lastError = 'Printing is not available on Windows desktop version';
    return false;
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  isConnected(): boolean {
    return false;
  }

  async printReceipt(_content: string): Promise<boolean> {
    this.lastError = 'Printing is not available on Windows desktop. Use mobile app for printing.';
    console.warn('[WindowsPrint]', this.lastError);
    return false;
  }

  async printRaw(_data: string): Promise<boolean> {
    this.lastError = 'Printing is not available on Windows desktop';
    return false;
  }

  async openCashDrawer(): Promise<boolean> {
    this.lastError = 'Cash drawer not available on Windows desktop';
    return false;
  }

  isPrintingSupported(): boolean {
    return false;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getPendingJobs(): PrintJob[] {
    return [];
  }

  async cancelJob(_jobId: string): Promise<boolean> {
    return false;
  }
}

/**
 * Windows Receipt Builder - For future PDF generation or Windows printing
 */
class WindowsReceiptBuilder implements ReceiptBuilder {
  private lines: string[] = [];

  addHeader(businessName: string): this {
    this.lines.push(`================================`);
    this.lines.push(this.centerText(businessName));
    this.lines.push(`================================`);
    return this;
  }

  addLine(text: string, align: 'left' | 'center' | 'right' = 'left'): this {
    switch (align) {
      case 'center':
        this.lines.push(this.centerText(text));
        break;
      case 'right':
        this.lines.push(text.padStart(32));
        break;
      default:
        this.lines.push(text);
    }
    return this;
  }

  addDivider(): this {
    this.lines.push('--------------------------------');
    return this;
  }

  addBlankLine(): this {
    this.lines.push('');
    return this;
  }

  addItem(name: string, qty: number, price: number): this {
    const qtyStr = `x${qty}`;
    const priceStr = `${price.toFixed(2)} DH`;
    const spacing = 32 - name.length - qtyStr.length - priceStr.length;
    this.lines.push(`${name}${' '.repeat(Math.max(1, spacing))}${qtyStr} ${priceStr}`);
    return this;
  }

  addTotal(label: string, amount: number, bold: boolean = false): this {
    const amountStr = `${amount.toFixed(2)} DH`;
    const prefix = bold ? '>>> ' : '';
    const suffix = bold ? ' <<<' : '';
    const spacing = 32 - label.length - amountStr.length - prefix.length - suffix.length;
    this.lines.push(`${prefix}${label}${' '.repeat(Math.max(1, spacing))}${amountStr}${suffix}`);
    return this;
  }

  addQRCode(_data: string): this {
    this.lines.push('[QR Code not available on Windows]');
    return this;
  }

  addBarcode(_data: string): this {
    this.lines.push('[Barcode not available on Windows]');
    return this;
  }

  build(): string {
    return this.lines.join('\n');
  }

  private centerText(text: string): string {
    const padding = Math.max(0, Math.floor((32 - text.length) / 2));
    return ' '.repeat(padding) + text;
  }
}

// Export singleton instance
export const printService = new WindowsPrintService();
export const createReceiptBuilder = (): ReceiptBuilder => new WindowsReceiptBuilder();

export default printService;
