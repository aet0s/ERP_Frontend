import { useState } from 'react';
import { Download, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export interface ExportColumnOption {
  key: string;
  label: string;
  category?: string;
  defaultSelected?: boolean;
}

interface ExportColumnModalProps {
  title: string;
  recordCount: number;
  availableColumns: ExportColumnOption[];
  onClose: () => void;
  onConfirmExport: (selectedKeys: string[]) => Promise<void> | void;
}

export function ExportColumnModal({
  title,
  recordCount,
  availableColumns,
  onClose,
  onConfirmExport
}: ExportColumnModalProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    const set = new Set<string>();
    availableColumns.forEach((col) => {
      if (col.defaultSelected !== false) {
        set.add(col.key);
      }
    });
    return set;
  });
  const [exporting, setExporting] = useState(false);

  const toggleColumn = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedKeys(new Set(availableColumns.map((c) => c.key)));
  };

  const deselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleExport = async () => {
    if (selectedKeys.size === 0) return;
    setExporting(true);
    try {
      await onConfirmExport(Array.from(selectedKeys));
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <div className="space-y-4">
        {/* Info Header */}
        <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600 shrink-0" size={18} />
            <span>
              Select the columns you want to include in the exported CSV. Exporting <strong>{recordCount}</strong> record(s).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-blue-300">|</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Selected count info */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
          <span>
            {selectedKeys.size} of {availableColumns.length} columns selected
          </span>
        </div>

        {/* Columns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto p-1">
          {availableColumns.map((col) => {
            const isChecked = selectedKeys.has(col.key);
            return (
              <label
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition select-none ${
                  isChecked
                    ? 'bg-blue-50/60 border-blue-300 text-blue-950 font-semibold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className={`shrink-0 ${isChecked ? 'text-blue-600' : 'text-slate-400'}`}>
                  {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <div className="truncate">
                  <span className="block truncate">{col.label}</span>
                  {col.category && (
                    <span className="block text-[10px] text-slate-400 font-normal truncate">
                      {col.category}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedKeys.size === 0 || exporting}
            icon={<Download size={15} />}
          >
            {exporting ? 'Generating CSV...' : `Export ${selectedKeys.size} Column${selectedKeys.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
