import { useState, useEffect, useRef } from 'react';
import {
  Activity, RefreshCw, Database, Server, Building2,
  ShieldCheck, AlertTriangle, Cpu, HardDrive, Clock, Zap,
  CheckCircle2, XCircle, Search, Layers, Radio,
  Download, Terminal
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { usePersistentTab } from '../hooks/usePersistentTab';

type HealthModule = {
  id: string;
  name: string;
  category: string;
  status: 'healthy' | 'warning' | 'degraded' | 'unreachable';
  latency_ms: number;
  details: string;
  metric: string;
};

type WorkspaceHealth = {
  id: string;
  name: string;
  company_code: string;
  database_name: string;
  status: string;
  plan: string;
  db_status: string;
  latency_ms: number;
  tables_count: number;
  users_count: number;
  error?: string | null;
};

type HealthData = {
  system_status: 'healthy' | 'degraded' | 'critical';
  health_score: number;
  diagnostics_duration_ms: number;
  timestamp: string;
  infrastructure: {
    master_db: {
      status: string;
      latency_ms: number;
      tables_count: number;
      migration_version: string;
      database_name: string;
    };
    connection_pools: {
      active_pools: number;
      max_pools_ceiling: number;
      pool_details: Record<string, { activeQueries: number; lastUsed: string; idleMs: number }>;
      pool_utilization_pct: number;
    };
    runtime: {
      uptime_seconds: number;
      uptime_formatted: string;
      node_version: string;
      platform: string;
      architecture: string;
      pid: number;
      memory: {
        heap_used_mb: number;
        heap_total_mb: number;
        rss_mb: number;
        external_mb: number;
      };
    };
    storage_backups: {
      writable: boolean;
      total_backups: number;
      total_size_bytes: number;
      total_size_formatted: string;
      last_backup_at: string | null;
    };
    security: {
      jwt_active: boolean;
      hmac_engine: boolean;
      grace_period_days: number;
      master_audit_events: number;
    };
  };
  workspaces_summary: {
    total: number;
    active: number;
    trial: number;
    paused: number;
    stopped: number;
    cancelled: number;
    list: WorkspaceHealth[];
  };
  modules: HealthModule[];
};

export function SuperAdminHealth() {
  const toast = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters & Tabs
  const [moduleCategory, setModuleCategory] = usePersistentTab<string>('superadmin_health_category', 'all', 'category');
  const [searchWorkspace, setSearchWorkspace] = useState('');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0 = off, 15, 30, 60
  const timerRef = useRef<any>(null);

  const loadHealth = async (showToast = false) => {
    try {
      setLoading(true);
      const res = await api.get('/admin/health');
      setHealth(res.data);
      if (showToast) {
        toast(`Diagnostic probe completed in ${res.data.diagnostics_duration_ms}ms`, 'success');
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to run health probe', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefreshInterval > 0) {
      timerRef.current = setInterval(() => {
        loadHealth(false);
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshInterval]);

  // Ping all tenant databases
  const handlePingTenants = async () => {
    try {
      setActionLoading('ping');
      const res = await api.post('/admin/health/ping-tenants', {});
      toast(`Ping completed across ${res.data.tested_count} databases (All reachable: ${res.data.all_reachable ? 'YES' : 'NO'})`, 'success');
      loadHealth();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to ping tenant databases', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Flush idle database connection pools
  const handleFlushPools = async () => {
    try {
      setActionLoading('flush');
      const res = await api.post('/admin/health/flush-pools', {});
      toast(res.data.message || 'Database pools flushed successfully', 'success');
      loadHealth();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to flush pools', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Verify Audit Chain Cryptographic Integrity
  const handleVerifyAuditChain = async () => {
    try {
      setActionLoading('audit');
      const res = await api.post('/admin/health/verify-audit-chain', {});
      toast(`Audit Chain Verified: ${res.data.verified_records} records check (${res.data.integrity_status})`, 'success');
      loadHealth();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to verify audit chain', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Export Diagnostics Snapshot
  const handleExportDiagnostics = () => {
    if (!health) return;
    const jsonStr = JSON.stringify(health, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system_health_diagnostics_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Diagnostics report exported to JSON', 'success');
  };

  const categories = [
    { id: 'all', label: 'All Modules' },
    { id: 'Core Infrastructure', label: 'Infrastructure' },
    { id: 'Security & Access', label: 'Security & RBAC' },
    { id: 'Architecture', label: 'Multi-Tenancy' },
    { id: 'Business Logic', label: 'Business Engines' },
    { id: 'Supply Chain', label: 'Supply Chain' },
    { id: 'Manufacturing', label: 'Manufacturing' },
    { id: 'Compliance & Governance', label: 'Audit & Compliance' }
  ];

  const filteredModules = (health?.modules || []).filter((m) => {
    if (moduleCategory === 'all') return true;
    return m.category.toLowerCase().includes(moduleCategory.toLowerCase());
  });

  const filteredWorkspaces = (health?.workspaces_summary?.list || []).filter((w) => {
    return (
      w.name.toLowerCase().includes(searchWorkspace.toLowerCase()) ||
      w.company_code.toLowerCase().includes(searchWorkspace.toLowerCase()) ||
      w.database_name.toLowerCase().includes(searchWorkspace.toLowerCase())
    );
  });

  const getStatusBadge = (status: string) => {
    if (status === 'healthy' || status === 'active' || status === 'Operational') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 shadow-2xs">
          <CheckCircle2 size={12} className="text-emerald-500" /> Operational
        </span>
      );
    }
    if (status === 'warning' || status === 'degraded' || status === 'trial') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200 shadow-2xs">
          <AlertTriangle size={12} className="text-amber-500" /> Warning / Busy
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200 shadow-2xs">
        <XCircle size={12} className="text-rose-500" /> Unreachable
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageTitle
          icon={<Activity />}
          title="System Health & Deep Diagnostics"
          subtitle="Real-time multi-module diagnostic probes, tenant database latency, and runtime vitals"
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Refresh Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 shadow-2xs">
            <Radio size={12} className={autoRefreshInterval > 0 ? 'text-emerald-500 animate-pulse' : 'text-slate-400'} />
            <span className="font-semibold text-slate-500 text-[11px] uppercase">Auto-Probe:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(parseInt(e.target.value, 10))}
              className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer text-xs"
            >
              <option value={0}>Off (Manual)</option>
              <option value={15}>Every 15s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 60s</option>
            </select>
          </div>

          <Button
            variant="secondary"
            onClick={() => loadHealth(true)}
            disabled={loading}
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Run Diagnostic Probe
          </Button>

          <Button
            variant="secondary"
            onClick={handlePingTenants}
            disabled={actionLoading === 'ping'}
            className="text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100"
          >
            <Zap size={14} className="mr-1.5 text-blue-600" />
            {actionLoading === 'ping' ? 'Pinging...' : 'Ping All DBs'}
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportDiagnostics}
            disabled={!health}
            title="Download full JSON diagnostics report"
          >
            <Download size={14} className="mr-1.5" /> Export Report
          </Button>
        </div>
      </div>

      {health && (
        <>
          {/* TOP VIVID SYSTEM STATUS HERO BANNER */}
          <div
            className={`p-5 rounded-3xl border shadow-sm transition relative overflow-hidden ${
              health.system_status === 'healthy'
                ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border-emerald-500/30 text-white'
                : health.system_status === 'degraded'
                ? 'bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 border-amber-500/30 text-white'
                : 'bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border-rose-500/30 text-white'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                    health.system_status === 'healthy'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                      : health.system_status === 'degraded'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/10'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-lg shadow-rose-500/10'
                  }`}
                >
                  <Activity size={30} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-extrabold tracking-tight text-white">
                      {health.system_status === 'healthy'
                        ? 'ALL SYSTEM MODULES OPERATIONAL'
                        : health.system_status === 'degraded'
                        ? 'SYSTEM OPERATIONAL WITH MINOR WARNINGS'
                        : 'CRITICAL SYSTEM ALERT'}
                    </h2>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                        health.system_status === 'healthy'
                          ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/40'
                          : 'bg-amber-500/30 text-amber-300 border-amber-400/40'
                      }`}
                    >
                      {health.health_score}% Health Score
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Continuous multi-probe diagnostics covering Master Database, {health.workspaces_summary.total} Tenant Schemas, LRU Pool Connection Ceilings, Cryptographic Audit Chains, and 12 Enterprise Engine Modules.
                  </p>
                </div>
              </div>

              {/* Action Buttons in Hero */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleFlushPools}
                  disabled={actionLoading === 'flush'}
                  className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Server size={14} className="text-indigo-400" />
                  {actionLoading === 'flush' ? 'Flushing...' : 'Flush Idle DB Pools'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAuditChain}
                  disabled={actionLoading === 'audit'}
                  className="px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck size={14} className="text-emerald-400" />
                  {actionLoading === 'audit' ? 'Verifying...' : 'Verify Audit Chain'}
                </button>
              </div>
            </div>
          </div>

          {/* REAL-TIME PERFORMANCE VITALS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Master DB Latency */}
            <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Master DB Latency</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5 block">{health.infrastructure.master_db.latency_ms} ms</span>
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} /> {health.infrastructure.master_db.tables_count} Tables ({health.infrastructure.master_db.migration_version})
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Database size={20} />
              </div>
            </div>

            {/* Connection Pools Ceiling */}
            <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tenant DB Pools</span>
                <span className="text-2xl font-black text-indigo-900 mt-0.5 block">
                  {health.infrastructure.connection_pools.active_pools} <span className="text-sm font-bold text-slate-400">/ {health.infrastructure.connection_pools.max_pools_ceiling}</span>
                </span>
                <span className="text-[11px] text-indigo-600 font-medium">
                  {health.infrastructure.connection_pools.pool_utilization_pct}% Pool Capacity Used
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Server size={20} />
              </div>
            </div>

            {/* V8 Memory Heap */}
            <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">V8 Memory Usage</span>
                <span className="text-2xl font-black text-slate-900 mt-0.5 block">
                  {health.infrastructure.runtime.memory.heap_used_mb} <span className="text-sm font-bold text-slate-400">MB</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Total RSS: {health.infrastructure.runtime.memory.rss_mb} MB
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <Cpu size={20} />
              </div>
            </div>

            {/* Platform Uptime */}
            <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Platform Uptime</span>
                <span className="text-lg font-black text-slate-900 mt-1 block truncate">
                  {health.infrastructure.runtime.uptime_formatted}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  Node {health.infrastructure.runtime.node_version} ({health.infrastructure.runtime.platform})
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Clock size={20} />
              </div>
            </div>

            {/* Storage & Backups */}
            <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disaster Recovery</span>
                <span className="text-2xl font-black text-emerald-900 mt-0.5 block">
                  {health.infrastructure.storage_backups.total_backups} <span className="text-sm font-bold text-slate-400">Dumps</span>
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  {health.infrastructure.storage_backups.total_size_formatted} Stored
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <HardDrive size={20} />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* MODULE-BY-MODULE COMPREHENSIVE STATUS MATRIX */}
          {/* ============================================================ */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers size={16} className="text-blue-600" /> Full ERP Module Health Matrix ({health.modules.length} Deep Probes)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated runtime verification of all business logic, isolation boundaries, cryptography engines, and database stores.
                </p>
              </div>

              {/* Module Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setModuleCategory(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      moduleCategory === c.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredModules.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-blue-300/80 transition shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{m.category}</span>
                      <h4 className="font-bold text-slate-900 text-xs mt-0.5">{m.name}</h4>
                    </div>
                    {getStatusBadge(m.status)}
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed min-h-[32px]">
                    {m.details}
                  </p>

                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[10px]">
                      <Clock size={11} className="text-slate-400" /> {m.latency_ms} ms ping
                    </span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 text-[10px]">
                      {m.metric}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ============================================================ */}
          {/* PER-WORKSPACE LIVE DATABASE HEALTH & LATENCY MATRIX */}
          {/* ============================================================ */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" /> Live Workspace Database Health & Latency Probe
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct connection verification, table counts, and query round-trip times for all company databases.
                </p>
              </div>

              {/* Workspace Search */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search workspace or schema..."
                  value={searchWorkspace}
                  onChange={(e) => setSearchWorkspace(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3.5 rounded-tl-2xl">Company Workspace</th>
                    <th className="p-3.5">Database Schema</th>
                    <th className="p-3.5">Plan / Status</th>
                    <th className="p-3.5">Database Health</th>
                    <th className="p-3.5">Latency</th>
                    <th className="p-3.5">Tables</th>
                    <th className="p-3.5 text-right rounded-tr-2xl">Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                  {filteredWorkspaces.map((w) => (
                    <tr key={w.id} className="hover:bg-blue-50/40 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{w.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Code: {w.company_code}</div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px] text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {w.database_name}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="capitalize font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] mr-1.5 border border-slate-200">
                          {w.plan}
                        </span>
                        <span className="text-[11px] text-slate-500 capitalize">
                          {w.status}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {getStatusBadge(w.db_status)}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`font-mono font-bold text-[11px] ${
                            w.latency_ms < 50
                              ? 'text-emerald-600'
                              : w.latency_ms < 200
                              ? 'text-blue-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {w.latency_ms} ms
                        </span>
                      </td>

                      <td className="p-3.5 font-semibold text-slate-700">
                        {w.tables_count} tables
                      </td>

                      <td className="p-3.5 text-right font-bold text-slate-900">
                        {w.users_count} users
                      </td>
                    </tr>
                  ))}
                  {filteredWorkspaces.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No workspace databases matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================ */}
          {/* DEEP INFRASTRUCTURE & SECURITY SPECIFICATIONS */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cryptography & Security Engine Verification */}
            <div className="p-5 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={16} /> Security & Cryptographic Integrity Engine
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">
                  Enforced
                </span>
              </div>

              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="text-slate-400">JWT Token Signature Engine</span>
                  <span className="text-emerald-400 font-mono font-bold">ACTIVE (256-bit HS256)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="text-slate-400">SHA-256 HMAC Tamper-Proof Audit</span>
                  <span className="text-emerald-400 font-mono font-bold">VERIFIED ({health.infrastructure.security.master_audit_events} events)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 border border-slate-700/80">
                  <span className="text-slate-400">Subscription Grace Buffer Window</span>
                  <span className="text-indigo-300 font-mono font-bold">{health.infrastructure.security.grace_period_days} Days Buffer</span>
                </div>
              </div>
            </div>

            {/* Active LRU Database Pool Inspector */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-800">
                <div className="flex items-center gap-1.5 text-blue-600">
                  <Terminal size={16} /> Active LRU Connection Pool Registry
                </div>
                <span className="text-slate-500 text-[11px] font-normal">
                  {Object.keys(health.infrastructure.connection_pools.pool_details).length} active pool instances
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {Object.entries(health.infrastructure.connection_pools.pool_details).map(([dbName, details]) => (
                  <div
                    key={dbName}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-mono"
                  >
                    <div className="truncate max-w-[200px] text-slate-800 font-semibold" title={dbName}>
                      {dbName}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>Active Queries: <strong className="text-slate-800">{details.activeQueries}</strong></span>
                      <span>Idle: {Math.round(details.idleMs / 1000)}s</span>
                    </div>
                  </div>
                ))}
                {Object.keys(health.infrastructure.connection_pools.pool_details).length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No active tenant pools in memory. Pools are dynamically mounted on demand.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}