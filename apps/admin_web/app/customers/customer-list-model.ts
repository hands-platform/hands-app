import { formatDateTime as formatDate } from '../../lib/admin-format';
import type { AdminCustomerDirectoryRow } from '../../lib/admin-api';
import { bookingLatestActivityAt } from '../../lib/admin-booking-time';
import { adminCountLabel } from '../../lib/admin-copy';
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
        row.deviceLanguage,
        row.deviceLanguageCountryLabel,
        row.genderLabel,
        row.latestMemoTitle,
        row.latestMemoDetail,
      ].some((value) => value.toLowerCase().includes(query))
    ) {
      return false;
    }
    if (filters.country && row.deviceLanguageCountryCode !== filters.country) return false;
    if (filters.gender && row.gender !== filters.gender) return false;
    const activityDate = customerActivityDate(row, filters.dateField);
    if (filters.dateFrom && !isOnOrAfterDate(activityDate, filters.dateFrom)) return false;
    if (filters.dateTo && !isOnOrBeforeDate(activityDate, filters.dateTo)) return false;
    return true;
  });
}

export function sortCustomerRows(rows: CustomerRow[], sort: string) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    if (sort === 'booking-count') {
      return (
        right.bookingCount - left.bookingCount || dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt)
      );
    }
    if (sort === 'booking-count-asc') {
      return (
        left.bookingCount - right.bookingCount || dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt)
      );
    }
    return dateMs(right.lastBookingAt) - dateMs(left.lastBookingAt);
  });
  return sorted;
}

