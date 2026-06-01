import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AdminAppSession,
  AdminBookingDetail,
  AdminChatMessage,
  AdminCustomerDetail,
  AdminNotification,
  adminGet,
} from '../../../lib/admin-api';
import {
  detailDateRangeOptions,
  isWithinDetailDateFilter,
  readDetailDateFilters,
} from '../../../lib/detail-date-filter';
import {
  DetailActivityTypeOption,
  detailActivityTypeLabel,
  isWithinDetailActivityType,
  readDetailActivityType,
} from '../../../lib/detail-activity-filter';
import { buildCsvDataHref } from '../../../lib/csv-export';
import { addCustomerOpsNote } from './actions';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ACTIVE_STATUSES = [
  'CREATED',
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
];
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];

const CUSTOMER_ACTIVITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All event types', types: [] },
  { value: 'booking_work', label: 'Bookings and completed work', types: ['BOOKING', 'WORK'] },
  { value: 'chat', label: 'Chat archive', types: ['CHAT'] },
  { value: 'payment', label: 'Payments and refunds', types: ['PAYMENT', 'REFUND'] },
  { value: 'address_app', label: 'Account, addresses, sessions, devices', types: ['ACCOUNT', 'ADDRESS', 'SESSION', 'DEVICE'] },
  {
    value: 'support',
    label: 'Notifications, reviews, staff records',
    types: ['NOTICE', 'REVIEW', 'OPS', 'AUDIT'],
  },
] satisfies DetailActivityTypeOption[];

