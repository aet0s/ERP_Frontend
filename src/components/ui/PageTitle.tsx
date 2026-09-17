import type { ReactNode } from 'react';
import { Package2 } from 'lucide-react';

export function PageTitle({
  icon,
  title,
  subtitle,
  action
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-blue-600 grid place-items-center text-white shadow-sm shadow-blue-500/20 shrink-0">
          {icon}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle ? <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex items-center gap-2.5 shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="min-h-[160px] flex flex-col items-center justify-center p-8 gap-3 text-center text-slate-400">
      <Package2 size={32} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {action}
    </div>
  );
}
