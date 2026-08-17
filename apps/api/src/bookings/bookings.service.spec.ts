import { NotFoundException } from '@nestjs/common';
import {
  BookingMatchSource,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentAdminOperationStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';

import { PROVIDER_WALLET_BLOCK_CODE } from '../provider-wallet/provider-wallet.policy';
import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
} from '../matching/matching.policy';
import { BookingsService } from './bookings.service';
import { bookingCreationFingerprint } from './bookings.creation-idempotency';
import { providerBookingHistoryWhere } from './bookings.provider-query';
import { PROVIDER_ACTIVE_WORK_STATUS_VALUES } from './bookings.provider-readiness';

describe('BookingsService identity scoping', () => {
  it('queries customer booking detail through the signed-in customer profile', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockRejectedValue(new NotFoundException('Booking not found')),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getCustomerBooking('another-customer-booking', 'customer-user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.booking.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'another-customer-booking',
          customerProfileId: 'customer-profile-1',
        },
      }),
    );
  });

  it('paginates customer booking history without changing the response shape', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listCustomerBookings('customer-user-1', {
        cursor: 'booking-20',
        take: '500',
      }),
    ).resolves.toEqual([]);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'booking-20' },
        skip: 1,
        take: 50,
        where: { customerProfileId: 'customer-profile-1' },
      }),
    );
  });

  it('queries Partner booking detail only through that Partner access contract', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          currentLat: 10.77,
          currentLng: 106.7,
          id: 'provider-profile-1',
          status: ProviderStatus.ONLINE_AVAILABLE,
        }),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockRejectedValue(new NotFoundException('Booking not found')),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getProviderBooking('another-partner-booking', 'provider-user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    const bookingQuery = prisma.booking.findFirstOrThrow.mock.calls[0]?.[0];
    expect(bookingQuery).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'another-partner-booking',
          OR: expect.any(Array),
        }),
      }),
    );
    expect(JSON.stringify(bookingQuery?.where)).toContain('provider-profile-1');
  });
});

