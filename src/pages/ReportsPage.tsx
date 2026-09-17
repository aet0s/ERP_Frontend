import { useEffect, useState } from 'react';
import { DatePicker } from '../components/ui/DatePicker';
import {
  Download,
  FileBarChart,
  AlertCircle,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Package,
  DollarSign,
  Search
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { dateIso, formatCurrency, formatNumber } from '../lib/utils';
import { PageTitle, EmptyState } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { ReportExportModal } from '../components/ReportExportModal';

const REPORT_MODULES = [
  { value: 'gst_summary', label: 'GST Filing Summary (GSTR-1 / GSTR-3B)' },
  { value: 'reorder', label: 'Low-Stock Reorder Suggestions & PO Engine' },
  { value: 'profit_loss', label: 'Profit & Loss Statement (P&L)' },
  { value: 'sales', label: 'Sales & Product Performance Report' },
  { value: 'procurement', label: 'Procurement Spending & Vendor Report' },
  { value: 'production', label: 'Production Efficiency & Yield Analysis' },
  { value: 'inventory', label: 'Inventory Valuation & Asset Cost' },
  { value: 'expenses', label: 'Operating Expense Category Breakdown' },
  { value: 'outstanding', label: 'Outstanding Balances (Payables/Receivables)' },
  { value: 'stock_movements', label: 'Stock Movements & Ledger Audit' }
];

interface ReorderItem {
  item_id: string;
  item_name: string;
  item_code?: string;
  item_type?: string;
  unit?: string;
  current_stock: number;
  reorder_level: number;
  suggested_reorder_qty: number;
  preferred_vendor_id?: string | null;
  preferred_vendor_name?: string;
  last_purchase_price?: number;
}

export function ReportsPage() {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const { canView, canExport } = usePermissions('reports');
  const { canCreate: canCreateProcurement } = usePermissions('procurement');
  const [report, setReport] = usePersistentTab<string>('reports_selected', 'gst_summary', 'report');
  const [range, setRange] = useState({
    start_date: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    end_date: dateIso()
  });
  const [activePreset, setActivePreset] = useState<string>('30d');
  const [data, setData] = useState<{ rows: any[]; summary?: any }>({ rows: [] });
  const [reorderList, setReorderList] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [creatingPoId, setCreatingPoId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const routes: Record<string, string> = {
    gst_summary: '/api/reports/gst-summary',
    reorder: '/api/reorder-suggestions',
    procurement: '/api/reports/procurement',
    sales: '/api/reports/sales',
    production: '/api/reports/production',
    inventory: '/api/reports/inventory',
    profit_loss: '/api/reports/profit-loss',
    outstanding: '/api/reports/outstanding-balances',
    expenses: '/api/reports/expenses',
    stock_movements: '/api/reports/stock-movements'
  };

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    if (preset === 'today') {
      setRange({ start_date: today, end_date: today });
    } else if (preset === '7d') {
      const start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      setRange({ start_date: start, end_date: today });
    } else if (preset === '30d') {
      const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
      setRange({ start_date: start, end_date: today });
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setRange({ start_date: start, end_date: today });
    } else if (preset === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().slice(0, 10);
      setRange({ start_date: start, end_date: today });
    } else if (preset === 'this_fy') {
      // Indian/Standard FY: Starts April 1st
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(startYear, 3, 1).toISOString().slice(0, 10);
      setRange({ start_date: start, end_date: today });
    }
  };

  useEffect(() => {
    let active = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        if (report === 'reorder') {
          const res = await api.get('/api/reorder-suggestions');
          if (active) setReorderList(res.data || []);
        } else {
          const endpoint = routes[report] || routes.gst_summary;
          const res = await api.get(endpoint, { params: range });
          if (!active) return;
          if (res.data) {
            setData({
              rows: Array.isArray(res.data.rows) ? res.data.rows : Array.isArray(res.data) ? res.data : [],
              summary: res.data.summary || {}
            });
          }
        }
      } catch (error: any) {
        if (!active) return;
        toast(error.response?.data?.error || 'Unable to load report data', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchReport();
    return () => { active = false; };
  }, [report, range.start_date, range.end_date]);

  const download = async (format: 'csv' | 'pdf') => {
    try {
      const endpoint = routes[report] || routes.gst_summary;
      const pdfEndpoint = format === 'pdf' ? `${endpoint}.pdf` : endpoint;
      const res = await api.get(pdfEndpoint, { params: { ...range, format }, responseType: 'blob' });
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report}_${range.start_date}_to_${range.end_date}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast('Failed to download report', 'error');
    }
  };

  const createPoFromReorder = async (item: ReorderItem, customQty?: number) => {
    if (!item.preferred_vendor_id) {
      return toast(`Item "${item.item_name}" has no linked vendor. Link a vendor in Catalog first.`, 'error');
    }
    const orderQty = customQty || item.suggested_reorder_qty || 1;
    try {
      setCreatingPoId(item.item_id);
      await api.post('/api/purchase-orders', {
        vendor_id: item.preferred_vendor_id,
        items: [{
          item_id: item.item_id,
          quantity: orderQty,
          rate_per_unit: item.last_purchase_price || 0,
          tax_rate: 18
        }]
      });
      toast(`✅ 1-Click Purchase Order created for ${item.item_name} with ${item.preferred_vendor_name}!`, 'success');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create purchase order', 'error');
    } finally {
      setCreatingPoId(null);
    }
  };

  // Filter rows by search keyword if present
  const filteredRows = (data.rows || []).filter((row) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return Object.values(row).some((val) => String(val).toLowerCase().includes(term));
  });

  const filteredReorderList = reorderList.filter((item) => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(term) ||
      (item.item_code && item.item_code.toLowerCase().includes(term)) ||
      (item.preferred_vendor_name && item.preferred_vendor_name.toLowerCase().includes(term))
    );
  });

  const columns = data.rows && data.rows.length > 0
    ? Object.keys(data.rows[0])
    : ['date', 'name', 'quantity', 'total_amount'];

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Reports module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<FileBarChart />}
        title="Reports, Compliance & Intelligence"
        subtitle="Financial statements, GST Filing (GSTR-1/3B), Live Valuation, and Smart Low-Stock Reorder automation."
        action={
          canExport ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={<Download size={15} />}
                onClick={() => setShowExportModal(true)}
              >
                Export CSV
              </Button>
              <Button icon={<Download size={15} />} onClick={() => download('pdf')}>Download PDF</Button>
            </div>
          ) : undefined
        }
      />

      {/* Control Bar: Report Selection + Range Presets */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Report Module:</span>
            <div className="flex-1">
              <Select
                value={report}
                onChange={setReport}
                options={[
                  { value: 'gst_summary', label: 'GST Filing Summary (GSTR-1 / GSTR-3B)' },
                  { value: 'reorder', label: 'Low-Stock Reorder Suggestions & PO Engine' },
                  { value: 'profit_loss', label: 'Profit & Loss Statement (P&L)' },
                  { value: 'sales', label: 'Sales & Product Performance Report' },
                  { value: 'procurement', label: 'Procurement Spending & Vendor Report' },
                  { value: 'production', label: 'Production Efficiency & Yield Analysis' },
                  { value: 'inventory', label: 'Inventory Valuation & Asset Cost' },
                  { value: 'expenses', label: 'Operating Expense Category Breakdown' },
                  { value: 'outstanding', label: 'Outstanding Balances (Payables/Receivables)' },
                  { value: 'stock_movements', label: 'Stock Movements & Ledger Audit' }
                ]}
              />
            </div>
          </div>

          {report !== 'reorder' && report !== 'inventory' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Period:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
                {[
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: 'this_month', label: 'Month' },
                  { id: 'this_quarter', label: 'Quarter' },
                  { id: 'this_fy', label: 'FY' }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      activePreset === preset.id ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 ml-2">
                <div className="w-32">
                  <DatePicker value={range.start_date} onChange={(val) => { setActivePreset('custom'); setRange({ ...range, start_date: val }); }} />
                </div>
                <span className="text-slate-400 text-xs font-medium">to</span>
                <div className="w-32">
                  <DatePicker value={range.end_date} onChange={(val) => { setActivePreset('custom'); setRange({ ...range, end_date: val }); }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* 1. GST SUMMARY REPORT */}
      {/* ============================================================ */}
      {report === 'gst_summary' && data.summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Output Tax (Sales)</span>
                <Receipt className="text-blue-600" size={18} />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {formatCurrency(data.summary.outward_tax_liability ?? data.summary.total_output_tax, workspace?.currency)}
              </div>
              <div className="text-[11px] text-slate-500">
                Tax liability collected on {data.summary.b2b_sales_count || 0} B2B + {data.summary.b2c_sales_count || 0} B2C sales
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Input Tax Credit (ITC)</span>
                <TrendingUp className="text-emerald-600" size={18} />
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(data.summary.input_tax_credit_itc ?? data.summary.total_input_tax_credit, workspace?.currency)}
              </div>
              <div className="text-[11px] text-slate-500">Estimated GST credit on {formatCurrency(data.summary.total_inward_purchases, workspace?.currency)} purchases</div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md space-y-1.5 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Net GST Cash Payable</span>
                <DollarSign className="text-amber-400" size={18} />
              </div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(data.summary.net_gst_payable, workspace?.currency)}
              </div>
              <div className="text-[11px] text-slate-400">GSTR-3B Estimated Net Cash Payout</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. PROFIT & LOSS STATEMENT */}
      {/* ============================================================ */}
      {report === 'profit_loss' && data.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Revenue</span>
            <div className="text-lg font-bold text-slate-900">{formatCurrency(data.summary.revenue, workspace?.currency)}</div>
          </div>
          <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cost of Goods (COGS)</span>
            <div className="text-lg font-bold text-slate-700">{formatCurrency(data.summary.cogs, workspace?.currency)}</div>
          </div>
          <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Profit</span>
            <div className="text-lg font-bold text-blue-700">{formatCurrency(data.summary.gross_profit, workspace?.currency)}</div>
          </div>
          <div className="bg-white p-4 border border-slate-200/90 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Operating Expenses</span>
            <div className="text-lg font-bold text-amber-700">{formatCurrency(data.summary.operating_expenses, workspace?.currency)}</div>
          </div>
          <div className={`p-4 rounded-2xl shadow-xs border ${
            (data.summary.net_profit || 0) >= 0 ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-rose-50/80 border-rose-200 text-rose-900'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Net Profit</span>
            <div className="text-lg font-black">{formatCurrency(data.summary.net_profit, workspace?.currency)}</div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. LOW-STOCK REORDER SUGGESTIONS */}
      {/* ============================================================ */}
      {report === 'reorder' ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={18} /> Low Stock Reorder Recommendations & 1-Click PO Engine
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Items currently at or below minimum threshold linked directly to their primary preferred suppliers.
              </p>
            </div>
            <div className="px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-xl text-xs font-semibold text-amber-800">
              {reorderList.length} items needing replenishment
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {reorderList.map((item) => (
              <div key={item.item_id} className="py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 p-3 rounded-xl transition">
                <div className="space-y-1 min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{item.item_name}</span>
                    {item.item_code && <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{item.item_code}</span>}
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200">
                      {item.current_stock <= 0 ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-4">
                    <span>Current Stock: <strong className="text-rose-600 font-mono font-bold">{item.current_stock} {item.unit || ''}</strong></span>
                    <span>Reorder Threshold: <strong className="font-mono text-slate-800">{item.reorder_level} {item.unit || ''}</strong></span>
                    <span>Suggested Qty: <strong className="font-mono text-blue-700 font-bold">{item.suggested_reorder_qty} {item.unit || ''}</strong></span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Preferred Supplier: <strong className="text-slate-800">{item.preferred_vendor_name || 'No linked supplier'}</strong>
                    {item.last_purchase_price ? ` • Last Rate: ${formatCurrency(item.last_purchase_price, workspace?.currency)}/${item.unit || 'unit'}` : ''}
                  </div>
                </div>

                {canCreateProcurement && (
                  <div className="flex items-center gap-2">
                    <Button
                      icon={<ShoppingCart size={15} />}
                      disabled={creatingPoId === item.item_id}
                      onClick={() => createPoFromReorder(item)}
                    >
                      1-Click Create PO ({item.suggested_reorder_qty} {item.unit || 'units'})
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {reorderList.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <div className="inline-flex p-3 bg-emerald-50 rounded-full text-emerald-600 mb-2">
                  <Package size={24} />
                </div>
                <div className="font-semibold text-slate-800">All items are sufficiently stocked!</div>
                <div className="text-xs text-slate-400 mt-1">No items have fallen below their configured reorder safety threshold.</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* STANDARD TABULAR REPORT DISPLAY */
        /* ============================================================ */
        <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search within report..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredRows.length} of {(data.rows || []).length} records
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse min-w-[700px] text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  {columns.map((column) => (
                    <th key={column} className="p-3 whitespace-nowrap">
                      {column.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={columns.length || 1} className="p-3">
                        <div className="h-6 bg-slate-100 rounded-lg animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filteredRows.length > 0 ? (
                  filteredRows.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                      {columns.map((column) => {
                        const val = row[column];
                        const isNumber = typeof val === 'number';
                        const isCurrency = String(column).includes('amount') || String(column).includes('cost') || String(column).includes('value') || String(column).includes('revenue') || String(column).includes('spend') || String(column).includes('tax');
                        return (
                          <td key={column} className="p-3 whitespace-nowrap">
                            {isNumber && isCurrency
                              ? formatCurrency(val, workspace?.currency)
                              : isNumber
                              ? formatNumber(val)
                              : String(val ?? '—')}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length || 1} className="p-8 text-center text-slate-500">
                      <EmptyState title="No records found for the selected reporting parameters." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Export Columns Selection Modal */}
      {showExportModal && (
        <ReportExportModal
          reportName={REPORT_MODULES.find((m) => m.value === report)?.label || 'Report'}
          reportKey={report}
          rows={report === 'reorder' ? reorderList : (data.rows || [])}
          filteredRows={report === 'reorder' ? filteredReorderList : filteredRows}
          searchKeyword={tableSearch}
          dateRange={range}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
