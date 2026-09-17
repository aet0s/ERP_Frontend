import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import {
  Shield, Server, Check, Settings2, Users, Database, Activity,
  Lock, Download, Trash2,
  Search, RefreshCw, LogOut,
  Building2, Eye,
  RotateCcw, UserPlus,
  ChevronLeft, ChevronRight, PauseCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Modal';
import { usePersistentTab } from '../hooks/usePersistentTab';

type Workspace = {
  id: string;
  name: string;
  company_code: string;
  database_name: string;
  business_type: string;
  currency: string;
  plan: string;
  status: string;
  created_at: string;
  last_activity_at: string;
  suspended_at: string | null;
  user_count: number;
  raw_materials_count: number;
  finished_goods_count: number;
  procurements_count: number;
  production_batches_count: number;
  sales_count: number;
  expenses_count: number;
  users_count: number;
  vendors_count: number;
  customers_count: number;
};

type PlatformAdmin = { id: string; name: string; email: string };
type Permission = { role: string; module: string; can_view: number; can_create: number; can_edit: number; can_delete: number; can_approve: number; [key: string]: any };
type User = { id: string; name: string; email: string; role: string; status: string; created_at: string; last_login_at: string; workspace_id: string; workspace_name: string };
type AuditLog = { id: string; company_id: string | null; user_id: string | null; action: string; metadata: any; created_at: string };

const ROLES = ['owner', 'manager', 'accounts', 'staff', 'vendor', 'customer'];
const PLANS = ['trial', 'starter', 'professional', 'enterprise'];
const STATUSES = ['active', 'trial', 'suspended', 'cancelled', 'deleted'];

const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 transition";

export function SuperAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = usePersistentTab<'workspaces' | 'users' | 'permissions' | 'audit' | 'backups' | 'health' | 'settings'>(
    'superadmin_main_tab',
    'workspaces'
  );

  // Workspaces
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspaceStatusFilter, setWorkspaceStatusFilter] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [showWorkspaceDetail, setShowWorkspaceDetail] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userWorkspaceFilter, setUserWorkspaceFilter] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    workspace_id: '', name: '', email: '', password: '', role: 'staff'
  });

  // Permissions
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionWorkspaceId, setPermissionWorkspaceId] = useState('');
  const [permissionWorkspaces, setPermissionWorkspaces] = useState<{id: string; name: string}[]>([]);

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Backups
  const [backups, setBackups] = useState<any[]>([]);

  // Health
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Settings
  const [settings, setSettings] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const checkSession = async () => {
    try {
      const res = await api.get('/platform-admin/auth/me');
      if (res.data?.admin) {
        setAdmin(res.data.admin);
        loadWorkspaces();
        loadPermissionWorkspaces();
      }
    } catch (err) {
      setAdmin(null);
    }
  };

  useEffect(() => { checkSession(); }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.post('/platform-admin/auth/login', { email, password });
      if (res.data?.token) {
        localStorage.setItem('erp_platform_token', res.data.token);
      }
      toast('Platform Super Admin authenticated successfully', 'success');
      setAdmin(res.data.admin);
      loadWorkspaces();
      loadPermissionWorkspaces();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Invalid platform admin credentials', 'error');
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await api.post('/platform-admin/auth/logout', {}).catch(() => {});
    localStorage.removeItem('erp_platform_token');
    setAdmin(null);
    setWorkspaces([]); setUsers([]); setPermissions([]); setAuditLogs([]); setBackups([]);
  };

  // ---------- WORKSPACES ----------
  const loadWorkspaces = async () => {
    try {
      const res = await api.get('/admin/workspaces');
      setWorkspaces(Array.isArray(res.data) ? res.data : (res.data?.workspaces || []));
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch workspaces', 'error');
    }
  };

  const loadPermissionWorkspaces = async () => {
    try {
      const res = await api.get('/admin/workspaces');
      const wsList = Array.isArray(res.data) ? res.data : (res.data?.workspaces || []);
      setPermissionWorkspaces(wsList.map((w: any) => ({ id: w.id, name: w.name })));
    } catch { /* ignore */ }
  };

  const workspaceAction = async (id: string, type: 'suspend' | 'reactivate' | 'delete') => {
    if (type === 'delete') {
      const agreed = await confirm({
        title: 'Permanently Delete Workspace Database',
        message: 'PERMANENTLY DELETE this workspace? An automated SQL backup will be archived before the database is dropped. This action cannot be undone.',
        tone: 'danger',
        confirmText: 'Delete Workspace'
      });
      if (!agreed) return;
    }
    try {
      let url = `/admin/workspaces/${id}/${type}`;
      let data = {};
      if (type === 'delete') data = { confirmation_code: 'CONFIRM_PERMANENT_DELETE' };
      await api.post(url, data);
      toast(`Workspace ${type}d successfully`);
      loadWorkspaces();
    } catch (err: any) {
      toast(err.response?.data?.error || `Failed to ${type} workspace`, 'error');
    }
  };

  const updateWorkspacePlan = async (id: string, plan: string) => {
    try {
      await api.post(`/admin/workspaces/${id}/plan`, { plan });
      toast('Plan updated successfully');
      loadWorkspaces();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update plan', 'error');
    }
  };

  const filteredWorkspaces = workspaces.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      w.company_code.toLowerCase().includes(workspaceSearch.toLowerCase());
    const matchesStatus = !workspaceStatusFilter || w.status === workspaceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // ---------- USERS ----------
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch users', 'error');
    }
  }, [toast]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', newUserForm);
      toast('User created successfully', 'success');
      setShowCreateUser(false);
      setNewUserForm({ workspace_id: '', name: '', email: '', password: '', role: 'staff' });
      loadUsers();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create user', 'error');
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast('User role updated', 'success');
      loadUsers();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update role', 'error');
    }
  };

  const deleteUser = async (userId: string) => {
    const agreed = await confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user from the workspace?',
      tone: 'danger',
      confirmText: 'Delete User'
    });
    if (!agreed) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast('User deleted', 'success');
      loadUsers();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    const matchesWorkspace = !userWorkspaceFilter || u.workspace_id === userWorkspaceFilter;
    return matchesSearch && matchesRole && matchesWorkspace;
  });

  // ---------- PERMISSIONS ----------
  const loadPermissions = async () => {
    if (!permissionWorkspaceId) return;
    try {
      const res = await api.get(`/admin/workspaces/${permissionWorkspaceId}/permissions`);
      setPermissions(res.data || []);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to load permissions', 'error');
    }
  };

  const savePermissions = async () => {
    if (!permissionWorkspaceId) return;
    try {
      setSavingPermissions(true);
      await api.put(`/admin/workspaces/${permissionWorkspaceId}/permissions`, { permissions });
      toast('Roles & Permissions updated successfully!', 'success');
      await loadPermissions();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save permissions', 'error');
    } finally { setSavingPermissions(false); }
  };

  const togglePerm = (idx: number, field: string) => {
    const p = permissions[idx];
    const isVendor = p.role === 'vendor';
    const isCustomer = p.role === 'customer';
    const isLocked = (isVendor && !['vendor_orders', 'returns'].includes(p.module)) ||
      (isCustomer && !['customer_orders', 'returns'].includes(p.module));
    const isApproveLocked = (isVendor || isCustomer) && p.module === 'returns';
    if (isLocked) return;
    if (isApproveLocked && field === 'can_approve') return;
    const next = [...permissions];
    next[idx] = { ...next[idx], [field]: next[idx][field] ? 0 : 1 };
    setPermissions(next);
  };

  // ---------- AUDIT ----------
  const loadAuditLogs = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        search: auditSearch,
        action: auditActionFilter
      });
      const res = await api.get(`/admin/audit?${params}`);
      setAuditLogs(res.data.logs || res.data || []);
      setAuditTotal(res.data.total || (res.data.logs || res.data || []).length);
      setAuditPage(page);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch audit logs', 'error');
    }
  };

  // ---------- BACKUPS ----------
  const loadBackups = async () => {
    try {
      const res = await api.get('/admin/backups');
      setBackups(res.data.backups || res.data.items || (Array.isArray(res.data) ? res.data : []));
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch backups', 'error');
    }
  };

  const triggerBackup = async (workspaceId: string) => {
    try {
      await api.post('/admin/backups/trigger', { workspace_id: workspaceId });
      toast('Backup triggered', 'success');
      loadBackups();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to trigger backup', 'error');
    }
  };

  // ---------- HEALTH ----------
  const loadHealth = async () => {
    try {
      setHealthLoading(true);
      const res = await api.get('/admin/health');
      setHealth(res.data);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch health', 'error');
    } finally { setHealthLoading(false); }
  };

  // ---------- SETTINGS ----------
  const loadSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
    } catch { /* ignore */ }
  };

  const saveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.put('/admin/settings', settings);
      toast('Settings saved', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally { setSavingSettings(false); }
  };

  // Load data when tabs change
  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'permissions' && permissionWorkspaceId) loadPermissions();
    if (activeTab === 'audit') loadAuditLogs();
    if (activeTab === 'backups') loadBackups();
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'settings') loadSettings();
  }, [activeTab, permissionWorkspaceId, auditPage, auditSearch, auditActionFilter]);

  if (!admin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-md space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-slate-900 text-white rounded-2xl mb-2">
            <Shield size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Platform Super Admin</h2>
          <p className="text-xs text-slate-500">Cross-company platform operations console</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <Field label="Platform Admin Email">
            <input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" disabled={loading} className="w-full justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5">
            Sign In as Platform Admin
          </Button>
        </form>
      </div>
    );
  }

  const tabs = [
    { id: 'workspaces', label: 'Workspaces', icon: Server },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'permissions', label: 'Permissions', icon: Lock },
    { id: 'audit', label: 'Audit Log', icon: Activity },
    { id: 'backups', label: 'Backups', icon: Database },
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle icon={<Shield />} title="Super Admin Console" subtitle={`Authenticated as ${admin.email}`} />
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut size={16} className="mr-1" /> Sign Out
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-1 shadow-xs sticky top-0 z-20">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ========== WORKSPACES TAB ========== */}
      {activeTab === 'workspaces' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Server size={16} className="text-blue-600" /> Managed Workspaces ({filteredWorkspaces.length}/{workspaces.length})
            </h3>
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={loadWorkspaces}><RefreshCw size={16} className="mr-1" /> Refresh</Button>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search workspaces..."
                  value={workspaceSearch}
                  onChange={(e) => setWorkspaceSearch(e.target.value)}
                  className="pl-9 pr-10 py-2 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 w-64"
                />
              </div>
              <select
                value={workspaceStatusFilter}
                onChange={(e) => setWorkspaceStatusFilter(e.target.value)}
                className="py-2 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px] text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3">Company</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">DB Name</th>
                  <th className="p-3">Users</th>
                  <th className="p-3">Records</th>
                  <th className="p-3">Last Activity</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredWorkspaces.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{row.name}</td>
                    <td className="p-3 font-mono text-slate-600">{row.company_code}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        row.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        row.status === 'trial' ? 'bg-blue-100 text-blue-800' :
                        row.status === 'suspended' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <select
                        value={row.plan}
                        onChange={(e) => updateWorkspacePlan(row.id, e.target.value)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                      >
                        {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                      </select>
                    </td>
                    <td className="p-3 font-mono text-slate-500 text-[11px]">{row.database_name}</td>
                    <td className="p-3 text-center">{row.user_count}</td>
                    <td className="p-3 text-center text-slate-500">
                      {row.raw_materials_count + row.finished_goods_count + row.procurements_count +
                        row.production_batches_count + row.sales_count + row.expenses_count}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {row.last_activity_at ? new Date(row.last_activity_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button variant="ghost" onClick={() => { setSelectedWorkspace(row); setShowWorkspaceDetail(true); }}>
                        <Eye size={14} />
                      </Button>
                      {row.status === 'active' || row.status === 'trial' ? (
                        <Button variant="danger" onClick={() => workspaceAction(row.id, 'suspend')}>
                          <PauseCircle size={14} />
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => workspaceAction(row.id, 'reactivate')}>
                          <RotateCcw size={14} />
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => workspaceAction(row.id, 'delete')}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredWorkspaces.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-500">No workspaces found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========== USERS TAB ========== */}
      {activeTab === 'users' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users size={16} className="text-blue-600" /> All Users Across Workspaces ({filteredUsers.length}/{users.length})
            </h3>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setShowCreateUser(true)}><UserPlus size={16} className="mr-1" /> Create User</Button>
              <Button variant="secondary" onClick={loadUsers}><RefreshCw size={16} className="mr-1" /> Refresh</Button>
            </div>
          </div>
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 pr-4 py-2 px-3 bg-white border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm">
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <select value={userWorkspaceFilter} onChange={(e) => setUserWorkspaceFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm min-w-[180px]">
              <option value="">All Workspaces</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px] text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Workspace</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Last Login</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-medium text-slate-900">{u.name}</td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3 text-slate-500">{u.workspace_name}</td>
                    <td className="p-3">
                      <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-xs bg-white">
                        {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>{u.status}</span>
                    </td>
                    <td className="p-3 text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-slate-500">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                    <td className="p-3 text-right">
                      <Button variant="danger" onClick={() => deleteUser(u.id)}><Trash2 size={14} /></Button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========== PERMISSIONS TAB ========== */}
      {activeTab === 'permissions' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-blue-600" /> Platform Roles & Permissions Matrix Control
              </h3>
              <p className="text-xs text-slate-500">Select a workspace to manage its role permissions matrix. Vendor/Customer roles are locked to portal modules.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={permissionWorkspaceId}
                onChange={(e) => { setPermissionWorkspaceId(e.target.value); loadPermissions(); }}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm min-w-[250px]"
              >
                <option value="">Select Workspace</option>
                {permissionWorkspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <Button icon={<Check size={15} />} disabled={savingPermissions || !permissionWorkspaceId} onClick={savePermissions}>
                Save Permission Matrix
              </Button>
            </div>
          </div>
          {permissionWorkspaceId && permissions.length > 0 && (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-2.5 rounded-tl-lg">Role</th>
                    <th className="p-2.5">Module</th>
                    <th className="p-2.5 text-center">View</th>
                    <th className="p-2.5 text-center">Create</th>
                    <th className="p-2.5 text-center">Edit</th>
                    <th className="p-2.5 text-center">Delete</th>
                    <th className="p-2.5 text-center rounded-tr-lg">Approve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {permissions.map((p, idx) => {
                    const isVendor = p.role === 'vendor';
                    const isCustomer = p.role === 'customer';
                    const isLocked = (isVendor && !['vendor_orders', 'returns'].includes(p.module)) ||
                      (isCustomer && !['customer_orders', 'returns'].includes(p.module));
                    const isApproveLocked = (isVendor || isCustomer) && p.module === 'returns';
                    return (
                      <tr key={`${p.role}-${p.module}`} className={`hover:bg-slate-50/80 transition ${isLocked ? 'bg-slate-50/60 opacity-60' : ''}`}>
                        <td className="p-2.5 font-bold text-slate-900 capitalize">{p.role.replace('_', ' ')}</td>
                        <td className="p-2.5 font-mono text-slate-700">{p.module}</td>
                        <td className="p-2.5 text-center"><input type="checkbox" disabled={isLocked} checked={Boolean(p.can_view)} onChange={() => togglePerm(idx, 'can_view')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed" /></td>
                        <td className="p-2.5 text-center"><input type="checkbox" disabled={isLocked} checked={Boolean(p.can_create)} onChange={() => togglePerm(idx, 'can_create')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed" /></td>
                        <td className="p-2.5 text-center"><input type="checkbox" disabled={isLocked} checked={Boolean(p.can_edit)} onChange={() => togglePerm(idx, 'can_edit')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed" /></td>
                        <td className="p-2.5 text-center"><input type="checkbox" disabled={isLocked} checked={Boolean(p.can_delete)} onChange={() => togglePerm(idx, 'can_delete')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed" /></td>
                        <td className="p-2.5 text-center"><input type="checkbox" disabled={isLocked || isApproveLocked} checked={Boolean(p.can_approve)} onChange={() => togglePerm(idx, 'can_approve')} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!permissionWorkspaceId && (
            <div className="p-12 text-center text-slate-500">
              <Lock size={48} className="mx-auto mb-4 text-slate-300" />
              <p>Select a workspace to manage permissions</p>
            </div>
          )}
        </section>
      )}

      {/* ========== AUDIT LOG TAB ========== */}
      {activeTab === 'audit' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-blue-600" /> Platform Audit Log ({auditTotal} entries)
            </h3>
            <Button variant="secondary" onClick={() => loadAuditLogs(auditPage)}><RefreshCw size={16} className="mr-1" /> Refresh</Button>
          </div>
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input placeholder="Search audit logs..." value={auditSearch} onChange={(e) => { setAuditSearch(e.target.value); loadAuditLogs(1); }} className="pl-9 pr-4 py-2 px-3 bg-white border border-slate-300 rounded-lg text-sm" />
            </div>
            <input placeholder="Filter by action..." value={auditActionFilter} onChange={(e) => { setAuditActionFilter(e.target.value); loadAuditLogs(1); }} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm min-w-[180px]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px] text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="p-3 whitespace-nowrap text-slate-500">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                    <td className="p-3 font-mono text-slate-700">{log.action}</td>
                    <td className="p-3 text-slate-500">{log.company_id || 'Platform'}</td>
                    <td className="p-3 text-slate-500">{log.user_id || '-'}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-600 max-w-xs truncate">{JSON.stringify(log.metadata)}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No audit logs found</td></tr>}
              </tbody>
            </table>
          </div>
          {auditTotal > 50 && (
            <div className="p-4 border-t border-slate-200/80 flex items-center justify-center gap-2">
              <Button variant="secondary" onClick={() => loadAuditLogs(auditPage - 1)} disabled={auditPage <= 1}><ChevronLeft size={16} /> Prev</Button>
              <span className="text-sm text-slate-600">Page {auditPage} of {Math.ceil(auditTotal / 50)}</span>
              <Button variant="secondary" onClick={() => loadAuditLogs(auditPage + 1)} disabled={auditPage >= Math.ceil(auditTotal / 50)}>Next <ChevronRight size={16} /></Button>
            </div>
          )}
        </section>
      )}

      {/* ========== BACKUPS TAB ========== */}
      {activeTab === 'backups' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Database size={16} className="text-blue-600" /> Database Backups
            </h3>
            <Button variant="secondary" onClick={loadBackups}><RefreshCw size={16} className="mr-1" /> Refresh</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px] text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3">Workspace</th>
                  <th className="p-3">File</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Created</th>
                  <th className="p-3">Checksum</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-medium">{b.workspace_name || b.company_code}</td>
                    <td className="p-3 font-mono text-[11px]">{b.filename}</td>
                    <td className="p-3 text-slate-500">{(b.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td className="p-3 text-slate-500">{b.created_at ? new Date(b.created_at).toLocaleString() : '-'}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-500">{b.checksum?.slice(0, 16)}...</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" onClick={() => triggerBackup(b.workspace_id)}><Download size={14} className="mr-1" /> Backup Now</Button>
                    </td>
                  </tr>
                ))}
                {backups.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No backups found</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========== HEALTH TAB ========== */}
      {activeTab === 'health' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-blue-600" /> System Health & Metrics
            </h3>
            <Button variant="secondary" onClick={loadHealth}><RefreshCw size={16} className="mr-1" /> Refresh</Button>
          </div>
          {healthLoading ? (
            <div className="p-12 text-center"><div className="animate-spin text-blue-600">Loading...</div></div>
          ) : health ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Active Tenant Pools', value: health.active_tenant_pools || 0, icon: Database },
                  { label: 'Master DB Connections', value: health.master_pool_connections || 0, icon: Server },
                  { label: 'Total Workspaces', value: health.total_workspaces || workspaces.length, icon: Building2 },
                  { label: 'Active Workspaces', value: health.active_workspaces || workspaces.filter(w => w.status === 'active').length, icon: Check },
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2"><stat.icon size={20} className="text-blue-600" /><span className="text-sm text-slate-600">{stat.label}</span></div>
                    <div className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-slate-900 mb-3">Tenant Pool Details</h4>
                <pre className="bg-slate-900 text-green-300 p-4 rounded-lg text-xs overflow-auto max-h-96">{JSON.stringify(health.tenant_pools || {}, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500"><Activity size={48} className="mx-auto mb-4 text-slate-300" /><p>Click Refresh to load system health</p></div>
          )}
        </section>
      )}

      {/* ========== SETTINGS TAB ========== */}
      {activeTab === 'settings' && (
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Settings2 size={16} className="text-blue-600" /> Platform Settings
            </h3>
            <Button disabled={savingSettings} onClick={saveSettings}>
              <Check size={15} className="mr-1" /> Save Settings
            </Button>
          </div>
          <div className="p-6 space-y-6 max-w-3xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default Trial Days">
                <input type="number" className={inputCls} value={settings.default_trial_days || 14} onChange={(e) => setSettings({...settings, default_trial_days: parseInt(e.target.value)})} />
              </Field>
              <Field label="Max Active Tenant Pools">
                <input type="number" className={inputCls} value={settings.max_active_tenant_pools || 50} onChange={(e) => setSettings({...settings, max_active_tenant_pools: parseInt(e.target.value)})} />
              </Field>
              <Field label="Tenant Pool Max Connections">
                <input type="number" className={inputCls} value={settings.tenant_db_pool_max || 5} onChange={(e) => setSettings({...settings, tenant_db_pool_max: parseInt(e.target.value)})} />
              </Field>
              <Field label="Master DB Pool Max">
                <input type="number" className={inputCls} value={settings.master_db_pool_max || 20} onChange={(e) => setSettings({...settings, master_db_pool_max: parseInt(e.target.value)})} />
              </Field>
              <Field label="Default Currency">
                <input type="text" className={inputCls} value={settings.default_currency || 'INR'} onChange={(e) => setSettings({...settings, default_currency: e.target.value})} />
              </Field>
              <Field label="Invoice Rounding Method">
                <select className={inputCls} value={settings.invoice_rounding_method || 'round_half_up'} onChange={(e) => setSettings({...settings, invoice_rounding_method: e.target.value})}>
                  <option value="round_half_up">Round Half Up</option>
                  <option value="round_half_down">Round Half Down</option>
                  <option value="always_up">Always Up</option>
                  <option value="always_down">Always Down</option>
                  <option value="none">None</option>
                </select>
              </Field>
            </div>
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-slate-900 mb-3">Platform Admin Management</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New Admin Email">
                  <input type="email" className={inputCls} placeholder="newadmin@platform.com" />
                </Field>
                <Field label="New Admin Password">
                  <input type="password" className={inputCls} placeholder="SecurePassword123!" />
                </Field>
              </div>
              <Button variant="secondary" className="mt-2"><UserPlus size={16} className="mr-1" /> Create Platform Admin</Button>
            </div>
          </div>
        </section>
      )}

      {/* Workspace Detail Drawer */}
      {showWorkspaceDetail && selectedWorkspace && (
        <Drawer
          title={selectedWorkspace.name}
          onClose={() => setShowWorkspaceDetail(false)}
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-500">Status:</span> <span className="ml-2 font-medium capitalize">{selectedWorkspace.status}</span></div>
              <div><span className="text-slate-500">Plan:</span> <span className="ml-2 font-medium">{selectedWorkspace.plan}</span></div>
              <div><span className="text-slate-500">Currency:</span> <span className="ml-2 font-medium">{selectedWorkspace.currency}</span></div>
              <div><span className="text-slate-500">Business Type:</span> <span className="ml-2 font-medium">{selectedWorkspace.business_type || 'N/A'}</span></div>
              <div><span className="text-slate-500">Users:</span> <span className="ml-2 font-medium">{selectedWorkspace.user_count}</span></div>
              <div><span className="text-slate-500">Created:</span> <span className="ml-2 font-medium">{selectedWorkspace.created_at ? new Date(selectedWorkspace.created_at).toLocaleDateString() : 'N/A'}</span></div>
              <div><span className="text-slate-500">Last Activity:</span> <span className="ml-2 font-medium">{selectedWorkspace.last_activity_at ? new Date(selectedWorkspace.last_activity_at).toLocaleString() : 'Never'}</span></div>
              <div><span className="text-slate-500">Suspended:</span> <span className="ml-2 font-medium">{selectedWorkspace.suspended_at ? new Date(selectedWorkspace.suspended_at).toLocaleString() : 'N/A'}</span></div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="font-bold text-slate-900 mb-2">Record Counts</h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Raw Materials', value: selectedWorkspace.raw_materials_count },
                  { label: 'Finished Goods', value: selectedWorkspace.finished_goods_count },
                  { label: 'Procurements', value: selectedWorkspace.procurements_count },
                  { label: 'Production Batches', value: selectedWorkspace.production_batches_count },
                  { label: 'Sales', value: selectedWorkspace.sales_count },
                  { label: 'Expenses', value: selectedWorkspace.expenses_count },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-slate-500">{item.label}</div>
                    <div className="font-bold text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <Modal
          title="Create New User"
          onClose={() => setShowCreateUser(false)}
        >
          <form onSubmit={createUser} className="space-y-4">
            <Field label="Workspace">
              <select value={newUserForm.workspace_id} onChange={(e) => setNewUserForm({...newUserForm, workspace_id: e.target.value})} className={inputCls} required>
                <option value="">Select Workspace</option>
                {workspaces.filter(w => w.status === 'active').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Name"><input type="text" className={inputCls} required value={newUserForm.name} onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})} /></Field>
            <Field label="Email"><input type="email" className={inputCls} required value={newUserForm.email} onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})} /></Field>
            <Field label="Password"><input type="password" className={inputCls} required value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} minLength={6} /></Field>
            <Field label="Role">
              <select value={newUserForm.role} onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})} className={inputCls}>
                {ROLES.filter(r => r !== 'owner').map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateUser(false)}>Cancel</Button>
              <Button type="submit"><UserPlus size={16} className="mr-1" /> Create User</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}