describe('BookingsService booking creation', () => {
  it('loads the immutable address snapshot in the immediate booking response', async () => {
    const addressSnapshot = {
      id: 'snapshot-1',
      bookingId: 'booking-1',
      customerProfileId: 'customer-1',
      selectedLocationId: null,
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      latitude: 10.7769,
      longitude: 106.7009,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    const booking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      status: BookingStatus.OPEN_MATCHING,
      scheduledStartAt: new Date('2026-06-01T00:00:00.000Z'),
      scheduledEndAt: new Date('2026-06-01T01:00:00.000Z'),
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      lat: 10.7769,
      lng: 106.7009,
      addressSnapshot,
      notes: null,
      travelBufferMin: 30,
      earlyAcceptMin: 10,
      preferredProviderId: null,
      selectedProviderId: null,
      openedAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: new Date('2026-06-01T00:10:00.000Z'),
      metadata: {},
      services: [
        {
          serviceId: 'service-1',
          price: 500000,
          service: massageService(),
        },
      ],
      payment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        method: PaymentMethod.CASH,
        amount: 500000,
        currency: 'VND',
        status: PaymentStatus.AUTHORIZED,
        providerRef: null,
        metadata: {},
      },
      participants: [],
      preferredProvider: null,
      selectedProvider: null,
    };
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'customer-1',
          userId: 'customer-user-1',
          user: { fullName: 'Demo Customer', phone: '0865907184' },
        }),
      },
      massageService: {
        findFirstOrThrow: vi.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: vi.fn().mockResolvedValue(servicePayoutRule()),
      },
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    attachTransaction(prisma);
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      openBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.opened' }),
      registerActiveBooking: vi.fn(),
      scheduleBookingTimeout: vi.fn(),
    };
    const matchingGateway = {
      emitBookingOpened: vi.fn(),
      emitBackupBookingAvailable: vi.fn(),
    };
    const payments = {
      buildAuthorization: vi.fn().mockReturnValue({ method: PaymentMethod.CASH, amount: 500000 }),
      refreshAuthorizationForBooking: vi.fn().mockResolvedValue(booking.payment),
      requiresPostBookingAuthorization: vi.fn().mockReturnValue(false),
      scheduleStatusCheck: vi.fn(),
    };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await service.createOpenMatchingBooking('customer-user-1', {
      idempotencyKey: 'booking-request-1',
      serviceId: 'service-1',
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            matchingPolicy: expect.objectContaining({
              marketplaceRadiusMeters: 10000,
              backupProviderRadiusMeters: 10000,
            }),
          }),
        }),
        include: expect.objectContaining({
          addressSnapshot: true,
        }),
      }),
    );
    expect(prisma.booking.create.mock.invocationCallOrder[0]).toBeLessThan(
      payments.refreshAuthorizationForBooking.mock.invocationCallOrder[0],
    );
    expect(matching.openBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: expect.objectContaining({
          addressSnapshot: expect.objectContaining({
            addressText: 'District 1, Ho Chi Minh City, Vietnam',
            latitude: 10.7769,
            longitude: 106.7009,
          }),
        }),
        payload: expect.objectContaining({
          marketplaceRadiusMeters: 10000,
          backupProviderRadiusMeters: 10000,
        }),
      }),
    );
  });

  it('keeps a real gateway booking in CREATED until post-booking authorization succeeds', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.CREATED });
    const findFirst = vi.fn().mockResolvedValue(null);
    const findUniqueOrThrow = vi
      .fn()
      .mockResolvedValue({ id: 'booking-1', status: BookingStatus.OPEN_MATCHING });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const payments = {
      buildAuthorization: vi.fn().mockReturnValue({
        amount: 500000,
        method: PaymentMethod.VNPAY,
        providerRef: null,
        status: PaymentStatus.PENDING,
      }),
    };
    const prisma = { booking: { create, findFirst, findUniqueOrThrow, updateMany } };
    attachTransaction(prisma);
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      payments as never,
      {} as never,
      {} as never,
    );

    const gatewayFlow = service as unknown as {
      createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<unknown>;
      openBookingAfterPaymentAuthorization(
        booking: Record<string, unknown>,
        required: boolean,
      ): Promise<unknown>;
    };
    await gatewayFlow.createOpenMatchingBookingRecord({
      idempotencyKey: 'booking-request-1',
      addressPayload: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      bookingGateSnapshot: {},
      bookingLat: 10.7769,
      bookingLng: 106.7009,
      customerPrice: 500000,
      customerProfileId: 'customer-1',
      matchingPolicy: matchingPolicy(),
      paymentMethod: PaymentMethod.VNPAY,
      preferredProviderDistanceMeters: null,
      payoutRule: servicePayoutRule(),
      priceSummary: { finalAmount: 500000, paymentMetadata: {} },
      requiresPostBookingAuthorization: true,
      serviceId: 'service-1',
      timing: {
        expiresAt: new Date('2026-07-14T06:10:00.000Z'),
        openedAt: new Date('2026-07-14T06:00:00.000Z'),
        scheduledEndAt: new Date('2026-07-14T07:00:00.000Z'),
        scheduledStartAt: new Date('2026-07-14T06:00:00.000Z'),
      },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CREATED }),
      }),
    );

    await expect(
      gatewayFlow.openBookingAfterPaymentAuthorization(
        { id: 'booking-1', status: BookingStatus.CREATED },
        true,
      ),
    ).resolves.toEqual({ id: 'booking-1', status: BookingStatus.OPEN_MATCHING });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.CREATED },
      data: { status: BookingStatus.OPEN_MATCHING },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      include: expect.any(Object),
    });
  });

  it('reserves an authorized customer wallet payment under a customer-scoped database lock', async () => {
    const booking = {
      id: 'booking-wallet-1',
      payment: { id: 'payment-wallet-1' },
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: null }]),
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 700_000 } }),
        create: vi.fn().mockResolvedValue({ id: 'wallet-reservation-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      booking: { create: vi.fn() },
    };
    const payments = {
      buildAuthorization: vi.fn().mockReturnValue({
        amount: 500_000,
        method: PaymentMethod.CUSTOMER_WALLET,
        providerRef: null,
        status: PaymentStatus.AUTHORIZED,
      }),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      payments as never,
      {} as never,
      {} as never,
    );
    const walletFlow = service as unknown as {
      createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<typeof booking>;
    };

    await expect(walletFlow.createOpenMatchingBookingRecord(walletBookingCreateInput())).resolves.toEqual({
      booking,
      replayed: false,
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.customerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { customerProfileId: 'customer-1', currency: 'VND' },
      _sum: { amount: true },
    });
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CREATED }),
      }),
    );
    expect(tx.customerWalletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -500_000,
        bookingId: 'booking-wallet-1',
        customerProfileId: 'customer-1',
        sourceKey: 'customer-wallet-payment:booking-wallet-1:settlement',
        type: 'CUSTOMER_WALLET_PAYMENT',
      }),
    });
    expect(tx.customerWalletLedgerEntry.aggregate.mock.invocationCallOrder[0]).toBeLessThan(
      tx.booking.create.mock.invocationCallOrder[0],
    );
  });

  it('rejects a customer wallet booking before creating records when the locked balance is insufficient', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: null }]),
      booking: { create: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 499_999 } }),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      booking: { create: vi.fn() },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      { buildAuthorization: vi.fn() } as never,
      {} as never,
      {} as never,
    );
    const walletFlow = service as unknown as {
      createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<unknown>;
    };

    await expect(walletFlow.createOpenMatchingBookingRecord(walletBookingCreateInput())).rejects.toThrow(
      'Insufficient customer wallet balance',
    );
    expect(tx.booking.create).not.toHaveBeenCalled();
    expect(tx.customerWalletLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('returns the existing booking when the same customer replays the same idempotency key and payload', async () => {
    const input = { ...walletBookingCreateInput(), paymentMethod: PaymentMethod.CASH };
    let storedBooking: Record<string, unknown> | null = null;
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: null }]),
      booking: {
        findFirst: vi.fn(async () => storedBooking),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          storedBooking = {
            id: 'booking-idempotent-1',
            metadata: args.data.metadata,
            status: BookingStatus.OPEN_MATCHING,
          };
          return storedBooking;
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      { buildAuthorization: vi.fn().mockReturnValue({ amount: 500_000 }) } as never,
      {} as never,
      {} as never,
    );
    const flow = service as unknown as {
      createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<unknown>;
    };

    await expect(flow.createOpenMatchingBookingRecord(input)).resolves.toMatchObject({
      replayed: false,
    });
    await expect(flow.createOpenMatchingBookingRecord(input)).resolves.toMatchObject({
      booking: { id: 'booking-idempotent-1' },
      replayed: true,
    });

    expect(tx.booking.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('rejects reuse of a booking idempotency key with a different payload', async () => {
    const original = { ...walletBookingCreateInput(), paymentMethod: PaymentMethod.CASH };
    const fingerprint = bookingCreationFingerprint({
      address: original.addressPayload,
      lat: original.bookingLat,
      lng: original.bookingLng,
      paymentMethod: original.paymentMethod,
      serviceId: original.serviceId,
    });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ lockResult: null }]),
      booking: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-idempotent-1',
          metadata: {
            bookingCreationRequest: {
              fingerprint,
              idempotencyKey: original.idempotencyKey,
            },
          },
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      { buildAuthorization: vi.fn().mockReturnValue({ amount: 500_000 }) } as never,
      {} as never,
      {} as never,
    );
    const flow = service as unknown as {
      createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<unknown>;
    };

    await expect(
      flow.createOpenMatchingBookingRecord({
        ...original,
        addressPayload: { addressText: 'District 3, Ho Chi Minh City, Vietnam' },
      }),
    ).rejects.toThrow('Booking idempotency key was reused with a different request');
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('does not open VNPay matching while the provider payment is still pending', async () => {
    const updateMany = vi.fn();
    const payments = {
      paymentCanOpenMatching: vi.fn().mockReturnValue(false),
    };
    const service = new BookingsService(
      { booking: { updateMany } } as never,
      {} as never,
      {} as never,
      payments as never,
      {} as never,
      {} as never,
    );
    const booking = {
      id: 'booking-1',
      status: BookingStatus.CREATED,
      payment: {
        method: PaymentMethod.VNPAY,
        status: PaymentStatus.PENDING,
      },
    };
    const gatewayFlow = service as unknown as {
      openBookingAfterPaymentAuthorization(
        booking: typeof booking,
        required: boolean,
      ): Promise<typeof booking>;
    };

    await expect(gatewayFlow.openBookingAfterPaymentAuthorization(booking, true)).resolves.toBe(booking);
    expect(payments.paymentCanOpenMatching).toHaveBeenCalledWith(PaymentMethod.VNPAY, PaymentStatus.PENDING);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('recovers a captured VNPay booking with a fresh matching window exactly once', async () => {
    const createdBooking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      customerProfile: { userId: 'customer-user-1' },
      status: BookingStatus.CREATED,
      scheduledStartAt: new Date(Date.now() + 60_000),
      scheduledEndAt: new Date(Date.now() + 3_600_000),
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      addressSnapshot: null,
      lat: 10.7769,
      lng: 106.7009,
      notes: null,
      metadata: {},
      openedAt: new Date(),
      expiresAt: new Date(Date.now() - 60_000),
      preferredProviderId: null,
      selectedProviderId: null,
      preferredProvider: null,
      selectedProvider: null,
      participants: [],
      services: [{ serviceId: 'service-1', price: 500000, service: massageService() }],
      payment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        method: PaymentMethod.VNPAY,
        amount: 450000,
        currency: 'VND',
        providerRef: 'booking-1',
        status: PaymentStatus.CAPTURED,
        rawMeta: {
          authorizationState: 'READY',
          authorizationVerifiedBy: 'STATUS_QUERY',
          couponCode: 'SAVE10',
          discountAmount: 50000,
        },
      },
    };
    const recoveredBooking = {
      ...createdBooking,
      status: BookingStatus.OPEN_MATCHING,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const prisma = {
      booking: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(createdBooking)
          .mockResolvedValueOnce({ selectedProviderId: null, status: BookingStatus.OPEN_MATCHING }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(recoveredBooking),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      providerProfile: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      openBooking: vi.fn().mockReturnValue({ id: 'booking-1', status: 'OPEN_MATCHING' }),
      registerActiveBooking: vi.fn(),
      scheduleBookingTimeout: vi.fn(),
      closeBooking: vi.fn(),
    };
    const matchingGateway = { emitBookingOpened: vi.fn(), emitBackupBookingAvailable: vi.fn() };
    const payments = {
      requiresPostBookingAuthorization: vi.fn().mockReturnValue(true),
      paymentCanOpenMatching: vi.fn().mockReturnValue(true),
      paymentRequiresCaptureBeforeMatching: vi.fn().mockReturnValue(true),
      scheduleStatusCheck: vi.fn(),
    };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await expect(service.recoverCreatedBookingAfterPayment('booking-1', 'payment-1')).resolves.toEqual({
      recovered: true,
      bookingId: 'booking-1',
      status: BookingStatus.OPEN_MATCHING,
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'booking-1', status: BookingStatus.CREATED },
      data: {
        status: BookingStatus.OPEN_MATCHING,
        openedAt: expect.any(Date),
        expiresAt: expect.any(Date),
      },
    });
    expect(matching.registerActiveBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ status: 'OPEN_MATCHING' }),
    );
    expect(matchingGateway.emitBookingOpened).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ status: 'OPEN_MATCHING' }),
    );
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'customer-user-1' }));
  });

  it('closes a recovered matching projection when customer cancellation wins during activation', async () => {
    const createdBooking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      customerProfile: { userId: 'customer-user-1' },
      status: BookingStatus.CREATED,
      scheduledStartAt: new Date(Date.now() + 60_000),
      scheduledEndAt: new Date(Date.now() + 3_600_000),
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      addressSnapshot: null,
      lat: 10.7769,
      lng: 106.7009,
      notes: null,
      metadata: {},
      openedAt: new Date(),
      expiresAt: new Date(Date.now() - 60_000),
      preferredProviderId: null,
      selectedProviderId: null,
      preferredProvider: null,
      selectedProvider: null,
      participants: [],
      services: [{ serviceId: 'service-1', price: 500000, service: massageService() }],
      payment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        method: PaymentMethod.VNPAY,
        amount: 500000,
        currency: 'VND',
        providerRef: 'booking-1',
        status: PaymentStatus.CAPTURED,
        rawMeta: { authorizationState: 'READY', authorizationVerifiedBy: 'STATUS_QUERY' },
      },
    };
    const recoveredBooking = {
      ...createdBooking,
      status: BookingStatus.OPEN_MATCHING,
      expiresAt: new Date(Date.now() + 600_000),
    };
    const prisma = {
      booking: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(createdBooking)
          .mockResolvedValueOnce({ selectedProviderId: null, status: BookingStatus.CANCELLED }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(recoveredBooking),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerProfile: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      openBooking: vi.fn().mockReturnValue({ id: 'booking-1', status: 'OPEN_MATCHING' }),
      registerActiveBooking: vi.fn(),
      scheduleBookingTimeout: vi.fn(),
      closeBooking: vi.fn(),
    };
    const matchingGateway = { emitBookingOpened: vi.fn(), emitBackupBookingAvailable: vi.fn() };
    const payments = {
      requiresPostBookingAuthorization: vi.fn().mockReturnValue(true),
      paymentCanOpenMatching: vi.fn().mockReturnValue(true),
      paymentRequiresCaptureBeforeMatching: vi.fn().mockReturnValue(true),
      scheduleStatusCheck: vi.fn(),
    };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await expect(service.recoverCreatedBookingAfterPayment('booking-1', 'payment-1')).resolves.toEqual({
      skipped: true,
      reason: 'BOOKING_NO_LONGER_OPEN',
      bookingId: 'booking-1',
      status: BookingStatus.CANCELLED,
    });

    expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
    expect(matchingGateway.emitBookingOpened).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects booking creation when fresh customer GPS is 50km or more from the service address', async () => {
    const addressSnapshot = {
      id: 'snapshot-1',
      bookingId: 'booking-1',
      customerProfileId: 'customer-1',
      selectedLocationId: null,
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      latitude: 10.7769,
      longitude: 106.7009,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    const booking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      status: BookingStatus.OPEN_MATCHING,
      scheduledStartAt: new Date('2026-06-01T00:00:00.000Z'),
      scheduledEndAt: new Date('2026-06-01T01:00:00.000Z'),
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      lat: 10.7769,
      lng: 106.7009,
      addressSnapshot,
      notes: null,
      travelBufferMin: 30,
      earlyAcceptMin: 10,
      preferredProviderId: null,
      selectedProviderId: null,
      openedAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: new Date('2026-06-01T00:10:00.000Z'),
      metadata: {},
      services: [
        {
          serviceId: 'service-1',
          price: 500000,
          service: massageService(),
        },
      ],
      payment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        method: PaymentMethod.CASH,
        amount: 500000,
        currency: 'VND',
        status: PaymentStatus.AUTHORIZED,
        providerRef: null,
        metadata: {},
      },
      participants: [],
      preferredProvider: null,
      selectedProvider: null,
    };
    const prisma = {
      adminAuditLog: {
        create: vi.fn(),
      },
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'customer-1',
          userId: 'customer-user-1',
          user: { fullName: 'Demo Customer', phone: '0865907184' },
        }),
      },
      massageService: {
        findFirstOrThrow: vi.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: vi.fn().mockResolvedValue(servicePayoutRule()),
      },
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue({
        ...matchingPolicy(),
        backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
      }),
      openBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.opened' }),
      registerActiveBooking: vi.fn(),
      scheduleBookingTimeout: vi.fn(),
    };
    const matchingGateway = {
      emitBookingOpened: vi.fn(),
      emitBackupBookingAvailable: vi.fn(),
    };
    const payments = {
      buildAuthorization: vi.fn().mockReturnValue({ method: PaymentMethod.CASH, amount: 500000 }),
      refreshAuthorizationForBooking: vi.fn().mockResolvedValue(booking.payment),
      requiresPostBookingAuthorization: vi.fn().mockReturnValue(false),
      scheduleStatusCheck: vi.fn(),
    };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.createOpenMatchingBooking('customer-user-1', {
        idempotencyKey: 'booking-request-too-far-1',
        serviceId: 'service-1',
        address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
        lat: 10.7769,
        lng: 106.7009,
        currentLat: 37.5665,
        currentLng: 126.978,
        currentLocationUpdatedAt: new Date().toISOString(),
        paymentMethod: PaymentMethod.CASH,
      }),
    ).rejects.toThrow("Booking address must be within 50km of the customer's current location");

    expect(prisma.booking.create).not.toHaveBeenCalled();
    expect(matching.openBooking).not.toHaveBeenCalled();
    expect(payments.buildAuthorization).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'booking.create.rejected',
          target: 'customer:customer-1',
          metadata: expect.objectContaining({
            reasonCode: 'CUSTOMER_CURRENT_LOCATION_TOO_FAR',
            reason: "Booking address must be within 50km of the customer's current location",
            serviceId: 'service-1',
            customerProfileId: 'customer-1',
            bookingAddress: expect.objectContaining({
              lat: 10.7769,
              lng: 106.7009,
              addressText: 'District 1, Ho Chi Minh City, Vietnam',
            }),
            customerDistanceLimitMeters: 50000,
            currentLocationRecordedAt: expect.any(String),
          }),
        }),
      }),
    );
    expect(prisma.adminAuditLog.create.mock.calls[0][0].data.metadata.customerDistanceMeters).toBeGreaterThan(
      1_000_000,
    );
  });

  it('keeps marketplace invitation alerts open when a legacy delayed policy value is stored', async () => {
    const addressSnapshot = {
      id: 'snapshot-1',
      bookingId: 'booking-1',
      customerProfileId: 'customer-1',
      selectedLocationId: null,
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      latitude: 10.7769,
      longitude: 106.7009,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    };
    const booking = {
      id: 'booking-1',
      customerProfileId: 'customer-1',
      status: BookingStatus.OPEN_MATCHING,
      scheduledStartAt: new Date('2026-06-01T00:00:00.000Z'),
      scheduledEndAt: new Date('2026-06-01T01:00:00.000Z'),
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      lat: 10.7769,
      lng: 106.7009,
      addressSnapshot,
      notes: null,
      travelBufferMin: 30,
      earlyAcceptMin: 10,
      preferredProviderId: null,
      selectedProviderId: null,
      openedAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: new Date('2026-06-01T00:10:00.000Z'),
      metadata: {},
      services: [
        {
          serviceId: 'service-1',
          price: 500000,
          service: massageService(),
        },
      ],
      payment: {
        id: 'payment-1',
        bookingId: 'booking-1',
        method: PaymentMethod.CASH,
        amount: 500000,
        currency: 'VND',
        status: PaymentStatus.AUTHORIZED,
        providerRef: null,
        metadata: {},
      },
      participants: [],
      preferredProvider: null,
      selectedProvider: null,
    };
    const cleanPartner = approvedPartner({
      id: 'clean-partner',
      userId: 'clean-user',
      currentLat: 10.777,
      currentLng: 106.701,
    });
    const negativeWalletPartner = approvedPartner({
      id: 'negative-wallet-partner',
      userId: 'negative-wallet-user',
      currentLat: 10.7771,
      currentLng: 106.7011,
    });
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'customer-1',
          userId: 'customer-user-1',
          user: { fullName: 'Demo Customer', phone: '0865907184' },
        }),
      },
      massageService: {
        findFirstOrThrow: vi.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: vi.fn().mockResolvedValue(servicePayoutRule()),
      },
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([cleanPartner, negativeWalletPartner]),
      },
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([
          {
            providerProfileId: 'negative-wallet-partner',
            _sum: { amount: -120000 },
          },
        ]),
      },
    };
    attachTransaction(prisma);
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      openBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.opened' }),
      registerActiveBooking: vi.fn(),
      scheduleBookingTimeout: vi.fn(),
    };
    const matchingGateway = {
      emitBookingOpened: vi.fn(),
      emitBackupBookingAvailable: vi.fn(),
    };
    const payments = {
      buildAuthorization: vi.fn().mockReturnValue({ method: PaymentMethod.CASH, amount: 500000 }),
      refreshAuthorizationForBooking: vi.fn().mockResolvedValue(booking.payment),
      requiresPostBookingAuthorization: vi.fn().mockReturnValue(false),
      scheduleStatusCheck: vi.fn(),
    };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await service.createOpenMatchingBooking('customer-user-1', {
      idempotencyKey: 'booking-request-backup-1',
      serviceId: 'service-1',
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: PaymentMethod.CASH,
    });

    const backupNotificationCalls = notifications.create.mock.calls
      .map(([input]) => input)
      .filter((input) => input.type === 'booking.backup_available');

    expect(prisma.providerWalletLedgerEntry.groupBy).toHaveBeenCalledWith({
      by: ['providerProfileId'],
      where: {
        providerProfileId: { in: ['clean-partner', 'negative-wallet-partner'] },
      },
      _sum: { amount: true },
    });
    expect(matching.openBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          eligibleBackupProviderCount: 1,
        }),
      }),
    );
    expect(backupNotificationCalls).toEqual([
      expect.objectContaining({
        userId: 'clean-user',
        data: expect.objectContaining({ providerProfileId: 'clean-partner' }),
      }),
    ]);
    expect(matchingGateway.emitBackupBookingAvailable).toHaveBeenCalledWith(
      ['clean-user'],
      'booking-1',
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
  });
});

