/**
 * Database Implementation - Windows
 * Uses react-native-sqlite-storage for Windows platform
 */

import SQLite from 'react-native-sqlite-storage';
import type { DatabaseConnection, DatabaseService } from './database.interface';

// Enable promise-based API
SQLite.enablePromise(true);

let db: SQLite.SQLiteDatabase | null = null;

class WindowsDatabaseConnection implements DatabaseConnection {
  private database: SQLite.SQLiteDatabase;

  constructor(database: SQLite.SQLiteDatabase) {
    this.database = database;
  }

  async execAsync(sql: string): Promise<void> {
    await this.database.executeSql(sql);
  }

  async runAsync(sql: string, params: any[] = []): Promise<{ changes: number }> {
    const [result] = await this.database.executeSql(sql, params);
    return { changes: result.rowsAffected };
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const [result] = await this.database.executeSql(sql, params);
    if (result.rows.length > 0) {
      return result.rows.item(0) as T;
    }
    return null;
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const [result] = await this.database.executeSql(sql, params);
    const rows: T[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      rows.push(result.rows.item(i) as T);
    }
    return rows;
  }
}

export const windowsDatabaseService: DatabaseService = {
  async getDatabase(): Promise<DatabaseConnection> {
    if (!db) {
      db = await SQLite.openDatabase({
        name: 'caissapro_windows.db',
        location: 'default',
      });
    }
    return new WindowsDatabaseConnection(db);
  },

  async initDatabase(): Promise<void> {
    const connection = await this.getDatabase();
    
    // Enable foreign keys
    await connection.execAsync('PRAGMA foreign_keys = ON;');
    
    // Create all required tables
    await connection.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
    `);
    
    await connection.execAsync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category_id TEXT,
        is_active INTEGER DEFAULT 1,
        image_url TEXT,
        stock_quantity INTEGER DEFAULT -1,
        low_stock_threshold INTEGER DEFAULT 10,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);
    
    await connection.execAsync(`
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
    
    await connection.execAsync(`
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
    
    await connection.execAsync(`
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
    
    await connection.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    
    await connection.execAsync(`
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
    
    // Initialize order counter if not exists
    const counter = await connection.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['order_counter']
    );
    
    if (!counter) {
      await connection.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        ['order_counter', '0']
      );
    }
    
    // Seed default admin if no users exist
    const userCount = await connection.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users'
    );
    
    if ((userCount?.count || 0) === 0) {
      const adminId = generateUUID();
      await connection.runAsync(
        'INSERT INTO users (id, name, pin, role, is_active, synced) VALUES (?, ?, ?, ?, ?, 1)',
        [adminId, 'Admin', '1234', 'admin', 1]
      );
      console.log('[Windows DB] Default admin user created (PIN: 1234)');
    }
    
    console.log('[Windows DB] Database initialized successfully');
  },

  async closeDatabase(): Promise<void> {
    if (db) {
      await db.close();
      db = null;
    }
  },
};

// Simple UUID generator for Windows
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default windowsDatabaseService;
