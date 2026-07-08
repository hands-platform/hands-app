import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BellRing,
  BookOpenCheck,
  CalendarClock,
  FileClock,
  HeartHandshake,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { AdminDataTable } from '../components/admin-data-table';
import { AdminEmptyState } from '../components/admin-empty-state';
import { AdminFilterChipGroup } from '../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../components/admin-form-controls';
import { AdminTraceSummary } from '../components/admin-overview-card';
import { AdminPageTemplate, AdminSectionHeader } from '../components/admin-page-template';
import { AdminTextLink } from '../components/admin-text-link';
import { DateTimeText } from '../components/date-time-text';
import {
  AdminActionCard,
  AdminDetailGrid,
  AdminNotePanel,
  AdminSection,
  AdminTaskBreakdown,
  AdminTaskCard,
  AdminTaskGrid,
} from '../components/admin-surface';
import { InfoRow } from '../components/info-row';
import {
  AdminSignal,
  StatusBadge,
  StatusBadgeFromPillClass,
  StatusBadgeLink,
  StatusBadgeLinkFromPillClass,
  adminSignalToneFromClassName,
} from '../components/status-badge';
import {
  AdminAuditLog,
  AdminBooking,
  AdminCashSettlementSummary,
  AdminDashboardSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminAppSession,
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminOperationalPolicySetting,
  AdminPayment,
  AdminPaymentSummary,
  AdminPayoutBatch,
  AdminPayoutBatchSummary,
  AdminProvider,
  AdminRefund,
  AdminRefundSummary,
  AdminUser,
  adminGet,
} from '../lib/admin-api';
import {
  bookingLatestActivityAt,
  bookingRecordCreatedAt,
  bookingRequestOpenedAt,
} from '../lib/admin-booking-time';
import {
  formatDistanceMeters,
  formatMoneyOrZero as money,
  formatRelativeAge as relativeTimeLabel,
  readPlainRecord,
  shortUnknownId as shortId,
} from '../lib/admin-format';
import { type AdminDateRange, dateRangeLabel, isInDateRange } from '../lib/date-range';
import { marketplaceDisplayText as displayOperationalWording } from '../lib/admin-copy';
import { buildMarketplaceParticipantSnapshot } from '../lib/dashboard-marketplace';
import {
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
  normalizeAdminMarketplaceOpenMode,
  operationalPolicyHref,
} from '../lib/operations-policy';
import {
  bookingCompletedCloseoutNeedsOpsFromFacts,
  bookingPaymentReleaseNeedsOpsFromFacts,
} from '../lib/booking-payment-ops';
import { bookingChatQuietNeedsOps } from '../lib/booking-chat-repair-action-state';
import {
  bookingAlertEvidenceNeedsOpsFromFacts,
  bookingAlertTraceSummaryFromMetadata,
  bookingPartnerChoiceEvidenceNeedsOpsFromFacts,
} from '../lib/booking-evidence-ops';
import { bookingLocationNeedsOpsFromProvider } from '../lib/booking-status-location-helpers';
import {
  buildDashboardDataHrefs,
  buildDashboardDetailsHref,
  buildDashboardRange,
  buildDashboardViewMode,
} from './dashboard-page-model';

const DASHBOARD_INFO_HEADERS = ['Metric', 'Value'] as const;

const activeBookingStatuses = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

type DashboardTraceSummaryMetric = {
  readonly action?: ReactNode;
  readonly className?: string;
  readonly helper?: ReactNode;
  readonly href?: string;
  readonly key?: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
};

function DashboardTraceSummary({
  className,
  metrics,
}: {
  readonly className?: string;
  readonly metrics: readonly DashboardTraceSummaryMetric[];
}) {
  return (
    <AdminTraceSummary
      className={className}
      metrics={metrics.map((metric) => ({
        action: metric.action,
        className: metric.className,
        detail: metric.helper,
        href: metric.href,
        key: metric.key,
        label: metric.label,
        value: metric.value,
      }))}
    />
  );
}

// Authority marker for static guard: Online partners.

function emptyCashSettlementSummary(): AdminCashSettlementSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    currency: 'VND',
    rowCount: 0,
    providerCount: 0,
    totalCompanyCouponOffset: 0,
    totalDebtAmount: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    oldestOpenAt: null,
    oldestOpenAgeMinutes: 0,
    staleDebtRowCount: 0,
    highDebtProviderCount: 0,
    missingPaymentEvidenceCount: 0,
    cashPaymentRowCount: 0,
    topProviderGroups: [],
  };
}

function emptyDashboardSummary(): AdminDashboardSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    appPresence: {
      activeBookingCustomers: 0,
      disabledPushCustomers: 0,
      liveActiveBookingCustomers: 0,
      liveAppCustomers: 0,
      liveAppPartners: 0,
      liveOpenMatchingCustomers: 0,
      reachableCustomers: 0,
      recentCustomerSessions: 0,
      staleCustomerSessions: 0,
      totalCustomers: 0,
    },
    partnerSupply: {
      approvedVerification: 0,
      bankApproved: 0,
      blocked: 0,
      cashDebtPartners: 0,
      firstRevenue: 0,
      kycApproved: 0,
      level2Active: 0,
      liveSessions: 0,
      noLocation: 0,
      offline: 0,
      online: 0,
      onlineAvailable: 0,
      onlineAvailableSoon: 0,
      onlineBusy: 0,
      pendingVerification: 0,
      staleLocation: 0,
      supplyPressureLabel: 'No supply',
      total: 0,
      withdrawalProfileReady: 0,
    },
  };
}

function dashboardPartnerSupplyWithLiveFinance(
  summary: AdminDashboardSummary['partnerSupply'],
  input: { activeDemand: number; cashSettlementSummary: AdminCashSettlementSummary },
) {
  return {
    ...summary,
    cashDebtPartners: input.cashSettlementSummary.providerCount,
    supplyPressureLabel:
      summary.onlineAvailable > 0
        ? `${(input.activeDemand / summary.onlineAvailable).toFixed(1)}x`
        : 'No supply',
  };
}

type OpsQueueItem = {
  label: string;
  detail: string;
  href: string;
  severity: 'high' | 'medium' | 'low';
  area: 'Booking' | 'Payment' | 'Partner' | 'Notification' | 'Payout' | 'Finance';
  owner: 'Dispatch' | 'Finance' | 'Partner Ops' | 'Support' | 'System';
  priority: number;
  recommendedAction: string;
};

type PartnerOpsQueueItem = {
  id: string;
  name: string;
  status: string;
  detail: string;
  action: string;
  href: string;
  className: string;
  priority: number;
  metrics: Array<{ label: string; value: string; tone: 'ok' | 'warn' | 'danger' | 'info' }>;
};

type DashboardAcceptanceUnblockStep = {
  id: string;
  step: string;
  owner: 'Finance' | 'Account ops' | 'KYC' | 'Dispatch' | 'Ops';
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  action: string;
  href: string;
  className: string;
  pillClass: string;
  tone: 'ok' | 'warn' | 'danger' | 'info';
};

type DashboardBookingMatchingPolicySnapshot = {
  providerResponseWindowMinutes: number | null;
  backupProviderRadiusMeters: number | null;
  backupProviderLocationMaxAgeMinutes: number | null;
  backupProviderInvitationLimit: number | null;
  preferredAcceptMode: string | null;
  backupOpenMode: string | null;
  travelBufferMinutes: number | null;
};

type ShiftBriefing = {
  label: string;
  signalClass: string;
  headline: string;
  detail: string;
  primaryAction: {
    label: string;
    href: string;
  };
  stats: Array<{
    label: string;
    value: string;
    helper: string;
    tone: 'ok' | 'info' | 'warn' | 'danger';
    href: string;
  }>;
  nextActions: OpsQueueItem[];
};
type OperatorStartChecklistItem = {
  title: string;
  status: string;
  detail: string;
  action: string;
  href: string;
  className: string;
  pillClass: string;
};

type DashboardTone = 'ok' | 'info' | 'warn' | 'danger';

type LiveOperationsRadarItem = {
  lane: string;
  title: string;
  value: string;
  status: string;
  detail: string;
  href: string;
  owner: 'Dispatch' | 'Finance' | 'Partner Ops' | 'Support' | 'Setup';
  tone: DashboardTone;
  checks: string[];
};

type OperationsCommandBoardItem = {
  lane: string;
  owner: 'Dispatch' | 'Finance' | 'Partner Ops' | 'Support' | 'Setup';
  status: string;
  value: string;
  detail: string;
  href: string;
  tone: DashboardTone;
  checks: string[];
};

type BookingEvidenceCommandQueueItem = {
  lane: string;
  status: string;
  value: string;
  detail: string;
  href: string;
  owner: 'Dispatch' | 'Finance' | 'Support';
  tone: DashboardTone;
  checks: string[];
  operatorAction: string;
  sample?: {
    label: string;
    detail: ReactNode;
    href: string;
  };
};

type DashboardPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type DashboardFilters = {
  range: AdminDateRange;
};

const EMPTY_REFUND_SUMMARY: AdminRefundSummary = {
  totalCount: 0,
  requestedCount: 0,
  refundedBookingCount: 0,
  needsUpdateCount: 0,
  completedCount: 0,
  openCount: 0,
  outcomeLinkedCount: 0,
};

const dashboardRangeLinks: Array<{ range: AdminDateRange; label: string; href: string }> = [
  { range: 'all', label: 'All dates', href: '/' },
  { range: 'today', label: 'Today', href: '/?range=today' },
  { range: '7d', label: 'Last 7 days', href: '/?range=7d' },
  { range: '30d', label: 'Last 30 days', href: '/?range=30d' },
];

function buildFullDashboardData(input: {
  activePayoutBatches: AdminPayoutBatch[];
  appPresence: ReturnType<typeof buildAppPresence>;
  appSessions: AdminAppSession[];
  bookingDeepDive: ReturnType<typeof buildBookingOperationsDeepDive>;
  bookings: AdminBooking[];
  cashDebtRows: AdminEarning[];
  cashSettlementSummary: AdminCashSettlementSummary;
  earningRows: AdminEarning[];
  earnings: AdminEarningSummary;
  failedNotifications: AdminNotification[];
  liveBookingDeepDive: ReturnType<typeof buildBookingOperationsDeepDive>;
  liveBookingOps: ReturnType<typeof buildBookingOpsInsights>;
  matchingControl: ReturnType<typeof buildMatchingControlRoom>;
  notifications: AdminNotification[];
  operationalPolicies: AdminOperationalPolicySetting[];
  partnerSupply: ReturnType<typeof buildPartnerSupplyInsights>;
  payoutBatches: AdminPayoutBatch[];
  payments: AdminPayment[];
  providers: AdminProvider[];
  queue: OpsQueueItem[];
  rangeBookings: AdminBooking[];
  refunds: AdminRefund[];
  refundSummary: AdminRefundSummary;
}) {
  const partnerOpsQueue = buildPartnerOpsQueue(input.providers, input.cashDebtRows, input.appSessions);
  const commandSignals = buildDashboardCommandSignals({
    providers: input.providers,
    bookings: input.bookings,
    payments: input.payments,
    refunds: input.refunds,
    refundSummary: input.refundSummary,
    notifications: input.notifications,
    earnings: input.earnings,
    earningRows: input.earningRows,
    cashSettlementSummary: input.cashSettlementSummary,
    payoutBatches: input.payoutBatches,
  });

  return {
    acceptanceUnblockQuickOrder: buildDashboardAcceptanceUnblockQuickOrder({
      providers: input.providers,
      cashSettlementSummary: input.cashSettlementSummary,
      partnerOpsQueue,
    }),
    bookingDeepDive: input.bookingDeepDive,
    commandSignals,
    hourlyDemand: buildHourlyBookingDemand(input.rangeBookings),
    liveOperationsRadar: buildLiveOperationsRadar({
      bookingOps: input.liveBookingOps,
      bookingDeepDive: input.liveBookingDeepDive,
      matchingControl: input.matchingControl,
      appPresence: input.appPresence,
      partnerSupply: input.partnerSupply,
      cashSettlementSummary: input.cashSettlementSummary,
      failedNotifications: input.failedNotifications,
      activePayoutBatches: input.activePayoutBatches,
    }),
    operatorStartChecklist: buildOperatorStartChecklist({
      queue: input.queue,
      bookingOps: input.liveBookingOps,
      appPresence: input.appPresence,
      partnerSupply: input.partnerSupply,
      matchingControl: input.matchingControl,
      failedNotifications: input.failedNotifications,
      cashSettlementSummary: input.cashSettlementSummary,
      activePayoutBatches: input.activePayoutBatches,
    }),
    partnerOpsQueue,
    policyOutcome: buildDashboardPolicyOutcome(input.bookings, input.operationalPolicies),
    policySummary: buildOperationalPolicySummary(input.operationalPolicies),
    queueSummary: buildOpsQueueSummary(input.queue),
    regionalDemand: buildRegionalBookingDemand(input.rangeBookings),
    shiftBriefing: buildShiftCommandBriefing({
      queue: input.queue,
      commandSignals,
      bookingOps: input.liveBookingOps,
      bookingDeepDive: input.liveBookingDeepDive,
      appPresence: input.appPresence,
      partnerSupply: input.partnerSupply,
      matchingControl: input.matchingControl,
      failedNotifications: input.failedNotifications,
      cashSettlementSummary: input.cashSettlementSummary,
      activePayoutBatches: input.activePayoutBatches,
    }),
    topCommandSignal: commandSignals[0],
  };
}