describe('BookingsService booking-open delivery isolation', () => {
  it('continues preferred Partner notification and realtime when the customer notification fails', async () => {
    const notifications = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error('Customer notification unavailable'))
        .mockResolvedValueOnce({ id: 'preferred-notification-1' }),
    };
    const matchingGateway = {
      emitDirectBookingRequested: vi.fn(),
      emitBookingOpened: vi.fn(),
    };
    const service = new BookingsService(
      {} as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );
    const flow = service as unknown as {
      announceInitialOpenMatchingBooking(input: Record<string, unknown>): Promise<void>;
      notifyBackupProvidersAndRecordTrace: ReturnType<typeof vi.fn>;
    };
    flow.notifyBackupProvidersAndRecordTrace = vi.fn();

    await flow.announceInitialOpenMatchingBooking({
      bookingId: 'booking-1',
      customerDiscountAmount: 0,
      eligibleBackupProviders: [],
      matchingPayload: { bookingId: 'booking-1' },
      matchingPolicy: matchingPolicy(),
      preferredProvider: { id: 'partner-1', userId: 'partner-user-1', displayName: 'Linh' },
      userId: 'customer-user-1',
    });

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(matchingGateway.emitDirectBookingRequested).toHaveBeenCalledWith('partner-user-1', 'booking-1', {
      bookingId: 'booking-1',
    });
  });

  it('continues backup notification delivery and realtime after one Partner notification fails', async () => {
    const notifications = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error('First Partner notification unavailable'))
        .mockResolvedValueOnce({ id: 'notification-2' }),
    };
    const matchingGateway = { emitBackupBookingAvailable: vi.fn() };
    const service = new BookingsService(
      {} as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );
    const flow = service as unknown as {
      notifyBackupProviders(input: Record<string, unknown>): Promise<{
        trace: { notifiedCount: number; providers: Array<{ providerProfileId: string }> };
        websocketError?: unknown;
      }>;
    };
    const input = backupProviderNotificationInput();

    await expect(flow.notifyBackupProviders(input)).resolves.toMatchObject({
      trace: {
        notifiedCount: 1,
        providers: [{ providerProfileId: 'partner-2' }],
        websocketTargetCount: 2,
      },
      websocketError: undefined,
    });
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(matchingGateway.emitBackupBookingAvailable).toHaveBeenCalledWith(
      ['partner-user-1', 'partner-user-2'],
      'booking-1',
      { bookingId: 'booking-1' },
    );
  });

  it('records backup notification evidence before surfacing a websocket failure', async () => {
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const matchingGateway = {
      emitBackupBookingAvailable: vi.fn().mockRejectedValue(new Error('Realtime unavailable')),
    };
    const service = new BookingsService(
      {} as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );
    const flow = service as unknown as {
      notifyBackupProvidersAndRecordTrace(input: Record<string, unknown>): Promise<void>;
      recordBackupNotificationTrace: ReturnType<typeof vi.fn>;
    };
    flow.recordBackupNotificationTrace = vi.fn();

    await expect(flow.notifyBackupProvidersAndRecordTrace(backupProviderNotificationInput())).rejects.toThrow(
      'Realtime unavailable',
    );
    expect(flow.recordBackupNotificationTrace).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ notifiedCount: 2, websocketTargetCount: 2 }),
    );
  });
});

describe('BookingsService final partner selection', () => {
  it('returns the latest booking when customer selection starts after matching already closed', async () => {
    const latestBooking = {
      ...matchedBookingWithAddressSnapshot(),
      status: BookingStatus.PROVIDER_ON_THE_WAY,
      selectedProviderId: 'partner-1',
      expiresAt: new Date(Date.now() + 60_000),
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue(latestBooking),
      },
      bookingParticipant: { findUnique: vi.fn() },
    };
    const matching = { closeBooking: vi.fn(), selectFinalProvider: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.selectProvider('booking-1', 'customer-user-1', 'partner-2')).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Booking is already matched or no longer open for customer final selection',
        booking: expect.objectContaining({
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'partner-1',
        }),
      }),
      status: 409,
    });

    expect(prisma.bookingParticipant.findUnique).not.toHaveBeenCalled();
    expect(matching.closeBooking).not.toHaveBeenCalled();
    expect(matching.selectFinalProvider).not.toHaveBeenCalled();
  });

  it('loads the immutable address snapshot before emitting the matched booking', async () => {
    const matchedBooking = matchedBookingWithAddressSnapshot();
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'partner-1',
        }),
        update: vi.fn().mockResolvedValue(matchedBooking),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
          status: ParticipantStatus.ACCEPTED,
        }),
      },
      adminAuditLog: { create: vi.fn() },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    const transaction = attachTransaction(prisma);
    const matching = {
      closeBooking: vi.fn(),
      selectFinalProvider: vi.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'booking.matched',
        booking: matchedBooking,
      }),
    };
    const matchingGateway = { emitBookingMatched: vi.fn() };
    const notifications = { create: vi.fn() };
    const providerAvailabilityLifecycle = { markBusy: vi.fn(), reconcile: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
      providerAvailabilityLifecycle as never,
    );

    await service.selectProvider('booking-1', 'customer-user-1', 'partner-1');

    expect(transaction).toHaveBeenCalled();
    expect(providerAvailabilityLifecycle.markBusy).toHaveBeenCalledWith('partner-1');
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          addressSnapshot: true,
        }),
      }),
    );
    expect(matching.selectFinalProvider).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({
        addressSnapshot: expect.objectContaining({
          addressText: 'District 1, Ho Chi Minh City, Vietnam',
          latitude: 10.7769,
          longitude: 106.7009,
        }),
      }),
    );
  });

  it('returns a committed final selection when Redis cleanup and one notification enqueue fail', async () => {
    const adminAuditLogCreate = vi.fn();
    const marketplacePartner = approvedPartner({
      id: 'marketplace-partner',
      userId: 'marketplace-user-1',
      displayName: 'Marketplace Partner',
    });
    const matchedBooking = {
      ...matchedBookingWithAddressSnapshot(),
      status: BookingStatus.IN_SERVICE,
      preferredProviderId: 'first-pick-partner',
      selectedProviderId: 'marketplace-partner',
      preferredProvider: approvedPartner({
        id: 'first-pick-partner',
        userId: 'first-pick-user-1',
      }),
      selectedProvider: marketplacePartner,
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        update: vi.fn().mockResolvedValue(matchedBooking),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'marketplace-partner',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      adminAuditLog: { create: adminAuditLogCreate },
    };
    const transaction = attachTransaction(prisma);
    const matching = {
      closeBooking: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
      selectFinalProvider: vi.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'booking.matched',
        booking: matchedBooking,
      }),
    };
    const matchingGateway = { emitBookingMatched: vi.fn() };
    const notifications = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error('Notification queue unavailable'))
        .mockResolvedValue({ id: 'notification-customer' }),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.selectProvider('booking-1', 'customer-user-1', 'marketplace-partner'),
    ).resolves.toEqual(
      expect.objectContaining({
        bookingId: 'booking-1',
        event: 'booking.matched',
      }),
    );

    expect(prisma.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'marketplace-partner',
      },
      _sum: { amount: true },
    });
    expect(transaction).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.IN_SERVICE,
          selectedProviderId: 'marketplace-partner',
          matchedAt: expect.any(Date),
          matchSource: BookingMatchSource.CUSTOMER_SELECTED_PARTNER,
          chatRoom: { upsert: { create: {}, update: {} } },
          participants: {
            update: {
              where: {
                bookingId_providerProfileId: {
                  bookingId: 'booking-1',
                  providerProfileId: 'marketplace-partner',
                },
              },
              data: { status: ParticipantStatus.SELECTED, respondedAt: expect.any(Date) },
            },
            updateMany: {
              where: {
                providerProfileId: { not: 'marketplace-partner' },
                status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
              },
              data: { status: ParticipantStatus.EXPIRED, respondedAt: expect.any(Date) },
            },
          },
        }),
      }),
    );
    expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
    expect(adminAuditLogCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'customer-user-1',
        action: 'booking.matched.customer_selected',
        target: 'booking:booking-1',
        metadata: {
          bookingId: 'booking-1',
          providerProfileId: 'marketplace-partner',
          matchSource: 'CUSTOMER_SELECTED_PARTNER',
        },
      },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'marketplace-user-1',
        type: 'booking.matched',
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-user-1',
        type: 'booking.matched',
      }),
    );
    expect(matchingGateway.emitBookingMatched).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ event: 'booking.matched' }),
    );
  });

  it('rejects final selection when the Partner received another active booking first', async () => {
    const prisma = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'booking-already-active' }]),
      customerProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: null,
        }),
        update: vi.fn(),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          providerProfileId: 'partner-1',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerWalletLedgerEntry: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      adminAuditLog: { create: vi.fn() },
    };
    attachTransaction(prisma);
    const service = new BookingsService(
      prisma as never,
      { closeBooking: vi.fn(), selectFinalProvider: vi.fn() } as never,
      { emitBookingMatched: vi.fn() } as never,
      {} as never,
      { create: vi.fn() } as never,
      {} as never,
    );

    await expect(service.selectProvider('booking-1', 'customer-user-1', 'partner-1')).rejects.toThrow(
      'Partner must complete the current booking before receiving or joining another booking',
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('rechecks participant eligibility after locking the booking for final selection', async () => {
    const prisma = {
      customerProfile: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: null,
        }),
        update: vi.fn(),
      },
      bookingParticipant: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ providerProfileId: 'partner-1', status: ParticipantStatus.JOINED })
          .mockResolvedValueOnce({ providerProfileId: 'partner-1', status: ParticipantStatus.REJECTED }),
      },
      providerWalletLedgerEntry: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      adminAuditLog: { create: vi.fn() },
    };
    attachTransaction(prisma);
    const service = new BookingsService(
      prisma as never,
      { closeBooking: vi.fn(), selectFinalProvider: vi.fn() } as never,
      { emitBookingMatched: vi.fn() } as never,
      {} as never,
      { create: vi.fn() } as never,
      {} as never,
    );

    await expect(service.selectProvider('booking-1', 'customer-user-1', 'partner-1')).rejects.toThrow(
      'Partner must participate or accept before customer selection',
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('blocks customer final selection when the booking was already matched by a racing first-pick acceptance', async () => {
    const raceError = new Prisma.PrismaClientKnownRequestError('No booking matched the conditional update', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const marketplacePartner = approvedPartner({
      id: 'marketplace-partner',
      userId: 'marketplace-user-1',
      displayName: 'Marketplace Partner',
    });
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'first-pick-partner',
          payment: null,
        }),
        update: vi.fn().mockRejectedValue(raceError),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: marketplacePartner.id,
          status: ParticipantStatus.JOINED,
        }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      adminAuditLog: { create: vi.fn() },
    };
    const transaction = attachTransaction(prisma);
    const matching = {
      closeBooking: vi.fn(),
      selectFinalProvider: vi.fn(),
    };
    const matchingGateway = { emitBookingMatched: vi.fn() };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.selectProvider('booking-1', 'customer-user-1', marketplacePartner.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Booking is already matched or no longer open for customer final selection',
        booking: expect.objectContaining({
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'first-pick-partner',
        }),
      }),
      status: 409,
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          expiresAt: { gt: expect.any(Date) },
        },
      }),
    );
    expect(transaction).toHaveBeenCalled();
    expect(matching.closeBooking).not.toHaveBeenCalled();
    expect(matching.selectFinalProvider).not.toHaveBeenCalled();
    expect(matchingGateway.emitBookingMatched).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('blocks customer final selection for a preferred first-pick partner until that partner accepts', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        update: vi.fn(),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'first-pick-partner',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
      },
    };
    const matching = {
      closeBooking: vi.fn(),
      selectFinalProvider: vi.fn(),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.selectProvider('booking-1', 'customer-user-1', 'first-pick-partner'),
    ).rejects.toThrow('Partner must participate or accept before customer selection');

    expect(prisma.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(matching.selectFinalProvider).not.toHaveBeenCalled();
  });

  it('blocks customer final selection when a marketplace partner wallet becomes negative', async () => {
    const selectedBooking = {
      id: 'booking-1',
      status: BookingStatus.PROVIDER_ON_THE_WAY,
      selectedProviderId: 'marketplace-partner',
      selectedProvider: { id: 'marketplace-partner', userId: 'partner-user-2' },
      preferredProvider: null,
      payment: null,
      chatRoom: { id: 'chat-1' },
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        update: vi.fn(),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'marketplace-partner',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -70000 } }),
      },
      adminAuditLog: { create: vi.fn() },
    };
    attachTransaction(prisma);
    const matching = {
      closeBooking: vi.fn(),
      selectFinalProvider: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.matched' }),
    };
    prisma.booking.update.mockResolvedValue(selectedBooking);
    const notifications = { create: vi.fn() };
    const matchingGateway = { emitBookingMatched: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.selectProvider('booking-1', 'customer-user-1', 'marketplace-partner'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: PROVIDER_WALLET_BLOCK_CODE,
        marketplaceJoinBlocked: false,
        directFirstPickBlocked: true,
        alreadyMatchedServiceBlocked: true,
        marketplaceVisibilityBlocked: false,
      }),
    });

    expect(prisma.providerWalletLedgerEntry.aggregate).toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(matching.selectFinalProvider).not.toHaveBeenCalled();
    expect(matchingGateway.emitBookingMatched).not.toHaveBeenCalled();
  });
});

