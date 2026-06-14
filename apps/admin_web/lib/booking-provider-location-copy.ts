export type BookingProviderLocationFreshness = 'recent' | 'stale' | 'expired' | 'missing' | string | null | undefined;

export function bookingProviderLocationMetricValue(freshness: BookingProviderLocationFreshness) {
  if (freshness === 'recent') {
    return 'Recent';
  }
  if (freshness === 'stale') {
    return 'Stale';
  }
  if (freshness === 'expired') {
    return 'Too old';
  }
  return 'Missing';
}

export function bookingProviderLocationMetricHelper(
  recordedAt?: string | null,
  options: { nowMs?: number } = {},
) {
  if (!recordedAt) {
    return 'No Partner location shared yet';
  }

  const recordedAtMs = new Date(recordedAt).getTime();
  if (!Number.isFinite(recordedAtMs)) {
    return 'Partner location timestamp is invalid';
  }

  const nowMs = options.nowMs ?? Date.now();
  const ageMinutes = Math.max(0, Math.round((nowMs - recordedAtMs) / 60_000));
  if (ageMinutes < 1) {
    return 'Updated just now';
  }
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Updated ${ageHours}h ago`;
}
