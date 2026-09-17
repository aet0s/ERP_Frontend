import type { ReactNode } from 'react';

export function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 w-full">
      <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-600">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
      {error && <span className="text-xs text-rose-500 font-medium animate-in fade-in duration-200">{error}</span>}
    </label>
  );
}
