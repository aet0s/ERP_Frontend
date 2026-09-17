import { useState, useMemo } from 'react';
import {
  Download,
  Settings2
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatDate } from '../lib/utils';
import { useToast } from '../context';

interface ReportExportModalProps {
  reportName: string;
  reportKey: string;
  rows: any[];
  filteredRows: any[];
  searchKeyword?: string;
  dateRange: { start_date: string; end_date: string };
  onClose: () => void;
}

export function ReportExportModal({
  reportName,
  reportKey,
  rows,
  filteredRows,
  searchKeyword,
  dateRange,
  onClose
}: ReportExportModalProps) {
  const toast = useToast();

  // Extract all available column keys from data
  const availableColumns = useMemo(() => {
    const keySet = new Set<string>();
    const sample = rows.slice(0, 50);
    sample.forEach((r) => {
      if (r && typeof r === 'object') {
        Object.keys(r).forEach((k) => {
          // Ignore private/internal keys if any
          if (!k.startsWith('_') && k !== 'password' && k !== 'token') {
            keySet.add(k);
          }
        });
      }
    });

    const formatLabel = (key: string) => {
      const labels: Record<string, string> = {
        invoice_number: 'Invoice Number',
        procurement_number: 'Procurement #',
        po_number: 'Purchase Order #',
        bill_number: 'Bill Number',
        date: 'Date',
        created_at: 'Created Date',
        customer_name: 'Customer Name',
        vendor_name: 'Vendor Name',
        party_name: 'Party Name',
        item_name: 'Item / Product Name',
        item_code: 'Item Code / SKU',
        item_type: 'Item Type',
        category: 'Category',
        unit: 'Unit',
        quantity: 'Quantity',
        qty: 'Quantity',
        current_stock: 'Current Stock',
        reorder_level: 'Reorder Level',
        suggested_reorder_qty: 'Suggested Reorder Qty',
        preferred_vendor_name: 'Preferred Vendor',
        last_purchase_price: 'Last Purchase Price',
        rate: 'Rate / Unit Price',
        unit_price: 'Unit Price',
        taxable_value: 'Taxable Amount',
        taxable_amount: 'Taxable Amount',
        tax_rate: 'GST Rate (%)',
        cgst_amount: 'CGST Amount',
        sgst_amount: 'SGST Amount',
        igst_amount: 'IGST Amount',
        total_tax: 'Total Tax',
        tax_amount: 'Tax Amount',
        total_amount: 'Total Amount',
        line_total: 'Line Total',
        amount: 'Amount',
        status: 'Status',
        payment_status: 'Payment Status',
        notes: 'Notes / Remarks',
        reason: 'Reason'
      };

      if (labels[key]) return labels[key];
      return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    return Array.from(keySet).map((key) => ({
      id: key,
      label: formatLabel(key)
    }));
  }, [rows]);

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(availableColumns.map((c) => c.id))
  );

  const [exportScope, setExportScope] = useState<'all' | 'filtered'>(
    searchKeyword && filteredRows.length < rows.length ? 'filtered' : 'all'
  );

  const [exporting, setExporting] = useState(false);

  const toggleColumn = (id: string) => {
    const next = new Set(selectedColumns);
    if (next.has(id)) {
      if (next.size === 1) {
        toast('At least one column must be selected', 'info');
        return;
      }
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedColumns(next);
  };

  const selectAll = () => {
    setSelectedColumns(new Set(availableColumns.map((c) => c.id)));
  };

  const resetDefault = () => {
    // Select all non-internal keys
    setSelectedColumns(new Set(availableColumns.map((c) => c.id)));
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast('Please select at least one column', 'error');
      return;
    }

    setExporting(true);
    try {
      const recordsToExport = exportScope === 'filtered' ? filteredRows : rows;
      if (recordsToExport.length === 0) {
        toast('No records to export in the selected scope', 'info');
        return;
      }

      const activeCols = availableColumns.filter((c) => selectedColumns.has(c.id));

      const escapeCsv = (val: any) => {
        if (val === null || typeof val === 'undefined') return '';
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          return `"${formatDate(val)}"`;
        }
        if (typeof val === 'object') {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        const text = String(val);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };

      const headerLine = activeCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
      const dataLines = recordsToExport.map((row) =>
        activeCols.map((c) => escapeCsv(row[c.id])).join(',')
      );

      const csvContent = [headerLine, ...dataLines].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportKey}_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast(`✅ Exported ${recordsToExport.length} records with ${activeCols.length} columns!`, 'success');
      onClose();
    } catch (err: any) {
      toast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal title={`Export Report: ${reportName}`} onClose={onClose}>
      <div className="space-y-5 text-sm">
        {/* Scope Selection */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Export Scope
          </span>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
              exportScope === 'all'
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
            }`}>
              <input
                type="radio"
                name="reportExportScope"
                checked={exportScope === 'all'}
                onChange={() => setExportScope('all')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-xs">All Period Records</span>
                <span className="text-[11px] font-normal text-slate-500">{rows.length} records</span>
              </div>
            </label>

            <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
              exportScope === 'filtered'
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
            } ${filteredRows.length === rows.length ? 'opacity-70' : ''}`}>
              <input
                type="radio"
                name="reportExportScope"
                checked={exportScope === 'filtered'}
                onChange={() => setExportScope('filtered')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-xs">Filtered Search Results</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {filteredRows.length} records {searchKeyword ? `matching "${searchKeyword}"` : ''}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Column Selection Toolbar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 size={13} className="text-blue-600" />
                Select Columns to Export ({selectedColumns.size} / {availableColumns.length})
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Choose the fields you wish to include in your exported spreadsheet.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded font-medium transition cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={resetDefault}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded font-medium transition cursor-pointer"
              >
                Reset Default
              </button>
            </div>
          </div>

          {/* Grid of Columns Checkboxes */}
          <div className="max-h-64 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-3 bg-white">
            {availableColumns.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No column data available to export
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availableColumns.map((col) => {
                  const isSelected = selectedColumns.has(col.id);
                  return (
                    <div
                      key={col.id}
                      onClick={() => toggleColumn(col.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-blue-50/60 border-blue-200 text-blue-950 font-medium'
                          : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                      />
                      <div className="truncate">
                        <span className="block truncate font-medium">{col.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">{col.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Format: <strong>CSV (.csv)</strong> ready for Excel & Sheets
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Download size={14} />}
              disabled={exporting || availableColumns.length === 0}
              onClick={handleExport}
            >
              {exporting ? 'Exporting...' : 'Export Selected Columns'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
