import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// Open the database (async in SDK 54+)
let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('caissapro_offline.db');
  }
  return db;
};

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

export const initOfflineDatabase = async (): Promise<void> => {
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
  
  // Create orders table (simplified for cashier mode)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER,
      status TEXT DEFAULT 'NEW',
      total_amount REAL DEFAULT 0,
      payment_method TEXT,
      discount REAL DEFAULT 0,
      discount_type TEXT,
      amount_received REAL,
      change_amount REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
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
  
  console.log('Offline database initialized');
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
};

// ============================================================================
// ORDER OPERATIONS (Cashier Mode)
// ============================================================================

export interface OfflineOrder {
  id: string;
  orderNumber: number;
  status: 'NEW' | 'PREPARING' | 'READY' | 'PAID' | 'CANCELLED';
  totalAmount: number;
  paymentMethod?: 'cash' | 'card';
  discount: number;
  discountType?: 'percent' | 'amount';
  amountReceived?: number;
  changeAmount?: number;
  createdAt: Date;
  paidAt?: Date;
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
      `INSERT INTO orders (id, order_number, status, total_amount, payment_method, discount, discount_type, amount_received, change_amount, created_at, paid_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        order.id,
        orderNumber,
        order.status,
        order.totalAmount,
        order.paymentMethod || null,
        order.discount,
        order.discountType || null,
        order.amountReceived || null,
        order.changeAmount || null,
        order.createdAt.toISOString(),
        order.paidAt?.toISOString() || null,
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
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
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
      status: string;
      total_amount: number;
      payment_method: string | null;
      discount: number;
      discount_type: string | null;
      amount_received: number | null;
      change_amount: number | null;
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
        status: order.status as OfflineOrder['status'],
        totalAmount: order.total_amount,
        paymentMethod: order.payment_method as 'cash' | 'card' | undefined,
        discount: order.discount,
        discountType: order.discount_type as 'percent' | 'amount' | undefined,
        amountReceived: order.amount_received || undefined,
        changeAmount: order.change_amount || undefined,
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
