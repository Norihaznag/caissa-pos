import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Debug: Log configuration (remove in production)
console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase Key exists:', !!SUPABASE_SERVICE_KEY);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase configuration! Check .env file.');
}

// Using service_role key to bypass RLS for admin operations
export const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

// Database types
export interface License {
  id: string;
  license_key: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  device_id: string | null;
  status: 'available' | 'active' | 'suspended' | 'revoked';
  plan: 'trial' | 'standard' | 'premium' | 'lifetime' | 'annual';
  activated_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Device {
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

export interface LicenseLog {
  id: string;
  device_id: string | null;
  license_id: string | null;
  action: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
