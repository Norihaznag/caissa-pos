-- =============================================
-- CaissaPro License System - Supabase Schema
-- =============================================
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- LICENSES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_key VARCHAR(25) UNIQUE NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  device_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'active', 'suspended', 'revoked')),
  plan VARCHAR(20) DEFAULT 'standard' CHECK (plan IN ('trial', 'standard', 'premium', 'lifetime')),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster license lookups
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_device_id ON licenses(device_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- =============================================
-- DEVICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_model VARCHAR(255),
  app_version VARCHAR(20),
  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for device lookups
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_license_id ON devices(license_id);

-- =============================================
-- LICENSE LOGS TABLE (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS license_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id VARCHAR(50),
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_license_logs_device_id ON license_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_license_logs_license_id ON license_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_license_logs_action ON license_logs(action);
CREATE INDEX IF NOT EXISTS idx_license_logs_created_at ON license_logs(created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous reads for license validation
CREATE POLICY "Allow license lookup" ON licenses
  FOR SELECT USING (true);

CREATE POLICY "Allow license updates" ON licenses
  FOR UPDATE USING (true);

-- Policy: Allow device operations
CREATE POLICY "Allow device operations" ON devices
  FOR ALL USING (true);

-- Policy: Allow log inserts
CREATE POLICY "Allow log inserts" ON license_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow log reads" ON license_logs
  FOR SELECT USING (true);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate a random license key
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS VARCHAR(19) AS $$
DECLARE
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(19) := '';
  i INTEGER;
  part INTEGER;
BEGIN
  FOR part IN 1..4 LOOP
    IF part > 1 THEN
      result := result || '-';
    END IF;
    FOR i IN 1..4 LOOP
      result := result || substr(chars, floor(random() * 36 + 1)::integer, 1);
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create a new license
CREATE OR REPLACE FUNCTION create_license(
  p_customer_name VARCHAR DEFAULT NULL,
  p_customer_email VARCHAR DEFAULT NULL,
  p_customer_phone VARCHAR DEFAULT NULL,
  p_plan VARCHAR DEFAULT 'standard',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS licenses AS $$
DECLARE
  new_key VARCHAR(19);
  new_license licenses;
BEGIN
  -- Generate unique key
  LOOP
    new_key := generate_license_key();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM licenses WHERE license_key = new_key);
  END LOOP;
  
  -- Insert new license
  INSERT INTO licenses (
    license_key,
    customer_name,
    customer_email,
    customer_phone,
    plan,
    expires_at,
    notes,
    status
  ) VALUES (
    new_key,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_plan,
    p_expires_at,
    p_notes,
    'available'
  ) RETURNING * INTO new_license;
  
  RETURN new_license;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ADMIN VIEWS
-- =============================================

-- View: All active licenses with device info
CREATE OR REPLACE VIEW active_licenses_view AS
SELECT 
  l.id,
  l.license_key,
  l.customer_name,
  l.customer_email,
  l.customer_phone,
  l.plan,
  l.status,
  l.activated_at,
  l.expires_at,
  d.device_id,
  d.device_name,
  d.device_model,
  d.app_version,
  d.last_seen_at
FROM licenses l
LEFT JOIN devices d ON l.device_id = d.device_id
WHERE l.status = 'active'
ORDER BY l.activated_at DESC;

-- View: Trial devices (for tracking trial abuse)
CREATE OR REPLACE VIEW trial_devices_view AS
SELECT 
  d.device_id,
  d.device_name,
  d.device_model,
  d.trial_started_at,
  d.trial_expires_at,
  d.last_seen_at,
  CASE 
    WHEN d.trial_expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as trial_status,
  EXTRACT(DAY FROM d.trial_expires_at - NOW()) as days_remaining
FROM devices d
WHERE d.trial_started_at IS NOT NULL
  AND d.license_id IS NULL
ORDER BY d.trial_started_at DESC;

-- View: License logs summary
CREATE OR REPLACE VIEW license_logs_summary AS
SELECT 
  DATE(created_at) as log_date,
  action,
  COUNT(*) as count
FROM license_logs
GROUP BY DATE(created_at), action
ORDER BY log_date DESC, action;

-- =============================================
-- SAMPLE DATA (for testing - REMOVE IN PRODUCTION)
-- =============================================

-- Create a few test licenses
-- SELECT create_license('Test Customer', 'test@example.com', '+212600000000', 'standard', NOW() + INTERVAL '30 days');
-- SELECT create_license('Premium Customer', 'premium@example.com', '+212600000001', 'premium', NOW() + INTERVAL '365 days');
-- SELECT create_license('Lifetime Customer', 'lifetime@example.com', '+212600000002', 'lifetime', NULL);

-- =============================================
-- USEFUL QUERIES FOR ADMIN
-- =============================================

-- Generate 5 new available licenses:
-- SELECT create_license('', '', '', 'standard', NOW() + INTERVAL '30 days') FROM generate_series(1, 5);

-- View all licenses:
-- SELECT * FROM licenses ORDER BY created_at DESC;

-- View all devices:
-- SELECT * FROM devices ORDER BY last_seen_at DESC;

-- Revoke a license:
-- UPDATE licenses SET status = 'revoked', updated_at = NOW() WHERE license_key = 'XXXX-XXXX-XXXX-XXXX';

-- Suspend a license:
-- UPDATE licenses SET status = 'suspended', updated_at = NOW() WHERE license_key = 'XXXX-XXXX-XXXX-XXXX';

-- Reset device binding (allow reactivation on different device):
-- UPDATE licenses SET device_id = NULL, status = 'available', activated_at = NULL, updated_at = NOW() WHERE license_key = 'XXXX-XXXX-XXXX-XXXX';

-- Check trial abuse (devices that reinstalled):
-- SELECT device_id, COUNT(*) as log_count, MIN(created_at) as first_seen, MAX(created_at) as last_seen
-- FROM license_logs
-- WHERE action = 'trial_start'
-- GROUP BY device_id
-- HAVING COUNT(*) > 1;