export default async function CustomerDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const detailSearchParams = searchParams ? await searchParams : {};
  const dateFilters = readDetailDateFilters(detailSearchParams);
  const activityType = readDetailActivityType(detailSearchParams, CUSTOMER_ACTIVITY_TYPE_OPTIONS);
  const customer = await adminGet<AdminCustomerDetail | null>(`/admin/customers/${id}`, null);

  if (!customer) {
    notFound();
  }

  const bookings = customer.bookings ?? [];
  const wallet = buildCustomerWallet(bookings);
  const bookingStats = buildBookingStats(bookings);
  const addresses = buildAddressRows(customer);
  const latestBooking = bookings[0];
  const lastCompletedBooking = bookings.find((booking) => booking.status === 'COMPLETED');
  const latestSession = customer.user?.appSessions?.[0];
  const pushDevices = customer.user?.pushDevices ?? [];
  const notifications = customer.user?.notifications ?? [];
  const activityPlan = buildCustomerActivityPlan(customer, bookings, wallet, bookingStats, addresses);
  const chatRooms = bookings.filter((booking) => booking.chatRoom);
  const chatMessageCount = chatRooms.reduce(
    (sum, booking) => sum + (booking.chatRoom?.messages?.length ?? 0),
    0,
  );
  const customerActivityRecords = buildCustomerActivityRecords(customer, bookings, addresses);
  const recentAuditLogs = customer.auditLogs ?? [];
  const filteredBookings = bookings.filter((booking) =>
    isWithinDetailDateFilter(booking.scheduledStartAt ?? booking.createdAt ?? booking.updatedAt, dateFilters),
  );
  const filteredChatBookings = bookings.filter((booking) => {
    if (!booking.chatRoom) return false;
    return (
      isWithinDetailDateFilter(
        booking.scheduledStartAt ?? booking.createdAt ?? booking.updatedAt,
        dateFilters,
      ) ||
      readChatMessages(booking).some((message) => isWithinDetailDateFilter(message.createdAt, dateFilters))
    );
  });
  const filteredCustomerActivityRecords = customerActivityRecords.filter(
    (record) =>
      isWithinDetailDateFilter(record.at, dateFilters) &&
      isWithinDetailActivityType(record.type, activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS),
  );
  const customerActivitySummary = buildCustomerActivitySummary(filteredCustomerActivityRecords);
  const filteredNotifications = notifications.filter((notification) =>
    isWithinDetailDateFilter(notification.createdAt, dateFilters),
  );
  const filteredAuditLogs = recentAuditLogs.filter((log) =>
    isWithinDetailDateFilter(log.createdAt, dateFilters),
  );
  const accountFacts = buildCustomerAccountFacts(customer, bookings, addresses);
  const customerOperatorCommandQueue = buildCustomerOperatorCommandQueue({
    customer,
    bookings,
    wallet,
    bookingStats,
    addresses,
    latestSession,
    pushDevices,
    notifications,
  });
  const customerOperatingLedger = buildCustomerOperatingLedger({
    customer,
    bookings,
    wallet,
    bookingStats,
    addresses,
    latestSession,
    pushDevices,
    notifications,
    activityRecords: customerActivityRecords,
  });
  const filteredActivityCsvHref = buildCsvDataHref(
    filteredCustomerActivityRecords.map((record) => ({
      type: record.type,
      date: formatDate(record.at),
      title: record.title,
      detail: record.detail,
      href: record.href ?? '',
      record_id: record.id,
      customer_id: customer.id,
      customer_phone: customer.user?.phone ?? '',
    })),
    ['type', 'date', 'title', 'detail', 'href', 'record_id', 'customer_id', 'customer_phone'],
  );

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
          <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(customer.id)}`}>
            All customer chats
          </Link>
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <MetricCard
          label="Bookings"
          value={bookings.length.toString()}
          helper={`${bookingStats.active} active now`}
        />
        <MetricCard
          label="Completed work"
          value={bookingStats.completed.toString()}
          helper="Finished service records"
        />
        <MetricCard
          label="Last work"
          value={lastCompletedBooking ? shortId(lastCompletedBooking.id) : 'None'}
          helper={
            lastCompletedBooking
              ? formatDate(
                  lastCompletedBooking.updatedAt ??
                    lastCompletedBooking.scheduledStartAt ??
                    lastCompletedBooking.createdAt,
                )
              : 'No completed service yet'
          }
        />
        <MetricCard
          label="Closed bookings"
          value={bookingStats.closed.toString()}
          helper={`Customer ${bookingStats.customerClosed} / admin ${bookingStats.adminClosed} / partner ${bookingStats.partnerClosed} / no-show ${bookingStats.noShow}`}
        />
        <MetricCard
          label="Captured spend"
          value={formatMoney(wallet.capturedSpend)}
          helper="Captured customer payments"
        />
        <MetricCard
          label="Refunded"
          value={formatMoney(wallet.refundAmount)}
          helper={`${wallet.refundCount} refund row(s)`}
        />
        <MetricCard
          label="Saved addresses"
          value={addresses.length.toString()}
          helper="Profile and selected locations"
        />
        <MetricCard
          label="App session"
          value={latestSession ? 'Seen' : 'None'}
          helper={latestSession ? formatDate(latestSession.lastSeenAt) : 'No app session recorded'}
        />
      </section>

      <section className="card" id="customer-operator-command-queue" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer operator command queue</h2>
            <p className="muted">
              Next factual actions for the customer desk. This queue only points operators to live bookings,
              chat archives, payment rows, saved locations, devices, and staff notes that may need follow-up.
            </p>
          </div>
          <span className={`pill ${customerSupportPillClass(customerOperatorCommandQueue.tone)}`}>
            {customerOperatorCommandQueue.status}
          </span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {customerOperatorCommandQueue.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 14 }}>
          {customerOperatorCommandQueue.commands.map((command) => (
            <div className={`ops-task-note ops-task-${command.tone}`} key={command.id}>
              <div className="ops-row">
                <div>
                  <span className={`pill ${customerSupportPillClass(command.tone)}`}>{command.label}</span>
                  <h3>{command.title}</h3>
                  <p className="muted">{command.detail}</p>
                  <small className="muted">Owner: {command.owner}</small>
                </div>
                <CustomerOperatorCommandAction command={command} customerId={customer.id} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer full record index</h2>
            <p className="muted">
              Factual customer record map for operators. This page shows booking, work, payment, chat, address,
              notification, app session, and operator history.
            </p>
          </div>
          <span className="pill pill-info">{customerActivityRecords.length} event(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <a href="#customer-info">
            <span>Customer info</span>
            <strong>{customer.user?.phone ?? 'No phone'}</strong>
            <small>Identity, contact, account age.</small>
          </a>
          <a href="#wallet">
            <span>Wallet and payment</span>
            <strong>{formatMoney(wallet.capturedSpend)}</strong>
            <small>Captured, pending, cash, refund rows.</small>
          </a>
          <a href="#addresses">
            <span>Addresses</span>
            <strong>{addresses.length}</strong>
            <small>Saved address and selected map pins.</small>
          </a>
          <a href="#booking-history">
            <span>Bookings</span>
            <strong>{bookings.length}</strong>
            <small>{bookingStats.completed} completed work record(s).</small>
          </a>
          <a href="#chat-history">
            <span>Chat archive</span>
            <strong>{chatMessageCount}</strong>
            <small>{chatRooms.length} room(s), retained for admin.</small>
          </a>
          <a href="#customer-activity">
            <span>Activity timeline</span>
            <strong>{customerActivityRecords.length}</strong>
            <small>Date-ordered app and operations events.</small>
          </a>
        </div>
      </section>

      <section className="card" id="customer-operating-ledger" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer operating ledger</h2>
            <p className="muted">
              Compact factual ledger for account, booking work, chat archive, payment, wallet, address,
              app device, notification, and operator history. This ledger is factual history only.
            </p>
          </div>
          <span className="pill pill-info">{customerOperatingLedger.length} record areas</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Area</th>
              <th>Status</th>
              <th>Evidence</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {customerOperatingLedger.map((row) => (
              <tr key={row.area}>
                <td>{row.area}</td>
                <td>{row.status}</td>
                <td>{row.evidence}</td>
                <td>
                  <Link className="text-link" href={row.href}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="record-date-filter" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Record date filter</h2>
            <p className="muted">
              Narrow booking, chat, notification, audit, and activity records without changing the saved
              customer data.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-info">{dateFilters.label}</span>
            <span className="pill pill-neutral">
              {detailActivityTypeLabel(activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS)}
            </span>
          </div>
        </div>
        <form className="form-grid" action={`/customers/${customer.id}`} style={{ marginTop: 14 }}>
          <label>
            Preset
            <select name="range" defaultValue={dateFilters.range}>
              {detailDateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Record type
            <select name="type" defaultValue={activityType}>
              {CUSTOMER_ACTIVITY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" name="from" defaultValue={dateFilters.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={dateFilters.to} />
          </label>
          <div className="actions">
            <button type="submit">Apply filter</button>
            <a
              className="text-link"
              download={`hands-customer-${shortId(customer.id)}-activity.csv`}
              href={filteredActivityCsvHref}
            >
              Export activity CSV
            </a>
            <Link className="text-link" href={`/customers/${customer.id}`}>
              Clear
            </Link>
          </div>
        </form>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Filtered bookings</span>
            <strong>{filteredBookings.length}</strong>
            <small>Matching, completed, cancelled, and refunded records.</small>
          </div>
          <div>
            <span>Filtered chat rooms</span>
            <strong>{filteredChatBookings.length}</strong>
            <small>Rooms with booking or message dates in this period.</small>
          </div>
          <div>
            <span>Filtered activity</span>
            <strong>{filteredCustomerActivityRecords.length}</strong>
            <small>
              {detailActivityTypeLabel(activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS)} in this period.
            </small>
          </div>
          <div>
            <span>Filtered notices</span>
            <strong>{filteredNotifications.length}</strong>
            <small>Customer notification rows.</small>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer activity action panel</h2>
            <p className="muted">
              Facts-only operator view for booking progress, completed work, archived chats, payment records,
              addresses, and customer contact.
            </p>
          </div>
          <span className={`pill ${customerSupportPillClass(activityPlan.tone)}`}>{activityPlan.status}</span>
        </div>
        <div className="service-trace-summary">
          {activityPlan.cards.map((card) => (
            <Link className="text-link" href={card.href} key={card.title}>
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small className="muted">{card.detail}</small>
            </Link>
          ))}
        </div>
        <div className="ops-task-note ops-task-pending" style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <strong>{activityPlan.headline}</strong>
              <p className="muted">{activityPlan.detail}</p>
              <div className="participant-list" style={{ marginTop: 8 }}>
                {activityPlan.badges.map((badge) => (
                  <span className={`pill ${customerSupportPillClass(badge.tone)}`} key={badge.label}>
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
            <Link className="text-link" href={activityPlan.primaryHref}>
              {activityPlan.primaryAction}
            </Link>
          </div>
        </div>
        <form action={addCustomerOpsNote} className="compact-form form-grid" style={{ marginTop: 14 }}>
          <input type="hidden" name="customerId" value={customer.id} />
          <label>
            Quick note preset
            <select name="preset" defaultValue="">
              <option value="">Manual note only</option>
              {activityPlan.presets.map((preset) => (
                <option value={preset} key={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>
          <label>
            Related booking
            <select name="bookingId" defaultValue={latestBooking?.id ?? ''}>
              <option value="">No booking link</option>
              {bookings.slice(0, 20).map((booking) => (
                <option value={booking.id} key={booking.id}>
                  {shortId(booking.id)} / {booking.status} / {bookingServiceLabel(booking)}
                </option>
              ))}
            </select>
          </label>
          <label className="full-span">
            Activity note
            <textarea
              name="note"
              placeholder="Example: Customer contacted by phone, address confirmed, chat archive reviewed."
            />
          </label>
          <button type="submit">Save customer activity note</button>
        </form>
      </section>

      <section className="card" id="customer-info" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer information</h2>
            <p className="muted">Identity, contact, reachability, and app activity for support operators.</p>
          </div>
          <span
            className={`pill ${pushDevices.some((device) => device.enabled) ? 'pill-success' : 'pill-neutral'}`}
          >
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

      <section className="card" id="customer-account-facts" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer account facts</h2>
            <p className="muted">
              Factual profile, booking, payment, support, and account fields. Missing values are shown as not
              captured instead of guessed.
            </p>
          </div>
          <span className="pill pill-info">{accountFacts.length} field(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {accountFacts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <small className="muted">{fact.helper}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        <section className="card" id="wallet">
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

        <section className="card" id="addresses">
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

      <section className="card" id="booking-history" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking and cancellation history</h2>
            <p className="muted">
              All loaded bookings with partner, service, payment, refund, review, and chat state.
            </p>
          </div>
          <span className="pill pill-info">{filteredBookings.length} bookings</span>
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
            {filteredBookings.map((booking) => (
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
                  {isClosedCustomerBooking(booking) ? (
                    <p className="muted">
                      {formatDate(booking.closedAt)} / {bookingClosureLabel(booking)}
                    </p>
                  ) : null}
                </td>
                <td>
                  {bookingPartnerDisplayName(booking)}
                </td>
                <td>
                  <strong>{booking.payment?.status ?? 'No payment'}</strong>
                  <p className="muted">
                    {booking.payment ? formatMoney(Number(booking.payment.amount ?? 0)) : 'No amount'}
                  </p>
                </td>
                <td>
                  <strong>
                    {booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} messages` : 'No room'}
                  </strong>
                  <p className="muted">{bookingChatArchiveLabel(booking)}</p>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${booking.id}`}>
                    Booking
                  </Link>
                  {booking.chatRoom ? (
                    <Link
                      className="text-link"
                      href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}
                      style={{ marginLeft: 10 }}
                    >
                      Chat archive
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredBookings.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No booking record matched this date filter.
          </p>
        ) : null}
      </section>

      <section className="card" id="chat-history" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Chat history</h2>
            <p className="muted">
              Admin archive for every matched booking. Customer and partner apps hide the chat after
              completion, but operations keeps the full message history here.
            </p>
          </div>
          <span className="pill pill-info">{filteredChatBookings.length} rooms</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {filteredChatBookings.length > 0 ? (
            filteredChatBookings.map((booking) => (
              <div className="card" key={booking.id}>
                <div className="risk-watch-header">
                  <div>
                    <strong>
                      {shortId(booking.id)} / {bookingServiceLabel(booking)}
                    </strong>
                    <p className="muted">
                      {booking.status} / Room {booking.chatRoom?.id}
                    </p>
                  </div>
                  <Link className="text-link" href={`/bookings/${booking.id}`}>
                    Open booking
                  </Link>
                  {booking.chatRoom ? (
                    <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
                      Open full chat archive
                    </Link>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {readChatMessages(booking)
                    .filter((message) => isWithinDetailDateFilter(message.createdAt, dateFilters))
                    .map((message) => (
                      <div className="ops-task-note" key={message.id}>
                        <strong>
                          {message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender'}
                        </strong>
                        <p>{message.body}</p>
                        <p className="muted">{formatDate(message.createdAt)}</p>
                      </div>
                    ))}
                  {readChatMessages(booking).filter((message) =>
                    isWithinDetailDateFilter(message.createdAt, dateFilters),
                  ).length === 0 ? (
                    <p className="muted">
                      No messages in this date filter, but the room belongs to this period.
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="muted">No chat rooms matched this date filter.</p>
          )}
        </div>
      </section>

      <section className="card" id="customer-activity" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer chronological activity</h2>
            <p className="muted">
              Date-sorted factual history across bookings, completed work, chat messages, payments, refunds,
              addresses, app sessions, push devices, notifications, reviews, and operator notes.
            </p>
          </div>
          <span className="pill pill-info">{filteredCustomerActivityRecords.length} event(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          {customerActivitySummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {filteredCustomerActivityRecords.length > 0 ? (
            filteredCustomerActivityRecords.slice(0, 40).map((record) => (
              <div className="setup-stage-item" key={`${record.type}-${record.id}-${record.at}`}>
                <span>{record.type}</span>
                <div>
                  {record.href ? (
                    <Link className="text-link" href={record.href}>
                      <strong>{record.title}</strong>
                    </Link>
                  ) : (
                    <strong>{record.title}</strong>
                  )}
                  <p className="muted">{record.detail}</p>
                </div>
                <small>{formatDate(record.at)}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No customer activity matched this date filter</strong>
                <p className="muted">
                  Clear the date filter or choose a wider range to review the full activity archive.
                </p>
              </div>
              <small>0</small>
            </div>
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
                  <span>
                    {device.enabled ? 'Enabled' : 'Disabled'} /{' '}
                    {formatDate(device.updatedAt ?? device.createdAt)}
                  </span>
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
                  <span>
                    {session.active ? 'Active' : 'Inactive'} / {formatDate(session.lastSeenAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No app session recorded.</p>
            )}
          </div>
        </section>
      </section>

      <section className="card" id="notifications">
        <div className="risk-watch-header">
          <div>
            <h2>Recent customer notifications</h2>
            <p className="muted">
              Delivery status helps support explain missed booking, payment, and chat updates.
            </p>
          </div>
          <span className="pill pill-info">{filteredNotifications.length} rows</span>
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
            {filteredNotifications.slice(0, 20).map((notification) => (
              <tr key={notification.id}>
                <td>
                  <strong>{displayMarketplaceText(notification.title)}</strong>
                  <p className="muted">{displayMarketplaceText(notification.body)}</p>
                </td>
                <td>{notification.type}</td>
                <td>{formatDate(notification.createdAt)}</td>
                <td>{notification.deliveries?.[0]?.status ?? 'No delivery'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" id="audit-trail" style={{ marginTop: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Customer audit trail</h2>
            <p className="muted">Recent operator notes and system actions attached to this customer.</p>
          </div>
          <span className="pill pill-info">{filteredAuditLogs.length} logs</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Created</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filteredAuditLogs.slice(0, 20).map((log) => (
              <tr key={log.id}>
                <td>{log.action}</td>
                <td>{log.actor?.fullName ?? log.actor?.phone ?? 'System'}</td>
                <td>{formatDate(log.createdAt)}</td>
                <td>
                  <code>{compactJson(log.metadata)}</code>
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

type CustomerOperatorTone = 'success' | 'info' | 'warn' | 'danger';

type CustomerOperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  owner: string;
  tone: CustomerOperatorTone;
  action:
    | { type: 'link'; href: string; label: string }
    | { type: 'note'; preset: string; label: string; bookingId?: string };
};

type CustomerPushDevice = NonNullable<NonNullable<AdminCustomerDetail['user']>['pushDevices']>[number];
type CustomerActivityRecord = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail: string;
  href?: string;
};

type CustomerOperatingLedgerRow = {
  area: string;
  status: string;
  evidence: string;
  href: string;
};

function CustomerOperatorCommandAction({
  customerId,
  command,
}: {
  customerId: string;
  command: CustomerOperatorCommand;
}) {
  if (command.action.type === 'link') {
    return (
      <Link className="text-link" href={command.action.href}>
        {command.action.label}
      </Link>
    );
  }

  return (
    <form action={addCustomerOpsNote} className="compact-form">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="preset" value={command.action.preset} />
      <input type="hidden" name="bookingId" value={command.action.bookingId ?? ''} />
      <button type="submit">{command.action.label}</button>
    </form>
  );
}

function buildBookingStats(bookings: AdminBookingDetail[]) {
  const closedBookings = bookings.filter((booking) => CLOSED_BOOKING_STATUSES.includes(booking.status));
  return {
    active: bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    cancelled: bookings.filter((booking) => ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status))
      .length,
    closed: closedBookings.length,
    customerClosed: closedBookings.filter((booking) => booking.closedByRole === 'CUSTOMER').length,
    adminClosed: closedBookings.filter((booking) => booking.closedByRole === 'ADMIN').length,
    partnerClosed: closedBookings.filter((booking) => booking.closedByRole === 'PROVIDER').length,
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

function buildCustomerOperatorCommandQueue({
  customer,
  bookings,
  wallet,
  bookingStats,
  addresses,
  latestSession,
  pushDevices,
  notifications,
}: {
  customer: AdminCustomerDetail;
  bookings: AdminBookingDetail[];
  wallet: ReturnType<typeof buildCustomerWallet>;
  bookingStats: ReturnType<typeof buildBookingStats>;
  addresses: Array<{ key: string; label: string; value: string }>;
  latestSession?: AdminAppSession;
  pushDevices: CustomerPushDevice[];
  notifications: AdminNotification[];
}) {
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status));
  const activeBooking = activeBookings[0];
  const matchedWithoutChat = activeBookings.filter(
    (booking) =>
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
      !booking.chatRoom,
  );
  const quietChatBooking = activeBookings.find(
    (booking) => booking.chatRoom && readChatMessages(booking).length === 0,
  );
  const paymentIssueBooking = bookings.find(
    (booking) =>
      booking.payment &&
      !['AUTHORIZED', 'CAPTURED', 'REFUNDED', 'RELEASED'].includes(booking.payment.status),
  );
  const refundBooking = bookings.find(
    (booking) => (booking.payment?.refunds?.length ?? 0) > 0 || (booking.refunds?.length ?? 0) > 0,
  );
  const enabledPushDevices = pushDevices?.filter((device) => device.enabled) ?? [];
  const unreadNotifications = notifications?.filter((notification) => !notification.readAt) ?? [];
  const lastSeenMs = latestSession ? dateMs(latestSession.lastSeenAt) : 0;
  const staleSession =
    !latestSession || Date.now() - lastSeenMs > 1000 * 60 * 60 * 24 * 7;
  const missingAddress = addresses.length === 0;
  const commands: CustomerOperatorCommand[] = [];

  if (activeBooking) {
    commands.push({
      id: `active-${activeBooking.id}`,
      label: 'Live booking',
      title: 'Open the current customer booking',
      detail: `${activeBooking.status} / ${bookingServiceLabel(
        activeBooking,
      )}. Check partner, payment, location, and chat records from the booking detail page.`,
      owner: 'Dispatch / Customer desk',
      tone: 'info',
      action: { type: 'link', href: `/bookings/${activeBooking.id}`, label: 'Open booking' },
    });
  }

  if (matchedWithoutChat.length > 0) {
    const booking = matchedWithoutChat[0];
    commands.push({
      id: `chat-missing-${booking.id}`,
      label: 'Chat required',
      title: 'Matched booking has no chat room row',
      detail:
        'Matching should create a customer-partner chat. Open the booking and verify chat creation before service continues.',
      owner: 'Realtime / Support',
      tone: 'warn',
      action: { type: 'link', href: `/bookings/${booking.id}#chat`, label: 'Inspect chat' },
    });
  }

  if (quietChatBooking) {
    commands.push({
      id: `chat-quiet-${quietChatBooking.id}`,
      label: 'Chat quiet',
      title: 'Chat exists but no messages are archived yet',
      detail:
        'The room is open. Leave a factual note if staff confirms the customer and partner are communicating outside chat.',
      owner: 'Customer desk',
      tone: 'info',
      action: {
        type: 'note',
        label: 'Add chat note',
        bookingId: quietChatBooking.id,
        preset: 'Chat room exists but no messages are archived yet; operator should verify customer contact if needed.',
      },
    });
  }

  if (paymentIssueBooking) {
    commands.push({
      id: `payment-${paymentIssueBooking.id}`,
      label: 'Payment row',
      title: 'Review the latest non-captured payment status',
      detail: `${paymentIssueBooking.payment?.status ?? 'Unknown'} / ${
        paymentIssueBooking.payment?.method ?? 'No method'
      } / ${formatMoney(Number(paymentIssueBooking.payment?.amount ?? 0))}`,
      owner: 'Payments',
      tone: 'warn',
      action: { type: 'link', href: `/payments?customer=${customer.id}`, label: 'Open payments' },
    });
  }

  if (refundBooking) {
    commands.push({
      id: `refund-${refundBooking.id}`,
      label: 'Refund record',
      title: 'Refund or release history exists',
      detail:
        'Open the refund desk before answering customer payment questions. Refund records are factual history only.',
      owner: 'Payments',
      tone: 'info',
      action: { type: 'link', href: '/refunds', label: 'Open refunds' },
    });
  }

  if (missingAddress) {
    commands.push({
      id: 'address-missing',
      label: 'Address',
      title: 'No saved service address is loaded',
      detail:
        'Ask the customer to confirm a map pin or saved address before dispatch so partner distance and service location stay clear.',
      owner: 'Customer desk',
      tone: 'warn',
      action: {
        type: 'note',
        label: 'Add address note',
        preset: 'Customer has no saved service address loaded; ask customer to confirm the service location before dispatch.',
      },
    });
  }

  if (enabledPushDevices.length === 0) {
    commands.push({
      id: 'push-unreachable',
      label: 'App reachability',
      title: 'No enabled customer push device',
      detail:
        'Use phone or in-app session records for contact until the customer registers an enabled push device.',
      owner: 'Customer desk',
      tone: 'warn',
      action: { type: 'link', href: `/notifications?user=${customer.userId}`, label: 'Open notices' },
    });
  }

  if (staleSession) {
    commands.push({
      id: 'session-stale',
      label: 'App session',
      title: latestSession ? 'Customer app session is older than 7 days' : 'No customer app session recorded',
      detail: latestSession
        ? `Last seen ${formatDate(latestSession.lastSeenAt)} on ${
            latestSession.platform ?? 'unknown platform'
          }.`
        : 'No mobile session row is loaded for this customer.',
      owner: 'Customer desk',
      tone: 'info',
      action: {
        type: 'note',
        label: 'Add session note',
        preset: latestSession
          ? 'Customer app session is older than 7 days; verify contact path if support is needed.'
          : 'No customer app session is loaded; verify contact path if support is needed.',
      },
    });
  }

  if (unreadNotifications.length > 0) {
    commands.push({
      id: 'unread-notifications',
      label: 'Notifications',
      title: `${unreadNotifications.length} unread notification row(s)`,
      detail:
        'Review recent notifications and delivery rows before sending duplicate customer communication.',
      owner: 'Customer desk',
      tone: 'info',
      action: { type: 'link', href: `/notifications?user=${customer.userId}`, label: 'Open notifications' },
    });
  }

  if (commands.length === 0) {
    commands.push({
      id: 'steady-state',
      label: 'Steady state',
      title: 'No immediate customer desk action detected',
      detail:
        'Booking, payment, chat, address, app session, and notification records are loaded for normal monitoring.',
      owner: 'Customer desk',
      tone: 'success',
      action: {
        type: 'note',
        label: 'Add monitoring note',
        preset: 'Customer record reviewed; no immediate customer desk action detected.',
      },
    });
  }

  const blocking = commands.some((command) => command.tone === 'danger' || command.tone === 'warn');
  return {
    status: blocking ? 'Follow-up queued' : activeBooking ? 'Live monitoring' : 'Record ready',
    tone: blocking ? ('warn' as const) : activeBooking ? ('info' as const) : ('success' as const),
    metrics: [
      {
        label: 'Live bookings',
        value: activeBookings.length.toString(),
        detail: activeBooking ? `${shortId(activeBooking.id)} / ${activeBooking.status}` : 'No active booking',
      },
      {
        label: 'Completed work',
        value: bookingStats.completed.toString(),
        detail: 'Finished service records only',
      },
      {
        label: 'Captured spend',
        value: formatMoney(wallet.capturedSpend),
        detail: `${formatMoney(wallet.pendingPaymentAmount)} pending or authorized`,
      },
      {
        label: 'Chat archive',
        value: bookings.filter((booking) => booking.chatRoom).length.toString(),
        detail: `${bookings.reduce((sum, booking) => sum + readChatMessages(booking).length, 0)} message(s) retained`,
      },
      {
        label: 'Saved locations',
        value: addresses.length.toString(),
        detail: missingAddress ? 'No saved address loaded' : addresses[0]?.value ?? 'Address loaded',
      },
      {
        label: 'App reachability',
        value: enabledPushDevices.length ? 'Push enabled' : 'Phone/manual',
        detail: latestSession ? `Last seen ${formatDate(latestSession.lastSeenAt)}` : 'No app session',
      },
    ],
    commands: commands.slice(0, 8),
  };
}

