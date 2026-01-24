import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Supabase Configuration - uses .env file
const SUPABASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  'https://mdkwrvcttwwwqjdajwob.supabase.co';
  
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ka3dydmN0dHd3d3FqZGFqd29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMDI2MTAsImV4cCI6MjA4NDc3ODYxMH0.0Fc63oqFcI013i18ARzVAwgwL6GgLjRgNFmTVMqBOhI';

// Create Supabase client with AsyncStorage for persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types
export interface DbLicense {
  id: string;
  license_key: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  device_id: string | null;
  status: 'available' | 'active' | 'suspended' | 'revoked';
  plan: 'trial' | 'standard' | 'premium' | 'lifetime';
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDevice {
  id: string;
  device_id: string;
  device_name: string | null;
  device_model: string | null;
  app_version: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  license_id: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface DbLicenseLog {
  id: string;
  device_id: string | null;
  license_id: string | null;
  action: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
