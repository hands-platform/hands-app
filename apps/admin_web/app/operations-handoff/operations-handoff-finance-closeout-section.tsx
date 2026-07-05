import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
import { shortDisplayId } from '../../lib/admin-format';
import type { FinanceHandoffRow } from './operations-handoff-finance-rows';

type OperationsHandoffFinanceCloseoutSectionProps = {
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
  rows,
}: OperationsHandoffFinanceCloseoutSectionProps) {
  const visibleRows = rows.slice(0, 12);

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
      description="Cash debt, payout evidence, and chat records that an operator should not lose at handoff."
      title="Finance and chat closeout"
    >
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage="No finance rows need handoff."
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
                <StatusBadge tone={statusBadgeToneFromPillClass(row.statusClass)}>{row.status}</StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}
