import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll, AdminTableSubstack } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminSignal, type AdminSignalTone, type StatusBadgeTone } from '../../components/status-badge';

export type FinanceOverviewTableRow = {
  readonly actionLabel?: string;
  readonly helper: ReactNode;
  readonly href: string;
  readonly key: string;
  readonly label: ReactNode;
  readonly signal: ReactNode;
  readonly signalTone?: AdminSignalTone;
  readonly value: ReactNode;
};

type FinanceOverviewTablePanelProps = {
  readonly className?: string;
  readonly description: string;
  readonly resultLabel?: string;
  readonly resultTone?: StatusBadgeTone;
  readonly rows: readonly FinanceOverviewTableRow[];
  readonly title: string;
};

export function FinanceOverviewTablePanel({
  className,
  description,
  resultLabel,
  resultTone,
  rows,
  title,
}: FinanceOverviewTablePanelProps) {
  return (
    <AdminTablePanel
      className={`finance-overview-table-card admin-mb-16${className ? ` ${className}` : ''}`}
      description={description}
      resultLabel={resultLabel}
      resultTone={resultTone}
      title={title}
    >
      <AdminTableScroll className="finance-overview-table-wrap">
        <AdminDataTable
          className="finance-overview-table"
          emptyMessage={<AdminEmptyState message="No finance operating rows are available." title="No finance rows" />}
          headers={financeOverviewTableHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <AdminSignal tone={row.signalTone ?? 'info'}>{row.signal}</AdminSignal>
              </td>
              <td>
                <AdminTableSubstack className="finance-overview-workspace-cell">
                  <strong>{row.label}</strong>
                  <p className="muted">{row.helper}</p>
                </AdminTableSubstack>
              </td>
              <td>
                <strong>{row.value}</strong>
              </td>
              <td>
                <AdminFormControlLink className="button-secondary finance-overview-table-action" href={row.href}>
                  {row.actionLabel ?? 'Open'}
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminTablePanel>
  );
}

const financeOverviewTableHeaders = ['Signal', 'Workspace', 'Evidence', 'Action'] as const;
