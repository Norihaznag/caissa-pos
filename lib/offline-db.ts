import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// For web platform, this file won't be used - see offline-db.web.ts
// Metro bundler will resolve .web.ts files for web platform

// Open the database (async in SDK 54+)
let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  // If already initialized, return immediately
  if (db) {
    return db;
  }
  
  // If initialization is in progress, wait for it
  if (dbInitPromise) {
    return dbInitPromise;
  }
  
  // Start initialization (only once)
  dbInitPromise = (async () => {
    try {
      db = await SQLite.openDatabaseAsync('caissapro_offline.db');
      return db;
    } catch (error) {
      dbInitPromise = null; // Reset on error so we can retry
      throw error;
    }
  })();
  
  return dbInitPromise;
};

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbSchemaInitialized = false;
let dbSchemaInitPromise: Promise<void> | null = null;

export const initOfflineDatabase = async (): Promise<void> => {
  // If already initialized, return immediately
  if (dbSchemaInitialized) {
    return;
  }
  
  // If initialization is in progress, wait for it
  if (dbSchemaInitPromise) {
    return dbSchemaInitPromise;
  }
  
  // Start schema initialization (only once)
  dbSchemaInitPromise = (async () => {
    try {
      const database = await getDatabase();
      
      // Enable foreign keys
      await database.execAsync('PRAGMA foreign_keys = ON;');
      
      // Create categories table
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0
        );
      `);
  
  // Create products table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category_id TEXT,
      is_active INTEGER DEFAULT 1,
      image_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
  `);
  
  // Create orders table (enhanced for cashier mode with table support)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER,
      table_number INTEGER DEFAULT 0,
      customer_name TEXT,
      status TEXT DEFAULT 'NEW',
      total_amount REAL DEFAULT 0,
      payment_method TEXT,
      discount REAL DEFAULT 0,
      discount_type TEXT,
      amount_received REAL,
      change_amount REAL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      printed INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0
    );
  `);
  
  // Create order_items table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);
  
  // Create users table for offline authentication
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT DEFAULT 'cashier',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced INTEGER DEFAULT 0
    );
  `);
  
  // Create sync_queue table for tracking pending syncs
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      attempts INTEGER DEFAULT 0
    );
  `);
  
  // Create settings table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  // Create expenses table for tracking daily expenses
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      synced INTEGER DEFAULT 0
    );
  `);
  
  // ========== v2.3: SHIFTS TABLE ==========
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_amount REAL DEFAULT 0,
      closing_amount REAL,
      total_sales REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      total_discounts REAL DEFAULT 0,
      total_change_given REAL DEFAULT 0,
      cancelled_orders INTEGER DEFAULT 0,
      status TEXT DEFAULT 'OPEN',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  
  // ========== v2.3: PAYROLL TABLE ==========
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS payroll (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      salary_type TEXT NOT NULL DEFAULT 'monthly',
      base_salary REAL NOT NULL DEFAULT 0,
      hourly_rate REAL,
      overtime_rate REAL,
      total_hours REAL,
      overtime_hours REAL,
      bonuses REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      advances REAL DEFAULT 0,
      total_payable REAL NOT NULL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  
  // ========== v2.3: PLANNED SHIFTS TABLE ==========
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS planned_shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      role TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  
  // ========== v2.3: STAFF COMPENSATION TABLE ==========
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS staff_compensation (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      salary_type TEXT NOT NULL DEFAULT 'monthly',
      base_salary REAL DEFAULT 0,
      hourly_rate REAL DEFAULT 0,
      overtime_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  
  // ========== v2.3: INDEXES FOR PERFORMANCE ==========
  try {
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_shifts_user_opened ON shifts(user_id, opened_at)');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at)');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_orders_cashier ON orders(cashier_id)');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id)');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_payroll_user_period ON payroll(user_id, period_start)');
    await database.execAsync('CREATE INDEX IF NOT EXISTS idx_planned_shifts_date ON planned_shifts(date)');
    console.log('v2.3 indexes created successfully');
  } catch (indexError) {
    console.warn('Index creation warning:', indexError);
  }
  
  // ========== MIGRATIONS ==========
  // Add new columns to existing orders table if they don't exist
  try {
    // Check if table_number column exists
    const tableInfo = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(orders)"
    );
    const columnNames = tableInfo.map(col => col.name);
    
    // Add missing columns one by one
    if (!columnNames.includes('table_number')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN table_number INTEGER DEFAULT 0');
      console.log('Migration: Added table_number column');
    }
    if (!columnNames.includes('customer_name')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN customer_name TEXT');
      console.log('Migration: Added customer_name column');
    }
    if (!columnNames.includes('note')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN note TEXT');
      console.log('Migration: Added note column');
    }
    if (!columnNames.includes('printed')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN printed INTEGER DEFAULT 0');
      console.log('Migration: Added printed column');
    }
    
    // Also check order_items table for note column
    const orderItemsInfo = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(order_items)"
    );
    const orderItemsColumns = orderItemsInfo.map(col => col.name);
    
    if (!orderItemsColumns.includes('note')) {
      await database.execAsync('ALTER TABLE order_items ADD COLUMN note TEXT');
      console.log('Migration: Added note column to order_items');
    }
    
    // Add stock_quantity to products table
    const productsInfo = await database.getAllAsync<{ name: string }>(
      "PRAGMA table_info(products)"
    );
    const productColumns = productsInfo.map(col => col.name);
    
    if (!productColumns.includes('stock_quantity')) {
      await database.execAsync('ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT -1');
      console.log('Migration: Added stock_quantity column to products (-1 means unlimited)');
    }
    if (!productColumns.includes('low_stock_threshold')) {
      await database.execAsync('ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 10');
      console.log('Migration: Added low_stock_threshold column to products');
    }
    
    // ========== v2.3 MIGRATIONS: Shifts, Payroll, Staff Attribution ==========
    
    // Add cashier_id and waiter_id to orders table for staff attribution
    if (!columnNames.includes('cashier_id')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN cashier_id TEXT');
      console.log('Migration: Added cashier_id column to orders');
    }
    if (!columnNames.includes('waiter_id')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN waiter_id TEXT');
      console.log('Migration: Added waiter_id column to orders');
    }
    if (!columnNames.includes('shift_id')) {
      await database.execAsync('ALTER TABLE orders ADD COLUMN shift_id TEXT');
      console.log('Migration: Added shift_id column to orders');
    }
    
    console.log('Database migrations completed successfully');
  } catch (migrationError: any) {
    // If migration fails, log the full error but don't throw
    // The columns might already exist or there's another issue
    console.warn('Migration warning:', migrationError?.message || migrationError);
  }
  
  // Initialize order counter if not exists
  const counter = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['order_counter']
  );
  
  if (!counter) {
    await database.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?)',
      ['order_counter', '0']
    );
  }
  
  // Seed default admin user if no users exist
  const userCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users'
  );
  
  if ((userCount?.count || 0) === 0) {
    const adminId = await Crypto.randomUUID();
    await database.runAsync(
      'INSERT INTO users (id, name, pin, role, is_active, synced) VALUES (?, ?, ?, ?, ?, 1)',
      [adminId, 'Admin', '1234', 'admin', 1]
    );
    console.log('Default admin user created (PIN: 1234)');
  }
  
  // Seed demo data if database is empty (for fresh installs)
  const categoryCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  
  if ((categoryCount?.count || 0) === 0) {
    console.log('Seeding demo data...');
    await seedDemoData(database);
  }
  
  dbSchemaInitialized = true;
  console.log('Offline database initialized');
    } catch (error) {
      dbSchemaInitPromise = null; // Reset on error so we can retry
      throw error;
    }
  })();
  
  return dbSchemaInitPromise;
};

