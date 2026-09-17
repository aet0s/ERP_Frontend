import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../context';
import { usePortal } from '../../components/AppShell';
import {
  CircleDollarSign, Search, Download, RefreshCw, AlertCircle,
  FileText, Calendar, CheckCircle2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Pagination } from '../../components/ui/Pagination';
import { formatDate, formatCurrency, formatNumber } from '../../lib/utils';

export function PortalPaymentsPage() {
  const toast = useToast();
  const { activeWorkspace, loading: portalLoading } = usePortal();

  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [totalInvoiced, setTotalInvoiced] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected payment detail
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);

  const fetchPayments = async () => {
    if (!activeWorkspace) {
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params: any = {
        company_id: activeWorkspace.company_id,
        page: currentPage,
        limit: pageSize
      };
      if (search.trim()) params.search = search.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await api.get('/portal/payments', { params });

      if (res.data?.ok) {
        setPayments(res.data.payments || []);
        setTotalItems(res.data.meta?.total || (res.data.payments || []).length);
        setTotalAmount(res.data.total_amount || 0);
        setTotalDue(res.data.total_due ?? 0);
        setTotalInvoiced(res.data.total_invoiced ?? 0);
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to fetch payment ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [activeWorkspace?.company_id, currentPage, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchPayments();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Real CSV Export
  const exportPaymentsCSV = () => {
    if (payments.length === 0) {
      toast('No payments to export', 'info');
      return;
    }

    const headers = ['Payment ID', 'Date', 'Linked Order #', 'Installment Amount', 'Order Total', 'Remaining Balance Due', 'Payment Notes', 'Logged At'];
    const rows = payments.map((p) => [
      p.id,
      p.date ? new Date(p.date).toISOString().slice(0, 10) : '',
      p.order_number || '—',
      p.amount || 0,
      p.order_total || 0,
      p.order_due || 0,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      p.created_at ? new Date(p.created_at).toISOString().slice(0, 19).replace('T', ' ') : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payments_ledger_${activeWorkspace?.company_code || 'portal'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('Exported payments ledger CSV successfully', 'success');
  };

  if (!activeWorkspace) {
    if (portalLoading) {
      return (
        <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-400">
          Loading workspace details...
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Workspace Connected</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          Connect to a workspace using their Company Connect Code to inspect financial logs and installment history.
        </p>
      </div>
    );
  }

  const isVendor = activeWorkspace.portal_type === 'vendor';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 font-bold">
            <CircleDollarSign size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isVendor ? 'Payments & Installments Ledger' : 'Payment History & Receipts'}
            </h1>
            <p className="text-xs text-slate-500">
              {isVendor
                ? `Itemized settlements and installments from ${activeWorkspace.company_name} (${activeWorkspace.company_code})`
                : `Invoice settlements recorded with ${activeWorkspace.company_name} (${activeWorkspace.company_code})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<Download size={14} />}
            onClick={exportPaymentsCSV}
            className="text-xs font-bold"
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} />}
            onClick={fetchPayments}
            className="text-xs font-bold"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            {isVendor ? 'Total Installments Received' : 'Total Payments Made'}
          </span>
          <p className="text-2xl font-black text-emerald-600 tabular-nums">
            {formatCurrency(totalAmount, activeWorkspace.currency)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            {isVendor ? 'Pending From Buyer' : 'Outstanding Balance Due'}
          </span>
          <p className="text-2xl font-black text-amber-600 tabular-nums">
            {formatCurrency(totalDue, activeWorkspace.currency)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            {isVendor ? 'Total Procurement Value' : 'Total Invoiced Amount'}
          </span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            {formatCurrency(totalInvoiced, activeWorkspace.currency)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Installment Logs Count
          </span>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            {formatNumber(totalItems, 0)}
          </p>
        </div>
      </div>

      {/* Filters Bar with Global DatePicker */}
      <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search order #, notes, transaction ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="w-36">
            <DatePicker
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setCurrentPage(1);
              }}
              placeholder="From Date"
            />
          </div>

          <div className="w-36">
            <DatePicker
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setCurrentPage(1);
              }}
              placeholder="To Date"
            />
          </div>

          {(search || startDate || endDate) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Clear
            </button>
          )}

          <Button type="submit" variant="secondary" className="text-xs font-bold">
            Filter
          </Button>
        </div>
      </form>

      {/* Payments Ledger Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
            Loading payments and installment logs...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CircleDollarSign size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">No payment logs found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no payment installments recorded for your account in {activeWorkspace.company_name} yet.
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Payment Date (dd-mm-yyyy)</th>
                    <th className="py-3 px-4">Linked Order #</th>
                    <th className="py-3 px-4 text-right">Installment Amount</th>
                    <th className="py-3 px-4 text-right">Order Total</th>
                    <th className="py-3 px-4 text-right">Remaining Due</th>
                    <th className="py-3 px-4">Payment Notes / Ref</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {payments.map((p) => {
                    const isFullyCleared = Number(p.order_due || 0) <= 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {p.date ? formatDate(p.date) : '—'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-blue-600 font-mono">
                            {p.order_number || '—'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-emerald-600 tabular-nums whitespace-nowrap text-sm">
                          + {formatCurrency(p.amount, activeWorkspace.currency)}
                        </td>

                        <td className="py-3.5 px-4 text-right text-slate-700 tabular-nums whitespace-nowrap">
                          {formatCurrency(p.order_total, activeWorkspace.currency)}
                        </td>

                        <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                          {isFullyCleared ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <CheckCircle2 size={11} /> Cleared (0.00)
                            </span>
                          ) : (
                            <span className="font-bold text-amber-700">
                              {formatCurrency(p.order_due, activeWorkspace.currency)}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {p.notes || <span className="text-slate-400 italic">Disbursed by owner</span>}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPayment(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="View Receipt Details"
                          >
                            <FileText size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Server-Side Pagination */}
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>

      {/* Payment Receipt Drawer / Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CircleDollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Installment Receipt</h3>
                  <p className="text-xs text-slate-500">Order #{selectedPayment.order_number}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block mb-1">
                  Settled Amount
                </span>
                <p className="text-3xl font-black text-emerald-700 tabular-nums">
                  {formatCurrency(selectedPayment.amount, activeWorkspace.currency)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                    <Calendar size={11} /> Payment Date
                  </span>
                  <span className="font-bold text-slate-900">
                    {selectedPayment.date ? formatDate(selectedPayment.date) : '—'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Remaining Due</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(selectedPayment.order_due, activeWorkspace.currency)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Payment Notes / Description</span>
                <p className="text-slate-700 font-medium">
                  {selectedPayment.notes || 'Settlement disbursed via workspace accounts management.'}
                </p>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between font-mono">
                <span>Transaction ID:</span>
                <span className="font-bold text-slate-600">{selectedPayment.id}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <Button onClick={() => setSelectedPayment(null)} className="w-full text-xs font-bold">
                Close Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
