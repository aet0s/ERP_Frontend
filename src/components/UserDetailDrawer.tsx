import { useEffect, useState } from 'react';
import {
  Shield, Edit3, Trash2, Copy, Check, UserCheck,
  ExternalLink, Mail, Send
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useToast } from '../context';
import { Drawer } from './ui/Modal';
import { Button } from './ui/Button';
import { StatusBadge } from './ui/StatusBadge';
import { RolePermissionsPreview } from './ui/RolePermissionsPreview';

interface UserDetailDrawerProps {
  userId?: string;
  inviteId?: string;
  initialData?: any;
  matrixPermissions?: any[];
  onClose: () => void;
  onEditRoles?: (user: any) => void;
  onDeleteUser?: (user: any) => void;
  onRevokeInvite?: (inviteId: string) => void;
}

const ROLE_STYLES: Record<string, { label: string; badge: string; desc: string }> = {
  owner: { label: 'Owner', badge: 'bg-purple-100 text-purple-800 border-purple-200', desc: 'Full administrative control over entire workspace' },
  admin: { label: 'Administrator', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', desc: 'Administrative management rights' },
  manager: { label: 'Manager', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', desc: 'Operational oversight and reporting' },
  accounts: { label: 'Accounts', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', desc: 'Invoicing, expenses, GST & financial ledger' },
  production_manager: { label: 'Production Manager', badge: 'bg-amber-50 text-amber-800 border-amber-200', desc: 'Manufacturing runs, recipes (BOM) & shifts' },
  sales_manager: { label: 'Sales Manager', badge: 'bg-blue-50 text-blue-700 border-blue-200', desc: 'Customer sales orders, invoices & dispatches' },
  staff: { label: 'Staff', badge: 'bg-slate-100 text-slate-700 border-slate-200', desc: 'Standard day-to-day operations and logging' }
};

export function UserDetailDrawer({
  userId,
  inviteId,
  initialData,
  matrixPermissions = [],
  onClose,
  onEditRoles,
  onDeleteUser,
  onRevokeInvite
}: UserDetailDrawerProps) {
  const toast = useToast();
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData && (Boolean(userId) || Boolean(inviteId)));
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isInvite = Boolean(inviteId) || (!userId && data?.token);

  useEffect(() => {
    let isMounted = true;
    if (userId) {
      setLoading(true);
      api.get(`/api/users/${userId}`)
        .then((res) => {
          if (isMounted) setData(res.data);
        })
        .catch(() => {
          if (isMounted && initialData) setData(initialData);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else if (inviteId) {
      setLoading(true);
      api.get(`/api/users/invites/${inviteId}`)
        .then((res) => {
          if (isMounted) setData(res.data);
        })
        .catch(() => {
          if (isMounted && initialData) setData(initialData);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [userId, inviteId, initialData]);

  const handleCopyEmail = () => {
    if (!data?.email) return;
    navigator.clipboard.writeText(data.email);
    setCopiedEmail(true);
    toast('Email copied to clipboard', 'info');
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyLink = () => {
    const link = data?.invite_link || (data?.token ? `${window.location.origin}/accept-invite?token=${data.token}` : '');
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast('Invitation link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const rolesList: string[] = data?.roles && Array.isArray(data.roles) && data.roles.length > 0
    ? data.roles
    : (data?.role ? [data.role] : ['staff']);

  return (
    <Drawer
      title={isInvite ? 'Invitation Details' : 'Team Member Profile'}
      onClose={onClose}
    >
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-slate-100 rounded-2xl" />
          <div className="h-44 bg-slate-100 rounded-2xl" />
          <div className="h-32 bg-slate-100 rounded-2xl" />
        </div>
      ) : data ? (
        <div className="space-y-6 text-slate-800 text-xs">
          {/* Top Profile Summary Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center font-bold text-base text-blue-200 uppercase shrink-0">
                  {isInvite ? <Send size={20} /> : (data.name ? data.name.charAt(0) : data.email?.charAt(0) || 'U')}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white leading-tight">
                      {isInvite ? 'Pending Invitation' : (data.name || 'Team Member')}
                    </h3>
                    {data.is_primary_owner && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide bg-purple-500/20 text-purple-200 border border-purple-400/40">
                        ★ Primary Owner
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300 text-xs mt-0.5 font-mono">
                    <Mail size={12} className="text-slate-400" />
                    <span>{data.email}</span>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copy email"
                    >
                      {copiedEmail ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {!isInvite && data.status && (
                <StatusBadge status={data.status} />
              )}
            </div>

            {/* Quick stats strip */}
            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-700/60 pt-2.5">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  {isInvite ? 'Sent On' : 'Joined Workspace'}
                </span>
                <span className="text-slate-200 font-medium">
                  {data.created_at ? formatDate(data.created_at) : 'Active'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                  {isInvite ? 'Expires In' : 'Last Login'}
                </span>
                <span className="text-slate-200 font-medium">
                  {isInvite
                    ? (data.expires_at ? formatDate(data.expires_at) : '7 days')
                    : (data.last_login_at ? formatDate(data.last_login_at) : 'Never')}
                </span>
              </div>
            </div>
          </div>

          {/* Invitation Link Banner (Invites Only) */}
          {isInvite && (
            <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-2">
              <span className="font-bold text-[11px] text-amber-900 uppercase tracking-wider block flex items-center gap-1.5">
                <ExternalLink size={13} className="text-amber-700" /> Direct Invitation Link
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                The invitee can use this link to complete their setup and join this workspace directly:
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={data.invite_link || (data.token ? `${window.location.origin}/accept-invite?token=${data.token}` : 'Token generated')}
                  className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-slate-700 select-all"
                />
                <Button
                  variant="secondary"
                  className="shrink-0 text-xs py-1.5 px-3 bg-white"
                  icon={copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  onClick={handleCopyLink}
                >
                  {copiedLink ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {/* Account Information Card */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <UserCheck size={14} className="text-blue-600" /> Account Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Full Name</span>
                <span className="font-semibold text-slate-900">{data.name || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Phone Number</span>
                <span className="font-semibold text-slate-900">{data.phone || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Email Address</span>
                <span className="font-mono text-slate-700">{data.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Member ID</span>
                <span className="font-mono text-[10px] text-slate-500 truncate block" title={data.id}>
                  {data.id || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Roles Section */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Shield size={14} className="text-blue-600" /> Assigned Roles ({rolesList.length})
              </h4>
              {!isInvite && onEditRoles && !data.is_primary_owner && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditRoles(data);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 size={12} /> Edit Roles
                </button>
              )}
            </div>

            <div className="space-y-2">
              {rolesList.map((rKey: string) => {
                const rMeta = ROLE_STYLES[rKey] || {
                  label: rKey.replace('_', ' '),
                  badge: 'bg-slate-100 text-slate-800 border-slate-200',
                  desc: 'Custom assigned role'
                };
                return (
                  <div key={rKey} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${rMeta.badge}`}>
                          {rMeta.label}
                        </span>
                        {rKey === data.role && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            (Primary)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {rMeta.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dynamic Module Capabilities Preview */}
          {!isInvite && (
            <div className="space-y-2">
              <RolePermissionsPreview
                roles={rolesList}
                permissions={matrixPermissions}
                title="Active Module Permissions"
                defaultExpanded={true}
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div>
              {!isInvite && onDeleteUser && !data.is_primary_owner && (
                <Button
                  variant="secondary"
                  className="text-red-600 hover:bg-red-50 hover:border-red-200 border-slate-200 text-xs"
                  icon={<Trash2 size={13} />}
                  onClick={() => {
                    onClose();
                    onDeleteUser(data);
                  }}
                >
                  Remove Member
                </Button>
              )}
              {isInvite && onRevokeInvite && (
                <Button
                  variant="secondary"
                  className="text-red-600 hover:bg-red-50 hover:border-red-200 border-slate-200 text-xs"
                  icon={<Trash2 size={13} />}
                  onClick={() => {
                    onClose();
                    onRevokeInvite(data.id || inviteId || '');
                  }}
                >
                  Revoke Invite
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose} className="text-xs">
                Close
              </Button>
              {!isInvite && onEditRoles && !data.is_primary_owner && (
                <Button
                  variant="primary"
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  icon={<Edit3 size={13} />}
                  onClick={() => {
                    onClose();
                    onEditRoles(data);
                  }}
                >
                  Assign Roles
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 text-xs">
          No record details could be loaded.
        </div>
      )}
    </Drawer>
  );
}