function buildCustomerAccountFacts(
  customer: AdminCustomerDetail,
  bookings: AdminBookingDetail[],
  addresses: Array<{ key: string; label: string; value: string }>,
) {
  const sessions = customer.user?.appSessions ?? [];
  const pushDevices = customer.user?.pushDevices ?? [];
  const latestSession = sessions[0];
  const refunds = bookings.flatMap((booking) => [
    ...(booking.payment?.refunds ?? []),
    ...(booking.refunds ?? []),
  ]);
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length;
  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const cancelledBookings = bookings.filter((booking) =>
    ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status),
  ).length;
  const notes = (customer.auditLogs ?? []).filter((log) => log.action === 'customer.ops_note.add');
  const latestPaymentBooking = bookings.find((booking) => booking.payment);
  const frequentService = mostCommonLabel(bookings.map((booking) => bookingServiceLabel(booking)));
  const frequentPartner = mostCommonLabel(
    bookings
      .map(
        (booking) =>
          bookingPartnerDisplayName(booking),
      )
      .filter(Boolean) as string[],
  );

  return [
    {
      label: 'Customer ID',
      value: customer.id,
      helper: 'Internal admin identifier',
    },
    {
      label: 'Login method',
      value: customer.user?.phone ? 'Phone OTP' : 'Not captured',
      helper: 'Phone auth remains the primary customer login method',
    },
    {
      label: 'Gender',
      value: 'Not captured',
      helper: 'Customer app does not collect this field yet',
    },
    {
      label: 'Birth / age',
      value: 'Not captured',
      helper: 'Add later only if operations really needs it',
    },
    {
      label: 'Nationality / language',
      value: 'Not captured',
      helper: 'Designed for VN, EN, KO, ZH, and JA localization later',
    },
    {
      label: 'Signup source',
      value: 'Mobile app / phone',
      helper: 'Campaign attribution table is not connected yet',
    },
    {
      label: 'Account state',
      value: 'Open',
      helper: 'No customer suspension or deletion request is recorded',
    },
    {
      label: 'Recent login IP',
      value: latestSession?.ipAddress ?? 'Not saved',
      helper: latestSession ? formatDate(latestSession.lastSeenAt) : 'No app session recorded',
    },
    {
      label: 'Devices',
      value: `${sessions.length} session(s) / ${pushDevices.length} push device(s)`,
      helper: `${pushDevices.filter((device) => device.enabled).length} enabled push device(s)`,
    },
    {
      label: 'Bookings',
      value: `${bookings.length} total`,
      helper: `${activeBookings} active / ${completedBookings} completed / ${cancelledBookings} cancelled`,
    },
    {
      label: 'Frequently used service',
      value: frequentService ?? 'Not enough bookings',
      helper: 'Calculated from loaded booking history only',
    },
    {
      label: 'Preferred partner',
      value: frequentPartner ?? 'Not enough bookings',
      helper: 'Most repeated selected or preferred partner in this archive',
    },
    {
      label: 'Last payment',
      value: latestPaymentBooking?.payment?.method ?? 'No payment',
      helper: latestPaymentBooking?.payment
        ? `${latestPaymentBooking.payment.status} / ${formatMoney(Number(latestPaymentBooking.payment.amount ?? 0))}`
        : 'No payment row loaded',
    },
    {
      label: 'Refund records',
      value: refunds.length.toString(),
      helper: formatMoney(refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0)),
    },
    {
      label: 'Saved addresses',
      value: addresses.length.toString(),
      helper: addresses[0]?.value ?? 'No saved customer address',
    },
    {
      label: 'CS / admin notes',
      value: notes.length.toString(),
      helper: notes[0]?.createdAt ? `Latest ${formatDate(notes[0].createdAt)}` : 'No support note saved',
    },
    {
      label: 'Terms agreement',
      value: 'Not captured',
      helper: 'Customer agreement history table can be added in the Supabase phase',
    },
    {
      label: 'Withdrawal request',
      value: 'None recorded',
      helper: 'No customer deletion request table is connected yet',
    },
  ];
}

