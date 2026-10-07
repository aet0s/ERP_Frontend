import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Eye,
  PackageCheck,
  SlidersHorizontal,
  Warehouse
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, formatNumber, csvDownload } from '../lib/utils';
import type { AnyRow, TableColumn } from '../lib/types';
import { useOptions } from '../hooks/useOptions';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';
import { InventoryDetailDrawer } from '../components/InventoryDetailDrawer';

const INVENTORY_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'name', label: 'Item Name', defaultSelected: true },
  { key: 'item_type_label', label: 'Category / Type', defaultSelected: true },
  { key: 'location_name', label: 'Storage Location', defaultSelected: true },
  { key: 'packaged_stock_display', label: 'Packaged Stock (e.g. 4,000 Pack of Strips)', defaultSelected: true },
  { key: 'current_stock', label: 'Available Stock Quantity', defaultSelected: true },
  { key: 'unit', label: 'Measurement Unit', defaultSelected: true },
  { key: 'unit_cost', label: 'Unit Cost (₹)', defaultSelected: true },
  { key: 'value_at_cost', label: 'Valuation at Cost (₹)', defaultSelected: true },
  { key: 'selling_price', label: 'Selling Price / MRP (₹)', defaultSelected: false },
  { key: 'potential_revenue', label: 'Potential Sales Revenue (₹)', defaultSelected: false },
  { key: 'reorder_level', label: 'Reorder Threshold', defaultSelected: true },
  { key: 'status', label: 'Stock Status', defaultSelected: true },
  { key: 'total_in', label: 'Total Inward / Received', defaultSelected: false },
  { key: 'used_in_production', label: 'Used in Production', defaultSelected: false },
  { key: 'sold_in_sales', label: 'Sold in Sales', defaultSelected: false }
];

