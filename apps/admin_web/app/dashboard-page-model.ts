import { normalizeDateRange, readSearchParam } from '../lib/date-range';

export type DashboardDetailsMode = 'summary' | 'all';

type DashboardParams = Record<string, string | string[] | undefined>;

export type DashboardViewMode = {
  readonly detailsMode: DashboardDetailsMode;
  readonly shouldRenderFullDashboard: boolean;
};

export type DashboardDataHrefs = {
  readonly appSessionsHref: string;
  readonly bookingGateAuditHref: string;
  readonly bookingsHref: string;
  readonly earningsHref: string;
  readonly notificationsHref: string;
  readonly operationalPolicyHref: string | null;
  readonly partnersHref: string;
  readonly paymentsHref: string;
  readonly payoutBatchesHref: string;
  readonly refundsHref: string;
  readonly usersHref: string;
};

const DASHBOARD_BOOKING_TAKE = 100;
const DASHBOARD_NOTIFICATION_TAKE = 20;
const DASHBOARD_AUDIT_TAKE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  return {
    appSessionsHref: '/admin/app-sessions',
    bookingGateAuditHref: buildDashboardDateScopedHref(
      '/admin/audit-logs',
      {
        action: 'booking.create.rejected',
        take: String(DASHBOARD_AUDIT_TAKE),
      },
      range,
    ),
    bookingsHref: `/admin/bookings?${new URLSearchParams({
      dateRange: range,
      take: String(DASHBOARD_BOOKING_TAKE),
    }).toString()}`,
    earningsHref: '/admin/earnings',
    notificationsHref: buildDashboardDateScopedHref(
      '/admin/notifications',
      { take: String(DASHBOARD_NOTIFICATION_TAKE) },
      range,
    ),
    operationalPolicyHref: viewMode.shouldRenderFullDashboard ? '/admin/operational-policy' : null,
    partnersHref: '/admin/partners?view=list',
    paymentsHref: '/admin/payments',
    payoutBatchesHref: '/admin/payout-batches',
    refundsHref: '/admin/refunds',
    usersHref: '/admin/users',
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