function buildCustomerOperatingLedger({
  customer,
  bookings,
  wallet,
  bookingStats,
  addresses,
  latestSession,
  pushDevices,
  notifications,
  activityRecords,
}: {
  customer: AdminCustomerDetail;
  bookings: AdminBookingDetail[];
  wallet: ReturnType<typeof buildCustomerWallet>;
  bookingStats: ReturnType<typeof buildBookingStats>;
  addresses: Array<{ key: string; label: string; value: string }>;
  latestSession?: AdminAppSession;
  pushDevices: CustomerPushDevice[];
  notifications: AdminNotification[];
  activityRecords: CustomerActivityRecord[];
}): CustomerOperatingLedgerRow[] {
  const latestBooking = bookings[0];
  const lastCompletedBooking = bookings.find((booking) => booking.status === 'COMPLETED');
  const chatRooms = bookings.filter((booking) => booking.chatRoom);
  const chatMessages = bookings.reduce((sum, booking) => sum + readChatMessages(booking).length, 0);
  const refundRows = bookings.reduce(
    (sum, booking) => sum + (booking.payment?.refunds?.length ?? 0) + (booking.refunds?.length ?? 0),
    0,
  );
  const enabledPushCount = pushDevices.filter((device) => device.enabled).length;
  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;
  const notes = (customer.auditLogs ?? []).filter((log) => log.action === 'customer.ops_note.add');

  return [
    {
      area: 'Account',
      status: customer.user?.phone ? 'Phone linked' : 'Phone missing',
      evidence: `${customer.user?.fullName ?? 'Unnamed customer'} / ${customer.user?.phone ?? 'No phone'} / joined ${formatDate(
        customer.user?.createdAt,
      )}`,
      href: `/customers/${customer.id}#customer-info`,
    },
    {
      area: 'Booking work',
      status: `${bookings.length} booking(s)`,
      evidence: `${bookingStats.active} active / ${bookingStats.completed} completed / ${bookingStats.cancelled} closed`,
      href: `/customers/${customer.id}#booking-history`,
    },
    {
      area: 'Latest booking',
      status: latestBooking ? latestBooking.status : 'No booking',
      evidence: latestBooking
        ? `${shortId(latestBooking.id)} / ${bookingServiceLabel(latestBooking)} / ${formatDate(
            latestBooking.scheduledStartAt ?? latestBooking.createdAt,
          )}`
        : 'No booking record loaded for this customer.',
      href: latestBooking ? `/bookings/${latestBooking.id}` : `/customers/${customer.id}#booking-history`,
    },
    {
      area: 'Last completed work',
      status: lastCompletedBooking ? shortId(lastCompletedBooking.id) : 'None',
      evidence: lastCompletedBooking
        ? `${bookingServiceLabel(lastCompletedBooking)} / ${formatDate(
            lastCompletedBooking.updatedAt ??
              lastCompletedBooking.scheduledEndAt ??
              lastCompletedBooking.scheduledStartAt,
          )}`
        : 'No completed service record loaded.',
      href: lastCompletedBooking ? `/bookings/${lastCompletedBooking.id}` : `/customers/${customer.id}#booking-history`,
    },
    {
      area: 'Chat archive',
      status: `${chatRooms.length} room(s)`,
      evidence: `${chatMessages} retained message(s). Admin keeps chat after mobile chat hides.`,
      href: `/customers/${customer.id}#chat-history`,
    },
    {
      area: 'Payment and wallet',
      status: formatMoney(wallet.capturedSpend),
      evidence: `${formatMoney(wallet.pendingPaymentAmount)} pending or authorized / ${refundRows} refund row(s) / ${formatMoney(
        wallet.cashBookingAmount,
      )} cash booking amount`,
      href: `/customers/${customer.id}#wallet`,
    },
    {
      area: 'Addresses',
      status: addresses.length ? `${addresses.length} saved` : 'No saved address',
      evidence: addresses[0]?.value ?? 'No customer address or selected map pin loaded.',
      href: `/customers/${customer.id}#addresses`,
    },
    {
      area: 'App access',
      status: latestSession ? 'Session saved' : 'No session',
      evidence: latestSession
        ? `${latestSession.platform ?? 'Unknown platform'} / ${latestSession.ipAddress ?? 'No IP'} / ${formatDate(
            latestSession.lastSeenAt,
          )}`
        : 'No customer app session row loaded.',
      href: `/customers/${customer.id}#customer-info`,
    },
    {
      area: 'Devices and notices',
      status: `${enabledPushCount} push-ready`,
      evidence: `${pushDevices.length} push device(s) / ${notifications.length} notification row(s) / ${unreadNotifications} unread`,
      href: `/customers/${customer.id}#notifications`,
    },
    {
      area: 'Activity timeline',
      status: `${activityRecords.length} event(s)`,
      evidence: 'Date-ordered factual booking, work, chat, payment, address, app, and support records.',
      href: `/customers/${customer.id}#customer-activity`,
    },
    {
      area: 'Operator notes',
      status: `${notes.length} note(s)`,
      evidence: `${customer.auditLogs?.length ?? 0} customer-linked audit row(s) retained for staff handoff.`,
      href: `/customers/${customer.id}#audit-trail`,
    },
  ];
}

