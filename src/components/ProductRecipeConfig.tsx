import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import {
  Layers, Package, Plus, Trash2, Edit2, CheckCircle2,
  Lock, CornerDownRight, Box, Calculator
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm, useWorkspace } from '../context';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Drawer, Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Select } from './ui/Select';

interface InputRow {
  item_id: string;
  item_name?: string;
  quantity: string;
  uom: string;
  scrap_percentage: string;
  estimated_cost: number;
}

interface OutputRow {
  product_id: string;
  product_name?: string;
  product_type: 'finished_good' | 'item';
  quantity: string;
  uom: string;
  is_primary: boolean;
  cost_allocation_percent: string;
  base_selling_price?: number;
}

interface PackagingLevel {
  id: string;
  product_id: string;
  name: string;
  package_unit: string;
  contains_quantity: number;
  contains_unit?: string | null;
  parent_level_id: string | null;
  parent_package_name?: string;
  base_quantity_equivalent: number;
  selling_price: number;
  mrp: number;
  barcode: string | null;
  is_default: boolean;
  status: string;
  notes: string | null;
}

interface ProductRecipeConfigProps {
  formulaId?: string | null;
  productId?: string | null;
  initialTab?: 'formula' | 'packaging';
  onClose: () => void;
  onSaved: () => void;
}

