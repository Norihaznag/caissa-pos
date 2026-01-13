import { supabase, DbUser, DbCategory, DbProduct, DbTable, DbOrder, DbOrderItem } from './supabase';

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
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['NEW', 'PREPARING'])
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
      .in('status', ['PAID', 'READY']);
    
    if (error) throw error;
    
    const orders = data || [];
    const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
    
    return {
      totalOrders: orders.length,
      totalRevenue,
      orders,
    };
  },
};
