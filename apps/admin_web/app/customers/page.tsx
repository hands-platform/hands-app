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
  const attentionRows = rows.filter((row) => row.needsAttention).slice(0, 8);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Customer Management</h1>
          <p className="muted">
            Customer command board for profile, booking history, cancellations, chat trace, wallet view,
            saved addresses, app sessions, and push reachability.
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
        <MetricCard label="In app now" value={summary.live.toString()} helper="Latest session under 30 minutes" />
        <MetricCard label="Active bookings" value={summary.activeBookings.toString()} helper="Needs live ops attention" />
        <MetricCard label="Completed bookings" value={summary.completedBookings.toString()} helper="Completed service count" />
        <MetricCard label="Cancelled / expired" value={summary.cancelledBookings.toString()} helper="Customer recovery queue" />
        <MetricCard label="No-shows" value={summary.noShowBookings.toString()} helper="Review support and penalty trail" />
        <MetricCard label="Saved addresses" value={summary.addresses.toString()} helper="Saved or selected locations" />
        <MetricCard label="Captured spend" value={formatMoney(summary.capturedSpend)} helper="Captured customer payments" />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer command board</h2>
            <p className="muted">
              Fast queue for customers who need payment, cancellation, chat, address, or reachability review.
            </p>
          </div>
          <span className={`pill ${attentionRows.length ? 'pill-warn' : 'pill-success'}`}>
            {attentionRows.length} attention
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
            <span>Refund exposure</span>
            <strong>{formatMoney(summary.refundAmount)}</strong>
            <small className="muted">Refund rows in loaded history</small>
          </div>
          <div>
            <span>Chat traces</span>
            <strong>{summary.chatRooms}</strong>
            <small className="muted">Rooms connected to bookings</small>
          </div>
          <div>
            <span>Missing addresses</span>
            <strong>{summary.missingAddress}</strong>
            <small className="muted">Ask support to confirm location</small>
          </div>
          <div>
            <span>Payment issues</span>
            <strong>{summary.paymentIssues}</strong>
            <small className="muted">Pending, failed, released, or refunded</small>
          </div>
        </div>
        {attentionRows.length > 0 ? (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Reason</th>
                <th>Last booking</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {attentionRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <p className="muted">{row.phone}</p>
                  </td>
                  <td>{row.attentionReason}</td>
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
            No customer needs immediate operator attention.
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
              <th>Last booking</th>
              <th>Bookings</th>
              <th>Cancel / no-show</th>
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
                <td>{row.lastBookingAt ? formatDate(row.lastBookingAt) : 'No booking yet'}</td>
                <td>
                  <strong>{row.bookingCount}</strong>
                  <p className="muted">{row.activeBookings} active / {row.completedBookings} completed</p>
                </td>
                <td>
                  <strong>{row.cancelledBookings}</strong>
                  <p className="muted">{row.noShowBookings} no-show</p>
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
  const noShowBookings = bookings.filter((booking) => booking.status === 'NO_SHOW').length;
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
  const lastSeenAt = customer.user?.appSessions?.[0]?.lastSeenAt;
  const pushReachable = Boolean(customer.user?.pushDevices?.some((device) => device.enabled));
  const needsAttention = activeBookings > 0 || cancelledBookings > 0 || noShowBookings > 0 || paymentIssues > 0 || addressCount === 0;
  const attentionReason =
    activeBookings > 0
      ? `${activeBookings} active booking(s)`
      : paymentIssues > 0
        ? `${paymentIssues} payment issue(s)`
        : noShowBookings > 0
          ? `${noShowBookings} no-show row(s)`
          : cancelledBookings > 0
            ? `${cancelledBookings} cancelled / expired row(s)`
            : addressCount === 0
              ? 'No saved address'
              : 'Review';

  return {
    id: customer.id,
    name: customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer',
    phone: customer.user?.phone ?? 'No phone',
    bookingCount: bookings.length,
    activeBookings,
    completedBookings,
    cancelledBookings,
    noShowBookings,
    refundAmount,
    capturedSpend,
    addressCount,
    lastBookingAt,
    lastSeenAt,
    pushReachable,
    paymentIssues,
    chatRooms: bookings.filter((booking) => booking.chatRoom).length,
    needsAttention,
    attentionReason,
  };
}

function buildCustomerSummary(rows: ReturnType<typeof buildCustomerRow>[]) {
  return {
    total: rows.length,
    live: rows.filter((row) => row.lastSeenAt && Date.now() - dateMs(row.lastSeenAt) <= 30 * 60_000).length,
    activeBookings: rows.reduce((sum, row) => sum + row.activeBookings, 0),
    completedBookings: rows.reduce((sum, row) => sum + row.completedBookings, 0),
    cancelledBookings: rows.reduce((sum, row) => sum + row.cancelledBookings, 0),
    noShowBookings: rows.reduce((sum, row) => sum + row.noShowBookings, 0),
    addresses: rows.reduce((sum, row) => sum + row.addressCount, 0),
    capturedSpend: rows.reduce((sum, row) => sum + row.capturedSpend, 0),
    refundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    pushReachable: rows.filter((row) => row.pushReachable).length,
    chatRooms: rows.reduce((sum, row) => sum + row.chatRooms, 0),
    missingAddress: rows.filter((row) => row.addressCount === 0).length,
    paymentIssues: rows.reduce((sum, row) => sum + row.paymentIssues, 0),
    latestBookingAt: rows.map((row) => row.lastBookingAt).filter(Boolean).sort((left, right) => dateMs(right) - dateMs(left))[0],
  };
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
