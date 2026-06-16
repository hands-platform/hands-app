import Link from 'next/link';
import { formatMoney, shortDisplayId } from '../../lib/admin-format';
import type { FinanceHandoffRow } from './operations-handoff-finance-rows';

type OperationsHandoffFinanceCloseoutSectionProps = {
  readonly rows: readonly FinanceHandoffRow[];
};

export function OperationsHandoffFinanceCloseoutSection({
  rows,
}: OperationsHandoffFinanceCloseoutSectionProps) {
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
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Gross</th>
              <th>HANDS fee</th>
              <th>Withholding</th>
              <th>Wallet effect</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row) => (
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>No finance rows need handoff.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
