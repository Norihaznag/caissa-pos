import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type UserRole = 'admin' | 'waiter' | 'kitchen' | null;

export interface User {
  id: string;
  name: string;
  pin: string;
  role: UserRole;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  isActive: boolean;
}

export interface Table {
  id: string;
  number: number;
  status: 'open' | 'occupied';
  currentOrderId?: string;
  activeOrderTotal?: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  note?: string;
}

export type OrderStatus = 'NEW' | 'PREPARING' | 'READY' | 'PAID' | 'CANCELLED';

export interface Order {
  id: string;
  tableId: string;
  tableNumber: number;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  waiterId?: string;
  waiterName?: string;
  paymentMethod?: 'cash' | 'card';
  paidAt?: Date;
  discount?: number;
  discountType?: 'percent' | 'amount';
}

export interface SyncQueueItem {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  data: any;
  createdAt: Date;
  retries: number;
}

// Store State
interface AppState {
  // User session
  user: User | null;
  isAuthenticated: boolean;
  
  // Data
  categories: Category[];
  products: Product[];
  tables: Table[];
  orders: Order[];
  
  // Sync
  syncQueue: SyncQueueItem[];
  isOnline: boolean;
  lastSyncAt: Date | null;
  
  // Actions - Auth
  login: (user: User) => void;
  logout: () => void;
  
  // Actions - Categories
  setCategories: (categories: Category[]) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  
  // Actions - Products
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  // Actions - Tables
  setTables: (tables: Table[]) => void;
  addTable: (table: Table) => void;
  updateTable: (id: string, data: Partial<Table>) => void;
  deleteTable: (id: string) => void;
  
  // Actions - Orders
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, data: Partial<Order>) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  getOrderByTable: (tableNumber: number) => Order | undefined;
  getActiveOrderByTable: (tableNumber: number) => Order | undefined;
  
  // Actions - Complete flows
  createOrderAndOccupyTable: (order: Order, tableId: string) => void;
  completePaymentAndFreeTable: (orderId: string, tableId: string, paymentData: { method: 'cash' | 'card'; discount?: number; discountType?: 'percent' | 'amount' }) => void;
  cancelOrderAndFreeTable: (orderId: string, tableId: string) => void;
  
  // Actions - Sync
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>) => void;
  removeFromSyncQueue: (id: string) => void;
  clearSyncQueue: () => void;
  setOnlineStatus: (isOnline: boolean) => void;
  setLastSyncAt: (date: Date) => void;
}

// Generate UUID
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      isAuthenticated: false,
      categories: [],
      products: [],
      tables: [],
      orders: [],
      syncQueue: [],
      isOnline: true,
      lastSyncAt: null,

      // Auth Actions
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),

      // Category Actions
      setCategories: (categories) => set({ categories }),
      addCategory: (category) => set((state) => ({ 
        categories: [...state.categories, category] 
      })),
      updateCategory: (id, data) => set((state) => ({
        categories: state.categories.map((c) => 
          c.id === id ? { ...c, ...data } : c
        ),
      })),
      deleteCategory: (id) => set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      })),

      // Product Actions
      setProducts: (products) => set({ products }),
      addProduct: (product) => set((state) => ({ 
        products: [...state.products, product] 
      })),
      updateProduct: (id, data) => set((state) => ({
        products: state.products.map((p) => 
          p.id === id ? { ...p, ...data } : p
        ),
      })),
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      })),

      // Table Actions
      setTables: (tables) => set({ tables }),
      addTable: (table) => set((state) => ({ 
        tables: [...state.tables, table] 
      })),
      updateTable: (id, data) => set((state) => ({
        tables: state.tables.map((t) => 
          t.id === id ? { ...t, ...data } : t
        ),
      })),
      deleteTable: (id) => set((state) => ({
        tables: state.tables.filter((t) => t.id !== id),
      })),

      // Order Actions
      setOrders: (orders) => set({ orders }),
      addOrder: (order) => set((state) => ({ 
        orders: [...state.orders, order] 
      })),
      updateOrder: (id, data) => set((state) => ({
        orders: state.orders.map((o) => 
          o.id === id ? { ...o, ...data, updatedAt: new Date() } : o
        ),
      })),
      updateOrderStatus: (id, status) => set((state) => ({
        orders: state.orders.map((o) => 
          o.id === id ? { ...o, status, updatedAt: new Date() } : o
        ),
      })),
      
      getOrderByTable: (tableNumber) => {
        return get().orders.find(o => o.tableNumber === tableNumber);
      },
      
      getActiveOrderByTable: (tableNumber) => {
        return get().orders.find(o => 
          o.tableNumber === tableNumber && 
          !['PAID', 'CANCELLED'].includes(o.status)
        );
      },
      
      // Complete Flow Actions
      createOrderAndOccupyTable: (order, tableId) => set((state) => ({
        orders: [...state.orders, order],
        tables: state.tables.map((t) => 
          t.id === tableId 
            ? { ...t, status: 'occupied' as const, currentOrderId: order.id, activeOrderTotal: order.totalAmount }
            : t
        ),
      })),
      
      completePaymentAndFreeTable: (orderId, tableId, paymentData) => set((state) => ({
        orders: state.orders.map((o) => 
          o.id === orderId 
            ? { 
                ...o, 
                status: 'PAID' as OrderStatus, 
                paymentMethod: paymentData.method,
                discount: paymentData.discount,
                discountType: paymentData.discountType,
                paidAt: new Date(),
                updatedAt: new Date() 
              } 
            : o
        ),
        tables: state.tables.map((t) => 
          t.id === tableId 
            ? { ...t, status: 'open' as const, currentOrderId: undefined, activeOrderTotal: undefined }
            : t
        ),
      })),
      
      cancelOrderAndFreeTable: (orderId, tableId) => set((state) => ({
        orders: state.orders.map((o) => 
          o.id === orderId 
            ? { ...o, status: 'CANCELLED' as OrderStatus, updatedAt: new Date() } 
            : o
        ),
        tables: state.tables.map((t) => 
          t.id === tableId 
            ? { ...t, status: 'open' as const, currentOrderId: undefined, activeOrderTotal: undefined }
            : t
        ),
      })),

      // Sync Actions
      addToSyncQueue: (item) => set((state) => ({
        syncQueue: [...state.syncQueue, {
          ...item,
          id: generateId(),
          createdAt: new Date(),
          retries: 0,
        }],
      })),
      removeFromSyncQueue: (id) => set((state) => ({
        syncQueue: state.syncQueue.filter((item) => item.id !== id),
      })),
      clearSyncQueue: () => set({ syncQueue: [] }),
      setOnlineStatus: (isOnline) => set({ isOnline }),
      setLastSyncAt: (date) => set({ lastSyncAt: date }),
    }),
    {
      name: 'pos-maroc-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        categories: state.categories,
        products: state.products,
        tables: state.tables,
        orders: state.orders,
        syncQueue: state.syncQueue,
      }),
    }
  )
);
