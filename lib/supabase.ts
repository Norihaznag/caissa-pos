import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
// TODO: Replace with your actual Supabase URL and anon key
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

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
  role: 'admin' | 'waiter' | 'kitchen';
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
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  created_at: string;
}
