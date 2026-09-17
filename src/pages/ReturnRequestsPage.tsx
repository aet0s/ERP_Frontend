import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  Package
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useToast } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import type { AnyRow, TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { ReturnDetailDrawer } from '../components/ReturnDetailDrawer';
import { ExportColumnsModal, RETURN_EXPORT_COLUMNS } from '../components/ExportColumnsModal';

function ActionModal({
  request,
  actionType,
  onClose,
  onDone
}: {
  request: any;
  actionType: 'approve' | 'reject';
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (actionType === 'approve') {
        await api.post(`/api/return-requests/${request.id}/approve`, { review_notes: notes });
        toast('Request approved & document/inventory ledger processed', 'success');
      } else {
        await api.post(`/api/return-requests/${request.id}/reject`, { review_notes: notes });
        toast('Request rejected', 'info');
      }
      onDone();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Action failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <Modal title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Request ${request.request_number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
          <div><strong className="text-slate-700">Request:</strong> <span className="font-mono">{request.request_number}</span></div>
          <div><strong className="text-slate-700">Type:</strong> {request.request_type?.replace('_', ' ').toUpperCase()}</div>
          <div><strong className="text-slate-700">Party:</strong> {request.vendor_name || request.customer_name || 'N/A'}</div>
          <div><strong className="text-slate-700">Reason:</strong> {request.reason}</div>
        </div>

        <Field label={actionType === 'approve' ? 'Review / Approval Notes (Optional)' : 'Rejection Reason (Required)'}>
          <textarea
            className={`${inputCls} h-24 resize-y`}
            required={actionType === 'reject'}
            placeholder={actionType === 'reject' ? 'Explain why this return request is being rejected...' : 'Approval notes / instructions...'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={actionType === 'approve' ? 'primary' : 'danger'}
            disabled={loading}
          >
            {loading ? 'Processing...' : actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ReturnRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refresh, setRefresh] = useState(0);
  const { canView, canApprove, canExport } = usePermissions('returns');

  // URL search params & localStorage for tab persistence across page reloads (matching InventoryPage pattern)
  const initialTab = (() => {
    const fromUrl = searchParams.get('tab');
    if (fromUrl === 'all' || fromUrl === 'customer' || fromUrl === 'vendor') return fromUrl;
    const fromStorage = localStorage.getItem('return_requests_tab');
    if (fromStorage === 'all' || fromStorage === 'customer' || fromStorage === 'vendor') return fromStorage as 'all' | 'customer' | 'vendor';
    return 'all';
  })();

  const [directionTab, setDirectionTab] = useState<'all' | 'customer' | 'vendor'>(initialTab);

  // Keep directionTab in sync when URL searchParams changes
  useEffect(() => {
    const tabParam = (searchParams.get('tab') as 'all' | 'customer' | 'vendor') || 'all';
    if (tabParam === 'all' || tabParam === 'customer' || tabParam === 'vendor') {
      setDirectionTab(tabParam);
      localStorage.setItem('return_requests_tab', tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: 'all' | 'customer' | 'vendor') => {
    const next = new URLSearchParams(searchParams);
    if (tabId && tabId !== 'all') {
      next.set('tab', tabId);
    } else {
      next.delete('tab');
    }
    setSearchParams(next);
    setDirectionTab(tabId);
    localStorage.setItem('return_requests_tab', tabId);
  };

  const [summary, setSummary] = useState<{
    total_count?: number;
    pending_count?: number;
    approved_count?: number;
    rejected_count?: number;
    vendor_returns_count?: number;
    customer_returns_count?: number;
  }>({});

  useEffect(() => {
    api.get('/api/return-requests?limit=1')
      .then((res) => {
        if (res.data?.summary) setSummary(res.data.summary);
      })
      .catch(() => {});
  }, [refresh]);
  
  // Advanced filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [reasonCategoryFilter, setReasonCategoryFilter] = useState('');

  // Selected for View Details Drawer
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);

  // Selected for Approve / Reject action
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Custom Column Export state
  const [exportContext, setExportContext] = useState<{
    selectedRows: any[];
    total: number;
    getExportData: () => Promise<any[]>;
  } | null>(null);

  // Handle custom CSV column export
  const handleExportDownload = async (selectedColIds: string[], exportAll: boolean) => {
    if (!exportContext) return;
    const records = exportAll ? await exportContext.getExportData() : exportContext.selectedRows;
    const colsToExport = RETURN_EXPORT_COLUMNS.filter((c) => selectedColIds.includes(c.id));

    const escapeCsv = (val: any) => {
      if (val === null || typeof val === 'undefined') return '';
      const text = String(val);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const headerLine = colsToExport.map((c) => escapeCsv(c.label)).join(',');
    const dataLines = records.map((row) =>
      colsToExport.map((c) => escapeCsv(c.getter(row))).join(',')
    );

    const csvContent = [headerLine, ...dataLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `returns_cancellations_${directionTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: TableColumn<AnyRow>[] = [
    {
      key: 'request_number',
      label: 'Request #',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <strong className="text-slate-900 font-semibold font-mono">{row.request_number}</strong>
        </div>
      )
    },
    {
      key: 'return_direction',
      label: 'Direction',
      render: (row) => {
        const isVendor = row.return_direction === 'vendor' ||
          ['purchase_return', 'purchase_cancellation'].includes(row.request_type) ||
          Boolean(row.vendor_id);
        return (
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            isVendor
              ? 'bg-amber-100/80 text-amber-900 border border-amber-300/60'
              : 'bg-emerald-100/80 text-emerald-900 border border-emerald-300/60'
          }`}>
            {isVendor ? <Building2 size={11} /> : <User size={11} />}
            {isVendor ? 'To Vendor' : 'By Customer'}
          </span>
        );
      }
    },
    {
      key: 'request_type',
      label: 'Return Type',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-700 capitalize">
          {row.request_type ? row.request_type.replace('_', ' ') : 'Return'}
        </span>
      )
    },
    {
      key: 'party',
      label: 'Party',
      render: (row) => (
        <div className="font-semibold text-slate-800 truncate max-w-[170px]" title={row.vendor_name || row.customer_name}>
          {row.vendor_name || row.customer_name || 'Internal'}
        </div>
      )
    },
    {
      key: 'reference_number',
      label: 'Ref Order #',
      render: (row) => (
        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
          {row.reference_number || row.reference_id || '-'}
        </span>
      )
    },
    {
      key: 'items_summary',
      label: 'Items',
      render: (row) => {
        let items = row.return_items || row.items;
        if (typeof items === 'string') {
          try { items = JSON.parse(items); } catch (_) { items = []; }
        }
        if (!Array.isArray(items) || items.length === 0) {
          return <span className="text-xs text-slate-400 italic">Entire Order</span>;
        }
        const first = items[0];
        const extraCount = items.length - 1;
        return (
          <div className="text-xs text-slate-700 truncate max-w-[180px]" title={items.map((i: any) => `${i.name || i.item_name} (${i.quantity})`).join(', ')}>
            <span className="font-medium">{first.name || first.item_name || 'Item'}</span>{' '}
            <span className="text-slate-500">({first.quantity} {first.unit || 'units'})</span>
            {extraCount > 0 && (
              <span className="ml-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-1 rounded">
                +{extraCount} more
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span className="truncate max-w-[190px] block text-xs text-slate-600" title={row.reason}>
          {row.reason}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (row) => formatDate(row.created_at)
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {canApprove && row.status === 'Pending' && !(
            row.return_direction === 'vendor' ||
            ['purchase_return', 'purchase_cancellation'].includes(row.request_type) ||
            Boolean(row.vendor_id)
          ) && (
            <>
              <button
                onClick={() => { setSelectedRequest(row); setActionType('approve'); }}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition cursor-pointer"
                title="Approve Request"
              >
                <CheckCircle2 size={12} /> Approve
              </button>
              <button
                onClick={() => { setSelectedRequest(row); setActionType('reject'); }}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition cursor-pointer"
                title="Reject Request"
              >
                <XCircle size={12} /> Reject
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Returns module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<RefreshCcw />}
        title="Returns & Cancellations Queue"
        subtitle="Review, approve, and track both return requests made to vendors (Purchase) and returns requested by customers (Sales)."
      />

      {/* Direction Navigation Tabs: All First, Customer Second, Vendor Third */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
              directionTab === 'all'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Package size={16} />
            <span>All Requests</span>
            {summary.total_count !== undefined && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                directionTab === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {summary.total_count}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('customer')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
              directionTab === 'customer'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <User size={16} />
            <span>Returns by Customers (Sales)</span>
            {summary.customer_returns_count !== undefined && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                summary.customer_returns_count > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {summary.customer_returns_count}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('vendor')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
              directionTab === 'vendor'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Building2 size={16} />
            <span>Returns to Vendors (Purchase)</span>
            {summary.vendor_returns_count !== undefined && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                directionTab === 'vendor' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {summary.vendor_returns_count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* DataTable with Advanced Multi-Filter bar and Custom Column Export */}
      <DataTable
        endpoint="/api/return-requests"
        columns={columns}
        filters={{
          direction: directionTab !== 'all' ? directionTab : undefined,
          status: statusFilter || undefined,
          request_type: typeFilter || undefined,
          reason_category: reasonCategoryFilter || undefined
        }}
        refreshKey={refresh}
        showDateFilters={true}
        emptyTitle={`No ${directionTab === 'vendor' ? 'vendor returns' : directionTab === 'customer' ? 'customer returns' : 'return requests'} found`}
        rowId={(row) => String(row.id || '')}
        onView={(row) => setDetailRequestId(String(row.id))}
        extraFilters={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <div className="w-36">
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'Pending', label: 'Pending Review' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' }
                ]}
              />
            </div>

            {/* Request Type Filter */}
            <div className="w-40">
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                options={
                  directionTab === 'vendor'
                    ? [
                        { value: '', label: 'All Vendor Types' },
                        { value: 'purchase_return', label: 'Purchase Return' },
                        { value: 'purchase_cancellation', label: 'Purchase Cancellation' }
                      ]
                    : directionTab === 'customer'
                    ? [
                        { value: '', label: 'All Customer Types' },
                        { value: 'sales_return', label: 'Sales Return' },
                        { value: 'sales_cancellation', label: 'Sales Cancellation' }
                      ]
                    : [
                        { value: '', label: 'All Request Types' },
                        { value: 'purchase_return', label: 'Purchase Return' },
                        { value: 'purchase_cancellation', label: 'Purchase Cancellation' },
                        { value: 'sales_return', label: 'Sales Return' },
                        { value: 'sales_cancellation', label: 'Sales Cancellation' }
                      ]
                }
              />
            </div>

            {/* Reason Category Filter */}
            <div className="w-44">
              <Select
                value={reasonCategoryFilter}
                onChange={setReasonCategoryFilter}
                options={[
                  { value: '', label: 'All Reason Categories' },
                  { value: 'Quality', label: 'Quality / Defective' },
                  { value: 'Damaged', label: 'Damaged in Transit' },
                  { value: 'Expiry', label: 'Expired / Near Expiry' },
                  { value: 'Wrong', label: 'Wrong Item Delivered' },
                  { value: 'Cancellation', label: 'Order Cancellation' }
                ]}
              />
            </div>
          </div>
        }
        canExport={canExport}
        canCreate={false}
        canEdit={false}
        canDelete={false}
        onExport={canExport ? (ctx) => setExportContext(ctx) : undefined}
      />

      {/* Rich Return Detail Drawer */}
      {detailRequestId ? (
        <ReturnDetailDrawer
          requestId={detailRequestId}
          onClose={() => setDetailRequestId(null)}
          onApprove={canApprove ? (req) => {
            setDetailRequestId(null);
            setSelectedRequest(req);
            setActionType('approve');
          } : undefined}
          onReject={canApprove ? (req) => {
            setDetailRequestId(null);
            setSelectedRequest(req);
            setActionType('reject');
          } : undefined}
          onRefresh={() => setRefresh((v) => v + 1)}
        />
      ) : null}

      {/* Approve / Reject Modal */}
      {selectedRequest && actionType ? (
        <ActionModal
          request={selectedRequest}
          actionType={actionType}
          onClose={() => { setSelectedRequest(null); setActionType(null); }}
          onDone={() => { setSelectedRequest(null); setActionType(null); setRefresh((v) => v + 1); }}
        />
      ) : null}

      {/* Export Columns Selection Modal */}
      {exportContext ? (
        <ExportColumnsModal
          onClose={() => setExportContext(null)}
          selectedCount={exportContext.selectedRows.length}
          totalCount={exportContext.total}
          onConfirmExport={handleExportDownload}
        />
      ) : null}
    </div>
  );
}
