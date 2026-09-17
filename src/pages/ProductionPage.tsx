import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { useWorkspace, useToast } from '../context';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, formatNumber, formatDate, csvDownload } from '../lib/utils';
import type { TableColumn } from '../lib/types';
import { DataTable } from '../components/DataTable';
import { DetailDrawer } from '../components/DetailDrawer';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { ExportColumnModal, type ExportColumnOption } from '../components/ExportColumnModal';

const HISTORICAL_BATCH_EXPORT_COLUMNS: ExportColumnOption[] = [
  { key: 'batch_number', label: 'Batch #', category: 'Identifiers' },
  { key: 'date', label: 'Date', category: 'Identifiers' },
  { key: 'stage_name', label: 'Process / Stage', category: 'Identifiers' },
  { key: 'input_quantity', label: 'Input Consumed Qty', category: 'Materials' },
  { key: 'input_material_type', label: 'Input Material Unit', category: 'Materials' },
  { key: 'output_quantity', label: 'Output Produced Qty', category: 'Outputs' },
  { key: 'output_unit', label: 'Output Unit', category: 'Outputs' },
  { key: 'cost_per_unit', label: 'Unit Cost', category: 'Costing' }
];

export function ProductionPage() {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const { canView, canExport } = usePermissions('production');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportModalData, setExportModalData] = useState<{
    selectedRows: any[];
    selectAllAcrossPages: boolean;
    total: number;
    getExportData: () => Promise<any[]>;
  } | null>(null);

  if (!canView) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 mt-1">You do not have permission to view the Production module. Contact your workspace administrator to request access.</p>
      </div>
    );
  }

  const columns: TableColumn<any>[] = [
    { key: 'batch_number', label: 'Batch #', sortable: true, render: (row) => <strong className="text-slate-900 font-semibold">{row.batch_number}</strong> },
    { key: 'date', label: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    { key: 'stage_name', label: 'Process / Stage', sortable: true, render: (row) => row.stage_name || 'Production Batch' },
    { key: 'input_quantity', label: 'Input Consumed', align: 'right', render: (row) => `${formatNumber(row.input_quantity)} ${row.input_material_type || ''}` },
    { key: 'output_quantity', label: 'Output Produced', align: 'right', render: (row) => `${formatNumber(row.output_quantity)} ${row.output_unit || ''}` },
    { key: 'cost_per_unit', label: 'Unit Cost', align: 'right', render: (row) => formatCurrency(row.cost_per_unit, workspace?.currency) }
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        icon={<Boxes />}
        title="Historical Production Batches (Archive)"
        subtitle="Read-only historical view of production batch records created before the 2-stage production model."
        action={
          <Button icon={<Boxes size={16} />} onClick={() => navigate('/production')}>
            Go to Active Production Runs
          </Button>
        }
      />

      <DataTable
        endpoint="/api/production-batches"
        columns={columns}
        canExport={canExport}
        canCreate={false}
        canDelete={false}
        onView={(row) => setSelectedId(String(row.id || ''))}
        onExport={canExport ? (ctx) => setExportModalData(ctx) : undefined}
        showDateFilters={true}
        emptyTitle="No historical batch records found"
      />

      {exportModalData && (
        <ExportColumnModal
          title="Export Historical Batches to CSV"
          recordCount={exportModalData.total}
          availableColumns={HISTORICAL_BATCH_EXPORT_COLUMNS}
          onClose={() => setExportModalData(null)}
          onConfirmExport={async (selectedKeys) => {
            const records = await exportModalData.getExportData();
            const exportCols: TableColumn<any>[] = HISTORICAL_BATCH_EXPORT_COLUMNS
              .filter((c) => selectedKeys.includes(c.key))
              .map((c) => ({
                key: c.key,
                label: c.label
              }));

            const formattedRecords = records.map((r: any) => ({
              ...r,
              date: r.date ? formatDate(r.date) : '',
              cost_per_unit: r.cost_per_unit ?? 0
            }));

            csvDownload(
              `historical_batches_${new Date().toISOString().slice(0, 10)}.csv`,
              formattedRecords,
              exportCols
            );
            toast(`Exported ${formattedRecords.length} records successfully!`, 'success');
            setExportModalData(null);
          }}
        />
      )}

      {selectedId ? (
        <DetailDrawer
          title="Historical Production Batch Detail"
          endpoint={`/api/production-batches/${selectedId}`}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
