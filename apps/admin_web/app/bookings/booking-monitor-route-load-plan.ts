import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { readPostMatchCancellationReasonFilter } from './booking-post-match-cancellation-reason';

export type BookingMonitorRouteKind = 'all' | 'completed' | 'postMatchCancellations';

const BOOKING_MONITOR_PAGE_SIZE = 20;
const COMPLETED_BOOKING_PAGE_SIZE = 25;
const POST_MATCH_CANCELLATION_PAGE_SIZE = 25;
const BOOKING_MONITOR_GATE_AUDIT_TAKE = 20;
const BOOKING_HISTORY_VIEWS = new Set([
  'all',
  'pre-match-cancelled',
  'preferred-rejected',
  'preferred-no-response',
  'usage-unresolved',
]);
const BOOKING_MONITOR_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.travelBufferMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
] as const;

export type BookingMonitorRouteLoadPlan = {
  readonly bookingGateAuditHref: string | null;
  readonly bookingsHref: string;
  readonly summaryHref: string;
  readonly policySettingsHref: string;
};

export function buildBookingMonitorRouteLoadPlan(
  params: Record<string, string | string[] | undefined> | undefined,
  kind: BookingMonitorRouteKind,
): BookingMonitorRouteLoadPlan {
  const view = readSingleSearchParam(params?.view);
  return {
    bookingGateAuditHref: kind === 'all' && view === 'blocked-create' ? bookingCreateRejectionAuditPath() : null,
    bookingsHref: bookingListApiPath(params, kind),
    summaryHref: bookingSummaryApiPath(params, kind),
    policySettingsHref: `/admin/operational-policy?${new URLSearchParams({
      keys: BOOKING_MONITOR_POLICY_KEYS.join(','),
    }).toString()}`,
  };
}

function bookingSummaryApiPath(
  params: Record<string, string | string[] | undefined> | undefined,
  kind: BookingMonitorRouteKind,
) {
  if (kind === 'all') {
    return '/admin/bookings/summary';
  }

  const searchParams = new URLSearchParams();
  const dateRange = readSingleSearchParam(params?.dateRange) ??
    (kind === 'postMatchCancellations' ? '30d' : 'today');
  if (kind === 'postMatchCancellations') {
    searchParams.set('dateRange', dateRange);
    if (dateRange === 'custom') {
      setOptionalSearchParam(searchParams, 'dateFrom', readSingleSearchParam(params?.dateFrom) ?? '');
      setOptionalSearchParam(searchParams, 'dateTo', readSingleSearchParam(params?.dateTo) ?? '');
    }
    return `/admin/bookings/post-match-cancellations-summary?${searchParams.toString()}`;
  }
  const q = readSingleSearchParam(params?.q)?.trim();
  setOptionalSearchParam(searchParams, 'age', readSingleSearchParam(params?.age) ?? '');
  searchParams.set('dateRange', dateRange);
  setOptionalSearchParam(searchParams, 'q', q ?? '');
  if (dateRange === 'custom') {
    setOptionalSearchParam(searchParams, 'dateFrom', readSingleSearchParam(params?.dateFrom) ?? '');
    setOptionalSearchParam(searchParams, 'dateTo', readSingleSearchParam(params?.dateTo) ?? '');
  }

  const path =
    kind === 'completed'
      ? '/admin/bookings/completed-operations-summary'
      : '/admin/bookings/post-match-cancellations-summary';
  return `${path}?${searchParams.toString()}`;
}