export default async function DashboardPage({ searchParams }: { searchParams?: DashboardPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildDashboardFilters(params);
  const dashboardViewMode = buildDashboardViewMode(params);
  const dashboardDataHrefs = buildDashboardDataHrefs(params);
  const shouldRenderFullDashboard = dashboardViewMode.shouldRenderFullDashboard;
  const selectedRangeLabel = dateRangeLabel(filters.range);
  const [
    dashboardSummary,
    users,
    providers,
    bookings,
    payments,
    paymentSummary,
    earnings,
    earningRows,
    refunds,
    refundSummary,
    notifications,
    notificationSummary,
    payoutBatches,
    payoutBatchSummary,
    appSessions,
    auditLogs,
    cashSettlementSummary,
    operationalPolicies,
  ] = await Promise.all([
    adminGet<AdminDashboardSummary>(dashboardDataHrefs.dashboardSummaryHref, emptyDashboardSummary()),
    dashboardDataHrefs.usersHref
      ? adminGet<AdminUser[]>(dashboardDataHrefs.usersHref, [])
      : Promise.resolve([]),
    dashboardDataHrefs.partnersHref
      ? adminGet<AdminProvider[]>(dashboardDataHrefs.partnersHref, [])
      : Promise.resolve([]),
    adminGet<AdminBooking[]>(dashboardDataHrefs.bookingsHref, []),
    dashboardDataHrefs.paymentsHref
      ? adminGet<AdminPayment[]>(dashboardDataHrefs.paymentsHref, [])
      : Promise.resolve([]),
    adminGet<AdminPaymentSummary | null>(dashboardDataHrefs.paymentSummaryHref, null),
    adminGet<AdminEarningSummary>(dashboardDataHrefs.earningsSummaryHref, {
      count: 0,
      grossAmount: 0,
      platformFee: 0,
      withholdingAmount: 0,
      netAmount: 0,
      pendingNetAmount: 0,
      availableNetAmount: 0,
      paidNetAmount: 0,
      currency: 'VND',
    }),
    dashboardDataHrefs.earningsHref
      ? adminGet<AdminEarning[]>(dashboardDataHrefs.earningsHref, [])
      : Promise.resolve([]),
    dashboardDataHrefs.refundsHref
      ? adminGet<AdminRefund[]>(dashboardDataHrefs.refundsHref, [])
      : Promise.resolve([]),
    adminGet<AdminRefundSummary>(dashboardDataHrefs.refundsSummaryHref, EMPTY_REFUND_SUMMARY),
    dashboardDataHrefs.notificationsHref
      ? adminGet<AdminNotification[]>(dashboardDataHrefs.notificationsHref, [])
      : Promise.resolve([]),
    adminGet<AdminNotificationBoardSummary | null>(dashboardDataHrefs.notificationSummaryHref, null),
    dashboardDataHrefs.payoutBatchesHref
      ? adminGet<AdminPayoutBatch[]>(dashboardDataHrefs.payoutBatchesHref, [])
      : Promise.resolve([]),
    adminGet<AdminPayoutBatchSummary | null>(dashboardDataHrefs.payoutBatchSummaryHref, null),
    dashboardDataHrefs.appSessionsHref
      ? adminGet<AdminAppSession[]>(dashboardDataHrefs.appSessionsHref, [])
      : Promise.resolve([]),
    dashboardDataHrefs.bookingGateAuditHref
      ? adminGet<AdminAuditLog[]>(dashboardDataHrefs.bookingGateAuditHref, [])
      : Promise.resolve([]),
    adminGet<AdminCashSettlementSummary>(
      dashboardDataHrefs.cashSettlementSummaryHref,
      emptyCashSettlementSummary(),
    ),
    dashboardDataHrefs.operationalPolicyHref
      ? adminGet<AdminOperationalPolicySetting[]>(dashboardDataHrefs.operationalPolicyHref, [])
      : Promise.resolve([]),
  ]);

  const queue = buildOpsQueue({
    providers,
    bookings,
    payments,
    refunds,
    notifications,
    earnings,
    earningRows,
    refundSummary,
    bookingCreateRejections: auditLogs.filter((log) => log.action === 'booking.create.rejected'),
    cashSettlementSummary,
    payoutBatches,
  });
  const cashDebtRows = openCashDebtEarnings(earningRows);
  const cashDebtAmount = cashSettlementSummary.totalDebtAmount;
  const rangeBookings = bookings.filter((booking) =>
    isInDateRange(bookingLatestActivityAt(booking), filters.range),
  );
  const rangePayments = payments;
  const paymentHoldCount =
    paymentSummary?.authorized ?? payments.filter((payment) => payment.status === 'AUTHORIZED').length;
  const rangeEarningRows = earningRows;
  const rangePaymentCount = paymentSummary?.totalCount ?? rangePayments.length;
  const rangeEarningCount = earnings.count ?? rangeEarningRows.length;
  const bookingCreateRejections = auditLogs.filter((log) => log.action === 'booking.create.rejected');
  const rangeBookingCreateRejections = bookingCreateRejections;
  const bookingCreateGateSummary = buildBookingCreateGateSummary(bookingCreateRejections);
  const rangeBookingCreateGateSummary = buildBookingCreateGateSummary(rangeBookingCreateRejections);
  const bookingOps = buildBookingOpsInsights(rangeBookings);
  const liveBookingOps = buildBookingOpsInsights(bookings);
  const liveBookingDeepDive = buildBookingOperationsDeepDive(bookings, payments);
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const failedNotificationCount = notificationSummary?.failed ?? failedNotifications.length;
  const bookingEvidenceCommandQueue = buildBookingEvidenceCommandQueue({
    bookings,
    bookingDeepDive: liveBookingDeepDive,
    cashSettlementSummary,
    failedNotificationCount,
    failedNotifications,
  });
  const marketplaceParticipantSnapshot = buildMarketplaceParticipantSnapshot(bookings);
  const appPresence = shouldRenderFullDashboard
    ? buildAppPresence(users, bookings, appSessions)
    : dashboardSummary.appPresence;
  const activeBookings = bookings.filter((booking) => activeBookingStatuses.has(booking.status));
  const partnerSupply = shouldRenderFullDashboard
    ? buildPartnerSupplyInsights(providers, bookings, appSessions, cashDebtRows, cashSettlementSummary)
    : dashboardPartnerSupplyWithLiveFinance(dashboardSummary.partnerSupply, {
        activeDemand: activeBookings.length,
        cashSettlementSummary,
      });
  const activePayoutBatches = payoutBatches.filter((batch) => !['PAID', 'CANCELLED'].includes(batch.status));
  const activePayoutBatchCount = payoutBatchSummary?.open ?? activePayoutBatches.length;
  const matchingControl = buildMatchingControlRoom(bookings, providers, operationalPolicies, partnerSupply);
  const operationsCommandBoard = buildOperationsCommandBoard({
    bookingOps: liveBookingOps,
    bookingDeepDive: liveBookingDeepDive,
    matchingControl,
    appPresence,
    partnerSupply,
    cashSettlementSummary,
    failedNotificationCount,
    failedNotifications,
    activePayoutBatches,
  });
  const fullDashboardData = shouldRenderFullDashboard
    ? buildFullDashboardData({
        activePayoutBatches,
        appPresence,
        appSessions,
        bookingDeepDive: buildBookingOperationsDeepDive(rangeBookings, rangePayments),
        bookings,
        cashDebtRows,
        cashSettlementSummary,
        earningRows,
        earnings,
        failedNotifications,
        liveBookingDeepDive,
        liveBookingOps,
        matchingControl,
        notifications,
        operationalPolicies,
        partnerSupply,
        payoutBatches,
        payments,
        providers,
        queue,
        rangeBookings,
        refunds,
        refundSummary,
      })
    : null;

  const metrics = [
    [
      'Total bookings',
      rangeBookings.length.toString(),
      `${selectedRangeLabel} bookings in the selected dashboard window.`,
    ],
    [
      'Open matching',
      bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length.toString(),
      'Live counter: Customer is waiting for Partner response.',
    ],
    ['Active bookings', activeBookings.length.toString(), 'Bookings that still need operational visibility.'],
    [
      'Completed bookings',
      bookingOps.completed.toString(),
      `${selectedRangeLabel} finished services ready for payment/review closeout.`,
    ],
    [
      'Cancelled bookings',
      bookingOps.cancelled.toString(),
      `${selectedRangeLabel} cancelled requests needing refund/release review.`,
    ],
    [
      'Expired bookings',
      bookingOps.expired.toString(),
      `${selectedRangeLabel} expired requests that should have payment release and customer follow-up checked.`,
    ],
    [
      'No-show records',
      bookingOps.noShowSignal.toString(),
      `${selectedRangeLabel} formal NO_SHOW bookings plus overdue matched bookings without chat records.`,
    ],
    [
      'Closeout checks',
      bookingOps.completedCloseoutChecks.toString(),
      `${selectedRangeLabel} completed bookings missing capture, earning, tax, fee, or wallet impact records.`,
    ],
    [
      'Blocked create attempts',
      rangeBookingCreateRejections.length.toString(),
      `${selectedRangeLabel} stopped before payment and matching: ${rangeBookingCreateGateSummary.customerDistanceGate} customer distance, ${rangeBookingCreateGateSummary.firstPickDistanceGate} first-pick distance.`,
    ],
    ['Online Partners', partnerSupply.online.toString(), 'Supply currently visible to customers.'],
    [
      'Pending verification',
      partnerSupply.pendingVerification.toString(),
      'Partners waiting for admin approval.',
    ],
    [
      'Customers in app',
      appPresence.liveAppCustomers.toString(),
      'Customers with recent app activity in the active window.',
    ],
    [
      'Live matching customers',
      appPresence.liveOpenMatchingCustomers.toString(),
      'Customers currently in app while waiting for Partner matching.',
    ],
    [
      'Partners in app',
      appPresence.liveAppPartners.toString(),
      'Partners with recent app activity in the active window.',
    ],
    [
      'Active customers',
      appPresence.activeBookingCustomers.toString(),
      'Unique customers currently attached to active bookings.',
    ],
    ['Payment holds', paymentHoldCount.toString(), 'Authorized payments not yet captured or released.'],
    [
      'Failed notifications',
      failedNotificationCount.toString(),
      `${selectedRangeLabel} delivery failures that may need retry or disabled-device review.`,
    ],
    [
      'Available payout',
      money(earnings.availableNetAmount, earnings.currency),
      'Partner earnings ready for payout batching.',
    ],
    [
      'Cash debt',
      money(cashDebtAmount, earnings.currency),
      `${cashSettlementSummary.providerCount} Partner(s), ${cashSettlementSummary.rowCount} debt row(s) blocking final acceptance, service start, and payout release.`,
    ],
    [
      'Open payout batches',
      activePayoutBatchCount.toString(),
      `${selectedRangeLabel} draft, processing, failed, or held payout batches needing finance visibility.`,
    ],
    [
      'Action queue',
      queue.length.toString(),
      'Prioritized items assembled from booking, payment, Partner, and notification state.',
    ],
  ];
  const coreOperatingCounterLabels = [
    'Total bookings',
    'Open matching',
    'Active bookings',
    'Completed bookings',
    'Cancelled bookings',
    'No-show records',
    'Blocked create attempts',
    'Customers in app',
    'Live matching customers',
    'Partners in app',
    'Online Partners',
    'Payment holds',
    'Cash debt',
  ];
  const coreOperatingCounters = coreOperatingCounterLabels
    .map((counterLabel) => {
      const counter = metrics.find(([label]) => label === counterLabel);

      if (!counter) {
        return null;
      }

      return {
        label: counter[0],
        value: counter[1],
        helper: counter[2],
      };
    })
    .filter((counter): counter is { label: string; value: string; helper: string } => Boolean(counter));
  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/bookings">
            <CalendarClock size={16} aria-hidden="true" />
            Booking monitor
          </AdminFormControlLink>
          <AdminFormControlLink href="/operations-policy">
            <Settings2 size={16} aria-hidden="true" />
            Operations policy
          </AdminFormControlLink>
          <AdminTextLink href="/cash-settlements">
            Cash settlements
          </AdminTextLink>
          <AdminTextLink href="/payments">
            Payments
          </AdminTextLink>
          <AdminFormControlLink href="/partners">
            <HeartHandshake size={16} aria-hidden="true" />
            Partner review
          </AdminFormControlLink>
          <AdminFormControlLink href="/partner-controls">
            <ShieldCheck size={16} aria-hidden="true" />
            Partner controls
          </AdminFormControlLink>
          <AdminTextLink href="/tax-policy">
            Tax policy
          </AdminTextLink>
          <AdminFormControlLink href="/audit-log">
            <FileClock size={16} aria-hidden="true" />
            Audit log
          </AdminFormControlLink>
        </>
      }
      contentClassName="dashboard-page"
      description="Daily command center for dispatch, Partner supply, payment holds, refunds, notifications, and payout follow-up."
      title="HANDS Operations"
    >
      <AdminSection
        actions={
          <AdminFormControlLink href="/bookings">
            <CalendarClock size={16} aria-hidden="true" />
            Open booking monitor
          </AdminFormControlLink>
        }
        className="admin-mt-20"
        description="Booking volume, matching wait, completed and cancelled work, live app presence, Partner supply, payment holds, and cash debt in one operator scan."
        id="dashboard-core-operating-counters"
        title="Core operating counters"
      >
        <DashboardTraceSummary className="admin-mt-12" metrics={coreOperatingCounters} />
        <div className="actions admin-mt-12">
          <AdminFormControlLink href="/bookings?view=matching">
            <BellRing size={16} aria-hidden="true" />
            Matching wait
          </AdminFormControlLink>
          <AdminFormControlLink href="/bookings?view=no-show">
            <BookOpenCheck size={16} aria-hidden="true" />
            No-show evidence
          </AdminFormControlLink>
          <AdminTextLink href="/usage-overview?segment=live-customers">
            Live customer pattern
          </AdminTextLink>
          <AdminTextLink href="/cash-settlements">
            Cash settlement gate
          </AdminTextLink>
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <AdminFormControlLink href={operationsCommandBoard[0]?.href ?? '/bookings'}>
            <BellRing size={16} aria-hidden="true" />
            Open first action
          </AdminFormControlLink>
        }
        className="admin-mt-20"
        description="One-screen command order for live bookings, first-pick wait, 10km Partner marketplace, customer choice, chat handoff, settlement gates, notifications, and owner follow-up."
        id="dashboard-operations-command-board"
        title="Operations command board"
      >
        <AdminTaskGrid className="admin-mt-14">
          {operationsCommandBoard.map((item) => (
            <AdminActionCard
              className={dashboardToneCardClass(item.tone)}
              href={item.href}
              key={item.lane}
              leading={
                <>
                  <small>{item.owner}</small>
                  <StatusBadgeFromPillClass pillClass={dashboardTonePillClass(item.tone)}>{item.status}</StatusBadgeFromPillClass>
                </>
              }
              title={item.lane}
              variant="ops-task"
            >
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
              <AdminFilterChipGroup className="admin-mt-10">
                {item.checks.map((check) => (
                  <StatusBadge key={check} tone="neutral">
                    {check}
                  </StatusBadge>
                ))}
              </AdminFilterChipGroup>
            </AdminActionCard>
          ))}
        </AdminTaskGrid>
      </AdminSection>

      <AdminSection
        actions={
          <AdminTextLink href="/bookings?view=marketplace">
            Open participant ledger
          </AdminTextLink>
        }
        className="admin-mt-20"
        description="Actual booking participant records only. Partners with negative wallets can see open booking requests, but final acceptance, service start, and payout release wait for settlement."
        id="dashboard-booking-participant-flow"
        title="Booking participant flow"
      >
        <DashboardTraceSummary
          className="admin-mt-12"
          metrics={[
            {
              label: 'Open marketplace bookings',
              value: marketplaceParticipantSnapshot.openMarketplaceBookings,
              helper: 'Bookings still open for first-pick response, Partner participation, or customer choice.',
            },
            {
              label: 'Participant rows',
              value: marketplaceParticipantSnapshot.participantRows,
              helper: 'First-pick, marketplace, accepted, declined, and selected records.',
            },
            {
              label: 'First-pick rows',
              value: marketplaceParticipantSnapshot.firstPickRows,
              helper: 'Preferred Partner response rows from the first-pick window.',
            },
            {
              label: 'Marketplace participants',
              value: marketplaceParticipantSnapshot.marketplaceRows,
              helper: 'Rows from Partners beyond the preferred first-pick Partner.',
            },
            {
              label: 'Customer-selectable',
              value: marketplaceParticipantSnapshot.customerSelectableRows,
              helper: 'Accepted or selected rows that can support customer final choice.',
            },
            {
              label: 'Choice pending bookings',
              value: marketplaceParticipantSnapshot.customerChoicePendingBookings,
              helper: 'Open bookings where the customer can choose a final Partner now.',
            },
            {
              label: 'Customer selected',
              value: marketplaceParticipantSnapshot.customerSelectedRows,
              helper: 'Final Partner decisions owned by the customer.',
            },
            {
              label: 'No participants yet',
              value: marketplaceParticipantSnapshot.openBookingsWithoutParticipants,
              helper: 'Open matching rows where the customer is still waiting for Partner options.',
            },
            {
              label: 'Cash fee gate',
              value: marketplaceParticipantSnapshot.cashDebtBlockedBookings,
              helper: 'Bookings where unpaid HANDS fees block final acceptance, service start, and payout release.',
            },
            {
              label: 'Latest participant',
              value: (
                <AdminTextLink href={marketplaceParticipantSnapshot.latestParticipantHref}>
                  {marketplaceParticipantSnapshot.latestParticipantLabel}
                </AdminTextLink>
              ),
              helper: `${marketplaceParticipantSnapshot.declinedRows} declined response row(s) retained.`,
            },
          ]}
        />
        <div className="actions admin-mt-12">
          <AdminTextLink href="/bookings?view=marketplace">
            Marketplace bookings
          </AdminTextLink>
          <AdminTextLink href="/bookings?view=customer-choice">
            Customer choice
          </AdminTextLink>
          <AdminTextLink href="/cash-settlements">
            Negative wallet settlement
          </AdminTextLink>
        </div>
      </AdminSection>

      <AdminSection
        actions={
          <AdminTextLink href="/bookings?view=attention">
            Open evidence queue
          </AdminTextLink>
        }
        className="admin-mt-20"
        description="Fast paths for admin decisions that must be based on retained facts: chat, location, alert, payment, cash settlement, refund, and audit evidence."
        id="dashboard-evidence-drilldown"
        title="Evidence drilldown"
      >
        <DashboardTraceSummary
          className="admin-mt-12"
          metrics={[
            {
              label: 'Booking create gates',
              value: bookingCreateRejections.length,
              helper: (
                <AdminTextLink href="/bookings?view=blocked-create">
                  {bookingCreateGateSummary.customerGpsGate} optional GPS evidence,{' '}
                  {bookingCreateGateSummary.customerDistanceGate} customer distance,{' '}
                  {bookingCreateGateSummary.firstPickDistanceGate} first-pick distance
                </AdminTextLink>
              ),
            },
            {
              label: 'Chat evidence',
              value: liveBookingDeepDive.matchedWithoutChat + liveBookingDeepDive.quietActiveChats,
              helper: (
                <AdminTextLink href="/bookings?view=chat-repair">
                  Missing or quiet retained chat checks
                </AdminTextLink>
              ),
            },
            {
              label: 'No-show evidence',
              value: bookingOps.noShowSignal,
              helper: (
                <AdminTextLink href="/bookings?view=no-show">
                  Review only with booking and chat evidence
                </AdminTextLink>
              ),
            },
            {
              label: 'Alert evidence',
              value: failedNotificationCount,
              helper: (
                <AdminTextLink href="/notifications?review=failed">
                  Failed push and in-app delivery rows
                </AdminTextLink>
              ),
            },
            {
              label: 'Settlement evidence',
              value: cashSettlementSummary.rowCount,
              helper: (
                <AdminTextLink href="/cash-settlements">
                  Cash fee debt rows before final acceptance, service start, and payout release
                </AdminTextLink>
              ),
            },
            {
              label: 'Refund evidence',
              value: refundSummary.totalCount,
              helper: (
                <AdminTextLink href="/refunds">
                  Refund ledger and payment release checks
                </AdminTextLink>
              ),
            },
            {
              label: 'Payout evidence',
              value: activePayoutBatchCount,
              helper: (
                <AdminTextLink href="/payouts">
                  Weekly, monthly, and admin-selected batches
                </AdminTextLink>
              ),
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        actions={
          <AdminTextLink href={bookingEvidenceCommandQueue[0]?.href ?? '/bookings'}>
            Open first evidence queue
          </AdminTextLink>
        }
        className="admin-mt-20"
        description="Direct routes into the booking monitor evidence filters. Use these when staff need the exact booking list behind address, Partner choice, chat records, payment, wallet, location, alert, or closeout evidence."
        id="dashboard-booking-evidence-command-queue"
        title="Booking evidence command queue"
      >
        <AdminTaskGrid className="admin-mt-14">
          {bookingEvidenceCommandQueue.map((item) => (
            <AdminActionCard
              className={dashboardToneCardClass(item.tone)}
              href={item.href}
              key={item.lane}
              actionLabel={item.operatorAction}
              leading={
                <>
                  <small>{item.owner}</small>
                  <StatusBadgeFromPillClass pillClass={dashboardTonePillClass(item.tone)}>{item.status}</StatusBadgeFromPillClass>
                </>
              }
              title={item.lane}
              variant="ops-task"
            >
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
              {item.sample ? (
                <AdminNotePanel className="admin-mt-10">
                  <strong>{item.sample.label}</strong>
                  <p className="muted">{item.sample.detail}</p>
                </AdminNotePanel>
              ) : null}
              <AdminFilterChipGroup className="admin-mt-10">
                {item.checks.map((check) => (
                  <StatusBadge key={check} tone="neutral">
                    {check}
                  </StatusBadge>
                ))}
              </AdminFilterChipGroup>
            </AdminActionCard>
          ))}
        </AdminTaskGrid>
      </AdminSection>

      <AdminSection
        actions={<StatusBadge tone="info">{selectedRangeLabel}</StatusBadge>}
        className="admin-mt-20"
        description={
          <>
            Range: {selectedRangeLabel}. Booking demand, service/payment mix, completed work, cancelled work,
            closeout checks, and notification history use this window. Live queues and app activity stay
            current so urgent work is never hidden.
          </>
        }
        id="dashboard-date-range"
        title="Dashboard date range"
      >
        <div className="actions admin-mt-12">
          {dashboardRangeLinks.map((link) => (
            filters.range === link.range ? (
              <StatusBadgeLink href={link.href} key={link.range} tone="info">
                {link.label}
              </StatusBadgeLink>
            ) : (
              <AdminTextLink href={link.href} key={link.range}>
                {link.label}
              </AdminTextLink>
            )
          ))}
        </div>
        <DashboardTraceSummary
          className="admin-mt-12"
          metrics={[
            {
              label: 'Range bookings',
              value: rangeBookings.length,
              helper: 'Records included in demand and status analysis.',
            },
            {
              label: 'Range payments',
              value: rangePaymentCount,
              helper: 'Payment method mix for the selected window.',
            },
            {
              label: 'Range earnings',
              value: rangeEarningCount,
              helper: 'Earning rows created in the selected window.',
            },
          ]}
        />
      </AdminSection>

      {fullDashboardData ? (
        <>
          <AdminSection
            actions={
              <AdminTextLink href={fullDashboardData.liveOperationsRadar[0]?.href ?? '/bookings'}>
                Open first lane
              </AdminTextLink>
            }
            className="admin-mt-20"
            description="Current-shift radar for customer wait, first-pick, 10km marketplace, final Partner choice, chat handoff, Partner supply, cash fee gates, and payout batches."
            id="dashboard-live-operations-radar"
            title="Live operations radar"
          >
            <AdminTaskGrid className="admin-mt-14">
              {fullDashboardData.liveOperationsRadar.map((item) => (
                <AdminActionCard
                  className={dashboardToneCardClass(item.tone)}
                  href={item.href}
                  key={item.lane}
                  detail={item.detail}
                  leading={
                    <>
                      <small>
                        {item.owner} / {item.lane}
                      </small>
                      <StatusBadgeFromPillClass pillClass={dashboardTonePillClass(item.tone)}>
                        {item.status}
                      </StatusBadgeFromPillClass>
                    </>
                  }
                  title={item.title}
                  variant="ops-task"
                >
                  <AdminFilterChipGroup className="admin-mt-10">
                    <StatusBadge tone="neutral">{item.value}</StatusBadge>
                    {item.checks.slice(0, 3).map((check) => (
                      <StatusBadge key={check} tone="info">
                        {check}
                      </StatusBadge>
                    ))}
                  </AdminFilterChipGroup>
                </AdminActionCard>
              ))}
            </AdminTaskGrid>
          </AdminSection>

          <AdminSection
            actions={
              <AdminFormControlLink href="/operations-policy">
                <Settings2 size={16} aria-hidden="true" />
                Review policy cohorts
              </AdminFormControlLink>
            }
            className="admin-mt-20"
            description="First-screen readout of whether current matching policy is producing acceptable outcomes. Deeper cohort analysis stays in Operations Policy."
            id="dashboard-policy-outcome-pulse"
            title="Policy outcome pulse"
          >
            <DashboardTraceSummary className="admin-mt-12" metrics={fullDashboardData.policyOutcome.metrics} />
            <AdminTaskGrid className="admin-mt-14">
              {fullDashboardData.policyOutcome.cards.map((card) => (
                <AdminActionCard
                  actionLabel={card.operatorAction}
                  className={card.className}
                  detail={card.detail}
                  href={card.href}
                  key={card.title}
                  leading={<StatusBadgeFromPillClass pillClass={card.pillClass}>{card.scope}</StatusBadgeFromPillClass>}
                  title={card.title}
                  variant="ops-task"
                />
              ))}
            </AdminTaskGrid>
          </AdminSection>

          <AdminSection
            actions={
              <AdminSignal
                className={fullDashboardData.shiftBriefing.signalClass}
                tone={adminSignalToneFromClassName(fullDashboardData.shiftBriefing.signalClass)}
              >
                {fullDashboardData.shiftBriefing.label}
              </AdminSignal>
            }
            className="admin-mt-20"
            description="Start here before opening detail pages. It compresses dispatch, Partner supply, cash debt, notification, and payout pressure into one operating handoff."
            id="dashboard-shift-command-briefing"
            title="Shift command briefing"
          >
            <AdminNotePanel className="admin-mt-14">
              <div className="ops-row">
                <div>
                  <StatusBadge tone="warning">Next best move</StatusBadge>
                  <strong>{fullDashboardData.shiftBriefing.headline}</strong>
                  <p className="muted">{fullDashboardData.shiftBriefing.detail}</p>
                </div>
                <AdminFormControlLink href={fullDashboardData.shiftBriefing.primaryAction.href}>
                  <BellRing size={16} aria-hidden="true" />
                  {fullDashboardData.shiftBriefing.primaryAction.label}
                </AdminFormControlLink>
              </div>
            </AdminNotePanel>
            <DashboardTraceSummary
              className="admin-mt-14"
              metrics={fullDashboardData.shiftBriefing.stats.map((stat) => ({
                className: `ops-task-breakdown-item ops-task-breakdown-${stat.tone}`,
                helper: stat.helper,
                href: stat.href,
                label: stat.label,
                value: stat.value,
              }))}
            />
            <AdminTaskGrid className="admin-mt-14">
              {fullDashboardData.shiftBriefing.nextActions.map((item, index) => (
                <AdminActionCard
                  actionLabel="Open"
                  className={opsQueueCardClass(item.severity)}
                  detail={item.recommendedAction}
                  href={item.href}
                  key={`${item.area}-${item.href}-${item.label}-${index}`}
                  leading={
                    <small>
                      {item.owner} / {item.area}
                    </small>
                  }
                  title={item.label}
                  variant="ops-task"
                >
                </AdminActionCard>
              ))}
              {fullDashboardData.shiftBriefing.nextActions.length === 0 && (
                <AdminNotePanel>
                  <AdminEmptyState
                    framed
                    message="Keep monitoring live matching, Partner locations, cash debt, and notification delivery as demand changes."
                    title="No same-shift queue item is visible."
                  />
                </AdminNotePanel>
              )}
            </AdminTaskGrid>
          </AdminSection>

          <AdminSection
            actions={
              <AdminSignal
                tone={
                  fullDashboardData.operatorStartChecklist.some((item) => item.pillClass === 'pill-danger')
                    ? 'warn'
                    : 'ok'
                }
              >
                {
                  fullDashboardData.operatorStartChecklist.filter((item) => item.pillClass !== 'pill-success')
                    .length
                }{' '}
                action(s)
              </AdminSignal>
            }
            className="admin-mt-20"
            description="A simple order for the first admin pass: protect waiting customers, confirm Partner supply, clear money blockers, then check external integrations."
            id="dashboard-opening-shift-checklist"
            title="Opening shift checklist"
          >
            <AdminTaskGrid className="admin-mt-14">
              {fullDashboardData.operatorStartChecklist.map((item, index) => (
                <AdminActionCard
                  actionLabel={item.action}
                  className={item.className}
                  detail={item.detail}
                  href={item.href}
                  key={item.title}
                  leading={
                    <>
                      <small>Step {index + 1}</small>
                      <StatusBadgeFromPillClass pillClass={item.pillClass}>{item.status}</StatusBadgeFromPillClass>
                    </>
                  }
                  title={item.title}
                  variant="ops-task"
                />
              ))}
            </AdminTaskGrid>
          </AdminSection>

          <AdminSection
            actions={
              <AdminFilterChipGroup>
                <AdminFormControlLink href="/bookings?view=matching">
                  <BellRing size={16} aria-hidden="true" />
                  Open matching timeline
                </AdminFormControlLink>
                <AdminFormControlLink href="/operations-policy">
                  <Settings2 size={16} aria-hidden="true" />
                  Simulate policy
                </AdminFormControlLink>
              </AdminFilterChipGroup>
            }
            className="admin-mt-20 dashboard-card-scroll dashboard-matching-card"
            description="Live view of open matching demand. Existing bookings keep their saved matching rules; new bookings use the current policy."
            id="dashboard-matching-control-room"
            title="Matching control room"
          >
            <DashboardTraceSummary className="admin-mt-12" metrics={matchingControl.metrics} />
            <AdminDetailGrid className="admin-mt-14">
              <AdminNotePanel>
                <AdminSectionHeader
                  actions={(
                    <StatusBadgeFromPillClass pillClass={matchingControl.openRows.length ? 'pill-warn' : 'pill-success'}>
                      {matchingControl.openRows.length} shown
                    </StatusBadgeFromPillClass>
                  )}
                  description="Bookings that may require dispatch intervention before the customer cancels or the timer expires."
                  title="Open matching queue"
                />
                <div className="stack admin-mt-10">
                  {matchingControl.openRows.map((row) => (
                    <div className="ops-row" key={row.id}>
                      <div>
                        <AdminTextLink href={`/bookings/${row.id}`}>
                          {row.title}
                        </AdminTextLink>
                        <p className="muted">{row.detail}</p>
                        <AdminFilterChipGroup className="admin-mt-8">
                          <StatusBadgeFromPillClass pillClass={row.customerPillClass}>{row.customerState}</StatusBadgeFromPillClass>
                          <StatusBadgeFromPillClass pillClass={row.backupPillClass}>{row.backupState}</StatusBadgeFromPillClass>
                          <StatusBadgeFromPillClass pillClass={row.supplyPillClass}>{row.supplyState}</StatusBadgeFromPillClass>
                        </AdminFilterChipGroup>
                        <p className="muted admin-mt-6">Next: {row.nextAction}</p>
                      </div>
                      <StatusBadgeFromPillClass pillClass={row.pillClass}>{row.status}</StatusBadgeFromPillClass>
                    </div>
                  ))}
                  {matchingControl.openRows.length === 0 ? (
                    <AdminEmptyState
                      framed
                      message="No open matching booking is waiting right now."
                      title={null}
                    />
                  ) : null}
                </div>
              </AdminNotePanel>
              <AdminNotePanel>
                <AdminSectionHeader
                  actions={(
                    <StatusBadgeFromPillClass pillClass={matchingControl.healthPillClass}>
                      {matchingControl.healthLabel}
                    </StatusBadgeFromPillClass>
                  )}
                  description="The most likely reason matching will feel slow before operators touch a booking."
                  title="Supply and policy checks"
                />
                <AdminTaskGrid className="admin-grid-single admin-mt-12">
                  {matchingControl.checks.map((check) => (
                    <AdminTaskCard
                      className={check.className}
                      detail={check.detail}
                      key={check.title}
                      leading={<StatusBadgeFromPillClass pillClass={check.pillClass}>{check.status}</StatusBadgeFromPillClass>}
                      title={check.title}
                    >
                      <small>{check.operatorAction}</small>
                    </AdminTaskCard>
                  ))}
                </AdminTaskGrid>
              </AdminNotePanel>
            </AdminDetailGrid>
          </AdminSection>

          <AdminSection
            actions={
              <AdminFormControlLink href="/operations-policy">
                <Settings2 size={16} aria-hidden="true" />
                Change policy
              </AdminFormControlLink>
            }
            className="admin-mt-20 dashboard-card-scroll dashboard-policy-card"
            description="Live dispatch rules and owner decisions currently guiding matching, marketplace participation, cancellation, no-show, and Partner alerts."
            id="dashboard-operations-policy-status"
            title="Operations policy status"
          >
            <DashboardTraceSummary
              className="admin-mt-12"
              metrics={[
                {
                  label: 'Active overrides',
                  value: fullDashboardData.policySummary.activeOverrideCount,
                  helper: 'Values different from recommended baseline.',
                },
                {
                  label: 'Recent changes',
                  value: fullDashboardData.policySummary.recentChangeCount,
                  helper: 'Policy records changed in the last 7 days.',
                },
                {
                  label: 'Policy alignment',
                  value: fullDashboardData.policySummary.healthLabel,
                  helper: fullDashboardData.policySummary.healthHelper,
                },
                ...fullDashboardData.policySummary.enforced.map((item) => ({
                  action: (
                    <AdminTextLink href={item.href}>
                      Tune
                    </AdminTextLink>
                  ),
                  helper: item.helper,
                  key: item.label,
                  label: item.label,
                  value: item.value,
                })),
              ]}
            />
            {fullDashboardData.policySummary.activeOverrides.length ||
            fullDashboardData.policySummary.recentChanges.length ? (
              <AdminDetailGrid className="admin-mt-14">
                <AdminNotePanel>
                  <div className="ops-row">
                    <div>
                      <strong>Active policy overrides</strong>
                      <p className="muted">
                        These owner choices are currently different from the recommended operating baseline.
                      </p>
                    </div>
                    <StatusBadgeFromPillClass
                      pillClass={
                        fullDashboardData.policySummary.activeOverrideCount ? 'pill-warn' : 'pill-success'
                      }
                    >
                      {fullDashboardData.policySummary.activeOverrideCount} override(s)
                    </StatusBadgeFromPillClass>
                  </div>
                  <div className="stack admin-mt-10">
                    {fullDashboardData.policySummary.activeOverrides.slice(0, 4).map((override) => (
                      <div className="ops-row" key={override.key}>
                        <div>
                          <strong>{override.label}</strong>
                          <p className="muted">
                            Current {override.current} / recommended {override.recommended}
                          </p>
                        </div>
                        <StatusBadgeLink href={override.href} tone="info">
                          {override.category}
                        </StatusBadgeLink>
                      </div>
                    ))}
                    {fullDashboardData.policySummary.activeOverrides.length === 0 ? (
                      <p className="muted">
                        No active policy override is different from the recommended baseline.
                      </p>
                    ) : null}
                  </div>
                </AdminNotePanel>
                <AdminNotePanel>
                  <div className="ops-row">
                    <div>
                      <strong>Recent policy changes</strong>
                      <p className="muted">
                        Use this as a quick audit signal before investigating dispatch, payment, or alert
                        behavior.
                      </p>
                    </div>
                    <AdminFormControlLink href="/audit-log?bucket=Operations%2FPolicy">
                      <FileClock size={16} aria-hidden="true" />
                      Policy audit
                    </AdminFormControlLink>
                  </div>
                  <div className="stack admin-mt-10">
                    {fullDashboardData.policySummary.recentChanges.slice(0, 4).map((change) => (
                      <div className="ops-row" key={change.key}>
                        <div>
                          <strong>{change.label}</strong>
                          <p className="muted">
                            {change.current} changed {change.changedAtLabel}
                          </p>
                        </div>
                        <StatusBadgeLinkFromPillClass
                          href={change.href}
                          pillClass={change.enforced ? 'pill-success' : 'pill-warn'}
                        >
                          {change.enforced ? 'Live' : 'Planning'}
                        </StatusBadgeLinkFromPillClass>
                      </div>
                    ))}
                    {fullDashboardData.policySummary.recentChanges.length === 0 ? (
                      <AdminEmptyState
                        framed
                        message="No policy setting was changed in the last 7 days."
                        title={null}
                      />
                    ) : null}
                  </div>
                </AdminNotePanel>
              </AdminDetailGrid>
            ) : null}
            <AdminTaskGrid className="admin-mt-14">
              {fullDashboardData.policySummary.decisions.map((decision) => (
                <AdminActionCard
                  actionLabel="Open policy"
                  className={decision.className}
                  detail={decision.current}
                  href={decision.href}
                  key={decision.key}
                  leading={<StatusBadgeFromPillClass pillClass={decision.pillClass}>{decision.status}</StatusBadgeFromPillClass>}
                  title={decision.label}
                  variant="ops-task"
                >
                  <small>{decision.recommendation}</small>
                </AdminActionCard>
              ))}
            </AdminTaskGrid>
          </AdminSection>

          <AdminDetailGrid className="admin-mt-20">
            <AdminSection
              actions={
                <AdminFormControlLink href="/bookings?view=attention">
                  <BellRing size={16} aria-hidden="true" />
                  Attention bookings
                </AdminFormControlLink>
              }
              description="Dispatch exceptions for the selected dashboard date range that should be checked before they become customer complaints."
              id="dashboard-booking-attention-cockpit"
              title="Booking attention cockpit"
            >
              <AdminFilterChipGroup className="admin-mt-8">
                <AdminFormControlLink href="/bookings?view=matching">
                  <BellRing size={16} aria-hidden="true" />
                  Matching ops
                </AdminFormControlLink>
                <AdminFormControlLink href="/bookings?view=attention">
                  <BellRing size={16} aria-hidden="true" />
                  Attention bookings
                </AdminFormControlLink>
              </AdminFilterChipGroup>
              <DashboardTraceSummary
                metrics={[
                  {
                    label: 'Matching escalations',
                    value: fullDashboardData.bookingDeepDive.matchingEscalations,
                    helper: 'First-pick, marketplace participants, final choice, or chat handoff',
                  },
                  {
                    label: 'Expired matching',
                    value: fullDashboardData.bookingDeepDive.expiredOpenMatching,
                    helper: 'Open windows past timeout',
                  },
                  {
                    label: 'No participants',
                    value: fullDashboardData.bookingDeepDive.openWithoutParticipants,
                    helper: 'Customer waiting, no Partner participation yet',
                  },
                  {
                    label: 'Matched no chat',
                    value: fullDashboardData.bookingDeepDive.matchedWithoutChat,
                    helper: 'Partner selected, room missing',
                  },
                  {
                    label: 'Quiet active chats',
                    value: fullDashboardData.bookingDeepDive.quietActiveChats,
                    helper: 'Room exists but no messages',
                  },
                  {
                    label: 'Payment release check',
                    value: fullDashboardData.bookingDeepDive.releaseChecks,
                    helper: 'Cancelled/expired/no-show not released',
                  },
                  {
                    label: 'Completion capture check',
                    value: fullDashboardData.bookingDeepDive.captureChecks,
                    helper: 'Completed service still authorized',
                  },
                  {
                    label: 'Avg participants',
                    value: fullDashboardData.bookingDeepDive.averageParticipants,
                    helper: 'Open/matched response depth',
                  },
                  {
                    label: 'Manual closeout',
                    value: fullDashboardData.bookingDeepDive.manualCloseout,
                    helper: 'Needs operator audit trail',
                  },
                ]}
              />
            </AdminSection>

            <AdminSection
              actions={
                <AdminTextLink href="/services">
                  Service pricing
                </AdminTextLink>
              }
              description="Which services and payment methods created operational load in the selected dashboard date range."
              id="dashboard-service-payment-mix"
              title="Service and payment mix"
            >
              <AdminDetailGrid>
                <div>
                  <h3>Top service demand</h3>
                  <div className="stack">
                    {fullDashboardData.bookingDeepDive.serviceDemand.map((item) => (
                      <div className="ops-row" key={item.label}>
                        <div>
                          <strong>{item.label}</strong>
                          <p className="muted">
                            {item.active} active / {item.completed} completed / avg {money(item.averagePrice)}
                          </p>
                        </div>
                        <StatusBadge tone="info">{item.total}</StatusBadge>
                      </div>
                    ))}
                    {fullDashboardData.bookingDeepDive.serviceDemand.length === 0 ? (
                      <AdminEmptyState framed message="No service demand loaded yet." title={null} />
                    ) : null}
                  </div>
                </div>
                <div>
                  <h3>Payment method load</h3>
                  <div className="stack">
                    {fullDashboardData.bookingDeepDive.paymentMix.map((item) => (
                      <div className="ops-row" key={item.method}>
                        <div>
                          <strong>{item.method}</strong>
                          <p className="muted">
                            {money(item.amount, item.currency)} / {item.authorized} authorized /{' '}
                            {item.pending} pending
                          </p>
                        </div>
                        <StatusBadgeFromPillClass pillClass={item.checkCount ? 'pill-warn' : 'pill-info'}>
                          {item.count} payment(s)
                        </StatusBadgeFromPillClass>
                      </div>
                    ))}
                    {fullDashboardData.bookingDeepDive.paymentMix.length === 0 ? (
                      <AdminEmptyState framed message="No payment method data loaded yet." title={null} />
                    ) : null}
                  </div>
                </div>
              </AdminDetailGrid>
            </AdminSection>
          </AdminDetailGrid>

          <AdminDetailGrid className="admin-mt-20">
            <AdminSection
              actions={
                <AdminTextLink href="/bookings">
                  Open bookings
                </AdminTextLink>
              }
              description="Total, matching, completion, cancellation, and no-show proxy for the selected dashboard date range."
              id="dashboard-booking-status-control"
              title="Booking status control"
            >
              <DashboardTraceSummary
                metrics={[
                  { label: 'Total', value: bookingOps.total, helper: 'All bookings' },
                  { label: 'Matching wait', value: bookingOps.openMatching, helper: 'Customer waiting' },
                  { label: 'Completed', value: bookingOps.completed, helper: 'Service finished' },
                  { label: 'Cancelled', value: bookingOps.cancelled, helper: 'Refund/release check' },
                  { label: 'Expired', value: bookingOps.expired, helper: 'Manual closeout' },
                  { label: 'Formal no-show', value: bookingOps.noShowFormal, helper: 'Operator decision' },
                  { label: 'No-show records', value: bookingOps.noShowSignal, helper: 'Formal and overdue' },
                  { label: 'Closeout checks', value: bookingOps.completedCloseoutChecks, helper: 'Finance records' },
                ]}
              />
            </AdminSection>

            <AdminSection
              actions={<StatusBadge tone="info">Presence proxy</StatusBadge>}
              description="Current customer activity proxy until dedicated customer session tracking is added."
              id="dashboard-customer-app-presence"
              title="Customer app presence"
            >
              <AdminDataTable emptyMessage={null} headers={DASHBOARD_INFO_HEADERS} rowCount={10}>
                <InfoRow
                  label="Live app customers"
                  value={appPresence.liveAppCustomers.toString()}
                  detail="Customers with recent app activity."
                />
                <InfoRow
                  label="Live matching customers"
                  value={appPresence.liveOpenMatchingCustomers.toString()}
                  detail="Live customers attached to open matching bookings."
                />
                <InfoRow
                  label="Live active-booking customers"
                  value={appPresence.liveActiveBookingCustomers.toString()}
                  detail="Live customers attached to active bookings."
                />
                <InfoRow
                  label="Live app Partners"
                  value={appPresence.liveAppPartners.toString()}
                  detail="Partners with recent app activity."
                />
                <InfoRow
                  label="Recent customer sessions"
                  value={appPresence.recentCustomerSessions.toString()}
                  detail="Customer sessions seen in the last 30 minutes but not live now."
                />
                <InfoRow
                  label="Stale customer sessions"
                  value={appPresence.staleCustomerSessions.toString()}
                  detail="Customer sessions seen within 24 hours but outside the recent window."
                />
                <InfoRow
                  label="Active booking customers"
                  value={appPresence.activeBookingCustomers.toString()}
                  detail="Unique customers attached to open or in-service bookings."
                />
                <InfoRow
                  label="Reachable customers"
                  value={appPresence.reachableCustomers.toString()}
                  detail="Alternative signal from enabled push devices when session heartbeats are missing."
                />
                <InfoRow
                  label="Push-disabled customers"
                  value={appPresence.disabledPushCustomers.toString()}
                  detail="Customers who may not receive booking or chat updates."
                />
                <InfoRow
                  label="Customer records"
                  value={appPresence.totalCustomers.toString()}
                  detail="Total users with a customer profile in the current admin summary."
                />
              </AdminDataTable>
            </AdminSection>
          </AdminDetailGrid>

          <AdminDetailGrid className="admin-mt-20">
            <AdminSection
              actions={<StatusBadge tone="info">Asia/Ho_Chi_Minh</StatusBadge>}
              description="Bookings grouped by request hour in Vietnam time."
              id="dashboard-hourly-booking-demand"
              title="Hourly booking demand"
            >
              <div className="stack">
                {fullDashboardData.hourlyDemand.map((item) => (
                  <div className="ops-row" key={item.hour}>
                    <div>
                      <strong>{item.hour}</strong>
                      <p className="muted">
                        {item.active} active / {item.completed} completed / {item.cancelled} cancelled
                      </p>
                    </div>
                    <StatusBadgeFromPillClass pillClass={item.total ? 'pill-info' : 'pill-neutral'}>
                      {item.total}
                    </StatusBadgeFromPillClass>
                  </div>
                ))}
              </div>
            </AdminSection>

            <AdminSection
              actions={
                <AdminTextLink href="/bookings?view=all">
                  Full booking list
                </AdminTextLink>
              }
              description="Top service areas inferred from booking address text."
              id="dashboard-regional-booking-demand"
              title="Regional booking demand"
            >
              <div className="stack">
                {fullDashboardData.regionalDemand.map((item) => (
                  <div className="ops-row" key={item.region}>
                    <div>
                      <strong>{item.region}</strong>
                      <p className="muted">
                        {item.active} active / {item.completed} completed / {item.cancelled} cancelled
                      </p>
                    </div>
                    <StatusBadgeFromPillClass pillClass={item.noShowSignal ? 'pill-warn' : 'pill-info'}>
                      {item.total} booking(s)
                    </StatusBadgeFromPillClass>
                  </div>
                ))}
                {fullDashboardData.regionalDemand.length === 0 && (
                  <AdminEmptyState framed message="No booking address data loaded yet." title={null} />
                )}
              </div>
            </AdminSection>
          </AdminDetailGrid>

          <AdminDetailGrid className="admin-mt-20">
            <AdminSection
              actions={
                <AdminTextLink href="/partners">
                  Open Partners
                </AdminTextLink>
              }
              description="Current operational capacity, app presence, location freshness, and finance blockers."
              id="dashboard-partner-supply-status"
              title="Partner supply status"
            >
              <DashboardTraceSummary
                metrics={[
                  { label: 'Total Partners', value: partnerSupply.total, helper: 'All registered Partner profiles' },
                  {
                    label: 'Online supply',
                    value: partnerSupply.online,
                    helper: `${partnerSupply.onlineAvailable} available now`,
                  },
                  {
                    label: 'Live app Partners',
                    value: partnerSupply.liveSessions,
                    helper: 'Active session heartbeat',
                  },
                  {
                    label: 'Supply pressure',
                    value: partnerSupply.supplyPressureLabel,
                    helper: 'Active demand / available supply',
                  },
                  {
                    label: 'Stale location',
                    value: partnerSupply.staleLocation,
                    helper: 'Last saved location older than 90m',
                  },
                  {
                    label: 'Cash debt gate',
                    value: partnerSupply.cashDebtPartners,
                    helper: 'Must settle before final acceptance, service start, and payout release',
                  },
                  {
                    label: 'Verification queue',
                    value: partnerSupply.pendingVerification,
                    helper: 'Submitted for review',
                  },
                  { label: 'Account holds', value: partnerSupply.blocked, helper: 'Account-control blockers' },
                ]}
              />
            </AdminSection>

            <AdminSection
              actions={
                <AdminTextLink href="/partner-controls">
                  Review queue
                </AdminTextLink>
              }
              description="Funnel view for signup, KYC, banking, first revenue tax review, and optional profile review."
              id="dashboard-partner-approval-funnel"
              title="Partner approval funnel"
            >
              <AdminDataTable emptyMessage={null} headers={DASHBOARD_INFO_HEADERS} rowCount={6}>
                <InfoRow
                  label="Approved verification"
                  value={partnerSupply.approvedVerification.toString()}
                  detail="Partners whose admin verification can support work activation."
                />
                <InfoRow
                  label="KYC approved"
                  value={partnerSupply.kycApproved.toString()}
                  detail="Identity review approved for Level 2 activity."
                />
                <InfoRow
                  label="Bank approved"
                  value={partnerSupply.bankApproved.toString()}
                  detail="Primary bank account ready for payout routing."
                />
                <InfoRow
                  label="First revenue Partners"
                  value={partnerSupply.firstRevenue.toString()}
                  detail="Partners who can request wallet payout review after earning revenue."
                />
                <InfoRow
                  label="Withdrawal profile ready"
                  value={partnerSupply.withdrawalProfileReady.toString()}
                  detail="First-revenue Partners with a saved residential address for payout review."
                />
                <InfoRow
                  label="Level 2 active"
                  value={partnerSupply.level2Active.toString()}
                  detail="Partners whose KYC and verification support matching participation."
                />
              </AdminDataTable>
            </AdminSection>
          </AdminDetailGrid>

          <AdminSection
            actions={
              <AdminTextLink href="/partners">
                Partner queue
              </AdminTextLink>
            }
            className="admin-mt-20 dashboard-card-scroll dashboard-partner-dispatch-card"
            description="Partner checklist queue for marketplace blockers, location updates, first-revenue payout follow-up, and app contactability."
            id="dashboard-partner-dispatch-control"
            title="Partner dispatch control"
          >
            <AdminTaskGrid className="admin-mt-12">
              {fullDashboardData.partnerOpsQueue.items.map((item) => (
                <AdminActionCard
                  actionLabel={item.action}
                  className={item.className}
                  detail={item.detail}
                  href={item.href}
                  key={item.id}
                  leading={<small>{item.status}</small>}
                  title={item.name}
                  variant="ops-task"
                >
                  <AdminTaskBreakdown
                    items={item.metrics.map((metric) => ({
                      label: metric.label,
                      tone: metric.tone,
                      value: metric.value,
                    }))}
                  />
                </AdminActionCard>
              ))}
              {fullDashboardData.partnerOpsQueue.items.length === 0 && (
                <AdminNotePanel>
                  <AdminEmptyState
                    framed
                    message="Verified Partners, wallet debt, location freshness, payout follow-up, and app contactability are clear in the current view."
                    title="No Partner blocker is currently visible."
                  />
                </AdminNotePanel>
              )}
            </AdminTaskGrid>
            <DashboardTraceSummary
              className="admin-mt-14"
              metrics={[
                {
                  label: 'Blocked now',
                  value: fullDashboardData.partnerOpsQueue.blockedNow,
                  helper: 'Marketplace or account control held',
                },
                {
                  label: 'Needs payout profile',
                  value: fullDashboardData.partnerOpsQueue.payoutSetup,
                  helper: 'First revenue follow-up',
                },
                {
                  label: 'Location stale/missing',
                  value: fullDashboardData.partnerOpsQueue.locationIssue,
                  helper: 'Dispatch visibility gap',
                },
                {
                  label: 'Not contactable',
                  value: fullDashboardData.partnerOpsQueue.contactIssue,
                  helper: 'No recent app activity or push',
                },
              ]}
            />
          </AdminSection>

          <AdminSection
            actions={
              <AdminTextLink href="/partner-controls">
                Full unblock playbook
              </AdminTextLink>
            }
            className="admin-mt-20"
            description="First-screen sequence for clearing Partner marketplace holds. Tax review stays as a post-first-earning payout gate, not an initial marketplace gate."
            id="dashboard-marketplace-unblock-quick-order"
            title="Marketplace unblock quick order"
          >
            <AdminTaskGrid className="admin-mt-12">
              {fullDashboardData.acceptanceUnblockQuickOrder.map((step) => (
                <AdminActionCard
                  actionLabel={step.action}
                  className={step.className}
                  detail={step.detail}
                  href={step.href}
                  key={step.id}
                  leading={<StatusBadgeFromPillClass pillClass={step.pillClass}>Step {step.step}</StatusBadgeFromPillClass>}
                  title={step.title}
                  variant="ops-task"
                >
                  <AdminTaskBreakdown
                    items={[
                      {
                        label: step.metricLabel,
                        tone: step.tone,
                        value: step.metricValue,
                      },
                      {
                        label: 'Owner',
                        tone: 'info',
                        value: step.owner,
                      },
                    ]}
                  />
                </AdminActionCard>
              ))}
            </AdminTaskGrid>
          </AdminSection>

          <AdminSection
            actions={
              <AdminSignal tone={queue.some((item) => item.severity === 'high') ? 'warn' : 'ok'}>
                {queue.some((item) => item.severity === 'high') ? 'Checklist action open' : 'Stable'}
              </AdminSignal>
            }
            className="admin-mt-20 dashboard-card-scroll dashboard-command-lanes-card"
            description="High-level routing for the operating day: dispatch, Partner onboarding, payments, payouts, and owner follow-up."
            id="dashboard-today-command-lanes"
            title="Today command lanes"
          >
            {fullDashboardData.topCommandSignal && (
              <AdminNotePanel className="admin-mt-14">
                <div className="ops-row">
                  <div>
                    <StatusBadgeFromPillClass pillClass={fullDashboardData.topCommandSignal.pillClass}>
                      First move
                    </StatusBadgeFromPillClass>
                    <strong>{fullDashboardData.topCommandSignal.title}</strong>
                    <p className="muted">{fullDashboardData.topCommandSignal.detail}</p>
                  </div>
                  <AdminTextLink href={fullDashboardData.topCommandSignal.href}>
                    {fullDashboardData.topCommandSignal.action}
                  </AdminTextLink>
                </div>
              </AdminNotePanel>
            )}
            <AdminTaskGrid>
              {fullDashboardData.commandSignals.map((signal) => (
                <AdminActionCard
                  actionLabel={signal.action}
                  className={signal.className}
                  detail={signal.detail}
                  href={signal.href}
                  key={signal.title}
                  leading={<StatusBadgeFromPillClass pillClass={signal.pillClass}>{signal.status}</StatusBadgeFromPillClass>}
                  title={signal.title}
                  variant="ops-task"
                >
                  <AdminTaskBreakdown
                    items={signal.breakdown.map((item) => ({
                      href: item.href,
                      label: item.label,
                      tone: item.tone,
                      value: item.value,
                    }))}
                  />
                </AdminActionCard>
              ))}
            </AdminTaskGrid>
          </AdminSection>

          <AdminDetailGrid className="admin-mt-20 dashboard-queue-grid">
            <AdminSection
              actions={
                <AdminSignal tone={fullDashboardData.queueSummary.high > 0 ? 'warn' : 'ok'}>
                  {fullDashboardData.queueSummary.high > 0
                    ? `${fullDashboardData.queueSummary.high} same-shift`
                    : 'No same-shift queue'}
                </AdminSignal>
              }
              className="dashboard-card-scroll dashboard-checklist-card"
              description="Same-shift checklist actions grouped by customer protection, Partner controls, payment release, cash debt, and payout recovery."
              id="dashboard-operations-checklist-queue"
              title="Operations checklist queue"
            >
              <DashboardTraceSummary
                metrics={[
                  {
                    label: 'Immediate checks',
                    value: fullDashboardData.queueSummary.high,
                    helper: 'Same-shift checklist actions',
                  },
                  {
                    label: 'Customer protection',
                    value: fullDashboardData.queueSummary.customerProtection,
                    helper: 'Booking checks',
                  },
                  {
                    label: 'Finance checks',
                    value: fullDashboardData.queueSummary.financeImmediate,
                    helper: 'Payment, payout, debt',
                  },
                  {
                    label: 'Partner ops',
                    value: fullDashboardData.queueSummary.partnerImmediate,
                    helper: 'Reports or verification',
                  },
                ]}
              />
              {fullDashboardData.queueSummary.first && (
                <AdminNotePanel className="admin-mt-14">
                  <div>
                    <StatusBadgeFromPillClass
                      pillClass={
                        fullDashboardData.queueSummary.first.severity === 'high'
                          ? 'pill-danger'
                          : 'pill-warn'
                      }
                    >
                      First action
                    </StatusBadgeFromPillClass>
                    <h3>{fullDashboardData.queueSummary.first.label}</h3>
                    <p>{fullDashboardData.queueSummary.first.recommendedAction}</p>
                    <p className="muted">
                      Owner: {fullDashboardData.queueSummary.first.owner} - Checklist position{' '}
                      {fullDashboardData.queueSummary.first.priority} -{' '}
                      {fullDashboardData.queueSummary.first.detail}
                    </p>
                  </div>
                  <AdminTextLink href={fullDashboardData.queueSummary.first.href}>
                    Open task
                  </AdminTextLink>
                </AdminNotePanel>
              )}
              <div className="ops-check-list">
                {queue.slice(0, 10).map((item, index) => (
                  <Link
                    className={`ops-check-item ops-check-${item.severity}`}
                    href={item.href}
                    key={`${item.area}-${item.label}-${item.href}-${index}`}
                    prefetch={false}
                  >
                    <div>
                      <span className="muted">
                        {item.area} - {item.owner} - Checklist position {item.priority}
                      </span>
                      <strong>{item.label}</strong>
                      <p className="muted">{item.detail}</p>
                      <p className="muted">{item.recommendedAction}</p>
                    </div>
                    <p>{opsQueueSeverityLabel(item.severity)}</p>
                  </Link>
                ))}
                {queue.length === 0 && (
                  <AdminEmptyState
                    framed
                    message="No active operational issues detected from the current local data."
                    title={null}
                  />
                )}
              </div>
            </AdminSection>

          </AdminDetailGrid>

          <AdminDetailGrid className="admin-mt-20">
            <AdminSection
              description="Gross earnings, platform fee, pending net, and paid net from the selected earnings window."
              id="dashboard-finance-closeout-status"
              title="Finance closeout status"
            >
              <AdminDataTable emptyMessage={null} headers={DASHBOARD_INFO_HEADERS} rowCount={4}>
                <InfoRow
                  label="Gross"
                  value={money(earnings.grossAmount, earnings.currency)}
                  detail={`${earnings.count} earning record(s)`}
                />
                <InfoRow
                  label="Platform fee"
                  value={money(earnings.platformFee, earnings.currency)}
                  detail="Admin revenue before Partner payout."
                />
                <InfoRow
                  label="Pending net"
                  value={money(earnings.pendingNetAmount, earnings.currency)}
                  detail="Not ready for payout yet."
                />
                <InfoRow
                  label="Paid net"
                  value={money(earnings.paidNetAmount, earnings.currency)}
                  detail="Already marked paid."
                />
              </AdminDataTable>
            </AdminSection>
          </AdminDetailGrid>
        </>
      ) : (
        <AdminSection
          actions={
            <AdminFormControlLink href={buildDashboardDetailsHref('all', params)}>
              Load full dashboard
            </AdminFormControlLink>
          }
          className="admin-mt-20"
          description="The default dashboard keeps the first operator scan focused on core counters, command lanes, evidence shortcuts, and the selected date range. Load the full dashboard when you need radar, policy pulse, Partner review, queue, and finance detail sections."
          id="dashboard-on-demand-detail"
          title="More operating detail"
        />
      )}
    </AdminPageTemplate>
  );
}

function buildDashboardFilters(params: Record<string, string | string[] | undefined>): DashboardFilters {
  return {
    range: buildDashboardRange(params),
  };
}

function buildMatchingControlRoom(
  bookings: AdminBooking[],
  providers: AdminProvider[],
  settings: AdminOperationalPolicySetting[],
  partnerSupplySummary?: Pick<
    ReturnType<typeof buildPartnerSupplyInsights>,
    'online' | 'onlineAvailable' | 'staleLocation'
  >,
) {
  const openMatching = bookings
    .filter((booking) => booking.status === 'OPEN_MATCHING')
    .sort(
      (left, right) =>
        Date.parse(left.expiresAt ?? left.createdAt ?? '') -
        Date.parse(right.expiresAt ?? right.createdAt ?? ''),
    );
  const responseWindowMinutes =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ?? 10;
  const backupRadiusMeters =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ?? 10000;
  const backupLocationMaxAgeMinutes =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ?? 30;
  const backupInvitationLimit =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ?? 50;
  const backupOpenMode = normalizeAdminMarketplaceOpenMode(
    dashboardPolicyStringValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode) ??
      'IMMEDIATE_WITHIN_WINDOW',
  );
  const immediateBackup = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const openMatchingWithPolicySnapshot = openMatching.filter((booking) =>
    dashboardBookingPolicySnapshot(booking),
  );
  const hasProviderRows = providers.length > 0;
  const freshOnlinePartners = providers.filter(
    (provider) =>
      provider.status.startsWith('ONLINE') &&
      !provider.blockedAt &&
      parseCoordinatePair(provider.currentLat, provider.currentLng) &&
      locationAgeMinutes(provider.currentLocationUpdatedAt) !== null &&
      (locationAgeMinutes(provider.currentLocationUpdatedAt) ?? Infinity) <= backupLocationMaxAgeMinutes,
  );
  const freshOnlinePartnerCount = hasProviderRows
    ? freshOnlinePartners.length
    : (partnerSupplySummary?.onlineAvailable ?? 0);
  const openRows = openMatching.slice(0, 8).map((booking) => {
    const savedPolicy = dashboardBookingPolicySnapshot(booking);
    const bookingResponseWindowMinutes = savedPolicy?.providerResponseWindowMinutes ?? responseWindowMinutes;
    const bookingBackupRadiusMeters = savedPolicy?.backupProviderRadiusMeters ?? backupRadiusMeters;
    const bookingBackupLocationMaxAgeMinutes =
      savedPolicy?.backupProviderLocationMaxAgeMinutes ?? backupLocationMaxAgeMinutes;
    const bookingBackupInvitationLimit = savedPolicy?.backupProviderInvitationLimit ?? backupInvitationLimit;
    const bookingBackupOpenMode = savedPolicy?.backupOpenMode ?? backupOpenMode;
    const bookingImmediateBackup = bookingBackupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
    const coordinate = parseCoordinatePair(booking.lat, booking.lng);
    const eligiblePartnersAll =
      hasProviderRows && coordinate
        ? providersWithinRadius(providers, coordinate.lat, coordinate.lng, bookingBackupRadiusMeters)
        : [];
    const eligiblePartners = eligiblePartnersAll.slice(0, bookingBackupInvitationLimit);
    const freshEligible = eligiblePartners.filter(
      (item) => (item.ageMinutes ?? Infinity) <= bookingBackupLocationMaxAgeMinutes,
    );
    const summaryEligibleCount = hasProviderRows
      ? eligiblePartners.length
      : coordinate
        ? Math.max(partnerSupplySummary?.online ?? 0, partnerSupplySummary?.onlineAvailable ?? 0)
        : 0;
    const summaryFreshEligibleCount = hasProviderRows
      ? freshEligible.length
      : coordinate
        ? (partnerSupplySummary?.onlineAvailable ?? 0)
        : 0;
    const participantCount = booking.participants?.length ?? 0;
    const expired = booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false;
    const firstPickDeclined = Boolean(
      booking.preferredProvider?.id &&
      (booking.participants ?? []).some(
        (participant) =>
          participant.providerProfile?.id === booking.preferredProvider?.id &&
          participant.status === 'REJECTED',
      ),
    );
    const backupWindowOpen = bookingImmediateBackup || firstPickDeclined || expired;
    const needsSameShiftDispatch = expired || summaryFreshEligibleCount === 0;
    const customerReadyToChoose = participantCount > 0;
    const hasCustomerPin = Boolean(coordinate);
    const customerState = customerReadyToChoose ? 'Customer can choose' : 'Customer waiting';
    const customerPillClass = customerReadyToChoose ? 'pill-success' : 'pill-warn';
    const backupState = backupWindowOpen ? 'Marketplace open' : 'First-pick window';
    const backupPillClass = backupWindowOpen ? 'pill-success' : 'pill-info';
    const supplyState = hasCustomerPin
      ? hasProviderRows
        ? `${freshEligible.length} fresh / ${eligiblePartners.length} nearby`
        : `${summaryFreshEligibleCount} fresh / ${summaryEligibleCount} live supply`
      : 'No customer pin';
    const supplyPillClass = !hasCustomerPin
      ? 'pill-danger'
      : summaryFreshEligibleCount
        ? 'pill-success'
        : 'pill-danger';
    const nextAction = matchingRowNextAction({
      expired,
      hasCustomerPin,
      customerReadyToChoose,
      backupWindowOpen,
      freshEligibleCount: summaryFreshEligibleCount,
      eligibleCount: summaryEligibleCount,
      firstPickName: booking.preferredProvider?.displayName ?? null,
    });
    const detail = [
      bookingRegionLabel(booking),
      `first-pick ${booking.preferredProvider?.displayName ?? 'none'}`,
      `${participantCount} participant row(s)`,
      firstPickDeclined
        ? 'first-pick declined'
        : backupWindowOpen
          ? 'marketplace open'
          : 'marketplace waiting',
      coordinate && hasProviderRows
        ? `${freshEligible.length}/${eligiblePartners.length} fresh eligible / ${eligiblePartnersAll.length} in radius`
        : coordinate
          ? `${summaryFreshEligibleCount}/${summaryEligibleCount} live supply from summary`
          : 'no customer pin',
      `${bookingBackupInvitationLimit} invite cap`,
      `${formatDistance(bookingBackupRadiusMeters)} radius`,
      `${bookingBackupLocationMaxAgeMinutes}m freshness`,
      `${bookingResponseWindowMinutes}m window`,
      savedPolicy ? 'saved policy' : 'live policy default',
      booking.expiresAt ? `timer ${timeUntilLabel(booking.expiresAt)}` : 'no timer',
    ].join(' / ');

    return {
      id: booking.id,
      title: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
      detail,
      status: needsSameShiftDispatch ? 'Dispatch now' : 'Monitor',
      pillClass: needsSameShiftDispatch ? 'pill-danger' : 'pill-warn',
      eligibleCount: summaryEligibleCount,
      freshEligibleCount: summaryFreshEligibleCount,
      expired,
      hasPolicySnapshot: Boolean(savedPolicy),
      customerState,
      customerPillClass,
      backupState,
      backupPillClass,
      supplyState,
      supplyPillClass,
      nextAction,
    };
  });
  const attentionRows = openRows.filter((row) => row.expired || row.freshEligibleCount === 0);
  const averageEligible =
    openRows.length > 0
      ? (openRows.reduce((sum, row) => sum + row.eligibleCount, 0) / openRows.length).toFixed(1)
      : '0';
  const insideFirstPickWindow = openMatching.filter((booking) =>
    bookingInsideResponseWindow(booking, responseWindowMinutes),
  ).length;
  const pastFirstPickWindow = openMatching.length - insideFirstPickWindow;
  const customerChoiceReady = openMatching.filter((booking) =>
    (booking.participants ?? []).some((participant) => participant.status === 'ACCEPTED'),
  ).length;

  return {
    openRows,
    healthLabel: attentionRows.length ? `${attentionRows.length} attention` : 'Stable',
    healthPillClass: attentionRows.length ? 'pill-danger' : 'pill-success',
    metrics: [
      {
        label: 'Open matching',
        value: String(openMatching.length),
        helper: `${attentionRows.length} booking(s) need dispatch review now.`,
      },
      {
        label: 'Inside first window',
        value: String(insideFirstPickWindow),
        helper: `Open bookings still inside the first-pick response window using the live ${responseWindowMinutes}m policy.`,
      },
      {
        label: 'Past first-pick',
        value: String(pastFirstPickWindow),
        helper: 'Open bookings past the first-pick response window and ready for marketplace handling.',
      },
      {
        label: 'Customer can choose',
        value: String(customerChoiceReady),
        helper: 'Open bookings with accepted Partners visible in the customer choice list.',
      },
      {
        label: 'Policy timer',
        value: `${responseWindowMinutes} min live`,
        helper: 'New bookings use this value; open rows keep their saved matching rules.',
      },
      {
        label: 'Marketplace radius',
        value: formatDistance(backupRadiusMeters),
        helper: `${averageEligible} average eligible Partner(s) using row-level saved radius when available.`,
      },
      {
        label: 'Marketplace invite cap',
        value: String(backupInvitationLimit),
        helper: 'Maximum nearest eligible Partners opened for marketplace participation on new bookings.',
      },
      {
        label: 'Marketplace open rule',
        value: immediateBackup ? 'Immediate live' : 'Delayed live',
        helper: immediateBackup
          ? 'New bookings allow eligible Partners during the first-pick timer.'
          : 'New bookings hold marketplace Partners unless first-pick declines or the window expires.',
      },
      {
        label: 'Saved rules',
        value: `${openMatchingWithPolicySnapshot.length}/${openMatching.length}`,
        helper: 'Open bookings with stored matchingPolicy metadata for audit-safe dispatch decisions.',
      },
      {
        label: 'Fresh online supply',
        value: String(freshOnlinePartnerCount),
        helper: hasProviderRows
          ? `Online Partners with a location update in the last ${backupLocationMaxAgeMinutes} minutes.`
          : 'Dashboard summary supply available without loading the full Partner list.',
      },
    ],
    checks: [
      {
        status: attentionRows.length ? 'Action needed' : 'Clear',
        title: 'Timer and supply check',
        detail: attentionRows.length
          ? `${attentionRows.length} open matching booking(s) are expired or have no fresh eligible nearby Partner.`
          : 'Open matching bookings have usable Partner supply in the current sample.',
        operatorAction: attentionRows.length
          ? 'Open the affected bookings, contact Partners, or widen/refresh supply before customer wait grows.'
          : 'Keep monitoring response speed and participant depth.',
        className: attentionRows.length ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: attentionRows.length ? 'pill-danger' : 'pill-success',
      },
      {
        status: immediateBackup ? 'Visible early' : 'Delayed',
        title: 'Marketplace participation mode',
        detail: immediateBackup
          ? 'New bookings can show nearby marketplace Partners during the first-pick response window.'
          : 'New bookings keep marketplace Partners waiting until timeout, unless first-pick declines first.',
        operatorAction: immediateBackup
          ? 'This supports the current customer anxiety-reduction direction.'
          : 'Use this only when first-pick Partner response rate is strong enough, and monitor decline recovery.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        status:
          openMatching.length === 0 || openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'Traceable'
            : 'Live policy default',
        title: 'Open booking policy records',
        detail:
          openMatching.length === 0
            ? 'No open matching booking needs policy record review right now.'
            : `${openMatchingWithPolicySnapshot.length}/${openMatching.length} open matching booking(s) have saved matching policy.`,
        operatorAction:
          openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'Use each booking row and detail page for manual dispatch decisions.'
            : 'Older open bookings without saved rules should be reviewed against current policy and audit notes.',
        className:
          openMatching.length === 0 || openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'ops-task-done'
            : 'ops-task-pending',
        pillClass:
          openMatching.length === 0 || openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'pill-success'
            : 'pill-warn',
      },
      {
        status: freshOnlinePartners.length ? 'Location ready' : 'Location gap',
        title: 'Partner app location freshness',
        detail: freshOnlinePartners.length
          ? `${freshOnlinePartners.length} online Partner(s) have location data fresh within ${backupLocationMaxAgeMinutes} minutes.`
          : 'No online Partner has a fresh location update in the current admin sample.',
        operatorAction: freshOnlinePartners.length
          ? 'This is enough to validate the low-cost last-location model.'
          : 'Ask Partners to open the app so one fresh low-cost location update can seed matching.',
        className: freshOnlinePartners.length ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: freshOnlinePartners.length ? 'pill-success' : 'pill-danger',
      },
    ],
  };
}