describe('BookingsService provider service lifecycle', () => {
  it('announces Partner arrival to the active booking room', async () => {
    const arrivedBooking = {
      id: 'booking-1',
      status: BookingStatus.ARRIVED,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            selectedProviderId: 'partner-1',
            status: BookingStatus.PROVIDER_ON_THE_WAY,
          })
          .mockResolvedValueOnce(arrivedBooking),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const matchingGateway = {
      emitProviderArrived: vi.fn().mockRejectedValue(new Error('Realtime unavailable')),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateProviderBookingStatus('booking-1', 'partner-user-1', BookingStatus.ARRIVED),
    ).resolves.toBe(arrivedBooking);

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        selectedProviderId: 'partner-1',
        status: { in: [BookingStatus.MATCHED, BookingStatus.PROVIDER_ON_THE_WAY] },
      },
      data: { status: BookingStatus.ARRIVED },
    });
    expect(matchingGateway.emitProviderArrived).toHaveBeenCalledWith('booking-1', arrivedBooking);
  });

  it('rejects a stale Partner lifecycle write before emitting an arrival event', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const matchingGateway = { emitProviderArrived: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateProviderBookingStatus('booking-1', 'partner-user-1', BookingStatus.ARRIVED),
    ).rejects.toThrow('Booking state changed concurrently; reload and try again');
    expect(matchingGateway.emitProviderArrived).not.toHaveBeenCalled();
  });

  it('starts service with wallet gate, chat handoff, and service-started notifications', async () => {
    const startedBooking = {
      id: 'booking-1',
      status: BookingStatus.IN_SERVICE,
      customerProfile: { userId: 'customer-user-1' },
      selectedProvider: { id: 'partner-1', userId: 'partner-user-1' },
      preferredProvider: null,
      chatRoom: { id: 'chat-room-1' },
    };
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.ARRIVED,
        }),
        update: vi.fn().mockResolvedValue(startedBooking),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const notifications = { create: vi.fn().mockRejectedValue(new Error('Notification queue unavailable')) };
    const matchingGateway = { emitServiceStarted: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.updateProviderBookingStatus('booking-1', 'partner-user-1', BookingStatus.IN_SERVICE),
    ).resolves.toBe(startedBooking);

    expect(prisma.providerWalletLedgerEntry.aggregate).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.IN_SERVICE,
          chatRoom: { upsert: { create: {}, update: {} } },
        }),
        include: expect.objectContaining({
          chatRoom: true,
          customerProfile: true,
          selectedProvider: true,
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'service.started',
        userId: 'customer-user-1',
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'service.started',
        userId: 'partner-user-1',
        data: {
          destination: 'chat',
          bookingId: 'booking-1',
          chatRoomId: 'chat-room-1',
        },
      }),
    );
    expect(matchingGateway.emitServiceStarted).toHaveBeenCalledWith('booking-1', startedBooking);
  });

  it('auto-approves partner post-match cancellations inside the 15-minute window', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-01T10:10:00.000Z'));
    const payment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      amount: 400000,
      currency: 'VND',
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING,
    };
    const releasedPayment = { ...payment, status: PaymentStatus.RELEASED };
    const earning = {
      id: 'earning-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      netAmount: -100000,
      currency: 'VND',
      status: EarningStatus.PENDING,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          notes: null,
          matchedAt: new Date('2026-06-01T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          earning,
        }),
        update: vi.fn().mockResolvedValue(providerCancelledBooking({ payment })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerEarning: {
        update: vi.fn().mockResolvedValue({ ...earning, status: EarningStatus.CANCELLED, netAmount: 0 }),
      },
      providerWalletLedgerEntry: { upsert: vi.fn() },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      paymentAdminOperationClaim: { findFirst: vi.fn().mockResolvedValue(null) },
      adminAuditLog: { create: vi.fn() },
    };
    const prisma = {
      booking: {
        update: vi.fn(),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const matching = { closeBooking: vi.fn() };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const notifications = { create: vi.fn() };
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({
        payment: releasedPayment,
        refundRequested: false,
        released: true,
      }),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    try {
      const result = await service.cancelProviderBooking('booking-1', 'partner-user-1', {
        addressText: '  Lang, Ha Noi  ',
        lat: 10.7769,
        lng: 106.7009,
        reasonCode: 'CUSTOMER_REQUESTED',
        note: 'Cancelled from chat',
      });

      expect(result.postMatchCancellation).toMatchObject({
        autoApproved: true,
        adminReviewRequired: false,
        minutesAfterMatch: 10,
        reasonCode: 'CUSTOMER_REQUESTED',
      });
      expect(tx.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            closedReason: 'post_match_cancellation_approved',
            closedNote: 'Customer requested cancellation: Cancelled from chat',
          }),
        }),
      );
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            opsTasks: expect.objectContaining({
              upsert: expect.objectContaining({
                update: expect.objectContaining({ status: BookingOpsTaskStatus.PENDING }),
                create: expect.objectContaining({ status: BookingOpsTaskStatus.PENDING }),
              }),
            }),
          }),
        }),
      );
      expect(tx.providerEarning.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EarningStatus.CANCELLED, netAmount: 0 }),
        }),
      );
      expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sourceKey: 'earning:earning-1:post-match-cancellation-approval' },
        }),
      );
      expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledWith(
        'payment-1',
        'Partner post-match cancellation auto-approved',
      );
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking-1' },
          data: expect.objectContaining({
            opsTasks: expect.objectContaining({
              upsert: expect.objectContaining({
                update: expect.objectContaining({ status: BookingOpsTaskStatus.DONE }),
              }),
            }),
          }),
        }),
      );
      expect(result.payment).toEqual(expect.objectContaining({ status: PaymentStatus.RELEASED }));
      expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'booking.post_match_cancellation.auto_approve',
          }),
        }),
      );
      expect(tx.locationSnapshot.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
          addressText: 'Lang, Ha Noi',
          lat: 10.7769,
          lng: 106.7009,
        },
      });
      expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'customer-user-1',
          data: expect.objectContaining({ autoApproved: true }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects partner post-match cancellations before closeout when action location is missing', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      locationSnapshot: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.cancelProviderBooking('booking-1', 'partner-user-1', {
        reasonCode: 'CUSTOMER_REQUESTED',
        note: 'Cancelled from chat',
      }),
    ).rejects.toThrow('Partner action location requires both lat and lng');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.locationSnapshot.create).not.toHaveBeenCalled();
  });

  it('blocks partner cancellation while a booking payment operation is active', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.IN_SERVICE,
          notes: null,
          matchedAt: new Date('2026-06-01T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          earning: null,
          opsTasks: [],
        }),
        updateMany: vi.fn(),
      },
      paymentAdminOperationClaim: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'claim-1',
          status: PaymentAdminOperationStatus.IN_PROGRESS,
        }),
      },
    };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue(approvedPartner()) },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.cancelProviderBooking('booking-1', 'partner-user-1', {
        reasonCode: 'CUSTOMER_REQUESTED',
        note: 'Customer requested cancellation in chat.',
        lat: 10.7769,
        lng: 106.7009,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BOOKING_PAYMENT_OPERATION_IN_PROGRESS' }),
    });

    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('rolls back partner cancellation when location evidence cannot be stored', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.IN_SERVICE,
          notes: null,
          matchedAt: new Date('2026-06-01T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          earning: null,
          opsTasks: [],
        }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      locationSnapshot: {
        create: vi.fn().mockRejectedValue(new Error('location evidence unavailable')),
      },
      paymentAdminOperationClaim: { findFirst: vi.fn().mockResolvedValue(null) },
      providerEarning: { update: vi.fn() },
      providerWalletLedgerEntry: { upsert: vi.fn() },
    };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue(approvedPartner()) },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.cancelProviderBooking('booking-1', 'partner-user-1', {
        reasonCode: 'CUSTOMER_REQUESTED',
        note: 'Customer requested cancellation in chat.',
        lat: 10.7769,
        lng: 106.7009,
      }),
    ).rejects.toThrow('location evidence unavailable');

    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.providerEarning.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'after the 15-minute approval window',
      now: '2026-06-01T10:16:00.000Z',
      reasonCode: 'CUSTOMER_REQUESTED' as const,
      note: 'Customer requested cancellation after the approval window.',
      minutesAfterMatch: 16,
    },
    {
      caseName: 'when the Partner could not meet the customer inside the approval window',
      now: '2026-06-01T10:10:00.000Z',
      reasonCode: 'CUSTOMER_NOT_FOUND' as const,
      note: 'Arrived at the saved address and called twice without a response.',
      minutesAfterMatch: 10,
    },
  ])(
    'queues partner post-match cancellations for admin review $caseName',
    async ({ now, reasonCode, note, minutesAfterMatch }) => {
      vi.useFakeTimers().setSystemTime(new Date(now));
      const payment = {
        id: 'payment-1',
        bookingId: 'booking-1',
        amount: 400000,
        currency: 'VND',
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING,
      };
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        booking: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'booking-1',
            status: BookingStatus.ARRIVED,
            notes: null,
            matchedAt: new Date('2026-06-01T10:00:00.000Z'),
            selectedProviderId: 'partner-1',
            earning: null,
          }),
          update: vi.fn().mockResolvedValue(providerCancelledBooking({ payment })),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        providerEarning: { update: vi.fn() },
        providerWalletLedgerEntry: { upsert: vi.fn() },
        locationSnapshot: {
          create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
        },
        paymentAdminOperationClaim: { findFirst: vi.fn().mockResolvedValue(null) },
        adminAuditLog: { create: vi.fn() },
      };
      const prisma = {
        providerProfile: {
          findUnique: vi.fn().mockResolvedValue(approvedPartner()),
        },
        $transaction: vi.fn((callback) => callback(tx)),
      };
      const matching = { closeBooking: vi.fn() };
      const matchingGateway = { emitBookingExpired: vi.fn() };
      const notifications = { create: vi.fn() };
      const payments = { closeUnmatchedBookingPayment: vi.fn() };
      const service = new BookingsService(
        prisma as never,
        matching as never,
        matchingGateway as never,
        payments as never,
        notifications as never,
        {} as never,
      );

      try {
        const result = await service.cancelProviderBooking('booking-1', 'partner-user-1', {
          addressText: '  Cau Giay, Ha Noi  ',
          lat: 21.0285,
          lng: 105.8542,
          reasonCode,
          note,
        });

        expect(result.postMatchCancellation).toMatchObject({
          autoApproved: false,
          adminReviewRequired: true,
          minutesAfterMatch,
          earningResult: { skipped: true, reason: 'AWAITING_ADMIN_REVIEW' },
          reasonCode,
        });
        expect(tx.booking.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: BookingStatus.CANCELLED,
              closedReason: 'partner_cancelled',
              metadata: expect.objectContaining({
                postMatchCancellation: expect.objectContaining({
                  requiresAdminReview: true,
                }),
              }),
            }),
          }),
        );
        expect(tx.booking.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              opsTasks: expect.objectContaining({
                upsert: expect.objectContaining({
                  update: expect.objectContaining({ status: BookingOpsTaskStatus.PENDING }),
                  create: expect.objectContaining({ status: BookingOpsTaskStatus.PENDING }),
                }),
              }),
            }),
          }),
        );
        expect(tx.providerEarning.update).not.toHaveBeenCalled();
        expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
        expect(payments.closeUnmatchedBookingPayment).not.toHaveBeenCalled();
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'booking.post_match_cancellation.review_required',
            }),
          }),
        );
        expect(tx.locationSnapshot.create).toHaveBeenCalledWith({
          data: {
            bookingId: 'booking-1',
            providerProfileId: 'partner-1',
            addressText: 'Cau Giay, Ha Noi',
            lat: 21.0285,
            lng: 105.8542,
          },
        });
        expect(notifications.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'customer-user-1',
            data: expect.objectContaining({ adminReviewRequired: true }),
          }),
        );
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

