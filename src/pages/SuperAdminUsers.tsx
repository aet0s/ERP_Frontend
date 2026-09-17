import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Trash2, RefreshCw, Search, X, Shield, Edit3
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DatePicker } from '../components/ui/DatePicker';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { RolePermissionsPreview } from '../components/ui/RolePermissionsPreview';

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  status: string;
  created_at: string;
  last_login_at: string;
  workspace_id: string;
  workspace_name: string;
};

type Workspace = { id: string; name: string; status: string; plan?: string };

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full administrative control of workspace' },
  { value: 'manager', label: 'Manager', description: 'Operational control over catalog, inventory, production' },
  { value: 'accounts', label: 'Accounts', description: 'Financial ledger, invoicing, bills, and payments' },
  { value: 'staff', label: 'Staff', description: 'Floor operations, order processing, stock movements' },
  { value: 'vendor', label: 'Vendor', description: 'Vendor portal access to purchase orders' },
  { value: 'customer', label: 'Customer', description: 'Customer portal access to sales orders' }
];

const inputCls = "w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition";

export function SuperAdminUsers() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userWorkspaceFilter, setUserWorkspaceFilter] = useState('');
  const [userDateFilter, setUserDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [totalUsers, setTotalUsers] = useState(0);

  // Create User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    workspace_id: '',
    name: '',
    email: '',
    password: '',
    roles: ['staff'] as string[]
  });

  // Edit User Roles Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const loadUsers = useCallback(async (page = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: userSearch,
        role: userRoleFilter,
        workspace_id: userWorkspaceFilter,
        date: userDateFilter
      });
      const res = await api.get(`/admin/users?${params}`);
      const list = res.data.items || res.data.users || (Array.isArray(res.data) ? res.data : []);
      setUsers(list);
      setTotalUsers(res.data.total !== undefined ? res.data.total : list.length);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  }, [userSearch, userRoleFilter, userWorkspaceFilter, userDateFilter, toast, currentPage]);

  const loadWorkspaces = async () => {
    try {
      const res = await api.get('/admin/workspaces?all=true');
      const raw = Array.isArray(res.data) ? res.data : (res.data.items || res.data.workspaces || []);
      setWorkspaces(raw.filter((w: any) => w.status !== 'deleted').map((w: any) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        plan: w.plan
      })));
    } catch { /* ignore */ }
  };

  useEffect(() => { loadWorkspaces(); }, []);

  useEffect(() => {
    loadUsers(currentPage);
  }, [currentPage, userRoleFilter, userWorkspaceFilter, userDateFilter, loadUsers]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      loadUsers(1);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.workspace_id) {
      toast('Please select a workspace', 'error');
      return;
    }
    if (!newUserForm.roles.length) {
      toast('Please assign at least one role', 'error');
      return;
    }
    try {
      await api.post('/admin/users', {
        workspace_id: newUserForm.workspace_id,
        name: newUserForm.name,
        email: newUserForm.email,
        password: newUserForm.password,
        roles: newUserForm.roles,
        role: newUserForm.roles[0] || 'staff'
      });
      toast('User created successfully in workspace', 'success');
      setShowCreateUser(false);
      setNewUserForm({ workspace_id: '', name: '', email: '', password: '', roles: ['staff'] });
      loadUsers(1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create user', 'error');
    }
  };

  const handleOpenEditRoles = (u: User) => {
    setEditingUser(u);
    const existingRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role || 'staff'];
    setEditRoles(existingRoles);
  };

  const saveUserRoles = async () => {
    if (!editingUser) return;
    if (editRoles.length === 0) {
      toast('User must have at least one role assigned', 'error');
      return;
    }
    try {
      setSavingRoles(true);
      await api.put(`/admin/users/${editingUser.id}/roles`, {
        roles: editRoles,
        role: editRoles[0]
      });
      toast(`Roles updated for ${editingUser.name}`, 'success');
      setEditingUser(null);
      loadUsers(currentPage);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update roles', 'error');
    } finally {
      setSavingRoles(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    const agreed = await confirm({
      title: 'Delete User Account',
      message: `Are you sure you want to delete user "${userName}"? They will immediately lose access to their assigned workspace.`,
      confirmText: 'Delete User',
      tone: 'danger'
    });
    if (!agreed) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast('User deleted', 'success');
      loadUsers(currentPage);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const PAGE_SIZE = 20;
  const hasActiveFilters = Boolean(userSearch || userRoleFilter || userWorkspaceFilter || userDateFilter);

  // Dropdown Options
  const roleFilterOptions = [
    { value: '', label: 'All Roles' },
    ...ROLES.map((r) => ({ value: r.value, label: r.label }))
  ];

  const workspaceFilterOptions = [
    { value: '', label: 'All Workspaces' },
    ...workspaces.map((w) => ({ value: w.id, label: w.name, description: `Status: ${w.status}` }))
  ];

  const createWorkspaceOptions = workspaces.map((w) => ({
    value: w.id,
    label: w.name,
    description: `Plan: ${w.plan || 'N/A'}`
  }));

  const roleSelectOptions = ROLES.filter((r) => r.value !== 'owner').map((r) => ({
    value: r.value,
    label: r.label,
    description: r.description
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle
          icon={<Users />}
          title="All Users"
          subtitle={`${totalUsers} total users across workspaces (20 per page)`}
        />
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowCreateUser(true)}>
            <UserPlus size={16} className="mr-1.5" /> Create User
          </Button>
          <Button variant="secondary" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={16} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Modern Filter Toolbar with Custom Dropdowns */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search by name or email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Custom Role Filter Dropdown */}
          <div className="w-[140px]">
            <Select
              value={userRoleFilter}
              onChange={setUserRoleFilter}
              options={roleFilterOptions}
              placeholder="All Roles"
              className="w-full"
              triggerClassName="bg-slate-50 border-slate-200"
            />
          </div>

          {/* Custom Workspace Filter Dropdown */}
          <div className="w-[180px]">
            <Select
              value={userWorkspaceFilter}
              onChange={setUserWorkspaceFilter}
              options={workspaceFilterOptions}
              placeholder="All Workspaces"
              searchable
              className="w-full"
              triggerClassName="bg-slate-50 border-slate-200"
            />
          </div>

          {/* Date Filter (Global DatePicker with dd-mm-yyyy) */}
          <div className="w-[150px]">
            <DatePicker
              value={userDateFilter}
              onChange={(val) => setUserDateFilter(val)}
              placeholder="dd-mm-yyyy"
              className="bg-slate-50 border-slate-200"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setUserSearch('');
                setUserRoleFilter('');
                setUserWorkspaceFilter('');
                setUserDateFilter('');
              }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold px-2.5 py-2 rounded-lg hover:bg-red-50 border border-red-200 transition whitespace-nowrap cursor-pointer flex items-center gap-1"
            >
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px] text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Workspace</th>
                <th className="p-3.5">Assigned Roles (Multi-Role)</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5">Last Login</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {users.map((u) => {
                const userRolesList = u.roles && u.roles.length > 0 ? u.roles : [u.role || 'staff'];

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">{u.email}</td>
                    <td className="p-3.5 text-slate-700 font-medium">{u.workspace_name}</td>
                    
                    {/* Multi-Role Badges with Edit Action */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {userRolesList.map((r) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] border tracking-wider ${
                              r === 'owner'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : r === 'manager'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : r === 'accounts'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : r === 'vendor' || r === 'customer'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleOpenEditRoles(u)}
                          title="Manage Assigned Roles"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('en-GB') // dd/mm/yyyy
                        : '-'}
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleDateString('en-GB')
                        : 'Never'}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <Button
                        variant="ghost"
                        onClick={() => handleOpenEditRoles(u)}
                        title="Edit Roles"
                        className="text-slate-600 hover:text-blue-600"
                      >
                        <Shield size={14} />
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => deleteUser(u.id, u.name)}
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    <Users size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold">No users match the current filter</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing the date, workspace, or search filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Global 20/page Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalUsers}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Create User Modal with Multi-Role Assignment */}
      {showCreateUser && (
        <Modal title="Create New Workspace User" onClose={() => setShowCreateUser(false)}>
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Workspace Target
              </label>
              <Select
                value={newUserForm.workspace_id}
                onChange={(val) => setNewUserForm({ ...newUserForm, workspace_id: val })}
                options={createWorkspaceOptions}
                placeholder="Select Target Workspace..."
                searchable
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                className={inputCls}
                required
                autoComplete="name"
                placeholder="e.g. Sarah Jenkins"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                className={inputCls}
                required
                autoComplete="email"
                placeholder="sarah@company.com"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Temporary Password
              </label>
              <input
                type="password"
                className={inputCls}
                required
                autoComplete="new-password"
                placeholder="Min 6 characters"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Roles (Select Multiple)
              </label>
              <Select
                multiple
                values={newUserForm.roles}
                onMultiChange={(roles) => setNewUserForm({ ...newUserForm, roles })}
                options={roleSelectOptions}
                placeholder="Choose roles for this user..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                User will receive aggregated permissions across all assigned roles.
              </p>
            </div>

            {/* Live Role Capability Preview */}
            <RolePermissionsPreview
              roles={newUserForm.roles}
              title="Permissions Matrix Preview"
              defaultExpanded={false}
            />

            <div className="flex gap-2 pt-3 justify-end border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setShowCreateUser(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <UserPlus size={16} className="mr-1.5" /> Create User
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Roles Modal */}
      {editingUser && (
        <Modal
          title={`Manage Roles — ${editingUser.name}`}
          onClose={() => setEditingUser(null)}
        >
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div className="font-bold text-slate-900">{editingUser.name}</div>
              <div className="text-xs text-slate-500 font-mono">{editingUser.email}</div>
              <div className="text-xs text-slate-600 mt-1">
                Workspace: <span className="font-semibold">{editingUser.workspace_name}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Roles (Multi-Role)
              </label>
              <Select
                multiple
                values={editRoles}
                onMultiChange={setEditRoles}
                options={ROLES.map((r) => ({
                  value: r.value,
                  label: r.label,
                  description: r.description
                }))}
                placeholder="Select roles..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Permissions will dynamically combine across all selected roles.
              </p>
            </div>

            {/* Live Role Capability Preview */}
            <RolePermissionsPreview
              roles={editRoles}
              title="Permissions Matrix Preview"
              defaultExpanded={false}
            />

            <div className="flex gap-2 pt-3 justify-end border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={saveUserRoles} disabled={savingRoles}>
                {savingRoles ? 'Saving...' : 'Save User Roles'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}