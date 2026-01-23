/**
 * ReceiptPreview Component
 * 
 * Displays a preview of how the receipt will look when printed.
 * Uses the same formatting logic as the native module for consistency.
 * 
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { X, Printer } from 'lucide-react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface ReceiptDesign {
  // Shop Identity
  restaurantName: string;
  address?: string;
  phone?: string;
  taxId?: string;
  
  // Footer
  footerMessage?: string;
  
  // WiFi
  wifiPassword?: string;
  showWifi?: boolean;
  
  // Toggle options
  showOrderNumber?: boolean;
  showTableNumber?: boolean;
  showWaiterName?: boolean;
  showDateTime?: boolean;
  showPaymentDetails?: boolean;
  showSubtotal?: boolean;
  showTotal?: boolean;
  showFooter?: boolean;
  
  // Formatting
  paperWidth?: 58 | 80;
  boldTotal?: boolean;
  separatorStyle?: 'dash' | 'equal' | 'dot';
  centerHeader?: boolean;
}

export interface ReceiptPreviewData {
  // Order info
  orderId: string;
  orderNumber?: number | string;
  tableNumber?: number;
  waiterName?: string;
  date: string;
  
  // Items
  items: ReceiptItem[];
  
  // Totals
  subtotal: number;
  discount?: number;
  total: number;
  
  // Payment
  paymentMethod?: string;
  amountReceived?: number;
  change?: number;
}

interface ReceiptPreviewProps {
  visible: boolean;
  onClose: () => void;
  onPrint?: () => void;
  order: ReceiptPreviewData;
  design: ReceiptDesign;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReceiptPreview({ visible, onClose, onPrint, order, design }: ReceiptPreviewProps) {
  // Calculate character width based on paper width
  const charWidth = design.paperWidth === 58 ? 32 : 48;
  
  // Get separator character
  const separatorChar = useMemo(() => {
    switch (design.separatorStyle) {
      case 'equal': return '=';
      case 'dot': return '.';
      default: return '-';
    }
  }, [design.separatorStyle]);
  
  // Build receipt text
  const receiptText = useMemo(() => {
    const lines: string[] = [];
    
    // Format a line with left and right alignment
    const formatLine = (left: string, right: string): string => {
      const maxLeft = charWidth - right.length - 1;
      const truncatedLeft = left.length > maxLeft ? left.slice(0, maxLeft - 2) + '..' : left;
      const padding = charWidth - truncatedLeft.length - right.length;
      return truncatedLeft + ' '.repeat(Math.max(1, padding)) + right;
    };
    
    // Header
    if (design.centerHeader) {
      const headerPadding = Math.floor((charWidth - design.restaurantName.length) / 2);
      lines.push(' '.repeat(Math.max(0, headerPadding)) + design.restaurantName);
    } else {
      lines.push(design.restaurantName);
    }
    
    if (design.address) {
      if (design.centerHeader) {
        const padding = Math.floor((charWidth - design.address.length) / 2);
        lines.push(' '.repeat(Math.max(0, padding)) + design.address);
      } else {
        lines.push(design.address);
      }
    }
    
    if (design.phone) {
      const phoneText = `Tél: ${design.phone}`;
      if (design.centerHeader) {
        const padding = Math.floor((charWidth - phoneText.length) / 2);
        lines.push(' '.repeat(Math.max(0, padding)) + phoneText);
      } else {
        lines.push(phoneText);
      }
    }
    
    lines.push('');
    lines.push(separatorChar.repeat(charWidth));
    
    // Order info
    if (design.showOrderNumber !== false && order.orderNumber) {
      lines.push(`N° Commande: ${order.orderNumber}`);
    }
    
    if (design.showTableNumber !== false && order.tableNumber && order.tableNumber > 0) {
      lines.push(`Table: ${order.tableNumber}`);
    }
    
    if (design.showWaiterName !== false && order.waiterName) {
      lines.push(`Serveur: ${order.waiterName}`);
    }
    
    if (design.showDateTime !== false && order.date) {
      lines.push(`Date: ${order.date}`);
    }
    
    lines.push(separatorChar.repeat(charWidth));
    
    // Items
    for (const item of order.items) {
      const qtyPrefix = `${item.quantity}x `;
      const priceStr = item.total.toFixed(2);
      const maxNameLen = charWidth - qtyPrefix.length - priceStr.length - 1;
      const truncName = item.name.length > maxNameLen 
        ? item.name.slice(0, maxNameLen - 2) + '..' 
        : item.name;
      lines.push(formatLine(`${qtyPrefix}${truncName}`, priceStr));
      
      // Item note (if any)
      if (item.note && item.note.trim()) {
        const noteText = `   ⤷ ${item.note.trim()}`;
        if (noteText.length > charWidth) {
          lines.push(noteText.slice(0, charWidth - 2) + '..');
        } else {
          lines.push(noteText);
        }
      }
    }
    
    lines.push(separatorChar.repeat(charWidth));
    
    // Totals
    if (design.showSubtotal !== false && order.subtotal > 0) {
      lines.push(formatLine('Sous-total:', `${order.subtotal.toFixed(2)} DH`));
    }
    
    if (order.discount && order.discount > 0) {
      lines.push(formatLine('Remise:', `-${order.discount.toFixed(2)} DH`));
    }
    
    // Total (emphasized)
    lines.push(formatLine('TOTAL:', `${order.total.toFixed(2)} DH`));
    
    lines.push(separatorChar.repeat(charWidth));
    
    // Payment details
    if (design.showPaymentDetails !== false) {
      if (order.paymentMethod) {
        lines.push(formatLine('Paiement:', order.paymentMethod));
      }
      
      if (order.amountReceived && order.amountReceived > 0 && 
          order.paymentMethod?.toLowerCase().includes('espèces')) {
        lines.push(formatLine('Reçu:', `${order.amountReceived.toFixed(2)} DH`));
        if (order.change && order.change > 0) {
          lines.push(formatLine('Monnaie:', `${order.change.toFixed(2)} DH`));
        }
      }
    }
    
    lines.push('');
    
    // Footer
    if (design.showFooter !== false && design.footerMessage) {
      if (design.centerHeader) {
        const padding = Math.floor((charWidth - design.footerMessage.length) / 2);
        lines.push(' '.repeat(Math.max(0, padding)) + design.footerMessage);
      } else {
        lines.push(design.footerMessage);
      }
    }
    
    // WiFi Password
    if (design.showWifi && design.wifiPassword) {
      lines.push('');
      const wifiLine = `WiFi: ${design.wifiPassword}`;
      if (design.centerHeader) {
        const padding = Math.floor((charWidth - wifiLine.length) / 2);
        lines.push(' '.repeat(Math.max(0, padding)) + wifiLine);
      } else {
        lines.push(wifiLine);
      }
    }
    
    return lines.join('\n');
  }, [order, design, charWidth, separatorChar]);
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Aperçu du ticket</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Paper info */}
          <View style={styles.paperInfo}>
            <Text style={styles.paperInfoText}>
              Papier: {design.paperWidth || 80}mm • {charWidth} caractères/ligne
            </Text>
          </View>
          
          {/* Receipt paper */}
          <ScrollView style={styles.receiptScroll}>
            <View style={[
              styles.receiptPaper,
              { width: design.paperWidth === 58 ? 220 : 300 }
            ]}>
              <Text style={styles.receiptText}>{receiptText}</Text>
            </View>
          </ScrollView>
          
          {/* Print button */}
          {onPrint && (
            <TouchableOpacity style={styles.printButton} onPress={onPrint}>
              <Printer size={20} color="#fff" />
              <Text style={styles.printButtonText}>Imprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  paperInfo: {
    padding: 8,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
  },
  paperInfoText: {
    fontSize: 12,
    color: '#1565c0',
  },
  receiptScroll: {
    flex: 1,
    padding: 16,
  },
  receiptPaper: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 4,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    color: '#000',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196f3',
    padding: 16,
    gap: 8,
  },
  printButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReceiptPreview;