describe('BookingsService service completion', () => {
  it('reserves gateway capture and releases the claim only with the completed booking transaction', async () => {
    const completedBooking = completedBookingWithAddressSnapshot();
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
      providerProfile: { findUnique: vi.fn().mockResolvedValue(approvedPartner()) },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            selectedProviderId: 'partner-1',
            status: BookingStatus.IN_SERVICE,
          })
          .mockResolvedValueOnce({
            selectedProviderId: 'partner-1',
            status: BookingStatus.IN_SERVICE,
          })
          .mockResolvedValueOnce(completedBooking)
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
      },
      locationSnapshot: { create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }) },
      payment: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'payment-1',
            method: PaymentMethod.MOMO,
            status: PaymentStatus.AUTHORIZED,
          })
          .mockResolvedValueOnce({ id: 'payment-1', method: PaymentMethod.MOMO })
          .mockResolvedValueOnce({ id: 'payment-1', status: PaymentStatus.CAPTURED }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      paymentAdminOperationClaim: {
        create: vi.fn().mockResolvedValue({ id: 'claim-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const payments = {
      confirmGatewayCaptureForBookingCompletion: vi.fn().mockResolvedValue({}),
      paymentRequiresGatewayCaptureForBookingCompletion: vi.fn().mockReturnValue(true),
    };
    const earnings = { createForCompletedBooking: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      { completeBooking: vi.fn().mockReturnValue(completedBooking) } as never,
      { emitServiceCompleted: vi.fn() } as never,
      payments as never,
      { create: vi.fn() } as never,
      earnings as never,
      { reconcile: vi.fn() } as never,
    );

    await service.complete('booking-1', 'partner-user-1', { lat: 10.7769, lng: 106.7009 });

    expect(prisma.paymentAdminOperationClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BOOKING_COMPLETION_CAPTURE',
          paymentId: 'payment-1',
        }),
      }),
    );
    expect(prisma.paymentAdminOperationClaim.updateMany).toHaveBeenCalledWith({
      where: { id: 'claim-1', status: PaymentAdminOperationStatus.IN_PROGRESS },
      data: expect.objectContaining({ status: PaymentAdminOperationStatus.SUCCEEDED }),
    });
    expect(earnings.createForCompletedBooking).toHaveBeenCalled();
  });

  it('loads the immutable address snapshot before emitting the completed booking', async () => {
    const completedBooking = completedBookingWithAddressSnapshot();
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            selectedProviderId: 'partner-1',
            status: BookingStatus.IN_SERVICE,
          })
          .mockResolvedValueOnce({
            ...completedBooking,
          })
          .mockResolvedValueOnce({
            customerProfile: { userId: 'customer-user-1' },
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(2),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      payment: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'payment-1',
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          })
          .mockResolvedValueOnce({ id: 'payment-1', method: PaymentMethod.CASH })
          .mockResolvedValueOnce({ id: 'payment-1', status: PaymentStatus.CAPTURED }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const matching = {
      completeBooking: vi.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'service.completed',
        booking: completedBooking,
      }),
    };
    const matchingGateway = { emitServiceCompleted: vi.fn() };
    const notifications = { create: vi.fn().mockRejectedValue(new Error('Notification queue unavailable')) };
    const earnings = { createForCompletedBooking: vi.fn() };
    const payments = {
      confirmGatewayCaptureForBookingCompletion: vi.fn().mockResolvedValue({}),
      paymentRequiresGatewayCaptureForBookingCompletion: vi.fn().mockReturnValue(false),
    };
    const providerAvailabilityLifecycle = { markBusy: vi.fn(), reconcile: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      earnings as never,
      providerAvailabilityLifecycle as never,
    );

    await expect(
      service.complete('booking-1', 'partner-user-1', {
        lat: 10.7769,
        lng: 106.7009,
      }),
    ).resolves.toEqual(expect.any(Object));

    expect(providerAvailabilityLifecycle.reconcile).toHaveBeenCalledWith('partner-1');
    expect(matchingGateway.emitServiceCompleted).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ event: 'service.completed' }),
    );
    expect(payments.confirmGatewayCaptureForBookingCompletion).toHaveBeenCalledWith(
      'partner-user-1',
      'booking-1',
    );

    expect(prisma.booking.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          addressSnapshot: true,
        }),
      }),
    );
    expect(matching.completeBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({
        addressSnapshot: expect.objectContaining({
          addressText: 'District 1, Ho Chi Minh City, Vietnam',
          latitude: 10.7769,
          longitude: 106.7009,
        }),
      }),
    );
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      data: { status: PaymentStatus.CAPTURED },
      where: { id: 'payment-1', status: { in: [PaymentStatus.PENDING] } },
    });
    const completedAt = prisma.booking.updateMany.mock.calls[0]?.[0]?.data.closedAt;
    expect(completedAt).toBeInstanceOf(Date);
    expect(earnings.createForCompletedBooking).toHaveBeenCalledWith(
      'booking-1',
      'partner-1',
      { occurredAt: completedAt },
      prisma,
    );
  });

  it('records a booking-linked partner action location before completion when provided', async () => {
    const completedBooking = completedBookingWithAddressSnapshot();
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            selectedProviderId: 'partner-1',
            status: BookingStatus.IN_SERVICE,
          })
          .mockResolvedValueOnce({
            ...completedBooking,
          })
          .mockResolvedValueOnce({
            customerProfile: { userId: 'customer-user-1' },
          }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(2),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      payment: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'payment-1',
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          })
          .mockResolvedValueOnce({ id: 'payment-1', method: PaymentMethod.CASH })
          .mockResolvedValueOnce({ id: 'payment-1', status: PaymentStatus.CAPTURED }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const matching = {
      completeBooking: vi.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'service.completed',
        booking: completedBooking,
      }),
    };
    const matchingGateway = { emitServiceCompleted: vi.fn() };
    const notifications = { create: vi.fn() };
    const earnings = { createForCompletedBooking: vi.fn() };
    const payments = {
      confirmGatewayCaptureForBookingCompletion: vi.fn().mockResolvedValue({}),
      paymentRequiresGatewayCaptureForBookingCompletion: vi.fn().mockReturnValue(false),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      earnings as never,
    );

    await service.complete('booking-1', 'partner-user-1', {
      addressText: '  33 Nguyen Dinh Chieu, Ho Chi Minh City  ',
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(prisma.locationSnapshot.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        addressText: '33 Nguyen Dinh Chieu, Ho Chi Minh City',
        lat: 10.7769,
        lng: 106.7009,
      },
    });
    expect(prisma.booking.updateMany).toHaveBeenCalled();
  });

  it('does not publish completion side effects when the booking state claim is stale', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.IN_SERVICE,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      payment: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'payment-1',
            method: PaymentMethod.CASH,
            status: PaymentStatus.PENDING,
          })
          .mockResolvedValueOnce({ id: 'payment-1', method: PaymentMethod.CASH })
          .mockResolvedValueOnce({ id: 'payment-1', status: PaymentStatus.CAPTURED }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const matching = { completeBooking: vi.fn() };
    const matchingGateway = { emitServiceCompleted: vi.fn() };
    const notifications = { create: vi.fn() };
    const earnings = { createForCompletedBooking: vi.fn() };
    const payments = {
      confirmGatewayCaptureForBookingCompletion: vi.fn().mockResolvedValue({}),
      paymentRequiresGatewayCaptureForBookingCompletion: vi.fn().mockReturnValue(false),
    };
    const providerAvailabilityLifecycle = { reconcile: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      earnings as never,
      providerAvailabilityLifecycle as never,
    );

    await expect(
      service.complete('booking-1', 'partner-user-1', { lat: 10.7769, lng: 106.7009 }),
    ).rejects.toThrow('Booking state changed concurrently; reload and try again');
    expect(earnings.createForCompletedBooking).not.toHaveBeenCalled();
    expect(matching.completeBooking).not.toHaveBeenCalled();
    expect(matchingGateway.emitServiceCompleted).not.toHaveBeenCalled();
    expect(providerAvailabilityLifecycle.reconcile).not.toHaveBeenCalled();
  });

  it('does not start completion accounting when gateway capture cannot be confirmed', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.IN_SERVICE,
        }),
      },
      payment: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'payment-1',
          method: PaymentMethod.MOMO,
          status: PaymentStatus.AUTHORIZED,
        }),
      },
      paymentAdminOperationClaim: {
        create: vi.fn().mockResolvedValue({ id: 'claim-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const payments = {
      confirmGatewayCaptureForBookingCompletion: vi
        .fn()
        .mockRejectedValue(new Error('gateway capture unavailable')),
      paymentRequiresGatewayCaptureForBookingCompletion: vi.fn().mockReturnValue(true),
    };
    const earnings = { createForCompletedBooking: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      payments as never,
      {} as never,
      earnings as never,
    );

    await expect(
      service.complete('booking-1', 'partner-user-1', { lat: 10.7769, lng: 106.7009 }),
    ).rejects.toThrow('gateway capture unavailable');

    expect(prisma.paymentAdminOperationClaim.updateMany).toHaveBeenCalledWith({
      where: { id: 'claim-1', status: PaymentAdminOperationStatus.IN_PROGRESS },
      data: expect.objectContaining({
        errorCode: 'BOOKING_COMPLETION_CAPTURE_REQUIRES_REVIEW',
        status: PaymentAdminOperationStatus.REVIEW_REQUIRED,
      }),
    });
    expect(earnings.createForCompletedBooking).not.toHaveBeenCalled();
  });

  it('rejects completion before closeout when Partner action location is missing', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.IN_SERVICE,
        }),
        update: vi.fn(),
      },
      locationSnapshot: {
        create: vi.fn(),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.complete('booking-1', 'partner-user-1')).rejects.toThrow(
      'Partner action location requires both lat and lng',
    );

    expect(prisma.locationSnapshot.create).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });
});

