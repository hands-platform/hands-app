import { BookingStatus } from '@prisma/client';
import { ADMIN_BOOKING_LIVE_MAX_AGE_HOURS } from './admin-booking-list-query';

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
  readonly id?: string;
  readonly matchedAt?: Date | string | null;
  readonly metadata?: unknown;
  readonly openedAt?: Date | string | null;
  readonly customerProfileId?: string | null;
  readonly preferredProviderId?: string | null;
  readonly selectedProvider?: unknown;
  readonly selectedProviderId?: string | null;
  readonly status: BookingStatus;
  readonly updatedAt?: Date | string | null;
};

export type AdminBookingListMetadata = {
  readonly dataClass: AdminBookingDataClass;
  readonly lastEventAt: Date | string | null;
  readonly scopeEnd: Date;
  readonly scopeStart: Date | null;
  readonly serviceAddressText: string | null;
  readonly sourceUpdatedAt: Date | string | null;
  readonly statusChangedAt: Date | string | null;
  readonly statusChangedLabel: string;
};

export type AdminBookingDataClass = 'live' | 'backlog' | 'anomaly' | 'test';

type AdminBookingListPrivacyInput = {
  readonly address?: unknown;
  readonly addressSnapshot?: {
    readonly address?: unknown;
    readonly addressText?: string | null;
    readonly latitude?: unknown;
    readonly longitude?: unknown;
  } | null;
  readonly customerProfile?: {
    readonly user?: {
      readonly phone?: string | null;
    } | null;
  } | null;
  readonly lat?: unknown;
  readonly lng?: unknown;
};

type ProtectedAdminBookingListItem<T extends AdminBookingListPrivacyInput> = Omit<
  T,
  'address' | 'addressSnapshot' | 'customerProfile' | 'lat' | 'lng'
> & {
  readonly address: null;
  readonly addressSnapshot:
    | (Record<string, unknown> & {
        readonly address: null;
        readonly addressText: string | null;
        readonly latitude: null;
        readonly longitude: null;
      })
    | null
    | undefined;
  readonly customerProfile: T['customerProfile'];
  readonly lat: null;
  readonly lng: null;
  readonly serviceAddressText: string | null;
};

const LIST_METADATA_TEXT_FIELDS = ['deviceLanguage', 'customerDeviceLanguage', 'language', 'locale'] as const;
const LIST_METADATA_MATCHING_POLICY_FIELDS = [
  'providerResponseWindowMinutes',
  'marketplaceRadiusMeters',
  'marketplacePartnerRadiusMeters',
  'backupProviderRadiusMeters',
  'marketplaceLocationMaxAgeMinutes',
  'marketplacePartnerLocationMaxAgeMinutes',
  'backupProviderLocationMaxAgeMinutes',
  'marketplaceInvitationLimit',
  'marketplacePartnerInvitationLimit',
  'backupProviderInvitationLimit',
  'preferredAcceptMode',
  'marketplaceOpenMode',
  'backupOpenMode',
  'travelBufferMinutes',
] as const;
const LIST_METADATA_ALERT_TRACE_FIELDS = ['stage', 'createdAt', 'notifiedCount'] as const;
const LIST_METADATA_POST_MATCH_CANCELLATION_FIELDS = [
  'reasonCode',
  'reasonLabel',
  'requiresAdminReview',
  'autoApproved',
] as const;

const ADDRESS_TEXT_FIELDS = [
  'addressText',
  'address_text',
  'fullAddress',
  'full_address',
  'formattedAddress',
  'formatted_address',
  'displayAddress',
  'display_address',
  'addressLine',
  'address_line',
] as const;

const ADDRESS_PART_FIELDS = ['line1', 'street', 'ward', 'district', 'city', 'province', 'country'] as const;
const SAFE_ADDRESS_AREA_FIELDS = [
  'ward',
  'district',
  'subAdministrativeArea',
  'city',
  'administrativeArea',
  'province',
  'country',
] as const;
const ADDRESS_LABEL_FIELDS = ['label', 'name'] as const;
const COORDINATE_PAIR_TEXT_RE = /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;
const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CREATED,
  BookingStatus.OPEN_MATCHING,
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
]);

