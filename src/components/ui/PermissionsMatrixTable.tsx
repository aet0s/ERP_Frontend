import { useState, useMemo } from 'react';
import {
  Check,
  Search,
  CheckCheck,
  Shield,
  FileSpreadsheet,
  Layers,
  RotateCcw,
  Eye,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Download,
  Lock
} from 'lucide-react';
import { Button } from './Button';

export type PermissionRow = {
  role: string;
  module: string;
  can_view: number;
  can_create: number;
  can_edit: number;
  can_delete: number;
  can_approve: number;
  can_export?: number;
  [key: string]: any;
};

export const MODULE_METADATA: Record<string, { label: string; category: 'Financial' | 'Operations' | 'Sales' | 'Administration'; description: string; navPath?: string }> = {
  // Financial
  inventory: { label: 'Inventory', category: 'Financial', description: 'Stock valuation, warehouse inventory levels & stock adjustments', navPath: '/inventory' },
  expenses: { label: 'Expenses', category: 'Financial', description: 'Operational expense records, petty cash logs & payment vouchers', navPath: '/expenses' },
  reports: { label: 'Reports', category: 'Financial', description: 'Financial statements, GST reports, P&L summaries & audit trails', navPath: '/reports' },
  billing: { label: 'Billing & Subscription', category: 'Financial', description: 'Workspace ERP subscription plan, billing history & payment methods', navPath: '/settings' },

  // Operations
  procurement: { label: 'Procurement', category: 'Operations', description: 'Purchase orders, vendor bills, goods receipts (GRN) & debit notes', navPath: '/procurement' },
  production: { label: 'Production', category: 'Operations', description: 'Manufacturing orders, production batches, work orders & BOM recipes', navPath: '/production' },
  shift_log: { label: 'Shift Log', category: 'Operations', description: 'Daily shop-floor shift logs, output quantities & operator audit', navPath: '/shift-logs' },
  catalog: { label: 'Catalog & Items', category: 'Operations', description: 'Product catalog, raw materials, SKUs, specifications & pricing', navPath: '/catalog' },
  locations: { label: 'Locations', category: 'Operations', description: 'Multi-warehouse facilities, storage zones, racks & bin hierarchy', navPath: '/locations' },
  stock_transfers: { label: 'Stock Transfers', category: 'Operations', description: 'Inter-warehouse stock movements, transfers & transit tracking', navPath: '/stock-transfers' },
  vendor_orders: { label: 'Vendor Portal Orders', category: 'Operations', description: 'Purchase orders dispatched to connected portal suppliers', navPath: '/portal/orders' },

  // Sales
  sales: { label: 'Sales', category: 'Sales', description: 'Customer sales orders, GST tax invoices, shipping notes & dispatches', navPath: '/sales' },
  parties: { label: 'Parties & People', category: 'Sales', description: 'Customer accounts, vendor directory, client profiles & credit terms', navPath: '/people' },
  returns: { label: 'Returns & Cancellations', category: 'Sales', description: 'Customer return requests, inspection claims, replacements & credit notes', navPath: '/return-requests' },
  quotations: { label: 'Quotations & Estimates', category: 'Sales', description: 'Sales estimates, price quotes, customer proposals & discounts', navPath: '/sales' },
  customer_orders: { label: 'Customer Portal Orders', category: 'Sales', description: 'Orders placed online by customers via Customer Portal', navPath: '/portal/orders' },

  // Administration
  dashboard: { label: 'Dashboard', category: 'Administration', description: 'Executive business KPI summaries, cash-flow metrics & overview analytics', navPath: '/' },
  ai_analytics: { label: 'AI Analytics', category: 'Financial', description: 'AI business predictions, revenue forecasting, inventory runout & cash flow health', navPath: '/ai-analytics' },
  users: { label: 'Users & Team', category: 'Administration', description: 'Team member accounts, role assignments, passwords & invitations', navPath: '/users' },
  users_roles: { label: 'Users & Team', category: 'Administration', description: 'Team member accounts, role assignments, passwords & invitations', navPath: '/users' },
  settings: { label: 'Settings', category: 'Administration', description: 'Company profile, GSTIN, invoice numbering series & business preferences', navPath: '/settings' }
};

