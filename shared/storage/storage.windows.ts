/**
 * Windows Storage Service
 * Uses @react-native-async-storage/async-storage which supports Windows
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageServiceInterface, TypedStorageInterface } from './storage.interface';

class WindowsStorageService implements StorageServiceInterface {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('[WindowsStorage] getItem error:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('[WindowsStorage] setItem error:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('[WindowsStorage] removeItem error:', error);
      throw error;
    }
  }

  async multiGet(keys: string[]): Promise<readonly [string, string | null][]> {
    try {
      return await AsyncStorage.multiGet(keys);
    } catch (error) {
      console.error('[WindowsStorage] multiGet error:', error);
      return keys.map(k => [k, null] as [string, string | null]);
    }
  }

  async multiSet(keyValuePairs: readonly [string, string][]): Promise<void> {
    try {
      await AsyncStorage.multiSet(keyValuePairs as [string, string][]);
    } catch (error) {
      console.error('[WindowsStorage] multiSet error:', error);
      throw error;
    }
  }

  async multiRemove(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('[WindowsStorage] multiRemove error:', error);
      throw error;
    }
  }

  async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('[WindowsStorage] getAllKeys error:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('[WindowsStorage] clear error:', error);
      throw error;
    }
  }
}

/**
 * Typed storage wrapper for JSON serialization
 */
class TypedStorage implements TypedStorageInterface {
  private storage: StorageServiceInterface;

  constructor(storage: StorageServiceInterface) {
    this.storage = storage;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.storage.getItem(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[TypedStorage] get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.storage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('[TypedStorage] set error:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.storage.removeItem(key);
  }
}

// Export singleton instances
export const storageService = new WindowsStorageService();
export const typedStorage = new TypedStorage(storageService);

export default storageService;
