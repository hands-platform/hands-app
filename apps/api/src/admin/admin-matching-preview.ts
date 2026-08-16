import { BookingStatus } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';

import {
  backupProviderCandidateStageWheres,
  finalizeBackupProviderDispatchCandidates,
  resolveBackupProviderDispatchCandidates,
} from '../bookings/bookings.backup-providers';
import {
  MATCHING_BACKUP_OPEN_MODE_KEY,
  MATCHING_PREFERRED_ACCEPT_MODE_KEY,
  resolveMatchingPolicy,
} from '../matching/matching.policy';
import type { PrismaService } from '../prisma/prisma.service';

export type AdminMatchingPreviewStatus =
  | 'UNAVAILABLE'
  | 'BLOCKED_NO_REFERENCE'
  | 'DEMO_PREVIEW_ONLY'
  | 'INCOMPLETE_EVIDENCE'
  | 'BLOCKED_NO_ELIGIBLE_SUPPLY'
  | 'READY_WITH_PRODUCTION_EVIDENCE';

export type AdminMatchingPreview = {
  status: AdminMatchingPreviewStatus;
  reference: {
    kind: 'BOOKING' | 'DEMO';
    bookingId: string | null;
    bookingStatus: string | null;
    serviceId: string | null;
    lat: number | null;
    lng: number | null;
    observedAt: string | null;
    label: string;
  };
  checkedAt: string;
  evidence: {
    totalEvaluated: number;
    returnedCandidates: number;
    truncated: false;
    newestAt: string | null;
    oldestAt: string | null;
  };
  stages: Array<{
    code: string;
    label: string;
    passedCount: number;
    excludedCount: number;
    actionHref: string | null;
    actionLabel: string | null;
  }>;
  primaryBlocker: {
    code: string;
    title: string;
    detail: string;
    actionHref: string | null;
    actionLabel: string | null;
  } | null;
  candidates: Array<{
    partnerId: string;
    name: string;
    distanceMeters: number;
    locationUpdatedAt: string;
    stage: 'INVITABLE';
    blockerCodes: string[];
  }>;
  safety: {
    dryRun: true;
    mutationsPerformed: false;
  };
};

const DEMO_REFERENCE = {
  bookingId: null,
  bookingStatus: null,
  kind: 'DEMO' as const,
  label: 'Ho Chi Minh City demo reference',
  lat: 10.7769,
  lng: 106.7009,
  observedAt: null,
  serviceId: null,
};
const CANDIDATE_PREVIEW_LIMIT = 10;

const bookingReferenceSelect = {
  id: true,
  status: true,
  preferredProviderId: true,
  lat: true,
  lng: true,
  openedAt: true,
  createdAt: true,
  expiresAt: true,
  addressSnapshot: {
    select: { createdAt: true, latitude: true, longitude: true },
  },
  customerProfile: {
    select: { gender: true, nationality: true },
  },
  services: {
    orderBy: { id: 'asc' as const },
    take: 1,
    select: { serviceId: true },
  },
};

