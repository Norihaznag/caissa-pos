import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration - loaded from .env or fallback to hardcoded values for production
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vdmiehvldsivrjwnxdly.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbWllaHZsZHNpdnJqd254ZGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzYzNjYsImV4cCI6MjA4Mzg1MjM2Nn0.kp8CbdK5gjQ0bn_bzZoV867QIg6BROGhv0duN6MfzbU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database Types
export interface DbUser {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'waiter' | 'kitchen' | 'cashier';
  is_active: boolean;
  created_at: string;
}

export interface DbCategory {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface DbProduct {
  id: string;
  name: string;
  price: number;
  category_id: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
}

export interface DbTable {
  id: string;
  number: number;
  status: 'open' | 'occupied';
  current_order_id: string | null;
  created_at: string;
}

export interface DbOrder {
  id: string;
  table_id: string;
  waiter_id: string | null;
  status: 'NEW' | 'PREPARING' | 'READY' | 'PAID' | 'CANCELLED';
  is_served: boolean;
  total_amount: number;
  created_at: string;
  updated_at: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  payment_method?: 'cash' | 'card';
  discount?: number;
  discount_type?: 'percent' | 'amount';
  amount_received?: number;
  change_amount?: number;
  paid_at?: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  note?: string;
  created_at: string;
}
