import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminBookingDetail, AdminChatMessage, AdminCustomerDetail, adminGet } from '../../../lib/admin-api';

type PageProps = {
  params: Promise<{ id: string }>;
};

const ACTIVE_STATUSES = ['CREATED', 'OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'];

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const customer = await adminGet<AdminCustomerDetail | null>(`/admin/customers/${id}`, null);

  if (!customer) {
    notFound();
  }

  const bookings = customer.bookings ?? [];
  const wallet = buildCustomerWallet(bookings);
  const bookingStats = buildBookingStats(bookings);
  const addresses = buildAddressRows(customer);
  const latestBooking = bookings[0];
  const latestSession = customer.user?.appSessions?.[0];
  const pushDevices = customer.user?.pushDevices ?? [];
  const notifications = customer.user?.notifications ?? [];

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="muted">
            <Link className="text-link" href="/customers">
              Back to customers
            </Link>
          </p>
          <h1>Customer detail</h1>
          <p className="muted">
            {customer.user?.fullName ?? 'Unnamed customer'} / {customer.user?.phone ?? 'No phone'}
          </p>
        </div>
        <div className="actions">
          {latestBooking?.id && (
            <Link className="text-link" href={`/bookings/${latestBooking.id}`}>
              Open latest booking
            </Link>
          )}
          <Link className="text-link" href={`/payments?customer=${customer.id}`}>
            Payment view
          </Link>
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <MetricCard label="Bookings" value={bookings.length.toString()} helper={`${bookingStats.active} active now`} />
        <MetricCard label="Completed" value={bookingStats.completed.toString()} helper="Finished service count" />
        <MetricCard label="Cancelled" value={bookingStats.cancelled.toString()} helper="Cancelled, expired, or refunded" />
        <MetricCard label="No-show" value={bookingStats.noShow.toString()} helper="Needs penalty/support review" />
        <MetricCard label="Captured spend" value={formatMoney(wallet.capturedSpend)} helper="Captured customer payments" />
        <MetricCard label="Refunded" value={formatMoney(wallet.refundAmount)} helper={`${wallet.refundCount} refund row(s)`} />
        <MetricCard label="Saved addresses" value={addresses.length.toString()} helper="Profile and selected locations" />
        <MetricCard
          label="App session"
          value={latestSession ? 'Seen' : 'None'}
          helper={latestSession ? formatDate(latestSession.lastSeenAt) : 'No app session recorded'}
        />
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer information</h2>
            <p className="muted">Identity, contact, reachability, and app activity for support operators.</p>
          </div>
          <span className={`pill ${pushDevices.some((device) => device.enabled) ? 'pill-success' : 'pill-neutral'}`}>
            {pushDevices.some((device) => device.enabled) ? 'Push reachable' : 'No push device'}
          </span>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Name</span>
            <strong>{customer.user?.fullName ?? 'Not saved'}</strong>
            <small className="muted">Customer profile name</small>
          </div>
          <div>
            <span>Phone</span>
            <strong>{customer.user?.phone ?? 'Not saved'}</strong>
            <small className="muted">OTP identity</small>
          </div>
          <div>
            <span>Email</span>
            <strong>{customer.user?.email ?? 'Not saved'}</strong>
            <small className="muted">Optional contact</small>
          </div>
          <div>
            <span>Joined</span>
            <strong>{formatDate(customer.user?.createdAt)}</strong>
            <small className="muted">Account created</small>
          </div>
          <div>
            <span>Last seen</span>
            <strong>{formatDate(latestSession?.lastSeenAt)}</strong>
            <small className="muted">{latestSession?.platform ?? 'No platform'}</small>
          </div>
          <div>
            <span>Notifications</span>
            <strong>{notifications.length}</strong>
            <small className="muted">Recent in-app rows</small>
          </div>
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2>Customer wallet</h2>
          <p className="muted">
            Wallet-style readout derived from bookings, payments, refunds, coupons, and cash/payment state.
          </p>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            <div className="ops-row">
              <strong>Captured payments</strong>
              <span>{formatMoney(wallet.capturedSpend)}</span>
            </div>
            <div className="ops-row">
              <strong>Authorized / pending</strong>
              <span>{formatMoney(wallet.pendingPaymentAmount)}</span>
            </div>
            <div className="ops-row">
              <strong>Refund exposure</strong>
              <span>{formatMoney(wallet.refundAmount)}</span>
            </div>
            <div className="ops-row">
              <strong>Cash bookings</strong>
              <span>{formatMoney(wallet.cashBookingAmount)}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Saved addresses</h2>
          <p className="muted">Profile addresses and map pins selected in the customer app.</p>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {addresses.length > 0 ? (
              addresses.slice(0, 6).map((address) => (
                <div className="ops-row" key={address.key}>
                  <strong>{address.label}</strong>
                  <span>{address.value}</span>
                </div>
              ))
            ) : (
              <p className="muted">No saved address yet.</p>
            )}
          </div>
        </section>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking and cancellation history</h2>
            <p className="muted">All loaded bookings with partner, service, payment, refund, review, and chat state.</p>
          </div>
          <span className="pill pill-info">{bookings.length} bookings</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Service</th>
              <th>Status</th>
              <th>Partner</th>
              <th>Payment</th>
              <th>Chat</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <strong>{shortId(booking.id)}</strong>
                  <p className="muted">{formatDate(booking.scheduledStartAt ?? booking.createdAt)}</p>
                </td>
                <td>
                  <strong>{bookingServiceLabel(booking)}</strong>
                  <p className="muted">{formatMoney(bookingTotal(booking))}</p>
                </td>
                <td>
                  <span className={`pill ${bookingStatusPillClass(booking.status)}`}>{booking.status}</span>
                  <p className="muted">{bookingStatusOperatorHint(booking)}</p>
                </td>
                <td>{booking.selectedProvider?.displayName ?? booking.preferredProvider?.displayName ?? 'No partner'}</td>
                <td>
                  <strong>{booking.payment?.status ?? 'No payment'}</strong>
                  <p className="muted">{booking.payment ? formatMoney(Number(booking.payment.amount ?? 0)) : 'No amount'}</p>
                </td>
                <td>
                  <strong>{booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} messages` : 'No room'}</strong>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${booking.id}`}>
                    Booking
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Chat history</h2>
            <p className="muted">Recent messages grouped by booking so support can review context quickly.</p>
          </div>
          <span className="pill pill-info">{bookings.filter((booking) => booking.chatRoom).length} rooms</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {bookings.filter((booking) => booking.chatRoom).length > 0 ? (
            bookings
              .filter((booking) => booking.chatRoom)
              .slice(0, 12)
              .map((booking) => (
                <div className="card" key={booking.id}>
                  <div className="risk-watch-header">
                    <div>
                      <strong>{shortId(booking.id)} / {bookingServiceLabel(booking)}</strong>
                      <p className="muted">{booking.status} / Room {booking.chatRoom?.id}</p>
                    </div>
                    <Link className="text-link" href={`/bookings/${booking.id}`}>
                      Open booking
                    </Link>
                  </div>
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    {readChatMessages(booking).map((message) => (
                      <div className="ops-task-note" key={message.id}>
                        <strong>{message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender'}</strong>
                        <p>{message.body}</p>
                        <p className="muted">{formatDate(message.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <p className="muted">No chat rooms for this customer yet.</p>
          )}
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2>Push devices</h2>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {pushDevices.length > 0 ? (
              pushDevices.map((device) => (
                <div className="ops-row" key={device.id}>
                  <strong>{device.platform}</strong>
                  <span>{device.enabled ? 'Enabled' : 'Disabled'} / {formatDate(device.updatedAt ?? device.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No customer push device recorded.</p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>App sessions</h2>
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {(customer.user?.appSessions ?? []).length > 0 ? (
              (customer.user?.appSessions ?? []).slice(0, 8).map((session) => (
                <div className="ops-row" key={session.id}>
                  <strong>{session.platform ?? session.role}</strong>
                  <span>{session.active ? 'Active' : 'Inactive'} / {formatDate(session.lastSeenAt)}</span>
                </div>
              ))
            ) : (
              <p className="muted">No app session recorded.</p>
            )}
          </div>
        </section>
      </section>

      <section className="card">
        <div className="risk-watch-header">
          <div>
            <h2>Recent customer notifications</h2>
            <p className="muted">Delivery status helps support explain missed booking, payment, and chat updates.</p>
          </div>
          <span className="pill pill-info">{notifications.length} rows</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Notification</th>
              <th>Type</th>
              <th>Created</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {notifications.slice(0, 20).map((notification) => (
              <tr key={notification.id}>
                <td>
                  <strong>{notification.title}</strong>
                  <p className="muted">{notification.body}</p>
                </td>
                <td>{notification.type}</td>
                <td>{formatDate(notification.createdAt)}</td>
                <td>{notification.deliveries?.[0]?.status ?? 'No delivery'}</td>
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

function buildBookingStats(bookings: AdminBookingDetail[]) {
  return {
    active: bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    cancelled: bookings.filter((booking) => ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status)).length,
    noShow: bookings.filter((booking) => booking.status === 'NO_SHOW').length,
  };
}

function buildCustomerWallet(bookings: AdminBookingDetail[]) {
  return bookings.reduce(
    (wallet, booking) => {
      const paymentAmount = Number(booking.payment?.amount ?? 0);
      if (booking.payment?.status === 'CAPTURED') wallet.capturedSpend += paymentAmount;
      if (booking.payment && ['PENDING', 'AUTHORIZED'].includes(booking.payment.status)) {
        wallet.pendingPaymentAmount += paymentAmount;
      }
      if (booking.payment?.method === 'CASH') wallet.cashBookingAmount += paymentAmount;
      const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
      wallet.refundCount += refunds.length;
      wallet.refundAmount += refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
      return wallet;
    },
    {
      capturedSpend: 0,
      pendingPaymentAmount: 0,
      refundAmount: 0,
      refundCount: 0,
      cashBookingAmount: 0,
    },
  );
}

function buildAddressRows(customer: AdminCustomerDetail) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (Array.isArray(customer.addresses)) {
    customer.addresses.forEach((address, index) => {
      rows.push({ key: `profile-${index}`, label: `Profile address ${index + 1}`, value: stringifyAddress(address) });
    });
  } else if (customer.addresses) {
    rows.push({ key: 'profile-address', label: 'Profile address', value: stringifyAddress(customer.addresses) });
  }
  for (const location of customer.selectedLocations ?? []) {
    rows.push({
      key: location.id,
      label: `Selected pin ${formatDate(location.createdAt)}`,
      value: `${location.addressText} / ${location.latitude}, ${location.longitude}`,
    });
  }
  return rows;
}

function readChatMessages(booking: AdminBookingDetail): AdminChatMessage[] {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateMs(right.createdAt) - dateMs(left.createdAt);
  });
}

function bookingTotal(booking: AdminBookingDetail) {
  return (booking.services ?? []).reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 1), 0);
}

function bookingServiceLabel(booking: AdminBookingDetail) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function bookingStatusOperatorHint(booking: AdminBookingDetail) {
  if (ACTIVE_STATUSES.includes(booking.status)) return 'Live booking';
  if (booking.status === 'COMPLETED') return 'Closeout done';
  if (booking.status === 'NO_SHOW') return 'Support review';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status)) return 'Recovery / refund trail';
  return 'Historical row';
}

function bookingStatusPillClass(status: string) {
  if (ACTIVE_STATUSES.includes(status)) return 'pill-info';
  if (status === 'COMPLETED') return 'pill-success';
  if (status === 'NO_SHOW') return 'pill-danger';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(status)) return 'pill-warn';
  return 'pill-neutral';
}

function stringifyAddress(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const knownText = objectValue.addressText ?? objectValue.address ?? objectValue.label ?? objectValue.name;
    if (typeof knownText === 'string') return knownText;
    return JSON.stringify(value);
  }
  return String(value ?? 'No address');
}

function shortId(id?: string) {
  if (!id) return 'unknown';
  return id.slice(0, 8);
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
