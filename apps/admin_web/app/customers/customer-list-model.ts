import { formatDateTime as formatDate } from '../../lib/admin-format';
import type { AdminCustomer } from '../../lib/admin-api';
import type { CustomerFilters } from './customer-filters';

const ACTIVE_STATUSES = [
  'CREATED',
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
];
const CLOSED_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];

export function filterCustomerRows(rows: CustomerRow[], filters: CustomerFilters) {
  const query = filters.q.toLowerCase();
  return rows.filter((row) => {
    if (
      query &&
      ![
        row.name,
        row.phone,
        row.email,
        row.id,
        row.commonService,
        row.commonArea,
        row.commonPartner,
        row.latestMemoTitle,
        row.latestMemoDetail,
      ].some((value) => value.toLowerCase().includes(query))
    ) {
      return false;
    }
    if (filters.booking === 'active' && row.activeBookings === 0) return false;
    if (filters.booking === 'completed' && row.completedBookings === 0) return false;
    if (filters.booking === 'closed' && row.cancelledBookings === 0) return false;
    if (filters.booking === 'no-booking' && row.bookingCount > 0) return false;
    if (filters.bookingFlow === 'open-matching' && row.openMatchingBookings === 0) return false;
    if (filters.bookingFlow === 'first-pick' && row.firstPickBookings === 0) return false;
    if (filters.bookingFlow === 'customer-choice' && row.customerChoiceBookings === 0) return false;
    if (filters.bookingFlow === 'chat-live' && row.chatRooms === 0) return false;
    if (filters.bookingFlow === 'chat-missing' && row.chatMissingBookings === 0) return false;
    if (filters.bookingFlow === 'service-live' && row.serviceLiveBookings === 0) return false;
    if (filters.bookingFlow === 'completed-work' && row.completedBookings === 0) return false;
    if (filters.bookingFlow === 'closed-record' && row.cancelledBookings === 0) return false;
    if (filters.bookingFlow === 'address-snapshot' && row.addressSnapshotBookings === 0) return false;
    if (filters.reachability === 'in-app' && !row.isLive) return false;
    if (filters.reachability === 'push-ready' && !row.pushReachable) return false;
    if (filters.reachability === 'no-push' && row.pushReachable) return false;
    if (filters.reachability === 'no-session' && row.lastSeenAt) return false;
    if (filters.seen === 'live' && !row.isLive) return false;
    if (filters.seen === '7d' && !isWithinRecentDays(row.lastSeenAt, 7)) return false;
    if (filters.seen === '30d' && !isWithinRecentDays(row.lastSeenAt, 30)) return false;
    if (filters.seen === 'inactive-30d' && isWithinRecentDays(row.lastSeenAt, 30)) return false;
    if (filters.seen === 'never' && row.lastSeenAt) return false;
    if (filters.address === 'saved' && row.addressCount === 0) return false;
    if (filters.address === 'missing' && row.addressCount > 0) return false;
    if (filters.payment === 'captured' && row.capturedSpend <= 0) return false;
    if (filters.payment === 'issue' && row.paymentIssues === 0) return false;
    if (filters.payment === 'refund' && row.refundAmount <= 0) return false;
    if (filters.payment === 'no-payment' && row.paymentCount > 0) return false;
    if (filters.chat === 'has-chat' && row.chatRooms === 0) return false;
    if (filters.chat === 'no-chat' && row.chatRooms > 0) return false;
    if (filters.memo === 'has-memo' && row.memoCount === 0) return false;
    if (filters.memo === 'no-memo' && row.memoCount > 0) return false;
    if (filters.joinedFrom && !isOnOrAfterDate(row.joinedAt, filters.joinedFrom)) return false;
    if (filters.joinedTo && !isOnOrBeforeDate(row.joinedAt, filters.joinedTo)) return false;
    if (filters.minBookings !== null && row.bookingCount < filters.minBookings) return false;
    if (filters.minCompleted !== null && row.completedBookings < filters.minCompleted) return false;
    if (filters.minSpend !== null && row.capturedSpend < filters.minSpend) return false;
    return true;
  });
}

