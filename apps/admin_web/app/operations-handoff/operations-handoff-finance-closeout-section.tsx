import Link from 'next/link';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
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
          <Link className="text-link" href="/cash-settlements">
            Cash settlements
          </Link>
          <Link className="text-link" href="/payouts">
            Payouts
          </Link>
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
                <Link className="text-link" href={`/partners/${row.providerId}`}>
                  {row.partnerName}
                </Link>
              </td>
              <td>
                <Link className="text-link" href={`/bookings/${row.bookingId}`}>
                  {shortDisplayId(row.bookingId)}
                </Link>
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
                <span className={row.statusClass}>{row.status}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminSection>
  );
}
