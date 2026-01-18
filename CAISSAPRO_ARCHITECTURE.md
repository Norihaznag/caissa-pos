# CaissaPro - Complete POS System Architecture Guide

## 🎯 Project Overview

**CaissaPro** is a fully offline-first Point of Sale (POS) application built for restaurants, cafes, and retail businesses in Morocco. It runs on Android tablets and phones, designed for environments with unreliable internet connectivity.

### Core Concept
- **100% Offline-First**: All operations work without internet using SQLite local database
- **Thermal Receipt Printing**: Native ESC/POS printing via Bluetooth, USB, or WiFi
- **Role-Based Access**: Admin, Cashier, and Waiter roles with different permissions
- **Moroccan Market**: Currency in DH (Dirhams), French language UI, Arabic support

---

## 🏗️ Technology Stack

### Frontend Framework
```
React Native 0.81.5 (New Architecture enabled)
Expo SDK 54
TypeScript 5.9.3
```

### Styling
```
NativeWind 4.2.1 (TailwindCSS for React Native)
TailwindCSS 3.4.18
tailwind-variants for component styling
```

### Navigation
```
expo-router 6.0.21 (file-based routing)
@react-navigation/native 7.x
```

### State Management
```
Zustand 5.0.10 (global state)
React useState/useEffect (local state)
AsyncStorage (persistent settings)
```

### Database
```
expo-sqlite 16.0.10 (SQLite for offline data)
@supabase/supabase-js 2.90.1 (optional cloud sync)
```

### Native Modules
```
Custom ThermalPrinterModule (Kotlin)
- Bluetooth SPP printing
- USB printer support
- WiFi/Network printing
- ESC/POS command generation
```

### UI Libraries
```
lucide-react-native (icons)
react-native-gifted-charts (analytics charts)
expo-linear-gradient (gradients)
expo-haptics (touch feedback)
react-native-reanimated (animations)
```

---

## 📁 Project Structure

```
poss/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout with providers
│   ├── index.tsx                 # Login/PIN screen
│   ├── cashier-simple.tsx        # Main POS interface (4400+ lines)
│   ├── printer-settings.tsx      # Printer configuration
│   └── printer-test.tsx          # Printer testing screen
│
├── components/
│   ├── AdminPanel.tsx            # Full admin panel (2400+ lines)
│   ├── UnifiedPrinterModal.tsx   # Printer device selection
│   ├── BluetoothPrinterModal.tsx # Legacy BT modal
│   ├── PrinterTestScreen.tsx     # Print test component
│   ├── ThemeProvider.tsx         # Theme context
│   └── ui/                       # Reusable UI components
│
├── lib/
│   ├── offline-db.ts             # SQLite database & services (1500+ lines)
│   ├── store.ts                  # Zustand global state
│   ├── permissions.ts            # Role-based permissions
│   ├── printing.ts               # Print utilities & receipt design
│   ├── theme.ts                  # Design tokens
│   ├── sounds.ts                 # Audio feedback
│   ├── schema.sql                # Database schema
│   └── services/
│       └── PrinterService.ts     # Unified printer service (600 lines)
│
├── android/
│   └── app/src/main/java/com/caissapro/app/
│       ├── MainActivity.kt
│       ├── MainApplication.kt
│       └── printing/
│           ├── ThermalPrinterModule.kt   # Native ESC/POS module (970 lines)
│           └── ThermalPrinterPackage.kt  # React Native package
│
└── assets/                       # Images, fonts, sounds
```

---

## 🗄️ Database Schema (SQLite)

### Tables

```sql
-- Categories for product organization
categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER,
  created_at TEXT,
  synced INTEGER
)

-- Products with stock tracking
products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category_id TEXT,
  is_active INTEGER,
  image_url TEXT,
  stock_quantity INTEGER,
  low_stock_threshold INTEGER,
  created_at TEXT,
  synced INTEGER
)

-- Orders with full payment tracking
orders (
  id TEXT PRIMARY KEY,
  order_number INTEGER,
  table_number INTEGER,
  customer_name TEXT,
  status TEXT,  -- NEW, PREPARING, READY, PAID, CANCELLED
  total_amount REAL,
  payment_method TEXT,  -- cash, card
  discount REAL,
  amount_received REAL,
  change_amount REAL,
  created_at TEXT,
  paid_at TEXT,
  printed INTEGER,
  synced INTEGER
)

-- Order line items
order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  product_id TEXT,
  product_name TEXT,
  price REAL,
  quantity INTEGER,
  note TEXT
)

-- Users with PIN authentication
users (
  id TEXT PRIMARY KEY,
  name TEXT,
  pin TEXT,  -- Hashed with SHA-256
  role TEXT,  -- admin, cashier, waiter
  is_active INTEGER
)

-- Settings key-value store
settings (
  key TEXT PRIMARY KEY,
  value TEXT
)

-- Expenses tracking
expenses (
  id TEXT PRIMARY KEY,
  amount REAL,
  category TEXT,
  description TEXT,
  created_at TEXT
)

-- Work shifts
shifts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  opened_at TEXT,
  closed_at TEXT,
  opening_amount REAL,
  closing_amount REAL,
  total_sales REAL,
  status TEXT
)
```