function buildCustomerActivityPlan(
  customer: AdminCustomerDetail,
  bookings: AdminBookingDetail[],
  wallet: ReturnType<typeof buildCustomerWallet>,
  bookingStats: ReturnType<typeof buildBookingStats>,
  addresses: Array<{ key: string; label: string; value: string }>,
) {
  const latestBooking = bookings[0];
  const lastCompletedBooking = bookings.find((booking) => booking.status === 'COMPLETED');
  const unreadNotifications =
    customer.user?.notifications?.filter((notification) => !notification.readAt).length ?? 0;
  const paymentIssueCount = bookings.filter((booking) => {
    return booking.payment && !['AUTHORIZED', 'CAPTURED'].includes(booking.payment.status);
  }).length;
  const chatArchiveCount = bookings.filter((booking) => booking.chatRoom).length;
  const missingAddress = addresses.length === 0;
  const activityFacts = [
    bookingStats.active > 0 ? `${bookingStats.active} active booking(s)` : null,
    bookingStats.completed > 0 ? `${bookingStats.completed} completed work record(s)` : null,
    paymentIssueCount > 0 ? `${paymentIssueCount} payment status row(s)` : null,
    wallet.refundAmount > 0 ? `${formatMoney(wallet.refundAmount)} refund record(s)` : null,
    chatArchiveCount > 0 ? `${chatArchiveCount} archived chat room(s)` : null,
    missingAddress ? 'No saved address' : null,
  ].filter(Boolean) as string[];
  const tone: 'success' | 'info' = latestBooking ? 'info' : 'success';
  const primaryHref = latestBooking?.id ? `/bookings/${latestBooking.id}` : '/customers';
  const primaryAction = latestBooking?.id ? 'Open latest booking' : 'Back to customers';
  return {
    tone,
    status: latestBooking ? 'Activity recorded' : 'No bookings yet',
    headline: activityFacts.length > 0 ? activityFacts.join(' / ') : 'No customer booking activity yet.',
    detail:
      activityFacts.length > 0
        ? 'Use this panel to leave factual notes for the next operator.'
        : 'When this customer books, the profile, booking, payment, chat archive, and address records will appear here.',
    primaryHref,
    primaryAction,
    cards: [
      {
        title: 'Latest booking',
        value: latestBooking ? `${shortId(latestBooking.id)} / ${latestBooking.status}` : 'None',
        detail: latestBooking ? bookingServiceLabel(latestBooking) : 'No reservation history yet',
        href: latestBooking ? `/bookings/${latestBooking.id}` : '/bookings',
      },
      {
        title: 'Last completed work',
        value: lastCompletedBooking ? shortId(lastCompletedBooking.id) : 'None',
        detail: lastCompletedBooking
          ? `${bookingServiceLabel(lastCompletedBooking)} / ${formatDate(lastCompletedBooking.updatedAt ?? lastCompletedBooking.scheduledStartAt ?? lastCompletedBooking.createdAt)}`
          : 'No finished service record',
        href: lastCompletedBooking ? `/bookings/${lastCompletedBooking.id}` : '/bookings',
      },
      {
        title: 'Payment records',
        value: `${paymentIssueCount} non-captured row(s)`,
        detail: `${formatMoney(wallet.refundAmount)} refund records`,
        href: '/payments',
      },
      {
        title: 'Chat archive',
        value: `${chatArchiveCount} room(s)`,
        detail: 'App chat closes after completion; admin keeps the archive',
        href: latestBooking ? `/bookings/${latestBooking.id}#chat` : '/bookings?view=chat',
      },
      {
        title: 'Saved locations',
        value: addresses.length ? `${addresses.length} saved` : 'Missing',
        detail: missingAddress ? 'No stored address row' : 'Profile and selected pins exist',
        href: latestBooking ? `/bookings/${latestBooking.id}#customer` : '/customers',
      },
      {
        title: 'Notifications',
        value: `${unreadNotifications} unread`,
        detail: `${customer.user?.pushDevices?.filter((device) => device.enabled).length ?? 0} enabled push device(s)`,
        href: '/notifications',
      },
      {
        title: 'Operator notes',
        value: `${customer.auditLogs?.length ?? 0} logs`,
        detail: 'Recent customer-linked audit actions',
        href: '/audit-log',
      },
    ],
    badges: [
      {
        label: bookingStats.active ? 'Live booking' : 'No live booking',
        tone: bookingStats.active ? 'warn' : 'success',
      },
      { label: `${bookingStats.completed} completed`, tone: 'success' },
      { label: `${chatArchiveCount} chat archive(s)`, tone: 'info' },
      {
        label: missingAddress ? 'Address not saved' : 'Address saved',
        tone: missingAddress ? 'warn' : 'success',
      },
    ],
    presets: [
      'Customer contacted; waiting for reply.',
      'Address confirmed with customer.',
      'Payment record checked.',
      'Chat archive reviewed.',
      'Booking completion confirmed.',
      'Customer asked to update saved address.',
    ],
  };
}

