import type { ReactNode } from 'react';
import { Download, Filter, Save, X } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import {
  AdminReviewRecordsSection,
  reviewRecordsForCustomer,
} from '../../../components/admin-review-records-section';
import { AdminManualWalletAdjustmentHistory } from '../../../components/admin-manual-wallet-adjustment-history';
import { AdminTraceSummary } from '../../../components/admin-overview-card';
import { MoneyText } from '../../../components/money-text';
import { DateTimeText } from '../../../components/date-time-text';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormDate,
  AdminFormGrid,
  AdminFormShell,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../components/admin-form-controls';
import {
  AdminChatWindow,
  type AdminChatWindowMessage,
  type AdminChatWindowMessageRole,
} from '../../../components/admin-chat-window';
import { AdminPageTemplate, AdminSectionHeader } from '../../../components/admin-page-template';
import { AdminStageItem, AdminStageList } from '../../../components/admin-stage-item';
import { AdminCard, AdminNotePanel, AdminSection } from '../../../components/admin-surface';
import { AdminTextLink } from '../../../components/admin-text-link';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  AdminAppSession,
  AdminAuditLog,
  AdminBookingDetail,
  AdminChatMessage,
  AdminCustomerDetail,
  AdminManualWalletAdjustmentRow,
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
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { readAddressText, serviceAddressAreaLabel } from '../../bookings/booking-address-readers';
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
import { customerSelectedLocationDetail } from './customer-detail-location-copy';
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
  type CustomerDetailUsageSummary,
} from './customer-detail-overview-shell';
import { CustomerDetailSectionBand } from './customer-detail-section-shell';

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
const CUSTOMER_CHAT_HISTORY_PAGE_SIZE = 3;
const CUSTOMER_BOOKING_GATE_PREVIEW_LIMIT = 8;
const CUSTOMER_NOTIFICATION_PREVIEW_LIMIT = 10;
const CUSTOMER_AUDIT_TRAIL_PREVIEW_LIMIT = 10;
const CUSTOMER_MANUAL_ADJUSTMENT_HISTORY_LIMIT = 5;
const CUSTOMER_NOTIFICATION_HEADERS = ['Notification', 'Type', 'Created', 'Delivery'] as const;
const CUSTOMER_AUDIT_TRAIL_HEADERS = ['Action', 'Actor', 'Created', 'Metadata'] as const;

