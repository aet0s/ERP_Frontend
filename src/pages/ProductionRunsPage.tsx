import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Boxes, Plus, Trash2, Layers, CircleDollarSign,
  MapPin, Calendar, Copy, TrendingUp, Package,
  CheckCircle2, FileText, Sparkles, Clock, X, AlertTriangle
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace, useConfirm } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { usePersistentTab } from '../hooks/usePersistentTab';
import { formatCurrency, formatNumber, formatDate, dateIso, csvDownload } from '../lib/utils';
import { DatePicker } from '../components/ui/DatePicker';
import type { TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Modal, Drawer } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';
import { ManufacturingFormulasTab } from '../components/ManufacturingFormulasTab';

const PRODUCTION_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'run_number', label: 'Production Run #', category: 'Identifiers' },
  { key: 'date', label: 'Run Date', category: 'Identifiers' },
  { key: 'location_name', label: 'Manufacturing Facility / Location', category: 'Identifiers' },
  { key: 'status', label: 'Status', category: 'Identifiers' },
  { key: 'output_summary', label: 'Produced Finished Goods Summary', category: 'Outputs' },
  { key: 'output_count', label: 'Output Product Types Count', category: 'Outputs' },
  { key: 'input_count', label: 'Input Materials Count', category: 'Inputs' },
  { key: 'raw_materials_cost', label: 'Raw Materials Cost', category: 'Financials & Costing' },
  { key: 'labor_cost', label: 'Direct Labor Cost', category: 'Financials & Costing' },
  { key: 'other_cost', label: 'Overhead / Misc Cost', category: 'Financials & Costing' },
  { key: 'total_input_cost', label: 'Total Manufacturing Cost', category: 'Financials & Costing' },
  { key: 'notes', label: 'Production Notes / Instructions', category: 'Notes' },
  { key: 'created_at', label: 'Logged At', category: 'Audit' }
];

