import { useState, useEffect } from 'react';
import {
  Layers, Plus, Edit2, Trash2, Eye, Calculator,
  ArrowRight
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm, useWorkspace } from '../context';
import { formatCurrency, formatNumber } from '../lib/utils';
import { Button } from './ui/Button';
import { Drawer, Modal } from './ui/Modal';
import { StatusBadge } from './ui/StatusBadge';
import { ProductRecipeConfig } from './ProductRecipeConfig';

interface FormulaSummary {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  version: number;
  status: string;
  batch_size: number;
  batch_uom: string;
  cost_allocation_method: string;
  inputs_count: number;
  outputs_count: number;
  created_at: string;
  updated_at: string;
}

export function ManufacturingFormulasTab({
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onSelectForRun
}: {
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onSelectForRun?: (formulaId: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { workspace } = useWorkspace();

  const [formulas, setFormulas] = useState<FormulaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editorFormulaId, setEditorFormulaId] = useState<string | null | undefined>(undefined);
  const [viewFormulaId, setViewFormulaId] = useState<string | null>(null);
  const [scaleFormula, setScaleFormula] = useState<any | null>(null);
  const [scaleTargetQty, setScaleTargetQty] = useState('100');
  const [scaledResult, setScaledResult] = useState<any | null>(null);
  const [scalingLoading, setScalingLoading] = useState(false);

  const fetchFormulas = () => {
    setLoading(true);
    api.get('/api/manufacturing/formulas')
      .then((res) => {
        setFormulas(res.data || []);
      })
      .catch((err) => {
        toast(err.response?.data?.error || 'Failed to fetch formulas', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFormulas();
  }, []);

  const handleDelete = async (formula: FormulaSummary) => {
    const ok = await confirm({
      title: 'Archive Manufacturing Formula?',
      message: `Are you sure you want to archive "${formula.name}" (v${formula.version})? Existing production runs will retain their history.`
    });
    if (!ok) return;

    try {
      await api.delete(`/api/manufacturing/formulas/${formula.id}`);
      toast('Formula archived successfully');
      fetchFormulas();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to archive formula', 'error');
    }
  };

  const handleOpenScale = (f: any) => {
    setScaleFormula(f);
    setScaleTargetQty(String(f.batch_size || 100));
    calculateScale(f.id, f.batch_size || 100);
  };

  const calculateScale = (formulaId: string, size: number) => {
    setScalingLoading(true);
    api.get(`/api/manufacturing/formulas/${formulaId}/scale?batch_size=${size}`)
      .then((res) => {
        setScaledResult(res.data);
      })
      .catch((err) => {
        toast(err.response?.data?.error || 'Failed to calculate scaled batch', 'error');
      })
      .finally(() => setScalingLoading(false));
  };

  const filtered = formulas.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.code && f.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search formulas by name or code..."
            className="px-3.5 py-2 border rounded-xl text-xs w-full sm:w-72 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="text-xs text-slate-500 hidden sm:inline whitespace-nowrap">
            {filtered.length} {filtered.length === 1 ? 'formula' : 'formulas'}
          </span>
        </div>

        {canCreate && (
          <Button icon={<Plus size={16} />} onClick={() => setEditorFormulaId(null)}>
            New Manufacturing Formula
          </Button>
        )}
      </div>

      {/* Formulas Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <Layers size={40} className="mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">No Manufacturing Formulas Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Formulas define recipes, bill of materials (BOM), expected yields, and cost allocations for converting raw materials into finished products.
          </p>
          {canCreate && (
            <Button className="text-xs px-3 py-1.5" icon={<Plus size={14} />} onClick={() => setEditorFormulaId(null)}>
              Create First Formula
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(formula => (
            <div
              key={formula.id}
              className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                        v{formula.version}
                      </span>
                      {formula.code && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {formula.code}
                        </span>
                      )}
                      <StatusBadge status={formula.status} />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-1.5 truncate group-hover:text-blue-600 transition">
                      {formula.name}
                    </h4>
                  </div>
                </div>

                {formula.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{formula.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Batch Size</span>
                    <strong className="text-slate-800 font-mono text-xs">
                      {formatNumber(formula.batch_size)} {formula.batch_uom}
                    </strong>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">BOM Recipe</span>
                    <strong className="text-slate-800 text-xs">
                      {formula.inputs_count} in → {formula.outputs_count} out
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between p-3 bg-slate-50/70 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-white"
                    title="Scale Batch Calculator"
                    onClick={() => handleOpenScale(formula)}
                  >
                    <Calculator size={15} />
                  </button>
                  <button
                    className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-white"
                    title="View Details"
                    onClick={() => setViewFormulaId(formula.id)}
                  >
                    <Eye size={15} />
                  </button>
                  {canEdit && (
                    <button
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-white"
                      title="Edit Formula"
                      onClick={() => setEditorFormulaId(formula.id)}
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white"
                      title="Archive Formula"
                      onClick={() => handleDelete(formula)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {onSelectForRun && (
                  <Button
                    variant="secondary"
                    className="text-xs font-semibold px-3 py-1.5"
                    icon={<ArrowRight size={13} />}
                    onClick={() => onSelectForRun(formula.id)}
                  >
                    Start Run
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unified Recipe & Packaging Configuration */}
      {editorFormulaId !== undefined && (
        <ProductRecipeConfig
          formulaId={editorFormulaId}
          onClose={() => setEditorFormulaId(undefined)}
          onSaved={fetchFormulas}
        />
      )}

      {/* Batch Scaling Simulator Modal */}
      {scaleFormula && (
        <Modal title={`Batch Scaling Simulator — ${scaleFormula.name}`} onClose={() => setScaleFormula(null)} wide>
          <div className="space-y-5">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold">Standard Formula Scale:</span>{' '}
                {formatNumber(scaleFormula.batch_size)} {scaleFormula.batch_uom}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Target Production Batch:</span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  className="w-24 px-2.5 py-1 bg-white border border-blue-300 rounded-lg font-mono font-bold text-xs"
                  value={scaleTargetQty}
                  onChange={e => {
                    setScaleTargetQty(e.target.value);
                    if (Number(e.target.value) > 0) {
                      calculateScale(scaleFormula.id, Number(e.target.value));
                    }
                  }}
                />
                <span className="font-mono text-xs">{scaleFormula.batch_uom}</span>
              </div>
            </div>

            {scalingLoading ? (
              <div className="py-8 text-center text-xs text-slate-400">Recalculating proportional BOM requirements...</div>
            ) : scaledResult ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Required Raw Materials (Inputs)</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Material</th>
                          <th className="p-2.5 text-right">Unit Cost</th>
                          <th className="p-2.5 text-right">Scaled Quantity</th>
                          <th className="p-2.5 text-right">With Scrap Allowance</th>
                          <th className="p-2.5 text-right">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {scaledResult.inputs?.map((inp: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-medium text-slate-900">{inp.item_name}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(inp.unit_cost, workspace?.currency)} / {inp.uom}</td>
                            <td className="p-2.5 text-right font-mono">{formatNumber(inp.scaled_quantity)} {inp.uom}</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatNumber(inp.required_with_scrap)} {inp.uom}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(inp.line_cost, workspace?.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right text-xs text-slate-600 mt-1.5 font-medium">
                    Total Estimated Input Cost: <strong className="font-mono text-slate-900 text-sm">{formatCurrency(scaledResult.total_estimated_input_cost, workspace?.currency)}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Expected Finished Goods (Outputs)</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-right">Expected Output</th>
                          <th className="p-2.5 text-right">Est. Allocated Cost</th>
                          <th className="p-2.5 text-right">Unit Manufacturing Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {scaledResult.outputs?.map((out: any, idx: number) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-medium text-slate-900">
                              {out.product_name}
                              {out.is_primary && (
                                <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">Primary</span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatNumber(out.scaled_quantity)} {out.uom}</td>
                            <td className="p-2.5 text-right font-mono text-slate-700">{formatCurrency(out.allocated_cost, workspace?.currency)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-700">{formatCurrency(out.estimated_unit_cost, workspace?.currency)} / {out.uom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setScaleFormula(null)}>
                Close Simulator
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Formula Detail Drawer */}
      {viewFormulaId && (
        <FormulaDetailDrawer
          formulaId={viewFormulaId}
          onClose={() => setViewFormulaId(null)}
          onEdit={() => {
            setEditorFormulaId(viewFormulaId);
            setViewFormulaId(null);
          }}
        />
      )}
    </div>
  );
}

function FormulaDetailDrawer({
  formulaId,
  onClose,
  onEdit
}: {
  formulaId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const toast = useToast();
  const { workspace } = useWorkspace();
  const [formula, setFormula] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/manufacturing/formulas/${formulaId}`)
      .then(res => setFormula(res.data))
      .catch(err => toast(err.response?.data?.error || 'Failed to fetch formula', 'error'))
      .finally(() => setLoading(false));
  }, [formulaId]);

  if (loading) {
    return (
      <Drawer title="Formula Details" onClose={onClose}>
        <div className="p-8 text-center text-xs text-slate-400 animate-pulse">Loading recipe specifications...</div>
      </Drawer>
    );
  }

  if (!formula) return null;

  return (
    <Drawer title={formula.name} onClose={onClose} width="max-w-xl sm:max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
            Version {formula.version}
          </span>
          <StatusBadge status={formula.status} />
          {formula.code && <span className="text-xs font-mono text-slate-500">[{formula.code}]</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Batch Size</span>
            <strong className="text-slate-900 font-mono text-xs">{formatNumber(formula.batch_size)} {formula.batch_uom}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Expected Yield</span>
            <strong className="text-emerald-700 font-mono text-xs">{formula.expected_yield_percent ? `${formula.expected_yield_percent}%` : '100%'}</strong>
          </div>
        </div>

        {formula.description && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950">
            <span className="font-bold text-[10px] uppercase block text-amber-800">Operating Instructions / Notes</span>
            <p className="mt-1 whitespace-pre-line">{formula.description}</p>
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Raw Material Inputs ({formula.inputs?.length || 0})</h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Material</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  <th className="p-2.5 text-right">Scrap %</th>
                  <th className="p-2.5 text-right">Est. Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {formula.inputs?.map((inp: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2.5 font-medium text-slate-900">{inp.item_name}</td>
                    <td className="p-2.5 text-right font-mono">{formatNumber(inp.quantity)} {inp.uom}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">{inp.scrap_percentage || 0}%</td>
                    <td className="p-2.5 text-right font-mono text-slate-800">{formatCurrency(inp.unit_cost, workspace?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outputs */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Manufactured Outputs ({formula.outputs?.length || 0})</h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {formula.outputs?.map((out: any, idx: number) => (
                  <tr key={idx}>
                    <td className="p-2.5 font-medium text-slate-900">
                      {out.product_name}
                      {out.is_primary && (
                        <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">Primary</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatNumber(out.quantity)} {out.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={onEdit} icon={<Edit2 size={14} />}>Edit Formula</Button>
        </div>
      </div>
    </Drawer>
  );
}
