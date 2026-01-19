# CaissaPro Windows Desktop

Windows desktop version of CaissaPro POS system built with React Native Windows.

## Prerequisites

1. **Windows 10/11** (64-bit)
2. **Visual Studio 2022** with:
   - Desktop development with C++
   - Universal Windows Platform development
   - Windows 10 SDK (10.0.19041.0 or later)
3. **Node.js 18+** and npm
4. **Windows Developer Mode** enabled:
   - Settings > Update & Security > For developers > Developer Mode

## Setup Instructions

### 1. Install Dependencies

```powershell
cd windows-app
npm install
```

### 2. Initialize React Native Windows

```powershell
npx react-native-windows-init --overwrite
```

This creates the `windows/` folder with the native Windows project.

### 3. Link Native Modules

React Native Windows auto-links most modules, but verify:

```powershell
npx react-native autolink-windows
```

### 4. Build and Run (Debug)

```powershell
npx react-native run-windows
```

Or with architecture specified:

```powershell
npx react-native run-windows --arch x64
```

## Build Release Version

### Build Release APK (Signed)

```powershell
npx react-native run-windows --release --arch x64
```

### Build MSIX Package for Distribution

```powershell
npx react-native run-windows --release --arch x64 --bundle
```

The output will be in:
`windows-app\windows\CaissaProWindows\AppPackages\`

## Project Structure

```
windows-app/
├── src/
│   ├── App.tsx                 # App entry point
│   ├── navigation/
│   │   ├── RootNavigator.tsx   # Navigation setup
│   │   └── types.ts            # Navigation types
│   └── screens/
│       ├── LoginScreen.tsx     # PIN login screen
│       └── CashierScreen.tsx   # Main POS screen
├── windows/                    # Native Windows project (generated)
├── index.js                    # RN entry point
├── app.json                    # App config
├── package.json                # Dependencies
├── metro.config.js             # Metro bundler config
├── babel.config.js             # Babel config
└── tsconfig.json               # TypeScript config
```

## Shared Code

This app shares business logic with the mobile Expo app via the `../shared/` directory:

- `shared/database/` - SQLite database abstraction
- `shared/printing/` - Printing service abstraction
- `shared/storage/` - AsyncStorage abstraction

## Features

### Available on Windows
- ✅ PIN-based login
- ✅ Product browsing and search
- ✅ Cart management
- ✅ Order processing (cash/card)
- ✅ Offline-first SQLite database
- ✅ Order history

### Not Available on Windows
- ❌ Bluetooth thermal printing (mobile only)
- ❌ Cash drawer (mobile only)

## Troubleshooting

### "Developer Mode is not enabled"
Enable Developer Mode in Windows Settings:
Settings → Update & Security → For developers → Developer Mode

### "Unable to find vcvarsall.bat"
Install Visual Studio 2022 with "Desktop development with C++" workload.

### "MSBuild.exe not found"
Add MSBuild to PATH or run from Developer Command Prompt.

### "The SDK 'Microsoft.NET.Sdk' specified could not be found"
Install .NET 6.0 SDK or later.

### Metro Bundler Issues
```powershell
# Clear cache
npx react-native start --reset-cache

# Or manually clear
rmdir /s /q node_modules\.cache
```

## Version

- CaissaPro: 2.3.0
- React Native Windows: 0.76.10
- Platform: Windows Desktop (UWP)
