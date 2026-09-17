import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { Shield, Save, RotateCcw, Building2, ShoppingBag, Eye, Plus, Edit2, Trash2, CheckCircle2, Download, Info } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface PortalPermission {
  id?: string;
  role: 'vendor' | 'customer';
  module: string;
  can_view: number | boolean;
  can_create: number | boolean;
  can_edit: number | boolean;
  can_delete: number | boolean;
  can_approve: number | boolean;
  can_export: number | boolean;
}

const VENDOR_MODULES = [
  { id: 'vendor_orders', name: 'Purchase Orders & Procurements', desc: 'Allows vendors to view, acknowledge, confirm and track incoming purchase orders from client workspaces.' },
  { id: 'delivery_challans', name: 'Delivery Challans & Dispatch', desc: 'Permits vendors to generate dispatch notes, attach tracking details and confirm shipments.' },
  { id: 'invoices', name: 'Invoices & Billing', desc: 'Allows vendors to submit commercial invoices and view payment statuses.' },
  { id: 'returns', name: 'Vendor Return & Replacement Requests', desc: 'Enables vendors to handle return items, inspect claims and respond with replacement or credit.' },
  { id: 'payments', name: 'Payment Records & Receipts', desc: 'Allows vendors to view disbursement history and download payment vouchers.' }
];

const CUSTOMER_MODULES = [
  { id: 'customer_orders', name: 'Sales Orders & Purchases', desc: 'Permits customers to track order fulfillment, download sales orders, and review past orders.' },
  { id: 'invoices', name: 'Tax Invoices & Billing', desc: 'Allows customers to view GST tax invoices and download PDF copies.' },
  { id: 'returns', name: 'Return & Refund Requests', desc: 'Enables customers to request product returns, enter reason notes, and monitor return statuses.' },
  { id: 'quotations', name: 'Price Quotations & Estimates', desc: 'Allows customers to view official price quotes and submit acceptances.' },
  { id: 'payments', name: 'Payment Receipts & Outstanding Balances', desc: 'Allows customers to view payment history and current account balance.' }
];

