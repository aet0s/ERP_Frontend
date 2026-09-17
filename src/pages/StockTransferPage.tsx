import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeftRight, Plus, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context';
import { formatNumber } from '../lib/utils';
import type { AnyRow, TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';

function StockTransferModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    from_location_id: '',
    to_location_id: '',
    item_type: 'raw_material',
    item_id: '',
    quantity: '',
    notes: ''
  });

  useEffect(() => {
    api.get('/api/locations').then((res) => setLocations(res.data || []));
  }, []);

  useEffect(() => {
    if (!form.item_type) return;
    api.get('/api/items', { params: { item_type: form.item_type } })
      .then((res) => setItems(res.data || []))
      .catch(() => setItems([]));
  }, [form.item_type]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.from_location_id === form.to_location_id) {
      toast('Source and destination locations must be different', 'error');
      return;
    }
    try {
      await api.post('/api/stock-transfers', {
        ...form,
        quantity: Number(form.quantity)
      });
      toast('Stock transfer executed successfully');
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to execute stock transfer', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <Modal title="New Stock Transfer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From Location (Source)">
            <Select
              value={form.from_location_id}
              onChange={(val) => setForm({ ...form, from_location_id: val })}
              options={[
                { value: '', label: 'Select source location' },
                ...locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
              ]}
            />
          </Field>

          <Field label="To Location (Destination)">
            <Select
              value={form.to_location_id}
              onChange={(val) => setForm({ ...form, to_location_id: val })}
              options={[
                { value: '', label: 'Select destination location' },
                ...locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
              ]}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Item Category">
            <Select
              value={form.item_type}
              onChange={(val) => setForm({ ...form, item_type: val, item_id: '' })}
              options={[
                { value: 'raw_material', label: 'Raw Material' },
                { value: 'finished_good', label: 'Finished Good' },
                { value: 'wip', label: 'WIP Item' }
              ]}
            />
          </Field>

          <Field label="Select Item">
            <Select
              value={form.item_id}
              onChange={(val) => setForm({ ...form, item_id: val })}
              options={[
                { value: '', label: 'Select item' },
                ...items.map((i) => ({ value: i.id, label: `${i.name} (${i.code || i.unit})` }))
              ]}
            />
          </Field>
        </div>

        <Field label="Quantity to Transfer">
          <input className={inputCls} required type="number" step="any" min="0.0001" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>

        <Field label="Transfer Notes / Reason">
          <textarea className={`${inputCls} h-20 resize-y`} placeholder="e.g. Replenishing Plant 2 stock..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="submit" icon={<Check size={16} />}>Execute Transfer</Button>
        </div>
      </form>
    </Modal>
  );
}

export function StockTransferPage() {
  const [refresh, setRefresh] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const columns: TableColumn<AnyRow>[] = [
    { key: 'transfer_number', label: 'Transfer #', sortable: true, render: (row) => <strong className="text-slate-900 font-semibold">{row.transfer_number}</strong> },
    { key: 'item_name', label: 'Item Name', sortable: true },
    { key: 'quantity', label: 'Quantity', align: 'right', sortable: true, render: (row) => `${formatNumber(row.quantity)} ${row.item_unit || ''}` },
    { key: 'from_location_name', label: 'From Location', sortable: true },
    { key: 'to_location_name', label: 'To Location', sortable: true },
    { key: 'created_by_name', label: 'Transferred By', render: (row) => row.created_by_name || 'Staff' },
    { key: 'created_at', label: 'Date & Time', sortable: true, render: (row) => new Date(row.created_at).toLocaleString() }
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<ArrowLeftRight />}
        title="Stock Transfers"
        subtitle="Transfer materials and finished goods between locations with automatic paired ledger movements."
        action={<Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>New Transfer</Button>}
      />

      <DataTable
        endpoint="/api/stock-transfers"
        columns={columns}
        refreshKey={refresh}
        showDateFilters={true}
        emptyTitle="No stock transfers recorded"
        rowId={(row) => String(row.id || '')}
      />

      {showModal ? (
        <StockTransferModal onClose={() => setShowModal(false)} onSaved={() => { setRefresh((v) => v + 1); setShowModal(false); }} />
      ) : null}
    </div>
  );
}
