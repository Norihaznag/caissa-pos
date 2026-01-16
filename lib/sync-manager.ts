import { supabase } from './supabase';
import {
  getSyncQueue,
  removeSyncQueueItem,
  incrementSyncAttempts,
  getSyncQueueCount,
  syncFromSupabase,
} from './offline-db';
import { categoryService, productService } from './services';
import NetInfo from '@react-native-community/netinfo';

// ============================================================================
// CONNECTIVITY CHECK
// ============================================================================

export const checkConnectivity = async (): Promise<boolean> => {
  try {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) return false;
    
    // Also try to ping Supabase
    const { error } = await supabase.from('categories').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

// ============================================================================
// SYNC TO SUPABASE (Upload pending changes)
// ============================================================================

export const syncToSupabase = async (): Promise<{
  synced: number;
  failed: number;
  pending: number;
}> => {
  const isOnline = await checkConnectivity();
  
  if (!isOnline) {
    const pending = await getSyncQueueCount();
    return { synced: 0, failed: 0, pending };
  }
  
  const queue = await getSyncQueue();
  let synced = 0;
  let failed = 0;
  
  for (const item of queue) {
    try {
      // Skip items with too many attempts
      if (item.attempts >= 5) {
        await removeSyncQueueItem(item.id);
        failed++;
        continue;
      }
      
      switch (item.tableName) {
        case 'orders':
          await syncOrder(item);
          break;
        case 'order_items':
          await syncOrderItem(item);
          break;
        default:
          console.log(`Unknown table: ${item.tableName}`);
      }
      
      await removeSyncQueueItem(item.id);
      synced++;
    } catch (error) {
      console.error(`Sync error for ${item.tableName}:`, error);
      await incrementSyncAttempts(item.id);
      failed++;
    }
  }
  
  const pending = await getSyncQueueCount();
  return { synced, failed, pending };
};

// Sync individual order to Supabase
const syncOrder = async (item: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  recordId: string;
  data: any;
}): Promise<void> => {
  const { action, recordId, data } = item;
  
  switch (action) {
    case 'CREATE':
      // First create the order
      const { error: orderError } = await supabase.from('orders').insert({
        id: recordId,
        table_id: null, // Cashier mode: no table, orders are direct counter sales
        status: data.status,
        total_amount: data.totalAmount,
        payment_method: data.paymentMethod,
        discount: data.discount,
        discount_type: data.discountType,
        amount_received: data.amountReceived,
        change_amount: data.changeAmount,
        created_at: data.createdAt,
        paid_at: data.paidAt,
      });
      
      if (orderError) throw orderError;
      
      // Then create order items
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          const { error: itemError } = await supabase.from('order_items').insert({
            id: item.id,
            order_id: recordId,
            product_id: item.productId,
            product_name: item.productName,
            price: item.price,
            quantity: item.quantity,
            note: item.note,
          });
          
          if (itemError) throw itemError;
        }
      }
      break;
      
    case 'UPDATE':
      const { error: updateError } = await supabase
        .from('orders')
        .update(data)
        .eq('id', recordId);
        
      if (updateError) throw updateError;
      break;
      
    case 'DELETE':
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', recordId);
        
      if (deleteError) throw deleteError;
      break;
  }
};

// Sync individual order item to Supabase
const syncOrderItem = async (item: {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  recordId: string;
  data: any;
}): Promise<void> => {
  const { action, recordId, data } = item;
  
  switch (action) {
    case 'CREATE':
      const { error: createError } = await supabase.from('order_items').insert({
        id: recordId,
        ...data,
      });
      if (createError) throw createError;
      break;
      
    case 'UPDATE':
      const { error: updateError } = await supabase
        .from('order_items')
        .update(data)
        .eq('id', recordId);
      if (updateError) throw updateError;
      break;
      
    case 'DELETE':
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('id', recordId);
      if (deleteError) throw deleteError;
      break;
  }
};

// ============================================================================
// SYNC FROM SUPABASE (Download products & categories)
// ============================================================================

export const syncFromServer = async (): Promise<{
  success: boolean;
  categoriesCount: number;
  productsCount: number;
}> => {
  try {
    const isOnline = await checkConnectivity();
    
    if (!isOnline) {
      return { success: false, categoriesCount: 0, productsCount: 0 };
    }
    
    // Fetch categories and products from Supabase
    const [categoriesData, productsData] = await Promise.all([
      categoryService.getAll(),
      productService.getAll(),
    ]);
    
    const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
    const safeProducts = Array.isArray(productsData) ? productsData : [];
    
    // Sync to local SQLite database
    await syncFromSupabase(safeCategories, safeProducts);
    
    return {
      success: true,
      categoriesCount: safeCategories.length,
      productsCount: safeProducts.length,
    };
  } catch (error) {
    console.error('Error syncing from server:', error);
    return { success: false, categoriesCount: 0, productsCount: 0 };
  }
};

// ============================================================================
// BACKGROUND SYNC MANAGER
// ============================================================================

let syncInterval: ReturnType<typeof setInterval> | null = null;

export const startBackgroundSync = (intervalMs: number = 30000): void => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  syncInterval = setInterval(async () => {
    try {
      const result = await syncToSupabase();
      if (result.synced > 0) {
        console.log(`Background sync: ${result.synced} items synced`);
      }
    } catch (error) {
      console.error('Background sync error:', error);
    }
  }, intervalMs);
  
  console.log(`Background sync started (interval: ${intervalMs}ms)`);
};

export const stopBackgroundSync = (): void => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('Background sync stopped');
  }
};

// ============================================================================
// FULL SYNC (Both directions)
// ============================================================================

export const performFullSync = async (): Promise<{
  uploadResult: { synced: number; failed: number; pending: number };
  downloadResult: { success: boolean; categoriesCount: number; productsCount: number };
}> => {
  // First upload pending changes
  const uploadResult = await syncToSupabase();
  
  // Then download latest data
  const downloadResult = await syncFromServer();
  
  return { uploadResult, downloadResult };
};
