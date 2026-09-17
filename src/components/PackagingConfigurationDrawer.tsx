import { useState, useEffect } from 'react';
import {
  Package, Plus, Trash2, Edit2,
  Layers, Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm, useWorkspace } from '../context';
import { formatCurrency, formatNumber } from '../lib/utils';
import { STANDARD_UOMS } from '../lib/uom';
import { Drawer, Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Select } from './ui/Select';

interface PackagingMaterial {
  id: string;
  material_item_id: string;
  item_name?: string;
  quantity: number;
  uom: string;
  cost_per_unit: number;
}

interface PackagingLevel {
  id: string;
  product_id: string;
  product_type: string;
  level_number?: number;
  level_order?: number;
  name: string;
  package_unit: string;
  contains_quantity?: number;
  capacity_quantity?: number;
  contains_unit?: string | null;
  capacity_unit?: string | null;
  parent_level_id: string | null;
  parent_package_name?: string;
  parent_package_unit?: string;
  base_quantity_equivalent: number;
  selling_price: number;
  mrp: number;
  barcode: string | null;
  is_default: boolean;
  status: string;
  notes: string | null;
  materials_count?: number;
  packaging_materials_cost?: number;
}

export function PackagingConfigurationDrawer({
  product,
  onClose,
  onSaved
}: {
  product: {
    id: string;
    name: string;
    sku?: string;
    unit?: string;
    default_price?: number;
    current_stock?: number;
    available_stock?: number;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { workspace } = useWorkspace();

  const [levels, setLevels] = useState<PackagingLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState<Record<string, any>>({});
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);

  // Form state for creating / editing packaging level
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('Box');
  const [formParentId, setFormParentId] = useState('');
  const [formCapacityQty, setFormCapacityQty] = useState('10');
  const [formPrice, setFormPrice] = useState('');
  const [formMrp, setFormMrp] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [savingLevel, setSavingLevel] = useState(false);

  // Materials BOM editor state for active level
  const [bomLevelId, setBomLevelId] = useState<string | null>(null);
  const [bomMaterials, setBomMaterials] = useState<PackagingMaterial[]>([]);
  const [loadingBom, setLoadingBom] = useState(false);
  const [newMatItemId, setNewMatItemId] = useState('');
  const [newMatQty, setNewMatQty] = useState('1');
  const [newMatUom, setNewMatUom] = useState('unit');

  const baseUnit = product.unit || 'unit';
  const basePrice = Number(product.default_price || 0);

  const fetchLevels = () => {
    setLoading(true);
    api.get(`/api/packaging/levels?product_id=${product.id}`)
      .then((res) => {
        setLevels(res.data || []);
      })
      .catch((err) => {
        toast(err.response?.data?.error || 'Failed to load packaging levels', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLevels();
    api.get('/api/items?limit=200').then(res => setRawMaterials(res.data.rows || res.data)).catch(() => []);
  }, [product.id]);

  // Load capacity for each level
  useEffect(() => {
    if (levels.length === 0) return;
    levels.forEach(lvl => {
      api.get(`/api/packaging/levels/${lvl.id}/capacity`)
        .then(res => {
          setCapacityInfo(prev => ({ ...prev, [lvl.id]: res.data }));
        })
        .catch(() => {});
    });
  }, [levels]);

  const resetForm = () => {
    setFormName('');
    setFormUnit('Box');
    setFormParentId('');
    setFormCapacityQty('10');
    setFormPrice('');
    setFormMrp('');
    setFormBarcode('');
    setFormIsDefault(false);
    setFormNotes('');
    setEditingLevelId(null);
    setIsCreating(false);
  };

  const handleStartEdit = (lvl: PackagingLevel) => {
    setEditingLevelId(lvl.id);
    setFormName(lvl.name);
    setFormUnit(lvl.package_unit);
    setFormParentId(lvl.parent_level_id || '');
    setFormCapacityQty(String(lvl.contains_quantity ?? lvl.capacity_quantity ?? '10'));
    setFormPrice(lvl.selling_price ? String(lvl.selling_price) : '');
    setFormMrp(lvl.mrp ? String(lvl.mrp) : '');
    setFormBarcode(lvl.barcode || '');
    setFormIsDefault(Boolean(lvl.is_default));
    setFormNotes(lvl.notes || '');
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  // Live calculated base equivalent for the form
  let formCalculatedBase = Number(formCapacityQty) || 1;
  let formParentUnitLabel = baseUnit;
  if (formParentId) {
    const parent = levels.find(l => l.id === formParentId);
    if (parent) {
      formParentUnitLabel = parent.package_unit || parent.name;
      formCalculatedBase = (Number(formCapacityQty) || 1) * Number(parent.base_quantity_equivalent || 1);
    }
  }

  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return toast('Packaging name is required', 'error');
    if (!formUnit.trim()) return toast('Package unit is required', 'error');
    if (!formCapacityQty || Number(formCapacityQty) <= 0) return toast('Capacity must be greater than zero', 'error');

    setSavingLevel(true);
    try {
      const payload = {
        product_id: product.id,
        product_type: 'finished_good',
        name: formName.trim(),
        package_unit: formUnit.trim(),
        contains_quantity: Number(formCapacityQty),
        capacity_quantity: Number(formCapacityQty),
        contains_unit: formParentUnitLabel || baseUnit,
        capacity_unit: formParentUnitLabel || baseUnit,
        parent_level_id: formParentId || null,
        selling_price: formPrice ? Number(formPrice) : 0,
        mrp: formMrp ? Number(formMrp) : 0,
        barcode: formBarcode.trim() || undefined,
        is_default: formIsDefault,
        notes: formNotes.trim() || undefined
      };

      if (editingLevelId) {
        await api.put(`/api/packaging/levels/${editingLevelId}`, payload);
        toast('Packaging level updated successfully');
      } else {
        await api.post('/api/packaging/levels', payload);
        toast('Packaging level added successfully');
      }

      resetForm();
      fetchLevels();
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save packaging level', 'error');
    } finally {
      setSavingLevel(false);
    }
  };

  const handleDeleteLevel = async (lvl: PackagingLevel) => {
    const ok = await confirm({
      title: 'Remove Packaging Level?',
      message: `Are you sure you want to remove "${lvl.name}"? Child packaging levels and historical references will be validated.`
    });
    if (!ok) return;

    try {
      await api.delete(`/api/packaging/levels/${lvl.id}`);
      toast('Packaging level removed');
      fetchLevels();
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete packaging level', 'error');
    }
  };

  // Open Materials BOM modal for a level
  const handleOpenBom = (lvl: PackagingLevel) => {
    setBomLevelId(lvl.id);
    setLoadingBom(true);
    api.get(`/api/packaging/levels/${lvl.id}`)
      .then(res => {
        setBomMaterials(res.data.materials || []);
      })
      .catch(() => toast('Failed to load packaging materials', 'error'))
      .finally(() => setLoadingBom(false));
  };

  const handleAddMaterial = async () => {
    if (!bomLevelId || !newMatItemId) return toast('Select a packaging material item', 'error');
    if (!newMatQty || Number(newMatQty) <= 0) return toast('Quantity must be greater than zero', 'error');

    try {
      await api.post(`/api/packaging/levels/${bomLevelId}/materials`, {
        material_item_id: newMatItemId,
        quantity: Number(newMatQty),
        uom: newMatUom
      });
      toast('Packaging material attached');
      setNewMatItemId('');
      setNewMatQty('1');
      // reload
      const res = await api.get(`/api/packaging/levels/${bomLevelId}`);
      setBomMaterials(res.data.materials || []);
      fetchLevels();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to add packaging material', 'error');
    }
  };

  const handleRemoveMaterial = async (matId: string) => {
    if (!bomLevelId) return;
    try {
      await api.delete(`/api/packaging/levels/${bomLevelId}/materials/${matId}`);
      toast('Packaging material removed');
      const res = await api.get(`/api/packaging/levels/${bomLevelId}`);
      setBomMaterials(res.data.materials || []);
      fetchLevels();
    } catch (err: any) {
      toast('Failed to remove material', 'error');
    }
  };

  return (
    <Drawer title={`Packaging Hierarchy — ${product.name}`} onClose={onClose} width="max-w-2xl sm:max-w-3xl">
      <div className="space-y-6">
        {/* Base Inventory Item Specification Header */}
        <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 rounded-2xl border border-blue-200/80 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 block">
                Base Inventory Truth
              </span>
              <h3 className="font-bold text-slate-900 text-sm">{product.name}</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Base Inventory Unit: <strong className="text-blue-800 font-mono">{baseUnit}</strong> • Standard Unit Price:{' '}
                <strong className="text-slate-900 font-mono">{formatCurrency(basePrice, workspace?.currency)}</strong>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Current Stock</span>
              <strong className="font-mono text-base text-slate-900">
                {formatNumber(product.available_stock ?? product.current_stock ?? 0)} {baseUnit}
              </strong>
            </div>
          </div>
        </div>

        {/* Packaging Hierarchy Visual Flow */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package size={16} className="text-blue-600" />
                Configured Packaging Hierarchy & Units
              </h4>
              <p className="text-xs text-slate-500">
                Define packaging sizes (e.g. Retail Pouch, Master Box, Pallet) with automated base quantity conversions.
              </p>
            </div>

            {!isCreating && !editingLevelId && (
              <Button className="text-xs px-3 py-1.5" icon={<Plus size={14} />} onClick={handleStartCreate}>
                Add Packaging Level
              </Button>
            )}
          </div>

          {/* Form for Creating or Editing a Packaging Level */}
          {(isCreating || editingLevelId) && (
            <form onSubmit={handleSaveLevel} className="p-4 bg-white rounded-2xl border-2 border-blue-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h5 className="font-bold text-xs text-blue-900">
                  {editingLevelId ? 'Edit Packaging Level' : 'Add New Packaging Level'}
                </h5>
                <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600">
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <Field label="Package Display Name" required>
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs"
                      placeholder="e.g. Retail Pouch, Master Box, Bulk Drum"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Package Unit Type" required>
                    <Select
                      value={formUnit}
                      onChange={setFormUnit}
                      options={STANDARD_UOMS.filter(u => u.category === 'packaging' || u.category === 'count').map(u => ({
                        value: u.value,
                        label: u.label
                      }))}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Parent Package (Contained Inside)">
                    <Select
                      value={formParentId}
                      onChange={setFormParentId}
                      options={[
                        { value: '', label: `Base Unit directly (${baseUnit})` },
                        ...levels
                          .filter(l => l.id !== editingLevelId)
                          .map(l => ({
                            value: l.id,
                            label: `${l.name} (${l.package_unit})`
                          }))
                      ]}
                    />
                  </Field>
                </div>

                <div>
                  <Field label={`Capacity (Number of ${formParentUnitLabel}s)`} required>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono"
                      value={formCapacityQty}
                      onChange={e => setFormCapacityQty(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Selling Price per Package">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono"
                      placeholder={`Calculated: ${(basePrice * formCalculatedBase).toFixed(2)}`}
                      value={formPrice}
                      onChange={e => setFormPrice(e.target.value)}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Maximum Retail Price (MRP)">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono"
                      placeholder="Optional"
                      value={formMrp}
                      onChange={e => setFormMrp(e.target.value)}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Package Barcode / SKU">
                    <input
                      type="text"
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono"
                      placeholder="e.g. 8901234567890"
                      value={formBarcode}
                      onChange={e => setFormBarcode(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500"
                      checked={formIsDefault}
                      onChange={e => setFormIsDefault(e.target.checked)}
                    />
                    Set as Default Sales Package
                  </label>
                </div>
              </div>

              {/* Conversion Preview Tag */}
              <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200/70 text-xs text-blue-900 flex items-center gap-2">
                <Sparkles size={14} className="text-blue-600 shrink-0" />
                <span>
                  <strong>Conversion Rule:</strong> 1 {formName || formUnit} = {formCapacityQty || 1} {formParentUnitLabel}
                  {formParentId ? ` (= ${formCalculatedBase} ${baseUnit}s)` : ''}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={resetForm} disabled={savingLevel}>
                  Cancel
                </Button>
                <Button type="submit" className="text-xs px-3 py-1.5" disabled={savingLevel}>
                  {savingLevel ? 'Saving...' : editingLevelId ? 'Save Changes' : 'Add Packaging Level'}
                </Button>
              </div>
            </form>
          )}

          {/* List of Existing Levels */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(n => <div key={n} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : levels.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 space-y-2">
              <Package size={28} className="mx-auto text-slate-300" />
              <p>No packaging levels configured yet. This product is currently sold only in base units ({baseUnit}).</p>
            </div>
          ) : (
            <div className="space-y-3">
              {levels.map((lvl, index) => {
                const cap = capacityInfo[lvl.id];
                const pkgCost = lvl.packaging_materials_cost || 0;

                return (
                  <div
                    key={lvl.id}
                    className="p-4 bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <strong className="text-slate-900 text-sm font-bold">{lvl.name}</strong>
                        <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                          Unit: {lvl.package_unit}
                        </span>
                        {lvl.is_default && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            Default Package
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          className="px-2 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium flex items-center gap-1 transition"
                          onClick={() => handleOpenBom(lvl)}
                        >
                          <Layers size={13} />
                          Packaging BOM ({lvl.materials_count || 0})
                        </button>
                        <button
                          className="p-1 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50"
                          onClick={() => handleStartEdit(lvl)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                          onClick={() => handleDeleteLevel(lvl)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Operational conversion and pricing metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Conversion</span>
                        <strong className="text-blue-700 font-mono text-xs">
                          = {formatNumber(lvl.base_quantity_equivalent)} {baseUnit}s
                        </strong>
                        {lvl.parent_package_name && (
                          <span className="text-[10px] text-slate-500 block">
                            ({lvl.contains_quantity ?? lvl.capacity_quantity} × {lvl.parent_package_name})
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Package Price</span>
                        <strong className="text-slate-900 font-mono text-xs">
                          {lvl.selling_price ? formatCurrency(lvl.selling_price, workspace?.currency) : 'Inherited'}
                        </strong>
                        {lvl.mrp > 0 && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            MRP: {formatCurrency(lvl.mrp, workspace?.currency)}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Packaging BOM Cost</span>
                        <strong className="text-slate-700 font-mono text-xs">
                          {formatCurrency(pkgCost, workspace?.currency)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Packaging Capacity</span>
                        {cap ? (
                          <div className="text-xs">
                            <strong className="text-emerald-700 font-mono font-bold">
                              {formatNumber(cap.possible_packages)} {lvl.package_unit}s
                            </strong>
                            <span className="text-[10px] text-slate-400 block">
                              ({formatNumber(cap.remainder_base_quantity)} {baseUnit}s rem.)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Calculating...</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Packaging Materials BOM Drawer / Modal */}
        {bomLevelId && (
          <Modal title="Packaging Bill of Materials (BOM)" onClose={() => setBomLevelId(null)}>
            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                Specify boxes, wraps, labels, containers, or tapes consumed when packaging this specific unit.
              </p>

              {/* Add Material Row */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="font-bold text-slate-800 block text-[11px] uppercase">Attach Packaging Material</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Select
                      value={newMatItemId}
                      onChange={val => {
                        setNewMatItemId(val);
                        const match = rawMaterials.find(m => m.id === val);
                        if (match) setNewMatUom(match.unit || 'unit');
                      }}
                      placeholder="Select Material / Component..."
                      options={rawMaterials.map(rm => ({
                        value: rm.id,
                        label: `${rm.name} (${rm.unit || 'unit'})`
                      }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      className="w-20 px-2 py-1.5 border rounded-lg text-xs font-mono"
                      placeholder="Qty"
                      value={newMatQty}
                      onChange={e => setNewMatQty(e.target.value)}
                    />
                    <Button className="text-xs px-3 py-1.5" onClick={handleAddMaterial}>Add</Button>
                  </div>
                </div>
              </div>

              {/* Existing BOM list */}
              {loadingBom ? (
                <div className="py-6 text-center text-slate-400">Loading BOM materials...</div>
              ) : bomMaterials.length === 0 ? (
                <div className="py-6 text-center text-slate-400">No packaging materials attached.</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Material</th>
                        <th className="p-2.5 text-right">Quantity</th>
                        <th className="p-2.5 text-right">Unit Cost</th>
                        <th className="p-2.5 text-right">Total</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {bomMaterials.map(mat => (
                        <tr key={mat.id}>
                          <td className="p-2.5 font-medium text-slate-900">{mat.item_name}</td>
                          <td className="p-2.5 text-right font-mono">{formatNumber(mat.quantity)} {mat.uom}</td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(mat.cost_per_unit, workspace?.currency)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(mat.quantity * mat.cost_per_unit, workspace?.currency)}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              className="text-slate-400 hover:text-rose-600"
                              onClick={() => handleRemoveMaterial(mat.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setBomLevelId(null)}>Done</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Drawer Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Drawer>
  );
}
