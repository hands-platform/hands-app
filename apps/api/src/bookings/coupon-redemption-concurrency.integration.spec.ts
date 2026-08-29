import {
  BookingStatus,
  CouponRedemptionState,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  Role,
  ServicePublicationStatus,
} from '@prisma/client';

import { disposableIntegrationDatabaseTarget } from '../common/disposable-integration-database';
import {
  COUPON_RELEASE_REASON,
  COUPON_REVERSAL_REASON,
  consumeCouponRedemptionForBooking,
  recordCouponRedemptionReversal,
  releaseCouponRedemptionForBooking,
} from './bookings.coupon-redemption';
import { BookingsService } from './bookings.service';

const integrationEnabled = process.env.RUN_COUPON_REDEMPTION_DB_INTEGRATION === '1';
const integrationTarget = integrationEnabled
  ? disposableIntegrationDatabaseTarget(process.env.DATABASE_URL, process.env.INTEGRATION_DATABASE_ALLOWLIST)
  : null;
const integrationDescribe = integrationEnabled ? describe : describe.skip;

integrationDescribe('Booking coupon redemption PostgreSQL concurrency', () => {
  const prisma = new PrismaClient({
    ...(integrationTarget ? { datasources: { db: { url: integrationTarget.databaseUrl } } } : {}),
  });
  const runId = `coupon-redemption-${Date.now()}`;
  const serviceId = `${runId}:service`;
  const payoutRuleId = `${runId}:payout-rule`;
  const customers = [0, 1].map((index) => ({
    profileId: `${runId}:customer:${index}`,
    userId: `${runId}:user:${index}`,
  }));
  const payments = {
    buildAuthorization: vi.fn(
      (method: PaymentMethod, amount: number, _bookingId: string, rawMeta: Record<string, unknown>) => ({
        amount,
        method,
        providerRef: null,
        rawMeta,
        status: PaymentStatus.PENDING,
      }),
    ),
    closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({
      refundRequested: false,
      released: false,
    }),
    requiresPostBookingAuthorization: vi.fn().mockReturnValue(true),
  };
  const matching = { closeBooking: vi.fn() };
  const matchingGateway = { emitBookingExpired: vi.fn() };
  const notifications = { create: vi.fn() };
  const service = new BookingsService(
    prisma as never,
    matching as never,
    matchingGateway as never,
    payments as never,
    notifications as never,
    {} as never,
  );
  const flow = service as unknown as {
    createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<{
      booking: { id: string };
      replayed: boolean;
    }>;
  };

  beforeAll(async () => {
    for (const [index, customer] of customers.entries()) {
      await prisma.user.create({
        data: {
          id: customer.userId,
          fullName: `Coupon concurrency customer ${index + 1}`,
          phone: `integration:${runId}:${index}`,
          roles: [Role.CUSTOMER],
          customerProfile: { create: { id: customer.profileId } },
        },
      });
    }
    await prisma.massageService.create({
      data: {
        id: serviceId,
        active: true,
        basePrice: 500_000,
        durationMin: 60,
        name: `Coupon redemption ${runId}`,
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
    await prisma.$disconnect();
  });

  it('allows exactly one Booking/Payment/RESERVED row at the total redemption limit', async () => {
    const coupon = await createCoupon('total-cap', {
      grossBudgetAmount: 200_000n,
      maxRedemptions: 1,
      perCustomerRedemptionLimit: 1,
    });

    const outcomes = await Promise.allSettled([
      createBooking(coupon.code, customers[0].profileId, 'total-a'),
      createBooking(coupon.code, customers[1].profileId, 'total-b'),
    ]);

    expectSingleReservation(outcomes);
    await expect(redemptionCount(coupon.id)).resolves.toBe(1);
    await expect(paymentCountForCoupon(coupon.code)).resolves.toBe(1);
  }, 30_000);

  it('does not let concurrent bookings exceed the remaining gross budget', async () => {
    const coupon = await createCoupon('budget-cap', {
      grossBudgetAmount: 150_000n,
      maxRedemptions: 2,
      perCustomerRedemptionLimit: 1,
    });

    const outcomes = await Promise.allSettled([
      createBooking(coupon.code, customers[0].profileId, 'budget-a'),
      createBooking(coupon.code, customers[1].profileId, 'budget-b'),
    ]);

    expectSingleReservation(outcomes);
    await expect(activeDiscountExposure(coupon.id)).resolves.toBe(100_000);
  }, 30_000);

  it('allows exactly one booking when one customer races their lifetime limit', async () => {
    const coupon = await createCoupon('customer-cap', {
      grossBudgetAmount: 200_000n,
      maxRedemptions: 2,
      perCustomerRedemptionLimit: 1,
    });

    const outcomes = await Promise.allSettled([
      createBooking(coupon.code, customers[0].profileId, 'customer-a'),
      createBooking(coupon.code, customers[0].profileId, 'customer-b'),
    ]);

    expectSingleReservation(outcomes);
    await expect(redemptionCount(coupon.id)).resolves.toBe(1);
  }, 30_000);

  it('replays the existing booking without consuming capacity after the coupon is paused', async () => {
    const coupon = await createCoupon('replay');
    const idempotencyKey = `${runId}:replay`;
    const first = await flow.createOpenMatchingBookingRecord(
      bookingInput(coupon.code, customers[0].profileId, idempotencyKey),
    );
    await prisma.coupon.update({ where: { id: coupon.id }, data: { active: false } });

    const replay = await flow.createOpenMatchingBookingRecord(
      bookingInput(coupon.code, customers[0].profileId, idempotencyKey),
    );

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ booking: expect.objectContaining({ id: first.booking.id }), replayed: true });
    await expect(redemptionCount(coupon.id)).resolves.toBe(1);
    await expect(bookingCount(idempotencyKey)).resolves.toBe(1);
  }, 30_000);

  it('rejects a different payload on the same key without reserving more capacity', async () => {
    const coupon = await createCoupon('conflict');
    const idempotencyKey = `${runId}:conflict`;
    await flow.createOpenMatchingBookingRecord(
      bookingInput(coupon.code, customers[0].profileId, idempotencyKey, 'District 1'),
    );

    await expect(
      flow.createOpenMatchingBookingRecord(
        bookingInput(coupon.code, customers[0].profileId, idempotencyKey, 'District 3'),
      ),
    ).rejects.toThrow('Booking idempotency key was reused with a different request');
    await expect(redemptionCount(coupon.id)).resolves.toBe(1);
    await expect(bookingCount(idempotencyKey)).resolves.toBe(1);
  }, 30_000);

  it('rolls back the booking and reservation when nested Payment creation fails', async () => {
    const coupon = await createCoupon('payment-failure');
    const duplicateProviderRef = `${runId}:duplicate-payment-ref`;
    await prisma.booking.create({
      data: {
        address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
        customerProfileId: customers[0].profileId,
        lat: 10.7769,
        lng: 106.7009,
        payment: {
          create: {
            amount: 1,
            method: PaymentMethod.CASH,
            providerRef: duplicateProviderRef,
            status: PaymentStatus.PENDING,
          },
        },
        scheduledEndAt: new Date(Date.now() + 60 * 60_000),
        scheduledStartAt: new Date(),
      },
    });
    payments.buildAuthorization.mockImplementationOnce((method, amount, _bookingId, rawMeta) => ({
      amount,
      method,
      providerRef: duplicateProviderRef,
      rawMeta,
      status: PaymentStatus.PENDING,
    }));
    const idempotencyKey = `${runId}:payment-failure`;

    await expect(
      flow.createOpenMatchingBookingRecord(bookingInput(coupon.code, customers[0].profileId, idempotencyKey)),
    ).rejects.toThrow();
    await expect(redemptionCount(coupon.id)).resolves.toBe(0);
    await expect(bookingCount(idempotencyKey)).resolves.toBe(0);
  }, 30_000);

  it('releases a reservation with customer cancellation and makes total capacity reusable', async () => {
    const coupon = await createCoupon('customer-release', {
      grossBudgetAmount: 100_000n,
      maxRedemptions: 1,
      perCustomerRedemptionLimit: 1,
    });
    const first = await createBooking(coupon.code, customers[0].profileId, 'customer-release-a');

    await service.cancelCustomerBooking(first.booking.id, customers[0].userId);

    await expect(
      prisma.couponRedemption.findUnique({ where: { bookingId: first.booking.id } }),
    ).resolves.toMatchObject({
      state: CouponRedemptionState.RELEASED,
      releaseReason: COUPON_RELEASE_REASON.CUSTOMER_CANCELLED,
      releasedAt: expect.any(Date),
    });
    await expect(
      createBooking(coupon.code, customers[1].profileId, 'customer-release-b'),
    ).resolves.toMatchObject({ replayed: false });
    await expect(redemptionCount(coupon.id)).resolves.toBe(2);
  }, 30_000);

  it('closes a CREATED booking and releases its reservation after terminal authorization failure', async () => {
    const coupon = await createCoupon('authorization-failure');
    const created = await createBooking(coupon.code, customers[0].profileId, 'authorization-failure-booking');
    const payment = await prisma.payment.update({
      where: { bookingId: created.booking.id },
      data: { status: PaymentStatus.FAILED },
    });
    await prisma.booking.update({
      where: { id: created.booking.id },
      data: { status: BookingStatus.CREATED },
    });

    await expect(service.recoverCreatedBookingAfterPayment(created.booking.id, payment.id)).resolves.toEqual({
      bookingId: created.booking.id,
      closed: true,
      reason: 'PAYMENT_AUTHORIZATION_FAILED',
    });
    await expect(prisma.booking.findUnique({ where: { id: created.booking.id } })).resolves.toMatchObject({
      status: BookingStatus.CANCELLED,
      closedReason: 'payment_authorization_failed',
    });
    await expect(
      prisma.couponRedemption.findUnique({ where: { bookingId: created.booking.id } }),
    ).resolves.toMatchObject({
      state: CouponRedemptionState.RELEASED,
      releaseReason: COUPON_RELEASE_REASON.PAYMENT_AUTHORIZATION_FAILED,
    });
  }, 30_000);

  it('consumes once and rolls back a contradictory booking transition', async () => {
    const coupon = await createCoupon('completion-consume');
    const created = await createBooking(coupon.code, customers[0].profileId, 'completion-consume');
    const completedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: created.booking.id },
        data: { status: BookingStatus.COMPLETED, closedAt: completedAt },
      });
      await consumeCouponRedemptionForBooking(tx, {
        bookingId: created.booking.id,
        occurredAt: completedAt,
      });
    });
    const consumed = await prisma.couponRedemption.findUniqueOrThrow({
      where: { bookingId: created.booking.id },
    });
    await expect(
      prisma.$transaction((tx) =>
        consumeCouponRedemptionForBooking(tx, {
          bookingId: created.booking.id,
          occurredAt: new Date(completedAt.getTime() + 1_000),
        }),
      ),
    ).resolves.toEqual({ state: CouponRedemptionState.CONSUMED, transitioned: false });
    await expect(
      prisma.couponRedemption.findUnique({ where: { bookingId: created.booking.id } }),
    ).resolves.toMatchObject({
      state: CouponRedemptionState.CONSUMED,
      consumedAt: consumed.consumedAt,
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: created.booking.id },
          data: { status: BookingStatus.CANCELLED },
        });
        await releaseCouponRedemptionForBooking(tx, {
          bookingId: created.booking.id,
          occurredAt: new Date(completedAt.getTime() + 2_000),
          reason: COUPON_RELEASE_REASON.PARTNER_CANCELLED,
        });
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUPON_REDEMPTION_STATE_CONFLICT' }),
    });
    await expect(prisma.booking.findUnique({ where: { id: created.booking.id } })).resolves.toMatchObject({
      status: BookingStatus.COMPLETED,
    });
  }, 30_000);

  it('serializes concurrent partial reversal evidence and reverses only at the exact total', async () => {
    const coupon = await createCoupon('partial-reversal');
    const created = await createBooking(coupon.code, customers[0].profileId, 'partial-reversal');
    const consumedAt = new Date();
    await consume(created.booking.id, consumedAt);

    const outcomes = await Promise.allSettled([
      reverse(created.booking.id, coupon.id, 'partial-a', 60_000, consumedAt),
      reverse(created.booking.id, coupon.id, 'partial-b', 40_000, consumedAt),
    ]);

    expect(outcomes.every((outcome) => outcome.status === 'fulfilled')).toBe(true);
    await expect(
      prisma.couponRedemption.findUnique({ where: { bookingId: created.booking.id } }),
    ).resolves.toMatchObject({ state: CouponRedemptionState.REVERSED, reversedAt: expect.any(Date) });
    await expect(
      prisma.couponRedemptionReversalEvent.aggregate({
        where: { redemption: { bookingId: created.booking.id } },
        _count: true,
        _sum: { amount: true },
      }),
    ).resolves.toMatchObject({ _count: 2, _sum: { amount: 100_000 } });
  }, 30_000);

  it('writes one immutable event when the same reversal source races itself', async () => {
    const coupon = await createCoupon('reversal-replay');
    const created = await createBooking(coupon.code, customers[0].profileId, 'reversal-replay');
    const consumedAt = new Date();
    await consume(created.booking.id, consumedAt);

    const outcomes = await Promise.all([
      reverse(created.booking.id, coupon.id, 'same-source', 100_000, consumedAt),
      reverse(created.booking.id, coupon.id, 'same-source', 100_000, consumedAt),
    ]);

    expect(outcomes.filter((outcome) => outcome.eventCreated)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.eventCreated)).toHaveLength(1);
    await expect(
      prisma.couponRedemptionReversalEvent.count({
        where: { redemption: { bookingId: created.booking.id } },
      }),
    ).resolves.toBe(1);
  }, 30_000);

  it('allows only one concurrent source when their total would exceed the discount', async () => {
    const coupon = await createCoupon('reversal-cap');
    const created = await createBooking(coupon.code, customers[0].profileId, 'reversal-cap');
    const consumedAt = new Date();
    await consume(created.booking.id, consumedAt);

    const outcomes = await Promise.allSettled([
      reverse(created.booking.id, coupon.id, 'cap-a', 60_000, consumedAt),
      reverse(created.booking.id, coupon.id, 'cap-b', 60_000, consumedAt),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(
      rejected?.status === 'rejected' && typeof rejected.reason?.getResponse === 'function'
        ? rejected.reason.getResponse()
        : null,
    ).toMatchObject({ code: 'COUPON_REVERSAL_EXCEEDS_DISCOUNT' });
    await expect(
      prisma.couponRedemption.findUnique({ where: { bookingId: created.booking.id } }),
    ).resolves.toMatchObject({ state: CouponRedemptionState.CONSUMED, reversedAt: null });
    await expect(
      prisma.couponRedemptionReversalEvent.aggregate({
        where: { redemption: { bookingId: created.booking.id } },
        _count: true,
        _sum: { amount: true },
      }),
    ).resolves.toMatchObject({ _count: 1, _sum: { amount: 60_000 } });
  }, 30_000);

  function createCoupon(
    label: string,
    limits: {
      grossBudgetAmount?: bigint;
      maxRedemptions?: number;
      perCustomerRedemptionLimit?: number;
    } = {},
  ) {
    const now = Date.now();
    return prisma.coupon.create({
      data: {
        id: `${runId}:coupon:${label}`,
        active: true,
        code: `C02${label.replaceAll('-', '').toUpperCase()}${String(now).slice(-6)}`,
        currency: 'VND',
        discount: { type: 'percent', value: 50 },
        endsAt: new Date(now + 60 * 60_000),
        grossBudgetAmount: 1_000_000n,
        maxRedemptions: 10,
        maximumDiscountAmount: 100_000,
        minimumOrderAmount: 0,
        perCustomerRedemptionLimit: 2,
        startsAt: new Date(now - 60_000),
        ...limits,
      },
    });
  }

  function createBooking(couponCode: string, customerProfileId: string, label: string) {
    return flow.createOpenMatchingBookingRecord(
      bookingInput(couponCode, customerProfileId, `${runId}:${label}`),
    );
  }

  function consume(bookingId: string, occurredAt: Date) {
    return prisma.$transaction((tx) => consumeCouponRedemptionForBooking(tx, { bookingId, occurredAt }));
  }

  function reverse(
    bookingId: string,
    couponId: string,
    sourceLabel: string,
    amount: number,
    consumedAt: Date,
  ) {
    const occurredAt = new Date(consumedAt.getTime() + 1_000);
    return prisma.$transaction((tx) =>
      recordCouponRedemptionReversal(tx, {
        amount,
        bookingId,
        expectedCouponId: couponId,
        occurredAt,
        reason: COUPON_REVERSAL_REASON.SETTLEMENT_REFUND,
        sourceKey: `${runId}:settlement-reversal:${sourceLabel}`,
        sourceReference: `booking-settlement-snapshot:${sourceLabel}`,
      }),
    );
  }

  function bookingInput(
    couponCode: string,
    customerProfileId: string,
    idempotencyKey: string,
    district = 'District 1',
  ) {
    const addressText = `${district}, Ho Chi Minh City, Vietnam`;
    const openedAt = new Date();
    return {
      addressPayload: { addressText },
      addressText,
      adminMinimumAmount: 300_000,
      bookingGateSnapshot: { gatePassed: true },
      bookingLat: 10.7769,
      bookingLng: 106.7009,
      couponCode,
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
      priceSummary: {
        discountAmount: 0,
        finalAmount: 500_000,
        paymentMetadata: { discountAmount: 0, originalAmount: 500_000 },
      },
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

  function redemptionCount(couponId: string) {
    return prisma.couponRedemption.count({ where: { couponId } });
  }

  async function activeDiscountExposure(couponId: string) {
    const aggregate = await prisma.couponRedemption.aggregate({
      where: { couponId, state: { not: 'RELEASED' } },
      _sum: { discountAmount: true },
    });
    return aggregate._sum.discountAmount ?? 0;
  }

  function paymentCountForCoupon(couponCode: string) {
    return prisma.payment.count({
      where: { rawMeta: { path: ['couponCode'], equals: couponCode } },
    });
  }

  function bookingCount(idempotencyKey: string) {
    return prisma.booking.count({
      where: {
        metadata: {
          path: ['bookingCreationRequest', 'idempotencyKey'],
          equals: idempotencyKey,
        },
      },
    });
  }

  function expectSingleReservation(
    outcomes: PromiseSettledResult<{ booking: { id: string }; replayed: boolean }>[],
  ) {
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    const response =
      rejected?.status === 'rejected' && typeof rejected.reason?.getResponse === 'function'
        ? rejected.reason.getResponse()
        : null;
    expect(response).toEqual({ code: 'COUPON_LIMIT_REACHED', message: 'Coupon is not available' });
  }
});
