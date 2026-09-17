import { useEffect, useState } from 'react';
import {
  Download, CreditCard, User,
  Package, Truck,
  Plus, Copy, Check
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import { useWorkspace, useToast } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { Drawer } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';

interface SalesDetailDrawerProps {
  saleId: string;
  onClose: () => void;
  onRecordPayment?: (sale: any) => void;
  onDispatch?: (sale: any) => void;
  onRefresh?: () => void;
}

export function SalesDetailDrawer({
  saleId,
  onClose,
  onRecordPayment,
  onDispatch,
  onRefresh
}: SalesDetailDrawerProps) {
  const { workspace } = useWorkspace();
  const { canApprove, canCreate, canEdit, canExport } = usePermissions('sales');
  const toast = useToast();
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchDetail = () => {
    setLoading(true);
    api.get(`/api/invoices/${saleId}`)
      .then((res) => {
        setSale(res.data);
        if (onRefresh) onRefresh();
      })
      .catch((err) => {
        console.error('fetch invoice detail error', err);
        toast('Failed to load invoice details', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (saleId) {
      fetchDetail();
    }
  }, [saleId]);

  const currency = workspace?.currency || 'INR';

  const copyInvoiceNumber = () => {
    if (!sale?.invoice_number) return;
    navigator.clipboard.writeText(sale.invoice_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Invoice number copied to clipboard', 'info');
  };

  const handleDownloadPdf = async () => {
    if (!sale) return;
    try {
      setDownloadingPdf(true);
      const res = await api.get(`/api/invoices/${sale.id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sale.invoice_number || 'Sales_Invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('Invoice PDF downloaded', 'success');
    } catch (err) {
      toast('Failed to download invoice PDF', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const workspaceState = (workspace as any)?.state || 'Delhi';
  const isInterstate = sale?.place_of_supply && workspaceState
    ? sale.place_of_supply.trim().toLowerCase() !== workspaceState.trim().toLowerCase()
    : false;

  const isOverdue = sale?.due_date && Number(sale?.amount_due || 0) > 0 && new Date(sale.due_date) < new Date();

  return (
    <Drawer title="Sales Invoice Details" onClose={onClose}>
      {loading ? (
        <div className="space-y-4">
          <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : sale ? (
        <div className="space-y-5 pb-6">
          {/* Header Executive Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  GST Tax Invoice
                </span>
                <span className="text-slate-500">•</span>
                <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                  <span>{sale.invoice_number || sale.id}</span>
                  <button
                    type="button"
                    onClick={copyInvoiceNumber}
                    className="text-slate-400 hover:text-white transition p-0.5 rounded cursor-pointer"
                    title="Copy Invoice #"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={sale.payment_status || (Number(sale.amount_due || 0) <= 0 ? 'Paid' : 'Unpaid')} />
                {sale.status && sale.status !== 'Draft' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {sale.status}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-slate-800 pt-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoice Date</span>
                <strong className="text-white font-medium">{formatDate(sale.date || sale.created_at)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Due Date</span>
                <strong className={isOverdue ? 'text-red-400 font-bold' : 'text-white font-medium'}>
                  {sale.due_date ? formatDate(sale.due_date) : 'Immediate'}
                  {isOverdue && <span className="block text-[9px] text-red-400 font-bold uppercase tracking-wider">Overdue</span>}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Location</span>
                <strong className="text-white font-medium truncate block">{sale.location_name || 'Main Warehouse'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Place of Supply</span>
                <strong className="text-white font-medium truncate block">{sale.place_of_supply || 'Same State'}</strong>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">Grand Total: <strong className="text-white font-bold">{formatCurrency(sale.total_amount, currency)}</strong></span>
              <div className="flex items-center gap-2">
                {canApprove && onDispatch && !sale.dispatch_tracking_ref && !sale.dispatch_date && sale.status !== 'Goods Received' && sale.status !== 'Delivered' && sale.status !== 'Returned' && (
                  <button
                    type="button"
                    onClick={() => onDispatch(sale)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <Truck size={13} /> Dispatch Order
                  </button>
                )}
                {canExport && (
                  <button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs border border-slate-700"
                  >
                    <Download size={13} /> {downloadingPdf ? 'Downloading...' : 'PDF Invoice'}
                  </button>
                )}
                {(canCreate || canEdit) && Number(sale.amount_due || 0) > 0 && onRecordPayment && (
                  <button
                    type="button"
                    onClick={() => onRecordPayment(sale)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <Plus size={13} /> Record Payment
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Billing Details Card */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5">
                <User size={14} className="text-blue-600 shrink-0" />
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Customer & Billing Details</h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                GSTIN: <strong className="text-slate-800 font-mono">{sale.customer_gstin || 'Unregistered / Direct'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Customer Name</span>
                <strong className="text-slate-900 text-sm font-semibold">{sale.customer_name || 'Walk-in Customer'}</strong>
                {sale.customer_email && (
                  <span className="block text-slate-600 text-[11px] mt-0.5 truncate">{sale.customer_email}</span>
                )}
                {sale.customer_phone && (
                  <span className="block text-slate-600 text-[11px] mt-0.5">{sale.customer_phone}</span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Billing / Supply State</span>
                <strong className="text-slate-800 font-medium">{sale.place_of_supply || 'Default State'}</strong>
                <span className="block text-[11px] text-slate-500 mt-1">
                  Tax Type: <strong className="text-slate-700">{isInterstate ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Dispatch / Shipping Info (if dispatched or tracking exists) */}
          {(sale.dispatch_tracking_ref || sale.dispatch_date) ? (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-blue-800 font-bold text-[11px] uppercase tracking-wider">
                  <Truck size={14} className="text-blue-600" />
                  <span>Dispatch & Shipping Details</span>
                </div>
                {sale.status === 'Goods Received' || sale.status === 'Delivered' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    <Check size={12} /> Received by Customer
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                    In Transit
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-slate-500 block text-[10px]">Tracking Number:</span>
                  <strong className="font-mono text-slate-900">{sale.dispatch_tracking_ref}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Dispatched Date:</span>
                  <strong>{formatDate(sale.dispatch_date)}</strong>
                </div>
              </div>
              {sale.delivered_date && (
                <div className="text-[11px] text-emerald-700 font-medium pt-1 border-t border-blue-100">
                  Customer Receipt Date: <strong>{formatDate(sale.delivered_date)}</strong>
                </div>
              )}
            </div>
          ) : (
            onDispatch && sale.status !== 'Goods Received' && sale.status !== 'Returned' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <strong className="text-slate-800 block font-semibold">Ready for Dispatch</strong>
                  <span className="text-slate-500 text-[11px]">Generate logistics tracking ref and dispatch shipment to buyer.</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDispatch(sale)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Truck size={13} /> Dispatch Now
                </button>
              </div>
            )
          )}

          {sale.status === 'Return Requested' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1 text-amber-900">
              <strong className="block font-bold">⚠️ Customer Return Requested</strong>
              <p className="text-[11px]">The customer has requested a return for this order. Review and process approval or rejection in the Return Requests page.</p>
            </div>
          )}

          {/* Line Items Table with Packaging Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-blue-600" />
                Line Items ({sale.items?.length || 0})
              </h4>
              <span className="text-[11px] text-slate-500">
                All prices in <strong>{currency}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
              <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2">
                <div className="col-span-5">PRODUCT / FINISHED GOOD</div>
                <div className="col-span-2 text-right">QTY SOLD</div>
                <div className="col-span-2 text-right">RATE</div>
                <div className="col-span-1 text-right">GST %</div>
                <div className="col-span-2 text-right">LINE TOTAL</div>
              </div>

              {sale.items && sale.items.length > 0 ? (
                sale.items.map((item: any, idx: number) => {
                  const pkgName = item.package_name || null;
                  const pkgUnit = item.package_unit || item.unit || 'pcs';
                  const unitsPerPkg = Number(item.units_per_package || 1);
                  const isPackaged = unitsPerPkg > 1 || !!pkgName;

                  return (
                    <div key={item.id || idx} className="p-3 grid grid-cols-12 gap-2 items-center text-xs">
                      {/* Product Name & Packaging Config Pill */}
                      <div className="col-span-5">
                        <strong className="text-slate-900 font-semibold block truncate">
                          {item.finished_good_name || item.item_name || 'Finished Product'}
                        </strong>
                        {isPackaged ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                              📦 {pkgName || `${unitsPerPkg} ${item.base_unit || 'units'}/${pkgUnit}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">Base Unit ({item.unit || 'units'})</span>
                        )}
                      </div>

                      {/* Quantity Sold */}
                      <div className="col-span-2 text-right font-semibold text-slate-800">
                        <span>{formatNumber(item.quantity)} {pkgUnit}</span>
                        {isPackaged && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            (= {formatNumber(Number(item.quantity) * unitsPerPkg)} {item.base_unit || 'units'})
                          </span>
                        )}
                      </div>

                      {/* Rate per Unit */}
                      <div className="col-span-2 text-right text-slate-700 font-medium">
                        {formatCurrency(item.rate_per_unit, currency)}
                        <span className="block text-[10px] text-slate-400 font-normal">/{pkgUnit}</span>
                      </div>

                      {/* GST Tax Rate */}
                      <div className="col-span-1 text-right text-slate-600 font-medium">
                        {Number(item.tax_rate || 0)}%
                        {Number(item.discount_percent || 0) > 0 && (
                          <span className="block text-[9px] text-emerald-600 font-bold">-{Number(item.discount_percent)}%</span>
                        )}
                      </div>

                      {/* Line Total */}
                      <div className="col-span-2 text-right font-bold text-slate-900">
                        {formatCurrency(item.line_total || (item.quantity * item.rate_per_unit), currency)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-slate-400 text-xs italic">No line items attached.</div>
              )}
            </div>
          </div>

          {/* Financial Breakdown & Tax Split */}
          <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-2 text-xs">
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
              Financial Summary & GST Split
            </h4>

            {sale.subtotal != null && (
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value (Subtotal):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(sale.subtotal, currency)}</span>
              </div>
            )}

            {Number(sale.cgst_amount || 0) > 0 && (
              <div className="flex justify-between text-slate-600 pl-2">
                <span>CGST (Central Tax):</span>
                <span className="font-medium text-slate-700">+{formatCurrency(sale.cgst_amount, currency)}</span>
              </div>
            )}

            {Number(sale.sgst_amount || 0) > 0 && (
              <div className="flex justify-between text-slate-600 pl-2">
                <span>SGST (State Tax):</span>
                <span className="font-medium text-slate-700">+{formatCurrency(sale.sgst_amount, currency)}</span>
              </div>
            )}

            {Number(sale.igst_amount || 0) > 0 && (
              <div className="flex justify-between text-slate-600 pl-2">
                <span>IGST (Integrated Tax):</span>
                <span className="font-medium text-slate-700">+{formatCurrency(sale.igst_amount, currency)}</span>
              </div>
            )}

            {Number(sale.total_tax || 0) > 0 && (
              <div className="flex justify-between text-slate-700 font-semibold border-t border-slate-200/60 pt-1">
                <span>Total GST Tax:</span>
                <span className="text-emerald-700">+{formatCurrency(sale.total_tax, currency)}</span>
              </div>
            )}

            {Number(sale.discount_amount || 0) > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>
                  Invoice Discount
                  {Number(sale.subtotal || 0) > 0
                    ? ` (${((Number(sale.discount_amount) / Number(sale.subtotal)) * 100).toFixed(1).replace(/\.0$/, '')}%):`
                    : ':'}
                </span>
                <span className="font-semibold font-mono text-emerald-700">-{formatCurrency(sale.discount_amount, currency)}</span>
              </div>
            )}

            {Number(sale.round_off_amount || 0) !== 0 && (
              <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                <span>Round Off:</span>
                <span>{Number(sale.round_off_amount) > 0 ? `+${Number(sale.round_off_amount).toFixed(2)}` : Number(sale.round_off_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 text-sm">
              <span>Grand Total Amount:</span>
              <span className="text-blue-700">{formatCurrency(sale.total_amount, currency)}</span>
            </div>

            {/* Paid / Due Balance Cards */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="block text-[10px] uppercase font-bold text-emerald-700">Amount Received</span>
                <span className="text-xs font-extrabold text-emerald-800">{formatCurrency(sale.amount_received || 0, currency)}</span>
              </div>
              <div className={`p-2.5 rounded-xl text-center border ${Number(sale.amount_due || 0) > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                <span className="block text-[10px] uppercase font-bold">Balance Due</span>
                <span className="text-xs font-extrabold">{formatCurrency(sale.amount_due || 0, currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment Receipts Log */}
          {sale.payments_history && sale.payments_history.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={14} className="text-emerald-600" />
                  Payments Received Log ({sale.payments_history.length})
                </h4>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">DATE</div>
                  <div className="col-span-4 text-right">AMOUNT</div>
                  <div className="col-span-4">REFERENCE / NOTES</div>
                </div>
                {sale.payments_history.map((pay: any, idx: number) => (
                  <div key={pay.id || idx} className="p-2.5 grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-1 font-mono text-slate-400">#{idx + 1}</div>
                    <div className="col-span-3 text-slate-700 font-medium">{formatDate(pay.date || pay.created_at)}</div>
                    <div className="col-span-4 text-right font-bold text-emerald-700">{formatCurrency(pay.amount, currency)}</div>
                    <div className="col-span-4 text-slate-600 text-[11px] truncate">{pay.notes || pay.reference || 'Installment'}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-xs text-slate-500">
              No installment payments logged yet for this invoice.
            </div>
          )}

          {/* Terms & Conditions / Notes */}
          {(sale.notes || sale.terms_and_conditions) && (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3 text-xs">
              {sale.notes && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Invoice Notes</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{sale.notes}</p>
                </div>
              )}
              {sale.terms_and_conditions && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Terms & Conditions</span>
                  <p className="text-slate-600 whitespace-pre-wrap text-[11px]">{sale.terms_and_conditions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Invoice details not found.</p>
      )}
    </Drawer>
  );
}
