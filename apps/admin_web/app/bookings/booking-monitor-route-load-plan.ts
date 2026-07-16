import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

export type BookingMonitorRouteKind = 'all' | 'completed' | 'postMatchCancellations';

const BOOKING_MONITOR_LIST_TAKE = 10;
const BOOKING_MONITOR_GATE_AUDIT_TAKE = 10;
const BOOKING_MONITOR_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
  OPERATIONAL_POLICY_KEYS.travelBufferMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
  OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
] as const;

export type BookingMonitorRouteLoadPlan = {
  readonly bookingGateAuditHref: string;
  readonly bookingsHref: string;
  readonly policySettingsHref: string;
};

export function buildBookingMonitorRouteLoadPlan(
  params: Record<string, string | string[] | undefined> | undefined,
  kind: BookingMonitorRouteKind,
): BookingMonitorRouteLoadPlan {
  return {
    bookingGateAuditHref: `/admin/audit-logs?action=booking.create.rejected&take=${BOOKING_MONITOR_GATE_AUDIT_TAKE}`,
    bookingsHref: bookingListApiPath(params, kind),
    policySettingsHref: `/admin/operational-policy?${new URLSearchParams({
      keys: BOOKING_MONITOR_POLICY_KEYS.join(','),
    }).toString()}`,
  };
}

function bookingListApiPath(
  params: Record<string, string | string[] | undefined> | undefined,
  kind: BookingMonitorRouteKind,
) {
  const searchParams = new URLSearchParams();
  const dateRange = readSingleSearchParam(params?.dateRange) ?? 'today';
  const statusGroup = bookingListStatusGroup(kind, readSingleSearchParam(params?.view));

  searchParams.set('dateRange', dateRange);
  if (statusGroup) {
    searchParams.set('statusGroup', statusGroup);
  }
  searchParams.set('take', String(BOOKING_MONITOR_LIST_TAKE));
  if (dateRange === 'custom') {
    setOptionalSearchParam(searchParams, 'dateFrom', readSingleSearchParam(params?.dateFrom) ?? '');
    setOptionalSearchParam(searchParams, 'dateTo', readSingleSearchParam(params?.dateTo) ?? '');
  }

  return `/admin/bookings?${searchParams.toString()}`;
}

function bookingListStatusGroup(kind: BookingMonitorRouteKind, view?: string) {
  switch (kind) {
    case 'completed':
      return 'completed';
    case 'postMatchCancellations':
      return 'post-match-cancellations';
    case 'all':
    default:
      return view === 'all' ? undefined : 'realtime';
  }
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