// Seed demo data for fresh installations
const seedDemoData = async (database: SQLite.SQLiteDatabase) => {
  // Categories
  const categories = [
    { id: await Crypto.randomUUID(), name: 'Boissons Chaudes', display_order: 1 },
    { id: await Crypto.randomUUID(), name: 'Boissons Froides', display_order: 2 },
    { id: await Crypto.randomUUID(), name: 'Pâtisseries', display_order: 3 },
    { id: await Crypto.randomUUID(), name: 'Sandwichs', display_order: 4 },
    { id: await Crypto.randomUUID(), name: 'Plats', display_order: 5 },
    { id: await Crypto.randomUUID(), name: 'Desserts', display_order: 6 },
  ];
  
  for (const cat of categories) {
    await database.runAsync(
      'INSERT INTO categories (id, name, display_order, synced) VALUES (?, ?, ?, 1)',
      [cat.id, cat.name, cat.display_order]
    );
  }
  
  // Products
  const products = [
    // Boissons Chaudes
    { name: 'Café Express', price: 8, categoryIndex: 0 },
    { name: 'Café Crème', price: 12, categoryIndex: 0 },
    { name: 'Cappuccino', price: 15, categoryIndex: 0 },
    { name: 'Thé Menthe', price: 10, categoryIndex: 0 },
    { name: 'Thé Rouge', price: 10, categoryIndex: 0 },
    { name: 'Chocolat Chaud', price: 18, categoryIndex: 0 },
    // Boissons Froides
    { name: 'Jus Orange', price: 15, categoryIndex: 1 },
    { name: 'Jus Pomme', price: 15, categoryIndex: 1 },
    { name: 'Coca-Cola', price: 12, categoryIndex: 1 },
    { name: 'Fanta', price: 12, categoryIndex: 1 },
    { name: 'Eau Minérale', price: 8, categoryIndex: 1 },
    { name: 'Limonade', price: 14, categoryIndex: 1 },
    // Pâtisseries
    { name: 'Croissant', price: 10, categoryIndex: 2 },
    { name: 'Pain Chocolat', price: 12, categoryIndex: 2 },
    { name: 'Mille-feuille', price: 18, categoryIndex: 2 },
    { name: 'Éclair', price: 15, categoryIndex: 2 },
    { name: 'Tarte Fruits', price: 22, categoryIndex: 2 },
    { name: 'Cookie', price: 8, categoryIndex: 2 },
    // Sandwichs
    { name: 'Sandwich Poulet', price: 28, categoryIndex: 3 },
    { name: 'Sandwich Thon', price: 25, categoryIndex: 3 },
    { name: 'Panini', price: 30, categoryIndex: 3 },
    { name: 'Wrap Végé', price: 26, categoryIndex: 3 },
    { name: 'Club Sandwich', price: 35, categoryIndex: 3 },
    // Plats
    { name: 'Tajine Poulet', price: 55, categoryIndex: 4 },
    { name: 'Couscous', price: 60, categoryIndex: 4 },
    { name: 'Pizza Margherita', price: 45, categoryIndex: 4 },
    { name: 'Pâtes Bolognaise', price: 40, categoryIndex: 4 },
    { name: 'Salade César', price: 38, categoryIndex: 4 },
    // Desserts
    { name: 'Crème Brûlée', price: 25, categoryIndex: 5 },
    { name: 'Tiramisu', price: 28, categoryIndex: 5 },
    { name: 'Cheesecake', price: 30, categoryIndex: 5 },
    { name: 'Glace 2 Boules', price: 20, categoryIndex: 5 },
  ];
  
  for (const prod of products) {
    const productId = await Crypto.randomUUID();
    await database.runAsync(
      'INSERT INTO products (id, name, price, category_id, is_active, synced) VALUES (?, ?, ?, ?, 1, 1)',
      [productId, prod.name, prod.price, categories[prod.categoryIndex].id]
    );
  }
  
  console.log(`Demo data seeded: ${categories.length} categories, ${products.length} products`);
};

// ============================================================================
// CATEGORY OPERATIONS
// ============================================================================

