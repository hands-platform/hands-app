import { normalizeDateRange, readSearchParam } from '../lib/date-range';
import { OPERATIONAL_POLICY_KEYS } from '../lib/operations-policy';

export type DashboardDetailsMode = 'summary' | 'all' | 'booking' | 'operations';
export type DashboardOperationsMode = 'live' | 'analysis' | 'partner' | 'closeout';

type DashboardParams = Record<string, string | string[] | undefined>;

export type DashboardViewMode = {
  readonly detailsMode: DashboardDetailsMode;
  readonly operationsMode: DashboardOperationsMode;
  readonly shouldRenderFullDashboard: boolean;
};

export type DashboardDataHrefs = {
  readonly appSessionsHref: string | null;
  readonly bookingGateAuditHref: string | null;
  readonly bookingsHref: string | null;
  readonly cashSettlementSummaryHref: string;
  readonly dashboardSummaryHref: string;
  readonly earningsHref: string | null;
  readonly earningsSummaryHref: string;
  readonly notificationSummaryHref: string;
  readonly notificationsHref: string | null;
  readonly operationalPolicyHref: string | null;
  readonly partnersHref: string | null;
  readonly paymentsHref: string | null;
  readonly paymentSummaryHref: string;
  readonly payoutBatchSummaryHref: string;
  readonly payoutBatchesHref: string | null;
  readonly refundsHref: string | null;
  readonly refundsSummaryHref: string;
  readonly startShiftSummaryHref: string;
  readonly startShiftAnalyticsHref: string;
};

type DashboardListDataRequirements = {
  readonly appSessions: boolean;
  readonly audit: boolean;
  readonly earnings: boolean;
  readonly notifications: boolean;
  readonly operationalPolicy: boolean;
  readonly partners: boolean;
  readonly payments: boolean;
  readonly payoutBatches: boolean;
  readonly refunds: boolean;
};

const DASHBOARD_BOOKING_TAKE = 20;
const DASHBOARD_NOTIFICATION_TAKE = 10;
const DASHBOARD_AUDIT_TAKE = 10;
const DASHBOARD_FINANCE_TAKE = 10;
const DASHBOARD_APP_SESSION_TAKE = 5;
const DASHBOARD_SUMMARY_NOTIFICATION_TAKE = 5;
const DASHBOARD_SUMMARY_AUDIT_TAKE = 5;
const DASHBOARD_SUMMARY_FINANCE_TAKE = 5;
const DASHBOARD_SUMMARY_APP_SESSION_TAKE = 5;
const DASHBOARD_PARTNER_TAKE = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
  OPERATIONAL_POLICY_KEYS.preferredAcceptMode,
  OPERATIONAL_POLICY_KEYS.travelBufferMinutes,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
  OPERATIONAL_POLICY_KEYS.cancellationAfterMatch,
  OPERATIONAL_POLICY_KEYS.noShowPartnerReport,
  OPERATIONAL_POLICY_KEYS.partnerAlertChannel,
] as const;
const DASHBOARD_OPERATIONAL_POLICY_HREF = `/admin/operational-policy?${new URLSearchParams({
  keys: DASHBOARD_OPERATIONAL_POLICY_KEYS.join(','),
}).toString()}`;

export function buildDashboardViewMode(params: DashboardParams): DashboardViewMode {
  // Start Shift is intentionally summary-only. Historical diagnostics live in their
  // dedicated operational, finance, audit, and Developer/System workspaces.
  const detailsMode = normalizeDashboardDetailsMode(readSearchParam(params.details));
  return {
    detailsMode,
    operationsMode: 'live',
    shouldRenderFullDashboard: false,
  };
}

