import { useEffect, useState } from 'react';
import { Plus, Trash2, Layers, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { formatCurrency } from '../lib/utils';
import { STANDARD_UOMS } from '../lib/uom';
import { Modal } from './ui/Modal';
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
  catalog_price?: number;
}

export function FormulaEditorModal({
  formulaId,
  onClose,
  onSaved
}: {
  formulaId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available catalog choices
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);

  // Formula state
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
    { product_id: '', product_type: 'finished_good', quantity: '1', uom: 'unit', is_primary: true, cost_allocation_percent: '100' }
  ]);

  // Fetch catalog items & formula details
  useEffect(() => {
    Promise.all([
      api.get('/api/items?limit=200').then(res => res.data.rows || res.data).catch(() => []),
      api.get('/api/finished-goods?limit=200').then(res => res.data.rows || res.data).catch(() => [])
    ]).then(([itemsList, fgList]) => {
      setRawMaterials(itemsList);
      setFinishedGoods(fgList);

      if (formulaId) {
        setLoading(true);
        api.get(`/api/manufacturing/formulas/${formulaId}`)
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
                item_id: i.item_id,
                item_name: i.item_name,
                quantity: String(i.quantity),
                uom: i.uom || 'unit',
                scrap_percentage: String(i.scrap_percentage || 0),
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
                cost_allocation_percent: String(o.cost_allocation_percent || 0),
                catalog_price: Number(o.catalog_price || 0)
              })));
            }
          })
          .catch((err) => {
            toast(err.response?.data?.error || 'Failed to load formula', 'error');
          })
          .finally(() => setLoading(false));
      }
    });
  }, [formulaId]);

  // Live calculations
  const totalInputCost = inputs.reduce((sum, inp) => {
    const qty = Number(inp.quantity) || 0;
    const scrap = Number(inp.scrap_percentage) || 0;
    const totalQty = qty * (1 + scrap / 100);
    return sum + (totalQty * (inp.estimated_cost || 0));
  }, 0);

  const handleAddInput = () => {
    setInputs(prev => [...prev, { item_id: '', quantity: '1', uom: 'unit', scrap_percentage: '0', estimated_cost: 0 }]);
  };

  const handleRemoveInput = (index: number) => {
    if (inputs.length <= 1) return toast('Formula must have at least one input material', 'error');
    setInputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (index: number, field: keyof InputRow, val: any) => {
    setInputs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'item_id') {
        const found = rawMaterials.find(rm => rm.id === val);
        if (found) {
          copy[index].uom = found.unit || 'unit';
          copy[index].estimated_cost = Number(found.last_purchase_price || found.standard_cost || 0);
        }
      }
      return copy;
    });
  };

  const handleAddOutput = () => {
    setOutputs(prev => [
      ...prev,
      {
        product_id: '',
        product_type: 'finished_good' as const,
        quantity: '1',
        uom: 'unit',
        is_primary: false,
        cost_allocation_percent: '0'
      }
    ]);
  };

  const handleRemoveOutput = (index: number) => {
    if (outputs.length <= 1) return toast('Formula must have at least one output product', 'error');
    setOutputs(prev => {
      const remaining = prev.filter((_, i) => i !== index);
      if (!remaining.some(o => o.is_primary) && remaining.length > 0) {
        remaining[0].is_primary = true;
      }
      return remaining;
    });
  };

  const handleOutputChange = (index: number, field: keyof OutputRow, val: any) => {
    setOutputs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'product_id') {
        const fg = finishedGoods.find(p => p.id === val);
        const itm = rawMaterials.find(p => p.id === val);
        const match = fg || itm;
        if (match) {
          copy[index].uom = match.unit || 'unit';
          copy[index].catalog_price = Number(match.default_price || match.selling_price || 0);
          copy[index].product_type = fg ? 'finished_good' : 'item';
        }
      }
      if (field === 'is_primary' && val === true) {
        copy.forEach((o, i) => { if (i !== index) o.is_primary = false; });
      }
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast('Formula Name is required', 'error');
    if (!batchSize || Number(batchSize) <= 0) return toast('Batch size must be greater than zero', 'error');

    for (const inp of inputs) {
      if (!inp.item_id) return toast('Please select raw materials for all inputs', 'error');
      if (!inp.quantity || Number(inp.quantity) <= 0) return toast('Input quantities must be greater than zero', 'error');
    }

    for (const out of outputs) {
      if (!out.product_id) return toast('Please select products for all outputs', 'error');
      if (!out.quantity || Number(out.quantity) <= 0) return toast('Output quantities must be greater than zero', 'error');
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

      if (formulaId) {
        await api.put(`/api/manufacturing/formulas/${formulaId}`, payload);
        toast('Formula updated successfully!');
      } else {
        await api.post('/api/manufacturing/formulas', payload);
        toast('Formula created successfully!');
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to save formula', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Loading Formula..." onClose={onClose} wide>
        <div className="p-8 text-center text-slate-500 animate-pulse">Fetching manufacturing formula details...</div>
      </Modal>
    );
  }

  return (
    <Modal title={formulaId ? 'Edit Manufacturing Formula (BOM)' : 'Create Manufacturing Formula (BOM)'} onClose={onClose} wide>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Field label="Formula / Recipe Name" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="e.g. Premium Cold-Pressed Oil 100L, Steel Assembly Bracket 50pk"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </Field>
          </div>
          <div>
            <Field label="Formula Code / SKU">
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
                placeholder="e.g. FORM-OIL-01"
                value={code}
                onChange={e => setCode(e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* Batch Scale & Units */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div>
            <Field label="Standard Batch Size" required>
              <input
                type="number"
                step="any"
                min="0.0001"
                className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                value={batchSize}
                onChange={e => setBatchSize(e.target.value)}
                required
              />
            </Field>
          </div>
          <div>
            <Field label="Batch Unit of Measure (UOM)" required>
              <Select
                value={batchUom}
                onChange={setBatchUom}
                options={STANDARD_UOMS.map(u => ({ value: u.value, label: u.label }))}
              />
            </Field>
          </div>
        </div>

        {/* 1. Raw Materials Inputs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Layers size={16} className="text-blue-600" />
                Raw Material Inputs (Bill of Materials)
              </h3>
              <p className="text-xs text-slate-500">Quantities of ingredients, components, or bulk items consumed per batch.</p>
            </div>
            <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" icon={<Plus size={14} />} onClick={handleAddInput}>
              Add Raw Material
            </Button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Raw Material / Component</th>
                  <th className="p-2.5 w-28">Quantity</th>
                  <th className="p-2.5 w-32">UOM</th>
                  <th className="p-2.5 w-28">Scrap / Loss %</th>
                  <th className="p-2.5 w-32 text-right">Est. Unit Cost</th>
                  <th className="p-2.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {inputs.map((inp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 min-w-[200px]">
                      <Select
                        value={inp.item_id}
                        onChange={val => handleInputChange(idx, 'item_id', val)}
                        placeholder="Select Material / Item..."
                        options={rawMaterials.map(rm => ({
                          value: rm.id,
                          label: `${rm.name} (${rm.sku || rm.unit || 'unit'})`
                        }))}
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        className="w-full px-2 py-1.5 border rounded-lg text-xs font-mono"
                        value={inp.quantity}
                        onChange={e => handleInputChange(idx, 'quantity', e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-2.5 w-32">
                      <Select
                        value={inp.uom}
                        onChange={val => handleInputChange(idx, 'uom', val)}
                        options={STANDARD_UOMS.map(u => ({ value: u.value, label: u.value }))}
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="99"
                        className="w-full px-2 py-1.5 border rounded-lg text-xs font-mono"
                        placeholder="0%"
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
                        className="text-slate-400 hover:text-rose-600 p-1"
                        onClick={() => handleRemoveInput(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pr-2 text-xs text-slate-600">
            Estimated Total Input Cost: <strong className="ml-1.5 font-mono text-slate-900">{formatCurrency(totalInputCost, workspace?.currency)}</strong>
          </div>
        </div>

        {/* 2. Produced Outputs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Manufactured Outputs (Finished Goods & By-Products)
              </h3>
              <p className="text-xs text-slate-500">Output products generated from executing this standard batch.</p>
            </div>
            <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" icon={<Plus size={14} />} onClick={handleAddOutput}>
              Add Output Product
            </Button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Output Product</th>
                  <th className="p-2.5 w-28">Quantity</th>
                  <th className="p-2.5 w-32">UOM</th>
                  <th className="p-2.5 w-24 text-center">Primary</th>
                  <th className="p-2.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {outputs.map((out, idx) => {
                  const productOptions = [
                    ...finishedGoods.map(fg => ({ value: fg.id, label: `${fg.name} (${fg.sku || fg.unit || 'unit'})` })),
                    ...rawMaterials.map(rm => ({ value: rm.id, label: `${rm.name} (${rm.unit || 'unit'})` }))
                  ];
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 min-w-[200px]">
                        <Select
                          value={out.product_id}
                          onChange={val => handleOutputChange(idx, 'product_id', val)}
                          placeholder="Select Output Product..."
                          options={productOptions}
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          className="w-full px-2 py-1.5 border rounded-lg text-xs font-mono"
                          value={out.quantity}
                          onChange={e => handleOutputChange(idx, 'quantity', e.target.value)}
                          required
                        />
                      </td>
                      <td className="p-2.5 w-32">
                        <Select
                          value={out.uom}
                          onChange={val => handleOutputChange(idx, 'uom', val)}
                          options={STANDARD_UOMS.map(u => ({ value: u.value, label: u.value }))}
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="radio"
                          name="primary_output"
                          checked={out.is_primary}
                          onChange={() => handleOutputChange(idx, 'is_primary', true)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600 p-1"
                          onClick={() => handleRemoveOutput(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Description & Operational Instructions */}
        <div>
          <Field label="Standard Operating Instructions / Notes">
            <textarea
              rows={2}
              className="w-full px-3 py-2 border rounded-xl text-xs"
              placeholder="e.g. Pre-heat mixing tank to 65C. Add raw materials in sequence. Filter through 50 micron mesh."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </Field>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : formulaId ? 'Update Formula' : 'Create Formula'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
