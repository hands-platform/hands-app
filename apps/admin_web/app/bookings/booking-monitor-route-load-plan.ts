export type BookingMonitorRouteKind = 'all' | 'completed' | 'postMatchCancellations';

const BOOKING_MONITOR_LIST_TAKE = 25;
const BOOKING_MONITOR_GATE_AUDIT_TAKE = 25;

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
    policySettingsHref: '/admin/operational-policy',
  };
}

function bookingListApiPath(
  params: Record<string, string | string[] | undefined> | undefined,
  kind: BookingMonitorRouteKind,
) {
  const searchParams = new URLSearchParams();
  const dateRange = readSingleSearchParam(params?.dateRange) ?? 'today';

  searchParams.set('dateRange', dateRange);
  searchParams.set('statusGroup', bookingListStatusGroup(kind));
  searchParams.set('take', String(BOOKING_MONITOR_LIST_TAKE));
  if (dateRange === 'custom') {
    setOptionalSearchParam(searchParams, 'dateFrom', readSingleSearchParam(params?.dateFrom) ?? '');
    setOptionalSearchParam(searchParams, 'dateTo', readSingleSearchParam(params?.dateTo) ?? '');
  }

  return `/admin/bookings?${searchParams.toString()}`;
}

function bookingListStatusGroup(kind: BookingMonitorRouteKind) {
  switch (kind) {
    case 'completed':
      return 'completed';
    case 'postMatchCancellations':
      return 'post-match-cancellations';
    case 'all':
    default:
      return 'realtime';
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
