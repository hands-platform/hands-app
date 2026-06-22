export const PARTNER_IDLE_LOCATION_MIN_INTERVAL_MINUTES = 60;
export const PARTNER_IDLE_LOCATION_MIN_DISTANCE_METERS = 3000;
export const PARTNER_ACTIVE_LOCATION_MIN_INTERVAL_MINUTES = 30;
export const PARTNER_LOCATION_STALE_AFTER_MINUTES = 90;
export const PROVIDER_LOCATION_TTL_SECONDS = PARTNER_LOCATION_STALE_AFTER_MINUTES * 60;

export type ProviderLocationUpdateDeniedReason =
  | 'TOO_FREQUENT_IDLE_LOCATION_UPDATE'
  | 'TOO_FREQUENT_ACTIVE_BOOKING_LOCATION_UPDATE';

export type ProviderLocationUpdateDecision =
  | { allowed: true }
  | { allowed: false; reason: ProviderLocationUpdateDeniedReason };

export type ProviderCachedLocation = {
  lat: number;
  lng: number;
  recordedAt?: string | Date | null;
};

export type ProviderLocationUpdateInput = {
  previous?: ProviderCachedLocation | null;
  next: { lat: number; lng: number };
  now?: Date;
  hasActiveBookingContext: boolean;
};

export function providerLocationUpdateDecision(
  input: ProviderLocationUpdateInput,
): ProviderLocationUpdateDecision {
  if (!input.previous?.recordedAt) {
    return { allowed: true };
  }

  const now = input.now ?? new Date();
  const recordedAt = new Date(input.previous.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    return { allowed: true };
  }

  const elapsedMinutes = (now.getTime() - recordedAt.getTime()) / 60000;
  if (input.hasActiveBookingContext) {
    return elapsedMinutes >= PARTNER_ACTIVE_LOCATION_MIN_INTERVAL_MINUTES
      ? { allowed: true }
      : { allowed: false, reason: 'TOO_FREQUENT_ACTIVE_BOOKING_LOCATION_UPDATE' };
  }

  if (elapsedMinutes >= PARTNER_IDLE_LOCATION_MIN_INTERVAL_MINUTES) {
    return { allowed: true };
  }

  const movedMeters = distanceMeters(input.previous, input.next);
  return movedMeters >= PARTNER_IDLE_LOCATION_MIN_DISTANCE_METERS
    ? { allowed: true }
    : { allowed: false, reason: 'TOO_FREQUENT_IDLE_LOCATION_UPDATE' };
}

function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earthRadiusMeters = 6371000;
  const fromLat = degreesToRadians(from.lat);
  const toLat = degreesToRadians(to.lat);
  const deltaLat = degreesToRadians(to.lat - from.lat);
  const deltaLng = degreesToRadians(to.lng - from.lng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