export function sortCustomerRows(rows: CustomerRow[], sort: string) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    if (sort === 'last-work') {
      return dateMs(right.lastCompletedAt) - dateMs(left.lastCompletedAt);
    }
    if (sort === 'booking-count') {
      return right.bookingCount - left.bookingCount || dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt);
    }
    if (sort === 'completed-count') {
      return (
        right.completedBookings - left.completedBookings ||
        dateMs(right.lastCompletedAt) - dateMs(left.lastCompletedAt)
      );
    }
    if (sort === 'captured-spend') {
      return right.capturedSpend - left.capturedSpend || dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt);
    }
    if (sort === 'last-seen') {
      return dateMs(right.lastSeenAt) - dateMs(left.lastSeenAt);
    }
    if (sort === 'joined') {
      return dateMs(right.joinedAt) - dateMs(left.joinedAt);
    }
    if (sort === 'name') {
      return left.name.localeCompare(right.name);
    }
    return dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt);
  });
  return sorted;
}

export function buildCustomerRow(customer: AdminCustomer) {
  const bookings = customer.bookings ?? [];
  const payments = bookings.map((booking) => booking.payment).filter(Boolean);
  const refundAmount = bookings.reduce((sum, booking) => {
    const paymentRefunds = booking.payment?.refunds ?? [];
    const bookingRefunds = booking.refunds ?? [];
    return (
      sum +
      [...paymentRefunds, ...bookingRefunds].reduce(
        (innerSum, refund) => innerSum + Number(refund.amount ?? 0),
        0,
      )
    );
  }, 0);
  const activeBookings = bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length;
  const closedBookings = bookings.filter((booking) => CLOSED_STATUSES.includes(booking.status));
  const cancelledBookings = closedBookings.length;
  const customerClosedBookings = closedBookings.filter((booking) => booking.closedByRole === 'CUSTOMER').length;
  const adminClosedBookings = closedBookings.filter((booking) => booking.closedByRole === 'ADMIN').length;
  const partnerClosedBookings = closedBookings.filter((booking) => booking.closedByRole === 'PROVIDER').length;
  const noShowBookings = bookings.filter((booking) => booking.status === 'NO_SHOW').length;
  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const openMatchingBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length;
  const firstPickBookings = bookings.filter(
    (booking) => booking.preferredProviderId && !booking.selectedProviderId,
  ).length;
  const customerChoiceBookings = bookings.filter((booking) => Boolean(booking.selectedProviderId)).length;
  const serviceLiveBookings = bookings.filter((booking) =>
    ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  ).length;
  const chatMissingBookings = bookings.filter(
    (booking) => shouldHaveCustomerChatRoom(booking) && !booking.chatRoom,
  ).length;
  const addressSnapshotBookings = bookings.filter((booking) => Boolean(booking.addressSnapshot)).length;
  const paymentIssues = payments.filter(
    (payment) => payment && !['AUTHORIZED', 'CAPTURED'].includes(payment.status),
  ).length;
  const capturedSpend = payments
    .filter((payment) => payment?.status === 'CAPTURED')
    .reduce((sum, payment) => sum + Number(payment?.amount ?? 0), 0);
  const addressCount = readAddressCount(customer.addresses) + (customer.selectedLocations?.length ?? 0);
  const lastBookingAt = bookings
    .map((booking) => booking.updatedAt ?? booking.createdAt ?? booking.scheduledStartAt)
    .filter(Boolean)
    .sort((left, right) => dateMs(right) - dateMs(left))[0];
  const completedRows = bookings
    .filter((booking) => booking.status === 'COMPLETED')
    .sort(
      (left, right) =>
        dateMs(right.updatedAt ?? right.createdAt ?? right.scheduledStartAt) -
        dateMs(left.updatedAt ?? left.createdAt ?? left.scheduledStartAt),
    );
  const lastCompletedBooking = completedRows[0];
  const lastCompletedAt =
    lastCompletedBooking?.updatedAt ??
    lastCompletedBooking?.createdAt ??
    lastCompletedBooking?.scheduledStartAt;
  const commonService = mostCommonLabel(bookings.map((booking) => bookingServiceLabel(booking)));
  const commonArea = mostCommonLabel(
    bookings.map((booking) => bookingAddressLabel(booking)).filter((label) => label !== 'No address'),
  );
  const commonPartner = mostCommonLabel(bookings.map((booking) => bookingPartnerLabel(booking)));
  const latestSession = customer.user?.appSessions?.[0];
  const lastSeenAt = latestSession?.lastSeenAt;
  const isLive = Boolean(lastSeenAt && Date.now() - dateMs(lastSeenAt) <= 30 * 60_000);
  const pushReachable = Boolean(customer.user?.pushDevices?.some((device) => device.enabled));
  const latestMemo = [...(customer.auditLogs ?? [])].sort(
    (left, right) => dateMs(right.createdAt) - dateMs(left.createdAt),
  )[0];
  const memoCount = customer.auditLogCount ?? customer.auditLogs?.length ?? 0;
  const activityLabel =
    activeBookings > 0
      ? `${activeBookings} active booking(s)`
      : completedBookings > 0
        ? `${completedBookings} completed work record(s)`
        : bookings.length > 0
          ? `${bookings.length} booking record(s)`
          : 'No booking history yet';

  return {
    id: customer.id,
    name: customer.user?.fullName ?? customer.user?.phone ?? 'Unnamed customer',
    phone: customer.user?.phone ?? 'No phone',
    email: customer.user?.email ?? 'No email',
    joinedAt: customer.user?.createdAt,
    bookingCount: bookings.length,
    activeBookings,
    openMatchingBookings,
    firstPickBookings,
    customerChoiceBookings,
    serviceLiveBookings,
    chatMissingBookings,
    addressSnapshotBookings,
    completedBookings,
    cancelledBookings,
    customerClosedBookings,
    adminClosedBookings,
    partnerClosedBookings,
    noShowBookings,
    paymentCount: payments.length,
    refundAmount,
    capturedSpend,
    addressCount,
    lastBookingAt,
    lastCompletedAt,
    lastCompletedLabel: lastCompletedBooking ? bookingServiceLabel(lastCompletedBooking) : 'No finished service record',
    lastCompletedPartner: lastCompletedBooking ? bookingPartnerLabel(lastCompletedBooking) : 'No completed partner',
    commonService: commonService ?? 'Not enough bookings',
    commonArea: commonArea ?? 'No repeated area',
    commonPartner: commonPartner ?? 'Not enough bookings',
    lastSeenAt,
    latestSessionDevice: sessionDeviceLabel(latestSession),
    latestSessionPlatform: latestSession?.platform ?? 'Unknown platform',
    latestSessionIp: latestSession?.ipAddress ?? 'No IP recorded',
    latestSessionAppVersion: latestSession?.appVersion ?? 'No app version',
    isLive,
    pushReachable,
    paymentIssues,
    chatRooms: bookings.filter((booking) => booking.chatRoom).length,
    memoCount,
    activityLabel,
    latestMemoTitle: latestMemo?.action ?? 'No memo',
    latestMemoDetail: latestMemo ? compactText(compactJson(latestMemo.metadata), 72) : 'No internal memo saved yet',
  };
}

