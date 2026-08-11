import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadgeFromPillClass } from '../../components/status-badge';
import { shortDisplayId } from '../../lib/admin-format';
import type { FinanceHandoffRow } from './operations-handoff-finance-rows';
import {
  OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
  OperationsHandoffPaginationFooter,
  type OperationsHandoffPagination,
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
  'Review reason',
] as const;

export function OperationsHandoffFinanceCloseoutSection({
  pagination,
  rows,
}: OperationsHandoffFinanceCloseoutSectionProps) {
  const visibleRows = rows.slice(0, OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.totalRows / OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
  );
  const start = (pagination.activePage - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE;
  const from = visibleRows.length === 0 ? 0 : start + 1;
  const to = visibleRows.length === 0 ? 0 : start + visibleRows.length;

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
      id="operations-handoff-finance-closeout"
      title="Finance and chat closeout"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No finance history rows."
          headers={FINANCE_CLOSEOUT_HEADERS}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
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
              <td>
                <small className="muted">{row.reviewReason}</small>
              </td>
            </tr>
          ))}
        </AdminDataTable>
        <OperationsHandoffPaginationFooter
          from={from}
          pagination={pagination}
          to={to}
          totalPages={totalPages}
        />
      </AdminTableScroll>
    </AdminSection>
  );
}