export const offlineCategoryService = {
  async getAll(): Promise<{
    id: string;
    name: string;
    displayOrder: number;
  }[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      name: string;
      display_order: number;
    }>('SELECT * FROM categories ORDER BY display_order');
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      displayOrder: r.display_order,
    }));
  },
  
  async create(category: { id: string; name: string; displayOrder: number }): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT OR REPLACE INTO categories (id, name, display_order, synced) VALUES (?, ?, ?, 0)',
      [category.id, category.name, category.displayOrder]
    );
    
    // Add to sync queue
    await addToSyncQueue('categories', category.id, 'CREATE', category);
  },
  
  async update(id: string, data: { name?: string; displayOrder?: number }): Promise<void> {
    const database = await getDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(data.displayOrder);
    }
    
    if (updates.length > 0) {
      updates.push('synced = 0');
      values.push(id);
      
      await database.runAsync(
        `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      // Add to sync queue
      await addToSyncQueue('categories', id, 'UPDATE', { id, ...data });
    }
  },
  
  async delete(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM categories WHERE id = ?', [id]);
    
    // Add to sync queue
    await addToSyncQueue('categories', id, 'DELETE', { id });
  },
  
  async getProductCount(categoryId: string): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [categoryId]
    );
    return result?.count || 0;
  },
  
  async bulkInsert(categories: { id: string; name: string; display_order: number }[]): Promise<void> {
    const database = await getDatabase();
    for (const cat of categories) {
      await database.runAsync(
        'INSERT OR REPLACE INTO categories (id, name, display_order, synced) VALUES (?, ?, ?, 1)',
        [cat.id, cat.name, cat.display_order]
      );
    }
  },
};

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

export const offlineProductService = {
  async getAll(): Promise<{
    id: string;
    name: string;
    price: number;
    categoryId: string;
    categoryName?: string;
    isActive: boolean;
    imageUrl?: string;
  }[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      name: string;
      price: number;
      category_id: string;
      category_name: string;
      is_active: number;
      image_url: string | null;
    }>(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.name
    `);
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      price: r.price,
      categoryId: r.category_id,
      categoryName: r.category_name,
      isActive: r.is_active === 1,
      imageUrl: r.image_url || undefined,
    }));
  },
  
  async getByCategory(categoryId: string): Promise<{
    id: string;
    name: string;
    price: number;
    categoryId: string;
    isActive: boolean;
    imageUrl?: string;
  }[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      name: string;
      price: number;
      category_id: string;
      is_active: number;
      image_url: string | null;
    }>(
      'SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY name',
      [categoryId]
    );
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      price: r.price,
      categoryId: r.category_id,
      isActive: r.is_active === 1,
      imageUrl: r.image_url || undefined,
    }));
  },
  
  async bulkInsert(products: {
    id: string;
    name: string;
    price: number;
    category_id: string;
    is_active: boolean;
    image_url?: string;
  }[]): Promise<void> {
    const database = await getDatabase();
    for (const prod of products) {
      await database.runAsync(
        'INSERT OR REPLACE INTO products (id, name, price, category_id, is_active, image_url, synced) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [prod.id, prod.name, prod.price, prod.category_id, prod.is_active ? 1 : 0, prod.image_url || null]
      );
    }
  },
  
  async create(product: {
    id: string;
    name: string;
    price: number;
    categoryId: string;
    isActive?: boolean;
    imageUrl?: string;
  }): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT OR REPLACE INTO products (id, name, price, category_id, is_active, image_url, synced) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [product.id, product.name, product.price, product.categoryId, product.isActive !== false ? 1 : 0, product.imageUrl || null]
    );
    
    // Add to sync queue
    await addToSyncQueue('products', product.id, 'CREATE', {
      id: product.id,
      name: product.name,
      price: product.price,
      category_id: product.categoryId,
      is_active: product.isActive !== false,
      image_url: product.imageUrl || null,
    });
  },
  
  async update(id: string, data: {
    name?: string;
    price?: number;
    categoryId?: string;
    isActive?: boolean;
    imageUrl?: string;
  }): Promise<void> {
    const database = await getDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.price !== undefined) {
      updates.push('price = ?');
      values.push(data.price);
    }
    if (data.categoryId !== undefined) {
      updates.push('category_id = ?');
      values.push(data.categoryId);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (data.imageUrl !== undefined) {
      updates.push('image_url = ?');
      values.push(data.imageUrl);
    }
    
    if (updates.length > 0) {
      updates.push('synced = 0');
      values.push(id);
      
      await database.runAsync(
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      // Add to sync queue
      await addToSyncQueue('products', id, 'UPDATE', { id, ...data });
    }
  },
  
  async delete(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM products WHERE id = ?', [id]);
    
    // Add to sync queue
    await addToSyncQueue('products', id, 'DELETE', { id });
  },
  
  async toggleActive(id: string): Promise<boolean> {
    const database = await getDatabase();
    
    // Get current status
    const product = await database.getFirstAsync<{ is_active: number }>(
      'SELECT is_active FROM products WHERE id = ?',
      [id]
    );
    
    const newStatus = product?.is_active === 1 ? 0 : 1;
    
    await database.runAsync(
      'UPDATE products SET is_active = ?, synced = 0 WHERE id = ?',
      [newStatus, id]
    );
    
    // Add to sync queue
    await addToSyncQueue('products', id, 'UPDATE', { id, is_active: newStatus === 1 });
    
    return newStatus === 1;
  },
  
  // Stock Management
  async updateStock(id: string, quantity: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE products SET stock_quantity = ?, synced = 0 WHERE id = ?',
      [quantity, id]
    );
    await addToSyncQueue('products', id, 'UPDATE', { id, stock_quantity: quantity });
  },
  
  async adjustStock(id: string, delta: number): Promise<number> {
    const database = await getDatabase();
    const product = await database.getFirstAsync<{ stock_quantity: number }>(
      'SELECT stock_quantity FROM products WHERE id = ?',
      [id]
    );
    
    const currentStock = product?.stock_quantity ?? -1;
    if (currentStock === -1) return -1; // Unlimited stock
    
    const newStock = Math.max(0, currentStock + delta);
    await database.runAsync(
      'UPDATE products SET stock_quantity = ?, synced = 0 WHERE id = ?',
      [newStock, id]
    );
    await addToSyncQueue('products', id, 'UPDATE', { id, stock_quantity: newStock });
    return newStock;
  },
  
  async setLowStockThreshold(id: string, threshold: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE products SET low_stock_threshold = ?, synced = 0 WHERE id = ?',
      [threshold, id]
    );
  },
  
  async getLowStockProducts(): Promise<{
    id: string;
    name: string;
    stockQuantity: number;
    lowStockThreshold: number;
    categoryName?: string;
  }[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      name: string;
      stock_quantity: number;
      low_stock_threshold: number;
      category_name: string | null;
    }>(`
      SELECT p.id, p.name, p.stock_quantity, p.low_stock_threshold, c.name as category_name
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.stock_quantity >= 0 
        AND p.stock_quantity <= p.low_stock_threshold 
        AND p.is_active = 1
      ORDER BY p.stock_quantity ASC
    `);
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      stockQuantity: r.stock_quantity,
      lowStockThreshold: r.low_stock_threshold,
      categoryName: r.category_name || undefined,
    }));
  },
  
  async getAllWithStock(): Promise<{
    id: string;
    name: string;
    price: number;
    categoryId: string;
    categoryName?: string;
    isActive: boolean;
    imageUrl?: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      name: string;
      price: number;
      category_id: string;
      category_name: string;
      is_active: number;
      image_url: string | null;
      stock_quantity: number;
      low_stock_threshold: number;
    }>(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.name
    `);
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      price: r.price,
      categoryId: r.category_id,
      categoryName: r.category_name,
      isActive: r.is_active === 1,
      imageUrl: r.image_url || undefined,
      stockQuantity: r.stock_quantity ?? -1,
      lowStockThreshold: r.low_stock_threshold ?? 10,
    }));
  },
};

// ============================================================================
// EXPENSE OPERATIONS
// ============================================================================

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description?: string;
  date: Date;
  createdBy?: string;
}

export const EXPENSE_CATEGORIES = [
  { id: 'fournisseur', label: 'Fournisseur' },
  { id: 'marche', label: 'Marché / Courses' },
  { id: 'lait_cafe', label: 'Lait & Café' },
  { id: 'pain', label: 'Pain & Pâtisserie' },
  { id: 'boissons', label: 'Boissons' },
  { id: 'reparation', label: 'Réparation' },
  { id: 'nettoyage', label: 'Nettoyage' },
  { id: 'avance_salaire', label: 'Avance Salaire' },
  { id: 'loyer', label: 'Loyer' },
  { id: 'electricite', label: 'Électricité / Eau' },
  { id: 'autre', label: 'Autre' },
] as const;

export const offlineExpenseService = {
  async getAll(): Promise<Expense[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      amount: number;
      category: string;
      description: string | null;
      date: string;
      created_by: string | null;
    }>('SELECT * FROM expenses ORDER BY date DESC');
    
    return results.map(r => ({
      id: r.id,
      amount: r.amount,
      category: r.category,
      description: r.description || undefined,
      date: new Date(r.date),
      createdBy: r.created_by || undefined,
    }));
  },
  
  async getTodayExpenses(): Promise<Expense[]> {
    const database = await getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const results = await database.getAllAsync<{
      id: string;
      amount: number;
      category: string;
      description: string | null;
      date: string;
      created_by: string | null;
    }>(`SELECT * FROM expenses WHERE date(date) = date(?) ORDER BY date DESC`, [today]);
    
    return results.map(r => ({
      id: r.id,
      amount: r.amount,
      category: r.category,
      description: r.description || undefined,
      date: new Date(r.date),
      createdBy: r.created_by || undefined,
    }));
  },
  
  async getTodayTotal(): Promise<number> {
    const database = await getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const result = await database.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(date) = date(?)`,
      [today]
    );
    return result?.total || 0;
  },
  
  async create(expense: {
    amount: number;
    category: string;
    description?: string;
    createdBy?: string;
  }): Promise<string> {
    const database = await getDatabase();
    const id = await Crypto.randomUUID();
    
    await database.runAsync(
      'INSERT INTO expenses (id, amount, category, description, created_by, synced) VALUES (?, ?, ?, ?, ?, 0)',
      [id, expense.amount, expense.category, expense.description || null, expense.createdBy || null]
    );
    
    await addToSyncQueue('expenses', id, 'CREATE', { id, ...expense });
    return id;
  },
  
  async delete(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    await addToSyncQueue('expenses', id, 'DELETE', { id });
  },
  
  async getByDateRange(startDate: Date, endDate: Date): Promise<Expense[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      amount: number;
      category: string;
      description: string | null;
      date: string;
      created_by: string | null;
    }>(
      `SELECT * FROM expenses WHERE date(date) >= date(?) AND date(date) <= date(?) ORDER BY date DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );
    
    return results.map(r => ({
      id: r.id,
      amount: r.amount,
      category: r.category,
      description: r.description || undefined,
      date: new Date(r.date),
      createdBy: r.created_by || undefined,
    }));
  },
  
  async getTotalByCategory(startDate?: Date, endDate?: Date): Promise<{ category: string; total: number }[]> {
    const database = await getDatabase();
    let query = `SELECT category, SUM(amount) as total FROM expenses`;
    const params: string[] = [];
    
    if (startDate && endDate) {
      query += ` WHERE date(date) >= date(?) AND date(date) <= date(?)`;
      params.push(startDate.toISOString(), endDate.toISOString());
    }
    
    query += ` GROUP BY category ORDER BY total DESC`;
    
    const results = await database.getAllAsync<{ category: string; total: number }>(query, params);
    return results;
  },
};

// ============================================================================
// ORDER OPERATIONS (Cashier Mode)
// ============================================================================

export interface OfflineOrder {
  id: string;
  orderNumber: number;
  tableNumber?: number;
  customerName?: string;
  status: 'NEW' | 'PENDING' | 'PREPARING' | 'READY' | 'PAID' | 'CANCELLED';
  totalAmount: number;
  paymentMethod?: 'cash' | 'card';
  discount: number;
  discountType?: 'percent' | 'amount';
  amountReceived?: number;
  changeAmount?: number;
  note?: string;
  createdAt: Date;
  paidAt?: Date;
  printed?: boolean;
  items: OfflineOrderItem[];
}

export interface OfflineOrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  note?: string;
}

export const offlineOrderService = {
  async getNextOrderNumber(): Promise<number> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['order_counter']
    );
    
    const nextNumber = parseInt(result?.value || '0', 10) + 1;
    
    // Reset counter at 999 or new day
    const today = new Date().toDateString();
    const lastDate = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['last_order_date']
    );
    
    let finalNumber = nextNumber;
    if (lastDate?.value !== today) {
      finalNumber = 1;
      await database.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['last_order_date', today]
      );
    }
    
    await database.runAsync(
      'UPDATE settings SET value = ? WHERE key = ?',
      [String(finalNumber), 'order_counter']
    );
    
    return finalNumber;
  },
  
  async create(order: Omit<OfflineOrder, 'orderNumber'>): Promise<OfflineOrder> {
    const database = await getDatabase();
    const orderNumber = await this.getNextOrderNumber();
    
    await database.runAsync(
      `INSERT INTO orders (id, order_number, table_number, customer_name, status, total_amount, payment_method, discount, discount_type, amount_received, change_amount, note, created_at, paid_at, printed, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        order.id,
        orderNumber,
        order.tableNumber || 0,
        order.customerName || null,
        order.status,
        order.totalAmount,
        order.paymentMethod || null,
        order.discount,
        order.discountType || null,
        order.amountReceived || null,
        order.changeAmount || null,
        order.note || null,
        order.createdAt.toISOString(),
        order.paidAt?.toISOString() || null,
        order.printed ? 1 : 0,
      ]
    );
    
    // Insert order items
    for (const item of order.items) {
      await database.runAsync(
        `INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, note, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [item.id, order.id, item.productId, item.productName, item.price, item.quantity, item.note || null]
      );
    }
    
    // Add to sync queue
    await addToSyncQueue('orders', order.id, 'CREATE', {
      ...order,
      orderNumber,
      items: order.items,
    });
    
    return { ...order, orderNumber };
  },
  
  async getAll(): Promise<OfflineOrder[]> {
    const database = await getDatabase();
    const orders = await database.getAllAsync<{
      id: string;
      order_number: number;
      status: string;
      total_amount: number;
      payment_method: string | null;
      discount: number;
      discount_type: string | null;
      amount_received: number | null;
      change_amount: number | null;
      table_number: number | null;
      customer_name: string | null;
      note: string | null;
      printed: number;
      created_at: string;
      paid_at: string | null;
    }>('SELECT * FROM orders ORDER BY created_at DESC');
    
    const result: OfflineOrder[] = [];
    
    for (const order of orders) {
      const items = await database.getAllAsync<{
        id: string;
        product_id: string;
        product_name: string;
        price: number;
        quantity: number;
        note: string | null;
      }>(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      
      result.push({
        id: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table_number ?? 0,
        customerName: order.customer_name || undefined,
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
        note: order.note || undefined,
        printed: order.printed === 1,
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        items: items.map(i => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          price: i.price,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
      });
    }
    
    return result;
  },
  
  async getTodayOrders(): Promise<OfflineOrder[]> {
    const database = await getDatabase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const orders = await database.getAllAsync<{
      id: string;
      order_number: number;
      table_number: number | null;
      customer_name: string | null;
      status: string;
      total_amount: number;
      payment_method: string | null;
      discount: number;
      discount_type: string | null;
      amount_received: number | null;
      change_amount: number | null;
      note: string | null;
      printed: number;
      created_at: string;
      paid_at: string | null;
    }>(
      'SELECT * FROM orders WHERE created_at >= ? ORDER BY created_at DESC',
      [startOfDay.toISOString()]
    );
    
    const result: OfflineOrder[] = [];
    
    for (const order of orders) {
      const items = await database.getAllAsync<{
        id: string;
        product_id: string;
        product_name: string;
        price: number;
        quantity: number;
        note: string | null;
      }>(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      
      result.push({
        id: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table_number ?? 0,
        customerName: order.customer_name || undefined,
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
        note: order.note || undefined,
        printed: order.printed === 1,
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        items: items.map(i => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          price: i.price,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
      });
    }
    
    return result;
  },
  
  async updateStatus(orderId: string, status: OfflineOrder['status']): Promise<void> {
    const database = await getDatabase();
    const paidAt = status === 'PAID' ? new Date().toISOString() : null;
    
    await database.runAsync(
      'UPDATE orders SET status = ?, paid_at = ?, synced = 0 WHERE id = ?',
      [status, paidAt, orderId]
    );
    
    await addToSyncQueue('orders', orderId, 'UPDATE', { status, paid_at: paidAt });
  },
  
  async completePayment(
    orderId: string,
    paymentMethod: 'cash' | 'card',
    amountReceived: number,
    changeAmount: number,
    discount: number,
    discountType: 'percent' | 'amount'
  ): Promise<void> {
    const database = await getDatabase();
    const paidAt = new Date().toISOString();
    
    await database.runAsync(
      `UPDATE orders SET 
        status = 'PAID',
        payment_method = ?,
        amount_received = ?,
        change_amount = ?,
        discount = ?,
        discount_type = ?,
        paid_at = ?,
        synced = 0
       WHERE id = ?`,
      [paymentMethod, amountReceived, changeAmount, discount, discountType, paidAt, orderId]
    );
    
    await addToSyncQueue('orders', orderId, 'UPDATE', {
      status: 'PAID',
      payment_method: paymentMethod,
      amount_received: amountReceived,
      change_amount: changeAmount,
      discount,
      discount_type: discountType,
      paid_at: paidAt,
    });
  },
  
  async getDailyStats(): Promise<{
    totalOrders: number;
    paidOrders: number;
    totalRevenue: number;
    cashRevenue: number;
    cardRevenue: number;
  }> {
    const database = await getDatabase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const stats = await database.getFirstAsync<{
      total_orders: number;
      paid_orders: number;
      total_revenue: number;
      cash_revenue: number;
      card_revenue: number;
    }>(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_orders,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_revenue
      FROM orders
      WHERE created_at >= ?
    `, [startOfDay.toISOString()]);
    
    return {
      totalOrders: stats?.total_orders || 0,
      paidOrders: stats?.paid_orders || 0,
      totalRevenue: stats?.total_revenue || 0,
      cashRevenue: stats?.cash_revenue || 0,
      cardRevenue: stats?.card_revenue || 0,
    };
  },
  
  // Get pending orders (not yet paid)
  async getPendingOrders(): Promise<OfflineOrder[]> {
    const database = await getDatabase();
    const orders = await database.getAllAsync<{
      id: string;
      order_number: number;
      table_number: number | null;
      customer_name: string | null;
      status: string;
      total_amount: number;
      payment_method: string | null;
      discount: number;
      discount_type: string | null;
      amount_received: number | null;
      change_amount: number | null;
      note: string | null;
      printed: number;
      created_at: string;
      paid_at: string | null;
    }>(
      `SELECT * FROM orders WHERE status IN ('NEW', 'PENDING', 'PREPARING', 'READY') ORDER BY created_at ASC`
    );
    
    const result: OfflineOrder[] = [];
    
    for (const order of orders) {
      const items = await database.getAllAsync<{
        id: string;
        product_id: string;
        product_name: string;
        price: number;
        quantity: number;
        note: string | null;
      }>(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      
      result.push({
        id: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table_number ?? 0,
        customerName: order.customer_name || undefined,
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
        note: order.note || undefined,
        printed: order.printed === 1,
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        items: items.map(i => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          price: i.price,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
      });
    }
    
    return result;
  },
  
  // Mark order as printed
  async markPrinted(orderId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'UPDATE orders SET printed = 1 WHERE id = ?',
      [orderId]
    );
  },
  
  // Delete order (for cancellation)
  async deleteOrder(orderId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await database.runAsync('DELETE FROM orders WHERE id = ?', [orderId]);
    await addToSyncQueue('orders', orderId, 'DELETE', { id: orderId });
  },
};

