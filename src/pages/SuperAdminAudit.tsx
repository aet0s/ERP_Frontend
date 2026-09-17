import { useState, useEffect } from 'react';
import {
  Activity, Search, RefreshCw, Download, ShieldCheck, ShieldAlert,
  Eye, FileText, CheckCircle2, Lock, Building2, User, Key, Layers,
  SlidersHorizontal, RotateCcw, AlertTriangle, Shield
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { usePersistentTab } from '../hooks/usePersistentTab';

type AuditLog = {
  id: string;
  company_id: string | null;
  company_name?: string | null;
  user_id: string | null;
  action: string;
  metadata: any;
  prev_hash?: string | null;
  hash?: string | null;
  created_at: string;
};

type WorkspaceOption = {
  id: string;
  name: string;
};

type AuditStats = {
  total: number;
  platformCount: number;
  workspaceCount: number;
};

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'superadmin_login', label: 'Super Admin Login' },
  { value: 'superadmin_logout', label: 'Super Admin Logout' },
  { value: 'superadmin_create_user', label: 'User Created' },
  { value: 'superadmin_update_user_roles', label: 'User Roles Updated' },
  { value: 'superadmin_delete_user', label: 'User Deleted' },
  { value: 'workspace_started', label: 'Workspace Started / Activated' },
  { value: 'workspace_resumed', label: 'Workspace Resumed' },
  { value: 'workspace_paused', label: 'Workspace Paused' },
  { value: 'workspace_stopped', label: 'Workspace Stopped' },
  { value: 'workspace_cancelled', label: 'Workspace Cancelled' },
  { value: 'superadmin_create_backup', label: 'Database Backup Created' },
  { value: 'superadmin_update_permissions', label: 'Permissions Matrix Updated' },
  { value: 'superadmin_update_settings', label: 'Platform Settings Updated' }
];