type DashboardPolicyOutcomeStats = {
  sampleCount: number;
  matchedCount: number;
  completedCount: number;
  failedOutcomeCount: number;
  participantCount: number;
  backupInviteCount: number;
};

function buildDashboardPolicyOutcome(bookings: AdminBooking[], settings: AdminOperationalPolicySetting[]) {
  const measuredBookings = bookings.filter((booking) => dashboardBookingPolicySnapshot(booking));
  const stats = dashboardPolicyOutcomeStats(measuredBookings);
  const liveWindow =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ?? 10;
  const liveRadius =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ?? 10000;
  const liveInviteCap =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ?? 50;
  const liveBackupMode = normalizeAdminMarketplaceOpenMode(
    dashboardPolicyStringValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode) ??
      'IMMEDIATE_WITHIN_WINDOW',
  );
  const driftCount = measuredBookings.filter(
    (booking) => dashboardPolicySnapshotDrift(booking, settings).length > 0,
  ).length;
  const lowBackupInviteCount = measuredBookings.filter(
    (booking) => booking.status === 'OPEN_MATCHING' && dashboardBookingBackupInviteCount(booking) === 0,
  ).length;
  const failedRate = stats.sampleCount > 0 ? stats.failedOutcomeCount / stats.sampleCount : 0;
  const matchedRate = stats.sampleCount > 0 ? stats.matchedCount / stats.sampleCount : 0;
  const avgInvites = dashboardAverageLabel(stats.backupInviteCount, stats.sampleCount, 'Partner(s)');
  const avgParticipants = dashboardAverageLabel(stats.participantCount, stats.sampleCount, 'Partner(s)');
  const outcomeHealthy = stats.sampleCount > 0 && matchedRate >= 0.7 && failedRate <= 0.15;

  return {
    metrics: [
      {
        label: 'Measured bookings',
        value: String(stats.sampleCount),
        helper: 'Bookings with saved matching policy records.',
      },
      {
        label: 'Matched rate',
        value: dashboardPercentLabel(stats.matchedCount, stats.sampleCount),
        helper: `${stats.matchedCount}/${stats.sampleCount} reached selected or active Partner state.`,
      },
      {
        label: 'Completed rate',
        value: dashboardPercentLabel(stats.completedCount, stats.sampleCount),
        helper: `${stats.completedCount}/${stats.sampleCount} completed service.`,
      },
      {
        label: 'Failed outcome rate',
        value: dashboardPercentLabel(stats.failedOutcomeCount, stats.sampleCount),
        helper: 'Cancelled, expired, refunded, or no-show outcomes in measured bookings.',
      },
      {
        label: 'Avg marketplace alerts',
        value: avgInvites,
        helper: 'Read from booking backupNotificationTraces metadata.',
      },
      {
        label: 'Avg participants',
        value: avgParticipants,
        helper: 'Partner join depth across measured bookings.',
      },
    ],
    cards: [
      {
        scope: outcomeHealthy ? 'On track' : stats.sampleCount ? 'Review' : 'Needs data',
        title: outcomeHealthy
          ? 'Matching policy is performing in the current sample'
          : stats.sampleCount
            ? 'Policy outcomes need operator review'
            : 'Policy outcomes need more booking data',
        detail: stats.sampleCount
          ? `${dashboardPercentLabel(stats.matchedCount, stats.sampleCount)} matched, ${dashboardPercentLabel(
              stats.failedOutcomeCount,
              stats.sampleCount,
            )} failed outcome, ${avgInvites} marketplace alert(s).`
          : 'Create measured bookings after the policy is active so the dashboard can compare policy to outcomes.',
        operatorAction: outcomeHealthy
          ? 'Keep current policy stable while collecting more district and time-band results.'
          : stats.sampleCount
            ? 'Open Operations Policy and compare cohorts before changing timer, radius, cap, or marketplace mode.'
            : 'Run a direct booking and marketplace Partner flow, then return here.',
        href: '/operations-policy',
        className: outcomeHealthy
          ? 'ops-task-done'
          : stats.sampleCount
            ? 'ops-task-pending'
            : 'ops-task-blocked',
        pillClass: outcomeHealthy ? 'pill-success' : stats.sampleCount ? 'pill-warn' : 'pill-danger',
      },
      {
        scope: 'Live rules',
        title: `${liveWindow}m wait / ${formatDistance(liveRadius)} / cap ${liveInviteCap}`,
        detail:
          liveBackupMode === 'IMMEDIATE_WITHIN_WINDOW'
            ? 'Marketplace Partners can be exposed during the first-pick response window.'
            : 'Marketplace timing needs policy review before rollout.',
        operatorAction:
          lowBackupInviteCount > 0
            ? `${lowBackupInviteCount} open matching booking(s) have no marketplace alert delivery record yet.`
            : 'Marketplace exposure is recorded in the current measured sample.',
        href: lowBackupInviteCount > 0 ? '/bookings?view=matching' : '/operations-policy',
        className: lowBackupInviteCount > 0 ? 'ops-task-pending' : 'ops-task-done',
        pillClass: lowBackupInviteCount > 0 ? 'pill-warn' : 'pill-success',
      },
      {
        scope: driftCount ? 'Drift' : 'Aligned',
        title: driftCount
          ? 'Some bookings were opened under older policy'
          : 'Measured bookings align with live policy',
        detail: driftCount
          ? `${driftCount} measured booking(s) differ from the current live policy. This is normal after admin changes, but should be visible before manual action.`
          : 'No measured booking currently differs from live matching policy values.',
        operatorAction: driftCount
          ? 'Use booking detail policy records before expiring, extending, or manually matching those requests.'
          : 'Manual dispatch can use the current policy view with lower ambiguity.',
        href: driftCount ? '/operations-policy' : '/bookings?view=matching',
        className: driftCount ? 'ops-task-pending' : 'ops-task-done',
        pillClass: driftCount ? 'pill-warn' : 'pill-success',
      },
    ],
  };
}

