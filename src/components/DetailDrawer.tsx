import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import { useWorkspace } from '../context';
import { Drawer } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';

export function DetailDrawer({
  endpoint,
  title,
  onClose
}: {
  endpoint: string;
  title: string;
  onClose: () => void;
}) {
  const { workspace } = useWorkspace();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(endpoint).then((res) => setDetail(res.data)).finally(() => setLoading(false));
  }, [endpoint]);

  return (
    <Drawer title={title} onClose={onClose}>
      {loading ? (
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      ) : detail ? (
        <div className="space-y-6">
          {/* Header Summary Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {detail.procurement_number ? 'Procurement Order' : detail.invoice_number ? 'Sales Invoice' : 'Document Details'}
                </span>
                <h3 className="text-base font-bold text-white font-mono">
                  {detail.procurement_number || detail.invoice_number || detail.po_number || detail.id}
                </h3>
              </div>
              {detail.status && <StatusBadge status={detail.status} />}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Party / Vendor:</span>
                <strong className="text-white font-medium">{detail.vendor_name || detail.customer_name || 'Walk-in / Direct'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Location:</span>
                <strong className="text-white font-medium">{detail.location_name || 'Main Location'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Date:</span>
                <strong className="text-white font-medium">{formatDate(detail.date || detail.created_at)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Items:</span>
                <strong className="text-white font-medium">{detail.items?.length || detail.item_count || 1} item(s)</strong>
              </div>
            </div>
          </div>

          {/* Vendor Denial Reason / Vendor Notes Alert Box */}
          {(detail.vendor_notes || detail.decline_reason || detail.rejection_reason) && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-red-700 block">
                Vendor Denial Reason / Rejection Notes
              </span>
              <p className="text-red-900 font-medium">
                {detail.vendor_notes || detail.decline_reason || detail.rejection_reason}
              </p>
            </div>
          )}

          {/* Financial Breakdown */}
          {(detail.total_amount != null || detail.subtotal != null) && (
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2 text-xs">
              <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
                Financial Summary
              </h4>
              {detail.subtotal != null && (
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Excl. Tax):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(detail.subtotal, workspace?.currency)}</span>
                </div>
              )}
              {Number(detail.tax_amount || detail.total_tax || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST Tax:</span>
                  <span className="font-semibold text-emerald-700">+{formatCurrency(detail.tax_amount || detail.total_tax, workspace?.currency)}</span>
                </div>
              )}
              {Number(detail.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(detail.discount_amount, workspace?.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 text-sm">
                <span>Grand Total:</span>
                <span>{formatCurrency(detail.total_amount, workspace?.currency)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="block text-[10px] uppercase font-bold text-emerald-700">Paid / Received</span>
                  <span className="text-xs font-extrabold text-emerald-800">{formatCurrency(detail.amount_paid ?? detail.amount_received ?? 0, workspace?.currency)}</span>
                </div>
                <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-center">
                  <span className="block text-[10px] uppercase font-bold text-red-700">Balance Due</span>
                  <span className="text-xs font-extrabold text-red-800">{formatCurrency(detail.amount_due ?? 0, workspace?.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          {detail.items && detail.items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Line Items ({detail.items.length})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2">
                  <div className="col-span-4">ITEM</div>
                  <div className="col-span-2 text-right">QTY</div>
                  <div className="col-span-3 text-right">RATE</div>
                  <div className="col-span-3 text-right">TOTAL</div>
                </div>
                {detail.items.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="p-2.5 grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-4 font-semibold text-slate-800 truncate">
                      {item.item_name || item.name || 'Material Item'}
                    </div>
                    <div className="col-span-2 text-right font-medium text-slate-700">
                      {formatNumber(item.quantity)} {item.unit || ''}
                    </div>
                    <div className="col-span-3 text-right text-slate-600">
                      {formatCurrency(item.rate_per_unit, workspace?.currency)}
                    </div>
                    <div className="col-span-3 text-right font-bold text-slate-900">
                      {formatCurrency(item.line_total || (item.quantity * item.rate_per_unit), workspace?.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Activity & Payments Timeline</h4>
            <div className="space-y-2">
              {(detail?.timeline || []).length ? (
                detail.timeline.map((item: any, index: number) => (
                  <div key={item.id || index} className="p-3 bg-slate-50 border-l-4 border-l-blue-600 rounded-r-xl border border-slate-200/60 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <strong className="font-bold text-slate-800 capitalize">{item.kind || item.reference_table || item.transaction_type}</strong>
                      <span className="text-[11px] font-medium text-slate-400">{formatDate(item.date || item.created_at)}</span>
                    </div>
                    <p className="text-slate-600">
                      {item.notes || item.reason || item.title || `${item.quantity ?? ''} ${item.item_type ?? ''}`}
                      {item.amount ? ` - ${formatCurrency(item.amount, workspace?.currency)}` : ''}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No related activity recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No details available.</p>
      )}
    </Drawer>
  );
}
