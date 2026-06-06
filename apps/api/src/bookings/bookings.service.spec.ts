import {
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  ProviderBankAccountStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';

import { PROVIDER_WALLET_BLOCK_CODE } from '../provider-wallet/provider-wallet.policy';
import { BookingsService } from './bookings.service';

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
});

function approvedPartner() {
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
  };
}

function approvedDocument(type: ProviderDocumentType) {
  return {
    type,
    status: ProviderDocumentStatus.APPROVED,
    deletedAt: null,
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
    backupProviderInvitationLimit: 20,
    backupOpenMode: 'IMMEDIATE',
  };
}
