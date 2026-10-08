import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ReceiptText, Plus, Trash2, RotateCcw, PackageCheck, CheckCircle2, Truck, Copy } from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace, useConfirm } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, dateIso, formatDate, csvDownload, cleanNumericString, handleNumericKeyDown, parseSafeNumber } from '../lib/utils';
import type { AnyRow, TableColumn } from '../lib/types';
import { useOptions } from '../hooks/useOptions';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';
import { ProcurementDetailDrawer } from '../components/ProcurementDetailDrawer';

const PROCUREMENT_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'procurement_number', label: 'Procurement #', category: 'Identifiers' },
  { key: 'date', label: 'Order Date', category: 'Identifiers' },
  { key: 'status', label: 'Status', category: 'Identifiers' },
  { key: 'location_name', label: 'Warehouse / Location', category: 'Identifiers' },
  { key: 'vendor_name', label: 'Vendor Name', category: 'Vendor Info' },
  { key: 'vendor_code', label: 'Vendor Code', category: 'Vendor Info' },
  { key: 'vendor_gstin', label: 'Vendor GSTIN', category: 'Vendor Info' },
  { key: 'item_names', label: 'Purchased Items', category: 'Item Details' },
  { key: 'item_count', label: 'Item Count', category: 'Item Details' },
  { key: 'total_item_quantity', label: 'Total Quantity', category: 'Item Details' },
  { key: 'subtotal', label: 'Subtotal (Taxable)', category: 'Financials' },
  { key: 'tax_amount', label: 'GST Tax Amount', category: 'Financials' },
  { key: 'discount_amount', label: 'Discount Amount', category: 'Financials' },
  { key: 'total_amount', label: 'Grand Total', category: 'Financials' },
  { key: 'amount_paid', label: 'Amount Paid', category: 'Financials' },
  { key: 'amount_due', label: 'Balance Due', category: 'Financials' },
  { key: 'payment_status', label: 'Payment Status', category: 'Financials' },
  { key: 'dispatch_tracking_ref', label: 'Tracking Ref', category: 'Logistics' },
  { key: 'dispatch_date', label: 'Dispatch Date', category: 'Logistics' },
  { key: 'received_date', label: 'Received Date', category: 'Logistics' },
  { key: 'notes', label: 'Internal Notes', category: 'Notes' },
  { key: 'vendor_notes', label: 'Vendor Remarks', category: 'Notes' }
];

