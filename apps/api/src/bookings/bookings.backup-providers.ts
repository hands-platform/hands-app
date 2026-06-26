import {
  ParticipantStatus,
  Prisma,
  ProviderDocumentStatus,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';
import { calculateDistanceMeters } from './bookings.policy';
import { REQUIRED_BOOKING_DOCUMENT_TYPES } from './bookings.provider-readiness';

export type BackupProviderDistanceCandidate = {
  id: string;
  currentLat: unknown;
  currentLng: unknown;
};

export function backupProviderCandidateWhere(input: {
  bookingId: string;
  serviceId: string;
  preferredProviderId?: string;
  freshLocationAfter: Date;
}): Prisma.ProviderProfileWhereInput {
  return {
    ...(input.preferredProviderId ? { id: { not: input.preferredProviderId } } : {}),
    status: { in: [ProviderStatus.ONLINE_AVAILABLE, ProviderStatus.ONLINE_AVAILABLE_SOON] },
    blockedAt: null,
    currentLat: { not: null },
    currentLng: { not: null },
    currentLocationUpdatedAt: { gte: input.freshLocationAfter },
    verification: { status: VerificationStatus.APPROVED },
    kyc: { status: ProviderKycStatus.APPROVED },
    AND: REQUIRED_BOOKING_DOCUMENT_TYPES.map((type) => ({
      documents: {
        some: {
          type,
          status: ProviderDocumentStatus.APPROVED,
          deletedAt: null,
        },
      },
    })),
    participants: {
      none: {
        bookingId: input.bookingId,
        status: ParticipantStatus.REJECTED,
      },
    },
    OR: [
      { services: { none: {} } },
      {
        services: {
          some: {
            serviceId: input.serviceId,
            active: true,
            service: { active: true },
          },
        },
      },
    ],
  };
}

export function backupProvidersWithinRadius<T extends BackupProviderDistanceCandidate>(
  providers: T[],
  input: { lat: number; lng: number; radiusMeters: number },
) {
  return providers
    .map((provider) => ({
      ...provider,
      distanceMeters: calculateDistanceMeters(input.lat, input.lng, provider.currentLat, provider.currentLng),
    }))
    .filter(
      (provider): provider is T & { distanceMeters: number } =>
        provider.distanceMeters !== null && provider.distanceMeters <= input.radiusMeters,
    );
}

export function nearestBackupProviders<T extends { distanceMeters: number }>(
  providers: T[],
  invitationLimit: number,
) {
  return [...providers].sort((left, right) => left.distanceMeters - right.distanceMeters).slice(0, invitationLimit);
}