// ============================================================================
// SYNC QUEUE OPERATIONS
// ============================================================================

export const addToSyncQueue = async (
  tableName: string,
  recordId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  data: any
): Promise<void> => {
  const database = await getDatabase();
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await database.runAsync(
    'INSERT INTO sync_queue (id, table_name, record_id, action, data) VALUES (?, ?, ?, ?, ?)',
    [id, tableName, recordId, action, JSON.stringify(data)]
  );
};

export const getSyncQueue = async (): Promise<{
  id: string;
  tableName: string;
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  attempts: number;
}[]> => {
  const database = await getDatabase();
  const results = await database.getAllAsync<{
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    data: string;
    attempts: number;
  }>('SELECT * FROM sync_queue ORDER BY created_at');
  
  return results.map(r => ({
    id: r.id,
    tableName: r.table_name,
    recordId: r.record_id,
    action: r.action as 'CREATE' | 'UPDATE' | 'DELETE',
    data: JSON.parse(r.data),
    attempts: r.attempts,
  }));
};

export const removeSyncQueueItem = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
};

export const incrementSyncAttempts = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?', [id]);
};

export const getSyncQueueCount = async (): Promise<number> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue'
  );
  return result?.count || 0;
};

// ============================================================================
// DATA SYNC FROM SUPABASE TO LOCAL
// ============================================================================

