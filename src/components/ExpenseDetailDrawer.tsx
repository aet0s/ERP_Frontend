import { useEffect, useState } from 'react';
import {
  AlertCircle, Calendar, Tag, FileText, User, Clock,
  Edit3, Trash2, Copy, CheckCircle2, Building
} from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { useWorkspace, useToast, useConfirm } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { Drawer } from './ui/Modal';
import { Button } from './ui/Button';

interface ExpenseDetailDrawerProps {
  expenseId: string;
  onClose: () => void;
  onEdit?: (expense: any) => void;
  onDeleted?: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  labor: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  transport: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  electricity: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  rent: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  maintenance: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  other: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' }
};

export function ExpenseDetailDrawer({
  expenseId,
  onClose,
  onEdit,
  onDeleted
}: ExpenseDetailDrawerProps) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const confirm = useConfirm();
  const { canEdit, canDelete } = usePermissions('expenses');

  const [expense, setExpense] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.get(`/api/expenses/${expenseId}`)
      .then((res) => {
        if (isMounted) setExpense(res.data);
      })
      .catch((err) => {
        toast(err.response?.data?.error || 'Failed to load expense details', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [expenseId]);

  const copyId = () => {
    navigator.clipboard.writeText(expense?.id || expenseId);
    setCopied(true);
    toast('Expense ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Expense Record?',
      message: `Are you sure you want to permanently delete this expense of ${formatCurrency(expense?.amount || 0, workspace?.currency)}? This action cannot be undone.`,
      tone: 'danger',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/expenses/${expenseId}`);
      toast('Expense deleted successfully', 'success');
      onDeleted?.();
      onClose();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to delete expense', 'error');
    }
  };

  const catStyle = CATEGORY_COLORS[expense?.category?.toLowerCase()] || CATEGORY_COLORS.other;

  return (
    <Drawer title="Expense Details" onClose={onClose}>
      {loading ? (
        <div className="space-y-4 animate-pulse p-4">
          <div className="h-32 bg-slate-100 rounded-3xl" />
          <div className="h-24 bg-slate-100 rounded-2xl" />
          <div className="h-40 bg-slate-100 rounded-2xl" />
        </div>
      ) : expense ? (
        <div className="space-y-5">
          {/* Header Card: Amount & Category Hero */}
          <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${catStyle.border} ${catStyle.bg} ${catStyle.text}`}>
                <Tag size={12} />
                {expense.category || 'Expense'}
              </span>

              <button
                type="button"
                onClick={copyId}
                className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg transition"
                title="Copy Reference ID"
              >
                {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{String(expense.id).slice(0, 8)}...</span>
              </button>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Total Expenditure Amount
              </span>
              <div className="text-3xl font-black text-white tracking-tight font-mono">
                {formatCurrency(expense.amount || 0, workspace?.currency)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Expense Date</span>
                  <strong className="text-white font-semibold">{formatDate(expense.date)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Building size={14} className="text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Accounted Period</span>
                  <strong className="text-white font-semibold">
                    {new Date(expense.date || expense.created_at).toLocaleString('default', { month: 'short', year: 'numeric' })}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Key Attributes Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <Tag size={12} className="text-blue-600" /> Category
              </span>
              <p className="text-sm font-bold text-slate-900 capitalize">
                {expense.category || 'General'}
              </p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                <User size={12} className="text-blue-600" /> Logged By
              </span>
              <p className="text-sm font-bold text-slate-900 truncate" title={expense.created_by_name || 'Workspace Owner'}>
                {expense.created_by_name || 'Workspace Owner'}
              </p>
              {expense.created_by_email && (
                <p className="text-[11px] text-slate-400 truncate" title={expense.created_by_email}>
                  {expense.created_by_email}
                </p>
              )}
            </div>
          </div>

          {/* Notes / Remarks Card */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-2 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              Notes & Description
            </h4>
            {expense.notes ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100">
                {expense.notes}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                No description or notes provided for this expense.
              </p>
            )}
          </div>

          {/* Activity / Audit History */}
          {expense.timeline && expense.timeline.length > 0 && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-blue-600" />
                Audit Trail & History
              </h4>
              <div className="space-y-2">
                {expense.timeline.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 truncate">{item.user_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(item.created_at || item.date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{item.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            {canDelete ? (
              <Button
                type="button"
                variant="secondary"
                icon={<Trash2 size={15} className="text-red-600" />}
                onClick={handleDelete}
                className="hover:bg-red-50 hover:border-red-200 hover:text-red-700"
              >
                Delete
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
              >
                Close
              </Button>

              {canEdit && onEdit && (
                <Button
                  type="button"
                  icon={<Edit3 size={15} />}
                  onClick={() => onEdit(expense)}
                >
                  Edit Expense
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Unable to find expense details.</p>
        </div>
      )}
    </Drawer>
  );
}
