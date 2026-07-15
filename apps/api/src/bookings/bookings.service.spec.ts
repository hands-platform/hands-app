import {
  BookingMatchSource,
  BookingOpsTaskStatus,
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';

import { PROVIDER_WALLET_BLOCK_CODE } from '../provider-wallet/provider-wallet.policy';
import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
} from '../matching/matching.policy';
import { BookingsService } from './bookings.service';
import { PROVIDER_ACTIVE_WORK_STATUS_VALUES } from './bookings.provider-readiness';

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
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      massageService: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rule-1' }),
      },
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        update: vi.fn().mockResolvedValue({}),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
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
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: 'booking-1', status: BookingStatus.OPEN_MATCHING });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const payments = {
      buildAuthorization: vi.fn().mockReturnValue({
        amount: 500000,
        method: PaymentMethod.VNPAY,
        providerRef: null,
        status: PaymentStatus.PENDING,
      }),
    };
    const service = new BookingsService(
      { booking: { create, findUniqueOrThrow, updateMany } } as never,
      {} as never,
      {} as never,
      payments as never,
      {} as never,
      {} as never,
    );

    const gatewayFlow = service as unknown as {
      createOpenMatchingBookingRecord(input: Record<string, unknown>): Promise<unknown>;
      openBookingAfterPaymentAuthorization(booking: Record<string, unknown>, required: boolean): Promise<unknown>;
    };
    await gatewayFlow.createOpenMatchingBookingRecord({
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
      gatewayFlow.openBookingAfterPaymentAuthorization({ id: 'booking-1', status: BookingStatus.CREATED }, true),
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
    expect(payments.paymentCanOpenMatching).toHaveBeenCalledWith(
      PaymentMethod.VNPAY,
      PaymentStatus.PENDING,
    );
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
        findUnique: vi.fn().mockResolvedValue(createdBooking),
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
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
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
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-user-1' }),
    );
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
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      massageService: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rule-1' }),
      },
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        update: vi.fn().mockResolvedValue({}),
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
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      massageService: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: vi.fn().mockResolvedValue({ id: 'rule-1' }),
      },
      booking: {
        create: vi.fn().mockResolvedValue(booking),
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        update: vi.fn().mockResolvedValue({}),
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

describe('BookingsService final partner selection', () => {
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
        aggregate: vi.fn(),
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
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await service.selectProvider('booking-1', 'customer-user-1', 'partner-1');

    expect(transaction).toHaveBeenCalled();
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

  it('allows the customer to select a joined marketplace partner when wallet is clear', async () => {
    const adminAuditLogCreate = vi.fn();
    const marketplacePartner = approvedPartner({
      id: 'marketplace-partner',
      userId: 'marketplace-user-1',
      displayName: 'Marketplace Partner',
    });
    const matchedBooking = {
      ...matchedBookingWithAddressSnapshot(),
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
      closeBooking: vi.fn(),
      selectFinalProvider: vi.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'booking.matched',
        booking: matchedBooking,
      }),
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
          status: BookingStatus.MATCHED,
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
    expect(matchingGateway.emitBookingMatched).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ event: 'booking.matched' }),
    );
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
    ).rejects.toThrow('Booking is already matched or no longer open for customer final selection');

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
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
      status: BookingStatus.MATCHED,
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
      },
    };
    const notifications = { create: vi.fn() };
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
      }),
    );
    expect(matchingGateway.emitServiceStarted).toHaveBeenCalledWith('booking-1', startedBooking);
  });

  it('auto-approves partner post-match cancellations inside the 15-minute window', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-01T10:10:00.000Z'));
    const earning = {
      id: 'earning-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      netAmount: -100000,
      currency: 'VND',
      status: EarningStatus.PENDING,
    };
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.MATCHED,
          notes: null,
          matchedAt: new Date('2026-06-01T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          earning,
        }),
        update: vi.fn().mockResolvedValue(providerCancelledBooking()),
      },
      providerEarning: {
        update: vi.fn().mockResolvedValue({ ...earning, status: EarningStatus.CANCELLED, netAmount: 0 }),
      },
      providerWalletLedgerEntry: { upsert: vi.fn() },
      adminAuditLog: { create: vi.fn() },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const matching = { closeBooking: vi.fn() };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    try {
      const result = await service.cancelProviderBooking('booking-1', 'partner-user-1', {
        addressText: '  Lang, Ha Noi  ',
        lat: 10.7769,
        lng: 106.7009,
        note: 'Cancelled from chat',
      });

      expect(result.postMatchCancellation).toMatchObject({
        autoApproved: true,
        adminReviewRequired: false,
        minutesAfterMatch: 10,
      });
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            closedReason: 'post_match_cancellation_approved',
            closedNote: 'Cancelled from chat',
            opsTasks: expect.objectContaining({
              upsert: expect.objectContaining({
                update: expect.objectContaining({ status: BookingOpsTaskStatus.DONE }),
                create: expect.objectContaining({ status: BookingOpsTaskStatus.DONE }),
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
      expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'booking.post_match_cancellation.auto_approve',
          }),
        }),
      );
      expect(prisma.locationSnapshot.create).toHaveBeenCalledWith({
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
      service.cancelProviderBooking('booking-1', 'partner-user-1', { note: 'Cancelled from chat' }),
    ).rejects.toThrow('Partner action location requires both lat and lng');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.locationSnapshot.create).not.toHaveBeenCalled();
  });

  it('queues partner post-match cancellations after 15 minutes for admin review', async () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-01T10:16:00.000Z'));
    const tx = {
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.ARRIVED,
          notes: null,
          matchedAt: new Date('2026-06-01T10:00:00.000Z'),
          selectedProviderId: 'partner-1',
          earning: null,
        }),
        update: vi.fn().mockResolvedValue(providerCancelledBooking()),
      },
      providerEarning: { update: vi.fn() },
      providerWalletLedgerEntry: { upsert: vi.fn() },
      adminAuditLog: { create: vi.fn() },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      $transaction: vi.fn((callback) => callback(tx)),
    };
    const matching = { closeBooking: vi.fn() };
    const matchingGateway = { emitBookingExpired: vi.fn() };
    const notifications = { create: vi.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    try {
      const result = await service.cancelProviderBooking('booking-1', 'partner-user-1', {
        addressText: '  Cau Giay, Ha Noi  ',
        lat: 21.0285,
        lng: 105.8542,
      });

      expect(result.postMatchCancellation).toMatchObject({
        autoApproved: false,
        adminReviewRequired: true,
        minutesAfterMatch: 16,
        earningResult: { skipped: true, reason: 'AWAITING_ADMIN_REVIEW' },
      });
      expect(tx.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.CANCELLED,
            closedReason: 'partner_cancelled',
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
      expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'booking.post_match_cancellation.review_required',
          }),
        }),
      );
      expect(prisma.locationSnapshot.create).toHaveBeenCalledWith({
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
  });
});

