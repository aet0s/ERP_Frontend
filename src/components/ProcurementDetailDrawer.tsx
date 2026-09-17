import { useEffect, useState } from 'react';
import { 
  Building2, Phone, Mail, MapPin, CreditCard, Truck, 
  FileText, CheckCircle2, Clock, DollarSign, AlertCircle, Package, PackageCheck, Copy
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatNumber } from '../lib/utils';
import { useWorkspace, useToast, useConfirm } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { Drawer } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';
import { Button } from './ui/Button';

interface ProcurementDetailDrawerProps {
  procurementId: string;
  onClose: () => void;
  onPayVendor?: (procurement: any) => void;
  onRefresh?: () => void;
}

export function ProcurementDetailDrawer({
  procurementId,
  onClose,
  onPayVendor,
  onRefresh
}: ProcurementDetailDrawerProps) {
  const { workspace } = useWorkspace();
  const { canApprove, canCreate, canEdit } = usePermissions('procurement');
  const toast = useToast();
  const confirm = useConfirm();
  const [proc, setProc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);

  const fetchDetail = () => {
    setLoading(true);
    api.get(`/api/procurements/${procurementId}`)
      .then((res) => {
        setProc(res.data);
        if (onRefresh) onRefresh();
      })
      .catch((err) => console.error('fetch procurement detail error', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (procurementId) {
      fetchDetail();
    }
  }, [procurementId]);

  const currency = workspace?.currency || 'INR';

  const handleReceiveInDrawer = async () => {
    if (!proc) return;
    const isDispatched = proc.status === 'Dispatched by Vendor' || proc.status === 'Dispatched';

    const userAgreed = await confirm({
      title: 'Confirm Goods Receipt',
      message: isDispatched
        ? `Vendor has dispatched procurement ${proc.procurement_number || proc.id}${proc.dispatch_tracking_ref ? ` (Tracking: ${proc.dispatch_tracking_ref})` : ''}. Confirming receipt will automatically add the items into your warehouse inventory and update stock levels.`
        : `Confirm receipt of goods for procurement ${proc.procurement_number || proc.id}? This will automatically add the items into your warehouse inventory and update stock levels.`,
      tone: 'info',
      confirmText: 'Receive Goods into Stock',
      cancelText: 'Cancel'
    });

    if (!userAgreed) return;

    try {
      setReceiving(true);
      const res = await api.post(`/api/procurements/${proc.id}/receive`);
      toast(res.data?.message || 'Goods received and inventory stock updated!', 'success');
      if (onRefresh) onRefresh();
      fetchDetail();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to mark goods as received', 'error');
    } finally {
      setReceiving(false);
    }
  };

  let carrierName = '';
  let vehicleNumber = '';
  if (proc?.vendor_notes && typeof proc.vendor_notes === 'string' && proc.vendor_notes.includes('Carrier:')) {
    const cMatch = proc.vendor_notes.match(/Carrier:\s*([^|.]+)/i);
    if (cMatch && cMatch[1]) carrierName = cMatch[1].trim();
    const vMatch = proc.vendor_notes.match(/Vehicle:\s*([^|.]+)/i);
    if (vMatch && vMatch[1]) vehicleNumber = vMatch[1].trim();
  } else if (proc?.dispatch_tracking_ref) {
    const up = proc.dispatch_tracking_ref.toUpperCase();
    if (up.includes('BLUEDART') || up.includes('BLUE DART')) carrierName = 'BlueDart Express';
    else if (up.includes('DTDC')) carrierName = 'DTDC Express';
    else if (up.includes('DELHIVERY')) carrierName = 'Delhivery';
    else if (up.includes('VRL')) carrierName = 'VRL Logistics';
  }

  return (
    <Drawer title="Procurement Details" onClose={onClose}>
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-slate-100 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-48 bg-slate-100 rounded-2xl" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      ) : proc ? (
        <div className="space-y-6 pb-6 text-slate-800">
          {/* 1. Header Card */}
          <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-md border border-slate-700/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Procurement Order
                  </span>
                  {proc.purchase_order?.po_number && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                      From PO: {proc.purchase_order.po_number}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white font-mono tracking-tight mt-0.5">
                  {proc.procurement_number || proc.id}
                </h3>
              </div>
              <div className="flex flex-col items-end gap-1">
                {proc.status && <StatusBadge status={proc.status} />}
                {Number(proc.amount_due || 0) <= 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Fully Paid
                  </span>
                ) : Number(proc.amount_paid || 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                    <Clock className="w-3 h-3" /> Partially Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-500/30">
                    <AlertCircle className="w-3 h-3" /> Unpaid
                  </span>
                )}
                <div className="text-right mt-1">
                  <span className="text-[10px] font-medium text-slate-400 block">Total:</span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">
                    {formatCurrency(proc.total_amount, workspace?.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-slate-700/60 pt-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Vendor Name:</span>
                <strong className="text-white font-medium truncate block">{proc.vendor_name || 'Vendor'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Payment Status:</span>
                <span className="inline-block mt-0.5">
                  <StatusBadge status={proc.payment_status || (Number(proc.amount_due) <= 0 ? 'paid' : Number(proc.amount_paid) > 0 ? 'partial' : 'unpaid')} />
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Warehouse / Location:</span>
                <strong className="text-white font-medium truncate block">{proc.location_name || 'Main Location'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Order Date:</span>
                <strong className="text-white font-medium block">{formatDate(proc.date || proc.created_at)}</strong>
              </div>
            </div>
          </div>

          {/* Fulfillment & Receiving Banner */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Fulfillment Status & Logistics
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={proc.status || 'Sent to Vendor'} />
                {proc.dispatch_tracking_ref && (
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-mono font-bold shadow-2xs cursor-pointer hover:bg-blue-100 transition group"
                    onClick={() => {
                      navigator.clipboard.writeText(proc.dispatch_tracking_ref);
                      toast(`Copied tracking ref: ${proc.dispatch_tracking_ref}`, 'success');
                    }}
                    title="Click to copy tracking reference"
                  >
                    <Truck size={13} className="text-blue-600 shrink-0" />
                    {carrierName && (
                      <span className="font-sans font-semibold text-[11px] text-blue-700 uppercase tracking-tight">
                        {carrierName}:
                      </span>
                    )}
                    <span>{proc.dispatch_tracking_ref}</span>
                    <Copy size={11} className="text-blue-400 group-hover:text-blue-700 shrink-0 ml-0.5" />
                    {proc.dispatch_date && (
                      <span className="font-sans font-normal text-[11px] text-blue-600 border-l border-blue-200 pl-1.5">
                        {formatDate(proc.dispatch_date)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {proc.status === 'Received' ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Stock Received on {formatDate(proc.received_date || proc.updated_at)}
              </div>
            ) : (proc.status === 'Dispatched by Vendor' || proc.status === 'Dispatched') ? (
              canApprove ? (
                <Button
                  variant="primary"
                  disabled={receiving}
                  onClick={handleReceiveInDrawer}
                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-2 ring-blue-400/30"
                >
                  <PackageCheck className="w-4 h-4 mr-1.5" />
                  {receiving ? 'Receiving Stock...' : 'Receive Goods into Stock'}
                </Button>
              ) : (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  Dispatched by Vendor (Approval Permission Required)
                </span>
              )
            ) : (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                Awaiting Vendor Dispatch
              </span>
            )}
          </div>

          {/* 2. Financial Summary KPI Banner */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Payment & Billing Summary
              </span>
              {Number(proc.amount_due || 0) > 0 && onPayVendor && (canCreate || canEdit) && (
                <Button
                  variant="primary"
                  onClick={() => onPayVendor(proc)}
                  className="shadow-sm text-xs py-1 px-3"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  Pay Vendor
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Total Bill
                </span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {formatCurrency(proc.total_amount, currency)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <span className="block text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                  Amount Paid
                </span>
                <span className="text-sm font-bold text-emerald-800 block mt-0.5">
                  {formatCurrency(proc.amount_paid, currency)}
                </span>
              </div>
              <div className={`p-3 rounded-xl border ${
                Number(proc.amount_due || 0) > 0 
                  ? 'bg-red-50/70 border-red-200' 
                  : 'bg-slate-100 border-slate-200'
              }`}>
                <span className={`block text-[10px] uppercase font-bold tracking-wider ${
                  Number(proc.amount_due || 0) > 0 ? 'text-red-700' : 'text-slate-500'
                }`}>
                  Balance Due
                </span>
                <span className={`text-sm font-bold block mt-0.5 ${
                  Number(proc.amount_due || 0) > 0 ? 'text-red-800' : 'text-slate-600'
                }`}>
                  {formatCurrency(proc.amount_due, currency)}
                </span>
              </div>
            </div>

            {/* Subtotal, Tax, Discount details */}
            <div className="border-t border-slate-200 pt-2 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal (Taxable):</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(proc.subtotal ?? (Number(proc.quantity || 0) * Number(proc.rate_per_unit || 0)), currency)}
                </span>
              </div>
              {Number(proc.tax_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>GST Taxes:</span>
                  <span className="font-semibold text-emerald-700">
                    +{formatCurrency(proc.tax_amount, currency)}
                  </span>
                </div>
              )}
              {Number(proc.discount_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(proc.discount_amount, currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Vendor Details Card */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Vendor & Tax Details
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-700 font-mono">
                {proc.vendor_code || 'VEN-N/A'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Vendor Name:</span>
                <span className="font-semibold text-slate-900">{proc.vendor_name || '—'}</span>
              </div>
              {proc.vendor_contact_person && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                  <span className="font-medium text-slate-800">{proc.vendor_contact_person}</span>
                </div>
              )}
              {proc.vendor_phone && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Phone:</span>
                  <a href={`tel:${proc.vendor_phone}`} className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {proc.vendor_phone}
                  </a>
                </div>
              )}
              {proc.vendor_email && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Email:</span>
                  <a href={`mailto:${proc.vendor_email}`} className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {proc.vendor_email}
                  </a>
                </div>
              )}
              <div>
                <span className="text-slate-400 block text-[11px]">GSTIN:</span>
                {proc.vendor_gstin ? (
                  <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                    {proc.vendor_gstin}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Not Provided</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">PAN:</span>
                {proc.vendor_pan ? (
                  <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                    {proc.vendor_pan}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Not Provided</span>
                )}
              </div>
            </div>

            {/* Address */}
            {(proc.vendor_address_line1 || proc.vendor_address || proc.vendor_city || proc.vendor_state) && (
              <div className="pt-2 border-t border-slate-100 text-xs flex items-start gap-2 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Billing / Dispatch Address:</span>
                  <p className="font-medium text-slate-800">
                    {[
                      proc.vendor_address_line1 || proc.vendor_address,
                      proc.vendor_address_line2,
                      proc.vendor_city,
                      proc.vendor_state,
                      proc.vendor_pincode,
                      proc.vendor_country
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Banking */}
            {proc.vendor_bank_account_number && (
              <div className="pt-2 border-t border-slate-100 text-xs flex items-start gap-2 text-slate-600">
                <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Bank Settlement Account:</span>
                  <p className="font-medium text-slate-800">
                    {proc.vendor_bank_account_name ? `${proc.vendor_bank_account_name} — ` : ''}
                    A/C: <span className="font-mono font-semibold">{proc.vendor_bank_account_number}</span>
                    {proc.vendor_bank_ifsc ? ` (IFSC: ${proc.vendor_bank_ifsc})` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 4. Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Purchased Items ({proc.items?.length || 0})
                </h4>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total Qty: {formatNumber((proc.items || []).reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0))}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-xs">
              <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2.5 grid grid-cols-12 gap-2">
                <div className="col-span-5">ITEM / SKU / HSN</div>
                <div className="col-span-2 text-right">QTY</div>
                <div className="col-span-2 text-right">RATE</div>
                <div className="col-span-3 text-right">TOTAL</div>
              </div>

              {(proc.items && proc.items.length > 0) ? (
                proc.items.map((item: any, idx: number) => {
                  const qty = Number(item.quantity || 0);
                  const rate = Number(item.rate_per_unit || 0);
                  const taxRate = Number(item.tax_rate || 0);
                  const lineTotal = Number(item.line_total || 0) || (qty * rate);

                  return (
                    <div key={item.id || idx} className="p-3 grid grid-cols-12 gap-2 items-center text-xs hover:bg-slate-50/80 transition-colors">
                      <div className="col-span-5 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {item.item_name || item.name || 'Raw Material / Item'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                          {item.item_code && item.item_code !== '-' && (
                            <span>SKU: {item.item_code}</span>
                          )}
                          {item.hsn_code && item.hsn_code !== '-' && (
                            <span className="bg-slate-100 text-slate-600 px-1 rounded">
                              HSN: {item.hsn_code}
                            </span>
                          )}
                          {taxRate > 0 && (
                            <span className="text-emerald-700 font-medium">
                              GST {taxRate}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 text-right font-medium text-slate-700">
                        {formatNumber(qty)} <span className="text-[10px] text-slate-400">{item.unit || ''}</span>
                      </div>
                      <div className="col-span-2 text-right text-slate-600 font-medium">
                        {formatCurrency(rate, currency)}
                      </div>
                      <div className="col-span-3 text-right font-bold text-slate-900">
                        {formatCurrency(lineTotal, currency)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  No line items found.
                </div>
              )}

              {/* Table Footer */}
              <div className="bg-slate-50 p-3 grid grid-cols-12 gap-2 items-center text-xs font-bold text-slate-900 border-t border-slate-200">
                <div className="col-span-5 uppercase tracking-wider text-[11px] text-slate-600">
                  Total
                </div>
                <div className="col-span-2 text-right text-slate-800">
                  {formatNumber((proc.items || []).reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0))}
                </div>
                <div className="col-span-2 text-right text-slate-400">—</div>
                <div className="col-span-3 text-right text-slate-900">
                  {formatCurrency(proc.total_amount, currency)}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Payments History Log Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Payment History & Installments ({(proc.payments_history || []).length})
                </h4>
              </div>
              {Number(proc.amount_due || 0) > 0 && onPayVendor && (
                <button
                  type="button"
                  onClick={() => onPayVendor(proc)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  + Add Payment
                </button>
              )}
            </div>

            {(proc.payments_history && proc.payments_history.length > 0) ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-xs">
                <div className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2">
                  <div className="col-span-3">DATE</div>
                  <div className="col-span-3">REF / MODE</div>
                  <div className="col-span-3">NOTES / RECORDED BY</div>
                  <div className="col-span-3 text-right">AMOUNT</div>
                </div>
                {proc.payments_history.map((pmt: any, idx: number) => (
                  <div key={pmt.id || idx} className="p-3 grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-3 font-medium text-slate-800">
                      {formatDate(pmt.date || pmt.created_at)}
                    </div>
                    <div className="col-span-3">
                      <span className="font-mono font-semibold text-slate-700 block">
                        {pmt.reference_number || 'Direct Payment'}
                      </span>
                      {pmt.payment_mode && (
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {pmt.payment_mode}
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-slate-600 truncate">
                      <span>{pmt.notes || '—'}</span>
                      {pmt.recorded_by_name && (
                        <span className="block text-[10px] text-slate-400">
                          by {pmt.recorded_by_name}
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-right font-bold text-emerald-700">
                      {formatCurrency(pmt.amount, currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-2">
                <p>No payments recorded for this procurement yet.</p>
                {onPayVendor && (
                  <Button
                    variant="secondary"
                    onClick={() => onPayVendor(proc)}
                    className="text-xs py-1.5 px-3"
                  >
                    Record First Payment
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 6. Dispatch & Tracking Info (if applicable) */}
          {(proc.dispatch_tracking_ref || proc.dispatch_date || proc.received_date || proc.vendor_notes || proc.notes) && (
            <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Logistics & Shipment Details
                  </h4>
                </div>
                {carrierName && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px] tracking-wide uppercase shadow-2xs">
                    {carrierName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {proc.dispatch_tracking_ref && (
                  <div className="p-3 bg-white rounded-xl border border-blue-200/70 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
                      Tracking / Docket Ref #
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-blue-950 select-all">
                        {proc.dispatch_tracking_ref}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(proc.dispatch_tracking_ref);
                          toast(`Copied tracking ref: ${proc.dispatch_tracking_ref}`, 'success');
                        }}
                        className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-700 cursor-pointer transition"
                        title="Copy Tracking #"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                )}
                {carrierName && (
                  <div className="p-3 bg-white rounded-xl border border-blue-200/70 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
                      Transporter / Logistics
                    </span>
                    <span className="font-bold text-xs text-slate-900 block">{carrierName}</span>
                    {vehicleNumber && (
                      <span className="font-mono text-[11px] text-slate-500 block mt-0.5">Vehicle: {vehicleNumber}</span>
                    )}
                  </div>
                )}
                {proc.dispatch_date && (
                  <div className="p-3 bg-white rounded-xl border border-blue-200/70 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
                      Dispatched On
                    </span>
                    <span className="font-semibold text-xs text-slate-800">{formatDate(proc.dispatch_date)}</span>
                  </div>
                )}
                {proc.received_date && (
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 block text-[10px] font-bold uppercase tracking-wider mb-1">
                      Delivered / Received On
                    </span>
                    <span className="font-semibold text-xs text-emerald-800">{formatDate(proc.received_date)}</span>
                  </div>
                )}
              </div>

              {proc.vendor_notes && (
                <div className="p-3 bg-white border border-amber-200 rounded-xl text-amber-950 shadow-2xs">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 block mb-1">
                    Vendor Remarks / Dispatch Notes:
                  </span>
                  <p className="text-xs text-slate-700 whitespace-pre-line">{proc.vendor_notes}</p>
                </div>
              )}

              {proc.notes && (
                <div className="pt-1 text-slate-600">
                  <span className="text-slate-400 block text-[11px]">Internal Notes:</span>
                  <p className="font-medium text-slate-700">{proc.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* 7. Activity Timeline */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Order Timeline & Milestones
            </h4>
            <div className="space-y-2">
              {(proc.timeline || []).length > 0 ? (
                proc.timeline.map((item: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-start gap-3 shadow-xs"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      item.kind === 'payment'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.kind === 'received'
                        ? 'bg-blue-100 text-blue-700'
                        : item.kind === 'dispatch'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.kind === 'payment' ? (
                        <DollarSign className="w-3.5 h-3.5" />
                      ) : item.kind === 'received' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : item.kind === 'dispatch' ? (
                        <Truck className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.title}</span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatDate(item.date)}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-slate-600 text-[11px] mt-0.5">{item.notes}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No activity timeline recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 italic text-sm">
          Procurement details could not be found.
        </div>
      )}
    </Drawer>
  );
}
