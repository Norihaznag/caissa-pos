import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAppStore } from './store';

// Real-time subscription for orders (Kitchen view)
export const useRealtimeOrders = () => {
  const { addOrder, updateOrderStatus } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to orders changes
    const channel = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('New order received:', payload);
          // Fetch the full order with items
          fetchOrderWithItems(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('Order updated:', payload);
          updateOrderStatus(payload.new.id, payload.new.status);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrderWithItems = async (orderId: string) => {
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Get table number
      const { data: table } = await supabase
        .from('tables')
        .select('number')
        .eq('id', order.table_id)
        .single();

      addOrder({
        id: order.id,
        tableId: order.table_id,
        tableNumber: table?.number || 0,
        items: (items || []).map((item: any) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          price: item.price,
          quantity: item.quantity,
        })),
        status: order.status,
        isServed: order.is_served || false,
        totalAmount: order.total_amount,
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        waiterId: order.waiter_id,
      });
    } catch (error) {
      console.error('Error fetching order:', error);
    }
  };

  return { isConnected };
};

// Real-time subscription for tables status
export const useRealtimeTables = () => {
  const { updateTable } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('tables-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tables',
        },
        (payload) => {
          console.log('Table updated:', payload);
          updateTable(payload.new.id, {
            status: payload.new.status,
            currentOrderId: payload.new.current_order_id,
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { isConnected };
};

// Hook to play sound notification for new orders
export const useOrderNotification = () => {
  const orders = useAppStore((state) => state.orders);
  const [lastOrderCount, setLastOrderCount] = useState(orders.length);

  useEffect(() => {
    const newOrders = orders.filter((o) => o.status === 'NEW');
    
    if (newOrders.length > lastOrderCount) {
      // New order received - play notification sound
      playNotificationSound();
    }
    
    setLastOrderCount(newOrders.length);
  }, [orders]);

  const playNotificationSound = () => {
    // TODO: Implement using expo-av
    // Audio.Sound.createAsync(require('../assets/sounds/notification.mp3'))
    //   .then(({ sound }) => sound.playAsync());
    console.log('🔔 New order notification!');
  };
};