describe('BookingsService partner customer evaluations', () => {
  it('creates one text-only customer evaluation for a completed booking selected Partner', async () => {
    const createdReview = {
      id: 'partner-customer-review-1',
      bookingId: 'booking-1',
      customerProfileId: 'customer-1',
      providerProfileId: 'partner-1',
      comment: 'Polite customer and smooth service closeout.',
      createdAt: new Date('2026-06-01T12:00:00.000Z'),
    };
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
        }),
      },
      providerCustomerReview: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdReview),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createProviderCustomerReview('booking-1', 'partner-user-1', {
        comment: '  Polite customer and smooth service closeout.  ',
      }),
    ).resolves.toBe(createdReview);

    expect(tx.booking.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      select: {
        id: true,
        status: true,
        customerProfileId: true,
        selectedProviderId: true,
      },
    });
    expect(tx.providerCustomerReview.findUnique).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      select: { id: true },
    });
    expect(tx.providerCustomerReview.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        customerProfileId: 'customer-1',
        providerProfileId: 'partner-1',
        comment: 'Polite customer and smooth service closeout.',
      },
    });
  });

  it('rejects duplicate Partner customer evaluations for the same booking', async () => {
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
        }),
      },
      providerCustomerReview: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing-review-1' }),
        create: vi.fn(),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createProviderCustomerReview('booking-1', 'partner-user-1', {
        comment: 'Already evaluated.',
      }),
    ).rejects.toThrow('Partner customer evaluation already exists for this booking');

    expect(tx.providerCustomerReview.create).not.toHaveBeenCalled();
  });

  it('rejects Partner customer evaluations before service completion', async () => {
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.IN_SERVICE,
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
        }),
      },
      providerCustomerReview: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createProviderCustomerReview('booking-1', 'partner-user-1', {
        comment: 'Too early.',
      }),
    ).rejects.toThrow('Partner customer evaluation is allowed only after service completion');

    expect(tx.providerCustomerReview.findUnique).not.toHaveBeenCalled();
    expect(tx.providerCustomerReview.create).not.toHaveBeenCalled();
  });
});

describe('BookingsService customer cancellation', () => {
  it('returns the latest matched booking in a conflict response', async () => {
    const matchedBooking = {
      ...openFirstPickBooking(),
      status: BookingStatus.IN_SERVICE,
      selectedProviderId: 'partner-1',
      selectedProvider: approvedPartner(),
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockResolvedValue(matchedBooking),
        update: vi.fn(),
      },
    };
    const payments = { closeUnmatchedBookingPayment: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      payments as never,
      {} as never,
      {} as never,
    );

    await expect(service.cancelCustomerBooking('booking-1', 'customer-user-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        booking: expect.objectContaining({
          status: BookingStatus.IN_SERVICE,
          selectedProviderId: 'partner-1',
        }),
      }),
      status: 409,
    });
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(payments.closeUnmatchedBookingPayment).not.toHaveBeenCalled();
  });

  it('loads the immutable address snapshot before returning a cancelled booking', async () => {
    const cancelledBooking = cancelledBookingWithAddressSnapshot();
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          preferredProvider: null,
          selectedProvider: null,
          participants: [],
          payment: { id: 'payment-1' },
        }),
        update: vi.fn().mockResolvedValue(cancelledBooking),
      },
      adminAuditLog: { create: vi.fn() },
    };
    attachTransaction(prisma);
    const matching = { closeBooking: vi.fn() };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({
        payment: cancelledBooking.payment,
        refundRequested: false,
        released: true,
      }),
    };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await service.cancelCustomerBooking('booking-1', 'customer-user-1');

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          addressSnapshot: true,
        }),
      }),
    );
    expect(matchingGateway.emitBookingExpired).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({
        addressSnapshot: expect.objectContaining({
          addressText: 'District 1, Ho Chi Minh City, Vietnam',
        }),
      }),
    );
  });

  it('cancels a payment-pending booking before matching opens', async () => {
    const cancelledBooking = cancelledBookingWithAddressSnapshot();
    const bookingUpdate = vi.fn().mockResolvedValue(cancelledBooking);
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.CREATED,
          selectedProviderId: null,
          preferredProvider: null,
          selectedProvider: null,
          participants: [],
          payment: { id: 'payment-1', status: PaymentStatus.PENDING },
        }),
        update: bookingUpdate,
      },
      adminAuditLog: { create: vi.fn() },
    };
    attachTransaction(prisma);
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({
        payment: cancelledBooking.payment,
        refundRequested: false,
        released: true,
      }),
    };
    const service = new BookingsService(
      prisma as never,
      { closeBooking: vi.fn() } as never,
      { emitBookingExpired: vi.fn() } as never,
      payments as never,
      { create: vi.fn() } as never,
      {} as never,
    );

    await service.cancelCustomerBooking('booking-1', 'customer-user-1');

    expect(bookingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'booking-1',
          selectedProviderId: null,
          OR: expect.arrayContaining([
            { status: BookingStatus.CREATED },
            expect.objectContaining({ status: BookingStatus.OPEN_MATCHING }),
          ]),
        }),
      }),
    );
    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledWith(
      'payment-1',
      'Customer cancelled after gateway payment capture',
    );
  });

  it('retries payment closure for a customer cancellation left pending', async () => {
    const cancelledBooking = {
      ...cancelledBookingWithAddressSnapshot(),
      closedByRole: Role.CUSTOMER,
      closedReason: 'customer_cancelled',
      opsTasks: [
        {
          type: BookingOpsTaskType.PAYMENT_REVIEWED,
          status: BookingOpsTaskStatus.PENDING,
        },
      ],
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockResolvedValue(cancelledBooking),
        update: vi.fn(),
      },
    };
    const matching = { closeBooking: vi.fn() };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({
        payment: cancelledBooking.payment,
        refundRequested: false,
        released: true,
      }),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      { create: vi.fn() } as never,
      {} as never,
    );

    await service.cancelCustomerBooking('booking-1', 'customer-user-1');

    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledOnce();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opsTasks: expect.objectContaining({
            upsert: expect.objectContaining({
              update: expect.objectContaining({ status: BookingOpsTaskStatus.DONE }),
            }),
          }),
        }),
      }),
    );
  });
});

