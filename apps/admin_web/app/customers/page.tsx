import Link from 'next/link';
import { AdminCustomer, adminGet } from '../../lib/admin-api';

const ACTIVE_STATUSES = ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'];
const CANCELLED_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED'];

export default async function CustomersPage() {
  const customers = await adminGet<AdminCustomer[]>('/admin/customers', []);
  const rows = customers.map(buildCustomerRow).sort((left, right) => {
    return dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt);
  });
  const summary = buildCustomerSummary(rows);
  const recentActivityRows = rows.filter((row) => row.lastBookingAt || row.lastCompletedAt).slice(0, 8);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Customer Management</h1>
          <p className="muted">
            Customer activity board for profile, booking history, completed work, chat archives, wallet view,
            saved addresses, app sessions, and push reachability. This page records facts only, not customer ranking.
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href="/bookings">
            Open bookings
          </Link>
          <Link className="text-link" href="/payments">
            Open payments
          </Link>
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Customers" value={summary.total.toString()} helper="Total customer profiles" />
        <MetricCard label="Joined recently" value={summary.recentJoins.toString()} helper="New accounts in 30 days" />
        <MetricCard label="In app now" value={summary.live.toString()} helper="Latest session under 30 minutes" />
        <MetricCard label="Active bookings" value={summary.activeBookings.toString()} helper="Needs live ops attention" />
        <MetricCard label="Completed work" value={summary.completedBookings.toString()} helper="Finished service records" />
        <MetricCard label="Last work" value={summary.latestCompletedAt ? formatDate(summary.latestCompletedAt) : 'None'} helper="Newest completed service" />
        <MetricCard label="Closed bookings" value={summary.cancelledBookings.toString()} helper="Cancelled, expired, or refunded records" />
        <MetricCard label="Saved addresses" value={summary.addresses.toString()} helper="Saved or selected locations" />
        <MetricCard label="Captured spend" value={formatMoney(summary.capturedSpend)} helper="Captured customer payments" />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer activity board</h2>
            <p className="muted">
              Recent customer activity by booking, completed work, payment, chat archive, address, and reachability.
            </p>
          </div>
          <span className="pill pill-info">
            {recentActivityRows.length} recent
          </span>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Last booking</span>
            <strong>{summary.latestBookingAt ? formatDate(summary.latestBookingAt) : 'None'}</strong>
            <small className="muted">Newest customer activity</small>
          </div>
          <div>
            <span>Push reachable</span>
            <strong>{summary.pushReachable}</strong>
            <small className="muted">Enabled device token exists</small>
          </div>
          <div>
            <span>Refund records</span>
            <strong>{formatMoney(summary.refundAmount)}</strong>
            <small className="muted">Refund rows in loaded history</small>
          </div>
          <div>
            <span>Chat traces</span>
            <strong>{summary.chatRooms}</strong>
            <small className="muted">Rooms connected to bookings</small>
          </div>
          <div>
            <span>No saved address</span>
            <strong>{summary.missingAddress}</strong>
            <small className="muted">Profile has no stored address row</small>
          </div>
          <div>
            <span>Payment issues</span>
            <strong>{summary.paymentIssues}</strong>
            <small className="muted">Pending, failed, released, or refunded</small>
          </div>
        </div>
        {recentActivityRows.length > 0 ? (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Activity</th>
                <th>Last completed work</th>
                <th>Last booking</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentActivityRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <p className="muted">{row.phone}</p>
                  </td>
                  <td>{row.activityLabel}</td>
                  <td>{row.lastCompletedAt ? formatDate(row.lastCompletedAt) : 'No completed work yet'}</td>
                  <td>{row.lastBookingAt ? formatDate(row.lastBookingAt) : 'No booking'}</td>
                  <td>
                    <Link className="text-link" href={`/customers/${row.id}`}>
                      Open customer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted" style={{ marginTop: 14 }}>
            No customer booking activity has been recorded yet.
          </p>
        )}
      </section>

      <section className="card">
        <div className="risk-watch-header">
          <div>
            <h2>All customers</h2>
            <p className="muted">
              List view sorted by the latest booking progress date. Open a row to see all customer details.
            </p>
          </div>
          <span className="pill pill-info">{rows.length} rows</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Joined</th>
              <th>Last work</th>
              <th>Bookings</th>
              <th>Wallet</th>
              <th>Addresses</th>
              <th>Reachability</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                  <p className="muted">{row.phone}</p>
                </td>
                <td>{formatDate(row.joinedAt)}</td>
                <td>
                  <strong>{row.lastCompletedAt ? formatDate(row.lastCompletedAt) : 'No completed work'}</strong>
                  <p className="muted">{row.lastCompletedLabel}</p>
                </td>
                <td>
                  <strong>{row.bookingCount}</strong>
                  <p className="muted">{row.activeBookings} active / {row.completedBookings} completed</p>
                </td>
                <td>
                  <strong>{formatMoney(row.capturedSpend)}</strong>
                  <p className="muted">{formatMoney(row.refundAmount)} refunded</p>
                </td>
                <td>{row.addressCount}</td>
                <td>
                  <span className={`pill ${row.pushReachable ? 'pill-success' : 'pill-neutral'}`}>
                    {row.pushReachable ? 'Push ready' : 'No push'}
                  </span>
                  <p className="muted">{row.lastSeenAt ? `Seen ${formatDate(row.lastSeenAt)}` : 'No session'}</p>
                </td>
                <td>
                  <Link className="text-link" href={`/customers/${row.id}`}>
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="card">
      <span className="muted">{label}</span>
      <h2>{value}</h2>
      <p className="muted">{helper}</p>
    </div>
  );
}