function buildAddressRows(customer: AdminCustomerDetail) {
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (Array.isArray(customer.addresses)) {
    customer.addresses.forEach((address, index) => {
      rows.push({
        key: `profile-${index}`,
        label: `Profile address ${index + 1}`,
        value: stringifyAddress(address),
      });
    });
  } else if (customer.addresses) {
    rows.push({
      key: 'profile-address',
      label: 'Profile address',
      value: stringifyAddress(customer.addresses),
    });
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
    return dateMs(left.createdAt) - dateMs(right.createdAt);
  });
}

function buildCustomerActivityRecords(
  customer: AdminCustomerDetail,
  bookings: AdminBookingDetail[],
  addresses: Array<{ key: string; label: string; value: string }>,
) {
  const records: CustomerActivityRecord[] = [];

  if (customer.user?.createdAt) {
    records.push({
      id: customer.user.id ?? customer.id,
      type: 'ACCOUNT',
      at: customer.user.createdAt,
      title: 'Customer account created',
      detail: `${customer.user.fullName ?? 'Unnamed customer'} / ${customer.user.phone ?? 'No phone'}`,
    });
  }

  for (const booking of bookings) {
    records.push({
      id: booking.id,
      type: 'BOOKING',
      at: booking.createdAt ?? booking.scheduledStartAt ?? '',
      title: `${booking.status} booking ${shortId(booking.id)}`,
      detail: `${bookingServiceLabel(booking)} / partner ${bookingPartnerDisplayName(
        booking,
      )} / requested ${formatDate(booking.scheduledStartAt)}${
        isClosedCustomerBooking(booking) ? ` / ${bookingClosureLabel(booking)}` : ''
      }`,
      href: `/bookings/${booking.id}`,
    });
    if (isClosedCustomerBooking(booking) && booking.closedAt) {
      records.push({
        id: `${booking.id}-closure`,
        type: 'BOOKING',
        at: booking.closedAt,
        title: `Booking closed ${shortId(booking.id)}`,
        detail: bookingClosureLabel(booking),
        href: `/bookings/${booking.id}`,
      });
    }

    if (booking.status === 'COMPLETED') {
      records.push({
        id: `${booking.id}-completed`,
        type: 'WORK',
        at: booking.updatedAt ?? booking.scheduledEndAt ?? booking.scheduledStartAt ?? '',
        title: `Completed work ${shortId(booking.id)}`,
        detail: `${bookingServiceLabel(booking)} / ${formatMoney(bookingTotal(booking))}`,
        href: `/bookings/${booking.id}`,
      });
    }

    if (booking.payment) {
      records.push({
        id: booking.payment.id ?? `${booking.id}-payment`,
        type: 'PAYMENT',
        at: booking.updatedAt ?? booking.createdAt ?? '',
        title: `${booking.payment.status} payment`,
        detail: `${booking.payment.method} / ${formatMoney(Number(booking.payment.amount ?? 0), booking.payment.currency ?? 'VND')}`,
        href: '/payments',
      });
    }

    if (booking.earning) {
      records.push({
        id: booking.earning.id,
        type: 'PAYMENT',
        at: booking.earning.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
        title: `${booking.earning.status} partner earning`,
        detail: `Gross ${formatMoney(Number(booking.earning.grossAmount ?? 0))} / platform fee ${formatMoney(
          Number(booking.earning.platformFee ?? 0),
        )} / net ${formatMoney(Number(booking.earning.netAmount ?? 0))}`,
        href: '/earnings',
      });

    }

    for (const ledger of booking.walletLedgerEntries ?? []) {
      records.push({
        id: ledger.id,
        type: 'PAYMENT',
        at: ledger.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
        title: `${ledger.type} wallet ledger`,
        detail: `${formatMoney(Number(ledger.amount ?? 0), ledger.currency ?? 'VND')} / ${
          ledger.notes ?? ledger.reference ?? ledger.sourceKey
        }`,
        href: '/earnings',
      });
    }

    for (const feeLog of booking.platformFeeLogs ?? []) {
      records.push({
        id: feeLog.id,
        type: 'PAYMENT',
        at: feeLog.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
        title: 'Platform fee log',
        detail: `${formatMoney(Number(feeLog.platformFeeAmount ?? 0), feeLog.currency ?? 'VND')} / gross ${formatMoney(
          Number(feeLog.grossAmount ?? 0),
          feeLog.currency ?? 'VND',
        )}`,
        href: '/earnings',
      });
    }

    for (const taxLog of booking.taxLogs ?? []) {
      records.push({
        id: taxLog.id,
        type: 'PAYMENT',
        at: taxLog.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
        title: 'Tax withholding log',
        detail: `${formatMoney(Number(taxLog.withholdingAmount ?? 0), taxLog.currency ?? 'VND')} / taxable ${formatMoney(
          Number(taxLog.taxableAmount ?? 0),
          taxLog.currency ?? 'VND',
        )}`,
        href: '/tax-policy',
      });
    }

    const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
    for (const refund of refunds) {
      const reason = 'reason' in refund ? refund.reason : undefined;
      records.push({
        id: refund.id,
        type: 'REFUND',
        at: refund.createdAt ?? booking.updatedAt ?? booking.createdAt ?? '',
        title: `${refund.status} refund`,
        detail: `${formatMoney(Number(refund.amount ?? 0))}${reason ? ` / ${reason}` : ''}`,
        href: '/refunds',
      });
    }

    for (const participant of booking.participants ?? []) {
      records.push({
        id: participant.id,
        type: 'BOOKING',
        at: participant.respondedAt ?? participant.joinedAt ?? booking.createdAt ?? '',
        title: `${participant.status} partner participant`,
        detail: `${participant.providerProfile?.displayName ?? participant.providerProfile?.user?.fullName ?? 'Partner'} / ${
          participant.distanceMeters != null ? `${participant.distanceMeters}m` : 'distance not stored'
        }`,
        href: `/bookings/${booking.id}`,
      });
    }

    for (const message of readChatMessages(booking)) {
      records.push({
        id: message.id,
        type: 'CHAT',
        at: message.createdAt,
        title: `Message in booking ${shortId(booking.id)}`,
        detail: `${message.sender?.fullName ?? message.sender?.phone ?? message.sender?.roles?.join(', ') ?? 'Unknown sender'}: ${compactText(
          message.body,
          96,
        )}`,
        href: `/bookings/${booking.id}#chat`,
      });
    }

    for (const task of booking.opsTasks ?? []) {
      records.push({
        id: task.id,
        type: 'OPS',
        at: task.updatedAt,
        title: `${task.status} ${task.type}`,
        detail: `${task.note ?? 'No note'} / actor ${task.actor?.fullName ?? task.actor?.phone ?? 'System'}`,
        href: `/bookings/${booking.id}`,
      });
    }
  }

  for (const location of customer.selectedLocations ?? []) {
    records.push({
      id: location.id,
      type: 'ADDRESS',
      at: location.createdAt,
      title: 'Customer selected service location',
      detail: `${location.addressText} / ${location.latitude}, ${location.longitude}`,
      href: '#addresses',
    });
  }

  for (const address of addresses.filter((item) => item.key.startsWith('profile-'))) {
    records.push({
      id: address.key,
      type: 'ADDRESS',
      at: customer.user?.updatedAt ?? customer.user?.createdAt ?? '',
      title: address.label,
      detail: address.value,
      href: '#addresses',
    });
  }

  for (const session of customer.user?.appSessions ?? []) {
    records.push({
      id: session.id,
      type: 'SESSION',
      at: session.lastSeenAt,
      title: `${session.active ? 'Active' : 'Inactive'} customer app session`,
      detail: `${session.platform ?? 'Unknown platform'} / ${session.appVersion ?? 'No app version'} / device ${session.deviceId}`,
      href: '#customer-info',
    });
  }

  for (const device of customer.user?.pushDevices ?? []) {
    records.push({
      id: device.id,
      type: 'DEVICE',
      at: device.updatedAt ?? device.createdAt ?? '',
      title: `${device.enabled ? 'Enabled' : 'Disabled'} push device`,
      detail: `${device.platform} / ${device.deliveries?.[0]?.status ?? 'No delivery attempt'}`,
      href: '#customer-info',
    });

    for (const delivery of device.deliveries ?? []) {
      records.push({
        id: delivery.id,
        type: 'DEVICE',
        at: delivery.attemptedAt,
        title: `${delivery.status} push delivery`,
        detail: `${delivery.provider} / device ${device.platform}`,
        href: '/notifications',
      });
    }
  }

  for (const notification of customer.user?.notifications ?? []) {
    records.push({
      id: notification.id,
      type: 'NOTICE',
      at: notification.createdAt,
      title: displayMarketplaceText(notification.title),
      detail: `${notification.type} / ${notification.readAt ? `read ${formatDate(notification.readAt)}` : 'unread'} / ${
        notification.deliveries?.[0]?.status ?? 'No delivery'
      }`,
      href: '/notifications',
    });

    for (const delivery of notification.deliveries ?? []) {
      records.push({
        id: delivery.id ?? `${notification.id}-${delivery.provider}-${delivery.attemptedAt}`,
        type: 'NOTICE',
        at: delivery.attemptedAt,
        title: `${delivery.status} notification delivery`,
        detail: `${delivery.provider} / ${displayMarketplaceText(notification.title)}`,
        href: '/notifications',
      });
    }
  }

  for (const review of customer.reviews ?? []) {
    records.push({
      id: review.id,
      type: 'REVIEW',
      at: review.createdAt ?? '',
      title: `Service feedback left for ${review.providerProfile?.displayName ?? 'partner'}`,
      detail: `Feedback level ${review.rating}/5 / ${reviewBookingServiceLabel(review.booking)}`,
      href: '/reviews',
    });
  }

  for (const log of customer.auditLogs ?? []) {
    records.push({
      id: log.id,
      type: 'AUDIT',
      at: log.createdAt,
      title: log.action,
      detail: `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${compactJson(log.metadata)}`,
      href: '/audit-log',
    });
  }

  return records
    .filter((record) => Boolean(record.at))
    .sort((left, right) => dateMs(right.at) - dateMs(left.at));
}

