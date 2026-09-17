import { useEffect, useState, useMemo, useCallback } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, Plus, Sun, Sunset, Moon,
  AlertTriangle, Calendar, Search, Eye,
  MapPin, X, CheckCircle2,
  Clock, History, RotateCcw, Filter, Trash2,
  Download
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useConfirm } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatDate, formatNumber, dateIso, csvDownload } from '../lib/utils';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Modal, Drawer } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { StatusBadge } from '../components/ui/StatusBadge';
import { DatePicker } from '../components/ui/DatePicker';
import { Pagination } from '../components/ui/Pagination';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';

const SHIFT_OPTIONS = [
  { value: 'morning', label: '🌅 Morning Shift (6AM–2PM)' },
  { value: 'evening', label: '🌆 Evening Shift (2PM–10PM)' },
  { value: 'night', label: '🌙 Night Shift (10PM–6AM)' }
];

const SHIFT_ICONS: Record<string, ReactNode> = {
  morning: <Sun size={13} className="text-amber-500" />,
  evening: <Sunset size={13} className="text-orange-500" />,
  night: <Moon size={13} className="text-indigo-500" />
};

const PRIORITY_BADGE_STYLE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200'
};

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high', label: '🟡 High' },
  { value: 'normal', label: '🔵 Normal' },
  { value: 'low', label: '🟢 Low' }
];

const SHIFT_FILTER_OPTIONS = [
  { value: '', label: 'All Shifts' },
  { value: 'morning', label: '🌅 Morning Shift' },
  { value: 'evening', label: '🌆 Evening Shift' },
  { value: 'night', label: '🌙 Night Shift' }
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'planned', label: '🟡 Planned' },
  { value: 'in_progress', label: '🔵 In Progress' },
  { value: 'completed', label: '🟢 Completed' },
  { value: 'on_hold', label: '🟠 On Hold' },
  { value: 'cancelled', label: '⚪ Cancelled' }
];

const OVERDUE_FILTER_OPTIONS = [
  { value: '', label: 'All Schedules' },
  { value: 'true', label: '⚠️ Overdue Only' }
];

const ORDER_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'order_number', label: 'Order Number' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'products_summary', label: 'Finished Products & Targets' },
  { key: 'target_quantity', label: 'Total Target Quantity' },
  { key: 'total_produced', label: 'Total Produced Quantity' },
  { key: 'remaining_quantity', label: 'Remaining Quantity' },
  { key: 'progress_pct', label: 'Completion (%)' },
  { key: 'formula_name', label: 'Recipe / Formula' },
  { key: 'location_name', label: 'Facility / Location' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'required_by_date', label: 'Deadline' },
  { key: 'notes', label: 'Notes' },
  { key: 'created_at', label: 'Created At' }
];

