import { BookingStatus } from '@prisma/client';

type AddressRecord = Record<string, unknown>;

export type AdminBookingListMetadataInput = {
  readonly address?: unknown;
  readonly addressSnapshot?: {
    readonly address?: unknown;
    readonly addressText?: string | null;
  } | null;
  readonly closedAt?: Date | string | null;
  readonly createdAt?: Date | string | null;
  readonly expiresAt?: Date | string | null;
  readonly matchedAt?: Date | string | null;
  readonly openedAt?: Date | string | null;
  readonly selectedProvider?: unknown;
  readonly selectedProviderId?: string | null;
  readonly status: BookingStatus;
  readonly updatedAt?: Date | string | null;
};

export type AdminBookingListMetadata = {
  readonly serviceAddressText: string | null;
  readonly statusChangedAt: Date | string | null;
  readonly statusChangedLabel: string;
};

const ADDRESS_TEXT_FIELDS = [
  'addressText',
  'address_text',
  'fullAddress',
  'formattedAddress',
  'label',
  'name',
  'line1',
  'street',
] as const;

const ADDRESS_PART_FIELDS = ['line1', 'street', 'ward', 'district', 'city', 'province', 'country'] as const;

export function withAdminBookingListMetadataList<T extends AdminBookingListMetadataInput>(
  bookings: readonly T[],
): Array<T & AdminBookingListMetadata> {
  return bookings.map((booking) => withAdminBookingListMetadata(booking));
}

export function withAdminBookingListMetadata<T extends AdminBookingListMetadataInput>(
  booking: T,
): T & AdminBookingListMetadata {
  return {
    ...booking,
    serviceAddressText: bookingServiceAddressText(booking),
    statusChangedAt: bookingStatusChangedAt(booking),
    statusChangedLabel: bookingStatusChangedLabel(booking),
  };
}

export function bookingServiceAddressText(booking: AdminBookingListMetadataInput): string | null {
  return (
    readBookingAddressText(booking.addressSnapshot?.addressText) ??
    readBookingAddressText(booking.addressSnapshot?.address) ??
    readBookingAddressText(booking.addressSnapshot) ??
    readBookingAddressText(booking.address)
  );
}

export function bookingStatusChangedAt(booking: AdminBookingListMetadataInput) {
  switch (booking.status) {
    case BookingStatus.CREATED:
    case BookingStatus.OPEN_MATCHING:
      return booking.openedAt ?? booking.createdAt ?? booking.updatedAt ?? null;
    case BookingStatus.MATCHED:
      return booking.matchedAt ?? booking.updatedAt ?? null;
    case BookingStatus.PROVIDER_ON_THE_WAY:
    case BookingStatus.ARRIVED:
    case BookingStatus.IN_SERVICE:
      return booking.updatedAt ?? booking.matchedAt ?? null;
    case BookingStatus.COMPLETED:
    case BookingStatus.CANCELLED:
    case BookingStatus.NO_SHOW:
      return booking.closedAt ?? booking.updatedAt ?? null;
    case BookingStatus.EXPIRED:
      return booking.closedAt ?? booking.expiresAt ?? booking.updatedAt ?? null;
    case BookingStatus.REFUNDED:
      return booking.updatedAt ?? booking.closedAt ?? null;
    default:
      return assertUnhandledAdminBookingStatus(booking.status);
  }
}

export function bookingStatusChangedLabel(booking: AdminBookingListMetadataInput) {
  switch (booking.status) {
    case BookingStatus.CREATED:
      return 'Requested at';
    case BookingStatus.OPEN_MATCHING:
      return 'Matching opened at';
    case BookingStatus.MATCHED:
      return 'Matched at';
    case BookingStatus.PROVIDER_ON_THE_WAY:
      return 'Partner on the way at';
    case BookingStatus.ARRIVED:
      return 'Arrived at';
    case BookingStatus.IN_SERVICE:
      return 'Service started at';
    case BookingStatus.COMPLETED:
      return 'Completed at';
    case BookingStatus.CANCELLED:
      return bookingHasPostMatchEvidence(booking) ? 'Partner cancelled at' : 'Cancelled at';
    case BookingStatus.NO_SHOW:
      return 'No-show marked at';
    case BookingStatus.EXPIRED:
      return 'Expired at';
    case BookingStatus.REFUNDED:
      return 'Refunded at';
    default:
      return assertUnhandledAdminBookingStatus(booking.status);
  }
}

function bookingHasPostMatchEvidence(booking: AdminBookingListMetadataInput) {
  return Boolean(booking.matchedAt || booking.selectedProviderId || booking.selectedProvider);
}

function readBookingAddressText(value: unknown): string | null {
  if (typeof value === 'string') {
    return trimmedString(value);
  }

  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const field of ADDRESS_TEXT_FIELDS) {
    const candidate = trimmedString(record[field]);
    if (candidate) {
      return candidate;
    }
  }

  const nestedAddress: string | null =
    record.address === value ? null : readBookingAddressText(record.address);
  if (nestedAddress) {
    return nestedAddress;
  }

  const addressParts = ADDRESS_PART_FIELDS.map((field) => trimmedString(record[field])).filter(Boolean);
  const uniqueParts = Array.from(new Set(addressParts));
  return uniqueParts.length > 0 ? uniqueParts.join(', ') : null;
}

function readRecord(value: unknown): AddressRecord | null {
  return value && typeof value === 'object' ? (value as AddressRecord) : null;
}

function trimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function assertUnhandledAdminBookingStatus(status: never): never {
  throw new Error(`Unhandled Admin booking list metadata status: ${status}`);
}
