import { AdminDataTable } from '../../components/admin-data-table';
import { PillClassBadge } from '../../components/status-badge';

export type CashSettlementPriorityBoardRow = {
  readonly ageLabel: string;
  readonly bookingHref: string;
  readonly bookingLabel: string;
  readonly debtAmountLabel: string;
  readonly pillClass: string;
  readonly priority: string;
  readonly providerName: string;
  readonly providerPhone: string;
  readonly reason: string;
  readonly requiredEvidence: readonly string[];
  readonly unlockResult: readonly string[];
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
      <p className="muted admin-mt-12">
        No settlement priority rows are waiting for finance action.
      </p>
    );
  }

  return (
    <div className="admin-scroll-x admin-mt-12">
      <AdminDataTable
        className="vuexy-booking-table"
        emptyMessage={null}
        headers={CASH_SETTLEMENT_PRIORITY_HEADERS}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={`${row.bookingHref}-${row.priority}`}>
            <td>
              <PillClassBadge pillClass={row.pillClass}>{row.priority}</PillClassBadge>
              <div className="muted">{row.ageLabel}</div>
            </td>
            <td>
              <strong>{row.providerName}</strong>
              <div>
                <a className="text-link" href={row.bookingHref}>
                  {row.bookingLabel}
                </a>
              </div>
              <div className="muted">{row.providerPhone}</div>
            </td>
            <td>
              <strong>{row.debtAmountLabel}</strong>
              <div className="muted">{row.reason}</div>
            </td>
            <td>
              <div className="service-matrix-cell">
                {row.requiredEvidence.map((line) => (
                  <small key={line}>{line}</small>
                ))}
              </div>
            </td>
            <td>
              <div className="service-matrix-cell">
                {row.unlockResult.map((line) => (
                  <small key={line}>{line}</small>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </div>
  );
}
