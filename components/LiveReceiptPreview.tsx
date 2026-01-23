/**
 * LiveReceiptPreview.tsx
 * Real-time receipt preview that updates as user edits design
 * v2.3 - CaissaPro
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface ReceiptDesign {
  restaurantName: string;
  address?: string;
  city?: string;
  phone?: string;
  taxId?: string;
  footerMessage?: string;
  footerMessageArabic?: string;
  
  // WiFi
  wifiPassword?: string;
  showWifi?: boolean;
  
  // Display options
  showLogo?: boolean;
  showOrderNumber?: boolean;
  showTableNumber?: boolean;
  showWaiterName?: boolean;
  showDateTime?: boolean;
  showPaymentDetails?: boolean;
  showSubtotal?: boolean;
  showTotal?: boolean;
  showFooter?: boolean;
  showTaxId?: boolean;
  
  // Formatting
  paperWidth?: 58 | 80;
  boldTotal?: boolean;
  separatorStyle?: 'dash' | 'equal' | 'dot';
  centerHeader?: boolean;
  autoCut?: boolean;
}

interface LiveReceiptPreviewProps {
  design: ReceiptDesign;
  compact?: boolean;
}

// Sample data for preview (constant - doesn't change)
const SAMPLE_ORDER = {
  orderNumber: 42,
  tableNumber: 5,
  waiterName: 'Ahmed',
  items: [
    { name: 'Café Crème', quantity: 2, price: 15, total: 30 },
    { name: 'Croissant Beurre', quantity: 1, price: 12, total: 12 },
    { name: 'Jus d\'Orange Frais', quantity: 1, price: 18, total: 18 },
  ],
  subtotal: 60,
  total: 60,
  paymentMethod: 'Espèces',
  amountReceived: 100,
  change: 40,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function LiveReceiptPreview({ design, compact = false }: LiveReceiptPreviewProps) {
  // Calculate character width based on paper width
  const charWidth = design.paperWidth === 58 ? 32 : 42;
  const paperPixelWidth = design.paperWidth === 58 ? 180 : 240;
  
  // Get separator character
  const separatorChar = useMemo(() => {
    switch (design.separatorStyle) {
      case 'equal': return '═';
      case 'dot': return '·';
      default: return '─';
    }
  }, [design.separatorStyle]);

  // Current date/time for display
  const currentDate = useMemo(() => {
    return new Date().toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);
  
  // Build receipt lines
  const receiptContent = useMemo(() => {
    const lines: { text: string; bold?: boolean; center?: boolean; large?: boolean }[] = [];
    
    // Helper to format line with left/right alignment
    const formatLine = (left: string, right: string): string => {
      const maxLeft = charWidth - right.length - 1;
      const truncatedLeft = left.length > maxLeft ? left.slice(0, maxLeft - 2) + '..' : left;
      const padding = charWidth - truncatedLeft.length - right.length;
      return truncatedLeft + ' '.repeat(Math.max(1, padding)) + right;
    };
    
    // Header
    lines.push({ 
      text: design.restaurantName || 'Nom du Restaurant', 
      bold: true, 
      center: design.centerHeader,
      large: true,
    });
    
    if (design.address) {
      lines.push({ text: design.address, center: design.centerHeader });
    }
    if (design.city) {
      lines.push({ text: design.city, center: design.centerHeader });
    }
    if (design.phone) {
      lines.push({ text: `Tél: ${design.phone}`, center: design.centerHeader });
    }
    if (design.showTaxId && design.taxId) {
      lines.push({ text: `ICE: ${design.taxId}`, center: design.centerHeader });
    }
    
    lines.push({ text: '' });
    lines.push({ text: separatorChar.repeat(charWidth) });
    
    // Order info
    if (design.showOrderNumber !== false) {
      lines.push({ text: `Commande N°: ${SAMPLE_ORDER.orderNumber}` });
    }
    if (design.showTableNumber !== false) {
      lines.push({ text: `Table: ${SAMPLE_ORDER.tableNumber}` });
    }
    if (design.showWaiterName !== false) {
      lines.push({ text: `Serveur: ${SAMPLE_ORDER.waiterName}` });
    }
    if (design.showDateTime !== false) {
      lines.push({ text: `Date: ${currentDate}` });
    }
    
    lines.push({ text: separatorChar.repeat(charWidth) });
    lines.push({ text: '' });
    
    // Items
    for (const item of SAMPLE_ORDER.items) {
      lines.push({ text: formatLine(`${item.quantity}x ${item.name}`, `${item.total.toFixed(2)}`) });
    }
    
    lines.push({ text: '' });
    lines.push({ text: separatorChar.repeat(charWidth) });
    
    // Totals
    if (design.showSubtotal !== false) {
      lines.push({ text: formatLine('Sous-total:', `${SAMPLE_ORDER.subtotal.toFixed(2)} DH`) });
    }
    
    if (design.showTotal !== false) {
      lines.push({ 
        text: formatLine('TOTAL:', `${SAMPLE_ORDER.total.toFixed(2)} DH`), 
        bold: design.boldTotal,
        large: design.boldTotal,
      });
    }
    
    lines.push({ text: separatorChar.repeat(charWidth) });
    
    // Payment details
    if (design.showPaymentDetails !== false) {
      lines.push({ text: formatLine('Mode:', SAMPLE_ORDER.paymentMethod) });
      lines.push({ text: formatLine('Reçu:', `${SAMPLE_ORDER.amountReceived.toFixed(2)} DH`) });
      lines.push({ text: formatLine('Monnaie:', `${SAMPLE_ORDER.change.toFixed(2)} DH`) });
    }
    
    lines.push({ text: '' });
    
    // Footer
    if (design.showFooter !== false && design.footerMessage) {
      lines.push({ text: design.footerMessage, center: true });
    }
    if (design.footerMessageArabic) {
      lines.push({ text: design.footerMessageArabic, center: true });
    }
    
    // WiFi Password
    if (design.showWifi && design.wifiPassword) {
      lines.push({ text: '' });
      lines.push({ text: `📶 WiFi: ${design.wifiPassword}`, center: true, bold: true });
    }
    
    // Auto cut indicator
    if (design.autoCut) {
      lines.push({ text: '' });
      lines.push({ text: '✂' + '─'.repeat(charWidth - 1), center: false });
    }
    
    return lines;
  }, [design, charWidth, separatorChar, currentDate]);
  
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          📄 Aperçu en direct • {design.paperWidth || 80}mm
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.paper, { width: paperPixelWidth }]}>
          {receiptContent.map((line, index) => (
            <Text
              key={index}
              style={[
                styles.receiptLine,
                line.bold && styles.bold,
                line.center && styles.center,
                line.large && styles.large,
              ]}
            >
              {line.text}
            </Text>
          ))}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Cet aperçu montre comment votre ticket sera imprimé
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  containerCompact: {
    maxHeight: 300,
  },
  header: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    maxHeight: 400,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  paper: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptLine: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 13,
    color: '#000',
  },
  bold: {
    fontWeight: '700',
  },
  center: {
    textAlign: 'center',
  },
  large: {
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    backgroundColor: '#FAFAFA',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
});

export default LiveReceiptPreview;
