/**
 * defaultRolePermissions.ts
 *
 * Single shared source of truth for workspace role default permissions across all frontend components.
 * Aligned with backend/lib/defaultPermissions.js.
 */

export interface RoleActionDefaults {
  view: number;
  create: number;
  edit: number;
  del: number;
  approve: number;
  export: number;
}

export const WORKSPACE_MODULE_LIST = [
  'dashboard',
  'catalog',
  'inventory',
  'procurement',
  'production',
  'shift_log',
  'sales',
  'parties',
  'expenses',
  'locations',
  'reports',
  'settings',
  'vendor_orders',
  'customer_orders',
  'returns',
  'users',
  'billing',
  'stock_transfers',
  'ai_analytics'
] as const;

export type WorkspaceModule = typeof WORKSPACE_MODULE_LIST[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, RoleActionDefaults>> = {
  owner: {
    '*': { view: 1, create: 1, edit: 1, del: 1, approve: 1, export: 1 }
  },
  manager: {
    dashboard: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    inventory: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    procurement: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    production: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    shift_log: { view: 1, create: 1, edit: 1, del: 1, approve: 1, export: 1 },
    catalog: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    locations: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    stock_transfers: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    sales: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    parties: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    returns: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    expenses: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    reports: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    vendor_orders: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    customer_orders: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    users: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    settings: { view: 1, create: 0, edit: 1, del: 0, approve: 0, export: 0 },
    billing: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    ai_analytics: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 }
  },
  accounts: {
    dashboard: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    sales: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    procurement: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    expenses: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    reports: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    catalog: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    billing: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    inventory: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    shift_log: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    parties: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    locations: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    returns: { view: 1, create: 0, edit: 0, del: 0, approve: 1, export: 1 },
    stock_transfers: { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    ai_analytics: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 }
  },
  production_manager: {
    dashboard: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    production: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    shift_log: { view: 1, create: 1, edit: 1, del: 1, approve: 1, export: 1 },
    inventory: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    catalog: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    locations: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 0 },
    stock_transfers: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    procurement: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    reports: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    ai_analytics: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 }
  },
  sales_manager: {
    dashboard: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    sales: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    parties: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    customer_orders: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    returns: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    quotations: { view: 1, create: 1, edit: 1, del: 0, approve: 1, export: 1 },
    catalog: { view: 1, create: 1, edit: 1, del: 0, approve: 0, export: 1 },
    settings: { view: 1, create: 0, edit: 1, del: 0, approve: 0, export: 0 },
    inventory: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    shift_log: { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    reports: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 },
    stock_transfers: { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    ai_analytics: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 }
  },
  staff: {
    dashboard: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    inventory: { view: 1, create: 1, edit: 0, del: 0, approve: 0, export: 0 },
    production: { view: 1, create: 1, edit: 0, del: 0, approve: 0, export: 0 },
    shift_log: { view: 1, create: 1, edit: 0, del: 0, approve: 0, export: 0 },
    sales: { view: 1, create: 1, edit: 0, del: 0, approve: 0, export: 0 },
    stock_transfers: { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 },
    ai_analytics: { view: 1, create: 0, edit: 0, del: 0, approve: 0, export: 1 }
  }
};

/**
 * Get the effective default permission for a given role and module.
 */
export function getDefaultRolePermission(role: string, moduleName: string): RoleActionDefaults {
  if (role === 'owner' || role === 'admin') {
    return { view: 1, create: 1, edit: 1, del: 1, approve: 1, export: 1 };
  }
  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role];
  if (!roleDefaults) {
    return { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 };
  }
  return roleDefaults[moduleName] || { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 };
}