export const ROLE_METADATA: Record<string, { label: string; description: string; badgeColor: string }> = {
  owner: { label: 'Owner / Administrator', description: 'Full administrative rights across entire workspace', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  manager: { label: 'Operations Manager', description: 'Broad operational, production and reporting privileges', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  accounts: { label: 'Accounts Manager', description: 'Finance, sales invoicing, expenses and GST reporting', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  sales_manager: { label: 'Sales Manager', description: 'Sales orders, client accounts, dispatches & returns', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  production_manager: { label: 'Production Manager', description: 'BOM recipes, factory batches, raw materials & transfers', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  staff: { label: 'Staff / Operator', description: 'Standard day-to-day operations and logging', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' }
};

const CATEGORIES: ('All Categories' | 'Financial' | 'Operations' | 'Sales' | 'Administration')[] = [
  'All Categories',
  'Financial',
  'Operations',
  'Sales',
  'Administration'
];

const ACTION_DESCRIPTIONS = {
  can_view: { label: 'View', desc: 'Allows viewing and searching records in this module.' },
  can_create: { label: 'Create', desc: 'Permits creating new documents, batches, and entries.' },
  can_edit: { label: 'Edit', desc: 'Allows updating existing records, line items, and notes.' },
  can_delete: { label: 'Delete', desc: 'Permits deleting or cancelling draft documents.' },
  can_approve: { label: 'Approve', desc: 'Grants authority to sign-off, authorize, or finalize workflows.' },
  can_export: { label: 'Export', desc: 'Enables downloading reports, PDF documents, and CSV exports.' }
};

const isPermissionEnabled = (value: unknown): boolean => Number(value) === 1 || value === true;

import { DEFAULT_ROLE_PERMISSIONS } from '../../lib/defaultRolePermissions';

interface PermissionsMatrixTableProps {
  permissions: PermissionRow[];
  onChange: (nextPermissions: PermissionRow[]) => void;
  onSave?: () => void;
  saving?: boolean;
  title?: string;
  subtitle?: string;
}

export function PermissionsMatrixTable({
  permissions,
  onChange,
  onSave,
  saving = false,
  title = 'Internal Workspace Permissions Matrix',
  subtitle = 'Configure permissions and module access for each internal team role.'
}: PermissionsMatrixTableProps) {
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'All Categories' | 'Financial' | 'Operations' | 'Sales' | 'Administration'>('All Categories');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Save Confirmation Modal with Change Summary
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState<PermissionRow[]>([]);

  // Capture initial snapshot on mount for change diffing
  useMemo(() => {
    if (initialSnapshot.length === 0 && permissions.length > 0) {
      setInitialSnapshot(JSON.parse(JSON.stringify(permissions)));
    }
  }, [permissions]);

  // Exclude vendor and customer from internal matrix
  const internalPermissions = useMemo(() => {
    return permissions.filter((p) => p.role !== 'vendor' && p.role !== 'customer');
  }, [permissions]);

  const togglePermission = (role: string, module: string, field: string) => {
    if (role === 'owner') return; // Owner role has immutable permanent full access
    const next = permissions.map((p) => {
      if (p.role === role && p.module === module) {
        return {
          ...p,
          [field]: Number(p[field]) === 1 || p[field] === true ? 0 : 1
        };
      }
      return p;
    });
    onChange(next);
  };

  // Column-level Bulk Toggle (Select All / Deselect All for a specific action across filtered rows, excluding Owner)
  const handleColumnBulkToggle = (actionField: 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_approve' | 'can_export') => {
    const nonOwnerRows = filteredPermissions.filter((p) => p.role !== 'owner');
    const targetKeys = new Set(nonOwnerRows.map((p) => `${p.role}_${p.module}`));
    const allAlreadyChecked = nonOwnerRows.length > 0 && nonOwnerRows.every((p) => isPermissionEnabled(p[actionField]));
    const nextValue = allAlreadyChecked ? 0 : 1;

    const next = permissions.map((p) => {
      if (p.role !== 'owner' && targetKeys.has(`${p.role}_${p.module}`)) {
        return { ...p, [actionField]: nextValue };
      }
      return p;
    });
    onChange(next);
  };

  // Row-level Bulk Actions (Grant All / Revoke All for a specific role & module row)
  const handleRowBulkToggle = (role: string, module: string, grant: boolean) => {
    if (role === 'owner') return; // Owner role cannot be changed
    const val = grant ? 1 : 0;
    const next = permissions.map((p) => {
      if (p.role === role && p.module === module) {
        return {
          ...p,
          can_view: val,
          can_create: val,
          can_edit: val,
          can_delete: val,
          can_approve: val,
          can_export: val
        };
      }
      return p;
    });
    onChange(next);
  };

  // Role-level Bulk Actions
  const handleBulkSetRole = (role: string, mode: 'all' | 'read_only' | 'revoke' | 'defaults') => {
    if (mode === 'defaults') {
      const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role];
      const next = permissions.map((p) => {
        if (role !== 'all' && p.role !== role) return p;
        if (p.role === 'owner') {
          return { ...p, can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, can_approve: 1, can_export: 1 };
        }
        const def = (roleDefaults && roleDefaults[p.module]) || { view: 0, create: 0, edit: 0, del: 0, approve: 0, export: 0 };
        return {
          ...p,
          can_view: def.view,
          can_create: def.create,
          can_edit: def.edit,
          can_delete: def.del,
          can_approve: def.approve,
          can_export: def.export
        };
      });
      onChange(next);
      return;
    }

    const next = permissions.map((p) => {
      if (role !== 'all' && p.role !== role) return p;

      if (mode === 'all') {
        return {
          ...p,
          can_view: 1,
          can_create: 1,
          can_edit: 1,
          can_delete: 1,
          can_approve: 1,
          can_export: 1
        };
      } else if (mode === 'read_only') {
        return {
          ...p,
          can_view: 1,
          can_create: 0,
          can_edit: 0,
          can_delete: 0,
          can_approve: 0,
          can_export: 1
        };
      } else {
        return {
          ...p,
          can_view: 0,
          can_create: 0,
          can_edit: 0,
          can_delete: 0,
          can_approve: 0,
          can_export: 0
        };
      }
    });
    onChange(next);
  };

  // Filter permissions based on role, category, and search
  const filteredPermissions = useMemo(() => {
    return internalPermissions.filter((p) => {
      if (selectedRole !== 'all' && p.role !== selectedRole) return false;
      const meta = MODULE_METADATA[p.module] || { label: p.module, category: 'Administration', description: '' };
      if (selectedCategory !== 'All Categories' && meta.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const roleLabel = ROLE_METADATA[p.role]?.label || p.role;
        const matches =
          p.module.toLowerCase().includes(q) ||
          meta.label.toLowerCase().includes(q) ||
          meta.category.toLowerCase().includes(q) ||
          meta.description.toLowerCase().includes(q) ||
          roleLabel.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [internalPermissions, selectedRole, selectedCategory, searchQuery]);

  // Group by the 4 required categories with clean ordering
  const CATEGORY_ORDER: ('Financial' | 'Operations' | 'Sales' | 'Administration')[] = [
    'Financial',
    'Operations',
    'Sales',
    'Administration'
  ];

  const groupedByCategory = useMemo(() => {
    const map = new Map<'Financial' | 'Operations' | 'Sales' | 'Administration', PermissionRow[]>();
    CATEGORY_ORDER.forEach((cat) => map.set(cat, []));

    for (const p of filteredPermissions) {
      const meta = MODULE_METADATA[p.module] || { label: p.module, category: 'Administration', description: '' };
      const cat = meta.category;
      if (map.has(cat)) {
        map.get(cat)!.push(p);
      }
    }
    return map;
  }, [filteredPermissions]);

  // Compute changes diff for the confirmation modal
  const changesSummary = useMemo(() => {
    if (initialSnapshot.length === 0) return [];
    const changes: { role: string; module: string; action: string; type: 'added' | 'removed' }[] = [];

    const actionFields: ('can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_approve' | 'can_export')[] = [
      'can_view', 'can_create', 'can_edit', 'can_delete', 'can_approve', 'can_export'
    ];

    for (const current of internalPermissions) {
      const orig = initialSnapshot.find((s) => s.role === current.role && s.module === current.module);
      if (!orig) continue;

      for (const field of actionFields) {
        const currVal = isPermissionEnabled(current[field]);
        const origVal = isPermissionEnabled(orig[field]);
        if (currVal !== origVal) {
          const roleName = ROLE_METADATA[current.role]?.label || current.role;
          const modName = MODULE_METADATA[current.module]?.label || current.module;
          const actName = ACTION_DESCRIPTIONS[field]?.label || field;
          changes.push({
            role: roleName,
            module: modName,
            action: actName,
            type: currVal ? 'added' : 'removed'
          });
        }
      }
    }
    return changes;
  }, [internalPermissions, initialSnapshot]);

  const handleOpenConfirm = () => {
    if (changesSummary.length === 0 && onSave) {
      onSave();
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSave = () => {
    setShowConfirmModal(false);
    if (onSave) onSave();
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Shield size={16} className="text-blue-600" /> {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onSave && (
              <Button
                icon={<Check size={14} />}
                disabled={saving}
                onClick={handleOpenConfirm}
                className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                {saving ? 'Saving Changes...' : `Save Matrix Changes (${changesSummary.length})`}
              </Button>
            )}
          </div>
        </div>

        {/* Role Selector Tabs (Internal Only) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedRole('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedRole === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            All Roles ({Object.keys(ROLE_METADATA).length})
          </button>
          {Object.entries(ROLE_METADATA).map(([rKey, rMeta]) => (
            <button
              type="button"
              key={rKey}
              onClick={() => setSelectedRole(rKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                selectedRole === rKey
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span>{rMeta.label}</span>
            </button>
          ))}
        </div>

        {/* Filter bar: Search, Category, Bulk Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search modules by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-600 shrink-0 font-medium"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Bulk:</span>
            <button
              type="button"
              onClick={() => handleBulkSetRole(selectedRole, 'all')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1"
              title="Grant all available capabilities for selected role"
            >
              <CheckCheck size={12} /> Grant All
            </button>
            <button
              type="button"
              onClick={() => handleBulkSetRole(selectedRole, 'read_only')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer flex items-center gap-1"
              title="Grant View & Export only"
            >
              <FileSpreadsheet size={12} /> Read Only
            </button>
            <button
              type="button"
              onClick={() => handleBulkSetRole(selectedRole, 'defaults')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition cursor-pointer flex items-center gap-1"
              title="Reset role to recommended security defaults"
            >
              <RotateCcw size={12} /> Reset Defaults
            </button>
            <button
              type="button"
              onClick={() => handleBulkSetRole(selectedRole, 'revoke')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1"
              title="Revoke all access"
            >
              <RotateCcw size={12} /> Revoke All
            </button>
          </div>
        </div>
      </div>

      {/* Permissions Matrix Table with Sticky Headers & Tooltips */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3 w-40">ROLE</th>
                <th className="p-3 w-64">MODULE & DETAILS</th>
                
                {/* VIEW Column with Bulk Toggle & Tooltip */}
                <th className="p-3 text-center w-20">
                  <div className="flex flex-col items-center gap-1 group relative">
                    <span className="flex items-center gap-1 text-[10px]" title={ACTION_DESCRIPTIONS.can_view.desc}>
                      <Eye size={12} /> VIEW
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnBulkToggle('can_view')}
                      className="text-[9px] font-mono text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </th>

                {/* CREATE Column */}
                <th className="p-3 text-center w-20">
                  <div className="flex flex-col items-center gap-1 group relative">
                    <span className="flex items-center gap-1 text-[10px]" title={ACTION_DESCRIPTIONS.can_create.desc}>
                      <Plus size={12} /> CREATE
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnBulkToggle('can_create')}
                      className="text-[9px] font-mono text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </th>

                {/* EDIT Column */}
                <th className="p-3 text-center w-20">
                  <div className="flex flex-col items-center gap-1 group relative">
                    <span className="flex items-center gap-1 text-[10px]" title={ACTION_DESCRIPTIONS.can_edit.desc}>
                      <Edit2 size={12} /> EDIT
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnBulkToggle('can_edit')}
                      className="text-[9px] font-mono text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </th>

                {/* DELETE Column */}
                <th className="p-3 text-center w-20">
                  <div className="flex flex-col items-center gap-1 group relative">
                    <span className="flex items-center gap-1 text-[10px]" title={ACTION_DESCRIPTIONS.can_delete.desc}>
                      <Trash2 size={12} /> DELETE
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnBulkToggle('can_delete')}
                      className="text-[9px] font-mono text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </th>

                {/* APPROVE Column */}
                <th className="p-3 text-center w-20">
                  <div className="flex flex-col items-center gap-1 group relative">
                    <span className="flex items-center gap-1 text-[10px]" title={ACTION_DESCRIPTIONS.can_approve.desc}>
                      <CheckCircle2 size={12} /> APPROVE
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnBulkToggle('can_approve')}
                      className="text-[9px] font-mono text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </th>

                {/* EXPORT Column */}
                <th className="p-3 text-center w-20">
                  <div className="flex flex-col items-center gap-1 group relative">
                    <span className="flex items-center gap-1 text-[10px]" title={ACTION_DESCRIPTIONS.can_export.desc}>
                      <Download size={12} /> EXPORT
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnBulkToggle('can_export')}
                      className="text-[9px] font-mono text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      Toggle
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No permissions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                Array.from(groupedByCategory.entries()).map(([catName, rows]) => {
                  if (rows.length === 0) return null;
                  return (
                    <tr key={catName} className="contents">
                      {/* Category Sticky Group Header */}
                      <tr className="bg-slate-100/90 border-t-2 border-slate-200 sticky top-0 z-10">
                        <td colSpan={8} className="px-4 py-2.5 text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-blue-600" />
                            <span>{catName} Modules</span>
                            <span className="text-[10px] text-slate-400 font-normal">({rows.length} permission items)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {catName === 'Financial' && 'Inventory valuation, expenses, reports & billing'}
                            {catName === 'Operations' && 'Purchasing, manufacturing, items & warehouse transfers'}
                            {catName === 'Sales' && 'Orders, customers, quotes, invoicing & returns'}
                            {catName === 'Administration' && 'Dashboard, user accounts & company settings'}
                          </span>
                        </td>
                      </tr>

                      {rows.map((p) => {
                        const meta = MODULE_METADATA[p.module] || { label: p.module, category: 'Administration', description: '' };
                        const roleMeta = ROLE_METADATA[p.role] || { label: p.role, description: '', badgeColor: 'bg-slate-100 text-slate-800' };

                        const isOwner = p.role === 'owner';

                        return (
                          <tr
                            key={`${p.role}-${p.module}`}
                            className={`transition ${isOwner ? 'bg-purple-50/20 hover:bg-purple-50/40' : 'hover:bg-slate-50/90'}`}
                          >
                            <td className="p-3 align-middle">
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wide ${roleMeta.badgeColor}`}>
                                {roleMeta.label}
                              </span>
                            </td>

                            <td className="p-3 align-middle">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <strong className="text-slate-900 font-semibold text-xs leading-tight">
                                      {meta.label}
                                    </strong>
                                    {meta.navPath && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        Page: {meta.navPath}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1" title={meta.description}>
                                    {meta.description}
                                  </p>
                                </div>
                                {isOwner ? (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded shrink-0" title="Owner permissions are permanent and cannot be changed">
                                    <Lock size={10} /> Full Access (Fixed)
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleRowBulkToggle(p.role, p.module, true)}
                                      className="text-[9px] text-blue-600 hover:underline px-1"
                                      title="Grant all actions for this row"
                                    >
                                      All
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRowBulkToggle(p.role, p.module, false)}
                                      className="text-[9px] text-slate-400 hover:underline px-1"
                                      title="Revoke all actions for this row"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* View Checkbox */}
                            <td className="p-3 text-center align-middle">
                              <label className={`inline-flex items-center justify-center ${isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={isPermissionEnabled(p.can_view)}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(p.role, p.module, 'can_view')}
                                  className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isOwner ? 'cursor-not-allowed opacity-80 accent-purple-600' : 'cursor-pointer'}`}
                                  title={isOwner ? "Owner permissions are permanent and cannot be modified" : ACTION_DESCRIPTIONS.can_view.desc}
                                />
                              </label>
                            </td>

                            {/* Create Checkbox */}
                            <td className="p-3 text-center align-middle">
                              <label className={`inline-flex items-center justify-center ${isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={isPermissionEnabled(p.can_create)}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(p.role, p.module, 'can_create')}
                                  className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isOwner ? 'cursor-not-allowed opacity-80 accent-purple-600' : 'cursor-pointer'}`}
                                  title={isOwner ? "Owner permissions are permanent and cannot be modified" : ACTION_DESCRIPTIONS.can_create.desc}
                                />
                              </label>
                            </td>

                            {/* Edit Checkbox */}
                            <td className="p-3 text-center align-middle">
                              <label className={`inline-flex items-center justify-center ${isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={isPermissionEnabled(p.can_edit)}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(p.role, p.module, 'can_edit')}
                                  className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isOwner ? 'cursor-not-allowed opacity-80 accent-purple-600' : 'cursor-pointer'}`}
                                  title={isOwner ? "Owner permissions are permanent and cannot be modified" : ACTION_DESCRIPTIONS.can_edit.desc}
                                />
                              </label>
                            </td>

                            {/* Delete Checkbox */}
                            <td className="p-3 text-center align-middle">
                              <label className={`inline-flex items-center justify-center ${isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={isPermissionEnabled(p.can_delete)}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(p.role, p.module, 'can_delete')}
                                  className={`w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 ${isOwner ? 'cursor-not-allowed opacity-80 accent-purple-600' : 'cursor-pointer'}`}
                                  title={isOwner ? "Owner permissions are permanent and cannot be modified" : ACTION_DESCRIPTIONS.can_delete.desc}
                                />
                              </label>
                            </td>

                            {/* Approve Checkbox */}
                            <td className="p-3 text-center align-middle">
                              <label className={`inline-flex items-center justify-center ${isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={isPermissionEnabled(p.can_approve)}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(p.role, p.module, 'can_approve')}
                                  className={`w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 ${isOwner ? 'cursor-not-allowed opacity-80 accent-purple-600' : 'cursor-pointer'}`}
                                  title={isOwner ? "Owner permissions are permanent and cannot be modified" : ACTION_DESCRIPTIONS.can_approve.desc}
                                />
                              </label>
                            </td>

                            {/* Export Checkbox */}
                            <td className="p-3 text-center align-middle">
                              <label className={`inline-flex items-center justify-center ${isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={isPermissionEnabled(p.can_export)}
                                  disabled={isOwner}
                                  onChange={() => togglePermission(p.role, p.module, 'can_export')}
                                  className={`w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${isOwner ? 'cursor-not-allowed opacity-80 accent-purple-600' : 'cursor-pointer'}`}
                                  title={isOwner ? "Owner permissions are permanent and cannot be modified" : ACTION_DESCRIPTIONS.can_export.desc}
                                />
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Confirmation & Changes Diff Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base pb-3 border-b border-slate-100">
              <Shield className="text-blue-600" size={20} />
              <h4>Confirm Permissions Matrix Updates</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are updating internal role authorizations for your workspace. Review the summary of changes below:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
              {changesSummary.length === 0 ? (
                <div className="text-slate-500 text-center py-4">No permission changes detected.</div>
              ) : (
                changesSummary.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg bg-white border border-slate-100 shadow-2xs">
                    <div>
                      <strong className="text-slate-800 font-semibold">{c.role}</strong>
                      <span className="text-slate-400 mx-1.5">→</span>
                      <span className="text-slate-600">{c.module}</span>
                    </div>
                    <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                      c.type === 'added' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {c.type === 'added' ? `+ Grant ${c.action}` : `- Revoke ${c.action}`}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-xs px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={saving}
                onClick={handleConfirmSave}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs"
              >
                {saving ? 'Saving...' : 'Confirm & Apply Updates'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