function dashboardPolicyOutcomeStats(bookings: AdminBooking[]): DashboardPolicyOutcomeStats {
  return bookings.reduce<DashboardPolicyOutcomeStats>(
    (stats, booking) => {
      stats.sampleCount += 1;
      if (dashboardBookingHasMatchedPartner(booking)) {
        stats.matchedCount += 1;
      }
      if (booking.status === 'COMPLETED') {
        stats.completedCount += 1;
      }
      if (['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(booking.status)) {
        stats.failedOutcomeCount += 1;
      }
      stats.participantCount += booking.participants?.length ?? 0;
      stats.backupInviteCount += dashboardBookingBackupInviteCount(booking);
      return stats;
    },
    {
      sampleCount: 0,
      matchedCount: 0,
      completedCount: 0,
      failedOutcomeCount: 0,
      participantCount: 0,
      backupInviteCount: 0,
    },
  );
}

function dashboardBookingHasMatchedPartner(booking: AdminBooking) {
  return (
    Boolean(booking.selectedProvider) ||
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status)
  );
}

function dashboardBookingBackupInviteCount(booking: AdminBooking) {
  return bookingAlertTraceSummaryFromMetadata(booking.metadata).totalNotified;
}

function dashboardPolicySnapshotDrift(booking: AdminBooking, settings: AdminOperationalPolicySetting[]) {
  const snapshot = dashboardBookingPolicySnapshot(booking);
  if (!snapshot) {
    return [];
  }
  const comparisons = [
    {
      saved: snapshot.providerResponseWindowMinutes,
      live: dashboardPolicyRawValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes),
    },
    {
      saved: snapshot.backupProviderRadiusMeters,
      live: dashboardPolicyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
    },
    {
      saved: snapshot.backupProviderLocationMaxAgeMinutes,
      live: dashboardPolicyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes),
    },
    {
      saved: snapshot.backupProviderInvitationLimit,
      live: dashboardPolicyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit),
    },
    {
      saved: snapshot.preferredAcceptMode,
      live: dashboardPolicyRawValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode),
    },
    {
      saved: snapshot.backupOpenMode,
      live: dashboardPolicyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode),
    },
  ];
  return comparisons.filter(
    (comparison) =>
      comparison.saved !== null &&
      comparison.saved !== undefined &&
      String(comparison.saved) !== String(comparison.live),
  );
}

function dashboardPolicyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return adminOperationalPolicySettingByKey(settings, key)?.value;
}

