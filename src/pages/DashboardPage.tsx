import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DatePicker } from '../components/ui/DatePicker';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileDown,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { dateIso, formatCurrency, formatNumber } from '../lib/utils';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';

/**
 * Compact Leaderboard with strict top-5 limitation and visual proportion bars
 */
function Leaderboard({
  title,
  rows,
  valueKey,
  subtitleKey,
  emptyText = 'No data logged for this timeframe.'
}: {
  title: string;
  rows: any[];
  valueKey: string;
  subtitleKey?: string;
  emptyText?: string;
}) {
  const { workspace } = useWorkspace();
  // Strictly enforce max 5 items to keep cards compact and bounded
  const safeRows = (Array.isArray(rows) ? rows : []).slice(0, 5);
  const maxValue = safeRows.reduce((max, r) => Math.max(max, Number(r[valueKey] || 0)), 0);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Top {safeRows.length}
          </span>
        </div>
        {safeRows.length ? (
          <div className="space-y-3">
            {safeRows.map((row, index) => {
              const val = Number(row[valueKey] || 0);
              const pct = maxValue > 0 ? Math.min(100, Math.round((val / maxValue) * 100)) : 0;
              const rankColor =
                index === 0
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : index === 1
                  ? 'bg-slate-200 text-slate-700 border-slate-300'
                  : index === 2
                  ? 'bg-orange-100 text-orange-800 border-orange-300'
                  : 'bg-slate-100 text-slate-500 border-slate-200';

              return (
                <div key={row.id || index} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold border shrink-0 ${rankColor}`}
                      >
                        {index + 1}
                      </span>
                      <strong className="font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {row.name}
                      </strong>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <em className="not-italic font-bold text-slate-900 block">
                        {formatCurrency(val, workspace?.currency)}
                      </em>
                      {subtitleKey && row[subtitleKey] !== undefined && (
                        <span className="text-[10px] text-slate-400">
                          Due: {formatCurrency(row[subtitleKey], workspace?.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Visual proportion bar for fast intuitive comparison */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-6 text-center">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const { canView, canExport } = usePermissions('dashboard');

  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preset, setPreset] = useState('30D');
  const [group, setGroup] = useState<'day' | 'week' | 'month'>('day');
  const [compare, setCompare] = useState(true);
  const [locationId, setLocationId] = useState(() => searchParams.get('location_id') || 'all');
  const [locations, setLocations] = useState<Array<{ id: string; name: string; is_default?: number }>>([]);
  const [focusTab, setFocusTab] = useState<'all' | 'financial' | 'operations' | 'inventory' | 'risks'>('all');

  // Modal for viewing all alerts without lengthening the dashboard page
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'low_stock' | 'overdue_receivable' | 'overdue_payable'>('all');
  const [modalLocationFilter, setModalLocationFilter] = useState<string>('all');
  const [alertSearch, setAlertSearch] = useState('');

  const [range, setRange] = useState(() => {
    const end = dateIso();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return { start_date: start.toISOString().slice(0, 10), end_date: end };
  });

  // Load locations for the location filter dropdown
  useEffect(() => {
    api
      .get('/api/locations')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setLocations(res.data);
        }
      })
      .catch(() => {
        // Fallback if user lacks locations permission
        setLocations([]);
      });
  }, []);

  const applyPreset = (next: string) => {
    setPreset(next);
    const end = new Date();
    const start = new Date();
    if (next === 'Today') start.setDate(end.getDate());
    if (next === '7D') start.setDate(end.getDate() - 6);
    if (next === '30D') start.setDate(end.getDate() - 29);
    if (next === 'This Month') start.setDate(1);
    if (next === 'This Quarter') start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1);
    if (next === 'This Year') start.setMonth(0, 1);
    setRange({ start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) });
  };

  const fetchOverview = () => {
    setLoading(true);
    api
      .get('/api/dashboard/overview', {
        params: {
          ...range,
          group,
          compare,
          location_id: locationId
        }
      })
      .then((res) => {
        if (res.data) {
          setOverview(res.data);
          if (Array.isArray(res.data.locations) && res.data.locations.length > 0) {
            setLocations(res.data.locations);
          }
        }
      })
      .catch((error) => {
        toast(error.response?.data?.error || 'Unable to load dashboard', 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOverview();
  }, [range.start_date, range.end_date, group, compare, locationId]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const res = await api.get('/api/dashboard/snapshot.pdf', {
        params: {
          ...range,
          group,
          location_id: locationId
        },
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `executive_dashboard_${range.start_date}_to_${range.end_date}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Executive Dashboard PDF downloaded successfully', 'success');
    } catch (e) {
      toast('Failed to download executive PDF snapshot', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Structured Profit & Cost Distribution Data for Visual Donut Chart
  const profitDistributionData = useMemo(() => {
    if (!overview?.summary?.current) return [];
    const curr = overview.summary.current;
    const cogs = Number(curr.cogs || 0);
    const opex = Number(curr.operating_expenses || 0);
    const profit = Number(curr.profit || 0);

    return [
      { name: 'Direct COGS', value: cogs > 0 ? cogs : 0, color: '#f97316' },
      { name: 'Operating Expenses', value: opex > 0 ? opex : 0, color: '#8b5cf6' },
      { name: 'Net Profit', value: profit > 0 ? profit : 0, color: '#16a34a' }
    ].filter((item) => item.value > 0);
  }, [overview]);

  const locationOptions = useMemo(() => [
    { value: 'all', label: 'All Locations (HQ & Warehouses)' },
    ...locations.map((loc: any) => ({
      value: loc.id,
      label: `${loc.name}${loc.is_default ? ' (Main / HQ)' : ''}`
    }))
  ], [locations]);

  const handleLocationChange = (val: string) => {
    setLocationId(val);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val === 'all') next.delete('location_id');
      else next.set('location_id', val);
      return next;
    });
  };

  // Distinct locations present across active alerts (declared before early returns)
  const alertLocations = useMemo(() => {
    const list = Array.isArray(overview?.alerts) ? overview.alerts : [];
    const map = new Map<string, string>();
    for (const al of list) {
      if (al.location_id && al.location_name) {
        map.set(al.location_id, al.location_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [overview?.alerts]);

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">
          You do not have permission to view the Executive Dashboard. Contact your workspace administrator to request access.
        </p>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <PageTitle
          icon={<LayoutDashboard />}
          title="Executive Dashboard"
          subtitle="Real-time multi-dimensional intelligence across revenue, margins, production, and liquidity."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" key={index} />
          ))}
        </div>
      </div>
    );
  }

  const kpis = Array.isArray(overview?.kpis) ? overview.kpis : [];
  const charts = overview?.charts || {};
  const leaderboards = overview?.leaderboards || {};
  const aging = overview?.aging || { receivables: [], payables: [] };
  const allAlerts = Array.isArray(overview?.alerts) ? overview.alerts : [];

  // Strictly show top 5 alerts on the page
  const topAlerts = allAlerts.slice(0, 5);

  // Filtered alerts for the View All Modal
  const modalAlerts = allAlerts.filter((al: any) => {
    if (alertFilter !== 'all' && al.type !== alertFilter) return false;
    if (modalLocationFilter !== 'all' && al.location_id !== modalLocationFilter) return false;
    if (alertSearch.trim()) {
      const q = alertSearch.toLowerCase();
      return (
        String(al.title || '').toLowerCase().includes(q) ||
        String(al.name || '').toLowerCase().includes(q) ||
        String(al.location_name || '').toLowerCase().includes(q) ||
        String(al.entity_id || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const inventoryColors = ['#2563eb', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Header with Title and Executive Export */}
      <PageTitle
        icon={<LayoutDashboard />}
        title="Executive Dashboard"
        subtitle="Real-time multi-dimensional intelligence across revenue, margins, production, and liquidity."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />}
              onClick={fetchOverview}
              disabled={loading}
            >
              Refresh
            </Button>
            {canExport && (
              <Button
                icon={<FileDown size={16} />}
                onClick={exportPdf}
                disabled={exporting}
              >
                {exporting ? 'Generating PDF...' : 'Export Full PDF'}
              </Button>
            )}
          </div>
        }
      />

      {/* Comprehensive Filter Control Bar */}
      <section className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Selector */}
          <div className="w-36">
            <Select
              value={preset}
              onChange={(val) => applyPreset(val)}
              options={['Today', '7D', '30D', 'This Month', 'This Quarter', 'This Year', 'Custom'].map((item) => ({
                value: item,
                label: item
              }))}
            />
          </div>

          {/* Date Pickers */}
          <div className="w-36">
            <DatePicker
              value={range.start_date}
              onChange={(val) => {
                setPreset('Custom');
                setRange({ ...range, start_date: val });
              }}
            />
          </div>
          <span className="text-slate-400 text-xs font-semibold">to</span>
          <div className="w-36">
            <DatePicker
              value={range.end_date}
              onChange={(val) => {
                setPreset('Custom');
                setRange({ ...range, end_date: val });
              }}
            />
          </div>

          {/* Location / Warehouse Filter */}
          <div className="w-56">
            <Select
              value={locationId}
              onChange={handleLocationChange}
              options={locationOptions}
            />
          </div>

          {/* Interval Grouping */}
          <div className="w-28">
            <Select
              value={group}
              onChange={(val) => setGroup(val as any)}
              options={[
                { value: 'day', label: 'Daily' },
                { value: 'week', label: 'Weekly' },
                { value: 'month', label: 'Monthly' }
              ]}
            />
          </div>

          {/* Comparison Checkbox */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={compare}
              onChange={(event) => setCompare(event.target.checked)}
            />
            vs Previous Period
          </label>

          {/* Location Badge */}
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-700">
            <Building2 size={13} className="text-slate-500" />
            <span className="truncate max-w-[160px]">{overview?.location_name || workspace?.name}</span>
          </div>
        </div>

        {/* Focus Navigation Pills */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto text-xs">
          <span className="text-slate-400 font-semibold text-[11px] mr-1 flex items-center gap-1">
            <SlidersHorizontal size={13} /> View:
          </span>
          {[
            { id: 'all', label: 'All Overview' },
            { id: 'financial', label: 'Financials & Cash' },
            { id: 'operations', label: 'Operations & Yield' },
            { id: 'inventory', label: 'Inventory & Stock' },
            { id: 'risks', label: 'Risks & Aging' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFocusTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                focusTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Metric KPI Cards (All 6 Standard Executive Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi: any) => (
          <div
            className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:shadow-sm transition-shadow"
            key={kpi.key}
          >
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                <span>{kpi.label}</span>
                {Number(kpi.change_percent) >= 0 ? (
                  <ArrowUpRight size={16} className="text-emerald-600" />
                ) : (
                  <ArrowDownRight size={16} className="text-rose-600" />
                )}
              </div>
              <strong className="block text-2xl font-extrabold text-slate-900 tracking-tight my-1">
                {kpi.suffix === '%' ? `${formatNumber(kpi.value)}%` : formatCurrency(kpi.value, workspace?.currency)}
              </strong>
              <p
                className={`text-[11px] font-semibold ${
                  Number(kpi.change_percent) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {compare
                  ? `${Number(kpi.change_percent) >= 0 ? '+' : ''}${formatNumber(kpi.change_percent)}% vs prev`
                  : kpi.detail || 'Current period'}
              </p>
            </div>
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={32}>
                <AreaChart data={charts.revenue_cost_profit || []}>
                  <Area
                    dataKey={kpi.key === 'net_profit' ? 'profit' : 'revenue'}
                    stroke="#2563eb"
                    fill="#dbeafe"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 1: Financial & Cash Flow Analytics */}
      {(focusTab === 'all' || focusTab === 'financial') && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Revenue vs Cost vs Profit Composed Chart */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Revenue vs Cost vs Net Profit
                </h2>
                <p className="text-xs text-slate-500">Gross revenue against combined COGS and operating expenditures</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={charts.revenue_cost_profit || []}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar name="Revenue" dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="Total Cost" dataKey="total_cost" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Line name="Net Profit" dataKey="profit" stroke="#16a34a" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* New Graphical Profit & Cost Distribution Donut Chart */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
                Revenue Cost Structure
              </h2>
              <p className="text-xs text-slate-500 mb-2">Visual breakdown of where incoming revenue flows</p>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={profitDistributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {profitDistributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-3 border-t border-slate-100 text-center text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold">COGS</span>
                <strong className="text-orange-600 font-bold text-xs">
                  {formatCurrency(overview?.summary?.current?.cogs, workspace?.currency)}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold">OPEX</span>
                <strong className="text-purple-600 font-bold text-xs">
                  {formatCurrency(overview?.summary?.current?.operating_expenses, workspace?.currency)}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold">PROFIT</span>
                <strong className="text-emerald-600 font-bold text-xs">
                  {formatCurrency(overview?.summary?.current?.profit, workspace?.currency)}
                </strong>
              </div>
            </div>
          </div>

          {/* Cash Flow Chart */}
          <div className="lg:col-span-3 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cash Flow & Liquidity Dynamics
                </h2>
                <p className="text-xs text-slate-500">Actual collections (Cash In) vs vendor & expense payouts (Cash Out)</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={charts.cash_flow || []}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar name="Cash In (Collections)" dataKey="money_in" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar name="Cash Out (Disbursements)" dataKey="money_out" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* SECTION 2: Operations & Production Yield Analytics */}
      {(focusTab === 'all' || focusTab === 'operations') && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Production Efficiency Chart */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Production Yield vs Standard Target
                </h2>
                <p className="text-xs text-slate-500">Batch output yield % tracked against standard 92% benchmark</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 block">AVERAGE YIELD</span>
                <strong className="text-sm font-extrabold text-blue-600">
                  {formatNumber(overview?.summary?.current?.average_yield_percent)}%
                </strong>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={charts.production_efficiency || []}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value: any) => `${formatNumber(value)}%`} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line name="Actual Yield %" dataKey="yield_percent" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                <Line
                  name="Target Benchmark (92%)"
                  dataKey="target_yield_percent"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line name="Wastage %" dataKey="wastage_percent" stroke="#dc2626" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Unit Cost Trend */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Finished Goods Unit Cost Trend
                </h2>
                <p className="text-xs text-slate-500">Historical cost per unit across logged production batches</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={charts.cost_per_unit_trend || []}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  name="Unit Cost"
                  dataKey="cost_per_unit"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#7c3aed' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* SECTION 3: Inventory Composition & Top Product Graphical Data */}
      {(focusTab === 'all' || focusTab === 'inventory') && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inventory Valuation Composition Donut Chart */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">
              Inventory Valuation Mix
            </h2>
            <p className="text-xs text-slate-500 mb-2">Capital locked in Raw Materials vs WIP vs Finished Goods</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={charts.inventory_composition || []}
                  dataKey="value"
                  nameKey="type"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={2}
                >
                  {(charts.inventory_composition || []).map((_: any, index: number) => (
                    <Cell key={index} fill={inventoryColors[index % inventoryColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center text-xs">
              {(charts.inventory_composition || []).map((item: any) => (
                <div key={item.type}>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                    {item.type === 'raw_material' ? 'Raw Mat' : item.type === 'wip' ? 'WIP' : 'Finished'}
                  </span>
                  <strong className="text-slate-800 text-xs block font-bold">
                    {formatCurrency(item.value, workspace?.currency)}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 Products Graphical Revenue Contribution */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Top 5 Products by Revenue
                  </h2>
                  <p className="text-xs text-slate-500">Visual comparison of primary revenue generating items</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Top 5 Items
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={leaderboards.top_products_by_revenue || []}
                  layout="vertical"
                  margin={{ left: 20, right: 30 }}
                >
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                  <YAxis dataKey="name" type="category" width={110} stroke="#64748b" fontSize={11} />
                  <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* SECTION 4: Leaderboards & Compact Data Boxes (STRICTLY TOP 5 ROWS) */}
      {(focusTab === 'all' || focusTab === 'financial' || focusTab === 'inventory') && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Leaderboard
            title="Top Products by Margin"
            rows={leaderboards.top_products_by_margin || []}
            valueKey="margin"
          />
          <Leaderboard
            title="Top Products by Volume"
            rows={leaderboards.top_products_by_revenue || []}
            valueKey="quantity"
          />
          <Leaderboard
            title="Top Customers by LTV"
            rows={leaderboards.top_customers || []}
            valueKey="lifetime_value"
            subtitleKey="outstanding_balance"
          />
          <Leaderboard
            title="Top Vendors by Spend"
            rows={leaderboards.top_vendors || []}
            valueKey="lifetime_value"
            subtitleKey="outstanding_balance"
          />
        </section>
      )}

      {/* SECTION 5: Aging Breakdown & System Risks (STRICTLY TOP 5 ALERTS) */}
      {(focusTab === 'all' || focusTab === 'risks' || focusTab === 'financial') && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Aging Analysis Box */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Working Capital & Aging Analysis
                </h2>
                <p className="text-xs text-slate-500">Overdue receivables vs vendor payables across aging brackets</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={(aging.receivables || []).map((row: any, index: number) => ({
                  bucket: `${row.bucket}d`,
                  receivables: row.amount,
                  payables: aging.payables?.[index]?.amount || 0
                }))}
              >
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip formatter={(value: any) => formatCurrency(value, workspace?.currency)} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Bar name="Receivables (Inbound)" dataKey="receivables" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar name="Payables (Outbound)" dataKey="payables" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Aging Bracket Breakdown Grid - fills space with valuable financial data */}
            <div className="grid grid-cols-4 gap-2 pt-3 mt-2 border-t border-slate-100 text-center">
              {(aging.receivables || []).map((row: any, index: number) => {
                const pay = aging.payables?.[index]?.amount || 0;
                return (
                  <div key={row.bucket} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {row.bucket}d
                    </span>
                    <span className="block text-[11px] font-semibold text-blue-600 truncate" title="Receivables">
                      +{formatCurrency(row.amount, workspace?.currency)}
                    </span>
                    <span className="block text-[11px] font-semibold text-orange-600 truncate mt-0.5" title="Payables">
                      -{formatCurrency(pay, workspace?.currency)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                Total Receivables: <strong className="text-slate-900 font-bold">{formatCurrency(overview?.summary?.current?.receivables, workspace?.currency)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                Total Payables: <strong className="text-slate-900 font-bold">{formatCurrency(overview?.summary?.current?.payables, workspace?.currency)}</strong>
              </span>
            </div>
          </div>

          {/* Alerts & System Risks Box - Sleek, Compact & Uniform */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Alerts & System Risks
                </h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                Top {Math.min(4, topAlerts.length)} of {allAlerts.length} Active
              </span>
            </div>

            {topAlerts.length ? (
              <div className="space-y-2">
                {topAlerts.slice(0, 4).map((alert: any, index: number) => {
                  const isHigh = alert.severity === 'high' || alert.status === 'Out';
                  return (
                    <div
                      className={`p-2.5 rounded-xl border text-xs transition-all ${
                        isHigh
                          ? 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                          : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                      }`}
                      key={alert.entity_id ? `${alert.entity_id}-${alert.location_id || index}` : index}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <AlertTriangle
                            size={15}
                            className={`shrink-0 mt-0.5 ${isHigh ? 'text-rose-600' : 'text-amber-600'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              {alert.location_name && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/90 border border-slate-200 text-slate-700 uppercase tracking-wider shrink-0 shadow-2xs">
                                  {alert.location_name}
                                </span>
                              )}
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                                  alert.status === 'Out' ? 'bg-rose-200/80 text-rose-800' : alert.status === 'Low' ? 'bg-amber-200/80 text-amber-800' : isHigh ? 'bg-rose-200/80 text-rose-800' : 'bg-amber-200/80 text-amber-800'
                                }`}
                              >
                                {alert.status === 'Out' ? 'Out of Stock' : alert.status === 'Low' ? 'Low Stock' : isHigh ? 'Critical' : 'Warning'}
                              </span>
                            </div>
                            <strong className="font-semibold block truncate text-slate-900">{alert.title}</strong>
                            {alert.amount && (
                              <span className="text-[10px] opacity-75 font-medium block">
                                Amount Due: {formatCurrency(alert.amount, workspace?.currency)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Cross-Location Transfer Recommendation - Compact Inline Bar */}
                      {alert.transfer_opportunity && (
                        <div className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-50/90 border border-emerald-200/90 flex items-center justify-between gap-2 text-[10px] text-emerald-950">
                          <span className="truncate">
                            💡 <strong>{alert.transfer_opportunity.available_stock} {alert.unit}</strong> at {alert.transfer_opportunity.from_location_name}
                          </span>
                          <Link
                            to={`/inventory/stock-transfers?from=${encodeURIComponent(alert.transfer_opportunity.from_location_id)}&to=${encodeURIComponent(alert.location_id || '')}&item=${encodeURIComponent(alert.entity_id || '')}`}
                            className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition shrink-0"
                          >
                            Transfer →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-slate-400 italic">
                <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                No urgent operational risks or stock anomalies detected.
              </div>
            )}

            {/* View All Button opens Modal so the page is NEVER lengthened */}
            {allAlerts.length > 4 && (
              <div className="pt-2.5 mt-2.5 border-t border-slate-100">
                <Button
                  variant="secondary"
                  className="w-full text-xs font-semibold justify-center text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowAlertsModal(true)}
                >
                  View All ({allAlerts.length}) Alerts & Risk Audit
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* View All Alerts Modal Dialog */}
      {showAlertsModal && (
        <Modal
          title={`Active Operational Alerts & Risks (${allAlerts.length})`}
          onClose={() => setShowAlertsModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            {/* Search & Filter inside Modal */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search alert title, party, or location..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={alertSearch}
                  onChange={(e) => setAlertSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 text-xs">
                {[
                  { id: 'all', label: `All (${allAlerts.length})` },
                  { id: 'low_stock', label: 'Low Stock' },
                  { id: 'overdue_receivable', label: 'Overdue Receivables' },
                  { id: 'overdue_payable', label: 'Overdue Payables' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAlertFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-colors ${
                      alertFilter === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location filter chips if multiple locations exist */}
            {alertLocations.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs flex-wrap pb-2 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Location:</span>
                <button
                  onClick={() => setModalLocationFilter('all')}
                  className={`px-2 py-0.5 rounded-lg font-semibold text-[10px] transition-colors ${
                    modalLocationFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Locations
                </button>
                {alertLocations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setModalLocationFilter(loc.id)}
                    className={`px-2 py-0.5 rounded-lg font-semibold text-[10px] transition-colors ${
                      modalLocationFilter === loc.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable list of alerts */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {modalAlerts.length ? (
                modalAlerts.map((al: any, idx: number) => {
                  const isHigh = al.severity === 'high' || al.status === 'Out';
                  return (
                    <div
                      key={idx}
                      className="pt-2.5 pb-2.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AlertTriangle
                            size={16}
                            className={`shrink-0 ${isHigh ? 'text-rose-600' : 'text-amber-600'}`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              {al.location_name && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                                  {al.location_name}
                                </span>
                              )}
                              <strong className="font-semibold text-slate-900 block truncate">
                                {al.title}
                              </strong>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Type: {al.type?.replace('_', ' ')} · Severity: {al.severity}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {al.amount && (
                            <strong className="text-slate-900 font-bold block">
                              {formatCurrency(al.amount, workspace?.currency)}
                            </strong>
                          )}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              isHigh ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {al.severity}
                          </span>
                        </div>
                      </div>

                      {al.transfer_opportunity && (
                        <div className="ml-6 p-2 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
                          <span className="truncate">
                            💡 <strong>{al.transfer_opportunity.available_stock} {al.unit}</strong> available at {al.transfer_opportunity.from_location_name}
                          </span>
                          <Link
                            to={`/inventory/stock-transfers?from=${encodeURIComponent(al.transfer_opportunity.from_location_id)}&to=${encodeURIComponent(al.location_id || '')}&item=${encodeURIComponent(al.entity_id || '')}`}
                            onClick={() => setShowAlertsModal(false)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold transition shrink-0"
                          >
                            Transfer Stock →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center py-8 text-xs text-slate-400 italic">
                  No alerts match your filter criteria.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
