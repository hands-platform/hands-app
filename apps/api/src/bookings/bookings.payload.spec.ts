import { BookingStatus, ParticipantStatus, PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import {
  bookingAddressSnapshotCreate,
  bookingCancellationResultWithReleasedPayment,
  bookingCancellationProviderUserIds,
  bookingPaymentCreate,
  bookingServiceLineCreate,
  customerCancellationCloseData,
  normalizeBookingAddress,
  toJson,
} from './bookings.payload';

describe('booking payload helpers', () => {
  it('normalizes object booking addresses while preserving the resolved address text', () => {
    expect(normalizeBookingAddress({ unit: '12A', addressText: 'old text' }, 'District 1')).toEqual({
      unit: '12A',
      addressText: 'District 1',
    });
  });

  it('normalizes string and empty booking addresses to an address text payload', () => {
    expect(normalizeBookingAddress('  District 3  ', 'District 1')).toEqual({
      addressText: 'District 3',
    });
    expect(normalizeBookingAddress(undefined, 'District 1')).toEqual({
      addressText: 'District 1',
    });
  });

  it('uses the authenticated customer contact instead of client-supplied contact fields', () => {
    expect(
      normalizeBookingAddress(
        {
          addressText: 'Client address',
          name: 'Forged name',
          phone: '0000000000',
        },
        'District 1, Ho Chi Minh City, Vietnam',
        { name: 'Nguyen An', phone: '0865907184' },
      ),
    ).toEqual({
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      name: 'Nguyen An',
      phone: '0865907184',
    });
  });

  it('builds booking address snapshot create data', () => {
    const address = { addressText: 'District 1, Ho Chi Minh City, Vietnam' };

    expect(
      bookingAddressSnapshotCreate({
        customerProfileId: 'customer-1',
        selectedLocationId: 'location-1',
        address,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
        latitude: 10.7769,
        longitude: 106.7009,
      }),
    ).toEqual({
      create: {
        customerProfileId: 'customer-1',
        selectedLocationId: 'location-1',
        address,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
        latitude: 10.7769,
        longitude: 106.7009,
      },
    });

    expect(
      bookingAddressSnapshotCreate({
        customerProfileId: 'customer-1',
        selectedLocationId: null,
        address,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
        latitude: 10.7769,
        longitude: 106.7009,
      }).create.selectedLocationId,
    ).toBeUndefined();
  });

  it('builds booking service line create data', () => {
    expect(bookingServiceLineCreate({
      serviceId: 'service-1',
      price: 500000,
      payoutRule: {
        id: 'rule-1',
        customerPrice: 500000,
        providerPayoutAmount: 350000,
        vatBps: 0,
        otherCostAmount: 0,
        currency: 'VND',
      },
    })).toEqual({
      create: {
        serviceId: 'service-1',
        price: 500000,
        payoutRuleIdSnapshot: 'rule-1',
        providerPayoutAmountSnapshot: 350000,
        payoutRuleSnapshot: {
          id: 'rule-1',
          customerPrice: 500000,
          providerPayoutAmount: 350000,
          vatBps: 0,
          otherCostAmount: 0,
          currency: 'VND',
        },
      },
    });
  });

  it('builds booking payment create data', () => {
    const authorization = {
      method: PaymentMethod.CASH,
      amount: 500000,
      status: PaymentStatus.AUTHORIZED,
      providerRef: null,
      rawMeta: { originalAmount: 500000 },
    };

    expect(bookingPaymentCreate(authorization)).toEqual({ create: authorization });
  });

  it('converts serializable values to Prisma JSON input', () => {
    expect(
      toJson({
        recordedAt: new Date('2026-06-11T00:00:00.000Z'),
        nested: { value: 1 },
      }),
    ).toEqual({
      recordedAt: '2026-06-11T00:00:00.000Z',
      nested: { value: 1 },
    });
  });

  it('builds customer cancellation close data', () => {
    const now = new Date('2026-06-11T00:00:00.000Z');

    expect(customerCancellationCloseData(now)).toEqual({
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
    });
  });

  it('uses the released payment record in the cancellation response when available', () => {
    const booking = { id: 'booking-1', payment: { id: 'payment-1', status: 'AUTHORIZED' } };
    const releasedPayment = { id: 'payment-1', status: 'RELEASED' };

    expect(bookingCancellationResultWithReleasedPayment(booking, releasedPayment)).toEqual({
      id: 'booking-1',
      payment: releasedPayment,
    });
    expect(bookingCancellationResultWithReleasedPayment(booking, null)).toBe(booking);
  });

  it('dedupes provider user ids for cancellation notifications', () => {
    expect([
      ...bookingCancellationProviderUserIds({
        preferredProvider: { userId: 'provider-user-1' },
        selectedProvider: { userId: 'provider-user-2' },
        participants: [
          { providerProfile: { userId: 'provider-user-1' } },
          { providerProfile: { userId: 'provider-user-3' } },
          { providerProfile: { userId: null } },
        ],
      }),
    ]).toEqual(['provider-user-1', 'provider-user-2', 'provider-user-3']);
  });
});
