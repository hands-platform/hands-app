import { BookingStatus, ParticipantStatus, Prisma, Role } from '@prisma/client';

export function normalizeBookingAddress(
  address: Prisma.InputJsonValue | undefined,
  addressText: string,
  customer?: { name: string; phone: string },
) {
  const normalized =
    address && typeof address === 'object' && !Array.isArray(address)
      ? { ...(address as Record<string, unknown>), addressText }
      : { addressText: typeof address === 'string' && address.trim() ? address.trim() : addressText };
  return {
    ...normalized,
    ...(customer ? { name: customer.name, phone: customer.phone } : {}),
  } as Prisma.InputJsonValue;
}

export function bookingAddressSnapshotCreate(input: {
  customerProfileId: string;
  selectedLocationId?: string | null;
  address: Prisma.InputJsonValue;
  addressText: string;
  latitude: number;
  longitude: number;
}) {
  return {
    create: {
      customerProfileId: input.customerProfileId,
      selectedLocationId: input.selectedLocationId ?? undefined,
      address: input.address,
      addressText: input.addressText,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  };
}

export function bookingServiceLineCreate(input: {
  serviceId: string;
  price: number;
  payoutRule: {
    id: string;
    customerPrice: number;
    providerPayoutAmount: number;
    vatBps: number;
    otherCostAmount: number;
    currency: string;
  };
}) {
  return {
    create: {
      serviceId: input.serviceId,
      price: input.price,
      payoutRuleIdSnapshot: input.payoutRule.id,
      providerPayoutAmountSnapshot: input.payoutRule.providerPayoutAmount,
      payoutRuleSnapshot: toJson(input.payoutRule),
    },
  };
}

export function bookingPaymentCreate(input: Prisma.PaymentCreateWithoutBookingInput) {
  return { create: input };
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function customerCancellationCloseData(now = new Date()) {
  return {
    status: BookingStatus.CANCELLED,
    closedAt: now,
    closedByRole: Role.CUSTOMER,
    closedReason: 'customer_cancelled',
    closedNote: 'Customer cancelled before partner commitment.',
    participants: {
      updateMany: {
        where: { status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] } },
        data: { status: ParticipantStatus.EXPIRED, respondedAt: now },
      },
    },
  };
}

export function bookingCancellationResultWithReleasedPayment<TBooking, TPayment>(
  booking: TBooking,
  releasedPayment: TPayment | null | undefined,
) {
  return releasedPayment ? { ...booking, payment: releasedPayment } : booking;
}

export function bookingCancellationProviderUserIds(booking: {
  preferredProvider?: { userId?: string | null } | null;
  selectedProvider?: { userId?: string | null } | null;
  participants?: Array<{ providerProfile?: { userId?: string | null } | null }>;
}) {
  const userIds = new Set<string>();
  if (booking.preferredProvider?.userId) {
    userIds.add(booking.preferredProvider.userId);
  }
  if (booking.selectedProvider?.userId) {
    userIds.add(booking.selectedProvider.userId);
  }
  for (const participant of booking.participants ?? []) {
    if (participant.providerProfile?.userId) {
      userIds.add(participant.providerProfile.userId);
    }
  }
  return userIds;
}