function dashboardPercentLabel(count: number, total: number) {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((count / total) * 100)}%`;
}

function dashboardAverageLabel(total: number, count: number, unit: string) {
  if (count <= 0) {
    return `0 ${unit}`;
  }
  return `${(total / count).toLocaleString('en', { maximumFractionDigits: 1 })} ${unit}`;
}

function dashboardPolicyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  const raw = adminOperationalPolicySettingByKey(settings, key)?.value;
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function dashboardPolicyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  const raw = adminOperationalPolicySettingByKey(settings, key)?.value;
  return typeof raw === 'string' ? raw : null;
}

function dashboardBookingPolicySnapshot(
  booking: AdminBooking,
): DashboardBookingMatchingPolicySnapshot | null {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  if (!policy) {
    return null;
  }
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy.providerResponseWindowMinutes),
    backupProviderRadiusMeters: readOptionalNumber(policy.backupProviderRadiusMeters),
    backupProviderLocationMaxAgeMinutes: readOptionalNumber(policy.backupProviderLocationMaxAgeMinutes),
    backupProviderInvitationLimit: readOptionalNumber(policy.backupProviderInvitationLimit),
    preferredAcceptMode: readOptionalString(policy.preferredAcceptMode),
    backupOpenMode: readOptionalString(policy.backupOpenMode),
    travelBufferMinutes: readOptionalNumber(policy.travelBufferMinutes),
  };
}

function bookingInsideResponseWindow(booking: AdminBooking, responseWindowMinutes: number) {
  const createdAtMs = Date.parse(booking.createdAt ?? '');
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }
  return Date.now() - createdAtMs <= responseWindowMinutes * 60 * 1000;
}

function matchingRowNextAction(input: {
  expired: boolean;
  hasCustomerPin: boolean;
  customerReadyToChoose: boolean;
  backupWindowOpen: boolean;
  freshEligibleCount: number;
  eligibleCount: number;
  firstPickName: string | null;
}) {
  if (input.expired) {
    return 'Expire or manually recover this request before the customer waits longer.';
  }
  if (!input.hasCustomerPin) {
    return 'Confirm the customer service location so distance-based marketplace matching can work.';
  }
  if (input.customerReadyToChoose) {
    return 'Confirm the customer sees the shortlist and can select the final Partner.';
  }
  if (input.freshEligibleCount === 0 && input.eligibleCount > 0) {
    return 'Ask nearby Partners to refresh location or open the Partner app before widening policy.';
  }
  if (input.freshEligibleCount === 0) {
    return 'Check local supply; no fresh nearby Partner is currently available for marketplace participation.';
  }
  if (input.backupWindowOpen) {
    return `Nudge ${input.freshEligibleCount} eligible nearby Partner(s) to join the customer choice list.`;
  }
  return `Monitor first-pick response from ${input.firstPickName ?? 'the preferred Partner'} while marketplace supply stays ready.`;
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildBookingCreateGateSummary(logs: AdminAuditLog[]) {
  const customerDistanceGate = logs.filter(
    (log) => bookingCreateGateReason(log) === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR',
  ).length;
  const customerGpsGate = logs.filter(
    (log) =>
      bookingCreateGateReason(log) === 'CUSTOMER_CURRENT_LOCATION_STALE' ||
      bookingCreateGateReason(log) === 'CUSTOMER_CURRENT_LOCATION_MISSING' ||
      bookingCreateGateReason(log) === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING' ||
      bookingCreateGateReason(log) === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID',
  ).length;
  const firstPickDistanceGate = logs.filter(
    (log) => bookingCreateGateReason(log) === 'PREFERRED_PARTNER_TOO_FAR',
  ).length;
  const serviceAreaGate = logs.filter(
    (log) => bookingCreateGateReason(log) === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
  ).length;

  return {
    total: logs.length,
    customerDistanceGate,
    customerGpsGate,
    firstPickDistanceGate,
    serviceAreaGate,
    otherGate: Math.max(
      0,
      logs.length - customerDistanceGate - customerGpsGate - firstPickDistanceGate - serviceAreaGate,
    ),
  };
}

function bookingCreateGateReason(log: AdminAuditLog) {
  const metadata = readPlainRecord(log.metadata);
  return readOptionalString(metadata?.reasonCode) ?? readOptionalString(metadata?.code) ?? 'UNKNOWN';
}

function providersWithinRadius(providers: AdminProvider[], lat: number, lng: number, radiusMeters: number) {
  return providers
    .map((provider) => {
      const coordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
      const distanceMeters = coordinate
        ? haversineDistanceMeters(lat, lng, coordinate.lat, coordinate.lng)
        : null;
      return {
        provider,
        ageMinutes,
        distanceMeters,
      };
    })
    .filter(
      (item) =>
        item.provider.status.startsWith('ONLINE') &&
        !item.provider.blockedAt &&
        item.distanceMeters !== null &&
        item.distanceMeters <= radiusMeters &&
        item.ageMinutes !== null &&
        item.ageMinutes <= 24 * 60,
    )
    .sort((left, right) => (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity));
}

function bookingServiceLabel(booking: AdminBooking) {
  const service = booking.services?.[0];
  const name = service?.service?.name ?? 'Booking';
  const duration = service?.service?.durationMin ? `${service.service.durationMin} min` : null;
  return duration ? `${name} (${duration})` : name;
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = typeof lat === 'number' ? lat : typeof lat === 'string' ? Number(lat) : NaN;
  const parsedLng = typeof lng === 'number' ? lng : typeof lng === 'string' ? Number(lng) : NaN;
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }
  if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6371000;
  const deltaLat = degreesToRadians(toLat - fromLat);
  const deltaLng = degreesToRadians(toLng - fromLng);
  const startLat = degreesToRadians(fromLat);
  const endLat = degreesToRadians(toLat);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function buildOperationsCommandBoard(input: {
  bookingOps: ReturnType<typeof buildBookingOpsInsights>;
  bookingDeepDive: ReturnType<typeof buildBookingOperationsDeepDive>;
  matchingControl: ReturnType<typeof buildMatchingControlRoom>;
  appPresence: ReturnType<typeof buildAppPresence>;
  partnerSupply: ReturnType<typeof buildPartnerSupplyInsights>;
  cashSettlementSummary: AdminCashSettlementSummary;
  failedNotificationCount: number;
  failedNotifications: AdminNotification[];
  activePayoutBatches: AdminPayoutBatch[];
}): OperationsCommandBoardItem[] {
  const openMatchingFollowUp = input.matchingControl.openRows.filter(
    (row) => row.expired || row.freshEligibleCount === 0,
  ).length;
  const firstPickRows = input.matchingControl.openRows.filter((row) =>
    row.backupState.toLowerCase().includes('first-pick'),
  ).length;
  const marketplaceRows = input.matchingControl.openRows.filter((row) =>
    row.backupState.toLowerCase().includes('marketplace'),
  ).length;
  const customerChoiceRows = input.matchingControl.openRows.filter((row) =>
    row.customerState.toLowerCase().includes('choose'),
  ).length;
  const chatHandoffRows = input.bookingDeepDive.matchedWithoutChat + input.bookingDeepDive.quietActiveChats;
  const financeRows =
    input.bookingOps.completedCloseoutChecks +
    input.cashSettlementSummary.rowCount +
    input.activePayoutBatches.length;

  return [
    {
      lane: 'Live booking command',
      owner: 'Dispatch',
      status: openMatchingFollowUp ? 'Action' : input.bookingOps.openMatching ? 'Live' : 'Clear',
      value: `${input.bookingOps.openMatching} open`,
      detail: openMatchingFollowUp
        ? `${openMatchingFollowUp} active booking row(s) have expired timers or no fresh nearby Partner.`
        : `${input.appPresence.liveOpenMatchingCustomers} customer(s) are live while matching is open.`,
      href: openMatchingFollowUp ? '/bookings?view=attention' : '/bookings?view=matching',
      tone: openMatchingFollowUp ? 'danger' : input.bookingOps.openMatching ? 'warn' : 'ok',
      checks: [
        `${input.bookingDeepDive.openWithoutParticipants} without Partner`,
        `${input.bookingDeepDive.expiredOpenMatching} expired timer(s)`,
        'Confirmed address record',
      ],
    },
    {
      lane: 'First-pick and 10km market',
      owner: 'Dispatch',
      status: firstPickRows || marketplaceRows ? 'Monitoring' : 'Clear',
      value: `${firstPickRows} first / ${marketplaceRows} market`,
      detail:
        firstPickRows || marketplaceRows
          ? 'Preferred Partner keeps the first window while nearby Partners can request to participate for customer choice.'
          : 'No first-pick or marketplace handoff is waiting in the current open sample.',
      href: firstPickRows ? '/bookings?view=first-pick' : '/bookings?view=marketplace',
      tone: firstPickRows || marketplaceRows ? 'info' : 'ok',
      checks: [
        '10 minute first-pick',
        input.matchingControl.metrics.find((item) => item.label === 'Marketplace radius')?.value ?? '10 km',
        'No auto assignment',
      ],
    },
    {
      lane: 'Customer final choice',
      owner: 'Support',
      status: customerChoiceRows ? 'Choose' : 'Waiting',
      value: `${customerChoiceRows} ready`,
      detail:
        customerChoiceRows > 0
          ? 'Accepted Partners are visible; customer must select the final Partner before work is locked.'
          : 'No customer final-choice handoff is waiting now.',
      href: customerChoiceRows ? '/bookings?view=customer-choice' : '/bookings',
      tone: customerChoiceRows ? 'info' : 'ok',
      checks: [
        `${input.bookingDeepDive.customerFinalSelection} selection wait`,
        'Customer-owned decision',
        'No direct cancel after match',
      ],
    },
    {
      lane: 'Chat and evidence',
      owner: 'Support',
      status: chatHandoffRows ? 'Review' : 'Clear',
      value: `${chatHandoffRows} check`,
      detail:
        chatHandoffRows > 0
          ? 'Matched work must have chat available during service and retained for admin decisions after completion.'
          : 'Matched chat and retained message checks are clear in the loaded data.',
      href: chatHandoffRows ? '/bookings?view=chat-repair' : '/chat-archive',
      tone: chatHandoffRows ? 'warn' : 'ok',
      checks: [
        `${input.bookingDeepDive.matchedWithoutChat} missing room`,
        `${input.bookingDeepDive.quietActiveChats} quiet room`,
        'Chat record retained',
      ],
    },
    {
      lane: 'Partner supply',
      owner: 'Partner Ops',
      status: input.partnerSupply.onlineAvailable ? 'Available' : 'Check',
      value: `${input.partnerSupply.onlineAvailable}/${input.partnerSupply.online} online`,
      detail:
        input.partnerSupply.onlineAvailable > 0
          ? `${input.partnerSupply.staleLocation} Partner location pin(s) are older than the freshness window.`
          : 'No online available Partner is visible; check app activity, location update, and onboarding review.',
      href: input.partnerSupply.staleLocation > 0 ? '/partners?review=location' : '/partners',
      tone: input.partnerSupply.onlineAvailable
        ? input.partnerSupply.staleLocation
          ? 'warn'
          : 'ok'
        : 'warn',
      checks: [
        `${input.partnerSupply.liveSessions} recent app activity`,
        `${input.partnerSupply.noLocation} missing pin`,
        `${input.partnerSupply.pendingVerification} KYC waiting`,
      ],
    },
    {
      lane: 'Finance closeout',
      owner: 'Finance',
      status: financeRows ? 'Review' : 'Clear',
      value: `${financeRows} item(s)`,
      detail:
        input.cashSettlementSummary.providerCount > 0
          ? 'Negative wallet keeps marketplace list visibility, but final acceptance, service start, and payout release wait for cash fee settlement.'
          : 'Completed work, cash settlement, and payout batch rows are visible for batch closeout.',
      href: financeRows ? '/finance-closeout' : '/earnings',
      tone: financeRows ? 'warn' : 'ok',
      checks: [
        `${input.cashSettlementSummary.rowCount} cash fee row(s)`,
        `${input.activePayoutBatches.length} payout batch(es)`,
        'Weekly/monthly/admin batch',
      ],
    },
    {
      lane: 'Notifications',
      owner: 'Support',
      status: input.failedNotificationCount ? 'Retry' : 'Clear',
      value: `${input.failedNotificationCount} failed`,
      detail:
        input.failedNotificationCount > 0
          ? 'Failed delivery rows should be retried or marked so operators know whether the customer or Partner saw it.'
          : 'No failed notification rows are visible in the current operations window.',
      href: input.failedNotificationCount ? '/notifications?review=failed' : '/notifications',
      tone: input.failedNotificationCount ? 'warn' : 'ok',
      checks: ['Delivery status', 'Disabled device', 'Retry status'],
    },
  ];
}

function buildBookingEvidenceCommandQueue(input: {
  bookings: AdminBooking[];
  bookingDeepDive: ReturnType<typeof buildBookingOperationsDeepDive>;
  cashSettlementSummary: AdminCashSettlementSummary;
  failedNotificationCount: number;
  failedNotifications: AdminNotification[];
}): BookingEvidenceCommandQueueItem[] {
  const addressRows = input.bookings.filter((booking) => !booking.addressSnapshot);
  const partnerChoiceRows = input.bookings.filter(dashboardBookingPartnerChoiceNeedsEvidence);
  const chatRows = input.bookings.filter(dashboardBookingChatNeedsEvidence);
  const moneyRows = input.bookings.filter(dashboardBookingMoneyNeedsEvidence);
  const locationRows = input.bookings.filter(dashboardBookingLocationNeedsEvidence);
  const alertRows = input.bookings.filter(dashboardBookingAlertNeedsEvidence);
  const closeoutRows = input.bookings.filter(dashboardBookingCloseoutNeedsEvidence);
  const addressChecks = addressRows.length;
  const partnerChoiceChecks = partnerChoiceRows.length;
  const chatChecks = input.bookingDeepDive.matchedWithoutChat + input.bookingDeepDive.quietActiveChats;
  const moneyChecks =
    input.bookingDeepDive.releaseChecks +
    input.bookingDeepDive.captureChecks +
    input.bookingDeepDive.manualCloseout +
    input.cashSettlementSummary.rowCount;
  const locationChecks = locationRows.length;
  const alertChecks = input.failedNotificationCount + alertRows.length;
  const closeoutChecks = closeoutRows.length;

  const items: BookingEvidenceCommandQueueItem[] = [
    {
      lane: 'Address evidence',
      owner: 'Dispatch',
      status: evidenceStatus(addressChecks),
      value: `${addressChecks} check`,
      detail:
        addressChecks > 0
          ? 'Booking rows need a confirmed service address before Partner discovery and distance evidence are reliable.'
          : 'Every loaded booking has the confirmed service address needed for operations review.',
      href: '/bookings?view=all&evidence=address',
      tone: evidenceTone(addressChecks, 1, 3),
      checks: ['Confirmed service address', 'Service address pin', 'Address text'],
      operatorAction: addressChecks > 0 ? 'Open address evidence queue' : 'Keep address evidence watch',
      sample: bookingEvidenceSample(addressRows, 'Address sample'),
    },
    {
      lane: 'Partner choice evidence',
      owner: 'Dispatch',
      status: evidenceStatus(partnerChoiceChecks),
      value: `${partnerChoiceChecks} wait`,
      detail:
        partnerChoiceChecks > 0
          ? 'Open rows need a preferred Partner decision, marketplace participant, or customer final selection record.'
          : 'Partner choice rows are clear for the loaded operations set.',
      href: '/bookings?view=matching&evidence=partner',
      tone: evidenceTone(partnerChoiceChecks, 2, 6),
      checks: ['First-pick window', '10km marketplace', 'Customer final choice'],
      operatorAction:
        partnerChoiceChecks > 0 ? 'Check customer final-choice handoff' : 'Watch first-pick flow',
      sample: bookingEvidenceSample(partnerChoiceRows, 'Partner choice sample'),
    },
    {
      lane: 'Chat record evidence',
      owner: 'Support',
      status: evidenceStatus(chatChecks),
      value: `${chatChecks} room`,
      detail:
        chatChecks > 0
          ? 'Matched work should have chat available during service and retained after completion for admin review.'
          : 'Chat room and retained message checks are clear in the loaded booking set.',
      href: '/bookings?view=all&evidence=chat',
      tone: evidenceTone(chatChecks, 1, 4),
      checks: ['Room exists', 'Messages retained', 'Review ready'],
      operatorAction: chatChecks > 0 ? 'Open chat evidence queue' : 'Keep chat record monitor',
      sample: bookingEvidenceSample(chatRows, 'Chat sample'),
    },
    {
      lane: 'Payment and wallet evidence',
      owner: 'Finance',
      status: evidenceStatus(moneyChecks),
      value: `${moneyChecks} item`,
      detail:
        moneyChecks > 0
          ? 'Payment release, capture, cash fee, tax, earning, and wallet impact rows need finance visibility.'
          : 'Payment, cash fee, earning, and wallet evidence is clear in the loaded data.',
      href: '/bookings?view=all&evidence=money',
      tone: evidenceTone(moneyChecks, 1, 5),
      checks: ['Payment status', 'Cash fee', 'Wallet impact'],
      operatorAction: moneyChecks > 0 ? 'Open finance evidence queue' : 'Keep finance evidence monitor',
      sample: bookingEvidenceSample(moneyRows, 'Money sample'),
    },
    {
      lane: 'Location evidence',
      owner: 'Dispatch',
      status: evidenceStatus(locationChecks),
      value: `${locationChecks} pin`,
      detail:
        locationChecks > 0
          ? 'Active handoff rows need a fresh Partner location pin or an operator-visible reason it is missing.'
          : 'Active handoff rows have usable location evidence or do not require a live pin yet.',
      href: '/bookings?view=all&evidence=location',
      tone: evidenceTone(locationChecks, 1, 5),
      checks: ['Booking address', 'Partner pin', 'Freshness window'],
      operatorAction: locationChecks > 0 ? 'Open location evidence queue' : 'Keep location evidence monitor',
      sample: bookingEvidenceSample(locationRows, 'Location sample'),
    },
    {
      lane: 'Alert evidence',
      owner: 'Support',
      status: evidenceStatus(alertChecks),
      value: `${alertChecks} alert`,
      detail:
        alertChecks > 0
          ? 'Notification delivery and marketplace invite evidence need review so staff know who actually saw the request.'
          : 'Notification delivery evidence is clear in the loaded operations window.',
      href: '/bookings?view=all&evidence=alerts',
      tone: evidenceTone(alertChecks, 1, 4),
      checks: ['Delivery state', 'Retry status', 'Partner invite evidence'],
      operatorAction: alertChecks > 0 ? 'Open alert delivery queue' : 'Keep alert evidence monitor',
      sample: bookingEvidenceSample(alertRows, 'Alert sample'),
    },
    {
      lane: 'Closeout evidence',
      owner: 'Finance',
      status: evidenceStatus(closeoutChecks),
      value: `${closeoutChecks} close`,
      detail:
        closeoutChecks > 0
          ? 'Completed, cancelled, expired, refunded, and no-show rows need final evidence before finance or support closeout.'
          : 'Closeout evidence is clear for terminal booking rows.',
      href: '/bookings?view=all&evidence=closeout',
      tone: evidenceTone(closeoutChecks, 1, 5),
      checks: ['Final status', 'Chat evidence', 'Finance evidence'],
      operatorAction: closeoutChecks > 0 ? 'Open closeout evidence queue' : 'Keep closeout monitor',
      sample: bookingEvidenceSample(closeoutRows, 'Closeout sample'),
    },
  ];

  const toneWeight: Record<BookingEvidenceCommandQueueItem['tone'], number> = {
    danger: 4,
    warn: 3,
    info: 2,
    ok: 1,
  };
  return items.sort((left, right) => {
    const toneDelta = toneWeight[right.tone] - toneWeight[left.tone];
    if (toneDelta !== 0) return toneDelta;
    return Number.parseInt(right.value, 10) - Number.parseInt(left.value, 10);
  });
}

function bookingEvidenceSample(
  bookings: AdminBooking[],
  label: string,
): BookingEvidenceCommandQueueItem['sample'] {
  const booking = bookings.sort(bookingEvidencePrioritySort)[0];
  if (!booking) {
    return undefined;
  }
  return {
    label: `${label}: ${shortId(booking.id)}`,
    detail: (
      <>
        {booking.status} / {bookingServiceLabel(booking)} / opened{' '}
        <DateTimeText fallback="unknown" value={bookingRequestOpenedAt(booking)} />
      </>
    ),
    href: `/bookings/${booking.id}`,
  };
}

function bookingEvidencePrioritySort(left: AdminBooking, right: AdminBooking) {
  const leftRank = bookingEvidenceStatusRank(left.status);
  const rightRank = bookingEvidenceStatusRank(right.status);
  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }
  return (
    dashboardDateValue(bookingLatestActivityAt(right)) - dashboardDateValue(bookingLatestActivityAt(left))
  );
}

function bookingEvidenceStatusRank(status?: string | null) {
  if (status === 'OPEN_MATCHING') return 5;
  if (status === 'MATCHED') return 4;
  if (['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(status ?? '')) return 3;
  if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status ?? '')) return 2;
  if (status === 'COMPLETED') return 1;
  return 0;
}

function dashboardDateValue(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function dashboardBookingPartnerChoiceNeedsEvidence(booking: AdminBooking) {
  const acceptedCount = (booking.participants ?? []).filter((participant) =>
    ['ACCEPTED', 'SELECTED'].includes(participant.status),
  ).length;
  return bookingPartnerChoiceEvidenceNeedsOpsFromFacts({
    status: booking.status,
    hasSelectedProvider: Boolean(booking.selectedProvider),
    hasPreferredProvider: Boolean(booking.preferredProvider),
    acceptedOrSelectedParticipantCount: acceptedCount,
  });
}

function dashboardBookingLocationNeedsEvidence(booking: AdminBooking) {
  const partner = booking.selectedProvider ?? booking.preferredProvider;
  return bookingLocationNeedsOpsFromProvider({
    status: booking.status,
    provider: partner,
  });
}

function dashboardBookingChatNeedsEvidence(booking: AdminBooking) {
  return (
    (booking.status === 'MATCHED' && !booking.chatRoom) ||
    bookingChatQuietNeedsOps({
      status: booking.status,
      hasChatRoom: Boolean(booking.chatRoom),
      messageCount: booking.chatRoom?.messages?.length ?? 0,
    })
  );
}

function dashboardBookingMoneyNeedsEvidence(booking: AdminBooking) {
  return (
    completedCloseoutNeedsOps(booking) ||
    isNoShowSignal(booking) ||
    unresolvedReleasePayment(booking) ||
    (booking.payment?.status === 'AUTHORIZED' && booking.status === 'COMPLETED')
  );
}

function dashboardBookingAlertNeedsEvidence(booking: AdminBooking) {
  const alertTrace = bookingAlertTraceSummaryFromMetadata(booking.metadata);
  return bookingAlertEvidenceNeedsOpsFromFacts({
    status: booking.status,
    participantCount: booking.participants?.length ?? 0,
    totalNotified: alertTrace.totalNotified,
  });
}

function dashboardBookingCloseoutNeedsEvidence(booking: AdminBooking) {
  if (completedCloseoutNeedsOps(booking) || isNoShowSignal(booking)) {
    return true;
  }
  if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) {
    return unresolvedReleasePayment(booking) || !booking.chatRoom;
  }
  return booking.status === 'REFUNDED' && (booking.refunds?.length ?? 0) === 0;
}

function evidenceStatus(count: number) {
  return count > 0 ? 'Review' : 'Clear';
}

function evidenceTone(
  count: number,
  warnAt: number,
  dangerAt: number,
): BookingEvidenceCommandQueueItem['tone'] {
  if (count >= dangerAt) return 'danger';
  if (count >= warnAt) return 'warn';
  return 'ok';
}

function buildLiveOperationsRadar(input: {
  bookingOps: ReturnType<typeof buildBookingOpsInsights>;
  bookingDeepDive: ReturnType<typeof buildBookingOperationsDeepDive>;
  matchingControl: ReturnType<typeof buildMatchingControlRoom>;
  appPresence: ReturnType<typeof buildAppPresence>;
  partnerSupply: ReturnType<typeof buildPartnerSupplyInsights>;
  cashSettlementSummary: AdminCashSettlementSummary;
  failedNotifications: AdminNotification[];
  activePayoutBatches: AdminPayoutBatch[];
}): LiveOperationsRadarItem[] {
  const openMatchingFollowUp = input.matchingControl.openRows.filter(
    (row) => row.expired || row.freshEligibleCount === 0,
  ).length;
  const firstPickRows = input.matchingControl.openRows.filter((row) =>
    row.backupState.toLowerCase().includes('first-pick'),
  ).length;
  const marketplaceRows = input.matchingControl.openRows.filter((row) =>
    row.backupState.toLowerCase().includes('marketplace'),
  ).length;
  const noFreshSupplyRows = input.matchingControl.openRows.filter(
    (row) => row.freshEligibleCount === 0,
  ).length;
  const customerChoiceRows = input.matchingControl.openRows.filter((row) =>
    row.customerState.toLowerCase().includes('choose'),
  ).length;
  const chatHandoffRows = input.bookingDeepDive.matchedWithoutChat + input.bookingDeepDive.quietActiveChats;
  return [
    {
      lane: 'Customer wait lane',
      owner: 'Dispatch',
      title: 'Watch active customer wait first',
      value: `${input.bookingOps.openMatching} open`,
      status: openMatchingFollowUp ? 'Action' : input.bookingOps.openMatching ? 'Live' : 'Clear',
      detail: openMatchingFollowUp
        ? `${openMatchingFollowUp} matching row(s) have expired timers or no fresh nearby Partner.`
        : `${input.appPresence.liveOpenMatchingCustomers} customer(s) are in app while matching is open.`,
      href: openMatchingFollowUp ? '/bookings?view=attention' : '/bookings?view=matching',
      tone: openMatchingFollowUp ? 'danger' : input.bookingOps.openMatching ? 'warn' : 'ok',
      checks: [
        `${input.appPresence.liveOpenMatchingCustomers} live matching customer(s)`,
        `${input.bookingDeepDive.openWithoutParticipants} without Partner`,
        `${input.bookingDeepDive.expiredOpenMatching} expired window(s)`,
      ],
    },
    {
      lane: 'First-pick and 10km market',
      owner: 'Dispatch',
      title: 'Confirm preferred Partner and marketplace supply',
      value: `${firstPickRows} first / ${marketplaceRows} market`,
      status: noFreshSupplyRows ? 'Supply gap' : firstPickRows + marketplaceRows ? 'Monitoring' : 'Clear',
      detail:
        firstPickRows + marketplaceRows > 0
          ? 'Preferred Partner has the first window while 10km marketplace participants stay visible for customer choice.'
          : 'No active first-pick or marketplace lane is visible in the current booking sample.',
      href: noFreshSupplyRows
        ? '/bookings?view=no-supply'
        : firstPickRows
          ? '/bookings?view=first-pick'
          : '/bookings?view=marketplace',
      tone: noFreshSupplyRows ? 'danger' : firstPickRows + marketplaceRows ? 'info' : 'ok',
      checks: [
        `${noFreshSupplyRows} no fresh supply`,
        `${input.matchingControl.metrics.find((item) => item.label === 'Marketplace radius')?.value ?? '10 km'} radius`,
        `${input.matchingControl.metrics.find((item) => item.label === 'Marketplace invite cap')?.value ?? 'cap'} invite cap`,
      ],
    },
    {
      lane: 'Customer final choice lane',
      owner: 'Support',
      title: 'Keep final Partner choice with the customer',
      value: `${customerChoiceRows} ready`,
      status: customerChoiceRows ? 'Choose' : 'Waiting',
      detail:
        customerChoiceRows > 0
          ? 'Accepted Partners are visible; customer must pick the final Partner before the job is locked.'
          : 'No customer final-choice handoff is waiting in the open matching sample.',
      href: customerChoiceRows ? '/bookings?view=customer-choice' : '/bookings',
      tone: customerChoiceRows ? 'info' : 'ok',
      checks: [
        `${input.bookingDeepDive.customerFinalSelection} selection wait`,
        'No auto assignment',
        'No customer direct cancel after match',
      ],
    },
    {
      lane: 'Chat handoff lane',
      owner: 'Support',
      title: 'Verify matched bookings have retained chat',
      value: `${chatHandoffRows} check`,
      status: chatHandoffRows ? 'Review' : 'Clear',
      detail:
        chatHandoffRows > 0
          ? 'Matched bookings must have chat available for mobile during work and archived for admin after completion.'
          : 'No missing or quiet active chat row is visible in the loaded booking set.',
      href: chatHandoffRows ? '/bookings?view=chat-repair' : '/chat-archive',
      tone: chatHandoffRows ? 'warn' : 'ok',
      checks: [
        `${input.bookingDeepDive.matchedWithoutChat} missing room`,
        `${input.bookingDeepDive.quietActiveChats} quiet room`,
        'Admin archive retained',
      ],
    },
    {
      lane: 'Cash settlement lane',
      owner: 'Finance',
      title: 'Separate list visibility from finalization gates',
      value: `${input.cashSettlementSummary.providerCount} Partner(s)`,
      status: input.cashSettlementSummary.providerCount ? 'Gate' : 'Clear',
      detail:
        input.cashSettlementSummary.providerCount > 0
          ? 'Negative wallet Partners can see marketplace requests while final acceptance, service start, and payout release wait for cash fee settlement.'
          : 'No cash fee debt is currently blocking final acceptance, service start, or payout release.',
      href: '/cash-settlements',
      tone: input.cashSettlementSummary.providerCount ? 'danger' : 'ok',
      checks: [
        money(input.cashSettlementSummary.totalDebtAmount, 'VND'),
        `${input.cashSettlementSummary.rowCount} debt row(s)`,
        'Weekly/monthly/admin batch payout',
      ],
    },
    {
      lane: 'Partner supply lane',
      owner: 'Partner Ops',
      title: 'Check online Partners and last-location freshness',
      value: `${input.partnerSupply.onlineAvailable}/${input.partnerSupply.online} online`,
      status: input.partnerSupply.onlineAvailable ? 'Available' : 'Low supply',
      detail:
        input.partnerSupply.onlineAvailable > 0
          ? `${input.partnerSupply.staleLocation} Partner location pin(s) are older than the freshness window.`
          : 'No online available Partner is visible; check app activity, location update, and onboarding review.',
      href: input.partnerSupply.staleLocation > 0 ? '/partners?review=location' : '/partners',
      tone: input.partnerSupply.onlineAvailable
        ? input.partnerSupply.staleLocation
          ? 'warn'
          : 'ok'
        : 'warn',
      checks: [
        `${input.partnerSupply.liveSessions} recent app activity`,
        `${input.partnerSupply.noLocation} missing pin`,
        `${input.partnerSupply.pendingVerification} KYC waiting`,
      ],
    },
    {
      lane: 'Alert and payout lane',
      owner: input.failedNotifications.length ? 'Support' : 'Finance',
      title: 'Close failed delivery and payout batch loops',
      value: `${input.failedNotifications.length} alert / ${input.activePayoutBatches.length} payout`,
      status: input.failedNotifications.length
        ? 'Retry'
        : input.activePayoutBatches.length
          ? 'Batch'
          : 'Clear',
      detail:
        input.failedNotifications.length > 0
          ? 'Failed notification rows should be retried or marked so operators know whether push actually arrived.'
          : 'Notification delivery is clear; payout batches remain visible by weekly, monthly, or admin-selected run.',
      href: input.failedNotifications.length ? '/notifications?review=failed' : '/payouts',
      tone: input.failedNotifications.length ? 'warn' : input.activePayoutBatches.length ? 'info' : 'ok',
      checks: [
        `${input.activePayoutBatches.length} active payout batch(es)`,
        'Deferred FCM push tracked',
        'Finance audit retained',
      ],
    },
  ];
}

function timeUntilLabel(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  if (minutes < 0) {
    return `${Math.abs(minutes)}m overdue`;
  }
  if (minutes < 60) {
    return `${minutes}m left`;
  }
  return `${Math.round(minutes / 60)}h left`;
}

function formatDistance(meters: number) {
  return formatDistanceMeters(meters);
}

function buildBookingOpsInsights(bookings: AdminBooking[]) {
  const expired = bookings.filter((booking) => booking.status === 'EXPIRED');
  const noShowFormal = bookings.filter((booking) => booking.status === 'NO_SHOW');
  const completedCloseoutChecks = bookings.filter(completedCloseoutNeedsOps);

  return {
    total: bookings.length,
    openMatching: bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length,
    active: bookings.filter((booking) => activeBookingStatuses.has(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    cancelled: bookings.filter((booking) => booking.status === 'CANCELLED').length,
    expired: expired.length,
    refunded: bookings.filter((booking) => booking.status === 'REFUNDED').length,
    noShowFormal: noShowFormal.length,
    noShowSignal: bookings.filter(isNoShowSignal).length,
    completedCloseoutChecks: completedCloseoutChecks.length,
  };
}

function buildBookingOperationsDeepDive(bookings: AdminBooking[], payments: AdminPayment[]) {
  const activeOrMatching = bookings.filter(
    (booking) => activeBookingStatuses.has(booking.status) || booking.status === 'OPEN_MATCHING',
  );
  const participantCount = activeOrMatching.reduce(
    (sum, booking) => sum + (booking.participants?.length ?? 0),
    0,
  );
  const expiredOpenMatching = bookings.filter(
    (booking) =>
      booking.status === 'OPEN_MATCHING' &&
      Boolean(booking.expiresAt) &&
      Date.parse(booking.expiresAt ?? '') < Date.now(),
  ).length;
  const openWithoutParticipants = bookings.filter(
    (booking) => booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0,
  ).length;
  const matchedWithoutChat = bookings.filter(
    (booking) => booking.status === 'MATCHED' && !booking.chatRoom,
  ).length;
  const customerFinalSelection = bookings.filter(
    (booking) =>
      booking.status === 'OPEN_MATCHING' &&
      !booking.selectedProvider &&
      (booking.participants ?? []).some(
        (participant) => participant.status === 'ACCEPTED' || participant.status === 'SELECTED',
      ),
  ).length;
  const quietActiveChats = bookings.filter((booking) =>
    bookingChatQuietNeedsOps({
      status: booking.status,
      hasChatRoom: Boolean(booking.chatRoom),
      messageCount: booking.chatRoom?.messages?.length ?? 0,
    }),
  ).length;
  const releaseChecks = bookings.filter(
    (booking) =>
      ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status) && unresolvedReleasePayment(booking),
  ).length;
  const captureChecks = payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED',
  ).length;
  const manualCloseout = bookings.filter(
    (booking) => completedCloseoutNeedsOps(booking) || isNoShowSignal(booking),
  ).length;

  return {
    matchingEscalations:
      expiredOpenMatching + openWithoutParticipants + matchedWithoutChat + customerFinalSelection,
    expiredOpenMatching,
    openWithoutParticipants,
    matchedWithoutChat,
    customerFinalSelection,
    quietActiveChats,
    releaseChecks,
    captureChecks,
    averageParticipants: activeOrMatching.length
      ? (participantCount / activeOrMatching.length).toFixed(1)
      : '0.0',
    manualCloseout,
    serviceDemand: buildServiceDemandMix(bookings),
    paymentMix: buildPaymentMethodMix(payments),
  };
}

function buildServiceDemandMix(bookings: AdminBooking[]) {
  const buckets = new Map<
    string,
    {
      label: string;
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      amount: number;
      averagePrice: number;
    }
  >();

  for (const booking of bookings) {
    for (const bookingService of booking.services ?? []) {
      const service = bookingService.service;
      const label = `${service?.name ?? 'Unknown service'} / ${service?.durationMin ?? '?'} min`;
      const quantity = bookingService.quantity ?? 1;
      const price = bookingService.price ?? service?.basePrice ?? 0;
      const bucket = buckets.get(label) ?? {
        label,
        total: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        amount: 0,
        averagePrice: 0,
      };

      bucket.total += quantity;
      bucket.amount += price * quantity;
      if (activeBookingStatuses.has(booking.status)) bucket.active += quantity;
      if (booking.status === 'COMPLETED') bucket.completed += quantity;
      if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) bucket.cancelled += quantity;
      bucket.averagePrice = bucket.total ? Math.round(bucket.amount / bucket.total) : 0;
      buckets.set(label, bucket);
    }
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || right.amount - left.amount)
    .slice(0, 6);
}

function buildPaymentMethodMix(payments: AdminPayment[]) {
  const buckets = new Map<
    string,
    {
      method: string;
      count: number;
      amount: number;
      currency: string;
      authorized: number;
      pending: number;
      captured: number;
      released: number;
      refunded: number;
      checkCount: number;
    }
  >();

  for (const payment of payments) {
    const method = payment.method ?? 'UNKNOWN';
    const bucket = buckets.get(method) ?? {
      method,
      count: 0,
      amount: 0,
      currency: payment.currency ?? 'VND',
      authorized: 0,
      pending: 0,
      captured: 0,
      released: 0,
      refunded: 0,
      checkCount: 0,
    };
    bucket.count += 1;
    bucket.amount += payment.amount ?? 0;
    if (payment.status === 'AUTHORIZED') bucket.authorized += 1;
    if (payment.status === 'PENDING') bucket.pending += 1;
    if (payment.status === 'CAPTURED') bucket.captured += 1;
    if (payment.status === 'RELEASED') bucket.released += 1;
    if (payment.status === 'REFUNDED') bucket.refunded += 1;
    if (
      (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') ||
      (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(payment.booking?.status ?? '') &&
        !['RELEASED', 'REFUNDED'].includes(payment.status))
    ) {
      bucket.checkCount += 1;
    }
    buckets.set(method, bucket);
  }

  return [...buckets.values()].sort((left, right) => right.count - left.count || right.amount - left.amount);
}

function buildAppPresence(users: AdminUser[], bookings: AdminBooking[], sessions: AdminAppSession[]) {
  const customers = users.filter((user) => Boolean(user.customerProfile));
  const customerSessions = sessions.filter((session) => session.role === 'CUSTOMER');
  const partnerSessions = sessions.filter((session) => session.role === 'PROVIDER');
  const liveCustomerUserIds = new Set(
    customerSessions
      .filter((session) => appSessionState(session) === 'live')
      .map((session) => session.userId),
  );
  const livePartnerUserIds = new Set(
    partnerSessions.filter((session) => appSessionState(session) === 'live').map((session) => session.userId),
  );
  const recentCustomerSessions = customerSessions.filter(
    (session) => appSessionState(session) === 'recent',
  ).length;
  const staleCustomerSessions = customerSessions.filter(
    (session) => appSessionState(session) === 'stale',
  ).length;
  const reachableCustomers = customers.filter((user) =>
    (user.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const disabledPushCustomers = customers.filter(
    (user) =>
      (user.pushDevices ?? []).length > 0 && !(user.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const liveCustomerPhones = new Set(
    customers
      .filter((user) => liveCustomerUserIds.has(user.id))
      .map((user) => user.phone)
      .filter(Boolean),
  );
  const activeBookingCustomerPhones = new Set(
    bookings
      .filter((booking) => activeBookingStatuses.has(booking.status))
      .map((booking) => booking.customerProfile?.user?.phone)
      .filter(isNonEmptyString),
  );
  const openMatchingCustomerPhones = new Set(
    bookings
      .filter((booking) => booking.status === 'OPEN_MATCHING')
      .map((booking) => booking.customerProfile?.user?.phone)
      .filter(isNonEmptyString),
  );
  const liveActiveBookingCustomers = countSetIntersection(liveCustomerPhones, activeBookingCustomerPhones);
  const liveOpenMatchingCustomers = countSetIntersection(liveCustomerPhones, openMatchingCustomerPhones);

  return {
    totalCustomers: customers.length,
    liveAppCustomers: liveCustomerUserIds.size,
    liveAppPartners: livePartnerUserIds.size,
    recentCustomerSessions,
    staleCustomerSessions,
    reachableCustomers,
    disabledPushCustomers,
    activeBookingCustomers: activeBookingCustomerPhones.size,
    liveActiveBookingCustomers,
    liveOpenMatchingCustomers,
  };
}

function countSetIntersection(left: Set<string>, right: Set<string>) {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) count += 1;
  });
  return count;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}

function buildPartnerSupplyInsights(
  providers: AdminProvider[],
  bookings: AdminBooking[],
  sessions: AdminAppSession[],
  cashDebtRows: AdminEarning[],
  cashSettlementSummary: AdminCashSettlementSummary,
) {
  const now = Date.now();
  const partnerSessions = sessions.filter((session) => session.role === 'PROVIDER');
  const livePartnerUserIds = new Set(
    partnerSessions.filter((session) => appSessionState(session) === 'live').map((session) => session.userId),
  );
  const cashDebtPartnerIds = new Set(cashDebtRows.map((earning) => earning.providerProfileId));
  const activeDemand = bookings.filter((booking) => activeBookingStatuses.has(booking.status)).length;
  const onlineAvailable = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const firstRevenuePartners = providers.filter(providerHasFirstRevenue);

  const staleLocation = providers.filter((provider) => {
    if (!provider.currentLocationUpdatedAt) {
      return false;
    }
    const updatedAt = Date.parse(provider.currentLocationUpdatedAt);
    return Number.isFinite(updatedAt) && now - updatedAt > 30 * 60_000;
  }).length;

  const noLocation = providers.filter(
    (provider) =>
      provider.currentLat === null ||
      provider.currentLat === undefined ||
      provider.currentLng === null ||
      provider.currentLng === undefined,
  ).length;

  return {
    total: providers.length,
    online: providers.filter((provider) => provider.status.startsWith('ONLINE')).length,
    onlineAvailable,
    onlineBusy: providers.filter((provider) => provider.status === 'ONLINE_BUSY').length,
    onlineAvailableSoon: providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE_SOON').length,
    offline: providers.filter((provider) => provider.status === 'OFFLINE').length,
    liveSessions: livePartnerUserIds.size,
    staleLocation,
    noLocation,
    cashDebtPartners: cashSettlementSummary.providerCount,
    pendingVerification: providers.filter((provider) => provider.verification?.status === 'SUBMITTED').length,
    approvedVerification: providers.filter((provider) => provider.verification?.status === 'APPROVED').length,
    kycApproved: providers.filter((provider) => provider.kyc?.status === 'APPROVED').length,
    bankApproved: providers.filter((provider) =>
      (provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED'),
    ).length,
    firstRevenue: firstRevenuePartners.length,
    withdrawalProfileReady: firstRevenuePartners.filter((provider) =>
      Boolean(provider.residentialAddress?.trim()),
    ).length,
    level2Active: providers.filter(
      (provider) => provider.kyc?.status === 'APPROVED' && provider.verification?.status === 'APPROVED',
    ).length,
    blocked: providers.filter((provider) => {
      const activeSanction = (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE');
      return Boolean(provider.blockedAt) || activeSanction || cashDebtPartnerIds.has(provider.id);
    }).length,
    supplyPressureLabel:
      onlineAvailable > 0 ? `${(activeDemand / onlineAvailable).toFixed(1)}x` : 'No supply',
  };
}

function buildPartnerOpsQueue(
  providers: AdminProvider[],
  cashDebtRows: AdminEarning[],
  sessions: AdminAppSession[],
) {
  const cashDebtByPartner = new Map<string, number>();
  for (const earning of cashDebtRows) {
    cashDebtByPartner.set(
      earning.providerProfileId,
      (cashDebtByPartner.get(earning.providerProfileId) ?? 0) + Math.abs(earning.netAmount),
    );
  }

  const livePartnerUserIds = new Set(
    sessions
      .filter((session) => session.role === 'PROVIDER' && appSessionState(session) === 'live')
      .map((session) => session.userId),
  );

  const items = providers
    .map((partner) => buildPartnerOpsQueueItem(partner, cashDebtByPartner, livePartnerUserIds))
    .filter((item): item is PartnerOpsQueueItem => Boolean(item))
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
    .slice(0, 8);

  return {
    items,
    blockedNow: providers.filter((partner) => {
      const hasCashDebt = (cashDebtByPartner.get(partner.id) ?? 0) > 0;
      const hasActiveSanction = (partner.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE');
      return hasCashDebt || Boolean(partner.blockedAt) || hasActiveSanction;
    }).length,
    payoutSetup: providers.filter((partner) => partnerNeedsFirstRevenueSetup(partner)).length,
    locationIssue: providers.filter((partner) => partnerLocationState(partner) !== 'recent').length,
    contactIssue: providers.filter((partner) => partnerContactState(partner, livePartnerUserIds) !== 'ready')
      .length,
  };
}

function buildDashboardAcceptanceUnblockQuickOrder(input: {
  providers: AdminProvider[];
  cashSettlementSummary: AdminCashSettlementSummary;
  partnerOpsQueue: ReturnType<typeof buildPartnerOpsQueue>;
}): DashboardAcceptanceUnblockStep[] {
  const activeAccountControls = input.providers.filter((partner) => {
    const hasActiveSanction = (partner.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE');
    return Boolean(partner.blockedAt) || hasActiveSanction;
  }).length;
  const verificationBlockers = input.providers.filter((partner) => {
    const verificationReady =
      partner.verification?.status === 'APPROVED' || partner.kyc?.status === 'APPROVED';
    return !verificationReady;
  }).length;
  const withdrawalSetupGate = input.partnerOpsQueue.payoutSetup;

  return [
    dashboardAcceptanceStep({
      id: 'dashboard-acceptance-cash-debt',
      step: '1',
      owner: 'Finance',
      title: 'Clear cash fee debt',
      detail:
        'Negative wallet Partners can view marketplace requests, but final acceptance, service start, and payout release are blocked until settlement.',
      metricLabel: 'Debt Partners',
      metricValue: input.cashSettlementSummary.providerCount.toString(),
      action: 'Open cash settlements',
      href: '/cash-settlements',
      blockerCount: input.cashSettlementSummary.providerCount,
    }),
    dashboardAcceptanceStep({
      id: 'dashboard-acceptance-account-control',
      step: '2',
      owner: 'Account ops',
      title: 'Resolve account controls',
      detail: 'Blocked accounts and active account controls stay above booking convenience.',
      metricLabel: 'Account blocks',
      metricValue: activeAccountControls.toString(),
      action: 'Open Partner controls',
      href: '/partner-controls?sanction=ACTIVE',
      blockerCount: activeAccountControls,
    }),
    dashboardAcceptanceStep({
      id: 'dashboard-acceptance-kyc-bank',
      step: '3',
      owner: 'KYC',
      title: 'Approve Level 2 activity',
      detail:
        'KYC, required documents, partner verification, and service-ready profile are the Level 2 work gate for paid bookings.',
      metricLabel: 'Needs review',
      metricValue: verificationBlockers.toString(),
      action: 'Open Partner review',
      href: '/partners?review=acceptance-blocked',
      blockerCount: verificationBlockers,
    }),
    dashboardAcceptanceStep({
      id: 'dashboard-acceptance-location',
      step: '4',
      owner: 'Dispatch',
      title: 'Refresh Partner location',
      detail: 'Marketplace supply quality depends on recent app-open location updates.',
      metricLabel: 'Location gaps',
      metricValue: input.partnerOpsQueue.locationIssue.toString(),
      action: 'Open location queue',
      href: '/partners?review=location',
      blockerCount: input.partnerOpsQueue.locationIssue,
      warnOnly: true,
    }),
    dashboardAcceptanceStep({
      id: 'dashboard-acceptance-contact',
      step: '5',
      owner: 'Ops',
      title: 'Confirm app contactability',
      detail: 'Recent app activity and enabled device state reduce missed 10 minute reply windows.',
      metricLabel: 'Contact gaps',
      metricValue: input.partnerOpsQueue.contactIssue.toString(),
      action: 'Open Partner review',
      href: '/partners?review=contactability',
      blockerCount: input.partnerOpsQueue.contactIssue,
      warnOnly: true,
    }),
    dashboardAcceptanceStep({
      id: 'dashboard-acceptance-tax-payout',
      step: '6',
      owner: 'Finance',
      title: 'Review withdrawal profile after first earning',
      detail:
        'Bank, address, and payout agreement review happens after revenue exists or when withdrawal is requested.',
      metricLabel: 'Payout gates',
      metricValue: withdrawalSetupGate.toString(),
      action: 'Open payout profile',
      href: '/partners?review=payout-setup',
      blockerCount: withdrawalSetupGate,
      warnOnly: true,
    }),
  ];
}

function dashboardAcceptanceStep(input: {
  id: string;
  step: string;
  owner: DashboardAcceptanceUnblockStep['owner'];
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  action: string;
  href: string;
  blockerCount: number;
  warnOnly?: boolean;
}): DashboardAcceptanceUnblockStep {
  const hasBlocker = input.blockerCount > 0;
  const tone = hasBlocker ? (input.warnOnly ? 'warn' : 'danger') : 'ok';
  return {
    id: input.id,
    step: input.step,
    owner: input.owner,
    title: input.title,
    detail: input.detail,
    metricLabel: input.metricLabel,
    metricValue: input.metricValue,
    action: input.action,
    href: input.href,
    className: hasBlocker ? (input.warnOnly ? 'ops-task-pending' : 'ops-task-blocked') : 'ops-task-done',
    pillClass: hasBlocker ? (input.warnOnly ? 'pill-warn' : 'pill-danger') : 'pill-success',
    tone,
  };
}

function buildPartnerOpsQueueItem(
  partner: AdminProvider,
  cashDebtByPartner: Map<string, number>,
  livePartnerUserIds: Set<string | undefined>,
): PartnerOpsQueueItem | null {
  const cashDebt = cashDebtByPartner.get(partner.id) ?? 0;
  const activeSanctions = (partner.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const locationState = partnerLocationState(partner);
  const contactState = partnerContactState(partner, livePartnerUserIds);
  const name = partnerDisplayName(partner);
  const href = `/partners/${partner.id}`;
  const metrics = [
    partnerOpsMetric('status', partner.status.replace('ONLINE_', '').toLowerCase(), 'info'),
    partnerOpsMetric('location', locationState, locationState === 'recent' ? 'ok' : 'warn'),
    partnerOpsMetric('contact', contactState, contactState === 'ready' ? 'ok' : 'warn'),
  ];

  if (cashDebt > 0) {
    return {
      id: `${partner.id}-cash-debt`,
      name,
      status: 'Cash debt block',
      detail:
        'Partner wallet is negative from cash fee/tax debt. Final acceptance, service start, and payout release wait until finance records a deposit or offset.',
      action: 'Open Partner finance',
      href,
      className: 'ops-task-blocked',
      priority: 110,
      metrics: [partnerOpsMetric('debt', money(cashDebt), 'danger'), ...metrics],
    };
  }

  if (partner.blockedAt || activeSanctions.length > 0) {
    return {
      id: `${partner.id}-account-control`,
      name,
      status: partner.blockedAt ? 'Account blocked' : 'Active control',
      detail: partner.blockedReason
        ? `Account control is active: ${partner.blockedReason}`
        : 'Account control is active. Review reports, controls, and payout holds before dispatch.',
      action: 'Open account review',
      href: `/partner-controls?q=${encodeURIComponent(partner.id)}`,
      className: 'ops-task-blocked',
      priority: 105,
      metrics: [partnerOpsMetric('controls', activeSanctions.length.toString(), 'danger'), ...metrics],
    };
  }

  if (partnerNeedsFirstRevenueSetup(partner)) {
    return {
      id: `${partner.id}-first-revenue-setup`,
      name,
      status: 'First revenue review',
      detail:
        'Partner has earned money. Review residential address and payout agreement before payout release.',
      action: 'Open payout profile',
      href,
      className: 'ops-task-pending',
      priority: 85,
      metrics: [
        partnerOpsMetric(
          'agreements',
          `${partner.agreements?.length ?? 0}/5`,
          (partner.agreements?.length ?? 0) >= 5 ? 'ok' : 'warn',
        ),
        ...metrics,
      ],
    };
  }

  if (partner.verification?.status === 'SUBMITTED' || partner.kyc?.status === 'PENDING') {
    return {
      id: `${partner.id}-verification`,
      name,
      status: 'Verification review',
      detail:
        'Partner is waiting for admin review. Clear KYC, required documents, and verification to expand supply.',
      action: 'Open review',
      href: '/partners?verification=SUBMITTED',
      className: 'ops-task-pending',
      priority: 70,
      metrics: [
        partnerOpsMetric('verification', partner.verification?.status ?? 'missing', 'warn'),
        partnerOpsMetric(
          'kyc',
          partner.kyc?.status ?? 'missing',
          partner.kyc?.status === 'APPROVED' ? 'ok' : 'warn',
        ),
        ...metrics,
      ],
    };
  }

  if (locationState !== 'recent' && partner.status.startsWith('ONLINE')) {
    return {
      id: `${partner.id}-location`,
      name,
      status: 'Location weak',
      detail: 'Partner is online but location is stale, expired, or missing. Dispatch distance may be wrong.',
      action: 'Open location review',
      href: '/partners?review=location',
      className: 'ops-task-pending',
      priority: 55,
      metrics,
    };
  }

  if (contactState !== 'ready' && partner.status.startsWith('ONLINE')) {
    return {
      id: `${partner.id}-contact`,
      name,
      status: 'Contact weak',
      detail:
        'Partner appears online but app activity or push contactability is weak. Booking alerts may not arrive.',
      action: 'Open push/session review',
      href: '/partners?review=push',
      className: 'ops-task-pending',
      priority: 45,
      metrics,
    };
  }

  return null;
}

function partnerNeedsFirstRevenueSetup(partner: AdminProvider) {
  if (!providerHasFirstRevenue(partner)) {
    return false;
  }
  const hasAddress = Boolean(partner.residentialAddress?.trim());
  const hasAgreements = (partner.agreements?.length ?? 0) >= 5;
  return !hasAddress || !hasAgreements;
}

function partnerLocationState(partner: AdminProvider) {
  const hasCoordinate =
    Number.isFinite(Number(partner.currentLat)) && Number.isFinite(Number(partner.currentLng));
  if (!hasCoordinate || !partner.currentLocationUpdatedAt) {
    return 'missing';
  }
  const updatedAt = Date.parse(partner.currentLocationUpdatedAt);
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }
  const ageMs = Date.now() - updatedAt;
  if (ageMs <= 30 * 60_000) {
    return 'recent';
  }
  if (ageMs <= 24 * 60 * 60_000) {
    return 'stale';
  }
  return 'expired';
}

function partnerContactState(partner: AdminProvider, livePartnerUserIds: Set<string | undefined>) {
  const hasLiveSession = partner.user?.id ? livePartnerUserIds.has(partner.user.id) : false;
  const hasEnabledPush = (partner.user?.pushDevices ?? []).some((device) => device.enabled);
  if (hasLiveSession && hasEnabledPush) {
    return 'ready';
  }
  if (hasLiveSession) {
    return 'push missing';
  }
  if (hasEnabledPush) {
    return 'not live';
  }
  return 'not contactable';
}

function partnerOpsMetric(
  label: string,
  value: string,
  tone: PartnerOpsQueueItem['metrics'][number]['tone'],
) {
  return { label, value, tone };
}

function partnerDisplayName(partner: AdminProvider) {
  return (
    partner.displayName ||
    partner.activityNickname ||
    partner.user?.fullName ||
    partner.user?.phone ||
    partner.id
  );
}

function providerHasFirstRevenue(provider: AdminProvider) {
  return (provider.earnings ?? []).some((earning) =>
    ['AVAILABLE', 'PENDING', 'PAID', 'HELD'].includes(earning.status),
  );
}

function appSessionState(session: AdminAppSession) {
  if (session.active && session.expiresAt && Date.parse(session.expiresAt) >= Date.now()) {
    return 'live';
  }

  const lastSeen = Date.parse(session.lastSeenAt);
  if (!Number.isFinite(lastSeen)) {
    return 'expired';
  }

  const ageMs = Date.now() - lastSeen;
  if (ageMs <= 30 * 60_000) {
    return 'recent';
  }
  if (ageMs <= 24 * 60 * 60_000) {
    return 'stale';
  }
  return 'expired';
}

function buildHourlyBookingDemand(bookings: AdminBooking[]) {
  const hourFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const buckets = new Map<
    string,
    { hour: string; total: number; active: number; completed: number; cancelled: number }
  >();

  for (const booking of bookings) {
    const timestamp = bookingRecordCreatedAt(booking);
    if (!timestamp) continue;
    const hour = `${hourFormatter.format(new Date(timestamp))}:00`;
    const bucket = buckets.get(hour) ?? { hour, total: 0, active: 0, completed: 0, cancelled: 0 };
    bucket.total += 1;
    if (activeBookingStatuses.has(booking.status)) bucket.active += 1;
    if (booking.status === 'COMPLETED') bucket.completed += 1;
    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') bucket.cancelled += 1;
    buckets.set(hour, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || left.hour.localeCompare(right.hour))
    .slice(0, 8);
}

function buildRegionalBookingDemand(bookings: AdminBooking[]) {
  const buckets = new Map<
    string,
    {
      region: string;
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      noShowSignal: number;
    }
  >();

  for (const booking of bookings) {
    const region = bookingRegionLabel(booking);
    const bucket = buckets.get(region) ?? {
      region,
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      noShowSignal: 0,
    };
    bucket.total += 1;
    if (activeBookingStatuses.has(booking.status)) bucket.active += 1;
    if (booking.status === 'COMPLETED') bucket.completed += 1;
    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') bucket.cancelled += 1;
    if (isNoShowSignal(booking)) bucket.noShowSignal += 1;
    buckets.set(region, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || left.region.localeCompare(right.region))
    .slice(0, 8);
}

function isNoShowSignal(booking: AdminBooking) {
  if (booking.status === 'NO_SHOW') {
    return true;
  }
  if (booking.status === 'EXPIRED') {
    return true;
  }
  const requestedAtValue = bookingRequestOpenedAt(booking);
  if (booking.status !== 'MATCHED' || !requestedAtValue) {
    return false;
  }
  const requestedAt = Date.parse(requestedAtValue);
  return Number.isFinite(requestedAt) && requestedAt + 30 * 60_000 < Date.now() && !booking.chatRoom;
}

function bookingRegionLabel(booking: AdminBooking) {
  const address = readAddressText(booking.address);
  if (!address) {
    if (Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng))) {
      return 'Pinned location';
    }
    return 'Unknown region';
  }

  const normalized = address.replace(/\s+/g, ' ').trim();
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const knownCity = parts.find((part) =>
    /ho chi minh|hcmc|saigon|sai gon|da nang|ha noi|hanoi|nha trang|da lat|dalat|can tho/i.test(part),
  );
  return knownCity ?? parts.at(-2) ?? parts.at(-1) ?? 'Unknown region';
}

function readAddressText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const direct =
      objectValue.addressText ??
      objectValue.address_text ??
      objectValue.formatted ??
      objectValue.formattedAddress ??
      objectValue.label;
    return typeof direct === 'string' ? direct : null;
  }
  return null;
}

type DashboardCommandSignal = {
  title: string;
  status: string;
  detail: string;
  action: string;
  href: string;
  className: string;
  pillClass: string;
  priority: number;
  severity: 'high' | 'medium' | 'low';
  breakdown: Array<{
    label: string;
    value: string;
    tone: 'ok' | 'info' | 'warn' | 'danger';
    href?: string;
  }>;
};

function buildDashboardCommandSignals(input: {
  providers: AdminProvider[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
  refundSummary: AdminRefundSummary;
  notifications: AdminNotification[];
  earnings: AdminEarningSummary;
  earningRows: AdminEarning[];
  cashSettlementSummary: AdminCashSettlementSummary;
  payoutBatches: AdminPayoutBatch[];
}): DashboardCommandSignal[] {
  const openMatching = input.bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const staleOpenMatching = openMatching.filter((booking) =>
    booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false,
  );
  const quietChatRooms = input.bookings.filter((booking) =>
    bookingChatQuietNeedsOps({
      status: booking.status,
      hasChatRoom: Boolean(booking.chatRoom),
      messageCount: booking.chatRoom?.messages?.length ?? 0,
    }),
  );
  const matchedWithoutChat = input.bookings.filter(
    (booking) => booking.status === 'MATCHED' && !booking.chatRoom,
  );
  const formalExpired = input.bookings.filter((booking) => booking.status === 'EXPIRED');
  const formalNoShow = input.bookings.filter((booking) => booking.status === 'NO_SHOW');
  const expiredPaymentChecks = formalExpired.filter((booking) => unresolvedReleasePayment(booking));
  const noShowPaymentChecks = formalNoShow.filter((booking) => unresolvedReleasePayment(booking));
  const completedCloseoutChecks = input.bookings.filter(completedCloseoutNeedsOps);
  const submittedVerification = input.providers.filter(
    (provider) => provider.verification?.status === 'SUBMITTED',
  );
  const submittedKyc = input.providers.filter((provider) => provider.kyc?.status === 'SUBMITTED');
  const openProviderReports = input.providers.filter((provider) =>
    (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)),
  );
  const activeProviderSanctions = input.providers.filter((provider) =>
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE'),
  );
  const providerReviews = input.providers.filter(
    (provider) =>
      provider.verification?.status === 'SUBMITTED' ||
      provider.kyc?.status === 'SUBMITTED' ||
      (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)) ||
      (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE'),
  );
  const completedAuthorized = input.payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED',
  );
  const missingGatewayRef = input.payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && !payment.providerRef,
  );
  const cashPending = input.payments.filter(
    (payment) => payment.method === 'CASH' && payment.status === 'PENDING',
  );
  const cashDebtRowCount = input.cashSettlementSummary.rowCount;
  const cashDebtProviderCount = input.cashSettlementSummary.providerCount;
  const cashDebtAmount = input.cashSettlementSummary.totalDebtAmount;
  const openRefundCount = input.refundSummary.openCount;
  const paymentReviews =
    completedCloseoutChecks.length +
    expiredPaymentChecks.length +
    noShowPaymentChecks.length +
    missingGatewayRef.length +
    cashPending.length +
    openRefundCount;
  const payoutHolds = input.payoutBatches.filter((batch) => Boolean(activePayoutHold(batch)));
  const payoutReviews = input.payoutBatches.filter((batch) =>
    ['DRAFT', 'FAILED', 'PROCESSING'].includes(batch.status),
  );
  const failedPayouts = input.payoutBatches.filter((batch) => batch.status === 'FAILED');
  const processingPayouts = input.payoutBatches.filter((batch) => batch.status === 'PROCESSING');
  const disabledPushProviders = input.providers.filter(
    (provider) => (provider.user?.pushDevices ?? []).filter((device) => device.enabled === false).length > 0,
  );
  const failedNotifications = input.notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const setupBlocked = input.earnings.availableNetAmount > 0 && payoutReviews.length === 0;

  const signals: DashboardCommandSignal[] = [
    {
      title: 'Dispatch lane',
      status: staleOpenMatching.length
        ? `${staleOpenMatching.length} EXPIRED`
        : `${openMatching.length} OPEN`,
      detail: staleOpenMatching.length
        ? 'Some open matching windows are expired and need operator review.'
        : 'Monitor open matching, quiet chat rooms, and customer final-choice handoff.',
      action: 'Open booking monitor',
      href: staleOpenMatching.length || matchedWithoutChat.length ? '/bookings?view=attention' : '/bookings',
      priority: staleOpenMatching.length || matchedWithoutChat.length ? 95 : openMatching.length ? 70 : 25,
      severity:
        staleOpenMatching.length || matchedWithoutChat.length
          ? 'high'
          : openMatching.length
            ? 'medium'
            : 'low',
      className: staleOpenMatching.length
        ? 'ops-task-blocked'
        : openMatching.length
          ? 'ops-task-pending'
          : 'ops-task-done',
      pillClass: staleOpenMatching.length
        ? 'pill-danger'
        : openMatching.length
          ? 'pill-warn'
          : 'pill-success',
      breakdown: [
        {
          label: 'Open matching',
          value: openMatching.length.toString(),
          tone: openMatching.length ? 'warn' : 'ok',
          href: '/bookings?view=active',
        },
        {
          label: 'Expired windows',
          value: staleOpenMatching.length.toString(),
          tone: staleOpenMatching.length ? 'danger' : 'ok',
          href: '/bookings?view=attention',
        },
        {
          label: 'Formal expired',
          value: formalExpired.length.toString(),
          tone: formalExpired.length ? 'warn' : 'ok',
          href: '/bookings?status=EXPIRED',
        },
        {
          label: 'No-show',
          value: formalNoShow.length.toString(),
          tone: formalNoShow.length ? 'warn' : 'ok',
          href: '/bookings?status=NO_SHOW',
        },
        {
          label: 'Quiet chats',
          value: quietChatRooms.length.toString(),
          tone: quietChatRooms.length ? 'info' : 'ok',
          href: '/bookings?view=chat',
        },
        {
          label: 'Matched no chat',
          value: matchedWithoutChat.length.toString(),
          tone: matchedWithoutChat.length ? 'danger' : 'ok',
          href: '/bookings?view=attention',
        },
      ],
    },
    {
      title: 'Partner lane',
      status: `${providerReviews.length} REVIEW`,
      detail: providerReviews.length
        ? 'Partner verification, reports, account controls, or KYC needs admin attention.'
        : 'No Partner review blocker in the current view.',
      action: 'Open Partners',
      href: '/partners',
      priority:
        activeProviderSanctions.length || openProviderReports.length ? 90 : providerReviews.length ? 65 : 20,
      severity:
        activeProviderSanctions.length || openProviderReports.length
          ? 'high'
          : providerReviews.length
            ? 'medium'
            : 'low',
      className: providerReviews.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: providerReviews.length ? 'pill-warn' : 'pill-success',
      breakdown: [
        {
          label: 'Verification',
          value: submittedVerification.length.toString(),
          tone: submittedVerification.length ? 'warn' : 'ok',
          href: '/partners?verification=SUBMITTED',
        },
        {
          label: 'KYC',
          value: submittedKyc.length.toString(),
          tone: submittedKyc.length ? 'warn' : 'ok',
          href: '/partners?review=kyc',
        },
        {
          label: 'Open reports',
          value: openProviderReports.length.toString(),
          tone: openProviderReports.length ? 'danger' : 'ok',
          href: '/partner-controls?status=OPEN',
        },
        {
          label: 'Active controls',
          value: activeProviderSanctions.length.toString(),
          tone: activeProviderSanctions.length ? 'danger' : 'ok',
          href: '/partner-controls?sanction=ACTIVE',
        },
      ],
    },
    {
      title: 'Payment lane',
      status: `${paymentReviews} REVIEW`,
      detail: paymentReviews
        ? 'Payment holds, missing refs, cash collection, completed closeout, expired/no-show release, or refunds need review.'
        : 'Payment and refund queues are quiet.',
      action: 'Open payments',
      href: completedCloseoutChecks.length
        ? '/bookings?view=closeout'
        : cashPending.length
          ? '/payments?review=cash'
          : '/payments',
      priority:
        completedCloseoutChecks.length || expiredPaymentChecks.length || noShowPaymentChecks.length
          ? 100
          : completedAuthorized.length
            ? 95
            : cashPending.length
              ? 85
              : paymentReviews
                ? 80
                : 20,
      severity:
        completedCloseoutChecks.length || expiredPaymentChecks.length || noShowPaymentChecks.length
          ? 'high'
          : paymentReviews
            ? 'medium'
            : 'low',
      className: paymentReviews ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: paymentReviews ? 'pill-danger' : 'pill-success',
      breakdown: [
        {
          label: 'Closeout checks',
          value: completedCloseoutChecks.length.toString(),
          tone: completedCloseoutChecks.length ? 'danger' : 'ok',
          href: '/bookings?view=closeout',
        },
        {
          label: 'Missing refs',
          value: missingGatewayRef.length.toString(),
          tone: missingGatewayRef.length ? 'warn' : 'ok',
          href: '/payments?review=missing-ref',
        },
        {
          label: 'Cash pending',
          value: cashPending.length.toString(),
          tone: cashPending.length ? 'warn' : 'ok',
          href: '/payments?review=cash',
        },
        {
          label: 'Release checks',
          value: (expiredPaymentChecks.length + noShowPaymentChecks.length).toString(),
          tone: expiredPaymentChecks.length + noShowPaymentChecks.length ? 'danger' : 'ok',
          href: '/bookings?view=payment',
        },
        {
          label: 'Open refunds',
          value: openRefundCount.toString(),
          tone: openRefundCount ? 'warn' : 'ok',
          href: '/refunds?review=open',
        },
      ],
    },
    {
      title: 'Cash settlement lane',
      status: cashDebtRowCount ? `${cashDebtRowCount} DEBT` : 'CLEAR',
      detail: cashDebtRowCount
        ? `${money(cashDebtAmount, input.cashSettlementSummary.currency)} Partner cash fee/tax debt across ${cashDebtProviderCount} Partner(s) must be collected or offset before final acceptance, service start, or payout release.`
        : 'No open cash fee debt is blocking final acceptance, service start, or payout release.',
      action: 'Open cash settlements',
      href: '/cash-settlements',
      priority: cashDebtRowCount ? 94 : 12,
      severity: cashDebtRowCount ? 'high' : 'low',
      className: cashDebtRowCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtRowCount ? 'pill-danger' : 'pill-success',
      breakdown: [
        {
          label: 'Debt rows',
          value: cashDebtRowCount.toString(),
          tone: cashDebtRowCount ? 'danger' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Blocked Partners',
          value: cashDebtProviderCount.toString(),
          tone: cashDebtProviderCount ? 'danger' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Wallet debt',
          value: money(cashDebtAmount, input.cashSettlementSummary.currency),
          tone: cashDebtAmount > 0 ? 'danger' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Over 24h',
          value: input.cashSettlementSummary.staleDebtRowCount.toString(),
          tone: input.cashSettlementSummary.staleDebtRowCount ? 'warn' : 'ok',
          href: '/cash-settlements',
        },
        {
          label: 'Cash pending',
          value: cashPending.length.toString(),
          tone: cashPending.length ? 'warn' : 'ok',
          href: '/payments?review=cash',
        },
      ],
    },
    {
      title: 'Payout lane',
      status: payoutHolds.length ? `${payoutHolds.length} HELD` : `${payoutReviews.length} OPEN`,
      detail: payoutHolds.length
        ? 'One or more payout batches are blocked by active Partner account controls.'
        : payoutReviews.length
          ? 'Draft, failed, or processing payout batches are waiting for finance movement.'
          : `${money(input.earnings.availableNetAmount, input.earnings.currency)} available from earnings.`,
      action: 'Open payouts',
      href: '/payouts',
      priority:
        payoutHolds.length || failedPayouts.length ? 92 : payoutReviews.length || setupBlocked ? 62 : 15,
      severity:
        payoutHolds.length || failedPayouts.length
          ? 'high'
          : payoutReviews.length || setupBlocked
            ? 'medium'
            : 'low',
      className: payoutHolds.length
        ? 'ops-task-blocked'
        : payoutReviews.length || setupBlocked
          ? 'ops-task-pending'
          : 'ops-task-done',
      pillClass: payoutHolds.length
        ? 'pill-danger'
        : payoutReviews.length || setupBlocked
          ? 'pill-warn'
          : 'pill-success',
      breakdown: [
        {
          label: 'Payout holds',
          value: payoutHolds.length.toString(),
          tone: payoutHolds.length ? 'danger' : 'ok',
          href: '/payouts',
        },
        {
          label: 'Failed',
          value: failedPayouts.length.toString(),
          tone: failedPayouts.length ? 'danger' : 'ok',
          href: '/payouts',
        },
        {
          label: 'Processing',
          value: processingPayouts.length.toString(),
          tone: processingPayouts.length ? 'info' : 'ok',
          href: '/payouts',
        },
        {
          label: 'Available',
          value: money(input.earnings.availableNetAmount, input.earnings.currency),
          tone: input.earnings.availableNetAmount > 0 ? 'warn' : 'ok',
          href: '/earnings',
        },
      ],
    },
    {
      title: 'Notification lane',
      status: `${failedNotifications.length} FAILED`,
      detail: failedNotifications.length
        ? 'Retry failed notifications or inspect disabled devices before live operation.'
        : 'No failed delivery in the current notification window.',
      action: 'Open notifications',
      href: '/notifications',
      priority: failedNotifications.length ? 58 : disabledPushProviders.length ? 35 : 10,
      severity: failedNotifications.length ? 'medium' : 'low',
      className: failedNotifications.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: failedNotifications.length ? 'pill-warn' : 'pill-success',
      breakdown: [
        {
          label: 'Failed sends',
          value: failedNotifications.length.toString(),
          tone: failedNotifications.length ? 'warn' : 'ok',
          href: '/notifications?review=failed',
        },
        {
          label: 'Disabled devices',
          value: disabledPushProviders.length.toString(),
          tone: disabledPushProviders.length ? 'info' : 'ok',
          href: '/partners?review=push',
        },
      ],
    },
  ];

  return signals.sort(
    (left, right) => right.priority - left.priority || left.title.localeCompare(right.title),
  );
}

function buildOpsQueue(input: {
  providers: AdminProvider[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  refunds: AdminRefund[];
  refundSummary: AdminRefundSummary;
  notifications: AdminNotification[];
  earnings: AdminEarningSummary;
  earningRows: AdminEarning[];
  bookingCreateRejections: AdminAuditLog[];
  cashSettlementSummary: AdminCashSettlementSummary;
  payoutBatches: AdminPayoutBatch[];
}) {
  const items: OpsQueueItem[] = [];

  for (const booking of input.bookings) {
    const flags = bookingFlags(booking);
    for (const flag of flags) {
      items.push({
        area: 'Booking',
        href: `/bookings/${booking.id}`,
        label: flag.label,
        detail: `${booking.services?.[0]?.service?.name ?? 'Booking'} - ${shortId(booking.id)}`,
        severity: flag.severity,
        owner: 'Dispatch',
        priority: flag.priority,
        recommendedAction: flag.recommendedAction,
      });
    }
  }

  const createGateSummary = buildBookingCreateGateSummary(input.bookingCreateRejections);
  if (input.bookingCreateRejections.length > 0) {
    items.push({
      area: 'Booking',
      href: '/bookings?view=blocked-create',
      label: 'Booking create attempts blocked',
      detail: `${input.bookingCreateRejections.length} stopped before payment: ${createGateSummary.customerDistanceGate} customer distance gate, ${createGateSummary.firstPickDistanceGate} first-pick distance gate.`,
      severity:
        createGateSummary.customerDistanceGate || createGateSummary.firstPickDistanceGate ? 'medium' : 'low',
      owner: 'Support',
      priority: 64,
      recommendedAction:
        'Open blocked create attempts and guide customers to book from a current location near the service address or choose a closer first-pick Partner.',
    });
  }

  for (const payment of input.payments) {
    if (payment.status === 'AUTHORIZED' && !payment.providerRef) {
      items.push({
        area: 'Payment',
        href: `/payments#payment-${payment.id}`,
        label: 'Payment hold missing gateway reference',
        detail: `${money(payment.amount, payment.currency)} for booking ${shortId(payment.bookingId)}`,
        severity: 'medium',
        owner: 'Finance',
        priority: 66,
        recommendedAction: 'Check the gateway/admin reference before capture, release, or refund.',
      });
    }
    if (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') {
      items.push({
        area: 'Payment',
        href: `/payments#payment-${payment.id}`,
        label: 'Completed service still authorized',
        detail: `${money(payment.amount, payment.currency)} should be captured or reviewed.`,
        severity: 'high',
        owner: 'Finance',
        priority: 96,
        recommendedAction: 'Capture the completed service payment or open a manual payment review.',
      });
    }
  }

  const openRefunds = input.refunds.filter((refund) => refund.status !== 'COMPLETED');
  for (const refund of openRefunds) {
    if (refund.status !== 'COMPLETED') {
      items.push({
        area: 'Payment',
        href: `/refunds#refund-${refund.id}`,
        label: 'Refund not completed',
        detail: `${money(refund.amount, refund.payment?.currency ?? 'VND')} for booking ${shortId(refund.bookingId)}`,
        severity: 'medium',
        owner: 'Finance',
        priority: 62,
        recommendedAction: 'Confirm refund status with the payment channel and update the refund record.',
      });
    }
  }
  const additionalOpenRefundCount = Math.max(0, input.refundSummary.openCount - openRefunds.length);
  if (additionalOpenRefundCount > 0) {
    items.push({
      area: 'Payment',
      href: '/refunds?review=open',
      label: 'Additional open refunds',
      detail: `${additionalOpenRefundCount} more open refund row(s) exist outside the current dashboard sample.`,
      severity: 'medium',
      owner: 'Finance',
      priority: 61,
      recommendedAction: 'Open the refund queue for the full server-paginated list before closing the shift.',
    });
  }

  if (input.cashSettlementSummary.rowCount > 0) {
    items.push({
      area: 'Finance',
      href: '/cash-settlements',
      label: 'Cash settlement queue blocking Partners',
      detail: `${input.cashSettlementSummary.providerCount} Partner(s) owe ${money(
        input.cashSettlementSummary.totalDebtAmount,
        input.cashSettlementSummary.currency,
      )} across ${input.cashSettlementSummary.rowCount} open debt row(s).`,
      severity: 'high',
      owner: 'Finance',
      priority: 100,
      recommendedAction:
        'Collect Partner deposit or approve an auditable offset before allowing more cash work.',
    });
  }

  for (const earning of openCashDebtEarnings(input.earningRows).slice(0, 5)) {
    items.push({
      area: 'Finance',
      href: '/cash-settlements',
      label: 'Partner cash fee debt open',
      detail: `${earning.providerProfile?.displayName ?? 'Partner'} owes ${money(Math.abs(earning.netAmount), earning.currency)} before final acceptance, service start, or payout release.`,
      severity: 'high',
      owner: 'Finance',
      priority: 98,
      recommendedAction:
        'Collect the company fee deposit or offset it before final acceptance or service start proceeds.',
    });
  }

  for (const provider of input.providers) {
    if (provider.verification?.status === 'SUBMITTED') {
      items.push({
        area: 'Partner',
        href: `/partners/${provider.id}`,
        label: 'Partner verification waiting',
        detail: provider.displayName,
        severity: 'medium',
        owner: 'Partner Ops',
        priority: 56,
        recommendedAction: 'Open the Partner profile and approve, reject, or request resubmission evidence.',
      });
    }
    const disabledDevices = provider.user?.pushDevices?.filter((device) => device.enabled === false) ?? [];
    if (disabledDevices.length > 0) {
      items.push({
        area: 'Notification',
        href: `/partners/${provider.id}`,
        label: 'Partner has disabled push device',
        detail: `${provider.displayName} has ${disabledDevices.length} disabled device(s).`,
        severity: 'low',
        owner: 'Support',
        priority: 28,
        recommendedAction: 'Review device delivery history and ask the Partner to re-enable notifications.',
      });
    }
    const openReports = (provider.reports ?? []).filter((report) =>
      ['OPEN', 'INVESTIGATING'].includes(report.status),
    );
    if (openReports.length > 0) {
      items.push({
        area: 'Partner',
        href: `/partners/${provider.id}`,
        label: 'Partner report open',
        detail: `${provider.displayName} has ${openReports.length} open report(s).`,
        severity: openReports.some((report) => ['HIGH', 'CRITICAL'].includes(report.severity))
          ? 'high'
          : 'medium',
        owner: 'Partner Ops',
        priority: openReports.some((report) => ['HIGH', 'CRITICAL'].includes(report.severity)) ? 89 : 64,
        recommendedAction:
          'Open the report case, contact support evidence, and decide control action or closure.',
      });
    }
    const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
    if (activeSanctions.length > 0) {
      items.push({
        area: 'Partner',
        href: `/partners/${provider.id}`,
        label: 'Partner active account control',
        detail: `${provider.displayName} has ${activeSanctions.length} active account control(s).`,
        severity: activeSanctions.some(
          (sanction) => sanction.type === 'PAYOUT_HOLD' || sanction.type === 'ACCOUNT_BLOCK',
        )
          ? 'high'
          : 'medium',
        owner: 'Partner Ops',
        priority: activeSanctions.some(
          (sanction) => sanction.type === 'PAYOUT_HOLD' || sanction.type === 'ACCOUNT_BLOCK',
        )
          ? 94
          : 67,
        recommendedAction:
          'Confirm whether the account control should continue before dispatch or payout decisions.',
      });
    }
  }

  for (const notification of input.notifications) {
    const failed = (notification.deliveries ?? []).filter((delivery) => delivery.status === 'FAILED');
    if (failed.length > 0) {
      items.push({
        area: 'Notification',
        href: `/notifications#notification-${notification.id}`,
        label: 'Notification delivery failed',
        detail: `${notification.title} - ${failed.length} failed attempt(s)`,
        severity: 'medium',
        owner: 'Support',
        priority: 46,
        recommendedAction: 'Retry delivery or disable stale devices so operations do not assume delivery.',
      });
    }
  }

  if (input.earnings.availableNetAmount > 0) {
    items.push({
      area: 'Payout',
      href: '/payouts',
      label: 'Partner payout can be prepared',
      detail: `${money(input.earnings.availableNetAmount, input.earnings.currency)} available for batching.`,
      severity: 'low',
      owner: 'Finance',
      priority: 24,
      recommendedAction: 'Create the next payout batch after checking holds, cash debt, and tax logs.',
    });
  }

  for (const batch of input.payoutBatches) {
    const payoutHold = activePayoutHold(batch);
    if (payoutHold) {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Payout batch blocked by hold',
        detail: `${batch.providerProfile?.displayName ?? 'Partner'} - ${payoutHold.reason}`,
        severity: 'high',
        owner: 'Finance',
        priority: 97,
        recommendedAction: 'Resolve the active payout hold or keep the batch paused with an audit note.',
      });
    } else if (batch.status === 'FAILED') {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Failed payout needs recovery',
        detail: `${money(batch.totalNetAmount, batch.currency)} for ${batch.providerProfile?.displayName ?? 'Partner'}`,
        severity: 'high',
        owner: 'Finance',
        priority: 92,
        recommendedAction: 'Check bank reference, retry transfer, or mark manual recovery with evidence.',
      });
    } else if (batch.status === 'PROCESSING') {
      items.push({
        area: 'Payout',
        href: `/payouts#${batch.id}`,
        label: 'Payout transfer in progress',
        detail: `${money(batch.totalNetAmount, batch.currency)} needs bank confirmation.`,
        severity: 'medium',
        owner: 'Finance',
        priority: 52,
        recommendedAction: 'Confirm bank settlement status before marking the payout as paid.',
      });
    }
  }

  return items.sort(
    (left, right) =>
      right.priority - left.priority ||
      severityPriorityValue(right.severity) - severityPriorityValue(left.severity) ||
      left.area.localeCompare(right.area),
  );
}

