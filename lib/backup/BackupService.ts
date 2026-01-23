import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { getDatabase } from '../offline-db';

// ============================================================================
// TYPES
// ============================================================================

export interface BackupData {
  version: string;
  createdAt: string;
  deviceInfo: string;
  
  // Database tables
  database: {
    categories: any[];
    products: any[];
    orders: any[];
    orderItems: any[];
    users: any[];
    settings: any[];
    expenses: any[];
    shifts: any[];
    payroll: any[];
    plannedShifts: any[];
    staffCompensation: any[];
  };
  
  // AsyncStorage data
  asyncStorage: {
    receiptDesign: any | null;
    printerConfig: any | null;
    autoPrint: string | null;
    onboardingComplete: string | null;
    // Add other important keys
    [key: string]: any;
  };
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  stats?: {
    categories: number;
    products: number;
    orders: number;
    users: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BACKUP_VERSION = '1.0.0';
const BACKUP_DIR = FileSystem.documentDirectory + 'backups/';

// AsyncStorage keys to backup
const ASYNC_STORAGE_KEYS = [
  'pos_receipt_design',
  'pos_printer_config',
  'pos_auto_print',
  '@caissapro_onboarding_complete',
  '@thermal_printer_settings',
  '@unified_printer_settings',
  '@unified_printer_active',
  '@unified_printer_auto_connect',
  '@printer_service_config',
  '@printer_service_last_device',
];

// ============================================================================
// BACKUP SERVICE
// ============================================================================

class BackupServiceClass {
  
  /**
   * Create a full backup of all app data
   */
  async createBackup(): Promise<BackupResult> {
    try {
      // Ensure backup directory exists
      const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
      }
      
      // Get database data
      const databaseData = await this.exportDatabase();
      
      // Get AsyncStorage data
      const asyncStorageData = await this.exportAsyncStorage();
      
      // Create backup object
      const backup: BackupData = {
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        deviceInfo: `${Platform.OS} ${Platform.Version}`,
        database: databaseData,
        asyncStorage: asyncStorageData,
      };
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `caissapro-backup-${timestamp}.json`;
      const filePath = BACKUP_DIR + fileName;
      
      // Write backup file
      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(backup, null, 2)
      );
      
      return {
        success: true,
        filePath,
      };
    } catch (error) {
      console.error('[BACKUP] Error creating backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
  
  /**
   * Share the backup file (for transfer to new device)
   */
  async shareBackup(filePath: string): Promise<boolean> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil.');
        return false;
      }
      
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Partager la sauvegarde CaissaPro',
        UTI: 'public.json',
      });
      