describe('BookingsService marketplace participation', () => {
  it('returns the latest booking state when a Partner joins after matching closed', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner({ id: 'partner-2' })),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'partner-1',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: vi.fn(),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.joinBooking('booking-1', 'partner-user-2')).rejects.toMatchObject({
      response: {
        message: 'Booking is already matched or no longer open for partner response',
        booking: {
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'partner-1',
          expiresAt: expect.any(Date),
        },
      },
      status: 409,
    });

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('keeps marketplace requests visible for negative-wallet partners', async () => {
    const openBooking = {
      ...openMarketplaceBooking(),
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: approvedPartner({ id: 'first-pick-partner' }),
      selectedProvider: null,
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.AUTHORIZED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([openBooking]),
      },
      providerBookingRequestEvent: {
        create: vi.fn(),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: -120000 } }),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getOpenBookings('partner-user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'booking-1',
        status: BookingStatus.OPEN_MATCHING,
      }),
    ]);

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
  });

  it('does not expose open marketplace requests before Partner identity approval', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi
          .fn()
          .mockResolvedValue(approvedPartner({ verification: { status: VerificationStatus.SUBMITTED } })),
      },
      booking: { findMany: vi.fn() },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getOpenBookings('partner-user-1')).rejects.toThrow(
      'Partner verification must be approved before receiving bookings',
    );
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('bounds partner open request reads with a default limit while preserving the list response', async () => {
    const openBooking = {
      ...openMarketplaceBooking(),
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: approvedPartner({ id: 'first-pick-partner' }),
      selectedProvider: null,
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.AUTHORIZED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([openBooking]),
      },
      providerBookingRequestEvent: {
        create: vi.fn(),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const bookings = await service.getOpenBookings('partner-user-1');

    expect(bookings).toEqual([
      expect.objectContaining({
        id: 'booking-1',
        status: BookingStatus.OPEN_MATCHING,
      }),
    ]);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    );
  });

  it('keeps active assigned work visible ahead of recent provider history', async () => {
    const activeBooking = {
      ...openMarketplaceBooking(),
      id: 'active-booking',
      status: BookingStatus.PROVIDER_ON_THE_WAY,
      selectedProviderId: 'provider-1',
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: null,
      selectedProvider: approvedPartner({ id: 'provider-1' }),
      participants: [],
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.AUTHORIZED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner({ id: 'provider-1' })),
      },
      booking: {
        findMany: vi.fn().mockResolvedValueOnce([activeBooking]).mockResolvedValueOnce([]),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.listProviderBookings('partner-user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'active-booking',
        status: BookingStatus.PROVIDER_ON_THE_WAY,
      }),
    ]);
    expect(prisma.booking.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          selectedProviderId: 'provider-1',
          status: { in: PROVIDER_ACTIVE_WORK_STATUS_VALUES },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    );
    expect(prisma.booking.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ status: { notIn: [...PROVIDER_ACTIVE_WORK_STATUS_VALUES] } }]),
        }),
        take: 19,
      }),
    );
  });

  it('paginates closed provider job history without changing the list response', async () => {
    const closedBooking = {
      ...openMarketplaceBooking(),
      id: 'closed-booking',
      status: BookingStatus.COMPLETED,
      selectedProviderId: 'provider-1',
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: null,
      selectedProvider: approvedPartner({ id: 'provider-1' }),
      participants: [],
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.CAPTURED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner({ id: 'provider-1' })),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([closedBooking]),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listProviderBookings('partner-user-1', {
        scope: 'history',
        cursor: 'booking-cursor-1',
        take: '500',
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'closed-booking', status: BookingStatus.COMPLETED })]);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'booking-cursor-1' },
        skip: 1,
        take: 50,
        where: {
          AND: [
            providerBookingHistoryWhere('provider-1'),
            {
              status: {
                in: [
                  BookingStatus.COMPLETED,
                  BookingStatus.CANCELLED,
                  BookingStatus.NO_SHOW,
                  BookingStatus.EXPIRED,
                  BookingStatus.REFUNDED,
                ],
              },
            },
          ],
        },
      }),
    );
  });

  it('records a partner open request list view event after visible requests are returned', async () => {
    const openBooking = {
      ...openMarketplaceBooking(),
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: approvedPartner({ id: 'first-pick-partner' }),
      selectedProvider: null,
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.AUTHORIZED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([openBooking]),
      },
      providerBookingRequestEvent: {
        create: vi.fn(),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.getOpenBookings('partner-user-1');

    expect(prisma.providerBookingRequestEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: 'OPEN_REQUEST_LIST_VIEWED',
        providerProfileId: 'partner-1',
        visibleBookingCount: 1,
        metadata: {
          bookingIds: ['booking-1'],
        },
      },
    });
  });

  it('clamps partner open request take and applies cursor paging without changing response shape', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getOpenBookings('partner-user-1', { cursor: 'booking-cursor-1', take: '500' }),
    ).resolves.toEqual([]);

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'booking-cursor-1' },
        skip: 1,
        take: 50,
      }),
    );
  });

  it('records a partner open request detail view event for visible booking details', async () => {
    const openBooking = {
      ...openMarketplaceBooking(),
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: approvedPartner({ id: 'first-pick-partner' }),
      selectedProvider: null,
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.AUTHORIZED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockResolvedValue(openBooking),
      },
      providerBookingRequestEvent: {
        create: vi.fn(),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getProviderBooking('booking-1', 'partner-user-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'booking-1',
        status: BookingStatus.OPEN_MATCHING,
      }),
    );
    expect(prisma.providerBookingRequestEvent.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        eventType: 'OPEN_REQUEST_DETAIL_VIEWED',
        providerProfileId: 'partner-1',
      },
    });
  });

  it('records partner open request detail close duration for visible booking details', async () => {
    const openBooking = {
      ...openMarketplaceBooking(),
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      address: { city: 'Ho Chi Minh City', district: 'District 1' },
      preferredProvider: approvedPartner({ id: 'first-pick-partner' }),
      selectedProvider: null,
      payment: {
        amount: 500000,
        method: PaymentMethod.CASH,
        status: PaymentStatus.AUTHORIZED,
        currency: 'VND',
      },
      chatRoom: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findFirstOrThrow: vi.fn().mockResolvedValue(openBooking),
      },
      providerBookingRequestEvent: {
        create: vi.fn(),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.recordProviderBookingDetailView('booking-1', 'partner-user-1', {
        durationSeconds: 95,
        eventType: 'closed',
      }),
    ).resolves.toEqual({
      durationSeconds: 95,
      eventType: 'OPEN_REQUEST_DETAIL_CLOSED',
      recorded: true,
    });

    expect(prisma.providerBookingRequestEvent.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        eventType: 'OPEN_REQUEST_DETAIL_CLOSED',
        metadata: {
          durationSeconds: 95,
          statusAtEvent: BookingStatus.OPEN_MATCHING,
        },
        providerProfileId: 'partner-1',
      },
    });
  });

  it('hides new open requests while the partner has unfinished selected work', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(
          approvedPartner({
            selectedBookings: [{ id: 'active-booking-1', status: BookingStatus.IN_SERVICE }],
          }),
        ),
      },
      booking: {
        findMany: vi.fn(),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.getOpenBookings('partner-user-1')).resolves.toEqual([]);

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('allows a negative-wallet partner to participate before final selection', async () => {
    const participant = {
      id: 'participant-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      status: ParticipantStatus.JOINED,
      providerProfile: approvedPartner(),
    };
    const bookingUpdate = vi.fn().mockResolvedValue({ participants: [participant] });
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce(openMarketplaceBooking())
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
        update: bookingUpdate,
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -120000 } }),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue({
        ...matchingPolicy(),
        backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
      }),
      registerParticipant: vi.fn(),
      joinBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'provider.joined' }),
    };
    const notifications = { create: vi.fn() };
    const matchingGateway = { emitProviderJoined: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(service.joinBooking('booking-1', 'partner-user-1')).resolves.toEqual({
      bookingId: 'booking-1',
      event: 'provider.joined',
    });

    expect(prisma.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(bookingUpdate).toHaveBeenCalled();
    expect(matching.registerParticipant).toHaveBeenCalled();
  });

  it('does not apply the marketplace wallet gate to the preferred first-pick partner', async () => {
    const participant = {
      id: 'participant-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      status: ParticipantStatus.JOINED,
      distanceMeters: 0,
      providerProfile: approvedPartner(),
    };
    const bookingUpdate = vi.fn().mockResolvedValue({ participants: [participant] });
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce(openFirstPickBooking())
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
        update: bookingUpdate,
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      registerParticipant: vi.fn(),
      joinBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'provider.joined' }),
    };
    const notifications = { create: vi.fn() };
    const matchingGateway = { emitProviderJoined: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(service.joinBooking('booking-1', 'partner-user-1')).resolves.toEqual({
      bookingId: 'booking-1',
      event: 'provider.joined',
    });

    expect(prisma.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(bookingUpdate).toHaveBeenCalled();
  });

  it('returns the committed marketplace join when Redis registration fails', async () => {
    const participant = {
      id: 'participant-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      status: ParticipantStatus.JOINED,
      providerProfile: approvedPartner(),
    };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue(approvedPartner()) },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce(openMarketplaceBooking())
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
        update: vi.fn().mockResolvedValue({ participants: [participant] }),
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      registerParticipant: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
      joinBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'provider.joined' }),
    };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const matchingGateway = { emitProviderJoined: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(service.joinBooking('booking-1', 'partner-user-1')).resolves.toEqual({
      bookingId: 'booking-1',
      event: 'provider.joined',
    });

    expect(notifications.create).toHaveBeenCalled();
    expect(matchingGateway.emitProviderJoined).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ event: 'provider.joined' }),
    );
  });

  it('blocks marketplace participation outside the booking-address radius', async () => {
    const bookingParticipantUpsert = vi.fn();
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(
          approvedPartner({
            currentLat: 10.0,
            currentLng: 106.0,
          }),
        ),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(openMarketplaceBooking()),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      bookingParticipant: {
        upsert: bookingParticipantUpsert,
      },
    };
    const matching = {
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      registerParticipant: vi.fn(),
      joinBooking: vi.fn(),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.joinBooking('booking-1', 'partner-user-1')).rejects.toThrow(
      'Only partners within 10km can participate in this booking',
    );

    expect(prisma.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(bookingParticipantUpsert).not.toHaveBeenCalled();
    expect(matching.registerParticipant).not.toHaveBeenCalled();
  });
});

describe('BookingsService partner response wallet gates', () => {
  it('returns the latest booking state when a Partner responds after matching closed', async () => {
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner({ id: 'partner-2' })),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'partner-1',
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: vi.fn(),
      },
      bookingParticipant: { findUnique: vi.fn() },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateParticipant('booking-1', 'partner-user-2', ParticipantStatus.ACCEPTED),
    ).rejects.toMatchObject({
      response: {
        message: 'Booking is already matched or no longer open for partner response',
        booking: {
          id: 'booking-1',
          status: BookingStatus.PROVIDER_ON_THE_WAY,
          selectedProviderId: 'partner-1',
          expiresAt: expect.any(Date),
        },
      },
      status: 409,
    });

    expect(prisma.bookingParticipant.findUnique).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('allows a marketplace participant with a negative wallet to accept while awaiting customer selection', async () => {
    const acceptedParticipant = { id: 'participant-1', status: ParticipantStatus.ACCEPTED };
    const bookingUpdate = vi.fn().mockResolvedValue({ participants: [acceptedParticipant] });
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...openMarketplaceBooking(),
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: null,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
        update: bookingUpdate,
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -90000 } }),
      },
    };
    const notifications = { create: vi.fn() };
    const matchingGateway = { emitProviderAccepted: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.ACCEPTED),
    ).resolves.toEqual(acceptedParticipant);

    expect(prisma.providerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(bookingUpdate).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalled();
    expect(matchingGateway.emitProviderAccepted).toHaveBeenCalledWith('booking-1', acceptedParticipant);
  });

  it('returns the committed marketplace response when notification delivery fails', async () => {
    const acceptedParticipant = { id: 'participant-1', status: ParticipantStatus.ACCEPTED };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue(approvedPartner()) },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...openMarketplaceBooking(),
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: null,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
        update: vi.fn().mockResolvedValue({ participants: [acceptedParticipant] }),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-1' }),
      },
    };
    const notifications = {
      create: vi.fn().mockRejectedValue(new Error('Notification queue unavailable')),
    };
    const matchingGateway = { emitProviderAccepted: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.ACCEPTED),
    ).resolves.toEqual(acceptedParticipant);

    expect(matchingGateway.emitProviderAccepted).toHaveBeenCalledWith('booking-1', acceptedParticipant);
  });

  it('matches the booking when the preferred first-pick partner accepts first', async () => {
    const bookingParticipantUpdate = vi.fn();
    const adminAuditLogCreate = vi.fn();
    const matchedBooking = {
      ...openFirstPickBooking(),
      status: BookingStatus.IN_SERVICE,
      selectedProviderId: 'partner-1',
      participants: [{ providerProfileId: 'partner-1', status: ParticipantStatus.SELECTED }],
      preferredProvider: approvedPartner(),
      selectedProvider: approvedPartner(),
      chatRoom: { id: 'chat-room-1', bookingId: 'booking-1' },
      addressSnapshot: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: approvedPartner(),
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
        update: vi.fn().mockResolvedValue(matchedBooking),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-1' }),
        update: bookingParticipantUpdate,
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: -90000 } }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      adminAuditLog: { create: adminAuditLogCreate },
    };
    const transaction = attachTransaction(prisma);
    const notifications = { create: vi.fn() };
    const matching = {
      closeBooking: vi.fn(),
      selectFinalProvider: vi.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'booking.matched',
        matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
        booking: matchedBooking,
      }),
    };
    const matchingGateway = {
      emitBookingMatched: vi.fn(),
      emitProviderAccepted: vi.fn(),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.ACCEPTED),
    ).resolves.toEqual(
      expect.objectContaining({
        event: 'booking.matched',
        matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
      }),
    );

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.IN_SERVICE,
          selectedProviderId: 'partner-1',
          matchedAt: expect.any(Date),
          matchSource: BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
          chatRoom: { upsert: { create: {}, update: {} } },
          participants: {
            update: {
              where: {
                bookingId_providerProfileId: { bookingId: 'booking-1', providerProfileId: 'partner-1' },
              },
              data: { status: ParticipantStatus.SELECTED, respondedAt: expect.any(Date) },
            },
            updateMany: {
              where: {
                providerProfileId: { not: 'partner-1' },
                status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
              },
              data: { status: ParticipantStatus.EXPIRED, respondedAt: expect.any(Date) },
            },
          },
        }),
      }),
    );
    expect(bookingParticipantUpdate).not.toHaveBeenCalled();
    expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
    expect(matching.selectFinalProvider).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({
        status: BookingStatus.IN_SERVICE,
        selectedProviderId: 'partner-1',
      }),
      'FIRST_PICK_ACCEPTED_FIRST',
    );
    expect(adminAuditLogCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'partner-user-1',
        action: 'booking.matched.first_pick_accepted',
        target: 'booking:booking-1',
        metadata: {
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
          matchSource: 'FIRST_PICK_ACCEPTED_FIRST',
        },
      },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking.matched',
        data: { bookingId: 'booking-1', chatRoomId: 'chat-room-1', providerProfileId: 'partner-1' },
      }),
    );
    expect(matchingGateway.emitBookingMatched).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ event: 'booking.matched', matchSource: 'FIRST_PICK_ACCEPTED_FIRST' }),
    );
    expect(matchingGateway.emitProviderAccepted).not.toHaveBeenCalled();
  });

  it('closes the whole booking and records the reason when the preferred partner rejects', async () => {
    const firstPickPartner = approvedPartner({ id: 'partner-1' });
    const rejectedBooking = {
      ...openFirstPickBooking(),
      status: BookingStatus.CANCELLED,
      closedReason: 'preferred_provider_rejected',
      customerProfile: { userId: 'customer-user-1' },
      preferredProvider: firstPickPartner,
      selectedProvider: null,
      chatRoom: null,
      services: [{ serviceId: 'service-1', service: massageService(), price: 500000 }],
      payment: null,
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(firstPickPartner),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: firstPickPartner,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
          payment: null,
        }),
        update: vi.fn().mockResolvedValue(rejectedBooking),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-1' }),
      },
      providerBookingRequestEvent: { create: vi.fn() },
      adminAuditLog: { create: vi.fn() },
    };
    attachTransaction(prisma);
    const matching = {
      closeBooking: vi.fn(),
    };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const payments = { closeUnmatchedBookingPayment: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.REJECTED, {
      reasonCode: 'SCHEDULE_CONFLICT',
      reasonDetail: 'Another confirmed appointment overlaps this request.',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          preferredProviderId: 'partner-1',
          expiresAt: { gt: expect.any(Date) },
        },
        data: expect.objectContaining({
          opsTasks: {
            upsert: {
              where: {
                bookingId_type: {
                  bookingId: 'booking-1',
                  type: BookingOpsTaskType.PAYMENT_REVIEWED,
                },
              },
              update: {
                status: BookingOpsTaskStatus.PENDING,
                note: 'Payment closure pending after preferred partner rejection.',
                actorId: 'partner-user-1',
              },
              create: {
                type: BookingOpsTaskType.PAYMENT_REVIEWED,
                status: BookingOpsTaskStatus.PENDING,
                note: 'Payment closure pending after preferred partner rejection.',
                actorId: 'partner-user-1',
              },
            },
          },
        }),
      }),
    );
    expect(prisma.providerBookingRequestEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'PREFERRED_PROVIDER_REJECTED',
        providerProfileId: 'partner-1',
        metadata: expect.objectContaining({
          reasonCode: 'SCHEDULE_CONFLICT',
          reasonDetail: 'Another confirmed appointment overlaps this request.',
        }),
      }),
    });
    expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
    expect(matchingGateway.emitBookingExpired).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ status: BookingStatus.CANCELLED }),
    );
    expect(payments.closeUnmatchedBookingPayment).not.toHaveBeenCalled();
  });

  it('resumes payment closure when a preferred-partner rejection was already committed', async () => {
    const firstPickPartner = approvedPartner({ id: 'partner-1' });
    const cancelledBooking = {
      ...openFirstPickBooking(),
      status: BookingStatus.CANCELLED,
      closedByRole: Role.PROVIDER,
      closedReason: 'preferred_provider_rejected',
      selectedProviderId: null,
      customerProfile: { userId: 'customer-user-1' },
      preferredProvider: firstPickPartner,
      selectedProvider: null,
      chatRoom: null,
      services: [{ serviceId: 'service-1' }],
      payment: { id: 'payment-1' },
      opsTasks: [
        {
          type: BookingOpsTaskType.PAYMENT_REVIEWED,
          status: BookingOpsTaskStatus.PENDING,
        },
      ],
    };
    const prisma = {
      providerProfile: { findUnique: vi.fn().mockResolvedValue(firstPickPartner) },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(cancelledBooking),
        update: vi.fn().mockResolvedValue(cancelledBooking),
      },
      bookingParticipant: { findUnique: vi.fn() },
    };
    const matching = { closeBooking: vi.fn() };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({
        payment: { id: 'payment-1', status: PaymentStatus.RELEASED },
        released: true,
        refundRequested: false,
      }),
    };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      payments as never,
      notifications as never,
      {} as never,
    );

    await expect(
      service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.REJECTED),
    ).resolves.toMatchObject({ status: BookingStatus.CANCELLED });

    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledWith(
      'payment-1',
      'Preferred partner rejected after gateway payment capture',
    );
    expect(prisma.bookingParticipant.findUnique).not.toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        opsTasks: {
          upsert: {
            where: {
              bookingId_type: {
                bookingId: 'booking-1',
                type: BookingOpsTaskType.PAYMENT_REVIEWED,
              },
            },
            update: {
              status: BookingOpsTaskStatus.DONE,
              note: 'Payment closure completed after booking cancellation.',
              actorId: 'partner-user-1',
            },
            create: {
              type: BookingOpsTaskType.PAYMENT_REVIEWED,
              status: BookingOpsTaskStatus.DONE,
              note: 'Payment closure completed after booking cancellation.',
              actorId: 'partner-user-1',
            },
          },
        },
      },
    });
    expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
    expect(matchingGateway.emitBookingExpired).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ status: BookingStatus.CANCELLED }),
    );
  });
});

