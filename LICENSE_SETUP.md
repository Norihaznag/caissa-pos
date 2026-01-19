# 🔐 CaissaPro License System Setup

## Status: DISABLED (App works without license)

When you're ready to enable licensing, follow these steps:

---

## Step 1: Update Gumroad Product ID

Open `lib/license.ts` and update line 7:

```typescript
// Change this:
const GUMROAD_PRODUCT_ID = 'YOUR_PRODUCT_ID_HERE';

// To your actual Gumroad product ID:
const GUMROAD_PRODUCT_ID = 'okmrtp';  // Your product ID from Gumroad
```

---

## Step 2: Update Contact Info

Open `components/LicenseActivation.tsx` and update:

**Line ~83 - Gumroad URL:**
```typescript
Linking.openURL('https://nordinaznag.gumroad.com/l/okmrtp');
```

**Line ~88 - WhatsApp number:**
```typescript
Linking.openURL('https://wa.me/212XXXXXXXXX?text=Bonjour, je souhaite acheter une licence CaissaPro');
```

---

## Step 3: Enable License Check

Open `app/_layout.tsx` and replace the content with:

```tsx
import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import '@/global.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LicenseActivation from '@/components/LicenseActivation';
import { validateLicense, LicenseData } from '@/lib/license';
import { useAppStore } from '@/lib/store';

export default function RootLayout() {
  const [checkingLicense, setCheckingLicense] = useState(true);
  const { isLicensed, setLicense } = useAppStore();

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    try {
      const result = await validateLicense();
      if (result.valid && result.data) {
        setLicense(result.data);
      }
    } catch (error) {
      console.error('License check error:', error);
    }
    setCheckingLicense(false);
  };

  const handleLicenseActivated = (license: LicenseData) => {
    setLicense(license);
  };

  // Show license activation screen if not licensed
  if (!checkingLicense && !isLicensed) {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <SafeAreaProvider>
            <LicenseActivation onActivated={handleLicenseActivated} />
          </SafeAreaProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

---

## Step 4: Build and Test

1. Build your APK: `eas build --platform android --profile preview`
2. Install on device
3. Get a test license from Gumroad (set price to $0 temporarily)
4. Test activation
5. Set real price and publish!

---

## Gumroad Setup (If Not Done)

### Your Gumroad Info:
- **Product URL:** `nordinaznag.gumroad.com/l/okmrtp`
- **Product ID:** `okmrtp`

### Enable License Keys on Gumroad:
1. Go to your product → **Content** tab
2. Enable **"Generate a unique license key"**
3. Save changes

---

## Files Created for Licensing:

| File | Purpose |
|------|---------|
| `lib/license.ts` | License validation logic |
| `components/LicenseActivation.tsx` | Activation UI screen |
| `lib/store.ts` | Added license state |

---

## Pricing Suggestions for Morocco:

| Plan | Price USD | Price MAD |
|------|-----------|-----------|
| Starter | $20 | ~200 DH |
| Pro | $50 | ~500 DH |
| Enterprise | $100 | ~1000 DH |

---

## Need Help?

When ready to enable licensing, just ask!
