import type { AdminBooking } from '../../lib/admin-api';
import {
  hasProviderCoordinate,
  providerLocationFreshnessFromTimestamp,
  type ProviderLocationFreshness,
} from '../../lib/booking-status-location-helpers';

const bookingLocationPillLabels: Record<ProviderLocationFreshness, string> = {
  expired: 'Location too old',
  missing: 'No location',
  recent: 'Location recent',
  stale: 'Location stale',
};

const bookingLocationToneClasses: Record<ProviderLocationFreshness, string> = {
  expired: 'pill-info',
  missing: 'pill-neutral',
  recent: 'pill-success',
  stale: 'pill-warn',
};

const STALE_LOCATION_MINUTES = 30;
const EXPIRED_LOCATION_HOURS = 24;

export function bookingLocationSignalLabel(booking: AdminBooking, nowMs: number): string {
  const provider = providerWithLocation(booking);
  if (!provider) {
    return 'Partner location: not shared yet';
  }

  const updatedAt = provider.currentLocationUpdatedAt;
  if (!updatedAt) {
    return 'Partner location: saved pin without timestamp';
  }

  const age = locationAgeLabel(updatedAt, nowMs);
  return `Partner location: ${age}`;
}

export function bookingLocationPillLabel(booking: AdminBooking, nowMs: number): string {
  return bookingLocationPillLabels[providerLocationFreshness(booking, nowMs)];
}

export function bookingLocationToneClass(booking: AdminBooking, nowMs: number): string {
  return bookingLocationToneClasses[providerLocationFreshness(booking, nowMs)];
}

export function providerLocationFreshness(
  booking: AdminBooking,
  nowMs: number,
): ProviderLocationFreshness {
  const provider = providerWithLocation(booking);
  return providerLocationFreshnessFromTimestamp(
    provider?.currentLocationUpdatedAt,
    nowMs,
    STALE_LOCATION_MINUTES,
    EXPIRED_LOCATION_HOURS,
  );
}

function providerWithLocation(booking: AdminBooking) {
  if (hasProviderCoordinate(booking.selectedProvider)) {
    return booking.selectedProvider;
  }

  return (booking.participants ?? [])
    .map((participant) => participant.providerProfile)
    .find((provider) => hasProviderCoordinate(provider));
}

function locationAgeLabel(value: string, nowMs: number) {
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'invalid timestamp';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const ageMinutes = Math.max(0, Math.round((reference - updatedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'updated just now';
  }
  if (ageMinutes < 60) {
    return `updated ${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `updated ${ageHours}h ago`;
}
