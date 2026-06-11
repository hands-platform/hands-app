import { calculateDistanceMeters } from './bookings.policy';

export type BackupProviderDistanceCandidate = {
  id: string;
  currentLat: unknown;
  currentLng: unknown;
};

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