export default async function CustomerDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const detailSearchParams = searchParams ? await searchParams : {};
  const dateFilters = readDetailDateFilters(detailSearchParams);
  const activityType = readDetailActivityType(detailSearchParams, CUSTOMER_ACTIVITY_TYPE_OPTIONS);
  const activityOrder = readDetailActivityOrder(detailSearchParams);
  const shouldRenderRecordArchive = readCustomerRecordArchiveMode(detailSearchParams) === 'all';
  const canLoadCustomerDiagnostics = canViewAdminDeveloperSystem(await getCurrentAdminOperatorAccess());
  const [customer, customerManualAdjustmentRows] = await Promise.all([
    adminGet<AdminCustomerDetail | null>(
      `/admin/customers/${id}?includeDiagnostics=${canLoadCustomerDiagnostics ? 'true' : 'false'}`,
      null,
    ),
    adminGet<AdminManualWalletAdjustmentRow[]>(
      `/admin/wallet-adjustments?ownerType=CUSTOMER&ownerId=${encodeURIComponent(
        id,
      )}&take=${CUSTOMER_MANUAL_ADJUSTMENT_HISTORY_LIMIT}`,
      [],
    ),
  ]);

  if (!customer) {
    notFound();
  }

  const currentTimeMs = new Date().getTime();
  const customerReviewRecords = reviewRecordsForCustomer(
    customer.reviews ?? [],
    customer.providerReviews ?? [],
    customer.id,
  );
  const bookings = customer.bookings ?? [];
  const wallet = customerWalletSummary(bookings);
  const customerWalletAdjustmentHref = `/wallet-adjustments?ownerType=CUSTOMER&ownerId=${encodeURIComponent(customer.id)}`;
  const bookingStats = buildBookingStats(bookings);
  const addresses = buildAddressRows(customer);
  const latestBooking = bookings[0];
  const activeBooking = bookings.find((booking) => ACTIVE_STATUSES.includes(booking.status));
  const lastCompletedBooking = bookings.find((booking) => booking.status === 'COMPLETED');
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
  const activityPlan = buildCustomerActivityPlan(bookings, wallet, bookingStats, addresses);
  const customerActivityRecords = buildCustomerActivityRecords(customer, bookings, addresses);
  const recentAuditLogs = customer.auditLogs ?? [];
  const filteredBookings = bookings.filter((booking) =>
    isWithinDetailDateFilter(bookingLatestActivityAt(booking), dateFilters),
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
      isWithinDetailDateFilter(bookingLatestActivityAt(booking), dateFilters) ||
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
  const filteredCustomerActivityRecords = orderCustomerActivityRecords(
    customerActivityRecords.filter(
      (record) =>
        isWithinDetailDateFilter(record.at, dateFilters) &&
        isWithinDetailActivityType(record.type, activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS),
    ),
    activityOrder,
  );
  const filteredNotifications = notifications.filter((notification) =>
    isWithinDetailDateFilter(notification.createdAt, dateFilters),
  );
  const filteredAuditLogs = recentAuditLogs.filter((log) =>
    isWithinDetailDateFilter(log.createdAt, dateFilters),
  );
  const visibleNotifications = filteredNotifications.slice(0, CUSTOMER_NOTIFICATION_PREVIEW_LIMIT);
  const visibleAuditLogs = filteredAuditLogs.slice(0, CUSTOMER_AUDIT_TRAIL_PREVIEW_LIMIT);
  const recordArchiveHref = buildCustomerDetailModeHref(
    `/customers/${id}`,
    detailSearchParams,
    'records',
    'all',
    'chat-history',
  );
  const bookingCreateGateAttempts = buildCustomerBookingGateAttemptRows(recentAuditLogs, customer.id);
  const filteredBookingCreateGateAttempts = buildCustomerBookingGateAttemptRows(
    filteredAuditLogs,
    customer.id,
  );
  const customerCountry = customerCountryDisplay(readCustomerDeviceLanguageLabel(appSessions));
  const accountFacts = buildCustomerAccountFacts({
    addresses,
    bookings,
    customer,
    diagnosticsLoaded: canLoadCustomerDiagnostics,
    notificationCount: notifications.length,
    pushDevices,
  });
  const customerOperatorCommandQueue = buildCustomerOperatorCommandQueue({
    customer,
    bookings,
    addresses,
    latestSession,
    diagnosticsLoaded: canLoadCustomerDiagnostics,
    pushDevices,
    notifications,
    currentTimeMs,
  });
  const filteredActivityCsvHref = buildCustomerActivityExportHref(customer.id, detailSearchParams);
  const overviewPartnerRails = buildCustomerPartnerRails(
    bookings,
    customer.favoriteProviders ?? [],
    customer.viewedProviders ?? [],
  );
  const overviewUsageSummary = buildCustomerUsageSummary({
    appSessions,
    bookings,
    customer,
    diagnosticsLoaded: canLoadCustomerDiagnostics,
    favoriteProviders: customer.favoriteProviders ?? [],
    viewedProviders: customer.viewedProviders ?? [],
  });
  const overviewStatusBadges = [
    activeBooking ? 'Active booking' : 'No live booking',
    ...(canLoadCustomerDiagnostics
      ? [
          pushDevices.some((device) => device.enabled) ? 'Push ready' : 'No push device',
          latestSession
            ? currentTimeMs - dateMs(latestSession.lastSeenAt) <= 30 * 60_000
              ? 'In app now'
              : 'Recent session saved'
            : 'No app session',
        ]
      : []),
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
      value: <MoneyText amount={wallet.customerBalance} />,
      helper: (
        <>
          Captured <MoneyText amount={wallet.capturedSpend} /> / refunded{' '}
          <MoneyText amount={wallet.refundAmount} />
        </>
      ),
    },
    {
      label: 'Completed work',
      value: `${bookingStats.completed}`,
      helper: lastCompletedBooking ? (
        <>
          Latest <DateTimeText value={bookingLatestActivityAt(lastCompletedBooking)} />
        </>
      ) : (
        'No completed service record yet.'
      ),
    },
    {
      label: 'Saved addresses',
      value: `${addresses.length}`,
      helper: addresses[0]?.value ? compactText(addresses[0].value, 72) : 'No saved address loaded yet.',
    },
  ];
  const overviewFacts: CustomerDetailOverviewFact[] = [
    {
      label: 'Gender',
      value: readCustomerGenderLabel(customer),
      helper: 'Customer profile gender value from admin API when available.',
    },
    {
      label: 'Sign-up Date',
      value: 'Unknown',
      valueDateTimeFallback: 'Unknown',
      valueDateTimeValue: customer.user?.createdAt,
      helper: customer.user?.updatedAt ? (
        <>
          Last account update <DateTimeText value={customer.user.updatedAt} />
        </>
      ) : (
        'No account update timestamp loaded.'
      ),
    },
    ...(canLoadCustomerDiagnostics
      ? [
          {
            label: 'Country',
            value: customerCountry.fullLabel,
            helper:
              customerCountry.sourceLabel === 'Unknown'
                ? 'No device language loaded.'
                : customerCountry.sourceLabel,
          },
          {
            label: 'Last Login Date',
            value: 'No session',
            valueDateTimeFallback: 'No session',
            valueDateTimeValue: latestSession?.lastSeenAt,
            helper: latestSession
              ? `${latestSession.platform ?? 'Unknown platform'} / ${
                  latestSession.appVersion ?? 'No app version'
                }`
              : 'No app session loaded.',
          },
          {
            label: 'Last Login Address',
            value: latestSession?.lastLoginAddress ?? latestSession?.ipAddress ?? 'No login address loaded',
            helper: latestSession?.ipAddress
              ? `IP ${latestSession.ipAddress}`
              : 'No login location evidence loaded.',
          },
        ]
      : []),
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
      helper: latestBooking ? (
        <>
          {latestBooking.status} / <DateTimeText value={bookingLatestActivityAt(latestBooking)} />
        </>
      ) : (
        'No booking has been created for this customer.'
      ),
    },
    {
      label: 'Wallet Amount',
      value: <MoneyText amount={wallet.customerBalance} />,
      helper: (
        <>
          {wallet.refundCount} refund row(s) / captured spend <MoneyText amount={wallet.capturedSpend} />
        </>
      ),
    },
  ];
  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/customers">Back to customers</AdminFormControlLink>
          {latestBooking?.id && (
            <AdminTextLink href={`/bookings/${latestBooking.id}`}>Open latest booking</AdminTextLink>
          )}
          <AdminTextLink href={`/payments?customer=${customer.id}`}>Payment view</AdminTextLink>
          <AdminTextLink href={`/chat-archive?q=${encodeURIComponent(customer.id)}`}>
            All customer chats
          </AdminTextLink>
        </>
      }
      contentClassName="customer-detail-page"
      description={`${customer.user?.fullName ?? 'Unnamed customer'} / ${customer.user?.phone ?? 'No phone'}`}
      title="Customer detail"
    >
      <CustomerDetailSectionBand
        eyebrow="Operations"
        title="Customer operating picture"
        description="Above-fold decision support for the desk: what is live now, what is blocked, what evidence exists, and which linked records matter next."
        status={<StatusBadge tone="info">Operator flow</StatusBadge>}
      >
        <CustomerDetailOverviewShell
          avatarStatus={customerAvatarStatus}
          facts={overviewFacts}
          highlights={overviewHighlights}
          name={customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer'}
          partnerRails={overviewPartnerRails}
          statusBadges={overviewStatusBadges}
          subtitle={`${customer.user?.phone ?? 'No phone'} / ${customer.user?.email ?? 'No email'}`}
          usageSummary={overviewUsageSummary}
        />
      </CustomerDetailSectionBand>

      <CustomerBookingOperationBoard
        basePath={`/customers/${id}`}
        groups={customerBookingOperationGroups}
        metrics={customerBookingOperationMetrics}
        searchParams={detailSearchParams}
      />

      <AdminReviewRecordsSection
        basePath={`/customers/${id}`}
        customerReviews={customerReviewRecords.customerReviews}
        description="Customer review records and Partner-written internal evaluations connected to this customer."
        id="customer-review-records"
        partnerEvaluations={customerReviewRecords.partnerEvaluations}
        searchParams={detailSearchParams}
        title="Customer review records"
      />

      <AdminSection
        actions={
          <>
            <StatusBadge tone={filteredBookingCreateGateAttempts.length > 0 ? 'warning' : 'neutral'}>
              {filteredBookingCreateGateAttempts.length} filtered
            </StatusBadge>
            <StatusBadge tone="neutral">{bookingCreateGateAttempts.length} total</StatusBadge>
            <AdminTextLink href="/bookings?view=blocked-create">Open gate queue</AdminTextLink>
          </>
        }
        className="admin-mb-16"
        description="Booking creation attempts stopped before payment and matching. These rows show factual gate evidence for customer support checks."
        id="customer-booking-create-gates"
        title="Customer blocked create attempts"
      >
        {filteredBookingCreateGateAttempts.length === 0 ? (
          <p className="muted admin-mt-12">No booking create gate attempt matched this date filter.</p>
        ) : (
          <AdminStageList className="admin-mt-14">
            {filteredBookingCreateGateAttempts
              .slice(0, CUSTOMER_BOOKING_GATE_PREVIEW_LIMIT)
              .map((attempt) => (
                <AdminStageItem key={attempt.id}>
                  <span>{attempt.gateLabel}</span>
                  <div>
                    <AdminTextLink href={attempt.bookingMonitorHref}>
                      <strong>{attempt.reasonLabel}</strong>
                    </AdminTextLink>
                    <p className="muted">{attempt.detail}</p>
                    <AdminFilterChipGroup className="admin-mt-8">
                      <StatusBadgeFromPillClass pillClass={attempt.tone}>
                        {attempt.gateLabel}
                      </StatusBadgeFromPillClass>
                      <StatusBadge tone="neutral">{attempt.addressLabel}</StatusBadge>
                      <StatusBadge tone="neutral">{attempt.distanceLabel}</StatusBadge>
                    </AdminFilterChipGroup>
                    <AdminFilterChipGroup className="admin-mt-8">
                      <AdminTextLink href={attempt.bookingMonitorHref}>Booking gate queue</AdminTextLink>
                      <AdminTextLink href={attempt.auditHref}>Audit evidence</AdminTextLink>
                    </AdminFilterChipGroup>
                  </div>
                  <small>
                    <DateTimeText value={attempt.at} />
                  </small>
                </AdminStageItem>
              ))}
          </AdminStageList>
        )}
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Next factual actions for the customer desk. This queue only points operators to live bookings, chat archives, payment rows, saved locations, devices, and staff notes that may need follow-up."
        id="customer-operator-command-queue"
        status={
          <StatusBadgeFromPillClass pillClass={customerSupportPillClass(customerOperatorCommandQueue.tone)}>
            {customerOperatorCommandQueue.status}
          </StatusBadgeFromPillClass>
        }
        title="Customer operator command queue"
      >
        <AdminStageList className="admin-mt-14">
          {customerOperatorCommandQueue.commands.map((command) => (
            <AdminNotePanel className={`ops-task-${command.tone}`} key={command.id}>
              <div className="ops-row">
                <div>
                  <StatusBadgeFromPillClass pillClass={customerSupportPillClass(command.tone)}>
                    {command.label}
                  </StatusBadgeFromPillClass>
                  <h3>{command.title}</h3>
                  <p className="muted">{command.detailNode ?? command.detail}</p>
                  <small className="muted">Owner: {command.owner}</small>
                </div>
                <CustomerOperatorCommandAction command={command} customerId={customer.id} />
              </div>
            </AdminNotePanel>
          ))}
        </AdminStageList>
      </AdminSection>

      <AdminSection
        actions={
          <>
            <StatusBadge tone="info">{dateFilters.label}</StatusBadge>
            <StatusBadge tone="neutral">
              {detailActivityTypeLabel(activityType, CUSTOMER_ACTIVITY_TYPE_OPTIONS)}
            </StatusBadge>
            <StatusBadge tone="neutral">{activityOrderLabel(activityOrder)}</StatusBadge>
          </>
        }
        className="admin-mb-16"
        description="Narrow booking, chat, notification, audit, and activity records without changing the saved customer data."
        id="record-date-filter"
        title="Record date filter"
      >
        <AdminFormGrid className="admin-mt-14" action={`/customers/${customer.id}`}>
          <AdminFormSelect
            className="admin-directory-filter-select"
            defaultValue={dateFilters.range}
            label="Preset"
            name="range"
            options={detailDateRangeOptions}
          />
          <AdminFormSelect
            className="admin-directory-filter-select"
            defaultValue={activityType}
            label="Record type"
            name="type"
            options={CUSTOMER_ACTIVITY_TYPE_OPTIONS}
          />
          <AdminFormSelect
            className="admin-directory-filter-select"
            defaultValue={activityOrder}
            label="Sort order"
            name="order"
            options={DETAIL_ACTIVITY_ORDER_OPTIONS}
          />
          <AdminFormDate
            className="admin-form-control-fluid"
            defaultValue={dateFilters.from}
            label="From"
            name="from"
          />
          <AdminFormDate
            className="admin-form-control-fluid"
            defaultValue={dateFilters.to}
            label="To"
            name="to"
          />
          <div className="actions">
            <AdminFormControlButton className="admin-directory-filter-button">
              <Filter aria-hidden="true" size={16} />
              Apply filter
            </AdminFormControlButton>
            <AdminFormControlLink
              className="admin-directory-filter-export"
              download={`hands-customer-${shortId(customer.id)}-activity.csv`}
              href={filteredActivityCsvHref}
              title="Exports filtered activity rows from the protected server route"
            >
              <Download aria-hidden="true" size={16} />
              Export activity CSV
            </AdminFormControlLink>
            <AdminFormControlLink
              className="admin-directory-filter-button is-ghost"
              href={`/customers/${customer.id}`}
            >
              <X aria-hidden="true" size={16} />
              Clear
            </AdminFormControlLink>
          </div>
        </AdminFormGrid>
      </AdminSection>

      <AdminSection
        className="admin-mb-16"
        description="Facts-only operator view for booking progress, completed work, archived chats, payment records, addresses, and customer contact."
        status={
          <StatusBadgeFromPillClass pillClass={customerSupportPillClass(activityPlan.tone)}>
            {activityPlan.status}
          </StatusBadgeFromPillClass>
        }
        title="Customer activity action panel"
      >
        <AdminNotePanel className="ops-task-pending admin-mt-14">
          <div className="ops-row">
            <div>
              <strong>{activityPlan.headline}</strong>
              <p className="muted">{activityPlan.detail}</p>
              <AdminFilterChipGroup className="admin-mt-8">
                {activityPlan.badges.map((badge) => (
                  <StatusBadgeFromPillClass
                    key={badge.label}
                    pillClass={customerSupportPillClass(badge.tone)}
                  >
                    {badge.label}
                  </StatusBadgeFromPillClass>
                ))}
              </AdminFilterChipGroup>
            </div>
            <AdminTextLink href={activityPlan.primaryHref}>{activityPlan.primaryAction}</AdminTextLink>
          </div>
        </AdminNotePanel>
        <AdminFormGrid action={addCustomerOpsNote} className="compact-form admin-mt-14">
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
        </AdminFormGrid>
      </AdminSection>

      <CustomerDetailSectionBand
        eyebrow="Account"
        title="Customer account and balance"
        description="Identity, saved contact facts, wallet readout, and location evidence grouped together so support can answer profile questions without scanning the full ledger."
        status={<StatusBadge tone="info">Profile and wallet</StatusBadge>}
      >
        <AdminSection
          actions={
            <>
              <StatusBadge tone="info">{accountFacts.length} field(s)</StatusBadge>
              {canLoadCustomerDiagnostics ? (
                <StatusBadge tone={pushDevices.some((device) => device.enabled) ? 'success' : 'neutral'}>
                  {pushDevices.some((device) => device.enabled) ? 'Push reachable' : 'No push device'}
                </StatusBadge>
              ) : null}
            </>
          }
          className="admin-mb-16"
          description="Contact, booking, payment, and support evidence that is not already repeated in the profile overview. Missing values are shown plainly instead of guessed."
          id="customer-account-evidence"
          title="Customer contact and evidence"
        >
          <AdminTraceSummary
            className="admin-mt-12"
            metrics={accountFacts.map((fact) => ({
              detail: fact.helper,
              label: fact.label,
              value: fact.value,
            }))}
          />
        </AdminSection>

        <AdminSection
          actions={
            <>
              <StatusBadge tone="info">
                <MoneyText amount={wallet.customerBalance} />
              </StatusBadge>
              <StatusBadge tone="neutral">{addresses.length} saved address(es)</StatusBadge>
              <AdminTextLink href={customerWalletAdjustmentHref}>Review or create adjustment</AdminTextLink>
            </>
          }
          className="admin-mb-16"
          description="Payment ledger and saved address evidence in one operator readout. Partner cash-fee debt is never carried on the customer account."
          id="customer-account-operations"
          title="Customer account operations"
        >
          <AdminStageList className="admin-mt-12">
            <AdminNotePanel className="ops-task-info">
              <AdminSectionHeader
                actions={
                  <StatusBadge tone="info">
                    <MoneyText amount={wallet.customerBalance} />
                  </StatusBadge>
                }
                description={wallet.operatorNote}
                title="Payment ledger"
              />
              <div className="ops-row">
                <strong>Captured payments</strong>
                <MoneyText amount={wallet.capturedSpend} />
              </div>
              <div className="ops-row">
                <strong>Authorized / pending</strong>
                <MoneyText amount={wallet.pendingPaymentAmount} />
              </div>
              <div className="ops-row">
                <strong>Refund exposure</strong>
                <MoneyText amount={wallet.refundAmount} />
              </div>
              <div className="ops-row">
                <strong>Cash bookings</strong>
                <MoneyText amount={wallet.cashBookingAmount} />
              </div>
              <div className="ops-row">
                <strong>Customer balance</strong>
                <MoneyText amount={wallet.customerBalance} />
              </div>
            </AdminNotePanel>
            <AdminNotePanel className="ops-task-info" id="addresses">
              <AdminSectionHeader
                actions={<StatusBadge tone="neutral">{addresses.length} row(s)</StatusBadge>}
                description="Profile addresses and map pins selected in the customer app."
                title="Saved addresses"
              />
              {addresses.length > 0 ? (
                addresses.slice(0, 6).map((address) => (
                  <div className="ops-row" key={address.key}>
                    <strong>{address.labelNode ?? address.label}</strong>
                    <span>{address.value}</span>
                  </div>
                ))
              ) : (
                <AdminEmptyState framed message="No saved address yet." title={null} />
              )}
            </AdminNotePanel>
          </AdminStageList>
        </AdminSection>
        <AdminManualWalletAdjustmentHistory
          rows={customerManualAdjustmentRows}
          walletAdjustmentsHref={customerWalletAdjustmentHref}
        />
      </CustomerDetailSectionBand>

      <CustomerDetailSectionBand
        eyebrow="Records"
        title="Chat and audit record"
        description="Retained chat history, customer notification delivery, and audit trail in one archive block."
        status={<StatusBadge tone="info">Historical archive</StatusBadge>}
      >
        {shouldRenderRecordArchive ? (
          <>
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
              <AdminStageList className="customer-chat-history-list">
                {visibleChatBookings.length > 0 ? (
                  visibleChatBookings.map((booking) => (
                    <CustomerChatHistoryRoomCard
                      booking={booking}
                      dateFilters={dateFilters}
                      key={booking.id}
                    />
                  ))
                ) : (
                  <AdminEmptyState framed message="No chat rooms matched this date filter." title={null} />
                )}
              </AdminStageList>
              <AdminTablePaginationFooter
                activePage={chatHistoryActivePage}
                ariaLabel="Customer chat history pages"
                className="customer-chat-history-footer"
                from={chatHistoryPageFrom}
                hrefForPage={(page) =>
                  buildCustomerDetailPageHref(
                    `/customers/${id}`,
                    detailSearchParams,
                    'chatHistoryPage',
                    page,
                    'chat-history',
                  )
                }
                itemLabel="rooms"
                to={chatHistoryPageTo}
                totalPages={chatHistoryTotalPages}
                totalRows={filteredChatBookings.length}
              />
            </AdminFilterPanel>

            <AdminSection
              actions={
                <>
                  <StatusBadge tone="info">{filteredNotifications.length} notification row(s)</StatusBadge>
                  <StatusBadge tone="info">{filteredAuditLogs.length} audit log(s)</StatusBadge>
                </>
              }
              description="Customer notification delivery and audit rows for support review."
              id="notifications"
              title="Notification and audit records"
            >
              <AdminSectionHeader
                actions={<StatusBadge tone="info">{filteredNotifications.length} rows</StatusBadge>}
                className="admin-mt-16"
                description="Delivery status for missed booking, payment, and chat updates."
                title="Recent customer notifications"
              />
              <AdminTableScroll>
                <AdminDataTable
                  emptyMessage={null}
                  headers={CUSTOMER_NOTIFICATION_HEADERS}
                  rowCount={visibleNotifications.length}
                >
                  {visibleNotifications.map((notification) => (
                    <tr key={notification.id}>
                      <td>
                        <strong>{displayMarketplaceText(notification.title)}</strong>
                        <p className="muted">{displayMarketplaceText(notification.body)}</p>
                      </td>
                      <td>{displayMarketplaceText(notification.type)}</td>
                      <td>
                        <DateTimeText value={notification.createdAt} />
                      </td>
                      <td>{notification.deliveries?.[0]?.status ?? 'No delivery'}</td>
                    </tr>
                  ))}
                </AdminDataTable>
              </AdminTableScroll>
              <AdminSectionHeader
                actions={<StatusBadge tone="info">{filteredAuditLogs.length} logs</StatusBadge>}
                className="admin-mt-16"
                description="Recent operator notes and system actions attached to this customer."
                title="Customer audit trail"
                titleId="audit-trail"
              />
              <AdminTableScroll>
                <AdminDataTable
                  emptyMessage={null}
                  headers={CUSTOMER_AUDIT_TRAIL_HEADERS}
                  rowCount={visibleAuditLogs.length}
                >
                  {visibleAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.action}</td>
                      <td>{log.actor?.fullName ?? log.actor?.phone ?? 'System'}</td>
                      <td>
                        <DateTimeText value={log.createdAt} />
                      </td>
                      <td>
                        <code>{compactJson(log.metadata)}</code>
                      </td>
                    </tr>
                  ))}
                </AdminDataTable>
              </AdminTableScroll>
            </AdminSection>
          </>
        ) : (
          <AdminSection
            actions={
              <>
                <StatusBadge tone="info">{filteredChatBookings.length} chat room(s)</StatusBadge>
                <StatusBadge tone="info">{filteredNotifications.length} notification row(s)</StatusBadge>
                <StatusBadge tone="info">{filteredAuditLogs.length} audit log(s)</StatusBadge>
              </>
            }
            description="Chat, notification, and audit rows stay available on this customer detail page, but the default view keeps the record archive collapsed."
            id="customer-record-archive-summary"
            title="Record archive summary"
          >
            <AdminTraceSummary
              className="admin-mt-12"
              metrics={[
                {
                  label: 'Chat rooms',
                  value: filteredChatBookings.length,
                  detail: 'Matched booking chat archives retained for admin evidence.',
                },
                {
                  label: 'Notifications',
                  value: filteredNotifications.length,
                  detail: 'Customer notification delivery rows in the selected date range.',
                },
                {
                  label: 'Audit logs',
                  value: filteredAuditLogs.length,
                  detail: 'Customer operator and system audit records in the selected date range.',
                },
              ]}
            />
            <AdminFormControlLink className="button-secondary admin-mt-12" href={recordArchiveHref}>
              Load record archive
            </AdminFormControlLink>
          </AdminSection>
        )}
      </CustomerDetailSectionBand>
    </AdminPageTemplate>
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
  const chatMessages = filteredMessages.map(customerChatWindowMessage);
  const customerName =
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
  const partnerName = bookingPartnerDisplayName(booking);

  return (
    <AdminCard className="customer-chat-history-room-card">
      <AdminSectionHeader
        actions={
          <div className="customer-chat-history-actions">
            <AdminTextLink href={`/bookings/${booking.id}`}>Open booking</AdminTextLink>
            {booking.chatRoom ? (
              <AdminTextLink href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
                Open full chat archive
              </AdminTextLink>
            ) : null}
          </div>
        }
        description={`${booking.status} / Room ${booking.chatRoom?.id}`}
        title={`${shortId(booking.id)} / ${bookingServiceLabel(booking)}`}
      />
      <AdminChatWindow
        avatarLabel={customerName}
        className="admin-mt-12"
        emptyMessage="No messages in this date filter, but the room belongs to this period."
        messages={chatMessages}
        subtitle={`${partnerName} / ${booking.status}`}
        title={`${customerName} chat evidence`}
      />
    </AdminCard>
  );
}

