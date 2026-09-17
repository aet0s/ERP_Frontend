import { useMemo } from 'react';
import { useWorkspace } from '../context';
import type { PermissionRecord } from '../lib/types';

export interface ModulePermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  // snake_case aliases for convenience
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
  // Role context flags
  isOwnerOrAdmin: boolean;
  role: string;
  roles: string[];
}

const FULL_ACCESS: (role: string, roles: string[]) => ModulePermissions = (role, roles) => ({
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canApprove: true,
  canExport: true,
  can_view: true,
  can_create: true,
  can_edit: true,
  can_delete: true,
  can_approve: true,
  can_export: true,
  isOwnerOrAdmin: true,
  role,
  roles
});

const NO_ACCESS: (role: string, roles: string[]) => ModulePermissions = (role, roles) => ({
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canApprove: false,
  canExport: false,
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_approve: false,
  can_export: false,
  isOwnerOrAdmin: false,
  role,
  roles
});

/**
 * Universal React hook to inspect dynamic RBAC module permissions for the currently logged-in user.
 * 
 * Rules:
 * - 'owner' and 'admin' always have full bypass across all actions.
 * - For non-owners, permissions are resolved dynamically from `user.permissions` (aggregated across all assigned roles).
 * - If no permission row exists for a module, all actions default strictly to `false` (zero-trust security).
 */
export function usePermissions(moduleName?: string): ModulePermissions {
  const { user } = useWorkspace();

  return useMemo(() => {
    if (!user) {
      return NO_ACCESS('guest', []);
    }

    const currentRole = user.role || 'accounts';
    const currentRoles: string[] = Array.isArray(user.roles) ? (user.roles as string[]) : [currentRole];

    const isOwnerOrAdmin =
      currentRole === 'owner' ||
      currentRole === 'admin' ||
      currentRoles.includes('owner') ||
      currentRoles.includes('admin');

    if (isOwnerOrAdmin) {
      return FULL_ACCESS(currentRole, currentRoles);
    }

    if (!moduleName) {
      return NO_ACCESS(currentRole, currentRoles);
    }

    const perm: PermissionRecord | undefined = (user.permissions || []).find(
      (p: any) => p.module === moduleName
    );

    if (!perm) {
      return NO_ACCESS(currentRole, currentRoles);
    }

    const canView = Boolean(Number(perm.can_view) === 1 || perm.can_view === true);
    const canCreate = Boolean(Number(perm.can_create) === 1 || perm.can_create === true);
    const canEdit = Boolean(Number(perm.can_edit) === 1 || perm.can_edit === true);
    const canDelete = Boolean(Number(perm.can_delete) === 1 || perm.can_delete === true);
    const canApprove = Boolean(Number(perm.can_approve) === 1 || perm.can_approve === true);
    const canExport = Boolean(Number(perm.can_export) === 1 || perm.can_export === true);

    return {
      canView,
      canCreate,
      canEdit,
      canDelete,
      canApprove,
      canExport,
      can_view: canView,
      can_create: canCreate,
      can_edit: canEdit,
      can_delete: canDelete,
      can_approve: canApprove,
      can_export: canExport,
      isOwnerOrAdmin: false,
      role: currentRole,
      roles: currentRoles
    };
  }, [user, moduleName]);
}
