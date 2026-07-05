import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import type { PayoutPartnerFinanceQueueRow } from './payout-partner-finance-queue-model';

type PayoutPartnerFinanceQueueSectionProps = {
  readonly rows: readonly PayoutPartnerFinanceQueueRow[];
};

const headers = ['Partner', 'Amount', 'Finance signal', 'Evidence', 'Action'] as const;

export function PayoutPartnerFinanceQueueSection({
  rows,
}: PayoutPartnerFinanceQueueSectionProps) {
  return (
    <AdminTablePanel
      className="payout-partner-finance-queue-section admin-mb-16"
      description="Partner-facing payout readiness queue. This shows bank detail issues, payout holds, negative wallet evidence, and transfer reference gaps before finance marks a payout paid."
      id="payout-partner-finance-queue"
      resultLabel={rows.length ? `${rows.length} item(s)` : 'Clear'}
      resultTone={rows.some((row) => row.tone === 'danger') ? 'danger' : rows.length ? 'warning' : 'success'}
      title="Partner finance queue"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={<PayoutPartnerFinanceQueueEmptyState />}
          headers={headers}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.partnerLabel}</strong>
                <p className="muted">Batch {row.batchId}</p>
              </td>
              <td>
                <strong>{row.amountLabel}</strong>
              </td>
              <td>
                <StatusBadge tone={badgeToneForQueueTone(row.tone)}>{row.title}</StatusBadge>
                <p className="muted">{row.detail}</p>
              </td>
              <td>
                <p className="muted">{row.evidenceLabel}</p>
              </td>
              <td>
                <Link className="text-link" href={row.href}>
                  {row.actionLabel}
                </Link>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminTablePanel>
  );
}

function PayoutPartnerFinanceQueueEmptyState() {
  return (
    <AdminEmptyState
      framed
      message="No partner finance follow-up is visible in the current payout batch window."
    />
  );
}

function badgeToneForQueueTone(tone: PayoutPartnerFinanceQueueRow['tone']): StatusBadgeTone {
  if (tone === 'danger') {
    return 'danger';
  }

  if (tone === 'success') {
    return 'success';
  }

  return 'warning';
}