export function SuperAdminAudit() {
  const toast = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [stats, setStats] = useState<AuditStats>({ total: 0, platformCount: 0, workspaceCount: 0 });
  const [scope, setScope] = usePersistentTab<'all' | 'platform' | 'workspaces'>('superadmin_audit_scope', 'all', 'scope');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedWorkspace, setSelectedWorkspace] = useState('all');
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid?: boolean;
    verifiedCount?: number;
    total?: number;
    headHash?: string;
    brokenAtId?: string;
    reason?: string;
  } | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const PAGE_SIZE = 20;

  // Load workspaces for filter
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await api.get('/admin/workspaces');
        const list = Array.isArray(res.data) ? res.data : (res.data?.workspaces || []);
        setWorkspaces(list.map((w: any) => ({ id: w.id, name: w.name })));
      } catch (err) {
        console.warn('Failed to load workspaces for filter:', err);
      }
    };
    fetchWorkspaces();
  }, []);

  const loadAuditLogs = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
        scope,
        search: auditSearch,
        action: selectedAction,
        company_id: selectedWorkspace,
        start_date: startDate,
        end_date: endDate
      });
      const res = await api.get(`/admin/audit?${params}`);
      const logs = res.data.logs || (Array.isArray(res.data) ? res.data : []);
      setAuditLogs(logs);
      setAuditTotal(res.data.total || logs.length);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
      setAuditPage(page);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs(1);
  }, [scope, auditSearch, selectedAction, selectedWorkspace, startDate, endDate]);

  const verifyChain = async () => {
    try {
      setVerifying(true);
      const res = await api.get('/admin/audit/verify');
      setVerificationResult(res.data);
      if (res.data.valid) {
        toast(`✅ Cryptographic Audit Chain Validated! (${res.data.verifiedCount || 0} entries verified)`, 'success');
      } else {
        toast(`⚠️ Audit Chain Tamper Detected: ${res.data.reason || 'Hash mismatch'}`, 'error');
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to verify cryptographic chain', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const exportLogs = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        scope,
        search: auditSearch,
        action: selectedAction,
        company_id: selectedWorkspace,
        start_date: startDate,
        end_date: endDate
      });
      const res = await api.get(`/admin/audit/export?${params}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `platform_audit_${scope}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast(`Exported audit logs as ${format.toUpperCase()}`, 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to export audit logs', 'error');
    }
  };

  const resetAllFilters = () => {
    setScope('all');
    setSelectedWorkspace('all');
    setSelectedAction('all');
    setAuditSearch('');
    setStartDate('');
    setEndDate('');
  };

  const workspaceOptions = [
    { value: 'all', label: 'All Workspaces & Platform' },
    { value: 'platform', label: 'Super Admin Platform Only (Global)' },
    ...workspaces.map((w) => ({ value: w.id, label: w.name }))
  ];

  const hasActiveFilters = auditSearch || selectedAction !== 'all' || selectedWorkspace !== 'all' || startDate || endDate || scope !== 'all';

  const getActionBadge = (action: string) => {
    if (action.includes('login') || action.includes('logout')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-[11px] font-semibold border border-blue-200/60 shadow-2xs">
          <Key size={11} className="text-blue-500 shrink-0" />
          {action}
        </span>
      );
    }
    if (action.includes('create') || action.includes('started') || action.includes('resumed')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-[11px] font-semibold border border-emerald-200/60 shadow-2xs">
          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
          {action}
        </span>
      );
    }
    if (action.includes('paused') || action.includes('update') || action.includes('role')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-mono text-[11px] font-semibold border border-amber-200/60 shadow-2xs">
          <SlidersHorizontal size={11} className="text-amber-500 shrink-0" />
          {action}
        </span>
      );
    }
    if (action.includes('stop') || action.includes('cancel') || action.includes('delete')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-mono text-[11px] font-semibold border border-rose-200/60 shadow-2xs">
          <AlertTriangle size={11} className="text-rose-500 shrink-0" />
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-mono text-[11px] font-semibold border border-purple-200/60 shadow-2xs">
        <Shield size={11} className="text-purple-500 shrink-0" />
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle
          icon={<Activity />}
          title="Platform & Super Admin Audit Log"
          subtitle={`Complete audit trail & cryptographic record verification • ${auditTotal} events shown`}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            icon={<ShieldCheck size={15} className={verificationResult?.valid ? 'text-emerald-600' : 'text-slate-600'} />}
            disabled={verifying}
            onClick={verifyChain}
          >
            {verifying ? 'Verifying Hashes...' : 'Verify Cryptographic Chain'}
          </Button>
          <Button variant="secondary" icon={<Download size={15} />} onClick={() => exportLogs('csv')}>
            Export CSV
          </Button>
          <Button variant="secondary" icon={<FileText size={15} />} onClick={() => exportLogs('json')}>
            Export JSON
          </Button>
          <Button variant="secondary" onClick={() => loadAuditLogs(auditPage)} disabled={loading}>
            <RefreshCw size={15} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Audit Trail</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{stats.total || auditTotal}</span>
            <span className="text-[11px] text-slate-500 font-medium">Recorded Events in Master Chain</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <Layers size={22} />
          </div>
        </div>

        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Super Admin Actions</span>
            <span className="text-2xl font-extrabold text-indigo-900 mt-0.5 block">{stats.platformCount}</span>
            <span className="text-[11px] text-indigo-600 font-medium">Logins, Backups, Permissions, Lifecycle</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-2xs">
            <ShieldCheck size={22} />
          </div>
        </div>

        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Workspace Operations</span>
            <span className="text-2xl font-extrabold text-emerald-900 mt-0.5 block">{stats.workspaceCount}</span>
            <span className="text-[11px] text-emerald-600 font-medium">Tenant Activity Across Portals</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {/* Cryptographic Verification Status Alert */}
      {verificationResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            verificationResult.valid
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 shadow-xs'
              : 'bg-rose-50/90 border-rose-200 text-rose-900 shadow-xs'
          }`}
        >
          {verificationResult.valid ? (
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <div className="flex items-center justify-between">
              <strong className="font-bold text-sm">
                {verificationResult.valid
                  ? 'Cryptographic Chain 100% Verified & Tamper-Proof'
                  : 'Tampering or Chain Integrity Violation Detected'}
              </strong>
              <button
                type="button"
                onClick={() => setVerificationResult(null)}
                className="text-xs opacity-60 hover:opacity-100 underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <p className="mt-1 leading-relaxed opacity-90">
              {verificationResult.valid
                ? `SHA-256 hash chains from genesis to head are continuous and mathematically intact across all ${verificationResult.verifiedCount} recorded events.`
                : verificationResult.reason || 'Cryptographic signature mismatch.'}
            </p>
            {verificationResult.headHash && (
              <div className="mt-2 font-mono text-[11px] bg-white/70 p-2 rounded-xl border border-emerald-200/60 truncate flex items-center gap-1.5">
                <Lock size={12} className="text-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-800">Head Hash:</span> {verificationResult.headHash}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scope Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setScope('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            scope === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers size={14} /> All Activity
        </button>
        <button
          type="button"
          onClick={() => setScope('platform')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            scope === 'platform'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Shield size={14} /> Super Admin Platform Actions
        </button>
        <button
          type="button"
          onClick={() => setScope('workspaces')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            scope === 'workspaces'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 size={14} /> Workspace Operations
        </button>
      </div>

      {/* Advanced Filters Panel */}
      <div className="p-4 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Logs</label>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search actor, reason, action..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition"
              />
            </div>
          </div>

          {/* Workspace Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Workspace Filter</label>
            <Select
              value={selectedWorkspace}
              onChange={setSelectedWorkspace}
              options={workspaceOptions}
              placeholder="All Workspaces & Platform"
            />
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Action Type</label>
            <Select
              value={selectedAction}
              onChange={setSelectedAction}
              options={ACTION_OPTIONS}
              placeholder="All Actions"
            />
          </div>

          {/* Date Range Filters */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Date Range (DD-MM-YYYY)</label>
            <div className="flex items-center gap-2">
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Start Date"
                className="w-full text-xs"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="End Date"
                className="w-full text-xs"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filtered results active • {auditTotal} entries found</span>
            <button
              type="button"
              onClick={resetAllFilters}
              className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} /> Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5 rounded-tl-2xl">Timestamp</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Scope / Workspace</th>
                <th className="p-3.5">Actor / Initiator</th>
                <th className="p-3.5">Cryptographic Proof</th>
                <th className="p-3.5 text-right rounded-tr-2xl">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition group">
                  <td className="p-3.5 whitespace-nowrap text-slate-500">
                    <div className="font-semibold text-slate-800">{new Date(log.created_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{new Date(log.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-3.5">
                    {getActionBadge(log.action)}
                  </td>
                  <td className="p-3.5">
                    {log.company_name ? (
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <Building2 size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{log.company_name}</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-200/60">
                        <Shield size={11} className="text-indigo-500" /> Platform Super Admin
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{log.user_id || 'super_admin'}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    {log.hash ? (
                      <div className="inline-flex items-center gap-1 bg-slate-900 text-emerald-400 px-2.5 py-1 rounded-lg font-mono text-[10px] border border-slate-800 shadow-2xs">
                        <Lock size={10} className="text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{log.hash.slice(0, 10)}...{log.hash.slice(-6)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">Legacy</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <Button
                      variant="secondary"
                      className="py-1 px-2.5 text-xs inline-flex items-center gap-1 cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye size={12} /> Inspect
                    </Button>
                  </td>
                </tr>
              ))}
              {auditLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <Activity size={36} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    <p className="font-bold text-slate-800 text-sm">No audit logs matching current filters</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Try widening your date range, switching the scope tab, or clearing specific filters.
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="secondary"
                        onClick={resetAllFilters}
                        className="mt-3 inline-flex items-center gap-1"
                      >
                        <RotateCcw size={13} /> Reset All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={auditPage}
          totalItems={auditTotal}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => loadAuditLogs(p)}
        />
      </div>

      {/* Log Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Activity size={16} className="text-blue-600" /> Audit Record Details
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {selectedLog.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Action</span>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Timestamp</span>
                  <span className="font-semibold text-slate-800 block mt-1">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Scope / Workspace</span>
                  <span className="font-semibold text-slate-800 block mt-1">{selectedLog.company_name || 'Platform Super Admin (Global)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px] font-semibold uppercase">Actor / Initiator</span>
                  <span className="font-semibold text-slate-800 block mt-1">{selectedLog.user_id || 'super_admin'}</span>
                </div>
              </div>

              {/* Cryptographic Chain Integrity Proof */}
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl space-y-2 border border-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                  <Lock size={13} /> Tamper-Proof Cryptographic Hash Chain
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PREVIOUS HASH:</span>
                    <span className="text-slate-300 break-all">{selectedLog.prev_hash || '0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-400 block text-[10px]">RECORD HASH (SHA-256):</span>
                    <span className="text-emerald-300 font-bold break-all">{selectedLog.hash || 'N/A (Legacy Record)'}</span>
                  </div>
                </div>
              </div>

              {/* Metadata JSON Payload */}
              <div>
                <span className="font-bold text-slate-700 block mb-1.5 uppercase text-[11px]">Event Metadata & Context</span>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto font-mono text-[11px] border border-slate-800 max-h-56">
                  {typeof selectedLog.metadata === 'string'
                    ? selectedLog.metadata
                    : JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}