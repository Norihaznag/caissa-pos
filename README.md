# CaissaPro - Modern POS System

<p align="center">
  <img src="assets/images/icon.png" alt="CaissaPro Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Système de caisse moderne et intuitif pour restaurants et cafés</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.1.2-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Android-green.svg" alt="Platform">
  <img src="https://img.shields.io/badge/React%20Native-0.81.5-61dafb.svg" alt="React Native">
  <img src="https://img.shields.io/badge/Expo-54-000020.svg" alt="Expo">
</p>

---

## 📱 Overview

**CaissaPro** is a complete, offline-first Point of Sale (POS) application designed specifically for restaurants, cafés, and retail businesses in Morocco. Built with React Native and Expo, it offers a seamless experience for managing orders, payments, inventory, and thermal printing.

### ✨ Key Features

- **📦 Offline-First Architecture** - Works without internet, syncs when connected
- **🖨️ Multi-Protocol Thermal Printing** - Bluetooth, USB, and WiFi printer support
- **💳 Payment Management** - Cash and card payments with change calculation
- **📊 Real-time Analytics** - Daily reports, sales statistics, and expense tracking
- **👥 Multi-User Support** - Admin and Cashier roles with permission management
- **🎨 Modern UI** - Beautiful, responsive interface optimized for tablets and phones
- **🌙 Dark/Light Mode** - Automatic theme switching based on system preference

---

## 🏗️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo SDK | 54 | Development toolchain |
| TypeScript | 5.8+ | Type-safe development |
| SQLite | expo-sqlite | Local offline database |
| NativeWind | 4.2 | Tailwind CSS for React Native |
| Kotlin | 2.1.20 | Native Android modules |
| Supabase | 2.90+ | Backend & cloud sync (optional) |

---

## 📋 Features in Detail

### 🛒 Order Management
- Quick product selection with categories
- Table/counter assignment
- Order notes and modifications
- Pending orders queue
- Order history with search

### 🖨️ Thermal Printing
- **Bluetooth ESC/POS** - Connect to any standard thermal printer
- **USB OTG** - Direct USB connection support
- **WiFi/Network** - TCP/IP printing over local network
- Auto-print receipts after payment
- Customizable receipt design
- Cash drawer support

### 💰 Payment Processing
- Cash payments with change calculation
- Card payment tracking
- Split payments support
- Daily cash reports

### 📊 Reports & Analytics
- Daily sales summary
- Revenue breakdown by payment method
- Expense tracking by category
- Export capabilities

### 👤 User Management
- Admin role (full access)
- Cashier role (limited permissions)
- Role-based feature visibility

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android development)
- JDK 17+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/caissapro.git
cd caissapro

# Install dependencies
npm install

# Start the development server
npm start
```

### Running on Android

```bash
# Development build
npx expo run:android

# Or create a release APK
cd android
./gradlew assembleRelease
```

The release APK will be available at:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 📁 Project Structure

```
caissapro/
├── android/                    # Native Android code
│   └── app/src/main/java/
│       └── com/caissapro/app/
│           └── printing/       # Native thermal printer module (Kotlin)
├── app/                        # Expo Router screens
│   ├── (tabs)/                 # Tab navigation
│   ├── cashier-simple.tsx      # Main POS screen
│   └── index.tsx               # Entry point
├── components/                 # Reusable UI components
│   ├── AdminPanel.tsx          # Settings & admin features
│   ├── UnifiedPrinterModal.tsx # Printer configuration
│   └── PrinterTestScreen.tsx   # Printer diagnostics
├── lib/                        # Business logic & services
│   ├── offline-db.ts           # SQLite database operations
│   ├── printing.ts             # Print utilities
│   ├── ThermalPrinterService.ts
│   ├── UnifiedPrinterService.ts
│   └── BluetoothPrinterService.ts
├── assets/                     # Images, fonts, icons
└── app.json                    # Expo configuration
```

---

## 🖨️ Printer Support

CaissaPro includes a custom native Kotlin module (`ThermalPrinterModule`) for reliable ESC/POS printing:

### Supported Printers
- Any ESC/POS compatible thermal printer
- 58mm and 80mm paper widths
- Bluetooth SPP printers
- USB OTG printers
- Network/WiFi printers (port 9100)

### Tested Models
- Generic 58mm/80mm Bluetooth printers
- Xprinter series
- EPSON TM series
- Star Micronics

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Receipt Customization

Access **Admin Panel > Receipt Design** to customize:
- Restaurant name & address
- Phone number
- Tax ID display
- Footer messages (French & Arabic)
- Paper width (58mm / 80mm)

---

## 📱 Screenshots

| Main POS | Orders | Admin Panel |
|----------|--------|-------------|
| Product grid with categories | Order history & print | Settings & reports |

---

## 🔐 Permissions

The app requires the following Android permissions:

| Permission | Purpose |
|------------|---------|
| BLUETOOTH | Connect to Bluetooth printers |
| BLUETOOTH_CONNECT | Android 12+ Bluetooth |
| BLUETOOTH_SCAN | Discover printers |
| ACCESS_FINE_LOCATION | Bluetooth scanning |
| CAMERA | Product photos |
| INTERNET | Cloud sync (optional) |

---

## 📦 Release History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.2 | Jan 2026 | Fixed auto-print, unified printer module |
| 2.1.1 | Jan 2026 | Facebook-style header, UI improvements |
| 2.1.0 | Jan 2026 | Native Kotlin printer module |
| 2.0.2 | Jan 2026 | Bug fixes, performance improvements |
| 2.0.0 | Dec 2025 | Initial release |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👨‍💻 Author

**Noureddine Azinag**

- GitHub: [@noureddineazinag](https://github.com/noureddineazinag)
- Expo: [@noureddineazinag](https://expo.dev/@noureddineazinag)

---

## 🙏 Acknowledgments

- [Expo](https://expo.dev/) - Amazing development platform
- [React Native](https://reactnative.dev/) - Cross-platform framework
- [NativeWind](https://www.nativewind.dev/) - Tailwind for React Native
- [Lucide Icons](https://lucide.dev/) - Beautiful icon set

---

<p align="center">
  Made with ❤️ in Morocco 🇲🇦
</p>