function bookingListApiPath(
  params: Record<string, string | string[] | undefined> | undefined,
  kind: BookingMonitorRouteKind,
) {
  const searchParams = new URLSearchParams();
  const dateRange = readSingleSearchParam(params?.dateRange) ??
    (kind === 'postMatchCancellations' ? '30d' : 'today');
  const view = readSingleSearchParam(params?.view);
  const statusGroup = bookingListStatusGroup(kind, view);
  const page = readPositiveInteger(readSingleSearchParam(params?.page)) ?? 1;
  const q = readSingleSearchParam(params?.q)?.trim();
  const age = readSingleSearchParam(params?.age) ?? '';
  const requestedSort = readSingleSearchParam(params?.sort);
  const sort = requestedSort ?? bookingListDefaultSort(kind, view);
  const sla = readSingleSearchParam(params?.sla) ?? '';
  const cancellationReason = readPostMatchCancellationReasonFilter(params?.cancellationReason);

  if (bookingListUsesDateRange(kind, view)) {
    searchParams.set('dateRange', dateRange);
  }
  if (statusGroup) {
    searchParams.set('statusGroup', statusGroup);
  }
  searchParams.set('page', String(page));
  searchParams.set(
    'pageSize',
    String(
      kind === 'all'
        ? BOOKING_MONITOR_PAGE_SIZE
        : kind === 'completed'
          ? COMPLETED_BOOKING_PAGE_SIZE
          : POST_MATCH_CANCELLATION_PAGE_SIZE,
    ),
  );
  setOptionalSearchParam(searchParams, 'q', q ?? '');
  setOptionalSearchParam(searchParams, 'age', age);
  setOptionalSearchParam(searchParams, 'sort', kind === 'all' ? (requestedSort ?? '') : sort);
  if (kind === 'postMatchCancellations' && view !== 'no-show' && cancellationReason !== 'all') {
    searchParams.set('cancellationReason', cancellationReason);
  }
  setOptionalSearchParam(
    searchParams,
    'sla',
    statusGroup === 'matching-delays' ||
      statusGroup === 'post-match-cancellations-review' ||
      statusGroup === 'post-match-cancellations-no-show'
      ? sla
      : '',
  );
  if (bookingListUsesDateRange(kind, view) && dateRange === 'custom') {
    setOptionalSearchParam(searchParams, 'dateFrom', readSingleSearchParam(params?.dateFrom) ?? '');
    setOptionalSearchParam(searchParams, 'dateTo', readSingleSearchParam(params?.dateTo) ?? '');
  }

  return `/admin/bookings/page?${searchParams.toString()}`;
}

export function bookingListDefaultSort(kind: BookingMonitorRouteKind, view?: string) {
  if (kind === 'completed') return view === 'all' ? 'newest' : 'oldest';
  if (kind === 'postMatchCancellations') {
    return view === 'post-match-cancellations' ? 'newest' : 'oldest';
  }
  return view === undefined ||
    view === 'attention' ||
    view === 'matching-delays' ||
    view === 'handoff-repair' ||
    view === 'no-supply' ||
    view === 'data-anomaly'
    ? 'oldest'
    : 'newest';
}

function bookingListStatusGroup(kind: BookingMonitorRouteKind, view?: string) {
  switch (kind) {
    case 'completed': {
      const statusGroups: Record<string, string> = {
        payment: 'completed-payment',
        'cash-debt': 'completed-cash-debt',
        closeout: 'completed-closeout',
        pricing: 'completed-pricing',
        'refund-review': 'completed-refund',
        expired: 'completed-expired',
        all: 'completed',
      };
      return statusGroups[view ?? 'closeout'] ?? 'completed-closeout';
    }
    case 'postMatchCancellations': {
      const statusGroups: Record<string, string> = {
        'manual-decision': 'post-match-cancellations-review',
        'post-match-cancellations': 'post-match-cancellations',
        'no-show': 'post-match-cancellations-no-show',
      };
      return statusGroups[view ?? 'manual-decision'] ?? 'post-match-cancellations-review';
    }
    case 'all':
    default:
      if (view === 'all') return undefined;
      if (view === 'active') return 'realtime';
      if (view === 'data-anomaly') return 'data-anomaly';
      if (view === 'matching') return 'matching';
      if (view === 'in-service') return 'in-service';
      if (view === 'matching-delays') return 'matching-delays';
      if (view === 'first-pick') return 'preferred-pending';
      if (view === 'marketplace') return 'marketplace-active';
      if (view === 'customer-choice') return 'customer-choice';
      if (view === 'pre-match-cancelled') return 'pre-match-cancellations';
      if (view === 'preferred-rejected') return 'preferred-rejected';
      if (view === 'preferred-no-response') return 'preferred-no-response';
      if (view === 'usage-unresolved') return 'usage-unresolved';
      if (view === 'matched') return 'matched';
      if (view === 'handoff-repair') return 'handoff-repair';
      if (view === 'no-supply') return 'no-supply';
      if (!view || view === 'attention') return 'needs-action';
      return 'realtime';
  }
}

function bookingListUsesDateRange(kind: BookingMonitorRouteKind, view?: string) {
  if (kind === 'postMatchCancellations') return view === 'post-match-cancellations';
  return kind === 'completed' || BOOKING_HISTORY_VIEWS.has(view ?? '');
}

function bookingCreateRejectionAuditPath() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const params = new URLSearchParams({
    action: 'booking.create.rejected',
    take: String(BOOKING_MONITOR_GATE_AUDIT_TAKE),
    from: start.toISOString(),
    to: end.toISOString(),
  });
  return `/admin/audit-logs?${params.toString()}`;
}

function setOptionalSearchParam(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function readSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readPositiveInteger(value?: string) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