export const syncFromSupabase = async (
  categories: { id: string; name: string; display_order: number }[],
  products: { id: string; name: string; price: number; category_id: string; is_active: boolean; image_url?: string }[]
): Promise<void> => {
  await offlineCategoryService.bulkInsert(categories);
  await offlineProductService.bulkInsert(products);
  console.log(`Synced ${categories.length} categories and ${products.length} products to local DB`);
};

// ============================================================================
// CLEAR DATABASE
// ============================================================================

export const clearOfflineDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execAsync('DELETE FROM order_items');
  await database.execAsync('DELETE FROM orders');
  await database.execAsync('DELETE FROM sync_queue');
  await database.runAsync('UPDATE settings SET value = ? WHERE key = ?', ['0', 'order_counter']);
  console.log('Offline database cleared');
};

// Clear sync queue items with invalid UUIDs (old format like "order-xxx")
export const clearInvalidSyncQueueItems = async (): Promise<number> => {
  const database = await getDatabase();
  // UUID format: 8-4-4-4-12 hex characters
  // Delete items where record_id doesn't match UUID pattern
  const result = await database.runAsync(
    `DELETE FROM sync_queue WHERE record_id NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'`
  );
  console.log(`Cleared ${result.changes} invalid sync queue items`);
  return result.changes;
};

