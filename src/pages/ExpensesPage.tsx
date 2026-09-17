import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Check, CircleDollarSign } from 'lucide-react';
import { api } from '../lib/api';
import { useToast, useWorkspace } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, dateIso, formatDate } from '../lib/utils';
import { DatePicker } from '../components/ui/DatePicker';
import type { AnyRow, TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { ExpenseDetailDrawer } from '../components/ExpenseDetailDrawer';
import { PageTitle } from '../components/ui/PageTitle';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';

function EditExpenseModal({
  expense,
  onClose,
  onSaved
}: {
  expense: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    category: expense.category || 'other',
    amount: String(expense.amount ?? ''),
    date: String(expense.date || '').slice(0, 10),
    notes: expense.notes || ''
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/api/expenses/${expense.id}`, { ...form, amount: Number(form.amount) });
      toast('Expense updated successfully');
      onSaved();
      onClose();
    } catch (err: any) {
      toast(err.response?.data?.error || 'Unable to update expense', 'error');
    }
  };

  const inputCls = "w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <Modal title="Edit Expense" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Category">
          <Select
            value={form.category}
            onChange={(val) => setForm({ ...form, category: val })}
            options={['labor', 'transport', 'electricity', 'rent', 'maintenance', 'other'].map(cat => ({ value: cat, label: cat }))}
          />
        </Field>
        <Field label="Amount">
          <input className={inputCls} required inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Date">
          <input className={inputCls} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Notes">
          <input className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" icon={<Check size={16} />}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ExpensesPage() {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const { canView, canCreate, canEdit, canDelete, canExport } = usePermissions('expenses');
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState({ category: '' });
  const [detail, setDetail] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ category: 'other', amount: '', date: dateIso(), notes: '' });
  const [nextExpenseNumber, setNextExpenseNumber] = useState<string>('');

  useEffect(() => {
    api.get('/api/numbering-series/next/expense')
      .then((res) => {
        if (res?.data?.next_code) {
          setNextExpenseNumber(res.data.next_code);
        }
      })
      .catch(() => {});
  }, [refresh]);

  const submitNewExpense = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/api/expenses', { ...form, amount: Number(form.amount) });
      toast('Expense recorded successfully');
      setForm({ category: 'other', amount: '', date: dateIso(), notes: '' });
      setRefresh((value) => value + 1);
    } catch (error: any) {
      toast(error.response?.data?.error || 'Unable to record expense', 'error');
    }
  };

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Expenses module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  const columns: TableColumn<AnyRow>[] = [
    {
      key: 'expense_number',
      label: 'Voucher #',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {row.expense_number || `#${row.id}`}
        </span>
      )
    },
    { key: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right', render: (row) => formatCurrency(row.amount, workspace?.currency) },
    { key: 'notes', label: 'Note' }
  ];

  const formInputCls = "w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <div className="space-y-6">
      <PageTitle icon={<CircleDollarSign />} title="Expenses" subtitle="Track operating expenses with searchable history." />
      
      {/* Entry Panel for Recording New Expenses */}
      {canCreate && (
        <section className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Record New Expense</h2>
            {nextExpenseNumber && (
              <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                Next Voucher: <strong className="text-slate-900">{nextExpenseNumber}</strong>
              </span>
            )}
          </div>
          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end" onSubmit={submitNewExpense}>
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(val) => setForm({ ...form, category: val })}
                options={['labor', 'transport', 'electricity', 'rent', 'maintenance', 'other'].map((cat) => ({ value: cat, label: cat }))}
              />
            </Field>
            <Field label="Amount"><input className={formInputCls} required inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
            <Field label="Date"><DatePicker value={form.date} onChange={(val) => setForm({ ...form, date: val })} /></Field>
            <Field label="Notes"><input className={formInputCls} placeholder="Invoice details, supplier info..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            
            <div className="flex items-center gap-2">
              <Button type="submit" icon={<Check size={16} />}>Record Expense</Button>
            </div>
          </form>
        </section>
      )}

      {/* Expenses Data Table */}
      <DataTable
        endpoint="/api/expenses"
        columns={columns}
        filters={filters}
        refreshKey={refresh}
        showDateFilters={true}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        canExport={canExport}
        onView={(row) => setDetail(row.id || null)}
        onEdit={canEdit ? (row) => setEditing(row) : undefined}
        onDelete={canDelete ? async (row) => { await api.delete(`/api/expenses/${row.id}`); toast('Expense deleted'); } : undefined}
        emptyTitle="No expenses recorded yet"
        extraFilters={
          <div className="w-44">
            <Select
              value={filters.category}
              onChange={(val) => setFilters({ category: val })}
              options={[
                { value: '', label: 'All categories' },
                ...['labor', 'transport', 'electricity', 'rent', 'maintenance', 'other'].map((cat) => ({ value: cat, label: cat }))
              ]}
            />
          </div>
        }
      />

      {/* Edit Expense Popup Modal */}
      {editing && canEdit ? (
        <EditExpenseModal
          expense={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setRefresh((v) => v + 1)}
        />
      ) : null}

      {detail ? (
        <ExpenseDetailDrawer
          expenseId={detail}
          onClose={() => setDetail(null)}
          onEdit={canEdit ? (exp) => {
            setDetail(null);
            setEditing(exp);
          } : undefined}
          onDeleted={canDelete ? () => {
            setDetail(null);
            setRefresh((v) => v + 1);
          } : undefined}
        />
      ) : null}
    </div>
  );
}
