import { formatCurrency, formatNumber } from '../../lib/utils';

export function SummaryStrip({
  summary,
  currencyCode
}: {
  summary?: Record<string, any>;
  currencyCode: string;
}) {
  if (!summary || Object.keys(summary).length === 0) return null;
  const labels: Record<string, string> = {
    total_amount: 'Total',
    amount_paid: 'Paid',
    amount_due: 'Due',
    amount_received: 'Received',
    total_quantity: 'Qty',
    output_quantity: 'Output',
    input_quantity: 'Input',
    total_value: 'Value',
    total_items: 'Total Items',
    low_count: 'Alerts'
  };
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 border-b border-slate-200/80 overflow-x-auto">
      {Object.entries(summary)
        .slice(0, 5)
        .map(([key, value]) => (
          <div key={key} className="min-w-[130px] p-2.5 bg-white border border-slate-200/90 rounded-lg shadow-2xs">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {labels[key] || key.replace(/_/g, ' ')}
            </span>
            <strong className="text-base font-bold text-slate-900 mt-0.5 block">
              {key.includes('amount') || key.includes('value')
                ? formatCurrency(value, currencyCode)
                : formatNumber(value)}
            </strong>
          </div>
        ))}
    </div>
  );
}
