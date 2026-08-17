import { ListChecks } from 'lucide-react';
import { AdminEmptyState } from '../components/admin-empty-state';
import { AdminFilterChipGroup } from '../components/admin-filter-chip-group';
import { AdminFormControlLink } from '../components/admin-form-light-controls';
import { AdminPageTemplate } from '../components/admin-page-template';
import { AdminQueueMeta } from '../components/admin-overview-card';
import { AdminTextLink } from '../components/admin-text-link';
import { AdminActionCard, AdminDisclosure, AdminSection, AdminTaskGrid } from '../components/admin-surface';
import { StartShiftChartWidgetsDeferred } from '../components/start-shift-chart-widgets-deferred';
import { StartShiftLiveMetrics } from '../components/start-shift-live-metrics';
import {
  StartShiftDemandSupplyWidgets,
  StartShiftRankingWidgets,
} from '../components/start-shift-ranking-widgets';
import { StartShiftRefreshButton } from '../components/start-shift-refresh-button';
import { StatusBadge, StatusBadgeFromPillClass, StatusBadgeLink } from '../components/status-badge';
import {
  AdminBooking,
  AdminCashSettlementSummary,
  AdminDashboardSummary,
  AdminEarningSummary,
  AdminNotification,
  AdminOperationalPolicySetting,
  AdminPayment,
  AdminPayoutBatch,
  AdminProvider,
  AdminRefundSummary,
  AdminStartShiftAnalytics,
  AdminStartShiftSummary,
  adminGet,
} from '../lib/admin-api';
import { adminCountLabel } from '../lib/admin-copy';
import {
  formatMoneyOrZero as money,
  formatRelativeAge as relativeTimeLabel,
  shortDisplayId,
} from '../lib/admin-format';
import { type AdminDateRange, dateRangeLabel } from '../lib/date-range';
import { getCurrentAdminOperatorAccess } from '../lib/admin-operator-access';
import {
  buildDashboardDataHrefs,
  buildDashboardDetailsHref,
  buildDashboardRange,
  buildStartShiftChartAnalytics,
  buildDashboardViewMode,
} from './dashboard-page-model';
import {
  DashboardDataScopeStatus,
  DashboardTraceSummary,
  combinedDashboardSourceState,
  dashboardSourceState,
  type DashboardSourceState,
} from './dashboard-trace-summary';
import {
  type PrioritizedStartShiftAction,
  prioritizeStartShiftActions,
  prioritizeStartShiftCommandItems,
  splitStartShiftActions,
  startShiftActionAgeing,
  startShiftActionHref,
  startShiftActionValue,
} from './start-shift-action-priority';
import { buildStartShiftFinanceReviewWorkload } from './start-shift-finance-review-workload';
import {
  START_SHIFT_ACTIVE_BOOKING_STATUSES,
  buildBookingOperationsDeepDive,
  buildBookingOpsInsights,
} from './start-shift-booking-insights';
import { buildMatchingControlRoom } from './start-shift-matching-control';
import {
  buildOperationsCommandBoard,
  type DashboardTone,
  type OperationsCommandBoardItem,
} from './start-shift-operations-command-board';

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

function emptyEarningSummary(): AdminEarningSummary {
  return {
    availableNetAmount: 0,
    count: 0,
    currency: 'VND',
    grossAmount: 0,
    netAmount: 0,
    paidNetAmount: 0,
    pendingNetAmount: 0,
    platformFee: 0,
    withholdingAmount: 0,
  };
}

function emptyDashboardSummary(): AdminDashboardSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    actionQueue: {
      completedPaymentHolds: 0,
      completedWithoutSettlement: 0,
      completedWithoutSettlementBacklog: 0,
      completedWithoutSettlementRecent: 0,
      customerChoice: 0,
      matchingExpired: 0,
      matchingWithoutParticipants: 0,
    },
    bookingActivity: {
      live: {
        active: 0,
        arrived: 0,
        customerChoice: 0,
        inService: 0,
        matched: 0,
        onTheWay: 0,
        openMatching: 0,
      },
      period: {
        cancelled: 0,
        completed: 0,
        expired: 0,
        noShow: 0,
        refunded: 0,
        total: 0,
      },
    },
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
      approvalPending: 0,
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

function StartShiftActionGrid({
  className,
  items,
  showActionLabel = true,
}: {
  readonly className?: string;
  readonly items: readonly OperationsCommandBoardItem[];
  readonly showActionLabel?: boolean;
}) {
  return (
    <AdminTaskGrid className={className}>
      {items.map((item) => (
        <AdminActionCard
          actionLabel={showActionLabel ? startShiftCommandActionLabel(item) : undefined}
          className={`start-shift-action-item ${dashboardToneCardClass(item.tone)}`}
          detail={item.detail}
          href={item.href}
          key={item.lane}
          leading={
            <StatusBadgeFromPillClass pillClass={dashboardTonePillClass(item.tone)}>
              {item.status}
            </StatusBadgeFromPillClass>
          }
          title={item.lane}
          value={item.value}
          variant="ops-task"
        >
          <AdminQueueMeta
            assignee={item.assigneeLabel}
            impact={item.impactLabel}
            oldest={item.oldestLabel}
            owner={item.owner}
            ownerLabel="Team"
          />
          {item.ageing?.length ? (
            <AdminFilterChipGroup ariaLabel={`${item.lane} ageing`} className="start-shift-ageing-strip">
              {item.ageing.map((bucket) =>
                bucket.href ? (
                  <StatusBadgeLink
                    ariaLabel={`Open ${item.lane}: ${bucket.label}`}
                    href={bucket.href}
                    key={bucket.label}
                    tone={bucket.tone}
                  >
                    {bucket.label}
                  </StatusBadgeLink>
                ) : (
                  <StatusBadge key={bucket.label} tone={bucket.tone}>
                    {bucket.label}
                  </StatusBadge>
                ),
              )}
            </AdminFilterChipGroup>
          ) : null}
          {item.nextCases?.length ? (
            <AdminFilterChipGroup ariaLabel={`${item.lane} next cases`} className="start-shift-next-cases">
              {item.nextCases.map((nextCase) => (
                <StatusBadgeLink href={nextCase.href} key={nextCase.href} tone="info">
                  {nextCase.label}
                </StatusBadgeLink>
              ))}
            </AdminFilterChipGroup>
          ) : null}
        </AdminActionCard>
      ))}
    </AdminTaskGrid>
  );
}

