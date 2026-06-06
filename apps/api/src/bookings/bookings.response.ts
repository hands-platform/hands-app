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
  return {
    ...clientBookingResponse(booking),
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

function publicBookingAddress(address: unknown) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    return address;
  }

  return Object.fromEntries(
    Object.entries(address as Record<string, unknown>).filter(
      ([key]) => !PRIVATE_BOOKING_ADDRESS_KEYS.has(key),
    ),
  );
}

function publicBookingAddressSnapshot(snapshot: BookingAddressSnapshotInput) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return snapshot ?? null;
  }

  const response: Record<string, unknown> = {};
  copySnapshotField(snapshot, response, 'address', publicBookingAddress(snapshot.address));
  copySnapshotField(snapshot, response, 'addressText', snapshot.addressText);
  copySnapshotField(snapshot, response, 'latitude', snapshot.latitude);
  copySnapshotField(snapshot, response, 'longitude', snapshot.longitude);
  return response;
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
