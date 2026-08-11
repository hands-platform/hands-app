import type { AdminFinanceReviewOwnerWorkloadSummary } from '../../lib/admin-api';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { adminCountLabel } from '../../lib/admin-copy';
import { FinanceDataTable } from './finance-data-table';
import { FinanceTablePanel } from './finance-table-panel';

type FinanceReviewOwnerWorkloadPanelProps = {
  readonly ariaLabel?: string;
  readonly currentOperatorId?: string | null;
  readonly description: string;
  readonly hrefForOwner: (owner: 'mine' | 'unassigned') => string;
  readonly summary: AdminFinanceReviewOwnerWorkloadSummary;
};

export function FinanceReviewOwnerWorkloadPanel({
  ariaLabel = 'Finance review owner workload table',
  currentOperatorId,
  description,
  hrefForOwner,
  summary,
}: FinanceReviewOwnerWorkloadPanelProps) {
  return (
    <FinanceTablePanel
      className="admin-mb-16"
      description={description}
      grouped
      resultLabel={adminCountLabel(summary.openCount, 'open review')}
      resultTone={summary.unassigned.over48hCount > 0 ? 'warning' : 'info'}
      title="Review owner workload"
    >
      <FinanceDataTable
        ariaLabel={ariaLabel}
        emptyMessage="No open review workload exists in the current queue."
        headers={['Review owner', 'Open', '48h+', 'Open amount', 'Oldest']}
        rowCount={summary.owners.length + (summary.unassigned.openCount > 0 ? 1 : 0)}
      >
        {summary.unassigned.openCount > 0 ? (
          <tr>
            <td>
              <AdminTextLink href={hrefForOwner('unassigned')}>
                <strong>Unassigned</strong>
              </AdminTextLink>
              <div className="muted">Needs an owner</div>
            </td>
            <td>{summary.unassigned.openCount}</td>
            <td>
              <StatusBadgeFromPillClass
                pillClass={summary.unassigned.over48hCount > 0 ? 'pill-warn' : 'pill-success'}
              >
                {summary.unassigned.over48hCount}
              </StatusBadgeFromPillClass>
            </td>
            <td>
              <MoneyText amount={summary.unassigned.openAmount} currency={summary.currency} />
            </td>
            <td>
              {summary.unassigned.oldestOccurredAt
                ? <DateTimeText value={summary.unassigned.oldestOccurredAt} />
                : <AdminInlineFallback>None</AdminInlineFallback>}
            </td>
          </tr>
        ) : null}
        {summary.owners.map((owner) => {
          const isCurrentOwner = owner.assigneeAdminId === currentOperatorId;
          const label = adminIdentityLabel(owner.assignee, owner.assigneeAdminId);
          return (
            <tr key={owner.assigneeAdminId}>
              <td>
                {isCurrentOwner ? (
                  <AdminTextLink href={hrefForOwner('mine')}>
                    <strong>{label}</strong>
                  </AdminTextLink>
                ) : (
                  <strong>{label}</strong>
                )}
                <div className="muted">{isCurrentOwner ? 'My reviews' : 'Assigned reviews'}</div>
              </td>
              <td>{owner.openCount}</td>
              <td>
                <StatusBadgeFromPillClass
                  pillClass={owner.over48hCount > 0 ? 'pill-warn' : 'pill-success'}
                >
                  {owner.over48hCount}
                </StatusBadgeFromPillClass>
              </td>
              <td><MoneyText amount={owner.openAmount} currency={summary.currency} /></td>
              <td>
                {owner.oldestOccurredAt
                  ? <DateTimeText value={owner.oldestOccurredAt} />
                  : <AdminInlineFallback>None</AdminInlineFallback>}
              </td>
            </tr>
          );
        })}
      </FinanceDataTable>
    </FinanceTablePanel>
  );
}

function adminIdentityLabel(
  admin: { email: string | null; fullName: string | null } | null | undefined,
  fallback: string,
) {
  return admin?.fullName || admin?.email || fallback;
}
