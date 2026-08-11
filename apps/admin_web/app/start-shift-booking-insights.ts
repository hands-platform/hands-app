import { type AdminBooking, type AdminPayment } from '../lib/admin-api';
import {
  bookingRecordCreatedAt,
  bookingRequestOpenedAt,
} from '../lib/admin-booking-time';
import { bookingChatQuietNeedsOps } from '../lib/booking-chat-repair-action-state';
import {
  bookingCompletedCloseoutNeedsOpsFromFacts,
  bookingPaymentReleaseNeedsOpsFromFacts,
} from '../lib/booking-payment-ops';

export const START_SHIFT_ACTIVE_BOOKING_STATUSES = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function buildBookingOpsInsights(bookings: AdminBooking[]) {
  const expired = bookings.filter((booking) => booking.status === 'EXPIRED');
  const noShowFormal = bookings.filter((booking) => booking.status === 'NO_SHOW');
  const completedCloseoutChecks = bookings.filter(completedCloseoutNeedsOps);

  return {
    total: bookings.length,
    openMatching: bookings.filter((booking) => booking.status === 'OPEN_MATCHING').length,
    active: bookings.filter((booking) => START_SHIFT_ACTIVE_BOOKING_STATUSES.has(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'COMPLETED').length,
    cancelled: bookings.filter((booking) => booking.status === 'CANCELLED').length,
    expired: expired.length,
    refunded: bookings.filter((booking) => booking.status === 'REFUNDED').length,
    noShowFormal: noShowFormal.length,
    noShowSignal: bookings.filter(isNoShowSignal).length,
    completedCloseoutChecks: completedCloseoutChecks.length,
  };
}

export function buildBookingOperationsDeepDive(
  bookings: AdminBooking[],
  payments: AdminPayment[],
) {
  const activeOrMatching = bookings.filter(
    (booking) =>
      START_SHIFT_ACTIVE_BOOKING_STATUSES.has(booking.status) ||
      booking.status === 'OPEN_MATCHING',
  );
  const participantCount = activeOrMatching.reduce(
    (sum, booking) => sum + (booking.participants?.length ?? 0),
    0,
  );
  const expiredOpenMatching = bookings.filter(
    (booking) =>
      booking.status === 'OPEN_MATCHING' &&
      Boolean(booking.expiresAt) &&
      Date.parse(booking.expiresAt ?? '') < Date.now(),
  ).length;
  const openWithoutParticipants = bookings.filter(
    (booking) => booking.status === 'OPEN_MATCHING' && (booking.participants?.length ?? 0) === 0,
  ).length;
  const matchedWithoutChat = bookings.filter(
    (booking) => booking.status === 'MATCHED' && !booking.chatRoom,
  ).length;
  const customerFinalSelection = bookings.filter(
    (booking) =>
      booking.status === 'OPEN_MATCHING' &&
      !booking.selectedProvider &&
      (booking.participants ?? []).some(
        (participant) => participant.status === 'ACCEPTED' || participant.status === 'SELECTED',
      ),
  ).length;
  const quietActiveChats = bookings.filter((booking) =>
    bookingChatQuietNeedsOps({
      status: booking.status,
      hasChatRoom: Boolean(booking.chatRoom),
      messageCount: booking.chatRoom?.messages?.length ?? 0,
    }),
  ).length;
  const releaseChecks = bookings.filter(
    (booking) =>
      ['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status) &&
      unresolvedReleasePayment(booking),
  ).length;
  const captureChecks = payments.filter(
    (payment) => payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED',
  ).length;
  const manualCloseout = bookings.filter(
    (booking) => completedCloseoutNeedsOps(booking) || isNoShowSignal(booking),
  ).length;

  return {
    matchingEscalations:
      expiredOpenMatching + openWithoutParticipants + matchedWithoutChat + customerFinalSelection,
    expiredOpenMatching,
    openWithoutParticipants,
    matchedWithoutChat,
    customerFinalSelection,
    quietActiveChats,
    releaseChecks,
    captureChecks,
    averageParticipants: activeOrMatching.length
      ? (participantCount / activeOrMatching.length).toFixed(1)
      : '0.0',
    manualCloseout,
    serviceDemand: buildServiceDemandMix(bookings),
    paymentMix: buildPaymentMethodMix(payments),
  };
}

export function buildServiceDemandMix(bookings: AdminBooking[]) {
  const buckets = new Map<
    string,
    {
      label: string;
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      amount: number;
      averagePrice: number;
    }
  >();

  for (const booking of bookings) {
    for (const bookingService of booking.services ?? []) {
      const service = bookingService.service;
      const label = `${service?.name ?? 'Unknown service'} / ${service?.durationMin ?? '?'} min`;
      const quantity = bookingService.quantity ?? 1;
      const price = bookingService.price ?? service?.basePrice ?? 0;
      const bucket = buckets.get(label) ?? {
        label,
        total: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        amount: 0,
        averagePrice: 0,
      };

      bucket.total += quantity;
      bucket.amount += price * quantity;
      if (START_SHIFT_ACTIVE_BOOKING_STATUSES.has(booking.status)) bucket.active += quantity;
      if (booking.status === 'COMPLETED') bucket.completed += quantity;
      if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) {
        bucket.cancelled += quantity;
      }
      bucket.averagePrice = bucket.total ? Math.round(bucket.amount / bucket.total) : 0;
      buckets.set(label, bucket);
    }
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || right.amount - left.amount)
    .slice(0, 6);
}

export function buildPaymentMethodMix(payments: AdminPayment[]) {
  const buckets = new Map<
    string,
    {
      method: string;
      count: number;
      amount: number;
      currency: string;
      authorized: number;
      pending: number;
      captured: number;
      released: number;
      refunded: number;
      checkCount: number;
    }
  >();

  for (const payment of payments) {
    const method = payment.method ?? 'UNKNOWN';
    const bucket = buckets.get(method) ?? {
      method,
      count: 0,
      amount: 0,
      currency: payment.currency ?? 'VND',
      authorized: 0,
      pending: 0,
      captured: 0,
      released: 0,
      refunded: 0,
      checkCount: 0,
    };
    bucket.count += 1;
    bucket.amount += payment.amount ?? 0;
    if (payment.status === 'AUTHORIZED') bucket.authorized += 1;
    if (payment.status === 'PENDING') bucket.pending += 1;
    if (payment.status === 'CAPTURED') bucket.captured += 1;
    if (payment.status === 'RELEASED') bucket.released += 1;
    if (payment.status === 'REFUNDED') bucket.refunded += 1;
    if (
      (payment.status === 'AUTHORIZED' && payment.booking?.status === 'COMPLETED') ||
      (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(payment.booking?.status ?? '') &&
        !['RELEASED', 'REFUNDED'].includes(payment.status))
    ) {
      bucket.checkCount += 1;
    }
    buckets.set(method, bucket);
  }

  return [...buckets.values()].sort(
    (left, right) => right.count - left.count || right.amount - left.amount,
  );
}

export function buildHourlyBookingDemand(bookings: AdminBooking[]) {
  const hourFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const buckets = new Map<
    string,
    { hour: string; total: number; active: number; completed: number; cancelled: number }
  >();

  for (const booking of bookings) {
    const timestamp = bookingRecordCreatedAt(booking);
    if (!timestamp) continue;
    const hour = `${hourFormatter.format(new Date(timestamp))}:00`;
    const bucket = buckets.get(hour) ?? {
      hour,
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
    };
    bucket.total += 1;
    if (START_SHIFT_ACTIVE_BOOKING_STATUSES.has(booking.status)) bucket.active += 1;
    if (booking.status === 'COMPLETED') bucket.completed += 1;
    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') bucket.cancelled += 1;
    buckets.set(hour, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || left.hour.localeCompare(right.hour))
    .slice(0, 8);
}

export function buildRegionalBookingDemand(bookings: AdminBooking[]) {
  const buckets = new Map<
    string,
    {
      region: string;
      total: number;
      active: number;
      completed: number;
      cancelled: number;
      noShowSignal: number;
    }
  >();

  for (const booking of bookings) {
    const region = bookingRegionLabel(booking);
    const bucket = buckets.get(region) ?? {
      region,
      total: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      noShowSignal: 0,
    };
    bucket.total += 1;
    if (START_SHIFT_ACTIVE_BOOKING_STATUSES.has(booking.status)) bucket.active += 1;
    if (booking.status === 'COMPLETED') bucket.completed += 1;
    if (booking.status === 'CANCELLED' || booking.status === 'EXPIRED') bucket.cancelled += 1;
    if (isNoShowSignal(booking)) bucket.noShowSignal += 1;
    buckets.set(region, bucket);
  }

  return [...buckets.values()]
    .sort((left, right) => right.total - left.total || left.region.localeCompare(right.region))
    .slice(0, 8);
}

export function isNoShowSignal(booking: AdminBooking) {
  if (booking.status === 'NO_SHOW' || booking.status === 'EXPIRED') {
    return true;
  }
  const requestedAtValue = bookingRequestOpenedAt(booking);
  if (booking.status !== 'MATCHED' || !requestedAtValue) {
    return false;
  }
  const requestedAt = Date.parse(requestedAtValue);
  return Number.isFinite(requestedAt) && requestedAt + 30 * 60_000 < Date.now() && !booking.chatRoom;
}

export function bookingRegionLabel(booking: AdminBooking) {
  const address = readAddressText(booking.address);
  if (!address) {
    if (Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng))) {
      return 'Pinned location';
    }
    return 'Unknown region';
  }

  const normalized = address.replace(/\s+/g, ' ').trim();
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const knownCity = parts.find((part) =>
    /ho chi minh|hcmc|saigon|sai gon|da nang|ha noi|hanoi|nha trang|da lat|dalat|can tho/i.test(part),
  );
  return knownCity ?? parts.at(-2) ?? parts.at(-1) ?? 'Unknown region';
}

export function unresolvedReleasePayment(booking: AdminBooking) {
  return bookingPaymentReleaseNeedsOpsFromFacts({ payment: booking.payment });
}

export function completedCloseoutNeedsOps(booking: AdminBooking) {
  return bookingCompletedCloseoutNeedsOpsFromFacts(booking);
}

function readAddressText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const direct =
      objectValue.addressText ??
      objectValue.address_text ??
      objectValue.formatted ??
      objectValue.formattedAddress ??
      objectValue.label;
    return typeof direct === 'string' ? direct : null;
  }
  return null;
}