export type CustomerRow = ReturnType<typeof buildCustomerRow>;

export function buildCustomerSummary(rows: CustomerRow[]) {
  return {
    total: rows.length,
    live: rows.filter((row) => row.isLive).length,
    recentJoins: rows.filter(
      (row) => row.joinedAt && Date.now() - dateMs(row.joinedAt) <= 30 * 24 * 60 * 60_000,
    ).length,
    activeBookings: rows.reduce((sum, row) => sum + row.activeBookings, 0),
    completedBookings: rows.reduce((sum, row) => sum + row.completedBookings, 0),
    cancelledBookings: rows.reduce((sum, row) => sum + row.cancelledBookings, 0),
    addresses: rows.reduce((sum, row) => sum + row.addressCount, 0),
    capturedSpend: rows.reduce((sum, row) => sum + row.capturedSpend, 0),
    refundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    pushReachable: rows.filter((row) => row.pushReachable).length,
    chatRooms: rows.reduce((sum, row) => sum + row.chatRooms, 0),
    missingAddress: rows.filter((row) => row.addressCount === 0).length,
    paymentIssues: rows.reduce((sum, row) => sum + row.paymentIssues, 0),
    latestBookingAt: rows
      .map((row) => row.lastBookingAt)
      .filter(Boolean)
      .sort((left, right) => dateMs(right) - dateMs(left))[0],
    latestCompletedAt: rows
      .map((row) => row.lastCompletedAt)
      .filter(Boolean)
      .sort((left, right) => dateMs(right) - dateMs(left))[0],
  };
}

