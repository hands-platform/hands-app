import Link from 'next/link';

import { AdminTableScroll } from '../../components/admin-data-table';
import { formatDateTime as formatDate, formatMoney } from '../../lib/admin-format';
import type { CustomerRow } from './customer-list-model';

type CustomersTableSectionProps = {
  readonly rows: readonly CustomerRow[];
  readonly sortLabel: string;
};

export function CustomersTableSection({ rows, sortLabel }: CustomersTableSectionProps) {
  return (
    <section className="card">
      <div className="ops-section-header">
        <div>
          <h2>All customers</h2>
          <p className="muted">List view sorted by {sortLabel}. Open a row to see all customer details.</p>
        </div>
        <span className="pill pill-info">{rows.length} rows</span>
      </div>
      <AdminTableScroll>
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Customer ID</th>
              <th>Phone / email</th>
              <th>Joined</th>
              <th>Recent access</th>
              <th>Last work</th>
              <th>Bookings</th>
              <th>Completed</th>
              <th>Frequent service / area</th>
              <th>Repeated partner</th>
              <th>Closed / no-show</th>
              <th>Total paid</th>
              <th>Device / IP</th>
              <th>Ops trail</th>
              <th>Memo</th>
              <th>Addresses</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                  <p className="muted">First signup: {formatDate(row.joinedAt)}</p>
                </td>
                <td>
                  <code>{row.id}</code>
                </td>
                <td>
                  <strong>{row.phone}</strong>
                  <p className="muted">{row.email}</p>
                </td>
                <td>{formatDate(row.joinedAt)}</td>
                <td>
                  <strong>{row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}</strong>
                  <p className="muted">{row.isLive ? 'In app now' : 'Not live'}</p>
                </td>
                <td>
                  <strong>{row.lastCompletedAt ? formatDate(row.lastCompletedAt) : 'No completed work'}</strong>
                  <p className="muted">{row.lastCompletedLabel}</p>
                </td>
                <td>
                  <strong>{row.bookingCount}</strong>
                  <p className="muted">
                    {row.activeBookings} active / last {row.lastBookingAt ? formatDate(row.lastBookingAt) : 'none'}
                  </p>
                </td>
                <td>
                  <strong>{row.completedBookings}</strong>
                  <p className="muted">{row.lastCompletedPartner}</p>
                </td>
                <td>
                  <strong>{row.commonService}</strong>
                  <p className="muted">{row.commonArea}</p>
                </td>
                <td>
                  <strong>{row.commonPartner}</strong>
                  <p className="muted">Repeated selected or preferred partner</p>
                </td>
                <td>
                  <strong>{row.cancelledBookings}</strong>
                  <p className="muted">
                    Customer {row.customerClosedBookings} / admin {row.adminClosedBookings} / partner{' '}
                    {row.partnerClosedBookings}
                  </p>
                  <p className="muted">{row.noShowBookings} no-show</p>
                </td>
                <td>
                  <strong>{formatMoney(row.capturedSpend)}</strong>
                  <p className="muted">{formatMoney(row.refundAmount)} refunded</p>
                </td>
                <td>
                  <strong>{row.latestSessionDevice}</strong>
                  <p className="muted">{row.latestSessionIp}</p>
                </td>
                <td>
                  <strong>{row.chatRooms} chat room(s)</strong>
                  <p className="muted">
                    {row.paymentIssues} payment follow-up / {row.memoCount} memo(s)
                  </p>
                </td>
                <td>
                  <strong>{row.latestMemoTitle}</strong>
                  <p className="muted">{row.latestMemoDetail}</p>
                </td>
                <td>{row.addressCount}</td>
                <td>
                  <Link className="text-link" href={`/customers/${row.id}`}>
                    Details
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={17}>
                  <strong>No customers found</strong>
                  <p className="muted">Change the filters or clear search to view customer records.</p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </AdminTableScroll>
    </section>
  );
}