      return true;
    } catch (error) {
      console.error('[BACKUP] Error sharing backup:', error);
      return false;
    }
  }
  
  /**
   * Create and immediately share a backup
   */
  async createAndShareBackup(): Promise<BackupResult> {
    const result = await this.createBackup();
    
    if (result.success && result.filePath) {
      const shared = await this.shareBackup(result.filePath);
      if (!shared) {
        return {
          ...result,
          error: 'Sauvegarde créée mais échec du partage',
        };
      }
    }
    
    return result;
  }
  
  /**
   * Restore from a backup file
   */
  async restoreFromFile(): Promise<RestoreResult> {
    try {
      // Let user pick a backup file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return {
          success: false,
          error: 'Aucun fichier sélectionné',
        };
      }
      
      const fileUri = result.assets[0].uri;
      
      // Read and parse the backup file
      const content = await FileSystem.readAsStringAsync(fileUri);
      
      const backup: BackupData = JSON.parse(content);
      
      // Validate backup
      if (!backup.version || !backup.database) {
        return {
          success: false,
          error: 'Fichier de sauvegarde invalide',
        };
      }
      
      // Restore the data
      return await this.restoreBackup(backup);
      
    } catch (error) {
      console.error('[BACKUP] Error restoring from file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la restauration',
      };
    }
  }
  
  /**
   * Restore backup data to the app
   */
  async restoreBackup(backup: BackupData): Promise<RestoreResult> {
    try {
      const db = await getDatabase();
      
      // Start transaction for database restoration
      let stats = {
        categories: 0,
        products: 0,
        orders: 0,
        users: 0,
      };
      
      // Clear existing data first (optional - could merge instead)
      // For safety, we'll replace all data
      
      // Restore categories
      if (backup.database.categories?.length > 0) {
        await db.runAsync('DELETE FROM categories');
        for (const cat of backup.database.categories) {
          await db.runAsync(
            `INSERT OR REPLACE INTO categories (id, name, display_order, created_at, synced) 
             VALUES (?, ?, ?, ?, ?)`,
            [cat.id, cat.name, cat.display_order || 0, cat.created_at, cat.synced || 0]
          );
          stats.categories++;
        }
      }
      
      // Restore products
      if (backup.database.products?.length > 0) {
        await db.runAsync('DELETE FROM products');
        for (const prod of backup.database.products) {
          await db.runAsync(
            `INSERT OR REPLACE INTO products (id, name, price, category_id, is_active, image_url, created_at, synced) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [prod.id, prod.name, prod.price, prod.category_id, prod.is_active ?? 1, prod.image_url, prod.created_at, prod.synced || 0]
          );
          stats.products++;
        }
      }
      
      // Restore users (except default admin - preserve local PIN)
      if (backup.database.users?.length > 0) {
        // Get current admin to preserve
        const currentAdmin = await db.getFirstAsync<any>(
          'SELECT * FROM users WHERE role = ?',
          ['admin']
        );
        
        await db.runAsync('DELETE FROM users WHERE role != ?', ['admin']);
        
        for (const user of backup.database.users) {
          // Skip if it's the admin and we already have one
          if (user.role === 'admin' && currentAdmin) {
            continue;
          }
          
          await db.runAsync(
            `INSERT OR REPLACE INTO users (id, name, pin_hash, role, is_active, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [user.id, user.name, user.pin_hash, user.role, user.is_active ?? 1, user.created_at]
          );
          stats.users++;
        }
      }
      
      // Restore orders
      if (backup.database.orders?.length > 0) {
        await db.runAsync('DELETE FROM order_items');
        await db.runAsync('DELETE FROM orders');
        
        for (const order of backup.database.orders) {
          await db.runAsync(
            `INSERT OR REPLACE INTO orders (id, order_number, table_number, customer_name, status, total_amount, payment_method, discount, discount_type, created_at, synced, is_served) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              order.id, order.order_number, order.table_number || 0, order.customer_name,
              order.status, order.total_amount, order.payment_method, order.discount || 0,
              order.discount_type, order.created_at, order.synced || 0, order.is_served || 0
            ]
          );
          stats.orders++;
        }
      }
      
      // Restore order items
      if (backup.database.orderItems?.length > 0) {
        for (const item of backup.database.orderItems) {
          await db.runAsync(
            `INSERT OR REPLACE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.order_id, item.product_id, item.product_name, item.quantity, item.unit_price, item.total_price]
          );
        }
      }
      
      // Restore settings
      if (backup.database.settings?.length > 0) {
        await db.runAsync('DELETE FROM settings');
        for (const setting of backup.database.settings) {
          await db.runAsync(
            `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
            [setting.key, setting.value]
          );
        }
      }
      
      // Restore expenses
      if (backup.database.expenses?.length > 0) {
        await db.runAsync('DELETE FROM expenses');
        for (const expense of backup.database.expenses) {
          await db.runAsync(
            `INSERT OR REPLACE INTO expenses (id, description, amount, category, created_at, synced) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [expense.id, expense.description, expense.amount, expense.category, expense.created_at, expense.synced || 0]
          );
        }
      }
      
      // Restore shifts
      if (backup.database.shifts?.length > 0) {
        await db.runAsync('DELETE FROM shifts');
        for (const shift of backup.database.shifts) {
          await db.runAsync(
            `INSERT OR REPLACE INTO shifts (id, user_id, opened_at, closed_at, opening_cash, closing_cash, expected_cash, notes, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [shift.id, shift.user_id, shift.opened_at, shift.closed_at, shift.opening_cash, shift.closing_cash, shift.expected_cash, shift.notes, shift.status]
          );
        }
      }
      
      // Restore AsyncStorage data
      if (backup.asyncStorage) {
        for (const key of Object.keys(backup.asyncStorage)) {
          const value = backup.asyncStorage[key];
          if (value !== null && value !== undefined) {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            await AsyncStorage.setItem(key, stringValue);
          }
        }
      }
      
      return {
        success: true,
        stats,
      };
      
    } catch (error) {
      console.error('[BACKUP] Error restoring backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la restauration',
      };
    }
  }
  
  /**
   * Export all database tables to JSON
   */
  private async exportDatabase(): Promise<BackupData['database']> {
    const db = await getDatabase();
    
    // Helper to get all rows from a table
    const getAll = async (table: string): Promise<any[]> => {
      try {
        return await db.getAllAsync(`SELECT * FROM ${table}`);
      } catch {
        return [];
      }
    };
    
    return {
      categories: await getAll('categories'),
      products: await getAll('products'),
      orders: await getAll('orders'),
      orderItems: await getAll('order_items'),
      users: await getAll('users'),
      settings: await getAll('settings'),
      expenses: await getAll('expenses'),
      shifts: await getAll('shifts'),
      payroll: await getAll('payroll'),
      plannedShifts: await getAll('planned_shifts'),
      staffCompensation: await getAll('staff_compensation'),
    };
  }
  
  /**
   * Export AsyncStorage data
   */
  private async exportAsyncStorage(): Promise<BackupData['asyncStorage']> {
    const result: BackupData['asyncStorage'] = {
      receiptDesign: null,
      printerConfig: null,
      autoPrint: null,
      onboardingComplete: null,
    };
    
    for (const key of ASYNC_STORAGE_KEYS) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          // Try to parse as JSON, otherwise keep as string
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      } catch {
        // Skip if error
      }
    }
    
    return result;
  }
  
  /**
   * Get list of available local backups
   */
  async getLocalBackups(): Promise<{ name: string; date: string; size: number; path: string }[]> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
      if (!dirInfo.exists) {
        return [];
      }
      
      const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
      const backups = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = BACKUP_DIR + file;
          const info = await FileSystem.getInfoAsync(filePath);
          if (info.exists && !info.isDirectory) {
            backups.push({
              name: file,
              date: file.replace('caissapro-backup-', '').replace('.json', '').replace(/-/g, ':'),
              size: (info as any).size || 0,
              path: filePath,
            });
          }
        }
      }
      
      // Sort by date (newest first)
      return backups.sort((a, b) => b.name.localeCompare(a.name));
    } catch {
      return [];
    }
  }
  
  /**
   * Delete a local backup
   */
  async deleteBackup(filePath: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get backup file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Export singleton instance
export const BackupService = new BackupServiceClass();
export default BackupService;
