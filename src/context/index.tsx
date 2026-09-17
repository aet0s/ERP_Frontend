import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import type { Workspace, UserSummary } from '../lib/types';

// ─── Toast ───────────────────────────────────────────────────────────────────

export const ToastContext = createContext<
  (message: string, variant?: 'success' | 'error' | 'info') => void
>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

// ─── Confirm Dialog Options & Context ────────────────────────────────────────

export interface ConfirmOptions {
  title?: string;
  message: string;
  tone?: 'danger' | 'warning' | 'info' | 'primary';
  confirmText?: string;
  cancelText?: string;
}

export type ConfirmFunction = (
  options: string | ConfirmOptions
) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFunction>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export const WorkspaceContext = createContext<{
  workspace: Workspace | null;
  user?: UserSummary | null;
  reloadWorkspace: () => Promise<void>;
}>({ workspace: null, user: null, reloadWorkspace: async () => undefined });

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function useUser() {
  const { user } = useContext(WorkspaceContext);
  return user;
}

// ─── Providers ───────────────────────────────────────────────────────────────

export function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; variant: string }[]>([]);
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    message: string;
    tone: 'danger' | 'warning' | 'info' | 'primary';
    confirmText: string;
    cancelText: string;
    resolve: (value: boolean) => void;
  }>(null);

  const toast = (message: string, variant: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, variant }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600);
  };

  const ask: ConfirmFunction = (options) => {
    return new Promise<boolean>((resolve) => {
      if (typeof options === 'string') {
        setConfirmState({
          title: 'Confirmation',
          message: options,
          tone: 'danger',
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          resolve
        });
      } else {
        setConfirmState({
          title: options.title || 'Are you sure?',
          message: options.message,
          tone: options.tone || 'danger',
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          resolve
        });
      }
    });
  };

  const toastVariantStyles: Record<string, string> = {
    success: 'border-l-4 border-l-emerald-500 text-slate-800',
    error: 'border-l-4 border-l-red-500 text-slate-800',
    info: 'border-l-4 border-l-blue-500 text-slate-800'
  };

  const getToneIcon = (tone: string) => {
    switch (tone) {
      case 'danger':
        return (
          <div className="w-12 h-12 rounded-2xl bg-red-100/80 border border-red-200 flex items-center justify-center text-red-600 shadow-sm shrink-0">
            <AlertTriangle size={24} />
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm shrink-0">
            <AlertCircle size={24} />
          </div>
        );
      case 'info':
        return (
          <div className="w-12 h-12 rounded-2xl bg-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
            <Info size={24} />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-indigo-100/80 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <CheckCircle2 size={24} />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = (tone: string) => {
    switch (tone) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20';
      default:
        return 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20';
    }
  };

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={ask}>
        {children}

        {/* Global Toast Stack */}
        <div className="fixed right-5 bottom-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
          {toasts.map((toastItem) => (
            <div
              key={toastItem.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-lg shadow-slate-900/5 text-sm font-medium ${toastVariantStyles[toastItem.variant] || ''}`}
            >
              <span>{toastItem.message}</span>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                onClick={() => setToasts((items) => items.filter((item) => item.id !== toastItem.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Global Custom Confirmation Popup Dialog */}
        {confirmState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                {getToneIcon(confirmState.tone)}
                <div className="space-y-1.5 flex-1 pr-2">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {confirmState.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {confirmState.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    confirmState.resolve(false);
                    setConfirmState(null);
                  }}
                  className="px-4 py-2 font-medium text-slate-700"
                >
                  {confirmState.cancelText}
                </Button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    confirmState.resolve(true);
                    setConfirmState(null);
                  }}
                  className={`px-5 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${getConfirmButtonClasses(confirmState.tone)}`}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
