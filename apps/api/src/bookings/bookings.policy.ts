import { BadRequestException } from '@nestjs/common';
import { BookingStatus, ParticipantStatus, PaymentMethod } from '@prisma/client';

import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  BACKUP_OPEN_IMMEDIATE,
  safeDistanceMeters,
} from '../matching/matching.policy';

const MINUTE_MS = 60_000;
const CUSTOMER_DIRECT_CANCELLATION_TERMINAL_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.IN_SERVICE,
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
  BookingStatus.REFUNDED,
]);
const PARTNER_COMMITMENT_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
]);

export function isCustomerSelectableParticipantForFinalChoice(
  participant: { status: ParticipantStatus; providerProfileId: string },
  preferredProviderId?: string | null,
) {
  if (participant.status === ParticipantStatus.ACCEPTED) {
    return true;
  }

  if (participant.status === ParticipantStatus.JOINED) {
    return participant.providerProfileId !== preferredProviderId;
  }

  return false;
}

export function isMarketplacePartnerAction(providerProfileId: string, preferredProviderId?: string | null) {
  return providerProfileId !== preferredProviderId;
}

export function isMarketplaceParticipationWindowOpen(
  booking: {
    preferredProviderId?: string | null;
    openedAt?: Date | string | null;
    participants?: Array<{ providerProfileId: string; status: ParticipantStatus | string }>;
  },
  policy: {
    backupOpenMode: string;
    providerResponseWindowMinutes: number;
  },
) {
  if (
    policy.backupOpenMode === BACKUP_OPEN_IMMEDIATE ||
    policy.backupOpenMode === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY
  ) {
    return true;
  }
  if (!booking.preferredProviderId || firstPickPartnerDeclined(booking)) {
    return true;
  }
  const openedAt = booking.openedAt ? new Date(booking.openedAt).getTime() : NaN;
  if (Number.isNaN(openedAt)) {
    return false;
  }
  return Date.now() >= openedAt + policy.providerResponseWindowMinutes * MINUTE_MS;
}

export function assertPartnerResponseWindowOpen(booking: { status: BookingStatus; expiresAt?: Date | null }) {
  if (booking.status !== BookingStatus.OPEN_MATCHING) {
    throw new BadRequestException('Booking is not open for partner responses');
  }
  if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
    throw new BadRequestException('Booking request is expired');
  }
}

export function assertCustomerDirectCancellationAllowed(booking: {
  status: BookingStatus;
  selectedProviderId?: string | null;
  participants?: Array<{ status: ParticipantStatus | string }>;
}) {
  if (CUSTOMER_DIRECT_CANCELLATION_TERMINAL_STATUSES.has(booking.status)) {
    throw new BadRequestException('Booking cannot be cancelled in its current state');
  }

  if (bookingHasPartnerCommitment(booking)) {
    throw new BadRequestException(
      'Matched bookings cannot be cancelled directly. Use booking chat so HANDS operations can review the evidence.',
    );
  }
}

export function bookingHasPartnerCommitment(booking: {
  status: BookingStatus;
  selectedProviderId?: string | null;
  participants?: Array<{ status: ParticipantStatus | string }>;
}) {
  return (
    PARTNER_COMMITMENT_BOOKING_STATUSES.has(booking.status) ||
    Boolean(booking.selectedProviderId)
  );
}

export function assertProviderLifecycleTransitionAllowed(current: BookingStatus, allowed: BookingStatus[]) {
  if (!allowed.includes(current)) {
    throw new BadRequestException(
      `Invalid booking status transition from ${current}. Expected one of: ${allowed.join(', ')}`,
    );
  }
}

export function providerLifecycleAllowedPreviousStatuses(next: BookingStatus): BookingStatus[] | null {
  if (next === BookingStatus.ARRIVED) {
    return [BookingStatus.MATCHED, BookingStatus.PROVIDER_ON_THE_WAY];
  }
  if (next === BookingStatus.IN_SERVICE) {
    return [BookingStatus.MATCHED, BookingStatus.PROVIDER_ON_THE_WAY, BookingStatus.ARRIVED];
  }
  if (next === BookingStatus.COMPLETED) {
    return [
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.IN_SERVICE,
    ];
  }
  return null;
}

