import type { ReactNode } from 'react';

export type Role = 'owner' | 'accounts' | 'production_manager' | 'sales_manager' | 'vendor' | 'customer' | 'admin' | 'manager' | 'staff';
export type ID = string;

export type PermissionRecord = {
  module: string;
  can_view: number | boolean;
  can_create?: number | boolean;
  can_edit?: number | boolean;
  can_delete?: number | boolean;
  can_approve?: number | boolean;
  can_export?: number | boolean;
};

export type UserSummary = {
  id: ID;
  workspace_id: ID;
  name?: string;
  email: string;
  role: Role;
  roles?: Role[] | string[];
  permissions?: PermissionRecord[];
  is_primary_owner?: boolean;
};

export type Workspace = {
  id: ID;
  name: string;
  company_code?: string;
  connect_code?: string | null;
  business_type?: string | null;
  currency: string;
  number_system?: 'indian' | 'international' | string;
  plan?: string;
  status?: string;
  logo_url?: string | null;
  accent_color?: string | null;
  onboarding_completed_at?: string | null;
};

export type AnyRow = Record<string, any> & { id?: ID };
export type ListMeta = { page: number; page_size: number; total: number; total_pages: number };
export type ListEnvelope<T> = { items: T[]; meta: ListMeta; summary?: Record<string, any> };
export type SelectOption = {
  id: ID;
  name: string;
  unit?: string;
  default_price?: number | string | null;
  reorder_level?: number | string | null;
  available_stock?: number | string;
  input_material_type?: string;
};
export type TableColumn<T extends AnyRow> = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
};
