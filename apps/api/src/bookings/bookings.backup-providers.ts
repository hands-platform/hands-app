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
import { providerBookingAlertMatches } from './bookings.alert-preferences';

export type BackupProviderDistanceCandidate = {
  id: string;
  currentLat: unknown;
  currentLng: unknown;
};

export type BackupProviderDispatchCandidate = BackupProviderDistanceCandidate & {
  bookingAlertPreferences: unknown;
};

export type BackupProviderWalletTotal = {
  providerProfileId: string;
  _sum: { amount: unknown };
};

type BackupProviderCandidateWhereInput = {
  bookingId: string;
  serviceId: string;
  preferredProviderId?: string;
  freshLocationAfter: Date;
};

export function backupProviderCandidateStageWheres(
  input: BackupProviderCandidateWhereInput,
): {
  onlineAvailable: Prisma.ProviderProfileWhereInput;
  accountAvailable: Prisma.ProviderProfileWhereInput;
  identityReady: Prisma.ProviderProfileWhereInput;
  serviceReady: Prisma.ProviderProfileWhereInput;
  freshLocation: Prisma.ProviderProfileWhereInput;
} {
  const onlineAvailable = {
    status: { in: [ProviderStatus.ONLINE_AVAILABLE, ProviderStatus.ONLINE_AVAILABLE_SOON] },
  } satisfies Prisma.ProviderProfileWhereInput;
  const accountAvailable = {
    ...onlineAvailable,
    ...(input.preferredProviderId ? { id: { not: input.preferredProviderId } } : {}),
    blockedAt: null,
  } satisfies Prisma.ProviderProfileWhereInput;
  const identityReady = {
    ...accountAvailable,
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
  } satisfies Prisma.ProviderProfileWhereInput;
  const serviceReady = {
    ...identityReady,
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
  } satisfies Prisma.ProviderProfileWhereInput;
  const freshLocation = {
    ...serviceReady,
    currentLat: { not: null },
    currentLng: { not: null },
    currentLocationUpdatedAt: { gte: input.freshLocationAfter },
  } satisfies Prisma.ProviderProfileWhereInput;

  return { accountAvailable, freshLocation, identityReady, onlineAvailable, serviceReady };
}

export function backupProviderCandidateWhere(
  input: BackupProviderCandidateWhereInput,
): Prisma.ProviderProfileWhereInput {
  return backupProviderCandidateStageWheres(input).freshLocation;
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
  providers: readonly T[],
  invitationLimit: number,
) {
  return [...providers].sort((left, right) => left.distanceMeters - right.distanceMeters).slice(0, invitationLimit);
}

export function backupProvidersMatchingBookingAlerts<T extends BackupProviderDispatchCandidate & { distanceMeters: number }>(
  providers: T[],
  input: {
    serviceId: string;
    customerGender?: string | null;
    customerNationality?: string | null;
  },
) {
  return providers.filter((provider) =>
    providerBookingAlertMatches(provider.bookingAlertPreferences, {
      distanceMeters: provider.distanceMeters,
      serviceId: input.serviceId,
      customerGender: input.customerGender,
      customerNationality: input.customerNationality,
    }),
  );
}

export function backupProvidersWithClearWallets<T extends { id: string }>(
  providers: readonly T[],
  walletTotals: readonly BackupProviderWalletTotal[],
) {
  const blockedProviderIds = new Set(
    walletTotals
      .filter((row) => Number(row._sum.amount ?? 0) < 0)
      .map((row) => row.providerProfileId),
  );
  return providers.filter((provider) => !blockedProviderIds.has(provider.id));
}

export function resolveBackupProviderDispatchCandidates<
  T extends BackupProviderDispatchCandidate,
>(
  providers: T[],
  input: {
    lat: number;
    lng: number;
    radiusMeters: number;
    serviceId: string;
    customerGender?: string | null;
    customerNationality?: string | null;
  },
) {
  const withinRadius = backupProvidersWithinRadius(providers, input);
  const matchingAlerts = backupProvidersMatchingBookingAlerts(withinRadius, input);
  return { matchingAlerts, withinRadius };
}

export function finalizeBackupProviderDispatchCandidates<T extends { id: string; distanceMeters: number }>(
  providers: readonly T[],
  walletTotals: readonly BackupProviderWalletTotal[],
  invitationLimit: number,
): { finalGateReady: T[]; invited: T[] } {
  const finalGateReady = backupProvidersWithClearWallets(providers, walletTotals);
  return {
    finalGateReady,
    invited: nearestBackupProviders(finalGateReady, invitationLimit),
  };
}
