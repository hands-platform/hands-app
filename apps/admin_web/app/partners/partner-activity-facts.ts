import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import { bookingLatestActivityAt } from '../../lib/admin-booking-time';

const partnerBookingRowsCache = new WeakMap<AdminProvider, AdminBooking[]>();
const partnerCompletedWorkCountCache = new WeakMap<AdminProvider, number>();
const partnerGrossRevenueCache = new WeakMap<AdminProvider, number>();
const partnerPendingPayoutCache = new WeakMap<AdminProvider, number>();
const partnerAvailablePayoutCache = new WeakMap<AdminProvider, number>();
const partnerLastCompletedWorkAtCache = new WeakMap<AdminProvider, string | null>();
const partnerLastActivityAtCache = new WeakMap<AdminProvider, string | null>();
const partnerLastSessionAtCache = new WeakMap<AdminProvider, string | null>();
const partnerWalletBalanceCache = new WeakMap<AdminProvider, number>();

export function partnerBookingRows(provider: AdminProvider) {
  const cached = partnerBookingRowsCache.get(provider);
  if (cached) return cached;

  const records = new Map<string, AdminBooking>();
  for (const booking of provider.preferredBookings ?? []) {
    records.set(booking.id, booking);
  }
  for (const booking of provider.selectedBookings ?? []) {
    records.set(booking.id, booking);
  }
  for (const participant of provider.participants ?? []) {
    if (participant.booking) records.set(participant.booking.id, participant.booking);
  }

  const rows = [...records.values()];
  partnerBookingRowsCache.set(provider, rows);
  return rows;
}

export function latestPartnerBookingRecord(bookings: AdminBooking[]) {
  return [...bookings].sort((left, right) => {
    const rightTime = Date.parse(bookingLatestActivityAt(right) ?? '');
    const leftTime = Date.parse(bookingLatestActivityAt(left) ?? '');
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  })[0];
}

export function partnerCompletedWorkCount(provider: AdminProvider) {
  if (provider.activitySummary) {
    return provider.activitySummary.completedWorkCount;
  }

  const cached = partnerCompletedWorkCountCache.get(provider);
  if (cached !== undefined) return cached;

  const count = (provider.earnings ?? []).filter((earning) => {
    if (earning.booking?.status === 'COMPLETED') return true;
    return ['AVAILABLE', 'PAID'].includes(earning.status);
  }).length;

  partnerCompletedWorkCountCache.set(provider, count);
  return count;
}

export function partnerGrossRevenue(provider: AdminProvider) {
  if (provider.activitySummary) {
    return provider.activitySummary.grossRevenue;
  }

  const cached = partnerGrossRevenueCache.get(provider);
  if (cached !== undefined) return cached;

  const value = (provider.earnings ?? []).reduce((sum, earning) => sum + Number(earning.grossAmount ?? 0), 0);
  partnerGrossRevenueCache.set(provider, value);
  return value;
}

export function partnerPendingPayout(provider: AdminProvider) {
  if (provider.activitySummary) {
    return provider.activitySummary.pendingPayout;
  }

  const cached = partnerPendingPayoutCache.get(provider);
  if (cached !== undefined) return cached;

  const value = (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status))
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
  partnerPendingPayoutCache.set(provider, value);
  return value;
}

export function partnerAvailablePayout(provider: AdminProvider) {
  if (provider.activitySummary) {
    return provider.activitySummary.availablePayout;
  }

  const cached = partnerAvailablePayoutCache.get(provider);
  if (cached !== undefined) return cached;

  const value = (provider.earnings ?? [])
    .filter((earning) => earning.status === 'AVAILABLE')
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
  partnerAvailablePayoutCache.set(provider, value);
  return value;
}

export function partnerLastCompletedWorkAt(provider: AdminProvider) {
  if (provider.activitySummary) {
    return provider.activitySummary.lastCompletedWorkAt ?? null;
  }

  const cached = partnerLastCompletedWorkAtCache.get(provider);
  if (cached !== undefined) return cached;

  const value = latestTimestamp(
    (provider.earnings ?? [])
      .filter(
        (earning) =>
          earning.booking?.status === 'COMPLETED' || ['AVAILABLE', 'PAID'].includes(earning.status),
      )
      .flatMap((earning) => [
        earning.booking ? bookingLatestActivityAt(earning.booking) : null,
        earning.paidAt,
        earning.availableAt,
        earning.createdAt,
      ]),
  );
  partnerLastCompletedWorkAtCache.set(provider, value);
  return value;
}

export function partnerLastActivityAt(provider: AdminProvider) {
  const cached = partnerLastActivityAtCache.get(provider);
  if (cached !== undefined) return cached;

  const value = latestTimestamp([
    provider.currentLocationUpdatedAt,
    provider.nextAvailableAt,
    provider.activitySummary?.lastCompletedWorkAt,
    provider.bookingSummary?.latestBookingAt,
    ...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]),
    ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt]),
    ...(provider.user?.pushDevices ?? []).map((device) => device.createdAt),
    ...(provider.earnings ?? []).flatMap((earning) => [
      earning.booking ? bookingLatestActivityAt(earning.booking) : null,
      earning.createdAt,
      earning.availableAt,
      earning.paidAt,
    ]),
  ]);
  partnerLastActivityAtCache.set(provider, value);
  return value;
}

export function partnerLastSessionAt(provider: AdminProvider) {
  const cached = partnerLastSessionAtCache.get(provider);
  if (cached !== undefined) return cached;

  const value = latestTimestamp([
    ...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]),
    ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt]),
  ]);
  partnerLastSessionAtCache.set(provider, value);
  return value;
}

export function partnerUnsettledWalletBalance(provider: AdminProvider) {
  if (provider.activitySummary) {
    return provider.activitySummary.walletBalance;
  }

  const cached = partnerWalletBalanceCache.get(provider);
  if (cached !== undefined) return cached;

  const value = (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status) && !earning.payoutBatchId)
    .reduce((sum, earning) => sum + numberValue(earning.netAmount), 0);
  partnerWalletBalanceCache.set(provider, value);
  return value;
}

export function latestTimestamp(values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => {
      if (!value) return null;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? { value, timestamp } : null;
    })
    .filter(Boolean)
    .sort((left, right) => (right?.timestamp ?? 0) - (left?.timestamp ?? 0))[0];

  return latest?.value ?? null;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}