export function withAdminBookingListMetadataList<T extends AdminBookingListMetadataInput>(
  bookings: readonly T[],
): Array<T & AdminBookingListMetadata> {
  const now = new Date();
  return bookings.map((booking) => withAdminBookingListMetadata(booking, now));
}

export function withAdminBookingListMetadata<T extends AdminBookingListMetadataInput>(
  booking: T,
  now = new Date(),
): T & AdminBookingListMetadata {
  const lastEventAt = bookingStatusChangedAt(booking);
  const liveBoundary = new Date(
    now.getTime() - ADMIN_BOOKING_LIVE_MAX_AGE_HOURS * 60 * 60_000,
  );
  const dataClass = adminBookingDataClass(booking, liveBoundary);
  return {
    ...booking,
    dataClass,
    lastEventAt,
    scopeEnd: now,
    scopeStart: dataClass === 'live' ? liveBoundary : null,
    serviceAddressText: bookingServiceAddressText(booking),
    sourceUpdatedAt: booking.updatedAt ?? lastEventAt,
    statusChangedAt: lastEventAt,
    statusChangedLabel: bookingStatusChangedLabel(booking),
  };
}

function adminBookingDataClass(
  booking: AdminBookingListMetadataInput,
  liveBoundary: Date,
): AdminBookingDataClass {
  if (isExplicitBookingFixture(booking)) {
    return 'test';
  }
  if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) {
    return 'backlog';
  }
  const updatedAtMs = booking.updatedAt ? new Date(booking.updatedAt).getTime() : Number.NaN;
  return updatedAtMs >= liveBoundary.getTime() ? 'live' : 'anomaly';
}

function isExplicitBookingFixture(booking: AdminBookingListMetadataInput) {
  const fixtureId = [
    booking.id,
    booking.customerProfileId,
    booking.preferredProviderId,
    booking.selectedProviderId,
  ].some((value) => /^(?:smoke|seed-)/i.test(value ?? ''));
  const metadata = readRecord(booking.metadata);
  return fixtureId || metadata?.smokeFixture === true || metadata?.smoke === true;
}

export function protectAdminBookingListItem<T extends AdminBookingListPrivacyInput>(
  booking: T,
): ProtectedAdminBookingListItem<T> {
  const serviceAddressText = bookingServiceAreaText(booking);
  const customerProfile = booking.customerProfile
    ? {
        ...booking.customerProfile,
        user: booking.customerProfile.user
          ? {
              ...booking.customerProfile.user,
              phone: maskedPhone(booking.customerProfile.user.phone),
            }
          : booking.customerProfile.user,
      }
    : booking.customerProfile;
  const addressSnapshot = booking.addressSnapshot
    ? {
        ...booking.addressSnapshot,
        address: null,
        addressText: serviceAddressText,
        latitude: null,
        longitude: null,
      }
    : booking.addressSnapshot;

  return {
    ...booking,
    address: null,
    addressSnapshot,
    customerProfile,
    lat: null,
    lng: null,
    serviceAddressText,
  } as ProtectedAdminBookingListItem<T>;
}

