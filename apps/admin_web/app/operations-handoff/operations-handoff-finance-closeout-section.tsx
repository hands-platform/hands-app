import Link from 'next/link';
import { AdminDataTable } from '../../components/admin-data-table';
import { formatMoney, shortDisplayId } from '../../lib/admin-format';
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
    <section className="card">
      <div className="toolbar">
        <div>
          <h2>Finance and chat closeout</h2>
          <p className="muted">
            Cash debt, payout evidence, and chat records that an operator should not lose at handoff.
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href="/cash-settlements">
            Cash settlements
          </Link>
          <Link className="text-link" href="/payouts">
            Payouts
          </Link>
        </div>
      </div>
      <div className="admin-table-scroll">
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
              <td>{formatMoney(row.grossAmount, row.currency)}</td>
              <td>{formatMoney(row.platformFee, row.currency)}</td>
              <td>{formatMoney(row.withholdingAmount, row.currency)}</td>
              <td>{formatMoney(row.netAmount, row.currency)}</td>
              <td>
                <span className={row.statusClass}>{row.status}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </div>
    </section>
  );
}
