import { supabase, DbUser, DbCategory, DbProduct, DbTable, DbOrder, DbOrderItem } from './supabase';

// Re-export types for convenience
export type { DbUser, DbCategory, DbProduct, DbTable, DbOrder, DbOrderItem };

// ============================================================================
// USER SERVICE
// ============================================================================

export const userService = {
  async authenticateByPin(pin: string): Promise<DbUser | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('pin', pin)
      .eq('is_active', true)
      .single();
    
    if (error || !data) return null;
    return data;
  },

  async getAll(): Promise<DbUser[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async create(user: Omit<DbUser, 'id' | 'created_at'>): Promise<DbUser> {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, user: Partial<DbUser>): Promise<DbUser> {
    const { data, error } = await supabase
      .from('users')
      .update(user)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================================================
// CATEGORY SERVICE
// ============================================================================

export const categoryService = {
  async getAll(): Promise<DbCategory[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order');
    
    if (error) throw error;
    return data || [];
  },

  async create(category: Omit<DbCategory, 'id' | 'created_at'>): Promise<DbCategory> {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, category: Partial<DbCategory>): Promise<DbCategory> {
    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================================================
// PRODUCT SERVICE
// ============================================================================

export const productService = {
  async getAll(): Promise<DbProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async getByCategory(categoryId: string): Promise<DbProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async create(product: Omit<DbProduct, 'id' | 'created_at'>): Promise<DbProduct> {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, product: Partial<DbProduct>): Promise<DbProduct> {
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================================================
// IMAGE UPLOAD SERVICE
// ============================================================================

export const imageService = {
  async uploadProductImage(uri: string, productId: string): Promise<string | null> {
    try {
      // Get the file extension
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Read the file as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to array buffer
      const arrayBuffer = await new Response(blob).arrayBuffer();

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  },

  async deleteProductImage(imageUrl: string): Promise<void> {
    try {
      // Extract the file path from the URL
      const urlParts = imageUrl.split('/product-images/');
      if (urlParts.length < 2) return;
      
      const filePath = urlParts[1];
      
      await supabase.storage
        .from('product-images')
        .remove([filePath]);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  },
};

// ============================================================================
// TABLE SERVICE
// ============================================================================

export const tableService = {
  async getAll(): Promise<DbTable[]> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('number');
    
    if (error) throw error;
    return data || [];
  },

  async create(table: Omit<DbTable, 'id' | 'created_at'>): Promise<DbTable> {
    const { data, error } = await supabase
      .from('tables')
      .insert(table)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, table: Partial<DbTable>): Promise<DbTable> {
    const { data, error } = await supabase
      .from('tables')
      .update(table)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async setOccupied(id: string, orderId: string): Promise<void> {
    const { error } = await supabase
      .from('tables')
      .update({ status: 'occupied', current_order_id: orderId })
      .eq('id', id);
    
    if (error) throw error;
  },

  async setOpen(id: string): Promise<void> {
    const { error } = await supabase
      .from('tables')
      .update({ status: 'open', current_order_id: null })
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================================================
// ORDER SERVICE
// ============================================================================

export const orderService = {
  async getAll(): Promise<DbOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getToday(): Promise<DbOrder[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getPending(): Promise<DbOrder[]> {
    // Waiter sees all orders that haven't been paid or cancelled
    // This includes NEW, PREPARING, READY orders (even if served)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['NEW', 'PREPARING', 'READY'])
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Get orders for kitchen display (NEW, PREPARING, READY - not served)
  async getForKitchen(): Promise<DbOrder[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('is_served', false)
      .in('status', ['NEW', 'PREPARING', 'READY'])
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<DbOrder | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  },

  async create(order: Omit<DbOrder, 'id' | 'created_at' | 'updated_at'>): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: DbOrder['status']): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async cancelOrder(id: string, reason?: string): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: 'CANCELLED', 
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async markServed(id: string): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ is_served: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<Omit<DbOrder, 'id' | 'created_at'>>): Promise<DbOrder> {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================================================
// ORDER ITEMS SERVICE
// ============================================================================

export const orderItemService = {
  async getByOrderId(orderId: string): Promise<DbOrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    
    if (error) throw error;
    return data || [];
  },

  async create(item: Omit<DbOrderItem, 'id' | 'created_at'>): Promise<DbOrderItem> {
    const { data, error } = await supabase
      .from('order_items')
      .insert(item)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async createMany(items: Omit<DbOrderItem, 'id' | 'created_at'>[]): Promise<DbOrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .insert(items)
      .select();
    
    if (error) throw error;
    return data || [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================================================
// REPORTS SERVICE
// ============================================================================

export const reportsService = {
  async getDailyReport(date: Date = new Date()): Promise<{
    totalOrders: number;
    totalRevenue: number;
    orders: DbOrder[];
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .in('status', ['PAID', 'READY', 'NEW', 'PREPARING']); // All non-cancelled orders for stats
    
    if (error) throw error;
    
    const orders = data || [];
    // Only count PAID orders for revenue
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total_amount, 0);
    
    return {
      totalOrders: orders.length,
      totalRevenue,
      orders,
    };
  },

  // End of day cash report with payment breakdown
  async getEndOfDayReport(date: Date = new Date()): Promise<{
    totalOrders: number;
    paidOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    cashRevenue: number;
    cardRevenue: number;
    totalDiscounts: number;
    avgOrderValue: number;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get all orders for the day
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());
    
    if (ordersError) throw ordersError;
    
    const orders = ordersData || [];
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
    
    // Calculate revenue by payment method
    const cashOrders = paidOrders.filter(o => o.payment_method === 'cash');
    const cardOrders = paidOrders.filter(o => o.payment_method === 'card');
    
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const cashRevenue = cashOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const cardRevenue = cardOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalDiscounts = paidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    
    // Get top products
    const paidOrderIds = paidOrders.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('product_name, quantity, price')
      .in('order_id', paidOrderIds.length > 0 ? paidOrderIds : ['none']);
    
    const items = itemsData || [];
    const productMap = new Map<string, { quantity: number; revenue: number }>();
    
    items.forEach(item => {
      const existing = productMap.get(item.product_name) || { quantity: 0, revenue: 0 };
      productMap.set(item.product_name, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.price * item.quantity),
      });
    });
    
    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    
    return {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      cashRevenue,
      cardRevenue,
      totalDiscounts,
      avgOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
      topProducts,
    };
  },
};
