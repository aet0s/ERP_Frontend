import { useState } from 'react';
import {
  Download,
  Settings2
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatDate } from '../lib/utils';
import { useToast } from '../context';

export interface ColumnOption {
  id: string;
  label: string;
  category: string;
  defaultSelected?: boolean;
  getter: (row: any) => string | number;
}

export const RETURN_EXPORT_COLUMNS: ColumnOption[] = [
  // Core Identification
  {
    id: 'request_number',
    label: 'Request Number',
    category: 'Identification',
    defaultSelected: true,
    getter: (r) => r.request_number || ''
  },
  {
    id: 'return_direction',
    label: 'Direction (Vendor / Customer)',
    category: 'Identification',
    defaultSelected: true,
    getter: (r) => {
      const isVendor = r.return_direction === 'vendor' || 
        ['purchase_return', 'purchase_cancellation'].includes(r.request_type) ||
        Boolean(r.vendor_id);
      return isVendor ? 'Return to Vendor' : 'Return by Customer';
    }
  },
  {
    id: 'request_type',
    label: 'Request Type',
    category: 'Identification',
    defaultSelected: true,
    getter: (r) => (r.request_type ? r.request_type.replace('_', ' ').toUpperCase() : '')
  },
  {
    id: 'status',
    label: 'Status',
    category: 'Identification',
    defaultSelected: true,
    getter: (r) => r.status || ''
  },
  {
    id: 'created_at',
    label: 'Request Date',
    category: 'Identification',
    defaultSelected: true,
    getter: (r) => formatDate(r.created_at)
  },

  // Party & Reference
  {
    id: 'party_name',
    label: 'Party (Vendor / Customer)',
    category: 'Party & Reference',
    defaultSelected: true,
    getter: (r) => r.vendor_name || r.customer_name || 'N/A'
  },
  {
    id: 'party_type',
    label: 'Party Role',
    category: 'Party & Reference',
    defaultSelected: false,
    getter: (r) => (r.vendor_name ? 'Vendor' : r.customer_name ? 'Customer' : 'Internal')
  },
  {
    id: 'party_email',
    label: 'Party Email',
    category: 'Party & Reference',
    defaultSelected: false,
    getter: (r) => r.vendor_email || r.customer_email || ''
  },
  {
    id: 'party_phone',
    label: 'Party Phone',
    category: 'Party & Reference',
    defaultSelected: false,
    getter: (r) => r.vendor_phone || r.customer_phone || ''
  },
  {
    id: 'reference_type',
    label: 'Reference Document Type',
    category: 'Party & Reference',
    defaultSelected: false,
    getter: (r) => r.reference_type || ''
  },
  {
    id: 'reference_number',
    label: 'Reference Order # (PO / Invoice)',
    category: 'Party & Reference',
    defaultSelected: true,
    getter: (r) => r.reference_number || r.reference_id || ''
  },
  {
    id: 'reference_total_amount',
    label: 'Original Order Amount',
    category: 'Party & Reference',
    defaultSelected: false,
    getter: (r) => (r.reference_total_amount ? Number(r.reference_total_amount).toFixed(2) : '')
  },

  // Reason & Line Items
  {
    id: 'reason',
    label: 'Reason for Return',
    category: 'Reason & Items',
    defaultSelected: true,
    getter: (r) => r.reason || ''
  },
  {
    id: 'requested_by_type',
    label: 'Requested By Source',
    category: 'Reason & Items',
    defaultSelected: false,
    getter: (r) => r.requested_by_type || ''
  },
  {
    id: 'items_summary',
    label: 'Returned Items Summary',
    category: 'Reason & Items',
    defaultSelected: true,
    getter: (r) => {
      let items = r.return_items || r.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (_) { items = []; }
      }
      if (!Array.isArray(items) || items.length === 0) return 'Entire Document';
      return items.map((i: any) => `${i.name || i.item_name || 'Item'} (${i.quantity} ${i.unit || 'units'})`).join('; ');
    }
  },
  {
    id: 'items_count',
    label: 'Returned Items Count',
    category: 'Reason & Items',
    defaultSelected: false,
    getter: (r) => {
      let items = r.return_items || r.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (_) { items = []; }
      }
      return Array.isArray(items) ? items.length : 1;
    }
  },
  {
    id: 'outcome_amount',
    label: 'Credit / Debit Amount',
    category: 'Reason & Items',
    defaultSelected: true,
    getter: (r) => (r.outcome_amount ? Number(r.outcome_amount).toFixed(2) : '')
  },

  // Review & Resolution
  {
    id: 'reviewed_by_name',
    label: 'Reviewed By',
    category: 'Review & Resolution',
    defaultSelected: false,
    getter: (r) => r.reviewed_by_name || ''
  },
  {
    id: 'updated_at',
    label: 'Review Date',
    category: 'Review & Resolution',
    defaultSelected: false,
    getter: (r) => (r.status !== 'Pending' ? formatDate(r.updated_at) : '')
  },
  {
    id: 'review_notes',
    label: 'Review / Rejection Notes',
    category: 'Review & Resolution',
    defaultSelected: true,
    getter: (r) => r.review_notes || ''
  },
  {
    id: 'outcome_document_type',
    label: 'Outcome Document Type',
    category: 'Review & Resolution',
    defaultSelected: false,
    getter: (r) => (r.outcome_document_type ? r.outcome_document_type.replace('_', ' ').toUpperCase() : '')
  },
  {
    id: 'outcome_document_number',
    label: 'Credit / Debit Note #',
    category: 'Review & Resolution',
    defaultSelected: true,
    getter: (r) => r.outcome_document_number || ''
  }
];

