-- ============================================================================
-- POS MAROC - Migration: Shift Management System
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================================================

-- Shift templates (recurring weekly schedules)
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

-- Daily shifts (actual working days)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'absent', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, shift_date)
);

-- Add waiter_id to orders for accountability (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'orders' AND column_name = 'waiter_id') THEN
    ALTER TABLE orders ADD COLUMN waiter_id UUID REFERENCES users(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policies for shift_templates
DROP POLICY IF EXISTS "All users can view templates" ON shift_templates;
CREATE POLICY "All users can view templates" ON shift_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage templates" ON shift_templates;
CREATE POLICY "Admins can manage templates" ON shift_templates FOR ALL USING (true);

-- Policies for shifts
DROP POLICY IF EXISTS "All users can view shifts" ON shifts;
CREATE POLICY "All users can view shifts" ON shifts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage shifts" ON shifts;
CREATE POLICY "Admins can manage shifts" ON shifts FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shift_templates_user ON shift_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);

-- ============================================================================
-- Done! The shift management system is ready.
-- ============================================================================
