import { useState, useMemo } from 'react';
import {
  Shield,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Download
} from 'lucide-react';
import { MODULE_METADATA, ROLE_METADATA, type PermissionRow } from './PermissionsMatrixTable';

interface RolePermissionsPreviewProps {
  roles: string[];
  permissions?: PermissionRow[];
  title?: string;
  defaultExpanded?: boolean;
  className?: string;
}

import { getDefaultRolePermission } from '../../lib/defaultRolePermissions';

export function RolePermissionsPreview({
  roles,
  permissions,
  title,
  defaultExpanded = false,
  className = ''
}: RolePermissionsPreviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [search, setSearch] = useState('');

  const activeRoles = useMemo(() => {
    return (roles || []).filter(Boolean);
  }, [roles]);

  // Aggregate permissions across all active roles for each module
  const aggregatedModules = useMemo(() => {
    const allModules = Object.keys(MODULE_METADATA);
    return allModules.map((mod) => {
      let can_view = 0;
      let can_create = 0;
      let can_edit = 0;
      let can_delete = 0;
      let can_approve = 0;
      let can_export = 0;

      activeRoles.forEach((role) => {
        if (role === 'owner' || role === 'admin') {
          can_view = 1;
          can_create = 1;
          can_edit = 1;
          can_delete = 1;
          can_approve = 1;
          can_export = 1;
          return;
        }

        // Check if explicit permission row exists
        if (permissions && permissions.length > 0) {
          const match = permissions.find((p) => p.role === role && p.module === mod);
          if (match) {
            if (match.can_view) can_view = 1;
            if (match.can_create) can_create = 1;
            if (match.can_edit) can_edit = 1;
            if (match.can_delete) can_delete = 1;
            if (match.can_approve) can_approve = 1;
            if (match.can_export) can_export = 1;
            return;
          }
        }

        // Fallback to shared DEFAULT_ROLE_PERMISSIONS
        const def = getDefaultRolePermission(role, mod);
        if (def) {
          if (def.view) can_view = 1;
          if (def.create) can_create = 1;
          if (def.edit) can_edit = 1;
          if (def.del) can_delete = 1;
          if (def.approve) can_approve = 1;
          if (def.export) can_export = 1;
        }
      });

      const meta = MODULE_METADATA[mod] || {
        label: mod.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        category: 'Operations',
        description: ''
      };

      const hasAnyAccess = can_view || can_create || can_edit || can_delete || can_approve || can_export;

      return {
        module: mod,
        meta,
        can_view,
        can_create,
        can_edit,
        can_delete,
        can_approve,
        can_export,
        hasAnyAccess
      };
    });
  }, [activeRoles, permissions]);

  const accessibleCount = aggregatedModules.filter((m) => m.hasAnyAccess).length;
  const totalCount = aggregatedModules.length;

  const filteredModules = useMemo(() => {
    if (!search.trim()) return aggregatedModules;
    const q = search.toLowerCase();
    return aggregatedModules.filter(
      (m) =>
        m.module.toLowerCase().includes(q) ||
        m.meta.label.toLowerCase().includes(q) ||
        m.meta.category.toLowerCase().includes(q) ||
        m.meta.description.toLowerCase().includes(q)
    );
  }, [aggregatedModules, search]);

  if (activeRoles.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-xl border border-blue-200/80 bg-blue-50/40 overflow-hidden text-xs ${className}`}>
      {/* Header Bar */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-blue-100/50 transition select-none"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Shield size={15} className="text-blue-600 shrink-0" />
          <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            {title || 'Permissions Matrix for Assigned Role(s)'}:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeRoles.map((r) => {
              const meta = ROLE_METADATA[r];
              return (
                <span
                  key={r}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    meta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {meta?.label || r}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
            {accessibleCount} of {totalCount} Modules Granted
          </span>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 p-0.5 rounded transition"
            aria-label={expanded ? 'Collapse permissions preview' : 'Expand permissions preview'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 bg-white border-t border-blue-100 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Live preview of capabilities granted to this user upon creation. Privileges union automatically across multiple roles.
            </p>
            <div className="relative w-48 shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter modules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200/80">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-2 text-left">Module</th>
                  <th className="p-2 text-center w-14">
                    <span className="flex items-center justify-center gap-1"><Eye size={11} /> View</span>
                  </th>
                  <th className="p-2 text-center w-14">
                    <span className="flex items-center justify-center gap-1"><Plus size={11} /> Create</span>
                  </th>
                  <th className="p-2 text-center w-14">
                    <span className="flex items-center justify-center gap-1"><Edit2 size={11} /> Edit</span>
                  </th>
                  <th className="p-2 text-center w-14">
                    <span className="flex items-center justify-center gap-1"><Trash2 size={11} /> Delete</span>
                  </th>
                  <th className="p-2 text-center w-14">
                    <span className="flex items-center justify-center gap-1"><CheckCircle2 size={11} /> Approve</span>
                  </th>
                  <th className="p-2 text-center w-14">
                    <span className="flex items-center justify-center gap-1"><Download size={11} /> Export</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredModules.map((item) => (
                  <tr
                    key={item.module}
                    className={`hover:bg-slate-50/70 transition ${
                      item.hasAnyAccess ? 'bg-white' : 'bg-slate-50/30 opacity-60'
                    }`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900">{item.meta.label}</span>
                        {(item.meta as any).navPath && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Page: {(item.meta as any).navPath}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1">{item.meta.description}</div>
                    </td>
                    <td className="p-2 text-center">
                      <StatusDot active={item.can_view === 1} label="View" />
                    </td>
                    <td className="p-2 text-center">
                      <StatusDot active={item.can_create === 1} label="Create" />
                    </td>
                    <td className="p-2 text-center">
                      <StatusDot active={item.can_edit === 1} label="Edit" />
                    </td>
                    <td className="p-2 text-center">
                      <StatusDot active={item.can_delete === 1} label="Delete" />
                    </td>
                    <td className="p-2 text-center">
                      <StatusDot active={item.can_approve === 1} label="Approve" />
                    </td>
                    <td className="p-2 text-center">
                      <StatusDot active={item.can_export === 1} label="Export" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  if (active) {
    return (
      <span
        title={`${label} Allowed`}
        className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 font-bold"
      >
        <Check size={12} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      title={`${label} Prohibited`}
      className="inline-block w-2.5 h-0.5 rounded-full bg-slate-300 mx-auto"
    />
  );
}
