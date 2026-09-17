import { useEffect, useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  Check, Copy, CreditCard, Download, Moon, RefreshCw, Settings, Sun, Upload,
  Shield, Activity, FileText, ShieldCheck, ShieldAlert, CheckCircle2, Lock, Eye, Search,
  Building2, Sliders, AlertTriangle, Link2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import type { UserSummary } from '../lib/types';
import { setGlobalNumberSystem } from '../lib/utils';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { Pagination } from '../components/ui/Pagination';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { PermissionsMatrixTable } from '../components/ui/PermissionsMatrixTable';

const inputCls = "w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition";

const AUDIT_ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'approve', label: 'Approve' },
  { value: 'invite', label: 'Invite Member' },
  { value: 'login', label: 'Login' },
  { value: 'export', label: 'Data Export' }
];

const AUDIT_ENTITY_OPTIONS = [
  { value: 'all', label: 'All Entities' },
  { value: 'user', label: 'User / Member' },
  { value: 'raw_material', label: 'Raw Materials' },
  { value: 'finished_good', label: 'Finished Goods' },
  { value: 'procurement', label: 'Procurements' },
  { value: 'production_batch', label: 'Production Batches' },
  { value: 'sales', label: 'Sales & Invoices' },
  { value: 'expense', label: 'Expenses' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'customer', label: 'Customers' },
  { value: 'permissions', label: 'Permissions Matrix' },
  { value: 'workspace', label: 'Workspace Settings' }
];