function buildCustomerRow(customer: AdminCustomer) {
  const bookings = customer.bookings ?? [];
  const payments = bookings.map((booking) => booking.payment).filter(Boolean);
  const refundAmount = bookings.reduce((sum, booking) => {
    const paymentRefunds = booking.payment?.refunds ?? [];
    const bookingRefunds = booking.refunds ?? [];
    return sum + [...paymentRefunds, ...bookingRefunds].reduce((innerSum, refund) => innerSum + Number(refund.amount ?? 0), 0);
  }, 0);
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length;
  const cancelledBookings = bookings.filter((booking) => CANCELLED_STATUSES.includes(booking.status)).length;
  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const paymentIssues = payments.filter((payment) => payment && !['AUTHORIZED', 'CAPTURED'].includes(payment.status)).length;
  const capturedSpend = payments
    .filter((payment) => payment?.status === 'CAPTURED')
    .reduce((sum, payment) => sum + Number(payment?.amount ?? 0), 0);
  const addressCount = readAddressCount(customer.addresses) + (customer.selectedLocations?.length ?? 0);
  const lastBookingAt = bookings
    .map((booking) => booking.updatedAt ?? booking.createdAt ?? booking.scheduledStartAt)
    .filter(Boolean)
    .sort((left, right) => dateMs(right) - dateMs(left))[0];
  const completedRows = bookings
    .filter((booking) => booking.status === 'COMPLETED')
    .sort((left, right) => dateMs(right.updatedAt ?? right.scheduledStartAt ?? right.createdAt) - dateMs(left.updatedAt ?? left.scheduledStartAt ?? left.createdAt));
  const lastCompletedBooking = completedRows[0];
  const lastCompletedAt = lastCompletedBooking?.updatedAt ?? lastCompletedBooking?.scheduledStartAt ?? lastCompletedBooking?.createdAt;
  const lastSeenAt = customer.user?.appSessions?.[0]?.lastSeenAt;
  const pushReachable = Boolean(customer.user?.pushDevices?.some((device) => device.enabled));
  const activityLabel =
    activeBookings > 0
      ? `${activeBookings} active booking(s)`
      : completedBookings > 0
        ? `${completedBookings} completed work record(s)`
        : bookings.length > 0
          ? `${bookings.length} booking record(s)`
          : 'No booking history yet';

  return {
    id: customer.id,
    name: customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer',
    phone: customer.user?.phone ?? 'No phone',
    joinedAt: customer.user?.createdAt,
    bookingCount: bookings.length,
    activeBookings,
    completedBookings,
    cancelledBookings,
    refundAmount,
    capturedSpend,
    addressCount,
    lastBookingAt,
    lastCompletedAt,
    lastCompletedLabel: lastCompletedBooking ? bookingServiceLabel(lastCompletedBooking) : 'No finished service record',
    lastSeenAt,
    pushReachable,
    paymentIssues,
    chatRooms: bookings.filter((booking) => booking.chatRoom).length,
    activityLabel,
  };
}

function buildCustomerSummary(rows: ReturnType<typeof buildCustomerRow>[]) {
  return {
    total: rows.length,
    live: rows.filter((row) => row.lastSeenAt && Date.now() - dateMs(row.lastSeenAt) <= 30 * 60_000).length,
    recentJoins: rows.filter((row) => row.joinedAt && Date.now() - dateMs(row.joinedAt) <= 30 * 24 * 60 * 60_000).length,
    activeBookings: rows.reduce((sum, row) => sum + row.activeBookings, 0),
    completedBookings: rows.reduce((sum, row) => sum + row.completedBookings, 0),
    cancelledBookings: rows.reduce((sum, row) => sum + row.cancelledBookings, 0),
    addresses: rows.reduce((sum, row) => sum + row.addressCount, 0),
    capturedSpend: rows.reduce((sum, row) => sum + row.capturedSpend, 0),
    refundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    pushReachable: rows.filter((row) => row.pushReachable).length,
    chatRooms: rows.reduce((sum, row) => sum + row.chatRooms, 0),
    missingAddress: rows.filter((row) => row.addressCount === 0).length,
    paymentIssues: rows.reduce((sum, row) => sum + row.paymentIssues, 0),
    latestBookingAt: rows.map((row) => row.lastBookingAt).filter(Boolean).sort((left, right) => dateMs(right) - dateMs(left))[0],
    latestCompletedAt: rows.map((row) => row.lastCompletedAt).filter(Boolean).sort((left, right) => dateMs(right) - dateMs(left))[0],
  };
}

function bookingServiceLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function readAddressCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return 1;
  return 0;
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function formatMoney(value: number, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
