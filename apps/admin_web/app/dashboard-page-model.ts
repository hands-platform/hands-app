import { normalizeDateRange, readSearchParam } from '../lib/date-range';
import { OPERATIONAL_POLICY_KEYS } from '../lib/operations-policy';

export type DashboardDetailsMode = 'summary' | 'all';

type DashboardParams = Record<string, string | string[] | undefined>;

export type DashboardViewMode = {
  readonly detailsMode: DashboardDetailsMode;
  readonly shouldRenderFullDashboard: boolean;
};

export type DashboardDataHrefs = {
  readonly appSessionsHref: string | null;
  readonly bookingGateAuditHref: string | null;
  readonly bookingsHref: string;
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
  readonly usersHref: string | null;
};

const DASHBOARD_BOOKING_TAKE = 50;
const DASHBOARD_NOTIFICATION_TAKE = 20;
const DASHBOARD_AUDIT_TAKE = 20;
const DASHBOARD_FINANCE_TAKE = 25;
const DASHBOARD_APP_SESSION_TAKE = 10;
const DASHBOARD_SUMMARY_BOOKING_TAKE = 5;
const DASHBOARD_SUMMARY_NOTIFICATION_TAKE = 5;
const DASHBOARD_SUMMARY_AUDIT_TAKE = 5;
const DASHBOARD_SUMMARY_FINANCE_TAKE = 5;
const DASHBOARD_SUMMARY_APP_SESSION_TAKE = 5;
const DASHBOARD_USER_TAKE = 25;
const DASHBOARD_PARTNER_TAKE = 25;
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
  const detailsMode = normalizeDashboardDetailsMode(readSearchParam(params.details));
  return {
    detailsMode,
    shouldRenderFullDashboard: detailsMode === 'all',
  };
}

export function buildDashboardDataHrefs(params: DashboardParams): DashboardDataHrefs {
  const viewMode = buildDashboardViewMode(params);
  const range = buildDashboardRange(params);
  const limits = dashboardDataLimits(viewMode);
  return {
    dashboardSummaryHref: '/admin/dashboard/summary',
    cashSettlementSummaryHref: buildDashboardRangeScopedHref(
      '/admin/cash-settlement-summary',
      {},
      range,
    ),
    appSessionsHref: viewMode.shouldRenderFullDashboard
      ? `/admin/app-sessions?${new URLSearchParams({
          take: String(limits.appSessions),
        }).toString()}`
      : null,
    bookingGateAuditHref: viewMode.shouldRenderFullDashboard
      ? buildDashboardDateScopedHref(
          '/admin/audit-logs',
          {
            action: 'booking.create.rejected',
            take: String(limits.audit),
          },
          range,
        )
      : null,
    bookingsHref: `/admin/bookings?${new URLSearchParams({
      dateRange: range,
      take: String(limits.bookings),
    }).toString()}`,
    earningsHref: viewMode.shouldRenderFullDashboard
      ? buildDashboardRangeScopedHref('/admin/earnings', { take: String(limits.finance) }, range)
      : null,
    earningsSummaryHref: buildDashboardRangeScopedHref('/admin/earnings/summary', {}, range),
    notificationsHref: viewMode.shouldRenderFullDashboard
      ? buildDashboardDateScopedHref('/admin/notifications', { take: String(limits.notifications) }, range)
      : null,
    notificationSummaryHref: buildDashboardDateScopedHref('/admin/notifications/summary', {}, range),
    operationalPolicyHref: viewMode.shouldRenderFullDashboard ? DASHBOARD_OPERATIONAL_POLICY_HREF : null,
    partnersHref: viewMode.shouldRenderFullDashboard
      ? `/admin/partners/list-providers?${new URLSearchParams({
          take: String(DASHBOARD_PARTNER_TAKE),
        }).toString()}`
      : null,
    paymentsHref: viewMode.shouldRenderFullDashboard
      ? buildDashboardRangeScopedHref('/admin/payments', { take: String(limits.finance) }, range)
      : null,
    paymentSummaryHref: buildDashboardRangeScopedHref('/admin/payments/summary', {}, range),
    payoutBatchesHref: viewMode.shouldRenderFullDashboard
      ? buildDashboardRangeScopedHref('/admin/payout-batches', { take: String(limits.finance) }, range)
      : null,
    payoutBatchSummaryHref: buildDashboardRangeScopedHref('/admin/payout-batches/summary', {}, range),
    refundsHref: viewMode.shouldRenderFullDashboard
      ? buildDashboardRangeScopedHref('/admin/refunds', { take: String(limits.finance) }, range)
      : null,
    refundsSummaryHref: buildDashboardRangeScopedHref('/admin/refunds/summary', {}, range),
    usersHref: viewMode.shouldRenderFullDashboard
      ? `/admin/users?${new URLSearchParams({ take: String(DASHBOARD_USER_TAKE) }).toString()}`
      : null,
  };
}

function dashboardDataLimits(viewMode: DashboardViewMode) {
  if (viewMode.shouldRenderFullDashboard) {
    return {
      appSessions: DASHBOARD_APP_SESSION_TAKE,
      audit: DASHBOARD_AUDIT_TAKE,
      bookings: DASHBOARD_BOOKING_TAKE,
      finance: DASHBOARD_FINANCE_TAKE,
      notifications: DASHBOARD_NOTIFICATION_TAKE,
    };
  }

  return {
    appSessions: DASHBOARD_SUMMARY_APP_SESSION_TAKE,
    audit: DASHBOARD_SUMMARY_AUDIT_TAKE,
    bookings: DASHBOARD_SUMMARY_BOOKING_TAKE,
    finance: DASHBOARD_SUMMARY_FINANCE_TAKE,
    notifications: DASHBOARD_SUMMARY_NOTIFICATION_TAKE,
  };
}

export function buildDashboardRange(params: DashboardParams) {
  const rangeParam = readSearchParam(params.range);
  return rangeParam ? normalizeDateRange(rangeParam) : 'today';
}

export function buildDashboardDetailsHref(detailsMode: DashboardDetailsMode, params: DashboardParams) {
  const query = new URLSearchParams();
  const range = readSearchParam(params.range);
  if (range) {
    query.set('range', range);
  }
  if (detailsMode === 'all') {
    query.set('details', 'all');
  }
  const value = query.toString();
  return value ? `/?${value}` : '/';
}

function normalizeDashboardDetailsMode(value: string): DashboardDetailsMode {
  return value === 'all' ? 'all' : 'summary';
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
