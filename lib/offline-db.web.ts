// Web version of offline-db using IndexedDB
// This is used when building for web/Electron

import * as Crypto from 'expo-crypto';

// IndexedDB wrapper for web
let db: IDBDatabase | null = null;
const DB_NAME = 'caissapro_offline';
const DB_VERSION = 1;

// Types (same as native version)
export interface OfflineCategory {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface OfflineProduct {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url: string | null;
  display_order: number;
  available: number;
  created_at: string;
  updated_at: string;
  synced: number;
}

export interface OfflineOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

export interface OfflineOrder {
  id: string;
  orderNumber: number;
  tableNumber: number;
  customerName: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  paymentMethod: 'cash' | 'card' | null;
  subtotal: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  changeGiven: number;
  createdAt: string;
  updatedAt: string;
  synced: number;
  items: OfflineOrderItem[];
}

// Open IndexedDB
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Create stores
      if (!database.objectStoreNames.contains('categories')) {
        const catStore = database.createObjectStore('categories', { keyPath: 'id' });
        catStore.createIndex('display_order', 'display_order');
      }
      
      if (!database.objectStoreNames.contains('products')) {
        const prodStore = database.createObjectStore('products', { keyPath: 'id' });
        prodStore.createIndex('category_id', 'category_id');
        prodStore.createIndex('display_order', 'display_order');
      }
      
      if (!database.objectStoreNames.contains('orders')) {
        const orderStore = database.createObjectStore('orders', { keyPath: 'id' });
        orderStore.createIndex('status', 'status');
        orderStore.createIndex('createdAt', 'createdAt');
      }
      
      if (!database.objectStoreNames.contains('order_items')) {
        const itemStore = database.createObjectStore('order_items', { keyPath: 'id' });
        itemStore.createIndex('order_id', 'order_id');
      }
      
