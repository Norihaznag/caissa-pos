import { Stack } from 'expo-router';
import '@/global.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// LICENSE SYSTEM - TEMPORARILY DISABLED
// To enable licensing, uncomment the code below and follow LICENSE_SETUP.md
// import React, { useState, useEffect } from 'react';
// import LicenseActivation from '@/components/LicenseActivation';
// import { validateLicense, LicenseData } from '@/lib/license';
// import { useAppStore } from '@/lib/store';

export default function RootLayout() {
  // LICENSE CHECK DISABLED - App works without license for now
  // When ready to enable licensing:
  // 1. Update GUMROAD_PRODUCT_ID in lib/license.ts
  // 2. Uncomment the license code below
  // 3. See LICENSE_SETUP.md for full instructions

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
