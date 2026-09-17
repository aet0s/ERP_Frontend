import { useState, useEffect } from 'react';
import {
  Lock
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Select } from '../components/ui/Select';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { PermissionsMatrixTable, type PermissionRow } from '../components/ui/PermissionsMatrixTable';

type Workspace = { id: string; name: string; status: string; plan?: string };

export function SuperAdminPermissions() {
  const toast = useToast();
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionWorkspaceId, setPermissionWorkspaceId] = usePersistentTab<string>('superadmin_permissions_workspace', '', 'workspace_id');
  const [permissionWorkspaces, setPermissionWorkspaces] = useState<Workspace[]>([]);

  const loadPermissionWorkspaces = async () => {
    try {
      const res = await api.get('/admin/workspaces');
      const raw = Array.isArray(res.data) ? res.data : (res.data?.workspaces || []);
      const list = raw.filter((w: any) => w.status !== 'deleted').map((w: any) => ({
        id: w.id,
        name: w.name,
        status: w.status,
        plan: w.plan
      }));
      setPermissionWorkspaces(list);
      if (list.length > 0 && !permissionWorkspaceId) {
        setPermissionWorkspaceId(list[0].id);
      }
    } catch { /* ignore */ }
  };

  const loadPermissions = async () => {
    if (!permissionWorkspaceId) return;
    try {
      setLoadingPermissions(true);
      const res = await api.get(`/admin/workspaces/${permissionWorkspaceId}/permissions`);
      setPermissions(res.data || []);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to load permissions', 'error');
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => { loadPermissionWorkspaces(); }, []);
  useEffect(() => { loadPermissions(); }, [permissionWorkspaceId]);

  const savePermissions = async () => {
    if (!permissionWorkspaceId) return;
    try {
      setSavingPermissions(true);
      await api.put(`/admin/workspaces/${permissionWorkspaceId}/permissions`, { permissions });
      toast('Roles & Permissions matrix updated successfully!', 'success');
      await loadPermissions();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save permissions', 'error');
    } finally { setSavingPermissions(false); }
  };

  const workspaceOptions = permissionWorkspaces.map((w) => ({
    value: w.id,
    label: w.name,
    description: `Status: ${w.status} | Plan: ${w.plan || 'N/A'}`
  }));

  const activeWorkspaceName = permissionWorkspaces.find(w => w.id === permissionWorkspaceId)?.name || 'Selected Workspace';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle
          icon={<Lock />}
          title="Platform Roles & Permissions Matrix"
          subtitle={`Managing detailed capabilities across ${permissionWorkspaces.length} tenant workspaces.`}
        />
      </div>

      {/* Workspace Selector Bar */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-96">
          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Select Target Workspace</label>
          <Select
            value={permissionWorkspaceId}
            onChange={(val) => setPermissionWorkspaceId(val)}
            options={workspaceOptions}
            placeholder="Select Workspace..."
            searchable
            className="w-full"
          />
        </div>

        <div className="text-right text-xs text-slate-500">
          <span className="font-semibold text-slate-800">{activeWorkspaceName}</span>
          <span className="block text-[11px]">Database permissions synchronized</span>
        </div>
      </div>

      {loadingPermissions ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-12 text-center text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Loading permissions for {activeWorkspaceName}...</p>
        </div>
      ) : permissionWorkspaceId && permissions.length > 0 ? (
        <PermissionsMatrixTable
          permissions={permissions}
          onChange={setPermissions}
          onSave={savePermissions}
          saving={savingPermissions}
          title={`Permissions Matrix: ${activeWorkspaceName}`}
          subtitle="Configure view, create, edit, delete, approve, and export privileges across all ERP roles."
        />
      ) : !permissionWorkspaceId ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-12 text-center text-slate-500">
          <Lock size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="font-semibold">Select a workspace above to manage its permissions matrix.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs p-12 text-center text-slate-500">
          <p className="font-semibold">No permissions configured for {activeWorkspaceName}.</p>
        </div>
      )}
    </div>
  );
}