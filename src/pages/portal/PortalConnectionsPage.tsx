import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../../context';
import { usePortal } from '../../components/AppShell';
import type { WorkspaceConnection } from '../../components/AppShell';
import {
  Link2, CheckCircle2, Clock, ArrowRight,
  RefreshCw, Mail, Phone
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function PortalConnectionsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { activeConnections, pendingRequests, activeWorkspace, setActiveWorkspace, refreshData } = usePortal();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAcceptInvite = async (membershipId: string) => {
    try {
      setActionLoading(`accept-${membershipId}`);
      const res = await api.post(`/portal/connections/${membershipId}/accept`, {});
      if (res.data?.ok) {
        toast(res.data.message || 'Connected successfully!', 'success');
        await refreshData();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to accept connection', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineInvite = async (membershipId: string) => {
    try {
      setActionLoading(`decline-${membershipId}`);
      const res = await api.post(`/portal/connections/${membershipId}/decline`, {});
      if (res.data?.ok) {
        toast('Connection invitation declined', 'info');
        await refreshData();
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to decline connection', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLaunchWorkspace = (ws: WorkspaceConnection) => {
    setActiveWorkspace(ws);
    navigate('/portal/orders');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 font-bold">
            <Link2 size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Workspace Connections
            </h1>
            <p className="text-xs text-slate-500">
              Active partnerships ({activeConnections.length}) and pending invitations ({pendingRequests.length})
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          icon={<RefreshCw size={14} />}
          onClick={() => refreshData()}
          className="text-xs font-bold self-start sm:self-auto"
        >
          Refresh Connections
        </Button>
      </div>

      {/* Pending Connection Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Pending Connection Requests ({pendingRequests.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((req) => (
              <div
                key={req.membership_id}
                className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      {req.portal_type === 'vendor' ? 'Vendor Link' : 'Customer Link'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {req.company_code}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900">{req.company_name}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Requested on {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : 'recently'}.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                    <Clock size={12} /> Awaiting Approval / Action
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === `accept-${req.membership_id}`}
                      onClick={() => handleAcceptInvite(req.membership_id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === `decline-${req.membership_id}`}
                      onClick={() => handleDeclineInvite(req.membership_id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Workspace Connections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Connected Client Workspaces ({activeConnections.length})
            </h3>
          </div>
        </div>

        {activeConnections.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Link2 size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">No Connected Workspaces Yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Partner access is granted strictly by workspace invitation. Once a client workspace sends you an invitation, it will appear here for you to accept.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeConnections.map((ws) => {
              const isCurrent = activeWorkspace?.company_id === ws.company_id;
              return (
                <div
                  key={ws.company_id}
                  className={`bg-white rounded-3xl p-5 border transition shadow-xs flex flex-col justify-between gap-4 ${
                    isCurrent ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {ws.company_code}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ws.portal_type === 'vendor' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {ws.portal_type === 'vendor' ? 'Supplier Role' : 'Customer Role'}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md flex items-center gap-1">
                          <CheckCircle2 size={10} /> Active Context
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                      {ws.company_name}
                    </h4>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                      {ws.support_email && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{ws.support_email}</span>
                        </div>
                      )}
                      {ws.support_phone && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span>{ws.support_phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Currency: {ws.currency || 'INR'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleLaunchWorkspace(ws)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Open Orders</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
