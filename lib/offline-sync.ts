import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore, SyncQueueItem } from './store';
import { supabase } from './supabase';

const SYNC_QUEUE_KEY = 'pos_sync_queue';

// Generate UUID for offline orders
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Check network connectivity
export const checkConnectivity = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

// Subscribe to network changes
export const subscribeToNetworkChanges = (
  onOnline: () => void,
  onOffline: () => void
) => {
  return NetInfo.addEventListener(state => {
    if (state.isConnected) {
      onOnline();
    } else {
      onOffline();
    }
  });
};

// Save sync queue to AsyncStorage
export const saveSyncQueue = async (queue: SyncQueueItem[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving sync queue:', error);
  }
};

// Load sync queue from AsyncStorage
export const loadSyncQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading sync queue:', error);
    return [];
  }
};

// Process a single sync item
const processSyncItem = async (item: SyncQueueItem): Promise<boolean> => {
  try {
    switch (item.action) {
      case 'CREATE':
        const { error: createError } = await supabase
          .from(item.table)
          .insert(item.data);
        if (createError) throw createError;
        break;

      case 'UPDATE':
        const { error: updateError } = await supabase
          .from(item.table)
          .update(item.data)
          .eq('id', item.data.id);
        if (updateError) throw updateError;
        break;

      case 'DELETE':
        const { error: deleteError } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.data.id);
        if (deleteError) throw deleteError;
        break;
    }
    return true;
  } catch (error) {
    console.error(`Error processing sync item ${item.id}:`, error);
    return false;
  }
};

// Sync all pending items
export const syncPendingItems = async (): Promise<{
  synced: number;
  failed: number;
}> => {
  const store = useAppStore.getState();
  const queue = store.syncQueue;
  
  if (queue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const isOnline = await checkConnectivity();
  if (!isOnline) {
    return { synced: 0, failed: queue.length };
  }

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    const success = await processSyncItem(item);
    if (success) {
      store.removeFromSyncQueue(item.id);
      synced++;
    } else {
      failed++;
    }
  }

  if (synced > 0) {
    store.setLastSyncAt(new Date());
  }

  return { synced, failed };
};

// Create offline order
export const createOfflineOrder = async (order: {
  tableId: string;
  tableNumber: number;
  items: Array<{
    productId: string;
    productName: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  waiterId?: string;
}): Promise<string> => {
  const store = useAppStore.getState();
  const orderId = generateUUID();
  const now = new Date();

  const newOrder = {
    id: orderId,
    tableId: order.tableId,
    tableNumber: order.tableNumber,
    items: (order.items || []).map(item => ({
      ...item,
      id: generateUUID(),
    })),
    status: 'NEW' as const,
    totalAmount: order.totalAmount,
    createdAt: now,
    updatedAt: now,
    waiterId: order.waiterId,
  };

  // Add to local store
  store.addOrder(newOrder);

  // Add to sync queue for later sync
  store.addToSyncQueue({
    action: 'CREATE',
    table: 'orders',
    data: {
      id: orderId,
      table_id: order.tableId,
      waiter_id: order.waiterId,
      status: 'NEW',
      total_amount: order.totalAmount,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  });

  // Add order items to sync queue
  for (const item of newOrder.items) {
    store.addToSyncQueue({
      action: 'CREATE',
      table: 'order_items',
      data: {
        id: item.id,
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        price: item.price,
        quantity: item.quantity,
      },
    });
  }

  // Try to sync immediately if online
  const isOnline = await checkConnectivity();
  if (isOnline) {
    await syncPendingItems();
  }

  return orderId;
};

// Update order status offline
export const updateOrderStatusOffline = async (
  orderId: string,
  status: 'NEW' | 'PREPARING' | 'READY' | 'PAID' | 'CANCELLED'
): Promise<void> => {
  const store = useAppStore.getState();

  // Update local store
  store.updateOrderStatus(orderId, status);

  // Add to sync queue
  store.addToSyncQueue({
    action: 'UPDATE',
    table: 'orders',
    data: {
      id: orderId,
      status,
      updated_at: new Date().toISOString(),
    },
  });

  // Try to sync immediately if online
  const isOnline = await checkConnectivity();
  if (isOnline) {
    await syncPendingItems();
  }
};

// Initialize offline sync system
export const initOfflineSync = async (): Promise<void> => {
  const store = useAppStore.getState();
  
  // Load persisted sync queue
  const savedQueue = await loadSyncQueue();
  if (savedQueue.length > 0) {
    // Queue is already persisted via Zustand persist
    console.log(`Loaded ${savedQueue.length} items from sync queue`);
  }

  // Subscribe to network changes
  subscribeToNetworkChanges(
    async () => {
      console.log('Network connected - syncing pending items');
      store.setOnlineStatus(true);
      await syncPendingItems();
    },
    () => {
      console.log('Network disconnected - switching to offline mode');
      store.setOnlineStatus(false);
    }
  );

  // Initial connectivity check
  const isOnline = await checkConnectivity();
  store.setOnlineStatus(isOnline);

  if (isOnline) {
    await syncPendingItems();
  }
};
