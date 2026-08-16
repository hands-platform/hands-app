import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';
import {
  providerLastAppActivityAt,
  resolveProviderAvailability,
} from '../providers/provider-availability';

export const REQUIRED_BOOKING_DOCUMENT_TYPES = [
  ProviderDocumentType.CCCD_FRONT,
  ProviderDocumentType.CCCD_BACK,
  ProviderDocumentType.SELFIE,
];

export const PROVIDER_ACTIVE_WORK_STATUS_VALUES = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
] as const;

const PROVIDER_ACTIVE_WORK_STATUSES = new Set<BookingStatus>(PROVIDER_ACTIVE_WORK_STATUS_VALUES);

type ProviderBookingIdentityReadiness = {
  blockedAt: Date | null;
  blockedReason: string | null;
  verification?: { status: VerificationStatus } | null;
  kyc?: { status: ProviderKycStatus } | null;
  documents?: Array<{
    type: ProviderDocumentType;
    status: ProviderDocumentStatus;
    deletedAt?: Date | null;
  }>;
};

export function assertProviderCanViewOpenBookingMarketplace(
  provider: ProviderBookingIdentityReadiness,
) {
  assertProviderBookingAccessNotBlocked(provider);
  assertProviderBookingIdentityReady(provider);
}

export function assertProviderCanReceiveBooking(provider: {
  blockedAt: Date | null;
  blockedReason: string | null;
  status: ProviderStatus;
  availabilityChangedAt?: Date;
  availabilityIntent?: ProviderAvailabilityIntent;
  availabilityReason?: ProviderAvailabilityReason;
  workingHoursTimezone?: string | null;
  workingHours?: Array<{
    weekday: number;
    enabled: boolean;
    startMinute: number;
    endMinute: number;
  }>;
  currentLocationUpdatedAt?: Date | null;
  sessions?: Array<{ lastSeenAt: Date }>;
  user?: {
    createdAt?: Date;
    appSessions?: Array<{ lastSeenAt: Date }>;
    appUsageDailyAggregates?: Array<{ lastOccurredAt: Date }>;
  };
  selectedBookings?: Array<{
    id?: string;
    status: BookingStatus;
  }>;
  verification?: { status: VerificationStatus } | null;
  kyc?: { status: ProviderKycStatus } | null;
  documents?: Array<{
    type: ProviderDocumentType;
    status: ProviderDocumentStatus;
    deletedAt?: Date | null;
  }>;
  bankAccounts?: Array<{
    status: string;
    deletedAt?: Date | null;
  }>;
}, now = new Date()) {
  assertProviderBookingAccessNotBlocked(provider);
  if (provider.availabilityIntent) {
    const availability = resolveProviderAvailability({
      availabilityIntent: provider.availabilityIntent,
      lastAppActivityAt: providerLastAppActivityAt({
        appSessionLastSeenAt: provider.user?.appSessions?.[0]?.lastSeenAt,
        currentLocationUpdatedAt: provider.currentLocationUpdatedAt,
        explicitAvailabilityChangedAt:
          provider.availabilityReason === ProviderAvailabilityReason.MANUAL_AVAILABLE ||
          provider.availabilityReason === ProviderAvailabilityReason.MANUAL_OFFLINE
            ? provider.availabilityChangedAt
            : null,
        providerSessionLastSeenAt: provider.sessions?.[0]?.lastSeenAt,
        usageLastOccurredAt: provider.user?.appUsageDailyAggregates?.[0]?.lastOccurredAt,
        userCreatedAt: provider.user?.createdAt,
      }),
      now,
      timezone: provider.workingHoursTimezone,
      workingHours: provider.workingHours,
    });
    if (availability.availabilityReason === ProviderAvailabilityReason.INACTIVE_7D) {
      throw new BadRequestException('Partner must reopen the app after 7 days of inactivity');
    }
    if (availability.availabilityReason === ProviderAvailabilityReason.MANUAL_OFFLINE) {
      throw new BadRequestException('Partner is manually offline');
    }
    if (availability.availabilityReason === ProviderAvailabilityReason.OUTSIDE_WORKING_HOURS) {
      throw new BadRequestException('Partner is outside saved working hours');
    }
  }
  if (provider.status === ProviderStatus.OFFLINE) {
    throw new BadRequestException('Partner must be online before receiving bookings');
  }
  if (providerHasActiveSelectedBooking(provider)) {
    throw new BadRequestException(
      'Partner must complete the current booking before receiving or joining another booking',
    );
  }
  assertProviderBookingIdentityReady(provider);
}

function assertProviderBookingAccessNotBlocked(provider: ProviderBookingIdentityReadiness) {
  if (!provider.blockedAt) return;
  throw new BadRequestException(
    provider.blockedReason
      ? `Partner account is blocked by admin review: ${provider.blockedReason}`
      : 'Partner account is blocked by admin review.',
  );
}

function assertProviderBookingIdentityReady(provider: ProviderBookingIdentityReadiness) {
  if (provider.verification?.status !== VerificationStatus.APPROVED) {
    throw new BadRequestException('Partner verification must be approved before receiving bookings');
  }
  if (provider.kyc?.status !== ProviderKycStatus.APPROVED) {
    throw new BadRequestException('Partner KYC must be approved before receiving bookings');
  }

  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === ProviderDocumentStatus.APPROVED && !document.deletedAt)
      .map((document) => document.type),
  );
  const missingDocuments = REQUIRED_BOOKING_DOCUMENT_TYPES.filter((type) => !approvedDocuments.has(type));
  if (missingDocuments.length > 0) {
    throw new BadRequestException(
      `Partner required KYC documents must be approved before receiving bookings: ${missingDocuments.join(', ')}`,
    );
  }
}

export function providerHasActiveSelectedBooking(provider: {
  selectedBookings?: Array<{ status: BookingStatus }>;
}) {
  return Boolean(
    provider.selectedBookings?.some((booking) => PROVIDER_ACTIVE_WORK_STATUSES.has(booking.status)),
  );
}

export function assertProviderOffersRequestedService(input: {
  providerService?: { active: boolean } | null;
  configuredServiceCount: number;
}) {
  if (input.providerService && !input.providerService.active) {
    throw new BadRequestException('Partner does not offer this service');
  }
  if (!input.providerService && input.configuredServiceCount > 0) {
    throw new BadRequestException('Partner does not offer this service');
  }
}
