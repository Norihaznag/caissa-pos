-- ============================================================================
-- MIGRATION: Add is_served column to orders table
-- Run this in your Supabase SQL Editor if you already have the database
-- ============================================================================

-- Add is_served column with default value false
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_served BOOLEAN DEFAULT false;

-- Update existing orders: Mark PAID orders as served (they were completed before this feature)
UPDATE orders SET is_served = true WHERE status = 'PAID';

-- Update existing orders: Mark CANCELLED orders as served (no need to track them)
UPDATE orders SET is_served = true WHERE status = 'CANCELLED';

-- Create new index for kitchen view
DROP INDEX IF EXISTS idx_orders_pending;
CREATE INDEX idx_orders_pending ON orders(created_at) WHERE is_served = false AND status != 'CANCELLED';

-- Verification: Check the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'is_served';
