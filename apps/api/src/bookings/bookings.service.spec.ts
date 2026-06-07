import {
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';

import { PROVIDER_WALLET_BLOCK_CODE } from '../provider-wallet/provider-wallet.policy';
import { DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT } from '../matching/matching.policy';
import { BookingsService } from './bookings.service';

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
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      massageService: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(massageService()),
      },
      servicePayoutRule: {
        findFirst: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      },
      booking: {
        create: jest.fn().mockResolvedValue(booking),
        findUnique: jest.fn().mockResolvedValue({ metadata: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
      providerProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const matching = {
      getPolicy: jest.fn().mockResolvedValue(matchingPolicy()),
      openBooking: jest.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.opened' }),
      registerActiveBooking: jest.fn(),
      scheduleBookingTimeout: jest.fn(),
    };
    const matchingGateway = {
      emitBookingOpened: jest.fn(),
      emitBackupBookingAvailable: jest.fn(),
    };
    const payments = {
      buildAuthorization: jest.fn().mockReturnValue({ method: PaymentMethod.CASH, amount: 500000 }),
      refreshAuthorizationForBooking: jest.fn().mockResolvedValue(booking.payment),
      scheduleStatusCheck: jest.fn(),
    };
    const notifications = { create: jest.fn() };
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
        include: expect.objectContaining({
          addressSnapshot: true,
        }),
      }),
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
      }),
    );
  });
});

describe('BookingsService final partner selection', () => {
  it('loads the immutable address snapshot before emitting the matched booking', async () => {
    const matchedBooking = matchedBookingWithAddressSnapshot();
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'partner-1',
        }),
        update: jest.fn().mockResolvedValue(matchedBooking),
      },
      bookingParticipant: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
          status: ParticipantStatus.ACCEPTED,
        }),
      },
      providerEarning: {
        aggregate: jest.fn(),
      },
    };
    const matching = {
      closeBooking: jest.fn(),
      selectFinalProvider: jest.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'booking.matched',
        booking: matchedBooking,
      }),
    };
    const matchingGateway = { emitBookingMatched: jest.fn() };
    const notifications = { create: jest.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await service.selectProvider('booking-1', 'customer-user-1', 'partner-1');

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
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        update: jest.fn().mockResolvedValue(matchedBooking),
      },
      bookingParticipant: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'marketplace-partner',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
      },
    };
    const matching = {
      closeBooking: jest.fn(),
      selectFinalProvider: jest.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'booking.matched',
        booking: matchedBooking,
      }),
    };
    const matchingGateway = { emitBookingMatched: jest.fn() };
    const notifications = { create: jest.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );

    await expect(service.selectProvider('booking-1', 'customer-user-1', 'marketplace-partner')).resolves.toEqual(
      expect.objectContaining({
        bookingId: 'booking-1',
        event: 'booking.matched',
      }),
    );

    expect(prisma.providerEarning.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'marketplace-partner',
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.MATCHED,
          selectedProviderId: 'marketplace-partner',
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

  it('blocks customer final selection for a preferred first-pick partner until that partner accepts', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        update: jest.fn(),
      },
      bookingParticipant: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'first-pick-partner',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerEarning: {
        aggregate: jest.fn(),
      },
    };
    const matching = {
      closeBooking: jest.fn(),
      selectFinalProvider: jest.fn(),
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

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(matching.selectFinalProvider).not.toHaveBeenCalled();
  });

  it('blocks customer final selection when a marketplace partner wallet becomes negative', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'first-pick-partner',
        }),
        update: jest.fn(),
      },
      bookingParticipant: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: 'booking-1',
          providerProfileId: 'marketplace-partner',
          status: ParticipantStatus.JOINED,
        }),
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: -70000 } }),
      },
    };
    const matching = {
      closeBooking: jest.fn(),
      selectFinalProvider: jest.fn(),
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
      service.selectProvider('booking-1', 'customer-user-1', 'marketplace-partner'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: PROVIDER_WALLET_BLOCK_CODE,
        marketplaceJoinBlocked: true,
        marketplaceVisibilityBlocked: false,
      }),
    });

    expect(prisma.providerEarning.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'marketplace-partner',
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(matching.selectFinalProvider).not.toHaveBeenCalled();
  });
});

