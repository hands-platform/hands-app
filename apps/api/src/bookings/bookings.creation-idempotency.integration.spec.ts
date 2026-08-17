import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  Role,
  ServicePublicationStatus,
} from '@prisma/client';

import { BookingsService } from './bookings.service';

const integrationDescribe = process.env.RUN_BOOKING_DB_INTEGRATION === '1' ? describe : describe.skip;

integrationDescribe('Booking creation PostgreSQL idempotency', () => {
  const prisma = new PrismaClient();
  const runId = `booking-idempotency-${Date.now()}`;
  const userId = `${runId}:user`;
  const customerProfileId = `${runId}:customer`;
  const serviceId = `${runId}:service`;
  const payoutRuleId = `${runId}:payout-rule`;
  const payments = {
    buildAuthorization: vi.fn((method: PaymentMethod, amount: number) => ({
      amount,
      method,
      providerRef: null,
      rawMeta: { integrationRunId: runId },
      status: PaymentStatus.AUTHORIZED,
    })),
  };
  const service = new BookingsService(
    prisma as never,
    {} as never,
    {} as never,
    payments as never,
    {} as never,
    {} as never,
  );
  const flow = service as unknown as {
    createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<{
      booking: { id: string };
      replayed: boolean;
    }>;
  };

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        fullName: 'Booking idempotency integration customer',
        phone: `integration:${runId}`,
        roles: [Role.CUSTOMER],
        customerProfile: { create: { id: customerProfileId } },
      },
    });
    await prisma.massageService.create({
      data: {
        id: serviceId,
        active: true,
        basePrice: 500_000,
        durationMin: 60,
        name: `Booking idempotency ${runId}`,
        publicationStatus: ServicePublicationStatus.PUBLISHED,
        payoutRules: {
          create: {
            id: payoutRuleId,
            customerPrice: 500_000,
            providerPayoutAmount: 350_000,
          },
        },
      },
    });
  });

  afterAll(async () => {
    const bookingIds = (
      await prisma.booking.findMany({
        where: { customerProfileId },
        select: { id: true },
      })
    ).map((booking) => booking.id);
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } }),
      prisma.bookingAddressSnapshot.deleteMany({ where: { bookingId: { in: bookingIds } } }),
      prisma.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } }),
      prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }),
      prisma.servicePayoutRule.deleteMany({ where: { id: payoutRuleId } }),
      prisma.massageService.deleteMany({ where: { id: serviceId } }),
      prisma.customerProfile.deleteMany({ where: { id: customerProfileId } }),
      prisma.user.deleteMany({ where: { id: userId } }),
    ]);
    await prisma.$disconnect();
  });

  it('creates one booking for concurrent requests with the same key and payload', async () => {
    const idempotencyKey = `${runId}:same-payload`;
    const outcomes = await Promise.all([
      flow.createOpenMatchingBookingRecord(bookingInput(idempotencyKey)),
      flow.createOpenMatchingBookingRecord(bookingInput(idempotencyKey)),
    ]);

    expect(outcomes.map((outcome) => outcome.replayed).sort()).toEqual([false, true]);
    expect(new Set(outcomes.map((outcome) => outcome.booking.id))).toHaveLength(1);
    await expect(bookingCount(idempotencyKey)).resolves.toBe(1);
  }, 30_000);

  it('allows one concurrent payload and rejects reuse of its key by a different payload', async () => {
    const idempotencyKey = `${runId}:payload-conflict`;
    const outcomes = await Promise.allSettled([
      flow.createOpenMatchingBookingRecord(bookingInput(idempotencyKey, 'District 1')),
      flow.createOpenMatchingBookingRecord(bookingInput(idempotencyKey, 'District 3')),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason.message : null).toContain(
      'Booking idempotency key was reused with a different request',
    );
    await expect(bookingCount(idempotencyKey)).resolves.toBe(1);
  }, 30_000);

  function bookingInput(idempotencyKey: string, district = 'District 1') {
    const addressText = `${district}, Ho Chi Minh City, Vietnam`;
    const openedAt = new Date('2026-08-17T02:00:00.000Z');
    return {
      addressPayload: { addressText },
      addressText,
      bookingGateSnapshot: { gatePassed: true },
      bookingLat: 10.7769,
      bookingLng: 106.7009,
      couponCode: null,
      customerPrice: 500_000,
      customerProfileId,
      idempotencyKey,
      matchingPolicy: {
        providerResponseWindowMinutes: 10,
        backupProviderRadiusMeters: 10_000,
        backupProviderLocationMaxAgeMinutes: 30,
        backupProviderInvitationLimit: 25,
        bookingMaxCustomerCurrentToAddressKm: 50,
        bookingMaxPreferredProviderDistanceKm: 10,
        bookingCurrentLocationFreshnessMinutes: 30,
        bookingDistanceGateEnabled: true,
        bookingServiceAreaRequired: true,
        preferredAcceptMode: 'CUSTOMER_CONFIRM',
        backupOpenMode: 'IMMEDIATE',
        travelBufferMinutes: 30,
      },
      paymentMethod: PaymentMethod.CASH,
      payoutRule: {
        id: payoutRuleId,
        customerPrice: 500_000,
        providerPayoutAmount: 350_000,
        vatBps: 0,
        otherCostAmount: 0,
        currency: 'VND',
      },
      preferredProviderDistanceMeters: null,
      priceSummary: { finalAmount: 500_000, paymentMetadata: {} },
      requiresPostBookingAuthorization: false,
      serviceId,
      timing: {
        expiresAt: new Date(openedAt.getTime() + 10 * 60_000),
        openedAt,
        scheduledEndAt: new Date(openedAt.getTime() + 60 * 60_000),
        scheduledStartAt: openedAt,
      },
    };
  }

  function bookingCount(idempotencyKey: string) {
    return prisma.booking.count({
      where: {
        customerProfileId,
        metadata: {
          path: ['bookingCreationRequest', 'idempotencyKey'],
          equals: idempotencyKey,
        },
        status: BookingStatus.OPEN_MATCHING,
      },
    });
  }
});
