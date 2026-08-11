import type { ReactNode } from 'react';

import { AdminDataTable, AdminTableScroll, AdminTableSubstack } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminSignal, type AdminSignalTone, type StatusBadgeTone } from '../../components/status-badge';

export type FinanceOverviewTableRow = {
  readonly actionLabel?: string;
  readonly affectedRecords?: ReactNode;
  readonly exposure?: ReactNode;
  readonly helper: ReactNode;
  readonly href: string;
  readonly key: string;
  readonly label: ReactNode;
  readonly oldest?: ReactNode;
  readonly owner?: ReactNode;
  readonly signal: ReactNode;
  readonly signalTone?: AdminSignalTone;
  readonly value: ReactNode;
};

type FinanceOverviewTablePanelProps = {
  readonly className?: string;
  readonly description: string;
  readonly emptyMessage?: string;
  readonly emptyTitle?: string;
  readonly resultLabel?: string;
  readonly resultTone?: StatusBadgeTone;
  readonly rows: readonly FinanceOverviewTableRow[];
  readonly title: string;
  readonly variant?: 'controls' | 'records';
};

export function FinanceOverviewTablePanel({
  className,
  description,
  emptyMessage = 'No finance operating rows are available.',
  emptyTitle = 'No finance rows',
  resultLabel,
  resultTone,
  rows,
  title,
  variant = 'records',
}: FinanceOverviewTablePanelProps) {
  const controls = variant === 'controls';
  const showOldest = controls && rows.some((row) => row.oldest !== undefined && row.oldest !== null);
  const showOwner = controls && rows.some((row) => row.owner !== undefined && row.owner !== null);
  const headers = controls
    ? ['Signal', 'Control', 'Affected records', 'Exposure', ...(showOldest ? ['Oldest'] : []), ...(showOwner ? ['Owner'] : []), 'Action']
    : financeRecordTableHeaders;
  return (
    <AdminTablePanel
      className={`finance-overview-table-card admin-mb-16${className ? ` ${className}` : ''}`}
      description={description}
      resultLabel={resultLabel}
      resultTone={resultTone}
      title={title}
    >
      <AdminTableScroll ariaLabel={`${title} table`} className="finance-overview-table-wrap">
        <AdminDataTable
          className={`finance-overview-table is-${variant}`}
          emptyMessage={<AdminEmptyState message={emptyMessage} title={emptyTitle} />}
          headers={headers}
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
              {controls ? (
                <>
                  <td><strong>{row.affectedRecords ?? '—'}</strong></td>
                  <td><strong>{row.exposure ?? row.value ?? 'Not calculated'}</strong></td>
                  {showOldest ? <td>{row.oldest}</td> : null}
                  {showOwner ? <td>{row.owner}</td> : null}
                </>
              ) : (
                <td><strong>{row.value}</strong></td>
              )}
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

const financeRecordTableHeaders = ['Signal', 'Register', 'Scope', 'Action'] as const;
