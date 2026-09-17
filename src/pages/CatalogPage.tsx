import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Package2, Plus, Trash2, Box, Layers, Tag, CircleDollarSign,
  AlertTriangle, CheckCircle2, XCircle, Info, Edit3, Copy,
  Building2, Calendar, Check, ShieldCheck,
  Phone, Mail, Award, Loader2
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, formatNumber, formatDate, getCurrencySymbol, csvDownload, generateUUID } from '../lib/utils';
import type { TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Modal, Drawer } from '../components/ui/Modal';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { ProductRecipeConfig } from '../components/ProductRecipeConfig';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';

const ITEM_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'code', label: 'SKU / Item Code', category: 'Item Identifiers' },
  { key: 'name', label: 'Item Name', category: 'Item Identifiers' },
  { key: 'item_type', label: 'Category / Classification', category: 'Item Identifiers' },
  { key: 'status', label: 'Status (Active/Inactive)', category: 'Item Identifiers' },
  { key: 'unit', label: 'Unit of Measure', category: 'Inventory & Stock' },
  { key: 'current_stock', label: 'Current Available Stock', category: 'Inventory & Stock' },
  { key: 'reorder_level', label: 'Reorder Level Threshold', category: 'Inventory & Stock' },
  { key: 'stock_status', label: 'Stock Health Status', category: 'Inventory & Stock' },
  { key: 'last_purchase_price', label: 'Last Purchase Price', category: 'Pricing & Valuation' },
  { key: 'weighted_average_cost', label: 'Weighted Average Cost', category: 'Pricing & Valuation' },
  { key: 'default_price', label: 'Catalog Selling Price', category: 'Pricing & Valuation' },
  { key: 'inventory_valuation', label: 'Estimated Stock Valuation', category: 'Pricing & Valuation' },
  { key: 'hsn_code', label: 'HSN / SAC Code', category: 'Tax & Compliance' },
  { key: 'tax_rate', label: 'GST Tax Rate (%)', category: 'Tax & Compliance' },
  { key: 'created_at', label: 'Record Created Date', category: 'Audit' }
];

const FINISHED_GOODS_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'name', label: 'Finished Good Name', category: 'Product Identifiers' },
  { key: 'unit', label: 'Base Unit of Measure', category: 'Product Identifiers' },
  { key: 'default_price', label: 'Default Catalog Price', category: 'Pricing' },
  { key: 'available_stock', label: 'Available Inventory Stock', category: 'Inventory' },
  { key: 'reorder_level', label: 'Reorder Level Threshold', category: 'Inventory' },
  { key: 'stock_status', label: 'Stock Health Status', category: 'Inventory' },
  { key: 'hsn_code', label: 'HSN Code', category: 'Tax & Compliance' },
  { key: 'created_at', label: 'Creation Date', category: 'Audit' }
];

interface ContactPerson {
  local_id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
}

