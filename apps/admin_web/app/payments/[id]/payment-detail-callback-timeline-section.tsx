import type { ReactNode } from 'react';

import { AdminDataTable } from '../../../components/admin-data-table';
import { AdminTablePanel } from '../../../components/admin-table-panel';
import { DateTimeText } from '../../../components/date-time-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../../components/status-badge';

export type PaymentDetailCallbackTimelineRow = {
  readonly amountLabel: string;
  readonly createdAt: string | null;
  readonly errorCodeLabel: string;
  readonly errorMessage: string;
  readonly id: string;
  readonly outcome: string;
  readonly payloadDetails: ReactNode;
  readonly pillClass: string;
  readonly providerRef: string;
  readonly providerStatus: string;
  readonly signatureLabel: string;
  readonly verificationMode: string;
};

type PaymentDetailCallbackTimelineSectionProps = {
  readonly reviewCount: number;
  readonly rows: readonly PaymentDetailCallbackTimelineRow[];
};

export function PaymentDetailCallbackTimelineSection({ reviewCount, rows }: PaymentDetailCallbackTimelineSectionProps) {
  return (
    <AdminTablePanel
      description="Accepted, replayed, rejected, and conflicting callbacks connected to this payment or gateway reference."
      id="callback-timeline"
      resultLabel={reviewCount ? `${reviewCount} review` : 'Trace ready'}
      resultTone={reviewCount ? 'warning' : 'info'}
      title="Gateway callback attempt timeline"
    >
      <AdminDataTable
        className="vuexy-booking-table"
        emptyMessage="No gateway callback attempts have been captured for this payment yet."
        headers={['Received', 'Outcome', 'Gateway evidence', 'Error', 'Payload']}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr id={`callback-attempt-${row.id}`} key={row.id}>
            <td>
              <DateTimeText fallback="-" value={row.createdAt} />
            </td>
            <td>
              <StatusBadge tone={statusBadgeToneFromPillClass(row.pillClass)}>{row.outcome}</StatusBadge>
              <div className="muted">Signature: {row.signatureLabel}</div>
            </td>
            <td>
              <strong>{row.providerRef}</strong>
              <div className="muted">Mode: {row.verificationMode}</div>
              <div className="muted">Gateway status: {row.providerStatus}</div>
              <div className="muted">Amount: {row.amountLabel}</div>
            </td>
            <td>
              {row.errorCodeLabel}
              <div className="muted">{row.errorMessage}</div>
            </td>
            <td>{row.payloadDetails}</td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTablePanel>
  );
}
