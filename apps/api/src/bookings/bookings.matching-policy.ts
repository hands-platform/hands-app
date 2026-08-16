import { Prisma } from '@prisma/client';
import {
  BACKUP_OPEN_AFTER_FIRST_PICK_DELAY,
  BACKUP_OPEN_IMMEDIATE,
  MatchingPolicy,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
} from '../matching/matching.policy';

export function bookingMatchingPolicySnapshot(policy: MatchingPolicy) {
  return {
    providerResponseWindowMinutes: policy.providerResponseWindowMinutes,
    marketplaceRadiusMeters: policy.backupProviderRadiusMeters,
    marketplaceLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    marketplaceInvitationLimit: policy.backupProviderInvitationLimit,
    marketplaceOpenMode: policy.backupOpenMode,
    backupProviderRadiusMeters: policy.backupProviderRadiusMeters,
    backupProviderLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    backupProviderInvitationLimit: policy.backupProviderInvitationLimit,
    bookingMaxCustomerCurrentToAddressKm: policy.bookingMaxCustomerCurrentToAddressKm,
    bookingMaxPreferredProviderDistanceKm: policy.bookingMaxPreferredProviderDistanceKm,
    bookingCurrentLocationFreshnessMinutes: policy.bookingCurrentLocationFreshnessMinutes,
    bookingDistanceGateEnabled: policy.bookingDistanceGateEnabled,
    bookingServiceAreaRequired: policy.bookingServiceAreaRequired,
    preferredAcceptMode: policy.preferredAcceptMode,
    backupOpenMode: policy.backupOpenMode,
    travelBufferMinutes: policy.travelBufferMinutes,
  };
}

export function bookingCreateMetadata(input: {
  policy: MatchingPolicy;
  bookingGate: Prisma.InputJsonValue;
}): Prisma.InputJsonObject {
  return {
    dataOrigin: 'PRODUCTION',
    matchingPolicy: bookingMatchingPolicySnapshot(input.policy),
    bookingGate: input.bookingGate,
  };
}

export function restoreBookingMatchingPolicy(
  metadata: unknown,
  fallback: MatchingPolicy,
): MatchingPolicy {
  const metadataRecord = readPlainRecord(metadata);
  const snapshot = readPlainRecord(metadataRecord?.matchingPolicy);
  if (!snapshot) {
    return fallback;
  }

  return {
    providerResponseWindowMinutes: readSnapshotInteger(
      snapshot.providerResponseWindowMinutes,
      fallback.providerResponseWindowMinutes,
    ),
    backupProviderRadiusMeters: readSnapshotInteger(
      snapshot.marketplaceRadiusMeters ?? snapshot.backupProviderRadiusMeters,
      fallback.backupProviderRadiusMeters,
    ),
    travelBufferMinutes: readSnapshotInteger(snapshot.travelBufferMinutes, fallback.travelBufferMinutes),
    backupProviderLocationMaxAgeMinutes: readSnapshotInteger(
      snapshot.marketplaceLocationMaxAgeMinutes ?? snapshot.backupProviderLocationMaxAgeMinutes,
      fallback.backupProviderLocationMaxAgeMinutes,
    ),
    backupProviderInvitationLimit: readSnapshotInteger(
      snapshot.marketplaceInvitationLimit ?? snapshot.backupProviderInvitationLimit,
      fallback.backupProviderInvitationLimit,
    ),
    bookingMaxCustomerCurrentToAddressKm: readSnapshotInteger(
      snapshot.bookingMaxCustomerCurrentToAddressKm,
      fallback.bookingMaxCustomerCurrentToAddressKm,
    ),
    bookingMaxPreferredProviderDistanceKm: readSnapshotInteger(
      snapshot.bookingMaxPreferredProviderDistanceKm,
      fallback.bookingMaxPreferredProviderDistanceKm,
    ),
    bookingCurrentLocationFreshnessMinutes: readSnapshotInteger(
      snapshot.bookingCurrentLocationFreshnessMinutes,
      fallback.bookingCurrentLocationFreshnessMinutes,
    ),
    bookingDistanceGateEnabled: readSnapshotBoolean(
      snapshot.bookingDistanceGateEnabled,
      fallback.bookingDistanceGateEnabled,
    ),
    bookingServiceAreaRequired: readSnapshotBoolean(
      snapshot.bookingServiceAreaRequired,
      fallback.bookingServiceAreaRequired,
    ),
    preferredAcceptMode:
      snapshot.preferredAcceptMode === PREFERRED_ACCEPT_CUSTOMER_CONFIRM
        ? snapshot.preferredAcceptMode
        : PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    backupOpenMode: restoredBackupOpenMode(snapshot, fallback),
  };
}

export function readPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function restoredBackupOpenMode(snapshot: Record<string, unknown>, fallback: MatchingPolicy) {
  if (
    snapshot.marketplaceOpenMode === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY ||
    snapshot.marketplaceOpenMode === BACKUP_OPEN_IMMEDIATE
  ) {
    return snapshot.marketplaceOpenMode;
  }
  if (
    snapshot.backupOpenMode === BACKUP_OPEN_AFTER_FIRST_PICK_DELAY ||
    snapshot.backupOpenMode === BACKUP_OPEN_IMMEDIATE
  ) {
    return snapshot.backupOpenMode;
  }
  return fallback.backupOpenMode;
}

function readSnapshotInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function readSnapshotBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}