describe('BookingsService service completion', () => {
  it('loads the immutable address snapshot before emitting the completed booking', async () => {
    const completedBooking = completedBookingWithAddressSnapshot();
    const prisma = {
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
            customerProfile: { userId: 'customer-user-1' },
          }),
        update: vi.fn().mockResolvedValue(completedBooking),
        count: vi.fn().mockResolvedValue(2),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      payment: {
        findUniqueOrThrow: vi
          .fn()
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
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      earnings as never,
    );

    await service.complete('booking-1', 'partner-user-1', {
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
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
  });

  it('records a booking-linked partner action location before completion when provided', async () => {
    const completedBooking = completedBookingWithAddressSnapshot();
    const prisma = {
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
            customerProfile: { userId: 'customer-user-1' },
          }),
        update: vi.fn().mockResolvedValue(completedBooking),
        count: vi.fn().mockResolvedValue(2),
      },
      locationSnapshot: {
        create: vi.fn().mockResolvedValue({ id: 'snapshot-1' }),
      },
      payment: {
        findUniqueOrThrow: vi
          .fn()
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
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
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
    expect(prisma.booking.update).toHaveBeenCalled();
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
});

describe('BookingsService marketplace participation', () => {
  it('keeps marketplace requests visible for negative-wallet partners while participation stays blocked', async () => {
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
      status: BookingStatus.MATCHED,
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
      expect.objectContaining({ id: 'active-booking', status: BookingStatus.MATCHED }),
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
      expect.objectContaining({ take: 19 }),
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

  it('allows a negative-wallet partner to join before final acceptance', async () => {
    const bookingParticipantUpsert = vi.fn().mockResolvedValue({
      id: 'participant-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      status: ParticipantStatus.JOINED,
      distanceMeters: 0,
      providerProfile: approvedPartner(),
    });
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce(openMarketplaceBooking())
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: -120000 } }),
      },
      bookingParticipant: {
        upsert: bookingParticipantUpsert,
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

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(bookingParticipantUpsert).toHaveBeenCalled();
    expect(matching.registerParticipant).toHaveBeenCalled();
  });

  it('does not apply the marketplace wallet gate to the preferred first-pick partner', async () => {
    const bookingParticipantUpsert = vi.fn().mockResolvedValue({
      id: 'participant-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      status: ParticipantStatus.JOINED,
      distanceMeters: 0,
      providerProfile: approvedPartner(),
    });
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce(openFirstPickBooking())
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
      },
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: -120000 } }),
      },
      bookingParticipant: {
        upsert: bookingParticipantUpsert,
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

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(bookingParticipantUpsert).toHaveBeenCalled();
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
      providerEarning: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
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

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(bookingParticipantUpsert).not.toHaveBeenCalled();
    expect(matching.registerParticipant).not.toHaveBeenCalled();
  });
});

