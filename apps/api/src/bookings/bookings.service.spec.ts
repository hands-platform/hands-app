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