function buildShiftCommandBriefing(input: {
  queue: OpsQueueItem[];
  commandSignals: DashboardCommandSignal[];
  bookingOps: ReturnType<typeof buildBookingOpsInsights>;
  bookingDeepDive: ReturnType<typeof buildBookingOperationsDeepDive>;
  appPresence: ReturnType<typeof buildAppPresence>;
  partnerSupply: ReturnType<typeof buildPartnerSupplyInsights>;
  matchingControl: ReturnType<typeof buildMatchingControlRoom>;
  failedNotifications: AdminNotification[];
  cashSettlementSummary: AdminCashSettlementSummary;
  activePayoutBatches: AdminPayoutBatch[];
}): ShiftBriefing {
  const firstQueueItem = input.queue[0];
  const firstSignal = input.commandSignals[0];
  const highQueueCount = input.queue.filter((item) => item.severity === 'high').length;
  const openMatchingRows = input.matchingControl.openRows.length;
  const cashDebtPartners = input.cashSettlementSummary.providerCount;
  const failedNotificationCount = input.failedNotifications.length;
  const payoutBatchCount = input.activePayoutBatches.length;
  const hasAttention =
    highQueueCount > 0 ||
    openMatchingRows > 0 ||
    cashDebtPartners > 0 ||
    failedNotificationCount > 0 ||
    payoutBatchCount > 0;

  return {
    label: hasAttention ? 'Operator attention' : 'Stable shift',
    signalClass: hasAttention ? 'signal-warn' : 'signal-ok',
    headline: firstQueueItem?.label ?? firstSignal?.title ?? 'No critical first action',
    detail:
      firstQueueItem?.recommendedAction ??
      firstSignal?.detail ??
      'The current view has no critical blocker. Keep the dispatch and finance lanes under observation.',
    primaryAction: {
      label: firstQueueItem
        ? 'Open checklist item'
        : firstSignal
          ? firstSignal.action
          : 'Open booking monitor',
      href: firstQueueItem?.href ?? firstSignal?.href ?? '/bookings',
    },
    stats: [
      {
        label: 'Dispatch pressure',
        value: openMatchingRows.toString(),
        helper: `${input.bookingDeepDive.openWithoutParticipants} without Partner, ${input.bookingOps.noShowSignal} no-show record(s)`,
        tone: openMatchingRows ? 'warn' : 'ok',
        href: '/bookings?view=active',
      },
      {
        label: 'Customer presence',
        value: input.appPresence.liveAppCustomers.toString(),
        helper: `${input.appPresence.liveOpenMatchingCustomers} live in matching, ${input.appPresence.liveActiveBookingCustomers} live in active work`,
        tone: input.appPresence.liveAppCustomers ? 'info' : 'warn',
        href: '/usage-overview?segment=live-customers',
      },
      {
        label: 'Partner supply',
        value: `${input.partnerSupply.onlineAvailable}/${input.partnerSupply.online}`,
        helper: `${input.partnerSupply.staleLocation} stale location, ${input.partnerSupply.supplyPressureLabel} pressure`,
        tone: input.partnerSupply.onlineAvailable ? 'ok' : 'warn',
        href: '/partners',
      },
      {
        label: 'Cash debt block',
        value: cashDebtPartners.toString(),
        helper: money(input.cashSettlementSummary.totalDebtAmount, input.cashSettlementSummary.currency),
        tone: cashDebtPartners ? 'danger' : 'ok',
        href: '/cash-settlements',
      },
      {
        label: 'Alert failures',
        value: failedNotificationCount.toString(),
        helper: 'Push/in-app delivery rows needing retry or device review',
        tone: failedNotificationCount ? 'warn' : 'ok',
        href: '/notifications?review=failed',
      },
      {
        label: 'Payout batches',
        value: payoutBatchCount.toString(),
        helper: 'Draft, processing, failed, or held payout work',
        tone: payoutBatchCount ? 'info' : 'ok',
        href: '/payouts',
      },
    ],
    nextActions: input.queue.slice(0, 4),
  };
}