      if (!database.objectStoreNames.contains('sync_queue')) {
        database.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

// Initialize database
export const initOfflineDatabase = async (): Promise<void> => {
  await openDatabase();
  console.log('[Web DB] IndexedDB initialized');
  
  // Seed demo data if empty
  await seedDemoDataIfEmpty();
};

// Seed demo data for Electron/Web version
const seedDemoDataIfEmpty = async (): Promise<void> => {
  const categories = await offlineCategoryService.getAll();
  if (categories.length > 0) {
    console.log('[Web DB] Data already exists, skipping seed');
    return;
  }
  
  console.log('[Web DB] Seeding demo data...');
  const now = new Date().toISOString();
  
  // Demo Categories
  const demoCategories: OfflineCategory[] = [
    { id: 'cat-1', name: '☕ Boissons Chaudes', display_order: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'cat-2', name: '🥤 Boissons Froides', display_order: 2, created_at: now, updated_at: now, synced: 1 },
    { id: 'cat-3', name: '🥐 Pâtisseries', display_order: 3, created_at: now, updated_at: now, synced: 1 },
    { id: 'cat-4', name: '🥪 Sandwichs', display_order: 4, created_at: now, updated_at: now, synced: 1 },
    { id: 'cat-5', name: '🍕 Plats', display_order: 5, created_at: now, updated_at: now, synced: 1 },
    { id: 'cat-6', name: '🍨 Desserts', display_order: 6, created_at: now, updated_at: now, synced: 1 },
  ];
  
  // Demo Products
  const demoProducts: OfflineProduct[] = [
    // Boissons Chaudes
    { id: 'prod-1', name: 'Espresso', price: 12, category_id: 'cat-1', image_url: null, display_order: 1, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-2', name: 'Cappuccino', price: 18, category_id: 'cat-1', image_url: null, display_order: 2, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-3', name: 'Café Latte', price: 20, category_id: 'cat-1', image_url: null, display_order: 3, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-4', name: 'Thé Menthe', price: 12, category_id: 'cat-1', image_url: null, display_order: 4, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-5', name: 'Chocolat Chaud', price: 18, category_id: 'cat-1', image_url: null, display_order: 5, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-6', name: 'Café Américain', price: 15, category_id: 'cat-1', image_url: null, display_order: 6, available: 1, created_at: now, updated_at: now, synced: 1 },
    
    // Boissons Froides
    { id: 'prod-7', name: 'Jus d\'Orange', price: 20, category_id: 'cat-2', image_url: null, display_order: 1, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-8', name: 'Smoothie Fruits', price: 28, category_id: 'cat-2', image_url: null, display_order: 2, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-9', name: 'Ice Tea', price: 18, category_id: 'cat-2', image_url: null, display_order: 3, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-10', name: 'Limonade Maison', price: 22, category_id: 'cat-2', image_url: null, display_order: 4, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-11', name: 'Eau Minérale', price: 10, category_id: 'cat-2', image_url: null, display_order: 5, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-12', name: 'Coca Cola', price: 15, category_id: 'cat-2', image_url: null, display_order: 6, available: 1, created_at: now, updated_at: now, synced: 1 },
    
    // Pâtisseries
    { id: 'prod-13', name: 'Croissant', price: 10, category_id: 'cat-3', image_url: null, display_order: 1, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-14', name: 'Pain au Chocolat', price: 12, category_id: 'cat-3', image_url: null, display_order: 2, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-15', name: 'Muffin', price: 15, category_id: 'cat-3', image_url: null, display_order: 3, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-16', name: 'Cookie', price: 12, category_id: 'cat-3', image_url: null, display_order: 4, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-17', name: 'Brownie', price: 18, category_id: 'cat-3', image_url: null, display_order: 5, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-18', name: 'Cheesecake', price: 35, category_id: 'cat-3', image_url: null, display_order: 6, available: 1, created_at: now, updated_at: now, synced: 1 },
    
    // Sandwichs
    { id: 'prod-19', name: 'Sandwich Poulet', price: 35, category_id: 'cat-4', image_url: null, display_order: 1, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-20', name: 'Sandwich Thon', price: 32, category_id: 'cat-4', image_url: null, display_order: 2, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-21', name: 'Club Sandwich', price: 42, category_id: 'cat-4', image_url: null, display_order: 3, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-22', name: 'Panini Fromage', price: 30, category_id: 'cat-4', image_url: null, display_order: 4, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-23', name: 'Wrap Végétarien', price: 35, category_id: 'cat-4', image_url: null, display_order: 5, available: 1, created_at: now, updated_at: now, synced: 1 },
    
    // Plats
    { id: 'prod-24', name: 'Salade César', price: 45, category_id: 'cat-5', image_url: null, display_order: 1, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-25', name: 'Pizza Margherita', price: 55, category_id: 'cat-5', image_url: null, display_order: 2, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-26', name: 'Pasta Carbonara', price: 50, category_id: 'cat-5', image_url: null, display_order: 3, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-27', name: 'Burger Classic', price: 55, category_id: 'cat-5', image_url: null, display_order: 4, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-28', name: 'Tajine Poulet', price: 65, category_id: 'cat-5', image_url: null, display_order: 5, available: 1, created_at: now, updated_at: now, synced: 1 },
    
    // Desserts
    { id: 'prod-29', name: 'Crème Brûlée', price: 30, category_id: 'cat-6', image_url: null, display_order: 1, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-30', name: 'Tiramisu', price: 35, category_id: 'cat-6', image_url: null, display_order: 2, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-31', name: 'Glace 2 Boules', price: 25, category_id: 'cat-6', image_url: null, display_order: 3, available: 1, created_at: now, updated_at: now, synced: 1 },
    { id: 'prod-32', name: 'Panna Cotta', price: 28, category_id: 'cat-6', image_url: null, display_order: 4, available: 1, created_at: now, updated_at: now, synced: 1 },
  ];
  
  await offlineCategoryService.bulkUpsert(demoCategories);
  await offlineProductService.bulkUpsert(demoProducts);
  
  console.log('[Web DB] Demo data seeded: 6 categories, 32 products');
};

// Category Service
export const offlineCategoryService = {
  getAll: async (): Promise<OfflineCategory[]> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('categories', 'readonly');
      const store = tx.objectStore('categories');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  
  upsert: async (category: Partial<OfflineCategory>): Promise<void> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      store.put({
        ...category,
        updated_at: new Date().toISOString(),
        synced: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  
  bulkUpsert: async (categories: Partial<OfflineCategory>[]): Promise<void> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('categories', 'readwrite');
      const store = tx.objectStore('categories');
      categories.forEach(cat => store.put({
        ...cat,
        updated_at: new Date().toISOString(),
        synced: 1,
      }));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// Product Service
export const offlineProductService = {
  getAll: async (): Promise<OfflineProduct[]> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  
  getByCategory: async (categoryId: string): Promise<OfflineProduct[]> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const index = store.index('category_id');
      const request = index.getAll(categoryId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },
  
  upsert: async (product: Partial<OfflineProduct>): Promise<void> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      store.put({
        ...product,
        updated_at: new Date().toISOString(),
        synced: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  
  bulkUpsert: async (products: Partial<OfflineProduct>[]): Promise<void> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      products.forEach(prod => store.put({
        ...prod,
        updated_at: new Date().toISOString(),
        synced: 1,
      }));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// Order Service
export const offlineOrderService = {
  create: async (order: {
    tableNumber: number;
    customerName?: string;
    status: string;
    paymentMethod?: string;
    subtotal: number;
    discount: number;
    totalAmount: number;
    amountPaid: number;
    changeGiven: number;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      notes?: string;
    }>;
  }): Promise<OfflineOrder> => {
    const database = await openDatabase();
    const orderId = await Crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Get next order number
    const orders = await offlineOrderService.getToday();
    const orderNumber = orders.length + 1;
    
    const newOrder: OfflineOrder = {
      id: orderId,
      orderNumber,
      tableNumber: order.tableNumber,
      customerName: order.customerName || null,
      status: order.status as 'pending' | 'paid' | 'cancelled',
      paymentMethod: order.paymentMethod as 'cash' | 'card' | null,
      subtotal: order.subtotal,
      discount: order.discount,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      changeGiven: order.changeGiven,
      createdAt: now,
      updatedAt: now,
      synced: 0,
      items: [],
    };
    
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['orders', 'order_items', 'sync_queue'], 'readwrite');
      
      // Save order
      tx.objectStore('orders').put(newOrder);
      
      // Save items
      const itemStore = tx.objectStore('order_items');
      order.items.forEach(async (item) => {
        const itemId = await Crypto.randomUUID();
        const orderItem: OfflineOrderItem = {
          id: itemId,
          order_id: orderId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice,
          notes: item.notes || null,
        };
        itemStore.put(orderItem);
        newOrder.items.push(orderItem);
      });
      
      // Add to sync queue
      tx.objectStore('sync_queue').put({
        type: 'order',
        action: 'create',
        data: newOrder,
        created_at: now,
      });
      
      tx.oncomplete = () => resolve(newOrder);
      tx.onerror = () => reject(tx.error);
    });
  },
  
  getToday: async (): Promise<OfflineOrder[]> => {
    const database = await openDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['orders', 'order_items'], 'readonly');
      const orderStore = tx.objectStore('orders');
      const itemStore = tx.objectStore('order_items');
      
      const request = orderStore.getAll();
      request.onsuccess = async () => {
        const allOrders = request.result || [];
        const todayOrders = allOrders.filter((o: OfflineOrder) => 
          o.createdAt.startsWith(today)
        );
        
        // Get items for each order
        const ordersWithItems = await Promise.all(todayOrders.map((order: OfflineOrder) => {
          return new Promise<OfflineOrder>((res) => {
            const itemIndex = itemStore.index('order_id');
            const itemReq = itemIndex.getAll(order.id);
            itemReq.onsuccess = () => {
              order.items = itemReq.result || [];
              res(order);
            };
            itemReq.onerror = () => {
              order.items = [];
              res(order);
            };
          });
        }));
        
        resolve(ordersWithItems);
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  getById: async (id: string): Promise<OfflineOrder | null> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['orders', 'order_items'], 'readonly');
      const orderStore = tx.objectStore('orders');
      const itemStore = tx.objectStore('order_items');
      
      const request = orderStore.get(id);
      request.onsuccess = () => {
        const order = request.result;
        if (!order) {
          resolve(null);
          return;
        }
        
        const itemIndex = itemStore.index('order_id');
        const itemReq = itemIndex.getAll(id);
        itemReq.onsuccess = () => {
          order.items = itemReq.result || [];
          resolve(order);
        };
        itemReq.onerror = () => {
          order.items = [];
          resolve(order);
        };
      };
      request.onerror = () => reject(request.error);
    });
  },
  
  updateStatus: async (id: string, status: string, paymentMethod?: string, amountPaid?: number, changeGiven?: number): Promise<void> => {
    const database = await openDatabase();
    const order = await offlineOrderService.getById(id);
    if (!order) return;
    
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['orders', 'sync_queue'], 'readwrite');
      const store = tx.objectStore('orders');
      
      const updatedOrder = {
        ...order,
        status,
        paymentMethod: paymentMethod || order.paymentMethod,
        amountPaid: amountPaid ?? order.amountPaid,
        changeGiven: changeGiven ?? order.changeGiven,
        updatedAt: new Date().toISOString(),
        synced: 0,
      };
      
      store.put(updatedOrder);
      
      tx.objectStore('sync_queue').put({
        type: 'order',
        action: 'update',
        data: updatedOrder,
        created_at: new Date().toISOString(),
      });
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  
  delete: async (id: string): Promise<void> => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(['orders', 'order_items'], 'readwrite');
      tx.objectStore('orders').delete(id);
      
      // Delete related items
      const itemStore = tx.objectStore('order_items');
      const index = itemStore.index('order_id');
      const request = index.getAllKeys(id);
      request.onsuccess = () => {
        request.result.forEach(key => itemStore.delete(key));
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

// Sync queue functions
export const getSyncQueueCount = async (): Promise<number> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sync_queue', 'readonly');
    const request = tx.objectStore('sync_queue').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const clearInvalidSyncQueueItems = async (): Promise<void> => {
  // No-op for web - handled differently
};

export const getSyncQueue = async (): Promise<any[]> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sync_queue', 'readonly');
    const request = tx.objectStore('sync_queue').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const clearSyncQueue = async (): Promise<void> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('sync_queue', 'readwrite');
    tx.objectStore('sync_queue').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
