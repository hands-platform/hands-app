import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  ProviderAvailabilityIntent,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';
import {
  assertProviderCanReceiveBooking,
  assertProviderOffersRequestedService,
  REQUIRED_BOOKING_DOCUMENT_TYPES,
} from './bookings.provider-readiness';

describe('booking provider readiness helpers', () => {
  it('keeps the required booking document set explicit', () => {
    expect(REQUIRED_BOOKING_DOCUMENT_TYPES).toEqual([
      ProviderDocumentType.CCCD_FRONT,
      ProviderDocumentType.CCCD_BACK,
      ProviderDocumentType.SELFIE,
    ]);
  });

  it('accepts a partner with approved verification, KYC, and required documents', () => {
    expect(() => assertProviderCanReceiveBooking(readyProvider())).not.toThrow();
  });

  it('rejects blocked partners with the admin reason when present', () => {
    expect(() =>
      assertProviderCanReceiveBooking(
        readyProvider({
          blockedAt: new Date('2026-06-11T00:00:00.000Z'),
          blockedReason: 'manual review',
        }),
      ),
    ).toThrow(new BadRequestException('Partner account is blocked by admin review: manual review'));
  });

  it('rejects partners that are offline or not fully approved', () => {
    expect(() =>
      assertProviderCanReceiveBooking(readyProvider({ status: ProviderStatus.OFFLINE })),
    ).toThrow(new BadRequestException('Partner must be online before receiving bookings'));

    expect(() =>
      assertProviderCanReceiveBooking(
        readyProvider({ verification: { status: VerificationStatus.SUBMITTED } }),
      ),
    ).toThrow(new BadRequestException('Partner verification must be approved before receiving bookings'));

    expect(() =>
      assertProviderCanReceiveBooking(readyProvider({ kyc: { status: ProviderKycStatus.PENDING } })),
    ).toThrow(new BadRequestException('Partner KYC must be approved before receiving bookings'));
  });

  it('rejects a never-tracked available Partner after seven days', () => {
    expect(() =>
      assertProviderCanReceiveBooking(
        readyProvider({
          availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
          currentLocationUpdatedAt: null,
          sessions: [],
          user: {
            appSessions: [],
            appUsageDailyAggregates: [],
            createdAt: new Date('2026-07-13T03:00:00.000Z'),
          },
        }),
        new Date('2026-07-20T03:00:00.000Z'),
      ),
    ).toThrow(new BadRequestException('Partner must reopen the app after 7 days of inactivity'));
  });

  it('rejects partners with unfinished selected work but ignores closed cancellations', () => {
    expect(() =>
      assertProviderCanReceiveBooking(
        readyProvider({
          selectedBookings: [{ id: 'booking-active', status: BookingStatus.IN_SERVICE }],
        }),
      ),
    ).toThrow(
      new BadRequestException(
        'Partner must complete the current booking before receiving or joining another booking',
      ),
    );

    expect(() =>
      assertProviderCanReceiveBooking(
        readyProvider({
          selectedBookings: [{ id: 'booking-cancelled', status: BookingStatus.CANCELLED }],
        }),
      ),
    ).not.toThrow();
  });

  it('rejects missing booking documents', () => {
    expect(() =>
      assertProviderCanReceiveBooking(
        readyProvider({
          documents: [
            {
              type: ProviderDocumentType.CCCD_FRONT,
              status: ProviderDocumentStatus.APPROVED,
              deletedAt: null,
            },
          ],
        }),
      ),
    ).toThrow(
      new BadRequestException(
        'Partner required KYC documents must be approved before receiving bookings: CCCD_BACK, SELFIE',
      ),
    );
  });

  it('accepts active requested services and partners without explicit service rows', () => {
    expect(() =>
      assertProviderOffersRequestedService({
        providerService: { active: true },
        configuredServiceCount: 1,
      }),
    ).not.toThrow();
    expect(() =>
      assertProviderOffersRequestedService({
        providerService: null,
        configuredServiceCount: 0,
      }),
    ).not.toThrow();
  });

  it('rejects inactive requested services or missing services after service rows are configured', () => {
    expect(() =>
      assertProviderOffersRequestedService({
        providerService: { active: false },
        configuredServiceCount: 1,
      }),
    ).toThrow(new BadRequestException('Partner does not offer this service'));
    expect(() =>
      assertProviderOffersRequestedService({
        providerService: null,
        configuredServiceCount: 1,
      }),
    ).toThrow(new BadRequestException('Partner does not offer this service'));
  });
});

function readyProvider(
  overrides: Partial<Parameters<typeof assertProviderCanReceiveBooking>[0]> = {},
): Parameters<typeof assertProviderCanReceiveBooking>[0] {
  return {
    blockedAt: null,
    blockedReason: null,
    status: ProviderStatus.ONLINE_AVAILABLE,
    verification: { status: VerificationStatus.APPROVED },
    kyc: { status: ProviderKycStatus.APPROVED },
    documents: REQUIRED_BOOKING_DOCUMENT_TYPES.map((type) => ({
      type,
      status: ProviderDocumentStatus.APPROVED,
      deletedAt: null,
    })),
    bankAccounts: [],
    ...overrides,
  };
}