const SHIFT_LOG_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'log_date', label: 'Shift Date' },
  { key: 'shift', label: 'Shift' },
  { key: 'order_number', label: 'Production Order #' },
  { key: 'item_name', label: 'Finished Product' },
  { key: 'quantity_produced', label: 'Quantity Produced' },
  { key: 'uom', label: 'Unit of Measure' },
  { key: 'logged_by_name', label: 'Logged By (Operator)' },
  { key: 'location_name', label: 'Facility / Location' },
  { key: 'notes', label: 'Shift Notes' },
  { key: 'created_at', label: 'Logged At' }
];

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT LOG MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ShiftLogModal({
  orders,
  preselectedOrder,
  onClose,
  onSaved
}: {
  orders: any[];
  preselectedOrder?: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preselectedOrder?.id || (orders[0]?.id || '')
  );
  const [logDate, setLogDate] = useState(dateIso());
  const [shift, setShift] = useState('morning');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeOrder = preselectedOrder || orders.find((o) => o.id === selectedOrderId);

  // Normalize outputs list (from multi-output relation or fallback single target item)
  const outputItems = useMemo(() => {
    if (!activeOrder) return [];
    if (Array.isArray(activeOrder.outputs) && activeOrder.outputs.length > 0) {
      return activeOrder.outputs;
    }
    return [
      {
        id: activeOrder.id,
        item_id: activeOrder.target_item_id,
        item_name: activeOrder.target_item_name || 'Finished Product',
        item_unit: activeOrder.target_uom || activeOrder.target_item_unit || 'Units',
        target_quantity: activeOrder.target_quantity || 0,
        total_produced: activeOrder.total_produced || 0,
        remaining_quantity: activeOrder.remaining_quantity !== undefined
          ? activeOrder.remaining_quantity
          : Math.max(0, (Number(activeOrder.target_quantity) || 0) - (Number(activeOrder.total_produced) || 0))
      }
    ];
  }, [activeOrder]);

  // Yield inputs keyed by item_id
  const [yields, setYields] = useState<Record<string, string>>({});

  // Reset yields when active order changes
  useEffect(() => {
    setYields({});
  }, [activeOrder?.id]);

  const handleYieldChange = (itemId: string, value: string) => {
    setYields((prev) => ({
      ...prev,
      [itemId]: value
    }));
  };

  const totalYieldEntered = useMemo(() => {
    return Object.values(yields).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [yields]);

  const hasPositiveYield = useMemo(() => {
    return Object.values(yields).some((val) => Number(val) > 0);
  }, [yields]);

  const orderOptions = useMemo(() => {
    return orders.map((o) => {
      const outputCount = Array.isArray(o.outputs) ? o.outputs.length : 1;
      const labelDesc = outputCount > 1
        ? `${o.outputs.map((op: any) => op.item_name).join(', ')} (${outputCount} products)`
        : `${o.target_item_name || 'Item'} (${formatNumber(o.remaining_quantity || 0)} ${o.target_uom || 'units'} remaining)`;
      return {
        value: o.id,
        label: `${o.order_number} — ${labelDesc}`
      };
    });
  }, [orders]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOrder) {
      toast('Please select a production order', 'error');
      return;
    }
    if (!hasPositiveYield) {
      toast('Please enter yield produced for at least one product', 'error');
      return;
    }

    const entries = outputItems
      .map((item: any) => ({
        item_id: item.item_id,
        quantity_produced: Number(yields[item.item_id] || 0),
        uom: item.item_unit || item.uom || activeOrder.target_uom || 'Units'
      }))
      .filter((entry: any) => entry.quantity_produced > 0);

    if (entries.length === 0) {
      toast('Please enter a valid quantity produced greater than zero', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/production-orders/${activeOrder.id}/shift-logs`, {
        log_date: logDate,
        shift,
        notes,
        entries
      });
      toast(`Shift output recorded for ${entries.length} product(s)!`, 'success');
      onSaved();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to log shift production', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isMultiOutput = outputItems.length > 1;

  return (
    <Modal
      title={activeOrder ? `Log Shift Production — ${activeOrder.order_number}` : 'Log Shift Production'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Order Selector (if not preselected) */}
        {!preselectedOrder ? (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Production Order <span className="text-rose-500">*</span>
            </label>
            <Select
              value={selectedOrderId}
              onChange={setSelectedOrderId}
              options={orderOptions}
              placeholder="Select production order..."
              searchable
            />
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-blue-700">{activeOrder.order_number}</span>
              <div className="flex items-center gap-1.5">
                {isMultiOutput && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                    {outputItems.length} Finished Products
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                  PRIORITY_BADGE_STYLE[activeOrder.priority] || PRIORITY_BADGE_STYLE.normal
                }`}>
                  {activeOrder.priority || 'normal'}
                </span>
              </div>
            </div>
            {!isMultiOutput && (
              <div className="font-semibold text-slate-900 text-sm">{activeOrder.target_item_name}</div>
            )}
            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
              <span>Facility: <strong>{activeOrder.location_name || 'Main Facility'}</strong></span>
              <span>Deadline: <strong>{formatDate(activeOrder.required_by_date)}</strong></span>
            </div>
          </div>
        )}

        {/* Shift Date & Shift Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shift Date <span className="text-rose-500">*</span>
            </label>
            <DatePicker
              value={logDate}
              onChange={setLogDate}
              placeholder="dd-mm-yyyy"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Shift Window <span className="text-rose-500">*</span>
            </label>
            <Select
              value={shift}
              onChange={setShift}
              options={SHIFT_OPTIONS}
            />
          </div>
        </div>

        {/* Finished Products & Yield Logging Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              {isMultiOutput ? `Finished Goods Yield (${outputItems.length} Products)` : 'Quantity Produced'} <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-slate-400">Enter output achieved during this shift</span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
            {outputItems.map((item: any) => {
              const target = Number(item.target_quantity) || 0;
              const produced = Number(item.total_produced) || 0;
              const remaining = Math.max(0, target - produced);
              const curYield = Number(yields[item.item_id] || 0);
              const projectedRemaining = Math.max(0, remaining - curYield);
              const uom = item.uom || item.item_unit || activeOrder?.target_uom || 'Units';
              const unitsPerPkg = Number(item.units_per_package) || 1;
              const baseUnit = item.base_unit || '';
              const isPackaged = unitsPerPkg > 1 && Boolean(baseUnit);

              return (
                <div
                  key={item.item_id}
                  className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 transition hover:border-blue-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                        <span>{item.item_name}</span>
                        {item.packaging_name && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                            📦 {item.packaging_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                        <span>Target: <strong className="text-slate-700 font-mono">{formatNumber(target)} {uom}</strong></span>
                        <span>•</span>
                        <span>Produced: <strong className="text-emerald-700 font-mono">{formatNumber(produced)} {uom}</strong></span>
                        <span>•</span>
                        <span>Remaining: <strong className="text-rose-700 font-mono">{formatNumber(remaining)} {uom}</strong></span>
                        {isPackaged && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 font-mono text-[10px] font-semibold">
                              (Base: {formatNumber(target * unitsPerPkg)} {baseUnit} • 1 {uom} = {unitsPerPkg} {baseUnit})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-7">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={yields[item.item_id] ?? ''}
                          onChange={(e) => handleYieldChange(item.item_id, e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-14 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-blue-500 shadow-2xs"
                        />
                        <span className="absolute right-3 top-1.5 text-xs font-semibold text-slate-400 pointer-events-none">
                          {uom}
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-5 text-[11px]">
                      {curYield > 0 ? (
                        <div className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-800 font-medium">
                          Proj. Rem: <strong className="font-mono">{formatNumber(projectedRemaining)} {uom}</strong>
                          {isPackaged && (
                            <span className="block text-[10px] text-blue-600 font-mono">
                              (= {formatNumber(projectedRemaining * unitsPerPkg)} {baseUnit})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No output logged for this shift</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shift Notes */}
        <Field label="Shift Notes / Remarks (Optional)">
          <textarea
            rows={2}
            placeholder="e.g. Machine 2 calibration performed, completed 1st batch without defects..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-blue-500"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} type="button" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !hasPositiveYield}>
            {submitting ? 'Recording Shift...' : `Save Shift Output (${formatNumber(totalYieldEntered)} units)`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT HISTORY DRAWER (Per Order)
// ─────────────────────────────────────────────────────────────────────────────
function ShiftHistoryDrawer({
  order,
  onClose,
  onLogShift,
  isOwnerOrAdmin,
  onDeleted
}: {
  order: any;
  onClose: () => void;
  onLogShift: () => void;
  isOwnerOrAdmin?: boolean;
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = () => {
    setLoading(true);
    api.get(`/api/production-orders/${order.id}/shift-logs`)
      .then((res) => {
        setLogs(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [order.id]);

  const handleDeleteLog = async (log: any) => {
    const itemName = log.item_name || log.target_item_name || 'finished stock';
    const ok = await confirm({
      title: 'Delete Shift Production Entry?',
      message: `Are you sure you want to delete this ${log.shift} shift record (${formatNumber(log.quantity_produced)} ${log.uom} of ${itemName}) from ${formatDate(log.log_date)}? This will subtract ${formatNumber(log.quantity_produced)} ${log.uom} from the inventory ledger and adjust the order progress. Only workspace administrators are authorized to perform this deletion. Continue?`
    });
    if (!ok) return;

    try {
      await api.delete(`/api/production-orders/${order.id}/shift-logs/${log.id}`);
      toast(`Shift log deleted & ${formatNumber(log.quantity_produced)} ${log.uom} of ${itemName} deducted from inventory`, 'success');
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      if (onDeleted) onDeleted();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete shift log', 'error');
    }
  };

  const outputList = Array.isArray(order.outputs) && order.outputs.length > 0
    ? order.outputs
    : [
        {
          id: order.id,
          item_id: order.target_item_id,
          item_name: order.target_item_name || 'Finished Good',
          item_unit: order.target_uom || 'Units',
          target_quantity: order.target_quantity || 0,
          total_produced: order.total_produced || 0,
          remaining_quantity: order.remaining_quantity || 0,
          progress_pct: order.target_quantity > 0 ? Math.min(100, Math.round(((order.total_produced || 0) / order.target_quantity) * 100)) : 0
        }
      ];

  const isMultiOutput = outputList.length > 1;
  const targetQty = Number(order.target_quantity) || 0;
  const producedQty = logs.reduce((sum, l) => sum + (Number(l.quantity_produced) || 0), 0);
  const remaining = Math.max(0, targetQty - producedQty);
  const progressPct = targetQty > 0 ? Math.min(100, Math.round((producedQty / targetQty) * 100)) : 0;

  return (
    <Drawer
      title={`Shift Log History — Order ${order.order_number}`}
      onClose={onClose}
    >
      <div className="space-y-5 text-xs">
        {/* Order Summary Header */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-blue-700 text-sm">{order.order_number}</span>
            <div className="flex items-center gap-1.5">
              {isMultiOutput && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  {outputList.length} Products
                </span>
              )}
              <StatusBadge status={order.status} />
            </div>
          </div>

          <div>
            {!isMultiOutput ? (
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">{order.target_item_name}</h3>
                {outputList[0]?.packaging_name && (
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                    📦 {outputList[0].packaging_name}
                  </span>
                )}
              </div>
            ) : (
              <h3 className="text-sm font-bold text-slate-900">Finished Products ({outputList.length})</h3>
            )}
            {order.formula_name && (
              <p className="text-[11px] text-slate-500 mt-0.5">Formula: {order.formula_name}</p>
            )}
          </div>

          {/* Product Targets Breakdown */}
          {isMultiOutput ? (
            <div className="space-y-2 pt-1 border-t border-slate-200/60">
              {outputList.map((out: any) => {
                const outTarget = Number(out.target_quantity) || 0;
                const outProduced = Number(out.total_produced) || 0;
                const outRemaining = Math.max(0, outTarget - outProduced);
                const outPct = outTarget > 0 ? Math.min(100, Math.round((outProduced / outTarget) * 100)) : 0;
                const uom = out.uom || out.item_unit || 'Units';
                const unitsPerPkg = Number(out.units_per_package) || 1;
                const baseUnit = out.base_unit || '';
                const isPackaged = unitsPerPkg > 1 && Boolean(baseUnit);

                return (
                  <div key={out.item_id || out.id} className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{out.item_name}</span>
                        {out.packaging_name && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                            📦 {out.packaging_name}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-[11px] text-slate-700">{outPct}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                      <div>
                        <span className="text-slate-400 block font-semibold">Target</span>
                        <span className="font-mono font-bold text-slate-800">{formatNumber(outTarget)} {uom}</span>
                        {isPackaged && (
                          <span className="text-[9px] text-slate-400 font-mono block">(= {formatNumber(outTarget * unitsPerPkg)} {baseUnit})</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Produced</span>
                        <span className="font-mono font-bold text-emerald-700">{formatNumber(outProduced)} {uom}</span>
                        {isPackaged && (
                          <span className="text-[9px] text-emerald-600 font-mono block">(= {formatNumber(outProduced * unitsPerPkg)} {baseUnit})</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Remaining</span>
                        <span className="font-mono font-bold text-rose-700">{formatNumber(outRemaining)} {uom}</span>
                        {isPackaged && (
                          <span className="text-[9px] text-rose-500 font-mono block">(= {formatNumber(outRemaining * unitsPerPkg)} {baseUnit})</span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${outPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${outPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 text-center">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Target</span>
                  <strong className="font-mono text-sm text-slate-800">{formatNumber(targetQty)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Produced</span>
                  <strong className="font-mono text-sm text-emerald-700">{formatNumber(producedQty)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold block">Remaining</span>
                  <strong className="font-mono text-sm text-rose-700">{formatNumber(remaining)}</strong>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Overall Completion</span>
                  <span className="font-mono">{progressPct}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100">
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} className="text-slate-400" />
              Deadline: <strong className="text-slate-700">{formatDate(order.required_by_date)}</strong>
            </span>
            <span className="capitalize">
              Priority: <strong className="text-slate-800">{order.priority || 'Normal'}</strong>
            </span>
          </div>
        </div>

        {/* Action Button */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <Button
            className="w-full justify-center"
            icon={<Plus size={14} />}
            onClick={onLogShift}
          >
            Log Shift for this Order
          </Button>
        )}

        {/* Shift Logs Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Shift Production Entries ({logs.length})
            </h4>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">Loading shift records...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
              No shifts logged yet for this order.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Shift</th>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-right px-3 py-2">Produced</th>
                    <th className="text-left px-3 py-2">Logged By</th>
                    <th className="text-left px-3 py-2">Notes</th>
                    {isOwnerOrAdmin && <th className="text-right px-3 py-2">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {formatDate(log.log_date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 capitalize">
                          {SHIFT_ICONS[log.shift]}
                          {log.shift}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                        {log.item_name || log.target_item_name || 'Finished Item'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        +{formatNumber(log.quantity_produced)} <span className="text-slate-400 font-normal text-[10px]">{log.uom}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {log.logged_by_name || 'Staff'}
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate" title={log.notes}>
                        {log.notes || '—'}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition cursor-pointer border border-transparent hover:border-rose-200"
                            title="Delete Shift Log (Admin only)"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PRODUCTION SHIFT LOG PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function ProductionShiftLogPage() {
  const shiftPerms = usePermissions('shift_log');
  const prodPerms = usePermissions('production');
  const canView = shiftPerms.canView || prodPerms.canView;
  const canCreate = shiftPerms.canCreate || prodPerms.canCreate;
  const canDelete = shiftPerms.canDelete || prodPerms.canDelete;
  const canExport = shiftPerms.canExport || prodPerms.canExport;
  const isOwnerOrAdmin = shiftPerms.isOwnerOrAdmin || prodPerms.isOwnerOrAdmin;
  const canDeleteShiftLog = isOwnerOrAdmin || canDelete;

  const toast = useToast();
  const confirm = useConfirm();

  const handleDeleteGlobalShiftLog = async (log: any) => {
    const ok = await confirm({
      title: 'Delete Shift Production Log?',
      message: `Are you sure you want to delete this ${log.shift} shift record for Order ${log.order_number}? Deleting it will subtract ${formatNumber(log.quantity_produced)} ${log.uom} of ${log.target_item_name || 'finished goods'} from the inventory ledger and adjust the order status. Continue?`
    });
    if (!ok) return;

    try {
      await api.delete(`/api/production-shift-logs/${log.id}`);
      toast(`Shift log deleted & ${formatNumber(log.quantity_produced)} ${log.uom} deducted from inventory ledger`, 'success');
      setShiftLogs((prev) => prev.filter((l) => l.id !== log.id));
      setRefreshKey((v) => v + 1);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete shift log', 'error');
    }
  };

  // Search parameters for URL persistence (tabs, page, filters hold across reloads)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'active';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const searchQuery = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const locationFilter = searchParams.get('location_id') || '';
  const productIdFilter = searchParams.get('product_id') || '';
  const formulaIdFilter = searchParams.get('formula_id') || '';
  const operatorIdFilter = searchParams.get('operator_id') || '';
  const overdueFilter = searchParams.get('overdue') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const shiftFilter = searchParams.get('shift') || '';

  // Local state for instant input typing
  const [searchInput, setSearchInput] = useState(searchQuery);

  // Sync local searchInput if URL changes
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Data states
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersMeta, setOrdersMeta] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 });
  const [shiftLogs, setShiftLogs] = useState<any[]>([]);
  const [shiftLogsMeta, setShiftLogsMeta] = useState({ page: 1, page_size: 20, total: 0, total_pages: 1 });
  const [locations, setLocations] = useState<any[]>([]);

  // Distinct filter options loaded from backend
  const [filterOptions, setFilterOptions] = useState<{
    products: Array<{ id: string; name: string; unit?: string }>;
    formulas: Array<{ id: string; name: string }>;
    operators: Array<{ id: string; name: string; email?: string }>;
  }>({ products: [], formulas: [], operators: [] });

  const [stats, setStats] = useState({
    active_orders_count: 0,
    today_shifts_count: 0,
    completed_orders_count: 0,
    urgent_or_overdue_count: 0
  });

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals and drawers
  const [shiftModalOrder, setShiftModalOrder] = useState<any | null>(null);
  const [showGenericModal, setShowGenericModal] = useState(false);
  const [historyDrawerOrder, setHistoryDrawerOrder] = useState<any | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Helper to update URL search parameters
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === undefined || val === '') {
        next.delete(key);
      } else {
        next.set(key, val);
      }
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Tab change handler
  const handleTabChange = (newTab: string) => {
    updateParams({
      tab: newTab,
      page: '1'
    });
  };

  // Page change handler
  const handlePageChange = (newPage: number) => {
    updateParams({ page: String(newPage) });
  };

  // Filter handlers
  const handleSearchSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    updateParams({ search: searchInput.trim(), page: '1' });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateParams({ search: '', page: '1' });
  };

  const handleStatusChange = (val: string) => {
    updateParams({ status: val, page: '1' });
  };

  const handlePriorityChange = (val: string) => {
    updateParams({ priority: val, page: '1' });
  };

  const handleLocationChange = (val: string) => {
    updateParams({ location_id: val, page: '1' });
  };

  const handleProductChange = (val: string) => {
    updateParams({ product_id: val, page: '1' });
  };

  const handleFormulaChange = (val: string) => {
    updateParams({ formula_id: val, page: '1' });
  };

  const handleOperatorChange = (val: string) => {
    updateParams({ operator_id: val, page: '1' });
  };

  const handleOverdueChange = (val: string) => {
    updateParams({ overdue: val, page: '1' });
  };

  const handleStartDateChange = (val: string) => {
    updateParams({ start_date: val, page: '1' });
  };

  const handleEndDateChange = (val: string) => {
    updateParams({ end_date: val, page: '1' });
  };

  const handleShiftFilterChange = (val: string) => {
    updateParams({ shift: val, page: '1' });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    updateParams({
      search: '',
      status: '',
      priority: '',
      location_id: '',
      product_id: '',
      formula_id: '',
      operator_id: '',
      overdue: '',
      start_date: '',
      end_date: '',
      shift: '',
      page: '1'
    });
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
    statusFilter ||
    priorityFilter ||
    locationFilter ||
    productIdFilter ||
    formulaIdFilter ||
    operatorIdFilter ||
    overdueFilter ||
    startDate ||
    endDate ||
    (activeTab === 'shift_history' && shiftFilter)
  );

  // Load locations for filter dropdown
  useEffect(() => {
    api.get('/api/locations')
      .then((res) => {
        setLocations(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => setLocations([]));
  }, []);

  // Load distinct filter options (products, formulas, operators)
  useEffect(() => {
    api.get('/api/production-orders/filter-options')
      .then((res) => {
        if (res.data) {
          setFilterOptions({
            products: res.data.products || [],
            formulas: res.data.formulas || [],
            operators: res.data.operators || []
          });
        }
      })
      .catch(() => {});
  }, []);

  const locationOptions = useMemo(() => {
    const list = [{ value: '', label: 'All Facilities / Locations' }];
    locations.forEach((loc) => {
      list.push({ value: loc.id, label: loc.name });
    });
    return list;
  }, [locations]);

  const productOptions = useMemo(() => {
    const list = [{ value: '', label: 'All Finished Goods' }];
    filterOptions.products.forEach((p) => {
      list.push({ value: p.id, label: `${p.name}${p.unit ? ` (${p.unit})` : ''}` });
    });
    return list;
  }, [filterOptions.products]);

  const formulaOptions = useMemo(() => {
    const list = [{ value: '', label: 'All Recipes / Formulas' }];
    filterOptions.formulas.forEach((f) => {
      list.push({ value: f.id, label: f.name });
    });
    return list;
  }, [filterOptions.formulas]);

  const operatorOptions = useMemo(() => {
    const list = [{ value: '', label: 'All Operators / Staff' }];
    filterOptions.operators.forEach((u) => {
      list.push({ value: u.id, label: u.name });
    });
    return list;
  }, [filterOptions.operators]);

  // Load KPI stats
  useEffect(() => {
    api.get('/api/production-orders/stats')
      .then((res) => {
        if (res.data) setStats(res.data);
      })
      .catch(() => undefined);
  }, [refreshKey]);

  // Determine status query param based on active tab
  const statusParam = useMemo(() => {
    if (activeTab === 'active') return 'open,in_progress';
    if (activeTab === 'completed') return 'completed';
    if (activeTab === 'cancelled') return 'cancelled';
    return ''; // 'all' tab shows everything
  }, [activeTab]);

  // Load Orders Data (for orders tabs: active, all, completed, cancelled)
  useEffect(() => {
    if (activeTab === 'shift_history') return;

    setLoading(true);
    const params: any = {
      page: currentPage,
      page_size: 20
    };
    if (statusFilter) {
      params.status = statusFilter;
    } else if (statusParam) {
      params.status = statusParam;
    }
    if (priorityFilter) params.priority = priorityFilter;
    if (locationFilter) params.location_id = locationFilter;
    if (productIdFilter) params.product_id = productIdFilter;
    if (formulaIdFilter) params.formula_id = formulaIdFilter;
    if (overdueFilter) params.overdue = overdueFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (searchQuery) params.search = searchQuery;

    api.get('/api/production-orders', { params })
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        setOrders(list);
        if (res.data?.meta) {
          setOrdersMeta(res.data.meta);
        } else {
          setOrdersMeta({
            page: currentPage,
            page_size: 20,
            total: list.length,
            total_pages: 1
          });
        }
      })
      .catch(() => {
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [
    activeTab,
    statusParam,
    statusFilter,
    priorityFilter,
    locationFilter,
    productIdFilter,
    formulaIdFilter,
    overdueFilter,
    startDate,
    endDate,
    searchQuery,
    currentPage,
    refreshKey
  ]);

  // Load Shift Logs History (for shift_history tab)
  useEffect(() => {
    if (activeTab !== 'shift_history') return;

    setLoading(true);
    const params: any = {
      page: currentPage,
      page_size: 20
    };
    if (shiftFilter) params.shift = shiftFilter;
    if (operatorIdFilter) params.operator_id = operatorIdFilter;
    if (productIdFilter) params.product_id = productIdFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (searchQuery) params.search = searchQuery;

    api.get('/api/production-shift-logs', { params })
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        setShiftLogs(list);
        if (res.data?.meta) {
          setShiftLogsMeta(res.data.meta);
        } else {
          setShiftLogsMeta({
            page: currentPage,
            page_size: 20,
            total: list.length,
            total_pages: 1
          });
        }
      })
      .catch(() => {
        setShiftLogs([]);
      })
      .finally(() => setLoading(false));
  }, [
    activeTab,
    shiftFilter,
    operatorIdFilter,
    productIdFilter,
    startDate,
    endDate,
    searchQuery,
    currentPage,
    refreshKey
  ]);

  // Export execution handler
  const handleConfirmExport = async (selectedKeys: string[]) => {
    try {
      if (activeTab === 'shift_history') {
        const params: any = {
          export: 'true'
        };
        if (shiftFilter) params.shift = shiftFilter;
        if (operatorIdFilter) params.operator_id = operatorIdFilter;
        if (productIdFilter) params.product_id = productIdFilter;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (searchQuery) params.search = searchQuery;

        const res = await api.get('/api/production-shift-logs', { params });
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];

        const exportCols = SHIFT_LOG_EXPORT_COLUMNS
          .filter((c) => selectedKeys.includes(c.key))
          .map((c) => ({ key: c.key, label: c.label }));

        const formattedRows = list.map((r: any) => ({
          ...r,
          log_date: r.log_date ? formatDate(r.log_date) : '',
          created_at: r.created_at ? formatDate(r.created_at) : '',
          item_name: r.item_name || r.target_item_name || 'Item',
          quantity_produced: Number(r.quantity_produced) || 0
        }));

        csvDownload(`shift_production_logs_${dateIso()}.csv`, formattedRows, exportCols);
        toast(`Exported ${formattedRows.length} shift logs successfully!`, 'success');
      } else {
        const params: any = {
          export: 'true'
        };
        if (statusFilter) {
          params.status = statusFilter;
        } else if (statusParam) {
          params.status = statusParam;
        }
        if (priorityFilter) params.priority = priorityFilter;
        if (locationFilter) params.location_id = locationFilter;
        if (productIdFilter) params.product_id = productIdFilter;
        if (formulaIdFilter) params.formula_id = formulaIdFilter;
        if (overdueFilter) params.overdue = overdueFilter;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        if (searchQuery) params.search = searchQuery;

        const res = await api.get('/api/production-orders', { params });
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];

        const exportCols = ORDER_EXPORT_COLUMNS
          .filter((c) => selectedKeys.includes(c.key))
          .map((c) => ({ key: c.key, label: c.label }));

        const formattedRows = list.map((r: any) => {
          const tQty = Number(r.target_quantity) || 0;
          const pQty = Number(r.total_produced) || 0;
          const pct = tQty > 0 ? Math.min(100, Math.round((pQty / tQty) * 100)) : 0;
          const prodSummary = Array.isArray(r.outputs) && r.outputs.length > 0
            ? r.outputs.map((o: any) => `${o.item_name || 'Item'}: ${o.total_produced || 0}/${o.target_quantity || 0} ${o.item_unit || o.uom || ''}`).join('; ')
            : `${r.target_item_name || 'Item'}: ${pQty}/${tQty} ${r.target_item_unit || ''}`;

          return {
            ...r,
            start_date: r.start_date ? formatDate(r.start_date) : '',
            required_by_date: r.required_by_date ? formatDate(r.required_by_date) : '',
            created_at: r.created_at ? formatDate(r.created_at) : '',
            products_summary: prodSummary,
            progress_pct: `${pct}%`,
            target_quantity: tQty,
            total_produced: pQty,
            remaining_quantity: Math.max(0, tQty - pQty)
          };
        });

        csvDownload(`production_orders_${dateIso()}.csv`, formattedRows, exportCols);
        toast(`Exported ${formattedRows.length} production orders successfully!`, 'success');
      }
      setShowExportModal(false);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to export data', 'error');
    }
  };

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You don't have permission to view production orders or shift logs.</p>
      </div>
    );
  }

  // Common tab navigation definitions matching standard ERP pages
  const tabs = [
    {
      id: 'active',
      label: 'Active Orders',
      icon: <Clock size={15} />,
      badge: stats.active_orders_count > 0 ? stats.active_orders_count : undefined
    },
    {
      id: 'all',
      label: 'All Production Orders',
      icon: <ClipboardList size={15} />
    },
    {
      id: 'completed',
      label: 'Completed',
      icon: <CheckCircle2 size={15} />
    },
    {
      id: 'shift_history',
      label: 'Shift Logs History',
      icon: <History size={15} />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header matching ERP Global Template */}
      <PageTitle
        icon={<ClipboardList />}
        title="Production Shift Log"
        subtitle="Track shop floor production targets, server-side paginated shift logs, and shift-by-shift outputs."
        action={
          <div className="flex items-center gap-2">
            {canExport && (
              <Button
                variant="secondary"
                icon={<Download size={15} />}
                onClick={() => setShowExportModal(true)}
              >
                Export
              </Button>
            )}
            {canCreate && (
              <Button
                icon={<Plus size={16} />}
                onClick={() => setShowGenericModal(true)}
              >
                Log Shift Output
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Summary Cards matching ERP Global Template */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Orders */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Orders</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><ClipboardList size={15} /></span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {stats.active_orders_count}
          </div>
          <p className="text-[11px] text-slate-500">
            Open production orders on the shop floor
          </p>
        </div>

        {/* Card 2: Today's Shift Logs (Distinct shift sessions) */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Today's Shift Logs</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Clock size={15} /></span>
          </div>
          <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
            {stats.today_shifts_count}
          </div>
          <p className="text-[11px] text-slate-500">
            {stats.today_shifts_count === 1 ? 'Shift session' : 'Shift sessions'} recorded today
          </p>
        </div>

        {/* Card 3: Completed Orders */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Completed Orders</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><CheckCircle2 size={15} /></span>
          </div>
          <div className="text-2xl font-black text-indigo-950 font-mono tracking-tight">
            {stats.completed_orders_count}
          </div>
          <p className="text-[11px] text-slate-500">
            Fulfilled and closed production orders
          </p>
        </div>

        {/* Card 4: Urgent / Overdue */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Urgent / Overdue</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><AlertTriangle size={15} /></span>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono tracking-tight">
            {stats.urgent_or_overdue_count}
          </div>
          <p className="text-[11px] text-slate-500">
            {stats.urgent_or_overdue_count === 0 ? 'All orders on schedule' : 'Orders requiring priority attention'}
          </p>
        </div>
      </div>

      {/* Common Tab Design matching other ERP pages (Holds state in URL searchParams on refresh) */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {tabs.map((tab) => {
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
                {tab.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
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

      {/* Rich Search & Filter Toolbar with Global Custom Dropdowns & Custom DatePicker */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Filter Controls Grid */}
        <div className="space-y-3">
          {/* Row 1: Search, Product, Status / Shift, Priority / Operator */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <form onSubmit={handleSearchSubmit}>
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={activeTab === 'shift_history' ? 'Search order #, product, operator, notes...' : 'Search order #, product, formula, notes...'}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => {
                    if (searchInput !== searchQuery) {
                      updateParams({ search: searchInput.trim(), page: '1' });
                    }
                  }}
                  className="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-blue-500 shadow-2xs"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </form>
            </div>

            {/* Product / Finished Good Select */}
            <div className="md:col-span-3">
              <Select
                value={productIdFilter}
                onChange={handleProductChange}
                options={productOptions}
                placeholder="All Finished Goods"
                searchable
              />
            </div>

            {activeTab !== 'shift_history' ? (
              <>
                {/* Status Select */}
                <div className="md:col-span-2">
                  <Select
                    value={statusFilter}
                    onChange={handleStatusChange}
                    options={STATUS_FILTER_OPTIONS}
                    placeholder="All Statuses"
                  />
                </div>

                {/* Priority Select */}
                <div className="md:col-span-3">
                  <Select
                    value={priorityFilter}
                    onChange={handlePriorityChange}
                    options={PRIORITY_FILTER_OPTIONS}
                    placeholder="All Priorities"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Shift Filter (Shift History Tab) */}
                <div className="md:col-span-2">
                  <Select
                    value={shiftFilter}
                    onChange={handleShiftFilterChange}
                    options={SHIFT_FILTER_OPTIONS}
                    placeholder="All Shifts"
                  />
                </div>

                {/* Operator Select (Shift History Tab) */}
                <div className="md:col-span-3">
                  <Select
                    value={operatorIdFilter}
                    onChange={handleOperatorChange}
                    options={operatorOptions}
                    placeholder="All Operators / Staff"
                    searchable
                  />
                </div>
              </>
            )}
          </div>

          {/* Row 2: Secondary filters & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 border-t border-slate-100">
            {activeTab !== 'shift_history' ? (
              <>
                {/* Recipe / Formula Select */}
                <div className="md:col-span-3">
                  <Select
                    value={formulaIdFilter}
                    onChange={handleFormulaChange}
                    options={formulaOptions}
                    placeholder="All Recipes / Formulas"
                    searchable
                  />
                </div>

                {/* Facility / Location Select */}
                <div className="md:col-span-3">
                  <Select
                    value={locationFilter}
                    onChange={handleLocationChange}
                    options={locationOptions}
                    placeholder="All Facilities"
                    searchable
                  />
                </div>

                {/* Schedule / Overdue Select */}
                <div className="md:col-span-2">
                  <Select
                    value={overdueFilter}
                    onChange={handleOverdueChange}
                    options={OVERDUE_FILTER_OPTIONS}
                    placeholder="All Schedules"
                  />
                </div>

                {/* Date Range */}
                <div className="md:col-span-4 flex items-center gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={startDate}
                      onChange={handleStartDateChange}
                      placeholder="Due From"
                    />
                  </div>
                  <span className="text-slate-400 text-xs font-semibold">to</span>
                  <div className="flex-1">
                    <DatePicker
                      value={endDate}
                      onChange={handleEndDateChange}
                      placeholder="Due To"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Date Range for Shift History */}
                <div className="md:col-span-6 flex items-center gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={startDate}
                      onChange={handleStartDateChange}
                      placeholder="Shift Date From"
                    />
                  </div>
                  <span className="text-slate-400 text-xs font-semibold">to</span>
                  <div className="flex-1">
                    <DatePicker
                      value={endDate}
                      onChange={handleEndDateChange}
                      placeholder="Shift Date To"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active Filter Chips / Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <Filter size={12} /> Active Filters:
              </span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                  Query: "{searchQuery}"
                  <button onClick={handleClearSearch} className="hover:text-blue-900 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {productIdFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium">
                  Product: {filterOptions.products.find((p) => p.id === productIdFilter)?.name || 'Selected'}
                  <button onClick={() => handleProductChange('')} className="hover:text-emerald-950 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-medium capitalize">
                  Status: {statusFilter.replace('_', ' ')}
                  <button onClick={() => handleStatusChange('')} className="hover:text-blue-950 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {priorityFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium capitalize">
                  Priority: {priorityFilter}
                  <button onClick={() => handlePriorityChange('')} className="hover:text-amber-950 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {formulaIdFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-medium">
                  Formula: {filterOptions.formulas.find((f) => f.id === formulaIdFilter)?.name || 'Selected'}
                  <button onClick={() => handleFormulaChange('')} className="hover:text-purple-950 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {locationFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                  Facility: {locations.find((l) => l.id === locationFilter)?.name || 'Selected'}
                  <button onClick={() => handleLocationChange('')} className="hover:text-slate-900 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {overdueFilter === 'true' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-medium">
                  ⚠️ Overdue Only
                  <button onClick={() => handleOverdueChange('')} className="hover:text-rose-950 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {shiftFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium capitalize">
                  Shift: {shiftFilter}
                  <button onClick={() => handleShiftFilterChange('')} className="hover:text-indigo-900 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {operatorIdFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-medium">
                  Operator: {filterOptions.operators.find((u) => u.id === operatorIdFilter)?.name || 'Selected'}
                  <button onClick={() => handleOperatorChange('')} className="hover:text-indigo-950 cursor-pointer"><X size={11} /></button>
                </span>
              )}
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                  Dates: {startDate || '—'} to {endDate || '—'}
                  <button onClick={() => { handleStartDateChange(''); handleEndDateChange(''); }} className="hover:text-slate-900 cursor-pointer"><X size={11} /></button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <RotateCcw size={12} /> Reset All
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: Orders Tables (active, all, completed) */}
      {activeTab !== 'shift_history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              Loading production orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <ClipboardList size={36} className="mx-auto text-slate-300" />
              <h4 className="font-bold text-slate-800 text-sm">No production orders found</h4>
              <p className="text-xs text-slate-500">
                {hasActiveFilters
                  ? 'No orders match your filter criteria. Try resetting filters.'
                  : activeTab === 'active'
                  ? 'No active orders on the shop floor. Click "Log Shift Output" or create a production order from the Production page.'
                  : 'No production orders recorded.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Order #</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Product</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Facility</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Target</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider min-w-[160px]">Progress</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Remaining</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Required By</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Priority</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Status</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => {
                      const targetQty = Number(order.target_quantity) || 0;
                      const producedQty = Number(order.total_produced) || 0;
                      const remainingQty = Math.max(0, targetQty - producedQty);
                      const progress = targetQty > 0 ? Math.min(100, Math.round((producedQty / targetQty) * 100)) : 0;
                      const isOverdue = new Date(order.required_by_date) < new Date() && order.status !== 'completed';

                      const isMultiOutput = Array.isArray(order.outputs) && order.outputs.length > 1;

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition">
                          {/* Order # */}
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-blue-700">{order.order_number}</span>
                            {order.shift_log_count > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {order.shift_log_count} {order.shift_log_count === 1 ? 'shift' : 'shifts'} logged
                              </div>
                            )}
                          </td>

                          {/* Product */}
                          <td className="px-4 py-3">
                            {isMultiOutput ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                    {order.outputs.length} Products
                                  </span>
                                  {order.formula_name && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={order.formula_name}>
                                      {order.formula_name}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  {order.outputs.map((out: any) => (
                                    <div key={out.id || out.item_id} className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                      <span>• {out.item_name}</span>
                                      {out.packaging_name && (
                                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-full font-bold">
                                          📦 {out.packaging_name}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>{order.target_item_name}</span>
                                  {order.outputs?.[0]?.packaging_name && (
                                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-full font-bold">
                                      📦 {order.outputs[0].packaging_name}
                                    </span>
                                  )}
                                </div>
                                {order.formula_name && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                                    Formula: {order.formula_name}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Facility */}
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} className="text-slate-400" />
                              {order.location_name || 'Main Facility'}
                            </span>
                          </td>

                          {/* Target */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isMultiOutput ? (
                              <div className="space-y-1 font-mono text-xs">
                                {order.outputs.map((out: any) => {
                                  const unitsPerPkg = Number(out.units_per_package) || 1;
                                  const baseUnit = out.base_unit || '';
                                  const isPackaged = unitsPerPkg > 1 && Boolean(baseUnit);
                                  return (
                                    <div key={out.id || out.item_id} className="text-slate-800">
                                      <strong>{formatNumber(out.target_quantity)}</strong> <span className="text-slate-600 font-semibold text-[11px]">{out.uom || out.item_unit}</span>
                                      {isPackaged && (
                                        <span className="text-slate-400 font-normal text-[10px] ml-1">
                                          (= {formatNumber((Number(out.target_quantity) || 0) * unitsPerPkg)} {baseUnit})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="font-mono font-bold text-slate-900">
                                {formatNumber(targetQty)} <span className="text-slate-600 font-semibold">{order.target_uom}</span>
                                {Number(order.outputs?.[0]?.units_per_package) > 1 && (
                                  <span className="text-slate-400 font-normal text-[10px] ml-1">
                                    (= {formatNumber(targetQty * Number(order.outputs[0].units_per_package))} {order.outputs[0].base_unit || 'base'})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Progress */}
                          <td className="px-4 py-3">
                            {isMultiOutput ? (
                              <div className="space-y-2 min-w-[170px]">
                                {order.outputs.map((out: any) => {
                                  const outTarget = Number(out.target_quantity) || 0;
                                  const outProduced = Number(out.total_produced) || 0;
                                  const outPct = outTarget > 0 ? Math.min(100, Math.round((outProduced / outTarget) * 100)) : 0;
                                  const uom = out.item_unit || out.uom || 'units';

                                  return (
                                    <div key={out.id || out.item_id} className="space-y-0.5">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="truncate max-w-[90px] text-slate-600 font-medium">{out.item_name}:</span>
                                        <span className="font-mono text-slate-700">
                                          <strong>{formatNumber(outProduced)}</strong>/{formatNumber(outTarget)} {uom} ({outPct}%)
                                        </span>
                                      </div>
                                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${outPct >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                                          style={{ width: `${outPct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-mono text-slate-600">
                                    <strong>{formatNumber(producedQty)}</strong> / {formatNumber(targetQty)}
                                  </span>
                                  <span className="font-mono font-bold text-slate-700">{progress}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Remaining */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isMultiOutput ? (
                              <div className="space-y-1 font-mono text-xs">
                                {order.outputs.map((out: any) => {
                                  const rem = Math.max(0, (Number(out.target_quantity) || 0) - (Number(out.total_produced) || 0));
                                  return (
                                    <div key={out.id || out.item_id} className="text-slate-800">
                                      <strong>{formatNumber(rem)}</strong> <span className="text-slate-400 font-normal text-[10px]">{out.item_unit || out.uom}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="font-mono font-bold text-slate-900">
                                {formatNumber(remainingQty)} <span className="text-slate-400 font-normal">{order.target_uom}</span>
                              </div>
                            )}
                          </td>

                          {/* Required By */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-700'}>
                              {isOverdue && <AlertTriangle size={11} />}
                              {formatDate(order.required_by_date)}
                            </span>
                          </td>

                          {/* Priority */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                              PRIORITY_BADGE_STYLE[order.priority] || PRIORITY_BADGE_STYLE.normal
                            }`}>
                              {order.priority || 'normal'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={order.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {canCreate && order.status !== 'completed' && order.status !== 'cancelled' && (
                                <button
                                  type="button"
                                  onClick={() => setShiftModalOrder(order)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                >
                                  <Plus size={12} /> Log Shift
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setHistoryDrawerOrder(order)}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                title="View Shift History"
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Server-Side Pagination */}
              <Pagination
                currentPage={ordersMeta.page}
                totalItems={ordersMeta.total}
                pageSize={ordersMeta.page_size}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: Global Shift Logs History Table */}
      {activeTab === 'shift_history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              Loading shift logs...
            </div>
          ) : shiftLogs.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <History size={36} className="mx-auto text-slate-300" />
              <h4 className="font-bold text-slate-800 text-sm">No shift production entries found</h4>
              <p className="text-xs text-slate-500">
                {hasActiveFilters
                  ? 'No shift records match your current filters. Try clearing filters.'
                  : 'No shift production has been logged yet.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Shift</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Order #</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Target Item</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Quantity Produced</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Logged By</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Notes</th>
                      {canDeleteShiftLog && (
                        <th className="text-right px-4 py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shiftLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                          {formatDate(log.log_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 capitalize">
                            {SHIFT_ICONS[log.shift]}
                            {log.shift} Shift
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-blue-700">{log.order_number}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {log.item_name || log.target_item_name || 'Item'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          +{formatNumber(log.quantity_produced)} <span className="text-slate-400 font-normal text-[10px]">{log.uom}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {log.logged_by_name || 'Staff'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={log.notes}>
                          {log.notes || '—'}
                        </td>
                        {canDeleteShiftLog && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteGlobalShiftLog(log)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 hover:border-rose-300 transition cursor-pointer shadow-2xs"
                              title="Delete Shift Log"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Server-Side Pagination */}
              <Pagination
                currentPage={shiftLogsMeta.page}
                totalItems={shiftLogsMeta.total}
                pageSize={shiftLogsMeta.page_size}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Log Shift Modal (Preselected Order) */}
      {shiftModalOrder && (
        <ShiftLogModal
          orders={orders}
          preselectedOrder={shiftModalOrder}
          onClose={() => setShiftModalOrder(null)}
          onSaved={() => {
            setShiftModalOrder(null);
            setRefreshKey((v) => v + 1);
          }}
        />
      )}

      {/* Log Shift Modal (Generic dropdown selector) */}
      {showGenericModal && (
        <ShiftLogModal
          orders={orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')}
          onClose={() => setShowGenericModal(false)}
          onSaved={() => {
            setShowGenericModal(false);
            setRefreshKey((v) => v + 1);
          }}
        />
      )}

      {/* Shift History Slide-over Drawer */}
      {historyDrawerOrder && (
        <ShiftHistoryDrawer
          order={historyDrawerOrder}
          isOwnerOrAdmin={canDeleteShiftLog}
          onClose={() => setHistoryDrawerOrder(null)}
          onDeleted={() => setRefreshKey((v) => v + 1)}
          onLogShift={() => {
            const ord = historyDrawerOrder;
            setHistoryDrawerOrder(null);
            setShiftModalOrder(ord);
          }}
        />
      )}

      {/* Pop-up Column-Selective Export Modal matching ERP Standard */}
      {showExportModal && canExport && (
        <ExportColumnModal
          title={activeTab === 'shift_history' ? 'Export Shift Production Logs to CSV' : 'Export Production Orders to CSV'}
          recordCount={activeTab === 'shift_history' ? shiftLogsMeta.total : ordersMeta.total}
          availableColumns={activeTab === 'shift_history' ? SHIFT_LOG_EXPORT_COLUMNS : ORDER_EXPORT_COLUMNS}
          onClose={() => setShowExportModal(false)}
          onConfirmExport={handleConfirmExport}
        />
      )}
    </div>
  );
}

export default ProductionShiftLogPage;