function ProductionRunDetailDrawer({
  runId,
  onClose,
  onVoid
}: {
  runId: string;
  onClose: () => void;
  onVoid?: (id: string) => void;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [run, setRun] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/production-runs/${runId}`)
      .then((res) => setRun(res.data))
      .catch((err) => {
        toast(err.response?.data?.error || 'Failed to fetch production run details', 'error');
      })
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <Drawer title="Production Run Details" onClose={onClose} width="max-w-2xl sm:max-w-3xl">
        <div className="space-y-4 animate-pulse p-2">
          <div className="h-32 bg-slate-100 rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="h-20 bg-slate-100 rounded-xl" />
          </div>
          <div className="h-44 bg-slate-100 rounded-2xl" />
          <div className="h-56 bg-slate-100 rounded-2xl" />
        </div>
      </Drawer>
    );
  }

  if (!run) {
    return (
      <Drawer title="Production Run Details" onClose={onClose} width="max-w-2xl sm:max-w-3xl">
        <div className="p-8 text-center text-slate-500 space-y-3">
          <p className="font-semibold text-slate-700">Unable to load production run details.</p>
          <p className="text-xs text-slate-400">The record could not be retrieved from the server or may have been deleted.</p>
          <Button variant="secondary" onClick={onClose} className="mt-2 text-xs">
            Close
          </Button>
        </div>
      </Drawer>
    );
  }

  // Financial & Operational Aggregations
  const rawMatCost =
    run.inputs?.reduce((acc: number, i: any) => acc + Number(i.line_total_cost || 0), 0) ||
    (Number(run.total_input_cost) - Number(run.labor_cost || 0) - Number(run.other_cost || 0));

  const totalCost = Number(run.total_input_cost || 0);
  const laborCost = Number(run.labor_cost || 0);
  const otherCost = Number(run.other_cost || 0);

  const totalInputQty = run.inputs?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0) || 0;
  const totalOutputQty = run.outputs?.reduce((sum: number, o: any) => sum + Number(o.quantity_produced || 0), 0) || 0;

  const totalEstRevenue = run.outputs?.reduce((sum: number, o: any) => {
    if (Array.isArray(o.allocations) && o.allocations.length > 0) {
      const allocRev = o.allocations.reduce((aSum: number, a: any) => {
        const count = Number(a.package_count || 0);
        if (a.packaging_level_id) {
          return aSum + (count * Number(a.selling_price || o.package_selling_price || o.default_price || 0));
        }
        return aSum + (count * Number(o.base_selling_price || o.default_price || 0));
      }, 0);
      return sum + allocRev;
    }
    const q = Number(o.quantity_produced || 0);
    const p = Number(o.default_price || 0);
    return sum + (q * p);
  }, 0) || 0;

  const totalBatchMrp = run.outputs?.reduce((sum: number, o: any) => {
    if (Array.isArray(o.allocations) && o.allocations.length > 0) {
      const allocMrp = o.allocations.reduce((aSum: number, a: any) => {
        const count = Number(a.package_count || 0);
        if (a.packaging_level_id) {
          const m = Number(a.mrp || o.package_mrp || a.selling_price || o.default_price || 0);
          return aSum + (count * m);
        }
        return aSum + (count * Number(o.base_selling_price || o.default_price || 0));
      }, 0);
      return sum + allocMrp;
    }
    const q = Number(o.quantity_produced || 0);
    const m = Number(o.package_mrp || o.default_price || 0);
    return sum + (q * m);
  }, 0) || 0;

  const netProfit = totalEstRevenue - totalCost;
  const overallMarginPct = totalEstRevenue > 0 ? (netProfit / totalEstRevenue) * 100 : 0;
  const valueMultiplier = totalCost > 0 ? totalEstRevenue / totalCost : 0;

  const netProfitByMrp = totalBatchMrp - totalCost;
  const overallMarginPctByMrp = totalBatchMrp > 0 ? (netProfitByMrp / totalBatchMrp) * 100 : 0;
  const valueMultiplierByMrp = totalCost > 0 ? totalBatchMrp / totalCost : 0;

  const rawMatPct = totalCost > 0 ? (rawMatCost / totalCost) * 100 : 0;
  const laborPct = totalCost > 0 ? (laborCost / totalCost) * 100 : 0;
  const otherPct = totalCost > 0 ? (otherCost / totalCost) * 100 : 0;

  return (
    <Drawer title={`Production Run: ${run.run_number}`} onClose={onClose} width="max-w-2xl sm:max-w-3xl">
      <div className="space-y-6 pb-6 text-slate-800 text-sm">
        {/* 1. Header Card / Hero */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl text-white shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Manufacturing Run
                </span>
                {run.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 size={11} /> Completed &amp; Logged
                  </span>
                ) : run.status === 'in_progress' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-900/60 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                    <Clock size={11} /> In Progress (Shifts Active)
                  </span>
                ) : run.status === 'cancelled' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-900/60 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                    <X size={11} /> Cancelled / Voided
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-900/60 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    <AlertTriangle size={11} /> Open / Awaiting Shifts
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-blue-400" />
                {run.run_number}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(run.run_number);
                    toast(`Copied ${run.run_number}`, 'success');
                  }}
                  className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  title="Copy Run #"
                >
                  <Copy size={13} />
                </button>
              </h3>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-400 block mb-0.5">Total Manufacturing Cost</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {formatCurrency(totalCost, workspace?.currency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Production Location:</span>
              <strong className="text-white font-medium truncate flex items-center gap-1 mt-0.5">
                <MapPin size={12} className="text-blue-400 shrink-0" />
                {run.location_name || 'Main Factory / HQ'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Run Execution Date:</span>
              <strong className="text-white font-medium flex items-center gap-1 mt-0.5">
                <Calendar size={12} className="text-slate-400 shrink-0" />
                {formatDate(run.date)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Materials Consumed:</span>
              <strong className="text-white font-medium flex items-center gap-1 mt-0.5">
                <Layers size={12} className="text-blue-400 shrink-0" />
                {run.inputs?.length || 0} items ({formatNumber(totalInputQty)} total qty)
              </strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Finished Products:</span>
              <strong className="text-white font-medium flex items-center gap-1 mt-0.5">
                <Package size={12} className="text-emerald-400 shrink-0" />
                {run.outputs?.length || 0} product lines ({formatNumber(totalOutputQty)} units)
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Executive Financial & Valuation Performance KPIs */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
            <TrendingUp size={14} className="text-blue-600" /> Financial Valuation & Performance
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="border-r border-slate-100 pr-2">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Cost Invested</span>
              <strong className="text-slate-900 text-sm font-mono block mt-0.5">
                {formatCurrency(totalCost, workspace?.currency)}
              </strong>
              <span className="text-[10px] text-slate-400">All input factors</span>
            </div>

            <div className="border-r border-slate-100 pr-2">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Est. Catalog Revenue</span>
              <strong className="text-blue-700 text-sm font-mono block mt-0.5">
                {formatCurrency(totalEstRevenue, workspace?.currency)}
              </strong>
              <span className={`text-[10px] font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {netProfit >= 0 ? `+${formatCurrency(netProfit, workspace?.currency)} (${overallMarginPct.toFixed(1)}%)` : `${formatCurrency(netProfit, workspace?.currency)} (${overallMarginPct.toFixed(1)}%)`}
              </span>
            </div>

            <div className="border-r border-slate-100 pr-2">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Batch MRP</span>
              <strong className="text-amber-700 text-sm font-mono block mt-0.5">
                {formatCurrency(totalBatchMrp, workspace?.currency)}
              </strong>
              <span className="text-[10px] text-slate-400">Max Retail Value</span>
            </div>

            <div className="border-r border-slate-100 pr-2">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Profit by MRP</span>
              <strong className={`text-sm font-mono block mt-0.5 ${netProfitByMrp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(netProfitByMrp, workspace?.currency)}
              </strong>
              <span className={`text-[10px] font-bold ${netProfitByMrp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {netProfitByMrp >= 0 ? `+${overallMarginPctByMrp.toFixed(1)}% Margin` : `${overallMarginPctByMrp.toFixed(1)}% Loss`}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 block uppercase">Value Addition</span>
              <strong className="text-slate-900 text-base font-mono block mt-0.5">
                {valueMultiplier > 0 ? `${valueMultiplier.toFixed(2)}x` : '—'}
              </strong>
              <span className="text-[10px] text-slate-400 font-mono">
                {valueMultiplierByMrp > 0 ? `${valueMultiplierByMrp.toFixed(2)}x MRP` : 'Output ratio'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Cost Breakdown & Allocation Structure */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CircleDollarSign size={14} className="text-blue-600" /> Cost Structure Breakdown
            </span>
            <span className="text-slate-500 text-[11px]">Proportional factor breakdown</span>
          </h4>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-600">1. Raw Materials</span>
                  <span className="text-xs font-bold font-mono text-slate-900">{rawMatPct.toFixed(1)}%</span>
                </div>
                <strong className="text-sm font-bold text-slate-900 font-mono block">
                  {formatCurrency(rawMatCost, workspace?.currency)}
                </strong>
                <span className="text-[10px] text-slate-400">{run.inputs?.length || 0} material line(s)</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-600">2. Direct Labor</span>
                  <span className="text-xs font-bold font-mono text-slate-900">{laborPct.toFixed(1)}%</span>
                </div>
                <strong className="text-sm font-bold text-slate-900 font-mono block">
                  {formatCurrency(laborCost, workspace?.currency)}
                </strong>
                <span className="text-[10px] text-slate-400">Direct labor & manpower</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-600">3. Factory Overhead</span>
                  <span className="text-xs font-bold font-mono text-slate-900">{otherPct.toFixed(1)}%</span>
                </div>
                <strong className="text-sm font-bold text-slate-900 font-mono block">
                  {formatCurrency(otherCost, workspace?.currency)}
                </strong>
                <span className="text-[10px] text-slate-400">Power, tooling & misc</span>
              </div>
            </div>

            {/* Proportional Cost Bar */}
            <div className="space-y-1">
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${rawMatPct}%` }} className="bg-blue-500" title={`Raw Materials: ${rawMatPct.toFixed(1)}%`} />
                <div style={{ width: `${laborPct}%` }} className="bg-indigo-500" title={`Labor: ${laborPct.toFixed(1)}%`} />
                <div style={{ width: `${otherPct}%` }} className="bg-amber-500" title={`Overhead: ${otherPct.toFixed(1)}%`} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Materials</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Labor</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Overhead</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Consumed Raw Material Inputs */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-blue-600" /> Consumed Raw Materials & Inputs
            </span>
            <span className="text-slate-500 font-medium text-[11px]">
              {run.inputs?.length || 0} materials ({formatNumber(totalInputQty)} units total)
            </span>
          </h4>

          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white shadow-2xs">
            {run.inputs && run.inputs.length > 0 ? (
              run.inputs.map((inp: any) => {
                const lineTotal = Number(inp.line_total_cost || 0);
                const sharePct = rawMatCost > 0 ? (lineTotal / rawMatCost) * 100 : 0;
                return (
                  <div key={inp.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50/50 transition">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900 font-bold">{inp.item_name}</strong>
                        {inp.item_type && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase font-medium">
                            {inp.item_type}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-2">
                        <span>Quantity Consumed: <strong className="text-slate-700">{formatNumber(inp.quantity)} {inp.item_unit || 'units'}</strong></span>
                        <span>•</span>
                        <span>Unit Rate: {formatCurrency(inp.unit_cost, workspace?.currency)}/{inp.item_unit || 'unit'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <strong className="font-mono font-bold text-slate-900 text-sm block">
                        {formatCurrency(lineTotal, workspace?.currency)}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {sharePct.toFixed(1)}% of materials
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">No input materials recorded.</div>
            )}
          </div>
        </div>

        {/* 5. Manufactured Outputs */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Boxes size={14} className="text-emerald-600" /> Manufactured Outputs
            </span>
            <span className="text-slate-500 font-medium text-[11px]">
              {run.outputs?.length || 0} product types ({formatNumber(totalOutputQty)} units total)
            </span>
          </h4>

          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white shadow-2xs">
            {run.outputs && run.outputs.length > 0 ? (
              run.outputs.map((out: any) => {
                const qty = Number(out.quantity_produced) || 0;
                const singleAlloc = out.allocations?.length === 1 && !Number(out.loose_remaining)
                  ? out.allocations[0]
                  : null;

                const displayPkgName = out.packaging_name || singleAlloc?.packaging_name || singleAlloc?.level_name;

                let displayQty = qty;
                let displayUnit = out.package_unit || out.unit || 'units';
                let displayBaseQty = Number(out.base_quantity) || qty;
                const displayBaseUnit = out.base_unit || out.unit || 'units';

                if (singleAlloc) {
                  displayQty = Number(singleAlloc.package_count || qty);
                  displayUnit = singleAlloc.package_unit || out.package_unit || out.unit || 'pkgs';
                  displayBaseQty = Number(singleAlloc.base_units_consumed || out.base_quantity || qty);
                } else if (out.packaging_level_id && Number(out.units_per_package) > 1 && out.unit === out.base_unit) {
                  displayQty = Math.round((qty / Number(out.units_per_package)) * 10000) / 10000;
                  displayUnit = out.package_unit || 'pkgs';
                  displayBaseQty = qty;
                }

                let estRevenue = 0;
                if (Array.isArray(out.allocations) && out.allocations.length > 0) {
                  estRevenue = out.allocations.reduce((aSum: number, a: any) => {
                    const count = Number(a.package_count || 0);
                    if (a.packaging_level_id) {
                      return aSum + (count * Number(a.selling_price || out.package_selling_price || out.default_price || 0));
                    }
                    return aSum + (count * Number(out.base_selling_price || out.default_price || 0));
                  }, 0);
                } else {
                  estRevenue = displayQty * Number(out.default_price || 0);
                }

                const catalogPrice = Number(out.default_price) || Number(out.package_selling_price) || 0;
                const packageMrp = Number(out.package_mrp || singleAlloc?.mrp || 0);
                const basePrice = Number(out.base_selling_price) || 0;

                const batchMrpValue = Array.isArray(out.allocations) && out.allocations.length > 0
                  ? out.allocations.reduce((aSum: number, a: any) => {
                      const count = Number(a.package_count || 0);
                      if (a.packaging_level_id) {
                        return aSum + (count * Number(a.mrp || out.package_mrp || a.selling_price || out.default_price || 0));
                      }
                      return aSum + (count * Number(out.base_selling_price || out.default_price || 0));
                    }, 0)
                  : (displayQty * (packageMrp || catalogPrice));

                const allocatedOutputCost = Number(out.allocated_cost || 0);
                const profitByRevenue = estRevenue - allocatedOutputCost;
                const profitByMrp = batchMrpValue - allocatedOutputCost;

                return (
                  <div key={out.id} className="p-4 bg-white space-y-3 text-xs hover:bg-slate-50/50 transition">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-bold text-sm">{out.item_name}</strong>
                          {displayPkgName ? (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                              📦 {displayPkgName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-bold">
                              Base Unit
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px] mt-0.5">
                          <span>
                            Produced: <strong className="text-slate-800">{formatNumber(displayQty)} {displayUnit}</strong>
                          </span>
                          {displayPkgName && displayBaseQty > 0 && displayUnit.toLowerCase() !== displayBaseUnit.toLowerCase() && (
                            <span className="text-slate-500">
                              (= <strong className="text-blue-700 font-bold">{formatNumber(displayBaseQty)} {displayBaseUnit}</strong>)
                            </span>
                          )}
                          {out.fill_quantity && out.fill_unit && (
                            <span className="text-indigo-600 font-medium">
                              • {formatNumber(Number(displayQty) * Number(out.fill_quantity))} {out.fill_unit}s
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Est. Revenue / MRP Value</span>
                        <strong className="font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(estRevenue, workspace?.currency)}
                        </strong>
                        {batchMrpValue > estRevenue && (
                          <span className="text-[10px] font-mono text-amber-700 block font-semibold">
                            MRP: {formatCurrency(batchMrpValue, workspace?.currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Catalog Price &amp; MRP</span>
                        <strong className="text-slate-900 font-mono text-xs block mt-0.5 truncate">
                          {catalogPrice > 0 ? `${formatCurrency(catalogPrice, workspace?.currency)} / ${displayUnit}` : 'Not set'}
                        </strong>
                        <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-mono mt-0.5">
                          {packageMrp > 0 && (
                            <span className="text-amber-700 font-bold">
                              MRP: {formatCurrency(packageMrp, workspace?.currency)} / {displayUnit}
                            </span>
                          )}
                          {displayPkgName && basePrice > 0 && (
                            <span className="text-slate-400">
                              Base: {formatCurrency(basePrice, workspace?.currency)} / {displayBaseUnit}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Est. Batch Revenue</span>
                        <strong className="text-blue-700 font-mono text-xs block mt-0.5 truncate">
                          {formatCurrency(estRevenue, workspace?.currency)}
                        </strong>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {formatNumber(displayQty)} {displayUnit} × {formatCurrency(catalogPrice, workspace?.currency)}
                        </span>
                        <span className={`text-[10px] font-bold block mt-0.5 ${profitByRevenue >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Profit: {formatCurrency(profitByRevenue, workspace?.currency)} {estRevenue > 0 ? `(${((profitByRevenue / estRevenue) * 100).toFixed(1)}%)` : ''}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Batch MRP Value</span>
                        <strong className="text-amber-800 font-mono text-xs block mt-0.5 truncate">
                          {formatCurrency(batchMrpValue, workspace?.currency)}
                        </strong>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          {formatNumber(displayQty)} {displayUnit} × {formatCurrency(packageMrp || catalogPrice, workspace?.currency)}
                        </span>
                        <span className={`text-[10px] font-bold block mt-0.5 ${profitByMrp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Profit by MRP: {formatCurrency(profitByMrp, workspace?.currency)} {batchMrpValue > 0 ? `(${((profitByMrp / batchMrpValue) * 100).toFixed(1)}%)` : ''}
                        </span>
                      </div>
                    </div>

                    {out.allocations && out.allocations.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Package size={11} className="text-indigo-600" />
                            Batch Packaging &amp; Loose Allocation:
                          </span>
                          {Number(out.loose_remaining) > 0 && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Unallocated: {formatNumber(out.loose_remaining)} {displayBaseUnit}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {out.allocations.map((alloc: any, aIdx: number) => {
                            const isLoose = !alloc.packaging_level_id;
                            const pCount = Number(alloc.package_count || 0);
                            const pkgUnit = alloc.package_unit || 'pkg';
                            const containsQty = Number(alloc.contains_quantity || 0);
                            const containsUnit = alloc.contains_unit || '';
                            const baseEquiv = Number(alloc.base_quantity_equivalent || alloc.base_unit_equivalent || 1);
                            const consumedBase = Number(alloc.base_units_consumed || (pCount * baseEquiv));

                            const allocSellingPrice = Number(alloc.selling_price || 0);
                            const allocMrp = Number(alloc.mrp || 0);
                            const allocTotalRev = pCount * allocSellingPrice;
                            const allocTotalMrp = pCount * (allocMrp || allocSellingPrice);

                            return (
                              <div
                                key={alloc.id || aIdx}
                                className={`p-3 rounded-xl border text-xs ${
                                  isLoose
                                    ? 'bg-amber-50/60 border-amber-200/80 text-amber-950'
                                    : 'bg-indigo-50/50 border-indigo-200/70 text-slate-900'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                  {/* Left: Package Name, Quantities & Hierarchy */}
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                        {isLoose ? '🟡 Loose / Unpackaged' : `📦 ${alloc.packaging_name || alloc.level_name || 'Package'}`}
                                      </span>
                                      {!isLoose && (
                                        <span className="text-[10px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-full font-mono shadow-2xs">
                                          {formatNumber(pCount)} {pkgUnit}s produced
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono">
                                      {!isLoose ? (
                                        <>
                                          <span className="text-slate-700 font-semibold">
                                            {formatNumber(pCount)} {pkgUnit}s × {formatNumber(containsQty > 0 ? containsQty : baseEquiv)} {containsUnit || displayBaseUnit}
                                          </span>
                                          {containsUnit && containsUnit.toLowerCase() !== displayBaseUnit.toLowerCase() && (
                                            <span className="text-slate-500">
                                              (1 {pkgUnit} = {formatNumber(containsQty)} {containsUnit} = {formatNumber(baseEquiv)} {displayBaseUnit})
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-slate-500">
                                          Unpackaged base units
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Consumed Base Units & Pricing */}
                                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1 text-right shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 font-mono">
                                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                      <span className="text-[10px] uppercase font-normal text-slate-400">Total Consumed:</span>
                                      <span className="text-blue-700">{formatNumber(consumedBase)} {displayBaseUnit}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                      {allocSellingPrice > 0 && (
                                        <span>{formatCurrency(allocSellingPrice, workspace?.currency)} / {pkgUnit}</span>
                                      )}
                                      {allocMrp > 0 && (
                                        <span className="text-amber-700 font-semibold">
                                          (MRP: {formatCurrency(allocMrp, workspace?.currency)})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      Rev: <strong className="text-slate-800">{formatCurrency(allocTotalRev, workspace?.currency)}</strong>
                                      {allocMrp > 0 && (
                                        <>
                                          {' • '}
                                          MRP: <strong className="text-amber-800">{formatCurrency(allocTotalMrp, workspace?.currency)}</strong>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">No manufactured outputs recorded.</div>
            )}
          </div>
        </div>

        {/* 6. Production Notes & Operational Log */}
        {run.notes && (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
            <span className="font-bold text-[10px] uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <FileText size={12} /> Operational & Batch Notes:
            </span>
            <p className="text-slate-700 whitespace-pre-line">{run.notes}</p>
          </div>
        )}

        {/* 7. Drawer Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          {onVoid ? (
            <Button
              variant="secondary"
              onClick={() => onVoid(run.id)}
              className="text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition"
              icon={<Trash2 size={13} />}
            >
              Void Production Run
            </Button>
          ) : <div />}

          <Button variant="secondary" onClick={onClose} className="px-5 text-xs font-bold">
            Close
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function NewProductionRunModal({
  onClose,
  onSaved,
  initialFormulaId
}: {
  onClose: () => void;
  onSaved: () => void;
  initialFormulaId?: string | null;
}) {
  const toast = useToast();
  const { workspace } = useWorkspace();
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<any[]>([]);
  const [formulas, setFormulas] = useState<any[]>([]);
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState(dateIso());
  const [requiredByDate, setRequiredByDate] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [otherCost, setOtherCost] = useState('0');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes] = useState('');

  // Formula integration
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>(initialFormulaId || '');
  const [activeFormula, setActiveFormula] = useState<any | null>(null);
  const [formulaScale, setFormulaScale] = useState<string>('1');

  const [inputs, setInputs] = useState<any[]>([{ item_id: '', quantity: '1', expected_quantity: 1, uom: 'unit', unit_cost: '0' }]);
  const [outputs, setOutputs] = useState<any[]>([
    { finished_good_id: '', packaging_level_id: '', packaging_config_id: '', quantity_produced: '1', expected_quantity: 1, cost_allocation_percent: '100', package_counts: {}, loose_count: '' }
  ]);

  useEffect(() => {
    api.get('/api/locations').then((res) => {
      const locs = res.data || [];
      setLocations(locs);
      const def = locs.find((l: any) => l.is_default) || locs[0];
      if (def) setLocationId(def.id);
    });
    api.get('/api/items?limit=300').then((res) => {
      const itms = res.data?.data || res.data?.rows || res.data || [];
      setItems(itms);
      setInputs((prev) =>
        prev.map((inp) => {
          if (!inp.unit_cost || Number(inp.unit_cost) === 0) {
            const found = itms.find((x: any) => x.id === inp.item_id);
            if (found) {
              const p = found.effective_purchase_price ?? found.last_purchase_price ?? found.default_price ?? 0;
              if (p > 0) return { ...inp, unit_cost: String(p) };
            }
          }
          return inp;
        })
      );
    });
    api.get('/api/finished-goods?limit=300').then((res) => setFinishedGoods(res.data?.data || res.data?.rows || res.data || []));
    api.get('/api/manufacturing/formulas').then((res) => setFormulas(res.data || []));
  }, []);

  useEffect(() => {
    if (initialFormulaId) {
      handleApplyFormula(initialFormulaId);
    }
  }, [initialFormulaId]);

  const handleApplyFormula = (formulaId: string, scaleMultiplier?: number) => {
    if (!formulaId) {
      setActiveFormula(null);
      setSelectedFormulaId('');
      setFormulaScale('1');
      return;
    }
    setSelectedFormulaId(formulaId);
    api.get(`/api/manufacturing/formulas/${formulaId}`)
      .then((res) => {
        const f = res.data;
        setActiveFormula(f);
        const targetScale = scaleMultiplier !== undefined ? scaleMultiplier : 1;
        setFormulaScale(String(targetScale));

        // Initial populate from formula details
        if (f.inputs && f.inputs.length > 0) {
          setInputs(f.inputs.map((inp: any) => {
            const targetItemId = inp.item_id || inp.product_id || inp.raw_material_id;
            const foundItem = items.find((itm) => itm.id === targetItemId);
            const costVal = Number(
              inp.unit_cost ||
              (foundItem?.effective_purchase_price ??
               foundItem?.last_purchase_price ??
               foundItem?.default_price ??
               0)
            );
            return {
              item_id: targetItemId,
              quantity: String(inp.quantity),
              expected_quantity: Number(inp.quantity),
              uom: inp.uom || inp.base_unit || 'unit',
              unit_cost: String(costVal || 0)
            };
          }));
        }

        if (f.outputs && f.outputs.length > 0) {
          setOutputs(f.outputs.map((out: any) => ({
            finished_good_id: out.product_id || out.item_id,
            packaging_level_id: '',
            packaging_config_id: '',
            quantity_produced: String(out.quantity),
            expected_quantity: Number(out.quantity),
            cost_allocation_percent: String(out.cost_allocation_percent || 100),
            is_primary: out.is_primary,
            package_counts: {},
            loose_count: ''
          })));
        }

        if (f.description && !notes) {
          setNotes(`[Formula: ${f.name} v${f.version || 1}] ${f.description}`);
        }

        // Call scale endpoint with multiplier if targetScale != 1
        if (targetScale !== 1) {
          api.get(`/api/manufacturing/formulas/${formulaId}/scale?scale_multiplier=${targetScale}`)
            .then((scaleRes) => {
              const data = scaleRes.data;
              if (data.inputs && data.inputs.length > 0) {
                setInputs(data.inputs.map((inp: any) => {
                  const targetItemId = inp.item_id || inp.product_id || inp.raw_material_id;
                  const foundItem = items.find((itm) => itm.id === targetItemId);
                  const costVal = Number(
                    inp.unit_cost ||
                    (foundItem?.effective_purchase_price ??
                     foundItem?.last_purchase_price ??
                     foundItem?.default_price ??
                     0)
                  );
                  return {
                    item_id: targetItemId,
                    quantity: String(inp.required_with_scrap || inp.scaled_quantity),
                    expected_quantity: inp.scaled_quantity,
                    uom: inp.uom,
                    unit_cost: String(costVal || 0)
                  };
                }));
              }

              if (data.outputs && data.outputs.length > 0) {
                setOutputs(data.outputs.map((out: any) => ({
                  finished_good_id: out.product_id || out.item_id,
                  packaging_level_id: '',
                  packaging_config_id: '',
                  quantity_produced: String(out.scaled_quantity),
                  expected_quantity: out.scaled_quantity,
                  cost_allocation_percent: String(out.cost_share_percent || out.cost_allocation_percent || 0),
                  is_primary: out.is_primary,
                  package_counts: {},
                  loose_count: ''
                })));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => toast('Failed to load formula', 'error'));
  };

  const handleInputQuantityChange = (idx: number, val: string) => {
    const nextInputs = [...inputs];
    nextInputs[idx].quantity = val;
    setInputs(nextInputs);

    const numVal = Number(val);
    if (activeFormula && numVal > 0) {
      const baseInp = activeFormula.inputs?.[idx] || activeFormula.inputs?.find((i: any) => (i.item_id || i.product_id) === nextInputs[idx].item_id);
      const baseQty = Number(baseInp?.quantity) || 1;
      const lossPct = Number(baseInp?.expected_loss_percent || baseInp?.scrap_percentage || 0);
      const baseWithLoss = baseQty * (1 + lossPct / 100);
      const multiplier = baseWithLoss > 0 ? (numVal / baseWithLoss) : (numVal / baseQty);

      setFormulaScale(String(Math.round(multiplier * 10000) / 10000));

      // Proportionally calculate and update produced outputs
      setOutputs((prevOutputs) =>
        prevOutputs.map((out, outIdx) => {
          const baseOut = activeFormula.outputs?.[outIdx] || activeFormula.outputs?.find((o: any) => (o.item_id || o.product_id) === out.finished_good_id);
          const baseOutQty = Number(baseOut?.quantity) || 1;
          const scaledProduced = Math.round(baseOutQty * multiplier * 10000) / 10000;
          return {
            ...out,
            quantity_produced: String(scaledProduced),
            expected_quantity: scaledProduced
          };
        })
      );

      // If there are other inputs in this BOM, scale them proportionally too
      if (activeFormula.inputs && activeFormula.inputs.length > 1) {
        setInputs((currentInputs) =>
          currentInputs.map((otherInp, otherIdx) => {
            if (otherIdx === idx) return { ...otherInp, quantity: val };
            const baseOther = activeFormula.inputs?.[otherIdx] || activeFormula.inputs?.find((i: any) => (i.item_id || i.product_id) === otherInp.item_id);
            if (!baseOther) return otherInp;
            const otherBaseQty = Number(baseOther.quantity) || 1;
            const otherLossPct = Number(baseOther.expected_loss_percent || baseOther.scrap_percentage || 0);
            const otherRequired = Math.round(otherBaseQty * (1 + otherLossPct / 100) * multiplier * 10000) / 10000;
            return {
              ...otherInp,
              quantity: String(otherRequired),
              expected_quantity: otherRequired
            };
          })
        );
      }
    }
  };

  const handleOutputQuantityChange = (idx: number, val: string) => {
    const next = [...outputs];
    next[idx].quantity_produced = val;
    setOutputs(next);

    const numVal = Number(val);
    if (activeFormula && numVal > 0 && activeFormula.outputs?.length > 0) {
      const baseOut = activeFormula.outputs?.[idx] || activeFormula.outputs?.find((o: any) => (o.item_id || o.product_id) === next[idx].finished_good_id);
      const baseOutQty = Number(baseOut?.quantity) || 1;
      const multiplier = numVal / baseOutQty;

      setFormulaScale(String(Math.round(multiplier * 10000) / 10000));

      // Scale required inputs proportionally
      if (activeFormula.inputs && activeFormula.inputs.length > 0) {
        setInputs((currentInputs) =>
          currentInputs.map((inp, inpIdx) => {
            const baseInp = activeFormula.inputs?.[inpIdx] || activeFormula.inputs?.find((i: any) => (i.item_id || i.product_id) === inp.item_id);
            if (!baseInp) return inp;
            const baseQty = Number(baseInp.quantity) || 1;
            const lossPct = Number(baseInp.expected_loss_percent || baseInp.scrap_percentage || 0);
            const req = Math.round(baseQty * (1 + lossPct / 100) * multiplier * 10000) / 10000;
            return {
              ...inp,
              quantity: String(req),
              expected_quantity: req
            };
          })
        );
      }
    }
  };

  useEffect(() => {
    if (initialFormulaId) {
      handleApplyFormula(initialFormulaId);
    }
  }, [initialFormulaId]);

  const addInput = () => setInputs((prev) => [...prev, { item_id: '', quantity: '1', expected_quantity: 1, uom: 'unit', unit_cost: '0' }]);
  const removeInput = (idx: number) => setInputs((prev) => prev.filter((_, i) => i !== idx));

  const addOutput = () =>
    setOutputs((prev) => [
      ...prev,
      {
        finished_good_id: prev.length > 0 ? prev[prev.length - 1].finished_good_id : '',
        packaging_level_id: '',
        packaging_config_id: '',
        quantity_produced: '1',
        expected_quantity: 1,
        cost_allocation_percent: '0',
        package_counts: {},
        loose_count: ''
      }
    ]);
  const removeOutput = (idx: number) => setOutputs((prev) => prev.filter((_, i) => i !== idx));

  const handleInputItemChange = (idx: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    const next = [...inputs];
    next[idx].item_id = itemId;
    next[idx].uom = item?.unit || 'unit';
    const cost = Number(
      item?.effective_purchase_price ??
      item?.last_purchase_price ??
      item?.purchase_price ??
      item?.weighted_average_cost ??
      item?.last_vendor_price ??
      0
    );
    next[idx].unit_cost = cost > 0 ? String(cost) : '0';
    setInputs(next);
  };

  // Live financial metrics
  const totalInputCost = inputs.reduce((sum, inp) => {
    const qty = Number(inp.quantity) || 0;
    const cost = Number(inp.unit_cost) || 0;
    return sum + (qty * cost);
  }, 0);

  const numLaborCost = Number(laborCost) || 0;
  const numOtherCost = Number(otherCost) || 0;
  const grandTotalCost = totalInputCost + numLaborCost + numOtherCost;

  // Live yield calculation
  const totalExpectedOutput = outputs.reduce((sum, o) => sum + (Number(o.expected_quantity) || Number(o.quantity_produced) || 0), 0);
  const totalActualOutput = outputs.reduce((sum, o) => sum + (Number(o.quantity_produced) || 0), 0);
  const yieldPercent = totalExpectedOutput > 0 ? (totalActualOutput / totalExpectedOutput) * 100 : 100;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validInputs = inputs.filter((i) => i.item_id && Number(i.quantity) > 0);
    const validOutputs = outputs.filter((o) => o.finished_good_id && Number(o.quantity_produced) > 0);

    if (validInputs.length === 0) {
      toast('At least one consumed raw material input is required', 'error');
      return;
    }
    if (validOutputs.length === 0) {
      toast('At least one manufactured output product is required', 'error');
      return;
    }

    // Check for over-allocation in packaging/loose breakdown
    for (const out of validOutputs) {
      const fg = finishedGoods.find((g) => g.id === out.finished_good_id);
      const produced = Number(out.quantity_produced) || 0;
      const levels = fg?.packaging_levels || [];
      let totalAllocBase = 0;
      let hasCustomAllocation = false;

      if (out.package_counts) {
        for (const lvl of levels) {
          const pCount = Number(out.package_counts[lvl.id]) || 0;
          if (pCount > 0) {
            hasCustomAllocation = true;
            totalAllocBase += pCount * (Number(lvl.base_quantity_equivalent) || 1);
          }
        }
      }
      const looseCount = Number(out.loose_count) || 0;
      if (looseCount > 0) {
        hasCustomAllocation = true;
        totalAllocBase += looseCount;
      }

      if (hasCustomAllocation && totalAllocBase > produced + 0.0001) {
        toast(
          `Allocated quantity (${formatNumber(totalAllocBase)} ${fg?.unit || 'u'}) exceeds produced quantity (${formatNumber(produced)} ${fg?.unit || 'u'}) for ${fg?.name || 'product'}`,
          'error'
        );
        return;
      }
    }

    try {
      await api.post('/api/production-runs', {
        location_id: locationId,
        date,
        required_by_date: requiredByDate || null,
        priority,
        formula_id: selectedFormulaId || null,
        formula_version: activeFormula?.version || null,
        labor_cost: Number(laborCost) || 0,
        other_cost: Number(otherCost) || 0,
        notes,
        inputs: validInputs.map((i) => ({
          item_id: i.item_id,
          quantity: Number(i.quantity),
          expected_quantity: Number(i.expected_quantity || i.quantity),
          uom: i.uom || 'unit',
          unit_cost: Number(i.unit_cost)
        })),
        outputs: validOutputs.map((o) => {
          const fg = finishedGoods.find((g) => g.id === o.finished_good_id);
          const qty = Number(o.quantity_produced);
          const levels = fg?.packaging_levels || [];

          // Collect multi-tier packaging allocations + loose allocations
          const fgAllocations: any[] = [];
          if (o.package_counts) {
            for (const lvl of levels) {
              const pCount = Number(o.package_counts[lvl.id]) || 0;
              if (pCount > 0) {
                fgAllocations.push({
                  packaging_level_id: lvl.id,
                  package_count: pCount
                });
              }
            }
          }
          const looseCount = Number(o.loose_count) || 0;
          if (looseCount > 0) {
            fgAllocations.push({
              packaging_level_id: null,
              package_count: looseCount
            });
          }

          const singleAlloc = (fgAllocations.length === 1 && looseCount === 0 && fgAllocations[0].packaging_level_id)
            ? fgAllocations[0]
            : null;
          const chosenLevelId = singleAlloc ? singleAlloc.packaging_level_id : (o.packaging_level_id || null);
          const chosenLevel = levels.find((l: any) => l.id === chosenLevelId) || null;

          if (singleAlloc && chosenLevel) {
            const pkgCount = Number(singleAlloc.package_count);
            const unitsPerPkg = Number(chosenLevel.base_quantity_equivalent) || 1;
            return {
              item_type: 'finished_good',
              item_id: o.finished_good_id,
              packaging_level_id: chosenLevel.id,
              packaging_name: chosenLevel.name,
              units_per_package: unitsPerPkg,
              quantity_produced: pkgCount,
              expected_quantity: pkgCount,
              base_quantity: qty,
              unit: chosenLevel.package_unit || 'pkg',
              cost_allocation_percent: totalActualOutput > 0 ? (qty / totalActualOutput) * 100 : (100 / validOutputs.length),
              allocations: fgAllocations
            };
          }

          return {
            item_type: 'finished_good',
            item_id: o.finished_good_id,
            packaging_level_id: chosenLevel?.id || null,
            packaging_name: chosenLevel?.name || null,
            units_per_package: Number(chosenLevel?.base_quantity_equivalent) || 1,
            quantity_produced: qty,
            expected_quantity: Number(o.expected_quantity || qty),
            base_quantity: qty,
            unit: fg?.unit || 'unit',
            cost_allocation_percent: totalActualOutput > 0 ? (qty / totalActualOutput) * 100 : (100 / validOutputs.length),
            allocations: fgAllocations.length > 0 ? fgAllocations : undefined
          };
        })
      });
      toast('Production order created successfully! Floor staff can now track and log shifts against it.', 'success');
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to record production run', 'error');
    }
  };

  return (
    <Modal title="New Production Order" onClose={onClose} wide size="xl">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Formula Recipe Selector & Scaler Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 border border-blue-200 rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              <strong className="text-blue-950 text-xs uppercase tracking-wider font-bold">
                Manufacturing Recipe / Formula (BOM)
              </strong>
            </div>
            {activeFormula && (
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                Loaded: {activeFormula.name} (v{activeFormula.version})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Select
                value={selectedFormulaId}
                onChange={(id) => handleApplyFormula(id)}
                options={[
                  { value: '', label: '-- Custom Ad-Hoc Run (No Formula) --' },
                  ...formulas.map((f) => {
                    const bSize = f.batch_size ? `${formatNumber(f.batch_size)} ${f.batch_uom || ''}` : (f.primary_outputs_summary || 'Standard Batch');
                    const inCount = f.input_count ?? f.inputs_count ?? 1;
                    const outCount = f.output_count ?? f.outputs_count ?? 1;
                    return {
                      value: f.id,
                      label: `${f.name} (v${f.version || 1}) — Batch: ${bSize} [${inCount} in → ${outCount} out]`
                    };
                  })
                ]}
              />
            </div>
            {activeFormula && (
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    placeholder="Scale (e.g. 1)"
                    value={formulaScale}
                    onChange={(e) => {
                      const scaleVal = e.target.value;
                      setFormulaScale(scaleVal);
                      const mult = Number(scaleVal);
                      if (mult > 0) {
                        handleApplyFormula(selectedFormulaId, mult);
                      }
                    }}
                    className="w-full h-10 px-3 pr-20 border border-blue-300 rounded-xl bg-white font-mono font-bold text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] text-blue-600 font-bold pointer-events-none">
                    × Multiplier
                  </span>
                </div>
              </div>
            )}
          </div>

          {activeFormula && (
            <div className="flex flex-wrap items-center justify-between text-[11px] text-blue-900 pt-1 border-t border-blue-200/60">
              <span>
                Standard Recipe Output:{' '}
                <strong>
                  {formatNumber(activeFormula.batch_size || activeFormula.outputs?.[0]?.quantity || 1)}{' '}
                  {activeFormula.batch_uom || activeFormula.outputs?.[0]?.uom || 'units'}
                </strong>
              </span>
              <span className="flex items-center gap-1">
                Yield Ratio: <strong className="font-mono text-emerald-700">{yieldPercent.toFixed(1)}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* Run Facility & Date Details */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200">
          <Field label="Manufacturing Location" required>
            <Select
              value={locationId}
              onChange={setLocationId}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
            <span className="text-[10px] text-slate-500">Facility where materials are drawn and goods produced</span>
          </Field>
          <Field label="Order / Run Date" required>
            <DatePicker value={date} onChange={setDate} placeholder="Run Date" />
            <span className="text-[10px] text-slate-500">Scheduled production date</span>
          </Field>
          <Field label="Required By Date (Deadline)">
            <DatePicker value={requiredByDate} onChange={setRequiredByDate} placeholder="Deadline (optional)" />
            <span className="text-[10px] text-slate-500">Floor staff deadline</span>
          </Field>
          <Field label="Order Priority">
            <Select
              value={priority}
              onChange={setPriority}
              options={[
                { value: 'low', label: '🟢 Low' },
                { value: 'normal', label: '🔵 Normal' },
                { value: 'high', label: '🟡 High' },
                { value: 'urgent', label: '🔴 Urgent' }
              ]}
            />
            <span className="text-[10px] text-slate-500">Urgency level for staff</span>
          </Field>
        </div>

        {/* 1. Raw Materials (Inputs) */}
        <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div>
              <label className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" /> Consumed Raw Materials (Inputs)
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Raw materials or ingredients drawn from inventory and consumed in this run.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={addInput}
              className="text-xs font-semibold py-1 px-3 cursor-pointer"
              icon={<Plus size={13} />}
            >
              Add Material
            </Button>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
            <div className="col-span-5">Raw Material / Item</div>
            <div className="col-span-2">Quantity Consumed</div>
            <div className="col-span-2">Unit Cost ({workspace?.currency || '₹'})</div>
            <div className="col-span-2 text-right">Line Total</div>
            <div className="col-span-1 text-center"></div>
          </div>

          {/* Row Items */}
          <div className="space-y-2">
            {inputs.map((inp, idx) => {
              const selectedItem = items.find((i) => i.id === inp.item_id);
              const lineTotal = (Number(inp.quantity) || 0) * (Number(inp.unit_cost) || 0);

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start bg-white p-3 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition"
                >
                  <div className="sm:col-span-5 space-y-1">
                    <label className="sm:hidden block text-[10px] font-bold text-slate-600 uppercase">
                      Raw Material Item
                    </label>
                    <Select
                      value={inp.item_id}
                      onChange={(val) => handleInputItemChange(idx, val)}
                      triggerClassName="h-10 text-xs rounded-xl"
                      options={[
                        { value: '', label: 'Select Raw Material...' },
                        ...items.map((i) => {
                          const cost = Number(i.effective_purchase_price ?? i.last_purchase_price ?? i.purchase_price ?? 0);
                          return {
                            value: i.id,
                            label: `${i.name}${i.code ? ` (${i.code})` : ''} - ${i.unit || 'units'}${cost > 0 ? ` • Cost: ${formatCurrency(cost, workspace?.currency)}` : ''}`
                          };
                        })
                      ]}
                    />
                    {selectedItem && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 px-1 pt-0.5">
                        <span>Unit: <strong className="text-slate-700">{selectedItem.unit || 'unit'}</strong></span>
                        {selectedItem.current_stock !== undefined && (
                          <span>
                            • Stock: <strong className={Number(selectedItem.current_stock) <= 0 ? 'text-rose-600' : 'text-slate-700'}>
                              {formatNumber(selectedItem.current_stock)} {selectedItem.unit || ''}
                            </strong>
                          </span>
                        )}
                        {Number(selectedItem.effective_purchase_price ?? selectedItem.last_purchase_price ?? selectedItem.purchase_price ?? 0) > 0 && (
                          <span>
                            • Cost: <strong className="text-emerald-700 font-mono">
                              {formatCurrency(Number(selectedItem.effective_purchase_price ?? selectedItem.last_purchase_price ?? selectedItem.purchase_price), workspace?.currency)} / {selectedItem.unit || 'unit'}
                            </strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="sm:hidden block text-[10px] font-bold text-slate-600 uppercase">
                      Quantity Consumed
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      placeholder="Qty (e.g. 10)"
                      value={inp.quantity}
                      onChange={(e) => handleInputQuantityChange(idx, e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                      required
                    />
                    {selectedItem && (
                      <div className="text-[10px] text-slate-400 px-1 pt-0.5 truncate">
                        In {selectedItem.unit || 'units'}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="sm:hidden block text-[10px] font-bold text-slate-600 uppercase">
                      Unit Cost ({workspace?.currency || '₹'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={inp.unit_cost}
                      onChange={(e) => {
                        const next = [...inputs];
                        next[idx].unit_cost = e.target.value;
                        setInputs(next);
                      }}
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                      title="Unit Cost"
                    />
                  </div>

                  <div className="sm:col-span-2 text-left sm:text-right space-y-1">
                    <label className="sm:hidden block text-[10px] font-bold text-slate-600 uppercase">
                      Line Total
                    </label>
                    <div className="h-10 flex items-center justify-start sm:justify-end">
                      <strong className="font-mono text-sm font-bold text-slate-900 block truncate">
                        {formatCurrency(lineTotal, workspace?.currency)}
                      </strong>
                    </div>
                  </div>

                  <div className="sm:col-span-1 text-right sm:text-center">
                    <div className="h-10 flex items-center justify-end sm:justify-center">
                      {inputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInput(idx)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          title="Remove material input"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtotal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 px-1 text-xs">
            <span className="text-slate-500">
              Total Materials: <strong className="text-slate-800">{inputs.length} {inputs.length === 1 ? 'item' : 'items'}</strong>
            </span>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-semibold uppercase mr-2">Materials Subtotal:</span>
              <strong className="font-mono text-sm text-slate-900 font-bold">
                {formatCurrency(totalInputCost, workspace?.currency)}
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Direct Labor & Factory Overhead */}
        <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 space-y-3">
          <div>
            <label className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <CircleDollarSign size={14} className="text-blue-600" /> Direct Labor & Factory Overhead
            </label>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Additional operational and processing expenses added to total manufacturing cost and distributed across finished goods.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`Direct Labor Cost (${workspace?.currency || '₹'})`}>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 bg-white focus:outline-blue-500"
              />
              <span className="text-[10px] text-slate-500">Wages, machine operator fees, or contractor technician hours</span>
            </Field>
            <Field label={`Other / Overhead Cost (${workspace?.currency || '₹'})`}>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={otherCost}
                onChange={(e) => setOtherCost(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 bg-white focus:outline-blue-500"
              />
              <span className="text-[10px] text-slate-500">Electricity, fuel, facility rent, maintenance, or machine depreciation</span>
            </Field>
          </div>
        </div>

        {/* 3. Manufactured Products (Outputs) */}
        <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div>
              <label className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <Boxes size={14} className="text-emerald-600" /> Manufactured Products (Outputs)
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Finished items added to inventory and how total manufacturing cost is shared among them.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={addOutput}
                className="text-xs font-semibold py-1 px-3 cursor-pointer"
                icon={<Plus size={13} />}
              >
                Add Product
              </Button>
            </div>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
            <div className="col-span-6">Finished Product</div>
            <div className="col-span-3">Quantity Produced</div>
            <div className="col-span-2 text-right">Est. Unit Cost</div>
            <div className="col-span-1 text-center"></div>
          </div>

          {/* Row Items */}
          <div className="space-y-2.5">
            {outputs.map((out, idx) => {
              const selectedFg = finishedGoods.find((g) => g.id === out.finished_good_id);
              const producedQty = Number(out.quantity_produced) || 0;
              const allocRatio = totalActualOutput > 0 ? (producedQty / totalActualOutput) : (1 / (outputs.length || 1));
              const allocatedCost = grandTotalCost * allocRatio;
              const estUnitCost = producedQty > 0 ? allocatedCost / producedQty : 0;
              const levels = selectedFg?.packaging_levels || [];

              // Compute allocation metrics
              let totalPackagedBase = 0;
              if (out.package_counts) {
                for (const lvl of levels) {
                  const count = Number(out.package_counts[lvl.id]) || 0;
                  const eq = Number(lvl.base_quantity_equivalent) || 1;
                  totalPackagedBase += count * eq;
                }
              }
              const looseQty = Number(out.loose_count) || 0;
              const totalAllocatedBase = totalPackagedBase + looseQty;
              const remainingUnallocated = Math.max(0, producedQty - totalAllocatedBase);
              const isOverAllocated = totalAllocatedBase > producedQty + 0.0001;
              const isFullyReconciled = !isOverAllocated && Math.abs(totalAllocatedBase - producedQty) < 0.0001 && producedQty > 0;

              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition"
                >
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Finished Product #{idx + 1}
                    </label>
                    <Select
                      value={out.finished_good_id}
                      onChange={(val) => {
                        const next = [...outputs];
                        next[idx].finished_good_id = val;
                        next[idx].packaging_level_id = '';
                        next[idx].packaging_config_id = '';
                        next[idx].package_counts = {};
                        next[idx].loose_count = '';
                        setOutputs(next);
                      }}
                      options={[
                        { value: '', label: 'Select Output Finished Good...' },
                        ...finishedGoods.map((fg) => ({
                          value: fg.id,
                          label: `${fg.name} (${fg.unit || 'unit'})`
                        }))
                      ]}
                    />
                    {selectedFg && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5 px-1">
                        <span>Base Unit: <strong className="text-slate-800">{selectedFg.unit || 'unit'}</strong></span>
                        {Number(selectedFg.default_price) > 0 && (
                          <>
                            <span>•</span>
                            <span>Base Price: <strong className="text-emerald-700 font-mono">{formatCurrency(selectedFg.default_price, workspace?.currency)}</strong></span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Quantity Produced
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      placeholder="Qty Produced"
                      value={out.quantity_produced}
                      onChange={(e) => handleOutputQuantityChange(idx, e.target.value)}
                      className="w-full h-10 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                      required
                    />
                    {selectedFg && (
                      <div className="text-[10px] text-slate-400 px-1 pt-0.5 truncate">
                        In {selectedFg.unit || 'base units'}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 text-left sm:text-right space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Est. Unit Cost
                    </label>
                    <div className="h-10 flex flex-col justify-center items-start sm:items-end">
                      <strong className="font-mono text-sm font-bold text-slate-900 block truncate">
                        {formatCurrency(estUnitCost, workspace?.currency)}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono">
                        per {selectedFg?.unit || 'unit'}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-1 text-right sm:text-center">
                    <div className="h-10 flex items-center justify-end sm:justify-center">
                      {outputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOutput(idx)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          title="Remove output item"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-Tier Packaging & Loose Allocation Panel */}
                  {selectedFg && (
                    <div className="col-span-1 sm:col-span-12 mt-1 p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Package size={14} className="text-indigo-600" />
                          <span>Batch Packaging & Loose Allocation</span>
                          <span className="text-[10px] font-normal text-slate-500">
                            (Batch Total: <strong className="text-slate-800 font-mono">{formatNumber(producedQty)} {selectedFg.unit || 'units'}</strong>)
                          </span>
                        </div>

                        {/* Live Reconciliation Badges */}
                        <div className="flex items-center gap-2">
                          {isOverAllocated ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                              ⚠️ Over-allocated by {formatNumber(totalAllocatedBase - producedQty)} {selectedFg.unit || 'u'}
                            </span>
                          ) : isFullyReconciled ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> 100% Reconciled ({formatNumber(totalAllocatedBase)} {selectedFg.unit || 'u'})
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                {formatNumber(remainingUnallocated)} {selectedFg.unit || 'u'} unallocated
                              </span>
                              {remainingUnallocated > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...outputs];
                                    const curLoose = Number(next[idx].loose_count || 0);
                                    next[idx].loose_count = String(curLoose + remainingUnallocated);
                                    setOutputs(next);
                                  }}
                                  className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full transition cursor-pointer"
                                >
                                  + Allocate to Loose
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {levels.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                          {levels.map((lvl: any) => {
                            const eq = Number(lvl.base_quantity_equivalent) || 1;
                            const count = Number(out.package_counts?.[lvl.id] || 0);
                            const consumed = count * eq;
                            return (
                              <div key={lvl.id} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 pr-1">
                                    <span className="font-bold text-slate-800 text-[11px] block truncate">
                                      📦 {lvl.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block">
                                      1 {lvl.package_unit} = {formatNumber(eq)} {selectedFg.unit || 'u'}
                                    </span>
                                  </div>
                                  {Number(lvl.selling_price) > 0 && (
                                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                                      {formatCurrency(lvl.selling_price, workspace?.currency)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="0"
                                    value={out.package_counts?.[lvl.id] ?? ''}
                                    onChange={(e) => {
                                      const next = [...outputs];
                                      const cur = { ...(next[idx].package_counts || {}) };
                                      cur[lvl.id] = e.target.value;
                                      next[idx].package_counts = cur;
                                      setOutputs(next);
                                    }}
                                    className="w-full h-7 px-2 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                                    {lvl.package_unit}s
                                  </span>
                                  <button
                                    type="button"
                                    title="Fill all remaining units into this package"
                                    onClick={() => {
                                      const next = [...outputs];
                                      const cur = { ...(next[idx].package_counts || {}) };
                                      const currentCount = Number(cur[lvl.id] || 0);
                                      const addPkgs = Math.floor(remainingUnallocated / eq);
                                      if (addPkgs > 0) {
                                        cur[lvl.id] = String(currentCount + addPkgs);
                                        next[idx].package_counts = cur;
                                        setOutputs(next);
                                      }
                                    }}
                                    disabled={remainingUnallocated < eq}
                                    className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-1 rounded transition shrink-0 cursor-pointer"
                                  >
                                    Fill
                                  </button>
                                </div>

                                {count > 0 && (
                                  <div className="text-[10px] text-indigo-700 font-mono font-semibold text-right">
                                    = {formatNumber(consumed)} {selectedFg.unit || 'u'} consumed
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Loose / Unpackaged Units Card */}
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-800 text-[11px] block">
                                  🟡 Loose / Unpackaged
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  Individual {selectedFg.unit || 'units'}
                                </span>
                              </div>
                              {Number(selectedFg.default_price) > 0 && (
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                                  {formatCurrency(selectedFg.default_price, workspace?.currency)} / {selectedFg.unit || 'u'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={out.loose_count ?? ''}
                                onChange={(e) => {
                                  const next = [...outputs];
                                  next[idx].loose_count = e.target.value;
                                  setOutputs(next);
                                }}
                                className="w-full h-7 px-2 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-500"
                              />
                              <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                                {selectedFg.unit || 'units'}
                              </span>
                              {remainingUnallocated > 0 && (
                                <button
                                  type="button"
                                  title="Allocate all remaining units to loose"
                                  onClick={() => {
                                    const next = [...outputs];
                                    const curLoose = Number(next[idx].loose_count || 0);
                                    next[idx].loose_count = String(curLoose + remainingUnallocated);
                                    setOutputs(next);
                                  }}
                                  className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-1 rounded transition shrink-0 cursor-pointer"
                                >
                                  All
                                </button>
                              )}
                            </div>

                            {Number(out.loose_count) > 0 && (
                              <div className="text-[10px] text-amber-700 font-mono font-semibold text-right">
                                = {formatNumber(Number(out.loose_count))} {selectedFg.unit || 'u'} loose
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Entire batch will be logged as loose base units (<strong>{selectedFg.unit || 'unit'}</strong>).
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Configure packaging tiers in Recipes & Formulas tab to enable multi-pack splitting.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Outputs Subtotal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 px-1 text-xs">
            <span className="text-slate-500">
              Output Lines: <strong className="text-slate-800">{outputs.length} {outputs.length === 1 ? 'product' : 'products'}</strong>
            </span>
            <div className="text-right flex items-center gap-4">
              <span className="text-xs text-slate-600">
                Expected Output: <strong className="font-mono">{formatNumber(totalExpectedOutput)}</strong> • Actual:{' '}
                <strong className="font-mono">{formatNumber(totalActualOutput)}</strong>
              </span>
              <span className="text-xs text-emerald-700 font-bold">
                Batch Yield: {yieldPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* 4. Manufacturing Cost Allocation Summary */}
        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-blue-400" /> Manufacturing Cost & Profitability Summary
            </span>
            <span className="text-[10px] text-slate-400">Exact Ledger Tie-out</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Raw Materials</span>
              <strong className="font-mono text-sm font-bold block mt-0.5 text-slate-100">
                {formatCurrency(totalInputCost, workspace?.currency)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Labor & Overhead</span>
              <strong className="font-mono text-sm font-bold block mt-0.5 text-slate-100">
                {formatCurrency(numLaborCost + numOtherCost, workspace?.currency)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Total Batch Cost</span>
              <strong className="font-mono text-base font-bold block mt-0.5 text-blue-400">
                {formatCurrency(grandTotalCost, workspace?.currency)}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold block">Total Output Produced</span>
              <strong className="font-mono text-base font-bold block mt-0.5 text-emerald-400">
                {formatNumber(totalActualOutput)} {outputs[0]?.finished_good_id ? (finishedGoods.find(g => g.id === outputs[0].finished_good_id)?.unit || 'units') : 'units'}
              </strong>
            </div>
          </div>
        </div>

        {/* 5. Production Order Notes */}
        <div>
          <Field label="Production Order Notes & Floor Staff Instructions">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Batch temperature logged at 65C. Visual inspection passed. Special instructions for floor shifts."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white focus:outline-blue-500"
            />
          </Field>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={<Plus size={14} />}>
            Create Production Order
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProductionRunsPage() {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const confirm = useConfirm();
  const { canCreate, canDelete, canExport } = usePermissions('production');

  const [activeTab, setActiveTab] = usePersistentTab<'runs' | 'formulas'>('production_tab', 'runs', 'tab');
  const [showModal, setShowModal] = useState(false);
  const [initialFormulaId, setInitialFormulaId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [exportModalData, setExportModalData] = useState<any | null>(null);

  const deleteRun = async (id: string) => {
    const ok = await confirm({
      title: 'Void Production Run?',
      message: 'This will reverse all raw material deductions and remove produced finished goods from inventory ledger. Continue?'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/production-runs/${id}`);
      toast('Production run voided successfully & inventory restored', 'success');
      setRefresh((v) => v + 1);
      setSelectedRunId(null);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to void production run', 'error');
    }
  };

  const columns: TableColumn<any>[] = [
    {
      key: 'run_number',
      label: 'Run #',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-blue-600 text-xs">
          {row.run_number || 'RUN-000'}
        </span>
      )
    },
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-slate-600 text-xs">
          {row.date ? formatDate(row.date) : formatDate(row.created_at)}
        </span>
      )
    },
    {
      key: 'output_summary',
      label: 'Produced Outputs',
      render: (row) => (
        <div className="space-y-0.5">
          <span className="font-medium text-slate-800 text-xs block">{row.output_summary || 'Outputs'}</span>
          {row.output_count > 1 && (
            <span className="text-[10px] text-slate-500 font-mono">
              ({row.output_count} product lines)
            </span>
          )}
        </div>
      )
    },
    {
      key: 'location_name',
      label: 'Location',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 text-xs">
          <MapPin size={11} className="text-slate-400" />
          {row.location_name || 'Main Factory'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status || 'Completed'} />
    },
    {
      key: 'total_input_cost',
      label: 'Total Manufacturing Cost',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {formatCurrency(row.total_input_cost, workspace?.currency)}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<Boxes />}
        title="Production & Manufacturing"
        subtitle="Create production orders with BOM formulas, track floor execution, and monitor product yields."
        action={
          canCreate && activeTab === 'runs' ? (
            <Button
              icon={<Plus size={16} />}
              onClick={() => {
                setInitialFormulaId(null);
                setShowModal(true);
              }}
            >
              New Production Order
            </Button>
          ) : undefined
        }
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'runs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('runs')}
        >
          <Boxes size={15} />
          <span>Production Orders &amp; Runs</span>
        </button>
        <button
          type="button"
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'formulas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('formulas')}
        >
          <Layers size={15} />
          <span>Formulas &amp; BOM</span>
        </button>
      </div>

      {activeTab === 'formulas' ? (
        <ManufacturingFormulasTab
          canCreate={canCreate}
          canEdit={canCreate}
          canDelete={canDelete}
          onSelectForRun={(formulaId) => {
            setInitialFormulaId(formulaId);
            setActiveTab('runs');
            setShowModal(true);
          }}
        />
      ) : (
        <>
          {/* Unified DataTable with Single Actions Column (Eye View + Trash Delete) & Dynamic Export Popup */}
          <DataTable
            endpoint="/api/production-runs"
            columns={columns}
            refreshKey={refresh}
            showDateFilters={true}
            canCreate={canCreate}
            canDelete={canDelete}
            canExport={canExport}
            emptyTitle="No production runs logged"
            rowId={(row) => String(row.id || '')}
            onView={(row) => setSelectedRunId(String(row.id))}
            onDelete={canDelete ? (row) => deleteRun(String(row.id)) : undefined}
            onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
          />

          {/* Pop-up Column-Selective Export Modal */}
          {exportModalData && canExport && (
            <ExportColumnModal
              title="Export Production Runs to CSV"
              recordCount={exportModalData.total}
              availableColumns={PRODUCTION_EXPORT_COLUMNS}
              onClose={() => setExportModalData(null)}
              onConfirmExport={async (selectedKeys) => {
                const records = await exportModalData.getExportData();
                const exportCols: TableColumn<any>[] = PRODUCTION_EXPORT_COLUMNS
                  .filter((c) => selectedKeys.includes(c.key))
                  .map((c) => ({
                    key: c.key,
                    label: c.label
                  }));

                const formattedRecords = records.map((r: any) => {
                  const rawMatCost =
                    Number(r.total_input_cost || 0) -
                    Number(r.labor_cost || 0) -
                    Number(r.other_cost || 0);

                  return {
                    ...r,
                    date: r.date ? formatDate(r.date) : '',
                    created_at: r.created_at ? formatDate(r.created_at) : '',
                    total_input_cost: r.total_input_cost ?? 0,
                    labor_cost: r.labor_cost ?? 0,
                    other_cost: r.other_cost ?? 0,
                    raw_materials_cost: Math.max(0, rawMatCost),
                    status: r.status || 'Completed'
                  };
                });

                csvDownload(
                  `production_runs_${new Date().toISOString().slice(0, 10)}.csv`,
                  formattedRecords,
                  exportCols
                );
                toast(`Exported ${formattedRecords.length} production runs successfully!`, 'success');
                setExportModalData(null);
              }}
            />
          )}

          {showModal && canCreate ? (
            <NewProductionRunModal
              initialFormulaId={initialFormulaId}
              onClose={() => {
                setShowModal(false);
                setInitialFormulaId(null);
              }}
              onSaved={() => {
                setRefresh((v) => v + 1);
                setShowModal(false);
                setInitialFormulaId(null);
              }}
            />
          ) : null}

          {selectedRunId ? (
            <ProductionRunDetailDrawer
              runId={selectedRunId}
              onClose={() => setSelectedRunId(null)}
              onVoid={canDelete ? deleteRun : undefined}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export default ProductionRunsPage;
