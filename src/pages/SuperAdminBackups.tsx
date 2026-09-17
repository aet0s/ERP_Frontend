import { useState, useEffect } from 'react';
import {
  Database, Download, RefreshCw, Trash2, RotateCcw, Search, Eye,
  Copy, Check, FileCode, Layers, ShieldCheck, HardDrive, Plus,
  AlertTriangle, X, Clock, Building2, Server, Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Pagination } from '../components/ui/Pagination';
import { usePersistentTab } from '../hooks/usePersistentTab';

type BackupItem = {
  id: string;
  filename: string;
  type: string;
  type_label: string;
  workspace_id: string | null;
  workspace_name: string;
  company_code: string;
  database_name: string;
  size: number;
  size_formatted: string;
  created_at: string;
  checksum: string;
  table_count: number;
  tables: string[];
};

type BackupStats = {
  totalCount: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  masterBackupCount: number;
  tenantBackupCount: number;
  lastBackupAt: string | null;
};

type WorkspaceOption = {
  id: string;
  name: string;
  company_code?: string;
  database_name?: string;
};

type WorkspaceSchedule = {
  id: string;
  company_name: string;
  company_code: string;
  database_name: string;
  status: string;
  plan: string;
  auto_backup_enabled: number;
  auto_backup_frequency: string;
  auto_backup_retention_days: number;
  auto_backup_time: string;
  last_auto_backup_at: string | null;
};

type MasterSchedule = {
  id: string;
  name: string;
  database_name: string;
  is_master: boolean;
  auto_backup_enabled: number;
  auto_backup_frequency: string;
  auto_backup_retention_days: number;
  auto_backup_time: string;
  last_auto_backup_at: string | null;
};

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily (Every 24h)' },
  { value: 'weekly', label: 'Weekly (Every 7 days)' },
  { value: 'monthly', label: 'Monthly (Every 30 days)' }
];

const RETENTION_OPTIONS = [
  { value: '7', label: '7 Days' },
  { value: '14', label: '14 Days' },
  { value: '30', label: '30 Days (Recommended)' },
  { value: '60', label: '60 Days' },
  { value: '90', label: '90 Days' },
  { value: '180', label: '180 Days' },
  { value: '365', label: '365 Days (1 Year)' }
];