export function addProviderMatchingDistance<
  T extends {
    lat: unknown;
    lng: unknown;
    addressSnapshot?: { latitude: unknown; longitude: unknown } | null;
  },
>(booking: T, provider: { currentLat: unknown; currentLng: unknown }) {
  const dispatchPin = bookingDispatchCoordinates(booking);
  return {
    ...booking,
    distanceMeters: calculateDistanceMeters(
      dispatchPin.lat,
      dispatchPin.lng,
      provider.currentLat,
      provider.currentLng,
    ),
  };
}

export function bookingDispatchCoordinates(booking: {
  lat: unknown;
  lng: unknown;
  addressSnapshot?: { latitude: unknown; longitude: unknown } | null;
}) {
  const snapshotLat = parseFiniteCoordinate(booking.addressSnapshot?.latitude);
  const snapshotLng = parseFiniteCoordinate(booking.addressSnapshot?.longitude);
  if (snapshotLat != null && snapshotLng != null) {
    return { lat: snapshotLat, lng: snapshotLng };
  }
  return {
    lat: parseFiniteCoordinate(booking.lat) ?? Number.NaN,
    lng: parseFiniteCoordinate(booking.lng) ?? Number.NaN,
  };
}

export function calculateDistanceMeters(
  bookingLat: number,
  bookingLng: number,
  providerLat: unknown,
  providerLng: unknown,
) {
  return safeDistanceMeters(bookingLat, bookingLng, providerLat, providerLng);
}

export function formatMatchingRadius(radiusMeters: number) {
  if (radiusMeters >= 1000) {
    return `${(radiusMeters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })}km`;
  }
  return `${radiusMeters.toLocaleString('en')}m`;
}

export function providerLocationFreshEnough(value: Date | string | null | undefined, maxAgeMinutes: number) {
  if (!value) {
    return false;
  }
  const updatedAt = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return false;
  }
  return Date.now() - updatedAt <= maxAgeMinutes * MINUTE_MS;
}

export function bookingAddressText(address: unknown) {
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    const record = address as Record<string, unknown>;
    const knownText =
      record.addressText ??
      record.address_text ??
      record.line1 ??
      record.addressLine ??
      record.address ??
      record.label ??
      record.text ??
      record.name;
    if (typeof knownText === 'string' && knownText.trim()) {
      return knownText.trim();
    }
  }
  if (typeof address === 'string' && address.trim()) {
    return address.trim();
  }
  return null;
}

export function assertBookingServiceId(serviceId: unknown) {
  if (typeof serviceId !== 'string' || !serviceId.trim()) {
    throw new BadRequestException('serviceId is required');
  }
}

export function assertBookingPaymentMethod(paymentMethod: unknown) {
  const checkoutMethods: readonly PaymentMethod[] = [
    PaymentMethod.CASH,
    PaymentMethod.MOMO,
    PaymentMethod.VNPAY,
    PaymentMethod.CARD,
    PaymentMethod.CUSTOMER_WALLET,
  ];
  if (!checkoutMethods.includes(paymentMethod as PaymentMethod)) {
    throw new BadRequestException('Valid paymentMethod is required');
  }
}

export function normalizeBookingCoordinate(value: unknown, fieldName: 'lat' | 'lng') {
  const parsed = parseFiniteCoordinate(value);
  if (parsed == null) {
    throw new BadRequestException(`${fieldName} is required`);
  }
  return parsed;
}

export function vietnamBookingCoordinateGateError(lat: number, lng: number) {
  if (!isVietnamBookingCoordinate(lat, lng)) {
    return {
      message: 'Booking address must be inside Vietnam',
    };
  }
  return null;
}

export function isVietnamBookingCoordinate(lat: number, lng: number) {
  return lat >= 8 && lat <= 24 && lng >= 102 && lng <= 110;
}

function parseFiniteCoordinate(value: unknown) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstPickPartnerDeclined(booking: {
  preferredProviderId?: string | null;
  participants?: Array<{ providerProfileId: string; status: ParticipantStatus | string }>;
}) {
  if (!booking.preferredProviderId) {
    return false;
  }
  return Boolean(
    booking.participants?.some(
      (participant) =>
        participant.providerProfileId === booking.preferredProviderId &&
        participant.status === ParticipantStatus.REJECTED,
    ),
  );
}
