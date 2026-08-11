import type { ReactNode } from 'react';
import { Download, Gift, Megaphone, Phone, RefreshCw, Save, WalletCards } from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
  AdminTableSubstack,
} from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../../components/admin-filter-chip-group';
import {
  AdminReviewRecordsSection,
  reviewRecordsForCustomer,
} from '../../../components/admin-review-records-section';
import { MoneyText } from '../../../components/money-text';
import { DateTimeText } from '../../../components/date-time-text';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormInput,
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
import {
  AdminErrorState,
  AdminNotePanel,
  AdminSection,
  AdminSurfaceBlock,
} from '../../../components/admin-surface';
import { AdminDetails } from '../../../components/admin-details';
import { AdminTextLink } from '../../../components/admin-text-link';
import { canViewAdminDeveloperSystem } from '../../../components/admin-developer-system-section';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../components/status-badge';
import {
  AdminAuditLog,
  AdminBookingDetail,
  AdminChatMessage,
  AdminCustomerWalletLedgerPage,
  AdminCustomerDetail,
  AdminManualWalletAdjustmentOpenPeriod,
  adminGetResult,
} from '../../../lib/admin-api';
import { bookingLatestActivityAt, bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import {
  adminCountLabel,
  marketplaceDisplayText as displayMarketplaceText,
} from '../../../lib/admin-copy';
import {
  bookingCreateGateFilterLabel,
  bookingCreateGateReasonFilter,
  bookingCreateGateReasonLabel,
} from '../../../lib/booking-create-gate-reasons';
import { customerWalletSummary } from '../../../lib/customer-wallet-summary';
import { adminAvatarStatusFromSignals, type AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../lib/admin-operator-access-model';
import { addCustomerOpsNote, sendCustomerPushMessage } from './actions';
import {
  bookingPartnerDisplayName,
  compactJson,
  compactText,
  dateMs,
  formatDate,
  formatDistance,
  readMetadataObject,
  readNumber,
  readString,
  shortId,
} from './customer-detail-format';
import { customerSelectedLocationDetail } from './customer-detail-location-copy';
import {
  CustomerBookingOperationBoard,
  type CustomerBookingOperationGroup,
  type CustomerBookingOperationMetric,
  type CustomerBookingOperationRow,
} from './customer-booking-operation-board';
import {
  CustomerDetailBehaviorContext,
  CustomerDetailOverviewShell,
  type CustomerDetailOverviewFact,
  type CustomerDetailPartnerAvatar,
  type CustomerDetailPartnerRail,
} from './customer-detail-overview-shell';
import { CustomerDetailSectionBand } from './customer-detail-section-shell';
import { CustomerWalletAdjustmentPanel } from './customer-wallet-adjustment-panel';
import { safeCustomerReturnTo } from '../customer-filters';

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
const CUSTOMER_AUDIT_TRAIL_PREVIEW_LIMIT = 10;
const CUSTOMER_WALLET_LEDGER_PAGE_SIZE = 10;
const CUSTOMER_OVERVIEW_PARTNER_PREVIEW_LIMIT = 4;
const CUSTOMER_OPERATOR_NOTE_HEADERS = ['Date', 'Operator', 'Memo'] as const;
const CUSTOMER_SYSTEM_AUDIT_HEADERS = ['Action', 'Actor', 'Created', 'Metadata'] as const;
const CUSTOMER_REFERRAL_HEADERS = [
  'Referred customer',
  'Registered',
  'Status',
  'Reward booking',
  'Customer reward',
] as const;
const CUSTOMER_OPERATOR_NOTE_PRESETS = [
  'Customer contacted; waiting for reply.',
  'Address confirmed with customer.',
  'Payment record checked.',
  'Chat archive reviewed.',
  'Booking completion confirmed.',
  'Customer asked to update saved address.',
] as const;
const CUSTOMER_REFERRAL_CREDITED_STATUSES = new Set([
  'CREDITED',
  'REWARDED',
  'USED_FOR_SERVICE',
  'OFFSET',
  'CASHOUT_REQUESTED',
  'CASHOUT_APPROVED',
  'PAID',
  'TAX_REVIEW_REQUIRED',
]);
const CUSTOMER_REFERRAL_REVERSED_STATUSES = new Set(['CANCELLED', 'REVERSED']);
type CustomerDetailAction = 'wallet' | 'message' | 'note';

export default async function CustomerDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const rawDetailSearchParams = searchParams ? await searchParams : {};
  const detailSearchParams = withoutLegacyCustomerDetailView(rawDetailSearchParams);
  const returnTo = safeCustomerReturnTo(detailSearchParams.returnTo);
  const customerAction = readCustomerDetailAction(detailSearchParams.action);
  const walletAdjustmentNotice = readCustomerDetailSearchParam(detailSearchParams.walletAdjustmentNotice);
  const notificationNotice = readCustomerDetailSearchParam(detailSearchParams.notificationNotice);
  const noteNotice = readCustomerDetailSearchParam(detailSearchParams.noteNotice);
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const canViewCustomerDiagnostics = canViewAdminDeveloperSystem(operatorAccess);
  const canLoadCustomerDiagnostics =
    canViewCustomerDiagnostics &&
    readCustomerDetailSearchParam(detailSearchParams.diagnostics) === 'developer';
  const canCreateCustomerWalletAdjustmentRequest = hasAdminOperatorCategory(
    operatorAccess,
    'FINANCE_WALLET_ADJUSTMENTS',
  );
  const walletPage = readCustomerBookingOperationPage(detailSearchParams, 'walletPage');
  const walletSkip = (walletPage - 1) * CUSTOMER_WALLET_LEDGER_PAGE_SIZE;
  const shouldLoadWalletAdjustmentPeriods =
    customerAction === 'wallet' || Boolean(walletAdjustmentNotice);
  const [customerResult, customerWalletLedgerResult, walletAdjustmentPeriodsResult] = await Promise.all([
    adminGetResult<AdminCustomerDetail | null>(
      `/admin/customers/${id}?includeDiagnostics=${canLoadCustomerDiagnostics ? 'true' : 'false'}`,
      null,
    ),
    adminGetResult<AdminCustomerWalletLedgerPage>(
      `/admin/customers/${encodeURIComponent(
        id,
      )}/wallet-ledger?take=${CUSTOMER_WALLET_LEDGER_PAGE_SIZE}&skip=${walletSkip}`,
      {
        pagination: { skip: walletSkip, take: CUSTOMER_WALLET_LEDGER_PAGE_SIZE },
        rows: [],
        summary: { balance: 0, currency: 'VND', moneyIn: 0, moneyOut: 0, totalCount: 0 },
      },
    ),
    shouldLoadWalletAdjustmentPeriods
      ? adminGetResult<AdminManualWalletAdjustmentOpenPeriod[]>(
          '/admin/wallet-adjustments/open-periods',
          [],
        )
      : Promise.resolve({ data: [] as AdminManualWalletAdjustmentOpenPeriod[], ok: true, status: 200 }),
  ]);

  if (!customerResult.ok) {
    if (customerResult.status === 404) {
      notFound();
    }

    const permissionError = customerResult.status === 401 || customerResult.status === 403;
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href={returnTo}>Back to search results</AdminFormControlLink>}
        description="Current exceptions, account money, profile details, and retained support records."
        title="Customer detail"
      >
        <AdminErrorState
          action={
            <AdminFormControlLink href={`/customers/${encodeURIComponent(id)}`}>
              <RefreshCw aria-hidden="true" size={16} /> Refresh
            </AdminFormControlLink>
          }
          message={
            permissionError
              ? 'Your current operator role cannot load this customer record.'
              : 'Customer data could not be loaded. Refresh before making an operational decision.'
          }
          title={permissionError ? 'Customer access restricted' : 'Customer detail unavailable'}
        />
      </AdminPageTemplate>
    );
  }

  const customer = customerResult.data;
  if (!customer) {
    notFound();
  }
  const customerWalletLedger = customerWalletLedgerResult.ok
    ? customerWalletLedgerResult.data
    : null;

  const currentTimeMs = new Date().getTime();
  const customerReviewRecords = reviewRecordsForCustomer(
    customer.reviews ?? [],
    customer.providerReviews ?? [],
    customer.id,
  );
  const shouldRenderReviewRecords =
    customerReviewRecords.customerReviews.length + customerReviewRecords.partnerEvaluations.length > 0;
  const bookings = customer.bookings ?? [];
  const wallet = customerWalletSummary(bookings);
  const bookingStats = buildBookingStats(bookings);
  const allTimeActivity = buildCustomerAllTimeActivity(customer, bookingStats, wallet);
  const addresses = buildAddressRows(customer);
  const activeBooking = customer.activeBooking ?? bookings.find((booking) => ACTIVE_STATUSES.includes(booking.status));
  const appSessions = customer.user?.appSessions ?? [];
  const safeSessionSummary = customer.sessionSummary ?? null;
  const latestSession = canLoadCustomerDiagnostics ? appSessions[0] : safeSessionSummary;
  const pushDevices = customer.user?.pushDevices ?? [];
  const activeCustomerPushDevices = pushDevices.filter(
    (device) => device.enabled && (!device.role || device.role === 'CUSTOMER'),
  );
  const canSendCustomerPush = hasAdminOperatorCategory(operatorAccess, 'NOTIFICATIONS_DELIVERY');
  const customerActionLabel = customer.user?.fullName?.trim() || `Customer ${shortId(customer.id)}`;
  const customerActionContact = customer.user?.phone ?? customer.user?.email ?? 'No contact loaded';
  const customerAuditHref = `/audit-log?q=${encodeURIComponent(customer.id)}`;
  const customerDetailBasePath = `/customers/${encodeURIComponent(customer.id)}`;
  const walletActionHref = buildCustomerDetailActionHref(
    customerDetailBasePath,
    detailSearchParams,
    'wallet',
    'customer-wallet-adjustment-request',
  );
  const messageActionHref = buildCustomerDetailActionHref(
    customerDetailBasePath,
    detailSearchParams,
    'message',
    'customer-app-notifications',
  );
  const noteActionHref = buildCustomerDetailActionHref(
    customerDetailBasePath,
    detailSearchParams,
    'note',
    'customer-operator-notes',
  );
  const closeWalletActionHref = buildCustomerDetailActionHref(
    customerDetailBasePath,
    detailSearchParams,
    null,
    'customer-wallet-adjustment-request',
  );
  const closeMessageActionHref = buildCustomerDetailActionHref(
    customerDetailBasePath,
    detailSearchParams,
    null,
    'customer-app-notifications',
  );
  const closeNoteActionHref = buildCustomerDetailActionHref(
    customerDetailBasePath,
    detailSearchParams,
    null,
    'customer-operator-notes',
  );
  const customerPushAvailable = canSendCustomerPush && activeCustomerPushDevices.length > 0;
  const showCustomerMessageAction =
    customerPushAvailable && (customerAction === 'message' || notificationNotice === 'failed');
  const showCustomerNoteAction = customerAction === 'note' || noteNotice === 'failed';
  const customerAvatarStatus = adminAvatarStatusFromSignals({
    devices: pushDevices,
    matching: Boolean(activeBooking && MATCHING_AVATAR_STATUSES.has(activeBooking.status)),
    sessions: canLoadCustomerDiagnostics
      ? appSessions
      : safeSessionSummary
        ? [safeSessionSummary]
        : [],
    working: Boolean(activeBooking && WORKING_AVATAR_STATUSES.has(activeBooking.status)),
  });
  const notifications = customer.user?.notifications ?? [];
  const recentAuditLogs = customer.auditLogs ?? [];
  const operatorNotes = customer.operatorNotes ?? [];
  const customerBookingOperationBuckets = buildCustomerBookingOperationBuckets(bookings);
  const customerBookingOperationMetrics = buildCustomerBookingOperationMetrics(
    bookings,
    customerBookingOperationBuckets,
  );
  const customerBookingOperationGroups = buildCustomerBookingOperationGroups(
    customerBookingOperationBuckets,
  );
  const recordChatBookings = buildCustomerChatArchiveBookings(bookings);
  const chatHistoryPage = readCustomerBookingOperationPage(detailSearchParams, 'chatHistoryPage');
  const chatHistoryTotalPages = Math.max(
    1,
    Math.ceil(recordChatBookings.length / CUSTOMER_CHAT_HISTORY_PAGE_SIZE),
  );
  const chatHistoryActivePage = Math.min(chatHistoryPage, chatHistoryTotalPages);
  const chatHistoryStartIndex = (chatHistoryActivePage - 1) * CUSTOMER_CHAT_HISTORY_PAGE_SIZE;
  const visibleChatBookings = recordChatBookings.slice(
    chatHistoryStartIndex,
    chatHistoryStartIndex + CUSTOMER_CHAT_HISTORY_PAGE_SIZE,
  );
  const chatHistoryPageFrom = recordChatBookings.length === 0 ? 0 : chatHistoryStartIndex + 1;
  const chatHistoryPageTo = Math.min(
    recordChatBookings.length,
    chatHistoryStartIndex + visibleChatBookings.length,
  );
  const recordNotifications = notifications;
  const recordOperatorNotes = operatorNotes;
  const systemAuditLogs = recentAuditLogs.filter((log) => log.action !== 'customer.ops_note.add');
  const visibleAuditLogs = systemAuditLogs.slice(0, CUSTOMER_AUDIT_TRAIL_PREVIEW_LIMIT);
  const bookingCreateGateAttempts = buildCustomerBookingGateAttemptRows(recentAuditLogs, customer.id);
  const shouldRenderBookingCreateGateAttempts = bookingCreateGateAttempts.length > 0;
  const customerLanguage = readCustomerDeviceLanguageLabel(safeSessionSummary?.deviceLanguage);
  const customerCountry = customerCountryDisplay(customerLanguage);
  const customerOperatorCommandQueue = buildCustomerOperatorCommandQueue({
    customer,
    bookings: uniqueCustomerBookings([activeBooking, ...bookings]),
    activitySummary: allTimeActivity,
    bookingCreateGateAttempts,
    currentTimeMs,
  });
  const customerHistorySignals = customerBookingOperationBuckets.partnerCancelled.length >= 2 ? 1 : 0;
  const operatorLabel =
    operatorAccess?.fullName ?? operatorAccess?.email ?? operatorAccess?.phone ?? 'Current operator';
  const requestedNoteBookingId = readCustomerDetailSearchParam(detailSearchParams.bookingId);
  const noteBookingOptions = uniqueCustomerBookings([activeBooking, ...bookings]);
  const defaultNoteBookingId = noteBookingOptions.some(
    (booking) => booking.id === requestedNoteBookingId,
  )
    ? requestedNoteBookingId
    : '';
  const defaultNotePreset = readCustomerDetailSearchParam(detailSearchParams.preset);
  const customerActivityCsvHref = buildCustomerActivityExportHref(customer.id, {});
  const overviewPartnerRails = buildCustomerPartnerRails(
    bookings,
    customer.favoriteProviders ?? [],
    customer.viewedProviders ?? [],
  );
  const visibleOverviewPartnerRails = overviewPartnerRails.filter(
    (rail) => (rail.totalCount ?? rail.partners.length) > 0,
  );
  const customerReferralCode = customer.referralCodes?.[0] ?? null;
  const receivedReferral = customer.referralsReceived?.[0] ?? null;
  const madeReferrals = customer.referralsMade ?? [];
  const ownedReferralRewards = madeReferrals.flatMap((attribution) =>
    attribution.rewards.filter((reward) => reward.walletOwnerCustomerProfileId === customer.id),
  );
  const referralRewardTotals = summarizeCustomerReferralRewards(ownedReferralRewards);
  const hasReferralContext = Boolean(customerReferralCode || receivedReferral || madeReferrals.length > 0);
  const overviewStatusBadges = [
    activeBooking ? 'Active booking' : 'No live booking',
    activeCustomerPushDevices.length > 0 ? 'Push ready' : 'No active device',
    customerSessionRecencyLabel(latestSession?.lastSeenAt, currentTimeMs),
  ];
  const overviewFacts: CustomerDetailOverviewFact[] = [
    {
      label: 'Sign-up date',
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
    {
      label: 'Language and profile',
      value: `${customerLanguage} / ${readCustomerGenderLabel(customer)}`,
      helper: customerCountry.fullLabel,
    },
    {
      label: 'App reachability',
      value: activeCustomerPushDevices.length > 0 ? 'Push available' : 'No active device',
      helper: latestSession?.lastSeenAt ? (
        <>
          Last seen <DateTimeText value={latestSession.lastSeenAt} />
        </>
      ) : (
        'App activity not recorded.'
      ),
    },
  ];
  const profileContactFacts: CustomerDetailOverviewFact[] = [
    {
      label: 'Customer ID',
      value: shortId(customer.id),
      helper: customer.id,
    },
    ...overviewFacts,
  ];
  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink href={returnTo}>Back to search results</AdminFormControlLink>
      }
      contentClassName="customer-detail-page"
      description="Current exceptions, account money, profile details, and retained support records."
      title="Customer detail"
    >
      <AdminSection
        actions={
          <>
            <AdminFormControlLink className="button-primary" href={noteActionHref}>
              <Save aria-hidden="true" size={16} /> Add note
            </AdminFormControlLink>
            {customer.user?.phone ? (
              <AdminFormControlLink className="button-secondary" href={`tel:${customer.user.phone}`}>
                <Phone aria-hidden="true" size={16} /> Contact customer
              </AdminFormControlLink>
            ) : (
              <AdminFormControlLink className="button-secondary" href={noteActionHref}>
                <Phone aria-hidden="true" size={16} /> Add contact note
              </AdminFormControlLink>
            )}
            {customerWalletLedger ? (
              <AdminFormControlLink className="button-secondary" href={walletActionHref}>
                <WalletCards aria-hidden="true" size={16} /> Financial adjustment
              </AdminFormControlLink>
            ) : null}
          </>
        }
        className="admin-mb-16 customer-command-header"
        description={`${customerActionContact} / Customer ${customerRecordLabel(customer.id)}`}
        id="customer-operator-command-queue"
        status={
          <>
            <StatusBadgeFromPillClass pillClass={customerSupportPillClass(customerOperatorCommandQueue.tone)}>
              {customerOperatorCommandQueue.actionCount > 0
                ? `${customerOperatorCommandQueue.actionCount} open actions`
                : 'No open action'}
            </StatusBadgeFromPillClass>
            <StatusBadge tone={customerHistorySignals > 0 ? 'warning' : 'neutral'}>
              {customerHistorySignals} history signals
            </StatusBadge>
          </>
        }
        title={customerActionLabel}
      >
        {activeBooking ? (
          <AdminNotePanel className="ops-task-warning customer-command-current-booking">
            <div className="ops-row">
              <div>
                <strong>Active booking</strong>
                <p className="muted">
                  {customerBookingOptionLabel(activeBooking)}
                </p>
              </div>
              <AdminTextLink href={`/bookings/${activeBooking.id}`}>Open active booking</AdminTextLink>
            </div>
          </AdminNotePanel>
        ) : null}
        {customerOperatorCommandQueue.actionCount > 0 ? (
          <AdminStageList className="admin-mt-12">
            {customerOperatorCommandQueue.commands.map((command) => (
              <AdminNotePanel className={`ops-task-${command.tone}`} key={command.id}>
                <div className="ops-row">
                  <div>
                    <StatusBadgeFromPillClass pillClass={customerSupportPillClass(command.tone)}>
                      {command.label}
                    </StatusBadgeFromPillClass>
                    <strong>{command.title}</strong>
                    <p className="muted">{command.detailNode ?? command.detail}</p>
                    <small className="muted">Owner: {command.owner}</small>
                  </div>
                  <CustomerOperatorCommandAction command={command} customerId={customer.id} />
                </div>
              </AdminNotePanel>
            ))}
          </AdminStageList>
        ) : (
          <p className="muted admin-mt-10">
            No failed payment, open refund, reported review, referral review, booking block, chat gap,
            or delivery failure requires action now.
          </p>
        )}
        {customerHistorySignals > 0 ? (
          <p className="customer-command-history-signal admin-mt-10">
            <strong>History signal</strong> / {customerBookingOperationBuckets.partnerCancelled.length} of the
            latest {bookings.length} bookings were cancelled by a Partner. This is a review signal, not an
            automatic restriction.
          </p>
        ) : null}
        <small className="muted customer-command-checked-at">
          Checked at <DateTimeText value={new Date().toISOString()} /> / payments, refunds, reviews,
          notifications
          {!customerWalletLedger ? ' / wallet check incomplete' : ''}
        </small>
      </AdminSection>

      <CustomerDetailSectionBand
        eyebrow="Now"
        title="Current status"
        description="Identity, contact details, account status, and saved addresses for the current support decision."
        status={
          <StatusBadge tone={activeBooking ? 'warning' : 'success'}>
            {activeBooking ? 'Live booking' : 'No live booking'}
          </StatusBadge>
        }
      >
        <CustomerDetailOverviewShell
          avatarStatus={customerAvatarStatus}
          contactRows={addresses.map((address) => ({
            id: address.key,
            label: address.labelNode ?? address.label,
            value: address.value,
          }))}
          facts={profileContactFacts}
          name={customerActionLabel}
          statusBadges={overviewStatusBadges}
          subtitle={`${customer.user?.phone ?? 'No phone'} / ${customer.user?.email ?? 'No email'}`}
        />
      </CustomerDetailSectionBand>

      <CustomerBookingOperationBoard
        basePath={`/customers/${id}`}
        groups={customerBookingOperationGroups}
        metrics={customerBookingOperationMetrics}
        searchParams={detailSearchParams}
      />

      <CustomerDetailSectionBand
        eyebrow="Money"
        title="Payment & wallet"
        description="Customer payment position, wallet liability, and the complete wallet transaction flow in one place."
        status={<StatusBadge tone="info">Customer account</StatusBadge>}
      >
        <AdminSection
          actions={<AdminTextLink href={`/payments?customer=${customer.id}`}>Open payments</AdminTextLink>}
          className="admin-mb-16"
          description={`Lifetime captured payments and wallet ledger balance are separated from the latest ${bookings.length} booking records. Manual wallet movement never becomes platform revenue.`}
          id="customer-account-operations"
          title="Payment and wallet summary"
        >
          <AdminStageList className="admin-mt-12">
            <AdminNotePanel className="ops-task-info">
              <AdminSectionHeader
                actions={customerWalletLedger ? (
                  <StatusBadge tone={customerWalletLedger.summary.balance < 0 ? 'warning' : 'info'}>
                    Current balance <MoneyText amount={customerWalletLedger.summary.balance} />
                  </StatusBadge>
                ) : null}
                description="The wallet balance is a customer liability sourced from wallet ledger entries."
                title="Money position"
              />
              <div className="ops-row">
                <strong>Total captured payments</strong>
                <MoneyText amount={allTimeActivity.capturedSpend} />
              </div>
              <div className="ops-row">
                <strong>Recent authorized / pending</strong>
                <MoneyText amount={wallet.pendingPaymentAmount} />
              </div>
              <div className="ops-row">
                <strong>Open refund requests</strong>
                <span>{allTimeActivity.refundRequestCount}</span>
              </div>
              <div className="ops-row">
                <strong>Recent refund records</strong>
                <MoneyText amount={wallet.refundAmount} />
              </div>
              <div className="ops-row">
                <strong>Recent cash bookings</strong>
                <MoneyText amount={wallet.cashBookingAmount} />
              </div>
            </AdminNotePanel>
          </AdminStageList>
        </AdminSection>
        {customerWalletLedger ? (
          <CustomerWalletAdjustmentPanel
            actionHref={walletActionHref}
            actionOpen={customerAction === 'wallet'}
            auditHref={customerAuditHref}
            closeHref={closeWalletActionHref}
            currentBalance={customerWalletLedger.summary.balance}
            customerId={customer.id}
            customerLabel={`${customerActionLabel} / ${customerActionContact}`}
            canCreateRequest={canCreateCustomerWalletAdjustmentRequest}
            notice={walletAdjustmentNotice}
            operatorLabel={operatorLabel}
            openPeriods={walletAdjustmentPeriodsResult.ok ? walletAdjustmentPeriodsResult.data : []}
            walletLedger={customerWalletLedger}
            walletPage={walletPage}
          />
        ) : (
          <AdminErrorState
            action={
              <AdminFormControlLink href={`${customerDetailBasePath}#customer-account-operations`}>
                <RefreshCw aria-hidden="true" size={16} /> Retry wallet check
              </AdminFormControlLink>
            }
            message="Wallet balance and ledger could not be loaded. Do not treat this as a zero balance."
            title="Wallet data unavailable"
          />
        )}
      </CustomerDetailSectionBand>

      {visibleOverviewPartnerRails.length > 0 ? (
        <AdminSection
          className="admin-mb-16"
          description="Partner profiles viewed, saved, or connected to completed bookings."
          id="customer-behavior-context"
          status={
            <StatusBadge tone="neutral">
              {visibleOverviewPartnerRails.reduce(
                (total, rail) => total + (rail.totalCount ?? rail.partners.length),
                0,
              )}{' '}
              signals
            </StatusBadge>
          }
          title="Customer behavior"
        >
          <CustomerDetailBehaviorContext partnerRails={visibleOverviewPartnerRails} />
        </AdminSection>
      ) : null}

      <AdminSection
        actions={
          <>
            <StatusBadge tone="info">{madeReferrals.length} referred</StatusBadge>
            <StatusBadge tone="success">
              Credited <MoneyText amount={referralRewardTotals.credited} />
            </StatusBadge>
            {referralRewardTotals.pending > 0 ? (
              <StatusBadge tone="warning">
                Pending <MoneyText amount={referralRewardTotals.pending} />
              </StatusBadge>
            ) : null}
            {referralRewardTotals.reversed > 0 ? (
              <StatusBadge tone="neutral">
                Reversed <MoneyText amount={referralRewardTotals.reversed} />
              </StatusBadge>
            ) : null}
          </>
        }
        className="admin-mb-16"
        description="Customer referral code, inviter attribution, referred customers, and rewards credited to this customer."
        id="customer-referral-context"
        title="Referral activity"
      >
        {hasReferralContext ? (
          <>
            <AdminStageList className="admin-mt-12">
              <AdminNotePanel className="ops-task-info">
                <div className="ops-row">
                  <div>
                    <strong>Customer referral code</strong>
                    <p className="muted">{customerReferralCode?.code ?? 'No referral code issued'}</p>
                  </div>
                  <StatusBadge tone={customerReferralCode?.active ? 'success' : 'neutral'}>
                    {customerReferralCode
                      ? customerReferralCode.active
                        ? 'Active'
                        : 'Disabled'
                      : 'Not issued'}
                  </StatusBadge>
                </div>
              </AdminNotePanel>
              <AdminNotePanel className="ops-task-info">
                <div className="ops-row">
                  <div>
                    <strong>Invited by</strong>
                    <p className="muted">
                      {receivedReferral?.referrerCustomerProfile ? (
                        <AdminTextLink href={`/customers/${receivedReferral.referrerCustomerProfile.id}`}>
                          {customerReferralPersonLabel(receivedReferral.referrerCustomerProfile)}
                        </AdminTextLink>
                      ) : (
                        'No inbound customer referral attribution'
                      )}
                    </p>
                  </div>
                  <StatusBadge tone={receivedReferral ? 'info' : 'neutral'}>
                    {receivedReferral
                      ? `${receivedReferral.referralCode.code} / ${receivedReferral.status}`
                      : 'Direct signup'}
                  </StatusBadge>
                </div>
              </AdminNotePanel>
            </AdminStageList>

            {madeReferrals.length > 0 ? (
              <>
                <AdminSectionHeader
                  actions={
                    <AdminTextLink href={`/referrals/customers/${customer.id}`}>
                      Open referral records
                    </AdminTextLink>
                  }
                  className="admin-mt-16"
                  description="Latest customers attributed to this customer code and rewards owned by this customer."
                  title="Referred customers"
                />
                <AdminTableScroll>
                  <AdminDataTable
                    emptyMessage={null}
                    headers={CUSTOMER_REFERRAL_HEADERS}
                    rowCount={madeReferrals.length}
                  >
                    {madeReferrals.map((attribution) => {
                      const customerOwnedRewards = attribution.rewards.filter(
                        (reward) => reward.walletOwnerCustomerProfileId === customer.id,
                      );
                      const customerOwnedAmount = customerOwnedRewards
                        .reduce((sum, reward) => sum + reward.amount, 0);
                      return (
                        <tr key={attribution.id}>
                          <td>
                            {attribution.referredCustomerProfile ? (
                              <AdminTextLink href={`/customers/${attribution.referredCustomerProfile.id}`}>
                                {customerReferralPersonLabel(attribution.referredCustomerProfile)}
                              </AdminTextLink>
                            ) : (
                              'Customer record unavailable'
                            )}
                          </td>
                          <td>
                            <DateTimeText value={attribution.createdAt} />
                          </td>
                          <td>
                            <StatusBadge tone={referralAttributionTone(attribution.status)}>
                              {attribution.status}
                            </StatusBadge>
                          </td>
                          <td>
                            <AdminTableSubstack>
                              {customerOwnedRewards.length > 0 ? (
                                customerOwnedRewards.map((reward) =>
                                  reward.qualifyingBookingId ? (
                                    <AdminTextLink
                                      href={`/bookings/${reward.qualifyingBookingId}`}
                                      key={reward.id}
                                    >
                                      Booking {shortId(reward.qualifyingBookingId)}
                                    </AdminTextLink>
                                  ) : (
                                    <span className="muted" key={reward.id}>
                                      No booking reference
                                    </span>
                                  ),
                                )
                              ) : (
                                <span className="muted">No qualifying booking</span>
                              )}
                            </AdminTableSubstack>
                          </td>
                          <td>
                            <AdminTableSubstack>
                              {customerOwnedRewards.length > 0 ? (
                                customerOwnedRewards.map((reward) => (
                                  <span key={reward.id}>
                                    <MoneyText amount={reward.amount} />{' '}
                                    <StatusBadge tone={referralRewardTone(reward.status)}>
                                      {reward.status}
                                    </StatusBadge>
                                  </span>
                                ))
                              ) : (
                                <MoneyText amount={customerOwnedAmount} />
                              )}
                            </AdminTableSubstack>
                          </td>
                        </tr>
                      );
                    })}
                  </AdminDataTable>
                </AdminTableScroll>
              </>
            ) : null}
          </>
        ) : (
          <p className="muted">No customer referral activity is recorded.</p>
        )}
      </AdminSection>

      <AdminSection
        actions={
          <>
            <StatusBadge tone={customerPushAvailable ? 'success' : 'warning'}>
              {!canSendCustomerPush
                ? 'Push restricted / permission required'
                : activeCustomerPushDevices.length > 0
                  ? 'Push ready'
                  : 'Push unavailable / no active device'}
            </StatusBadge>
            <StatusBadge tone="info">{recordNotifications.length} messages</StatusBadge>
            {customerPushAvailable ? (
              <AdminFormControlLink
                className={showCustomerMessageAction ? 'button-secondary' : undefined}
                href={showCustomerMessageAction ? closeMessageActionHref : messageActionHref}
              >
                {showCustomerMessageAction ? 'Close' : 'Send message'}
              </AdminFormControlLink>
            ) : (
              <AdminFormControlLink
                className="button-secondary"
                href={customer.user?.phone ? `tel:${customer.user.phone}` : noteActionHref}
              >
                {customer.user?.phone ? 'Contact customer' : 'Add contact note'}
              </AdminFormControlLink>
            )}
          </>
        }
        className="admin-mb-16 customer-app-notification-section"
        description="The same referral credits, manual wallet changes, and Admin messages shown in the customer app. Booking wallet payments are excluded."
        id="customer-app-notifications"
        title="Customer app notifications"
      >
        {notificationNotice === 'sent' ? (
          <AdminNotePanel className="ops-task-success admin-mb-16">
            <strong>Push message sent</strong>
            <p className="muted">The message was saved in this customer notification history.</p>
            <AdminTextLink href={customerAuditHref}>Open audit event</AdminTextLink>
          </AdminNotePanel>
        ) : null}
        {notificationNotice === 'failed' ? (
          <AdminNotePanel className="ops-task-danger admin-mb-16">
            <strong>Push message was not sent</strong>
            <p className="muted">
              Check notification permission and confirm that the customer has an active push device.
            </p>
          </AdminNotePanel>
        ) : null}

        {showCustomerMessageAction ? (
          <div
            aria-label="Send customer message"
            className="customer-inline-action-disclosure-body"
            role="region"
          >
            <div className="ops-row admin-mb-14">
              <div>
                <strong>Message target</strong>
                <p className="muted">
                  {customerActionLabel} / {customerActionContact} / {activeCustomerPushDevices.length}{' '}
                  active {activeCustomerPushDevices.length === 1 ? 'device' : 'devices'}
                </p>
              </div>
              <StatusBadge tone={activeCustomerPushDevices.length > 0 ? 'success' : 'warning'}>
                {activeCustomerPushDevices.length > 0 ? 'Available' : 'Unavailable'}
              </StatusBadge>
            </div>
            <AdminFormGrid action={sendCustomerPushMessage} className="compact-form customer-push-form">
              <input name="customerId" type="hidden" value={customer.id} />
              <input name="targetUserId" type="hidden" value={customer.user?.id ?? customer.userId} />
              <AdminFormInput
                className="full-span"
                disabled={!canSendCustomerPush || activeCustomerPushDevices.length === 0}
                label="Title"
                labelVisibility="visible"
                maxLength={120}
                name="title"
                required
              />
              <AdminFormTextarea
                className="full-span"
                disabled={!canSendCustomerPush || activeCustomerPushDevices.length === 0}
                label="Message"
                labelVisibility="visible"
                maxLength={500}
                name="body"
                required
                rows={3}
              />
              <AdminFormControlButton
                disabled={!canSendCustomerPush || activeCustomerPushDevices.length === 0}
              >
                <Megaphone aria-hidden="true" size={16} />
                Send to customer
              </AdminFormControlButton>
              <AdminFormControlLink className="button-secondary" href={closeMessageActionHref}>
                Cancel
              </AdminFormControlLink>
            </AdminFormGrid>
            {!canSendCustomerPush ? (
              <p className="muted admin-mt-8">Notification delivery permission is required.</p>
            ) : activeCustomerPushDevices.length === 0 ? (
              <p className="muted admin-mt-8">This customer does not have an active push device.</p>
            ) : null}
          </div>
        ) : null}

        <AdminSectionHeader
          actions={
            <>
              <StatusBadge tone="info">{recordNotifications.length} messages</StatusBadge>
              <AdminTextLink href={`/notifications?user=${encodeURIComponent(customer.user?.id ?? customer.userId)}`}>
                Open delivery records
              </AdminTextLink>
            </>
          }
          className="admin-mt-16"
          description="Newest customer app messages appear first."
          title="Notification history"
        />
        <AdminStageList className="customer-app-notification-list admin-mt-12">
          {recordNotifications.length > 0 ? (
            recordNotifications.map((notification) => (
              <AdminStageItem className="customer-app-notification-row" key={notification.id}>
                <span className="customer-app-notification-icon" aria-hidden="true">
                  <CustomerNotificationIcon type={notification.type} />
                </span>
                <div className="customer-app-notification-copy">
                  <div className="ops-row">
                    <strong>{displayMarketplaceText(notification.title)}</strong>
                    <StatusBadge tone={notification.readAt ? 'neutral' : 'info'}>
                      {notification.readAt ? 'Read' : 'Unread'}
                    </StatusBadge>
                  </div>
                  <p>{displayMarketplaceText(notification.body)}</p>
                  <small className="muted">
                    <DateTimeText value={notification.createdAt} /> /{' '}
                    {notification.deliveries?.[0]?.status ?? 'In-app only'}
                  </small>
                </div>
              </AdminStageItem>
            ))
          ) : (
            <p className="muted">No referral credit, manual wallet change, or Admin push message is recorded.</p>
          )}
        </AdminStageList>
      </AdminSection>

      <CustomerDetailSectionBand
        eyebrow="History"
        id="audit-records"
        title="Audit records"
        description="Operator notes, reviews, chat, and system evidence retained for this customer."
        status={
          <>
            <StatusBadge tone="info">Historical records</StatusBadge>
            <AdminFormControlLink
              className="button-secondary"
              download={`hands-customer-${shortId(customer.id)}-activity.csv`}
              href={customerActivityCsvHref}
              title="Export retained customer activity from the protected server route"
            >
              <Download aria-hidden="true" size={16} />
              Export retained customer activity CSV
            </AdminFormControlLink>
          </>
        }
      >
        <AdminSection
          actions={
            <>
              <StatusBadge tone="neutral">{adminCountLabel(recordOperatorNotes.length, 'note')}</StatusBadge>
              <AdminFormControlLink
                className={showCustomerNoteAction ? 'button-secondary' : undefined}
                href={showCustomerNoteAction ? closeNoteActionHref : noteActionHref}
              >
                {showCustomerNoteAction ? 'Close' : 'Add note'}
              </AdminFormControlLink>
            </>
          }
          className="admin-mb-16"
          description="Add a factual operator note to the retained customer record. This does not change booking or payment state."
          id="customer-operator-notes"
          title="Add customer activity note"
        >
          {noteNotice === 'saved' ? (
            <AdminNotePanel className="ops-task-success admin-mb-16">
              <strong>Operator note saved</strong>
              <p className="muted">The note is retained in this customer history.</p>
              <AdminTextLink href={customerAuditHref}>Open audit event</AdminTextLink>
            </AdminNotePanel>
          ) : null}
          {noteNotice === 'failed' ? (
            <AdminNotePanel className="ops-task-danger admin-mb-16">
              <strong>Operator note was not saved</strong>
              <p className="muted">No customer record was changed. Review the note and try again.</p>
            </AdminNotePanel>
          ) : null}
          {showCustomerNoteAction ? (
            <div
              aria-label="Add customer operator note"
              className="customer-inline-action-disclosure-body"
              role="region"
            >
              <div className="ops-row admin-mb-14">
                <div>
                  <strong>Note target</strong>
                  <p className="muted">
                    {customerActionLabel} / {customerActionContact}
                  </p>
                </div>
                <StatusBadge tone="neutral">Customer record</StatusBadge>
              </div>
              <AdminFormGrid action={addCustomerOpsNote} className="compact-form admin-mt-14">
                <input type="hidden" name="customerId" value={customer.id} />
                <AdminFormSelect
                  className="customer-note-preset"
                  defaultValue={defaultNotePreset}
                  label="Quick note preset"
                  labelVisibility="visible"
                  name="preset"
                  options={[
                    { label: 'Manual note only', value: '' },
                    ...CUSTOMER_OPERATOR_NOTE_PRESETS.map((preset) => ({ label: preset, value: preset })),
                  ]}
                />
                <AdminFormSelect
                  className="customer-note-booking"
                  defaultValue={defaultNoteBookingId}
                  label="Related booking"
                  labelVisibility="visible"
                  name="bookingId"
                  options={[
                    { label: 'No booking link', value: '' },
                    ...noteBookingOptions.slice(0, 20).map((booking) => ({
                      label: customerBookingOptionLabel(booking),
                      value: booking.id,
                    })),
                  ]}
                />
                <AdminFormTextarea
                  className="customer-note-textarea full-span"
                  label="Activity note"
                  labelVisibility="visible"
                  minLength={3}
                  name="note"
                  placeholder="Example: Customer contacted by phone, address confirmed, chat archive reviewed."
                  required
                  rows={3}
                />
                <AdminFormControlButton className="customer-note-submit">
                  <Save aria-hidden="true" size={16} />
                  Save customer activity note
                </AdminFormControlButton>
                <AdminFormControlLink className="button-secondary" href={closeNoteActionHref}>
                  Cancel
                </AdminFormControlLink>
              </AdminFormGrid>
            </div>
          ) : null}
          <AdminSectionHeader
            actions={<StatusBadge tone="neutral">{adminCountLabel(recordOperatorNotes.length, 'note')}</StatusBadge>}
            className="admin-mt-16"
            description="Retained operator notes for this customer."
            title="Operator note history"
          />
          {recordOperatorNotes.length > 0 ? (
            <AdminTableScroll>
              <AdminDataTable
                emptyMessage="No operator note has been added yet."
                headers={CUSTOMER_OPERATOR_NOTE_HEADERS}
                rowCount={recordOperatorNotes.length}
              >
                {recordOperatorNotes.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <DateTimeText value={log.createdAt} />
                    </td>
                    <td>{customerOperatorLabel(log)}</td>
                    <td>{customerOperatorNoteMemo(log)}</td>
                  </tr>
                ))}
              </AdminDataTable>
            </AdminTableScroll>
          ) : (
            <p className="muted admin-mt-12">No customer activity note has been added.</p>
          )}
        </AdminSection>

        {shouldRenderReviewRecords ? (
          <AdminSurfaceBlock className="customer-record-group admin-mb-16" id="customer-review-evaluation-records">
            <AdminSectionHeader
              description="Customer reviews and Partner-written internal evaluations."
              status={
                <StatusBadge tone="neutral">
                  {customerReviewRecords.customerReviews.length +
                    customerReviewRecords.partnerEvaluations.length}{' '}
                  records
                </StatusBadge>
              }
              title="Reviews and evaluations"
              titleId="customer-review-evaluation-records-title"
            />
            <AdminReviewRecordsSection
              basePath={`/customers/${id}`}
              customerReviews={customerReviewRecords.customerReviews}
              description="Customer review records and Partner-written internal evaluations connected to this customer."
              hideCustomerColumn
              id="customer-review-records"
              partnerEvaluations={customerReviewRecords.partnerEvaluations}
              searchParams={detailSearchParams}
              separatePanels
              title="Customer review records"
            />
          </AdminSurfaceBlock>
        ) : null}

        {shouldRenderBookingCreateGateAttempts ? (
          <CustomerBookingCreateGateRecords attempts={bookingCreateGateAttempts} />
        ) : null}

        <AdminSurfaceBlock className="customer-record-group" id="customer-chat-system-evidence">
          <AdminSectionHeader
            description={
              canLoadCustomerDiagnostics
                ? 'Retained support evidence and explicitly loaded Developer/System diagnostics.'
                : 'Retained customer and Partner chat evidence connected to this customer.'
            }
            status={
              <>
                <StatusBadge tone="neutral">{recordChatBookings.length} chats</StatusBadge>
                {canLoadCustomerDiagnostics ? (
                  <StatusBadge tone="neutral">{systemAuditLogs.length} system logs</StatusBadge>
                ) : null}
                {canViewCustomerDiagnostics ? (
                  <AdminTextLink
                    href={
                      canLoadCustomerDiagnostics
                        ? `/customers/${id}#customer-chat-system-evidence`
                        : `/customers/${id}?diagnostics=developer#customer-system-diagnostics`
                    }
                  >
                    {canLoadCustomerDiagnostics
                      ? 'Hide developer/system evidence'
                      : 'Load developer/system evidence'}
                  </AdminTextLink>
                ) : null}
              </>
            }
            title={canLoadCustomerDiagnostics ? 'Chat and system evidence' : 'Chat evidence'}
            titleId="customer-chat-system-evidence-title"
          />
            <AdminSection
              className="customer-chat-history-section admin-mb-16"
              description={
                <>
                  Chat evidence from the latest {bookings.length} bookings. Customer and Partner apps hide
                  chat after completion, while retained messages remain available to operations.
                </>
              }
              id="chat-history"
              statusLabel={`${recordChatBookings.length} rooms`}
              statusTone="info"
              title="Chat history"
            >
              <AdminStageList className="customer-chat-history-list">
                {visibleChatBookings.length > 0 ? (
                  visibleChatBookings.map((booking) => (
                    <CustomerChatHistoryRoomCard booking={booking} key={booking.id} />
                  ))
                ) : (
                  <AdminEmptyState
                    framed
                    message="No retained customer chat rooms are available."
                    title={null}
                  />
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
                totalRows={recordChatBookings.length}
              />
            </AdminSection>

            {canLoadCustomerDiagnostics ? (
              <AdminSection
                actions={<StatusBadge tone="info">{adminCountLabel(systemAuditLogs.length, 'system log')}</StatusBadge>}
                description="Developer/System audit data loaded only for this explicit review."
                id="customer-system-diagnostics"
                title="System audit records"
              >
                <AdminSectionHeader
                  actions={<StatusBadge tone="info">{systemAuditLogs.length} logs</StatusBadge>}
                  className="admin-mt-16"
                  description="System actions attached to this customer. Operator notes are shown with the note form above."
                  title="System audit evidence"
                  titleId="audit-trail"
                />
                <AdminTableScroll>
                  <AdminDataTable
                    emptyMessage={null}
                    headers={CUSTOMER_SYSTEM_AUDIT_HEADERS}
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
            ) : null}
        </AdminSurfaceBlock>
      </CustomerDetailSectionBand>
    </AdminPageTemplate>
  );
}