interface ExportColumnsModalProps {
  onClose: () => void;
  selectedCount: number;
  totalCount: number;
  onConfirmExport: (selectedColumnIds: string[], exportAll: boolean) => Promise<void>;
}

export function ExportColumnsModal({
  onClose,
  selectedCount,
  totalCount,
  onConfirmExport
}: ExportColumnsModalProps) {
  const toast = useToast();
  const [selectedColIds, setSelectedColIds] = useState<Set<string>>(
    new Set(RETURN_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id))
  );
  const [exportAll, setExportAll] = useState(selectedCount === 0);
  const [exporting, setExporting] = useState(false);

  const toggleColumn = (id: string) => {
    const next = new Set(selectedColIds);
    if (next.has(id)) {
      if (next.size === 1) {
        toast('At least one column must be selected', 'info');
        return;
      }
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedColIds(next);
  };

  const selectAll = () => {
    setSelectedColIds(new Set(RETURN_EXPORT_COLUMNS.map((c) => c.id)));
  };

  const resetToDefault = () => {
    setSelectedColIds(new Set(RETURN_EXPORT_COLUMNS.filter((c) => c.defaultSelected).map((c) => c.id)));
  };

  const handleExport = async () => {
    if (selectedColIds.size === 0) {
      toast('Please select at least one column to export', 'error');
      return;
    }
    setExporting(true);
    try {
      await onConfirmExport(Array.from(selectedColIds), exportAll);
      onClose();
    } catch (err: any) {
      toast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Group columns by category
  const categories = Array.from(new Set(RETURN_EXPORT_COLUMNS.map((c) => c.category)));

  return (
    <Modal title="Export Returns & Cancellations Data" onClose={onClose}>
      <div className="space-y-5 text-sm">
        {/* Scope selection card */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Export Scope
          </span>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
              exportAll 
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
            }`}>
              <input
                type="radio"
                name="exportScope"
                checked={exportAll}
                onChange={() => setExportAll(true)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-xs">All Filtered Records</span>
                <span className="text-[11px] font-normal text-slate-500">{totalCount} total records</span>
              </div>
            </label>

            <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
              !exportAll 
                ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
            } ${selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="radio"
                name="exportScope"
                checked={!exportAll}
                disabled={selectedCount === 0}
                onChange={() => setExportAll(false)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-xs">Selected Records Only</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {selectedCount > 0 ? `${selectedCount} selected` : 'None selected in table'}
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
                Select Columns to Export ({selectedColIds.size} / {RETURN_EXPORT_COLUMNS.length})
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Check the fields you wish to include in the exported CSV spreadsheet.
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
                onClick={resetToDefault}
                className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded font-medium transition cursor-pointer"
              >
                Reset Default
              </button>
            </div>
          </div>

          {/* Categorized Column Checkboxes */}
          <div className="max-h-72 overflow-y-auto pr-1 space-y-4 border border-slate-200 rounded-xl p-3 bg-white">
            {categories.map((cat) => {
              const catCols = RETURN_EXPORT_COLUMNS.filter((c) => c.category === cat);
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                    {cat}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {catCols.map((col) => {
                      const isSelected = selectedColIds.has(col.id);
                      return (
                        <div
                          key={col.id}
                          onClick={() => toggleColumn(col.id)}
                          className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-blue-50/60 border-blue-200 text-blue-950 font-medium'
                              : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                          />
                          <span className="truncate">{col.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Format: <strong>CSV (.csv)</strong> ready for Excel & Google Sheets
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Download size={14} />}
              disabled={exporting}
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
