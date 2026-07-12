import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { shortDisplayId } from '../../lib/admin-format';
import type { FinanceHandoffRow } from './operations-handoff-finance-rows';
import {
  OperationsHandoffPaginationFooter,
  type OperationsHandoffPagination,
  paginateOperationsHandoffRows,
} from './operations-handoff-pagination';

type OperationsHandoffFinanceCloseoutSectionProps = {
  readonly pagination: OperationsHandoffPagination;
  readonly rows: readonly FinanceHandoffRow[];
};

const FINANCE_CLOSEOUT_HEADERS = [
  'Partner',
  'Booking',
  'Gross',
  'HANDS fee',
  'Withholding',
  'Wallet effect',
  'Status',
] as const;

export function OperationsHandoffFinanceCloseoutSection({
  pagination,
  rows,
}: OperationsHandoffFinanceCloseoutSectionProps) {
  const pagedRows = paginateOperationsHandoffRows(rows, pagination.activePage);

  return (
    <AdminSection
      actions={
        <div className="actions">
          <AdminTextLink href="/cash-settlements">
            Cash settlements
          </AdminTextLink>
          <AdminTextLink href="/payouts">
            Payouts
          </AdminTextLink>
        </div>
      }
      className="operations-handoff-finance-closeout-card"
      description="Cash debt, payout evidence, and chat records from the selected historical window."
      title="Finance and chat closeout"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No finance history rows."
          headers={FINANCE_CLOSEOUT_HEADERS}
          rowCount={pagedRows.rows.length}
        >
          {pagedRows.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <AdminTextLink href={`/partners/${row.providerId}`}>
                  {row.partnerName}
                </AdminTextLink>
              </td>
              <td>
                <AdminTextLink href={`/bookings/${row.bookingId}`}>
                  {shortDisplayId(row.bookingId)}
                </AdminTextLink>
              </td>
              <td>
                <MoneyText amount={row.grossAmount} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.platformFee} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.withholdingAmount} currency={row.currency} />
              </td>
              <td>
                <MoneyText amount={row.netAmount} currency={row.currency} />
              </td>
              <td>
                <StatusBadgeFromPillClass pillClass={row.statusClass}>{row.status}</StatusBadgeFromPillClass>
              </td>
            </tr>
          ))}
        </AdminDataTable>
        <OperationsHandoffPaginationFooter
          from={pagedRows.from}
          pagination={pagination}
          to={pagedRows.to}
          totalPages={pagedRows.totalPages}
        />
      </AdminTableScroll>
    </AdminSection>
  );
}
