-- ============================================================================
-- POS MAROC - Migration v2: Add Missing Features
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to add missing columns
-- ============================================================================

-- Add cashier role to users (if not already added)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'waiter', 'kitchen', 'cashier'));

-- Add image_url to products (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE products ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add payment fields to orders (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method VARCHAR(10) CHECK (payment_method IN ('cash', 'card'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'discount'
  ) THEN
    ALTER TABLE orders ADD COLUMN discount DECIMAL(10, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'discount_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN discount_type VARCHAR(10) CHECK (discount_type IN ('percent', 'amount'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'amount_received'
  ) THEN
    ALTER TABLE orders ADD COLUMN amount_received DECIMAL(10, 2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'change_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN change_amount DECIMAL(10, 2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add note to order_items (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'note'
  ) THEN
    ALTER TABLE order_items ADD COLUMN note TEXT;
  END IF;
END $$;

-- Add cashier user if not exists
INSERT INTO users (name, pin, role, is_active)
VALUES ('Caissier', '4444', 'cashier', true)
ON CONFLICT (pin) DO NOTHING;

-- ============================================================================
-- Storage Bucket for Product Images
-- ============================================================================
-- Run this in Supabase Dashboard > Storage > Create new bucket:
-- Bucket name: product-images
-- Public bucket: YES
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
-- Max file size: 5MB

