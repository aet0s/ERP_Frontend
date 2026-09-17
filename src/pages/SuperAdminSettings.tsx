import { useState, useEffect } from 'react';
import {
  Globe, Database, Server, Building2, Shield,
  RefreshCw, Check, UserPlus, Trash2, Key, AlertTriangle, Eye, EyeOff,
  Sparkles, Lock, ShieldCheck, DollarSign, Calculator,
  Mail
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { Button } from '../components/ui/Button';
import { usePersistentTab } from '../hooks/usePersistentTab';

type PlatformAdmin = {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
  last_login_at?: string | null;
};

type WorkspaceItem = {
  id: string;
  name: string;
  company_code: string;
  database_name: string;
  status: string;
};

const POPULAR_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' }
];

const ROUNDING_METHODS = [
  { id: 'round_half_up', name: 'Standard Round (Half Up)', desc: 'Standard mathematical rounding (e.g. 10.455 → 10.46)' },
  { id: 'bankers_rounding', name: 'Banker\'s Rounding (Half Even)', desc: 'Rounds to the nearest even digit, minimizes financial bias' },
  { id: 'round_down', name: 'Floor / Truncate (Round Down)', desc: 'Always rounds down towards zero (e.g. 10.459 → 10.45)' },
  { id: 'round_up', name: 'Ceiling (Round Up)', desc: 'Always rounds up to next decimal (e.g. 10.451 → 10.46)' },
  { id: 'exact_decimal', name: 'Exact 4-Decimal Precision', desc: 'Maintains exact 4-decimal currency precision without rounding' }
];