export function buildCustomerRow(customer: AdminCustomerDirectoryRow) {
  const bookings = customer.bookings ?? [];
  const activitySummary = customer.activitySummary;
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
  const activeBookings =
    activitySummary?.activeBookingCount ??
    bookings.filter((booking) => ACTIVE_STATUSES.includes(booking.status)).length;
  const closedBookings = bookings.filter((booking) => CLOSED_STATUSES.includes(booking.status));
  const cancelledBookings = activitySummary?.closedBookingCount ?? closedBookings.length;
  const customerClosedBookings =
    activitySummary?.customerClosedBookingCount ??
    closedBookings.filter((booking) => booking.closedByRole === 'CUSTOMER').length;
  const adminClosedBookings =
    activitySummary?.adminClosedBookingCount ??
    closedBookings.filter((booking) => booking.closedByRole === 'ADMIN').length;
  const partnerClosedBookings =
    activitySummary?.partnerClosedBookingCount ??
    closedBookings.filter((booking) => booking.closedByRole === 'PROVIDER').length;
  const noShowBookings =
    activitySummary?.noShowBookingCount ?? bookings.filter((booking) => booking.status === 'NO_SHOW').length;
  const completedBookings =
    activitySummary?.completedBookingCount ??
    bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const openMatchingBookings =
    activitySummary?.openMatchingBookingCount ??
    bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length;
  const firstPickBookings = bookings.filter(
    (booking) => booking.preferredProviderId && !booking.selectedProviderId,
  ).length;
  const customerChoiceBookings = bookings.filter((booking) => Boolean(booking.selectedProviderId)).length;
  const serviceLiveBookings =
    activitySummary?.serviceLiveBookingCount ??
    bookings.filter((booking) =>
      ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
    ).length;
  const currentBooking = bookings
    .filter((booking) => ACTIVE_STATUSES.includes(booking.status))
    .sort((left, right) => dateMs(bookingLatestActivityAt(right)) - dateMs(bookingLatestActivityAt(left)))[0];
  const chatMissingBookings = bookings.filter(
    (booking) => shouldHaveCustomerChatRoom(booking) && !booking.chatRoom,
  ).length;
  const addressSnapshotBookings = bookings.filter((booking) => Boolean(booking.addressSnapshot)).length;
  const paymentIssues =
    activitySummary?.paymentIssueCount ??
    payments.filter((payment) => payment && payment.status === 'FAILED').length;
  const capturedSpend =
    activitySummary?.capturedSpend ??
    payments
      .filter((payment) => payment?.status === 'CAPTURED')
      .reduce((sum, payment) => sum + Number(payment?.amount ?? 0), 0);
  const customerWalletBalance = activitySummary?.customerWalletBalance ?? 0;
  const refundRequests = activitySummary?.refundRequestCount ?? requestedRefundCount(bookings);
  const reportedReviews = activitySummary?.reportedReviewCount ?? 0;
  const addressCount = readAddressCount(customer.addresses) + customer.selectedLocationCount;
  const bookingCount = activitySummary?.bookingCount ?? bookings.length;
  const lastBookingAt =
    activitySummary?.lastBookingAt ??
    bookings
      .map((booking) => bookingLatestActivityAt(booking))
      .filter(Boolean)
      .sort((left, right) => dateMs(right) - dateMs(left))[0];
  const completedRows = bookings
    .filter((booking) => booking.status === 'COMPLETED')
    .sort((left, right) => dateMs(bookingLatestActivityAt(right)) - dateMs(bookingLatestActivityAt(left)));
  const lastCompletedBooking = completedRows[0];
  const lastCompletedAt =
    activitySummary?.lastCompletedBookingAt ??
    (lastCompletedBooking ? bookingLatestActivityAt(lastCompletedBooking) : undefined);
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
      ? adminCountLabel(activeBookings, 'active booking')
      : completedBookings > 0
        ? adminCountLabel(completedBookings, 'completed work record')
        : bookingCount > 0
          ? adminCountLabel(bookingCount, 'booking record')
          : 'No booking history yet';

  const deviceLanguage = readCustomerDeviceLanguage(customer);
  const gender = readCustomerGender(customer);

  return {
    id: customer.id,
    name: customer.user?.fullName?.trim() || 'Unnamed customer',
    phone: customer.user?.phone ?? 'No phone',
    email: customer.user?.email ?? 'No email',
    joinedAt: customer.user?.createdAt,
    bookingCount,
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
    customerWalletBalance,
    refundRequests,
    reportedReviews,
    addressCount,
    lastBookingAt,
    currentBookingUpdatedAt:
      activitySummary?.currentBookingUpdatedAt ??
      (currentBooking ? bookingLatestActivityAt(currentBooking) : undefined),
    lastCompletedAt,
    lastCompletedLabel: lastCompletedBooking
      ? bookingServiceLabel(lastCompletedBooking)
      : 'No finished service record',
    lastCompletedPartner: lastCompletedBooking
      ? bookingPartnerLabel(lastCompletedBooking)
      : 'No completed Partner',
    commonService: commonService ?? 'Not enough bookings',
    commonArea: commonArea ?? 'No repeated area',
    commonPartner: commonPartner ?? 'Not enough bookings',
    lastSeenAt,
    latestSessionDevice: sessionDeviceLabel(latestSession),
    latestSessionPlatform: latestSession?.platform ?? 'Unknown platform',
    latestSessionIp: latestSession?.ipAddress ?? 'No IP recorded',
    latestSessionAppVersion: latestSession?.appVersion ?? 'No app version',
    deviceLanguage,
    deviceLanguageCountryCode: customerDeviceLanguageCountryCode(deviceLanguage),
    deviceLanguageCountryLabel: customerDeviceLanguageCountryLabel(deviceLanguage),
    gender,
    genderLabel: customerGenderLabel(gender),
    lastLoginAddress: readCustomerLastLoginAddress(customer),
    isLive,
    pushReachable,
    paymentIssues,
    chatRooms: bookings.filter((booking) => booking.chatRoom).length,
    memoCount,
    activityLabel,
    latestMemoTitle: latestMemo?.action ?? 'No memo',
    latestMemoDetail: latestMemo
      ? compactText(compactJson(latestMemo.metadata), 72)
      : 'No internal memo saved yet',
  };
}

export type CustomerRow = ReturnType<typeof buildCustomerRow>;