function startShiftCommandActionLabel(item: OperationsCommandBoardItem) {
  if (item.lane === 'Dashboard data') return 'Refresh dashboard data';

  const subject = item.lane.toLowerCase().replace(/ review$/, '');
  return item.status === 'SLA overdue' ? `Review oldest ${subject}` : `Review ${subject}`;
}

type StartShiftWorkItem = {
  count: number;
  href: string;
  key: string;
  label: string;
  scope: string;
  tone: DashboardTone;
};

type DashboardPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

type DashboardFilters = {
  range: AdminDateRange;
};

function startShiftCommandItem(item: PrioritizedStartShiftAction): OperationsCommandBoardItem {
  const action = item.action;
  const amountContext = startShiftActionAmountContext(action.key, action.amount);
  const nextCaseIds =
    item.scope === 'current'
      ? action.nextCases?.current
      : item.scope === 'overdue'
        ? action.nextCases?.overdue
        : item.scope === 'legacy'
          ? action.nextCases?.legacy
          : [];
  return {
    ageing: startShiftActionAgeing(item),
    checks: [],
    detail: action.count > 0 ? action.operatorAction : `Clear. ${action.operatorAction}`,
    href: startShiftActionHref(item),
    impactAmount: action.amount,
    isLiveBlock: item.category === 'customer' && item.scope !== 'legacy',
    lane: action.label,
    nextCases: nextCaseIds?.map((caseId) => startShiftNextCase(action.key, caseId)),
    impactLabel: amountContext || undefined,
    oldestAt: action.oldestAt,
    oldestLabel: action.oldestAt ? relativeTimeLabel(action.oldestAt) : undefined,
    owner:
      action.key === 'partner-approvals'
        ? 'Partner Ops'
        : action.key === 'notification-failures'
          ? 'Support'
          : action.key === 'matching-delays' || action.key === 'cancellation-review'
            ? 'Dispatch'
            : 'Finance',
    status: item.status,
    tone: item.tone,
    overdueCount: item.isSlaOverdue ? (item.overdueCount ?? action.count) : 0,
    value: startShiftActionValue(item),
  };
}

function startShiftNextCase(key: string, caseId: string) {
  const encodedId = encodeURIComponent(caseId);
  if (key === 'partner-approvals') {
    return { href: `/partners/${encodedId}?section=full`, label: `Partner ${shortDisplayId(caseId)}` };
  }
  if (key === 'notification-failures') {
    return {
      href: `/notifications?review=failed&confirm=retry&notificationId=${encodedId}`,
      label: `Notification ${shortDisplayId(caseId)}`,
    };
  }
  return { href: `/bookings/${encodedId}`, label: `Booking ${shortDisplayId(caseId)}` };
}

function startShiftActionAmountContext(key: string, amount: number) {
  if (amount <= 0) return '';
  if (key === 'payment-holds') return `${money(amount)} authorized`;
  if (key === 'refund-review') return `${money(amount)} requested`;
  if (key === 'cash-reconciliation') return `${money(amount)} outstanding`;
  return '';
}

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
  { range: 'today', label: 'Today', href: '/?range=today' },
  { range: '7d', label: 'Last 7 days', href: '/?range=7d' },
  { range: '30d', label: 'Last 30 days', href: '/?range=30d' },
];