export function ProductRecipeConfig({
  formulaId,
  productId,
  initialTab = 'formula',
  onClose,
  onSaved
}: ProductRecipeConfigProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const { workspace } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'formula' | 'packaging'>(
    productId && !formulaId ? 'packaging' : initialTab
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Catalogs
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);

  // Formula state
  const [currentFormulaId, setCurrentFormulaId] = useState<string | null>(formulaId || null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [batchSize, setBatchSize] = useState('1');
  const [batchUom, setBatchUom] = useState('unit');
  const [status, setStatus] = useState('active');

  const [inputs, setInputs] = useState<InputRow[]>([
    { item_id: '', quantity: '1', uom: 'unit', scrap_percentage: '0', estimated_cost: 0 }
  ]);

  const [outputs, setOutputs] = useState<OutputRow[]>([
    { product_id: productId || '', product_type: 'finished_good', quantity: '1', uom: 'unit', is_primary: true, cost_allocation_percent: '100' }
  ]);

  // Packaging state per output
  const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
  const [packagingLevels, setPackagingLevels] = useState<PackagingLevel[]>([]);
  const [selectedProductBasePrice, setSelectedProductBasePrice] = useState<string>('0');
  const [savingBasePrice, setSavingBasePrice] = useState(false);

  // Level Editor Modal state
  const [editingLevel, setEditingLevel] = useState<PackagingLevel | null>(null);
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [levelFormName, setLevelFormName] = useState('');
  const [levelFormUnit, setLevelFormUnit] = useState('Packet');
  const [levelFormContainsQty, setLevelFormContainsQty] = useState('10');
  const [levelFormParentId, setLevelFormParentId] = useState<string>('');
  const [levelFormMrp, setLevelFormMrp] = useState('0');
  const [levelFormBarcode, setLevelFormBarcode] = useState('');
  const [levelFormIsDefault, setLevelFormIsDefault] = useState(false);
  const [levelFormNotes, setLevelFormNotes] = useState('');
  const [savingLevel, setSavingLevel] = useState(false);

  // Fetch catalog & initial formula or product
  useEffect(() => {
    Promise.all([
      api.get('/api/items?limit=300').then(res => res.data.rows || res.data).catch(() => []),
      api.get('/api/finished-goods?limit=300').then(res => res.data.rows || res.data).catch(() => [])
    ]).then(([itemsList, fgList]) => {
      setRawMaterials(itemsList);
      setFinishedGoods(fgList);

      if (currentFormulaId) {
        setLoading(true);
        api.get(`/api/manufacturing/formulas/${currentFormulaId}`)
          .then((res) => {
            const f = res.data;
            setName(f.name || '');
            setCode(f.code || '');
            setDescription(f.description || '');
            setBatchSize(String(f.batch_size || 1));
            setBatchUom(f.batch_uom || 'unit');
            setStatus(f.status || 'active');

            if (f.inputs && f.inputs.length > 0) {
              setInputs(f.inputs.map((i: any) => ({
                item_id: i.item_id || i.product_id,
                item_name: i.item_name,
                quantity: String(i.quantity),
                uom: i.uom || 'unit',
                scrap_percentage: String(i.scrap_percentage || i.expected_loss_percent || 0),
                estimated_cost: Number(i.unit_cost || 0)
              })));
            }

            if (f.outputs && f.outputs.length > 0) {
              setOutputs(f.outputs.map((o: any) => ({
                product_id: o.product_id || o.item_id,
                product_name: o.product_name || o.item_name,
                product_type: o.product_type || o.item_type || 'finished_good',
                quantity: String(o.quantity),
                uom: o.uom || 'unit',
                is_primary: Boolean(o.is_primary),
                cost_allocation_percent: String(o.cost_allocation_percent || 0)
              })));
            }
          })
          .catch((err) => toast(err.response?.data?.error || 'Failed to load formula', 'error'))
          .finally(() => setLoading(false));
      } else if (productId) {
        const foundFg = fgList.find((fg: any) => fg.id === productId);
        if (foundFg) {
          setName(`${foundFg.name} Standard Recipe`);
          setOutputs([{
            product_id: foundFg.id,
            product_name: foundFg.name,
            product_type: 'finished_good',
            quantity: '1',
            uom: foundFg.unit || 'unit',
            is_primary: true,
            cost_allocation_percent: '100'
          }]);
        }
      }
    });
  }, [currentFormulaId, productId]);

  // Current active output product in packaging tab
  const activeOutputProduct = outputs[selectedOutputIndex] || outputs[0];

  // Load packaging levels & base price for the selected output product
  const loadProductPackaging = (prodId: string) => {
    if (!prodId) {
      setPackagingLevels([]);
      setSelectedProductBasePrice('0');
      return;
    }

    const fg = finishedGoods.find(f => f.id === prodId);
    const initialBasePrice = fg?.base_selling_price != null ? fg.base_selling_price : (fg?.default_price || 0);
    setSelectedProductBasePrice(String(initialBasePrice));

    api.get(`/api/packaging/levels?product_id=${prodId}`)
      .then(res => {
        setPackagingLevels(res.data || []);
      })
      .catch(() => setPackagingLevels([]));
  };

  useEffect(() => {
    if (activeOutputProduct?.product_id) {
      loadProductPackaging(activeOutputProduct.product_id);
    }
  }, [activeOutputProduct?.product_id, finishedGoods]);

  // Update Base Selling Price
  const handleUpdateBaseSellingPrice = async () => {
    if (!activeOutputProduct?.product_id) return;
    setSavingBasePrice(true);
    try {
      const priceNum = Number(selectedProductBasePrice) || 0;
      await api.put(`/api/finished-goods/${activeOutputProduct.product_id}`, {
        base_selling_price: priceNum,
        default_price: priceNum
      });
      toast('Base selling price updated. Derived packaging prices recomputed!');
      loadProductPackaging(activeOutputProduct.product_id);
      // Update local finishedGoods cache
      setFinishedGoods(prev => prev.map(fg => fg.id === activeOutputProduct.product_id ? { ...fg, base_selling_price: priceNum, default_price: priceNum } : fg));
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to update base selling price', 'error');
    } finally {
      setSavingBasePrice(false);
    }
  };

  // Live calculations for inputs
  const totalInputCost = inputs.reduce((sum, inp) => {
    const qty = Number(inp.quantity) || 0;
    const scrap = Number(inp.scrap_percentage) || 0;
    const totalQty = qty * (1 + scrap / 100);
    return sum + (totalQty * (inp.estimated_cost || 0));
  }, 0);

  // Input row handlers
  const handleAddInput = () => {
    setInputs(prev => [...prev, { item_id: '', quantity: '1', uom: 'unit', scrap_percentage: '0', estimated_cost: 0 }]);
  };

  const handleRemoveInput = (index: number) => {
    if (inputs.length <= 1) return;
    setInputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (index: number, field: keyof InputRow, value: any) => {
    setInputs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'item_id') {
        const item = rawMaterials.find(m => m.id === value);
        if (item) {
          updated[index].item_name = item.name;
          updated[index].uom = item.unit || 'unit';
          updated[index].estimated_cost = Number(item.last_purchase_price || item.purchase_price || item.unit_cost || 0);
        }
      }
      return updated;
    });
  };

  // Output row handlers
  const handleAddOutput = () => {
    setOutputs(prev => [
      ...prev,
      { product_id: '', product_type: 'finished_good', quantity: '1', uom: 'unit', is_primary: false, cost_allocation_percent: '0' }
    ]);
  };

  const handleRemoveOutput = (index: number) => {
    if (outputs.length <= 1) return;
    setOutputs(prev => prev.filter((_, i) => i !== index));
    if (selectedOutputIndex >= outputs.length - 1) {
      setSelectedOutputIndex(Math.max(0, outputs.length - 2));
    }
  };

  const handleOutputChange = (index: number, field: keyof OutputRow, value: any) => {
    setOutputs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'product_id') {
        const fg = finishedGoods.find(f => f.id === value);
        if (fg) {
          updated[index].product_name = fg.name;
          updated[index].uom = fg.unit || 'unit';
          updated[index].base_selling_price = Number(fg.base_selling_price || fg.default_price || 0);
        }
      }
      if (field === 'is_primary' && value === true) {
        return updated.map((row, i) => ({ ...row, is_primary: i === index }));
      }
      return updated;
    });
  };

  // Save Formula
  const handleSaveFormula = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return toast('Formula / Recipe name is required', 'error');

    for (let i = 0; i < inputs.length; i++) {
      if (!inputs[i].item_id) return toast(`Input #${i + 1}: Material selection is required`, 'error');
      if (Number(inputs[i].quantity) <= 0) return toast(`Input #${i + 1}: Quantity must be greater than 0`, 'error');
    }

    for (let i = 0; i < outputs.length; i++) {
      if (!outputs[i].product_id) return toast(`Output #${i + 1}: Product selection is required`, 'error');
      if (Number(outputs[i].quantity) <= 0) return toast(`Output #${i + 1}: Quantity must be greater than 0`, 'error');
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        batch_size: Number(batchSize),
        batch_uom: batchUom,
        cost_allocation_method: 'equal_split',
        status,
        inputs: inputs.map(i => ({
          item_id: i.item_id,
          raw_material_id: i.item_id,
          product_id: i.item_id,
          item_type: 'raw_material',
          quantity: Number(i.quantity),
          uom: i.uom,
          scrap_percentage: Number(i.scrap_percentage) || 0,
          expected_loss_percent: Number(i.scrap_percentage) || 0
        })),
        outputs: outputs.map(o => ({
          item_id: o.product_id,
          product_id: o.product_id,
          item_type: o.product_type,
          product_type: o.product_type,
          quantity: Number(o.quantity),
          uom: o.uom,
          is_primary: Boolean(o.is_primary),
          cost_allocation_percent: 0
        }))
      };

      let resData;
      if (currentFormulaId) {
        resData = (await api.put(`/api/manufacturing/formulas/${currentFormulaId}`, payload)).data;
        toast('Formula updated successfully!');
      } else {
        resData = (await api.post('/api/manufacturing/formulas', payload)).data;
        setCurrentFormulaId(resData.id);
        toast('Formula created successfully! You can now configure packaging levels.');
      }

      onSaved();
      // If user came to configure packaging, seamlessly switch to packaging tab
      if (activeTab === 'formula') {
        setActiveTab('packaging');
      }
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save formula', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Packaging level modal handlers
  const handleOpenAddLevel = (parentId: string | null = null) => {
    setEditingLevel(null);
    setLevelFormName('');
    setLevelFormUnit(parentId ? 'Box' : 'Packet');
    setLevelFormContainsQty('10');
    setLevelFormParentId(parentId || '');
    setLevelFormMrp('0');
    setLevelFormBarcode('');
    setLevelFormIsDefault(packagingLevels.length === 0);
    setLevelFormNotes('');
    setIsLevelModalOpen(true);
  };

  const handleOpenEditLevel = (level: PackagingLevel) => {
    setEditingLevel(level);
    setLevelFormName(level.name);
    setLevelFormUnit(level.package_unit);
    setLevelFormContainsQty(String(level.contains_quantity));
    setLevelFormParentId(level.parent_level_id || '');
    setLevelFormMrp(String(level.mrp || 0));
    setLevelFormBarcode(level.barcode || '');
    setLevelFormIsDefault(Boolean(level.is_default));
    setLevelFormNotes(level.notes || '');
    setIsLevelModalOpen(true);
  };

  // Live computed selling price preview inside modal
  const parentLevel = packagingLevels.find(l => l.id === levelFormParentId);
  const parentBaseEquivalent = parentLevel ? Number(parentLevel.base_quantity_equivalent) || 1 : 1;
  const currentContainsQty = Number(levelFormContainsQty) || 1;
  const currentBaseEquivalent = (levelFormParentId ? parentBaseEquivalent : 1) * currentContainsQty;
  const computedPricePreview = Math.round(((Number(selectedProductBasePrice) || 0) * currentBaseEquivalent) * 100) / 100;

  const handleSaveLevel = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOutputProduct?.product_id) return;
    if (!levelFormName.trim()) return toast('Packaging name is required', 'error');
    if (!levelFormUnit.trim()) return toast('Package unit is required', 'error');
    if (Number(levelFormContainsQty) <= 0) return toast('Contains quantity must be greater than 0', 'error');

    setSavingLevel(true);
    try {
      const payload = {
        product_id: activeOutputProduct.product_id,
        name: levelFormName.trim(),
        package_unit: levelFormUnit.trim(),
        contains_quantity: Number(levelFormContainsQty),
        parent_level_id: levelFormParentId || null,
        mrp: Number(levelFormMrp) || 0,
        barcode: levelFormBarcode.trim() || undefined,
        is_default: levelFormIsDefault,
        notes: levelFormNotes.trim() || undefined
      };

      if (editingLevel) {
        await api.put(`/api/packaging/levels/${editingLevel.id}`, payload);
        toast('Packaging level updated successfully!');
      } else {
        await api.post('/api/packaging/levels', payload);
        toast('Packaging level created successfully!');
      }

      setIsLevelModalOpen(false);
      loadProductPackaging(activeOutputProduct.product_id);
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save packaging level', 'error');
    } finally {
      setSavingLevel(false);
    }
  };

  const handleDeleteLevel = async (level: PackagingLevel) => {
    const ok = await confirm({
      title: `Delete "${level.name}"?`,
      message: 'Are you sure you want to remove this packaging configuration? Child levels will become root levels.'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/packaging/levels/${level.id}`);
      toast('Packaging level deleted');
      if (activeOutputProduct?.product_id) {
        loadProductPackaging(activeOutputProduct.product_id);
      }
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete packaging level', 'error');
    }
  };

  return (
    <Drawer
      title={currentFormulaId ? `Recipe & Packaging: ${name || 'Formula'}` : 'Configure Manufacturing Recipe & Packaging'}
      onClose={onClose}
      width="max-w-4xl sm:max-w-5xl"
    >
      <div className="flex flex-col h-full space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('formula')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'formula'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers size={15} />
              1. Manufacturing Formula (BOM)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('packaging')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'packaging'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package size={15} />
              2. Hierarchical Packaging & Pricing
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            Industry-Agnostic Single Model
          </span>
        </div>

        {loading && (
          <div className="p-8 text-center text-slate-400 animate-pulse text-xs">
            Loading recipe configuration...
          </div>
        )}

        {/* TAB 1: FORMULA / BOM EDITOR */}
        {!loading && activeTab === 'formula' && (
          <form onSubmit={handleSaveFormula} className="space-y-6">
            {/* Header Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <Field label="Formula / Recipe Name" required>
                <input
                  type="text"
                  placeholder="e.g. 0.01 Torson Spring - Grade A"
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </Field>

              <Field label="Formula Code / SKU">
                <input
                  type="text"
                  placeholder="e.g. BOM-SPR-01"
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden uppercase font-mono"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
              </Field>

              <Field label="Standard Batch Size" required>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  value={batchSize}
                  onChange={e => setBatchSize(e.target.value)}
                  required
                />
              </Field>
            </div>

            {/* Inputs Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    Raw Material Inputs (Consumed per Batch)
                  </h4>
                  <p className="text-[11px] text-slate-500">Quantities of ingredients, wire, seeds, chemicals, or bulk items consumed.</p>
                </div>
                <Button type="button" variant="secondary" icon={<Plus size={14} />} onClick={handleAddInput}>
                  Add Raw Material
                </Button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Raw Material / Component</th>
                      <th className="p-3 w-28 text-right">Quantity</th>
                      <th className="p-3 w-28">UOM</th>
                      <th className="p-3 w-28 text-right">Scrap / Loss %</th>
                      <th className="p-3 w-32 text-right">Est. Unit Cost</th>
                      <th className="p-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {inputs.map((inp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 min-w-[200px]">
                          <Select
                            value={inp.item_id}
                            onChange={val => handleInputChange(idx, 'item_id', val)}
                            placeholder="Select Raw Material / Item..."
                            options={rawMaterials.map(rm => ({
                              value: rm.id,
                              label: `${rm.name} (${rm.unit || 'unit'})`
                            }))}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-right font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            value={inp.quantity}
                            onChange={e => handleInputChange(idx, 'quantity', e.target.value)}
                            required
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            value={inp.uom}
                            onChange={e => handleInputChange(idx, 'uom', e.target.value)}
                            required
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="99"
                            className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-right font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            value={inp.scrap_percentage}
                            onChange={e => handleInputChange(idx, 'scrap_percentage', e.target.value)}
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(inp.estimated_cost, workspace?.currency)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveInput(idx)}
                            disabled={inputs.length <= 1}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end text-xs font-bold text-slate-700 pt-1">
                Estimated Total Raw Input Spend: {formatCurrency(totalInputCost, workspace?.currency)}
              </div>
            </div>

            {/* Outputs Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    Manufactured Outputs (Finished Goods & By-Products)
                  </h4>
                  <p className="text-[11px] text-slate-500">Output products generated from executing this standard batch.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" icon={<Plus size={14} />} onClick={handleAddOutput}>
                    Add Output Product
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Output Product</th>
                      <th className="p-3 w-28 text-right">Quantity</th>
                      <th className="p-3 w-28">UOM</th>
                      <th className="p-3 w-24 text-center">Primary</th>
                      <th className="p-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {outputs.map((out, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 min-w-[200px]">
                          <Select
                            value={out.product_id}
                            onChange={val => handleOutputChange(idx, 'product_id', val)}
                            placeholder="Select Finished Good..."
                            options={finishedGoods.map(fg => ({
                              value: fg.id,
                              label: `${fg.name} (${fg.unit || 'unit'})`
                            }))}
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            step="any"
                            min="0.0001"
                            className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-right font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            value={out.quantity}
                            onChange={e => handleOutputChange(idx, 'quantity', e.target.value)}
                            required
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                            value={out.uom}
                            onChange={e => handleOutputChange(idx, 'uom', e.target.value)}
                            required
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="radio"
                            name="primary_output"
                            checked={out.is_primary}
                            onChange={() => handleOutputChange(idx, 'is_primary', true)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveOutput(idx)}
                            disabled={outputs.length <= 1}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            <Field label="Standard Operating Instructions / Notes">
              <textarea
                rows={2}
                placeholder="e.g. Pre-heat mixing tank to 65C. Add raw materials in sequence."
                className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </Field>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : currentFormulaId ? 'Save & Update Formula' : 'Save Formula & Continue to Packaging'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: PACKAGING HIERARCHY & DERIVED PRICING */}
        {activeTab === 'packaging' && (
          <div className="space-y-6">
            {/* Output Selector (if multiple outputs exist, e.g. Example 2 Oil + Khali) */}
            {outputs.length > 1 && (
              <div className="bg-slate-100 p-2.5 rounded-2xl flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 px-2">Select Output Product:</span>
                <div className="flex flex-wrap gap-1.5">
                  {outputs.map((out, idx) => {
                    const fgName = out.product_name || finishedGoods.find(f => f.id === out.product_id)?.name || `Output #${idx + 1}`;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOutputIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          selectedOutputIndex === idx
                            ? 'bg-white text-blue-700 shadow-xs border border-blue-200'
                            : 'text-slate-600 hover:bg-slate-200/80'
                        }`}
                      >
                        {fgName} ({out.quantity} {out.uom})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Base Selling Price Card */}
            <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-white p-4 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Base Unit Selling Price (Per Atomic Unit)
                  </h4>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                    Anchor Price
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Manual user-entered price for exactly <strong>1 {activeOutputProduct?.uom || 'base unit'}</strong> of {activeOutputProduct?.product_name || 'this product'}.
                  All packaging level selling prices derive strictly from this value.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                    {workspace?.currency === 'INR' ? '₹' : '$'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7 pr-3 py-1.5 border border-blue-300 rounded-xl text-xs font-mono font-bold text-slate-900 bg-white w-32 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    value={selectedProductBasePrice}
                    onChange={e => setSelectedProductBasePrice(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleUpdateBaseSellingPrice}
                  disabled={savingBasePrice}
                  variant="secondary"
                  className="text-xs whitespace-nowrap"
                >
                  {savingBasePrice ? 'Updating...' : 'Update Base Price'}
                </Button>
              </div>
            </div>

            {/* Packaging Tree / Levels Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={14} className="text-blue-600" />
                  Hierarchical Packaging Configurations
                </h4>
                <p className="text-[11px] text-slate-500">
                  Configure flat sibling packaging options (e.g. Bottle vs Tin) or nested multi-level tiers (e.g. Strip $\to$ Packet).
                </p>
              </div>

              <Button
                type="button"
                icon={<Plus size={14} />}
                onClick={() => handleOpenAddLevel(null)}
              >
                Add Packaging Option
              </Button>
            </div>

            {/* Packaging Levels List */}
            {packagingLevels.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                <Box size={28} className="mx-auto text-slate-400" />
                <p className="text-xs font-bold text-slate-700">No Packaging Levels Configured</p>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  By default, this product is managed as loose base units. Add packaging options like packets, bottles, tins, strips, or boxes to enable multi-package production run splitting.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus size={14} />}
                  onClick={() => handleOpenAddLevel(null)}
                >
                  Add First Packaging Level
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {packagingLevels.map((lvl) => {
                  const parent = packagingLevels.find(p => p.id === lvl.parent_level_id);
                  const baseEq = lvl.base_quantity_equivalent;
                  const unitLabel = activeOutputProduct?.uom || 'units';

                  return (
                    <div
                      key={lvl.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-blue-50 text-blue-700 font-bold">
                            <Package size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-bold text-slate-900">{lvl.name}</h5>
                              {lvl.is_default && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded-full">
                                  Default
                                </span>
                              )}
                              {parent ? (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-medium px-2 py-0.2 rounded-full flex items-center gap-1">
                                  <CornerDownRight size={10} />
                                  Wraps {parent.name}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.2 rounded-full">
                                  Root Option
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              1 {lvl.package_unit} contains <strong>{lvl.contains_quantity} {parent ? parent.package_unit : unitLabel}</strong>
                              {' '}(= <span className="font-mono font-bold text-slate-800">{formatNumber(baseEq)} {unitLabel}</span>)
                            </p>
                          </div>
                        </div>

                        {/* Financial Cards */}
                        <div className="flex items-center gap-3">
                          {/* Auto-Calculated Selling Price */}
                          <div className="bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-right">
                            <span className="text-[10px] uppercase font-bold text-emerald-800 flex items-center justify-end gap-1">
                              <Lock size={10} /> Selling Price (Derived)
                            </span>
                            <div className="text-xs font-mono font-bold text-emerald-950">
                              {formatCurrency(lvl.selling_price, workspace?.currency)}
                            </div>
                            <span className="text-[9px] text-emerald-700 font-mono">
                              {baseEq} × {formatCurrency(Number(selectedProductBasePrice) || 0, workspace?.currency)}
                            </span>
                          </div>

                          {/* Manual MRP */}
                          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-500">
                              MRP (Manual)
                            </span>
                            <div className="text-xs font-mono font-bold text-slate-800">
                              {formatCurrency(lvl.mrp, workspace?.currency)}
                            </div>
                            <span className="text-[9px] text-slate-400">User Entered</span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 pl-2 border-l border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleOpenAddLevel(lvl.id)}
                              title="Add child packaging level nesting under this"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Plus size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditLevel(lvl)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLevel(lvl)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Button type="button" variant="secondary" onClick={() => setActiveTab('formula')}>
                Back to Formula
              </Button>
              <Button type="button" onClick={onClose}>
                Done & Close
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT PACKAGING LEVEL */}
      {isLevelModalOpen && (
        <Modal
          title={editingLevel ? `Edit Packaging Level: ${editingLevel.name}` : 'Add Packaging Level'}
          onClose={() => setIsLevelModalOpen(false)}
        >
          <form onSubmit={handleSaveLevel} className="space-y-4">
            <Field label="Packaging Level Name" required>
              <input
                type="text"
                placeholder="e.g. Packet of 15, 1L Bottle, Strip of 10"
                className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                value={levelFormName}
                onChange={e => setLevelFormName(e.target.value)}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Package Unit Label" required>
                <input
                  type="text"
                  placeholder="e.g. Packet, Box, Strip, Bottle, Tin, Katta"
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  value={levelFormUnit}
                  onChange={e => setLevelFormUnit(e.target.value)}
                  required
                />
              </Field>

              <Field label="Encloses / Nests Inside">
                <Select
                  value={levelFormParentId}
                  onChange={setLevelFormParentId}
                  options={[
                    { value: '', label: `Base Product Directly (${activeOutputProduct?.uom || 'base units'})` },
                    ...packagingLevels
                      .filter(l => editingLevel ? l.id !== editingLevel.id : true)
                      .map(lvl => ({
                        value: lvl.id,
                        label: `Parent Level: ${lvl.name} (${lvl.package_unit})`
                      }))
                  ]}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Contains Quantity (in ${parentLevel ? parentLevel.package_unit : (activeOutputProduct?.uom || 'base unit')})`} required>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono font-bold"
                  value={levelFormContainsQty}
                  onChange={e => setLevelFormContainsQty(e.target.value)}
                  required
                />
              </Field>

              <Field label="MRP (Maximum Retail Price)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                  value={levelFormMrp}
                  onChange={e => setLevelFormMrp(e.target.value)}
                />
              </Field>
            </div>

            {/* Auto-Calculated Selling Price Card */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-950 flex items-center gap-1">
                  <Calculator size={13} className="text-emerald-700" />
                  Auto-Computed Selling Price:
                </span>
                <strong className="text-sm font-mono text-emerald-900">
                  {formatCurrency(computedPricePreview, workspace?.currency)}
                </strong>
              </div>
              <p className="text-[11px] text-emerald-800 font-mono">
                {currentBaseEquivalent} base {activeOutputProduct?.uom || 'units'} × {formatCurrency(Number(selectedProductBasePrice) || 0, workspace?.currency)} base price
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default_lvl"
                checked={levelFormIsDefault}
                onChange={e => setLevelFormIsDefault(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="is_default_lvl" className="text-xs text-slate-700 font-medium cursor-pointer">
                Set as default packaging option for this product
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <Button type="button" variant="secondary" onClick={() => setIsLevelModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingLevel}>
                {savingLevel ? 'Saving...' : editingLevel ? 'Update Level' : 'Create Packaging Level'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Drawer>
  );
}