export type CustomerPagination<T> = {
  readonly from: number;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export function paginateCustomerRows<T>(rows: readonly T[], filters: CustomerFilters): CustomerPagination<T> {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const paginatedRows = rows.slice(start, start + filters.pageSize);

  return {
    from: totalRows === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows: paginatedRows,
    to: Math.min(start + filters.pageSize, totalRows),
    totalPages,
    totalRows,
  };
}

export function buildServerCustomerPagination<T>(
  rows: readonly T[],
  filters: CustomerFilters,
  totalRows: number,
): CustomerPagination<T> {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

export function buildCustomerSummary(rows: CustomerRow[]) {
  const todayJoinedRows = rows.filter((row) => isToday(row.joinedAt));
  const todaySeenRows = rows.filter((row) => isToday(row.lastSeenAt));
  const monthSeenRows = rows.filter((row) => isWithinRecentDays(row.lastSeenAt, 30));

  const paymentIssues = rows.reduce((sum, row) => sum + row.paymentIssues, 0);

  return {
    total: rows.length,
    live: rows.filter((row) => row.isLive).length,
    recentJoins: rows.filter(
      (row) => row.joinedAt && Date.now() - dateMs(row.joinedAt) <= 30 * 24 * 60 * 60_000,
    ).length,
    genderBreakdown: genderBreakdown(rows),
    todayJoined: todayJoinedRows.length,
    todayJoinedGenderBreakdown: genderBreakdown(todayJoinedRows),
    todaySeen: todaySeenRows.length,
    todaySeenGenderBreakdown: genderBreakdown(todaySeenRows),
    monthSeen: monthSeenRows.length,
    monthSeenGenderBreakdown: genderBreakdown(monthSeenRows),
    activeBookings: rows.reduce((sum, row) => sum + row.activeBookings, 0),
    completedBookings: rows.reduce((sum, row) => sum + row.completedBookings, 0),
    cancelledBookings: rows.reduce((sum, row) => sum + row.cancelledBookings, 0),
    addresses: rows.reduce((sum, row) => sum + row.addressCount, 0),
    capturedSpend: rows.reduce((sum, row) => sum + row.capturedSpend, 0),
    refundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    pushReachable: rows.filter((row) => row.pushReachable).length,
    chatRooms: rows.reduce((sum, row) => sum + row.chatRooms, 0),
    missingAddress: rows.filter((row) => row.addressCount === 0).length,
    paymentIssues,
    needsAction: paymentIssues,
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

function customerActivityDate(row: CustomerRow, field: CustomerFilters['dateField']) {
  if (field === 'joined') return row.joinedAt;
  if (field === 'last-booking') return row.lastBookingAt;
  return row.lastSeenAt;
}

function requestedRefundCount(bookings: NonNullable<AdminCustomerDirectoryRow['bookings']>) {
  const refundIds = new Set<string>();
  for (const booking of bookings) {
    for (const refund of [...(booking.refunds ?? []), ...(booking.payment?.refunds ?? [])]) {
      if (refund.status === 'REQUESTED') refundIds.add(refund.id);
    }
  }
  return refundIds.size;
}

export function buildCustomerFilterSummary(
  rows: CustomerRow[],
  allRows: CustomerRow[],
  summary: ReturnType<typeof buildCustomerSummary>,
  activeFilterCount: number,
) {
  const totalBookings = rows.reduce((sum, row) => sum + row.bookingCount, 0);
  const noAppSession = rows.filter((row) => !row.lastSeenAt).length;
  const completedShare =
    totalBookings > 0 ? Math.round((summary.completedBookings / totalBookings) * 100) : 0;

  return [
    {
      label: 'Filtered rows',
      value: `${rows.length}/${allRows.length}`,
      detail:
        activeFilterCount > 0
          ? `${adminCountLabel(activeFilterCount, 'active filter')} ${activeFilterCount === 1 ? 'is' : 'are'} narrowing the customer list`
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

function shouldHaveCustomerChatRoom(booking: NonNullable<AdminCustomerDirectoryRow['bookings']>[number]) {
  return ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status);
}

function bookingServiceLabel(booking: NonNullable<AdminCustomerDirectoryRow['bookings']>[number]) {
  const first = booking.services?.[0];
  if (!first?.service) return 'No service';
  return `${first.service.name ?? 'Service'} / ${first.service.durationMin ?? '?'} min`;
}

function bookingPartnerLabel(booking: NonNullable<AdminCustomerDirectoryRow['bookings']>[number]) {
  return (
    booking.selectedProvider?.displayName ??
    booking.preferredProvider?.displayName ??
    booking.selectedProvider?.user?.fullName ??
    booking.preferredProvider?.user?.fullName ??
    booking.selectedProvider?.user?.phone ??
    booking.preferredProvider?.user?.phone ??
    'No Partner'
  );
}

function bookingAddressLabel(booking: NonNullable<AdminCustomerDirectoryRow['bookings']>[number]) {
  return (
    booking.addressSnapshot?.addressText ??
    stringifyAddress(booking.addressSnapshot?.address) ??
    stringifyAddress(booking.address) ??
    'No address'
  );
}

function sessionDeviceLabel(
  session?: NonNullable<NonNullable<AdminCustomerDirectoryRow['user']>['appSessions']>[number],
) {
  if (!session) return 'No session';
  const platform = session.platform ?? 'Unknown platform';
  const appVersion = session.appVersion ? `v${session.appVersion}` : 'No app version';
  return `${platform} / ${appVersion} / ${compactText(session.deviceId, 18)}`;
}

function readCustomerDeviceLanguage(customer: AdminCustomerDirectoryRow) {
  const latestSession = customer.user?.appSessions?.[0];
  const metadataCandidates = [
    latestSession?.deviceLanguage,
    readObjectText(customer as Record<string, unknown>, 'language'),
    readObjectText(customer as Record<string, unknown>, 'locale'),
    readObjectText((customer.user ?? {}) as Record<string, unknown>, 'language'),
    readObjectText((customer.user ?? {}) as Record<string, unknown>, 'locale'),
  ].filter(Boolean);

  return metadataCandidates[0] ?? 'Not captured';
}

function customerDeviceLanguageCountryCode(label: string) {
  if (!label || label === 'Not captured') {
    return 'UNKNOWN';
  }

  const language = label.replace(/_/g, '-').trim().split('-')[0]?.toLowerCase();
  const codes: Record<string, string> = { en: 'EN', ja: 'JA', ko: 'KO', vi: 'VI', zh: 'ZH' };
  return codes[language ?? ''] ?? 'UNKNOWN';
}

function customerDeviceLanguageCountryLabel(label: string) {
  const names: Record<string, string> = {
    EN: 'English',
    JA: 'Japanese',
    KO: 'Korean',
    VI: 'Vietnamese',
    ZH: 'Chinese',
  };
  const code = customerDeviceLanguageCountryCode(label);
  return names[code] ?? 'Unknown language';
}

function readCustomerGender(customer: AdminCustomerDirectoryRow) {
  const user = customer.user ?? {};
  const value = [
    readObjectText(customer as Record<string, unknown>, 'gender'),
    readObjectText(user as Record<string, unknown>, 'gender'),
    readObjectText(customer as Record<string, unknown>, 'sex'),
    readObjectText(user as Record<string, unknown>, 'sex'),
  ].find(Boolean);
  const normalized = value?.toLowerCase().trim() ?? '';

  if (['female', 'f', 'woman', 'women'].includes(normalized)) {
    return 'female';
  }
  if (['male', 'm', 'man', 'men'].includes(normalized)) {
    return 'male';
  }
  if (normalized && !['unknown', 'not captured', 'none', 'null'].includes(normalized)) {
    return 'other';
  }
  return 'unknown';
}

function customerGenderLabel(gender: string) {
  const labels: Record<string, string> = {
    female: 'Female',
    male: 'Male',
    other: 'Other',
    unknown: 'Not captured',
  };
  return labels[gender] ?? 'Not captured';
}

function readCustomerLastLoginAddress(customer: AdminCustomerDirectoryRow) {
  const latestSession = customer.user?.appSessions?.[0];
  const metadataCandidates = [
    latestSession?.lastLoginAddress,
    readObjectText(customer as Record<string, unknown>, 'lastLoginAddress'),
    readObjectText((customer.user ?? {}) as Record<string, unknown>, 'lastLoginAddress'),
  ].filter(Boolean);

  return metadataCandidates[0] ?? 'Not captured';
}

function mostCommonLabel(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value || value === 'No service' || value === 'No address' || value === 'No Partner') continue;
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

function isToday(value: string | null | undefined) {
  const timestamp = dateMs(value);
  if (!timestamp) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  return timestamp >= start.getTime() && timestamp < end.getTime();
}

function genderBreakdown(rows: CustomerRow[]) {
  return rows.reduce(
    (counts, row) => {
      if (row.gender === 'female' || row.gender === 'male' || row.gender === 'other') {
        counts[row.gender] += 1;
      } else {
        counts.unknown += 1;
      }
      return counts;
    },
    {
      female: 0,
      male: 0,
      other: 0,
      unknown: 0,
    },
  );
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

function readObjectText(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