export default async function DashboardPage({ searchParams }: { searchParams?: DashboardPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildDashboardFilters(params);
  const dashboardViewMode = buildDashboardViewMode(params);
  const dashboardDataHrefs = buildDashboardDataHrefs(params);
  const selectedRangeLabel = dateRangeLabel(filters.range);
  const [startShiftSummaryResponse, startShiftAnalyticsResponse, currentOperatorAccess] = await Promise.all([
    adminGet<AdminStartShiftSummary | null>(dashboardDataHrefs.startShiftSummaryHref, null, {
      freshness: 'aggregate',
      revalidateSeconds: 15,
      tags: ['start-shift-summary'],
    }),
    adminGet<AdminStartShiftAnalytics | null>(dashboardDataHrefs.startShiftAnalyticsHref, null, {
      freshness: 'aggregate',
      revalidateSeconds: 30,
      tags: ['start-shift-analytics'],
    }),
    getCurrentAdminOperatorAccess(),
  ]);
  const dashboardSummaryResponse = startShiftSummaryResponse?.operations ?? null;
  const providers: AdminProvider[] = [];
  const bookings: AdminBooking[] = [];
  const payments: AdminPayment[] = [];
  const paymentSummaryResponse = startShiftSummaryResponse?.payments ?? null;
  const earningsResponse = startShiftSummaryResponse?.earnings ?? null;
  const refundSummaryResponse = startShiftSummaryResponse?.refunds ?? null;
  const notifications: AdminNotification[] = [];
  const notificationSummaryResponse = startShiftSummaryResponse?.notifications ?? null;
  const payoutBatches: AdminPayoutBatch[] = [];
  const payoutBatchSummaryResponse = startShiftSummaryResponse?.payoutBatches ?? null;
  const cashSettlementSummaryResponse = startShiftSummaryResponse?.cashSettlements ?? null;
  const operationalPolicies: AdminOperationalPolicySetting[] = [];

  const dashboardSummary = dashboardSummaryResponse ?? emptyDashboardSummary();
  const paymentSummary = paymentSummaryResponse;
  const earnings = earningsResponse ?? emptyEarningSummary();
  const refundSummary = refundSummaryResponse ?? EMPTY_REFUND_SUMMARY;
  const notificationSummary = notificationSummaryResponse;
  const payoutBatchSummary = payoutBatchSummaryResponse;
  const cashSettlementSummary = cashSettlementSummaryResponse ?? emptyCashSettlementSummary();
  const dashboardRefreshHref = buildDashboardDetailsHref(dashboardViewMode.detailsMode, params);
  const dashboardSummaryState = dashboardSourceState(
    dashboardSummaryResponse,
    dashboardSummaryResponse?.generatedAt,
  );
  const paymentSummaryState = dashboardSourceState(
    paymentSummaryResponse,
    paymentSummaryResponse?.generatedAt,
  );
  const earningSummaryState = dashboardSourceState(earningsResponse, earningsResponse?.generatedAt);
  const refundSummaryState = dashboardSourceState(refundSummaryResponse, refundSummaryResponse?.generatedAt);
  const notificationSummaryState = dashboardSourceState(
    notificationSummaryResponse,
    notificationSummaryResponse?.generatedAt,
  );
  const payoutSummaryState = dashboardSourceState(
    payoutBatchSummaryResponse,
    payoutBatchSummaryResponse?.generatedAt,
  );
  const cashSummaryState = dashboardSourceState(
    cashSettlementSummaryResponse,
    cashSettlementSummaryResponse?.generatedAt,
  );
  const startShiftSummaryState = dashboardSourceState(
    startShiftSummaryResponse,
    startShiftSummaryResponse?.generatedAt,
  );
  const startShiftAnalytics = startShiftAnalyticsResponse ?? startShiftSummaryResponse?.analytics ?? null;
  const startShiftChartAnalytics = buildStartShiftChartAnalytics(startShiftAnalytics);
  const startShiftAnalyticsSourceState = dashboardSourceState(
    startShiftAnalytics,
    startShiftAnalytics?.generatedAt,
  );
  const financeReviewWorkload = startShiftSummaryResponse?.financeReviewWorkload;
  const paymentClearingWorkloadState = dashboardSourceState(financeReviewWorkload?.paymentClearing);
  const bankReconciliationWorkloadState = dashboardSourceState(financeReviewWorkload?.bankReconciliation);
  const companyBankAccountApprovalState = dashboardSourceState(financeReviewWorkload?.companyBankAccounts);
  const partnerDepositWorkloadState = dashboardSourceState(financeReviewWorkload?.partnerBankDeposits);
  const financeReviewWorkloadState = combinedDashboardSourceState([
    paymentClearingWorkloadState,
    bankReconciliationWorkloadState,
    partnerDepositWorkloadState,
    companyBankAccountApprovalState,
  ]);
  const financeReviewWorkloadLanes = buildStartShiftFinanceReviewWorkload({
    currentOperatorId: currentOperatorAccess?.id,
    summaries: financeReviewWorkload,
  });
  const hasStartShiftAnalyticsActivity = Boolean(
    startShiftAnalytics &&
    (startShiftAnalytics.buckets.some(
      (bucket) =>
        (bucket.bookingRequests ?? 0) > 0 ||
        (bucket.completed ?? 0) > 0 ||
        (bucket.cancelled ?? 0) > 0 ||
        (bucket.noShow ?? 0) > 0 ||
        (bucket.grossAmount ?? 0) > 0 ||
        (bucket.platformFee ?? 0) > 0 ||
        (bucket.partnerNetAmount ?? 0) > 0 ||
        (bucket.refundAmount ?? 0) > 0,
    ) ||
      Object.values(startShiftAnalytics.customerPulse).some((value) => value > 0)),
  );
  const startShiftChartState =
    startShiftAnalyticsSourceState === 'unavailable'
      ? 'unavailable'
      : startShiftAnalyticsSourceState === 'stale'
        ? 'stale'
        : hasStartShiftAnalyticsActivity
          ? 'ready'
          : 'empty';
  const dashboardSourceStates = [
    { label: 'Operations', state: dashboardSummaryState },
    { label: 'Payments', state: paymentSummaryState },
    { label: 'Earnings', state: earningSummaryState },
    { label: 'Refunds', state: refundSummaryState },
    { label: 'Notifications', state: notificationSummaryState },
    { label: 'Payouts', state: payoutSummaryState },
    { label: 'Cash settlements', state: cashSummaryState },
    { label: 'Analytics', state: startShiftAnalyticsSourceState },
    { label: 'Payment clearing workload', state: paymentClearingWorkloadState },
    { label: 'Bank reconciliation workload', state: bankReconciliationWorkloadState },
    { label: 'Partner deposit workload', state: partnerDepositWorkloadState },
    { label: 'Bank account approvals', state: companyBankAccountApprovalState },
  ] as const;
  const unavailableDashboardSources = dashboardSourceStates.filter(
    (source) => source.state === 'unavailable',
  );
  const staleDashboardSources = dashboardSourceStates.filter((source) => source.state === 'stale');
  const startShiftScopeSourceState =
    startShiftSummaryState === 'unavailable'
      ? 'unavailable'
      : staleDashboardSources.length > 0
        ? 'stale'
        : 'available';

  const paymentHoldCount =
    paymentSummary?.authorized ?? payments.filter((payment) => payment.status === 'AUTHORIZED').length;
  const sampledLiveBookingOps = buildBookingOpsInsights(bookings);
  const liveBookingActivity = dashboardSummary.bookingActivity?.live;
  const liveBookingOps = liveBookingActivity
    ? {
        ...sampledLiveBookingOps,
        active: liveBookingActivity.active,
        openMatching: liveBookingActivity.openMatching,
      }
    : sampledLiveBookingOps;
  const liveBookingDeepDive = buildBookingOperationsDeepDive(bookings, payments);
  const failedNotifications = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
  const failedNotificationCount = notificationSummary?.failed ?? failedNotifications.length;
  const appPresence = dashboardSummary.appPresence;
  const activeBookings = bookings.filter((booking) =>
    START_SHIFT_ACTIVE_BOOKING_STATUSES.has(booking.status),
  );
  const partnerSupply = dashboardPartnerSupplyWithLiveFinance(dashboardSummary.partnerSupply, {
    activeDemand: liveBookingActivity?.active ?? activeBookings.length,
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
    activePayoutBatchCount,
  });
  const dataReliabilityCommandItem: OperationsCommandBoardItem | null = unavailableDashboardSources.length
    ? {
        checks: unavailableDashboardSources.map((source) => source.label),
        detail: 'One or more summary sources did not respond. Refresh before treating zero values as clear.',
        href: dashboardRefreshHref,
        lane: 'Dashboard data',
        owner: 'Setup',
        status: 'Data unavailable',
        tone: 'danger',
        value: adminCountLabel(unavailableDashboardSources.length, 'source'),
      }
    : staleDashboardSources.length
      ? {
          checks: staleDashboardSources.map((source) => source.label),
          detail: 'One or more summary sources are older than five minutes.',
          href: dashboardRefreshHref,
          lane: 'Dashboard data',
          owner: 'Setup',
          status: 'Stale',
          tone: 'warn',
          value: adminCountLabel(staleDashboardSources.length, 'source'),
        }
      : null;
  const recentSettlementGapCount =
    dashboardSummary.actionQueue?.completedWithoutSettlementRecent ??
    dashboardSummary.actionQueue?.completedWithoutSettlement ??
    0;
  const settlementBacklogCount = dashboardSummary.actionQueue?.completedWithoutSettlementBacklog ?? 0;
  const exactActionQueueItems: OperationsCommandBoardItem[] = dashboardSummary.actionQueue
    ? [
        ...(dashboardSummary.actionQueue.matchingExpired > 0 ||
        dashboardSummary.actionQueue.matchingWithoutParticipants > 0
          ? [
              {
                checks: [
                  `${dashboardSummary.actionQueue.matchingExpired} expired`,
                  `${dashboardSummary.actionQueue.matchingWithoutParticipants} without Partner`,
                ],
                detail: 'Open matching bookings need dispatch review now.',
                href: '/bookings?view=attention',
                lane: 'Matching exceptions',
                owner: 'Dispatch' as const,
                status: 'Needs action',
                tone: 'danger' as const,
                value: `${dashboardSummary.actionQueue.matchingExpired} expired / ${dashboardSummary.actionQueue.matchingWithoutParticipants} no Partner`,
              },
            ]
          : []),
        ...(dashboardSummary.actionQueue.customerChoice > 0
          ? [
              {
                checks: ['Accepted Partner options', 'Customer final decision'],
                detail: 'Customers have Partner options and are waiting to make the final choice.',
                href: '/bookings?view=customer-choice',
                lane: 'Customer choice',
                owner: 'Support' as const,
                status: 'Waiting',
                tone: 'warn' as const,
                value: adminCountLabel(dashboardSummary.actionQueue.customerChoice, 'booking'),
              },
            ]
          : []),
        ...(dashboardSummary.actionQueue.completedPaymentHolds > 0 || recentSettlementGapCount > 0
          ? [
              {
                checks: [
                  adminCountLabel(dashboardSummary.actionQueue.completedPaymentHolds, 'payment hold'),
                  `${adminCountLabel(recentSettlementGapCount, 'missing settlement')} in the last 24 hours`,
                ],
                detail: 'Bookings completed in the last 24 hours need payment or settlement closeout review.',
                href: '/bookings?view=closeout',
                lane: 'Completed closeout',
                owner: 'Finance' as const,
                status: 'Needs action',
                tone: 'danger' as const,
                value: `${dashboardSummary.actionQueue.completedPaymentHolds} hold / ${recentSettlementGapCount} recent`,
              },
            ]
          : []),
      ]
    : [];
  const sampledLanesCoveredByExactSummary = new Set([
    'Live booking command',
    'Customer final choice',
    'Finance closeout',
  ]);
  const operationsAttentionItems =
    dashboardSummaryState === 'unavailable'
      ? []
      : operationsCommandBoard.filter(
          (item) =>
            (item.tone === 'danger' || item.tone === 'warn') &&
            (!dashboardSummary.actionQueue || !sampledLanesCoveredByExactSummary.has(item.lane)),
        );
  const fallbackImmediateCommandItems = [
    ...(dataReliabilityCommandItem ? [dataReliabilityCommandItem] : []),
    ...(dashboardSummaryState === 'unavailable' ? [] : exactActionQueueItems),
    ...operationsAttentionItems,
  ].slice(0, 5);
  const prioritizedAnalyticsActions = prioritizeStartShiftActions(startShiftAnalytics?.needsAction ?? []);
  const analyticsActionQueues = splitStartShiftActions(prioritizedAnalyticsActions);
  const analyticsImmediateCommandItems = prioritizedAnalyticsActions.map(startShiftCommandItem);
  const immediateCommandItems = startShiftAnalytics
    ? analyticsActionQueues.primary.map(startShiftCommandItem)
    : fallbackImmediateCommandItems;
  const secondaryImmediateCommandItems = startShiftAnalytics
    ? analyticsActionQueues.secondary.map(startShiftCommandItem)
    : [];
  const legacyImmediateCommandItems = startShiftAnalytics
    ? analyticsActionQueues.legacy.map(startShiftCommandItem)
    : [];
  const immediateCommandHrefs = new Set(
    (startShiftAnalytics ? analyticsImmediateCommandItems : immediateCommandItems).map((item) => item.href),
  );
  const immediateCommandKeys = new Set(
    startShiftAnalytics
      ? prioritizedAnalyticsActions.filter((item) => item.action.count > 0).map((item) => item.action.key)
      : [],
  );
  const legacyCleanupItemCount = analyticsActionQueues.legacy.reduce(
    (total, item) => total + item.action.count,
    0,
  );
  const financeReviewCommandItems: OperationsCommandBoardItem[] = financeReviewWorkloadLanes
    .filter((lane) => lane.state === 'unavailable' || lane.openCount > 0)
    .map((lane) => ({
      ageing:
        lane.state === 'unavailable'
          ? []
          : [
              ...(lane.unassigned.count > 0
                ? [
                    {
                      href: lane.unassigned.href,
                      label: `Unassigned ${lane.unassigned.count}`,
                      tone: 'warning' as const,
                    },
                  ]
                : []),
              ...(lane.mine.count > 0
                ? [
                    {
                      href: lane.mine.href,
                      label: `Mine ${lane.mine.count}`,
                      tone: 'info' as const,
                    },
                  ]
                : []),
              ...(lane.over48h.count > 0
                ? [
                    {
                      href: lane.over48h.href,
                      label: `48h+ ${lane.over48h.count}`,
                      tone: 'warning' as const,
                    },
                  ]
                : []),
            ],
      checks: [],
      detail:
        lane.state === 'unavailable'
          ? 'This workload source did not respond. Refresh before treating the queue as clear.'
          : `${lane.oldestOccurredAt ? `Oldest ${relativeTimeLabel(lane.oldestOccurredAt)}. ` : ''}${
              lane.isMonetary
                ? `${money(lane.openAmount, 'VND')} remains under review.`
                : `${adminCountLabel(lane.openCount, 'bank account change request')} await independent Finance approval.`
            } Review and assign the queue.`,
      href: lane.primaryHref,
      assigneeLabel: lane.assigneeLabel,
      impactAmount: lane.openAmount,
      impactLabel:
        lane.state === 'available' && lane.isMonetary && lane.openAmount > 0
          ? money(lane.openAmount, 'VND')
          : undefined,
      lane: lane.label,
      mineCount: lane.mine.count,
      oldestAt: lane.oldestOccurredAt,
      oldestLabel: lane.oldestOccurredAt ? relativeTimeLabel(lane.oldestOccurredAt) : undefined,
      owner: 'Finance',
      overdueCount: lane.over48h.count,
      status: lane.status,
      tone: lane.tone,
      unassignedCount: lane.unassigned.count,
      value: adminCountLabel(lane.openCount, 'case', 'cases'),
    }));
  const financeReviewOpenCount = financeReviewWorkloadLanes.reduce(
    (total, lane) => total + lane.openCount,
    0,
  );
  const financeReviewOver48hCount = financeReviewWorkloadLanes.reduce(
    (total, lane) => total + lane.over48h.count,
    0,
  );
  const financeReviewUnassignedCount = financeReviewWorkloadLanes.reduce(
    (total, lane) => total + lane.unassigned.count,
    0,
  );
  const financeReviewMineCount = financeReviewWorkloadLanes.reduce(
    (total, lane) => total + lane.mine.count,
    0,
  );
  const financeReviewOpenAmount = financeReviewWorkloadLanes.reduce(
    (total, lane) => total + (lane.isMonetary ? lane.openAmount : 0),
    0,
  );
  const operationalCommandItems = [...immediateCommandItems, ...secondaryImmediateCommandItems];
  const globalPriorityItems = prioritizeStartShiftCommandItems([
    ...operationalCommandItems,
    ...financeReviewCommandItems,
  ]);
  const nextAction = globalPriorityItems[0] ?? null;
  const openQueueItems = globalPriorityItems.slice(1);
  const operationsCommandBoardAttentionCount = globalPriorityItems.length;
  const operationalOverdueCount = operationalCommandItems.reduce(
    (total, item) => total + (item.overdueCount ?? 0),
    0,
  );
  const totalSlaOverdueCount = financeReviewOver48hCount + operationalOverdueCount;
  const financeOverdueHref =
    financeReviewWorkloadLanes.find((lane) => lane.over48h.count > 0)?.over48h.href ??
    '/finance-overview?view=queues';
  const financeUnassignedHref =
    financeReviewWorkloadLanes.find((lane) => lane.unassigned.count > 0)?.unassigned.href ??
    '/finance-overview?view=queues';
  const liveChartMetrics = [
    {
      href: '/bookings?view=matching',
      label: 'Customer matching wait',
      value: dashboardSummaryState === 'unavailable' ? 'Unavailable' : liveBookingOps.openMatching,
    },
    {
      href: '/bookings?view=active',
      label: 'In service',
      value:
        dashboardSummaryState === 'unavailable'
          ? 'Unavailable'
          : (liveBookingActivity?.inService ??
            bookings.filter((booking) => booking.status === 'IN_SERVICE').length),
    },
    {
      href: financeUnassignedHref,
      label: 'Unassigned',
      value: financeReviewWorkloadState === 'unavailable' ? 'Unavailable' : financeReviewUnassignedCount,
    },
    {
      href: financeOverdueHref,
      label: 'SLA overdue',
      value: financeReviewWorkloadState === 'unavailable' ? 'Unavailable' : totalSlaOverdueCount,
    },
  ] as const;
  const historicalImpactAmount = analyticsActionQueues.legacy.reduce(
    (total, item) => total + item.action.amount,
    0,
  );
  const historicalMoneyCaseCount = analyticsActionQueues.legacy.reduce(
    (total, item) => total + (item.action.amount > 0 ? item.action.count : 0),
    0,
  );
  const historicalOldestAt =
    analyticsActionQueues.legacy
      .map((item) => item.action.oldestAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
  const historicalSummary = [
    adminCountLabel(legacyCleanupItemCount, 'case', 'cases'),
    historicalImpactAmount > 0 ? `${money(historicalImpactAmount, 'VND')} exposed` : null,
    historicalOldestAt ? `oldest ${relativeTimeLabel(historicalOldestAt)}` : null,
  ]
    .filter((label): label is string => Boolean(label))
    .join(' · ');
  const moneyMetricSourceStates: DashboardSourceState[] = [
    paymentSummaryState,
    dashboardSummaryState,
    refundSummaryState,
    cashSummaryState,
    cashSummaryState,
    payoutSummaryState,
    earningSummaryState,
  ];
  const additionalWorkCandidates: StartShiftWorkItem[] = [
    {
      count: partnerSupply.approvalPending,
      href: '/partners?review=approval-pending&sort=oldest',
      key: 'partner-approvals',
      label: 'Partner approvals',
      scope: 'Pending',
      tone: 'warn',
    },
    {
      count: partnerSupply.staleLocation + partnerSupply.noLocation,
      href: '/partners?review=available-blocked-location',
      key: 'partner-location-refresh',
      label: 'Ready Partner location',
      scope: 'Refresh',
      tone: 'warn',
    },
    {
      count: failedNotificationCount,
      href: '/notifications?review=failed',
      key: 'notification-failures',
      label: 'Failed notifications',
      scope: 'Retry',
      tone: 'warn',
    },
    {
      count: appPresence.disabledPushCustomers,
      href: '/customers?review=push',
      key: 'customer-push-disabled',
      label: 'Customer push disabled',
      scope: 'Review',
      tone: 'info',
    },
  ];
  const additionalWorkItems = additionalWorkCandidates
    .filter(
      (item) =>
        item.count > 0 && !immediateCommandKeys.has(item.key) && !immediateCommandHrefs.has(item.href),
    )
    .slice(0, 6);
  const moneyStatusState = combinedDashboardSourceState([
    ...moneyMetricSourceStates,
    financeReviewWorkloadState,
  ]);
  const moneyOpenStatusLabel = [
    financeReviewOver48hCount > 0 ? `${financeReviewOver48hCount} overdue` : null,
    financeReviewUnassignedCount > 0 ? `${financeReviewUnassignedCount} unassigned` : null,
    settlementBacklogCount + historicalMoneyCaseCount > 0
      ? `${settlementBacklogCount + historicalMoneyCaseCount} backlog`
      : null,
    financeReviewOpenAmount + historicalImpactAmount > 0
      ? `${money(financeReviewOpenAmount + historicalImpactAmount, 'VND')} exposed`
      : null,
  ]
    .filter((label): label is string => Boolean(label))
    .join(' · ');
  const hasMoneyRisk =
    paymentHoldCount > 0 ||
    recentSettlementGapCount > 0 ||
    refundSummary.openCount > 0 ||
    cashSettlementSummary.rowCount > 0 ||
    activePayoutBatchCount > 0 ||
    financeReviewOpenCount > 0 ||
    settlementBacklogCount > 0 ||
    historicalMoneyCaseCount > 0;
  const hasPerformanceRankings = Boolean(
    startShiftAnalytics &&
    [
      ...Object.values(startShiftAnalytics.customerRankings),
      ...Object.values(startShiftAnalytics.partnerRankings),
    ].some((rows) => rows.length > 0),
  );
  const hasDemandSupplyDetails = Boolean(
    startShiftAnalytics &&
    (startShiftAnalytics.demandSupply.services.length > 0 ||
      startShiftAnalytics.demandSupply.failureRegions.length > 0 ||
      startShiftAnalytics.buckets.some(
        (bucket) => !bucket.isFuture && (bucket.bookingRequests ?? 0) > (bucket.matched ?? 0),
      )),
  );
  const operatorLabel =
    currentOperatorAccess?.fullName?.trim() || currentOperatorAccess?.email?.trim() || 'Signed-in operator';
  const additionalWorkState = dashboardSummaryState;
  return (
    <AdminPageTemplate
      actions={<StartShiftRefreshButton />}
      contentClassName="dashboard-page"
      title="Shift Command"
    >
      <nav aria-label="Shift context" className="start-shift-scope-nav">
        <div className="start-shift-scope-nav-status">
          <DashboardDataScopeStatus
            dataClass={startShiftSummaryResponse?.dataClass}
            generatedAt={startShiftSummaryResponse?.generatedAt}
            partialSourceCount={
              startShiftSummaryState === 'unavailable' ? 0 : unavailableDashboardSources.length
            }
            refreshSeconds={60}
            scope="current-shift"
            scopeEnd={startShiftSummaryResponse?.scopeEnd}
            scopeStart={startShiftSummaryResponse?.scopeStart}
            sourceState={startShiftScopeSourceState}
          />
        </div>
        <div className="start-shift-operator-context">
          <strong>{operatorLabel}</strong>
          <StatusBadge tone={financeReviewMineCount > 0 ? 'info' : 'success'}>
            Mine {financeReviewMineCount}
          </StatusBadge>
          <StatusBadge tone={financeReviewUnassignedCount > 0 ? 'warning' : 'success'}>
            Unassigned {financeReviewUnassignedCount}
          </StatusBadge>
          <StatusBadge tone={totalSlaOverdueCount > 0 ? 'danger' : 'success'}>
            SLA overdue {totalSlaOverdueCount}
          </StatusBadge>
          <AdminTextLink href="/operations-handoff">Open handoff</AdminTextLink>
        </div>
      </nav>

      <AdminSection
        actions={
          nextAction ? (
            <AdminFormControlLink className="button-primary" href={nextAction.href}>
              <ListChecks size={16} aria-hidden="true" />
              {startShiftCommandActionLabel(nextAction)}
            </AdminFormControlLink>
          ) : null
        }
        className="admin-mt-20"
        id="dashboard-needs-action-now"
        status={
          <StatusBadge
            tone={
              unavailableDashboardSources.length > 0
                ? 'danger'
                : operationsCommandBoardAttentionCount > 0 ||
                    legacyCleanupItemCount > 0 ||
                    staleDashboardSources.length > 0
                  ? 'warning'
                  : 'success'
            }
          >
            {unavailableDashboardSources.length > 0
              ? `${unavailableDashboardSources.length} sources unavailable`
              : nextAction
                ? nextAction.status
                : legacyCleanupItemCount > 0
                  ? 'Live clear'
                  : 'All clear'}
          </StatusBadge>
        }
        title="Next action"
      >
        {nextAction ? (
          <StartShiftActionGrid
            className="start-shift-action-grid start-shift-next-action"
            items={[nextAction]}
            showActionLabel={false}
          />
        ) : (
          <AdminEmptyState
            message={
              legacyCleanupItemCount > 0
                ? 'Historical backlog remains below.'
                : 'All verified queues are clear.'
            }
            title="No live operational cases need action"
          />
        )}
        <StartShiftLiveMetrics metrics={liveChartMetrics} />
      </AdminSection>

      <AdminSection
        className="admin-mt-20"
        id="dashboard-open-queues"
        status={
          <StatusBadge tone={openQueueItems.length > 0 ? 'warning' : 'success'}>
            {adminCountLabel(openQueueItems.length, 'queue')}
          </StatusBadge>
        }
        title="Open queues"
      >
        {openQueueItems.length > 0 ? (
          <StartShiftActionGrid className="start-shift-action-grid" items={openQueueItems} />
        ) : (
          <AdminEmptyState
            message="No lower-priority queue remains open."
            title="No additional open queues"
          />
        )}
      </AdminSection>

      {legacyImmediateCommandItems.length > 0 ? (
        <AdminSection
          className="admin-mt-20"
          id="dashboard-historical-backlog"
          status={
            <StatusBadge tone={historicalImpactAmount > 0 ? 'danger' : 'warning'}>
              {historicalSummary}
            </StatusBadge>
          }
          title="Historical backlog (24h+)"
        >
          <AdminDisclosure
            ariaLabel="Historical backlog (24h+) queues"
            className="start-shift-secondary-queues"
          >
            <summary className="start-shift-secondary-queues-summary">
              <span>
                <strong>Review historical records</strong>
                <small>Separated from live work without reducing their financial severity.</small>
              </span>
              <StatusBadge tone={historicalImpactAmount > 0 ? 'danger' : 'warning'}>
                {adminCountLabel(legacyCleanupItemCount, 'case', 'cases')}
              </StatusBadge>
            </summary>
            <StartShiftActionGrid
              className="start-shift-action-grid start-shift-secondary-action-grid"
              items={legacyImmediateCommandItems}
            />
          </AdminDisclosure>
        </AdminSection>
      ) : null}

      <AdminSection
        actions={<AdminFormControlLink href="/finance-overview">Open finance</AdminFormControlLink>}
        className="admin-mt-20"
        id="dashboard-money-status"
        status={
          <StatusBadge
            tone={
              moneyStatusState === 'unavailable'
                ? 'danger'
                : moneyStatusState === 'stale' || hasMoneyRisk
                  ? 'warning'
                  : 'success'
            }
          >
            {moneyStatusState === 'unavailable'
              ? 'Data unavailable'
              : moneyStatusState === 'stale'
                ? 'Stale'
                : moneyOpenStatusLabel || 'Clear'}
          </StatusBadge>
        }
        title="Money status"
      >
        <AdminEmptyState
          message={
            hasMoneyRisk
              ? 'Finance work is prioritized in Next action and Open queues above.'
              : 'No money queue needs action.'
          }
          title={hasMoneyRisk ? 'Use the prioritized finance queues' : 'Money checks clear'}
        />
      </AdminSection>

      {additionalWorkState !== 'available' || additionalWorkItems.length > 0 ? (
        <AdminSection
          actions={
            additionalWorkState === 'available' ? null : (
              <AdminFormControlLink href={dashboardRefreshHref}>Refresh</AdminFormControlLink>
            )
          }
          className="admin-mt-20"
          id="dashboard-today-work"
          status={
            <StatusBadge
              tone={
                additionalWorkState === 'unavailable'
                  ? 'danger'
                  : additionalWorkState === 'stale'
                    ? 'warning'
                    : additionalWorkItems.length > 0
                      ? 'info'
                      : 'success'
              }
            >
              {additionalWorkState === 'unavailable'
                ? 'Data unavailable'
                : additionalWorkState === 'stale'
                  ? 'Stale'
                  : additionalWorkItems.length === 0
                    ? 'Clear'
                    : additionalWorkItems.length === 1
                      ? '1 queue'
                      : `${additionalWorkItems.length} queues`}
            </StatusBadge>
          }
          title="Additional work"
        >
          {additionalWorkState === 'unavailable' ? (
            <AdminEmptyState framed message="Work queues could not be verified." title="Data unavailable" />
          ) : additionalWorkItems.length > 0 ? (
            <DashboardTraceSummary
              className="start-shift-metric-strip"
              defaultKind="action"
              defaultScope="Pending"
              metrics={additionalWorkItems.map((item) => ({
                href: item.href,
                kind: item.tone === 'warn' || item.tone === 'danger' ? 'action' : 'record',
                label: item.label,
                scope: item.scope,
                value: item.count,
              }))}
            />
          ) : (
            <AdminEmptyState
              framed
              message={
                additionalWorkState === 'stale'
                  ? 'Refresh before confirming that no additional queue is open.'
                  : 'No additional work queue is open.'
              }
              title={additionalWorkState === 'stale' ? 'Stale' : 'Clear'}
            />
          )}
        </AdminSection>
      ) : null}

      <AdminSection
        actions={
          <>
            <AdminFilterChipGroup ariaLabel="Shift command analytics range">
              {dashboardRangeLinks.map((link) =>
                filters.range === link.range ? (
                  <StatusBadgeLink href={link.href} key={link.range} tone="info">
                    {link.label}
                  </StatusBadgeLink>
                ) : (
                  <AdminTextLink href={link.href} key={link.range}>
                    {link.label}
                  </AdminTextLink>
                ),
              )}
            </AdminFilterChipGroup>
          </>
        }
        className="admin-mt-20"
        id="dashboard-today-result"
        status={
          <StatusBadge
            tone={
              startShiftChartState === 'unavailable'
                ? 'danger'
                : startShiftChartState === 'stale'
                  ? 'warning'
                  : 'info'
            }
          >
            {startShiftChartState === 'unavailable'
              ? 'Data unavailable'
              : startShiftChartState === 'stale'
                ? 'Stale'
                : selectedRangeLabel}
          </StatusBadge>
        }
        title={filters.range === 'today' ? 'Today result' : 'Period result'}
      >
        <StartShiftChartWidgetsDeferred
          analytics={startShiftChartAnalytics}
          fallbackBusinessTotals={
            earningsResponse
              ? {
                  grossAmount: money(earnings.grossAmount, earnings.currency),
                  partnerNetAmount: money(earnings.netAmount, earnings.currency),
                  platformFee: money(earnings.platformFee, earnings.currency),
                }
              : undefined
          }
          rangeLabel={selectedRangeLabel}
          section="all"
          state={startShiftChartState}
        />
      </AdminSection>

      {hasPerformanceRankings && startShiftAnalytics ? (
        <AdminSection
          actions={
            <AdminFilterChipGroup ariaLabel="Performance directories">
              <AdminTextLink href="/customers">Customers</AdminTextLink>
              <AdminTextLink href="/partners">Partners</AdminTextLink>
            </AdminFilterChipGroup>
          }
          className="admin-mt-20"
          id="dashboard-performance-leaders"
          status={<StatusBadge tone="info">{selectedRangeLabel}</StatusBadge>}
          title="Customer and Partner leaders"
        >
          <StartShiftRankingWidgets analytics={startShiftAnalytics} rangeLabel={selectedRangeLabel} />
        </AdminSection>
      ) : null}

      {hasDemandSupplyDetails && startShiftAnalytics ? (
        <AdminSection
          actions={
            <AdminFilterChipGroup ariaLabel="Demand and supply workspaces">
              <AdminTextLink href="/services">Services</AdminTextLink>
              <AdminTextLink href="/vietnam-overview">Vietnam Overview</AdminTextLink>
            </AdminFilterChipGroup>
          }
          className="admin-mt-20"
          id="dashboard-demand-supply"
          status={
            <StatusBadge tone={partnerSupply.onlineAvailable > 0 ? 'success' : 'warning'}>
              {partnerSupply.onlineAvailable} ready now
            </StatusBadge>
          }
          title="Demand and supply"
        >
          <StartShiftDemandSupplyWidgets
            analytics={startShiftAnalytics}
            readyPartners={partnerSupply.onlineAvailable}
          />
        </AdminSection>
      ) : null}
    </AdminPageTemplate>
  );
}

function buildDashboardFilters(params: Record<string, string | string[] | undefined>): DashboardFilters {
  return {
    range: buildDashboardRange(params),
  };
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
