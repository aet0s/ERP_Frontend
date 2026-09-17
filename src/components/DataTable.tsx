import { useEffect, useRef, useState } from 'react';
import { DatePicker } from './ui/DatePicker';
import type { ReactNode } from 'react';
import {
  Calendar,
  ChevronsUpDown,
  Download,
  Edit3,
  Filter,
  Plus,
  Search,
  Trash2,
  View,
  X
} from 'lucide-react';
import { useConfirm } from '../context';
import { useToast } from '../context';
import { useWorkspace } from '../context';
import { api } from '../lib/api';
import { csvDownload, readList } from '../lib/utils';
import type { AnyRow, ListMeta, TableColumn } from '../lib/types';
import { Button, IconButton } from './ui/Button';
import { EmptyState } from './ui/PageTitle';
import { SummaryStrip } from './ui/SummaryStrip';
import { DetailDrawer } from './DetailDrawer';
import { Pagination } from './ui/Pagination';

export function DataTable<T extends AnyRow>({
  endpoint,
  columns,
  filters = {},
  refreshKey = 0,
  showDateFilters = false,
  onView,
  onEdit,
  onDelete,
  onCreate,
  createLabel = 'Create',
  emptyTitle = 'No records yet',
  extraFilters,
  onExport,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canExport = true,
  rowId = (row) => row.id || JSON.stringify(row)
}: {
  endpoint: string;
  columns: TableColumn<T>[];
  filters?: Record<string, any>;
  refreshKey?: number;
  showDateFilters?: boolean;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => Promise<void>;
  onCreate?: () => void;
  createLabel?: string;
  emptyTitle?: string;
  extraFilters?: ReactNode;
  onExport?: (ctx: { selectedRows: T[]; selectAllAcrossPages: boolean; total: number; getExportData: () => Promise<T[]> }) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  rowId?: (row: T) => string;
}) {
  const { workspace } = useWorkspace();
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ page: 1, page_size: 20, total: 0, total_pages: 1 });
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pageSize] = useState(20);
  const [sortBy, setSortBy] = useState(
    columns.find((column) => column.sortable)?.key || columns[0]?.key || 'date'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllAcrossPages, setSelectAllAcrossPages] = useState(false);
  const [drawerRow, setDrawerRow] = useState<T | null>(null);
  const [exporting, setExporting] = useState(false);

  const currentPageRef = useRef(meta.page);
  currentPageRef.current = meta.page;
  const isFirstRender = useRef(true);
  const prevRefreshKey = useRef(refreshKey);

  const fetchRows = async (page = currentPageRef.current) => {
    setLoading(true);
    try {
      const response = await api.get(endpoint, {
        params: {
          table: 1,
          page,
          page_size: pageSize,
          sort_by: sortBy,
          sort_order: sortOrder,
          search: search || undefined,
          start_date: showDateFilters ? startDate || undefined : undefined,
          end_date: showDateFilters ? endDate || undefined : undefined,
          ...Object.fromEntries(
            Object.entries(filters).filter(
              ([, value]) => value !== '' && value !== null && typeof value !== 'undefined'
            )
          )
        }
      });
      const envelope = readList<T>(response.data);
      // If current page is beyond total pages (e.g. items were removed/approved), smoothly re-fetch last page
      if (envelope.items.length === 0 && page > 1 && envelope.meta.total > 0 && envelope.meta.total_pages < page) {
        fetchRows(envelope.meta.total_pages);
        return;
      }
      setRows(envelope.items);
      setMeta(envelope.meta);
      setSummary(envelope.summary || {});
      setSelected(new Set());
      setSelectAllAcrossPages(false);
    } catch (error: any) {
      toast(error.response?.data?.error || 'Unable to load records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (onExport) {
      const isAll = selectAllAcrossPages || selected.size === 0 || selected.size === meta.total;
      onExport({
        selectedRows,
        selectAllAcrossPages,
        total: isAll ? (meta.total || rows.length) : selectedRows.length,
        getExportData: async () => {
          if (isAll) {
            const response = await api.get(endpoint, {
              params: {
                table: 1,
                page: 1,
                page_size: 10000,
                sort_by: sortBy,
                sort_order: sortOrder,
                search: search || undefined,
                start_date: showDateFilters ? startDate || undefined : undefined,
                end_date: showDateFilters ? endDate || undefined : undefined,
                ...Object.fromEntries(
                  Object.entries(filters).filter(
                    ([, value]) => value !== '' && value !== null && typeof value !== 'undefined'
                  )
                )
              }
            });
            const envelope = readList<T>(response.data);
            return envelope.items.length > 0 ? envelope.items : rows;
          }
          return selectedRows;
        }
      });
      return;
    }

    if (selectAllAcrossPages || selected.size === 0 || selected.size === meta.total) {
      // Export all records across all pages
      setExporting(true);
      try {
        toast(`Exporting all ${meta.total || rows.length} records...`, 'info');
        const response = await api.get(endpoint, {
          params: {
            table: 1,
            page: 1,
            page_size: 10000,
            sort_by: sortBy,
            sort_order: sortOrder,
            search: search || undefined,
            start_date: showDateFilters ? startDate || undefined : undefined,
            end_date: showDateFilters ? endDate || undefined : undefined,
            ...Object.fromEntries(
              Object.entries(filters).filter(
                ([, value]) => value !== '' && value !== null && typeof value !== 'undefined'
              )
            )
          }
        });
        const envelope = readList<T>(response.data);
        const allItems = envelope.items.length > 0 ? envelope.items : rows;
        csvDownload(`export_all_${new Date().toISOString().slice(0, 10)}.csv`, allItems, columns);
        toast(`✅ Exported ${allItems.length} records successfully!`, 'success');
      } catch (err: any) {
        csvDownload(`export_${new Date().toISOString().slice(0, 10)}.csv`, rows, columns);
      } finally {
        setExporting(false);
      }
    } else {
      // Export only selected rows
      csvDownload(`selected_records_${new Date().toISOString().slice(0, 10)}.csv`, selectedRows, columns);
      toast(`Exported ${selectedRows.length} selected records`, 'success');
    }
  };

  // Reset to page 1 on search, filter, date range, sort, or endpoint change
  useEffect(() => {
    fetchRows(1);
  }, [endpoint, JSON.stringify(filters), search, startDate, endDate, pageSize, sortBy, sortOrder]);

  // Hold current page when external refresh is triggered (after action / approve / reject / edit)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (prevRefreshKey.current !== refreshKey) {
      prevRefreshKey.current = refreshKey;
      fetchRows(currentPageRef.current);
    }
  }, [refreshKey]);

  const sort = (column: TableColumn<T>) => {
    if (!column.sortable) return;
    if (sortBy === column.key) setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(column.key);
      setSortOrder('asc');
    }
  };

  const doDelete = async (row: T) => {
    if (!onDelete) return;
    const ok = await confirm({
      title: 'Delete record?',
      message: 'This will soft delete the record and keep an audit trail.',
      tone: 'danger'
    });
    if (!ok) return;
    await onDelete(row);
    fetchRows(meta.page);
  };

  const selectedRows = rows.filter((row) => selected.has(rowId(row)));


  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Search & Filter Toolbar Header */}
      <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Executive Search Box */}
          <div className="relative flex-1 min-w-[280px] max-w-lg">
            <div className="flex items-center gap-2.5 bg-white border border-slate-300/90 rounded-xl px-3.5 py-2 shadow-2xs focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-150">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by keywords, reference, notes..."
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Page Actions & Export */}
          <div className="flex items-center gap-2 shrink-0">
            {canExport && (
              selectedRows.length > 0 ? (
                <Button
                  variant="secondary"
                  icon={<Download size={15} />}
                  disabled={exporting}
                  onClick={handleExport}
                >
                  Export {selectAllAcrossPages ? `All (${meta.total})` : `Selected (${selectedRows.length})`}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon={<Download size={15} />}
                  disabled={exporting || rows.length === 0}
                  onClick={handleExport}
                >
                  Export All ({meta.total || rows.length})
                </Button>
              )
            )}

            {onCreate && canCreate ? (
              <Button icon={<Plus size={15} />} onClick={onCreate}>
                {createLabel}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Filter Controls Row (rendered only when filters exist) */}
        {extraFilters || showDateFilters ? (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
              <Filter size={13} className="text-slate-400" />
              <span>Filters:</span>
            </div>

            {extraFilters}

            {showDateFilters ? (
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
                <Calendar size={13} className="text-slate-500 ml-1.5 shrink-0" />
                <div className="w-36">
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Start Date" />
                </div>
                <span className="text-slate-400 text-xs font-medium px-0.5">to</span>
                <div className="w-36">
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="End Date" />
                </div>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 transition cursor-pointer"
                    title="Clear date filter"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <SummaryStrip summary={summary} currencyCode={workspace?.currency || 'USD'} />

      {/* Multi-Page Selection Banner */}
      {rows.length > 0 && selected.size === rows.length && meta.total > rows.length && (
        <div className="bg-blue-50 border-y border-blue-200/80 px-4 py-2 text-xs text-blue-900 flex items-center justify-between">
          <span>
            {selectAllAcrossPages
              ? `✅ All ${meta.total} records across all pages are selected for bulk action/export.`
              : `All ${rows.length} records on this page are selected.`}
          </span>
          {selectAllAcrossPages ? (
            <button
              type="button"
              onClick={() => { setSelectAllAcrossPages(false); setSelected(new Set()); }}
              className="text-blue-700 font-bold hover:underline cursor-pointer ml-2"
            >
              Clear selection
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectAllAcrossPages(true)}
              className="text-blue-700 font-bold hover:underline cursor-pointer ml-2"
            >
              Select all {meta.total} records across all pages
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] uppercase font-bold tracking-wider text-slate-600">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={selectAllAcrossPages || (rows.length > 0 && selected.size === rows.length)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelected(new Set(rows.map((row) => rowId(row))));
                    } else {
                      setSelected(new Set());
                      setSelectAllAcrossPages(false);
                    }
                  }}
                />
              </th>
              <th className="p-3 w-12 text-center text-slate-500 font-bold" title="Serial Number">
                #
              </th>
              {columns.map((column) => (
                <th key={column.key} className={`p-3 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 font-bold hover:text-slate-900 transition cursor-pointer disabled:cursor-default"
                    onClick={() => sort(column)}
                    disabled={!column.sortable}
                  >
                    <span>{column.label}</span>
                    {column.sortable ? <ChevronsUpDown size={13} className="text-slate-400" /> : null}
                  </button>
                </th>
              ))}
              {columns.length > 0 ? <th className="p-3 text-right w-32">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={columns.length + 3} className="p-3">
                    <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3}>
                  <EmptyState
                    title={emptyTitle}
                    action={
                      onCreate ? (
                        <Button icon={<Plus size={16} />} onClick={onCreate}>
                          {createLabel}
                        </Button>
                      ) : null
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const srNo = ((meta.page - 1) * pageSize) + index + 1;
                return (
                  <tr key={rowId(row)} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selected.has(rowId(row))}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(rowId(row));
                          else next.delete(rowId(row));
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-3 text-center font-mono text-xs text-slate-400 font-medium select-none">
                      {srNo}
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className={`p-3 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
                        {column.render ? column.render(row) : String(row[column.key] ?? '')}
                      </td>
                    ))}
                  <td className="p-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <IconButton
                        label="View Details"
                        icon={<View size={15} />}
                        onClick={() => onView ? onView(row) : setDrawerRow(row)}
                      />
                      {onEdit && canEdit ? (
                        <IconButton
                          label="Edit"
                          icon={<Edit3 size={15} />}
                          onClick={() => onEdit(row)}
                        />
                      ) : null}
                      {onDelete && canDelete ? (
                        <IconButton
                          label="Delete"
                          icon={<Trash2 size={15} />}
                          variant="danger"
                          onClick={() => doDelete(row)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>
        </table>
      </div>

      {/* Global Pagination Component */}
      <Pagination
        currentPage={meta.page}
        totalItems={meta.total}
        pageSize={20}
        onPageChange={(p) => fetchRows(p)}
      />
      {drawerRow ? (
        <DetailDrawer
          endpoint={`${endpoint}/${(drawerRow as any).id}`}
          title="Record Details"
          onClose={() => setDrawerRow(null)}
        />
      ) : null}
    </section>
  );
}
