import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  Building,
  CheckCircle2,
  Clock,
  Copy,
  Layers,
  MapPin,
  Package,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Info,
  Receipt,
  Store
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatNumber, formatDate } from '../lib/utils';
import { useWorkspace, useToast } from '../context';
import { Drawer } from './ui/Modal';
import { Button } from './ui/Button';
import { StatusBadge } from './ui/StatusBadge';

interface InventoryDetailDrawerProps {
  item: { item_type: string; item_id: string; name?: string };
  onClose: () => void;
  onAdjust?: (item: any) => void;
  onTransfer?: (item: any) => void;
}

export function InventoryDetailDrawer({
  item,
  onClose,
  onAdjust,
  onTransfer
}: InventoryDetailDrawerProps) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.get(`/api/inventory/${item.item_type}/${item.item_id}/details`)
      .then((res) => {
        if (isMounted) setDetail(res.data);
      })
      .catch((err) => {
        console.error('Failed to load inventory item details:', err);
        toast(err.response?.data?.error || 'Failed to load item details', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item.item_type, item.item_id]);

  const copyId = () => {
    if (!item.item_id) return;
    navigator.clipboard.writeText(item.item_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const typeLabels: Record<string, { label: string; color: string; border: string; bg: string }> = {
    raw_material: { label: 'Raw Material', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50' },
    finished_good: { label: 'Finished Good', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
    wip: { label: 'Work In Progress (WIP)', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50' }
  };

  const typeInfo = typeLabels[detail?.item_type || item.item_type] || {
    label: (detail?.item_type || item.item_type).replace('_', ' '),
    color: 'text-slate-700',
    border: 'border-slate-200',
    bg: 'bg-slate-50'
  };

  return (
    <Drawer
      title={detail?.name || item.name || 'Inventory Item Details'}
      onClose={onClose}
    >
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Fetching live inventory details & ledger...</p>
        </div>
      ) : detail ? (
        <div className="space-y-5 pb-6">
          {/* Header Asset Valuation Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white space-y-4 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${typeInfo.border} ${typeInfo.bg} ${typeInfo.color}`}>
                <Boxes size={12} />
                {typeInfo.label}
              </span>

              <div className="flex items-center gap-2">
                <StatusBadge status={detail.status} />
                <button
                  type="button"
                  onClick={copyId}
                  className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg transition"
                  title="Copy Item ID"
                >
                  {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{String(detail.item_id).slice(0, 8)}...</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Total Stock Valuation (At Cost)
              </span>
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {formatCurrency(detail.value_at_cost || 0, workspace?.currency)}
              </div>
              {detail.item_type === 'finished_good' && detail.selling_price > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <TrendingUp size={13} />
                  <span>Potential Sales Revenue: <strong>{formatCurrency(detail.potential_revenue || 0, workspace?.currency)}</strong></span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Current Stock Balance</span>
                  <strong className="text-white font-semibold text-sm">
                    {detail.item_type === 'finished_good' && detail.packaging_summary && Number(detail.current_stock) > 0 ? (
                      <span>
                        {detail.packaging_summary}
                        <span className="text-xs font-normal text-slate-400 block font-mono">({formatNumber(detail.current_stock, 0)} {detail.unit})</span>
                      </span>
                    ) : detail.packaged_stock != null && Number(detail.current_stock) > 0 ? (
                      <span>
                        {formatNumber(detail.packaged_stock, 0)} {detail.package_name || detail.package_unit}
                        {Number(detail.loose_stock || 0) > 0 ? ` + ${formatNumber(detail.loose_stock, 0)} ${detail.unit}` : ''}
                        <span className="text-xs font-normal text-slate-400 block font-mono">({formatNumber(detail.current_stock, 0)} {detail.unit})</span>
                      </span>
                    ) : (
                      `${formatNumber(detail.current_stock, 0)} ${detail.unit}`
                    )}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Storage Location</span>
                  <strong className="text-white font-semibold">
                    {detail.location_name || 'Main Warehouse'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Key Rates & Threshold Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <Tag size={12} className="text-blue-600" />
                  {detail.item_type === 'raw_material' ? 'Weighted Avg Cost (WAC)' : 'Unit Cost (Cost Basis)'}
                </span>
                {detail.item_type === 'raw_material' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                    WAC
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {detail.package_unit_cost != null && detail.package_name ? (
                  <>
                    {formatCurrency(detail.package_unit_cost, workspace?.currency)}
                    <span className="text-[11px] font-normal text-slate-500 block">
                      ({formatCurrency(detail.unit_cost, workspace?.currency)} / {detail.unit})
                    </span>
                  </>
                ) : (
                  `${formatCurrency(detail.unit_cost, workspace?.currency)} / ${detail.unit}`
                )}
              </p>
              {detail.item_type === 'raw_material' && (
                <span className="text-[10px] text-slate-400 block">
                  Blended rate across vendor purchases
                </span>
              )}
            </div>

            <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <AlertCircle size={12} className="text-amber-600" /> Reorder Level Threshold
              </span>
              <p className="text-sm font-bold text-slate-900 font-mono">
                {detail.reorder_level != null ? (
                  `${formatNumber(detail.reorder_level)} ${detail.unit}`
                ) : (
                  <span className="text-slate-400 font-normal italic">Not configured</span>
                )}
              </p>
            </div>
          </div>

          {/* Multi-Vendor Costing & Procurement Breakdown (For Raw Materials) */}
          {detail.item_type === 'raw_material' && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Store size={14} className="text-blue-600" />
                  Multi-Vendor Pricing & Weighted Costing (WAC)
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  Weighted Average Costing
                </span>
              </div>

              {/* Explanatory Banner */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Info size={13} className="text-blue-600 shrink-0" />
                  <span>How different vendor prices are handled:</span>
                </div>
                <p className="leading-relaxed">
                  When raw materials are purchased from different vendors at different rates, inventory valuation and production recipe consumption automatically use the <strong>Volume-Weighted Average Cost (WAC)</strong>. Every unit in stock is valued at this blended average cost, ensuring accurate asset valuation and recipe profit margins.
                </p>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Current WAC</span>
                  <strong className="font-mono text-sm text-blue-950 font-bold block mt-0.5">
                    {formatCurrency(detail.weighted_avg_cost || detail.unit_cost, workspace?.currency)}
                  </strong>
                  <span className="text-[9px] text-slate-500">Valuation rate</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">Last Purchase</span>
                  <strong className="font-mono text-sm text-slate-900 font-bold block mt-0.5">
                    {formatCurrency(detail.last_purchase_price || detail.vendor_pricing_summary?.last_purchase_price || detail.unit_cost, workspace?.currency)}
                  </strong>
                  <span className="text-[9px] text-slate-500">Most recent rate</span>
                </div>

                <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Lowest Rate</span>
                  <strong className="font-mono text-sm text-emerald-900 font-bold block mt-0.5">
                    {formatCurrency(detail.min_purchase_price || detail.vendor_pricing_summary?.min_price || detail.unit_cost, workspace?.currency)}
                  </strong>
                  <span className="text-[9px] text-slate-500">Best price paid</span>
                </div>

                <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Highest Rate</span>
                  <strong className="font-mono text-sm text-amber-900 font-bold block mt-0.5">
                    {formatCurrency(detail.max_purchase_price || detail.vendor_pricing_summary?.max_price || detail.unit_cost, workspace?.currency)}
                  </strong>
                  <span className="text-[9px] text-slate-500">Max price paid</span>
                </div>
              </div>

              {/* Vendor Purchases List */}
              {detail.vendor_purchases && detail.vendor_purchases.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Receipt size={12} className="text-slate-500" />
                      Vendor Procurement Purchases ({detail.vendor_purchases.length})
                    </span>
                    {detail.vendor_pricing_summary?.distinct_vendors_count > 0 && (
                      <span className="text-[10px] font-normal text-slate-500">
                        {detail.vendor_pricing_summary.distinct_vendors_count} distinct {detail.vendor_pricing_summary.distinct_vendors_count === 1 ? 'vendor' : 'vendors'}
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                          <th className="text-left px-3 py-2">Date</th>
                          <th className="text-left px-3 py-2">Vendor</th>
                          <th className="text-left px-3 py-2">PO #</th>
                          <th className="text-right px-3 py-2">Quantity</th>
                          <th className="text-right px-3 py-2">Rate / Unit</th>
                          <th className="text-right px-3 py-2">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {detail.vendor_purchases.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-[11px]">
                              {formatDate(p.date)}
                            </td>
                            <td className="px-3 py-2 text-slate-900 font-sans font-medium whitespace-nowrap text-[11px]">
                              {p.vendor_name}
                            </td>
                            <td className="px-3 py-2 text-blue-700 whitespace-nowrap text-[11px]">
                              {p.procurement_number || '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-800 whitespace-nowrap text-[11px]">
                              {formatNumber(p.quantity)} {detail.unit}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap text-[11px]">
                              {formatCurrency(p.rate_per_unit, workspace?.currency)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-blue-700 whitespace-nowrap text-[11px]">
                              {formatCurrency(p.total_amount || (Number(p.quantity) * Number(p.rate_per_unit)), workspace?.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Packaging Configurations Card (For Finished Goods) */}
          {detail.packaging_options && detail.packaging_options.length > 0 && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" />
                  Packaging Configurations & Conversions
                </h4>
                <span className="text-[10px] text-slate-400">Available packaging units</span>
              </div>

              <div className="space-y-2">
                {detail.packaging_options.map((pkg: any) => {
                  const isInStock = Number(pkg.packaged_stock || 0) > 0;
                  return (
                    <div key={pkg.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${isInStock ? 'bg-emerald-50/40 border-emerald-200/80' : 'bg-slate-50 border-slate-200/80 opacity-75'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-bold block">{pkg.package_name}</strong>
                          {isInStock ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              In Stock
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-200/80 text-slate-500">
                              0 in Stock
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          1 {pkg.package_unit || 'pack'} = {formatNumber(pkg.units_per_package)} {detail.unit}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className={`font-bold font-mono text-sm block ${isInStock ? 'text-emerald-800' : 'text-slate-400'}`}>
                          {formatNumber(pkg.packaged_stock, 0)} {pkg.package_unit || 'pkgs'}
                        </span>
                        {pkg.selling_price > 0 && (
                          <span className="text-[11px] text-slate-500 block">
                            Price: {formatCurrency(pkg.selling_price, workspace?.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {Number(detail.loose_stock || 0) > 0 && (
                  <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-200/80 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <strong className="text-slate-900 font-bold block">Loose Bulk (Unpackaged)</strong>
                      <span className="text-slate-500 text-[11px]">Unbottled finished inventory</span>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-800 font-bold font-mono text-sm block">
                        {formatNumber(detail.loose_stock, 0)} {detail.unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location Breakdown Card */}
          {detail.locations && detail.locations.length > 0 && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Building size={14} className="text-blue-600" />
                Location Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {detail.locations.map((loc: any) => (
                  <div key={loc.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <span className="text-[11px] font-semibold text-slate-600 block truncate">
                      {loc.name} {loc.is_default ? '(Default)' : ''}
                    </span>
                    <strong className="text-slate-900 font-bold font-mono text-sm">
                      {formatNumber(loc.stock)} {detail.unit}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Movement Summary */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-2 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowLeftRight size={14} className="text-blue-600" />
              Stock Movement Summary
            </h4>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 uppercase">
                  <ArrowDownLeft size={12} /> Total In
                </div>
                <div className="text-xs font-black text-emerald-900 font-mono mt-0.5">
                  {formatNumber(detail.total_in || 0)} {detail.unit}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-700 uppercase">
                  <ArrowUpRight size={12} /> Consumed / Sold
                </div>
                <div className="text-xs font-black text-amber-900 font-mono mt-0.5">
                  {formatNumber((detail.used_in_production || 0) + (detail.sold_in_sales || 0))} {detail.unit}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-[10px] font-bold text-blue-700 uppercase">Net Stock</div>
                <div className="text-xs font-black text-blue-900 font-mono mt-0.5">
                  {formatNumber(detail.current_stock || 0)} {detail.unit}
                </div>
              </div>
            </div>
          </div>

          {/* Recent History / Ledger */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600" />
              Recent Ledger Movements
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {detail.history && detail.history.length > 0 ? (
                detail.history.map((tx: any) => {
                  const isIn = tx.transaction_type === 'in';
                  return (
                    <div key={tx.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {isIn ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                          {tx.transaction_type} {formatNumber(tx.quantity)} {detail.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDate(tx.date || tx.created_at)}
                        </span>
                      </div>

                      <div className="text-slate-600 text-[11px]">
                        {tx.reference_note || tx.reason || 'Inventory Transaction'}
                        {tx.unit_cost > 0 && (
                          <span className="text-slate-400 ml-1 font-mono">
                            (@ {formatCurrency(tx.unit_cost, workspace?.currency)}/{detail.unit})
                          </span>
                        )}
                      </div>

                      {tx.user_name && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span>Logged by:</span>
                          <strong className="text-slate-700">{tx.user_name}</strong>
                          {tx.location_name && <span>• {tx.location_name}</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 italic py-2">No transaction history recorded yet.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {onTransfer && (
                <Button
                  type="button"
                  variant="secondary"
                  icon={<ArrowLeftRight size={14} className="text-emerald-600" />}
                  onClick={() => onTransfer(detail)}
                >
                  Transfer
                </Button>
              )}
              {onAdjust && (
                <Button
                  type="button"
                  variant="secondary"
                  icon={<SlidersHorizontal size={14} className="text-amber-600" />}
                  onClick={() => onAdjust(detail)}
                >
                  Adjust Stock
                </Button>
              )}
            </div>

            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Unable to find inventory details.</p>
        </div>
      )}
    </Drawer>
  );
}
