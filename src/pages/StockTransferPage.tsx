import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeftRight, Plus, Check, AlertTriangle, PackageCheck } from 'lucide-react';
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
import { usePermissions } from '../hooks/usePermissions';

function StockTransferModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [form, setForm] = useState({
    from_location_id: '',
    to_location_id: '',
    item_type: 'raw_material',
    item_id: '',
    packaging_level_id: '',
    quantity: '',
    notes: ''
  });

  useEffect(() => {
    api.get('/api/locations').then((res) => setLocations(res.data || []));
  }, []);

  // Fetch available items whenever item_type or from_location_id changes
  useEffect(() => {
    if (!form.item_type || !form.from_location_id) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    api.get('/api/stock-transfers/available-items', {
      params: {
        item_type: form.item_type,
        location_id: form.from_location_id
      }
    })
      .then((res) => {
        const fetchedItems = res.data || [];
        setItems(fetchedItems);
        // If current item is no longer in stock in the newly selected From location, reset it
        if (form.item_id) {
          const found = fetchedItems.find((it: any) => it.id === form.item_id);
          if (!found || Number(found.current_stock || 0) <= 0) {
            setForm((prev) => ({ ...prev, item_id: '', packaging_level_id: '', quantity: '' }));
          } else if (found.packaging_level_id && !form.packaging_level_id) {
            setForm((prev) => ({ ...prev, packaging_level_id: found.packaging_level_id }));
          }
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  }, [form.item_type, form.from_location_id]);

  const isSameLocation = Boolean(
    form.from_location_id &&
    form.to_location_id &&
    form.from_location_id === form.to_location_id
  );

  const selectedItem = items.find((i) => i.id === form.item_id);
  const pkgLevels = selectedItem?.packaging_levels || [];
  const activePkgLevel = pkgLevels.length > 0
    ? (pkgLevels.find((l: any) => l.id === form.packaging_level_id) || pkgLevels.find((l: any) => l.packaged_stock > 0) || pkgLevels[0])
    : null;

  const currentUnit = activePkgLevel
    ? (activePkgLevel.package_unit || activePkgLevel.name || 'Packets')
    : (selectedItem?.unit || 'units');

  const availableStock = activePkgLevel
    ? Number(activePkgLevel.packaged_stock || 0)
    : Number(selectedItem?.current_stock || 0);

  const qtyNum = Number(form.quantity || 0);
  const isQtyExceeded = Boolean(selectedItem && qtyNum > availableStock);

  const handleFromLocationChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      from_location_id: val,
      // If destination was same as newly selected source, clear it
      to_location_id: prev.to_location_id === val ? '' : prev.to_location_id,
      item_id: '',
      packaging_level_id: '',
      quantity: ''
    }));
  };

  const handleToLocationChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      to_location_id: val
    }));
  };

  const handleItemTypeChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      item_type: val,
      item_id: '',
      packaging_level_id: '',
      quantity: ''
    }));
  };

  const handleItemChange = (val: string) => {
    const it = items.find((i) => i.id === val);
    const defaultPkgId = it?.packaging_level_id || (it?.packaging_levels?.[0]?.id) || '';
    setForm((prev) => ({
      ...prev,
      item_id: val,
      packaging_level_id: defaultPkgId,
      quantity: ''
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.from_location_id || !form.to_location_id) {
      toast('Please select both source and destination locations', 'error');
      return;
    }
    if (form.from_location_id === form.to_location_id) {
      toast('Transfer is not possible: Source and destination locations cannot be the same', 'error');
      return;
    }
    if (!form.item_id || !selectedItem) {
      toast('Please select an in-stock item to transfer', 'error');
      return;
    }
    if (availableStock <= 0) {
      toast(`Transfer is not possible: Item has 0 ${currentUnit} in stock at the selected source location`, 'error');
      return;
    }
    if (!form.quantity || qtyNum <= 0) {
      toast('Please enter a valid transfer quantity', 'error');
      return;
    }
    if (isQtyExceeded) {
      toast(`Transfer is not possible: Quantity exceeds available stock (${formatNumber(availableStock)} ${currentUnit})`, 'error');
      return;
    }

    try {
      await api.post('/api/stock-transfers', {
        ...form,
        quantity: Number(form.quantity),
        packaging_level_id: activePkgLevel ? activePkgLevel.id : undefined
      });
      toast('Stock transfer executed successfully');
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to execute stock transfer', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";

  // Destination options: filter out the selected From location so user cannot select the same location
  const toLocationOptions = [
    { value: '', label: form.from_location_id ? 'Select destination location' : 'Select From location first' },
    ...locations
      .filter((l) => l.id !== form.from_location_id)
      .map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
  ];

  return (
    <Modal title="New Stock Transfer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* Same Location Error Warning */}
        {isSameLocation && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>Transfer is not possible: Source and destination locations cannot be the same.</span>
          </div>
        )}

        {/* Step 1 & Step 2: From Location & To Location */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="1. From Location (Source)">
            <Select
              value={form.from_location_id}
              onChange={handleFromLocationChange}
              options={[
                { value: '', label: 'Select source location' },
                ...locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
              ]}
            />
          </Field>

          <Field label="2. To Location (Destination)">
            <Select
              value={form.to_location_id}
              disabled={!form.from_location_id}
              onChange={handleToLocationChange}
              options={toLocationOptions}
            />
          </Field>
        </div>

        {/* Step 3 & Step 4: Item Category & Select Item */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="3. Item Category">
            <Select
              value={form.item_type}
              disabled={!form.from_location_id || !form.to_location_id}
              onChange={handleItemTypeChange}
              options={[
                { value: 'raw_material', label: 'Raw Material' },
                { value: 'finished_good', label: 'Finished Good' },
                { value: 'wip', label: 'WIP Item' }
              ]}
            />
          </Field>

          <Field label="4. Select Item (In Stock Only)">
            <Select
              value={form.item_id}
              disabled={!form.from_location_id || !form.to_location_id || loadingItems}
              onChange={handleItemChange}
              placeholder={
                !form.from_location_id
                  ? 'Select source location first'
                  : !form.to_location_id
                  ? 'Select destination first'
                  : loadingItems
                  ? 'Loading items...'
                  : 'Select in-stock item'
              }
              options={[
                {
                  value: '',
                  label: !form.from_location_id
                    ? 'Select source location first'
                    : loadingItems
                    ? 'Loading items...'
                    : 'Select in-stock item'
                },
                ...items.map((i) => {
                  const isPkg = i.item_type === 'finished_good' && i.packaging_levels && i.packaging_levels.length > 0;
                  const stock = Number(i.current_stock || 0);
                  const inStock = stock > 0;
                  let stockLabel = '';
                  if (isPkg) {
                    const pkgUnit = i.package_unit || i.package_name || 'Packets';
                    stockLabel = inStock
                      ? `In Stock: ${formatNumber(stock)} ${pkgUnit} (${formatNumber(i.base_stock || 0)} ${i.base_unit || 'units'})`
                      : `Out of Stock (0 ${pkgUnit})`;
                  } else {
                    stockLabel = inStock
                      ? `In Stock: ${formatNumber(stock)} ${i.unit || 'units'}`
                      : `Out of Stock (0 ${i.unit || 'units'})`;
                  }
                  return {
                    value: i.id,
                    disabled: !inStock,
                    label: `${i.name}${i.code ? ` (${i.code})` : ''} — ${stockLabel}`
                  };
                })
              ]}
            />
          </Field>
        </div>

        {/* Optional Packaging Format selection if product has multiple packaging formats */}
        {selectedItem && pkgLevels.length > 1 && (
          <Field label="Packaging Format">
            <Select
              value={activePkgLevel?.id || ''}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, packaging_level_id: val, quantity: '' }));
              }}
              options={pkgLevels.map((lvl: any) => ({
                value: lvl.id,
                label: `${lvl.name} (${lvl.package_unit}) — In Stock: ${formatNumber(lvl.packaged_stock)} ${lvl.package_unit} [1 ${lvl.package_unit} = ${lvl.base_quantity_equivalent} ${selectedItem.base_unit || 'units'}]`
              }))}
            />
          </Field>
        )}

        {/* Stock Badge for selected item */}
        {selectedItem && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            availableStock > 0 ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-800 font-semibold'
          }`}>
            <div className="flex items-center gap-2">
              <PackageCheck size={16} className={availableStock > 0 ? 'text-emerald-600' : 'text-red-500'} />
              <div>
                <span className="font-semibold block">Available in Source Location:</span>
                {activePkgLevel && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Package Format: <strong>{activePkgLevel.name}</strong> (1 {activePkgLevel.package_unit} = {activePkgLevel.base_quantity_equivalent} {selectedItem.base_unit || 'units'})
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold font-mono text-sm block">
                {availableStock > 0
                  ? `${formatNumber(availableStock)} ${currentUnit}`
                  : `0 ${currentUnit} (Transfer is not possible)`}
              </span>
              {activePkgLevel && availableStock > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">
                  Total: {formatNumber(availableStock * (Number(activePkgLevel.base_quantity_equivalent) || 1))} {selectedItem.base_unit || 'units'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Quantity to Transfer */}
        <div>
          <Field label={`5. Quantity to Transfer (${currentUnit})`}>
            <input
              className={inputCls}
              required
              type="number"
              step="any"
              min="0.0001"
              max={availableStock > 0 ? availableStock : undefined}
              disabled={!form.item_id || availableStock <= 0}
              placeholder={!form.item_id ? 'Select an in-stock item first' : `Enter number of ${currentUnit} (Max: ${formatNumber(availableStock)})`}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          {isQtyExceeded && (
            <div className="text-xs text-red-600 font-semibold flex items-center gap-1.5 mt-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Transfer is not possible: Entered quantity exceeds available stock ({formatNumber(availableStock)} {currentUnit}).</span>
            </div>
          )}
          {qtyNum > 0 && activePkgLevel && !isQtyExceeded && (
            <div className="text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200/60 rounded-lg p-2 flex items-center justify-between mt-1.5">
              <span>Transferring <strong>{formatNumber(qtyNum)} {currentUnit}</strong></span>
              <span className="font-mono font-medium">= {formatNumber(qtyNum * (Number(activePkgLevel.base_quantity_equivalent) || 1))} {selectedItem.base_unit || 'units'}</span>
            </div>
          )}
        </div>

        <Field label="Transfer Notes / Reason">
          <textarea
            className={`${inputCls} h-20 resize-y`}
            placeholder="e.g. Replenishing Plant 2 stock..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button
            type="submit"
            icon={<Check size={16} />}
            disabled={
              !form.from_location_id ||
              !form.to_location_id ||
              isSameLocation ||
              !form.item_id ||
              availableStock <= 0 ||
              !form.quantity ||
              qtyNum <= 0 ||
              isQtyExceeded
            }
          >
            Execute Transfer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function StockTransferPage() {
  const { canView, canCreate, canExport } = usePermissions('stock_transfers');
  const [refresh, setRefresh] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const columns: TableColumn<AnyRow>[] = [
    { key: 'transfer_number', label: 'Transfer #', sortable: true, render: (row) => <strong className="text-slate-900 font-semibold">{row.transfer_number}</strong> },
    { key: 'item_name', label: 'Item Name', sortable: true },
    {
      key: 'quantity',
      label: 'Quantity',
      align: 'right',
      sortable: true,
      render: (row) => {
        if (row.package_count != null && Number(row.package_count) > 0) {
          return (
            <div className="text-right">
              <span className="font-bold text-slate-900 block text-xs">
                {formatNumber(row.package_count)} {row.package_unit || row.package_name || 'pkgs'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                ({formatNumber(row.quantity)} {row.item_unit || 'units'})
              </span>
            </div>
          );
        }
        return `${formatNumber(row.quantity)} ${row.item_unit || ''}`;
      }
    },
    { key: 'from_location_name', label: 'From Location', sortable: true },
    { key: 'to_location_name', label: 'To Location', sortable: true },
    { key: 'created_by_name', label: 'Transferred By', render: (row) => row.created_by_name || 'Staff' },
    { key: 'created_at', label: 'Date & Time', sortable: true, render: (row) => new Date(row.created_at).toLocaleString() }
  ];

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Stock Transfers module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<ArrowLeftRight />}
        title="Stock Transfers"
        subtitle="Transfer materials and finished goods between locations with automatic paired ledger movements."
        action={canCreate ? <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>New Transfer</Button> : undefined}
      />

      <DataTable
        endpoint="/api/stock-transfers"
        columns={columns}
        refreshKey={refresh}
        showDateFilters={true}
        canExport={canExport}
        emptyTitle="No stock transfers recorded"
        rowId={(row) => String(row.id || '')}
      />

      {showModal && canCreate ? (
        <StockTransferModal onClose={() => setShowModal(false)} onSaved={() => { setRefresh((v) => v + 1); setShowModal(false); }} />
      ) : null}
    </div>
  );
}