function buildOperatorStartChecklist(input: {
  queue: OpsQueueItem[];
  bookingOps: ReturnType<typeof buildBookingOpsInsights>;
  appPresence: ReturnType<typeof buildAppPresence>;
  partnerSupply: ReturnType<typeof buildPartnerSupplyInsights>;
  matchingControl: ReturnType<typeof buildMatchingControlRoom>;
  failedNotifications: AdminNotification[];
  cashSettlementSummary: AdminCashSettlementSummary;
  activePayoutBatches: AdminPayoutBatch[];
}): OperatorStartChecklistItem[] {
  const openMatchingFollowUp = input.matchingControl.openRows.filter(
    (row) => row.expired || row.freshEligibleCount === 0,
  ).length;
  const highQueueCount = input.queue.filter((item) => item.severity === 'high').length;
  const missingPartnerSupply =
    input.partnerSupply.onlineAvailable === 0 || input.partnerSupply.staleLocation > 0;
  const cashDebtPartners = input.cashSettlementSummary.providerCount;
  const notificationFailures = input.failedNotifications.length;
  const payoutWork = input.activePayoutBatches.length;

  return [
    {
      title: 'Protect waiting customers',
      status: openMatchingFollowUp || input.bookingOps.noShowSignal ? 'Dispatch first' : 'Clear',
      detail: openMatchingFollowUp
        ? `${openMatchingFollowUp} open matching booking(s) have expired timers or no fresh Partner supply.`
        : `${input.bookingOps.openMatching} matching wait, ${input.bookingOps.noShowSignal} no-show record(s).`,
      action: 'Open matching queue',
      href: openMatchingFollowUp ? '/bookings?view=matching' : '/bookings',
      className: openMatchingFollowUp ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: openMatchingFollowUp ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Confirm Partner supply',
      status: missingPartnerSupply ? 'Refresh supply' : 'Ready',
      detail: `${input.partnerSupply.onlineAvailable} available, ${input.partnerSupply.staleLocation} stale location, ${input.partnerSupply.supplyPressureLabel} pressure.`,
      action: 'Open Partners',
      href: missingPartnerSupply ? '/partners?review=location' : '/partners?review=direct-ready',
      className: missingPartnerSupply ? 'ops-task-pending' : 'ops-task-done',
      pillClass: missingPartnerSupply ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Clear acceptance blockers',
      status: cashDebtPartners || highQueueCount ? 'Blocked work' : 'No hard block',
      detail: cashDebtPartners
        ? `${cashDebtPartners} Partner(s) have cash fee or tax debt blocking final acceptance, service start, and payout release.`
        : `${highQueueCount} checklist item(s), ${input.bookingOps.completedCloseoutChecks} closeout check(s).`,
      action: cashDebtPartners ? 'Open cash settlements' : 'Open checklist queue',
      href: cashDebtPartners ? '/cash-settlements' : '/?review=priority',
      className: cashDebtPartners || highQueueCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: cashDebtPartners || highQueueCount ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Check customer reachability',
      status:
        notificationFailures || input.appPresence.disabledPushCustomers ? 'Reachability check' : 'Reachable',
      detail: `${input.appPresence.liveAppCustomers} live customer(s), ${input.appPresence.disabledPushCustomers} push-disabled customer(s), ${notificationFailures} failed notification row(s).`,
      action: notificationFailures ? 'Open failed notifications' : 'Open usage overview',
      href: notificationFailures ? '/notifications?review=failed' : '/usage-overview?segment=reachability',
      className: notificationFailures ? 'ops-task-pending' : 'ops-task-done',
      pillClass: notificationFailures ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Confirm finance handoff',
      status: payoutWork ? 'Finance open' : 'No payout batch',
      detail: `${payoutWork} active payout batch(es), ${money(
        input.cashSettlementSummary.totalDebtAmount,
        input.cashSettlementSummary.currency,
      )} cash debt total.`,
      action: payoutWork ? 'Open payouts' : 'Open earnings',
      href: payoutWork ? '/payouts' : '/earnings',
      className: payoutWork ? 'ops-task-pending' : 'ops-task-done',
      pillClass: payoutWork ? 'pill-warn' : 'pill-success',
    },
  ];
}

