import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  size = 'md'
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const maxWidthCls = wide || size === 'xl'
    ? 'max-w-4xl'
    : size === 'lg'
    ? 'max-w-3xl'
    : size === 'sm'
    ? 'max-w-md'
    : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className={`w-full max-h-[90vh] flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden ${maxWidthCls}`}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
          <IconButton label="Close" icon={<X size={18} />} onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Drawer({
  title,
  children,
  onClose,
  width = 'max-w-xl sm:max-w-2xl'
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <aside className={`w-full ${width} h-full flex flex-col bg-white border-l border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200`}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{title}</h2>
          <IconButton label="Close" icon={<X size={18} />} onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </aside>
    </div>
  );
}