export function SuperAdminBackups() {
  const toast = useToast();
  const [activeTab, setActiveTab] = usePersistentTab<'snapshots' | 'schedules'>('superadmin_backups', 'snapshots');

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [stats, setStats] = useState<BackupStats>({
    totalCount: 0,
    totalSizeBytes: 0,
    totalSizeFormatted: '0 Bytes',
    masterBackupCount: 0,
    tenantBackupCount: 0,
    lastBackupAt: null
  });
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Schedules state
  const [masterSchedule, setMasterSchedule] = useState<MasterSchedule | null>(null);
  const [workspaceSchedules, setWorkspaceSchedules] = useState<WorkspaceSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [runningCron, setRunningCron] = useState(false);

  const handleTriggerCron = async () => {
    try {
      setRunningCron(true);
      const res = await api.post('/admin/backups/cron/run');
      toast(res.data?.message || 'Automated backup check completed successfully!', 'success');
      await Promise.all([loadBackups(), loadSchedules()]);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to execute backup cron check', 'error');
    } finally {
      setRunningCron(false);
    }
  };

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedWorkspace, setSelectedWorkspace] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [totalBackups, setTotalBackups] = useState(0);

  // Sidebar & Modals
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTarget, setCreateTarget] = useState<'full' | 'workspace' | 'master'>('full');
  const [selectedTargetWorkspace, setSelectedTargetWorkspace] = useState('');

  const [restoreModalBackup, setRestoreModalBackup] = useState<BackupItem | null>(null);
  const [deleteModalBackup, setDeleteModalBackup] = useState<BackupItem | null>(null);

  // Load Workspaces for filter & trigger
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const res = await api.get('/admin/workspaces?all=true');
        const list = Array.isArray(res.data) ? res.data : (res.data?.workspaces || res.data?.items || []);
        setWorkspaces(list.map((w: any) => ({
          id: w.id,
          name: w.name,
          company_code: w.company_code,
          database_name: w.database_name
        })));
        if (list.length > 0) {
          setSelectedTargetWorkspace(list[0].id);
        }
      } catch (err) {
        console.warn('Failed to load workspaces:', err);
      }
    };
    fetchWorkspaces();
  }, []);

  const loadBackups = async (pageToLoad = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageToLoad.toString(),
        limit: '20',
        search,
        type: selectedType,
        workspace_id: selectedWorkspace
      });
      const res = await api.get(`/admin/backups?${params}`);
      const list = res.data.backups || res.data.items || (Array.isArray(res.data) ? res.data : []);
      setBackups(list);
      setTotalBackups(res.data.total !== undefined ? res.data.total : list.length);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch backups', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      setSchedulesLoading(true);
      const res = await api.get('/admin/backups/schedules');
      if (res.data.masterSchedule) {
        setMasterSchedule(res.data.masterSchedule);
      }
      if (res.data.workspaceSchedules) {
        setWorkspaceSchedules(res.data.workspaceSchedules);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to load backup schedules', 'error');
    } finally {
      setSchedulesLoading(false);
    }
  };

  useEffect(() => {
    loadBackups(page);
  }, [page, search, selectedType, selectedWorkspace]);

  useEffect(() => {
    loadSchedules();
  }, []);

  // Open Detailed Sidebar and fetch preview data
  const handleOpenSidebar = async (item: BackupItem) => {
    setSelectedBackup(item);
    setCopiedChecksum(false);
    try {
      setPreviewLoading(true);
      const res = await api.get(`/admin/backups/${item.filename}/preview`);
      setPreviewData(res.data);
    } catch (err: any) {
      setPreviewData(null);
      console.warn('Failed to load preview:', err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopyChecksum = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedChecksum(true);
    toast('SHA-256 Checksum copied to clipboard', 'success');
    setTimeout(() => setCopiedChecksum(false), 2000);
  };

  // Download SQL
  const handleDownload = (filename: string) => {
    const token = localStorage.getItem('erp_platform_token');
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const downloadUrl = `${api.defaults.baseURL}/admin/backups/${filename}/download${tokenQuery}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast(`Downloading backup file: ${filename}`, 'success');
  };

  // Create Backup (Single, Master, or FULL)
  const handleCreateBackup = async () => {
    try {
      setActionLoading(true);
      if (createTarget === 'full') {
        const res = await api.post('/admin/backups/full', {});
        toast(res.data.message || 'Full system backup completed successfully!', 'success');
      } else if (createTarget === 'master') {
        const res = await api.post('/admin/backups/master', {});
        toast(res.data.message || 'Master Platform Database backup created successfully', 'success');
      } else {
        if (!selectedTargetWorkspace) {
          toast('Please select a workspace', 'error');
          return;
        }
        const res = await api.post('/admin/backups/trigger', { workspace_id: selectedTargetWorkspace });
        toast(`Backup created for ${res.data.workspace_name || 'workspace'}`, 'success');
      }
      setShowCreateModal(false);
      loadBackups();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create backup', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Restore Backup
  const handleRestore = async () => {
    if (!restoreModalBackup) return;
    try {
      setActionLoading(true);
      const res = await api.post(
        '/admin/backups/restore',
        { filename: restoreModalBackup.filename, workspace_id: restoreModalBackup.workspace_id }
      );
      toast(res.data.message || 'Database restored successfully', 'success');
      setRestoreModalBackup(null);
      if (selectedBackup?.filename === restoreModalBackup.filename) {
        setSelectedBackup(null);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to restore database', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Backup
  const handleDelete = async () => {
    if (!deleteModalBackup) return;
    try {
      setActionLoading(true);
      await api.delete(`/admin/backups/${deleteModalBackup.filename}`);
      toast(`Deleted backup file '${deleteModalBackup.filename}'`, 'success');
      setDeleteModalBackup(null);
      if (selectedBackup?.filename === deleteModalBackup.filename) {
        setSelectedBackup(null);
      }
      loadBackups();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete backup', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save Schedule for Workspace
  const handleSaveWorkspaceSchedule = async (sched: WorkspaceSchedule) => {
    try {
      setSavingScheduleId(sched.id);
      await api.put(
        `/admin/backups/schedules/${sched.id}`,
        {
          auto_backup_enabled: sched.auto_backup_enabled,
          auto_backup_frequency: sched.auto_backup_frequency,
          auto_backup_retention_days: sched.auto_backup_retention_days,
          auto_backup_time: sched.auto_backup_time
        }
      );
      toast(`Automated backup schedule saved for ${sched.company_name}`, 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update schedule', 'error');
    } finally {
      setSavingScheduleId(null);
    }
  };

  // Save Schedule for Master
  const handleSaveMasterSchedule = async () => {
    if (!masterSchedule) return;
    try {
      setSavingScheduleId('master');
      await api.put(
        '/admin/backups/schedules/master',
        {
          auto_backup_enabled: masterSchedule.auto_backup_enabled,
          auto_backup_frequency: masterSchedule.auto_backup_frequency,
          auto_backup_retention_days: masterSchedule.auto_backup_retention_days,
          auto_backup_time: masterSchedule.auto_backup_time
        }
      );
      toast('Master Platform automated backup schedule saved', 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update schedule', 'error');
    } finally {
      setSavingScheduleId(null);
    }
  };

  const workspaceFilterOptions = [
    { value: 'all', label: 'All Databases & Workspaces' },
    { value: 'master', label: 'Master Platform DB (erp_master)' },
    ...workspaces.map((w) => ({ value: w.id, label: `${w.name} (${w.company_code || 'Tenant'})` }))
  ];

  const typeFilterOptions = [
    { value: 'all', label: 'All Backup Types' },
    { value: 'manual', label: 'Manual Snapshots' },
    { value: 'pre_deletion', label: 'Pre-Deletion Archives' },
    { value: 'master', label: 'Master Platform DB' }
  ];

  const targetWorkspaceOptions = [
    ...workspaces.map((w) => ({ value: w.id, label: `${w.name} [${w.database_name || 'DB'}]` }))
  ];

  const getTypeBadge = (type: string, label: string) => {
    if (type === 'master') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-200/60 shadow-2xs">
          <Server size={11} className="text-indigo-500 shrink-0" />
          {label}
        </span>
      );
    }
    if (type === 'pre_deletion') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold text-[11px] border border-rose-200/60 shadow-2xs">
          <AlertTriangle size={11} className="text-rose-500 shrink-0" />
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200/60 shadow-2xs">
        <Database size={11} className="text-blue-500 shrink-0" />
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle
          icon={<Database />}
          title="Database Backups & Disaster Recovery"
          subtitle={`Automated backup schedules, manual snapshots, and one-click recovery • ${backups.length} snapshots stored`}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            icon={<Plus size={15} />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Backup
          </Button>
          <Button
            variant="secondary"
            onClick={handleTriggerCron}
            disabled={runningCron || loading || schedulesLoading}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            title="Trigger automated backup cron cycle check immediately"
          >
            <Clock size={15} className={`mr-1.5 ${runningCron ? 'animate-spin' : ''}`} />
            {runningCron ? 'Running Cron...' : 'Run Backup Cron Check'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => { loadBackups(); loadSchedules(); }}
            disabled={loading || schedulesLoading}
          >
            <RefreshCw size={15} className={`mr-1 ${loading || schedulesLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Storage & Backup Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Backups</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{stats.totalCount}</span>
            <span className="text-[11px] text-slate-500 font-medium">SQL Dump Archives</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <Layers size={22} />
          </div>
        </div>

        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Storage Used</span>
            <span className="text-2xl font-extrabold text-indigo-900 mt-0.5 block">{stats.totalSizeFormatted}</span>
            <span className="text-[11px] text-indigo-600 font-medium">Compressed Disk Footprint</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-2xs">
            <HardDrive size={22} />
          </div>
        </div>

        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Automated Schedules</span>
            <span className="text-2xl font-extrabold text-emerald-900 mt-0.5 block">
              {workspaceSchedules.filter((s) => s.auto_backup_enabled).length} / {workspaceSchedules.length}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium">Workspaces with Auto-Backup Active</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
            <Calendar size={22} />
          </div>
        </div>

        <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Last Backup Taken</span>
            <span className="text-sm font-extrabold text-slate-900 mt-1 block truncate">
              {stats.lastBackupAt ? new Date(stats.lastBackupAt).toLocaleString() : 'No backups yet'}
            </span>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <ShieldCheck size={12} /> Integrity Monitored
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-2xs">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Main View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('snapshots')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'snapshots'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database size={14} /> Stored Backup Snapshots ({backups.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'schedules'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar size={14} /> Automated Backup Schedules & Retention ({workspaceSchedules.length + 1})
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: STORED BACKUP SNAPSHOTS */}
      {/* ============================================================ */}
      {activeTab === 'snapshots' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="p-4 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Keyword Search */}
              <div className="relative">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Backups</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    placeholder="Search file, workspace, db..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 transition"
                  />
                </div>
              </div>

              {/* Workspace Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Database / Workspace</label>
                <Select
                  value={selectedWorkspace}
                  onChange={setSelectedWorkspace}
                  options={workspaceFilterOptions}
                  placeholder="Filter by workspace..."
                />
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Backup Type</label>
                <Select
                  value={selectedType}
                  onChange={setSelectedType}
                  options={typeFilterOptions}
                  placeholder="Filter by type..."
                />
              </div>
            </div>

            {(search || selectedType !== 'all' || selectedWorkspace !== 'all') && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span>Filtered results active • {totalBackups} snapshots matching</span>
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSelectedType('all'); setSelectedWorkspace('all'); }}
                  className="font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} /> Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Main Backups Table */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 rounded-tl-2xl">Database / Workspace</th>
                    <th className="p-3.5">Backup Type</th>
                    <th className="p-3.5">File Name</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5">Created At</th>
                    <th className="p-3.5">Tables</th>
                    <th className="p-3.5 text-right rounded-tr-2xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {backups.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-blue-50/40 transition group cursor-pointer"
                      onClick={() => handleOpenSidebar(b)}
                    >
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {b.type === 'master' ? (
                            <Server size={14} className="text-indigo-600 shrink-0" />
                          ) : (
                            <Building2 size={14} className="text-blue-600 shrink-0" />
                          )}
                          <span>{b.workspace_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          DB: {b.database_name}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {getTypeBadge(b.type, b.type_label)}
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]" title={b.filename}>
                          <FileCode size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{b.filename}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                          {b.size_formatted}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-500">
                        <div className="font-semibold text-slate-800">{new Date(b.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{new Date(b.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                          <Layers size={12} className="text-slate-400" /> {b.table_count || 0} tables
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            className="py-1 px-2 text-xs inline-flex items-center gap-1 cursor-pointer"
                            onClick={() => handleOpenSidebar(b)}
                            title="View Detailed Sidebar & Checksum"
                          >
                            <Eye size={12} /> Details
                          </Button>
                          <Button
                            variant="secondary"
                            className="py-1 px-2 text-xs inline-flex items-center gap-1 text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer"
                            onClick={() => handleDownload(b.filename)}
                            title="Download SQL Dump"
                          >
                            <Download size={12} /> Download
                          </Button>
                          <Button
                            variant="secondary"
                            className="py-1 px-2 text-xs inline-flex items-center gap-1 text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-pointer"
                            onClick={() => setRestoreModalBackup(b)}
                            title="Restore this Snapshot into Database"
                          >
                            <RotateCcw size={12} /> Restore
                          </Button>
                          <Button
                            variant="ghost"
                            className="py-1 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            onClick={() => setDeleteModalBackup(b)}
                            title="Delete this Archive"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        <Database size={36} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                        <p className="font-bold text-slate-800 text-sm">No backup archives found</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          Click "Create Backup" to generate a new snapshot of any tenant database or the platform master database.
                        </p>
                        <Button
                          variant="primary"
                          className="mt-3 inline-flex items-center gap-1.5"
                          onClick={() => setShowCreateModal(true)}
                        >
                          <Plus size={14} /> Create Snapshot Now
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalItems={totalBackups}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: AUTOMATED BACKUP SCHEDULES & RETENTION */}
      {/* ============================================================ */}
      {activeTab === 'schedules' && (
        <div className="space-y-5">
          {/* Master Platform Schedule Card */}
          {masterSchedule && (
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      Master Platform Database Schedule
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">
                        erp_master
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Backs up platform user accounts, company workspace registry, and audit logs.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-300 font-semibold">Automated Backup:</span>
                    <input
                      type="checkbox"
                      checked={Boolean(masterSchedule.auto_backup_enabled)}
                      onChange={(e) => setMasterSchedule({ ...masterSchedule, auto_backup_enabled: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 accent-indigo-500 cursor-pointer"
                    />
                    <span className={`text-xs font-bold ${masterSchedule.auto_backup_enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {masterSchedule.auto_backup_enabled ? 'Active' : 'Disabled'}
                    </span>
                  </label>
                  <Button
                    variant="primary"
                    className="bg-indigo-600 hover:bg-indigo-500 text-xs shadow-none border-0"
                    disabled={savingScheduleId === 'master'}
                    onClick={handleSaveMasterSchedule}
                  >
                    {savingScheduleId === 'master' ? 'Saving...' : 'Save Master Schedule'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1 font-semibold uppercase">Frequency</span>
                  <select
                    value={masterSchedule.auto_backup_frequency}
                    onChange={(e) => setMasterSchedule({ ...masterSchedule, auto_backup_frequency: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  >
                    {FREQUENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1 font-semibold uppercase">Retention Period</span>
                  <select
                    value={masterSchedule.auto_backup_retention_days}
                    onChange={(e) => setMasterSchedule({ ...masterSchedule, auto_backup_retention_days: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  >
                    {RETENTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1 font-semibold uppercase">Execution Time (UTC)</span>
                  <input
                    type="time"
                    value={masterSchedule.auto_backup_time}
                    onChange={(e) => setMasterSchedule({ ...masterSchedule, auto_backup_time: e.target.value })}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Workspaces Automated Backup Table */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Building2 size={16} className="text-blue-600" /> Workspace Backup Policies & Automation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure automated snapshots, retention cycles, and execution times for each company database.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 rounded-tl-2xl">Workspace</th>
                    <th className="p-3.5">Auto-Backup Status</th>
                    <th className="p-3.5">Frequency</th>
                    <th className="p-3.5">Retention Cycle</th>
                    <th className="p-3.5">Execution Time (UTC)</th>
                    <th className="p-3.5">Last Run</th>
                    <th className="p-3.5 text-right rounded-tr-2xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {workspaceSchedules.map((sched, idx) => (
                    <tr key={sched.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{sched.company_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">DB: {sched.database_name}</div>
                      </td>

                      <td className="p-3.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(sched.auto_backup_enabled)}
                            onChange={(e) => {
                              const updated = [...workspaceSchedules];
                              updated[idx] = { ...sched, auto_backup_enabled: e.target.checked ? 1 : 0 };
                              setWorkspaceSchedules(updated);
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          />
                          <span className={`text-xs font-bold ${sched.auto_backup_enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {sched.auto_backup_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>
                      </td>

                      <td className="p-3.5">
                        <select
                          value={sched.auto_backup_frequency}
                          onChange={(e) => {
                            const updated = [...workspaceSchedules];
                            updated[idx] = { ...sched, auto_backup_frequency: e.target.value };
                            setWorkspaceSchedules(updated);
                          }}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                        >
                          {FREQUENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3.5">
                        <select
                          value={sched.auto_backup_retention_days}
                          onChange={(e) => {
                            const updated = [...workspaceSchedules];
                            updated[idx] = { ...sched, auto_backup_retention_days: parseInt(e.target.value, 10) };
                            setWorkspaceSchedules(updated);
                          }}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                        >
                          {RETENTION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3.5">
                        <input
                          type="time"
                          value={sched.auto_backup_time || '02:00'}
                          onChange={(e) => {
                            const updated = [...workspaceSchedules];
                            updated[idx] = { ...sched, auto_backup_time: e.target.value };
                            setWorkspaceSchedules(updated);
                          }}
                          className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                        />
                      </td>

                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {sched.last_auto_backup_at ? (
                          <span>{new Date(sched.last_auto_backup_at).toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Scheduled nightly</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <Button
                          variant="secondary"
                          className="py-1 px-3 text-xs text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
                          disabled={savingScheduleId === sched.id}
                          onClick={() => handleSaveWorkspaceSchedule(sched)}
                        >
                          {savingScheduleId === sched.id ? 'Saving...' : 'Save Policy'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SLIDE-OVER DETAIL SIDEBAR (Drawer) */}
      {/* ============================================================ */}
      {selectedBackup && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-base">{selectedBackup.workspace_name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Database Snapshot & Integrity Inspection</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBackup(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Type and Storage Header Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Snapshot Type</span>
                  {getTypeBadge(selectedBackup.type, selectedBackup.type_label)}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
                  <div>
                    <span className="text-slate-400 block text-[10px]">FILE SIZE</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedBackup.size_formatted}</span>
                    <span className="text-[10px] text-slate-400 block">({selectedBackup.size.toLocaleString()} bytes)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CREATED ON</span>
                    <span className="font-semibold text-slate-800 block text-xs mt-0.5">
                      {new Date(selectedBackup.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Database & File Details */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[11px]">Database Specifications</h4>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Database Schema Name</span>
                    <span className="font-mono font-semibold text-slate-800 text-xs">{selectedBackup.database_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Archive File Name</span>
                    <span className="font-mono text-slate-700 text-[11px] break-all">{selectedBackup.filename}</span>
                  </div>
                </div>
              </div>

              {/* SHA-256 Checksum Card */}
              <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} /> SHA-256 Cryptographic Checksum
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyChecksum(selectedBackup.checksum)}
                    className="text-slate-300 hover:text-white flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-md transition cursor-pointer"
                  >
                    {copiedChecksum ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    {copiedChecksum ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-emerald-300 break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800 select-all">
                  {selectedBackup.checksum}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Cryptographically certifies this SQL archive has not been modified or corrupted since generation.
                </p>
              </div>

              {/* Included Tables Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[11px]">
                    Included Tables ({selectedBackup.tables?.length || selectedBackup.table_count || 0})
                  </h4>
                  {previewData?.insert_count !== undefined && (
                    <span className="text-slate-500 text-[11px]">{previewData.insert_count} Insert statements</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                  {(selectedBackup.tables && selectedBackup.tables.length > 0 ? selectedBackup.tables : ['users', 'audit_log', 'role_permissions']).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 bg-white text-slate-700 rounded-lg text-[10px] font-mono font-medium border border-slate-200 shadow-2xs"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* SQL Dump Preview Header */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[11px]">SQL Dump Preview</h4>
                {previewLoading ? (
                  <div className="p-6 bg-slate-950 text-slate-400 text-center rounded-xl font-mono text-[11px] flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Loading SQL headers...
                  </div>
                ) : (
                  <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl overflow-x-auto font-mono text-[10px] border border-slate-800 max-h-48 leading-relaxed">
                    {previewData?.preview || '-- ERP Studio SQL Dump Preview\n-- Schema definitions and tables included.'}
                  </pre>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                className="text-rose-600 hover:bg-rose-50 border-rose-200 text-xs"
                onClick={() => setDeleteModalBackup(selectedBackup)}
              >
                <Trash2 size={13} className="mr-1" /> Delete
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 text-xs"
                  onClick={() => setRestoreModalBackup(selectedBackup)}
                >
                  <RotateCcw size={13} className="mr-1" /> Restore
                </Button>
                <Button
                  variant="primary"
                  className="text-xs"
                  onClick={() => handleDownload(selectedBackup.filename)}
                >
                  <Download size={13} className="mr-1" /> Download .SQL
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE BACKUP MODAL (With Prominent FULL BACKUP Button) */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Database size={16} className="text-blue-600" /> Create Database Backup
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* FULL BACKUP OPTION (PROMINENT) */}
              <button
                type="button"
                onClick={() => setCreateTarget('full')}
                className={`w-full p-4 rounded-2xl border text-left transition relative cursor-pointer ${
                  createTarget === 'full'
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        FULL SYSTEM BACKUP
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Backs up the <strong className="text-slate-900">Master Platform DB</strong> AND <strong className="text-slate-900">All {workspaces.length} Workspace Databases</strong> in one unified parallel run.
                      </p>
                    </div>
                  </div>
                  {createTarget === 'full' && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check size={12} className="stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">or select specific database</span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              {/* Individual Target Selector Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateTarget('workspace')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    createTarget === 'workspace'
                      ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Building2 size={16} className="text-blue-600 mb-1" />
                  <div className="font-bold text-xs">Single Workspace</div>
                  <div className="text-[10px] text-slate-500 font-normal">Choose one company database</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateTarget('master')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    createTarget === 'master'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Server size={16} className="text-indigo-600 mb-1" />
                  <div className="font-bold text-xs">Master Platform DB</div>
                  <div className="text-[10px] text-slate-500 font-normal">erp_master schema only</div>
                </button>
              </div>

              {createTarget === 'workspace' && (
                <div className="pt-2 animate-in fade-in-50 duration-100">
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Select Workspace to Backup
                  </label>
                  <Select
                    value={selectedTargetWorkspace}
                    onChange={setSelectedTargetWorkspace}
                    options={targetWorkspaceOptions}
                    placeholder="Choose a workspace..."
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant={createTarget === 'full' ? 'primary' : 'secondary'}
                className={createTarget === 'full' ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold' : ''}
                onClick={handleCreateBackup}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Generating Backup...'
                  : createTarget === 'full'
                  ? 'Run Full System Backup (Master + All DBs)'
                  : 'Generate Snapshot'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE DATABASE CONFIRMATION MODAL */}
      {restoreModalBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-rose-100 bg-rose-50/80 flex items-center justify-between">
              <h3 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600" /> Confirm Database Restore
              </h3>
              <button
                type="button"
                onClick={() => setRestoreModalBackup(null)}
                className="w-7 h-7 rounded-lg hover:bg-rose-100 text-rose-700 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed font-medium">
                Are you sure you want to restore the database from snapshot{' '}
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1 py-0.5 rounded">
                  {restoreModalBackup.filename}
                </span>?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed space-y-1">
                <div className="font-bold text-[11px] flex items-center gap-1">
                  <AlertTriangle size={13} className="text-amber-600" /> Warning: Overwrite Action
                </div>
                <p className="text-[11px] text-amber-800">
                  Target Database: <strong className="font-mono">{restoreModalBackup.database_name}</strong>. Existing records in tables will be replaced by the snapshot data.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setRestoreModalBackup(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRestore}
                disabled={actionLoading}
              >
                {actionLoading ? 'Restoring Database...' : 'Yes, Restore Database'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE BACKUP CONFIRMATION MODAL */}
      {deleteModalBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Trash2 size={16} className="text-rose-600" /> Delete Backup Archive
              </h3>
              <button
                type="button"
                onClick={() => setDeleteModalBackup(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-2 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete backup archive{' '}
                <span className="font-mono font-bold text-slate-900 block mt-1 break-all bg-slate-100 p-2 rounded-lg">
                  {deleteModalBackup.filename}
                </span>
              </p>
              <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteModalBackup(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete Archive'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}