function opsQueueCardClass(severity: OpsQueueItem['severity']) {
  if (severity === 'high') return 'ops-task-blocked';
  if (severity === 'medium') return 'ops-task-pending';
  return 'ops-task-done';
}

function dashboardToneCardClass(tone: DashboardTone) {
  if (tone === 'danger') return 'ops-task-blocked';
  if (tone === 'warn') return 'ops-task-pending';
  if (tone === 'info') return 'ops-task-active';
  return 'ops-task-done';
}

function dashboardTonePillClass(tone: DashboardTone) {
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-success';
}

function buildOpsQueueSummary(queue: OpsQueueItem[]) {
  const high = queue.filter((item) => item.severity === 'high').length;
  const medium = queue.filter((item) => item.severity === 'medium').length;
  const low = queue.filter((item) => item.severity === 'low').length;
  const financeImmediate = queue.filter(
    (item) => item.severity === 'high' && ['Payment', 'Finance', 'Payout'].includes(item.area),
  ).length;
  const partnerImmediate = queue.filter((item) => item.severity === 'high' && item.area === 'Partner').length;
  const customerProtection = queue.filter((item) => item.area === 'Booking').length;
  const byArea = queue.reduce(
    (counts, item) => {
      counts[item.area] = (counts[item.area] ?? 0) + 1;
      return counts;
    },
    {} as Record<OpsQueueItem['area'], number>,
  );

  return {
    high,
    medium,
    low,
    financeImmediate,
    partnerImmediate,
    customerProtection,
    byArea,
    first: queue[0],
  };
}

function openCashDebtEarnings(earnings: AdminEarning[]) {
  return earnings.filter(isOpenCashDebtEarning);
}

function isOpenCashDebtEarning(earning: AdminEarning) {
  return (
    earning.netAmount < 0 &&
    earning.status !== 'PAID' &&
    earning.status !== 'CANCELLED' &&
    earning.payoutBatchId == null
  );
}

function bookingFlags(booking: AdminBooking) {
  const flags: Array<{
    label: string;
    severity: OpsQueueItem['severity'];
    priority: number;
    recommendedAction: string;
  }> = [];
  const paymentStatus = booking.payment?.status;
  const participantCount = booking.participants?.length ?? 0;
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;

  if (
    booking.status === 'CANCELLED' &&
    booking.payment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({
      label: 'Cancelled booking has unresolved payment',
      severity: 'high',
      priority: 99,
      recommendedAction: 'Open the booking and release or refund the customer payment before closing.',
    });
  }
  if (booking.status === 'EXPIRED' && unresolvedReleasePayment(booking)) {
    flags.push({
      label: 'Expired booking has unresolved payment release',
      severity: 'high',
      priority: 99,
      recommendedAction:
        'Release the authorization or create the refund path before customer support follows up.',
    });
  }
  if (booking.status === 'NO_SHOW' && unresolvedReleasePayment(booking)) {
    flags.push({
      label: 'No-show booking has unresolved payment release',
      severity: 'high',
      priority: 98,
      recommendedAction: 'Review no-show evidence, then settle payment release, refund, or fee collection.',
    });
  }
  if (completedCloseoutNeedsOps(booking)) {
    flags.push({
      label: 'Completed booking missing closeout records',
      severity: 'high',
      priority: 97,
      recommendedAction:
        'Run completed booking closeout: captured payment, earning, tax, fee, and wallet impact records.',
    });
  }
  if (booking.status === 'OPEN_MATCHING' && expired) {
    flags.push({
      label: 'Open matching window expired',
      severity: 'high',
      priority: 90,
      recommendedAction: 'Expire the request or contact the customer before it stays visible to Partners.',
    });
  }
  if (booking.status === 'OPEN_MATCHING' && booking.preferredProvider && participantCount === 0) {
    flags.push({
      label: 'First-pick Partner has not replied yet',
      severity: 'medium',
      priority: 61,
      recommendedAction:
        'Ask the first-pick Partner to reply or prepare marketplace matching for the customer.',
    });
  }
  if (booking.status === 'OPEN_MATCHING' && participantCount === 0) {
    flags.push({
      label: 'No Partner participation yet',
      severity: 'medium',
      priority: 58,
      recommendedAction:
        'Check nearby Partner supply and widen marketplace matching if the customer is waiting.',
    });
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    flags.push({
      label: 'Matched booking has no chat room',
      severity: 'high',
      priority: 88,
      recommendedAction: 'Create or repair the chat room so customer and Partner can coordinate.',
    });
  }
  if (
    bookingChatQuietNeedsOps({
      status: booking.status,
      hasChatRoom: Boolean(booking.chatRoom),
      messageCount: booking.chatRoom?.messages?.length ?? 0,
    })
  ) {
    flags.push({
      label: 'Chat room is ready but still quiet',
      severity: 'low',
      priority: 30,
      recommendedAction: 'Monitor the room and nudge the Partner if service start is approaching.',
    });
  }

  return flags;
}

function unresolvedReleasePayment(booking: AdminBooking) {
  return bookingPaymentReleaseNeedsOpsFromFacts({ payment: booking.payment });
}

function completedCloseoutNeedsOps(booking: AdminBooking) {
  return bookingCompletedCloseoutNeedsOpsFromFacts(booking);
}

function buildOperationalPolicySummary(settings: AdminOperationalPolicySetting[]) {
  const settingByKey = (key: string) => adminOperationalPolicySettingByKey(settings, key);
  const activeOverrides = settings
    .filter((setting) => isOperationalPolicyOverride(setting))
    .map((setting) => ({
      key: setting.key,
      category: setting.category,
      label: displayOperationalWording(setting.label),
      current: policyOptionLabel(setting),
      recommended: policyOptionLabel(setting, true),
      enforced: setting.enforced,
      href: operationalPolicyHref(setting.key),
    }));
  const recentChanges = settings
    .filter((setting) => isRecentOperationalPolicyChange(setting.updatedAt))
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime())
    .map((setting) => ({
      key: setting.key,
      label: displayOperationalWording(setting.label),
      current: policyOptionLabel(setting),
      changedAtLabel: relativeTimeLabel(setting.updatedAt),
      enforced: setting.enforced,
      href: operationalPolicyHref(setting.key),
    }));
  const healthLabel = activeOverrides.length ? `${activeOverrides.length} override(s)` : 'Baseline';
  const healthHelper = activeOverrides.length
    ? 'Owner-selected overrides are active. Confirm each still matches current operating intent.'
    : 'All loaded policies match the recommended baseline.';
  const enforced = [
    policyMetric(
      settingByKey(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes),
      'Response window',
      'First-pick Partner first reply timer.',
    ),
    policyMetric(
      settingByKey(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
      'Marketplace radius',
      'Partners inside this radius can participate.',
    ),
    policyMetric(
      settingByKey(OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit),
      'Marketplace invite cap',
      'Nearest eligible Partners opened for marketplace participation.',
    ),
    policyMetric(
      settingByKey(OPERATIONAL_POLICY_KEYS.travelBufferMinutes),
      'Travel buffer',
      'Availability buffer after work.',
    ),
    policyMetric(
      settingByKey(OPERATIONAL_POLICY_KEYS.preferredAcceptMode),
      'Accept mode',
      'First-pick accept behavior.',
    ),
  ];

  const decisionKeys = [
    OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    OPERATIONAL_POLICY_KEYS.walletNegativeGate,
    OPERATIONAL_POLICY_KEYS.cancellationAfterMatch,
    OPERATIONAL_POLICY_KEYS.noShowPartnerReport,
    OPERATIONAL_POLICY_KEYS.partnerAlertChannel,
  ];

  const decisions = decisionKeys
    .map((key) => settingByKey(key))
    .filter((setting): setting is AdminOperationalPolicySetting => Boolean(setting))
    .map((setting) => {
      const aligned = String(setting.value) === String(setting.recommendedValue);
      return {
        key: setting.key,
        label: displayOperationalWording(setting.label),
        status: setting.enforced ? 'Enforced' : aligned ? 'Recommended' : 'Owner choice',
        current: policyOptionLabel(setting),
        recommendation: `Recommended: ${policyOptionLabel(setting, true)}`,
        className: aligned ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: aligned ? 'pill-success' : 'pill-warn',
        href: operationalPolicyHref(setting.key),
      };
    });

  return {
    enforced,
    decisions,
    activeOverrides,
    recentChanges,
    activeOverrideCount: activeOverrides.length,
    recentChangeCount: recentChanges.length,
    healthLabel,
    healthHelper,
  };
}

function isOperationalPolicyOverride(setting: AdminOperationalPolicySetting) {
  return (
    setting.recommendedValue !== null &&
    setting.recommendedValue !== undefined &&
    String(setting.value) !== String(setting.recommendedValue)
  );
}

function isRecentOperationalPolicyChange(updatedAt?: string | null) {
  if (!updatedAt) {
    return false;
  }
  const updatedTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTime)) {
    return false;
  }
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - updatedTime <= sevenDaysMs;
}

function policyMetric(setting: AdminOperationalPolicySetting | undefined, label: string, helper: string) {
  return {
    label,
    value: setting ? formatPolicyValue(setting.value, setting.unit) : '-',
    helper,
    href: setting ? operationalPolicyHref(setting.key) : '/operations-policy',
  };
}

function policyOptionLabel(setting: AdminOperationalPolicySetting, useRecommended = false) {
  const value = String(useRecommended ? setting.recommendedValue : setting.value);
  return displayOperationalWording(
    setting.options?.find((option) => option.value === value)?.label ??
      formatPolicyValue(value, setting.unit),
  );
}

function formatPolicyValue(value: unknown, unit?: string | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (unit === 'meters') {
    return formatDistanceMeters(Number(value));
  }
  if (unit === 'minutes') {
    return `${value} min`;
  }
  return String(value);
}

function activePayoutHold(batch: AdminPayoutBatch) {
  return batch.providerProfile?.sanctions?.find(
    (sanction) => sanction.type === 'PAYOUT_HOLD' && sanction.status === 'ACTIVE',
  );
}

function severityPriorityValue(severity: OpsQueueItem['severity']) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

function opsQueueSeverityLabel(severity: OpsQueueItem['severity']) {
  if (severity === 'high') return 'SAME-SHIFT';
  if (severity === 'medium') return 'CHECK';
  return 'INFO';
}