describe('BookingsService partner response wallet gates', () => {
  it('blocks a marketplace partner with a negative wallet before accepting the request', async () => {
    const bookingParticipantUpdate = vi.fn();
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
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-1' }),
        update: bookingParticipantUpdate,
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: -90000 } }),
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
      service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.ACCEPTED),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: PROVIDER_WALLET_BLOCK_CODE,
        marketplaceJoinBlocked: false,
        alreadyMatchedServiceBlocked: true,
        marketplaceVisibilityBlocked: false,
      }),
    });

    expect(prisma.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'partner-1',
      },
      _sum: { amount: true },
    });
    expect(bookingParticipantUpdate).not.toHaveBeenCalled();
  });

  it('matches the booking when the preferred first-pick partner accepts first', async () => {
    const bookingParticipantUpdate = vi.fn();
    const adminAuditLogCreate = vi.fn();
    const matchedBooking = {
      ...openFirstPickBooking(),
      status: BookingStatus.MATCHED,
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
          status: BookingStatus.MATCHED,
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
          },
        }),
      }),
    );
    expect(bookingParticipantUpdate).not.toHaveBeenCalled();
    expect(matching.closeBooking).toHaveBeenCalledWith('booking-1');
    expect(matching.selectFinalProvider).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ status: BookingStatus.MATCHED, selectedProviderId: 'partner-1' }),
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

  it('uses the booking address snapshot when reopening marketplace after first-pick rejection', async () => {
    const firstPickPartner = approvedPartner({ id: 'partner-1' });
    const nearbyBackupPartner = approvedPartner({
      id: 'backup-partner-1',
      userId: 'backup-user-1',
      currentLat: 10.777,
      currentLng: 106.701,
    });
    const staleMutableCoordinates = {
      lat: 0,
      lng: 0,
      addressSnapshot: {
        latitude: 10.7769,
        longitude: 106.7009,
      },
    };
    const bookingParticipantUpdate = vi.fn();
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(firstPickPartner),
        findMany: vi.fn().mockResolvedValue([nearbyBackupPartner]),
      },
      providerWalletLedgerEntry: {
        groupBy: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findUnique: vi.fn().mockResolvedValue({ metadata: {} }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          ...staleMutableCoordinates,
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: firstPickPartner,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
        update: vi.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          ...staleMutableCoordinates,
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: firstPickPartner,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
      },
      bookingParticipant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'participant-1' }),
        update: bookingParticipantUpdate,
      },
    };
    const matching = {
      closeBooking: vi.fn(),
      getPolicy: vi.fn().mockResolvedValue(matchingPolicy()),
      openBooking: vi.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.opened' }),
      registerActiveBooking: vi.fn(),
      scheduleBookingTimeout: vi.fn(),
    };
    const matchingGateway = { emitBackupBookingAvailable: vi.fn() };
    const notifications = { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await service.updateParticipant('booking-1', 'partner-user-1', ParticipantStatus.REJECTED);

    expect(matching.openBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          eligibleBackupProviderCount: 1,
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'backup-user-1',
        type: 'booking.backup_available',
        data: expect.objectContaining({
          distanceMeters: 0,
          marketplaceRadiusMeters: 10000,
          marketplaceOpenMode: 'IMMEDIATE',
          marketplaceInvitationLimit: DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
          backupProviderRadiusMeters: 10000,
          backupOpenMode: 'IMMEDIATE',
          backupProviderInvitationLimit: DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT,
        }),
      }),
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
  const transaction = vi.fn(async (callback: (transactionClient: T) => Promise<unknown>) =>
    callback(client),
  );
  Object.assign(client, { $transaction: transaction });
  return transaction;
}
