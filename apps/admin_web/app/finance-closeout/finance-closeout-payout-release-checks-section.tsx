import { AdminDataTable } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import type { FinanceCloseoutHandoffRow } from '../../lib/finance-closeout';

type FinanceCloseoutPayoutReleaseChecksSectionProps = {
  readonly rows: readonly FinanceCloseoutHandoffRow[];
};

export function FinanceCloseoutPayoutReleaseChecksSection({
  rows,
}: FinanceCloseoutPayoutReleaseChecksSectionProps) {
  return (
    <AdminTableSection
      actions={
        <AdminTextLink href="/payouts">
          Open payouts
        </AdminTextLink>
      }
      bodyClassName="admin-table-section-body"
      className="admin-card-scroll"
      description="Transfer refs, earnings, tax logs, and open holds should be checked before a batch moves to paid. Use this as the final finance handoff list."
      title="Payout release checks"
    >
      <AdminDataTable
        emptyMessage="No finance handoff rows loaded."
        headers={['Queue', 'Count', 'Amount', 'Next action', 'Open']}
        rowCount={rows.length}
      >
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            <td>{row.count}</td>
            <td>{row.amount}</td>
            <td>{row.nextAction}</td>
            <td>
              <AdminTextLink href={row.href}>
                Open queue
              </AdminTextLink>
            </td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminTableSection>
  );
}