// Clear all sync queue items
export const clearSyncQueue = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execAsync('DELETE FROM sync_queue');
  console.log('Sync queue cleared');
};

// ============================================================================
// USER OPERATIONS (Offline Admin Mode)
// ============================================================================

export interface OfflineUser {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'cashier' | 'waiter';
  isActive: boolean;
}

export const offlineUserService = {
  async getAll(): Promise<OfflineUser[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{
      id: string;
      name: string;
      pin: string;
      role: string;
      is_active: number;
    }>('SELECT * FROM users ORDER BY name');
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      pin: r.pin,
      role: r.role as OfflineUser['role'],
      isActive: r.is_active === 1,
    }));
  },
  
  async getByPin(pin: string): Promise<OfflineUser | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{
      id: string;
      name: string;
      pin: string;
      role: string;
      is_active: number;
    }>('SELECT * FROM users WHERE pin = ? AND is_active = 1', [pin]);
    
    if (!result) return null;
    
    return {
      id: result.id,
      name: result.name,
      pin: result.pin,
      role: result.role as OfflineUser['role'],
      isActive: result.is_active === 1,
    };
  },
  
  async create(user: Omit<OfflineUser, 'isActive'> & { isActive?: boolean }): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT OR REPLACE INTO users (id, name, pin, role, is_active, synced) VALUES (?, ?, ?, ?, ?, 0)',
      [user.id, user.name, user.pin, user.role, user.isActive !== false ? 1 : 0]
    );
    
    await addToSyncQueue('users', user.id, 'CREATE', user);
  },
  
  async update(id: string, data: Partial<Omit<OfflineUser, 'id'>>): Promise<void> {
    const database = await getDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.pin !== undefined) {
      updates.push('pin = ?');
      values.push(data.pin);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    
    if (updates.length > 0) {
      updates.push('synced = 0');
      values.push(id);
      
      await database.runAsync(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      await addToSyncQueue('users', id, 'UPDATE', { id, ...data });
    }
  },
  
  async delete(id: string): Promise<void> {
    const database = await getDatabase();
    
    // Disable foreign key checks temporarily for this operation
    await database.runAsync('PRAGMA foreign_keys = OFF');
    
    try {
      // Nullify user references in orders table (cashier_id, waiter_id)
      try {
        await database.runAsync('UPDATE orders SET cashier_id = NULL WHERE cashier_id = ?', [id]);
      } catch (e) { console.log('[USER DELETE] cashier_id column may not exist'); }
      
      try {
        await database.runAsync('UPDATE orders SET waiter_id = NULL WHERE waiter_id = ?', [id]);
      } catch (e) { console.log('[USER DELETE] waiter_id column may not exist'); }
      
      // Delete from related tables (these may not exist, so wrap in try-catch)
      try {
        await database.runAsync('DELETE FROM payroll WHERE user_id = ?', [id]);
      } catch (e) { console.log('[USER DELETE] payroll table may not exist'); }
      
      try {
        await database.runAsync('DELETE FROM shifts WHERE user_id = ?', [id]);
      } catch (e) { console.log('[USER DELETE] shifts table may not exist'); }
      
      try {
        await database.runAsync('DELETE FROM planned_shifts WHERE user_id = ?', [id]);
      } catch (e) { console.log('[USER DELETE] planned_shifts table may not exist'); }
      
      try {
        await database.runAsync('DELETE FROM staff_compensation WHERE user_id = ?', [id]);
      } catch (e) { console.log('[USER DELETE] staff_compensation table may not exist'); }
      
      // Now safely delete the user
      await database.runAsync('DELETE FROM users WHERE id = ?', [id]);
      await addToSyncQueue('users', id, 'DELETE', { id });
      
      console.log('[USER] Successfully deleted user:', id);
    } finally {
      // Re-enable foreign key checks
      await database.runAsync('PRAGMA foreign_keys = ON');
    }
  },
  
  async isPinTaken(pin: string, excludeId?: string): Promise<boolean> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ count: number }>(
      excludeId 
        ? 'SELECT COUNT(*) as count FROM users WHERE pin = ? AND id != ?'
        : 'SELECT COUNT(*) as count FROM users WHERE pin = ?',
      excludeId ? [pin, excludeId] : [pin]
    );
    return (result?.count || 0) > 0;
  },
  
  async seedDefaultAdmin(): Promise<void> {
    const database = await getDatabase();
    
    // Check if any users exist
    const count = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users'
    );
    
    if ((count?.count || 0) === 0) {
      // Create default admin user
      const adminId = await Crypto.randomUUID();
      await database.runAsync(
        'INSERT INTO users (id, name, pin, role, is_active, synced) VALUES (?, ?, ?, ?, ?, 1)',
        [adminId, 'Admin', '1234', 'admin', 1]
      );
      console.log('Default admin user created (PIN: 1234)');
    }
  },
  
  async bulkInsert(users: {
    id: string;
    name: string;
    pin: string;
    role: string;
    is_active: boolean;
  }[]): Promise<void> {
    const database = await getDatabase();
    for (const user of users) {
      await database.runAsync(
        'INSERT OR REPLACE INTO users (id, name, pin, role, is_active, synced) VALUES (?, ?, ?, ?, ?, 1)',
        [user.id, user.name, user.pin, user.role, user.is_active ? 1 : 0]
      );
    }
  },
};

