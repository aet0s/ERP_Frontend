export function StatusBadge({ status }: { status?: string }) {
  const raw = String(status || 'OK');
  const norm = raw.toLowerCase().replace(/[\s_]+/g, '-');
  
  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  if (['paid', 'ok', 'active', 'owner', 'received', 'goods-received', 'delivered', 'stock-received', 'completed'].includes(norm)) {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  } else if (['dispatched', 'dispatched-by-vendor', 'in-transit', 'shipped', 'in-progress'].includes(norm)) {
    styles = 'bg-blue-50 text-blue-700 border-blue-200/80';
  } else if (['confirmed', 'confirmed-by-vendor', 'vendor-confirmed', 'confirmed-by-customer'].includes(norm)) {
    styles = 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
  } else if (['partially-paid', 'low', 'trial', 'manager', 'final', 'pending', 'pending-vendor-confirmation', 'sent-to-vendor', 'ordered', 'draft', 'pending-approval', 'open'].includes(norm)) {
    styles = 'bg-amber-50 text-amber-700 border-amber-200/80';
  } else if (['return-requested', 'returned', 'return-pending', 'sales-return', 'return-rejected'].includes(norm)) {
    styles = 'bg-rose-50 text-rose-700 border-rose-200/80 font-bold';
  } else if (['unpaid', 'out', 'suspended', 'staff', 'rejected', 'rejected-by-vendor', 'declined', 'cancelled', 'canceled', 'denied'].includes(norm)) {
    styles = 'bg-red-50 text-red-700 border-red-200/80';
  }

  const displayLabel = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${styles}`}>
      {displayLabel || 'OK'}
    </span>
  );
}

