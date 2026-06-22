import Link from 'next/link';
import { Download, Filter, Save, X } from 'lucide-react';
import { notFound } from 'next/navigation';
import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import { AdminRoundedPagination } from '../../../components/admin-rounded-pagination';
import {
  AdminAppSession,
  AdminAuditLog,
  AdminBookingDetail,
  AdminChatMessage,
  AdminCustomerDetail,
  AdminNotification,
  adminGet,
} from '../../../lib/admin-api';
import {
  bookingLatestActivityAt,
  bookingRecordCreatedAt,
  bookingRequestOpenedAt,
} from '../../../lib/admin-booking-time';
import { marketplaceDisplayText as displayMarketplaceText } from '../../../lib/admin-copy';
import {
  bookingCreateGateFilterLabel,
  bookingCreateGateReasonFilter,
  bookingCreateGateReasonLabel,
} from '../../../lib/booking-create-gate-reasons';
import { bookingChatOpensAfterMatchOrSelectionCopy } from '../../../lib/booking-chat-copy';
import { customerWalletSummary } from '../../../lib/customer-wallet-summary';
import {
  type DetailDateFilters,
  detailDateRangeOptions,
  isWithinDetailDateFilter,
  readDetailDateFilters,
} from '../../../lib/detail-date-filter';
import {
  detailActivityTypeLabel,
  isWithinDetailActivityType,
  readDetailActivityType,
} from '../../../lib/detail-activity-filter';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import { buildCsvDataHref } from '../../../lib/csv-export';
import { addCustomerOpsNote } from './actions';
import {
  bookingPartnerDisplayName,
  compactJson,
  compactText,
  dateMs,
  formatDate,
  formatDistance,
  formatMoney,
  readMetadataObject,
  readNumber,
  readString,
  shortId,
} from './customer-detail-format';
import {
  CUSTOMER_ACTIVITY_TYPE_OPTIONS,
  DETAIL_ACTIVITY_ORDER_OPTIONS,
  activityOrderLabel,
  orderCustomerActivityRecords,
  readDetailActivityOrder,
} from './customer-detail-filters';
import {
  CustomerBookingOperationBoard,
  type CustomerBookingOperationGroup,
  type CustomerBookingOperationMetric,
  type CustomerBookingOperationRow,
} from './customer-booking-operation-board';
import {
  CustomerDetailOverviewShell,
  type CustomerDetailOverviewFact,
  type CustomerDetailOverviewHighlight,
  type CustomerDetailPartnerAvatar,
  type CustomerDetailPartnerRail,
} from './customer-detail-overview-shell';
import {
  CustomerDetailSectionBand,
  CustomerDetailShortcutStrip,
  type CustomerDetailShortcut,
} from './customer-detail-section-shell';
import type { DetailActivityOrder } from './customer-detail-filters';

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
const MATCHING_AVATAR_STATUSES = new Set(['CREATED', 'OPEN_MATCHING']);
const WORKING_AVATAR_STATUSES = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];
const CUSTOMER_RECENT_ACTIVITY_LIMIT = 12;
const CUSTOMER_CHAT_HISTORY_PAGE_SIZE = 4;
const CUSTOMER_BOOKING_HISTORY_PAGE_SIZE = 10;
const CUSTOMER_CHAT_RETENTION_PAGE_SIZE = 10;
const CUSTOMER_BOOKING_OPS_LEDGER_PAGE_SIZE = 10;
const CUSTOMER_BOOKING_HISTORY_HEADERS = [
  'Booking',
  'Service',
  'Status',
  'Partner',
  'Payment',
  'Chat',
  'Open',
] as const;
const CUSTOMER_CHAT_RETENTION_HEADERS = [
  'Booking',
  'Chat state',
  'Latest message',
  'Retention',
  'Open',
] as const;
const CUSTOMER_BOOKING_OPS_LEDGER_HEADERS = [
  'Booking',
  'Partner',
  'Notes and tasks',
  'Closeout',
  'Open',
] as const;
const CUSTOMER_NOTIFICATION_HEADERS = ['Notification', 'Type', 'Created', 'Delivery'] as const;
const CUSTOMER_AUDIT_TRAIL_HEADERS = ['Action', 'Actor', 'Created', 'Metadata'] as const;

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
  const wallet = customerWalletSummary(bookings);
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
  const appSessions = customer.user?.appSessions ?? [];
  const latestSession = appSessions[0];
  const pushDevices = customer.user?.pushDevices ?? [];
  const customerAvatarStatus = adminAvatarStatusFromSignals({
    devices: pushDevices,
    matching: Boolean(activeBooking && MATCHING_AVATAR_STATUSES.has(activeBooking.status)),
    sessions: appSessions,
    working: Boolean(activeBooking && WORKING_AVATAR_STATUSES.has(activeBooking.status)),
  });
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
    isWithinDetailDateFilter(bookingLatestActivityAt(booking), dateFilters),
  );
  const bookingHistoryPage = readCustomerBookingHistoryPage(detailSearchParams);
  const bookingHistoryTotalPages = Math.max(
    1,
    Math.ceil(filteredBookings.length / CUSTOMER_BOOKING_HISTORY_PAGE_SIZE),
  );
  const bookingHistoryActivePage = Math.min(bookingHistoryPage, bookingHistoryTotalPages);
  const bookingHistoryStartIndex =
    (bookingHistoryActivePage - 1) * CUSTOMER_BOOKING_HISTORY_PAGE_SIZE;
  const visibleBookingHistoryRows = filteredBookings.slice(
    bookingHistoryStartIndex,
    bookingHistoryStartIndex + CUSTOMER_BOOKING_HISTORY_PAGE_SIZE,
  );
  const bookingHistoryPageFrom = filteredBookings.length === 0 ? 0 : bookingHistoryStartIndex + 1;
  const bookingHistoryPageTo = Math.min(
    filteredBookings.length,
    bookingHistoryStartIndex + visibleBookingHistoryRows.length,
  );
  const customerBookingOperationBuckets = buildCustomerBookingOperationBuckets(filteredBookings);
  const allCustomerBookingOperationBuckets = buildCustomerBookingOperationBuckets(bookings);
  const customerBookingOperationMetrics = buildCustomerBookingOperationMetrics(
    bookings,
    allCustomerBookingOperationBuckets,
  );
  const customerBookingOperationGroups = buildCustomerBookingOperationGroups(
    customerBookingOperationBuckets,
    detailSearchParams,
  );
  const filteredChatBookings = bookings.filter((booking) => {
    if (!booking.chatRoom) return false;
    return (
      isWithinDetailDateFilter(
        bookingLatestActivityAt(booking),
        dateFilters,
      ) ||
      readChatMessages(booking).some((message) => isWithinDetailDateFilter(message.createdAt, dateFilters))
    );
  });
  const chatHistoryPage = readCustomerBookingOperationPage(detailSearchParams, 'chatHistoryPage');
  const chatHistoryTotalPages = Math.max(
    1,
    Math.ceil(filteredChatBookings.length / CUSTOMER_CHAT_HISTORY_PAGE_SIZE),
  );
  const chatHistoryActivePage = Math.min(chatHistoryPage, chatHistoryTotalPages);
  const chatHistoryStartIndex = (chatHistoryActivePage - 1) * CUSTOMER_CHAT_HISTORY_PAGE_SIZE;
  const visibleChatBookings = filteredChatBookings.slice(
    chatHistoryStartIndex,
    chatHistoryStartIndex + CUSTOMER_CHAT_HISTORY_PAGE_SIZE,
  );
  const chatHistoryPageFrom = filteredChatBookings.length === 0 ? 0 : chatHistoryStartIndex + 1;
  const chatHistoryPageTo = Math.min(
    filteredChatBookings.length,
    chatHistoryStartIndex + visibleChatBookings.length,
  );
  const customerChatRetentionRows = buildCustomerChatRetentionRows(filteredBookings);
  const customerChatRetentionSummary = buildCustomerChatRetentionSummary(customerChatRetentionRows);
  const customerBookingOpsLedgerRows = buildCustomerBookingOpsLedgerRows(filteredBookings);
  const chatRetentionPage = readCustomerBookingOperationPage(detailSearchParams, 'chatRetentionPage');
  const chatRetentionTotalPages = Math.max(
    1,
    Math.ceil(customerChatRetentionRows.length / CUSTOMER_CHAT_RETENTION_PAGE_SIZE),
  );
  const chatRetentionActivePage = Math.min(chatRetentionPage, chatRetentionTotalPages);
  const chatRetentionStartIndex =
    (chatRetentionActivePage - 1) * CUSTOMER_CHAT_RETENTION_PAGE_SIZE;
  const visibleCustomerChatRetentionRows = customerChatRetentionRows.slice(
    chatRetentionStartIndex,
    chatRetentionStartIndex + CUSTOMER_CHAT_RETENTION_PAGE_SIZE,
  );
  const chatRetentionPageFrom =
    customerChatRetentionRows.length === 0 ? 0 : chatRetentionStartIndex + 1;
  const chatRetentionPageTo = Math.min(
    customerChatRetentionRows.length,
    chatRetentionStartIndex + visibleCustomerChatRetentionRows.length,
  );
  const bookingOpsLedgerPage = readCustomerBookingOperationPage(
    detailSearchParams,
    'bookingOpsLedgerPage',
  );
  const bookingOpsLedgerTotalPages = Math.max(
    1,
    Math.ceil(customerBookingOpsLedgerRows.length / CUSTOMER_BOOKING_OPS_LEDGER_PAGE_SIZE),
  );
  const bookingOpsLedgerActivePage = Math.min(bookingOpsLedgerPage, bookingOpsLedgerTotalPages);
  const bookingOpsLedgerStartIndex =
    (bookingOpsLedgerActivePage - 1) * CUSTOMER_BOOKING_OPS_LEDGER_PAGE_SIZE;
  const visibleCustomerBookingOpsLedgerRows = customerBookingOpsLedgerRows.slice(
    bookingOpsLedgerStartIndex,
    bookingOpsLedgerStartIndex + CUSTOMER_BOOKING_OPS_LEDGER_PAGE_SIZE,
  );
  const bookingOpsLedgerPageFrom =
    customerBookingOpsLedgerRows.length === 0 ? 0 : bookingOpsLedgerStartIndex + 1;
  const bookingOpsLedgerPageTo = Math.min(
    customerBookingOpsLedgerRows.length,
    bookingOpsLedgerStartIndex + visibleCustomerBookingOpsLedgerRows.length,
  );
  const filteredCustomerActivityRecords = orderCustomerActivityRecords(
    customerActivityRecords.filter(
      (record) =>
        isWithinDetailDateFilter(record.at, dateFilters) &&
        isWithinDetailActivityType(record.type, activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS),
    ),
    activityOrder,
  );
  const customerActivitySummary = buildCustomerActivitySummary(filteredCustomerActivityRecords);
  const customerDailyActivityDigest = buildCustomerDailyActivityDigest(
    filteredCustomerActivityRecords,
    activityOrder,
  );
  const visibleCustomerActivityRecords = filteredCustomerActivityRecords.slice(0, CUSTOMER_RECENT_ACTIVITY_LIMIT);
  const filteredNotifications = notifications.filter((notification) =>
    isWithinDetailDateFilter(notification.createdAt, dateFilters),
  );
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
  const customerCountry = customerCountryDisplay(readCustomerDeviceLanguageLabel(appSessions));
  const overviewPartnerRails = buildCustomerPartnerRails(
    bookings,
    customer.favoriteProviders ?? [],
    customer.viewedProviders ?? [],
  );
  const overviewStatusBadges = [
    activeBooking ? 'Active booking' : 'No live booking',
    pushDevices.some((device) => device.enabled) ? 'Push ready' : 'No push device',
    latestSession
      ? Date.now() - dateMs(latestSession.lastSeenAt) <= 30 * 60_000
        ? 'In app now'
        : 'Recent session saved'
      : 'No app session',
  ];
  const overviewHighlights: CustomerDetailOverviewHighlight[] = [
    {
      label: 'Current booking',
      value: activeBooking ? activeBooking.status : 'None',
      helper: activeBooking
        ? `${bookingServiceLabel(activeBooking)} / ${shortId(activeBooking.id)}`
        : `${bookingStats.active} active / ${bookings.length} total`,
    },
    {
      label: 'Wallet amount',
      value: formatMoney(wallet.customerBalance),
      helper: `Captured ${formatMoney(wallet.capturedSpend)} / refunded ${formatMoney(wallet.refundAmount)}`,
    },
    {
      label: 'Completed work',
      value: `${bookingStats.completed}`,
      helper: lastCompletedBooking
        ? `Latest ${formatDate(bookingLatestActivityAt(lastCompletedBooking))}`
        : 'No completed service record yet.',
    },
    {
      label: 'Saved addresses',
      value: `${addresses.length}`,
      helper: addresses[0]?.value ? compactText(addresses[0].value, 72) : 'No saved address loaded yet.',
    },
  ];
  const overviewFacts: CustomerDetailOverviewFact[] = [
    {
      label: 'Country',
      value: customerCountry.fullLabel,
      helper: customerCountry.sourceLabel === 'Unknown' ? 'No device language loaded.' : customerCountry.sourceLabel,
    },
    {
      label: 'Gender',
      value: readCustomerGenderLabel(customer),
      helper: 'Customer profile gender value from admin API when available.',
    },
    {
      label: 'Sign-up Date',
      value: formatDate(customer.user?.createdAt),
      helper: customer.user?.updatedAt
        ? `Last account update ${formatDate(customer.user.updatedAt)}`
        : 'No account update timestamp loaded.',
    },
    {
      label: 'Last Login Date',
      value: formatDate(latestSession?.lastSeenAt),
      helper: latestSession
        ? `${latestSession.platform ?? 'Unknown platform'} / ${latestSession.appVersion ?? 'No app version'}`
        : 'No app session loaded.',
    },
    {
      label: 'Last Login Address',
      value: latestSession?.lastLoginAddress ?? latestSession?.ipAddress ?? 'No login address loaded',
      helper: latestSession?.ipAddress ? `IP ${latestSession.ipAddress}` : 'No login location evidence loaded.',
    },
    {
      label: 'Total Work Completed',
      value: `${bookingStats.completed}`,
      helper: lastCompletedBooking
        ? `Latest completed booking ${shortId(lastCompletedBooking.id)}`
        : 'No completed service record yet.',
    },
    {
      label: 'Saved Address List',
      value: buildSavedAddressListValue(addresses),
      helper: `${addresses.length} saved address row(s) loaded.`,
    },
    {
      label: 'Latest Reservation',
      value: latestBooking ? shortId(latestBooking.id) : 'None',
      helper: latestBooking
        ? `${latestBooking.status} / ${formatDate(bookingLatestActivityAt(latestBooking))}`
        : 'No booking has been created for this customer.',
    },
    {
      label: 'Wallet Amount',
      value: formatMoney(wallet.customerBalance),
      helper: `${wallet.refundCount} refund row(s) / captured spend ${formatMoney(wallet.capturedSpend)}`,
    },
  ];
  const detailShortcuts: CustomerDetailShortcut[] = [
    {
      href: '#customer-booking-situation-board',
      label: 'Operations',
      value: `${filteredBookings.length} rows`,
      detail: 'Live work, completed work, cancellations, gate attempts, and command queue.',
    },
    {
      href: '#customer-info',
      label: 'Account',
      value: customer.user?.phone ?? 'No phone',
      detail: 'Identity, reachability, profile facts, wallet, and saved locations.',
    },
    {
      href: '#customer-chat-retention-ledger',
      label: 'Chat archive',
      value: `${chatRooms.length} room(s)`,
      detail: 'Retention checks, transcript access, and booking-linked room evidence.',
    },
    {
      href: '#booking-history',
      label: 'Booking records',
      value: `${filteredBookings.length} rows`,
      detail: 'Booking ledger, cancellation history, and booking-level operating notes.',
    },
    {
      href: '#customer-activity',
      label: 'Activity timeline',
      value: `${filteredCustomerActivityRecords.length} events`,
      detail: 'Cross-surface events grouped by date filter and record type.',
    },
  ];

  return (
    <div className="customer-detail-page">
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

      <CustomerDetailShortcutStrip items={detailShortcuts} />

      <CustomerDetailSectionBand
        eyebrow="Operations"
        title="Customer operating picture"
        description="Above-fold decision support for the desk: what is live now, what is blocked, what evidence exists, and which linked records matter next."
        status={<span className="pill pill-info">Operator flow</span>}
      >
        <CustomerDetailOverviewShell
          avatarStatus={customerAvatarStatus}
          facts={overviewFacts}
          highlights={overviewHighlights}
          name={customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer'}
          partnerRails={overviewPartnerRails}
          statusBadges={overviewStatusBadges}
          subtitle={`${customer.user?.phone ?? 'No phone'} / ${customer.user?.email ?? 'No email'}`}
        />

      <CustomerBookingOperationBoard
        basePath={`/customers/${id}`}
        groups={customerBookingOperationGroups}
        metrics={customerBookingOperationMetrics}
        searchParams={detailSearchParams}
      />

      <section className="card admin-mb-16" id="customer-recent-operations-timeline">
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
        <div className="setup-stage-list admin-mt-12">
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

      <section className="card admin-mb-16" id="customer-booking-create-gates">
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
        <div className="service-trace-summary admin-mt-12">
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
          <p className="muted admin-mt-12">
            No booking create gate attempt matched this date filter.
          </p>
        ) : (
          <div className="setup-stage-list admin-mt-14">
            {filteredBookingCreateGateAttempts.slice(0, 12).map((attempt) => (
              <div className="setup-stage-item" key={attempt.id}>
                <span>{attempt.gateLabel}</span>
                <div>
                  <Link className="text-link" href={attempt.bookingMonitorHref}>
                    <strong>{attempt.reasonLabel}</strong>
                  </Link>
                  <p className="muted">{attempt.detail}</p>
                  <div className="participant-list admin-mt-8">
                    <span className={`pill ${attempt.tone}`}>{attempt.gateLabel}</span>
                    <span className="pill pill-neutral">{attempt.addressLabel}</span>
                    <span className="pill pill-neutral">{attempt.distanceLabel}</span>
                  </div>
                  <div className="participant-list admin-mt-8">
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

      <section className="card admin-mb-16" id="customer-operator-command-queue">
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
        <div className="service-trace-summary admin-mt-12">
          {customerOperatorCommandQueue.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list admin-mt-14">
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

      <section className="card admin-mb-16" id="record-date-filter">
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
        <form className="form-grid admin-mt-14" action={`/customers/${customer.id}`}>
          <AdminFormSelect
            className="customer-detail-filter-select"
            defaultValue={dateFilters.range}
            label="Preset"
            name="range"
            options={detailDateRangeOptions}
          />
          <AdminFormSelect
            className="customer-detail-filter-select"
            defaultValue={activityType}
            label="Record type"
            name="type"
            options={CUSTOMER_ACTIVITY_TYPE_OPTIONS}
          />
          <AdminFormSelect
            className="customer-detail-filter-select"
            defaultValue={activityOrder}
            label="Sort order"
            name="order"
            options={DETAIL_ACTIVITY_ORDER_OPTIONS}
          />
          <AdminFormDate
            className="customer-detail-filter-date"
            defaultValue={dateFilters.from}
            label="From"
            name="from"
          />
          <AdminFormDate
            className="customer-detail-filter-date"
            defaultValue={dateFilters.to}
            label="To"
            name="to"
          />
          <div className="actions">
            <AdminFormControlButton className="customer-detail-filter-button">
              <Filter aria-hidden="true" size={16} />
              Apply filter
            </AdminFormControlButton>
            <AdminFormControlLink
              className="customer-detail-filter-link"
              download={`hands-customer-${shortId(customer.id)}-activity.csv`}
              href={filteredActivityCsvHref}
            >
              <Download aria-hidden="true" size={16} />
              Export activity CSV
            </AdminFormControlLink>
            <AdminFormControlLink className="customer-detail-filter-link" href={`/customers/${customer.id}`}>
              <X aria-hidden="true" size={16} />
              Clear
            </AdminFormControlLink>
          </div>
        </form>
        <div className="service-trace-summary admin-mt-12">
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

      <section className="card admin-mb-16">
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
        <div className="ops-task-note ops-task-pending admin-mt-14">
          <div className="ops-row">
            <div>
              <strong>{activityPlan.headline}</strong>
              <p className="muted">{activityPlan.detail}</p>
              <div className="participant-list admin-mt-8">
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
        <form action={addCustomerOpsNote} className="compact-form form-grid admin-mt-14">
          <input type="hidden" name="customerId" value={customer.id} />
          <AdminFormSelect
            className="customer-note-preset"
            defaultValue=""
            label="Quick note preset"
            name="preset"
            options={[
              { label: 'Manual note only', value: '' },
              ...activityPlan.presets.map((preset) => ({ label: preset, value: preset })),
            ]}
          />
          <AdminFormSelect
            className="customer-note-booking"
            defaultValue={latestBooking?.id ?? ''}
            label="Related booking"
            name="bookingId"
            options={[
              { label: 'No booking link', value: '' },
              ...bookings.slice(0, 20).map((booking) => ({
                label: `${shortId(booking.id)} / ${booking.status} / ${bookingServiceLabel(booking)}`,
                value: booking.id,
              })),
            ]}
          />
          <AdminFormTextarea
            className="customer-note-textarea full-span"
            label="Activity note"
            name="note"
            placeholder="Example: Customer contacted by phone, address confirmed, chat archive reviewed."
          />
          <AdminFormControlButton className="customer-note-submit">
            <Save aria-hidden="true" size={16} />
            Save customer activity note
          </AdminFormControlButton>
        </form>
      </section>
      </CustomerDetailSectionBand>

      <CustomerDetailSectionBand
        eyebrow="Account"
        title="Customer account and balance"
        description="Identity, saved contact facts, wallet readout, and location evidence grouped together so support can answer profile questions without scanning the full ledger."
        status={<span className="pill pill-info">Profile and wallet</span>}
      >
      <section className="card admin-mb-16" id="customer-info">
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

      <section className="card admin-mb-16" id="customer-account-facts">
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
        <div className="service-trace-summary admin-mt-12">
          {accountFacts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <small className="muted">{fact.helper}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="grid admin-mb-16">
        <section className="card" id="wallet">
          <h2>Customer payment ledger</h2>
          <p className="muted">
            Factual payment readout. Partner cash-fee debt is never carried on the customer account.
          </p>
          <div className="setup-stage-list admin-mt-12">
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
            <div className="ops-row">
              <strong>Customer balance</strong>
              <span>{formatMoney(wallet.customerBalance)}</span>
            </div>
          </div>
          <p className="muted admin-mt-12">
            {wallet.operatorNote}
          </p>
        </section>

        <section className="card" id="addresses">
          <h2>Saved addresses</h2>
          <p className="muted">Profile addresses and map pins selected in the customer app.</p>
          <div className="setup-stage-list admin-mt-12">
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
      </CustomerDetailSectionBand>

      <CustomerDetailSectionBand
        eyebrow="Records"
        title="Bookings, chat, and audit record"
        description="Historical booking rows, retained chat evidence, operator note ledgers, customer activity, notifications, and audit trail in one archive block."
        status={<span className="pill pill-info">Historical archive</span>}
      >
      <AdminFilterPanel
        className="booking-monitor booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group customer-booking-history-section"
        description="All loaded bookings with Partner, service, payment, refund, review, and chat state."
        id="booking-history"
        resultLabel={`${filteredBookings.length} bookings`}
        resultTone="info"
        title="Booking and cancellation history"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No booking record matched this date filter."
            headers={CUSTOMER_BOOKING_HISTORY_HEADERS}
            rowCount={visibleBookingHistoryRows.length}
          >
            {visibleBookingHistoryRows.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <strong>{shortId(booking.id)}</strong>
                  <p className="muted">{formatDate(bookingRecordCreatedAt(booking))}</p>
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
                      className="text-link admin-ml-10"
                      href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}
                    >
                      Chat archive
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <div className="vuexy-booking-table-footer customer-booking-history-footer">
          <span>
            Showing {bookingHistoryPageFrom} to {bookingHistoryPageTo} of {filteredBookings.length} entries
          </span>
          <AdminRoundedPagination
            activePage={bookingHistoryActivePage}
            ariaLabel="Booking and cancellation history pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) =>
              buildCustomerDetailPageHref(
                `/customers/${id}`,
                detailSearchParams,
                'bookingHistoryPage',
                page,
                'booking-history',
              )
            }
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={bookingHistoryTotalPages}
          />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group customer-chat-retention-section"
        description="Matched booking chat archive status for cancellation, no-show, and service evidence review."
        id="customer-chat-retention-ledger"
        resultLabel={`${customerChatRetentionRows.length} booking row(s)`}
        resultTone="info"
        title="Customer chat retention ledger"
      >
        <div className="service-trace-summary customer-chat-retention-summary">
          {customerChatRetentionSummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No booking row matched this date filter."
            headers={CUSTOMER_CHAT_RETENTION_HEADERS}
            rowCount={visibleCustomerChatRetentionRows.length}
          >
            {visibleCustomerChatRetentionRows.map((row) => (
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
                  <strong>{row.adminRetention}</strong>
                  <p className="muted">
                    {row.mobileVisibility} / {row.adminRetentionDetail}
                  </p>
                </td>
                <td>
                  <Link className="text-link" href={row.bookingHref}>
                    Booking
                  </Link>
                  {row.chatHref ? (
                    <Link className="text-link admin-ml-10" href={row.chatHref}>
                      Archive
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <div className="vuexy-booking-table-footer customer-chat-retention-footer">
          <span>
            Showing {chatRetentionPageFrom} to {chatRetentionPageTo} of {customerChatRetentionRows.length} entries
          </span>
          <AdminRoundedPagination
            activePage={chatRetentionActivePage}
            ariaLabel="Customer chat retention ledger pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) =>
              buildCustomerDetailPageHref(
                `/customers/${id}`,
                detailSearchParams,
                'chatRetentionPage',
                page,
                'customer-chat-retention-ledger',
              )
            }
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={chatRetentionTotalPages}
          />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="booking-monitor booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group customer-booking-ops-ledger-section"
        description="Booking-level notes, staff tasks, and closeout context linked to this customer."
        id="customer-booking-ops-ledger"
        resultLabel={`${customerBookingOpsLedgerRows.length} booking note row(s)`}
        resultTone="info"
        title="Booking operations note ledger"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No booking-level operation notes or staff tasks matched this customer date filter."
            headers={CUSTOMER_BOOKING_OPS_LEDGER_HEADERS}
            rowCount={visibleCustomerBookingOpsLedgerRows.length}
          >
            {visibleCustomerBookingOpsLedgerRows.map((row) => (
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
                  <p className="muted">
                    {row.taskStatus} / {compactText(row.taskDetail, 88)}
                  </p>
                </td>
                <td>
                  <strong>{row.closeoutStatus}</strong>
                  <p className="muted">{compactText(row.closeoutDetail, 96)}</p>
                </td>
                <td>
                  <Link className="text-link" href={row.bookingHref}>
                    Booking
                  </Link>
                  {row.chatHref ? (
                    <Link className="text-link admin-ml-10" href={row.chatHref}>
                      Chat
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
        <div className="vuexy-booking-table-footer customer-booking-ops-ledger-footer">
          <span>
            Showing {bookingOpsLedgerPageFrom} to {bookingOpsLedgerPageTo} of {customerBookingOpsLedgerRows.length} entries
          </span>
          <AdminRoundedPagination
            activePage={bookingOpsLedgerActivePage}
            ariaLabel="Booking operations note ledger pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) =>
              buildCustomerDetailPageHref(
                `/customers/${id}`,
                detailSearchParams,
                'bookingOpsLedgerPage',
                page,
                'customer-booking-ops-ledger',
              )
            }
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={bookingOpsLedgerTotalPages}
          />
        </div>
      </AdminFilterPanel>

      <AdminFilterPanel
        className="customer-chat-history-section"
        description={
          <>
            Admin archive for every matched booking. Customer and Partner apps hide the chat after
            completion, but operations keeps the full message history here.
          </>
        }
        id="chat-history"
        resultLabel={`${filteredChatBookings.length} rooms`}
        resultTone="info"
        title="Chat history"
      >
        <div className="setup-stage-list customer-chat-history-list">
          {visibleChatBookings.length > 0 ? (
            visibleChatBookings.map((booking) => (
              <CustomerChatHistoryRoomCard
                booking={booking}
                dateFilters={dateFilters}
                key={booking.id}
              />
            ))
          ) : (
            <p className="muted">No chat rooms matched this date filter.</p>
          )}
        </div>
        <div className="vuexy-booking-table-footer customer-chat-history-footer">
          <span>
            Showing {chatHistoryPageFrom} to {chatHistoryPageTo} of {filteredChatBookings.length} rooms
          </span>
          <AdminRoundedPagination
            activePage={chatHistoryActivePage}
            ariaLabel="Customer chat history pages"
            className="vuexy-booking-pagination"
            hrefForPage={(page) =>
              buildCustomerDetailPageHref(
                `/customers/${id}`,
                detailSearchParams,
                'chatHistoryPage',
                page,
                'chat-history',
              )
            }
            pageLinkClassName="vuexy-booking-page-link"
            totalPages={chatHistoryTotalPages}
          />
        </div>
      </AdminFilterPanel>

      <section className="card admin-mb-16" id="customer-activity">
        <div className="ops-section-header">
          <div>
            <h2>Customer chronological activity</h2>
            <p className="muted">
              Latest customer events across bookings, work, chat, payment, address, app, notification,
              review, and staff records.
            </p>
          </div>
          <span className="pill pill-info">
            {visibleCustomerActivityRecords.length}/{filteredCustomerActivityRecords.length} latest
          </span>
        </div>
        <div className="service-trace-summary admin-mt-14">
          {customerActivitySummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </div>
          ))}
        </div>
        <div className="setup-stage-list admin-mt-12">
          {visibleCustomerActivityRecords.length > 0 ? (
            visibleCustomerActivityRecords.map((record) => (
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
        {filteredCustomerActivityRecords.length > visibleCustomerActivityRecords.length ? (
          <p className="muted admin-mt-12">
            {filteredCustomerActivityRecords.length - visibleCustomerActivityRecords.length} more event(s) are grouped
            in the daily activity digest below.
          </p>
        ) : null}
      </section>

      <section className="card admin-mb-16" id="customer-daily-digest">
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
        <div className="setup-stage-list admin-mt-12">
          {customerDailyActivityDigest.length > 0 ? (
            customerDailyActivityDigest.map((day) => (
              <div className="setup-stage-item" key={day.key}>
                <span>{day.label}</span>
                <div>
                  <strong>{day.total} event(s)</strong>
                  <p className="muted">
                    {day.typeCounts.map((item) => `${item.type} ${item.count}`).join(' / ')}
                  </p>
                  <div className="setup-stage-list admin-mt-10">
                    {day.highlights.map((record) => (
                      <div className="service-matrix-cell" key={`${record.type}-${record.id}-${record.at}`}>
                        <strong>{record.title}</strong>
                        <small>
                          {record.type} / {formatDate(record.at)}
                        </small>
                        <p className="muted admin-m-0">
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

      <section className="card" id="notifications">
        <div className="ops-section-header">
          <div>
            <h2>Support and device trace</h2>
            <p className="muted">
              Device reachability, app sessions, notification delivery, and customer audit rows in one
              support trace.
            </p>
          </div>
          <span className="pill pill-info">
            {pushDevices.length} device(s) / {filteredNotifications.length} notification row(s)
          </span>
        </div>
        <div className="service-trace-summary admin-mt-12">
          <div>
            <span>Push devices</span>
            <strong>{pushDevices.filter((device) => device.enabled).length}/{pushDevices.length}</strong>
            <small>Enabled push targets</small>
          </div>
          <div>
            <span>App sessions</span>
            <strong>{appSessions.filter((session) => session.active).length}/{appSessions.length}</strong>
            <small>Active customer sessions</small>
          </div>
          <div>
            <span>Notifications</span>
            <strong>{filteredNotifications.length}</strong>
            <small>Rows in selected filter</small>
          </div>
          <div>
            <span>Audit logs</span>
            <strong>{filteredAuditLogs.length}</strong>
            <small>Operator/system actions</small>
          </div>
        </div>
        <div className="grid admin-mt-16">
          <div>
            <h3>Device and session state</h3>
            <div className="setup-stage-list admin-mt-12">
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
              {appSessions.length > 0 ? (
                appSessions.slice(0, 8).map((session) => (
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
          </div>
          <div>
            <h3>Latest support rows</h3>
            <div className="setup-stage-list admin-mt-12">
              <div className="ops-row">
                <strong>Notification</strong>
                <span>
                  {filteredNotifications[0]
                    ? `${displayMarketplaceText(filteredNotifications[0].title)} / ${formatDate(
                        filteredNotifications[0].createdAt,
                      )}`
                    : 'No notification row'}
                </span>
              </div>
              <div className="ops-row">
                <strong>Audit</strong>
                <span>
                  {filteredAuditLogs[0]
                    ? `${filteredAuditLogs[0].action} / ${formatDate(filteredAuditLogs[0].createdAt)}`
                    : 'No audit row'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ops-section-header admin-mt-16">
          <div>
            <h3>Recent customer notifications</h3>
            <p className="muted">Delivery status for missed booking, payment, and chat updates.</p>
          </div>
          <span className="pill pill-info">{filteredNotifications.length} rows</span>
        </div>
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={null}
            headers={CUSTOMER_NOTIFICATION_HEADERS}
            rowCount={filteredNotifications.slice(0, 20).length}
          >
            {filteredNotifications.slice(0, 20).map((notification) => (
              <tr key={notification.id}>
                <td>
                  <strong>{displayMarketplaceText(notification.title)}</strong>
                  <p className="muted">{displayMarketplaceText(notification.body)}</p>
                </td>
                <td>{displayMarketplaceText(notification.type)}</td>
                <td>{formatDate(notification.createdAt)}</td>
                <td>{notification.deliveries?.[0]?.status ?? 'No delivery'}</td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>

        <div className="ops-section-header admin-mt-16" id="audit-trail">
          <div>
            <h3>Customer audit trail</h3>
            <p className="muted">Recent operator notes and system actions attached to this customer.</p>
          </div>
          <span className="pill pill-info">{filteredAuditLogs.length} logs</span>
        </div>
        <AdminTableScroll>
          <AdminDataTable
            emptyMessage={null}
            headers={CUSTOMER_AUDIT_TRAIL_HEADERS}
            rowCount={filteredAuditLogs.slice(0, 20).length}
          >
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
          </AdminDataTable>
        </AdminTableScroll>
      </section>
      </CustomerDetailSectionBand>
    </div>
  );
}

function CustomerChatHistoryRoomCard({
  booking,
  dateFilters,
}: {
  readonly booking: AdminBookingDetail;
  readonly dateFilters: DetailDateFilters;
}) {
  const filteredMessages = readChatMessages(booking).filter((message) =>
    isWithinDetailDateFilter(message.createdAt, dateFilters),
  );

  return (
    <div className="card customer-chat-history-room-card">
      <div className="ops-section-header">
        <div>
          <strong>
            {shortId(booking.id)} / {bookingServiceLabel(booking)}
          </strong>
          <p className="muted">
            {booking.status} / Room {booking.chatRoom?.id}
          </p>
        </div>
        <div className="customer-chat-history-actions">
          <Link className="text-link" href={`/bookings/${booking.id}`}>
            Open booking
          </Link>
          {booking.chatRoom ? (
            <Link className="text-link" href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
              Open full chat archive
            </Link>
          ) : null}
        </div>
      </div>
      <div className="admin-grid-gap-8 admin-mt-10">
        {filteredMessages.map((message) => (
          <div className="ops-task-note" key={message.id}>
            <strong>{message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender'}</strong>
            <p>{message.body}</p>
            <p className="muted">{formatDate(message.createdAt)}</p>
          </div>
        ))}
        {filteredMessages.length === 0 ? (
          <p className="muted">No messages in this date filter, but the room belongs to this period.</p>
        ) : null}
      </div>
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
type CustomerDailyActivityDigest = {
  key: string;
  label: string;
  total: number;
  latestAt?: string;
  typeCounts: Array<{ type: string; count: number }>;
  highlights: CustomerActivityRecord[];
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

type CustomerBookingOperationBuckets = {
  readonly live: readonly AdminBookingDetail[];
  readonly completed: readonly AdminBookingDetail[];
  readonly preMatchCancelled: readonly AdminBookingDetail[];
  readonly partnerCancelled: readonly AdminBookingDetail[];
};

function buildCustomerBookingOperationBuckets(
  bookings: readonly AdminBookingDetail[],
): CustomerBookingOperationBuckets {
  const orderedBookings = [...bookings].sort(
    (left, right) => dateMs(bookingLatestActivityAt(right)) - dateMs(bookingLatestActivityAt(left)),
  );

  return {
    live: orderedBookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)),
    completed: orderedBookings.filter((booking) => booking.status === 'COMPLETED'),
    preMatchCancelled: orderedBookings.filter(isCustomerPreMatchCancellation),
    partnerCancelled: orderedBookings.filter(isCustomerPartnerCancellation),
  };
}

function buildCustomerBookingOperationMetrics(
  bookings: readonly AdminBookingDetail[],
  buckets: CustomerBookingOperationBuckets,
): CustomerBookingOperationMetric[] {
  const cancellationCount = buckets.preMatchCancelled.length + buckets.partnerCancelled.length;
  const latestActivityAt = bookings
    .map((booking) => bookingLatestActivityAt(booking))
    .sort((left, right) => dateMs(right) - dateMs(left))[0];

  return [
    {
      helper: latestActivityAt ? `Latest update ${formatDate(latestActivityAt)}` : 'No booking activity loaded.',
      label: 'Total bookings',
      tone: 'pill-info',
      value: String(bookings.length),
    },
    {
      helper: `${buckets.live.length} booking(s) currently visible at the top of this board.`,
      label: 'Current work',
      tone: buckets.live.length ? 'pill-warn' : 'pill-neutral',
      value: String(buckets.live.length),
    },
    {
      helper: 'Completed service rows retained for customer support.',
      label: 'Completed work',
      tone: 'pill-success',
      value: String(buckets.completed.length),
    },
    {
      helper: `${buckets.preMatchCancelled.length} pre-match / ${buckets.partnerCancelled.length} Partner cancel`,
      label: 'Cancellation split',
      tone: cancellationCount ? 'pill-warn' : 'pill-neutral',
      value: String(cancellationCount),
    },
  ];
}

function buildCustomerBookingOperationGroups(
  buckets: CustomerBookingOperationBuckets,
  searchParams: Record<string, string | string[] | undefined>,
): CustomerBookingOperationGroup[] {
  return [
    {
      countTone: buckets.live.length ? 'pill-warn' : 'pill-neutral',
      description: 'Bookings still waiting for matching, matched, on the way, arrived, or in service.',
      emptyMessage: 'No current or in-progress booking matched this filter.',
      key: 'live',
      page: readCustomerBookingOperationPage(searchParams, 'liveBookingsPage'),
      pageParam: 'liveBookingsPage',
      rows: buildCustomerBookingOperationRows(buckets.live),
      title: 'Current / In Progress',
    },
    {
      countTone: 'pill-success',
      description: 'Completed service rows with service price, Partner, address, and state timestamp.',
      emptyMessage: 'No completed booking matched this filter.',
      key: 'completed',
      page: readCustomerBookingOperationPage(searchParams, 'completedBookingsPage'),
      pageParam: 'completedBookingsPage',
      rows: buildCustomerBookingOperationRows(buckets.completed),
      title: 'Completed',
    },
    {
      countTone: buckets.preMatchCancelled.length ? 'pill-warn' : 'pill-neutral',
      description: 'Bookings closed before a final matched Partner signal was recorded.',
      emptyMessage: 'No pre-match cancellation matched this filter.',
      key: 'pre-match-cancelled',
      page: readCustomerBookingOperationPage(searchParams, 'preMatchCancelledBookingsPage'),
      pageParam: 'preMatchCancelledBookingsPage',
      rows: buildCustomerBookingOperationRows(buckets.preMatchCancelled),
      title: 'Pre-match Cancellations',
    },
    {
      countTone: buckets.partnerCancelled.length ? 'pill-danger' : 'pill-neutral',
      description: 'Partner-side post-match cancellations and no-show style rows for admin review history.',
      emptyMessage: 'No Partner cancellation matched this filter.',
      key: 'partner-cancelled',
      page: readCustomerBookingOperationPage(searchParams, 'partnerCancelledBookingsPage'),
      pageParam: 'partnerCancelledBookingsPage',
      rows: buildCustomerBookingOperationRows(buckets.partnerCancelled),
      title: 'Partner Cancellations',
    },
  ];
}

function buildCustomerBookingOperationRows(
  bookings: readonly AdminBookingDetail[],
): CustomerBookingOperationRow[] {
  return bookings.map((booking) => {
    const partnerId = booking.selectedProviderId ?? booking.selectedProvider?.id ?? booking.preferredProviderId;
    const participantCount = booking.participants?.length ?? 0;
    const selectedPartner = Boolean(booking.selectedProviderId ?? booking.selectedProvider);
    const preferredPartner = !selectedPartner && Boolean(booking.preferredProviderId ?? booking.preferredProvider);
    const stateAt = booking.statusChangedAt ?? booking.closedAt ?? bookingLatestActivityAt(booking);

    return {
      addressLabel: compactText(customerBookingAddressListLabel(booking), 84),
      bookingHelper: `${booking.status} / State ${formatDate(stateAt)}`,
      bookingHref: `/bookings/${booking.id}`,
      bookingLabel: shortId(booking.id),
      id: booking.id,
      partnerAvatarStatus: customerBookingPartnerAvatarStatus(booking),
      partnerHelper: customerBookingPartnerHelper(selectedPartner, preferredPartner, participantCount),
      partnerHref: partnerId ? `/partners/${partnerId}` : null,
      partnerLabel: partnerId ? bookingPartnerDisplayName(booking) : 'No Partner selected',
      requestTimeLabel: formatDate(bookingRequestOpenedAt(booking)),
      serviceLabel: bookingServiceLabel(booking),
      servicePriceLabel: formatMoney(bookingTotal(booking)),
      stateDetail: formatDate(stateAt),
      stateLabel: customerBookingStateLabel(booking),
      stateTone: bookingStatusPillClass(booking.status),
    };
  });
}

function readCustomerBookingOperationPage(
  searchParams: Record<string, string | string[] | undefined>,
  pageParam: string,
) {
  const rawValue = searchParams[pageParam];
  const rawPage = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const page = rawPage ? Number(rawPage) : 1;
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function readCustomerBookingHistoryPage(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return readCustomerBookingOperationPage(searchParams, 'bookingHistoryPage');
}

function buildCustomerDetailPageHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  pageParam: string,
  page: number,
  sectionId: string,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === pageParam || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }

  if (page > 1) {
    params.set(pageParam, String(page));
  }

  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}#${sectionId}`;
}

function isCustomerPreMatchCancellation(booking: AdminBookingDetail) {
  return (
    ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status) &&
    !isCustomerPartnerCancellation(booking)
  );
}

function isCustomerPartnerCancellation(booking: AdminBookingDetail) {
  if (booking.status === 'NO_SHOW') return true;
  if (!['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status)) return false;
  if (booking.closedByRole === 'PROVIDER') return true;
  return customerBookingHasMatchedPartnerSignal(booking);
}

function customerBookingHasMatchedPartnerSignal(booking: AdminBookingDetail) {
  const matchedValue = Boolean(
    booking.selectedProviderId ??
      booking.selectedProvider ??
      booking.matchedAt ??
      booking.earning ??
      booking.matchingEvidence?.matchedAt,
  );

  return (
    matchedValue ||
    booking.matchingEvidence?.stage === 'MATCHED' ||
    booking.matchingEvidence?.stage === 'SERVICE_ACTIVE'
  );
}

function customerBookingAddressListLabel(booking: AdminBookingDetail) {
  return (
    booking.serviceAddressText ??
    booking.addressSnapshot?.addressText ??
    (booking.addressSnapshot?.address ? stringifyAddress(booking.addressSnapshot.address) : null) ??
    (booking.address ? stringifyAddress(booking.address) : null) ??
    'No booking address loaded'
  );
}

function customerBookingPartnerAvatarStatus(booking: AdminBookingDetail) {
  if (MATCHING_AVATAR_STATUSES.has(booking.status)) return 'matching';
  if (WORKING_AVATAR_STATUSES.has(booking.status)) return 'working';
  if (booking.status === 'COMPLETED') return 'offline';
  if (isCustomerPartnerCancellation(booking)) return 'offline';
  return 'offline';
}

function customerBookingPartnerHelper(
  selectedPartner: boolean,
  preferredPartner: boolean,
  participantCount: number,
) {
  if (selectedPartner) return `Matched Partner / ${participantCount} participating`;
  if (preferredPartner) return `Requested Partner / ${participantCount} participating`;
  if (participantCount > 0) return `${participantCount} participating`;
  return 'No Partner activity';
}

function customerBookingStateLabel(booking: AdminBookingDetail) {
  if (booking.status === 'COMPLETED') return 'Completed';
  if (isCustomerPartnerCancellation(booking)) return booking.status === 'NO_SHOW' ? 'No-show' : 'Partner cancel';
  if (isCustomerPreMatchCancellation(booking)) return 'Pre-match cancel';
  if (WORKING_AVATAR_STATUSES.has(booking.status)) return 'In progress';
  if (MATCHING_AVATAR_STATUSES.has(booking.status)) return 'Matching';
  return booking.status;
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
  wallet: ReturnType<typeof customerWalletSummary>;
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
      )}. Check Partner, payment, location, and chat records from the booking detail page.`,
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
        'Matching should create a customer and Partner chat. Open the booking and verify chat creation before service continues.',
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
        'The room is open. Leave a factual note if staff confirms the customer and Partner are communicating outside chat.',
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
        'Ask the customer to confirm a map pin or saved address before dispatch so Partner distance and service location stay clear.',
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
      label: 'Preferred Partner',
      value: frequentPartner ?? 'Not enough bookings',
      helper: 'Most repeated selected or preferred Partner in this archive',
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

function buildCustomerActivityPlan(
  customer: AdminCustomerDetail,
  bookings: AdminBookingDetail[],
  wallet: ReturnType<typeof customerWalletSummary>,
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
          ? `${bookingServiceLabel(lastCompletedBooking)} / ${formatDate(bookingLatestActivityAt(lastCompletedBooking))}`
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

function readCustomerDeviceLanguageLabel(appSessions: readonly AdminAppSession[]) {
  const language = appSessions.find((session) => session.deviceLanguage)?.deviceLanguage;
  return language ?? 'Unknown';
}

function customerCountryDisplay(label: string) {
  const sourceLabel = label.trim() || 'Unknown';
  const region = customerCountryRegion(sourceLabel);

  return {
    fullLabel: region ? customerCountryName(region) : 'Unknown',
    sourceLabel,
  };
}

function customerCountryRegion(label: string) {
  if (!label || label === 'Unknown') {
    return null;
  }

  const normalized = label.replace(/_/g, '-').trim();
  const parts = normalized.split('-').filter(Boolean);
  const lastPart = parts.at(-1);

  if (lastPart && /^[a-z]{2}$/i.test(lastPart) && parts.length > 1) {
    return lastPart.toUpperCase();
  }

  if (/^[a-z]{2}$/i.test(normalized) && normalized.toLowerCase() === 'vi') {
    return 'VN';
  }

  return null;
}

function customerCountryName(region: string) {
  const countryNames: Record<string, string> = {
    CN: 'China',
    JP: 'Japan',
    KR: 'South Korea',
    SG: 'Singapore',
    TH: 'Thailand',
    US: 'United States',
    VN: 'Vietnam',
  };

  return countryNames[region] ?? region;
}

function readCustomerGenderLabel(customer: AdminCustomerDetail) {
  const directGender = readString(readCustomerLooseField(customer, 'gender'));
  if (directGender) return normalizeCustomerGenderLabel(directGender);

  const user = customer.user as (NonNullable<AdminCustomerDetail['user']> & {
    gender?: unknown;
    metadata?: unknown;
    rawUserMetaData?: unknown;
    userMetadata?: unknown;
  }) | undefined;
  const userGender = readString(user?.gender);
  if (userGender) return normalizeCustomerGenderLabel(userGender);

  const metadata = {
    ...readMetadataObject(user?.metadata),
    ...readMetadataObject(user?.userMetadata),
    ...readMetadataObject(user?.rawUserMetaData),
  };
  const metadataGender =
    readString(metadata.gender) ??
    readString(metadata.sex) ??
    readString(metadata.profileGender) ??
    readString(metadata.customerGender);

  return metadataGender ? normalizeCustomerGenderLabel(metadataGender) : 'Not saved';
}

function readCustomerLooseField(customer: AdminCustomerDetail, key: string) {
  return (customer as AdminCustomerDetail & Record<string, unknown>)[key];
}

function normalizeCustomerGenderLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['female', 'f', 'woman', 'women'].includes(normalized)) return 'Female';
  if (['male', 'm', 'man', 'men'].includes(normalized)) return 'Male';
  return value.trim();
}

function buildSavedAddressListValue(addresses: Array<{ key: string; label: string; value: string }>) {
  if (addresses.length === 0) {
    return 'No saved address';
  }

  return compactText(addresses.slice(0, 3).map((address) => address.value).join(' / '), 132);
}

function buildCustomerPartnerRails(
  bookings: AdminBookingDetail[],
  favoriteProviders: NonNullable<AdminCustomerDetail['favoriteProviders']>,
  viewedProviders: NonNullable<AdminCustomerDetail['viewedProviders']>,
): CustomerDetailPartnerRail[] {
  const viewedPartners = buildViewedPartnerAvatars(viewedProviders);
  const favoritePartners = buildFavoritePartnerAvatars(favoriteProviders);
  const completedPartners = buildCompletedPartnerAvatars(bookings);

  return [
    {
      title: 'Viewed Partners',
      helper: 'Partner profiles this customer opened in the app.',
      emptyMessage: 'No viewed Partner rows are captured for this customer yet.',
      partners: viewedPartners,
      totalCount: countCustomerViewedPartners(viewedProviders),
    },
    {
      title: 'Favorite Partners',
      helper: 'Partners the customer saved for direct requests.',
      emptyMessage: 'No favorite Partner rows are captured for this customer yet.',
      partners: favoritePartners,
      totalCount: countCustomerFavoritePartners(favoriteProviders),
    },
    {
      title: 'Completed Partners',
      helper: 'Partners with completed customer work.',
      emptyMessage: 'No completed Partner history is loaded yet.',
      partners: completedPartners,
      totalCount: countCustomerCompletedPartners(bookings),
    },
  ];
}

function countCustomerFavoritePartners(
  favorites: NonNullable<AdminCustomerDetail['favoriteProviders']>,
) {
  return favorites.filter((favorite) => favorite.providerProfileId || favorite.providerProfile?.id).length;
}

function countCustomerViewedPartners(views: NonNullable<AdminCustomerDetail['viewedProviders']>) {
  return views.filter((view) => view.providerProfileId || view.providerProfile?.id).length;
}

function countCustomerCompletedPartners(bookings: AdminBookingDetail[]) {
  const partnerIds = new Set<string>();

  for (const booking of bookings) {
    if (booking.status !== 'COMPLETED') continue;
    const partnerId = booking.selectedProviderId ?? booking.selectedProvider?.id ?? booking.preferredProviderId;
    if (partnerId) {
      partnerIds.add(partnerId);
    }
  }

  return partnerIds.size;
}

function buildFavoritePartnerAvatars(
  favorites: NonNullable<AdminCustomerDetail['favoriteProviders']>,
): CustomerDetailPartnerAvatar[] {
  return favorites
    .filter((favorite) => favorite.providerProfileId || favorite.providerProfile?.id)
    .map((favorite) => {
      const partner = favorite.providerProfile;
      const partnerId = favorite.providerProfileId ?? partner?.id ?? null;
      return {
        id: `favorite-${favorite.id}`,
        href: partnerId ? `/partners/${partnerId}` : null,
        label: displayMarketplaceText(
          partner?.displayName ?? partner?.user?.fullName ?? partner?.user?.phone ?? 'Favorite Partner',
        ),
        helper: `Saved ${formatDate(favorite.createdAt)}`,
        status: partnerAvatarStatusFromProviderStatus(partner?.status, 'CREATED'),
      };
    })
    .slice(0, 8);
}

function buildViewedPartnerAvatars(
  views: NonNullable<AdminCustomerDetail['viewedProviders']>,
): CustomerDetailPartnerAvatar[] {
  return views
    .filter((view) => view.providerProfileId || view.providerProfile?.id)
    .map((view) => {
      const partner = view.providerProfile;
      const partnerId = view.providerProfileId ?? partner?.id ?? null;
      const viewCountLabel = view.viewCount > 1 ? ` / ${view.viewCount} views` : '';
      return {
        id: `viewed-${view.id}`,
        href: partnerId ? `/partners/${partnerId}` : null,
        label: displayMarketplaceText(
          partner?.displayName ?? partner?.user?.fullName ?? partner?.user?.phone ?? 'Viewed Partner',
        ),
        helper: `Last viewed ${formatDate(view.lastViewedAt)}${viewCountLabel}`,
        status: partnerAvatarStatusFromProviderStatus(partner?.status, 'CREATED'),
      };
    })
    .slice(0, 8);
}

function buildCompletedPartnerAvatars(bookings: AdminBookingDetail[]): CustomerDetailPartnerAvatar[] {
  const partners = new Map<string, CustomerDetailPartnerAvatar>();
  const completedBookings = bookings
    .filter((booking) => booking.status === 'COMPLETED')
    .sort((left, right) => dateMs(bookingLatestActivityAt(right)) - dateMs(bookingLatestActivityAt(left)));

  for (const booking of completedBookings) {
    const partnerId = booking.selectedProviderId ?? booking.selectedProvider?.id ?? booking.preferredProviderId;
    if (!partnerId || partners.has(partnerId)) {
      continue;
    }

    const label = bookingPartnerDisplayName(booking);
    partners.set(partnerId, {
      id: `${partnerId}-${booking.id}`,
      href: `/partners/${partnerId}`,
      label,
      helper: `Latest completed ${formatDate(bookingLatestActivityAt(booking))}`,
      status: partnerAvatarStatusFromBooking(booking),
    });
  }

  return [...partners.values()].slice(0, 8);
}

function partnerAvatarStatusFromBooking(booking: AdminBookingDetail): AdminAvatarStatus {
  return partnerAvatarStatusFromProviderStatus(
    booking.selectedProvider?.status ?? booking.preferredProvider?.status,
    booking.status,
  );
}

function partnerAvatarStatusFromProviderStatus(
  status: string | null | undefined,
  bookingStatus: string,
): AdminAvatarStatus {
  const providerStatus = (status ?? '').toUpperCase();
  if (WORKING_AVATAR_STATUSES.has(bookingStatus)) return 'working';
  if (MATCHING_AVATAR_STATUSES.has(bookingStatus)) return 'matching';
  if (providerStatus.includes('ONLINE') || providerStatus.includes('AVAILABLE')) return 'online';
  if (providerStatus.includes('DELETED') || providerStatus.includes('REMOVED')) return 'app-deleted';
  return 'offline';
}

function preferredPartnerDisplayName(booking: AdminBookingDetail) {
  return displayMarketplaceText(
    booking.preferredProvider?.displayName ??
      booking.preferredProvider?.user?.fullName ??
      booking.preferredProvider?.user?.phone ??
      'No Partner',
  );
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
      at: bookingRecordCreatedAt(booking) ?? '',
      title: `${booking.status} booking ${shortId(booking.id)}`,
      detail: `${bookingServiceLabel(booking)} / Partner ${bookingPartnerDisplayName(
        booking,
      )} / opened ${formatDate(bookingRequestOpenedAt(booking))}${
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
        at: bookingLatestActivityAt(booking) ?? '',
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
        title: `${booking.earning.status} Partner earning`,
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
        title: `${participant.status} Partner participant`,
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
        detail: `${displayMarketplaceText(delivery.provider)} / device ${device.platform}`,
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
      detail: `${displayMarketplaceText(notification.type)} / ${notification.readAt ? `read ${formatDate(notification.readAt)}` : 'unread'} / ${
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
        detail: `${displayMarketplaceText(delivery.provider)} / ${displayMarketplaceText(notification.title)}`,
        href: '/notifications',
      });
    }
  }

  for (const review of customer.reviews ?? []) {
    records.push({
      id: review.id,
      type: 'REVIEW',
      at: review.createdAt ?? '',
      title: `Service feedback left for ${review.providerProfile?.displayName ?? 'Partner'}`,
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
      const gate = bookingCreateGateReasonFilter(reasonCode);
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
          ? `Optional GPS evidence: ${formatDate(currentLocationRecordedAt)}`
          : 'No optional GPS timestamp',
        serviceId ? `Service ${shortId(serviceId)}` : null,
        preferredProviderId ? `First-pick Partner ${shortId(preferredProviderId)}` : null,
      ].filter(Boolean);

      return {
        id: log.id,
        at: log.createdAt,
        gate,
        gateLabel: bookingCreateGateFilterLabel(gate),
        reasonLabel: bookingCreateGateReasonLabel(reasonCode, 'customerDetail'),
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
        bookingLabel: `${shortId(booking.id)} / ${formatDate(bookingLatestActivityAt(booking))}`,
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
      bookingLabel: `${shortId(booking.id)} / ${formatDate(bookingLatestActivityAt(booking))}`,
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
          : 'Pre-match bookings do not open customer and Partner chat yet.',
      latestSender,
      latestMessage: latestMessage ? compactText(latestMessage.body, 120) : 'No retained message loaded',
      latestMessageAt: latestMessage?.createdAt,
      mobileVisibility: mobileHidden
        ? 'Hidden in mobile after closeout'
        : booking.chatRoom
          ? 'Visible while service is active'
          : 'Not visible yet',
      mobileVisibilityDetail: mobileHidden
        ? 'Customer and Partner apps may hide completed or closed chats, but admin keeps the archive.'
        : booking.chatRoom
          ? 'Room should remain visible until the service is completed or closed.'
          : bookingChatOpensAfterMatchOrSelectionCopy,
      adminRetention: booking.chatRoom
        ? 'Admin archive retained'
        : requiresRoom
          ? 'Admin repair needed'
          : 'Waiting for match',
      adminRetentionDetail: booking.chatRoom
        ? 'Use the archive link for full message evidence.'
        : requiresRoom
          ? 'Open the booking detail to repair or investigate the missing room.'
          : 'No customer and Partner chat evidence is expected before matching.',
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
        ? 'Partner'
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
      return 'Live customer and Partner room';
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