export function adminBookingListMetadataPayload(metadata: unknown): Record<string, unknown> | null {
  const record = readRecord(metadata);
  if (!record) {
    return null;
  }

  const payload: Record<string, unknown> = {};
  copyTextFields(payload, record, LIST_METADATA_TEXT_FIELDS);

  const matchingPolicy = pickKnownFields(
    readRecord(record.matchingPolicy),
    LIST_METADATA_MATCHING_POLICY_FIELDS,
  );
  if (matchingPolicy) {
    payload.matchingPolicy = matchingPolicy;
  }

  const alertTraces = Array.isArray(record.backupNotificationTraces)
    ? record.backupNotificationTraces
        .map((trace) => pickKnownFields(readRecord(trace), LIST_METADATA_ALERT_TRACE_FIELDS))
        .filter((trace): trace is Record<string, unknown> => Boolean(trace))
    : [];
  if (alertTraces.length > 0) {
    payload.backupNotificationTraces = alertTraces;
  }

  const postMatchCancellation = pickKnownFields(
    readRecord(record.postMatchCancellation),
    LIST_METADATA_POST_MATCH_CANCELLATION_FIELDS,
  );
  if (postMatchCancellation) {
    payload.postMatchCancellation = postMatchCancellation;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

export function bookingServiceAddressText(booking: AdminBookingListMetadataInput): string | null {
  return (
    readBookingAddressText(booking.addressSnapshot?.addressText) ??
    readBookingAddressText(booking.address) ??
    readBookingAddressText(booking.addressSnapshot?.address) ??
    readBookingAddressText(booking.addressSnapshot)
  );
}

function bookingServiceAreaText(booking: AdminBookingListPrivacyInput) {
  return (
    structuredAddressArea(booking.address) ??
    structuredAddressArea(booking.addressSnapshot?.address) ??
    null
  );
}

function structuredAddressArea(value: unknown): string | null {
  const record = readRecord(value);
  if (!record) {
    return null;
  }

  const parts = SAFE_ADDRESS_AREA_FIELDS.map((field) => trimmedAddressText(record[field])).filter(Boolean);
  const uniqueParts = Array.from(new Set(parts));
  if (uniqueParts.length > 0) {
    return uniqueParts.slice(0, 3).join(', ');
  }

  return record.address === value ? null : structuredAddressArea(record.address);
}

function maskedPhone(value: string | null | undefined) {
  const phone = value?.trim();
  if (!phone || phone.includes('*')) {
    return phone;
  }

  const digits = phone.replace(/\D/gu, '');
  if (digits.length < 4) {
    return 'Phone hidden';
  }

  const prefix = phone.startsWith('+84') ? '+84' : phone.startsWith('+') ? '+' : '';
  const prefixDigits = prefix === '+84' ? 2 : 0;
  return `${prefix}${'*'.repeat(Math.max(3, digits.length - prefixDigits - 4))}${digits.slice(-4)}`;
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
    return trimmedAddressText(value);
  }

  const record = readRecord(value);
  if (!record) {
    return null;
  }

  for (const field of ADDRESS_TEXT_FIELDS) {
    const candidate = trimmedAddressText(record[field]);
    if (candidate) {
      return candidate;
    }
  }

  const addressParts = ADDRESS_PART_FIELDS.map((field) => trimmedAddressText(record[field])).filter(Boolean);
  const uniqueParts = Array.from(new Set(addressParts));
  if (uniqueParts.length > 0) {
    return uniqueParts.join(', ');
  }

  const nestedAddress: string | null =
    record.address === value ? null : readBookingAddressText(record.address);
  if (nestedAddress) {
    return nestedAddress;
  }

  for (const field of ADDRESS_LABEL_FIELDS) {
    const candidate = trimmedAddressText(record[field]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function readRecord(value: unknown): AddressRecord | null {
  return value && typeof value === 'object' ? (value as AddressRecord) : null;
}

function copyTextFields(
  output: Record<string, unknown>,
  input: AddressRecord,
  fields: readonly string[],
) {
  for (const field of fields) {
    const value = trimmedAddressText(input[field]);
    if (value) {
      output[field] = value;
    }
  }
}

function pickKnownFields(input: AddressRecord | null, fields: readonly string[]) {
  if (!input) {
    return null;
  }

  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const value = input[field];
    if (value !== null && value !== undefined) {
      output[field] = value;
    }
  }
  return Object.keys(output).length > 0 ? output : null;
}

function trimmedAddressText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || isPinLikeAddressText(text)) {
    return null;
  }
  return text;
}

function isPinLikeAddressText(value: string) {
  return COORDINATE_PAIR_TEXT_RE.test(value) || /\bpin\b/i.test(value);
}

function assertUnhandledAdminBookingStatus(status: never): never {
  throw new Error(`Unhandled Admin booking list metadata status: ${status}`);
}
