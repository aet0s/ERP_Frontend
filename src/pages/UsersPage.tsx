import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import {
  UserPlus,
  Copy,
  Plus,
  Check
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import type { TableColumn, UserSummary } from '../lib/types';
import { formatDate, csvDownload } from '../lib/utils';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { RolePermissionsPreview } from '../components/ui/RolePermissionsPreview';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';
import { UserDetailDrawer } from '../components/UserDetailDrawer';

const WORKSPACE_ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full access to all settings, billing & workspace features' },
  { value: 'manager', label: 'Manager', description: 'Operations manager with broad operational & reports access' },
  { value: 'accounts', label: 'Accounts', description: 'Finance, invoices, payments, procurement & ledger' },
  { value: 'production_manager', label: 'Production Manager', description: 'BOM, manufacturing batches, stages & WIP' },
  { value: 'sales_manager', label: 'Sales Manager', description: 'Sales orders, customer portal, invoices & deliveries' },
  { value: 'staff', label: 'Staff', description: 'Standard team member with basic day-to-day access' }
];

const USER_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'name', label: 'Member Name', category: 'Profile', defaultSelected: true },
  { key: 'email', label: 'Email Address', category: 'Profile', defaultSelected: true },
  { key: 'role_display', label: 'Primary Role', category: 'Permissions', defaultSelected: true },
  { key: 'roles_display', label: 'All Assigned Roles', category: 'Permissions', defaultSelected: true },
  { key: 'status', label: 'Account Status', category: 'Status', defaultSelected: true },
  { key: 'is_primary_owner_label', label: 'Primary Owner', category: 'Status', defaultSelected: true },
  { key: 'created_at_formatted', label: 'Joined Date', category: 'Activity', defaultSelected: true },
  { key: 'last_login_at_formatted', label: 'Last Login', category: 'Activity', defaultSelected: false }
];

const INVITE_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'email', label: 'Invitee Email', category: 'Invitation', defaultSelected: true },
  { key: 'role_display', label: 'Assigned Role', category: 'Invitation', defaultSelected: true },
  { key: 'created_at_formatted', label: 'Sent Date', category: 'Dates', defaultSelected: true },
  { key: 'expires_at_formatted', label: 'Expires Date', category: 'Dates', defaultSelected: true },
  { key: 'token', label: 'Invite Token', category: 'Technical', defaultSelected: false },
  { key: 'invite_link', label: 'Direct Invitation Link', category: 'Technical', defaultSelected: true }
];