function customerChatWindowMessage(message: AdminChatMessage): AdminChatWindowMessage {
  const role = customerChatMessageRole(message);
  return {
    body: message.body,
    createdDateTime: message.createdAt,
    id: message.id,
    role,
    senderLabel: message.sender?.fullName ?? message.sender?.phone ?? customerChatRoleLabel(role),
  };
}

function customerChatMessageRole(message: AdminChatMessage): AdminChatWindowMessageRole {
  const roles = message.sender?.roles ?? [];
  if (roles.includes('CUSTOMER')) return 'CUSTOMER';
  if (roles.includes('PROVIDER')) return 'PROVIDER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return 'SYSTEM';
}

function customerChatRoleLabel(role: AdminChatWindowMessageRole) {
  if (role === 'CUSTOMER') return 'Customer';
  if (role === 'PROVIDER') return 'Partner';
  if (role === 'ADMIN') return 'Admin';
  return 'System';
}

type CustomerOperatorTone = 'success' | 'info' | 'warn' | 'danger';

type CustomerOperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  detailNode?: ReactNode;
  owner: string;
  tone: CustomerOperatorTone;
  action:
    | { type: 'link'; href: string; label: string }
    | { type: 'note'; preset: string; label: string; bookingId?: string };
};

type CustomerPushDevice = NonNullable<NonNullable<AdminCustomerDetail['user']>['pushDevices']>[number];
type CustomerAddressRow = {
  key: string;
  label: string;
  labelNode?: ReactNode;
  value: string;
};

