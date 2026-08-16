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

type BookingCustomerProfileInput =
  | {
      gender?: unknown;
      nationality?: unknown;
      user?: { fullName?: unknown; phone?: unknown } | null;
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

const PUBLIC_BOOKING_ADDRESS_KEYS = new Set(['district', 'ward', 'city', 'province', 'country']);

const PARTNER_OPEN_BOOKING_PRIVATE_KEYS = new Set([
  'address',
  'addressSnapshot',
  'customer',
  'customerId',
  'customerProfile',
  'customerProfileId',
  'customerUserId',
  'participants',
  'user',
  'userId',
]);

const PUBLIC_PROVIDER_PROFILE_KEYS = new Set([
  'id',
  'displayName',
  'bio',
  'bioTranslations',
  'experienceYears',
  'specialties',
  'languages',
  'serviceStyle',
  'city',
  'serviceArea',
  'level',
  'status',
  'ratingAvg',
  'reviewCount',
  'nextAvailableAt',
  'updatedAt',
]);

const CLIENT_BOOKING_PRIVATE_KEYS = new Set([
  'closedByRole',
  'closedReason',
  'customerProfile',
  'metadata',
  'notes',
  'closedNote',
  'refunds',
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
  const source = booking as Record<string, unknown>;
  const publicBooking = Object.fromEntries(
    Object.entries(source).filter(([key]) => !CLIENT_BOOKING_PRIVATE_KEYS.has(key)),
  );
  return {
    ...publicBooking,
    payment: clientBookingPayment(booking.payment),
    cancellation: clientBookingCancellation(source),
    preferredProvider: publicProviderProfile(source.preferredProvider),
    selectedProvider: publicProviderProfile(source.selectedProvider),
    participants: publicBookingParticipants(source.participants),
    snapshots: source.selectedProviderId ? source.snapshots : [],
  };
}

function clientBookingCancellation(booking: Record<string, unknown>) {
  const status = textValue(booking.status);
  if (!['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(status)) {
    return null;
  }

  const closedReason = textValue(booking.closedReason).toLowerCase();
  const postMatchCancellation = nestedRecord(booking.metadata, 'postMatchCancellation');
  const partnerReasonCode = textValue(postMatchCancellation?.reasonCode);
  const reason = customerCancellationReason(closedReason, partnerReasonCode);
  return {
    reasonCode: reason.code,
    reason: reason.message,
    paymentOutcome: customerCancellationPaymentOutcome(booking, postMatchCancellation),
    supportRecommended:
      postMatchCancellation?.requiresAdminReview === true ||
      ['SAFETY_CONCERN', 'CUSTOMER_NOT_FOUND'].includes(partnerReasonCode),
  };
}

function customerCancellationReason(closedReason: string, partnerReasonCode: string) {
  if (closedReason === 'customer_cancelled') {
    return {
      code: 'CUSTOMER_CANCELLED_BEFORE_MATCH',
      message: 'You cancelled this booking before a partner was matched.',
    };
  }
  if (closedReason === 'preferred_provider_rejected') {
    return {
      code: 'PREFERRED_PARTNER_DECLINED',
      message: 'The requested partner could not accept this booking.',
    };
  }
  if (closedReason === 'preferred_provider_no_response') {
    return {
      code: 'PARTNER_RESPONSE_EXPIRED',
      message: 'The partner did not respond before the booking request expired.',
    };
  }

  const partnerReasons: Record<string, { code: string; message: string }> = {
    CUSTOMER_REQUESTED: {
      code: 'CUSTOMER_REQUESTED',
      message: 'This booking was cancelled after your request.',
    },
    CUSTOMER_NOT_FOUND: {
      code: 'CUSTOMER_NOT_FOUND',
      message: 'The partner could not meet you at the service location.',
    },
    SAFETY_CONCERN: {
      code: 'SAFETY_CONCERN',
      message: 'This booking was cancelled for safety reasons. HANDS support can help if needed.',
    },
    SERVICE_CANNOT_BE_PROVIDED: {
      code: 'SERVICE_CANNOT_BE_PROVIDED',
      message: 'The partner could not provide the requested service.',
    },
    OTHER: {
      code: 'PARTNER_CANCELLED',
      message: 'The partner cancelled this booking.',
    },
  };
  return (
    partnerReasons[partnerReasonCode] ?? {
      code: statusReasonExpired(closedReason) ? 'REQUEST_EXPIRED' : 'BOOKING_CANCELLED',
      message: statusReasonExpired(closedReason)
        ? 'This booking request expired before a partner was matched.'
        : 'This booking was cancelled.',
    }
  );
}

function customerCancellationPaymentOutcome(
  booking: Record<string, unknown>,
  postMatchCancellation: Record<string, unknown> | null,
) {
  const payment = isPlainRecord(booking.payment) ? booking.payment : null;
  const method = textValue(payment?.method);
  const paymentStatus = textValue(payment?.status);
  if (!payment || method === 'CASH') return 'NO_CHARGE';
  if (postMatchCancellation?.requiresAdminReview === true || postMatchCancellation?.autoApproved === false) {
    return 'UNDER_REVIEW';
  }
  if (paymentStatus === 'RELEASED') return 'RELEASED';
  if (paymentStatus === 'REFUNDED') return 'REFUNDED';

  const refunds = Array.isArray(booking.refunds) ? booking.refunds : [];
  const refundStatus = textValue(isPlainRecord(refunds[0]) ? refunds[0].status : null);
  if (['COMPLETED', 'REFUNDED'].includes(refundStatus)) return 'REFUNDED';
  if (refundStatus) return 'REFUND_REQUESTED';
  if (paymentStatus === 'CAPTURED') return 'REFUND_REQUESTED';
  return 'PROCESSING';
}

function nestedRecord(value: unknown, key: string) {
  return isPlainRecord(value) && isPlainRecord(value[key]) ? value[key] : null;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function statusReasonExpired(reason: string) {
  return reason.includes('expired') || reason.includes('no_response');
}

export function clientBookingResponses<T extends { payment?: ClientPaymentInput }>(bookings: T[]) {
  return bookings.map((booking) => clientBookingResponse(booking));
}

export function partnerOpenBookingResponse<
  T extends {
    payment?: ClientPaymentInput;
    preferredProviderId?: string | null;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
    customerProfile?: BookingCustomerProfileInput;
  },
>(booking: T, providerProfileId?: string) {
  const publicBooking = publicPartnerOpenBookingFields(
    clientBookingResponse(booking) as Record<string, unknown>,
  );

  return {
    ...publicBooking,
    isPreferredRequest: booking.preferredProviderId === providerProfileId,
    participationStatus: providerParticipationStatus(sourceParticipants(booking), providerProfileId),
    customer: partnerCustomerSummary(booking.customerProfile, false),
    address: publicBookingAddress(booking.address),
    addressSnapshot: publicBookingAddressSnapshot(booking.addressSnapshot),
  };
}

function sourceParticipants(value: unknown) {
  return isPlainRecord(value) ? value.participants : null;
}

function providerParticipationStatus(value: unknown, providerProfileId?: string) {
  if (!providerProfileId || !Array.isArray(value)) {
    return null;
  }
  const participant = value.find(
    (item) => isPlainRecord(item) && item.providerProfileId === providerProfileId,
  );
  return isPlainRecord(participant) ? textValue(participant.status) || null : null;
}

export function partnerOpenBookingResponses<
  T extends {
    payment?: ClientPaymentInput;
    preferredProviderId?: string | null;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
    customerProfile?: BookingCustomerProfileInput;
  },
>(bookings: T[], providerProfileId: string) {
  return bookings.map((booking) => partnerOpenBookingResponse(booking, providerProfileId));
}

export function partnerBookingResponse<
  T extends {
    payment?: ClientPaymentInput;
    preferredProviderId?: string | null;
    selectedProviderId?: string | null;
    address?: unknown;
    addressSnapshot?: BookingAddressSnapshotInput;
    customerProfile?: BookingCustomerProfileInput;
  },
>(booking: T, providerProfileId: string) {
  if (booking.selectedProviderId !== providerProfileId) {
    return partnerOpenBookingResponse(booking, providerProfileId);
  }

  const publicBooking = publicPartnerOpenBookingFields(
    clientBookingResponse(booking) as Record<string, unknown>,
  );
  return {
    ...publicBooking,
    isPreferredRequest: booking.preferredProviderId === providerProfileId,
    customer: partnerCustomerSummary(booking.customerProfile, true),
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
    customerProfile?: BookingCustomerProfileInput;
  },
>(bookings: T[], providerProfileId: string) {
  return bookings.map((booking) => partnerBookingResponse(booking, providerProfileId));
}

function publicBookingAddress(address: unknown) {
  if (!isPlainRecord(address)) {
    return address;
  }

  const publicAddress = Object.fromEntries(
    Object.entries(address).filter(
      ([key]) => PUBLIC_BOOKING_ADDRESS_KEYS.has(key) && !PRIVATE_BOOKING_ADDRESS_KEYS.has(key),
    ),
  );
  const addressPreview = coarseAddressPreview(address);
  if (addressPreview) {
    publicAddress.addressPreview = addressPreview;
  }
  return publicAddress;
}

function partnerCustomerSummary(profile: BookingCustomerProfileInput, includeContact: boolean) {
  const summary: Record<string, unknown> = {
    gender: textValue(profile?.gender) || null,
    nationality: textValue(profile?.nationality) || null,
  };
  if (includeContact) {
    summary.fullName = textValue(profile?.user?.fullName) || null;
    summary.phone = textValue(profile?.user?.phone) || null;
  }
  return summary;
}

function publicPartnerOpenBookingFields(booking: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(booking).filter(([key]) => !PARTNER_OPEN_BOOKING_PRIVATE_KEYS.has(key)),
  );
}

function publicBookingAddressSnapshot(snapshot: BookingAddressSnapshotInput) {
  if (!isPlainRecord(snapshot)) {
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
  if (!isPlainRecord(value)) {
    return null;
  }
  const parts = [value.ward, value.district, value.city, value.province, value.country]
    .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
    .map((part) => part.trim());
  const usefulParts = parts.filter((part, index) => parts.indexOf(part) === index);
  if (usefulParts.length > 0) {
    return usefulParts.slice(0, 3).join(', ');
  }

  const text = value.addressText ?? value.address_text ?? value.line1 ?? value.address;
  if (typeof text !== 'string') {
    return null;
  }
  const textParts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (textParts.length <= 1) {
    return null;
  }
  return textParts.slice(1, 4).join(', ');
}

function publicProviderProfile(value: unknown) {
  if (!isPlainRecord(value)) {
    return value ?? null;
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => PUBLIC_PROVIDER_PROFILE_KEYS.has(key)));
}

function publicBookingParticipants(value: unknown) {
  if (!Array.isArray(value)) {
    return value ?? [];
  }
  return value.map((participant) => {
    if (!isPlainRecord(participant)) {
      return participant;
    }
    return {
      ...participant,
      providerProfile: publicProviderProfile(participant.providerProfile),
    };
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