describe('BookingsService service completion', () => {
  it('loads the immutable address snapshot before emitting the completed booking', async () => {
    const completedBooking = completedBookingWithAddressSnapshot();
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            selectedProviderId: 'partner-1',
            status: BookingStatus.IN_SERVICE,
          })
          .mockResolvedValueOnce({
            customerProfile: { userId: 'customer-user-1' },
          }),
        update: jest.fn().mockResolvedValue(completedBooking),
        count: jest.fn().mockResolvedValue(2),
      },
    };
    const matching = {
      completeBooking: jest.fn().mockReturnValue({
        bookingId: 'booking-1',
        event: 'service.completed',
        booking: completedBooking,
      }),
    };
    const matchingGateway = { emitServiceCompleted: jest.fn() };
    const notifications = { create: jest.fn() };
    const earnings = { createForCompletedBooking: jest.fn() };
    const service = new BookingsService(
      prisma as never,
      matching as never,
      matchingGateway as never,
      {} as never,
      notifications as never,
      earnings as never,
    );

    await service.complete('booking-1', 'partner-user-1');

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
  });
});

describe('BookingsService customer cancellation', () => {
  it('loads the immutable address snapshot before returning a cancelled booking', async () => {
    const cancelledBooking = cancelledBookingWithAddressSnapshot();
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1', userId: 'customer-user-1' }),
      },
      booking: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          preferredProvider: null,
          selectedProvider: null,
          participants: [],
          payment: { id: 'payment-1' },
        }),
        update: jest.fn().mockResolvedValue(cancelledBooking),
      },
    };
    const matching = { closeBooking: jest.fn() };
    const matchingGateway = { emitBookingExpired: jest.fn() };
    const payments = {
      release: jest.fn().mockResolvedValue(cancelledBooking.payment),
    };
    const notifications = { create: jest.fn() };
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
  it('blocks a negative-wallet partner before creating a marketplace participant', async () => {
    const bookingParticipantUpsert = jest.fn();
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(openMarketplaceBooking()),
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: -120000 } }),
      },
      bookingParticipant: {
        upsert: bookingParticipantUpsert,
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

    await expect(service.joinBooking('booking-1', 'partner-user-1')).rejects.toMatchObject({
      response: expect.objectContaining({
        code: PROVIDER_WALLET_BLOCK_CODE,
        marketplaceJoinBlocked: true,
        marketplaceVisibilityBlocked: false,
        directFirstPickBlocked: false,
      }),
    });

    expect(prisma.providerEarning.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'partner-1',
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    expect(bookingParticipantUpsert).not.toHaveBeenCalled();
  });

  it('does not apply the marketplace wallet gate to the preferred first-pick partner', async () => {
    const bookingParticipantUpsert = jest.fn().mockResolvedValue({
      id: 'participant-1',
      bookingId: 'booking-1',
      providerProfileId: 'partner-1',
      status: ParticipantStatus.JOINED,
      distanceMeters: 0,
      providerProfile: approvedPartner(),
    });
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce(openFirstPickBooking())
          .mockResolvedValueOnce({ customerProfile: { userId: 'customer-user-1' } }),
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: -120000 } }),
      },
      bookingParticipant: {
        upsert: bookingParticipantUpsert,
      },
    };
    const matching = {
      getPolicy: jest.fn().mockResolvedValue(matchingPolicy()),
      registerParticipant: jest.fn(),
      joinBooking: jest.fn().mockReturnValue({ bookingId: 'booking-1', event: 'provider.joined' }),
    };
    const notifications = { create: jest.fn() };
    const matchingGateway = { emitProviderJoined: jest.fn() };
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
    const bookingParticipantUpsert = jest.fn();
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(
          approvedPartner({
            currentLat: 10.0,
            currentLng: 106.0,
          }),
        ),
      },
      booking: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(openMarketplaceBooking()),
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: 0 } }),
      },
      bookingParticipant: {
        upsert: bookingParticipantUpsert,
      },
    };
    const matching = {
      getPolicy: jest.fn().mockResolvedValue(matchingPolicy()),
      registerParticipant: jest.fn(),
      joinBooking: jest.fn(),
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

    expect(prisma.providerEarning.aggregate).toHaveBeenCalled();
    expect(bookingParticipantUpsert).not.toHaveBeenCalled();
    expect(matching.registerParticipant).not.toHaveBeenCalled();
  });
});