export async function buildAdminMatchingPreview(
  prisma: PrismaService,
  config: ConfigService,
  referenceBookingId?: string,
): Promise<AdminMatchingPreview> {
  const checkedAt = new Date();
  const requestedBookingId = referenceBookingId?.trim() || null;
  const booking = requestedBookingId
    ? await prisma.booking.findUnique({
        where: { id: requestedBookingId },
        select: bookingReferenceSelect,
      })
    : await prisma.booking.findFirst({
        where: {
          status: BookingStatus.OPEN_MATCHING,
          expiresAt: { gt: checkedAt },
          services: { some: {} },
        },
        orderBy: [{ openedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: bookingReferenceSelect,
      });

  if (!booking) {
    return previewWithoutProductionReference(checkedAt);
  }

  const serviceId = booking.services[0]?.serviceId ?? null;
  const referenceLat = nullableCoordinate(
    booking.addressSnapshot?.latitude ?? booking.lat,
  );
  const referenceLng = nullableCoordinate(
    booking.addressSnapshot?.longitude ?? booking.lng,
  );
  const reference = {
    bookingId: booking.id,
    bookingStatus: booking.status,
    kind: 'BOOKING' as const,
    label: `Booking ${booking.id}`,
    lat: referenceLat,
    lng: referenceLng,
    observedAt: (
      booking.addressSnapshot?.createdAt ?? booking.openedAt ?? booking.createdAt
    ).toISOString(),
    serviceId,
  };
  const actionable =
    booking.status === BookingStatus.OPEN_MATCHING &&
    booking.expiresAt !== null &&
    booking.expiresAt > checkedAt;
  if (!actionable) {
    return blockedReferencePreview(
      checkedAt,
      reference,
      'BLOCKED_NO_REFERENCE',
      'The requested booking is no longer an active matching reference.',
    );
  }
  if (!serviceId || referenceLat === null || referenceLng === null) {
    return blockedReferencePreview(
      checkedAt,
      reference,
      'INCOMPLETE_EVIDENCE',
      'The active booking is missing a requested service or usable dispatch coordinate.',
    );
  }

  const settings = await prisma.operationalPolicySetting.findMany({
    where: {
      OR: [
        { category: { in: ['Matching', 'Booking'] } },
        { key: { in: [MATCHING_PREFERRED_ACCEPT_MODE_KEY, MATCHING_BACKUP_OPEN_MODE_KEY] } },
      ],
    },
    select: { key: true, value: true },
  });
  const policy = resolveMatchingPolicy(
    config,
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );
  const freshLocationAfter = new Date(
    checkedAt.getTime() - policy.backupProviderLocationMaxAgeMinutes * 60_000,
  );
  const whereInput = {
    bookingId: booking.id,
    serviceId,
    ...(booking.preferredProviderId ? { preferredProviderId: booking.preferredProviderId } : {}),
    freshLocationAfter,
  };
  const where = backupProviderCandidateStageWheres(whereInput);
  const [
    totalEvaluated,
    onlineAvailable,
    accountAvailable,
    identityReady,
    serviceReady,
    freshLocation,
    locationEvidence,
    providers,
  ] = await Promise.all([
    prisma.providerProfile.count(),
    prisma.providerProfile.count({ where: where.onlineAvailable }),
    prisma.providerProfile.count({ where: where.accountAvailable }),
    prisma.providerProfile.count({ where: where.identityReady }),
    prisma.providerProfile.count({ where: where.serviceReady }),
    prisma.providerProfile.count({ where: where.freshLocation }),
    prisma.providerProfile.aggregate({
      where: where.serviceReady,
      _min: { currentLocationUpdatedAt: true },
      _max: { currentLocationUpdatedAt: true },
    }),
    prisma.providerProfile.findMany({
      where: where.freshLocation,
      select: {
        id: true,
        displayName: true,
        currentLat: true,
        currentLng: true,
        currentLocationUpdatedAt: true,
        bookingAlertPreferences: true,
      },
    }),
  ]);
  const providersWithEvidence = providers.filter(
    (provider): provider is typeof provider & { currentLocationUpdatedAt: Date } =>
      provider.currentLocationUpdatedAt instanceof Date,
  );
  const dispatchCandidates = resolveBackupProviderDispatchCandidates(providersWithEvidence, {
    customerGender: booking.customerProfile.gender,
    customerNationality: booking.customerProfile.nationality,
    lat: referenceLat,
    lng: referenceLng,
    radiusMeters: policy.backupProviderRadiusMeters,
    serviceId,
  });
  const walletTotals = dispatchCandidates.matchingAlerts.length
    ? await prisma.providerWalletLedgerEntry.groupBy({
        by: ['providerProfileId'],
        where: {
          providerProfileId: {
            in: dispatchCandidates.matchingAlerts.map((provider) => provider.id),
          },
        },
        _sum: { amount: true },
      })
    : [];
  const finalized = finalizeBackupProviderDispatchCandidates(
    dispatchCandidates.matchingAlerts,
    walletTotals,
    policy.backupProviderInvitationLimit,
  );
  const stageFacts = [
    stage('evaluated', 'Evaluated', totalEvaluated, totalEvaluated, null, null),
    stage('online', 'Online / available', onlineAvailable, totalEvaluated, '/partners?review=available-blocked', 'Review availability'),
    stage('account', 'Account and reference', accountAvailable, onlineAvailable, '/partners?review=blocked', 'Review blocked accounts'),
    stage('identity', 'Identity and required documents', identityReady, accountAvailable, '/partners?review=approval-incomplete', 'Review Partner approvals'),
    stage('service', 'Requested service and response history', serviceReady, identityReady, '/partners?review=available-blocked-service', 'Review service eligibility'),
    stage('fresh-location', 'Fresh dispatch location', freshLocation, serviceReady, '/partner-controls?details=controls&review=location', 'Review Partner locations'),
    stage('radius', 'Inside matching radius', dispatchCandidates.withinRadius.length, freshLocation, '/operations-policy?details=matching&matching=supply', 'Review supply and radius'),
    stage('alerts', 'Matching alert preferences', dispatchCandidates.matchingAlerts.length, dispatchCandidates.withinRadius.length, '/partners?review=ready-now', 'Review eligible Partners'),
    stage('final-gate', 'Final invitation gate', finalized.finalGateReady.length, dispatchCandidates.matchingAlerts.length, '/partners?review=available-blocked-wallet&walletStatus=negative', 'Review wallet gates'),
    stage('invited', 'Invitation limit', finalized.invited.length, finalized.finalGateReady.length, null, null),
  ];
  const firstBlockedStage = stageFacts.slice(1).find((item) => item.passedCount === 0) ?? null;
  const status: AdminMatchingPreviewStatus = finalized.invited.length
    ? 'READY_WITH_PRODUCTION_EVIDENCE'
    : 'BLOCKED_NO_ELIGIBLE_SUPPLY';

  return {
    candidates: finalized.invited.slice(0, CANDIDATE_PREVIEW_LIMIT).map((provider) => ({
      blockerCodes: [],
      distanceMeters: provider.distanceMeters,
      locationUpdatedAt: provider.currentLocationUpdatedAt.toISOString(),
      name: provider.displayName,
      partnerId: provider.id,
      stage: 'INVITABLE',
    })),
    checkedAt: checkedAt.toISOString(),
    evidence: {
      newestAt: locationEvidence._max.currentLocationUpdatedAt?.toISOString() ?? null,
      oldestAt: locationEvidence._min.currentLocationUpdatedAt?.toISOString() ?? null,
      returnedCandidates: finalized.invited.length,
      totalEvaluated,
      truncated: false,
    },
    primaryBlocker: firstBlockedStage
      ? {
          actionHref: firstBlockedStage.actionHref,
          actionLabel: firstBlockedStage.actionLabel,
          code: firstBlockedStage.code,
          detail: `${firstBlockedStage.excludedCount} Partner records were excluded at this production gate.`,
          title: `${firstBlockedStage.label} blocks dispatch`,
        }
      : null,
    reference,
    safety: { dryRun: true, mutationsPerformed: false },
    stages: stageFacts,
    status,
  };
}

function previewWithoutProductionReference(checkedAt: Date): AdminMatchingPreview {
  return {
    candidates: [],
    checkedAt: checkedAt.toISOString(),
    evidence: {
      newestAt: null,
      oldestAt: null,
      returnedCandidates: 0,
      totalEvaluated: 0,
      truncated: false,
    },
    primaryBlocker: {
      actionHref: '/bookings?view=matching',
      actionLabel: 'Open matching bookings',
      code: 'NO_ACTIONABLE_BOOKING',
      detail: 'No actionable booking coordinate is available. Demo coordinates cannot approve a live policy decision.',
      title: 'No production booking reference',
    },
    reference: DEMO_REFERENCE,
    safety: { dryRun: true, mutationsPerformed: false },
    stages: [],
    status: 'DEMO_PREVIEW_ONLY',
  };
}

function nullableCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function blockedReferencePreview(
  checkedAt: Date,
  reference: AdminMatchingPreview['reference'],
  status: 'BLOCKED_NO_REFERENCE' | 'INCOMPLETE_EVIDENCE',
  detail: string,
): AdminMatchingPreview {
  return {
    candidates: [],
    checkedAt: checkedAt.toISOString(),
    evidence: { newestAt: null, oldestAt: null, returnedCandidates: 0, totalEvaluated: 0, truncated: false },
    primaryBlocker: {
      actionHref: '/bookings?view=matching',
      actionLabel: 'Open matching bookings',
      code: status,
      detail,
      title: status === 'INCOMPLETE_EVIDENCE' ? 'Booking evidence is incomplete' : 'No actionable booking reference',
    },
    reference,
    safety: { dryRun: true, mutationsPerformed: false },
    stages: [],
    status,
  };
}

function stage(
  code: string,
  label: string,
  passedCount: number,
  previousCount: number,
  actionHref: string | null,
  actionLabel: string | null,
) {
  return {
    actionHref,
    actionLabel,
    code,
    excludedCount: Math.max(0, previousCount - passedCount),
    label,
    passedCount,
  };
}
