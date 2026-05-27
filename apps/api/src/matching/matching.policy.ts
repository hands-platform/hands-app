import { ConfigService } from '@nestjs/config';

export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;
export const DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES = 10;
export const DEFAULT_BACKUP_PROVIDER_RADIUS_METERS = 10000;

export type MatchingPolicy = {
  travelBufferMinutes: number;
  providerResponseWindowMinutes: number;
  backupProviderRadiusMeters: number;
};

export function resolveMatchingPolicy(config: ConfigService): MatchingPolicy {
  return {
    travelBufferMinutes: readPositiveInteger(
      config,
      'MATCHING_TRAVEL_BUFFER_MINUTES',
      DEFAULT_TRAVEL_BUFFER_MINUTES,
    ),
    providerResponseWindowMinutes: readPositiveInteger(
      config,
      'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES',
      DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
    ),
    backupProviderRadiusMeters: readPositiveInteger(
      config,
      'MATCHING_BACKUP_PROVIDER_RADIUS_METERS',
      DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
    ),
  };
}

export function roundTo100Meters(value: number) {
  return Math.round(value / 100) * 100;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readPositiveInteger(config: ConfigService, key: string, fallback: number) {
  const value = Number(config.get<string>(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
