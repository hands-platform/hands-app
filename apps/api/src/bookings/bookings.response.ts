type ClientPaymentInput =
  | {
      amount: number;
      method: unknown;
      status: unknown;
      currency?: string | null;
      [key: string]: unknown;
    }
  | null
  | undefined;

type BookingAddressSnapshotInput =
  | {
      address?: unknown;
      addressText?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      [key: string]: unknown;
    }
  | null
  | undefined;

const PRIVATE_BOOKING_ADDRESS_KEYS = new Set([
  'phone',
  'phoneNumber',
  'phone_number',
  'contactPhone',
  'contact_phone',
  'address',
  'addressLine',
  'address_line',
  'addressText',
  'address_text',
  'formattedAddress',
  'formatted_address',
  'label',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'line1',
  'line2',
]);

const PUBLIC_BOOKING_ADDRESS_KEYS = new Set([
  'district',
  'ward',
  'city',
  'province',
  'country',
]);

const PARTNER_OPEN_BOOKING_PRIVATE_KEYS = new Set([
  'address',
  'addressSnapshot',
  'customer',
  'customerId',
  'customerProfile',
  'customerProfileId',
  'customerUserId',
  'user',
  'userId',
]);

export function clientBookingPayment(payment: ClientPaymentInput) {
  if (!payment) {
    return null;
  }

  return {
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    currency: payment.currency ?? 'VND',
  };
}

export function clientBookingResponse<T extends { payment?: ClientPaymentInput }>(booking: T) {
  return {
    ...booking,
    payment: clientBookingPayment(booking.payment),
  };
}

export function clientBookingResponses<T extends { payment?: ClientPaymentInput }>(bookings: T[]) {
  return bookings.map((booking) => clientBookingResponse(booking));
}

export function partnerOpenBookingResponse<
  T extends {
    payment?: ClientPaymentInput;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
  },
>(booking: T) {
  const publicBooking = publicPartnerOpenBookingFields(
    clientBookingResponse(booking) as Record<string, unknown>,
  );

  return {
    ...publicBooking,
    address: publicBookingAddress(booking.address),
    addressSnapshot: publicBookingAddressSnapshot(booking.addressSnapshot),
  };
}

export function partnerOpenBookingResponses<
  T extends {
    payment?: ClientPaymentInput;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
  },
>(bookings: T[]) {
  return bookings.map((booking) => partnerOpenBookingResponse(booking));
}

export function partnerBookingResponse<
  T extends {
    payment?: ClientPaymentInput;
    selectedProviderId?: string | null;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
  },
>(booking: T, providerProfileId: string) {
  if (booking.selectedProviderId !== providerProfileId) {
    return partnerOpenBookingResponse(booking);
  }

  const publicBooking = publicPartnerOpenBookingFields(
    clientBookingResponse(booking) as Record<string, unknown>,
  );
  return {
    ...publicBooking,
    address: booking.address,
    addressSnapshot: booking.addressSnapshot ?? null,
  };
}

export function partnerBookingResponses<
  T extends {
    payment?: ClientPaymentInput;
    selectedProviderId?: string | null;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
  },
>(bookings: T[], providerProfileId: string) {
  return bookings.map((booking) => partnerBookingResponse(booking, providerProfileId));
}

function publicBookingAddress(address: unknown) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    return address;
  }

  const record = address as Record<string, unknown>;
  const publicAddress = Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => PUBLIC_BOOKING_ADDRESS_KEYS.has(key) && !PRIVATE_BOOKING_ADDRESS_KEYS.has(key),
    ),
  );
  const addressPreview = coarseAddressPreview(record);
  if (addressPreview) {
    publicAddress.addressPreview = addressPreview;
  }
  return publicAddress;
}

function publicPartnerOpenBookingFields(booking: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(booking).filter(([key]) => !PARTNER_OPEN_BOOKING_PRIVATE_KEYS.has(key)),
  );
}

function publicBookingAddressSnapshot(snapshot: BookingAddressSnapshotInput) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return snapshot ?? null;
  }

  const response: Record<string, unknown> = {};
  copySnapshotField(snapshot, response, 'address', publicBookingAddress(snapshot.address));
  const addressPreview =
    coarseAddressPreview(snapshot.address) ?? coarseAddressPreview({ addressText: snapshot.addressText });
  if (addressPreview) {
    response.addressPreview = addressPreview;
  }
  return response;
}

function coarseAddressPreview(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const parts = [record.ward, record.district, record.city, record.province, record.country]
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .map((part) => part.trim());
  const usefulParts = parts.filter((part, index) => parts.indexOf(part) === index);
  if (usefulParts.length > 0) {
    return usefulParts.slice(0, 3).join(', ');
  }

  const text = record.addressText ?? record.address_text ?? record.line1 ?? record.address;
  if (typeof text !== 'string') {
    return null;
  }
  const textParts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (textParts.length <= 1) {
    return textParts[0] ?? null;
  }
  return textParts.slice(1, 4).join(', ');
}

function copySnapshotField(
  snapshot: Record<string, unknown>,
  response: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
    response[key] = value;
  }
}