type CustomerActivityRecord = {
  id: string;
  type: string;
  at: string;
  title: string;
  detail: string;
  href?: string;
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
    return <AdminTextLink href={command.action.href}>{command.action.label}</AdminTextLink>;
  }

  return (
    <AdminFormShell action={addCustomerOpsNote} className="compact-form">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="preset" value={command.action.preset} />
      <input type="hidden" name="bookingId" value={command.action.bookingId ?? ''} />
      <AdminFormControlButton type="submit">{command.action.label}</AdminFormControlButton>
    </AdminFormShell>
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
      helper: latestActivityAt ? (
        <>
          Latest update <DateTimeText value={latestActivityAt} />
        </>
      ) : (
        'No booking activity loaded.'
      ),
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
    const partnerId =
      booking.selectedProviderId ?? booking.selectedProvider?.id ?? booking.preferredProviderId;
    const participantCount = booking.participants?.length ?? 0;
    const selectedPartner = Boolean(booking.selectedProviderId ?? booking.selectedProvider);
    const preferredPartner =
      !selectedPartner && Boolean(booking.preferredProviderId ?? booking.preferredProvider);
    const stateAt = booking.statusChangedAt ?? booking.closedAt ?? bookingLatestActivityAt(booking);

    return {
      addressLabel: compactText(customerBookingAddressListLabel(booking), 84),
      bookingHelper: (
        <>
          {booking.status} / State <DateTimeText value={stateAt} />
        </>
      ),
      bookingHref: `/bookings/${booking.id}`,
      bookingLabel: shortId(booking.id),
      id: booking.id,
      partnerAvatarStatus: customerBookingPartnerAvatarStatus(booking),
      partnerHelper: customerBookingPartnerHelper(selectedPartner, preferredPartner, participantCount),
      partnerHref: partnerId ? `/partners/${partnerId}` : null,
      partnerLabel: partnerId ? bookingPartnerDisplayName(booking) : 'No Partner selected',
      paymentDetailLabel: customerBookingPaymentDetailLabel(booking),
      paymentTypeLabel: customerBookingPaymentTypeLabel(booking),
      requestTimeLabel: <DateTimeText value={bookingRequestOpenedAt(booking)} />,
      serviceLabel: bookingServiceLabel(booking),
      servicePriceAmount: bookingTotal(booking),
      servicePriceCurrency: 'VND',
      stateDetail: <DateTimeText value={stateAt} />,
      stateLabel: customerBookingStateLabel(booking),
      stateTone: bookingStatusPillClass(booking.status),
    };
  });
}