function VendorPaymentModal({
  procurement,
  onClose,
  onSaved
}: {
  procurement: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [currentProc, setCurrentProc] = useState<any>(procurement);
  const [loading, setLoading] = useState(true);

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(dateIso());
  const [payNotes, setPayNotes] = useState('');

  const loadHistory = async () => {
    try {
      const res = await api.get(`/api/procurements/${procurement.id}/payments`);
      setPayments(res.data.payments || []);
      if (res.data.procurement) {
        setCurrentProc(res.data.procurement);
        if (Number(res.data.procurement.amount_due) > 0) {
          setPayAmount(String(res.data.procurement.amount_due));
        } else {
          setPayAmount('');
        }
      }
    } catch (err) {
      console.error('Failed to load vendor payment history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [procurement.id]);

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    const amountVal = Number(payAmount);
    if (!payAmount || amountVal <= 0) return toast('Please enter a valid payment amount', 'error');

    const dueVal = Number(currentProc.amount_due || 0);
    if (amountVal > dueVal + 0.01) {
      return toast(`Payment amount cannot exceed the remaining due balance of ${formatCurrency(dueVal, workspace?.currency)}`, 'error');
    }

    try {
      await api.post(`/api/procurements/${procurement.id}/payments`, {
        amount: Number(payAmount),
        date: payDate,
        notes: payNotes
      });
      toast('Vendor payment recorded successfully');
      setPayNotes('');
      await loadHistory();
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to record vendor payment', 'error');
    }
  };

  const formInputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs";

  return (
    <Modal title={`Vendor Payment Log & History - ${currentProc.procurement_number || 'Procurement'}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Top Financial Summary */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Vendor:</span> <strong className="text-slate-900 font-bold">{currentProc.vendor_name || 'Walk-in Vendor'}</strong>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Bill Amount:</span> <strong className="text-slate-900">{formatCurrency(currentProc.total_amount, workspace?.currency)}</strong>
          </div>
          {Number(currentProc.returned_amount || 0) > 0 && (
            <>
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Returned Goods Value (Debit Note):</span> <strong>-{formatCurrency(currentProc.returned_amount, workspace?.currency)}</strong>
              </div>
              <div className="flex justify-between text-blue-900 font-bold">
                <span>Net Payable for Kept Goods:</span> <strong>{formatCurrency(currentProc.net_total || (Number(currentProc.total_amount) - Number(currentProc.returned_amount)), workspace?.currency)}</strong>
              </div>
            </>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Amount Paid So Far:</span> <strong className="text-emerald-700 font-bold">{formatCurrency(currentProc.amount_paid, workspace?.currency)}</strong>
          </div>
          {Number(currentProc.amount_to_return || 0) > 0 ? (
            <div className="flex justify-between text-purple-700 font-bold border-t border-purple-200 pt-1.5 bg-purple-50 p-2 rounded-lg">
              <span>Amount to be Returned by Vendor (Refund Due):</span> <strong className="text-purple-800 font-bold text-sm">{formatCurrency(currentProc.amount_to_return, workspace?.currency)}</strong>
            </div>
          ) : (
            <div className="flex justify-between text-slate-700 font-bold border-t border-slate-200 pt-1.5">
              <span>Current Amount Due (Kept Goods):</span> <strong className="text-red-600 font-bold">{formatCurrency(currentProc.amount_due, workspace?.currency)}</strong>
            </div>
          )}
        </div>

        {Number(currentProc.amount_to_return || 0) > 0 && (
          <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-purple-800">
              <RotateCcw size={14} /> Overpayment / Refund Due:
            </span>
            <p>
              You have paid {formatCurrency(currentProc.amount_paid, workspace?.currency)}, but after accepted returns ({formatCurrency(currentProc.returned_amount, workspace?.currency)}), the net cost of kept materials is {formatCurrency(currentProc.net_total || (Number(currentProc.total_amount) - Number(currentProc.returned_amount)), workspace?.currency)}. The vendor owes you a refund of <strong>{formatCurrency(currentProc.amount_to_return, workspace?.currency)}</strong>. No additional payment is required.
            </p>
          </div>
        )}

        {/* Payment History Log Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
            <span>Vendor Payment History ({payments.length})</span>
            <span className="text-slate-500 font-normal lowercase text-[11px]">Installment Receipts</span>
          </h4>

          {loading ? (
            <div className="h-24 bg-slate-100 animate-pulse rounded-xl" />
          ) : payments.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2">
                <div className="col-span-1">#</div>
                <div className="col-span-3">DATE</div>
                <div className="col-span-3 text-right">AMOUNT PAID</div>
                <div className="col-span-5">NOTES / REF</div>
              </div>
              {payments.map((p, idx) => (
                <div key={p.id || idx} className="p-3 grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-1 font-mono text-slate-400">#{idx + 1}</div>
                  <div className="col-span-3 text-slate-700 font-medium">{formatDate(p.date || p.created_at)}</div>
                  <div className="col-span-3 text-right font-bold text-emerald-700">{formatCurrency(p.amount, workspace?.currency)}</div>
                  <div className="col-span-5 text-slate-600 text-[11px] truncate">{p.notes || 'Vendor payment'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs italic">
              No previous payment installments recorded yet for this vendor.
            </div>
          )}
        </div>

        {/* Record Next Vendor Payment / EMI Form */}
        {Number(currentProc.amount_due || 0) > 0 ? (
          <form onSubmit={submitPayment} className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Record Next Vendor Payment Installment</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Payment Amount Paid *">
                <input
                  className={`${formInputCls} font-mono`}
                  type="number"
                  step="any"
                  min="0.01"
                  max={currentProc.amount_due}
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                  onChange={(e) => setPayAmount(cleanNumericString(e.target.value))}
                />
              </Field>
              <Field label="Payment Date">
                <DatePicker value={payDate} onChange={setPayDate} />
              </Field>
            </div>

            <Field label="Payment Notes / Reference">
              <input className={formInputCls} placeholder="Bank Ref #, Cheque #, NEFT/RTGS..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
              <Button type="submit" icon={<Plus size={15} />}>Record Vendor Payment</Button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800">
            ✓ Payment for kept goods is complete! No balance due.
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ProcurementPage() {
  const { workspace } = useWorkspace();
  const { canView, canCreate, canEdit, canDelete, canApprove, canExport } = usePermissions('procurement');
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = usePersistentTab<'procurement' | 'debit_notes'>('procurement_tab', 'procurement', 'tab');
  const [refresh, setRefresh] = useState(0);
  const vendors = useOptions('/api/vendors?status=Active', refresh) as any[];
  const allVendors = useOptions('/api/vendors', refresh) as any[];
  const [detail, setDetail] = useState<string | null>(null);
  const [paymentProcurement, setPaymentProcurement] = useState<any | null>(null);
  const [exportModalData, setExportModalData] = useState<any | null>(null);

  const [showDnModal, setShowDnModal] = useState(false);
  const [showOwnerReturnModal, setShowOwnerReturnModal] = useState<any | null>(null);

  const [tableLocationFilter, setTableLocationFilter] = useState('');
  const [tableVendorFilter, setTableVendorFilter] = useState('');
  const [tablePaymentFilter, setTablePaymentFilter] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [vendorItems, setVendorItems] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<Array<{ item_id: string; quantity: string; rate_per_unit: string; tax_rate: string }>>([
    { item_id: '', quantity: '1', rate_per_unit: '0', tax_rate: '18' }
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [receiveImmediately, setReceiveImmediately] = useState(true);
  const [procDate, setProcDate] = useState(dateIso());
  const [notes, setNotes] = useState('');

  const locations = useOptions('/api/locations', refresh) as any[];
  const [locationId, setLocationId] = useState('');
  const defaultLocation = locations.find((l: any) => l.is_default) || locations[0];

  useEffect(() => {
    if (locations?.length && !locationId) {
      const def = locations.find((l: any) => l.is_default) || locations[0];
      if (def) setLocationId(def.id);
    }
  }, [locations, locationId]);

  useEffect(() => {
    const url = vendorId ? `/api/items?vendor_id=${vendorId}` : '/api/items';
    api.get(url).then((res) => {
      setVendorItems(res.data || []);
    }).catch(() => setVendorItems([]));
  }, [vendorId]);

  const addLine = () => {
    setLineItems((prev) => [...prev, { item_id: '', quantity: '1', rate_per_unit: '0', tax_rate: '18' }]);
  };

  const removeLine = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, value: string) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'item_id') {
        const sel = vendorItems.find((vi: any) => String(vi.id) === String(value) || String(vi.item_id) === String(value));
        if (sel) {
          const rate = sel.last_vendor_price || sel.last_purchase_price || sel.default_purchase_price || sel.unit_price;
          if (rate != null) next[idx].rate_per_unit = String(rate);
          if (sel.tax_rate != null) next[idx].tax_rate = String(sel.tax_rate);
        }
      }
      return next;
    });
  };

  const discountRate = Math.min(100, Math.max(0, parseSafeNumber(discountPercent)));

  const grossSubtotal = lineItems.reduce((acc, row) => {
    const q = parseSafeNumber(row.quantity);
    const r = parseSafeNumber(row.rate_per_unit);
    return acc + q * r;
  }, 0);

  const calculatedDiscountAmount = (grossSubtotal * discountRate) / 100;
  const taxableSubtotal = grossSubtotal - calculatedDiscountAmount;

  // Discount is given on MRP (quantity * rate) first, and then GST or Tax is calculated on that discounted MRP:
  const discountFactor = 1 - (discountRate / 100);
  const calculatedTax = lineItems.reduce((acc, row) => {
    const q = parseSafeNumber(row.quantity);
    const r = parseSafeNumber(row.rate_per_unit);
    const t = parseSafeNumber(row.tax_rate);
    const lineDiscountedMRP = (q * r) * discountFactor;
    return acc + (lineDiscountedMRP * t) / 100;
  }, 0);

  const overallTotal = taxableSubtotal + calculatedTax;

  const submitProcurement = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) return toast('Please select a vendor', 'error');

    const validItems = lineItems.filter(l => l.item_id && parseSafeNumber(l.quantity) > 0);
    if (validItems.length === 0) {
      return toast('Procurement must contain at least one valid item with a positive quantity', 'error');
    }

    try {
      const payload = {
        vendor_id: vendorId,
        location_id: locationId || undefined,
        date: procDate,
        items: validItems.map(l => ({
          item_id: l.item_id,
          raw_material_id: l.item_id,
          quantity: parseSafeNumber(l.quantity),
          unit_price: parseSafeNumber(l.rate_per_unit),
          rate_per_unit: parseSafeNumber(l.rate_per_unit),
          tax_rate: parseSafeNumber(l.tax_rate)
        })),
        lines: validItems.map(l => ({
          item_id: l.item_id,
          quantity: parseSafeNumber(l.quantity),
          rate_per_unit: parseSafeNumber(l.rate_per_unit),
          tax_rate: parseSafeNumber(l.tax_rate)
        })),
        discount_amount: Number(calculatedDiscountAmount.toFixed(2)),
        discount_percent: Number(discountRate) || 0,
        amount_paid: parseSafeNumber(amountPaid),
        paid: parseSafeNumber(amountPaid),
        payment_method: 'Cash',
        receive_immediately: receiveImmediately,
        status: receiveImmediately ? 'Received' : 'Sent to Vendor',
        notes
      };

      const res = await api.post('/api/procurements', payload);
      toast(`Procurement ${res.data?.procurement_number || ''} recorded successfully!`, 'success');
      setLineItems([{ item_id: '', quantity: '1', rate_per_unit: '0', tax_rate: '18' }]);
      setDiscountPercent('0');
      setAmountPaid('0');
      setNotes('');
      setRefresh((val) => val + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to record procurement', 'error');
    }
  };

  const handleReturnToVendor = async (row: any) => {
    setShowOwnerReturnModal(row);
  };

  const handleReceiveProcurement = async (row: any) => {
    const isDispatched = row.status === 'Dispatched by Vendor' || row.status === 'Dispatched';

    const userAgreed = await confirm({
      title: 'Confirm Goods Receipt',
      message: isDispatched
        ? `Vendor has dispatched procurement ${row.procurement_number || row.id}${row.dispatch_tracking_ref ? ` (Tracking: ${row.dispatch_tracking_ref})` : ''}. Confirming receipt will automatically add the items into your warehouse inventory and update stock levels.`
        : `Confirm receipt of goods for procurement ${row.procurement_number || row.id}? This will automatically add the items into your warehouse inventory and update stock levels.`,
      tone: 'info',
      confirmText: 'Receive Goods into Stock',
      cancelText: 'Cancel'
    });

    if (!userAgreed) return;

    try {
      const res = await api.post(`/api/procurements/${row.id}/receive`);
      toast(res.data?.message || 'Goods received and inventory ledger updated!', 'success');
      setRefresh((r) => r + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to mark goods as received', 'error');
    }
  };

  const columns: TableColumn<AnyRow>[] = [
    { key: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    {
      key: 'procurement_number',
      label: 'Procurement #',
      render: (row) => <span className="font-mono text-xs font-semibold text-slate-800">{row.procurement_number || (row.id ? String(row.id).slice(0, 8) : 'PROC')}</span>
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.vendor_name || 'Walk-in Vendor'}</div>
          {row.vendor_code ? <div className="text-[10px] text-slate-400 font-mono">Code: {row.vendor_code}</div> : null}
        </div>
      )
    },
    {
      key: 'item_names',
      label: 'Items Procured',
      render: (row) => {
        const count = Number(row.item_count || 0);
        const names = row.item_names || row.items_summary || row.material_name || row.item_name || 'Procurement Item';
        return (
          <span className="text-xs text-slate-700 font-medium truncate max-w-[200px] block" title={names}>
            {count > 1 ? `${count} items (${names})` : names}
          </span>
        );
      }
    },
    { key: 'total_amount', label: 'Total Amount', align: 'right', sortable: true, render: (row) => formatCurrency(row.total_amount, workspace?.currency) },
    {
      key: 'payment_status',
      label: 'Payment Status',
      render: (row) => {
        const status = row.payment_status || (Number(row.amount_due) <= 0 ? 'paid' : Number(row.amount_paid) > 0 ? 'partial' : 'unpaid');
        return <StatusBadge status={status} />;
      }
    },
    {
      key: 'status',
      label: 'Order / Fulfillment Status',
      sortable: true,
      render: (row) => {
        const s = row.status || 'Sent to Vendor';
        let carrierName = '';
        if (row.vendor_notes && typeof row.vendor_notes === 'string' && row.vendor_notes.includes('Carrier:')) {
          const match = row.vendor_notes.match(/Carrier:\s*([^|.]+)/i);
          if (match && match[1]) carrierName = match[1].trim();
        } else if (row.dispatch_tracking_ref) {
          const up = row.dispatch_tracking_ref.toUpperCase();
          if (up.includes('BLUEDART') || up.includes('BLUE DART')) carrierName = 'BlueDart';
          else if (up.includes('DTDC')) carrierName = 'DTDC';
          else if (up.includes('DELHIVERY')) carrierName = 'Delhivery';
          else if (up.includes('VRL')) carrierName = 'VRL';
        }

        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={s} />
            {row.dispatch_tracking_ref && (
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-blue-900 text-[11px] font-mono hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer shadow-2xs group"
                title={`Carrier: ${carrierName || 'Logistics'} | Tracking Ref: ${row.dispatch_tracking_ref}. Click to copy.`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(row.dispatch_tracking_ref);
                  toast(`Copied tracking ref: ${row.dispatch_tracking_ref}`, 'success');
                }}
              >
                <Truck size={11} className="text-blue-600 shrink-0" />
                {carrierName && (
                  <span className="font-sans font-semibold text-[10px] text-blue-700 uppercase tracking-tight">
                    {carrierName}:
                  </span>
                )}
                <span className="font-bold">{row.dispatch_tracking_ref}</span>
                <Copy size={10} className="text-blue-400 group-hover:text-blue-700 shrink-0 ml-0.5" />
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'amount_due',
      label: 'Vendor Dues',
      align: 'right',
      render: (row) => {
        const refundDue = Number(row.amount_to_return || 0);
        const due = Number(row.amount_due ?? (Number(row.total_amount) - Number(row.amount_paid || 0)));
        if (refundDue > 0) {
          return (
            <div className="flex flex-col items-end">
              <span className="font-bold text-rose-700 font-mono text-xs">
                Refund: {formatCurrency(refundDue, workspace?.currency)}
              </span>
              <span className="text-[10px] text-rose-500 font-medium">To be returned</span>
            </div>
          );
        }
        return (
          <span className={`font-semibold ${due > 0 ? 'text-amber-700 font-mono text-xs' : 'text-slate-400 text-xs'}`}>
            {due > 0 ? formatCurrency(due, workspace?.currency) : '—'}
          </span>
        );
      }
    },
    {
      key: 'actions_extra',
      label: 'Actions',
      align: 'right',
      render: (row) => {
        const isReceived = row.status === 'Received';

        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* Show Receive Goods button on any procurement that has not been received yet */}
            {canApprove && !isReceived && row.status !== 'Cancelled' && row.status !== 'Returned' && (
              <button
                type="button"
                onClick={() => handleReceiveProcurement(row)}
                className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-2 ring-blue-400/30 transition cursor-pointer"
                title="Confirm receipt of goods & update inventory stock"
              >
                <PackageCheck size={13} /> Receive Goods
              </button>
            )}

            {/* 2. After workspace admin has received the goods: show Stock Received badge and Return button */}
            {isReceived && (
              <>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 size={12} /> Stock Received
                </span>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => handleReturnToVendor(row)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-xl border border-amber-200 shadow-2xs transition cursor-pointer"
                    title="Return items to vendor & create Debit Note"
                  >
                    <RotateCcw size={13} /> Return
                  </button>
                )}
              </>
            )}

            {/* Pay Vendor button is visible only if user has create or edit permission and there is due balance */}
            {(canCreate || canEdit) && (
              Number(row.amount_due || 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => setPaymentProcurement(row)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 shadow-2xs transition cursor-pointer"
                  title="Record payment for kept goods"
                >
                  ₹ Pay Vendor
                </button>
              ) : Number(row.amount_to_return || 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => setPaymentProcurement(row)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-xl border border-rose-200 shadow-2xs transition cursor-pointer"
                  title="Vendor overpaid: Refund due"
                >
                  <RotateCcw size={12} /> Refund Due
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaymentProcurement(row)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition cursor-pointer"
                  title="View payment logs"
                >
                  Log
                </button>
              )
            )}
          </div>
        );
      }
    }
  ];

  const formInputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs";

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Procurement module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<ReceiptText />}
        title="Procurement"
        subtitle="Manage supplier procurements, vendor payment receipts, and debit note returns."
      />

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${tab !== 'debit_notes' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
          onClick={() => setTab('procurement')}
        >
          <ReceiptText size={16} /> Procurements
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${tab === 'debit_notes' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
          onClick={() => setTab('debit_notes')}
        >
          <RotateCcw size={16} /> Debit Notes
        </button>
      </div>

      {tab !== 'debit_notes' ? (
        <>
          {canCreate && (
          <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Record Multi-Line Procurement</h2>
            <form onSubmit={submitProcurement} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Field label="Step 1: Select Vendor (Required)">
                  <Select
                    value={vendorId}
                    onChange={setVendorId}
                    options={[
                      { value: '', label: '-- Choose Vendor --' },
                      ...vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.vendor_code || 'VEN-N/A'})` }))
                    ]}
                  />
                </Field>
                <Field label="Procurement Location">
                  <Select
                    value={locationId || defaultLocation?.id || ''}
                    onChange={setLocationId}
                    options={locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))}
                  />
                </Field>
                <Field label="Procurement Date">
                  <DatePicker value={procDate} onChange={setProcDate} />
                </Field>
                <Field label="Notes / Reference">
                  <input className={formInputCls} placeholder="Invoice #, Delivery Challan..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 grid grid-cols-12 gap-2">
                  <div className="col-span-5">ITEM MASTER</div>
                  <div className="col-span-2 text-right">QUANTITY</div>
                  <div className="col-span-2 text-right">RATE / UNIT</div>
                  <div className="col-span-2 text-right">TAX %</div>
                  <div className="col-span-1 text-center">ACTION</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {lineItems.map((line, idx) => (
                    <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center bg-slate-50/50">
                      <div className="col-span-5">
                        <Select
                          value={line.item_id}
                          onChange={(val) => updateLine(idx, 'item_id', val)}
                          options={[
                            { value: '', label: '-- Select Item --' },
                            ...vendorItems.map((vi) => ({
                              value: vi.id || vi.item_id,
                              label: `${vi.name || vi.item_name} (${vi.code || vi.item_code || 'SKU'}) ${vi.last_vendor_price ? `- ${formatCurrency(vi.last_vendor_price)}` : ''}`
                            }))
                          ]}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          className={`${formInputCls} text-right font-mono`}
                          required
                          placeholder="0"
                          value={line.quantity}
                          onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                          onChange={(e) => updateLine(idx, 'quantity', cleanNumericString(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className={`${formInputCls} text-right font-mono`}
                          required
                          placeholder="0.00"
                          value={line.rate_per_unit}
                          onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                          onChange={(e) => updateLine(idx, 'rate_per_unit', cleanNumericString(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          className={`${formInputCls} text-right font-mono`}
                          placeholder="0"
                          value={line.tax_rate}
                          onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                          onChange={(e) => updateLine(idx, 'tax_rate', cleanNumericString(e.target.value))}
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-100/70 border-t border-slate-200 flex justify-between items-center">
                  <Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addLine}>Add Another Item Line</Button>
                  <div className="text-right text-xs font-semibold text-slate-700 space-y-1">
                    <div>Gross MRP: <span className="text-slate-900">{formatCurrency(grossSubtotal, workspace?.currency)}</span></div>
                    {discountRate > 0 && (
                      <div className="text-emerald-700 font-medium flex items-center justify-end gap-1">
                        <span>Discount ({discountRate}%):</span>
                        <span className="font-bold font-mono">-{formatCurrency(calculatedDiscountAmount, workspace?.currency)}</span>
                      </div>
                    )}
                    <div>Taxable (Discounted MRP): <span className="text-slate-900">{formatCurrency(taxableSubtotal, workspace?.currency)}</span></div>
                    <div>GST Tax: <span className="text-slate-900">+{formatCurrency(calculatedTax, workspace?.currency)}</span></div>
                    <div className="text-sm font-bold text-blue-700 pt-0.5 border-t border-slate-200/80">
                      <span>Overall Total: </span>
                      <span className="font-mono">{formatCurrency(overallTotal, workspace?.currency)}</span>
                      {discountRate > 0 && (
                        <span className="ml-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                          (Saved {formatCurrency(calculatedDiscountAmount, workspace?.currency)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex justify-between items-center text-[11px] font-semibold tracking-wider uppercase text-slate-600">
                    <span>Discount (%)</span>
                    {discountRate > 0 && (
                      <span className="text-emerald-700 font-bold font-mono normal-case tracking-normal">
                        Saved: -{formatCurrency(calculatedDiscountAmount, workspace?.currency)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      className={`${formInputCls} pr-8 font-mono`}
                      placeholder="0"
                      value={discountPercent}
                      onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                      onChange={(e) => setDiscountPercent(cleanNumericString(e.target.value))}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                      %
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-600">
                    Amount Paid Now
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className={`${formInputCls} font-mono`}
                    placeholder="0.00"
                    inputMode="decimal"
                    value={amountPaid}
                    onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                    onChange={(e) => setAmountPaid(cleanNumericString(e.target.value))}
                  />
                </div>

                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-transparent select-none hidden md:block" aria-hidden="true">
                    Action
                  </span>
                  <Button type="submit" icon={<Check size={16} />} className="w-full h-[38px] shadow-sm">
                    Record Procurement
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={receiveImmediately}
                    onChange={(e) => setReceiveImmediately(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300"
                  />
                  <span>Receive items into warehouse inventory stock immediately upon recording</span>
                </label>
              </div>
            </form>
          </section>
          )}

          <DataTable
            endpoint="/api/procurements"
            columns={columns}
            refreshKey={refresh}
            showDateFilters={true}
            filters={{
              vendor_id: tableVendorFilter || undefined,
              payment_status: tablePaymentFilter || undefined,
              location_id: tableLocationFilter || undefined,
              status: tableStatusFilter || undefined
            }}
            extraFilters={
              <>
                <div className="w-48">
                  <Select
                    value={tableVendorFilter}
                    onChange={setTableVendorFilter}
                    options={[
                      { value: '', label: 'All Vendors' },
                      ...allVendors.map((v) => ({ value: v.id, label: v.name }))
                    ]}
                  />
                </div>
                <div className="w-36">
                  <Select
                    value={tablePaymentFilter}
                    onChange={setTablePaymentFilter}
                    options={[
                      { value: '', label: 'All Payments' },
                      { value: 'paid', label: 'Paid' },
                      { value: 'partial', label: 'Partially Paid' },
                      { value: 'unpaid', label: 'Unpaid' }
                    ]}
                  />
                </div>
                <div className="w-36">
                  <Select
                    value={tableStatusFilter}
                    onChange={setTableStatusFilter}
                    options={[
                      { value: '', label: 'All Statuses' },
                      { value: 'Delivered', label: 'Delivered' },
                      { value: 'Dispatched', label: 'Dispatched' },
                      { value: 'Confirmed', label: 'Confirmed' },
                      { value: 'Draft', label: 'Draft' },
                      { value: 'Denied', label: 'Denied / Rejected' }
                    ]}
                  />
                </div>
                <div className="w-44">
                  <Select
                    value={tableLocationFilter}
                    onChange={setTableLocationFilter}
                    options={[
                      { value: '', label: 'All Locations' },
                      ...locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
                    ]}
                  />
                </div>
              </>
            }
            onView={(row) => setDetail(row.id || null)}
            onDelete={canDelete ? async (row) => { await api.delete(`/api/procurements/${row.id}`); toast('Procurement deleted'); } : undefined}
            onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
            canCreate={canCreate}
            canDelete={canDelete}
            canExport={canExport}
            createLabel="New Procurement"
            emptyTitle="No procurements recorded yet"
          />
        </>
      ) : (
        <DataTable
          endpoint="/api/debit-notes"
          columns={[
            { key: 'created_at', label: 'Date', render: (r) => formatDate(r.created_at || r.date) },
            { key: 'debit_note_number', label: 'Debit Note #', render: (r) => <span className="font-mono text-xs font-semibold text-slate-700">{r.debit_note_number}</span> },
            { key: 'vendor_name', label: 'Vendor', render: (r) => r.vendor_name || 'Direct Return' },
            { key: 'reason', label: 'Reason' },
            { key: 'total_amount', label: 'Total Amount', align: 'right', render: (r) => formatCurrency(r.total_amount, workspace?.currency) }
          ]}
          refreshKey={refresh}
          showDateFilters={true}
          onCreate={canCreate ? () => setShowDnModal(true) : undefined}
          canCreate={canCreate}
          canDelete={canDelete}
          canExport={canExport}
          createLabel="Create Debit Note"
          emptyTitle="No Debit Notes created yet"
        />
      )}

      {detail ? (
        <ProcurementDetailDrawer
          procurementId={detail}
          onClose={() => setDetail(null)}
          onPayVendor={(procRecord) => {
            setPaymentProcurement(procRecord);
          }}
          onRefresh={() => setRefresh((v) => v + 1)}
        />
      ) : null}

      {/* Column-Selective Export Modal for Procurements */}
      {exportModalData && (
        <ExportColumnModal
          title="Export Procurements to CSV"
          recordCount={exportModalData.total}
          availableColumns={PROCUREMENT_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const exportCols: TableColumn<any>[] = PROCUREMENT_EXPORT_COLUMNS
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));
            const formattedRecords = records.map((r: any) => {
              const amtDue = Number(r.amount_due || 0);
              const amtPaid = Number(r.amount_paid || 0);
              const payStatus = amtDue <= 0 ? 'Paid' : amtPaid > 0 ? 'Partially Paid' : 'Unpaid';
              return {
                ...r,
                payment_status: payStatus,
                date: r.date ? formatDate(r.date) : '',
                dispatch_date: r.dispatch_date ? formatDate(r.dispatch_date) : '',
                received_date: r.received_date ? formatDate(r.received_date) : '',
                total_amount: r.total_amount ?? 0,
                amount_paid: amtPaid,
                amount_due: amtDue
              };
            });
            csvDownload(
              `procurements_export_${new Date().toISOString().slice(0, 10)}.csv`,
              formattedRecords,
              exportCols
            );
            toast(`Exported ${records.length} procurements with ${exportCols.length} columns!`, 'success');
          }}
        />
      )}

      {paymentProcurement ? (
        <VendorPaymentModal
          procurement={paymentProcurement}
          onClose={() => setPaymentProcurement(null)}
          onSaved={() => setRefresh((v) => v + 1)}
        />
      ) : null}
      {showDnModal ? <CreateDebitNoteModal onClose={() => setShowDnModal(false)} onSaved={() => { setRefresh((v) => v + 1); setShowDnModal(false); }} /> : null}
      {showOwnerReturnModal && (
        <OwnerReturnModal
          procurement={showOwnerReturnModal}
          onClose={() => setShowOwnerReturnModal(null)}
          onSaved={() => {
            setRefresh((v) => v + 1);
            setShowOwnerReturnModal(null);
          }}
        />
      )}
    </div>
  );
}

function OwnerReturnModal({
  procurement,
  onClose,
  onSaved
}: {
  procurement: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState(`Defective / Substandard material return from procurement dated ${formatDate(procurement.date)}`);
  const [returnItems, setReturnItems] = useState<Array<{
    item_id: string;
    item_name: string;
    item_code?: string;
    unit: string;
    received_quantity: number;
    return_quantity: number;
    rate_per_unit: number;
    selected: boolean;
  }>>([]);

  useEffect(() => {
    let mounted = true;
    api.get(`/api/procurements/${procurement.id}`)
      .then((res) => {
        if (!mounted) return;
        const proc = res.data;
        const rawItems = proc.items || [];
        if (rawItems.length > 0) {
          setReturnItems(
            rawItems.map((it: any) => ({
              item_id: it.item_id || it.raw_material_id || it.id,
              item_name: it.item_name || 'Item',
              item_code: it.item_code || '',
              unit: it.unit || 'units',
              received_quantity: Number(it.quantity || 0),
              return_quantity: Number(it.quantity || 0),
              rate_per_unit: Number(it.rate_per_unit || 0),
              selected: true
            }))
          );
        } else {
          setReturnItems([
            {
              item_id: proc.raw_material_id || proc.id,
              item_name: proc.material_name || proc.item_name || 'Procured Material',
              unit: 'units',
              received_quantity: Number(proc.quantity || 1),
              return_quantity: Number(proc.quantity || 1),
              rate_per_unit: Number(proc.rate_per_unit || 0),
              selected: true
            }
          ]);
        }
      })
      .catch(() => {
        toast('Failed to load procurement items for return', 'error');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [procurement.id]);

  const toggleSelect = (idx: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateQuantity = (idx: number, qtyStr: string) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const num = Number(qtyStr);
        return {
          ...item,
          return_quantity: isNaN(num) ? 0 : Math.min(item.received_quantity, Math.max(0, num))
        };
      })
    );
  };

  const selectedItems = returnItems.filter((it) => it.selected && it.return_quantity > 0);
  const totalReturnValue = selectedItems.reduce(
    (acc, it) => acc + it.return_quantity * it.rate_per_unit,
    0
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return toast('Please enter a return reason', 'error');
    if (selectedItems.length === 0)
      return toast('Please select at least one item with a valid return quantity', 'error');

    setSubmitting(true);
    try {
      await api.post('/api/return-requests', {
        reference_id: procurement.id,
        reference_type: 'procurement',
        request_type: 'purchase_return',
        reason: reason.trim(),
        vendor_id: procurement.vendor_id,
        items: selectedItems.map((it) => ({
          item_id: it.item_id,
          item_name: it.item_name,
          quantity: it.return_quantity,
          rate_per_unit: it.rate_per_unit,
          line_total: it.return_quantity * it.rate_per_unit
        }))
      });
      toast(
        'Purchase Return Request submitted! Once approved by staff or vendor, raw material inventory will be reduced & debit note issued.',
        'success'
      );
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to submit return request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs';

  return (
    <Modal
      title={`Initiate Return: ${procurement.procurement_number || procurement.id}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Vendor:</span>{' '}
            <strong className="text-slate-900 font-bold">{procurement.vendor_name || 'Vendor'}</strong>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Order Date:</span>{' '}
            <strong className="text-slate-800">{formatDate(procurement.date)}</strong>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Original Total:</span>{' '}
            <strong className="text-slate-900">
              {formatCurrency(procurement.total_amount, workspace?.currency)}
            </strong>
          </div>
        </div>

        <Field label="Reason for Returning to Vendor *">
          <textarea
            required
            rows={2}
            className={inputCls}
            placeholder="Explain reason for return (e.g. damaged goods, defective quality, wrong spec)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Select Items & Return Quantities
            </span>
            <span className="text-xs font-semibold text-rose-700">
              Return Value: {formatCurrency(totalReturnValue, workspace?.currency)}
            </span>
          </div>

          {loading ? (
            <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ) : returnItems.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1 text-center">✓</div>
                <div className="col-span-5">MATERIAL / ITEM</div>
                <div className="col-span-2 text-right">RCVD QTY</div>
                <div className="col-span-2 text-right">RETURN QTY</div>
                <div className="col-span-2 text-right">RETURN AMT</div>
              </div>

              {returnItems.map((item, idx) => {
                const lineTotal = (item.return_quantity || 0) * (item.rate_per_unit || 0);
                return (
                  <div
                    key={item.item_id || idx}
                    className={`p-2.5 grid grid-cols-12 gap-2 items-center text-xs transition ${
                      item.selected ? 'bg-white' : 'bg-slate-50/70 opacity-60'
                    }`}
                  >
                    <div className="col-span-1 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelect(idx)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                      />
                    </div>
                    <div className="col-span-5">
                      <strong className="text-slate-900 block truncate">{item.item_name}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Rate: {formatCurrency(item.rate_per_unit, workspace?.currency)}/{item.unit}
                      </span>
                    </div>
                    <div className="col-span-2 text-right font-medium text-slate-600">
                      {item.received_quantity} {item.unit}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={item.received_quantity}
                        disabled={!item.selected}
                        value={item.return_quantity}
                        onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                        onChange={(e) => updateQuantity(idx, cleanNumericString(e.target.value))}
                        className="w-full text-right font-bold text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-600 disabled:bg-slate-100 font-mono"
                      />
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold text-slate-800">
                      {formatCurrency(lineTotal, workspace?.currency)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center bg-slate-50 rounded-xl text-slate-500 text-xs italic">
              No items found in this procurement.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            icon={<RotateCcw size={14} />}
            disabled={submitting || selectedItems.length === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Return Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}



function CreateDebitNoteModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const vendors = useOptions('/api/vendors?status=Active') as any[];
  const [items, setItems] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [reason, setReason] = useState('Defective Goods Return');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ item_id: string; quantity: string; rate_per_unit: string }>>([
    { item_id: '', quantity: '1', rate_per_unit: '0' }
  ]);

  useEffect(() => {
    api.get('/api/items').then((res) => setItems(res.data || [])).catch(() => setItems([]));
  }, []);

  const addLine = () => {
    setLineItems([...lineItems, { item_id: '', quantity: '1', rate_per_unit: '0' }]);
  };

  const removeLine = (idx: number) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, value: string) => {
    const next = [...lineItems];
    (next[idx] as any)[field] = value;
    if (field === 'item_id' && value) {
      const match = items.find((i) => i.id === value);
      if (match && match.last_purchase_price) {
        next[idx].rate_per_unit = String(match.last_purchase_price);
      }
    }
    setLineItems(next);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) return toast('Please select a vendor', 'error');
    const validLines = lineItems.filter((l) => l.item_id && Number(l.quantity) > 0);
    if (validLines.length === 0) return toast('Please select at least one item with a valid quantity', 'error');

    const calculatedTotal = validLines.reduce((sum, line) => {
      return sum + (Number(line.quantity) || 0) * (Number(line.rate_per_unit) || 0);
    }, 0);

    try {
      await api.post('/api/debit-notes', {
        vendor_id: vendorId,
        reason,
        notes,
        total_amount: calculatedTotal,
        items: validLines.map((l) => ({
          item_id: l.item_id,
          quantity: Number(l.quantity) || 0,
          rate_per_unit: Number(l.rate_per_unit) || 0
        }))
      });
      toast('Debit Note created successfully');
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create Debit Note', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs";

  return (
    <Modal title="Create Debit Note (Vendor Return / Adjustment)" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Vendor / Supplier">
            <Select
              value={vendorId}
              onChange={setVendorId}
              options={[
                { value: '', label: '-- Optional / Walk-in --' },
                ...vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.vendor_code || 'VEN-N/A'})` }))
              ]}
            />
          </Field>
          <Field label="Reason for Debit Note">
            <Select
              value={reason}
              onChange={setReason}
              options={[
                { value: 'Defective Goods Return', label: 'Defective Goods Return' },
                { value: 'Short Shipment / Missing Quantity', label: 'Short Shipment / Missing Quantity' },
                { value: 'Rate Difference / Overcharged', label: 'Rate Difference / Overcharged' },
                { value: 'Discount / Rebate Received', label: 'Discount / Rebate Received' },
                { value: 'Other Adjustment', label: 'Other Adjustment' }
              ]}
            />
          </Field>
        </div>
        <Field label="Notes / Reference">
          <input className={inputCls} placeholder="Reference invoice or reason details..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2 grid grid-cols-12 gap-2">
            <div className="col-span-6">ITEM RETURNED</div>
            <div className="col-span-3 text-right">RETURN QTY</div>
            <div className="col-span-2 text-right">RATE / UNIT</div>
            <div className="col-span-1 text-center"></div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto">
            {lineItems.map((line, idx) => (
              <div key={idx} className="p-2 grid grid-cols-12 gap-2 items-center bg-slate-50/50">
                <div className="col-span-6">
                  <Select
                    value={line.item_id}
                    onChange={(val) => updateLine(idx, 'item_id', val)}
                    options={[
                      { value: '', label: '-- Select Item --' },
                      ...items.map((i) => ({ value: i.id, label: `${i.name} (${i.code || 'SKU-N/A'})` }))
                    ]}
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    className={`${inputCls} text-right font-mono`}
                    required
                    placeholder="0"
                    value={line.quantity}
                    onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                    onChange={(e) => updateLine(idx, 'quantity', cleanNumericString(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className={`${inputCls} text-right font-mono`}
                    required
                    placeholder="0.00"
                    value={line.rate_per_unit}
                    onKeyDown={(e) => handleNumericKeyDown(e, true, false)}
                    onChange={(e) => updateLine(idx, 'rate_per_unit', cleanNumericString(e.target.value))}
                  />
                </div>
                <div className="col-span-1 text-center">
                  <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
            <Button type="button" variant="secondary" icon={<Plus size={14} />} onClick={addLine}>Add Return Item</Button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button type="submit" icon={<Check size={16} />}>Create Debit Note</Button>
        </div>
      </form>
    </Modal>
  );
}