export function UsersPage({ user }: { user: UserSummary }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { workspace } = useWorkspace();
  const [tab, setTab] = usePersistentTab<'members' | 'invites'>('users_page_tab', 'members');
  const [refresh, setRefresh] = useState(0);

  // Filter States
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Column-Selective Export Modal State
  const [exportModalData, setExportModalData] = useState<{
    selectedRows: any[];
    selectAllAcrossPages: boolean;
    total: number;
    getExportData: () => Promise<any[]>;
  } | null>(null);

  // Dynamic Permissions Check via centralized usePermissions hook
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissions('users');

  const isOwnerOrAdmin = useMemo(() => {
    if (!user) return false;
    const role = user.role;
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    return role === 'owner' || role === 'admin' || roles.includes('owner') || roles.includes('admin');
  }, [user]);

  // Roles assignable by current user
  const assignableRoles = useMemo(() => {
    if (isOwnerOrAdmin) return WORKSPACE_ROLES;
    return WORKSPACE_ROLES.filter((r) => r.value !== 'owner' && r.value !== 'admin');
  }, [isOwnerOrAdmin]);

  // Modal States
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'staff' });
  const [sendingInvite, setSendingInvite] = useState(false);

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // View Details Drawer States
  const [viewingUser, setViewingUser] = useState<any | null>(null);
  const [viewingInvite, setViewingInvite] = useState<any | null>(null);

  // Full role permissions list for live capability preview
  const [matrixPermissions, setMatrixPermissions] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/permissions')
      .then((res) => setMatrixPermissions(res.data || []))
      .catch(() => {});
  }, []);

  // Send Invitation Handler
  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      toast('You do not have permission to invite users.', 'error');
      return;
    }
    if (!inviteForm.email.trim()) {
      toast('Email address is required', 'error');
      return;
    }

    setSendingInvite(true);
    try {
      const res = await api.post('/api/users/invites', {
        email: inviteForm.email.trim(),
        role: inviteForm.role
      });
      toast(res.data?.message || 'Invitation sent successfully!', 'success');
      setInviteModalOpen(false);
      setInviteForm({ email: '', role: 'staff' });
      setRefresh((k) => k + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to send invitation', 'error');
    } finally {
      setSendingInvite(false);
    }
  };

  // Open Edit Roles
  const openEditRoles = (targetUser: any) => {
    if (targetUser.is_primary_owner) {
      toast('The primary workspace owner role cannot be edited', 'error');
      return;
    }
    const targetRoles = targetUser.roles || [targetUser.role];
    const isTargetAdmin = targetRoles.includes('owner') || targetRoles.includes('admin');
    if (!isOwnerOrAdmin && isTargetAdmin) {
      toast('Only workspace owners and administrators can edit administrator accounts', 'error');
      return;
    }

    const roles = Array.isArray(targetUser.roles) && targetUser.roles.length > 0
      ? targetUser.roles
      : [targetUser.role || 'staff'];
    setSelectedRoles(roles);
    setEditingUser(targetUser);
  };

  // Save User Roles
  const handleSaveUserRoles = async () => {
    if (!editingUser) return;
    if (selectedRoles.length === 0) {
      toast('At least one role must be assigned', 'error');
      return;
    }

    setSavingRoles(true);
    try {
      await api.put(`/api/users/${editingUser.id}/role`, {
        role: selectedRoles[0],
        roles: selectedRoles
      });
      toast(`Roles updated for ${editingUser.name}`, 'success');
      setEditingUser(null);
      setRefresh((k) => k + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update user roles', 'error');
    } finally {
      setSavingRoles(false);
    }
  };

  // Delete User Handler
  const handleDeleteUser = async (targetUser: any) => {
    if (targetUser.is_primary_owner) {
      toast('The primary workspace owner cannot be removed', 'error');
      return;
    }
    if (targetUser.id === user.id) {
      toast('You cannot remove your own account from the workspace', 'error');
      return;
    }
    const targetRoles = targetUser.roles || [targetUser.role];
    const isTargetAdmin = targetRoles.includes('owner') || targetRoles.includes('admin');
    if (!isOwnerOrAdmin && isTargetAdmin) {
      toast('Only workspace owners and administrators can remove administrator accounts', 'error');
      return;
    }

    const ok = await confirm({
      title: 'Remove Team Member',
      message: `Are you sure you want to remove "${targetUser.name}" (${targetUser.email}) from ${workspace?.name || 'this workspace'}? They will immediately lose access.`,
      tone: 'danger',
      confirmText: 'Remove Member'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/users/${targetUser.id}`);
      toast(`User ${targetUser.name} removed`, 'info');
      setRefresh((k) => k + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to remove user', 'error');
    }
  };

  // Revoke Invite Handler
  const handleRevokeInvite = async (inviteId: string) => {
    const ok = await confirm({
      title: 'Revoke Invitation',
      message: 'Are you sure you want to cancel this pending invitation? The invite link will become invalid.',
      tone: 'danger',
      confirmText: 'Revoke Invite'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/users/invites/${inviteId}`);
      toast('Invitation revoked', 'info');
      setRefresh((k) => k + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to revoke invitation', 'error');
    }
  };

  // Columns for Team Members
  const memberColumns: TableColumn<any>[] = [
    {
      key: 'name',
      label: 'Member Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <strong className="font-semibold text-slate-900 block">{row.name}</strong>
          {row.is_primary_owner && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-purple-100 text-purple-800 border border-purple-300">
              ★ Primary Owner
            </span>
          )}
        </div>
      )
    },
    {
      key: 'email',
      label: 'Email Address',
      sortable: true,
      render: (row) => <span className="text-slate-500 font-mono text-xs">{row.email}</span>
    },
    {
      key: 'roles',
      label: 'Assigned Roles',
      render: (row) => {
        const rolesList = row.roles && row.roles.length > 0 ? row.roles : [row.role || 'staff'];
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {rolesList.map((r: string) => (
              <span
                key={r}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  r === 'owner'
                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-extrabold'
                    : r === 'admin'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold'
                    : r === 'manager'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200/80'
                }`}
              >
                {r.replace('_', ' ')}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status || 'Active'} />
    },
    {
      key: 'created_at',
      label: 'Joined Date',
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 text-xs">
          {row.created_at ? formatDate(row.created_at) : 'Active'}
        </span>
      )
    }
  ];

  // Columns for Pending Invitations
  const inviteColumns: TableColumn<any>[] = [
    {
      key: 'email',
      label: 'Invitee Email',
      sortable: true,
      render: (row) => <strong className="font-semibold text-slate-900 block">{row.email}</strong>
    },
    {
      key: 'role',
      label: 'Assigned Role',
      sortable: true,
      render: (row) => (
        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-bold uppercase tracking-wider">
          {(row.role || 'staff').replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Sent Date',
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 text-xs">
          {row.created_at ? formatDate(row.created_at) : 'Recent'}
        </span>
      )
    },
    {
      key: 'expires_at',
      label: 'Expires',
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 text-xs">
          {row.expires_at ? formatDate(row.expires_at) : '7 days'}
        </span>
      )
    },
    {
      key: 'token',
      label: 'Invitation Link',
      render: (row) => (
        row.token ? (
          <Button
            variant="secondary"
            className="py-1 px-2.5 text-xs inline-flex items-center gap-1 cursor-pointer"
            icon={<Copy size={12} />}
            onClick={() => {
              const link = `${window.location.origin}/accept-invite?token=${row.token}`;
              navigator.clipboard.writeText(link);
              toast('Invitation link copied to clipboard!', 'success');
            }}
          >
            Copy Link
          </Button>
        ) : (
          <span className="text-slate-400 text-xs">No token</span>
        )
      )
    }
  ];

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Users & Team module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <PageTitle
        icon={<UserPlus />}
        title="Users & Team"
        subtitle="Manage workspace team members, multi-role assignments, operational permissions and pending invitations."
      />

      {/* Unified Tab Switcher Matching ERP Standard */}
      <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${
            tab === 'members' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => {
            setTab('members');
            setRoleFilter('');
            setStatusFilter('');
          }}
        >
          Team Members
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${
            tab === 'invites' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => {
            setTab('invites');
            setRoleFilter('');
            setStatusFilter('');
          }}
        >
          Pending Invitations
        </button>
      </div>

      {/* Unified DataTable Component */}
      <DataTable
        endpoint={tab === 'members' ? '/api/users' : '/api/users/invites'}
        columns={tab === 'members' ? memberColumns : inviteColumns}
        refreshKey={refresh}
        showDateFilters={true}
        filters={{
          role: roleFilter || undefined,
          status: tab === 'members' ? (statusFilter || undefined) : undefined
        }}
        extraFilters={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                options={[
                  { value: '', label: 'All Roles' },
                  ...WORKSPACE_ROLES.map((r) => ({ value: r.value, label: r.label }))
                ]}
                placeholder="All Roles"
              />
            </div>
            {tab === 'members' && (
              <div className="w-36">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' },
                    { value: 'Suspended', label: 'Suspended' }
                  ]}
                  placeholder="All Status"
                />
              </div>
            )}
            {(roleFilter || (tab === 'members' && statusFilter)) && (
              <button
                type="button"
                onClick={() => {
                  setRoleFilter('');
                  setStatusFilter('');
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-200/70 transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        }
        onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
        rowId={(row) => String(row.id || '')}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canExport={canExport}
        onCreate={canCreate ? () => setInviteModalOpen(true) : undefined}
        createLabel="Invite Member"
        onView={tab === 'members' ? (row) => setViewingUser(row) : (row) => setViewingInvite(row)}
        onEdit={tab === 'members' && canEdit ? (row) => openEditRoles(row) : undefined}
        onDelete={
          tab === 'members'
            ? (canDelete ? (row) => handleDeleteUser(row) : undefined)
            : (canDelete ? (row) => handleRevokeInvite(row.id) : undefined)
        }
        emptyTitle={tab === 'members' ? 'No team members found' : 'No pending invitations found'}
      />

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <Modal
          title="Invite Team Member"
          onClose={() => setInviteModalOpen(false)}
        >
          <form onSubmit={handleSendInvite} className="space-y-4">
            <Field label="Invitee Email Address">
              <input
                type="email"
                className={inputCls}
                required
                placeholder="colleague@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </Field>

            <Field label="Primary Role Assignment">
              <Select
                value={inviteForm.role}
                onChange={(val) => setInviteForm({ ...inviteForm, role: val })}
                options={assignableRoles}
              />
            </Field>

            {/* Live Role Capabilities Preview */}
            <RolePermissionsPreview
              roles={[inviteForm.role]}
              permissions={matrixPermissions}
              title="Live Role Capabilities Preview"
              defaultExpanded={false}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendingInvite} icon={<Plus size={16} />}>
                {sendingInvite ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Multi-Role Assignment Modal */}
      {editingUser && (
        <Modal
          title={`Assign Roles: ${editingUser.name}`}
          onClose={() => setEditingUser(null)}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-bold text-slate-900">{editingUser.name}</div>
              <div className="text-xs text-slate-500 font-mono">{editingUser.email}</div>
            </div>

            <Field label="Assigned Roles (Multi-Select)">
              <Select
                multiple
                values={selectedRoles}
                onMultiChange={setSelectedRoles}
                options={assignableRoles}
                placeholder="Select roles..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Permissions will dynamically aggregate across all selected roles.
              </p>
            </Field>

            {/* Live Role Capabilities Preview */}
            <RolePermissionsPreview
              roles={selectedRoles}
              permissions={matrixPermissions}
              title="Combined Capabilities Preview"
              defaultExpanded={true}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveUserRoles} disabled={savingRoles} icon={<Check size={16} />}>
                {savingRoles ? 'Saving...' : 'Save Roles'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Column-Selective CSV Export Modal */}
      {exportModalData && (
        <ExportColumnModal
          title={`Export ${tab === 'members' ? 'Team Members' : 'Pending Invitations'} to CSV`}
          recordCount={exportModalData.total}
          availableColumns={tab === 'members' ? USER_EXPORT_COLUMNS : INVITE_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const allCols = tab === 'members' ? USER_EXPORT_COLUMNS : INVITE_EXPORT_COLUMNS;
            const exportCols: TableColumn<any>[] = allCols
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));

            const formattedRecords = records.map((r: any) => {
              const rolesList = Array.isArray(r.roles) ? r.roles : (r.roles ? String(r.roles).split(',') : [r.role || 'staff']);
              return {
                ...r,
                roles_display: rolesList.map((x: string) => x.replace('_', ' ')).join(', '),
                role_display: (r.role || 'staff').replace('_', ' '),
                is_primary_owner_label: r.is_primary_owner ? 'Yes (Primary)' : 'No',
                status: r.status || 'Active',
                created_at_formatted: r.created_at ? formatDate(r.created_at) : '-',
                last_login_at_formatted: r.last_login_at ? formatDate(r.last_login_at) : 'Never',
                expires_at_formatted: r.expires_at ? formatDate(r.expires_at) : '-',
                invite_link: r.token ? `${window.location.origin}/accept-invite?token=${r.token}` : ''
              };
            });

            csvDownload(
              `${tab === 'members' ? 'team_members' : 'pending_invitations'}_export_${new Date().toISOString().slice(0, 10)}.csv`,
              formattedRecords,
              exportCols
            );
            toast(`Exported ${records.length} records with ${exportCols.length} columns!`, 'success');
          }}
        />
      )}

      {/* Team Member View Details Drawer */}
      {viewingUser && (
        <UserDetailDrawer
          userId={viewingUser.id}
          initialData={viewingUser}
          matrixPermissions={matrixPermissions}
          onClose={() => setViewingUser(null)}
          onEditRoles={canEdit ? (target) => openEditRoles(target) : undefined}
          onDeleteUser={canDelete ? (target) => handleDeleteUser(target) : undefined}
        />
      )}

      {/* Pending Invitation View Details Drawer */}
      {viewingInvite && (
        <UserDetailDrawer
          inviteId={viewingInvite.id}
          initialData={viewingInvite}
          matrixPermissions={matrixPermissions}
          onClose={() => setViewingInvite(null)}
          onRevokeInvite={canDelete ? (id) => handleRevokeInvite(id) : undefined}
        />
      )}
    </div>
  );
}