function customerBookingPaymentTypeLabel(booking: AdminBookingDetail) {
  const method = booking.payment?.method?.toUpperCase();

  switch (method) {
    case 'CASH':
      return 'Cash';
    case 'MOMO':
    case 'WALLET':
    case 'ZALOPAY':
      return 'Wallet';
    case 'CARD':
    case 'VNPAY':
      return 'Card';
    default:
      return method ? displayMarketplaceText(method) : 'No payment';
  }
}

function customerBookingPaymentDetailLabel(booking: AdminBookingDetail) {
  if (!booking.payment) {
    return 'No payment row';
  }

  return (
    <>
      {booking.payment.status} /{' '}
      <MoneyText amount={Number(booking.payment.amount ?? 0)} currency={booking.payment.currency ?? 'VND'} />
    </>
  );
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

function readCustomerRecordArchiveMode(searchParams: Record<string, string | string[] | undefined>) {
  return readCustomerDetailSearchParam(searchParams.records) === 'all' ? 'all' : 'summary';
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

function buildCustomerDetailModeHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  modeParam: string,
  modeValue: string,
  sectionId: string,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === modeParam || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }

  params.set(modeParam, modeValue);
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}#${sectionId}`;
}

function buildCustomerActivityExportHref(
  customerId: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  const allowedKeys = new Set(['range', 'type', 'order', 'from', 'to']);

  for (const [key, value] of Object.entries(searchParams)) {
    if (!allowedKeys.has(key) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return `/api/admin/customers/${encodeURIComponent(customerId)}/activity/export${query ? `?${query}` : ''}`;
}

function readCustomerDetailSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function isCustomerPreMatchCancellation(booking: AdminBookingDetail) {
  return (
    ['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(booking.status) && !isCustomerPartnerCancellation(booking)
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
  return 'No matching participation';
}

function customerBookingStateLabel(booking: AdminBookingDetail) {
  if (booking.status === 'COMPLETED') return 'Completed';
  if (isCustomerPartnerCancellation(booking))
    return booking.status === 'NO_SHOW' ? 'No-show' : 'Partner cancel';
  if (isCustomerPreMatchCancellation(booking)) return 'Pre-match cancel';
  if (WORKING_AVATAR_STATUSES.has(booking.status)) return 'In progress';
  if (MATCHING_AVATAR_STATUSES.has(booking.status)) return 'Matching';
  return booking.status;
}

function buildCustomerOperatorCommandQueue({
  customer,
  bookings,
  addresses,
  latestSession,
  diagnosticsLoaded,
  pushDevices,
  notifications,
  currentTimeMs,
}: {
  customer: AdminCustomerDetail;
  bookings: AdminBookingDetail[];
  addresses: CustomerAddressRow[];
  latestSession?: AdminAppSession;
  diagnosticsLoaded: boolean;
  pushDevices: CustomerPushDevice[];
  notifications: AdminNotification[];
  currentTimeMs: number;
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
  const staleSession = !latestSession || currentTimeMs - lastSeenMs > 1000 * 60 * 60 * 24 * 7;
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
    const paymentStatus = paymentIssueBooking.payment?.status ?? 'Unknown';
    const paymentMethod = paymentIssueBooking.payment?.method ?? 'No method';
    const paymentCurrency = paymentIssueBooking.payment?.currency ?? 'VND';

    commands.push({
      id: `payment-${paymentIssueBooking.id}`,
      label: 'Payment row',
      title: 'Review the latest non-captured payment status',
      detail: `${paymentStatus} / ${paymentMethod} / ${paymentCurrency} payment amount`,
      detailNode: (
        <>
          {paymentStatus} / {paymentMethod} /{' '}
          <MoneyText amount={Number(paymentIssueBooking.payment?.amount ?? 0)} currency={paymentCurrency} />
        </>
      ),
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

  if (diagnosticsLoaded && enabledPushDevices.length === 0) {
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

  if (diagnosticsLoaded && staleSession) {
    commands.push({
      id: 'session-stale',
      label: 'App session',
      title: latestSession ? 'Customer app session is older than 7 days' : 'No customer app session recorded',
      detail: latestSession
        ? 'Customer app session is older than 7 days.'
        : 'No mobile session row is loaded for this customer.',
      detailNode: latestSession ? (
        <>
          Last seen <DateTimeText value={latestSession.lastSeenAt} /> on{' '}
          {latestSession.platform ?? 'unknown platform'}.
        </>
      ) : undefined,
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

  if (diagnosticsLoaded && unreadNotifications.length > 0) {
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
    commands: commands.slice(0, 8),
  };
}

function buildCustomerAccountFacts({
  addresses,
  bookings,
  customer,
  diagnosticsLoaded,
  notificationCount,
  pushDevices,
}: {
  addresses: CustomerAddressRow[];
  bookings: AdminBookingDetail[];
  customer: AdminCustomerDetail;
  diagnosticsLoaded: boolean;
  notificationCount: number;
  pushDevices: CustomerPushDevice[];
}) {
  const sessions = customer.user?.appSessions ?? [];
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
  const refundAmount = refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
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
      label: 'Name',
      value: customer.user?.fullName ?? 'Not saved',
      helper: 'Customer profile name',
    },
    {
      label: 'Phone',
      value: customer.user?.phone ?? 'Not saved',
      helper: customer.user?.phone ? 'Phone OTP identity' : 'Phone login is not saved',
    },
    {
      label: 'Email',
      value: customer.user?.email ?? 'Not saved',
      helper: 'Optional contact field',
    },
    {
      label: 'Login method',
      value: customer.user?.phone ? 'Phone OTP' : 'Not captured',
      helper: 'Phone auth remains the primary customer login method',
    },
    ...(diagnosticsLoaded
      ? [
          {
            label: 'Devices',
            value: `${sessions.length} session(s) / ${pushDevices.length} push device(s)`,
            helper: `${pushDevices.filter((device) => device.enabled).length} enabled push device(s)`,
          },
        ]
      : []),
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
      helper: latestPaymentBooking?.payment ? (
        <>
          {latestPaymentBooking.payment.status} /{' '}
          <MoneyText
            amount={Number(latestPaymentBooking.payment.amount ?? 0)}
            currency={latestPaymentBooking.payment.currency ?? 'VND'}
          />
        </>
      ) : (
        'No payment row loaded'
      ),
    },
    {
      label: 'Refund records',
      value: refunds.length.toString(),
      helper: <MoneyText amount={refundAmount} />,
    },
    {
      label: 'Saved addresses',
      value: addresses.length.toString(),
      helper: addresses[0]?.value ?? 'No saved customer address',
    },
    {
      label: 'CS / admin notes',
      value: notes.length.toString(),
      helper: notes[0]?.createdAt ? (
        <>
          Latest <DateTimeText value={notes[0].createdAt} />
        </>
      ) : (
        'No support note saved'
      ),
    },
    {
      label: 'Notifications',
      value: notificationCount.toString(),
      helper: 'Recent in-app notification rows',
    },
  ];
}

function buildCustomerActivityPlan(
  bookings: AdminBookingDetail[],
  wallet: ReturnType<typeof customerWalletSummary>,
  bookingStats: ReturnType<typeof buildBookingStats>,
  addresses: CustomerAddressRow[],
) {
  const latestBooking = bookings[0];
  const paymentIssueCount = bookings.filter((booking) => {
    return booking.payment && !['AUTHORIZED', 'CAPTURED'].includes(booking.payment.status);
  }).length;
  const chatArchiveCount = bookings.filter((booking) => booking.chatRoom).length;
  const missingAddress = addresses.length === 0;
  const activityFacts = [
    bookingStats.active > 0 ? `${bookingStats.active} active booking(s)` : null,
    bookingStats.completed > 0 ? `${bookingStats.completed} completed work record(s)` : null,
    paymentIssueCount > 0 ? `${paymentIssueCount} payment status row(s)` : null,
    wallet.refundAmount > 0 ? (
      <>
        <MoneyText amount={wallet.refundAmount} /> refund record(s)
      </>
    ) : null,
    chatArchiveCount > 0 ? `${chatArchiveCount} archived chat room(s)` : null,
    missingAddress ? 'No saved address' : null,
  ].filter(Boolean) as ReactNode[];
  const tone: 'success' | 'info' = latestBooking ? 'info' : 'success';
  const primaryHref = latestBooking?.id ? `/bookings/${latestBooking.id}` : '/customers';
  const primaryAction = latestBooking?.id ? 'Open latest booking' : 'Back to customers';
  return {
    tone,
    status: latestBooking ? 'Activity recorded' : 'No bookings yet',
    headline:
      activityFacts.length > 0
        ? joinCustomerActivityFacts(activityFacts)
        : 'No customer booking activity yet.',
    detail:
      activityFacts.length > 0
        ? 'Use this panel to leave factual notes for the next operator.'
        : 'When this customer books, the profile, booking, payment, chat archive, and address records will appear here.',
    primaryHref,
    primaryAction,
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

function joinCustomerActivityFacts(activityFacts: ReactNode[]): ReactNode {
  return activityFacts.flatMap((fact, index) => (index === 0 ? [fact] : [' / ', fact]));
}

function buildAddressRows(customer: AdminCustomerDetail) {
  const rows: CustomerAddressRow[] = [];
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
      label: 'Selected service address',
      labelNode: (
        <>
          Selected service address <DateTimeText value={location.createdAt} />
        </>
      ),
      value: customerSelectedLocationDetail(location),
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
    VN: 'Vietnam',
  };

  return countryNames[region] ?? displayCustomerDetailRegionName(region);
}

function displayCustomerDetailRegionName(region: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

function readCustomerGenderLabel(customer: AdminCustomerDetail) {
  const directGender = readString(readCustomerLooseField(customer, 'gender'));
  if (directGender) return normalizeCustomerGenderLabel(directGender);

  const user = customer.user as
    | (NonNullable<AdminCustomerDetail['user']> & {
        gender?: unknown;
        metadata?: unknown;
        rawUserMetaData?: unknown;
        userMetadata?: unknown;
      })
    | undefined;
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

function buildSavedAddressListValue(addresses: CustomerAddressRow[]) {
  if (addresses.length === 0) {
    return 'No saved address';
  }

  return compactText(
    addresses
      .slice(0, 3)
      .map((address) => address.value)
      .join(' / '),
    132,
  );
}

type CustomerUsageSummaryInput = {
  readonly appSessions: readonly AdminAppSession[];
  readonly bookings: readonly AdminBookingDetail[];
  readonly customer: AdminCustomerDetail;
  readonly diagnosticsLoaded: boolean;
  readonly favoriteProviders: NonNullable<AdminCustomerDetail['favoriteProviders']>;
  readonly viewedProviders: NonNullable<AdminCustomerDetail['viewedProviders']>;
};

type CustomerBookingRegionCount = {
  readonly count: number;
  readonly label: string;
  readonly latestAt: string | null;
};

function buildCustomerUsageSummary({
  appSessions,
  bookings,
  customer,
  diagnosticsLoaded,
  favoriteProviders,
  viewedProviders,
}: CustomerUsageSummaryInput): CustomerDetailUsageSummary {
  const latestSession = appSessions[0];
  const bookingRegions = buildCustomerBookingRegionRows(bookings);
  const primaryRegion = bookingRegions[0];
  const addressSnapshotCount = bookings.filter((booking) => customerStoredBookingAddressText(booking)).length;
  const selectedLocationCount = (customer.selectedLocations ?? []).filter((location) =>
    readAddressText(location.addressText),
  ).length;
  const favoriteCount = countCustomerFavoritePartners(favoriteProviders);
  const viewedCount = countCustomerViewedPartners(viewedProviders);
  const completedPartnerCount = countCustomerCompletedPartners([...bookings]);

  return {
    title: 'Usage and region summary',
    helper: 'Built from stored sessions, service addresses, and Partner links. No live GPS polling.',
    items: [
      ...(diagnosticsLoaded
        ? [
            {
              helper: latestSession ? (
                <>
                  Latest <DateTimeText value={latestSession.lastSeenAt} /> /{' '}
                  {latestSession.platform ?? 'Unknown platform'}
                </>
              ) : (
                'No app session loaded.'
              ),
              label: 'App sessions',
              value: String(appSessions.length),
            },
          ]
        : []),
      {
        helper: primaryRegion ? (
          <>
            {primaryRegion.count} booking row(s) / latest <DateTimeText value={primaryRegion.latestAt} />
          </>
        ) : (
          'Stored booking service addresses will populate this.'
        ),
        label: 'Primary booking region',
        value: primaryRegion?.label ?? 'No booking region',
      },
      {
        helper: `${selectedLocationCount} saved selected location row(s).`,
        label: 'Saved service addresses',
        value: `${addressSnapshotCount}/${bookings.length}`,
      },
      {
        helper: `${completedPartnerCount} completed Partner link(s).`,
        label: 'Partner engagement',
        value: `${favoriteCount} saved / ${viewedCount} viewed`,
      },
    ],
    regionRows:
      bookingRegions.length > 0
        ? bookingRegions.slice(0, 3).map((region) => ({
            helper: (
              <>
                Latest <DateTimeText value={region.latestAt} />
              </>
            ),
            label: region.label,
            value: `${region.count}`,
          }))
        : [
            {
              helper: 'No stored booking service address has been captured for this customer yet.',
              label: 'No booking region',
              value: '0',
            },
          ],
  };
}

function buildCustomerBookingRegionRows(
  bookings: readonly AdminBookingDetail[],
): CustomerBookingRegionCount[] {
  const regionCounts = new Map<string, { count: number; latestAt: string | null }>();

  for (const booking of bookings) {
    const addressText = customerStoredBookingAddressText(booking);
    if (!addressText) continue;

    const regionLabel = serviceAddressAreaLabel(addressText);
    if (!regionLabel || (regionLabel === addressText && /^no\s+/i.test(regionLabel))) continue;

    const latestAt = bookingLatestActivityAt(booking);
    const current = regionCounts.get(regionLabel);
    if (!current) {
      regionCounts.set(regionLabel, { count: 1, latestAt });
      continue;
    }

    regionCounts.set(regionLabel, {
      count: current.count + 1,
      latestAt: dateMs(latestAt) > dateMs(current.latestAt) ? latestAt : current.latestAt,
    });
  }

  return [...regionCounts.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return dateMs(right.latestAt) - dateMs(left.latestAt);
    });
}

function customerStoredBookingAddressText(booking: AdminBookingDetail) {
  return (
    readAddressText(booking.serviceAddressText) ??
    readAddressText(booking.addressSnapshot?.addressText) ??
    readAddressText(booking.addressSnapshot?.address) ??
    readAddressText(booking.address)
  );
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

function countCustomerFavoritePartners(favorites: NonNullable<AdminCustomerDetail['favoriteProviders']>) {
  return favorites.filter((favorite) => favorite.providerProfileId || favorite.providerProfile?.id).length;
}

function countCustomerViewedPartners(views: NonNullable<AdminCustomerDetail['viewedProviders']>) {
  return views.filter((view) => view.providerProfileId || view.providerProfile?.id).length;
}

function countCustomerCompletedPartners(bookings: AdminBookingDetail[]) {
  const partnerIds = new Set<string>();

  for (const booking of bookings) {
    if (booking.status !== 'COMPLETED') continue;
    const partnerId =
      booking.selectedProviderId ?? booking.selectedProvider?.id ?? booking.preferredProviderId;
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
        helper: (
          <>
            Saved <DateTimeText value={favorite.createdAt} />
          </>
        ),
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
        helper: (
          <>
            Last viewed <DateTimeText value={view.lastViewedAt} />
            {viewCountLabel}
          </>
        ),
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
    const partnerId =
      booking.selectedProviderId ?? booking.selectedProvider?.id ?? booking.preferredProviderId;
    if (!partnerId || partners.has(partnerId)) {
      continue;
    }

    const label = bookingPartnerDisplayName(booking);
    partners.set(partnerId, {
      id: `${partnerId}-${booking.id}`,
      href: `/partners/${partnerId}`,
      label,
      helper: (
        <>
          Latest completed <DateTimeText value={bookingLatestActivityAt(booking)} />
        </>
      ),
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

function readChatMessages(booking: AdminBookingDetail): AdminChatMessage[] {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateMs(left.createdAt) - dateMs(right.createdAt);
  });
}

function buildCustomerActivityRecords(
  customer: AdminCustomerDetail,
  bookings: AdminBookingDetail[],
  addresses: CustomerAddressRow[],
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
        title: `${ledger.type} wallet impact`,
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
      detail: customerSelectedLocationDetail(location),
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
      href: '#customer-account-evidence',
    });
  }

  for (const device of customer.user?.pushDevices ?? []) {
    records.push({
      id: device.id,
      type: 'DEVICE',
      at: device.updatedAt ?? device.createdAt ?? '',
      title: `${device.enabled ? 'Enabled' : 'Disabled'} push device`,
      detail: `${device.platform} / ${device.deliveries?.[0]?.status ?? 'No delivery attempt'}`,
      href: '#customer-account-evidence',
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
        addressText ? `Address: ${addressText}` : 'Readable service address not saved',
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