function buildCustomerActivitySummary(
  records: Array<{ id: string; type: string; at: string; title: string; detail: string }>,
) {
  const count = (types: string[]) => records.filter((record) => types.includes(record.type)).length;
  const latestAt = records[0]?.at;
  const oldestAt = records[records.length - 1]?.at;

  return [
    {
      label: 'Loaded range',
      value: latestAt ? formatDate(latestAt) : 'None',
      helper: oldestAt ? `Oldest loaded: ${formatDate(oldestAt)}` : 'No customer activity in this period.',
    },
    {
      label: 'Bookings and work',
      value: count(['BOOKING', 'WORK']).toString(),
      helper: 'Booking creation, status, and completed service records.',
    },
    {
      label: 'Chat archive',
      value: count(['CHAT']).toString(),
      helper: 'Messages retained for admin after mobile chat is hidden.',
    },
    {
      label: 'Payment records',
      value: count(['PAYMENT', 'REFUND']).toString(),
      helper: 'Captured, pending, refunded, or disputed payment events.',
    },
    {
      label: 'Address and app',
      value: count(['ADDRESS', 'SESSION', 'DEVICE']).toString(),
      helper: 'Saved locations, app sessions, and push device changes.',
    },
    {
      label: 'Support trail',
      value: count(['NOTICE', 'REVIEW', 'OPS', 'AUDIT']).toString(),
      helper: 'Notifications, reviews, staff notes, and audit records.',
    },
  ];
}

