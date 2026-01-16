-- ============================================================================
-- POS MAROC - Database Schema for Supabase
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create all tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  pin VARCHAR(4) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'waiter', 'kitchen', 'cashier')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for PIN lookup (authentication)
CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin) WHERE is_active = true;

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for category lookup
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE is_active = true;

-- ============================================================================
-- TABLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS tables (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'occupied')),
  current_order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'NEW' CHECK (status IN ('NEW', 'PREPARING', 'READY', 'PAID', 'CANCELLED')),
  is_served BOOLEAN DEFAULT false,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  payment_method VARCHAR(10) CHECK (payment_method IN ('cash', 'card')),
  discount DECIMAL(10, 2) DEFAULT 0,
  discount_type VARCHAR(10) CHECK (discount_type IN ('percent', 'amount')),
  amount_received DECIMAL(10, 2),
  change_amount DECIMAL(10, 2),
  paid_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for pending orders (kitchen view) - orders not yet served
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(created_at) WHERE is_served = false AND status != 'CANCELLED';

-- Index for today's orders (reports)
CREATE INDEX IF NOT EXISTS idx_orders_today ON orders(created_at);

-- Add foreign key to tables after orders table exists
ALTER TABLE tables 
  DROP CONSTRAINT IF EXISTS tables_current_order_id_fkey,
  ADD CONSTRAINT tables_current_order_id_fkey 
  FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- ============================================================================
-- ORDER ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for order items lookup
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- For development/demo, allow all operations (replace with proper policies in production)
-- Note: In production, you should create proper policies based on user roles

CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on categories" ON categories FOR ALL USING (true);
CREATE POLICY "Allow all operations on products" ON products FOR ALL USING (true);
CREATE POLICY "Allow all operations on tables" ON tables FOR ALL USING (true);
CREATE POLICY "Allow all operations on orders" ON orders FOR ALL USING (true);
CREATE POLICY "Allow all operations on order_items" ON order_items FOR ALL USING (true);

-- ============================================================================
-- SEED DATA - Moroccan Products
-- ============================================================================

-- Insert demo users
INSERT INTO users (name, pin, role) VALUES
  ('Admin', '1111', 'admin'),
  ('Serveur', '2222', 'waiter'),
  ('Cuisine', '3333', 'kitchen'),
  ('Caissier', '4444', 'cashier')
ON CONFLICT (pin) DO NOTHING;

-- Insert categories
INSERT INTO categories (id, name, display_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Boissons Chaudes', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Boissons Froides', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Jus Frais', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Pâtisserie', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Sandwichs', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Salades', 6)
ON CONFLICT DO NOTHING;

-- Insert products - Boissons Chaudes
INSERT INTO products (name, price, category_id) VALUES
  ('Café Noir', 5, 'c1000000-0000-0000-0000-000000000001'),
  ('Café au Lait', 7, 'c1000000-0000-0000-0000-000000000001'),
  ('Noisette', 6, 'c1000000-0000-0000-0000-000000000001'),
  ('Cappuccino', 12, 'c1000000-0000-0000-0000-000000000001'),
  ('Thé à la Menthe', 5, 'c1000000-0000-0000-0000-000000000001'),
  ('Thé Vert', 5, 'c1000000-0000-0000-0000-000000000001'),
  ('Chocolat Chaud', 10, 'c1000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Insert products - Boissons Froides
INSERT INTO products (name, price, category_id) VALUES
  ('Coca Cola', 8, 'c1000000-0000-0000-0000-000000000002'),
  ('Fanta', 8, 'c1000000-0000-0000-0000-000000000002'),
  ('Sprite', 8, 'c1000000-0000-0000-0000-000000000002'),
  ('Eau Minérale', 5, 'c1000000-0000-0000-0000-000000000002'),
  ('Eau Gazeuse', 6, 'c1000000-0000-0000-0000-000000000002'),
  ('Schweppes', 8, 'c1000000-0000-0000-0000-000000000002'),
  ('Red Bull', 20, 'c1000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Insert products - Jus Frais
INSERT INTO products (name, price, category_id) VALUES
  ('Jus d''Orange', 15, 'c1000000-0000-0000-0000-000000000003'),
  ('Jus de Pomme', 15, 'c1000000-0000-0000-0000-000000000003'),
  ('Jus d''Avocat', 20, 'c1000000-0000-0000-0000-000000000003'),
  ('Jus de Fraise', 18, 'c1000000-0000-0000-0000-000000000003'),
  ('Jus de Banane', 15, 'c1000000-0000-0000-0000-000000000003'),
  ('Panache', 25, 'c1000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Insert products - Pâtisserie
INSERT INTO products (name, price, category_id) VALUES
  ('Croissant', 8, 'c1000000-0000-0000-0000-000000000004'),
  ('Pain au Chocolat', 8, 'c1000000-0000-0000-0000-000000000004'),
  ('Msemen', 3, 'c1000000-0000-0000-0000-000000000004'),
  ('Harcha', 3, 'c1000000-0000-0000-0000-000000000004'),
  ('Baghrir', 10, 'c1000000-0000-0000-0000-000000000004'),
  ('Mille-feuille', 12, 'c1000000-0000-0000-0000-000000000004'),
  ('Chebakia', 5, 'c1000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- Insert products - Sandwichs
INSERT INTO products (name, price, category_id) VALUES
  ('Sandwich Thon', 18, 'c1000000-0000-0000-0000-000000000005'),
  ('Sandwich Poulet', 20, 'c1000000-0000-0000-0000-000000000005'),
  ('Sandwich Fromage', 15, 'c1000000-0000-0000-0000-000000000005'),
  ('Tacos Poulet', 25, 'c1000000-0000-0000-0000-000000000005'),
  ('Panini Mixte', 22, 'c1000000-0000-0000-0000-000000000005'),
  ('Croque Monsieur', 18, 'c1000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Insert products - Salades
INSERT INTO products (name, price, category_id) VALUES
  ('Salade Marocaine', 15, 'c1000000-0000-0000-0000-000000000006'),
  ('Salade Verte', 12, 'c1000000-0000-0000-0000-000000000006'),
  ('Salade Mixte', 18, 'c1000000-0000-0000-0000-000000000006'),
  ('Salade César', 25, 'c1000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

-- Insert tables (12 tables)
INSERT INTO tables (number, status) VALUES
  (1, 'open'), (2, 'open'), (3, 'open'), (4, 'open'),
  (5, 'open'), (6, 'open'), (7, 'open'), (8, 'open'),
  (9, 'open'), (10, 'open'), (11, 'open'), (12, 'open')
ON CONFLICT (number) DO NOTHING;

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================
-- Enable realtime for orders table (for kitchen notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
