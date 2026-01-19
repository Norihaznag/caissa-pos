/**
 * Storage Service Interface
 * Platform-agnostic abstraction for key-value storage
 */

export interface StorageServiceInterface {
  // Basic operations
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  
  // Batch operations
  multiGet(keys: string[]): Promise<readonly [string, string | null][]>;
  multiSet(keyValuePairs: readonly [string, string][]): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  
  // Utility
  getAllKeys(): Promise<readonly string[]>;
  clear(): Promise<void>;
}

/**
 * Typed storage helper for JSON data
 */
export interface TypedStorageInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