function StockTransferModal({ row, locations, onClose, onSaved }: { row?: any; locations: any[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const initialItemType = row?.item_type || 'raw_material';
  const initialItemId = row?.item_id || '';
  const initialFromLoc = row?.location_id || '';

  const [form, setForm] = useState({
    from_location_id: initialFromLoc,
    to_location_id: '',
    item_type: initialItemType,
    item_id: initialItemId,
    packaging_level_id: row?.packaging_level_id || '',
    quantity: '',
    notes: ''
  });

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
        // If an item is selected without a pinned row, verify it's still in stock in this location
        if (form.item_id && !row?.item_id) {
          const found = fetchedItems.find((it: any) => it.id === form.item_id);
          if (!found || Number(found.current_stock || 0) <= 0) {
            setForm((prev) => ({ ...prev, item_id: '', packaging_level_id: '', quantity: '' }));
          } else if (found.packaging_level_id && !form.packaging_level_id) {
            setForm((prev) => ({ ...prev, packaging_level_id: found.packaging_level_id }));
          }
        } else if (form.item_id && row?.item_id) {
          const found = fetchedItems.find((it: any) => it.id === form.item_id);
          if (found?.packaging_level_id && !form.packaging_level_id) {
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
    : (selectedItem?.unit || row?.unit || 'units');

  const availableStock = activePkgLevel
    ? Number(activePkgLevel.packaged_stock || 0)
    : Number(selectedItem?.current_stock ?? row?.current_stock ?? 0);

  const qtyNum = Number(form.quantity || 0);
  const isQtyExceeded = Boolean(selectedItem && qtyNum > availableStock);

  const handleFromLocationChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      from_location_id: val,
      // If destination was same as newly selected source, clear it
      to_location_id: prev.to_location_id === val ? '' : prev.to_location_id,
      item_id: row?.item_id ? row.item_id : '',
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
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
        item_type: form.item_type,
        item_id: form.item_id,
        from_location_id: form.from_location_id,
        to_location_id: form.to_location_id,
        quantity: Number(form.quantity),
        packaging_level_id: activePkgLevel ? activePkgLevel.id : undefined,
        notes: form.notes
      });
      toast('Stock transfer completed successfully');
      onSaved();
    } catch (error: any) {
      toast(error.response?.data?.error || 'Failed to complete stock transfer', 'error');
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
    <Modal title={`Stock Transfer ${row?.name ? `- ${row.name}` : ''}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
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
        {form.from_location_id && (selectedItem || row?.item_id) && (
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            availableStock > 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800 font-semibold'
          }`}>
            <div className="flex items-center gap-2">
              <PackageCheck size={16} className={availableStock > 0 ? 'text-emerald-600' : 'text-red-500'} />
              <div>
                <span className="font-semibold block">Available in Source Location:</span>
                {activePkgLevel && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Package Format: <strong>{activePkgLevel.name}</strong> (1 {activePkgLevel.package_unit} = {activePkgLevel.base_quantity_equivalent} {selectedItem?.base_unit || row?.unit || 'units'})
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
                  Total: {formatNumber(availableStock * (Number(activePkgLevel.base_quantity_equivalent) || 1))} {selectedItem?.base_unit || row?.unit || 'units'}
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
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
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
              <span className="font-mono font-medium">= {formatNumber(qtyNum * (Number(activePkgLevel.base_quantity_equivalent) || 1))} {selectedItem?.base_unit || row?.unit || 'units'}</span>
            </div>
          )}
        </div>

        <Field label="Notes / Reference">
          <textarea
            className={`${inputCls} h-20 resize-y`}
            placeholder="Optional transfer notes"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
          />
        </Field>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button
            type="submit"
            icon={<ArrowLeftRight size={16} />}
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

export function InventoryPage() {
  const { workspace } = useWorkspace();
  const { canView, canCreate, canEdit, canExport } = usePermissions('inventory');
  const toast = useToast();
  const [refresh, setRefresh] = useState(0);

  // URL search params for tab persistence across page reloads
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || '';

  const [filters, setFilters] = useState<{ item_type: string; status: string }>({
    item_type: searchParams.get('tab') || '',
    status: ''
  });
  const [locationId, setLocationId] = useState('');
  const locations = useOptions('/api/locations', refresh) as any[];

  const [detailItem, setDetailItem] = useState<AnyRow | null>(null);
  const [transfer, setTransfer] = useState<AnyRow | null>(null);
  const [exportModalData, setExportModalData] = useState<{ total: number; getExportData: () => Promise<any[]> } | null>(null);

  const [summaryData, setSummaryData] = useState<{
    total_value: number;
    raw_material_value: number;
    raw_material_count: number;
    finished_goods_value: number;
    finished_goods_count: number;
    wip_value?: number;
    wip_count?: number;
    low_count: number;
    total_items: number;
  }>({
    total_value: 0,
    raw_material_value: 0,
    raw_material_count: 0,
    finished_goods_value: 0,
    finished_goods_count: 0,
    wip_value: 0,
    wip_count: 0,
    low_count: 0,
    total_items: 0
  });

  // Keep filters in sync when URL searchParams changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') || '';
    setFilters((prev) => ({ ...prev, item_type: tabParam }));
  }, [searchParams]);

  // Fetch summary stats
  useEffect(() => {
    api.get('/api/inventory', { params: { table: 1, page_size: 1, location_id: locationId || undefined } })
      .then((res) => {
        if (res.data?.summary) {
          setSummaryData({
            total_value: Number(res.data.summary.total_value || 0),
            raw_material_value: Number(res.data.summary.raw_material_value || 0),
            raw_material_count: Number(res.data.summary.raw_material_count || 0),
            finished_goods_value: Number(res.data.summary.finished_goods_value || 0),
            finished_goods_count: Number(res.data.summary.finished_goods_count || 0),
            wip_value: Number(res.data.summary.wip_value || 0),
            wip_count: Number(res.data.summary.wip_count || 0),
            low_count: Number(res.data.summary.low_count || 0),
            total_items: Number(res.data.summary.total_items || 0)
          });
        }
      })
      .catch((err) => console.error('Failed to load inventory summary:', err));
  }, [refresh, locationId]);

  const handleTabChange = (tabId: string) => {
    const next = new URLSearchParams(searchParams);
    if (tabId) {
      next.set('tab', tabId);
    } else {
      next.delete('tab');
    }
    setSearchParams(next);
    setFilters((prev) => ({ ...prev, item_type: tabId }));
  };

  const handleInitiateTransfer = (itemRow: any) => {
    const stock = Number(itemRow?.current_stock || 0);
    if (stock <= 0) {
      toast('No Stock is available for transfer', 'error');
      return;
    }
    setTransfer(itemRow);
  };

  const columns: TableColumn<AnyRow>[] = [
    {
      key: 'name',
      label: 'Item Name & Category',
      sortable: true,
      render: (row) => {
        const typeBadge = {
          raw_material: { label: 'Raw Material', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
          finished_good: { label: 'Finished Good', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          wip: { label: 'WIP', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
        }[row.item_type as string] || { label: String(row.item_type).replace('_', ' '), cls: 'bg-slate-50 text-slate-700 border-slate-200' };

        return (
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 block hover:text-blue-600 transition cursor-pointer" onClick={() => setDetailItem(row)}>
              {row.name}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${typeBadge.cls}`}>
              {typeBadge.label}
            </span>
          </div>
        );
      }
    },
    {
      key: 'current_stock',
      label: 'Available Stock',
      sortable: true,
      render: (row) => {
        if (row.item_type === 'finished_good' && row.packaging_summary && Number(row.current_stock) > 0) {
          return (
            <div>
              <span className="font-bold text-slate-900 text-sm block">
                {row.packaging_summary}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono">
                ({formatNumber(row.current_stock, 0)} {row.unit})
              </span>
            </div>
          );
        }
        if (row.packaged_stock != null && row.package_name && Number(row.current_stock) > 0) {
          return (
            <div>
              <span className="font-bold text-slate-900 text-sm block">
                {formatNumber(row.packaged_stock, 0)} {row.package_name}
                {Number(row.loose_units || 0) > 0 ? ` + ${formatNumber(row.loose_units, 0)} ${row.unit}` : ''}
              </span>
              <span className="text-[11px] text-slate-400 block font-mono">
                ({formatNumber(row.current_stock, 0)} {row.unit})
              </span>
            </div>
          );
        }
        return (
          <span className="font-bold text-slate-900 text-sm">
            {formatNumber(row.current_stock, 0)} {row.unit || ''}
          </span>
        );
      }
    },
    {
      key: 'unit_cost',
      label: 'Unit Cost (WAC)',
      sortable: true,
      align: 'right',
      render: (row) => {
        if (row.package_unit_cost != null && row.package_name) {
          return (
            <div className="text-right">
              <span className="font-mono text-slate-900 font-semibold block text-xs">
                {formatCurrency(row.package_unit_cost, workspace?.currency)} / {row.package_unit || 'pkg'}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                ({formatCurrency(row.unit_cost, workspace?.currency)} / {row.unit})
              </span>
            </div>
          );
        }
        return (
          <div className="text-right">
            <span className="font-mono text-slate-800 text-xs font-semibold block">
              {formatCurrency(row.unit_cost, workspace?.currency)} / {row.unit}
            </span>
            {row.item_type === 'raw_material' && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span
                  className="inline-flex items-center text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded"
                  title="Volume-Weighted Average Cost across all vendor purchases"
                >
                  WAC
                </span>
                {row.last_purchase_price > 0 && Math.abs(Number(row.last_purchase_price) - Number(row.unit_cost)) > 0.01 && (
                  <span
                    className="text-[10px] text-slate-400 font-mono"
                    title={`Most recent vendor purchase rate: ${formatCurrency(row.last_purchase_price, workspace?.currency)}`}
                  >
                    Last: {formatCurrency(row.last_purchase_price, workspace?.currency)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'value_at_cost',
      label: 'Valuation (At Cost)',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-extrabold text-blue-700 font-mono text-sm">
          {formatCurrency(row.value_at_cost, workspace?.currency)}
        </span>
      )
    },
    {
      key: 'selling_price',
      label: 'Selling Price / Value',
      sortable: true,
      align: 'right',
      render: (row) => {
        if (row.item_type === 'finished_good' && row.selling_price > 0) {
          const displayPrice = row.package_selling_price || row.selling_price;
          const displayUnit = row.package_unit || row.unit;
          return (
            <div className="text-right">
              <span className="text-emerald-700 font-semibold font-mono text-xs block">
                {formatCurrency(displayPrice, workspace?.currency)} / {displayUnit}
              </span>
              {row.potential_revenue > 0 && (
                <span className="text-[10px] text-slate-400 block font-mono" title="Total Potential Revenue">
                  Tot: {formatCurrency(row.potential_revenue, workspace?.currency)}
                </span>
              )}
            </div>
          );
        }
        return <span className="text-slate-400 text-xs">-</span>;
      }
    },
    {
      key: 'location_name',
      label: 'Location',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
          {row.location_name || 'Main Warehouse'}
        </span>
      )
    },
    {
      key: 'reorder_level',
      label: 'Reorder Level',
      sortable: true,
      render: (row) =>
        row.item_type === 'wip'
          ? <span className="text-slate-400 text-xs">-</span>
          : (
            <input
              className={`w-20 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-blue-600 transition ${!canEdit ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
              defaultValue={row.reorder_level ?? ''}
              disabled={!canEdit}
              title={!canEdit ? 'Edit permission required to update reorder level' : undefined}
              onBlur={async (event) => {
                if (!canEdit) return;
                await api.patch(`/api/inventory/${row.item_type}/${row.item_id}/reorder-level`, {
                  reorder_level: event.target.value || null
                });
                toast('Reorder level updated');
                setRefresh((value) => value + 1);
              }}
            />
          )
    },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="View Details & Ledger"
            onClick={() => setDetailItem(row)}
            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
          >
            <Eye size={15} />
          </button>
          {canCreate && (
            <button
              type="button"
              title={Number(row.current_stock || 0) <= 0 ? "No Stock available for transfer" : "Stock Transfer"}
              onClick={() => handleInitiateTransfer(row)}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                Number(row.current_stock || 0) <= 0
                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <ArrowLeftRight size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Inventory module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<Warehouse />}
        title="Inventory & Stock Valuation"
        subtitle="Live real-time asset valuation, stock balances across packaging formats, and warehouse movement audit trails."
        action={
          canCreate ? (
            <Button variant="secondary" icon={<ArrowLeftRight size={16} />} onClick={() => setTransfer({})}>
              Stock Transfer
            </Button>
          ) : undefined
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Inventory Value</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Warehouse size={15} /></span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatCurrency(summaryData.total_value, workspace?.currency)}
          </div>
          <p className="text-[11px] text-slate-500">
            Valuation across {summaryData.total_items} items at true cost
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Finished Goods Value</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><PackageCheck size={15} /></span>
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-tight">
            {formatCurrency(summaryData.finished_goods_value, workspace?.currency)}
          </div>
          <p className="text-[11px] text-slate-500">
            {summaryData.finished_goods_count} Finished products in stock
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Raw Materials Value</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Boxes size={15} /></span>
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono tracking-tight">
            {formatCurrency(summaryData.raw_material_value, workspace?.currency)}
          </div>
          <p className="text-[11px] text-slate-500">
            {summaryData.raw_material_count} Raw materials available
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Stock Alerts</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><AlertTriangle size={15} /></span>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
            {summaryData.low_count}
          </div>
          <p className="text-[11px] text-slate-500">
            {summaryData.low_count === 0 ? 'All stock levels healthy' : 'Items low or out of stock'}
          </p>
        </div>
      </div>

      {/* Category Tabs matching standard ERP pages (persists active tab across reloads) */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {[
            {
              id: '',
              label: 'All Stock Items',
              icon: <Warehouse size={15} />,
              badge: summaryData.total_items > 0 ? summaryData.total_items : undefined
            },
            {
              id: 'finished_good',
              label: 'Finished Goods',
              icon: <PackageCheck size={15} />,
              badge: summaryData.finished_goods_count > 0 ? summaryData.finished_goods_count : undefined
            },
            {
              id: 'raw_material',
              label: 'Raw Materials',
              icon: <Boxes size={15} />,
              badge: summaryData.raw_material_count > 0 ? summaryData.raw_material_count : undefined
            },
            {
              id: 'wip',
              label: 'Work In Progress (WIP)',
              icon: <SlidersHorizontal size={15} />,
              badge: (summaryData.wip_count || 0) > 0 ? summaryData.wip_count : undefined
            }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <DataTable
        endpoint={locationId ? `/api/inventory?location_id=${locationId}` : '/api/inventory'}
        columns={columns}
        filters={filters}
        refreshKey={refresh}
        showDateFilters={true}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={false}
        canExport={canExport}
        onView={(row) => setDetailItem(row)}
        onExport={(ctx) => setExportModalData(ctx)}
        emptyTitle="No inventory items found"
        rowId={(row) => `${row.item_type}:${row.item_id}`}
        extraFilters={
          <>
            <div className="w-48">
              <Select
                value={locationId}
                onChange={setLocationId}
                options={[
                  { value: '', label: 'All Storage Locations' },
                  ...locations.map((l) => ({ value: l.id, label: `${l.name} ${l.is_default ? '(Default)' : ''}` }))
                ]}
              />
            </div>
            <div className="w-36">
              <Select
                value={filters.status}
                onChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'OK', label: 'In Stock (OK)' },
                  { value: 'Low', label: 'Low Stock' },
                  { value: 'Out', label: 'Out of Stock' }
                ]}
              />
            </div>
          </>
        }
      />

      {/* Rich Detail Drawer */}
      {detailItem && (
        <InventoryDetailDrawer
          item={detailItem as any}
          onClose={() => setDetailItem(null)}
          onTransfer={canCreate ? (item) => {
            const stock = Number(item?.current_stock || 0);
            if (stock <= 0) {
              toast('No Stock is available for transfer', 'error');
              return;
            }
            setDetailItem(null);
            setTransfer(item);
          } : undefined}
        />
      )}

      {/* Transfer Modal */}
      {transfer && (
        <StockTransferModal
          row={transfer.item_id ? transfer : undefined}
          locations={locations}
          onClose={() => setTransfer(null)}
          onSaved={() => {
            setRefresh((value) => value + 1);
            setTransfer(null);
          }}
        />
      )}

      {/* Column-Selective CSV Export Modal */}
      {exportModalData && (
        <ExportColumnModal
          title="Export Inventory & Stock to CSV"
          recordCount={exportModalData.total}
          availableColumns={INVENTORY_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const exportCols: TableColumn<any>[] = INVENTORY_EXPORT_COLUMNS
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));

            const typeMap: Record<string, string> = {
              raw_material: 'Raw Material',
              finished_good: 'Finished Good',
              wip: 'Work In Progress'
            };

            const formattedRecords = records.map((r: any) => ({
              ...r,
              item_type_label: typeMap[r.item_type] || r.item_type,
              packaged_stock_display: r.packaging_summary || (r.packaged_stock != null ? `${r.packaged_stock} ${r.package_name || ''}` : `${r.current_stock} ${r.unit}`),
              current_stock: r.current_stock != null ? Number(r.current_stock).toFixed(2) : '0.00',
              unit_cost: r.unit_cost != null ? Number(r.unit_cost).toFixed(2) : '0.00',
              value_at_cost: r.value_at_cost != null ? Number(r.value_at_cost).toFixed(2) : '0.00',
              selling_price: r.selling_price != null ? Number(r.selling_price).toFixed(2) : '0.00',
              potential_revenue: r.potential_revenue != null ? Number(r.potential_revenue).toFixed(2) : '0.00',
              reorder_level: r.reorder_level != null ? Number(r.reorder_level).toFixed(2) : 'Not set',
              total_in: r.total_in != null ? Number(r.total_in).toFixed(2) : '0.00',
              used_in_production: r.used_in_production != null ? Number(r.used_in_production).toFixed(2) : '0.00',
              sold_in_sales: r.sold_in_sales != null ? Number(r.sold_in_sales).toFixed(2) : '0.00'
            }));

            csvDownload(
              `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`,
              formattedRecords,
              exportCols
            );
            toast(`Exported ${records.length} items with ${exportCols.length} columns!`, 'success');
          }}
        />
      )}
    </div>
  );
}
