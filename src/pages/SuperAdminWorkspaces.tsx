import { useState, useEffect, useCallback } from 'react';
import {
  Server, Trash2, RefreshCw,
  Search, Eye, CreditCard,
  Calendar, Clock, Sparkles, Building2,
  Play, Pause, StopCircle, XCircle, Shield
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Drawer, Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';

export type Workspace = {
  id: string;
  name: string;
  company_code: string;
  database_name: string;
  business_type: string;
  currency: string;
  plan: string;
  status: string;
  subscription_status?: string;
  subscription_id?: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  canceled_at?: string | null;
  onboarding_completed_at?: string | null;
  created_at: string;
  last_activity_at: string;
  suspended_at: string | null;
  status_reason?: string | null;
  status_reason_updated_at?: string | null;
  status_reason_updated_by?: string | null;
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

interface PaymentRecord {
  id: string;
  event_id: string;
  provider: string;
  event_type: string;
  plan: string;
  amount: number | null;
  currency: string;
  status: string;
  date: string;
  period_end: string | null;
  invoice_number: string | null;
  receipt_url: string | null;
}

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'provisioning', label: 'Provisioning' }
];

const PLAN_FILTERS = [
  { value: '', label: 'All Assigned Plans' },
  { value: 'trial', label: 'Trial' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' }
];

const PRESET_REASONS: Record<string, string[]> = {
  pause: [
    'Overdue subscription payment',
    'Customer requested temporary pause',
    'Under administrative review',
    'Scheduled maintenance / upgrade',
    'Pending contract renewal'
  ],
  stop: [
    'Repeated non-payment / past due grace period',
    'Violation of platform terms',
    'Security / fraud investigation',
    'Customer account closure request',
    'Critical policy non-compliance'
  ],
  cancel: [
    'Customer requested cancellation',
    'Subscription expired without renewal',
    'Plan transitioned to separate custom agreement',
    'Non-payment beyond final notice'
  ],
  start: [
    'Subscription payment received & confirmed',
    'Account verified & compliant',
    'Administrative review cleared',
    'Customer request approved'
  ]
};

export function SuperAdminWorkspaces({ workspaces: initialWorkspaces }: { workspaces?: any }) {
  const toast = useToast();
  const confirm = useConfirm();
  const initialList = Array.isArray(initialWorkspaces)
    ? initialWorkspaces
    : (initialWorkspaces?.items || initialWorkspaces?.workspaces || []);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialList);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspaceStatusFilter, setWorkspaceStatusFilter] = useState('');
  const [workspacePlanFilter, setWorkspacePlanFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [showWorkspaceDetail, setShowWorkspaceDetail] = useState(false);
  const [loading, setLoading] = useState(false);

  const [totalWorkspaces, setTotalWorkspaces] = useState(0);

  // SuperAdmin Action with Reason Modal
  const [actionModal, setActionModal] = useState<{
    workspaceId: string;
    workspaceName: string;
    action: 'start' | 'pause' | 'stop' | 'cancel';
    reason: string;
  } | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Payment History State
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [paymentWorkspace, setPaymentWorkspace] = useState<Workspace | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const handleRefresh = useCallback(async (page = currentPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: workspaceSearch,
        status: workspaceStatusFilter,
        plan: workspacePlanFilter
      });
      const res = await api.get(`/admin/workspaces?${params}`);
      const list = res.data.items || res.data.workspaces || (Array.isArray(res.data) ? res.data : []);
      setWorkspaces(list);
      setTotalWorkspaces(res.data.total !== undefined ? res.data.total : list.length);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch workspaces', 'error');
    } finally {
      setLoading(false);
    }
  }, [workspaceSearch, workspaceStatusFilter, workspacePlanFilter, toast, currentPage]);

  useEffect(() => {
    handleRefresh(currentPage);
  }, [currentPage, workspaceStatusFilter, workspacePlanFilter, handleRefresh]);

  const loadPaymentHistory = async (workspace: Workspace) => {
    setPaymentWorkspace(workspace);
    setShowPaymentsModal(true);
    setLoadingPayments(true);
    try {
      const res = await api.get(`/admin/workspaces/${workspace.id}/payments`);
      setPayments(res.data?.payments || []);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch payment history', 'error');
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  const openActionModal = (id: string, name: string, action: 'start' | 'pause' | 'stop' | 'cancel') => {
    const defaultPreset = PRESET_REASONS[action]?.[0] || '';
    setActionModal({
      workspaceId: id,
      workspaceName: name,
      action,
      reason: defaultPreset
    });
  };

  const handleExecuteActionWithReason = async () => {
    if (!actionModal) return;
    const { workspaceId, action, reason } = actionModal;

    setSubmittingAction(true);
    try {
      const res = await api.post(`/admin/workspaces/${workspaceId}/${action}`, {
        reason: (reason || '').trim() || `Administrative ${action} applied by Super Admin`
      });
      toast(res.data?.message || `Workspace plan ${action}ed successfully`, 'success');
      setActionModal(null);
      handleRefresh(currentPage);
      if (selectedWorkspace && selectedWorkspace.id === workspaceId) {
        setSelectedWorkspace(res.data?.company || {
          ...selectedWorkspace,
          status: action === 'cancel' ? 'cancelled' : action === 'pause' ? 'paused' : action === 'stop' ? 'suspended' : 'active',
          status_reason: reason
        });
      }
    } catch (err: any) {
      toast(err.response?.data?.error || `Failed to execute ${action} on workspace`, 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const workspaceAction = async (id: string, type: 'suspend' | 'reactivate' | 'delete') => {
    if (type === 'delete') {
      const userAgreed = await confirm({
        title: 'Permanently Delete Workspace Database',
        message: 'PERMANENTLY DELETE this workspace? An automated SQL backup will be archived before the database is dropped. This action cannot be undone.',
        tone: 'danger',
        confirmText: 'Delete & Drop Database',
        cancelText: 'Cancel'
      });
      if (!userAgreed) return;
    }
    try {
      const data = type === 'delete' ? { confirmation_code: 'CONFIRM_PERMANENT_DELETE' } : {};
      await api.post(`/admin/workspaces/${id}/${type}`, data);
      toast(`Workspace ${type}d successfully`, 'success');
      handleRefresh(currentPage);
    } catch (err: any) {
      toast(err.response?.data?.error || `Failed to ${type} workspace`, 'error');
    }
  };

  const getPlanBadgeClass = (plan: string) => {
    const p = (plan || '').toLowerCase();
    if (p === 'enterprise') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (p === 'professional' || p === 'pro') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (p === 'starter') return 'bg-slate-100 text-slate-800 border-slate-200';
    return 'bg-blue-100 text-blue-800 border-blue-200'; // trial
  };

  const getExpiryInfo = (w: Workspace) => {
    const now = Date.now();
    const expiryDateStr = w.current_period_end || w.trial_ends_at;
    if (!expiryDateStr) {
      return { label: 'Ongoing', isExpired: false, daysLeft: null, dateStr: 'N/A' };
    }
    const expiryTime = new Date(expiryDateStr).getTime();
    const diffDays = Math.ceil((expiryTime - now) / 86400000);
    const dateFormatted = new Date(expiryDateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    if (diffDays <= 0) {
      return {
        label: 'Expired',
        isExpired: true,
        daysLeft: 0,
        dateStr: dateFormatted
      };
    }
    return {
      label: `${diffDays}d remaining`,
      isExpired: false,
      daysLeft: diffDays,
      dateStr: dateFormatted
    };
  };

  const hasActiveFilters = Boolean(workspaceSearch || workspaceStatusFilter || workspacePlanFilter);

  useEffect(() => {
    setCurrentPage(1);
  }, [workspaceSearch, workspaceStatusFilter, workspacePlanFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle
          icon={<Server />}
          title="All Workspaces"
          subtitle={`${totalWorkspaces} total tenant workspaces (20 per page)`}
        />
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={15} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search, Separate Status Filter & Plan Filter Bar */}
      <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search by company name, code, or database..."
            value={workspaceSearch}
            onChange={(e) => setWorkspaceSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition"
          />
        </div>

        {/* Custom Status & Plan Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-[150px]">
            <Select
              value={workspaceStatusFilter}
              onChange={setWorkspaceStatusFilter}
              options={STATUS_FILTERS}
              placeholder="All Statuses"
              className="w-full"
              triggerClassName="bg-slate-50 border-slate-200"
            />
          </div>

          <div className="w-[165px]">
            <Select
              value={workspacePlanFilter}
              onChange={setWorkspacePlanFilter}
              options={PLAN_FILTERS}
              placeholder="All Assigned Plans"
              className="w-full"
              triggerClassName="bg-slate-50 border-slate-200"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setWorkspaceSearch('');
                setWorkspaceStatusFilter('');
                setWorkspacePlanFilter('');
              }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold px-2.5 py-2 rounded-lg hover:bg-red-50 border border-red-200 transition whitespace-nowrap cursor-pointer flex items-center gap-1"
            >
              <XCircle size={13} /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Workspaces Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px] text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Company</th>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Assigned Plan</th>
                <th className="p-3.5">Activated On</th>
                <th className="p-3.5">Expires On</th>
                <th className="p-3.5 text-center">Users</th>
                <th className="p-3.5 text-center">Items</th>
                <th className="p-3.5 text-center">Records</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {(Array.isArray(workspaces) ? workspaces : []).map((row) => {
                const expiry = getExpiryInfo(row);
                const activatedDate = row.created_at
                  ? new Date(row.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'N/A';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <strong className="block text-slate-900 font-bold text-sm leading-snug">{row.name}</strong>
                      <span className="font-mono text-[10px] text-slate-400">{row.database_name}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 font-bold">{row.company_code}</td>
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                            row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : row.status === 'trial'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : row.status === 'suspended'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {row.status}
                        </span>
                        {row.status_reason && row.status !== 'active' && row.status !== 'trial' && (
                          <div className="text-[10px] text-slate-500 max-w-[170px] truncate" title={`Super Admin Internal Reason: ${row.status_reason}`}>
                            <span className="font-semibold text-slate-700">Reason:</span> {row.status_reason}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Read-only Plan Badge (No dropdown as requested) */}
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] border tracking-wider inline-flex items-center gap-1 ${getPlanBadgeClass(
                          row.plan
                        )}`}
                      >
                        <Sparkles size={11} />
                        {row.plan || 'TRIAL'}
                      </span>
                    </td>

                    {/* Activated Date */}
                    <td className="p-3.5 whitespace-nowrap text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{activatedDate}</span>
                      </div>
                    </td>

                    {/* Expires On & Remaining Time */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-900 font-medium">
                          <Clock size={13} className="text-slate-400" />
                          <span>{expiry.dateStr}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            expiry.isExpired
                              ? 'bg-red-100 text-red-700'
                              : expiry.daysLeft && expiry.daysLeft <= 7
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {expiry.label}
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5 text-center font-semibold text-slate-700">{row.user_count}</td>
                    <td className="p-3.5 text-center text-slate-500 font-semibold">
                      {row.raw_materials_count + row.finished_goods_count}
                    </td>
                    <td className="p-3.5 text-center text-slate-500 font-semibold">
                      {row.procurements_count + row.production_batches_count + row.sales_count + row.expenses_count}
                    </td>

                    <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                      {/* Payment History Trigger */}
                      <Button
                        variant="ghost"
                        className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                        title="View Subscription & Payment History"
                        onClick={() => loadPaymentHistory(row)}
                      >
                        <CreditCard size={14} />
                      </Button>

                      {/* Detail Drawer */}
                      <Button
                        variant="ghost"
                        title="Inspect Workspace"
                        onClick={() => {
                          setSelectedWorkspace(row);
                          setShowWorkspaceDetail(true);
                        }}
                      >
                        <Eye size={14} />
                      </Button>

                      {/* Lifecycle: Start / Resume */}
                      {(row.status === 'paused' || row.status === 'suspended' || row.status === 'cancelled') && (
                        <Button
                          variant="ghost"
                          className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          title="Start / Resume Workspace Plan"
                          onClick={() => openActionModal(row.id, row.name, 'start')}
                        >
                          <Play size={14} className="fill-emerald-600 text-emerald-600" />
                        </Button>
                      )}

                      {/* Lifecycle: Pause */}
                      {(row.status === 'active' || row.status === 'trial') && (
                        <Button
                          variant="ghost"
                          className="text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          title="Pause Workspace Subscription"
                          onClick={() => openActionModal(row.id, row.name, 'pause')}
                        >
                          <Pause size={14} />
                        </Button>
                      )}

                      {/* Lifecycle: Stop */}
                      {(row.status === 'active' || row.status === 'trial' || row.status === 'paused') && (
                        <Button
                          variant="ghost"
                          className="text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                          title="Stop Workspace Operations"
                          onClick={() => openActionModal(row.id, row.name, 'stop')}
                        >
                          <StopCircle size={14} />
                        </Button>
                      )}

                      {/* Lifecycle: Cancel */}
                      {(row.status === 'active' || row.status === 'trial' || row.status === 'paused') && (
                        <Button
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Cancel Plan Subscription"
                          onClick={() => openActionModal(row.id, row.name, 'cancel')}
                        >
                          <XCircle size={14} />
                        </Button>
                      )}

                      {/* Hard Delete */}
                      <Button
                        variant="danger"
                        title="Delete Workspace & Drop DB"
                        onClick={() => workspaceAction(row.id, 'delete')}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {workspaces.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">
                    <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold">No workspaces match the current filter</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing the status filter or search query</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={totalWorkspaces}
          pageSize={20}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Workspace Detail Drawer */}
      {showWorkspaceDetail && selectedWorkspace && (
        <Drawer
          onClose={() => setShowWorkspaceDetail(false)}
          title={selectedWorkspace.name}
        >
          <div className="space-y-6 text-sm">
            {/* Plan & Subscription Card */}
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan & Subscription</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${getPlanBadgeClass(
                    selectedWorkspace.plan
                  )}`}
                >
                  {selectedWorkspace.plan || 'TRIAL'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Subscription Status:</span>
                  <strong className="text-slate-900 font-semibold capitalize">
                    {selectedWorkspace.subscription_status || selectedWorkspace.status}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Currency:</span>
                  <strong className="text-slate-900 font-semibold">{selectedWorkspace.currency}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Activated On:</span>
                  <strong className="text-slate-900 font-semibold">
                    {selectedWorkspace.created_at
                      ? new Date(selectedWorkspace.created_at).toLocaleDateString()
                      : 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Expires / Renews:</span>
                  <strong className="text-slate-900 font-semibold">
                    {getExpiryInfo(selectedWorkspace).dateStr} ({getExpiryInfo(selectedWorkspace).label})
                  </strong>
                </div>
              </div>

              {/* SuperAdmin Internal Reason Card if exists */}
              {selectedWorkspace.status_reason && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                    <Shield size={12} className="text-amber-700" />
                    <span>Super Admin Audit Rationale (Private)</span>
                  </div>
                  <p className="text-slate-800 font-medium leading-relaxed bg-white/90 p-2.5 rounded-lg border border-amber-200/60">
                    "{selectedWorkspace.status_reason}"
                  </p>
                  {selectedWorkspace.status_reason_updated_at && (
                    <div className="text-[10px] text-slate-500 pt-0.5">
                      Recorded on {new Date(selectedWorkspace.status_reason_updated_at).toLocaleString()}
                      {selectedWorkspace.status_reason_updated_by ? ` by ${selectedWorkspace.status_reason_updated_by}` : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Plan Lifecycle Action Buttons inside Drawer */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Plan Lifecycle Controls</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openActionModal(selectedWorkspace.id, selectedWorkspace.name, 'start')}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Play size={13} className="fill-emerald-700" /> Start / Resume
                  </button>

                  <button
                    type="button"
                    onClick={() => openActionModal(selectedWorkspace.id, selectedWorkspace.name, 'pause')}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Pause size={13} /> Pause Plan
                  </button>

                  <button
                    type="button"
                    onClick={() => openActionModal(selectedWorkspace.id, selectedWorkspace.name, 'stop')}
                    className="px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <StopCircle size={13} /> Stop Workspace
                  </button>

                  <button
                    type="button"
                    onClick={() => openActionModal(selectedWorkspace.id, selectedWorkspace.name, 'cancel')}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <XCircle size={13} /> Cancel Plan
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <Button
                  variant="secondary"
                  className="w-full justify-center text-xs"
                  onClick={() => {
                    setShowWorkspaceDetail(false);
                    loadPaymentHistory(selectedWorkspace);
                  }}
                >
                  <CreditCard size={14} className="mr-1.5" /> View Payment History
                </Button>
              </div>
            </div>

            {/* General Workspace Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Company Code:</span>
                <span className="font-mono font-bold text-slate-800">{selectedWorkspace.company_code}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Database Schema:</span>
                <span className="font-mono text-slate-600">{selectedWorkspace.database_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Business Type:</span>
                <span className="font-medium text-slate-800">{selectedWorkspace.business_type || 'General'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Users:</span>
                <span className="font-bold text-slate-900">{selectedWorkspace.user_count}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Last Activity:</span>
                <span className="font-medium text-slate-700">
                  {selectedWorkspace.last_activity_at
                    ? new Date(selectedWorkspace.last_activity_at).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Suspension Date:</span>
                <span className="font-medium text-slate-700">
                  {selectedWorkspace.suspended_at ? new Date(selectedWorkspace.suspended_at).toLocaleString() : 'None'}
                </span>
              </div>
            </div>

            {/* Record Counts */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Tenant Database Metrics</h4>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                {[
                  { label: 'Raw Materials', value: selectedWorkspace.raw_materials_count },
                  { label: 'Finished Goods', value: selectedWorkspace.finished_goods_count },
                  { label: 'Procurements', value: selectedWorkspace.procurements_count },
                  { label: 'Production Runs', value: selectedWorkspace.production_batches_count },
                  { label: 'Sales Orders', value: selectedWorkspace.sales_count },
                  { label: 'Expenses', value: selectedWorkspace.expenses_count },
                  { label: 'Users', value: selectedWorkspace.users_count },
                  { label: 'Vendors', value: selectedWorkspace.vendors_count },
                  { label: 'Customers', value: selectedWorkspace.customers_count }
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <div className="text-[11px] text-slate-500">{item.label}</div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* SuperAdmin Action with Reason Modal */}
      {actionModal && (
        <Modal
          title={`${
            actionModal.action === 'pause'
              ? 'Pause Subscription'
              : actionModal.action === 'stop'
              ? 'Stop Workspace Operations'
              : actionModal.action === 'cancel'
              ? 'Cancel Subscription'
              : 'Start / Resume Workspace'
          } — ${actionModal.workspaceName}`}
          onClose={() => setActionModal(null)}
        >
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <Shield size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                Provide an administrative rationale for this action. This audit note is stored for Super Admin tracking and is <strong className="text-slate-900">never visible to portal users</strong>.
              </span>
            </div>

            {/* Quick-Select Reason Tags */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Quick-Select Reason:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(PRESET_REASONS[actionModal.action] || []).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setActionModal({ ...actionModal, reason: preset })}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                      actionModal.reason === preset
                        ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reason Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Internal Administrative Reason (Super Admin Only):
              </label>
              <textarea
                rows={3}
                value={actionModal.reason}
                onChange={(e) => setActionModal({ ...actionModal, reason: e.target.value })}
                placeholder="Enter detailed reason for the audit trail..."
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setActionModal(null)} disabled={submittingAction}>
                Cancel
              </Button>
              <Button
                variant={
                  actionModal.action === 'start'
                    ? 'primary'
                    : actionModal.action === 'pause'
                    ? 'secondary'
                    : 'danger'
                }
                onClick={handleExecuteActionWithReason}
                disabled={submittingAction}
                className={
                  actionModal.action === 'pause'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                    : ''
                }
              >
                {submittingAction
                  ? 'Applying...'
                  : actionModal.action === 'pause'
                  ? 'Pause Workspace'
                  : actionModal.action === 'stop'
                  ? 'Stop Workspace'
                  : actionModal.action === 'cancel'
                  ? 'Cancel Subscription'
                  : 'Resume Workspace'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Plan Payment History Modal */}
      {showPaymentsModal && paymentWorkspace && (
        <Modal
          title={`Payment & Plan History — ${paymentWorkspace.name}`}
          onClose={() => {
            setShowPaymentsModal(false);
            setPaymentWorkspace(null);
            setPayments([]);
          }}
        >
          <div className="space-y-4">
            {/* Header Summary Card */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-xs text-slate-400">Current Assigned Plan</div>
                <div className="text-xl font-extrabold capitalize flex items-center gap-2">
                  <span>{paymentWorkspace.plan || 'Trial'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 font-semibold border border-blue-400/30 uppercase">
                    {paymentWorkspace.status}
                  </span>
                </div>
              </div>
              <div className="text-xs text-slate-300 sm:text-right">
                <div>
                  <strong>Activated:</strong>{' '}
                  {paymentWorkspace.created_at ? new Date(paymentWorkspace.created_at).toLocaleDateString() : 'N/A'}
                </div>
                <div>
                  <strong>Expires:</strong> {getExpiryInfo(paymentWorkspace).dateStr}
                </div>
              </div>
            </div>

            {/* Payment Transactions Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Plan / Event</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="p-3">
                        <strong className="block text-slate-900 font-bold">{p.plan}</strong>
                        <span className="text-[10px] font-mono text-slate-400">{p.invoice_number || p.event_id}</span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        {p.amount !== null ? `${p.currency} ${p.amount.toFixed(2)}` : 'Included in Trial'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            p.status === 'Paid' || p.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'Active Trial'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {p.date ? new Date(p.date).toLocaleString() : '-'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{p.provider}</td>
                    </tr>
                  ))}

                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        {loadingPayments ? 'Loading payment transactions...' : 'No payment records recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPaymentsModal(false);
                  setPaymentWorkspace(null);
                  setPayments([]);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}