export function SuperAdminPortalPermissions() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'vendor' | 'customer'>('vendor');
  const [permissions, setPermissions] = useState<PortalPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/portal-permissions');
      if (Array.isArray(res.data)) {
        setPermissions(res.data);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to load platform portal permissions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const getPerm = (role: 'vendor' | 'customer', module: string): PortalPermission => {
    const found = permissions.find((p) => p.role === role && p.module === module);
    return found || {
      role,
      module,
      can_view: 0,
      can_create: 0,
      can_edit: 0,
      can_delete: 0,
      can_approve: 0,
      can_export: 0
    };
  };

  const updatePermAction = (role: 'vendor' | 'customer', module: string, action: keyof Omit<PortalPermission, 'id' | 'role' | 'module'>, val: boolean) => {
    setPermissions((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((p) => p.role === role && p.module === module);
      if (idx >= 0) {
        copy[idx] = { ...copy[idx], [action]: val ? 1 : 0 };
      } else {
        copy.push({
          role,
          module,
          can_view: action === 'can_view' ? (val ? 1 : 0) : 0,
          can_create: action === 'can_create' ? (val ? 1 : 0) : 0,
          can_edit: action === 'can_edit' ? (val ? 1 : 0) : 0,
          can_delete: action === 'can_delete' ? (val ? 1 : 0) : 0,
          can_approve: action === 'can_approve' ? (val ? 1 : 0) : 0,
          can_export: action === 'can_export' ? (val ? 1 : 0) : 0
        });
      }
      return copy;
    });
  };

  const handleGrantAll = (role: 'vendor' | 'customer') => {
    const modules = role === 'vendor' ? VENDOR_MODULES : CUSTOMER_MODULES;
    setPermissions((prev) => {
      const copy = prev.filter((p) => p.role !== role);
      modules.forEach((m) => {
        copy.push({
          role,
          module: m.id,
          can_view: 1,
          can_create: 1,
          can_edit: 1,
          can_delete: 1,
          can_approve: 1,
          can_export: 1
        });
      });
      return copy;
    });
    toast(`Granted full platform capabilities for ${role}s`, 'info');
  };

  const handleReadOnly = (role: 'vendor' | 'customer') => {
    const modules = role === 'vendor' ? VENDOR_MODULES : CUSTOMER_MODULES;
    setPermissions((prev) => {
      const copy = prev.filter((p) => p.role !== role);
      modules.forEach((m) => {
        copy.push({
          role,
          module: m.id,
          can_view: 1,
          can_create: 0,
          can_edit: 0,
          can_delete: 0,
          can_approve: 0,
          can_export: 1
        });
      });
      return copy;
    });
    toast(`Set read-only platform capabilities for ${role}s`, 'info');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/admin/portal-permissions', { permissions });
      toast('Platform Portal Permissions saved successfully!', 'success');
      await fetchPermissions();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save portal permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const activeModules = activeTab === 'vendor' ? VENDOR_MODULES : CUSTOMER_MODULES;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xl">
            <Shield className="text-blue-600" size={24} />
            <h1>Platform Portal Permissions Master Matrix</h1>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Single global source of truth for Vendor and Customer portal capabilities across all tenant workspaces.
            Workspace admins cannot override these platform-level safety guardrails.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            variant="secondary"
            onClick={fetchPermissions}
            disabled={loading || saving}
            className="flex items-center gap-2 text-xs"
          >
            <RotateCcw size={14} />
            Reload
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={loading || saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Global Permissions'}
          </Button>
        </div>
      </div>

      {/* Role Switcher Tabs */}
      <div className="flex items-center justify-between bg-white border border-slate-200/90 rounded-2xl p-2 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('vendor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'vendor'
                ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-200/60'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 size={16} />
            Vendor Portal Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'customer'
                ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-200/60'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ShoppingBag size={16} />
            Customer Portal Matrix
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 pr-2">
          <Button
            variant="ghost"
            onClick={() => handleReadOnly(activeTab)}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            Set Read-Only
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleGrantAll(activeTab)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Grant Full Access
          </Button>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {activeTab === 'vendor' ? 'Vendor Portal Capabilities' : 'Customer Portal Capabilities'}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {activeModules.length} Modules Configured
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading platform portal permissions matrix...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="py-3.5 px-4 font-semibold text-slate-700 text-xs uppercase tracking-wider w-80">
                    Module & Capability
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1.5"><Eye size={14} /> View</div>
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1.5"><Plus size={14} /> Create</div>
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1.5"><Edit2 size={14} /> Edit / Acknowledge</div>
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1.5"><Trash2 size={14} /> Delete</div>
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1.5"><CheckCircle2 size={14} /> Approve</div>
                  </th>
                  <th className="py-3.5 px-3 font-semibold text-slate-700 text-xs uppercase tracking-wider text-center">
                    <div className="flex items-center justify-center gap-1.5"><Download size={14} /> Export</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeModules.map((m) => {
                  const perm = getPerm(activeTab, m.id);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{m.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.desc}</div>
                      </td>

                      {/* Can View */}
                      <td className="py-3.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perm.can_view)}
                            onChange={(e) => updatePermAction(activeTab, m.id, 'can_view', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* Can Create */}
                      <td className="py-3.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perm.can_create)}
                            onChange={(e) => updatePermAction(activeTab, m.id, 'can_create', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* Can Edit */}
                      <td className="py-3.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perm.can_edit)}
                            onChange={(e) => updatePermAction(activeTab, m.id, 'can_edit', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* Can Delete */}
                      <td className="py-3.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perm.can_delete)}
                            onChange={(e) => updatePermAction(activeTab, m.id, 'can_delete', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* Can Approve */}
                      <td className="py-3.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perm.can_approve)}
                            onChange={(e) => updatePermAction(activeTab, m.id, 'can_approve', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>

                      {/* Can Export */}
                      <td className="py-3.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer justify-center">
                          <input
                            type="checkbox"
                            checked={Boolean(perm.can_export)}
                            onChange={(e) => updatePermAction(activeTab, m.id, 'can_export', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
