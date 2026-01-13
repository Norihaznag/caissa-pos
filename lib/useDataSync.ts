import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from './store';
import { 
  userService, 
  categoryService, 
  productService, 
  tableService, 
  orderService,
  orderItemService 
} from './services';
import { supabase } from './supabase';

interface DataSyncState {
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  lastSyncAt: Date | null;
}

export function useDataSync() {
  const [state, setState] = useState<DataSyncState>({
    isLoading: false,
    isInitialized: false,
    error: null,
    lastSyncAt: null,
  });

  const store = useAppStore();

  // Sync all data from Supabase to local store
  const syncAll = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      // Fetch all data in parallel
      const [categoriesDb, productsDb, tablesDb, ordersDb] = await Promise.all([
        categoryService.getAll(),
        productService.getAll(),
        tableService.getAll(),
        orderService.getToday(),
      ]);

      // Transform categories
      const categories = categoriesDb.map(c => ({
        id: c.id,
        name: c.name,
        order: c.display_order,
      }));

      // Transform products
      const products = productsDb.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        categoryId: p.category_id,
        isActive: p.is_active,
      }));

      // Transform tables and fetch active order totals
      const tables = await Promise.all(
        tablesDb.map(async (t) => {
          let activeOrderTotal = 0;
          if (t.current_order_id) {
            const order = await orderService.getById(t.current_order_id);
            if (order) {
              activeOrderTotal = order.total_amount;
            }
          }
          return {
            id: t.id,
            number: t.number,
            status: t.status,
            currentOrderId: t.current_order_id || undefined,
            activeOrderTotal: activeOrderTotal || undefined,
          };
        })
      );

      // Transform orders and fetch order items
      const orders = await Promise.all(
        ordersDb.map(async (o) => {
          const itemsDb = await orderItemService.getByOrderId(o.id);
          const table = tablesDb.find(t => t.id === o.table_id);
          
          return {
            id: o.id,
            tableId: o.table_id,
            tableNumber: table?.number || 0,
            items: itemsDb.map(i => ({
              id: i.id,
              productId: i.product_id,
              productName: i.product_name,
              price: i.price,
              quantity: i.quantity,
            })),
            status: o.status,
            isServed: o.is_served || false,
            totalAmount: o.total_amount,
            createdAt: new Date(o.created_at),
            updatedAt: new Date(o.updated_at),
            waiterId: o.waiter_id || undefined,
          };
        })
      );

      // Update store
      store.setCategories(categories);
      store.setProducts(products);
      store.setTables(tables);
      store.setOrders(orders);
      store.setLastSyncAt(new Date());

      setState({
        isLoading: false,
        isInitialized: true,
        error: null,
        lastSyncAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error('Sync error:', error);
      setState(s => ({
        ...s,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur de synchronisation',
      }));
      return false;
    }
  }, [store]);

  // Check connection to Supabase
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.from('categories').select('id').limit(1);
      if (error) throw error;
      store.setOnlineStatus(true);
      return true;
    } catch {
      store.setOnlineStatus(false);
      return false;
    }
  }, [store]);

  // Initial sync on mount
  useEffect(() => {
    const init = async () => {
      const isConnected = await checkConnection();
      if (isConnected) {
        await syncAll();
      } else {
        // Use cached data if available
        setState(s => ({ 
          ...s, 
          isInitialized: true,
          error: 'Mode hors ligne - données locales utilisées' 
        }));
      }
    };

    init();
  }, []);

  return {
    ...state,
    syncAll,
    checkConnection,
  };
}

// Hook for real-time subscriptions
export function useRealtimeSubscription(table: string, onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onUpdate]);
}
