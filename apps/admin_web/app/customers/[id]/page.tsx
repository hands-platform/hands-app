import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetricCard } from '../../../components/metric-card';
import {
  AdminAppSession,
  AdminAuditLog,
  AdminBookingDetail,
  AdminChatMessage,
  AdminCustomerDetail,
  AdminNotification,
  adminGet,
} from '../../../lib/admin-api';
import { marketplaceDisplayText as displayMarketplaceText } from '../../../lib/admin-copy';
import {
  formatDateTime,
  formatDistanceMeters,
  formatMoney as formatAdminMoney,
  shortId as formatShortId,
} from '../../../lib/admin-format';
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
const DETAIL_ACTIVITY_ORDER_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;
type DetailActivityOrder = (typeof DETAIL_ACTIVITY_ORDER_OPTIONS)[number]['value'];

const CUSTOMER_ACTIVITY_TYPE_OPTIONS = [
  { value: 'all', label: 'All event types', types: [] },
  { value: 'booking_work', label: 'Bookings and completed work', types: ['BOOKING', 'WORK'] },
  { value: 'chat', label: 'Chat archive', types: ['CHAT'] },
  { value: 'payment', label: 'Payments and refunds', types: ['PAYMENT', 'REFUND'] },
  {
    value: 'address_app',
    label: 'Account, addresses, sessions, devices',
    types: ['ACCOUNT', 'ADDRESS', 'SESSION', 'DEVICE'],
  },
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
  const activityOrder = readDetailActivityOrder(detailSearchParams);
  const customer = await adminGet<AdminCustomerDetail | null>(`/admin/customers/${id}`, null);

  if (!customer) {
    notFound();
  }

  const bookings = customer.bookings ?? [];
  const wallet = buildCustomerWallet(bookings);
  const bookingStats = buildBookingStats(bookings);
  const addresses = buildAddressRows(customer);
  const latestBooking = bookings[0];
  const activeBooking = bookings.find((booking) => ACTIVE_STATUSES.includes(booking.status));
  const lastCompletedBooking = bookings.find((booking) => booking.status === 'COMPLETED');
  const latestChatBooking = bookings.find((booking) => booking.chatRoom);
  const latestPaymentBooking = bookings.find((booking) => booking.payment);
  const latestRefundBooking = bookings.find(
    (booking) => (booking.payment?.refunds?.length ?? 0) > 0 || (booking.refunds?.length ?? 0) > 0,
  );
  const latestAddressSnapshotBooking = bookings.find((booking) => booking.addressSnapshot);
  const latestOpsBooking = bookings.find(
    (booking) => bookingOpsTaskCount(booking) > 0 || bookingAuditLogCount(booking) > 0,
  );
  const latestPartnerBooking = bookings.find(
    (booking) => booking.selectedProviderId || booking.preferredProviderId,
  );
  const latestSession = customer.user?.appSessions?.[0];
  const pushDevices = customer.user?.pushDevices ?? [];
  const notifications = customer.user?.notifications ?? [];
  const activityPlan = buildCustomerActivityPlan(customer, bookings, wallet, bookingStats, addresses);
  const chatRooms = bookings.filter((booking) => booking.chatRoom);
  const chatMessageCount = chatRooms.reduce(
    (sum, booking) => sum + (booking.chatRoom?.messages?.length ?? 0),
    0,
  );
  const customerPaymentCount = bookings.filter((booking) => booking.payment).length;
  const customerActivityRecords = buildCustomerActivityRecords(customer, bookings, addresses);
  const recentAuditLogs = customer.auditLogs ?? [];
  const filteredBookings = bookings.filter((booking) =>
    isWithinDetailDateFilter(booking.createdAt ?? booking.updatedAt ?? booking.scheduledStartAt, dateFilters),
  );
  const filteredChatBookings = bookings.filter((booking) => {
    if (!booking.chatRoom) return false;
    return (
      isWithinDetailDateFilter(
        booking.createdAt ?? booking.updatedAt ?? booking.scheduledStartAt,
        dateFilters,
      ) ||
      readChatMessages(booking).some((message) => isWithinDetailDateFilter(message.createdAt, dateFilters))
    );
  });
  const customerChatRetentionRows = buildCustomerChatRetentionRows(filteredBookings);
  const customerChatRetentionSummary = buildCustomerChatRetentionSummary(customerChatRetentionRows);
  const customerBookingOpsLedgerRows = buildCustomerBookingOpsLedgerRows(filteredBookings);
  const filteredCustomerActivityRecords = orderCustomerActivityRecords(
    customerActivityRecords.filter(
      (record) =>
        isWithinDetailDateFilter(record.at, dateFilters) &&
        isWithinDetailActivityType(record.type, activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS),
    ),
    activityOrder,
  );
  const customerBookingEvidenceRows = buildCustomerBookingEvidenceRows(filteredBookings);
  const customerBookingJourneyRows = buildCustomerBookingJourneyRows(filteredBookings);
  const customerActivitySummary = buildCustomerActivitySummary(filteredCustomerActivityRecords);
  const customerDailyActivityDigest = buildCustomerDailyActivityDigest(
    filteredCustomerActivityRecords,
    activityOrder,
  );
  const filteredNotifications = notifications.filter((notification) =>
    isWithinDetailDateFilter(notification.createdAt, dateFilters),
  );
  const customerOperationsDigest = buildCustomerOperationsDigest({
    customer,
    bookings: filteredBookings,
    wallet,
    bookingStats,
    addresses,
    latestSession,
    pushDevices,
    notifications: filteredNotifications,
    activityRecords: filteredCustomerActivityRecords,
  });
  const filteredAuditLogs = recentAuditLogs.filter((log) =>
    isWithinDetailDateFilter(log.createdAt, dateFilters),
  );
  const bookingCreateGateAttempts = buildCustomerBookingGateAttemptRows(recentAuditLogs, customer.id);
  const filteredBookingCreateGateAttempts = buildCustomerBookingGateAttemptRows(
    filteredAuditLogs,
    customer.id,
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
  const connectedCustomerRecordLinks = [
    {
      label: 'Active booking',
      value: activeBooking ? shortId(activeBooking.id) : 'None',
      detail: activeBooking
        ? `${activeBooking.status} / ${bookingServiceLabel(activeBooking)}`
        : 'No live customer booking is currently loaded.',
      href: activeBooking ? `/bookings/${activeBooking.id}` : '#booking-history',
      tone: activeBooking ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: 'Latest booking',
      value: latestBooking ? shortId(latestBooking.id) : 'None',
      detail: latestBooking
        ? `${latestBooking.status} / ${bookingServiceLabel(latestBooking)}`
        : 'No booking has been created for this customer.',
      href: latestBooking ? `/bookings/${latestBooking.id}` : '#booking-history',
      tone: latestBooking ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Blocked create attempts',
      value: `${bookingCreateGateAttempts.length} attempt(s)`,
      detail: bookingCreateGateAttempts[0]
        ? `${bookingCreateGateAttempts[0].gateLabel} / latest ${formatDate(bookingCreateGateAttempts[0].at)}`
        : 'No booking create gate attempt is linked to this customer.',
      href: bookingCreateGateAttempts[0]?.bookingMonitorHref ?? '/bookings?view=blocked-create',
      tone: bookingCreateGateAttempts.length ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: 'Last completed work',
      value: lastCompletedBooking ? shortId(lastCompletedBooking.id) : 'None',
      detail: lastCompletedBooking
        ? formatDate(lastCompletedBooking.updatedAt ?? lastCompletedBooking.createdAt)
        : 'No completed service record yet.',
      href: lastCompletedBooking ? `/bookings/${lastCompletedBooking.id}` : '#booking-history',
      tone: lastCompletedBooking ? 'pill-success' : 'pill-neutral',
    },
    {
      label: 'Latest partner link',
      value: latestPartnerBooking
        ? shortId(latestPartnerBooking.selectedProviderId ?? latestPartnerBooking.preferredProviderId ?? '')
        : 'None',
      detail: latestPartnerBooking
        ? `${bookingPartnerDisplayName(latestPartnerBooking)} / booking ${shortId(latestPartnerBooking.id)}`
        : 'No preferred or final partner is attached to the loaded booking records.',
      href:
        latestPartnerBooking?.selectedProviderId || latestPartnerBooking?.preferredProviderId
          ? `/partners/${latestPartnerBooking.selectedProviderId ?? latestPartnerBooking.preferredProviderId}`
          : '#booking-history',
      tone: latestPartnerBooking ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Chat archive',
      value: `${chatMessageCount} message(s)`,
      detail: latestChatBooking
        ? `Latest room ${shortId(latestChatBooking.chatRoom?.id)} / ${chatRooms.length} retained room(s).`
        : 'No customer-partner chat archive is attached yet.',
      href: latestChatBooking
        ? `/chat-archive?q=${encodeURIComponent(latestChatBooking.id)}`
        : `/chat-archive?q=${encodeURIComponent(customer.id)}`,
      tone: chatRooms.length ? 'pill-success' : 'pill-neutral',
    },
    {
      label: 'Address snapshot',
      value: latestAddressSnapshotBooking ? shortId(latestAddressSnapshotBooking.id) : 'None',
      detail: latestAddressSnapshotBooking
        ? bookingAddressEvidenceLabel(latestAddressSnapshotBooking)
        : 'No immutable booking address snapshot is loaded yet.',
      href: latestAddressSnapshotBooking
        ? `/bookings/${latestAddressSnapshotBooking.id}#address-evidence`
        : '#addresses',
      tone: latestAddressSnapshotBooking ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'Payment records',
      value: formatMoney(wallet.capturedSpend),
      detail: latestPaymentBooking
        ? `${customerPaymentCount} payment row(s), latest ${latestPaymentBooking.payment?.status ?? 'UNKNOWN'} on ${shortId(
            latestPaymentBooking.id,
          )}.`
        : `${customerPaymentCount} payment row(s), ${wallet.refundCount} refund row(s).`,
      href: latestPaymentBooking
        ? `/bookings/${latestPaymentBooking.id}#payment-evidence`
        : `/payments?customer=${encodeURIComponent(customer.id)}`,
      tone: customerPaymentCount ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Refund records',
      value: formatMoney(wallet.refundAmount),
      detail: latestRefundBooking
        ? `Latest refund evidence is on booking ${shortId(latestRefundBooking.id)}.`
        : 'No refund row loaded.',
      href: latestRefundBooking ? `/bookings/${latestRefundBooking.id}#refund-evidence` : '#wallet',
      tone: wallet.refundCount ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: 'Saved locations',
      value: `${addresses.length} location(s)`,
      detail: addresses[0]?.value ?? 'No saved address or selected map pin.',
      href: '#addresses',
      tone: addresses.length ? 'pill-success' : 'pill-warn',
    },
    {
      label: 'App sessions',
      value: latestSession ? 'Seen' : 'None',
      detail: latestSession
        ? `${latestSession.platform ?? 'Unknown'} / ${formatDate(latestSession.lastSeenAt)}`
        : 'No app session loaded.',
      href: customer.user?.id
        ? `/app-sessions?user=${encodeURIComponent(customer.user.id)}`
        : '#customer-info',
      tone: latestSession ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Booking ops records',
      value: latestOpsBooking ? shortId(latestOpsBooking.id) : 'None',
      detail: latestOpsBooking
        ? `${bookingOpsTaskCount(latestOpsBooking)} task(s), ${bookingAuditLogCount(
            latestOpsBooking,
          )} audit row(s).`
        : 'No booking-level operator task is attached yet.',
      href: latestOpsBooking ? `/bookings/${latestOpsBooking.id}#ops-evidence` : '#customer-activity',
      tone: latestOpsBooking ? 'pill-info' : 'pill-neutral',
    },
    {
      label: 'Operator notes',
      value: `${recentAuditLogs.length} note(s)`,
      detail: recentAuditLogs[0]?.action ?? 'No operator note loaded.',
      href: `/audit-log?target=${encodeURIComponent(`customer:${customer.id}`)}`,
      tone: recentAuditLogs.length ? 'pill-info' : 'pill-neutral',
    },
  ];
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
  const customerOperationsQuickRail = [
    {
      href: '#customer-operations-digest',
      label: 'Digest',
      value: `${customerOperationsDigest.length} lanes`,
      detail: 'One-screen customer operations state.',
    },
    {
      href: '#customer-connected-operations-records',
      label: 'Linked records',
      value: `${connectedCustomerRecordLinks.length} links`,
      detail: 'Booking, chat, payment, refund, address, session, and staff links.',
    },
    {
      href: '#booking-history',
      label: 'Bookings',
      value: `${bookings.length}`,
      detail: `${bookingStats.completed} completed / ${bookingStats.active} active.`,
    },
    {
      href: '#customer-chat-retention-ledger',
      label: 'Chat archive',
      value: `${chatMessageCount} messages`,
      detail: `${chatRooms.length} retained room(s), hidden from mobile after completion.`,
    },
    {
      href: '#wallet',
      label: 'Wallet',
      value: formatMoney(wallet.capturedSpend),
      detail: `${wallet.refundCount} refund row(s), ${formatMoney(wallet.cashBookingAmount)} cash exposure.`,
    },
    {
      href: '#addresses',
      label: 'Addresses',
      value: `${addresses.length}`,
      detail: 'Saved locations and immutable booking address snapshots.',
    },
    {
      href: '#customer-activity',
      label: 'Activity',
      value: `${filteredCustomerActivityRecords.length}`,
      detail: `${dateFilters.label}, ${detailActivityTypeLabel(activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS)}.`,
    },
  ];
  const customerOperatorFirstRead = [
    {
      href: '#customer-info',
      label: 'Identity',
      value: customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer',
      detail: `${customer.user?.phone ?? 'No phone'} / joined ${formatDate(customer.user?.createdAt)}`,
    },
    {
      href: activeBooking ? `/bookings/${activeBooking.id}` : '#booking-history',
      label: 'Current booking',
      value: activeBooking ? activeBooking.status : 'None',
      detail: activeBooking
        ? `${bookingServiceLabel(activeBooking)} / ${shortId(activeBooking.id)}`
        : 'No active booking is loaded now.',
    },
    {
      href: lastCompletedBooking ? `/bookings/${lastCompletedBooking.id}` : '#booking-history',
      label: 'Last completed work',
      value: lastCompletedBooking ? shortId(lastCompletedBooking.id) : 'None',
      detail: lastCompletedBooking
        ? `${bookingServiceLabel(lastCompletedBooking)} / ${formatDate(
            lastCompletedBooking.updatedAt ??
              lastCompletedBooking.scheduledStartAt ??
              lastCompletedBooking.createdAt,
          )}`
        : 'No completed service record yet.',
    },
    {
      href: '#customer-chat-retention-ledger',
      label: 'Retained chat',
      value: `${chatMessageCount} messages`,
      detail: `${chatRooms.length} room(s) retained for admin review after completion.`,
    },
    {
      href: '#wallet',
      label: 'Payments',
      value: formatMoney(wallet.capturedSpend),
      detail: `${wallet.refundCount} refund row(s), ${formatMoney(wallet.refundAmount)} refunded.`,
    },
    {
      href: '#addresses',
      label: 'Locations',
      value: `${addresses.length} saved`,
      detail:
        latestAddressSnapshotBooking?.addressSnapshot?.addressText ??
        addresses[0]?.value ??
        'No selected service address loaded.',
    },
  ];

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

      <section className="card" id="customer-operator-first-read" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer operator first read</h2>
            <p className="muted">
              The first facts an operator checks before opening the full customer record.
            </p>
          </div>
          <span className="pill pill-info">Above-fold summary</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {customerOperatorFirstRead.map((item) => (
            <a href={item.href} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </a>
          ))}
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

      <section className="card" id="customer-operations-quick-rail" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer operations quick rail</h2>
            <p className="muted">
              Fast jumps for support and operations. This keeps the customer page factual: bookings,
              completed work, retained chat, payments, addresses, sessions, and staff records.
            </p>
          </div>
          <span className="pill pill-info">{customerOperationsQuickRail.length} shortcuts</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {customerOperationsQuickRail.map((item) => (
            <a href={item.href} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="card" id="customer-recent-operations-timeline" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer recent operations timeline</h2>
            <p className="muted">
              Latest factual customer events in the order operators need them: app, address, booking, chat,
              payment, refund, review, and staff records.
            </p>
          </div>
          <Link className="text-link" href="#customer-activity">
            Open full timeline
          </Link>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {filteredCustomerActivityRecords.length > 0 ? (
            filteredCustomerActivityRecords.slice(0, 8).map((record) => (
              <div className="setup-stage-item" key={`recent-${record.type}-${record.id}-${record.at}`}>
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
                <strong>No customer event matched this filter</strong>
                <p className="muted">Clear the date filter or choose a wider period.</p>
              </div>
              <small>0</small>
            </div>
          )}
        </div>
      </section>

      <section className="card" id="customer-operations-digest" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer operations digest</h2>
            <p className="muted">
              One-screen factual digest for the customer desk. It keeps completed work, latest work, active
              booking, chat archive, payment, address, app access, and staff records together.
            </p>
          </div>
          <span className="pill pill-info">{customerOperationsDigest.length} lanes</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {customerOperationsDigest.map((row) => (
            <div className="setup-stage-item" key={row.lane}>
              <span>{row.lane}</span>
              <div>
                <Link className="text-link" href={row.href}>
                  <strong>{row.status}</strong>
                </Link>
                <p className="muted">{row.detail}</p>
                <div className="participant-list" style={{ marginTop: 8 }}>
                  {row.evidence.map((item) => (
                    <span className="pill pill-neutral" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <small>{row.latestAt ? formatDate(row.latestAt) : 'No date'}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="customer-connected-operations-records" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer connected operations records</h2>
            <p className="muted">
              Jump from this customer to the linked bookings, completed work, chat archive, payment, refund,
              saved location, app session, and operator records.
            </p>
          </div>
          <span className="pill pill-info">{connectedCustomerRecordLinks.length} links</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {connectedCustomerRecordLinks.map((record) => (
            <div key={record.label}>
              <span>{record.label}</span>
              <strong>{record.value}</strong>
              <small>{record.detail}</small>
              <Link className={`pill ${record.tone}`} href={record.href}>
                Open
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="customer-booking-create-gates" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer blocked create attempts</h2>
            <p className="muted">
              Booking creation attempts stopped before payment and matching. These rows show factual gate
              evidence for customer support and setup checks.
            </p>
          </div>
          <Link className="text-link" href="/bookings?view=blocked-create">
            Open gate queue
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Loaded attempts</span>
            <strong>{bookingCreateGateAttempts.length}</strong>
            <small>All recent customer-linked gate attempts.</small>
          </div>
          <div>
            <span>Filtered attempts</span>
            <strong>{filteredBookingCreateGateAttempts.length}</strong>
            <small>Matches current date filter.</small>
          </div>
          <div>
            <span>Latest gate</span>
            <strong>{bookingCreateGateAttempts[0]?.gateLabel ?? 'None'}</strong>
            <small>
              {bookingCreateGateAttempts[0] ? formatDate(bookingCreateGateAttempts[0].at) : 'No gate row'}
            </small>
          </div>
        </div>
        {filteredBookingCreateGateAttempts.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No booking create gate attempt matched this date filter.
          </p>
        ) : (
          <div className="setup-stage-list" style={{ marginTop: 14 }}>
            {filteredBookingCreateGateAttempts.slice(0, 12).map((attempt) => (
              <div className="setup-stage-item" key={attempt.id}>
                <span>{attempt.gateLabel}</span>
                <div>
                  <Link className="text-link" href={attempt.bookingMonitorHref}>
                    <strong>{attempt.reasonLabel}</strong>
                  </Link>
                  <p className="muted">{attempt.detail}</p>
                  <div className="participant-list" style={{ marginTop: 8 }}>
                    <span className={`pill ${attempt.tone}`}>{attempt.gateLabel}</span>
                    <span className="pill pill-neutral">{attempt.addressLabel}</span>
                    <span className="pill pill-neutral">{attempt.distanceLabel}</span>
                  </div>
                  <div className="participant-list" style={{ marginTop: 8 }}>
                    <Link className="text-link" href={attempt.bookingMonitorHref}>
                      Booking gate queue
                    </Link>
                    <Link className="text-link" href={attempt.auditHref}>
                      Audit evidence
                    </Link>
                  </div>
                </div>
                <small>{formatDate(attempt.at)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card" id="customer-booking-evidence-bundles" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer booking evidence bundles</h2>
            <p className="muted">
              Booking-by-booking operating bundle for customer desk review. Each row connects the
              selected address snapshot, partner state, chat archive, payment, refund, earning, wallet, tax,
              and staff task records as factual history only.
            </p>
          </div>
          <span className="pill pill-info">{customerBookingEvidenceRows.length} booking bundle(s)</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer location</th>
              <th>Partner flow</th>
              <th>Chat archive</th>
              <th>Money records</th>
              <th>Ops evidence</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {customerBookingEvidenceRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.bookingLabel}</strong>
                  <p className="muted">{row.serviceLabel}</p>
                  <span className={`pill ${bookingStatusPillClass(row.status)}`}>{row.status}</span>
                </td>
                <td>
                  <strong>{row.addressStatus}</strong>
                  <p className="muted">{row.addressDetail}</p>
                </td>
                <td>
                  <strong>{row.partnerStatus}</strong>
                  <p className="muted">{row.partnerDetail}</p>
                </td>
                <td>
                  <strong>{row.chatStatus}</strong>
                  <p className="muted">{row.chatDetail}</p>
                </td>
                <td>
                  <strong>{row.moneyStatus}</strong>
                  <p className="muted">{row.moneyDetail}</p>
                </td>
                <td>
                  <strong>{row.opsStatus}</strong>
                  <p className="muted">{row.opsDetail}</p>
                </td>
                <td>
                  <Link className="text-link" href={`/bookings/${row.id}`}>
                    Booking
                  </Link>
                  {row.chatHref ? (
                    <Link className="text-link" href={row.chatHref} style={{ marginLeft: 10 }}>
                      Chat
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customerBookingEvidenceRows.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No booking bundle matched this date filter.
          </p>
        ) : null}
      </section>

      <section className="card" id="customer-operator-command-queue" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
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

      <section className="card" id="customer-booking-journey" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer booking journey</h2>
            <p className="muted">
              Booking-by-booking journey for support review: service address, partner handoff,
              retained chat, payment rows, and staff records are grouped as factual records only.
            </p>
          </div>
          <span className="pill pill-info">{customerBookingJourneyRows.length} journey row(s)</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 14 }}>
          {customerBookingJourneyRows.length > 0 ? (
            customerBookingJourneyRows.map((row) => (
              <div className="setup-stage-item" key={`journey-${row.id}`}>
                <span>{row.status}</span>
                <div>
                  <Link className="text-link" href={`/bookings/${row.id}`}>
                    <strong>{row.heading}</strong>
                  </Link>
                  <p className="muted">{row.detail}</p>
                  <div className="participant-list" style={{ marginTop: 8 }}>
                    {row.steps.map((step) => (
                      <span className={`pill ${step.tone}`} key={`${row.id}-${step.label}`}>
                        {step.label}: {step.value}
                      </span>
                    ))}
                  </div>
                  <div className="participant-list" style={{ marginTop: 8 }}>
                    {row.links.map((link) => (
                      <Link className="text-link" href={link.href} key={link.label}>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <small>{row.latestAt ? formatDate(row.latestAt) : 'No date'}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No booking journey matched this filter</strong>
                <p className="muted">Use a wider date range to show older booking rows.</p>
              </div>
              <small>0</small>
            </div>
          )}
        </div>
      </section>

      <section className="card" id="customer-full-record-index" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer full record index</h2>
            <p className="muted">
              Factual customer record map for operators. This page shows booking, work, payment, chat,
              address, notification, app session, and operator history.
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
          <a href="#customer-daily-digest">
            <span>Daily digest</span>
            <strong>{customerDailyActivityDigest.length}</strong>
            <small>Date-grouped customer activity.</small>
          </a>
        </div>
      </section>

      <section className="card" id="customer-operating-ledger" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer operating ledger</h2>
            <p className="muted">
              Compact factual ledger for account, booking work, chat archive, payment, wallet, address, app
              device, notification, and operator history. This ledger is factual history only.
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
        <div className="ops-section-header">
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
            <span className="pill pill-neutral">{activityOrderLabel(activityOrder)}</span>
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
            Sort order
            <select name="order" defaultValue={activityOrder}>
              {DETAIL_ACTIVITY_ORDER_OPTIONS.map((option) => (
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
        <div className="ops-section-header">
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
        <div className="ops-section-header">
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
        <div className="ops-section-header">
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
        <div className="ops-section-header">
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
                  <p className="muted">{formatDate(booking.createdAt ?? booking.scheduledStartAt)}</p>
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
                <td>{bookingPartnerDisplayName(booking)}</td>
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

      <section className="card" id="customer-chat-retention-ledger" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer chat retention ledger</h2>
            <p className="muted">
              Matched bookings must create a chat room. Mobile apps can hide the room after completion, while
              admin keeps the full archive for cancellation, no-show, and service evidence review.
            </p>
          </div>
          <span className="pill pill-info">{customerChatRetentionRows.length} booking row(s)</span>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          {customerChatRetentionSummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Room state</th>
              <th>Latest message</th>
              <th>Mobile visibility</th>
              <th>Admin archive</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {customerChatRetentionRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.bookingLabel}</strong>
                  <p className="muted">{row.serviceLabel}</p>
                  <span className={`pill ${bookingStatusPillClass(row.status)}`}>{row.status}</span>
                </td>
                <td>
                  <strong>{row.roomStatus}</strong>
                  <p className="muted">{row.roomDetail}</p>
                </td>
                <td>
                  <strong>{row.latestSender}</strong>
                  <p className="muted">{row.latestMessage}</p>
                  <small>{row.latestMessageAt ? formatDate(row.latestMessageAt) : 'No message date'}</small>
                </td>
                <td>
                  <strong>{row.mobileVisibility}</strong>
                  <p className="muted">{row.mobileVisibilityDetail}</p>
                </td>
                <td>
                  <strong>{row.adminRetention}</strong>
                  <p className="muted">{row.adminRetentionDetail}</p>
                </td>
                <td>
                  <Link className="text-link" href={row.bookingHref}>
                    Booking
                  </Link>
                  {row.chatHref ? (
                    <Link className="text-link" href={row.chatHref} style={{ marginLeft: 10 }}>
                      Archive
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customerChatRetentionRows.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No booking row matched this date filter.
          </p>
        ) : null}
      </section>

      <section className="card" id="customer-booking-ops-ledger" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Booking operations note ledger</h2>
            <p className="muted">
              Booking-level notes, manual closeout context, and staff tasks linked to this customer. This is
              factual operator history for support follow-up and evidence review.
            </p>
          </div>
          <span className="pill pill-info">{customerBookingOpsLedgerRows.length} booking note row(s)</span>
        </div>
        <table className="table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Partner</th>
              <th>Manual notes</th>
              <th>Staff tasks</th>
              <th>Closeout context</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {customerBookingOpsLedgerRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.bookingLabel}</strong>
                  <p className="muted">{row.serviceLabel}</p>
                  <span className={`pill ${bookingStatusPillClass(row.status)}`}>{row.status}</span>
                </td>
                <td>{row.partnerLabel}</td>
                <td>
                  <strong>{row.noteStatus}</strong>
                  <p className="muted">{row.noteDetail}</p>
                </td>
                <td>
                  <strong>{row.taskStatus}</strong>
                  <p className="muted">{row.taskDetail}</p>
                </td>
                <td>
                  <strong>{row.closeoutStatus}</strong>
                  <p className="muted">{row.closeoutDetail}</p>
                </td>
                <td>
                  <Link className="text-link" href={row.bookingHref}>
                    Booking
                  </Link>
                  {row.chatHref ? (
                    <Link className="text-link" href={row.chatHref} style={{ marginLeft: 10 }}>
                      Chat
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customerBookingOpsLedgerRows.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No booking-level operation notes or staff tasks matched this customer date filter.
          </p>
        ) : null}
      </section>

      <section className="card" id="chat-history" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
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
                <div className="ops-section-header">
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
        <div className="ops-section-header">
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

      <section className="card" id="customer-daily-digest" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Customer daily activity digest</h2>
            <p className="muted">
              Date-grouped factual activity for quick operator review. Use this before opening the full
              chronological timeline.
            </p>
          </div>
          <span className="pill pill-info">{customerDailyActivityDigest.length} day(s)</span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {customerDailyActivityDigest.length > 0 ? (
            customerDailyActivityDigest.map((day) => (
              <div className="setup-stage-item" key={day.key}>
                <span>{day.label}</span>
                <div>
                  <strong>{day.total} event(s)</strong>
                  <p className="muted">
                    {day.typeCounts.map((item) => `${item.type} ${item.count}`).join(' / ')}
                  </p>
                  <div className="setup-stage-list" style={{ marginTop: 10 }}>
                    {day.highlights.map((record) => (
                      <div className="service-matrix-cell" key={`${record.type}-${record.id}-${record.at}`}>
                        <strong>{record.title}</strong>
                        <small>
                          {record.type} / {formatDate(record.at)}
                        </small>
                        <p className="muted" style={{ margin: 0 }}>
                          {record.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <small>{day.latestAt ? formatDate(day.latestAt) : 'No date'}</small>
              </div>
            ))
          ) : (
            <div className="setup-stage-item">
              <span>NONE</span>
              <div>
                <strong>No daily activity matched this filter</strong>
                <p className="muted">Clear the date filter or choose a wider range.</p>
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
        <div className="ops-section-header">
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
        <div className="ops-section-header">
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
type CustomerDailyActivityDigest = {
  key: string;
  label: string;
  total: number;
  latestAt?: string;
  typeCounts: Array<{ type: string; count: number }>;
  highlights: CustomerActivityRecord[];
};

type CustomerBookingEvidenceRow = {
  id: string;
  bookingLabel: string;
  serviceLabel: string;
  status: string;
  addressStatus: string;
  addressDetail: string;
  partnerStatus: string;
  partnerDetail: string;
  chatStatus: string;
  chatDetail: string;
  chatHref?: string;
  moneyStatus: string;
  moneyDetail: string;
  opsStatus: string;
  opsDetail: string;
};

type CustomerBookingJourneyRow = {
  id: string;
  status: string;
  heading: string;
  detail: string;
  latestAt?: string;
  steps: Array<{ label: string; value: string; tone: string }>;
  links: Array<{ label: string; href: string }>;
};

type CustomerChatRetentionRow = {
  id: string;
  bookingLabel: string;
  serviceLabel: string;
  status: string;
  roomStatus: string;
  roomDetail: string;
  latestSender: string;
  latestMessage: string;
  latestMessageAt?: string;
  mobileVisibility: string;
  mobileVisibilityDetail: string;
  adminRetention: string;
  adminRetentionDetail: string;
  bookingHref: string;
  chatHref?: string;
  hasRoom: boolean;
  requiresRoom: boolean;
  messageCount: number;
  mobileHidden: boolean;
};
type CustomerBookingOpsLedgerRow = {
  id: string;
  bookingLabel: string;
  serviceLabel: string;
  status: string;
  partnerLabel: string;
  noteStatus: string;
  noteDetail: string;
  taskStatus: string;
  taskDetail: string;
  closeoutStatus: string;
  closeoutDetail: string;
  bookingHref: string;
  chatHref?: string;
};

type CustomerOperatingLedgerRow = {
  area: string;
  status: string;
  evidence: string;
  href: string;
};

type CustomerOperationsDigestRow = {
  lane: string;
  status: string;
  detail: string;
  href: string;
  latestAt?: string;
  evidence: string[];
};

type CustomerBookingGateAttemptRow = {
  id: string;
  at: string;
  gate: string;
  gateLabel: string;
  reasonLabel: string;
  detail: string;
  addressLabel: string;
  distanceLabel: string;
  bookingMonitorHref: string;
  auditHref: string;
  tone: string;
};

function readDetailActivityOrder(params: Record<string, string | string[] | undefined>): DetailActivityOrder {
  const value = Array.isArray(params.order) ? params.order[0] : params.order;
  return value === 'oldest' ? 'oldest' : 'newest';
}

function activityOrderLabel(order: DetailActivityOrder) {
  return DETAIL_ACTIVITY_ORDER_OPTIONS.find((option) => option.value === order)?.label ?? 'Newest first';
}

function orderCustomerActivityRecords<T extends { at?: string | null }>(
  records: T[],
  order: DetailActivityOrder,
) {
  return [...records].sort((left, right) =>
    order === 'oldest' ? dateMs(left.at) - dateMs(right.at) : dateMs(right.at) - dateMs(left.at),
  );
}

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
      booking.payment && !['AUTHORIZED', 'CAPTURED', 'REFUNDED', 'RELEASED'].includes(booking.payment.status),
  );
  const refundBooking = bookings.find(
    (booking) => (booking.payment?.refunds?.length ?? 0) > 0 || (booking.refunds?.length ?? 0) > 0,
  );
  const enabledPushDevices = pushDevices?.filter((device) => device.enabled) ?? [];
  const unreadNotifications = notifications?.filter((notification) => !notification.readAt) ?? [];
  const lastSeenMs = latestSession ? dateMs(latestSession.lastSeenAt) : 0;
  const staleSession = !latestSession || Date.now() - lastSeenMs > 1000 * 60 * 60 * 24 * 7;
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
        preset:
          'Chat room exists but no messages are archived yet; operator should verify customer contact if needed.',
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
        preset:
          'Customer has no saved service address loaded; ask customer to confirm the service location before dispatch.',
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
        detail: activeBooking
          ? `${shortId(activeBooking.id)} / ${activeBooking.status}`
          : 'No active booking',
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
        detail: missingAddress ? 'No saved address loaded' : (addresses[0]?.value ?? 'Address loaded'),
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
    bookings.map((booking) => bookingPartnerDisplayName(booking)).filter(Boolean) as string[],
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
            latestBooking.createdAt ?? latestBooking.scheduledStartAt,
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
      href: lastCompletedBooking
        ? `/bookings/${lastCompletedBooking.id}`
        : `/customers/${customer.id}#booking-history`,
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

function buildCustomerOperationsDigest({
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
}): CustomerOperationsDigestRow[] {
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status));
  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED');
  const closedBookings = bookings.filter((booking) => CLOSED_BOOKING_STATUSES.includes(booking.status));
  const latestBooking = bookings[0];
  const latestActiveBooking = activeBookings[0];
  const lastCompletedBooking = completedBookings[0];
  const chatBookings = bookings.filter((booking) => booking.chatRoom);
  const chatMessages = bookings.flatMap((booking) =>
    readChatMessages(booking).map((message) => ({ ...message, bookingId: booking.id })),
  );
  const latestChatMessage = [...chatMessages].sort(
    (left, right) => dateMs(right.createdAt) - dateMs(left.createdAt),
  )[0];
  const latestNotification = [...notifications].sort(
    (left, right) => dateMs(right.createdAt) - dateMs(left.createdAt),
  )[0];
  const latestStaffRecord = activityRecords.find((record) => ['OPS', 'AUDIT'].includes(record.type));
  const enabledPushCount = pushDevices.filter((device) => device.enabled).length;

  return [
    {
      lane: 'Account and app',
      status: customer.user?.phone ? 'Phone account linked' : 'Phone missing',
      detail: latestSession
        ? `Last app access ${formatDate(latestSession.lastSeenAt)} from ${
            latestSession.platform ?? 'unknown platform'
          }.`
        : 'No customer app session is loaded for this account.',
      href: '#customer-info',
      latestAt: latestSession?.lastSeenAt ?? customer.user?.createdAt,
      evidence: [
        customer.user?.phone ?? 'No phone',
        `${enabledPushCount}/${pushDevices.length} push-ready`,
        `Joined ${formatDate(customer.user?.createdAt)}`,
      ],
    },
    {
      lane: 'Work history',
      status: `${bookingStats.completed} completed / ${bookings.length} total`,
      detail: lastCompletedBooking
        ? `Last completed work is ${bookingServiceLabel(lastCompletedBooking)}.`
        : 'No completed work record is loaded in this filter.',
      href: lastCompletedBooking ? `/bookings/${lastCompletedBooking.id}` : '#booking-history',
      latestAt:
        lastCompletedBooking?.updatedAt ??
        lastCompletedBooking?.scheduledEndAt ??
        lastCompletedBooking?.createdAt,
      evidence: [
        `${activeBookings.length} active`,
        `${closedBookings.length} closed`,
        latestBooking ? `Latest ${shortId(latestBooking.id)}` : 'No latest booking',
      ],
    },
    {
      lane: 'Live booking',
      status: latestActiveBooking ? `${latestActiveBooking.status}` : 'No active booking',
      detail: latestActiveBooking
        ? `${bookingServiceLabel(latestActiveBooking)} is the newest active booking in this filter.`
        : 'No active booking appears in the selected date range.',
      href: latestActiveBooking ? `/bookings/${latestActiveBooking.id}` : '#booking-history',
      latestAt:
        latestActiveBooking?.updatedAt ??
        latestActiveBooking?.scheduledStartAt ??
        latestActiveBooking?.createdAt,
      evidence: [
        latestActiveBooking ? shortId(latestActiveBooking.id) : 'None',
        `${activeBookings.length} active row(s)`,
        'Customer final choice only',
      ],
    },
    {
      lane: 'Chat archive',
      status: `${chatBookings.length} room(s) / ${chatMessages.length} message(s)`,
      detail: latestChatMessage
        ? `Latest message: ${compactText(latestChatMessage.body, 90)}`
        : 'No retained chat message appears in this filter.',
      href: latestChatMessage?.bookingId ? `/bookings/${latestChatMessage.bookingId}#chat` : '#chat-history',
      latestAt: latestChatMessage?.createdAt,
      evidence: ['Admin retained', 'Hidden in apps after completion', `${chatMessages.length} message(s)`],
    },
    {
      lane: 'Payment and wallet',
      status: formatMoney(wallet.capturedSpend),
      detail: `${formatMoney(wallet.pendingPaymentAmount)} pending or authorized / ${formatMoney(
        wallet.refundAmount,
      )} refunded / ${formatMoney(wallet.cashBookingAmount)} cash amount.`,
      href: '#wallet',
      latestAt: activityRecords.find((record) => ['PAYMENT', 'REFUND'].includes(record.type))?.at,
      evidence: [
        `${wallet.refundCount} refund row(s)`,
        `${bookings.filter((booking) => booking.payment).length} payment row(s)`,
        'Factual records only',
      ],
    },
    {
      lane: 'Address records',
      status: addresses.length ? `${addresses.length} saved` : 'No saved address',
      detail: addresses[0]?.value ?? 'No customer address or selected map pin is loaded.',
      href: '#addresses',
      latestAt: activityRecords.find((record) => record.type === 'ADDRESS')?.at,
      evidence: [
        `${bookings.filter((booking) => booking.addressSnapshot).length} booking snapshot(s)`,
        `${addresses.length} saved location(s)`,
        'Address-based discovery',
      ],
    },
    {
      lane: 'Notifications',
      status: `${notifications.length} notification row(s)`,
      detail: latestNotification
        ? `${latestNotification.title ?? latestNotification.type ?? 'Notification'} / ${formatDate(
            latestNotification.createdAt,
          )}`
        : 'No notification row matched this filter.',
      href: '#notifications',
      latestAt: latestNotification?.createdAt,
      evidence: [
        `${notifications.filter((notification) => !notification.readAt).length} unread`,
        `${enabledPushCount} enabled device(s)`,
        'Delivery trace',
      ],
    },
    {
      lane: 'Staff trail',
      status: `${customer.auditLogs?.length ?? 0} audit row(s)`,
      detail: latestStaffRecord
        ? `${latestStaffRecord.title} / ${latestStaffRecord.detail}`
        : 'No staff record appears in the selected filter.',
      href: '#audit-trail',
      latestAt: latestStaffRecord?.at,
      evidence: ['Operator notes', 'Audit history', 'Factual activity only'],
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
        detail: latestBooking ? bookingServiceLabel(latestBooking) : 'No booking history yet',
        href: latestBooking ? `/bookings/${latestBooking.id}` : '/bookings',
      },
      {
        title: 'Last completed work',
        value: lastCompletedBooking ? shortId(lastCompletedBooking.id) : 'None',
        detail: lastCompletedBooking
          ? `${bookingServiceLabel(lastCompletedBooking)} / ${formatDate(lastCompletedBooking.updatedAt ?? lastCompletedBooking.createdAt ?? lastCompletedBooking.scheduledStartAt)}`
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
      )} / opened ${formatDate(booking.createdAt ?? booking.scheduledStartAt)}${
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
      detail: `Feedback record / ${reviewBookingServiceLabel(review.booking)}`,
      href: '/reviews',
    });
  }

  for (const log of customer.auditLogs ?? []) {
    const bookingGateAttempt =
      log.action === 'booking.create.rejected'
        ? buildCustomerBookingGateAttemptRows([log], customer.id)[0]
        : null;
    records.push({
      id: log.id,
      type: 'AUDIT',
      at: log.createdAt,
      title: bookingGateAttempt ? `Booking create stopped: ${bookingGateAttempt.reasonLabel}` : log.action,
      detail: bookingGateAttempt
        ? `${bookingGateAttempt.gateLabel} / ${bookingGateAttempt.detail}`
        : `${log.actor?.fullName ?? log.actor?.phone ?? 'System'} / ${compactJson(log.metadata)}`,
      href: bookingGateAttempt?.bookingMonitorHref ?? '/audit-log',
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
  const latestAt = orderCustomerActivityRecords(records, 'newest')[0]?.at;
  const oldestAt = orderCustomerActivityRecords(records, 'oldest')[0]?.at;

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

function buildCustomerDailyActivityDigest(
  records: CustomerActivityRecord[],
  order: DetailActivityOrder = 'newest',
): CustomerDailyActivityDigest[] {
  const grouped = new Map<string, CustomerActivityRecord[]>();

  for (const record of records) {
    const key = activityDateKey(record.at);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => (order === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)))
    .slice(0, 14)
    .map(([key, dayRecords]) => {
      const typeCounts = [...countActivityTypes(dayRecords).entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([type, count]) => ({ type, count }));
      const newestRecords = orderCustomerActivityRecords(dayRecords, 'newest');
      const sortedRecords = orderCustomerActivityRecords(dayRecords, order);

      return {
        key,
        label: formatActivityDateLabel(key),
        total: dayRecords.length,
        latestAt: newestRecords[0]?.at,
        typeCounts,
        highlights: sortedRecords.slice(0, 4),
      };
    });
}

function buildCustomerBookingGateAttemptRows(
  auditLogs: AdminAuditLog[],
  customerId: string,
): CustomerBookingGateAttemptRow[] {
  return auditLogs
    .filter((log) => log.action === 'booking.create.rejected')
    .map((log) => {
      const metadata = readMetadataObject(log.metadata);
      const reasonCode = readString(metadata.reasonCode) ?? 'UNKNOWN';
      const gate = customerBookingGateFilter(reasonCode);
      const bookingAddress = readMetadataObject(metadata.bookingAddress);
      const addressText = readString(bookingAddress.addressText);
      const customerDistance = readNumber(metadata.customerDistanceMeters);
      const customerDistanceLimit = readNumber(metadata.customerDistanceLimitMeters);
      const partnerDistance = readNumber(metadata.preferredProviderDistanceMeters);
      const partnerDistanceLimit = readNumber(metadata.preferredProviderDistanceLimitMeters);
      const currentLocationRecordedAt = readString(metadata.currentLocationRecordedAt);
      const preferredProviderId = readString(metadata.preferredProviderId);
      const serviceId = readString(metadata.serviceId);
      const distanceParts = [
        customerDistance !== null
          ? `Optional customer GPS ${formatDistance(customerDistance)} / limit ${formatDistance(customerDistanceLimit ?? 0)}`
          : null,
        partnerDistance !== null
          ? `First-pick ${formatDistance(partnerDistance)} / limit ${formatDistance(partnerDistanceLimit ?? 0)}`
          : null,
      ].filter(Boolean);
      const detailParts = [
        addressText ? `Address: ${addressText}` : 'Address snapshot metadata missing',
        currentLocationRecordedAt
          ? `GPS proof: ${formatDate(currentLocationRecordedAt)}`
          : 'No optional GPS timestamp',
        serviceId ? `Service ${shortId(serviceId)}` : null,
        preferredProviderId ? `First-pick partner ${shortId(preferredProviderId)}` : null,
      ].filter(Boolean);

      return {
        id: log.id,
        at: log.createdAt,
        gate,
        gateLabel: customerBookingGateLabel(gate),
        reasonLabel: customerBookingGateReasonLabel(reasonCode),
        detail: detailParts.join(' / '),
        addressLabel: addressText ? compactText(addressText, 72) : 'No address metadata',
        distanceLabel: distanceParts.length ? distanceParts.join(' / ') : 'No distance value',
        bookingMonitorHref: `/bookings?view=blocked-create&gate=${gate}`,
        auditHref: `/audit-log?query=booking.create.rejected&target=${encodeURIComponent(
          `customer:${customerId}`,
        )}`,
        tone: gate === 'unknown' ? 'pill-warn' : 'pill-info',
      };
    })
    .sort((left, right) => dateMs(right.at) - dateMs(left.at));
}

function customerBookingGateFilter(reasonCode: string) {
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') return 'service-area';
  if (
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING' ||
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE' ||
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING' ||
    reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID'
  ) {
    return 'customer-gps';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') return 'customer-distance';
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') return 'first-pick-distance';
  return 'unknown';
}

function customerBookingGateLabel(gate: string) {
  if (gate === 'service-area') return 'Service area';
  if (gate === 'customer-gps') return 'Optional GPS evidence';
  if (gate === 'customer-distance') return 'Optional GPS distance';
  if (gate === 'first-pick-distance') return 'First-pick distance';
  return 'Unknown gate';
}

function customerBookingGateReasonLabel(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'Optional customer GPS distance evidence';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'First-pick partner is outside the service address radius';
  }
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') {
    return 'Selected service address is outside enabled service area';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE') {
    return 'Optional customer GPS evidence is stale';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING') {
    return 'Optional customer GPS evidence is missing';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING') {
    return 'Optional customer GPS timestamp is missing';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID') {
    return 'Optional customer GPS timestamp is invalid';
  }
  return reasonCode.replace(/_/g, ' ').toLowerCase();
}

function buildCustomerBookingEvidenceRows(bookings: AdminBookingDetail[]): CustomerBookingEvidenceRow[] {
  return bookings.slice(0, 30).map((booking) => {
    const chatMessages = readChatMessages(booking);
    const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
    const participantCount = booking.participants?.length ?? 0;
    const acceptedParticipants =
      booking.participants?.filter((participant) => ['ACCEPTED', 'SELECTED'].includes(participant.status))
        .length ?? 0;
    const hasAddressSnapshot = Boolean(booking.addressSnapshot);
    const addressText = bookingAddressEvidenceLabel(booking);
    const moneyParts = [
      booking.payment
        ? `${booking.payment.status} ${booking.payment.method} ${formatMoney(
            Number(booking.payment.amount ?? 0),
            booking.payment.currency ?? 'VND',
          )}`
        : 'No payment row',
      booking.earning ? `earning ${booking.earning.status}` : 'no earning row',
      refunds.length ? `${refunds.length} refund row(s)` : 'no refund rows',
    ];
    const opsParts = [
      `${booking.opsTasks?.length ?? 0} ops task(s)`,
      `${booking.auditLogs?.length ?? 0} audit row(s)`,
      `${booking.platformFeeLogs?.length ?? 0} platform fee row(s)`,
      `${booking.taxLogs?.length ?? 0} tax row(s)`,
      `${booking.walletLedgerEntries?.length ?? 0} wallet row(s)`,
    ];

    return {
      id: booking.id,
      bookingLabel: `${shortId(booking.id)} / ${formatDate(
        booking.createdAt ?? booking.updatedAt ?? booking.scheduledStartAt,
      )}`,
      serviceLabel: `${bookingServiceLabel(booking)} / ${formatMoney(bookingTotal(booking))}`,
      status: booking.status,
      addressStatus: hasAddressSnapshot ? 'Snapshot saved' : 'No address snapshot',
      addressDetail: addressText,
      partnerStatus: booking.selectedProviderId
        ? 'Final partner selected'
        : booking.preferredProviderId
          ? 'Preferred partner first-pick'
          : participantCount
            ? 'Marketplace participation'
            : 'No partner participation',
      partnerDetail: `${bookingPartnerDisplayName(booking)} / ${participantCount} participant(s), ${acceptedParticipants} accepted/selected`,
      chatStatus: booking.chatRoom ? `${chatMessages.length} message(s)` : 'No chat room',
      chatDetail: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} / ${bookingChatArchiveLabel(booking)}`
        : bookingChatArchiveLabel(booking),
      chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      moneyStatus: booking.payment?.status ?? 'No payment',
      moneyDetail: moneyParts.join(' / '),
      opsStatus:
        (booking.opsTasks?.length ?? 0) > 0 || (booking.auditLogs?.length ?? 0) > 0
          ? 'Operator records'
          : 'No operator rows',
      opsDetail: opsParts.join(' / '),
    };
  });
}

function buildCustomerBookingJourneyRows(bookings: AdminBookingDetail[]): CustomerBookingJourneyRow[] {
  return bookings.slice(0, 20).map((booking) => {
    const chatMessages = readChatMessages(booking);
    const latestMessage = chatMessages[chatMessages.length - 1];
    const refunds = [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])];
    const participantCount = booking.participants?.length ?? 0;
    const selectedPartner = booking.selectedProviderId ? bookingPartnerDisplayName(booking) : null;
    const hasAddressSnapshot = Boolean(booking.addressSnapshot);
    const hasMoneyCloseout =
      Boolean(booking.earning) ||
      (booking.platformFeeLogs?.length ?? 0) > 0 ||
      (booking.taxLogs?.length ?? 0) > 0 ||
      (booking.walletLedgerEntries?.length ?? 0) > 0;
    const latestAt =
      latestMessage?.createdAt ??
      booking.updatedAt ??
      booking.closedAt ??
      booking.createdAt ??
      booking.scheduledStartAt;
    const moneyValue = booking.payment
      ? `${booking.payment.status} ${formatMoney(
          Number(booking.payment.amount ?? 0),
          booking.payment.currency ?? 'VND',
        )}`
      : hasMoneyCloseout
        ? 'Closeout rows'
        : 'No row';
    const partnerValue = selectedPartner
      ? selectedPartner
      : booking.preferredProviderId
        ? participantCount
          ? `First-pick plus ${participantCount} participant(s)`
          : 'First-pick waiting'
        : participantCount
          ? `${participantCount} participant(s)`
          : 'No participant';
    const chatValue = booking.chatRoom
      ? `${chatMessages.length} retained`
      : ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status)
        ? 'Needs room check'
        : 'Not opened';

    return {
      id: booking.id,
      status: booking.status,
      heading: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
      detail: `${formatMoney(bookingTotal(booking))} / ${bookingAddressEvidenceLabel(booking)}`,
      latestAt,
      steps: [
        {
          label: 'Address',
          value: hasAddressSnapshot ? 'Snapshot saved' : 'Review',
          tone: hasAddressSnapshot ? 'pill-success' : 'pill-warn',
        },
        {
          label: 'Partner',
          value: partnerValue,
          tone: selectedPartner ? 'pill-success' : participantCount ? 'pill-info' : 'pill-neutral',
        },
        {
          label: 'Chat',
          value: chatValue,
          tone: booking.chatRoom
            ? 'pill-success'
            : ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
                  booking.status,
                )
              ? 'pill-warn'
              : 'pill-neutral',
        },
        {
          label: 'Payment',
          value: moneyValue,
          tone: booking.payment ? 'pill-info' : hasMoneyCloseout ? 'pill-success' : 'pill-neutral',
        },
        {
          label: 'Refund',
          value: refunds.length ? `${refunds.length} row(s)` : 'None',
          tone: refunds.length ? 'pill-warn' : 'pill-neutral',
        },
        {
          label: 'Staff',
          value: `${booking.opsTasks?.length ?? 0} task(s) / ${booking.auditLogs?.length ?? 0} log(s)`,
          tone:
            (booking.opsTasks?.length ?? 0) > 0 || (booking.auditLogs?.length ?? 0) > 0
              ? 'pill-info'
              : 'pill-neutral',
        },
      ],
      links: [
        { label: 'Open booking', href: `/bookings/${booking.id}` },
        ...(booking.chatRoom
          ? [{ label: 'Open chat archive', href: `/chat-archive?q=${encodeURIComponent(booking.id)}` }]
          : []),
        ...(booking.payment ? [{ label: 'Open payments', href: '/payments' }] : []),
      ],
    };
  });
}

function buildCustomerBookingOpsLedgerRows(bookings: AdminBookingDetail[]): CustomerBookingOpsLedgerRow[] {
  return bookings
    .filter((booking) => {
      return (
        Boolean(booking.notes?.trim()) ||
        (booking.opsTasks?.length ?? 0) > 0 ||
        Boolean(booking.closedAt || booking.closedReason || booking.closedNote)
      );
    })
    .slice(0, 40)
    .map((booking) => {
      const tasks = [...(booking.opsTasks ?? [])].sort(
        (left, right) => dateMs(right.updatedAt) - dateMs(left.updatedAt),
      );
      const latestTask = tasks[0];
      const latestNote = latestCustomerBookingManualNote(booking.notes);

      return {
        id: booking.id,
        bookingLabel: `${shortId(booking.id)} / ${formatDate(
          booking.createdAt ?? booking.updatedAt ?? booking.scheduledStartAt,
        )}`,
        serviceLabel: `${bookingServiceLabel(booking)} / ${formatMoney(bookingTotal(booking))}`,
        status: booking.status,
        partnerLabel: bookingPartnerDisplayName(booking),
        noteStatus: latestNote ? 'Manual note saved' : 'No manual note',
        noteDetail: latestNote ?? 'No booking-level staff note has been saved for this booking.',
        taskStatus: tasks.length ? `${tasks.length} task row(s)` : 'No staff task',
        taskDetail: latestTask
          ? `${latestTask.status} ${latestTask.type} / ${latestTask.note ?? 'No task note'} / ${
              latestTask.actor?.fullName ?? latestTask.actor?.phone ?? 'System'
            }`
          : 'No linked booking operation task is loaded.',
        closeoutStatus: booking.closedAt ? 'Closed by operator flow' : 'Not closed',
        closeoutDetail: booking.closedAt
          ? `${formatDate(booking.closedAt)} / ${bookingClosureLabel(booking)}`
          : 'No cancellation, no-show, refund, or closeout decision is saved.',
        bookingHref: `/bookings/${booking.id}`,
        chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      };
    });
}

function latestCustomerBookingManualNote(notes?: string | null) {
  if (!notes?.trim()) return null;
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const latest = lines[lines.length - 1];
  return latest ? compactText(latest, 180) : null;
}

function buildCustomerChatRetentionRows(bookings: AdminBookingDetail[]): CustomerChatRetentionRow[] {
  return bookings.slice(0, 40).map((booking) => {
    const chatMessages = readChatMessages(booking);
    const latestMessage = chatMessages[chatMessages.length - 1];
    const requiresRoom = bookingRequiresRetainedChat(booking);
    const mobileHidden = bookingChatHiddenInMobile(booking);
    const latestSender =
      latestMessage?.sender?.fullName ??
      latestMessage?.sender?.phone ??
      latestMessage?.sender?.roles?.join(', ') ??
      'No message';

    return {
      id: booking.id,
      bookingLabel: `${shortId(booking.id)} / ${formatDate(
        booking.createdAt ?? booking.updatedAt ?? booking.scheduledStartAt,
      )}`,
      serviceLabel: `${bookingServiceLabel(booking)} / ${bookingPartnerDisplayName(booking)}`,
      status: booking.status,
      roomStatus: booking.chatRoom
        ? `${chatMessages.length} retained message(s)`
        : requiresRoom
          ? 'Matched booking without room'
          : 'No room required yet',
      roomDetail: booking.chatRoom
        ? `Room ${shortId(booking.chatRoom.id)} / ${bookingChatArchiveLabel(booking)}`
        : requiresRoom
          ? 'Matched or service-stage booking should have a retained chat room.'
          : 'Pre-match bookings do not open customer-partner chat yet.',
      latestSender,
      latestMessage: latestMessage ? compactText(latestMessage.body, 120) : 'No retained message loaded',
      latestMessageAt: latestMessage?.createdAt,
      mobileVisibility: mobileHidden
        ? 'Hidden in mobile after closeout'
        : booking.chatRoom
          ? 'Visible while service is active'
          : 'Not visible yet',
      mobileVisibilityDetail: mobileHidden
        ? 'Customer and partner apps may hide completed or closed chats, but admin keeps the archive.'
        : booking.chatRoom
          ? 'Room should remain visible until the service is completed or closed.'
          : 'Chat opens after customer final partner selection.',
      adminRetention: booking.chatRoom
        ? 'Admin archive retained'
        : requiresRoom
          ? 'Admin repair needed'
          : 'Waiting for match',
      adminRetentionDetail: booking.chatRoom
        ? 'Use the archive link for full message evidence.'
        : requiresRoom
          ? 'Open the booking detail to repair or investigate the missing room.'
          : 'No customer-partner chat evidence is expected before matching.',
      bookingHref: `/bookings/${booking.id}`,
      chatHref: booking.chatRoom ? `/chat-archive?q=${encodeURIComponent(booking.id)}` : undefined,
      hasRoom: Boolean(booking.chatRoom),
      requiresRoom,
      messageCount: chatMessages.length,
      mobileHidden,
    };
  });
}

function buildCustomerChatRetentionSummary(rows: CustomerChatRetentionRow[]) {
  const retainedRooms = rows.filter((row) => row.hasRoom).length;
  const retainedMessages = rows.reduce((sum, row) => sum + row.messageCount, 0);
  const matchedWithoutRoom = rows.filter((row) => row.requiresRoom && !row.hasRoom).length;
  const mobileHidden = rows.filter((row) => row.mobileHidden && row.hasRoom).length;

  return [
    {
      label: 'Retained rooms',
      value: retainedRooms.toString(),
      helper: 'Chat rooms saved for admin evidence.',
    },
    {
      label: 'Retained messages',
      value: retainedMessages.toString(),
      helper: 'Loaded messages across this customer date filter.',
    },
    {
      label: 'Matched without room',
      value: matchedWithoutRoom.toString(),
      helper: 'Matched/service-stage bookings that need chat-room repair.',
    },
    {
      label: 'Hidden in mobile',
      value: mobileHidden.toString(),
      helper: 'Completed or closed chat rooms still retained by admin.',
    },
  ];
}

function bookingRequiresRetainedChat(booking: AdminBookingDetail) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status);
}

function bookingChatHiddenInMobile(booking: AdminBookingDetail) {
  return ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(booking.status);
}

function bookingOpsTaskCount(booking: unknown) {
  const record = booking && typeof booking === 'object' ? (booking as { opsTasks?: unknown }) : {};
  return Array.isArray(record.opsTasks) ? record.opsTasks.length : 0;
}

function bookingAuditLogCount(booking: unknown) {
  const record = booking && typeof booking === 'object' ? (booking as { auditLogs?: unknown }) : {};
  return Array.isArray(record.auditLogs) ? record.auditLogs.length : 0;
}

function countActivityTypes(records: Array<{ type: string }>) {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(record.type, (counts.get(record.type) ?? 0) + 1);
  }
  return counts;
}

function activityDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatActivityDateLabel(key: string) {
  const date = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
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

function bookingAddressEvidenceLabel(booking: AdminBookingDetail) {
  if (booking.addressSnapshot) {
    const coordinate =
      booking.addressSnapshot.latitude != null && booking.addressSnapshot.longitude != null
        ? ` / ${booking.addressSnapshot.latitude}, ${booking.addressSnapshot.longitude}`
        : '';
    return `${booking.addressSnapshot.addressText ?? stringifyAddress(booking.addressSnapshot.address)}${coordinate}`;
  }
  if (booking.address) return stringifyAddress(booking.address);
  if (booking.lat != null && booking.lng != null) return `${booking.lat}, ${booking.lng}`;
  return 'No booking address evidence loaded';
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
  return formatShortId(id, { fallback: 'unknown' });
}

function compactJson(value: unknown) {
  if (!value) return 'No metadata';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function readMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function compactText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
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
  return formatDateTime(value, 'Not set');
}

function formatDistance(value: number) {
  return formatDistanceMeters(value);
}

function formatMoney(value: number, currency = 'VND') {
  return formatAdminMoney(value, currency, `0 ${currency}`);
}