export function SuperAdminSettings() {
  const toast = useToast();

  const [activeTab, setActiveTab] = usePersistentTab<'general' | 'subscription' | 'database' | 'security' | 'maintenance' | 'admins' | 'danger'>(
    'superadmin_settings',
    'general'
  );

  // Platform Settings State
  const [settings, setSettings] = useState<{
    platform_name: string;
    platform_support_email: string;
    platform_company_legal_name: string;
    allow_workspace_registration: number;
    default_trial_days: number;
    payment_grace_period_days: number;
    auto_freeze_on_grace_expiry: number;
    default_currency: string;
    invoice_rounding_method: string;
    default_tax_rate_pct: number;
    jwt_session_expiry_hours: number;
    max_login_attempts_lockout: number;
    enforce_strong_passwords: number;
    audit_log_retention_days: number;
    max_active_tenant_pools: number;
    tenant_db_pool_max: number;
    master_db_pool_max: number;
    tenant_pool_queue_timeout_ms: number;
    maintenance_mode_enabled: number;
    maintenance_message: string;
  }>({
    platform_name: 'ERP Enterprise Studio',
    platform_support_email: 'support@erpplatform.com',
    platform_company_legal_name: 'ERP Global Systems Technologies Inc.',
    allow_workspace_registration: 1,
    default_trial_days: 14,
    payment_grace_period_days: 7,
    auto_freeze_on_grace_expiry: 1,
    default_currency: 'INR',
    invoice_rounding_method: 'round_half_up',
    default_tax_rate_pct: 18.00,
    jwt_session_expiry_hours: 24,
    max_login_attempts_lockout: 5,
    enforce_strong_passwords: 1,
    audit_log_retention_days: 90,
    max_active_tenant_pools: 50,
    tenant_db_pool_max: 5,
    master_db_pool_max: 20,
    tenant_pool_queue_timeout_ms: 5000,
    maintenance_mode_enabled: 0,
    maintenance_message: 'The ERP platform is currently undergoing scheduled maintenance. Please check back shortly.'
  });

  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Platform Admins State
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Danger Zone Modals State
  const [showDeleteWorkspaceModal, setShowDeleteWorkspaceModal] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedDeleteWorkspaceId, setSelectedDeleteWorkspaceId] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.data) {
        setSettings({
          platform_name: res.data.platform_name || 'ERP Enterprise Studio',
          platform_support_email: res.data.platform_support_email || 'support@erpplatform.com',
          platform_company_legal_name: res.data.platform_company_legal_name || 'ERP Global Systems Technologies Inc.',
          allow_workspace_registration: Number(res.data.allow_workspace_registration ?? 1),
          default_trial_days: Number(res.data.default_trial_days ?? 14),
          payment_grace_period_days: Number(res.data.payment_grace_period_days ?? 7),
          auto_freeze_on_grace_expiry: Number(res.data.auto_freeze_on_grace_expiry ?? 1),
          default_currency: res.data.default_currency || 'INR',
          invoice_rounding_method: res.data.invoice_rounding_method || 'round_half_up',
          default_tax_rate_pct: Number(res.data.default_tax_rate_pct ?? 18.00),
          jwt_session_expiry_hours: Number(res.data.jwt_session_expiry_hours ?? 24),
          max_login_attempts_lockout: Number(res.data.max_login_attempts_lockout ?? 5),
          enforce_strong_passwords: Number(res.data.enforce_strong_passwords ?? 1),
          audit_log_retention_days: Number(res.data.audit_log_retention_days ?? 90),
          max_active_tenant_pools: Number(res.data.max_active_tenant_pools ?? 50),
          tenant_db_pool_max: Number(res.data.tenant_db_pool_max ?? 5),
          master_db_pool_max: Number(res.data.master_db_pool_max ?? 20),
          tenant_pool_queue_timeout_ms: Number(res.data.tenant_pool_queue_timeout_ms ?? 5000),
          maintenance_mode_enabled: Number(res.data.maintenance_mode_enabled ?? 0),
          maintenance_message: res.data.maintenance_message || 'The ERP platform is currently undergoing scheduled maintenance. Please check back shortly.'
        });
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to load platform settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const res = await api.get('/admin/platform-admins');
      setAdmins(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Fallback
    }
  };

  const loadWorkspaces = async () => {
    try {
      const res = await api.get('/admin/workspaces');
      setWorkspaces(Array.isArray(res.data) ? res.data : (res.data?.workspaces || []));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSettings();
    loadAdmins();
    loadWorkspaces();
  }, []);

  const saveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.put('/admin/settings', settings);
      toast('Platform settings updated and audited successfully across all instances!', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const createPlatformAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminPassword) {
      toast('Please provide valid email and password', 'error');
      return;
    }

    try {
      setCreatingAdmin(true);
      await api.post(
        '/admin/platform-admins',
        {
          name: newAdminName.trim() || 'Platform Super Admin',
          email: newAdminEmail.trim(),
          password: newAdminPassword
        }
      );
      toast(`Super Administrator account created for ${newAdminEmail}`, 'success');
      setShowAddAdminModal(false);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminName('');
      loadAdmins();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create platform admin', 'error');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedDeleteWorkspaceId) {
      toast('Please select a workspace to delete', 'error');
      return;
    }
    const ws = workspaces.find((w) => w.id === selectedDeleteWorkspaceId);
    if (!ws) return;

    if (deleteConfirmText !== ws.name && deleteConfirmText !== 'DELETE') {
      toast(`Type '${ws.name}' or 'DELETE' to confirm permanent unprovisioning`, 'error');
      return;
    }

    try {
      setDeletingWorkspace(true);
      await api.delete(`/admin/workspaces/${ws.id}`);
      toast(`Workspace '${ws.name}' and database '${ws.database_name}' permanently deleted. Pre-deletion backup archive created.`, 'success');
      setShowDeleteWorkspaceModal(false);
      setSelectedDeleteWorkspaceId('');
      setDeleteConfirmText('');
      loadWorkspaces();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete workspace', 'error');
    } finally {
      setDeletingWorkspace(false);
    }
  };

  const navigationTabs = [
    { id: 'general', label: 'Platform & Branding', icon: Globe },
    { id: 'subscription', label: 'Billing & Grace Buffers', icon: DollarSign },
    { id: 'database', label: 'Database & Pools', icon: Database },
    { id: 'security', label: 'Security & Auth Policies', icon: ShieldCheck },
    { id: 'maintenance', label: 'Maintenance Mode', icon: AlertTriangle },
    { id: 'admins', label: 'Super Administrators', icon: Key },
    { id: 'danger', label: 'Danger Zone', icon: Trash2 }
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-20 -top-10 w-48 h-48 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles size={14} className="text-amber-400" />
              Platform Super Administration & Governance
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Platform Settings & Governance</h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Configure system-wide database parameters, default trial periods, payment grace buffers, platform white-labeling, and cross-workspace governance policies.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <Button
              variant="secondary"
              onClick={loadSettings}
              disabled={loading || savingSettings}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
            >
              <RefreshCw size={15} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button
              onClick={saveSettings}
              disabled={savingSettings}
              className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 px-5 font-semibold"
            >
              <Check size={16} className="mr-1.5" />
              {savingSettings ? 'Saving Changes...' : 'Save All Settings'}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {navigationTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
                isActive
                  ? tab.id === 'danger'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: PLATFORM BRANDING & IDENTITY */}
      {/* ============================================================ */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-150">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <Globe size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Platform Identity & Brand Details</h2>
                <p className="text-xs text-slate-500">Displayed on global super admin headers, system emails, and auth portals</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Platform Name / Title
                </label>
                <input
                  type="text"
                  value={settings.platform_name}
                  onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Platform Support Email
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={settings.platform_support_email}
                    onChange={(e) => setSettings({ ...settings, platform_support_email: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Company Legal Entity Name
                </label>
                <input
                  type="text"
                  value={settings.platform_company_legal_name}
                  onChange={(e) => setSettings({ ...settings, platform_company_legal_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tenant Workspace Provisioning Controls</h2>
                <p className="text-xs text-slate-500">Manage self-service onboarding and database initialization defaults</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Allow Self-Service Workspace Registration</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    When enabled, new organizations can register on public onboarding pages.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.allow_workspace_registration)}
                    onChange={(e) => setSettings({ ...settings, allow_workspace_registration: e.target.checked ? 1 : 0 })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-xl leading-relaxed">
                <p className="font-semibold">Automatic Database Isolation</p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Every newly registered workspace is allocated a dedicated MySQL schema with isolated tables, migrations, and role permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: SUBSCRIPTION, BILLING & GRACE BUFFERS */}
      {/* ============================================================ */}
      {activeTab === 'subscription' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-150">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Subscription Trial & Payment Grace Buffers</h2>
                <p className="text-xs text-slate-500">Configure free trial durations and payment default safety buffers</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Default Free Trial Period */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Default Free Trial Period
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {settings.default_trial_days} Days
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={settings.default_trial_days}
                    onChange={(e) => setSettings({ ...settings, default_trial_days: parseInt(e.target.value, 10) || 14 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">Days</span>
                </div>
              </div>

              {/* Payment Grace Buffer Days */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Payment Buffer Window (Grace Period)
                  </label>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {settings.payment_grace_period_days} Days Buffer
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={settings.payment_grace_period_days}
                    onChange={(e) => setSettings({ ...settings, payment_grace_period_days: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-amber-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">Days Buffer</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Extra days allowed if a user forgets to pay before tenant portal access is locked.
                </p>
              </div>

              {/* Auto Freeze Toggle */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Auto-Freeze Workspace On Grace Expiry</span>
                  <span className="text-[10px] text-slate-500">Automatically blocks access once grace period expires</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.auto_freeze_on_grace_expiry)}
                  onChange={(e) => setSettings({ ...settings, auto_freeze_on_grace_expiry: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                <Calculator size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Currency & Invoicing Engine Rules</h2>
                <p className="text-xs text-slate-500">Default currencies, rounding methods, and tax calculation baselines</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Default Currency */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Platform Default Currency Code
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {POPULAR_CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setSettings({ ...settings, default_currency: c.code })}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                        settings.default_currency === c.code
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{c.symbol}</span>
                      <span>{c.code}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={settings.default_currency}
                  onChange={(e) => setSettings({ ...settings, default_currency: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono uppercase text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Default Tax Rate */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Baseline Tax Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.default_tax_rate_pct}
                    onChange={(e) => setSettings({ ...settings, default_tax_rate_pct: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">%</span>
                </div>
              </div>

              {/* Invoice Rounding Method */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Invoice Calculation Rounding Method
                </label>
                <select
                  value={settings.invoice_rounding_method}
                  onChange={(e) => setSettings({ ...settings, invoice_rounding_method: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  {ROUNDING_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: DATABASE & POOLS CONCURRENCY */}
      {/* ============================================================ */}
      {activeTab === 'database' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-6 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Database Engine & Connection Pool Limits</h2>
              <p className="text-xs text-slate-500">Fine-tune MySQL connection ceilings, queue timeouts, and dynamic tenant pool quotas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Max Active Tenant Pools in Memory (LRU Eviction Ceiling)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={settings.max_active_tenant_pools}
                  onChange={(e) => setSettings({ ...settings, max_active_tenant_pools: parseInt(e.target.value, 10) || 50 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-600"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">Pools</span>
              </div>
              <p className="text-[11px] text-slate-500">Least recently used pools are dynamically closed to prevent OS resource exhaustion.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Tenant Database Pool Max Connections
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.tenant_db_pool_max}
                onChange={(e) => setSettings({ ...settings, tenant_db_pool_max: parseInt(e.target.value, 10) || 5 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-600"
              />
              <p className="text-[11px] text-slate-500">Max parallel connections per tenant schema.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Master Database Pool Max Connections
              </label>
              <input
                type="number"
                min="5"
                max="200"
                value={settings.master_db_pool_max}
                onChange={(e) => setSettings({ ...settings, master_db_pool_max: parseInt(e.target.value, 10) || 20 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-600"
              />
              <p className="text-[11px] text-slate-500">Connection ceiling for erp_master registry.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Tenant Pool Queue Timeout (Milliseconds)
              </label>
              <input
                type="number"
                min="1000"
                max="30000"
                step="500"
                value={settings.tenant_pool_queue_timeout_ms}
                onChange={(e) => setSettings({ ...settings, tenant_pool_queue_timeout_ms: parseInt(e.target.value, 10) || 5000 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-indigo-600"
              />
              <p className="text-[11px] text-slate-500">Max wait time before returning a 503 if all connection slots are saturated.</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: SECURITY, AUTH & COMPLIANCE */}
      {/* ============================================================ */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in-50 duration-150">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
                <Lock size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Session & Authentication Security Policies</h2>
                <p className="text-xs text-slate-500">Session lifespan, brute force lockouts, and password complexity</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  JWT Session Token Expiration (Hours)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={settings.jwt_session_expiry_hours}
                    onChange={(e) => setSettings({ ...settings, jwt_session_expiry_hours: parseInt(e.target.value, 10) || 24 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-purple-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">Hours</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Max Failed Login Attempts Before Temporary Lockout
                </label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={settings.max_login_attempts_lockout}
                  onChange={(e) => setSettings({ ...settings, max_login_attempts_lockout: parseInt(e.target.value, 10) || 5 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block">Enforce Strong Password Complexity</span>
                  <span className="text-[10px] text-slate-500">Requires min 8 chars, 1 uppercase, 1 digit & 1 symbol</span>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.enforce_strong_passwords)}
                  onChange={(e) => setSettings({ ...settings, enforce_strong_passwords: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Audit Trail Retention & Compliance</h2>
                <p className="text-xs text-slate-500">Tamper-proof HMAC logging cycles and compliance retention</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Audit Log History Retention Period (Days)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="30"
                    max="3650"
                    value={settings.audit_log_retention_days}
                    onChange={(e) => setSettings({ ...settings, audit_log_retention_days: parseInt(e.target.value, 10) || 90 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-emerald-600"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">Days</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cryptographically sealed master audit log entries are preserved for this minimum period.
                </p>
              </div>

              <div className="p-4 bg-emerald-50/70 border border-emerald-200 text-emerald-900 rounded-xl leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" /> Tamper-Proof Cryptographic Verification
                </p>
                <p className="text-[11px] text-emerald-800">
                  Every user, workspace lifecycle, and platform administration action generates a continuous SHA-256 HMAC digest recorded in <code className="font-mono font-bold">master_audit_log</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: MAINTENANCE MODE & BROADCAST */}
      {/* ============================================================ */}
      {activeTab === 'maintenance' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-6 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Platform Maintenance Mode & User Broadcast</h2>
              <p className="text-xs text-slate-500">Put the entire platform into maintenance mode while retaining super admin access</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className={`p-4 rounded-xl border flex items-center justify-between transition ${
              settings.maintenance_mode_enabled
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div>
                <span className="font-bold text-sm block">
                  {settings.maintenance_mode_enabled ? 'MAINTENANCE MODE ACTIVE' : 'Platform Maintenance Mode'}
                </span>
                <span className="text-[11px] opacity-80 block mt-0.5">
                  When enabled, non-superadmin users will see a maintenance screen. Super admins retain full control.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.maintenance_mode_enabled)}
                  onChange={(e) => setSettings({ ...settings, maintenance_mode_enabled: e.target.checked ? 1 : 0 })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600" />
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Maintenance Notice Message Broadcast
              </label>
              <textarea
                rows={3}
                value={settings.maintenance_message}
                onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-amber-600 leading-relaxed"
                placeholder="Message to display to all tenant users..."
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: SUPER ADMINISTRATORS */}
      {/* ============================================================ */}
      {activeTab === 'admins' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-6 space-y-5 animate-in fade-in-50 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <Key size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Platform Super Administrators</h2>
                <p className="text-xs text-slate-500">Root accounts with platform governance privileges across all tenant schemas</p>
              </div>
            </div>

            <Button
              variant="primary"
              icon={<UserPlus size={14} />}
              onClick={() => setShowAddAdminModal(true)}
              className="text-xs"
            >
              Add Super Admin
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 rounded-tl-xl">Admin User</th>
                  <th className="p-3.5">Email Address</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created At</th>
                  <th className="p-3.5 text-right rounded-tr-xl">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Key size={13} className="text-blue-600" /> {adm.name}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700">{adm.email}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                        {adm.status || 'Active'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">{new Date(adm.created_at).toLocaleDateString()}</td>
                    <td className="p-3.5 text-right text-slate-500 font-mono text-[11px]">
                      {adm.last_login_at ? new Date(adm.last_login_at).toLocaleString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 7: DANGER ZONE (TERMINATION & UNPROVISIONING) */}
      {/* ============================================================ */}
      {activeTab === 'danger' && (
        <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-6 space-y-5 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-3.5 pb-4 border-b border-rose-200/80">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shadow-2xs">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-950">Danger Zone: Permanent Workspace Termination</h2>
              <p className="text-xs text-rose-700">Permanent database schema deletion with automated safeguard backups</p>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Unprovision & Delete Workspace Database</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically dumps a pre-deletion backup before dropping the tenant schema and unlinking company records.
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => setShowDeleteWorkspaceModal(true)}
              className="shrink-0 text-xs"
            >
              <Trash2 size={13} className="mr-1.5" /> Delete Workspace...
            </Button>
          </div>
        </div>
      )}

      {/* ADD SUPER ADMIN MODAL */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserPlus size={16} className="text-blue-600" /> Add Platform Super Admin
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAdminModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createPlatformAdmin} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Administrator"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address (Login ID)
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@erp-platform.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Strong password..."
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-9 py-2 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl leading-relaxed text-[11px]">
                <strong>Root Administrator Privileges:</strong> This account has full access across all tenant databases, backup triggers, and platform governance settings.
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowAddAdminModal(false)} disabled={creatingAdmin}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={creatingAdmin}>
                  {creatingAdmin ? 'Creating...' : 'Create Super Admin Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE WORKSPACE CONFIRMATION MODAL */}
      {showDeleteWorkspaceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-rose-100 bg-rose-50/80 flex items-center justify-between">
              <h3 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600" /> Permanent Workspace Termination
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteWorkspaceModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-rose-100 text-rose-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Workspace to Terminate
                </label>
                <select
                  value={selectedDeleteWorkspaceId}
                  onChange={(e) => setSelectedDeleteWorkspaceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                >
                  <option value="">Select a workspace...</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} [{w.database_name}]</option>
                  ))}
                </select>
              </div>

              {selectedDeleteWorkspaceId && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Type 'DELETE' or workspace name to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-rose-600"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowDeleteWorkspaceModal(false)} disabled={deletingWorkspace}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteWorkspace}
                disabled={deletingWorkspace || !selectedDeleteWorkspaceId}
              >
                {deletingWorkspace ? 'Terminating...' : 'Permanently Delete Workspace'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}