export function buildDashboardDataHrefs(params: DashboardParams): DashboardDataHrefs {
  const viewMode = buildDashboardViewMode(params);
  const range = buildDashboardRange(params);
  const limits = dashboardDataLimits(viewMode);
  const requirements = dashboardListDataRequirements(viewMode);
  return {
    startShiftAnalyticsHref: `/admin/dashboard/start-shift-analytics?${new URLSearchParams({
      dateRange: range,
    }).toString()}`,
    startShiftSummaryHref: `/admin/dashboard/start-shift-summary?${new URLSearchParams({
      dateRange: range,
    }).toString()}`,
    dashboardSummaryHref: `/admin/dashboard/summary?${new URLSearchParams({ dateRange: range }).toString()}`,
    cashSettlementSummaryHref: buildDashboardRangeScopedHref(
      '/admin/cash-settlement-summary',
      {},
      range,
    ),
    appSessionsHref: requirements.appSessions
      ? `/admin/app-sessions?${new URLSearchParams({
          take: String(limits.appSessions),
        }).toString()}`
      : null,
    bookingGateAuditHref: requirements.audit
      ? buildDashboardDateScopedHref(
          '/admin/audit-logs',
          {
            action: 'booking.create.rejected',
            take: String(limits.audit),
          },
          range,
        )
      : null,
    bookingsHref: viewMode.shouldRenderFullDashboard
      ? `/admin/bookings?${new URLSearchParams({
          dateRange: range,
          take: String(DASHBOARD_BOOKING_TAKE),
        }).toString()}`
      : null,
    earningsHref: requirements.earnings
      ? buildDashboardRangeScopedHref('/admin/earnings', { take: String(limits.finance) }, range)
      : null,
    earningsSummaryHref: buildDashboardRangeScopedHref('/admin/earnings/summary', {}, range),
    notificationsHref: requirements.notifications
      ? buildDashboardDateScopedHref('/admin/notifications', { take: String(limits.notifications) }, range)
      : null,
    notificationSummaryHref: buildDashboardDateScopedHref('/admin/notifications/summary', {}, range),
    operationalPolicyHref: requirements.operationalPolicy ? DASHBOARD_OPERATIONAL_POLICY_HREF : null,
    partnersHref: requirements.partners
      ? `/admin/partners/list-providers?${new URLSearchParams({
          take: String(DASHBOARD_PARTNER_TAKE),
        }).toString()}`
      : null,
    paymentsHref: requirements.payments
      ? buildDashboardRangeScopedHref('/admin/payments', { take: String(limits.finance) }, range)
      : null,
    paymentSummaryHref: buildDashboardRangeScopedHref('/admin/payments/summary', {}, range),
    payoutBatchesHref: requirements.payoutBatches
      ? buildDashboardRangeScopedHref('/admin/payout-batches', { take: String(limits.finance) }, range)
      : null,
    payoutBatchSummaryHref: buildDashboardRangeScopedHref('/admin/payout-batches/summary', {}, range),
    refundsHref: requirements.refunds
      ? buildDashboardRangeScopedHref('/admin/refunds', { take: String(limits.finance) }, range)
      : null,
    refundsSummaryHref: buildDashboardRangeScopedHref('/admin/refunds/summary', {}, range),
  };
}

function dashboardListDataRequirements(
  _viewMode: DashboardViewMode,
): DashboardListDataRequirements {
  void _viewMode;
  return {
    appSessions: false,
    audit: false,
    earnings: false,
    notifications: false,
    operationalPolicy: false,
    partners: false,
    payments: false,
    payoutBatches: false,
    refunds: false,
  };
}

function dashboardDataLimits(viewMode: DashboardViewMode) {
  if (viewMode.shouldRenderFullDashboard) {
    return {
      appSessions: DASHBOARD_APP_SESSION_TAKE,
      audit: DASHBOARD_AUDIT_TAKE,
      finance: DASHBOARD_FINANCE_TAKE,
      notifications: DASHBOARD_NOTIFICATION_TAKE,
    };
  }

  return {
    appSessions: DASHBOARD_SUMMARY_APP_SESSION_TAKE,
    audit: DASHBOARD_SUMMARY_AUDIT_TAKE,
    finance: DASHBOARD_SUMMARY_FINANCE_TAKE,
    notifications: DASHBOARD_SUMMARY_NOTIFICATION_TAKE,
  };
}

export function buildDashboardRange(params: DashboardParams) {
  const rangeParam = readSearchParam(params.range);
  const range = rangeParam ? normalizeDateRange(rangeParam) : 'today';
  return range === 'all' || range === '90d' ? '30d' : range;
}

export function buildDashboardDetailsHref(_detailsMode: DashboardDetailsMode, params: DashboardParams) {
  const query = new URLSearchParams();
  const range = readSearchParam(params.range);
  if (range) {
    query.set('range', range);
  }
  const value = query.toString();
  return value ? `/?${value}` : '/';
}

export function buildDashboardOperationsHref(
  _operationsMode: DashboardOperationsMode,
  params: DashboardParams,
) {
  const query = new URLSearchParams();
  const range = readSearchParam(params.range);
  if (range) {
    query.set('range', range);
  }
  const value = query.toString();
  return value ? `/?${value}` : '/';
}

function normalizeDashboardDetailsMode(_value: string): DashboardDetailsMode {
  void _value;
  return 'summary';
}

function buildDashboardDateScopedHref(
  pathname: string,
  baseParams: Record<string, string>,
  range: ReturnType<typeof normalizeDateRange>,
) {
  const query = new URLSearchParams(baseParams);
  const window = dashboardDateRangeWindow(range);
  if (window.from) {
    query.set('from', window.from.toISOString());
  }
  if (window.to) {
    query.set('to', window.to.toISOString());
  }
  return `${pathname}?${query.toString()}`;
}

function buildDashboardRangeScopedHref(
  pathname: string,
  baseParams: Record<string, string>,
  range: ReturnType<typeof normalizeDateRange>,
) {
  const query = new URLSearchParams(baseParams);
  query.set('range', range);
  return `${pathname}?${query.toString()}`;
}

function dashboardDateRangeWindow(range: ReturnType<typeof normalizeDateRange>, now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  if (range === 'today') {
    return { from: todayStart, to: tomorrowStart };
  }
  if (range === '7d') {
    return { from: new Date(tomorrowStart.getTime() - 7 * DAY_MS), to: tomorrowStart };
  }
  if (range === '30d') {
    return { from: new Date(tomorrowStart.getTime() - 30 * DAY_MS), to: tomorrowStart };
  }
  return {};
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