function CustomerNotificationIcon({ type }: { readonly type: string }) {
  if (type === 'customer.referral.reward_credited') {
    return <Gift size={20} />;
  }
  if (type === 'customer.wallet.manual_adjustment') {
    return <WalletCards size={20} />;
  }
  return <Megaphone size={20} />;
}

function CustomerBookingCreateGateRecords({
  attempts,
}: {
  readonly attempts: readonly CustomerBookingGateAttemptRow[];
}) {
  return (
    <AdminSection
      actions={
        <>
          <StatusBadge tone={attempts.length > 0 ? 'warning' : 'neutral'}>
            {attempts.length} retained
          </StatusBadge>
          <AdminTextLink href="/bookings?view=blocked-create">Open gate queue</AdminTextLink>
        </>
      }
      className="admin-mb-16"
      description="Retained booking creation attempts stopped before payment and matching. Use the live gate queue for current investigation."
      id="customer-booking-create-gates"
      title="Booking block evidence"
    >
      {attempts.length === 0 ? (
        <AdminEmptyState
          framed
          message="No blocked booking attempt is retained for this customer."
          title={null}
        />
      ) : (
        <AdminStageList className="admin-mt-14">
          {attempts.slice(0, CUSTOMER_BOOKING_GATE_PREVIEW_LIMIT).map((attempt) => (
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
  );
}

function CustomerChatHistoryRoomCard({ booking }: { readonly booking: AdminBookingDetail }) {
  const retainedMessages = readChatMessages(booking);
  const chatMessages = retainedMessages.map(customerChatWindowMessage);
  const lastMessage = retainedMessages.at(-1);
  const customerName =
    booking.customerProfile?.user?.fullName ?? booking.customerProfile?.user?.phone ?? 'Customer';
  const partnerName = bookingPartnerDisplayName(booking);
  const bookingLabel = customerRecordLabel(booking.id);

  return (
    <AdminDetails className="customer-chat-history-room-card customer-chat-history-disclosure" name="customer-chat-history">
      <summary>
        <span>
          <strong>{bookingLabel} / {bookingServiceLabel(booking)}</strong>
          <small>
            {customerBookingPaymentTypeLabel(booking)} / {customerBookingStateLabel(booking)}
          </small>
        </span>
        <span className="customer-chat-history-summary-meta">
          <StatusBadge tone="neutral">{retainedMessages.length} messages</StatusBadge>
          <small>
            {lastMessage ? <>Last message <DateTimeText value={lastMessage.createdAt} /></> : 'No messages'}
          </small>
        </span>
      </summary>
      <div className="customer-chat-history-disclosure-body">
        <div className="customer-chat-history-actions">
          <AdminTextLink href={`/bookings/${booking.id}`}>
            Open booking {bookingLabel}
          </AdminTextLink>
          {booking.chatRoom ? (
            <AdminTextLink href={`/chat-archive?q=${encodeURIComponent(booking.id)}`}>
              Open full chat archive {bookingLabel}
            </AdminTextLink>
          ) : null}
        </div>
        {booking.chatRoom?.id ? <small className="muted">Room {booking.chatRoom.id}</small> : null}
        <AdminChatWindow
          avatarLabel={customerName}
          className="admin-mt-12"
          emptyMessage="No retained messages are available in this chat room."
          messages={chatMessages}
          subtitle={`${partnerName} / ${customerBookingStateLabel(booking)}`}
          title={`${customerName} chat evidence`}
        />
      </div>
    </AdminDetails>
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

type CustomerAddressRow = {
  key: string;
  label: string;
  labelNode?: ReactNode;
  value: string;
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

  const noteParams = new URLSearchParams({ action: 'note', preset: command.action.preset });
  if (command.action.bookingId) noteParams.set('bookingId', command.action.bookingId);

  return (
    <AdminTextLink href={`/customers/${encodeURIComponent(customerId)}?${noteParams}#customer-operator-notes`}>
      {command.action.label}
    </AdminTextLink>
  );
}

function customerRecordLabel(value: string) {
  return value.length <= 12 ? value : `...${value.slice(-10)}`;
}

function customerBookingOptionLabel(booking: AdminBookingDetail) {
  return `${customerRecordLabel(booking.id)} / ${formatDate(bookingRequestOpenedAt(booking))} / ${customerBookingPaymentTypeLabel(booking)} / ${customerBookingStateLabel(booking)}`;
}

function uniqueCustomerBookings(
  bookings: readonly (AdminBookingDetail | null | undefined)[],
): AdminBookingDetail[] {
  return [...new Map(bookings.filter(Boolean).map((booking) => [booking!.id, booking!] as const)).values()];
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

type CustomerAllTimeActivity = {
  readonly activeBookingCount: number;
  readonly bookingCount: number;
  readonly capturedSpend: number;
  readonly completedBookingCount: number;
  readonly paymentIssueCount: number;
  readonly refundRequestCount: number;
  readonly reportedReviewCount: number;
};

function buildCustomerAllTimeActivity(
  customer: AdminCustomerDetail,
  recentBookingStats: ReturnType<typeof buildBookingStats>,
  recentWallet: ReturnType<typeof customerWalletSummary>,
): CustomerAllTimeActivity {
  const summary = customer.activitySummary;

  return {
    activeBookingCount: summary?.activeBookingCount ?? recentBookingStats.active,
    bookingCount: summary?.bookingCount ?? customer.bookings?.length ?? 0,
    capturedSpend: summary?.capturedSpend ?? recentWallet.capturedSpend,
    completedBookingCount: summary?.completedBookingCount ?? recentBookingStats.completed,
    paymentIssueCount:
      summary?.paymentIssueCount ??
      (customer.bookings ?? []).filter((booking) => booking.payment?.status === 'FAILED').length,
    refundRequestCount:
      summary?.refundRequestCount ??
      (customer.bookings ?? []).reduce(
        (count, booking) =>
          count +
          [...(booking.payment?.refunds ?? []), ...(booking.refunds ?? [])].filter(
            (refund) => refund.status === 'REQUESTED',
          ).length,
        0,
      ),
    reportedReviewCount: summary?.reportedReviewCount ?? 0,
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
      label: `Latest ${bookings.length} bookings`,
      tone: 'pill-info',
      value: String(bookings.length),
    },
    {
      helper: `${adminCountLabel(buckets.live.length, 'live booking')} in the newest records.`,
      label: 'Live now',
      tone: buckets.live.length ? 'pill-warn' : 'pill-neutral',
      value: String(buckets.live.length),
    },
    {
      helper: 'Completed service rows among the newest records.',
      label: `Completed in latest ${bookings.length}`,
      tone: 'pill-success',
      value: String(buckets.completed.length),
    },
    {
      helper: `${buckets.preMatchCancelled.length} pre-match / ${buckets.partnerCancelled.length} Partner cancel`,
      label: `Cancellations in latest ${bookings.length}`,
      tone: cancellationCount ? 'pill-warn' : 'pill-neutral',
      value: String(cancellationCount),
    },
  ];
}

function buildCustomerBookingOperationGroups(
  buckets: CustomerBookingOperationBuckets,
): CustomerBookingOperationGroup[] {
  return [
    {
      key: 'live',
      rows: buildCustomerBookingOperationRows(buckets.live),
      title: 'Current / In Progress',
      totalRows: buckets.live.length,
    },
    {
      key: 'completed',
      rows: buildCustomerBookingOperationRows(buckets.completed),
      title: 'Completed',
      totalRows: buckets.completed.length,
    },
    {
      key: 'pre-match-cancelled',
      rows: buildCustomerBookingOperationRows(buckets.preMatchCancelled),
      title: 'Pre-match Cancellations',
      totalRows: buckets.preMatchCancelled.length,
    },
    {
      key: 'partner-cancelled',
      rows: buildCustomerBookingOperationRows(buckets.partnerCancelled),
      title: 'Partner Cancellations',
      totalRows: buckets.partnerCancelled.length,
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
    const hasServiceSnapshot = (booking.services?.length ?? 0) > 0;

    return {
      addressLabel: compactText(customerBookingAddressListLabel(booking), 84),
      bookingHelper: (
        <>
          Requested <DateTimeText value={bookingRequestOpenedAt(booking)} />
        </>
      ),
      bookingHref: `/bookings/${booking.id}`,
      bookingLabel: customerRecordLabel(booking.id),
      id: booking.id,
      partnerAvatarStatus: customerBookingPartnerAvatarStatus(booking),
      partnerHelper: customerBookingPartnerHelper(selectedPartner, preferredPartner, participantCount),
      partnerHref: partnerId ? `/partners/${partnerId}` : null,
      partnerLabel: partnerId ? bookingPartnerDisplayName(booking) : 'No Partner selected',
      paymentDetailLabel: customerBookingPaymentDetailLabel(booking),
      paymentTypeLabel: customerBookingPaymentTypeLabel(booking),
      requestTimeLabel: <DateTimeText value={bookingRequestOpenedAt(booking)} />,
      serviceLabel: hasServiceSnapshot ? bookingServiceLabel(booking) : 'Service snapshot unavailable',
      servicePriceAmount: hasServiceSnapshot ? bookingTotal(booking) : null,
      servicePriceCurrency: 'VND',
      sortAtMs: dateMs(stateAt),
      stateDetail: (
        <>
          {customerBookingStateTimeVerb(booking)} <DateTimeText value={stateAt} />
        </>
      ),
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
    <span title={`Payment status: ${booking.payment.status}`}>
      {customerPaymentStatusLabel(booking.payment.status)} /{' '}
      <MoneyText amount={Number(booking.payment.amount ?? 0)} currency={booking.payment.currency ?? 'VND'} />
    </span>
  );
}

function customerPaymentStatusLabel(status: string) {
  switch (status) {
    case 'RELEASED':
      return 'Funds released';
    case 'CAPTURED':
      return 'Payment captured';
    case 'AUTHORIZED':
      return 'Authorized';
    case 'PENDING':
      return 'Pending';
    case 'REFUNDED':
      return 'Refunded';
    case 'FAILED':
      return 'Failed';
    default:
      return displayMarketplaceText(status);
  }
}

function customerBookingStateTimeVerb(booking: AdminBookingDetail) {
  if (booking.status === 'COMPLETED') return 'Completed at';
  if (['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(booking.status)) return 'Closed at';
  return 'Updated at';
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

function withoutLegacyCustomerDetailView(searchParams: Record<string, string | string[] | undefined>) {
  const canonicalSearchParams = { ...searchParams };
  delete canonicalSearchParams.view;
  delete canonicalSearchParams.range;
  delete canonicalSearchParams.type;
  delete canonicalSearchParams.activityOrder;
  delete canonicalSearchParams.from;
  delete canonicalSearchParams.to;
  return canonicalSearchParams;
}

function buildCustomerDetailActionHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  action: CustomerDetailAction | null,
  sectionId: string,
) {
  const params = new URLSearchParams();
  const transientKeys = new Set([
    'action',
    'noteNotice',
    'notificationNotice',
    'walletAdjustmentNotice',
  ]);

  for (const [key, value] of Object.entries(searchParams)) {
    if (transientKeys.has(key) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  if (action) params.set('action', action);
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}#${sectionId}`;
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
    if (key === pageParam || key === 'view' || value === undefined) continue;
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

function customerOperatorLabel(log: AdminAuditLog) {
  return log.actor?.fullName ?? log.actor?.email ?? log.actor?.phone ?? 'System';
}

function customerOperatorNoteMemo(log: AdminAuditLog) {
  const metadata = readMetadataObject(log.metadata);
  return readString(metadata.note) ?? readString(metadata.preset) ?? 'No memo';
}

function customerReferralPersonLabel(profile: {
  readonly id: string;
  readonly user?: { readonly fullName?: string | null; readonly phone?: string | null } | null;
}) {
  return profile.user?.fullName ?? profile.user?.phone ?? shortId(profile.id);
}

function summarizeCustomerReferralRewards(
  rewards: readonly { readonly amount: number; readonly status: string }[],
) {
  return rewards.reduce(
    (totals, reward) => {
      if (CUSTOMER_REFERRAL_CREDITED_STATUSES.has(reward.status)) {
        totals.credited += reward.amount;
      } else if (CUSTOMER_REFERRAL_REVERSED_STATUSES.has(reward.status)) {
        totals.reversed += reward.amount;
      } else {
        totals.pending += reward.amount;
      }
      return totals;
    },
    { credited: 0, pending: 0, reversed: 0 },
  );
}

function customerSessionRecencyLabel(lastSeenAt: string | null | undefined, nowMs: number) {
  if (!lastSeenAt) return 'No app activity recorded';
  const lastSeenMs = dateMs(lastSeenAt);
  if (!lastSeenMs) return 'No app activity recorded';
  const ageMs = Math.max(0, nowMs - lastSeenMs);
  if (ageMs <= 30 * 60_000) return 'In app now';
  if (ageMs <= 24 * 60 * 60_000) return 'Active today';
  if (ageMs >= 7 * 24 * 60 * 60_000) return 'Inactive 7+ days';
  return 'Active in last 7 days';
}

function referralAttributionTone(status: string) {
  if (status === 'REWARDED' || status === 'QUALIFIED') return 'success' as const;
  if (status === 'BLOCKED' || status === 'CANCELLED') return 'danger' as const;
  return 'info' as const;
}

function referralRewardTone(status: string) {
  if (['CREDITED', 'PAID', 'REWARDED', 'USED_FOR_SERVICE'].includes(status)) return 'success' as const;
  if (['CANCELLED', 'REVERSED', 'TAX_REVIEW_REQUIRED'].includes(status)) return 'danger' as const;
  if (status === 'HELD') return 'warning' as const;
  return 'info' as const;
}

function readCustomerDetailSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function readCustomerDetailAction(value: string | string[] | undefined): CustomerDetailAction | null {
  const action = readCustomerDetailSearchParam(value);
  return action === 'wallet' || action === 'message' || action === 'note' ? action : null;
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
  activitySummary,
  bookingCreateGateAttempts,
  currentTimeMs,
}: {
  customer: AdminCustomerDetail;
  bookings: AdminBookingDetail[];
  activitySummary: CustomerAllTimeActivity;
  bookingCreateGateAttempts: readonly CustomerBookingGateAttemptRow[];
  currentTimeMs: number;
}) {
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status));
  const matchedWithoutChat = activeBookings.filter(
    (booking) =>
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
      !booking.chatRoom,
  );
  const recentGateAttempts = bookingCreateGateAttempts.filter(
    (attempt) => currentTimeMs - dateMs(attempt.at) <= 24 * 60 * 60_000,
  );
  const referralReviewCount = [
    ...(customer.referralsMade ?? []),
    ...(customer.referralsReceived ?? []),
  ].filter((attribution) =>
    ['FLAGGED', 'HELD', 'REVIEW_REQUIRED'].includes(attribution.fraudReviewStatus),
  ).length;
  const failedNotificationCount = (customer.user?.notifications ?? []).filter(
    (notification) => notification.deliveries?.[0]?.status === 'FAILED',
  ).length;
  const commands: CustomerOperatorCommand[] = [];

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

  if (activitySummary.paymentIssueCount > 0) {
    commands.push({
      id: 'payment-failures',
      label: 'Payment failed',
      title: `${adminCountLabel(activitySummary.paymentIssueCount, 'failed payment')} ${activitySummary.paymentIssueCount === 1 ? 'requires' : 'require'} review`,
      detail:
        'Confirm the latest payment attempt before asking the customer to retry or changing booking state.',
      owner: 'Payments',
      tone: 'warn',
      action: { type: 'link', href: `/payments?customer=${customer.id}`, label: 'Open payments' },
    });
  }

  if (activitySummary.refundRequestCount > 0) {
    commands.push({
      id: 'refund-requests',
      label: 'Refund requested',
      title: `${adminCountLabel(activitySummary.refundRequestCount, 'refund request')} ${activitySummary.refundRequestCount === 1 ? 'is' : 'are'} still open`,
      detail: 'Review the refund request and payment evidence before approval or rejection.',
      owner: 'Payments',
      tone: 'warn',
      action: { type: 'link', href: '/refunds', label: 'Open refunds' },
    });
  }

  if (activitySummary.reportedReviewCount > 0) {
    commands.push({
      id: 'reported-reviews',
      label: 'Review reported',
      title: `${adminCountLabel(activitySummary.reportedReviewCount, 'reported review')} ${activitySummary.reportedReviewCount === 1 ? 'requires' : 'require'} moderation`,
      detail: 'Open the review queue and compare the customer, Partner, and booking evidence.',
      owner: 'Trust & Safety',
      tone: 'warn',
      action: { type: 'link', href: '/reviews', label: 'Open reviews' },
    });
  }

  if (recentGateAttempts.length > 0) {
    commands.push({
      id: 'recent-booking-gates',
      label: 'Booking blocked',
      title: `${adminCountLabel(recentGateAttempts.length, 'create attempt')} blocked in the last 24 hours`,
      detail: 'Check distance, service-area, and first-pick evidence before advising the customer to retry.',
      owner: 'Booking operations',
      tone: 'warn',
      action: { type: 'link', href: '/bookings?view=blocked-create', label: 'Open blocked queue' },
    });
  }

  if (referralReviewCount > 0) {
    commands.push({
      id: 'referral-review',
      label: 'Referral review',
      title: `${adminCountLabel(referralReviewCount, 'referral attribution')} ${referralReviewCount === 1 ? 'requires' : 'require'} review`,
      detail: 'Check the attribution, qualifying booking, fraud status, and reward ownership before release.',
      owner: 'Growth operations',
      tone: 'warn',
      action: { type: 'link', href: `/referrals/customers/${customer.id}`, label: 'Review referrals' },
    });
  }

  if (failedNotificationCount > 0) {
    commands.push({
      id: 'notification-failures',
      label: 'Delivery failed',
      title: `${adminCountLabel(failedNotificationCount, 'customer notification')} ${failedNotificationCount === 1 ? 'has' : 'have'} failed delivery`,
      detail: 'Check the latest delivery result and active push device before sending another message.',
      owner: 'Customer communications',
      tone: 'warn',
      action: { type: 'link', href: '#customer-app-notifications', label: 'Review messages' },
    });
  }

  const actionCount = commands.length;

  return {
    actionCount,
    status: actionCount > 0 ? `${actionCount} open` : 'No action needed',
    tone: actionCount > 0 ? ('warn' as const) : ('success' as const),
    commands: commands.slice(0, 8),
  };
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

function readCustomerDeviceLanguageLabel(deviceLanguage: string | null | undefined) {
  return deviceLanguage?.trim() || 'Not recorded';
}

function customerCountryDisplay(label: string) {
  const sourceLabel = label.trim() || 'Not recorded';
  const region = customerCountryRegion(sourceLabel);

  return {
    fullLabel: region ? customerCountryName(region) : 'Country not recorded',
    sourceLabel,
  };
}

function customerCountryRegion(label: string) {
  if (!label || label === 'Not recorded') {
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
    .slice(0, CUSTOMER_OVERVIEW_PARTNER_PREVIEW_LIMIT);
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
    .slice(0, CUSTOMER_OVERVIEW_PARTNER_PREVIEW_LIMIT);
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

  return [...partners.values()].slice(0, CUSTOMER_OVERVIEW_PARTNER_PREVIEW_LIMIT);
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

function buildCustomerChatArchiveBookings(bookings: AdminBookingDetail[]) {
  return bookings.filter((booking) => Boolean(booking.chatRoom));
}

function readChatMessages(booking: AdminBookingDetail): AdminChatMessage[] {
  return [...(booking.chatRoom?.messages ?? [])].sort((left, right) => {
    return dateMs(left.createdAt) - dateMs(right.createdAt);
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
