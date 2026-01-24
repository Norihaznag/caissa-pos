import { Stack } from 'expo-router';
import '@/global.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import LicenseGate from '@/components/LicenseGate';

// LICENSE SYSTEM CONFIGURATION:
// 1. Set up Supabase project and run lib/license/schema.sql
// 2. Update SUPABASE_URL and SUPABASE_ANON_KEY in lib/license/supabaseClient.ts
// 3. Set ENABLE_LICENSE = true below to activate the system

const ENABLE_LICENSE = true; // License system is now ACTIVE

export default function RootLayout() {
  const appContent = (
    <ErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );

  // License check enabled
  if (ENABLE_LICENSE) {
    return (
      <ErrorBoundary>
        <LicenseGate>
          {appContent}
        </LicenseGate>
      </ErrorBoundary>
    );
  }

  // License check disabled - app works freely
  return appContent;
}