// ============================================================================
// SETTINGS OPERATIONS
// ============================================================================

export const offlineSettingsService = {
  async get(key: string): Promise<string | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return result?.value || null;
  },
  
  async set(key: string, value: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  },
  
  async getAll(): Promise<Record<string, string>> {
    const database = await getDatabase();
    const results = await database.getAllAsync<{ key: string; value: string }>(
      'SELECT * FROM settings'
    );
    
    const settings: Record<string, string> = {};
    for (const r of results) {
      settings[r.key] = r.value;
    }
    return settings;
  },
  
  async delete(key: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  },
};

// ============================================================================
// ANALYTICS SERVICE - v2.2 Production Polish
// ============================================================================

export interface DailyStatsExtended {
  date: string;
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  avgOrderValue: number;
  totalDiscount: number;
  peakHour: number | null;
  peakHourOrders: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface HourlyStats {
  hour: number;
  orders: number;
  revenue: number;
}

export interface WeeklyTrend {
  dayOfWeek: number;
  dayName: string;
  orders: number;
  revenue: number;
}

export const analyticsService = {
  /**
   * Get extended daily stats for a specific date
   */
  async getDailyStatsForDate(date: Date): Promise<DailyStatsExtended> {
    const database = await getDatabase();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const stats = await database.getFirstAsync<{
      total_orders: number;
      paid_orders: number;
      cancelled_orders: number;
      total_revenue: number;
      cash_revenue: number;
      card_revenue: number;
      total_discount: number;
    }>(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid_orders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_revenue,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN discount ELSE 0 END), 0) as total_discount
      FROM orders
      WHERE created_at >= ? AND created_at <= ?
    `, [startOfDay.toISOString(), endOfDay.toISOString()]);
    
    // Get peak hour
    const peakHour = await database.getFirstAsync<{
      hour: number;
      order_count: number;
    }>(`
      SELECT 
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as order_count
      FROM orders
      WHERE status = 'PAID' AND created_at >= ? AND created_at <= ?
      GROUP BY hour
      ORDER BY order_count DESC
      LIMIT 1
    `, [startOfDay.toISOString(), endOfDay.toISOString()]);
    
    const paidOrders = stats?.paid_orders || 0;
    const totalRevenue = stats?.total_revenue || 0;
    
    return {
      date: date.toISOString().split('T')[0],
      totalOrders: stats?.total_orders || 0,
      paidOrders,
      cancelledOrders: stats?.cancelled_orders || 0,
      totalRevenue,
      cashRevenue: stats?.cash_revenue || 0,
      cardRevenue: stats?.card_revenue || 0,
      avgOrderValue: paidOrders > 0 ? totalRevenue / paidOrders : 0,
      totalDiscount: stats?.total_discount || 0,
      peakHour: peakHour?.hour ?? null,
      peakHourOrders: peakHour?.order_count || 0,
    };
  },
  
  /**
   * Get stats for a date range (for charts)
   */
  async getDateRangeStats(startDate: Date, endDate: Date): Promise<DailyStatsExtended[]> {
    const results: DailyStatsExtended[] = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const stats = await this.getDailyStatsForDate(new Date(current));
      results.push(stats);
      current.setDate(current.getDate() + 1);
    }
    
    return results;
  },
  
  /**
   * Get top-selling products for a date range
   */
  async getTopProducts(startDate: Date, endDate: Date, limit: number = 10): Promise<TopProduct[]> {
    const database = await getDatabase();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const products = await database.getAllAsync<{
      product_id: string;
      product_name: string;
      total_quantity: number;
      total_revenue: number;
    }>(`
      SELECT 
        oi.product_id,
        oi.product_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at <= ?
      GROUP BY oi.product_id, oi.product_name
      ORDER BY total_quantity DESC
      LIMIT ?
    `, [startDate.toISOString(), endDate.toISOString(), limit]);
    
    return products.map(p => ({
      productId: p.product_id,
      productName: p.product_name,
      totalQuantity: p.total_quantity,
      totalRevenue: p.total_revenue,
    }));
  },
  
  /**
   * Get hourly breakdown for a specific day
   */
  async getHourlyStats(date: Date): Promise<HourlyStats[]> {
    const database = await getDatabase();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const hourlyData = await database.getAllAsync<{
      hour: number;
      orders: number;
      revenue: number;
    }>(`
      SELECT 
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE status = 'PAID' AND created_at >= ? AND created_at <= ?
      GROUP BY hour
      ORDER BY hour
    `, [startOfDay.toISOString(), endOfDay.toISOString()]);
    
    // Fill in all 24 hours
    const result: HourlyStats[] = [];
    for (let h = 0; h < 24; h++) {
      const found = hourlyData.find(d => d.hour === h);
      result.push({
        hour: h,
        orders: found?.orders || 0,
        revenue: found?.revenue || 0,
      });
    }
    
    return result;
  },
  
  /**
   * Get last 7 days trend
   */
  async getWeeklyTrend(): Promise<WeeklyTrend[]> {
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const results: WeeklyTrend[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const stats = await this.getDailyStatsForDate(date);
      results.push({
        dayOfWeek: date.getDay(),
        dayName: dayNames[date.getDay()],
        orders: stats.paidOrders,
        revenue: stats.totalRevenue,
      });
    }
    
    return results;
  },
  
  /**
   * Get all orders for a specific date (for history view)
   */
  async getOrdersForDate(date: Date): Promise<OfflineOrder[]> {
    const database = await getDatabase();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const orders = await database.getAllAsync<{
      id: string;
      order_number: number;
      table_number: number | null;
      customer_name: string | null;
      status: string;
      total_amount: number;
      payment_method: string | null;
      discount: number;
      discount_type: string | null;
      amount_received: number | null;
      change_amount: number | null;
      note: string | null;
      printed: number;
      created_at: string;
      paid_at: string | null;
    }>(`
      SELECT * FROM orders 
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `, [startOfDay.toISOString(), endOfDay.toISOString()]);
    
    const result: OfflineOrder[] = [];
    
    for (const order of orders) {
      const items = await database.getAllAsync<{
        id: string;
        product_id: string;
        product_name: string;
        price: number;
        quantity: number;
        note: string | null;
      }>(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      
      result.push({
        id: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table_number ?? 0,
        customerName: order.customer_name || undefined,
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
        note: order.note || undefined,
        printed: order.printed === 1,
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        items: items.map(i => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          price: i.price,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
      });
    }
    
    return result;
  },
  
  /**
   * Search orders across all dates
   */
  async searchOrders(query: string, limit: number = 50): Promise<OfflineOrder[]> {
    const database = await getDatabase();
    const searchPattern = `%${query}%`;
    
    const orders = await database.getAllAsync<{
      id: string;
      order_number: number;
      table_number: number | null;
      customer_name: string | null;
      status: string;
      total_amount: number;
      payment_method: string | null;
      discount: number;
      discount_type: string | null;
      amount_received: number | null;
      change_amount: number | null;
      note: string | null;
      printed: number;
      created_at: string;
      paid_at: string | null;
    }>(`
      SELECT DISTINCT o.* FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 
        CAST(o.order_number AS TEXT) LIKE ?
        OR CAST(o.table_number AS TEXT) LIKE ?
        OR CAST(o.total_amount AS TEXT) LIKE ?
        OR oi.product_name LIKE ?
      ORDER BY o.created_at DESC
      LIMIT ?
    `, [searchPattern, searchPattern, searchPattern, searchPattern, limit]);
    
    const result: OfflineOrder[] = [];
    
    for (const order of orders) {
      const items = await database.getAllAsync<{
        id: string;
        product_id: string;
        product_name: string;
        price: number;
        quantity: number;
        note: string | null;
      }>(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      
      result.push({
        id: order.id,
        orderNumber: order.order_number,
        tableNumber: order.table_number ?? 0,
        customerName: order.customer_name || undefined,
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
        note: order.note || undefined,
        printed: order.printed === 1,
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
        items: items.map(i => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          price: i.price,
          quantity: i.quantity,
          note: i.note || undefined,
        })),
      });
    }
    
    return result;
  },
};
