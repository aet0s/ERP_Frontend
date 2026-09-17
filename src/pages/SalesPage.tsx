import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Plus, ShoppingCart, Download, FileText, Trash2, RotateCcw, Search, AlertTriangle, ShieldCheck, PackageCheck, PackageX, MapPin, Truck, Copy, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, formatNumber, dateIso, formatDate, csvDownload } from '../lib/utils';
import type { AnyRow, TableColumn } from '../lib/types';
import { useOptions } from '../hooks/useOptions';
import { DataTable } from '../components/DataTable';
import { SalesDetailDrawer } from '../components/SalesDetailDrawer';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DatePicker } from '../components/ui/DatePicker';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { usePersistentTab } from '../hooks/usePersistentTab';

function CustomerPaymentModal({
  sale,
  onClose,
  onSaved
}: {
  sale: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [currentSale, setCurrentSale] = useState<any>(sale);
  const [loading, setLoading] = useState(true);

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(dateIso());
  const [payNotes, setPayNotes] = useState('');

  const loadHistory = async () => {
    try {
      const res = await api.get(`/api/invoices/${sale.id}/payments`);
      setPayments(res.data.payments || []);
      if (res.data.sale) {
        setCurrentSale(res.data.sale);
        if (Number(res.data.sale.amount_due) > 0) {
          setPayAmount(String(res.data.sale.amount_due));
        } else {
          setPayAmount('');
        }
      }
    } catch (err) {
      console.error('Failed to load payments history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [sale.id]);

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    const amountVal = Number(payAmount);
    if (!payAmount || amountVal <= 0) return toast('Please enter a valid payment amount', 'error');

    const dueVal = Number(currentSale.amount_due || 0);
    if (amountVal > dueVal + 0.01) {
      return toast(`Payment amount cannot exceed the remaining due balance of ${formatCurrency(dueVal, workspace?.currency)}`, 'error');
    }

    try {
      await api.post(`/api/invoices/${sale.id}/payments`, {
        amount: Number(payAmount),
        date: payDate,
        notes: payNotes
      });
      toast('Payment installment recorded successfully');
      setPayNotes('');
      await loadHistory();
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to record payment', 'error');
    }
  };

  const formInputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs";

  return (
    <Modal title={`Payment Details & History - ${currentSale.invoice_number || 'Invoice'}`} onClose={onClose}>
      <div className="space-y-5">
        {/* Top Financial Summary */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Customer / Buyer:</span> <strong className="text-slate-900 font-bold">{currentSale.customer_name || 'Walk-in Customer'}</strong>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Bill Amount:</span> <strong className="text-slate-900">{formatCurrency(currentSale.total_amount, workspace?.currency)}</strong>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Amount Received So Far:</span> <strong className="text-emerald-700 font-bold">{formatCurrency(currentSale.amount_received, workspace?.currency)}</strong>
          </div>
          <div className="flex justify-between text-slate-700 font-bold border-t border-slate-200 pt-1.5">
            <span>Current Amount Due:</span> <strong className="text-red-600 font-bold">{formatCurrency(currentSale.amount_due, workspace?.currency)}</strong>
          </div>
        </div>

        {/* Installment History Log Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
            <span>Payment History & EMIs ({payments.length})</span>
            <span className="text-slate-500 font-normal lowercase text-[11px]">Installment Receipts</span>
          </h4>

          {loading ? (
            <div className="h-24 bg-slate-100 animate-pulse rounded-xl" />
          ) : payments.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              <div className="bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 grid grid-cols-12 gap-2">
                <div className="col-span-1">#</div>
                <div className="col-span-3">DATE</div>
                <div className="col-span-3 text-right">AMOUNT</div>
                <div className="col-span-5">NOTES / REF</div>
              </div>
              {payments.map((p, idx) => (
                <div key={p.id || idx} className="p-3 grid grid-cols-12 gap-2 items-center text-xs">
                  <div className="col-span-1 font-mono text-slate-400">#{idx + 1}</div>
                  <div className="col-span-3 text-slate-700 font-medium">{formatDate(p.date || p.created_at)}</div>
                  <div className="col-span-3 text-right font-bold text-emerald-700">{formatCurrency(p.amount, workspace?.currency)}</div>
                  <div className="col-span-5 text-slate-600 text-[11px] truncate">{p.notes || 'Payment receipt'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs italic">
              No previous payment installments recorded yet for this buyer.
            </div>
          )}
        </div>

        {/* Record Next Payment / EMI Form */}
        {Number(currentSale.amount_due || 0) > 0 ? (
          <form onSubmit={submitPayment} className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Record Next Payment / EMI Installment</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Payment Amount Received *">
                <input className={formInputCls} type="number" step="any" min="0.01" max={currentSale.amount_due} required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </Field>
              <Field label="Payment Date">
                <DatePicker value={payDate} onChange={setPayDate} />
              </Field>
            </div>

            <Field label="Payment Notes / Reference">
              <input className={formInputCls} placeholder="UPI Ref #, Cheque #, GPay, Bank Transfer..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
              <Button type="submit" icon={<Plus size={15} />}>Record Installment Payment</Button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800">
            ✓ Invoice is fully paid! No balance due.
          </div>
        )}
      </div>
    </Modal>
  );
}

function DispatchSalesModal({
  sale,
  onClose,
  onDispatched
}: {
  sale: any;
  onClose: () => void;
  onDispatched: () => void;
}) {
  const toast = useToast();
  const [transporterName, setTransporterName] = useState('BlueDart Logistics');
  const [trackingRef, setTrackingRef] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState(dateIso());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitDispatch = async (e: FormEvent) => {
    e.preventDefault();
    const effectiveTrk = trackingRef.trim() || transporterName;
    try {
      setSubmitting(true);
      const res = await api.post(`/api/invoices/${sale.id}/dispatch`, {
        transporter_name: transporterName,
        tracking_ref: effectiveTrk,
        vehicle_number: vehicleNumber.trim(),
        dispatch_date: dispatchDate,
        notes: notes.trim()
      });
      toast(res.data?.message || 'Order dispatched successfully!', 'success');
      onDispatched();
      onClose();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to dispatch order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formInputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs";

  return (
    <Modal title={`Dispatch Order Shipment - ${sale.invoice_number || 'Order'}`} onClose={onClose}>
      <form onSubmit={submitDispatch} className="space-y-4">
        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-950">
            <Truck size={14} className="text-blue-600" /> Dispatch Fulfillment
          </div>
          <div>
            Dispatching order <strong className="font-mono text-blue-900">{sale.invoice_number}</strong> for <strong>{sale.customer_name || 'Customer'}</strong>. Carrier tracking details will be visible on the customer portal, and inventory stock will be reserved/deducted from warehouse.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Transporter / Logistics Carrier *">
            <Select
              value={transporterName}
              onChange={setTransporterName}
              options={[
                { value: 'BlueDart Logistics', label: 'BlueDart Logistics' },
                { value: 'DTDC Express', label: 'DTDC Express' },
                { value: 'Delhivery', label: 'Delhivery' },
                { value: 'VRL Logistics', label: 'VRL Logistics' },
                { value: 'SafeXpress', label: 'SafeXpress' },
                { value: 'Trackon Couriers', label: 'Trackon Couriers' },
                { value: 'In-House Fleet / Delivery Van', label: 'In-House Fleet / Delivery Van' },
                { value: 'Local Courier / Direct Handover', label: 'Local Courier / Direct Handover' }
              ]}
            />
          </Field>

          <Field label="Tracking / Docket Reference # *">
            <input
              className={formInputCls}
              required
              placeholder="e.g. BD-8829104"
              value={trackingRef}
              onChange={(e) => setTrackingRef(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Dispatch Date">
            <DatePicker value={dispatchDate} onChange={setDispatchDate} />
          </Field>

          <Field label="Vehicle Number (Optional)">
            <input
              className={formInputCls}
              placeholder="e.g. DL-01-AB-1234"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Driver Instructions & Delivery Notes">
          <input
            className={formInputCls}
            placeholder="Driver contact info, expected ETA, packaging notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting} icon={<Truck size={15} />}>
            {submitting ? 'Dispatching...' : 'Confirm & Dispatch Shipment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Credit Note Creation Modal ───────────────────────────────────────────────
function CreditNoteModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const customers = useOptions('/api/customers') as any[];
  const sales = useOptions('/api/invoices') as any[];

  const [customerId, setCustId] = useState('');
  const [saleId, setSaleId] = useState('');
  const [reason, setReason] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [noteDate, setNoteDate] = useState(dateIso());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs";
  const errCls = "text-xs text-red-600 mt-1";

  const filteredSales = customerId
    ? sales.filter((s: any) => s.customer_id === customerId)
    : sales;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerId) e.customerId = 'Please select a customer';
    if (!reason.trim()) e.reason = 'Reason is required';
    const amt = Number(totalAmount);
    if (!totalAmount || isNaN(amt) || amt <= 0) e.totalAmount = 'Enter a valid amount greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      await api.post('/api/invoices/credit-notes', {
        customer_id: customerId,
        sale_id: saleId || null,
        reason: reason.trim(),
        total_amount: Number(totalAmount),
        date: noteDate,
        notes: notes.trim() || null
      });
      toast('Credit Note created successfully');
      onSaved();
      onClose();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to create credit note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Create Credit Note" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Customer *">
            <select
              id="cn-customer"
              className={`${formCls} ${errors.customerId ? 'border-red-400' : ''}`}
              value={customerId}
              onChange={(e) => { setCustId(e.target.value); setSaleId(''); }}
            >
              <option value="">— Select Customer —</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.customerId && <p className={errCls}>{errors.customerId}</p>}
          </Field>

          <Field label="Against Invoice (optional)">
            <select
              id="cn-sale"
              className={formCls}
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
            >
              <option value="">— Not linked to an invoice —</option>
              {filteredSales.map((s: any) => (
                <option key={s.id} value={s.id}>{s.invoice_number} — {s.customer_name || 'Customer'}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Reason for Credit Note *">
          <input
            id="cn-reason"
            className={`${formCls} ${errors.reason ? 'border-red-400' : ''}`}
            placeholder="e.g. Damaged goods returned, Over-billing correction..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {errors.reason && <p className={errCls}>{errors.reason}</p>}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount Reversed *">
            <input
              id="cn-amount"
              type="number"
              min="0.01"
              step="any"
              className={`${formCls} ${errors.totalAmount ? 'border-red-400' : ''}`}
              placeholder={`0.00 ${workspace?.currency || 'INR'}`}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
            {errors.totalAmount && <p className={errCls}>{errors.totalAmount}</p>}
          </Field>

          <Field label="Credit Note Date">
            <DatePicker value={noteDate} onChange={setNoteDate} />
          </Field>
        </div>

        <Field label="Internal Notes (optional)">
          <input
            id="cn-notes"
            className={formCls}
            placeholder="Any additional remarks or reference numbers..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting} icon={<RotateCcw size={15} />}>
            {submitting ? 'Creating...' : 'Issue Credit Note'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const SALES_INVOICE_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'invoice_number', label: 'Invoice Number', category: 'Invoice & Order', defaultSelected: true },
  { key: 'date', label: 'Invoice Date', category: 'Invoice & Order', defaultSelected: true },
  { key: 'due_date', label: 'Due Date', category: 'Invoice & Order', defaultSelected: true },
  { key: 'status', label: 'Order Status', category: 'Invoice & Order', defaultSelected: true },
  { key: 'payment_status', label: 'Payment Status', category: 'Invoice & Order', defaultSelected: true },
  { key: 'location_name', label: 'Sales Location', category: 'Invoice & Order', defaultSelected: true },
  { key: 'place_of_supply', label: 'Place of Supply (State)', category: 'Invoice & Order', defaultSelected: true },

  { key: 'customer_name', label: 'Customer Name', category: 'Customer Details', defaultSelected: true },
  { key: 'customer_gstin', label: 'Customer GSTIN', category: 'Customer Details', defaultSelected: true },
  { key: 'customer_state', label: 'Customer State', category: 'Customer Details', defaultSelected: false },
  { key: 'customer_phone', label: 'Customer Phone', category: 'Customer Details', defaultSelected: false },
  { key: 'customer_email', label: 'Customer Email', category: 'Customer Details', defaultSelected: false },

  { key: 'item_names', label: 'Item Names', category: 'Products & Quantities', defaultSelected: true },
  { key: 'total_quantity', label: 'Total Quantity Sold', category: 'Products & Quantities', defaultSelected: true },
  { key: 'item_count', label: 'Total Line Items Count', category: 'Products & Quantities', defaultSelected: false },

  { key: 'subtotal', label: 'Taxable Subtotal', category: 'Financial & Taxes', defaultSelected: true },
  { key: 'cgst_amount', label: 'CGST Amount', category: 'Financial & Taxes', defaultSelected: false },
  { key: 'sgst_amount', label: 'SGST Amount', category: 'Financial & Taxes', defaultSelected: false },
  { key: 'igst_amount', label: 'IGST Amount', category: 'Financial & Taxes', defaultSelected: false },
  { key: 'total_tax', label: 'Total GST Tax', category: 'Financial & Taxes', defaultSelected: true },
  { key: 'discount_amount', label: 'Invoice Discount', category: 'Financial & Taxes', defaultSelected: true },
  { key: 'round_off_amount', label: 'Round Off', category: 'Financial & Taxes', defaultSelected: false },
  { key: 'total_amount', label: 'Grand Total Amount', category: 'Financial & Taxes', defaultSelected: true },
  { key: 'amount_received', label: 'Amount Received', category: 'Financial & Taxes', defaultSelected: true },
  { key: 'amount_due', label: 'Balance Due', category: 'Financial & Taxes', defaultSelected: true },

  { key: 'dispatch_tracking_ref', label: 'Dispatch Tracking Ref', category: 'Shipping & Notes', defaultSelected: false },
  { key: 'dispatch_date', label: 'Dispatch Date', category: 'Shipping & Notes', defaultSelected: false },
  { key: 'notes', label: 'Notes / Reference', category: 'Shipping & Notes', defaultSelected: false },
  { key: 'terms_and_conditions', label: 'Terms & Conditions', category: 'Shipping & Notes', defaultSelected: false },
  { key: 'created_at', label: 'Created At', category: 'Shipping & Notes', defaultSelected: false }
];

const CREDIT_NOTE_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'credit_note_number', label: 'Credit Note #', category: 'Credit Note Details', defaultSelected: true },
  { key: 'date', label: 'Date', category: 'Credit Note Details', defaultSelected: true },
  { key: 'customer_name', label: 'Customer Name', category: 'Credit Note Details', defaultSelected: true },
  { key: 'invoice_number', label: 'Original Invoice #', category: 'Credit Note Details', defaultSelected: true },
  { key: 'reason', label: 'Return / Reversal Reason', category: 'Credit Note Details', defaultSelected: true },
  { key: 'total_amount', label: 'Total Amount Reversed', category: 'Credit Note Details', defaultSelected: true },
  { key: 'created_at', label: 'Created At', category: 'Credit Note Details', defaultSelected: false }
];

export function SalesPage() {
  const { workspace } = useWorkspace();
  const { canView, canCreate, canEdit, canDelete, canApprove, canExport } = usePermissions('sales');
  const toast = useToast();
  const [tab, setTab] = usePersistentTab<'invoices' | 'credit_notes'>('sales_tab', 'invoices', 'tab');
  const [refresh, setRefresh] = useState(0);
  const customers = useOptions('/api/customers', refresh) as any[];
  const goods = useOptions('/api/finished-goods', refresh) as any[];

  const [detail, setDetail] = useState<string | null>(null);
  const [exportModalData, setExportModalData] = useState<any | null>(null);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);

  // Payment Modal State
  const [paymentSale, setPaymentSale] = useState<any | null>(null);
  // Dispatch Modal State
  const [dispatchSale, setDispatchSale] = useState<any | null>(null);

  // Multi-Line Sales Invoice Form State
  const [customerId, setCustomerId] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('Delhi');
  const [invoiceDate, setInvoiceDate] = useState(dateIso());
  const [dueDate, setDueDate] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [lineItems, setLineItems] = useState<Array<{
    finished_good_id: string;
    packaging_config_id: string;
    quantity: string;
    rate_per_unit: string;
    discount_percent: string;
    tax_rate: string;
  }>>([
    { finished_good_id: '', packaging_config_id: '', quantity: '1', rate_per_unit: '0', discount_percent: '0', tax_rate: '18' }
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [amountReceived, setAmountReceived] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms] = useState('1. Goods once sold will not be taken back.\n2. Payment due within credit terms.');

  const locations = useOptions('/api/locations', refresh) as any[];
  const [locationId, setLocationId] = useState('');
  const [tableLocationFilter, setTableLocationFilter] = useState('');
  const defaultLocation = locations.find((l) => l.is_default) || locations[0];

  // Helper to determine the top/final packaged product configuration for a finished good
  const getFinalPackagingConfig = (fg: any) => {
    const list = fg?.packaging_levels?.length ? fg.packaging_levels : fg?.packaging_configs;
    if (!list || list.length === 0) return null;
    // Prefer package that actually has stock in warehouse
    const inStock = list.filter((p: any) => Number(p.available_stock || 0) > 0);
    if (inStock.length > 0) {
      const def = inStock.find((p: any) => p.is_default);
      if (def) return def;
      return inStock[0];
    }
    const def = list.find((p: any) => p.is_default);
    if (def) return def;
    return [...list].sort((a: any, b: any) => Number(b.base_quantity_equivalent || b.units_per_package || 0) - Number(a.base_quantity_equivalent || a.units_per_package || 0))[0];
  };

  // Auto-select default location
  useEffect(() => {
    if (locations.length > 0 && !locationId) {
      const def = locations.find((l) => l.is_default) || locations[0];
      if (def) setLocationId(def.id);
    }
  }, [locations]);

  // Customer Credit Limit & Details
  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Pre-fill rate, place of supply, and due date when customer selected
  useEffect(() => {
    if (selectedCustomer) {
      if (selectedCustomer.state) {
        setPlaceOfSupply(selectedCustomer.state);
      }
      // Auto-set Due Date based on payment terms (Net 15, Net 30, Net 45)
      const termsStr = String(selectedCustomer.payment_terms || '').toLowerCase();
      let daysToAdd = 0;
      if (termsStr.includes('15')) daysToAdd = 15;
      else if (termsStr.includes('30')) daysToAdd = 30;
      else if (termsStr.includes('45')) daysToAdd = 45;
      else if (termsStr.includes('60')) daysToAdd = 60;

      if (daysToAdd > 0) {
        const d = new Date(invoiceDate);
        d.setDate(d.getDate() + daysToAdd);
        setDueDate(d.toISOString().slice(0, 10));
      }
    }
  }, [customerId, selectedCustomer, invoiceDate]);

  const addLine = (productId?: string) => {
    const matched = productId ? goods.find((g) => g.id === productId) : null;
    const finalPkg = matched ? getFinalPackagingConfig(matched) : null;
    const initialRate = finalPkg?.selling_price
      ? String(finalPkg.selling_price)
      : (matched?.default_price ? String(matched.default_price) : '0');

    setLineItems([
      ...lineItems,
      {
        finished_good_id: productId || '',
        packaging_config_id: finalPkg?.id || '',
        quantity: '1',
        rate_per_unit: initialRate,
        discount_percent: '0',
        tax_rate: matched?.tax_rate ? String(matched.tax_rate) : '18'
      }
    ]);
  };

  const removeLine = (idx: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== idx));
    }
  };

  const updateLine = (idx: number, field: string, value: string) => {
    const next = [...lineItems];
    (next[idx] as any)[field] = value;

    if (field === 'finished_good_id') {
      if (value) {
        const matched = goods.find((g) => g.id === value);
        const finalPkg = matched ? getFinalPackagingConfig(matched) : null;
        if (finalPkg) {
          next[idx].packaging_config_id = finalPkg.id;
          next[idx].rate_per_unit = String(finalPkg.selling_price || matched?.default_price || '0');
        } else {
          next[idx].packaging_config_id = '';
          next[idx].rate_per_unit = matched?.default_price ? String(matched.default_price) : '0';
        }
        if (matched?.tax_rate != null) {
          next[idx].tax_rate = String(matched.tax_rate);
        }
      } else {
        next[idx].packaging_config_id = '';
        next[idx].rate_per_unit = '0';
      }
    } else if (field === 'packaging_config_id') {
      const matched = goods.find((g) => g.id === next[idx].finished_good_id);
      const list = matched?.packaging_levels?.length ? matched.packaging_levels : matched?.packaging_configs;
      if (value && list) {
        const selPkg = list.find((p: any) => p.id === value);
        if (selPkg) {
          next[idx].rate_per_unit = String(selPkg.selling_price || matched.default_price || '0');
        }
      } else if (!value && matched) {
        next[idx].rate_per_unit = String(matched.default_price || '0');
      }
    }
    setLineItems(next);
  };

  // Filter goods by user search term
  const filteredGoods = goods.filter((g) =>
    g.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Tax and Rounding Preview Logic
  const workspaceState = (workspace as any)?.state || 'Delhi';
  const isInterstate = workspaceState.trim().toLowerCase() !== placeOfSupply.trim().toLowerCase();

  let subtotal = 0;
  let totalTax = 0;
  let stockValidationError = '';

  lineItems.forEach((line, idx) => {
    const qty = Number(line.quantity) || 0;
    const rate = Number(line.rate_per_unit) || 0;
    const disc = Number(line.discount_percent) || 0;
    const taxPct = Number(line.tax_rate) || 0;

    const lineTaxable = (qty * rate) * (1 - disc / 100);
    const lineTax = lineTaxable * (taxPct / 100);
    subtotal += lineTaxable;
    totalTax += lineTax;

    if (line.finished_good_id) {
      const matchedFg = goods.find((g) => g.id === line.finished_good_id);
      const pkgList = matchedFg?.packaging_levels?.length ? matchedFg.packaging_levels : matchedFg?.packaging_configs;
      const activePkg = pkgList?.find((p: any) => p.id === line.packaging_config_id);
      const availableInUnit = activePkg
        ? Number(activePkg.available_stock || 0)
        : Number(matchedFg?.loose_stock != null ? matchedFg.loose_stock : 0);
      const unitName = activePkg ? (activePkg.package_unit || activePkg.name || activePkg.package_name) : (matchedFg?.unit || 'units');

      if (availableInUnit <= 0) {
        stockValidationError = `Line ${idx + 1}: "${matchedFg?.name} (${unitName})" is out of stock (0 available). Cannot sell unproduced packaging tier!`;
      } else if (qty > availableInUnit) {
        stockValidationError = `Line ${idx + 1}: Requested ${qty} ${unitName} of "${matchedFg?.name}${activePkg ? ` (${activePkg.name || activePkg.package_name})` : ''}", but only ${availableInUnit} ${unitName} available in stock!`;
      }
    }
  });

  const discountRate = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const calculatedDiscountAmount = (subtotal * discountRate) / 100;
  const preRoundingTotal = Math.max(0, subtotal + totalTax - calculatedDiscountAmount);
  const grandTotal = Math.round(preRoundingTotal);
  const roundOffAmount = grandTotal - preRoundingTotal;

  const submitInvoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!lineItems[0].finished_good_id) return toast('Select at least one product line', 'error');

    // Strict Inventory Stock Check Validation
    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      if (!line.finished_good_id) continue;
      const matchedFg = goods.find((g) => g.id === line.finished_good_id);
      const pkgList = matchedFg?.packaging_levels?.length ? matchedFg.packaging_levels : matchedFg?.packaging_configs;
      const activePkg = pkgList?.find((p: any) => p.id === line.packaging_config_id);
      const availableInUnit = activePkg
        ? Number(activePkg.available_stock || 0)
        : Number(matchedFg?.loose_stock != null ? matchedFg.loose_stock : 0);
      const unitName = activePkg ? (activePkg.package_unit || activePkg.name || activePkg.package_name) : (matchedFg?.unit || 'units');
      const requestedQty = Number(line.quantity || 0);

      if (availableInUnit <= 0) {
        return toast(
          `Cannot create invoice! Item "${matchedFg?.name} (${unitName})" is out of stock (0 available). You can only sell finished products that have actually been produced in warehouse inventory.`,
          'error'
        );
      } else if (requestedQty > availableInUnit) {
        return toast(
          `Cannot create invoice! Item "${matchedFg?.name} (${unitName})" has only ${availableInUnit} ${unitName} available in stock, but you requested ${requestedQty}.`,
          'error'
        );
      }
    }

    try {
      const itemsPayload = lineItems.map((l) => {
        const fg = goods.find((g) => g.id === l.finished_good_id);
        const pkgLvl = fg?.packaging_levels?.find((p: any) => p.id === l.packaging_config_id);
        const pkgCfg = fg?.packaging_configs?.find((p: any) => p.id === l.packaging_config_id);
        const pkg = pkgLvl || pkgCfg;
        return {
          ...l,
          packaging_level_id: pkgLvl ? pkgLvl.id : null,
          packaging_config_id: pkgCfg ? pkgCfg.id : (pkgLvl ? pkgLvl.id : null),
          package_name: pkg ? (pkg.name || pkg.package_name) : null,
          package_unit: pkg ? (pkg.package_unit || pkg.name) : null,
          units_per_package: pkgLvl ? Number(pkgLvl.base_quantity_equivalent) : (pkgCfg ? Number(pkgCfg.units_per_package) : 1)
        };
      });

      const res = await api.post('/api/invoices', {
        customer_id: customerId || null,
        location_id: locationId || null,
        date: invoiceDate,
        due_date: dueDate || null,
        place_of_supply: placeOfSupply,
        items: itemsPayload,
        invoice_discount: Number(calculatedDiscountAmount.toFixed(2)) || 0,
        discount_percent: Number(discountRate) || 0,
        amount_received: Number(amountReceived) || 0,
        terms_and_conditions: terms,
        notes
      });

      if (res.data.credit_limit_warning) {
        toast('Invoice created! Warning: Customer credit limit exceeded.', 'info');
      } else {
        toast('GST Sales Invoice generated successfully');
      }

      setCustomerId('');
      setLocationId(defaultLocation?.id || '');
      setLineItems([{ finished_good_id: '', packaging_config_id: '', quantity: '1', rate_per_unit: '0', discount_percent: '0', tax_rate: '18' }]);
      setDiscountPercent('0');
      setAmountReceived('0');
      setNotes('');
      setRefresh((v) => v + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create invoice', 'error');
    }
  };

  // Reliable Authenticated Blob PDF Download Handler
  const downloadPdf = async (saleId: string, invoiceNum: string) => {
    try {
      const res = await api.get(`/api/invoices/${saleId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNum || 'Sales_Invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('Invoice PDF downloaded');
    } catch (err) {
      toast('Failed to download invoice PDF', 'error');
    }
  };

  const columns: TableColumn<AnyRow>[] = [
    { key: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    { key: 'invoice_number', label: 'Invoice #', render: (row) => <span className="font-mono text-xs font-semibold text-slate-800">{row.invoice_number || 'INV-N/A'}</span> },
    { key: 'customer_name', label: 'Customer', sortable: true, render: (row) => row.customer_name || 'Walk-in Customer' },
    { key: 'location_name', label: 'Location', sortable: true, render: (row) => row.location_name || 'Default' },
    { key: 'item_names', label: 'Item Name', sortable: true, render: (row) => <span className="font-semibold text-slate-800">{row.item_names || row.name || `${row.item_count || 1} line item(s)`}</span> },
    { key: 'total_quantity', label: 'Quantity', sortable: true, align: 'right', render: (row) => formatNumber(row.total_quantity || row.quantity) },
    { key: 'total_amount', label: 'Grand Total', sortable: true, align: 'right', render: (row) => formatCurrency(row.total_amount || (row.quantity * row.rate_per_unit), workspace?.currency) },
    { key: 'amount_received', label: 'Received', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount_received, workspace?.currency) },
    { key: 'amount_due', label: 'Due', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount_due, workspace?.currency) },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const s = row.status || row.payment_status || 'Draft';
        let carrierName = '';
        if (row.notes && typeof row.notes === 'string' && row.notes.includes('Carrier:')) {
          const match = row.notes.match(/Carrier:\s*([^|.]+)/i);
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
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => {
        const isDispatched = row.status === 'Dispatched';
        const isReceived = row.status === 'Goods Received' || row.status === 'Delivered';
        const isReturnRequested = row.status === 'Return Requested';
        const isReturned = row.status === 'Returned';
        const canDispatch = !isDispatched && !isReceived && !isReturnRequested && !isReturned && row.status !== 'Declined';

        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {/* 1. Dispatch Button for Undispatched Orders */}
            {canApprove && canDispatch && (
              <button
                type="button"
                onClick={() => setDispatchSale(row)}
                className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white shadow-sm ring-2 ring-blue-400/30 transition cursor-pointer"
                title="Dispatch goods to customer with carrier and tracking details"
              >
                <Truck size={13} /> Dispatch
              </button>
            )}

            {/* 2. Goods Received Badge */}
            {isReceived && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                <CheckCircle2 size={12} /> Goods Received
              </span>
            )}

            {/* 3. Return Requested Badge */}
            {isReturnRequested && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200" title="Customer has requested a return. Review in Return Requests.">
                <RotateCcw size={12} /> Return Requested
              </span>
            )}

            {/* 4. Returned Badge */}
            {isReturned && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                Returned
              </span>
            )}

            {/* 5. Payment Button */}
            {(canCreate || canEdit) && (
              <button
                type="button"
                onClick={() => setPaymentSale(row)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 shadow-2xs transition cursor-pointer"
              >
                {Number(row.amount_due || 0) > 0 ? (
                  <>
                    <Plus size={13} /> Pay
                  </>
                ) : (
                  <>
                    <FileText size={13} /> Log
                  </>
                )}
              </button>
            )}

            {/* 6. Download PDF */}
            {canExport && (
              <button
                type="button"
                onClick={() => downloadPdf(String(row.id), row.invoice_number)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl border border-blue-200 shadow-2xs transition cursor-pointer"
              >
                <Download size={13} /> PDF
              </button>
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
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Sales & Invoicing module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle icon={<ShoppingCart />} title="Sales & GST Invoicing" subtitle="Create GST tax invoices with real-time inventory stock checks, instant PDF downloads, and credit note returns." />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${tab === 'invoices' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
          onClick={() => setTab('invoices')}
        >
          <FileText size={16} /> Sales Invoices
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition cursor-pointer ${tab === 'credit_notes' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'}`}
          onClick={() => setTab('credit_notes')}
        >
          <RotateCcw size={16} /> Credit Notes (Returns)
        </button>
      </div>

      {tab === 'invoices' ? (
        <>
          {/* Multi-Line GST Invoice Entry Form */}
          {canCreate && (
            <section className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Create GST Sales Invoice</h2>
            <form onSubmit={submitInvoice} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Field label="Customer">
                  <Select
                    value={customerId}
                    onChange={setCustomerId}
                    options={[
                      { value: '', label: 'Walk-in Customer' },
                      ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.gstin || 'No GSTIN'})` }))
                    ]}
                  />
                </Field>

                <Field label="Sales Location">
                  <Select
                    value={locationId || defaultLocation?.id || ''}
                    onChange={setLocationId}
                    options={locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))}
                  />
                </Field>

                <Field label="Place of Supply (State)">
                  <input className={formInputCls} value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} />
                </Field>

                <Field label="Invoice Date">
                  <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
                </Field>

                <Field label="Due Date (Auto Terms)">
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </Field>
              </div>

              {/* Customer Credit Summary Banner */}
              {selectedCustomer ? (
                <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                    <span className="font-semibold text-slate-800">{selectedCustomer.name}</span>
                    <span className="text-slate-500">({selectedCustomer.gstin || 'Unregistered'}, {selectedCustomer.state || 'N/A'})</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-700 font-medium">
                    <span>Terms: <strong>{selectedCustomer.payment_terms || 'Immediate'}</strong></span>
                    {selectedCustomer.credit_limit ? (
                      <span>Credit Limit: <strong className="text-slate-900">{formatCurrency(selectedCustomer.credit_limit, workspace?.currency)}</strong></span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Product Search Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Items Picker</span>
                <div className="relative w-72">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    placeholder="Search product catalog by keyword..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Stock Validation Error Warning Box */}
              {stockValidationError ? (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-semibold flex items-center gap-2.5">
                  <AlertTriangle size={18} className="text-red-600 shrink-0" />
                  <span>{stockValidationError}</span>
                </div>
              ) : null}

              {/* Line Items Table with Dedicated Stock Status Column */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">PRODUCT / FINISHED GOOD</div>
                  <div className="col-span-2 text-center">INVENTORY STOCK</div>
                  <div className="col-span-2 text-right">QTY TO SELL</div>
                  <div className="col-span-2 text-right">RATE / UNIT</div>
                  <div className="col-span-1 text-right">DISC %</div>
                  <div className="col-span-1 text-right">GST %</div>
                  <div className="col-span-1 text-center">ACTION</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {lineItems.map((line, idx) => {
                    const selectedFg = goods.find((g) => g.id === line.finished_good_id);
                    const pkgList = selectedFg?.packaging_levels?.length ? selectedFg.packaging_levels : selectedFg?.packaging_configs;
                    const activePkg = pkgList?.find((p: any) => p.id === line.packaging_config_id);
                    const unitsPerPkg = Number(activePkg?.base_quantity_equivalent || activePkg?.units_per_package || 1);
                    const availableInUnit = activePkg
                      ? Number(activePkg.available_stock || 0)
                      : Number(selectedFg?.loose_stock != null ? selectedFg.loose_stock : 0);
                    const unitName = activePkg ? (activePkg.package_unit || activePkg.name || activePkg.package_name) : (selectedFg?.unit || 'units');
                    const qtyVal = Number(line.quantity || 0);
                    const isExceeded = line.finished_good_id && (qtyVal > availableInUnit || availableInUnit <= 0);

                    return (
                      <div key={idx} className={`p-3 grid grid-cols-12 gap-2 items-start transition ${isExceeded ? 'bg-red-50/70 border-l-4 border-l-red-500' : 'bg-slate-50/50'}`}>
                        {/* Column 1: Product Select & Packaging Config Selector */}
                        <div className="col-span-3 space-y-1.5">
                          <Select
                            value={line.finished_good_id}
                            onChange={(val) => updateLine(idx, 'finished_good_id', val)}
                            options={[
                              { value: '', label: 'Select Product...' },
                              ...filteredGoods.map((g) => {
                                const inStockPkgs = (g.packaging_levels || g.packaging_configs || []).filter((p: any) => Number(p.available_stock || 0) > 0);
                                let stockLabel = '';
                                if (inStockPkgs.length > 0) {
                                  const parts = inStockPkgs.map((p: any) => `${formatNumber(p.available_stock, 0)} ${p.package_unit || p.name || p.package_name}`);
                                  if (Number(g.loose_stock || 0) > 0) {
                                    parts.push(`${formatNumber(g.loose_stock, 0)} ${g.unit} Loose`);
                                  }
                                  stockLabel = parts.join(' + ');
                                } else if (Number(g.loose_stock || 0) > 0) {
                                  stockLabel = `${formatNumber(g.loose_stock, 0)} ${g.unit} Loose`;
                                } else {
                                  stockLabel = `0 ${g.unit || 'units'} (Out of Stock)`;
                                }
                                return {
                                  value: g.id,
                                  label: `${g.name} — Stock: ${stockLabel}`
                                };
                              })
                            ]}
                          />

                          {/* Packaging Size Tier Selector (if finished good has packaging configs or levels) */}
                          {selectedFg && pkgList && pkgList.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/80 rounded-lg px-2 py-1 text-xs">
                              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider shrink-0">Pack:</span>
                              <select
                                className="w-full bg-white border border-blue-200 rounded text-xs py-0.5 px-1.5 text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer truncate"
                                value={line.packaging_config_id}
                                onChange={(e) => updateLine(idx, 'packaging_config_id', e.target.value)}
                              >
                                {pkgList.map((p: any) => {
                                  const pStock = Number(p.available_stock || 0);
                                  return (
                                    <option key={p.id} value={p.id} className={pStock <= 0 ? 'text-slate-400' : 'text-slate-900 font-medium'}>
                                      📦 {p.name || p.package_name} — {pStock > 0 ? `${formatNumber(pStock, 0)} ${p.package_unit || 'available'}` : 'Out of Stock (0)'}
                                    </option>
                                  );
                                })}
                                {Number(selectedFg.loose_stock || 0) > 0 ? (
                                  <option value="">
                                    📦 Loose Bulk ({formatNumber(selectedFg.loose_stock, 0)} {selectedFg.unit || 'Units'} available)
                                  </option>
                                ) : (
                                  <option value="" disabled className="text-slate-400">
                                    📦 Loose Bulk (0 available — Out of Stock)
                                  </option>
                                )}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Selected Item Inventory Stock Status Badge */}
                        <div className="col-span-2 flex flex-col items-center justify-center pt-1">
                          {selectedFg ? (
                            <div className="w-full flex flex-col items-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border w-full justify-center shadow-2xs ${
                                availableInUnit > 0
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {availableInUnit > 0 ? <PackageCheck size={14} className="text-emerald-600 shrink-0" /> : <PackageX size={14} className="text-red-500 shrink-0" />}
                                {availableInUnit > 0 ? `${formatNumber(availableInUnit, 0)} ${unitName}` : `0 ${unitName}`}
                              </span>
                              <span className={`text-[10px] font-mono mt-1 ${availableInUnit > 0 ? 'text-emerald-700 font-medium' : 'text-red-500 font-bold'}`}>
                                {availableInUnit > 0 ? `In Stock (${unitName})` : `Out of Stock`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium py-1.5">— Select Item —</span>
                          )}
                        </div>

                        {/* Column 3: Qty to Sell */}
                        <div className="col-span-2 space-y-1">
                          <div className="relative">
                            <input
                              className={`${formInputCls} text-right font-medium pr-14 ${isExceeded ? 'border-red-500 focus:border-red-600 focus:ring-red-500/20 bg-red-50 text-red-900 font-bold' : ''}`}
                              required
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                              placeholder="0"
                            />
                            <span className="absolute right-2.5 top-2.5 text-[11px] font-semibold text-slate-400 pointer-events-none uppercase">
                              {unitName}
                            </span>
                          </div>
                          {activePkg && Number(line.quantity || 0) > 0 && (
                            <div className="text-[10px] text-right text-slate-500 font-mono">
                              = {formatNumber(Number(line.quantity || 0) * unitsPerPkg)} {selectedFg?.unit || 'units'}
                            </div>
                          )}
                        </div>

                        {/* Column 4: Rate per Unit */}
                        <div className="col-span-2 space-y-1">
                          <input
                            className={`${formInputCls} text-right font-medium`}
                            required
                            inputMode="decimal"
                            value={line.rate_per_unit}
                            onChange={(e) => updateLine(idx, 'rate_per_unit', e.target.value)}
                          />
                          {selectedFg && (
                            <div className="text-[10px] text-right">
                              {activePkg ? (
                                <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium" title="Catalog selling price configured in inventory packaging">
                                  Catalog: <strong className="text-slate-900">{formatCurrency(activePkg.selling_price || 0, workspace?.currency)}</strong>/{activePkg.package_unit || 'pkg'}
                                  {Number(activePkg.mrp || 0) > 0 && <span className="text-slate-400">· MRP {formatCurrency(activePkg.mrp, workspace?.currency)}</span>}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium" title="Catalog selling price configured in inventory">
                                  Catalog: <strong className="text-slate-900">{formatCurrency(selectedFg.default_price || 0, workspace?.currency)}</strong>/{selectedFg.unit || 'unit'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Column 5: Discount % */}
                        <div className="col-span-1">
                          <input className={`${formInputCls} text-right`} inputMode="decimal" value={line.discount_percent} onChange={(e) => updateLine(idx, 'discount_percent', e.target.value)} />
                        </div>

                        {/* Column 6: GST % */}
                        <div className="col-span-1">
                          <Select
                            value={line.tax_rate}
                            onChange={(val) => updateLine(idx, 'tax_rate', val)}
                            options={[
                              { value: '0', label: '0%' },
                              { value: '5', label: '5%' },
                              { value: '12', label: '12%' },
                              { value: '18', label: '18%' },
                              { value: '28', label: '28%' }
                            ]}
                          />
                        </div>

                        {/* Column 7: Action */}
                        <div className="col-span-1 text-center pt-2">
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-slate-100/80 border-t border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={() => addLine()}>Add Another Product Line</Button>

                  {/* GST Split & Rounding Calculation Box */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs text-xs space-y-1.5 w-full md:w-80">
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Subtotal:</span>
                      <span className="font-semibold text-slate-900 font-mono">{formatCurrency(subtotal, workspace?.currency)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{isInterstate ? 'IGST Tax:' : 'CGST + SGST Tax:'}</span>
                      <span className="font-semibold text-slate-900 font-mono">{formatCurrency(totalTax, workspace?.currency)}</span>
                    </div>
                    {discountRate > 0 && (
                      <div className="flex justify-between text-emerald-700 font-medium pt-0.5">
                        <span>Invoice Discount ({discountRate}%):</span>
                        <span className="font-bold font-mono">-{formatCurrency(calculatedDiscountAmount, workspace?.currency)}</span>
                      </div>
                    )}
                    {roundOffAmount !== 0 ? (
                      <div className="flex justify-between text-slate-500 font-mono text-[11px]">
                        <span>Round Off:</span>
                        <span>{roundOffAmount > 0 ? `+${roundOffAmount.toFixed(2)}` : roundOffAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-100">
                      <span>Grand Total:</span>
                      <div className="text-right">
                        <span className="text-blue-700 font-mono">{formatCurrency(grandTotal, workspace?.currency)}</span>
                        {discountRate > 0 && (
                          <span className="ml-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                            (Saved {formatCurrency(calculatedDiscountAmount, workspace?.currency)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex justify-between items-center text-[11px] font-semibold tracking-wider uppercase text-slate-600">
                    <span>Invoice Discount (%)</span>
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
                      onChange={(e) => setDiscountPercent(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                      %
                    </span>
                  </div>
                </div>
                <Field label="Amount Received Now">
                  <input className={formInputCls} inputMode="decimal" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
                </Field>
                <div className="flex items-end">
                  <Button type="submit" icon={<Check size={16} />} disabled={!!stockValidationError} className="w-full">
                    Generate & Save Invoice
                  </Button>
                </div>
              </div>
            </form>
          </section>
          )}

          {/* Location Filter Toolbar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <MapPin size={15} className="text-blue-600" />
              <span>Filter Invoices by Location:</span>
            </div>
            <div className="w-64">
              <Select
                value={tableLocationFilter}
                onChange={setTableLocationFilter}
                options={[
                  { value: '', label: 'All Locations' },
                  ...locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
                ]}
              />
            </div>
          </div>

          {/* Invoices List */}
          <DataTable
            endpoint={tableLocationFilter ? `/api/invoices?location_id=${tableLocationFilter}` : '/api/invoices'}
            columns={columns}
            refreshKey={refresh}
            showDateFilters={true}
            onView={(row) => setDetail(row.id || null)}
            onDelete={canDelete ? async (row) => {
              await api.delete(`/api/sales/${row.id}`);
              toast('Invoice deleted & finished goods stock restored to inventory');
              setRefresh((v) => v + 1);
            } : undefined}
            onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
            canCreate={canCreate}
            canDelete={canDelete}
            canExport={canExport}
            createLabel="New Invoice"
            emptyTitle="No sales invoices generated yet"
          />
        </>
      ) : (
        <DataTable
          endpoint="/api/invoices/credit-notes"
          columns={[
            { key: 'created_at', label: 'Date', render: (r) => formatDate(r.created_at || r.date) },
            { key: 'credit_note_number', label: 'Credit Note #', render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.credit_note_number}</span> },
            { key: 'customer_name', label: 'Customer', render: (r) => r.customer_name || 'Customer' },
            { key: 'reason', label: 'Reason' },
            { key: 'total_amount', label: 'Amount Reversed', align: 'right', render: (r) => formatCurrency(r.total_amount, workspace?.currency) }
          ]}
          refreshKey={refresh}
          showDateFilters={true}
          onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
          canCreate={canCreate}
          canDelete={canDelete}
          canExport={canExport}
          onCreate={canCreate ? () => setShowCreditNoteModal(true) : undefined}
          createLabel="Create Credit Note"
          emptyTitle="No Credit Notes created yet"
        />
      )}

      {/* Create Credit Note Modal */}
      {showCreditNoteModal && (
        <CreditNoteModal
          onClose={() => setShowCreditNoteModal(false)}
          onSaved={() => setRefresh((v) => v + 1)}
        />
      )}

      {/* Record Payment Modal */}
      {paymentSale ? (
        <CustomerPaymentModal
          sale={paymentSale}
          onClose={() => setPaymentSale(null)}
          onSaved={() => setRefresh((v) => v + 1)}
        />
      ) : null}

      {/* Dispatch Shipment Modal */}
      {dispatchSale ? (
        <DispatchSalesModal
          sale={dispatchSale}
          onClose={() => setDispatchSale(null)}
          onDispatched={() => setRefresh((v) => v + 1)}
        />
      ) : null}

      {/* View Details Sidebar for Sales Invoices */}
      {detail ? (
        <SalesDetailDrawer
          saleId={detail}
          onClose={() => setDetail(null)}
          onRecordPayment={(s) => {
            setDetail(null);
            setPaymentSale(s);
          }}
          onDispatch={(s) => {
            setDetail(null);
            setDispatchSale(s);
          }}
          onRefresh={() => setRefresh((v) => v + 1)}
        />
      ) : null}

      {/* Column-Selective Export Modal for Sales */}
      {exportModalData && (
        <ExportColumnModal
          title={tab === 'invoices' ? 'Export Sales Invoices to CSV' : 'Export Credit Notes to CSV'}
          recordCount={exportModalData.total}
          availableColumns={tab === 'invoices' ? SALES_INVOICE_EXPORT_COLUMNS : CREDIT_NOTE_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const activeCols = tab === 'invoices' ? SALES_INVOICE_EXPORT_COLUMNS : CREDIT_NOTE_EXPORT_COLUMNS;
            const exportCols: TableColumn<any>[] = activeCols
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));

            const formattedRecords = records.map((r: any) => {
              const amtDue = Number(r.amount_due || 0);
              const amtReceived = Number(r.amount_received || 0);
              const payStatus = amtDue <= 0.01 ? 'Paid' : (amtReceived > 0 ? 'Partially Paid' : 'Unpaid');

              return {
                ...r,
                payment_status: r.payment_status || payStatus,
                date: r.date ? formatDate(r.date) : '',
                due_date: r.due_date ? formatDate(r.due_date) : '',
                dispatch_date: r.dispatch_date ? formatDate(r.dispatch_date) : '',
                created_at: r.created_at ? formatDate(r.created_at) : '',
                total_amount: r.total_amount != null ? Number(r.total_amount).toFixed(2) : '0.00',
                amount_received: amtReceived.toFixed(2),
                amount_due: amtDue.toFixed(2),
                subtotal: r.subtotal != null ? Number(r.subtotal).toFixed(2) : '0.00',
                total_tax: r.total_tax != null ? Number(r.total_tax).toFixed(2) : '0.00',
                cgst_amount: r.cgst_amount != null ? Number(r.cgst_amount).toFixed(2) : '0.00',
                sgst_amount: r.sgst_amount != null ? Number(r.sgst_amount).toFixed(2) : '0.00',
                igst_amount: r.igst_amount != null ? Number(r.igst_amount).toFixed(2) : '0.00',
                discount_amount: r.discount_amount != null ? Number(r.discount_amount).toFixed(2) : '0.00'
              };
            });

            csvDownload(
              `sales_${tab}_export_${new Date().toISOString().slice(0, 10)}.csv`,
              formattedRecords,
              exportCols
            );
            toast(`Exported ${records.length} records with ${exportCols.length} columns!`, 'success');
          }}
        />
      )}
    </div>
  );
}