---

## 🖨️ Printing Architecture

### Print Flow
```
User Action (Print Receipt)
    ↓
cashier-simple.tsx: handlePrintReceipt()
    ↓
lib/services/PrinterService.ts: printReceipt(receiptData)
    ↓
React Native Bridge
    ↓
ThermalPrinterModule.kt: printReceipt(ReadableMap)
    ↓
buildReceiptCommands() → ByteArray (ESC/POS)
    ↓
writeBytes() → Bluetooth/USB/WiFi OutputStream
    ↓
Physical Printer
```

### ESC/POS Commands Used
```kotlin
ESC @ (0x1B 0x40)     - Initialize printer
ESC a n               - Text alignment (0=left, 1=center, 2=right)
GS ! n                - Text size (0x11=double, 0x00=normal)
ESC E n               - Bold on/off
ESC d n               - Feed n lines
GS V n                - Cut paper
ESC p m t1 t2         - Open cash drawer
```

### Receipt Data Structure
```typescript
interface ReceiptData {
  // Header
  restaurantName: string;
  address?: string;
  phone?: string;
  
  // Order Info
  orderId: string;
  orderNumber?: number;
  tableNumber?: number;
  waiterName?: string;
  date: string;
  
  // Items
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  
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
  
  // Display Options
  showOrderNumber?: boolean;
  showTableNumber?: boolean;
  showDateTime?: boolean;
  paperWidth?: 58 | 80;
  autoCut?: boolean;
}
```

### Receipt Design Settings (Stored in AsyncStorage)
```typescript
interface ReceiptDesign {
  restaurantName: string;
  address: string;
  phone: string;
  taxId: string;  // ICE/IF
  footerMessage: string;
  paperWidth: 58 | 80;
  showOrderNumber: boolean;
  showTableNumber: boolean;
  showWaiterName: boolean;
  showDateTime: boolean;
  showPaymentDetails: boolean;
  showSubtotal: boolean;
  showFooter: boolean;
  boldTotal: boolean;
  separatorStyle: 'dash' | 'equal' | 'dot';
  centerHeader: boolean;
  autoCut: boolean;
}
```

---

## 🔐 Role-Based Permissions

### Roles
| Role | Description |
|------|-------------|
| `admin` | Full access to settings, products, users, reports |
| `cashier` | Sales operations, can apply discounts, print receipts |
| `waiter` | Create orders, view assigned tables |

### Permission Matrix
```typescript
admin: [
  'access_admin_panel',
  'manage_products',
  'manage_categories', 
  'manage_users',
  'manage_expenses',
  'configure_printer',
  'configure_receipt_design',
  'view_analytics',
  'print_daily_report',
  'view_all_orders',
]

cashier: [
  'create_order',
  'cancel_order',
  'apply_discount',
  'void_item',
  'view_daily_report',
  'view_stock',
]

waiter: [
  'create_order',
  'view_assigned_orders',
]
```

---

## 📱 Main UI Screens

### 1. Login Screen (`app/index.tsx`)
- PIN pad entry (4-6 digits)
- User selection dropdown
- SHA-256 PIN hashing for security

### 2. Cashier POS Screen (`app/cashier-simple.tsx`)
**Layout (Landscape Tablet):**
```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] CaissaPro           [Orders] [Stats] [Admin] [Logout]│
├─────────────────────────────────────────────────────────────┤
│ [All] [Café] [Pâtisserie] [Boissons] ...    │   CART        │
├─────────────────────────────────────────────────────────────│
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │ Cappuccino x2 │
│ │Prod1│ │Prod2│ │Prod3│ │Prod4│             │ 30.00 DH      │
│ │15 DH│ │20 DH│ │25 DH│ │18 DH│             │───────────────│
│ └─────┘ └─────┘ └─────┘ └─────┘             │ Cheesecake x1 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │ 35.00 DH      │
│ │Prod5│ │Prod6│ │Prod7│ │Prod8│             │               │
│ │...  │ │...  │ │...  │ │...  │             │───────────────│
│ └─────┘ └─────┘ └─────┘ └─────┘             │ TOTAL: 65 DH  │
│                                              │[💵Cash][💳Card]│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Product grid with categories
- Real-time cart management
- Table assignment (1-10)
- Quick payment (Cash/Card)
- Auto-print after payment
- Pending orders management
- Daily statistics
- Stock alerts

### 3. Admin Panel (`components/AdminPanel.tsx`)
**Tabs:**
- **Categories**: Create, edit, reorder categories
- **Products**: Full product CRUD with images and stock
- **Users**: Manage staff with PIN codes
- **Settings**: Restaurant info, receipt design, printer config
- **Reports**: Daily sales, expenses, analytics charts

---

## ⚡ Key Features Implementation

### Auto-Print After Payment
```typescript
// In cashier-simple.tsx handlePayment()
const autoPrintEnabled = await offlineSettingsService.get('auto_print_receipt');
const printerConnected = await PrinterService.checkConnection();

