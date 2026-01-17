// ============================================================================
// ROLE PERMISSIONS SYSTEM
// ============================================================================

export type UserRole = 'admin' | 'cashier' | 'waiter';

export type Permission = 
  // Sales & Orders
  | 'create_order'
  | 'cancel_order'
  | 'apply_discount'
  | 'void_item'
  | 'refund_order'
  // Reports
  | 'view_daily_report'
  | 'print_daily_report'
  | 'view_all_orders'
  // Stock
  | 'view_stock'
  | 'manage_stock'
  // Settings
  | 'access_admin_panel'
  | 'manage_products'
  | 'manage_categories'
  | 'manage_users'
  | 'manage_expenses'
  | 'configure_printer'
  | 'configure_receipt_design'
  | 'view_analytics';

// Define permissions for each role
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    // Settings and configuration only
    'access_admin_panel',
    'manage_products',
    'manage_categories',
    'manage_users',
    'manage_expenses',
    'configure_printer',
    'configure_receipt_design',
    'view_analytics',
    // Printing capability
    'print_daily_report',
    'view_daily_report', // Needed to print reports
  ],
  
  cashier: [
    // Sales operations
    'create_order',
    'cancel_order',
    'apply_discount',
    'void_item',
    'refund_order',
    // Daily operations
    'view_daily_report',
    'view_all_orders',
    'view_stock',
  ],
  
  waiter: [
    // Basic order operations
    'create_order',
    'void_item', // Can remove items from own orders
    'view_stock', // Can see what's available
  ],
};

// Check if a role has a specific permission
export const hasPermission = (role: UserRole | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
};

// Check if a role has any of the specified permissions
export const hasAnyPermission = (role: UserRole | undefined, permissions: Permission[]): boolean => {
  if (!role) return false;
  return permissions.some(p => hasPermission(role, p));
};

// Check if a role has all of the specified permissions
export const hasAllPermissions = (role: UserRole | undefined, permissions: Permission[]): boolean => {
  if (!role) return false;
  return permissions.every(p => hasPermission(role, p));
};

// Get all permissions for a role
export const getPermissions = (role: UserRole): Permission[] => {
  return rolePermissions[role] || [];
};

// Get human-readable permission labels (French)
export const permissionLabels: Record<Permission, string> = {
  // Sales & Orders
  create_order: 'Créer une commande',
  cancel_order: 'Annuler une commande',
  apply_discount: 'Appliquer une remise',
  void_item: 'Supprimer un article',
  refund_order: 'Rembourser une commande',
  // Reports
  view_daily_report: 'Voir le rapport journalier',
  print_daily_report: 'Imprimer le rapport journalier',
  view_all_orders: 'Voir toutes les commandes',
  // Stock
  view_stock: 'Voir le stock',
  manage_stock: 'Gérer le stock',
  // Settings
  access_admin_panel: 'Accéder aux paramètres',
  manage_products: 'Gérer les produits',
  manage_categories: 'Gérer les catégories',
  manage_users: 'Gérer les utilisateurs',
  manage_expenses: 'Gérer les dépenses',
  configure_printer: 'Configurer l\'imprimante',
  configure_receipt_design: 'Personnaliser les reçus',
  view_analytics: 'Voir les statistiques',
};

// Role labels
export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  cashier: 'Caissier',
  waiter: 'Serveur',
};

// Role descriptions
export const roleDescriptions: Record<UserRole, string> = {
  admin: 'Paramètres et configuration uniquement',
  cashier: 'Gestion des ventes et consultation des rapports',
  waiter: 'Prise de commandes uniquement',
};
