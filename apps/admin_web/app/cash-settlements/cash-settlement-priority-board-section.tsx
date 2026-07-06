import type { ReactNode } from 'react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { FinanceDataTable } from '../finance-tax/finance-data-table';

export type CashSettlementPriorityBoardRow = {
  readonly ageLabel: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly currency: string;
  readonly debtAmount: number;
  readonly pillClass: string;
  readonly priority: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly reason: ReactNode;
  readonly requiredEvidence: readonly ReactNode[];
  readonly unlockResult: readonly ReactNode[];
};

type CashSettlementPriorityBoardSectionProps = {
  readonly rows: readonly CashSettlementPriorityBoardRow[];
};

const CASH_SETTLEMENT_PRIORITY_HEADERS = [
  'Priority',
  'Partner / Booking',
  'Debt reason',
  'Required evidence',
  'Unlock result',
] as const;

export function CashSettlementPriorityBoardSection({ rows }: CashSettlementPriorityBoardSectionProps) {
  if (!rows.length) {
    return (
      <AdminEmptyState
        className="admin-mt-12"
        framed
        message="No settlement priority rows are waiting for finance action."
        title={null}
      />
    );
  }

  return (
    <FinanceDataTable
      emptyMessage={null}
      headers={CASH_SETTLEMENT_PRIORITY_HEADERS}
      rowCount={rows.length}
      scrollClassName="admin-mt-12"
    >
      {rows.map((row) => (
        <tr key={`${row.bookingHref}-${row.priority}`}>
          <td>
            <StatusBadgeFromPillClass pillClass={row.pillClass}>{row.priority}</StatusBadgeFromPillClass>
            <div className="muted">{row.ageLabel}</div>
          </td>
          <td>
            <strong>{row.providerName}</strong>
            <div>
              <AdminTextLink href={row.bookingHref}>
                {row.bookingLabel}
              </AdminTextLink>
            </div>
            <div className="muted">{row.providerPhone}</div>
          </td>
          <td>
            <strong>
              <MoneyText amount={row.debtAmount} currency={row.currency} />
            </strong>
            <div className="muted">{row.reason}</div>
          </td>
          <td>
            <div className="service-matrix-cell">
              {row.requiredEvidence.map((line, index) => (
                <small key={`${row.bookingHref}-evidence-${index}`}>{line}</small>
              ))}
            </div>
          </td>
          <td>
            <div className="service-matrix-cell">
              {row.unlockResult.map((line, index) => (
                <small key={`${row.bookingHref}-unlock-${index}`}>{line}</small>
              ))}
            </div>
          </td>
        </tr>
      ))}
    </FinanceDataTable>
  );
}
