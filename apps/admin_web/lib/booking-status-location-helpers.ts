import type { AdminBookingMatchingEvidence } from './admin-api';
import {
  bookingCheckFlag,
  compactBookingCheckFlags,
  type BookingCheckLevelFlag,
} from './booking-check-level';

export type PreferredAwaitingDecisionInput = {
  readonly finalSelection?: AdminBookingMatchingEvidence['finalSelection'] | null;
  readonly hasPreferredPartner: boolean;
  readonly preferredParticipantStatus?: string | null;
};

export type ProviderLocationCoordinateInput = {
  readonly currentLat?: string | number | null;
  readonly currentLng?: string | number | null;
};

export type ProviderLocationTimestampInput = ProviderLocationCoordinateInput & {
  readonly currentLocationUpdatedAt?: string | null;
};

export type ProviderLocationFreshness = 'recent' | 'stale' | 'expired' | 'missing';

export type BookingLocationNeedsOpsFromFactsInput = {
  status: string;
  hasProviderLocation: boolean;
  providerLocationFreshness: ProviderLocationFreshness;
};

const decidedPreferredParticipantStatuses = new Set(['ACCEPTED', 'SELECTED', 'REJECTED']);
const locationRequiredStatuses = new Set(['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);
const defaultStaleLocationMinutes = 30;
const defaultExpiredLocationHours = 24;

export function isPreferredAwaitingDecision(input: PreferredAwaitingDecisionInput): boolean {
  if (input.finalSelection) {
    return input.finalSelection === 'FIRST_PICK_PENDING';
  }

  if (!input.hasPreferredPartner) {
    return false;
  }

  if (!input.preferredParticipantStatus) {
    return true;
  }

  return !decidedPreferredParticipantStatuses.has(input.preferredParticipantStatus);
}

export function bookingLocationTrail<T>(explicitSnapshots: T[] | undefined | null, latestLocation: T | null): T[] {
  if ((explicitSnapshots?.length ?? 0) > 0) {
    return explicitSnapshots ?? [];
  }

  return latestLocation ? [latestLocation] : [];
}

export function hasProviderCoordinate(provider?: ProviderLocationCoordinateInput | null): boolean {
  if (!provider || provider.currentLat === null || provider.currentLat === undefined) {
    return false;
  }
  if (provider.currentLng === null || provider.currentLng === undefined) {
    return false;
  }
  return Number.isFinite(Number(provider.currentLat)) && Number.isFinite(Number(provider.currentLng));
}

export function providerLocationFreshnessFromTimestamp(
  value?: string | null,
  nowMs = Date.now(),
  staleLocationMinutes = defaultStaleLocationMinutes,
  expiredLocationHours = defaultExpiredLocationHours,
): ProviderLocationFreshness {
  if (!value) {
    return 'missing';
  }

  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const ageMs = reference - updatedAt;
  if (ageMs > expiredLocationHours * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > staleLocationMinutes * 60_000) {
    return 'stale';
  }
  return 'recent';
}

export function bookingLocationNeedsOpsFromFacts(input: BookingLocationNeedsOpsFromFactsInput): boolean {
  if (!locationRequiredStatuses.has(input.status)) {
    return false;
  }
  if (!input.hasProviderLocation) {
    return true;
  }
  return input.providerLocationFreshness !== 'recent';
}

export function bookingLocationCheckFlagsFromFacts(
  input: BookingLocationNeedsOpsFromFactsInput,
): BookingCheckLevelFlag[] {
  const locationRequired = locationRequiredStatuses.has(input.status);

  return compactBookingCheckFlags([
    bookingCheckFlag(
      locationRequired && !input.hasProviderLocation,
      'medium',
      'No Partner location record',
    ),
    bookingCheckFlag(
      locationRequired &&
        input.hasProviderLocation &&
        input.providerLocationFreshness !== 'recent',
      'medium',
      'Partner location is stale',
    ),
  ]);
}

export function bookingLocationNeedsOpsFromProvider(input: {
  status: string;
  provider?: ProviderLocationTimestampInput | null;
  nowMs?: number;
}): boolean {
  const hasLocation = hasProviderCoordinate(input.provider);
  return bookingLocationNeedsOpsFromFacts({
    status: input.status,
    hasProviderLocation: hasLocation,
    providerLocationFreshness: hasLocation
      ? providerLocationFreshnessFromTimestamp(input.provider?.currentLocationUpdatedAt, input.nowMs)
      : 'missing',
  });
}