function CatalogModal({
  config,
  onClose,
  onSaved
}: {
  config: { type: 'vendor' | 'item' | 'product' | 'stage'; row?: any };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const currencySymbol = getCurrencySymbol(workspace?.currency);
  const [codeUserEdited, setCodeUserEdited] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({
    name: config.row?.name || '',
    vendor_code: config.row?.vendor_code || (config.type === 'vendor' ? 'VEN-0001' : ''),
    code: config.row?.code || (config.type === 'item' ? 'SKU-0001' : ''),
    contact_person_name: config.row?.contact_person_name || config.row?.contact || '',
    phone: config.row?.phone || '',
    email: config.row?.email || '',
    address_line1: config.row?.address_line1 || config.row?.address || '',
    gstin: config.row?.gstin || '',
    state: config.row?.state || '',
    pan: config.row?.pan || '',
    payment_terms: config.row?.payment_terms || 'Net 30',
    item_type: config.row?.item_type || 'Raw Material',
    unit: config.row?.unit || 'kg',
    hsn_code: config.row?.hsn_code || '',
    tax_rate: config.row?.tax_rate ?? 18,
    reorder_level: config.row?.reorder_level ?? '',
    default_price: config.row?.default_price ?? '',
    last_purchase_price: config.row?.last_purchase_price ?? '',
    status: config.row?.status || 'Active',
    sequence_order: config.row?.sequence_order ?? 1,
    is_final_stage: Boolean(config.row?.is_final_stage)
  });

  // Auto-fetch next sequential code if adding a new vendor or item
  useEffect(() => {
    if (!config.row?.id) {
      if (config.type === 'vendor') {
        api.get('/api/numbering-series/next/vendor')
          .then(res => {
            if (res.data?.next_code) {
              setForm(prev => ({
                ...prev,
                vendor_code: codeUserEdited ? prev.vendor_code : res.data.next_code
              }));
            }
          })
          .catch(() => {});
      } else if (config.type === 'item') {
        api.get('/api/numbering-series/next/item')
          .then(res => {
            if (res.data?.next_code) {
              setForm(prev => ({
                ...prev,
                code: codeUserEdited ? prev.code : res.data.next_code
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, [config.type, config.row?.id, codeUserEdited]);

  const [contacts, setContacts] = useState<ContactPerson[]>(() => {
    let parsedContacts: any[] = [];
    if (Array.isArray(config.row?.contacts)) {
      parsedContacts = config.row.contacts;
    } else if (typeof config.row?.contacts === 'string' && config.row.contacts.trim()) {
      try {
        const parsed = JSON.parse(config.row.contacts);
        if (Array.isArray(parsed)) parsedContacts = parsed;
      } catch {}
    }
    if (parsedContacts.length > 0) {
      return parsedContacts.map((c: any) => ({
        local_id: c.local_id || generateUUID(),
        name: c.name || '',
        phone: c.phone || '',
        email: c.email || '',
        role: c.role || 'Primary Contact'
      }));
    }
    return [
      {
        local_id: generateUUID(),
        name: config.row?.contact_person_name || config.row?.contact || '',
        phone: config.row?.phone || config.row?.contact || '',
        email: config.row?.email || '',
        role: 'Primary Contact'
      }
    ];
  });

  const endpoint =
    config.type === 'vendor'
      ? '/api/vendors'
      : config.type === 'item'
      ? '/api/items'
      : '/api/finished-goods';

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { local_id: generateUUID(), name: '', phone: '', email: '', role: 'Accounts / Billing' }
    ]);
  };

  const removeContact = (localId: string) => {
    setContacts((prev) => prev.filter((c) => c.local_id !== localId));
  };

  const updateContact = (localId: string, field: keyof ContactPerson, value: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.local_id === localId ? { ...c, [field]: value } : c))
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload: any = { name: form.name.trim() };

      if (config.type === 'vendor') {
        payload.vendor_code = form.vendor_code ? form.vendor_code.trim() : null;
        payload.contact_person_name = form.contact_person_name ? form.contact_person_name.trim() : null;
        payload.phone = form.phone ? form.phone.trim() : null;
        payload.email = form.email ? form.email.trim() : null;
        payload.address_line1 = form.address_line1 ? form.address_line1.trim() : null;
        payload.gstin = form.gstin ? form.gstin.trim().toUpperCase() : null;
        payload.state = form.state ? form.state.trim() : null;
        payload.pan = form.pan ? form.pan.trim().toUpperCase() : null;
        payload.payment_terms = form.payment_terms;
        payload.contacts = contacts.filter((c) => c.name || c.phone || c.email);
      } else if (config.type === 'item') {
        payload.code = form.code ? form.code.trim() : null;
        payload.item_type = form.item_type;
        payload.unit = form.unit;
        payload.hsn_code = form.hsn_code ? form.hsn_code.trim() : null;
        payload.tax_rate = Number(form.tax_rate) || 18;
        payload.reorder_level = form.reorder_level === '' ? null : Number(form.reorder_level);
        payload.last_purchase_price = form.last_purchase_price === '' ? null : Number(form.last_purchase_price);
        payload.default_price = form.default_price === '' ? null : Number(form.default_price);
        payload.status = form.status || 'Active';
      } else if (config.type === 'stage') {
        payload.sequence_order = Number(form.sequence_order);
        payload.is_final_stage = form.is_final_stage;
      } else {
        payload.unit = form.unit;
        payload.hsn_code = form.hsn_code ? form.hsn_code.trim() : null;
        payload.reorder_level = form.reorder_level === '' ? null : Number(form.reorder_level);
        payload.default_price = form.default_price === '' ? null : Number(form.default_price);
      }

      if (config.row?.id) await api.put(`${endpoint}/${config.row.id}`, payload);
      else await api.post(endpoint, payload);

      toast('Catalog record saved');
      onSaved();
    } catch (error: any) {
      toast(error.response?.data?.error || 'Unable to save record', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <Modal title={config.row ? 'Edit Record' : 'Add Record'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {config.type === 'vendor' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Vendor Code">
                <input
                  className={`${inputCls} font-mono font-medium`}
                  placeholder="VEN-0001"
                  value={form.vendor_code}
                  onChange={(e) => {
                    setCodeUserEdited(true);
                    setForm({ ...form, vendor_code: e.target.value });
                  }}
                />
              </Field>
              <Field label="Legal Vendor Name">
                <input className={inputCls} required placeholder="e.g. Apex Trading Corp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Email Address">
                <input className={inputCls} type="email" placeholder="billing@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Primary Phone">
                <input className={inputCls} placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="15-Char GSTIN">
                <input className={inputCls} placeholder="07AAAAA0000A1Z5" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Registered State">
                <input className={inputCls} placeholder="Delhi, Maharashtra" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </Field>
              <Field label="PAN Number">
                <input className={inputCls} placeholder="ABCDE1234F" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <Field label="Payment Terms">
              <Select
                value={form.payment_terms}
                onChange={(val) => setForm({ ...form, payment_terms: val })}
                options={[
                  { value: 'Advance', label: 'Advance' },
                  { value: 'Net 15', label: 'Net 15' },
                  { value: 'Net 30', label: 'Net 30' },
                  { value: 'Net 45', label: 'Net 45' },
                  { value: 'Net 60', label: 'Net 60' }
                ]}
              />
            </Field>
            <Field label="Full Business Address">
              <textarea className={`${inputCls} min-h-[60px]`} placeholder="Complete street address..." value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
            </Field>

            {/* Multiple Contact Persons Sub-Form */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Contact Persons ({contacts.length})
                </label>
                <button type="button" onClick={addContact} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                  <Plus size={14} /> Add Contact Person
                </button>
              </div>
              <div className="space-y-2">
                {contacts.map((c, idx) => (
                  <div key={c.local_id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      <Field label={`Contact #${idx + 1} Name`}>
                        <input className={inputCls} placeholder="Name" value={c.name} onChange={(e) => updateContact(c.local_id, 'name', e.target.value)} />
                      </Field>
                      <Field label="Phone">
                        <input className={inputCls} placeholder="Phone" value={c.phone} onChange={(e) => updateContact(c.local_id, 'phone', e.target.value)} />
                      </Field>
                      <Field label="Email">
                        <input className={inputCls} type="email" placeholder="Email" value={c.email} onChange={(e) => updateContact(c.local_id, 'email', e.target.value)} />
                      </Field>
                      <Field label="Role">
                        <input className={inputCls} placeholder="Role" value={c.role} onChange={(e) => updateContact(c.local_id, 'role', e.target.value)} />
                      </Field>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeContact(c.local_id)} className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer">
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : config.type === 'item' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="SKU / Item Code">
                <input
                  className={`${inputCls} font-mono font-medium`}
                  placeholder="e.g. SKU-0001"
                  value={form.code}
                  onChange={(e) => {
                    setCodeUserEdited(true);
                    setForm({ ...form, code: e.target.value });
                  }}
                />
              </Field>
              <Field label="Purchasing Item Name" required>
                <input className={inputCls} required placeholder="e.g. Steel Wire" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Category / Type">
                <Select
                  value={form.item_type}
                  onChange={(val) => setForm({ ...form, item_type: val })}
                  options={[
                    { value: 'Raw Material', label: 'Raw Material' },
                    { value: 'Consumable', label: 'Consumable' },
                    { value: 'Packaging Material', label: 'Packaging Material' },
                    { value: 'Finished Good', label: 'Finished Good' },
                    { value: 'Other', label: 'Other' }
                  ]}
                />
              </Field>
              <Field label="Unit of Measure" required>
                <input className={inputCls} required placeholder="kg, pcs, liters" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </Field>
              <Field label="HSN / SAC Code">
                <input className={inputCls} placeholder="e.g. 7217" value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="GST Tax Rate (%)">
                <Select
                  value={String(form.tax_rate)}
                  onChange={(val) => setForm({ ...form, tax_rate: val })}
                  options={[
                    { value: '0', label: '0%' },
                    { value: '5', label: '5%' },
                    { value: '12', label: '12%' },
                    { value: '18', label: '18%' },
                    { value: '28', label: '28%' }
                  ]}
                />
              </Field>
              <Field label="Reorder Level Threshold">
                <input className={inputCls} inputMode="decimal" placeholder="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </Field>
              <Field label={`Unit / Purchase Price (${currencySymbol})`}>
                <input className={inputCls} inputMode="decimal" placeholder="0.00" value={form.last_purchase_price} onChange={(e) => setForm({ ...form, last_purchase_price: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label={`Catalog Selling Price (${currencySymbol})`}>
                <input className={inputCls} inputMode="decimal" placeholder="0.00" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val })}
                  options={[
                    { value: 'Active', label: 'Active' },
                    { value: 'Inactive', label: 'Inactive' }
                  ]}
                />
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Product Name" required>
              <input className={inputCls} required placeholder="e.g. Steel Springs (Packaged)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Base Unit of Measure" required>
                <input className={inputCls} required placeholder="pcs, kg, liters" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </Field>
              <Field label="HSN Code">
                <input className={inputCls} placeholder="e.g. 7320" value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} />
              </Field>
              <Field label={`Default Selling Price (${currencySymbol})`}>
                <input className={inputCls} inputMode="decimal" placeholder="0.00" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Reorder Level Threshold">
                <input className={inputCls} inputMode="decimal" placeholder="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
              </Field>
            </div>
          </>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="submit" icon={<Check size={16} />}>Save Record</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich Item Details Drawer (View Detail Sidebar)
// ─────────────────────────────────────────────────────────────────────────────
function ItemDetailDrawer({
  item,
  onClose,
  onEdit
}: {
  item: any;
  onClose: () => void;
  onEdit?: (item: any) => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [detail, setDetail] = useState<any>(item);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item?.id) return;
    setLoading(true);
    api.get(`/api/items/${item.id}`)
      .then((res) => setDetail(res.data))
      .catch(() => setDetail(item))
      .finally(() => setLoading(false));
  }, [item.id]);

  const stock = Number(detail.current_stock ?? item.current_stock ?? 0);
  const reorder = Number(detail.reorder_level ?? item.reorder_level ?? 0);
  const isOut = stock <= 0;
  const isLow = reorder > 0 && stock <= reorder;

  const unitCost = Number(detail.last_purchase_price || detail.weighted_average_cost || 0);
  const valuation = stock * unitCost;
  const vendors = detail.price_history_vendors || detail.supplying_vendors || [];

  return (
    <Drawer title={`Item Details: ${detail.name}`} onClose={onClose} width="max-w-2xl sm:max-w-3xl">
      <div className="space-y-6 pb-6 text-slate-800 text-sm">
        {/* 1. Executive Hero Header */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl text-white shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Catalog Item
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-900/60 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  <Tag size={11} /> {detail.item_type || 'Raw Material'}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  (detail.status || 'Active') === 'Active'
                    ? 'text-emerald-300 bg-emerald-900/60 border-emerald-500/30'
                    : 'text-slate-300 bg-slate-800 border-slate-600'
                }`}>
                  <ShieldCheck size={11} /> {detail.status || 'Active'}
                </span>
              </div>
              <h3 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
                <Package2 className="w-5 h-5 text-blue-400 shrink-0" />
                {detail.name}
              </h3>
              {detail.code && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-300 font-mono">
                  <span>SKU: <strong>{detail.code}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(detail.code);
                      toast(`Copied SKU: ${detail.code}`, 'success');
                    }}
                    className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
                    title="Copy SKU"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-400 block mb-0.5">Est. Total Valuation</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {formatCurrency(valuation, workspace?.currency)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                {formatNumber(stock)} {detail.unit || 'units'} in stock
              </span>
            </div>
          </div>

          {/* Header Quick Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Base Unit:</span>
              <strong className="text-white font-medium flex items-center gap-1 mt-0.5">
                <Box size={12} className="text-blue-400 shrink-0" />
                {detail.unit || 'Unit'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">HSN / SAC Code:</span>
              <strong className="text-white font-mono font-medium mt-0.5 block">
                {detail.hsn_code || 'N/A'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">GST Rate:</span>
              <strong className="text-white font-medium mt-0.5 block">
                {detail.tax_rate !== undefined && detail.tax_rate !== null ? `${detail.tax_rate}%` : '18%'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Created On:</span>
              <strong className="text-white font-medium flex items-center gap-1 mt-0.5">
                <Calendar size={12} className="text-slate-400 shrink-0" />
                {detail.created_at ? formatDate(detail.created_at) : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Stock Health & Inventory KPI Strip */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
            <Layers size={14} className="text-blue-600" /> Real-time Stock & Inventory Health
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Current Stock */}
            <div className={`p-3.5 rounded-2xl border transition ${
              isOut ? 'bg-rose-50/70 border-rose-200' : isLow ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <span className="text-[11px] font-semibold text-slate-600 uppercase block">Available Stock</span>
              <strong className={`text-xl font-mono block mt-0.5 ${
                isOut ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                {formatNumber(stock)} {detail.unit || 'units'}
              </strong>
              <div className="mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 ${
                  isOut ? 'bg-rose-100 text-rose-800' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {isOut ? <XCircle size={10} /> : isLow ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                  {isOut ? 'Out of Stock' : isLow ? 'Low Stock Warning' : 'Healthy Stock Level'}
                </span>
              </div>
            </div>

            {/* Reorder Threshold */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Reorder Level Threshold</span>
              <strong className="text-xl font-mono text-slate-900 block mt-0.5">
                {reorder > 0 ? `${formatNumber(reorder)} ${detail.unit || 'units'}` : 'Not Set'}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-1">
                {reorder > 0 && stock <= reorder ? (
                  <strong className="text-amber-600">Reorder required ({formatNumber(reorder - stock)} needed)</strong>
                ) : reorder > 0 ? (
                  'Stock is comfortably above reorder level'
                ) : (
                  'Set threshold to receive low-stock alerts'
                )}
              </span>
            </div>

            {/* Stock Valuation */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total Warehouse Valuation</span>
              <strong className="text-xl font-mono text-slate-900 block mt-0.5">
                {formatCurrency(valuation, workspace?.currency)}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                At unit cost {formatCurrency(unitCost, workspace?.currency)} / {detail.unit || 'unit'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Costing, Valuation & Pricing Architecture */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
            <CircleDollarSign size={14} className="text-blue-600" /> Costing & Valuation Architecture
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Last Purchase Price</span>
              <strong className="font-mono text-base font-bold text-slate-900 block">
                {detail.last_purchase_price ? formatCurrency(detail.last_purchase_price, workspace?.currency) : '—'}
              </strong>
              <span className="text-[10px] text-slate-400 block">From most recent procurement</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Weighted Average Cost (WAC)</span>
              <strong className="font-mono text-base font-bold text-blue-700 block">
                {detail.weighted_average_cost ? formatCurrency(detail.weighted_average_cost, workspace?.currency) : (detail.last_purchase_price ? formatCurrency(detail.last_purchase_price, workspace?.currency) : '—')}
              </strong>
              <span className="text-[10px] text-slate-400 block">Weighted average across POs</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Catalog Selling Price</span>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(detail)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                    title="Configure selling price"
                  >
                    {detail.default_price ? 'Edit' : 'Configure'}
                  </button>
                )}
              </div>
              <strong className="font-mono text-base font-bold text-slate-900 block">
                {detail.default_price ? formatCurrency(detail.default_price, workspace?.currency) : 'Not configured'}
              </strong>
              <span className="text-[10px] text-slate-400 block">Standard customer list price</span>
            </div>
          </div>
        </div>

        {/* 4. Supplying Vendors & Price History */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Building2 size={14} className="text-blue-600" /> Supplying Vendors & Purchase Price History
            </h4>
            <span className="text-slate-500 font-medium text-[11px]">
              {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'} logged
            </span>
          </div>

          {loading ? (
            <div className="p-5 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin text-blue-600" />
              <span>Loading supplier price history...</span>
            </div>
          ) : vendors.length > 0 ? (
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white shadow-2xs">
              {vendors.map((v: any, idx: number) => (
                <div key={idx} className="p-3.5 hover:bg-slate-50/50 transition flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 font-semibold text-sm">{v.vendor_name}</strong>
                      {v.vendor_code && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {v.vendor_code}
                        </span>
                      )}
                      {v.is_preferred_vendor && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Award size={11} /> Preferred
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      {v.vendor_item_code && (
                        <span>Vendor SKU: <strong className="font-mono text-slate-700">{v.vendor_item_code}</strong></span>
                      )}
                      {v.last_po_number && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          PO: {v.last_po_number}
                        </span>
                      )}
                      {v.total_orders > 0 && (
                        <span className="text-slate-500">
                          ({v.total_orders} {v.total_orders === 1 ? 'order' : 'orders'})
                        </span>
                      )}
                      {v.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} className="text-slate-400" /> {v.phone}
                        </span>
                      )}
                      {v.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={11} className="text-slate-400" /> {v.email}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Last Purchase Rate</span>
                    <strong className="font-mono text-sm font-bold text-emerald-700 block">
                      {v.last_purchase_price ? `${formatCurrency(v.last_purchase_price, workspace?.currency)} / ${detail.unit || 'unit'}` : '—'}
                    </strong>
                    {v.last_purchase_date && (
                      <span className="text-[10px] text-slate-400 font-mono block">
                        on {formatDate(v.last_purchase_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 space-y-1">
              <Info size={16} className="mx-auto text-slate-400 mb-1" />
              <p className="font-semibold text-slate-700">No vendor purchase history logged yet</p>
              <p className="text-[11px] text-slate-400">
                When purchase orders and vendor bills are recorded for this item, vendor rates and last purchase dates will automatically appear here.
              </p>
            </div>
          )}
        </div>

        {/* 5. Drawer Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          {onEdit && (
            <Button
              type="button"
              icon={<Edit3 size={14} />}
              onClick={() => onEdit(detail)}
              className="text-xs font-bold"
            >
              Edit Item
            </Button>
          )}

          <Button variant="secondary" onClick={onClose} className="px-5 text-xs font-bold">
            Close
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich Finished Good Details Drawer (View Detail Sidebar)
// ─────────────────────────────────────────────────────────────────────────────
function ProductDetailDrawer({
  product,
  onClose,
  onEdit,
  onManagePackaging
}: {
  product: any;
  onClose: () => void;
  onEdit?: (prod: any) => void;
  onManagePackaging?: (prod: any) => void;
}) {
  const { workspace } = useWorkspace();
  const [configs, setConfigs] = useState<any[]>([]);

  useEffect(() => {
    if (!product?.id) return;
    api.get(`/api/packaging-configs?product_id=${product.id}`)
      .then((res) => setConfigs(res.data || []))
      .catch(() => {});
  }, [product.id]);

  const stock = Number(product.available_stock ?? product.current_stock ?? 0);
  const reorder = Number(product.reorder_level ?? 0);
  const defaultPrice = Number(product.default_price || 0);
  const totalValuation = stock * defaultPrice;
  const isOut = stock <= 0;
  const isLow = reorder > 0 && stock <= reorder;

  return (
    <Drawer title={`Finished Good: ${product.name}`} onClose={onClose} width="max-w-2xl sm:max-w-3xl">
      <div className="space-y-6 pb-6 text-slate-800 text-sm">
        {/* Header Hero */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl text-white shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Manufactured Finished Good
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <Box size={11} /> Ready for Dispatch
                </span>
              </div>
              <h3 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
                <Package2 className="w-5 h-5 text-emerald-400 shrink-0" />
                {product.name}
              </h3>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-400 block mb-0.5">Catalog Selling Price</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {formatCurrency(defaultPrice, workspace?.currency)}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                per {product.unit || 'unit'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Base Unit of Measure:</span>
              <strong className="text-white font-medium flex items-center gap-1 mt-0.5">
                <Box size={12} className="text-blue-400 shrink-0" />
                {product.unit || 'units'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">HSN Code:</span>
              <strong className="text-white font-mono font-medium mt-0.5 block">
                {product.hsn_code || 'N/A'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Available Stock:</span>
              <strong className={`font-mono font-bold mt-0.5 block ${isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatNumber(stock)} {product.unit || 'units'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Package Variants:</span>
              <strong className="text-white font-medium mt-0.5 block">
                {configs.length} package sizes
              </strong>
            </div>
          </div>
        </div>

        {/* Stock & Valuation KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-3.5 rounded-2xl border ${
            isOut ? 'bg-rose-50/70 border-rose-200' : isLow ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
          }`}>
            <span className="text-[11px] font-semibold text-slate-600 uppercase block">Current Finished Stock</span>
            <strong className={`text-xl font-mono block mt-0.5 ${
              isOut ? 'text-rose-700' : isLow ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {formatNumber(stock)} {product.unit || 'units'}
            </strong>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 mt-1 ${
              isOut ? 'bg-rose-100 text-rose-800' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Ready in Stock'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">Reorder Level Threshold</span>
            <strong className="text-xl font-mono text-slate-900 block mt-0.5">
              {reorder > 0 ? `${formatNumber(reorder)} ${product.unit || 'units'}` : 'Not Set'}
            </strong>
            <span className="text-[10px] text-slate-400 block mt-1">
              {reorder > 0 && stock <= reorder ? (
                <strong className="text-amber-600">Reorder required ({formatNumber(reorder - stock)} needed)</strong>
              ) : 'Above reorder threshold'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase block">Stock Value (at Selling Price)</span>
            <strong className="text-xl font-mono text-slate-900 block mt-0.5">
              {formatCurrency(totalValuation, workspace?.currency)}
            </strong>
            <span className="text-[10px] text-slate-400 block mt-1 font-mono">
              {formatNumber(stock)} × {formatCurrency(defaultPrice, workspace?.currency)}
            </span>
          </div>
        </div>

        {/* Packaging Configurations Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Box size={14} className="text-blue-600" /> Configured Packaging & Bundle Sizes
            </h4>
            {onManagePackaging && (
              <Button
                type="button"
                variant="secondary"
                icon={<Box size={13} />}
                onClick={() => onManagePackaging(product)}
                className="text-xs font-semibold py-1 px-3 cursor-pointer"
              >
                Configure Packages
              </Button>
            )}
          </div>

          {configs.length > 0 ? (
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white shadow-2xs">
              {configs.map((c: any) => {
                const pkgPrice = Number(c.selling_price || 0);
                const mrp = Number(c.mrp || 0);
                const units = Number(c.units_per_package || 1);
                const effectiveUnitRate = units > 0 && pkgPrice > 0 ? (pkgPrice / units) : 0;

                return (
                  <div key={c.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50/50 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 font-bold text-sm">{c.package_name}</strong>
                        {Boolean(c.parent_config_id || (c.fill_unit && c.fill_unit.toLowerCase() !== (product.unit || '').toLowerCase())) ? (
                          <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                            1 {c.package_unit} = {formatNumber(c.fill_quantity || units)} {c.parent_package_unit || c.fill_unit} (= {formatNumber(units)} {product.unit || 'units'})
                          </span>
                        ) : (
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                            1 {c.package_unit} = {formatNumber(units)} {product.unit || 'units'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {effectiveUnitRate > 0 && (
                          <span>
                            Unit Rate: <strong className="text-slate-700 font-mono">{formatCurrency(effectiveUnitRate, workspace?.currency)} / {product.unit || 'unit'}</strong>
                          </span>
                        )}
                        {mrp > 0 && (
                          <span>
                            MRP: <span className="line-through text-slate-400 font-mono">{formatCurrency(mrp, workspace?.currency)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Package Selling Price</span>
                      <strong className="font-mono text-sm font-bold text-emerald-700 block">
                        {pkgPrice > 0 ? formatCurrency(pkgPrice, workspace?.currency) : 'Not configured'}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">No packaging sizes configured yet</p>
              <p className="text-[11px] text-slate-400">
                Click "Configure Packages" above to define package sizes (e.g. 1 Box = 100 Pcs, 1 Packet = 50 Pcs).
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          {onEdit && (
            <Button
              type="button"
              icon={<Edit3 size={14} />}
              onClick={() => onEdit(product)}
              className="text-xs font-bold"
            >
              Edit Product
            </Button>
          )}

          <Button variant="secondary" onClick={onClose} className="px-5 text-xs font-bold">
            Close
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Catalog & Items Page
// ─────────────────────────────────────────────────────────────────────────────
export function CatalogPage({ user: _user }: { user?: any } = {}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [tab, setTab] = usePersistentTab<'items' | 'products'>('catalog_tab', 'items');
  const [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState<null | { type: 'item' | 'product'; row?: any }>(null);
  const [packagingModalProduct, setPackagingModalProduct] = useState<any | null>(null);

  // View Detail Drawer State
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  // Compute dynamic module permissions for Catalog (Item & Raw Material Catalog)
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissions('catalog');

  // Column-Selective Export Modal State
  const [exportModalData, setExportModalData] = useState<{
    selectedRows: any[];
    selectAllAcrossPages: boolean;
    total: number;
    getExportData: () => Promise<any[]>;
  } | null>(null);

  // Filter States
  const [selectedType, setSelectedType] = useState('');
  const [selectedStockStatus, setSelectedStockStatus] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const hasActiveFilters = Boolean(selectedType || selectedStockStatus || selectedStatus);

  const clearFilters = () => {
    setSelectedType('');
    setSelectedStockStatus('');
    setSelectedStatus('');
  };

  const itemColumns: TableColumn<any>[] = [
    {
      key: 'code',
      label: 'SKU Code',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedDetailItem(row); }}
          className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
          title="Click to view full item details"
        >
          {row.code || '—'}
        </button>
      )
    },
    {
      key: 'name',
      label: 'Item Name',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedDetailItem(row); }}
          className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left transition"
        >
          {row.name}
        </button>
      )
    },
    {
      key: 'item_type',
      label: 'Category',
      sortable: true,
      render: (row) => (
        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
          {row.item_type || 'Raw Material'}
        </span>
      )
    },
    {
      key: 'current_stock',
      label: 'Current Stock',
      align: 'right',
      sortable: true,
      render: (row) => {
        const stock = Number(row.current_stock ?? 0);
        const reorder = Number(row.reorder_level ?? 0);
        const isOut = stock <= 0;
        const isLow = reorder > 0 && stock <= reorder;

        return (
          <div className="text-right">
            <span className={`font-mono text-xs font-bold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatNumber(stock)} {row.unit || ''}
            </span>
            {isOut ? (
              <span className="text-[10px] text-rose-500 font-semibold block">Out of Stock</span>
            ) : isLow ? (
              <span className="text-[10px] text-amber-600 font-semibold block">Low Stock Alert</span>
            ) : null}
          </div>
        );
      }
    },
    {
      key: 'unit',
      label: 'UOM',
      render: (row) => <span className="text-slate-500 text-xs">{row.unit || 'unit'}</span>
    },
    {
      key: 'last_purchase_price',
      label: 'Unit Cost',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {row.last_purchase_price ? formatCurrency(row.last_purchase_price, workspace?.currency) : '—'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${
          (row.status || 'Active') === 'Active'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}>
          {row.status || 'Active'}
        </span>
      )
    }
  ];

  const productColumns: TableColumn<any>[] = [
    {
      key: 'name',
      label: 'Finished Good Name',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSelectedDetailItem(row); }}
          className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left transition"
        >
          {row.name}
        </button>
      )
    },
    {
      key: 'available_stock',
      label: 'Available Stock',
      align: 'right',
      sortable: true,
      render: (row) => {
        const stock = Number(row.available_stock ?? row.current_stock ?? 0);
        const reorder = Number(row.reorder_level ?? 0);
        const isOut = stock <= 0;
        const isLow = reorder > 0 && stock <= reorder;

        return (
          <div className="text-right">
            <span className={`font-mono text-xs font-bold ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatNumber(stock)} {row.unit || ''}
            </span>
            {isOut ? (
              <span className="text-[10px] text-rose-500 font-semibold block">Out of Stock</span>
            ) : isLow ? (
              <span className="text-[10px] text-amber-600 font-semibold block">Low Stock</span>
            ) : null}
          </div>
        );
      }
    },
    { key: 'unit', label: 'Base Unit', render: (row) => <span className="text-slate-500 text-xs font-semibold">{row.unit || 'unit'}</span> },
    {
      key: 'default_price',
      label: 'Selling Prices (Base & Packages)',
      sortable: true,
      render: (row) => {
        const pkgs = row.packaging_configs || [];
        const basePrice = Number(row.default_price || 0);

        return (
          <div className="space-y-1 text-xs min-w-[210px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                Base ({row.unit || 'unit'})
              </span>
              <strong className="font-mono font-bold text-emerald-700">
                {basePrice > 0 ? formatCurrency(basePrice, workspace?.currency) : 'Not configured'}
              </strong>
            </div>

            {pkgs.length > 0 && (
              <div className="space-y-0.5 pt-1 border-t border-slate-100">
                {pkgs.map((pkg: any) => {
                  const pkgPrice = Number(pkg.selling_price || 0);
                  const isNested = Boolean(pkg.parent_config_id || (pkg.fill_unit && pkg.fill_unit.toLowerCase() !== (row.unit || '').toLowerCase()));
                  const convLabel = isNested
                    ? `${pkg.fill_quantity || pkg.units_per_package} ${pkg.parent_package_unit || pkg.fill_unit} = ${formatNumber(pkg.units_per_package)} ${row.unit || 'u'}`
                    : `${formatNumber(pkg.units_per_package)} ${row.unit || 'u'}`;

                  return (
                    <div key={pkg.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-600 truncate max-w-[180px]" title={`${pkg.package_name} (${convLabel})`}>
                        📦 <span className="font-medium text-slate-800">{pkg.package_name}</span>{' '}
                        <span className="text-slate-400 text-[10px]">({convLabel})</span>:
                      </span>
                      <strong className="font-mono font-bold text-blue-700 whitespace-nowrap">
                        {pkgPrice > 0 ? formatCurrency(pkgPrice, workspace?.currency) : '₹0.00'}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions_pkg',
      label: 'Packaging Config',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPackagingModalProduct(row); }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition border border-blue-200 cursor-pointer shadow-2xs"
        >
          <Box size={13} /> Manage Packages
          {row.packaging_configs && row.packaging_configs.length > 0 && (
            <span className="ml-0.5 bg-blue-200/70 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {row.packaging_configs.length}
            </span>
          )}
        </button>
      )
    }
  ];

  const endpoint = tab === 'items' ? '/api/items' : '/api/finished-goods';
  const columns = tab === 'items' ? itemColumns : productColumns;

  // Extra Filter Controls Bar
  const renderExtraFilters = () => (
    <div className="flex flex-wrap items-center gap-2">
      {tab === 'items' && (
        <div className="w-40">
          <Select
            value={selectedType}
            onChange={setSelectedType}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'Raw Material', label: 'Raw Material' },
              { value: 'Consumable', label: 'Consumable' },
              { value: 'Packaging Material', label: 'Packaging Material' },
              { value: 'Finished Good', label: 'Finished Good' },
              { value: 'Other', label: 'Other' }
            ]}
          />
        </div>
      )}

      <div className="w-40">
        <Select
          value={selectedStockStatus}
          onChange={setSelectedStockStatus}
          options={[
            { value: '', label: 'All Stock Levels' },
            { value: 'in_stock', label: 'In Stock (> 0)' },
            { value: 'low_stock', label: 'Low Stock Alert' },
            { value: 'out_of_stock', label: 'Out of Stock (0)' }
          ]}
        />
      </div>

      {tab === 'items' && (
        <div className="w-32">
          <Select
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[
              { value: '', label: 'All Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
          />
        </div>
      )}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1.5 hover:bg-blue-50 rounded-lg transition cursor-pointer border border-blue-200"
        >
          Clear Filters
        </button>
      )}
    </div>
  );

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Catalog module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<Package2 />}
        title="Catalog & Items"
        subtitle="Manage purchasing items, raw materials, valuation, packaging configurations, and finished goods."
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <button
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${
              tab === 'items' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setTab('items');
              clearFilters();
            }}
          >
            Purchasing Items
          </button>
          <button
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer ${
              tab === 'products' ? 'bg-blue-50 text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setTab('products');
              clearFilters();
            }}
          >
            Finished Goods
          </button>
        </div>
      </div>

      {/* Unified DataTable with Filters, Detail Drawer & Dynamic Column-Selective Export */}
      <DataTable
        endpoint={endpoint}
        columns={columns}
        filters={{
          item_type: selectedType || undefined,
          stock_status: selectedStockStatus || undefined,
          status: selectedStatus || undefined
        }}
        extraFilters={renderExtraFilters()}
        refreshKey={refresh}
        showDateFilters={false}
        rowId={(row) => String(row.id || '')}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canExport={canExport}
        onCreate={canCreate ? () => setModal({ type: tab === 'items' ? 'item' : 'product' }) : undefined}
        onView={(row) => setSelectedDetailItem(row)}
        onEdit={canEdit ? (row) => setModal({ type: tab === 'items' ? 'item' : 'product', row }) : undefined}
        onDelete={canDelete ? async (row) => {
          await api.delete(`${endpoint}/${row.id}`);
          toast('Record deleted');
        } : undefined}
        onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
        createLabel={`Add ${tab === 'items' ? 'Item' : 'Product'}`}
        emptyTitle={`No ${tab} records found`}
      />

      {/* View Detail Sidebar Drawer */}
      {selectedDetailItem && tab === 'items' && (
        <ItemDetailDrawer
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onEdit={canEdit ? (item) => {
            setSelectedDetailItem(null);
            setModal({ type: 'item', row: item });
          } : undefined}
        />
      )}

      {selectedDetailItem && tab === 'products' && (
        <ProductDetailDrawer
          product={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onEdit={canEdit ? (prod) => {
            setSelectedDetailItem(null);
            setModal({ type: 'product', row: prod });
          } : undefined}
          onManagePackaging={canEdit ? (prod) => {
            setSelectedDetailItem(null);
            setPackagingModalProduct(prod);
          } : undefined}
        />
      )}

      {/* Column-Selective Export Modal */}
      {exportModalData && (
        <ExportColumnModal
          title={tab === 'items' ? 'Export Catalog Items to CSV' : 'Export Finished Goods to CSV'}
          recordCount={exportModalData.total}
          availableColumns={tab === 'items' ? ITEM_EXPORT_COLUMNS : FINISHED_GOODS_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const exportCols: TableColumn<any>[] = (tab === 'items' ? ITEM_EXPORT_COLUMNS : FINISHED_GOODS_EXPORT_COLUMNS)
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));

            const formatted = records.map((r: any) => {
              const stock = Number(r.current_stock ?? r.available_stock ?? 0);
              const reorder = Number(r.reorder_level ?? 0);
              const stockHealth = stock <= 0 ? 'Out of Stock' : (reorder > 0 && stock <= reorder) ? 'Low Stock' : 'In Stock';
              const unitCost = Number(r.last_purchase_price || r.weighted_average_cost || 0);

              return {
                ...r,
                current_stock: stock,
                available_stock: stock,
                stock_status: stockHealth,
                inventory_valuation: stock * unitCost,
                last_purchase_price: r.last_purchase_price ?? '',
                weighted_average_cost: r.weighted_average_cost ?? '',
                default_price: r.default_price ?? '',
                tax_rate: r.tax_rate ? `${r.tax_rate}%` : '',
                created_at: r.created_at ? formatDate(r.created_at) : ''
              };
            });

            csvDownload(
              `${tab === 'items' ? 'catalog_items' : 'finished_goods'}_export_${new Date().toISOString().slice(0, 10)}.csv`,
              exportCols,
              formatted
            );
            toast(`Exported ${records.length} records successfully`);
            setExportModalData(null);
          }}
        />
      )}

      {/* Create / Edit Record Modal */}
      {modal ? (
        <CatalogModal
          config={modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setRefresh((v) => v + 1);
            setModal(null);
          }}
        />
      ) : null}

      {/* Unified Recipe & Packaging Configuration Drawer */}
      {packagingModalProduct ? (
        <ProductRecipeConfig
          productId={packagingModalProduct.id}
          initialTab="packaging"
          onClose={() => setPackagingModalProduct(null)}
          onSaved={() => setRefresh((v) => v + 1)}
        />
      ) : null}
    </div>
  );
}

