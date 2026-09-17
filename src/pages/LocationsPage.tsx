import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { MapPin, Plus, Check, Trash2, Star } from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import type { AnyRow, TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';

function LocationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [codeUserEdited, setCodeUserEdited] = useState(false);
  const [form, setForm] = useState({
    location_code: 'LOC-0001',
    name: '',
    address: '',
    city: '',
    state: '',
    notes: '',
    is_default: false
  });

  useEffect(() => {
    api.get('/api/numbering-series/next/location')
      .then((res) => {
        if (res?.data?.next_code && !codeUserEdited) {
          setForm((f) => ({ ...f, location_code: res.data.next_code }));
        }
      })
      .catch(() => {});
  }, [codeUserEdited]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/locations', form);
      toast('Location created successfully');
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create location', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <Modal title="Add Location / Warehouse" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Location Code">
          <input
            className={`${inputCls} font-mono font-medium`}
            placeholder="e.g. LOC-0001"
            value={form.location_code}
            onChange={(e) => {
              setCodeUserEdited(true);
              setForm({ ...form, location_code: e.target.value });
            }}
          />
          <p className="text-[11px] text-slate-400 mt-0.5">Auto-generated sequential code. You can edit if needed.</p>
        </Field>
        <Field label="Location Name">
          <input className={inputCls} required placeholder="e.g. Main Warehouse, Plant 2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Address">
          <input className={inputCls} placeholder="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input className={inputCls} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="State">
            <input className={inputCls} placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes / Operating Hours">
          <textarea className={`${inputCls} h-20 resize-y`} placeholder="Any extra operational details..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="is_default"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
          />
          <label htmlFor="is_default" className="text-sm text-slate-700 font-medium cursor-pointer">
            Set as default primary location
          </label>
        </div>
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="submit" icon={<Check size={16} />}>Create Location</Button>
        </div>
      </form>
    </Modal>
  );
}

export function LocationsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { canView, canCreate, canEdit, canDelete } = usePermissions('locations');
  const [refresh, setRefresh] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const makeDefault = async (id: string) => {
    try {
      await api.post(`/api/locations/${id}/set-default`);
      toast('Default location updated');
      setRefresh((v) => v + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update default location', 'error');
    }
  };

  const deleteLoc = async (id: string) => {
    const agreed = await confirm({
      title: 'Delete Warehouse Location',
      message: 'Are you sure you want to delete this location? Ensure no current inventory is mapped to this warehouse.',
      tone: 'danger',
      confirmText: 'Delete Location'
    });
    if (!agreed) return;
    try {
      await api.delete(`/api/locations/${id}`);
      toast('Location deleted');
      setRefresh((v) => v + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete location', 'error');
    }
  };

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Locations module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  const columns: TableColumn<AnyRow>[] = [
    {
      key: 'location_code',
      label: 'Code',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {row.location_code || '—'}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Location Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <strong className="text-slate-900 font-semibold">{row.name}</strong>
          {row.is_default ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              <Star size={10} className="fill-blue-700" /> Primary / Main (Default)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Secondary Location
            </span>
          )}
        </div>
      )
    },
    { key: 'city', label: 'City / State', render: (row) => [row.city, row.state].filter(Boolean).join(', ') || '—' },
    { key: 'address', label: 'Address', render: (row) => row.address || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(canEdit || canDelete ? [{
      key: 'actions',
      label: 'Actions',
      align: 'right' as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-2">
          {canEdit && !row.is_default ? (
            <button
              onClick={() => makeDefault(String(row.id))}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Make Default
            </button>
          ) : null}
          {canDelete && !row.is_default ? (
            <button
              onClick={() => deleteLoc(String(row.id))}
              className="text-slate-400 hover:text-red-600 transition cursor-pointer p-1"
              title="Delete location"
            >
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<MapPin />}
        title="Locations & Warehouses"
        subtitle="Manage warehouses, plants, and retail locations for multi-site inventory tracking."
        action={
          canCreate ? (
            <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>Add Location</Button>
          ) : undefined
        }
      />

      <DataTable
        endpoint="/api/locations"
        columns={columns}
        refreshKey={refresh}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canExport={false}
        showDateFilters={false}
        emptyTitle="No locations registered"
        rowId={(row) => String(row.id || '')}
      />

      {showModal && canCreate ? (
        <LocationModal onClose={() => setShowModal(false)} onSaved={() => { setRefresh((v) => v + 1); setShowModal(false); }} />
      ) : null}
    </div>
  );
}