export function SettingsPage({ user }: { user: UserSummary }) {
  const { workspace, reloadWorkspace } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canView, canEdit } = usePermissions('settings');

  const [activeTab, setActiveTab] = usePersistentTab<'general' | 'permissions' | 'partners' | 'billing' | 'audit' | 'danger'>(
    'workspace_settings_tab',
    'general'
  );

  const [form, setForm] = useState<Record<string, any>>({
    name: workspace?.name || '',
    connect_code: (workspace as any)?.connect_code || (workspace as any)?.company_code || '',
    business_type: workspace?.business_type || '',
    currency: workspace?.currency || 'INR',
    number_system: (workspace as any)?.number_system || 'indian',
    logo_url: workspace?.logo_url || '',
    accent_color: workspace?.accent_color || '#2563eb',
    gstin: (workspace as any)?.gstin || '',
    state: (workspace as any)?.state || 'Delhi',
    pan: (workspace as any)?.pan || '',
    rounding_method: (workspace as any)?.rounding_method || 'round_half_up',
    invoice_prefix: (workspace as any)?.invoice_prefix || 'INV-',
    reset_period: (workspace as any)?.reset_period || 'FY',
    support_email: (workspace as any)?.support_email || '',
    support_phone: (workspace as any)?.support_phone || ''
  });


  const [connectionRequests, setConnectionRequests] = useState<any[]>([]);
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);

  const [audit, setAudit] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('all');
  const [auditEntity, setAuditEntity] = useState('all');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditVerifying, setAuditVerifying] = useState(false);
  const [auditVerifyResult, setAuditVerifyResult] = useState<{
    valid?: boolean;
    verifiedCount?: number;
    headHash?: string;
    reason?: string;
  } | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  const [billing, setBilling] = useState<any>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [dark, setDark] = useState(
    localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.dataset.theme = 'light';
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const isOwnerOrManager = user.role === 'owner' || user.role === 'manager' || user.roles?.includes('owner') || user.roles?.includes('manager');
  const isOwnerOrAdmin = user.role === 'owner' || user.role === 'admin' || user.roles?.includes('owner') || user.roles?.includes('admin');

  const loadAuditLogs = async (page = 1) => {
    if (!isOwnerOrManager) return;
    try {
      const params = {
        page,
        page_size: 20,
        search: auditSearch,
        action: auditAction,
        entity_type: auditEntity,
        start_date: auditStartDate,
        end_date: auditEndDate
      };
      const res = await api.get('/api/audit-log', { params });
      setAudit(res.data.items || res.data || []);
      setAuditTotal(res.data.total || (Array.isArray(res.data) ? res.data.length : 0));
      setAuditPage(page);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch audit logs', 'error');
    }
  };



  const load = async () => {
    try {
      const calls: Promise<any>[] = [
        api.get('/api/billing'),
        api.get('/api/workspace'),
        api.get('/api/workspace/connection-requests').catch(() => ({ data: { requests: [] } }))
      ];
      if (isOwnerOrAdmin) {
        calls.push(api.get('/api/permissions'));
      }
      const [billingRes, wsRes, connRes, permRes] = await Promise.all(calls);
      setBilling(billingRes?.data || null);
      setConnectionRequests(connRes?.data?.requests || []);
      if (wsRes?.data) {
        setForm(prev => ({
          ...prev,
          name: wsRes.data.name ?? prev.name,
          connect_code: wsRes.data.connect_code ?? prev.connect_code,
          business_type: wsRes.data.business_type ?? prev.business_type,
          currency: wsRes.data.currency ?? prev.currency,
          number_system: wsRes.data.number_system ?? prev.number_system,
          logo_url: wsRes.data.logo_url ?? prev.logo_url,
          accent_color: wsRes.data.accent_color ?? prev.accent_color,
          gstin: wsRes.data.gstin ?? prev.gstin,
          state: wsRes.data.state ?? prev.state,
          pan: wsRes.data.pan ?? prev.pan,
          rounding_method: wsRes.data.rounding_method ?? prev.rounding_method,
          invoice_prefix: wsRes.data.invoice_prefix ?? prev.invoice_prefix,
          reset_period: wsRes.data.reset_period ?? prev.reset_period,
          support_email: wsRes.data.support_email ?? prev.support_email,
          support_phone: wsRes.data.support_phone ?? prev.support_phone
        }));
      }
      if (permRes) setPermissions(permRes.data || []);
    } catch { /* ignore */ }
  };

  const handleAcceptConnectionRequest = async (requestId: string) => {
    try {
      setRequestActionLoading(`accept-${requestId}`);
      const res = await api.post(`/api/workspace/connection-requests/${requestId}/accept`);
      if (res.data?.ok) {
        toast(res.data.message || 'Partner connection request approved!', 'success');
        await load();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to approve connection request', 'error');
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleDeclineConnectionRequest = async (requestId: string) => {
    try {
      setRequestActionLoading(`decline-${requestId}`);
      const res = await api.post(`/api/workspace/connection-requests/${requestId}/decline`);
      if (res.data?.ok) {
        toast(res.data.message || 'Partner connection request declined', 'info');
        await load();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to decline connection request', 'error');
    } finally {
      setRequestActionLoading(null);
    }
  };

  useEffect(() => {
    if (workspace) {
      setForm(prev => ({
        ...prev,
        name: workspace.name ?? prev.name,
        connect_code: (workspace as any)?.connect_code ?? prev.connect_code,
        business_type: workspace.business_type ?? prev.business_type,
        currency: workspace.currency ?? prev.currency,
        logo_url: workspace.logo_url ?? prev.logo_url,
        accent_color: workspace.accent_color ?? prev.accent_color,
        gstin: (workspace as any)?.gstin ?? prev.gstin,
        state: (workspace as any)?.state ?? prev.state,
        pan: (workspace as any)?.pan ?? prev.pan,
        rounding_method: (workspace as any)?.rounding_method ?? prev.rounding_method,
        invoice_prefix: (workspace as any)?.invoice_prefix ?? prev.invoice_prefix,
        reset_period: (workspace as any)?.reset_period ?? prev.reset_period,
        support_email: (workspace as any)?.support_email ?? prev.support_email,
        support_phone: (workspace as any)?.support_phone ?? prev.support_phone
      }));
    }
  }, [workspace]);

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadAuditLogs(1);
  }, [auditSearch, auditAction, auditEntity, auditStartDate, auditEndDate]);

  const verifyAuditChain = async () => {
    try {
      setAuditVerifying(true);
      const res = await api.get('/api/audit-log/verify');
      setAuditVerifyResult(res.data);
      if (res.data.valid) {
        toast(`✅ Workspace Audit Chain Validated! (${res.data.verifiedCount || 0} entries verified)`, 'success');
      } else {
        toast(`⚠️ Cryptographic Mismatch: ${res.data.reason || 'Audit log modified'}`, 'error');
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to verify cryptographic chain', 'error');
    } finally {
      setAuditVerifying(false);
    }
  };

  const exportAuditLogs = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        search: auditSearch,
        action: auditAction,
        entity_type: auditEntity,
        start_date: auditStartDate,
        end_date: auditEndDate
      });
      const res = await api.get(`/api/audit-log/export?${params}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `workspace_audit_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast(`Exported workspace audit logs as ${format.toUpperCase()}`, 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to export audit logs', 'error');
    }
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const handleCheckout = async (planName = 'pro') => {
    try {
      const res = await api.post('/api/billing/checkout', { plan: planName });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else if (res.data?.message || res.data?.simulated) {
        toast(res.data.message || 'Workspace plan upgraded to Pro!', 'success');
        await load();
        await reloadWorkspace();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to initialize checkout', 'error');
    }
  };

  const handlePortal = async () => {
    try {
      const res = await api.post('/api/billing/portal');
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else if (res.data?.message || res.data?.simulated) {
        toast(res.data.message || 'Billing portal session retrieved.', 'info');
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to open billing portal', 'error');
    }
  };

  const saveWorkspace = async () => {
    try {
      await api.put('/api/workspace', form);
      if (form.number_system) {
        setGlobalNumberSystem(form.number_system);
      }
      await reloadWorkspace();
      toast('Workspace settings saved successfully!', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save workspace settings', 'error');
    }
  };

  const handleLogoFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Logo file must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setForm((prev) => ({ ...prev, logo_url: base64 }));
      toast('Logo file uploaded successfully');
    };
    reader.readAsDataURL(file);
  };



  const downloadData = async () => {
    const res = await api.get('/api/data-export.json', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workspace_export.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const savePermissions = async () => {
    setSavingPermissions(true);
    try {
      await api.put('/api/permissions', { permissions });
      toast('Workspace role permissions updated successfully!', 'success');
      const res = await api.get('/api/permissions');
      setPermissions(res.data);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update permissions', 'error');
    } finally {
      setSavingPermissions(false);
    }
  };



  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Settings module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<Settings />}
        title="Workspace Settings & Governance"
        subtitle="Branding, team multi-role access, permissions matrix, billing, and immutable audit logs."
        action={
          canEdit ? (
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => navigate('/onboarding')}>
              Reconfigure Business
            </Button>
          ) : undefined
        }
      />

      {/* Tabs Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
            activeTab === 'general' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
          onClick={() => setActiveTab('general')}
        >
          <Building2 size={14} /> Workspace Profile
        </button>



        {isOwnerOrAdmin && (
          <button
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
              activeTab === 'permissions' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
            onClick={() => setActiveTab('permissions')}
          >
            <Shield size={14} /> Permissions Matrix
          </button>
        )}

        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
            activeTab === 'partners' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
          onClick={() => setActiveTab('partners')}
        >
          <Link2 size={14} /> Partner Proposals
          {connectionRequests.filter(r => r.status === 'Pending').length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold rounded-full text-[10px]">
              {connectionRequests.filter(r => r.status === 'Pending').length}
            </span>
          )}
        </button>

        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
            activeTab === 'billing' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
          onClick={() => setActiveTab('billing')}
        >
          <CreditCard size={14} /> Subscription & Plan
        </button>

        {(user.role === 'owner' || user.role === 'manager') && (
          <button
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
              activeTab === 'audit' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
            onClick={() => setActiveTab('audit')}
          >
            <Activity size={14} /> Audit Trail ({auditTotal})
          </button>
        )}

        <button
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer ${
            activeTab === 'danger' ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-rose-600 border border-slate-200'
          }`}
          onClick={() => setActiveTab('danger')}
        >
          <AlertTriangle size={14} /> Danger Zone
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: WORKSPACE PROFILE & BRANDING */}
      {/* ============================================================ */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            {/* COMPANY CONNECT CODE CARD */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-0.5 flex items-center gap-1.5">
                  <Link2 size={12} /> Shareable Company Connect Code
                </span>
                <p className="text-xs text-slate-600">
                  Share this unique code with vendors and customers so they can propose connections from their partner portal.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1.5 bg-white border border-blue-300 font-mono font-black text-sm text-blue-900 rounded-xl shadow-2xs">
                  {form.connect_code || workspace?.company_code || 'APEX-AUTO'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(form.connect_code || workspace?.company_code || '');
                    toast('Company Connect Code copied to clipboard!', 'success');
                  }}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer"
                  title="Copy Connect Code"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pt-2 border-t border-slate-100">
              <Building2 size={16} className="text-blue-600" /> Workspace Identity & Fiscal Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company Name">
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Company Connect Code">
                <input
                  className={`${inputCls} font-mono uppercase font-bold text-blue-900`}
                  value={form.connect_code || ''}
                  onChange={(e) => setForm({ ...form, connect_code: e.target.value.toUpperCase() })}
                  placeholder="e.g. APEX-AUTO"
                />
              </Field>
              <Field label="Business Type">
                <input className={inputCls} value={form.business_type || ''} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
              </Field>
              <Field label="Currency">
                <input className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="15-Char GSTIN Number">
                <input className={inputCls} placeholder="07AAAAA0000A1Z5" value={form.gstin || ''} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Registered State (Place of Supply)">
                <input className={inputCls} placeholder="e.g. Delhi, Maharashtra" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </Field>
              <Field label="PAN Number">
                <input className={inputCls} placeholder="ABCDE1234F" value={form.pan || ''} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
              </Field>

              <Field label="Accent Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                    value={form.accent_color || '#2563eb'}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    value={form.accent_color || '#2563eb'}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  />
                </div>
              </Field>

              <Field label="Invoice Series Prefix">
                <input className={inputCls} placeholder="INV-" value={form.invoice_prefix || 'INV-'} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} />
              </Field>

              <Field label="Rounding Engine Method">
                <Select
                  value={form.rounding_method || 'round_half_up'}
                  onChange={(val) => setForm({ ...form, rounding_method: val })}
                  options={[
                    { value: 'round_half_up', label: 'Round Half Up (0.50+ rounds up to ₹1)' },
                    { value: 'round_half_down', label: 'Round Half Down (0.50 rounds down)' },
                    { value: 'always_up', label: 'Always Round Up (Ceiling)' },
                    { value: 'always_down', label: 'Always Round Down (Floor)' },
                    { value: 'none', label: 'No Rounding (Exact Paise)' }
                  ]}
                />
              </Field>

              <Field label="Financial Year Numbering Reset">
                <Select
                  value={form.reset_period || 'FY'}
                  onChange={(val) => setForm({ ...form, reset_period: val })}
                  options={[
                    { value: 'FY', label: 'Reset Every FY (April - March)' },
                    { value: 'never', label: 'Never Reset (Continuous Numbering)' }
                  ]}
                />
              </Field>

              {/* NUMBERING & DECIMAL SYSTEM SELECTOR */}
              <div className="sm:col-span-2 p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Numbering & Decimal System
                    </label>
                    <p className="text-xs text-slate-500">
                      Choose how currency payments, line items, and quantities are grouped across the entire ERP and partner portals.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Active: {form.number_system === 'international' ? 'International' : 'Indian (Lakhs / Crores)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div
                    onClick={() => setForm({ ...form, number_system: 'indian' })}
                    className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                      (form.number_system || 'indian') === 'indian'
                        ? 'border-blue-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span className="text-base">🇮🇳</span> Indian Decimal System
                      </span>
                      {(form.number_system || 'indian') === 'indian' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      Lakhs & Crores grouping (3, 2, 2 format). Standard for Indian taxation, GST invoicing & ledger reports.
                    </p>
                    <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono flex items-center justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Format:</span>
                      <span className="font-bold text-blue-700">{form.currency || 'INR'} 12,34,567.89 • 10,00,000 units</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setForm({ ...form, number_system: 'international' })}
                    className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${
                      form.number_system === 'international'
                        ? 'border-blue-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span className="text-base">🌐</span> International Decimal System
                      </span>
                      {form.number_system === 'international' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      Thousands & Millions grouping (3, 3, 3 format). Standard for international trade and overseas entities.
                    </p>
                    <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-mono flex items-center justify-between">
                      <span className="text-slate-500 font-sans text-[11px]">Format:</span>
                      <span className="font-bold text-blue-700">{form.currency || 'INR'} 1,234,567.89 • 1,000,000 units</span>
                    </div>
                  </div>
                </div>
              </div>

              <Field label="Customer Support & Store Email">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="support@yourcompany.com"
                  value={form.support_email || ''}
                  onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Displayed on customer portal & return resolution popups</span>
              </Field>

              <Field label="Customer Helpline / Contact Number">
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="+91 98765 43210"
                  value={form.support_phone || ''}
                  onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Direct phone helpline shown to buyers and customers</span>
              </Field>

              {/* Logo URL & File Upload */}
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Company Logo</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="https://... or upload file below"
                    value={form.logo_url || ''}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<Upload size={15} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Logo
                  </Button>
                </div>

                {/* Logo Preview */}
                {form.logo_url && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs text-slate-500 font-medium">Logo Preview:</span>
                    <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 p-1 flex items-center justify-center overflow-hidden">
                      <img src={form.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {canEdit && (
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <Button icon={<Check size={16} />} onClick={saveWorkspace}>Save Profile & Branding</Button>
              </div>
            )}
          </section>

          {/* Preferences & Quick Actions */}
          <div className="space-y-6">
            <section className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={16} className="text-blue-600" /> Theme & Data Backups
              </h2>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={dark ? <Sun size={16} /> : <Moon size={16} />}
                  onClick={() => setDark(!dark)}
                >
                  {dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={<Download size={16} />}
                  onClick={downloadData}
                >
                  Export Workspace JSON
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}



      {/* ============================================================ */}
      {/* TAB 3: ROLE PERMISSIONS MATRIX */}
      {/* ============================================================ */}
      {activeTab === 'permissions' && isOwnerOrAdmin && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <PermissionsMatrixTable
            permissions={permissions}
            onChange={setPermissions}
            onSave={savePermissions}
            saving={savingPermissions}
          />
        </section>
      )}

      {/* ============================================================ */}
      {/* TAB: PARTNER PROPOSALS & NETWORK */}
      {/* ============================================================ */}
      {activeTab === 'partners' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Link2 size={16} className="text-blue-600" /> Incoming Partner Connection Proposals
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve connection requests from independent vendors and customers using your Company Connect Code.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 shrink-0">
              <span className="text-[10px] font-bold text-blue-700 uppercase">Connect Code:</span>
              <span className="font-mono font-black text-xs text-blue-950">
                {form.connect_code || workspace?.company_code || 'APEX-AUTO'}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(form.connect_code || workspace?.company_code || '');
                  toast('Company Connect Code copied!', 'success');
                }}
                className="p-1 text-blue-700 hover:text-blue-900 transition cursor-pointer"
                title="Copy"
              >
                <Copy size={13} />
              </button>
            </div>
          </div>

          {connectionRequests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Link2 size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">No Connection Proposals Yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Share your Company Connect Code <strong className="font-mono text-slate-700">{form.connect_code || workspace?.company_code}</strong> with partners so they can link with your workspace.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connectionRequests.map((req) => {
                  const isPending = req.status === 'Pending';
                  return (
                    <div
                      key={req.id}
                      className={`p-5 rounded-2xl border transition flex flex-col justify-between gap-4 ${
                        isPending
                          ? 'border-amber-200 bg-amber-50/20 shadow-xs'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            req.portal_type === 'vendor'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            Requested: {req.portal_type === 'vendor' ? 'Vendor / Supplier' : 'Customer / Buyer'}
                          </span>
                          <StatusBadge status={req.status} />
                        </div>

                        <h4 className="text-base font-bold text-slate-900">
                          {req.partner_business_name || req.name}
                        </h4>

                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <p><strong className="text-slate-400 font-semibold">Contact:</strong> {req.name} ({req.email})</p>
                          {req.phone && <p><strong className="text-slate-400 font-semibold">Phone:</strong> {req.phone}</p>}
                          {req.gstin && <p><strong className="text-slate-400 font-semibold">GSTIN:</strong> <span className="font-mono">{req.gstin}</span></p>}
                          {(req.city || req.state) && (
                            <p><strong className="text-slate-400 font-semibold">Location:</strong> {[req.city, req.state].filter(Boolean).join(', ')}</p>
                          )}
                          {req.notes && (
                            <div className="mt-2 p-2 rounded-lg bg-slate-100 text-[11px] text-slate-700">
                              <span className="font-bold text-slate-500 uppercase block text-[9px] mb-0.5">Partner Note:</span>
                              {req.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {isPending ? (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-amber-700 font-semibold">
                            Received {req.created_at ? new Date(req.created_at).toLocaleDateString() : 'recently'}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={requestActionLoading === `accept-${req.id}`}
                              onClick={() => handleAcceptConnectionRequest(req.id)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
                            >
                              Approve & Connect
                            </button>
                            <button
                              type="button"
                              disabled={requestActionLoading === `decline-${req.id}`}
                              onClick={() => handleDeclineConnectionRequest(req.id)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400">
                          Status: <strong className="text-slate-700 uppercase">{req.status}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/* TAB 4: SUBSCRIPTION & BILLING */}
      {/* ============================================================ */}
      {activeTab === 'billing' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4 max-w-2xl">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600" /> Subscription & Plan Tier
          </h2>
          {billing ? (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="font-semibold text-slate-600">Current Plan:</span>
                <StatusBadge status={billing.plan || 'trial'} />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <span className="font-semibold text-slate-600">Subscription Status:</span>
                <StatusBadge status={billing.subscription_status || 'trialing'} />
              </div>
              {billing.subscription_status === 'trialing' && (
                <p className="text-slate-500 font-medium">
                  ⏳ <strong>{billing.trial_days_remaining} day(s)</strong> remaining in free trial.
                </p>
              )}
              {billing.is_read_only && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 rounded-xl font-medium">
                  ⚠️ Workspace is operating in <strong>Read-Only</strong> mode. Upgrade to restore full write access.
                </div>
              )}
              {(user.role === 'owner' || user.role === 'manager') && (
                <div className="space-y-2 pt-2">
                  <Button className="w-full justify-center" icon={<CreditCard size={15} />} onClick={() => handleCheckout('pro')}>
                    Upgrade to Pro Plan
                  </Button>
                  <Button variant="secondary" className="w-full justify-center text-xs" onClick={handlePortal}>
                    Manage Billing & Invoices
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/* TAB 5: TAMPER-PROOF AUDIT TRAIL */}
      {/* ============================================================ */}
      {activeTab === 'audit' && (user.role === 'owner' || user.role === 'manager') && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} className="text-blue-600" /> Tamper-Proof Workspace Audit Trail
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographically hash-chained immutable activity log • {auditTotal} recorded events
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                icon={<ShieldCheck size={14} className={auditVerifyResult?.valid ? 'text-emerald-600' : 'text-slate-600'} />}
                disabled={auditVerifying}
                onClick={verifyAuditChain}
              >
                {auditVerifying ? 'Verifying...' : 'Verify Cryptographic Integrity'}
              </Button>
              <Button variant="secondary" icon={<Download size={14} />} onClick={() => exportAuditLogs('csv')}>
                Export CSV
              </Button>
              <Button variant="secondary" icon={<FileText size={14} />} onClick={() => exportAuditLogs('json')}>
                Export JSON
              </Button>
            </div>
          </div>

          {/* Verification Banner */}
          {auditVerifyResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                auditVerifyResult.valid
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/90 border-rose-200 text-rose-900'
              }`}
            >
              {auditVerifyResult.valid ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <strong className="font-bold text-xs">
                    {auditVerifyResult.valid
                      ? 'Cryptographic Audit Trail 100% Verified & Tamper-Proof'
                      : 'Integrity Check Failed'}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setAuditVerifyResult(null)}
                    className="text-xs opacity-60 hover:opacity-100 underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="mt-0.5 opacity-90">
                  {auditVerifyResult.valid
                    ? `Continuous SHA-256 hash chaining validated across all ${auditVerifyResult.verifiedCount} recorded events.`
                    : auditVerifyResult.reason || 'Cryptographic signature mismatch detected.'}
                </p>
                {auditVerifyResult.headHash && (
                  <div className="mt-1.5 font-mono text-[10px] bg-white/70 p-1.5 rounded-lg border border-emerald-200/60 truncate flex items-center gap-1">
                    <Lock size={11} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold text-emerald-800">Head Hash:</span> {auditVerifyResult.headHash}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Events</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Keyword, user, action..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Filter Action</label>
              <Select
                value={auditAction}
                onChange={setAuditAction}
                options={AUDIT_ACTION_OPTIONS}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Filter Entity</label>
              <Select
                value={auditEntity}
                onChange={setAuditEntity}
                options={AUDIT_ENTITY_OPTIONS}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
              <DatePicker
                value={auditStartDate}
                onChange={setAuditStartDate}
                placeholder="Start Date"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
              <DatePicker
                value={auditEndDate}
                onChange={setAuditEndDate}
                placeholder="End Date"
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 rounded-tl-xl">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">User / Member</th>
                  <th className="p-3">Cryptographic Proof</th>
                  <th className="p-3 text-right rounded-tr-xl">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {audit.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 whitespace-nowrap text-slate-500">
                      <div className="font-semibold text-slate-800">{new Date(row.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">{new Date(row.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-mono text-[11px] font-semibold border border-blue-200/60 capitalize">
                        {row.action}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-slate-700 capitalize">
                      {row.entity_type ? row.entity_type.replace('_', ' ') : 'System'}
                    </td>
                    <td className="p-3 text-slate-600">
                      <span className="font-semibold text-slate-900 block">{row.user_name || 'System / Automated'}</span>
                      {row.user_email && <span className="text-[10px] text-slate-400">{row.user_email}</span>}
                    </td>
                    <td className="p-3">
                      {row.hash ? (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 max-w-fit">
                          <Lock size={10} className="text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[100px]">{row.hash.slice(0, 12)}...</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Standard record</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="secondary"
                        className="py-1 px-2.5 text-xs inline-flex items-center gap-1 cursor-pointer"
                        onClick={() => setSelectedAuditLog(row)}
                      >
                        <Eye size={12} /> Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
                {audit.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No audit log entries found matching current criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={auditPage}
            totalItems={auditTotal}
            pageSize={20}
            onPageChange={(p) => loadAuditLogs(p)}
          />
        </section>
      )}

      {/* ============================================================ */}
      {/* TAB 6: DANGER ZONE */}
      {/* ============================================================ */}
      {activeTab === 'danger' && (
        <section className="bg-rose-50/60 border border-rose-200/90 rounded-2xl p-6 shadow-xs space-y-4 max-w-2xl">
          <h2 className="text-sm font-bold text-rose-900 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600" /> Danger Zone & Workspace Reset
          </h2>
          <p className="text-xs text-rose-700 leading-relaxed">
            Reconfiguring business will launch the setup wizard to re-tune manufacturing modules, currency, and primary tax locations.
          </p>
          <div className="pt-2">
            <Button
              variant="danger"
              icon={<RefreshCw size={15} />}
              onClick={() => navigate('/onboarding')}
            >
              Reconfigure Business Parameters
            </Button>
          </div>
        </section>
      )}



      {/* Audit Log Inspector Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Activity size={16} className="text-blue-600" /> Event Details & Cryptographic Audit Proof
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Record ID: {selectedAuditLog.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Action</span>
                  <span className="font-bold text-slate-900 capitalize">{selectedAuditLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Timestamp</span>
                  <span className="font-semibold text-slate-800">{new Date(selectedAuditLog.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Entity Type</span>
                  <span className="font-semibold text-slate-800 capitalize">{selectedAuditLog.entity_type || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Initiated By</span>
                  <span className="font-semibold text-slate-800">{selectedAuditLog.user_name || selectedAuditLog.user_email || 'System'}</span>
                </div>
              </div>

              {/* Cryptographic Proof */}
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl space-y-2 border border-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                  <Lock size={13} /> Tamper-Proof Cryptographic Hash Chain
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PREVIOUS HASH:</span>
                    <span className="text-slate-300 break-all">{selectedAuditLog.prev_hash || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-400 block text-[10px]">RECORD HASH (SHA-256):</span>
                    <span className="text-emerald-300 font-bold break-all">{selectedAuditLog.hash || 'N/A (Standard Record)'}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1.5 uppercase text-[11px]">Event Metadata Payload</span>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto font-mono text-[11px] border border-slate-800 max-h-56">
                  {typeof selectedAuditLog.metadata === 'string'
                    ? selectedAuditLog.metadata
                    : JSON.stringify(selectedAuditLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button onClick={() => setSelectedAuditLog(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
