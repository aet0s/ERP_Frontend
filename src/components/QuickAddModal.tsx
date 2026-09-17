import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { Modal } from './ui/Modal';
import { Field } from './ui/Field';
import { Button } from './ui/Button';

export function QuickAddModal({
  type,
  onClose,
  onCreated
}: {
  type: 'vendor' | 'customer' | 'material' | 'product';
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string>>({
    name: '',
    unit: 'kg',
    contact: '',
    address: '',
    default_price: '',
    reorder_level: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: ''
  });

  const config = {
    vendor: { title: 'Add Vendor', endpoint: '/api/vendors' },
    customer: { title: 'Add Customer', endpoint: '/api/customers' },
    material: { title: 'Add Raw Material', endpoint: '/api/raw-materials' },
    product: { title: 'Add Finished Good', endpoint: '/api/finished-goods' }
  }[type];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload: Record<string, any> = { name: form.name };
      if (type === 'vendor' || type === 'customer') {
        payload.contact = form.contact;
        payload.address = form.address;
        if (type === 'vendor') {
          payload.bank_account_name = form.bank_account_name;
          payload.bank_account_number = form.bank_account_number;
          payload.bank_ifsc = form.bank_ifsc ? form.bank_ifsc.toUpperCase() : '';
        }
      } else {
        payload.unit = form.unit;
        payload.reorder_level = form.reorder_level ? Number(form.reorder_level) : null;
      }
      if (type === 'product') payload.default_price = form.default_price ? Number(form.default_price) : null;
      await api.post(config.endpoint, payload);
      toast(`${config.title.replace('Add ', '')} created`);
      onCreated();
      onClose();
    } catch (error: any) {
      toast(error.response?.data?.error || 'Unable to create record', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <Modal title={config.title} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Name">
          <input required className={inputCls} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        {type === 'vendor' || type === 'customer' ? (
          <>
            <Field label="Contact">
              <input className={inputCls} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} />
            </Field>
            <Field label="Address">
              <input className={inputCls} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            {type === 'vendor' ? (
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Bank Details
                </label>
                <Field label="Bank Account Name">
                  <input className={inputCls} placeholder="Account Holder Name" value={form.bank_account_name} onChange={(event) => setForm({ ...form, bank_account_name: event.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank Account Number">
                    <input className={inputCls} placeholder="Account Number" value={form.bank_account_number} onChange={(event) => setForm({ ...form, bank_account_number: event.target.value })} />
                  </Field>
                  <Field label="Bank IFSC Code">
                    <input className={inputCls} placeholder="IFSC Code" value={form.bank_ifsc} onChange={(event) => setForm({ ...form, bank_ifsc: event.target.value.toUpperCase() })} />
                  </Field>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit">
                <input required className={inputCls} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
              </Field>
              <Field label="Reorder Level">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={form.reorder_level}
                  onChange={(event) => setForm({ ...form, reorder_level: event.target.value })}
                />
              </Field>
            </div>
            {type === 'product' ? (
              <Field label="Default Price">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={form.default_price}
                  onChange={(event) => setForm({ ...form, default_price: event.target.value })}
                />
              </Field>
            ) : null}
          </>
        )}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="submit" icon={<Check size={16} />}>
            Save Record
          </Button>
        </div>
      </form>
    </Modal>
  );
}