function approvedPartner(overrides: Record<string, unknown> = {}) {
  return {
    id: 'partner-1',
    userId: 'partner-user-1',
    displayName: 'Linh Wellness',
    status: ProviderStatus.ONLINE_AVAILABLE,
    blockedAt: null,
    blockedReason: null,
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: new Date(),
    verification: { status: VerificationStatus.APPROVED },
    kyc: { status: ProviderKycStatus.APPROVED },
    documents: [
      approvedDocument(ProviderDocumentType.CCCD_FRONT),
      approvedDocument(ProviderDocumentType.CCCD_BACK),
      approvedDocument(ProviderDocumentType.SELFIE),
    ],
    bankAccounts: [{ status: ProviderBankAccountStatus.APPROVED, deletedAt: null }],
    ...overrides,
  };
}

function backupProviderNotificationInput() {
  return {
    stage: 'initial_open',
    bookingId: 'booking-1',
    providers: [
      { id: 'partner-1', userId: 'partner-user-1', distanceMeters: 1_000 },
      { id: 'partner-2', userId: 'partner-user-2', distanceMeters: 2_000 },
    ],
    backupProviderRadiusMeters: 10_000,
    backupOpenMode: 'IMMEDIATE',
    backupProviderInvitationLimit: 25,
    matchingPayload: { bookingId: 'booking-1' },
  };
}

function approvedDocument(type: ProviderDocumentType) {
  return {
    type,
    status: ProviderDocumentStatus.APPROVED,
    deletedAt: null,
  };
}

function providerCancelledBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    status: BookingStatus.CANCELLED,
    selectedProviderId: 'partner-1',
    address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
    addressSnapshot: null,
    payment: null,
    services: [],
    participants: [],
    preferredProvider: null,
    selectedProvider: approvedPartner(),
    chatRoom: { id: 'chat-room-1' },
    customerProfile: { id: 'customer-1', userId: 'customer-user-1' },
    ...overrides,
  };
}

function massageService() {
  return {
    id: 'service-1',
    name: 'Swedish Massage',
    description: null,
    durationMin: 60,
    basePrice: 500000,
    priceStep: 100000,
    active: true,
    publicationStatus: 'PUBLISHED',
  };
}

function servicePayoutRule() {
  return {
    id: 'rule-1',
    customerPrice: 500000,
    providerPayoutAmount: 350000,
    vatBps: 0,
    otherCostAmount: 0,
    currency: 'VND',
  };
}

function matchedBookingWithAddressSnapshot() {
  return {
    id: 'booking-1',
    customerProfileId: 'customer-1',
    status: BookingStatus.MATCHED,
    scheduledStartAt: new Date('2026-06-01T00:00:00.000Z'),
    scheduledEndAt: new Date('2026-06-01T01:00:00.000Z'),
    address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
    lat: 10.7769,
    lng: 106.7009,
    addressSnapshot: {
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      latitude: 10.7769,
      longitude: 106.7009,
    },
    preferredProviderId: 'partner-1',
    selectedProviderId: 'partner-1',
    chatRoom: { id: 'chat-room-1' },
    preferredProvider: approvedPartner(),
    selectedProvider: approvedPartner(),
    payment: {
      id: 'payment-1',
      bookingId: 'booking-1',
      method: PaymentMethod.CASH,
      amount: 500000,
      currency: 'VND',
      status: PaymentStatus.AUTHORIZED,
    },
  };
}

function completedBookingWithAddressSnapshot() {
  return {
    ...matchedBookingWithAddressSnapshot(),
    status: BookingStatus.COMPLETED,
    payment: {
      id: 'payment-1',
      bookingId: 'booking-1',
      method: PaymentMethod.CASH,
      amount: 500000,
      currency: 'VND',
      status: PaymentStatus.CAPTURED,
    },
  };
}

function cancelledBookingWithAddressSnapshot() {
  return {
    ...matchedBookingWithAddressSnapshot(),
    status: BookingStatus.CANCELLED,
    selectedProviderId: null,
    selectedProvider: null,
    participants: [],
    chatRoom: null,
    payment: {
      id: 'payment-1',
      bookingId: 'booking-1',
      method: PaymentMethod.CASH,
      amount: 500000,
      currency: 'VND',
      status: PaymentStatus.RELEASED,
    },
  };
}

function openMarketplaceBooking() {
  return {
    id: 'booking-1',
    status: BookingStatus.OPEN_MATCHING,
    preferredProviderId: 'first-pick-partner',
    openedAt: new Date(Date.now() - 20 * 60_000),
    expiresAt: new Date(Date.now() + 10 * 60_000),
    lat: 10.7769,
    lng: 106.7009,
    addressSnapshot: { latitude: 10.7769, longitude: 106.7009 },
    participants: [
      {
        providerProfileId: 'first-pick-partner',
        status: ParticipantStatus.REJECTED,
      },
    ],
  };
}

function openFirstPickBooking() {
  return {
    ...openMarketplaceBooking(),
    preferredProviderId: 'partner-1',
    participants: [],
  };
}

function walletBookingCreateInput() {
  return {
    idempotencyKey: 'booking-request-wallet-1',
    addressPayload: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
    addressText: 'District 1, Ho Chi Minh City, Vietnam',
    bookingGateSnapshot: {},
    bookingLat: 10.7769,
    bookingLng: 106.7009,
    customerPrice: 500_000,
    customerProfileId: 'customer-1',
    matchingPolicy: matchingPolicy(),
    paymentMethod: PaymentMethod.CUSTOMER_WALLET,
    preferredProviderDistanceMeters: null,
    payoutRule: servicePayoutRule(),
    priceSummary: { finalAmount: 500_000, paymentMetadata: {} },
    requiresPostBookingAuthorization: true,
    serviceId: 'service-1',
    timing: {
      expiresAt: new Date('2026-07-14T06:10:00.000Z'),
      openedAt: new Date('2026-07-14T06:00:00.000Z'),
      scheduledEndAt: new Date('2026-07-14T07:00:00.000Z'),
      scheduledStartAt: new Date('2026-07-14T06:00:00.000Z'),
    },
  };
}

function matchingPolicy() {
  return {
    providerResponseWindowMinutes: 10,
    backupProviderRadiusMeters: 10000,
    backupProviderLocationMaxAgeMinutes: 30,
    backupProviderInvitationLimit: DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
    bookingMaxCustomerCurrentToAddressKm: 50,
    bookingMaxPreferredProviderDistanceKm: 10,
    bookingCurrentLocationFreshnessMinutes: 30,
    bookingDistanceGateEnabled: true,
    bookingServiceAreaRequired: true,
    preferredAcceptMode: 'CUSTOMER_CONFIRM',
    backupOpenMode: 'IMMEDIATE',
    travelBufferMinutes: 30,
  };
}

function attachTransaction<T extends Record<string, unknown>>(client: T) {
  if (!('$queryRaw' in client)) {
    Object.assign(client, { $queryRaw: vi.fn().mockResolvedValue([]) });
  }
  const transaction = vi.fn(async (callback: (transactionClient: T) => Promise<unknown>) => callback(client));
  Object.assign(client, { $transaction: transaction });
  return transaction;
}

describe('BookingsService backup notification evidence concurrency', () => {
  it('re-reads booking metadata after a lost conditional update instead of dropping another trace', async () => {
    const existingTrace = { stage: 'initial_open', createdAt: '2026-08-16T06:00:00.000Z' };
    const nextTrace = { stage: 'first_pick_declined', createdAt: '2026-08-16T06:01:00.000Z' };
    const prisma = {
      booking: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ metadata: {}, updatedAt: new Date('2026-08-16T06:00:00.000Z') })
          .mockResolvedValueOnce({
            metadata: { backupNotificationTraces: [existingTrace] },
            updatedAt: new Date('2026-08-16T06:00:01.000Z'),
          }),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }),
      },
    };
    const service = new BookingsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ) as unknown as {
      recordBackupNotificationTrace(bookingId: string, trace: unknown): Promise<void>;
    };

    await expect(service.recordBackupNotificationTrace('booking-1', nextTrace)).resolves.toBeUndefined();

    expect(prisma.booking.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.booking.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'booking-1',
        updatedAt: new Date('2026-08-16T06:00:01.000Z'),
      },
      data: {
        metadata: expect.objectContaining({
          backupNotificationTraces: [existingTrace, nextTrace],
        }),
      },
    });
  });
});