function bookingTotal(booking: AdminBookingDetail) {
  return (booking.services ?? []).reduce(
    (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 1),
    0,
  );
}

function bookingServiceLabel(booking: AdminBookingDetail) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function mostCommonLabel(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === 'No service') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function reviewBookingServiceLabel(booking?: { services?: AdminBookingDetail['services'] }) {
  const first = booking?.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function bookingStatusOperatorHint(booking: AdminBookingDetail) {
  if (ACTIVE_STATUSES.includes(booking.status)) return 'Live booking';
  if (booking.status === 'COMPLETED') return 'Closeout done';
  if (booking.status === 'NO_SHOW') return 'No-show record';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status)) return 'Closed booking record';
  return 'Historical row';
}

function isClosedCustomerBooking(booking: AdminBookingDetail) {
  return CLOSED_BOOKING_STATUSES.includes(booking.status);
}

function bookingClosureLabel(booking: AdminBookingDetail) {
  const actor =
    booking.closedByRole === 'CUSTOMER'
      ? 'customer'
      : booking.closedByRole === 'PROVIDER'
        ? 'partner'
        : booking.closedByRole === 'ADMIN'
          ? 'admin'
          : 'system';
  const reason = booking.closedReason ? booking.closedReason.replace(/_/g, ' ') : 'no reason saved';
  const note = booking.closedNote ? ` / ${compactText(booking.closedNote, 90)}` : '';
  return `${actor} closure / ${reason}${note}`;
}

function bookingChatArchiveLabel(booking: AdminBookingDetail) {
  if (booking.chatRoom) {
    if (booking.status === 'COMPLETED') return 'Archived for admin after completion';
    if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
      return 'Live customer-partner room';
    }
    return 'Chat room retained';
  }
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status)) {
    return 'Follow up: matched bookings should have chat';
  }
  return 'No match chat yet';
}

function bookingStatusPillClass(status: string) {
  if (ACTIVE_STATUSES.includes(status)) return 'pill-info';
  if (status === 'COMPLETED') return 'pill-success';
  if (status === 'NO_SHOW') return 'pill-danger';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(status)) return 'pill-warn';
  return 'pill-neutral';
}

function customerSupportPillClass(tone: string) {
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-success';
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

function compactJson(value: unknown) {
  if (!value) return 'No metadata';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function compactText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function displayMarketplaceText(value?: string | null) {
  return (value ?? '')
    .replace(/\bbackup\b/g, 'marketplace')
    .replace(/\bBackup\b/g, 'Marketplace')
    .replace(/\bProvider\b/g, 'Partner')
    .replace(/\bprovider\b/g, 'partner');
}

function bookingPartnerDisplayName(booking: AdminBookingDetail) {
  return displayMarketplaceText(
    booking.selectedProvider?.displayName ??
      booking.preferredProvider?.displayName ??
      booking.selectedProvider?.user?.fullName ??
      booking.preferredProvider?.user?.fullName ??
      'No partner',
  );
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
