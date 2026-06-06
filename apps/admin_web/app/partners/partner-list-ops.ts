import type { AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import {
  formatDateTime,
  formatDistanceMeters as formatAdminDistanceMeters,
  formatRelativeTime,
} from '../../lib/admin-format';
import { OPERATIONAL_POLICY_KEYS, readPositivePolicyNumber } from '../../lib/operations-policy';

export type ProviderLocationState = 'recent' | 'stale' | 'expired' | 'missing';

export type ProviderOpsPolicy = {
  staleLocationMinutes: number;
  expiredLocationHours: number;
  backupRadiusMeters: number;
  responseWindowMinutes: number;
};

export const DEFAULT_PROVIDER_OPS_POLICY: ProviderOpsPolicy = {
  staleLocationMinutes: 30,
  expiredLocationHours: 24,
  backupRadiusMeters: 10000,
  responseWindowMinutes: 10,
};

export function providerLocationStatus(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): ProviderLocationState {
  if (!hasProviderCoordinate(provider) || !provider.currentLocationUpdatedAt) {
    return 'missing';
  }

  const updatedAt = new Date(provider.currentLocationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }

  const ageMs = Date.now() - updatedAt;
  if (ageMs > opsPolicy.expiredLocationHours * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > opsPolicy.staleLocationMinutes * 60_000) {
    return 'stale';
  }
  return 'recent';
}

export function buildProviderOpsPolicy(settings: AdminOperationalPolicySetting[]): ProviderOpsPolicy {
  return {
    staleLocationMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
      DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes,
    expiredLocationHours: DEFAULT_PROVIDER_OPS_POLICY.expiredLocationHours,
    backupRadiusMeters:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
      DEFAULT_PROVIDER_OPS_POLICY.backupRadiusMeters,
    responseWindowMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      DEFAULT_PROVIDER_OPS_POLICY.responseWindowMinutes,
  };
}

export function hasProviderCoordinate(provider: AdminProvider) {
  if (provider.currentLat === null || provider.currentLat === undefined) {
    return false;
  }
  if (provider.currentLng === null || provider.currentLng === undefined) {
    return false;
  }
  return Number.isFinite(Number(provider.currentLat)) && Number.isFinite(Number(provider.currentLng));
}

export function formatDistanceMeters(distanceMeters: number) {
  return formatAdminDistanceMeters(distanceMeters);
}

export function providerLocationLabel(status: ProviderLocationState) {
  if (status === 'recent') {
    return 'Location recent';
  }
  if (status === 'stale') {
    return 'Location stale';
  }
  if (status === 'expired') {
    return 'Too old';
  }
  return 'No location';
}

export function providerLocationPillClass(status: ProviderLocationState) {
  if (status === 'recent') {
    return 'pill-success';
  }
  if (status === 'stale') {
    return 'pill-warn';
  }
  if (status === 'expired') {
    return 'pill-info';
  }
  return 'pill-neutral';
}

export function providerLocationAgeLabel(value?: string | null) {
  if (!value) {
    return 'Partner app has not shared a location.';
  }

  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'Saved location time is invalid.';
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'Updated just now.';
  }
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago.`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Updated ${ageHours}h ago.`;
}

export function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value?: string | null) {
  return formatDateTime(value, value ? 'invalid time' : 'not recorded');
}

export function dateMs(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatRelativeAge(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'with no timestamp',
    invalidFallback: 'at an invalid time',
    justNow: 'just now',
  });
}