describe('BookingsService partner response wallet gates', () => {
  it('blocks a marketplace partner with a negative wallet before accepting the request', async () => {
    const bookingParticipantUpdate = jest.fn();
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...openMarketplaceBooking(),
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: null,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
      },
      bookingParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
        update: bookingParticipantUpdate,
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: -90000 } }),
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
        marketplaceJoinBlocked: true,
        marketplaceVisibilityBlocked: false,
      }),
    });

    expect(prisma.providerEarning.aggregate).toHaveBeenCalledWith({
      where: {
        providerProfileId: 'partner-1',
        status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE] },
        payoutBatchId: null,
      },
      _sum: { netAmount: true },
    });
    expect(bookingParticipantUpdate).not.toHaveBeenCalled();
  });

  it('does not apply the marketplace wallet gate to the preferred first-pick acceptance', async () => {
    const bookingParticipantUpdate = jest.fn();
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(approvedPartner()),
      },
      booking: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: approvedPartner(),
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
        update: jest.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          participants: [{ providerProfileId: 'partner-1', status: ParticipantStatus.ACCEPTED }],
          preferredProvider: approvedPartner(),
          selectedProvider: null,
          chatRoom: null,
        }),
      },
      bookingParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
        update: bookingParticipantUpdate,
      },
      providerEarning: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { netAmount: -90000 } }),
      },
    };
    const notifications = { create: jest.fn() };
    const matchingGateway = { emitProviderAccepted: jest.fn() };
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
    ).resolves.toEqual(
      expect.objectContaining({
        participants: [expect.objectContaining({ status: ParticipantStatus.ACCEPTED })],
      }),
    );

    expect(prisma.providerEarning.aggregate).not.toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalled();
    expect(bookingParticipantUpdate).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'provider.accepted',
        data: { bookingId: 'booking-1', providerProfileId: 'partner-1' },
      }),
    );
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
      lat: 13.7563,
      lng: 100.5018,
      addressSnapshot: {
        latitude: 10.7769,
        longitude: 106.7009,
      },
    };
    const bookingParticipantUpdate = jest.fn();
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(firstPickPartner),
        findMany: jest.fn().mockResolvedValue([nearbyBackupPartner]),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({ metadata: {} }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...openFirstPickBooking(),
          ...staleMutableCoordinates,
          customerProfile: { userId: 'customer-user-1' },
          preferredProvider: firstPickPartner,
          selectedProvider: null,
          chatRoom: null,
          services: [{ serviceId: 'service-1' }],
        }),
        update: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-1' }),
        update: bookingParticipantUpdate,
      },
    };
    const matching = {
      closeBooking: jest.fn(),
      getPolicy: jest.fn().mockResolvedValue(matchingPolicy()),
      openBooking: jest.fn().mockReturnValue({ bookingId: 'booking-1', event: 'booking.opened' }),
      registerActiveBooking: jest.fn(),
      scheduleBookingTimeout: jest.fn(),
    };
    const matchingGateway = { emitBackupBookingAvailable: jest.fn() };
    const notifications = { create: jest.fn().mockResolvedValue({ id: 'notification-1' }) };
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