if (autoPrintEnabled === 'true' && printerConnected) {
  await handlePrintReceipt(newOrder);
}
```

### Stock Management
```typescript
// Deduct stock on sale
await offlineProductService.adjustStock(productId, -quantity);

// Low stock alerts
const lowStock = products.filter(p => 
  p.stockQuantity !== undefined && 
  p.stockQuantity <= (p.lowStockThreshold || 5)
);
```

### Offline Order Sync Queue
```typescript
// Orders are marked synced=0 when created offline
// Background job can sync when internet available
const unsyncedOrders = await getUnsyncedOrders();
for (const order of unsyncedOrders) {
  await supabase.from('orders').insert(order);
  await markOrderSynced(order.id);
}
```

---

## 🔧 Configuration Files

### `app.json` - Expo Config
```json
{
  "expo": {
    "name": "CaissaPro",
    "slug": "caissapro",
    "version": "2.1.0",
    "android": {
      "package": "com.caissapro.app",
      "permissions": [
        "BLUETOOTH",
        "BLUETOOTH_ADMIN",
        "BLUETOOTH_CONNECT",
        "BLUETOOTH_SCAN"
      ]
    }
  }
}
```

### Environment Variables (`.env`)
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

---

## 🚀 Build Commands

```bash
# Development
npx expo start

# Android APK (release)
cd android && ./gradlew assembleRelease

# Output location
android/app/build/outputs/apk/release/app-release.apk
```

---

## 🐛 Common Issues & Solutions

### 1. Printer Only Prints "CaissaPro"
**Cause**: ESC/POS string commands get corrupted when converted to UTF-8
**Solution**: Use native byte array commands in `ThermalPrinterModule.kt`

### 2. Receipt Printed Twice
**Cause**: Duplicate print calls or double-encoded commands
**Solution**: Add logging, ensure single print path

### 3. Wrong Shop Name on Receipt
**Cause**: Old saved settings in AsyncStorage
**Solution**: Load from `loadReceiptDesign()` and verify saved values

### 4. Bluetooth Connection Fails
**Cause**: Missing runtime permissions on Android 12+
**Solution**: Request `BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN`

---

## 📋 Key Files Summary

| File | Purpose | Lines |
|------|---------|-------|
| `app/cashier-simple.tsx` | Main POS UI | ~4400 |
| `components/AdminPanel.tsx` | Admin interface | ~2400 |
| `lib/offline-db.ts` | SQLite database layer | ~1500 |
| `lib/printing.ts` | Print utilities | ~1200 |
| `lib/services/PrinterService.ts` | Unified print service | ~600 |
| `ThermalPrinterModule.kt` | Native ESC/POS | ~970 |

---

## 🎨 Design Tokens (lib/theme.ts)

```typescript
colors = {
  primary: '#2563EB',      // Blue
  success: '#22C55E',      // Green
  warning: '#F59E0B',      // Orange
  error: '#EF4444',        // Red
  background: '#F3F4F6',   // Light gray
  white: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
}

spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32
}

borderRadius = {
  sm: 6, md: 10, lg: 14, xl: 18
}
```

---

## 🔄 State Flow

```
┌─────────────────┐
│   Zustand       │ ← Global auth state (user, logout)
│   useAppStore   │
└────────┬────────┘
         │
┌────────▼────────┐
│  AsyncStorage   │ ← Settings, printer config, receipt design
└────────┬────────┘
         │
┌────────▼────────┐
│    SQLite       │ ← Products, orders, categories, users
│  expo-sqlite    │
└─────────────────┘
```

---

## 📝 Notes for AI Assistants

1. **Main entry point** is `app/cashier-simple.tsx` - the massive cashier screen
2. **All printing** should go through `lib/services/PrinterService.ts`
3. **Native module** is in `android/app/src/main/java/com/caissapro/app/printing/`
4. **Receipt design** stored in AsyncStorage with key `pos_receipt_design`
5. **Database** is `caissapro_offline.db` accessed via `expo-sqlite`
6. **Build APK** with `cd android && ./gradlew assembleRelease`
7. **Permissions** system in `lib/permissions.ts` controls UI access
8. **Theme** is custom (not TailwindCSS classes directly in components)

---

*Last updated: January 2026 | CaissaPro v2.1.x*
