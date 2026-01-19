/**
 * Database Interface - Shared types for all platforms
 */

export interface DatabaseResult {
  insertId?: number;
  rowsAffected: number;
  rows: any[];
}

export interface DatabaseConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
}

export interface DatabaseService {
  getDatabase(): Promise<DatabaseConnection>;
  initDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;
}