export function buildCustomerFilterSummary(
  rows: CustomerRow[],
  allRows: CustomerRow[],
  summary: ReturnType<typeof buildCustomerSummary>,
  activeFilterCount: number,
) {
  const totalBookings = rows.reduce((sum, row) => sum + row.bookingCount, 0);
  const noAppSession = rows.filter((row) => !row.lastSeenAt).length;
  const completedShare = totalBookings > 0 ? Math.round((summary.completedBookings / totalBookings) * 100) : 0;

  return [
    {
      label: 'Filtered rows',
      value: `${rows.length}/${allRows.length}`,
      detail:
        activeFilterCount > 0
          ? `${activeFilterCount} active filter(s) are narrowing the customer list`
          : 'No active filters, full customer list is loaded',
    },
    {
      label: 'Completed work',
      value: summary.completedBookings.toString(),
      detail: `${completedShare}% of booking records in this result are completed`,
    },
    {
      label: 'Latest work',
      value: summary.latestCompletedAt ? formatDate(summary.latestCompletedAt) : 'None',
      detail: 'Most recent completed service in the current result',
    },
    {
      label: 'No app session',
      value: noAppSession.toString(),
      detail: 'Customer accounts without a saved app session record',
    },
    {
      label: 'Address follow-up',
      value: summary.missingAddress.toString(),
      detail: 'Customer profiles without saved or selected address records',
    },
    {
      label: 'Payment follow-up',
      value: summary.paymentIssues.toString(),
      detail: 'Payment records that are not authorized or captured',
    },
  ];
}

function shouldHaveCustomerChatRoom(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status);
}

function bookingServiceLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function bookingPartnerLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  return (
    booking.selectedProvider?.displayName ??
    booking.preferredProvider?.displayName ??
    booking.selectedProvider?.user?.fullName ??
    booking.preferredProvider?.user?.fullName ??
    booking.selectedProvider?.user?.phone ??
    booking.preferredProvider?.user?.phone ??
    'No partner'
  );
}

function bookingAddressLabel(booking: NonNullable<AdminCustomer['bookings']>[number]) {
  return (
    booking.addressSnapshot?.addressText ??
    stringifyAddress(booking.addressSnapshot?.address) ??
    stringifyAddress(booking.address) ??
    'No address'
  );
}

function sessionDeviceLabel(session?: NonNullable<NonNullable<AdminCustomer['user']>['appSessions']>[number]) {
  if (!session) return 'No session';
  const platform = session.platform ?? 'Unknown platform';
  const appVersion = session.appVersion ? `v${session.appVersion}` : 'No app version';
  return `${platform} / ${appVersion} / ${compactText(session.deviceId, 18)}`;
}

function mostCommonLabel(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === 'No service' || value === 'No address' || value === 'No partner') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function stringifyAddress(value: unknown) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const knownText = objectValue.addressText ?? objectValue.address ?? objectValue.label ?? objectValue.name;
    if (typeof knownText === 'string') return knownText;
    return compactText(JSON.stringify(value), 96);
  }
  return String(value);
}

function readAddressCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return 1;
  return 0;
}

function isWithinRecentDays(value: string | null | undefined, days: number) {
  if (!value) return false;
  return Date.now() - dateMs(value) <= days * 24 * 60 * 60_000;
}

function isOnOrAfterDate(value: string | null | undefined, date: string) {
  if (!value) return false;
  return dateMs(value) >= new Date(`${date}T00:00:00`).getTime();
}

function isOnOrBeforeDate(value: string | null | undefined, date: string) {
  if (!value) return false;
  return dateMs(value) <= new Date(`${date}T23:59:59.999`).getTime();
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function compactText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function compactJson(value: unknown) {
  if (!value) return 'No metadata';
  try {
    return JSON.stringify(value);
  } catch {
    return 'Metadata unavailable';
  }
}
