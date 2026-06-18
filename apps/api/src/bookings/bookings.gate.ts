import { BadRequestException } from '@nestjs/common';
import { MatchingPolicy } from '../matching/matching.policy';
import { isVietnamBookingCoordinate } from './bookings.policy';

export type BookingAttemptCurrentLocation = ReturnType<typeof normalizeBookingAttemptCurrentLocation>;

export type BookingGateRejectionAuditInput = {
  actorId: string;
  customerProfileId: string;
  serviceId: string;
  preferredProviderId?: string | null;
  reasonCode: string;
  reason: string;
  bookingLat: number;
  bookingLng: number;
  addressText: string;
  customerDistanceMeters?: number | null;
  preferredProviderDistanceMeters?: number | null;
  customerDistanceLimitMeters: number;
  preferredProviderDistanceLimitMeters: number;
  currentLocationRecordedAt?: Date | null;
};

export function assertWorldBookingCoordinate(lat: number, lng: number) {
  if (!isWorldBookingCoordinate(lat, lng)) {
    throw new BadRequestException('Booking address coordinate is invalid');
  }
}

export function normalizeBookingAttemptCurrentLocation(
  input: { currentLat?: number; currentLng?: number; currentLocationUpdatedAt?: string },
  policy: MatchingPolicy,
) {
  if (!policy.bookingDistanceGateEnabled) {
    return null;
  }
  const hasAnyCurrentLocationInput =
    input.currentLat != null || input.currentLng != null || input.currentLocationUpdatedAt != null;
  if (!hasAnyCurrentLocationInput) {
    return null;
  }
  const lat = Number(input.currentLat);
  const lng = Number(input.currentLng);
  if (!isWorldBookingCoordinate(lat, lng)) {
    return null;
  }
  const recordedAt = input.currentLocationUpdatedAt ? new Date(input.currentLocationUpdatedAt) : null;
  if (!recordedAt || Number.isNaN(recordedAt.getTime())) {
    return null;
  }
  const now = Date.now();
  if (recordedAt.getTime() > now + 60_000) {
    return null;
  }
  const ageMinutes = Math.max(0, (now - recordedAt.getTime()) / 60_000);
  if (ageMinutes > policy.bookingCurrentLocationFreshnessMinutes) {
    return null;
  }
  return { lat, lng, recordedAt, ageMinutes };
}

export function preferredProviderBookingDistanceGateError(
  preferredProvider: { id: string } | null,
  distanceMeters: number | null,
  policy: MatchingPolicy,
) {
  if (!policy.bookingDistanceGateEnabled || !preferredProvider) {
    return null;
  }
  const { preferredProviderDistanceLimitMeters: limitMeters } = bookingDistanceGateLimits(policy);
  if (distanceMeters === null || distanceMeters > limitMeters) {
    return {
      limitMeters,
      message: `Preferred partner must be within ${policy.bookingMaxPreferredProviderDistanceKm}km of the booking address`,
    };
  }
  return null;
}

export function customerCurrentLocationBookingDistanceGateError(
  distanceMeters: number | null,
  policy: MatchingPolicy,
) {
  if (!policy.bookingDistanceGateEnabled || distanceMeters === null) {
    return null;
  }
  const { customerDistanceLimitMeters: limitMeters } = bookingDistanceGateLimits(policy);
  if (distanceMeters >= limitMeters) {
    return {
      limitMeters,
      message: `Booking address must be within ${policy.bookingMaxCustomerCurrentToAddressKm}km of the customer's current location`,
    };
  }
  return null;
}

export function bookingDistanceGateLimits(policy: MatchingPolicy) {
  return {
    customerDistanceLimitMeters: policy.bookingMaxCustomerCurrentToAddressKm * 1000,
    preferredProviderDistanceLimitMeters: policy.bookingMaxPreferredProviderDistanceKm * 1000,
  };
}

export function bookingDistanceGateSnapshot(input: {
  matchingPolicy: MatchingPolicy;
  bookingLat: number;
  bookingLng: number;
  addressText: string;
  customerCurrentLocation: BookingAttemptCurrentLocation;
  customerToBookingDistanceMeters: number | null;
  preferredProvider: {
    id: string;
    currentLat?: unknown;
    currentLng?: unknown;
    currentLocationUpdatedAt?: Date | null;
  } | null;
  preferredProviderDistanceMeters: number | null;
}) {
  const limits = bookingDistanceGateLimits(input.matchingPolicy);

  return {
    distanceGateEnabled: input.matchingPolicy.bookingDistanceGateEnabled,
    serviceAreaRequired: input.matchingPolicy.bookingServiceAreaRequired,
    serviceArea: 'VIETNAM',
    serviceAreaValid: isVietnamBookingCoordinate(input.bookingLat, input.bookingLng),
    bookingAddress: {
      lat: input.bookingLat,
      lng: input.bookingLng,
      addressText: input.addressText,
    },
    customerCurrentLocation: input.customerCurrentLocation
      ? {
          lat: input.customerCurrentLocation.lat,
          lng: input.customerCurrentLocation.lng,
          recordedAt: input.customerCurrentLocation.recordedAt.toISOString(),
          ageMinutes: Number(input.customerCurrentLocation.ageMinutes.toFixed(2)),
        }
      : null,
    customerToBookingAddressDistanceMeters: input.customerToBookingDistanceMeters,
    customerDistanceLimitMeters: limits.customerDistanceLimitMeters,
    preferredProviderId: input.preferredProvider?.id ?? null,
    preferredProviderLocation: input.preferredProvider
      ? {
          lat: nullableCoordinate(input.preferredProvider.currentLat),
          lng: nullableCoordinate(input.preferredProvider.currentLng),
          updatedAt: input.preferredProvider.currentLocationUpdatedAt?.toISOString() ?? null,
        }
      : null,
    preferredProviderDistanceMeters: input.preferredProviderDistanceMeters,
    preferredProviderDistanceLimitMeters: limits.preferredProviderDistanceLimitMeters,
    gatePassed: true,
  };
}

export function bookingGateRejectionAuditCreateInput(input: BookingGateRejectionAuditInput) {
  return {
    data: {
      actorId: input.actorId,
      action: 'booking.create.rejected',
      target: `customer:${input.customerProfileId}`,
      metadata: {
        reasonCode: input.reasonCode,
        reason: input.reason,
        customerProfileId: input.customerProfileId,
        serviceId: input.serviceId,
        preferredProviderId: input.preferredProviderId ?? null,
        bookingAddress: {
          lat: input.bookingLat,
          lng: input.bookingLng,
          addressText: input.addressText,
        },
        customerDistanceMeters: input.customerDistanceMeters ?? null,
        preferredProviderDistanceMeters: input.preferredProviderDistanceMeters ?? null,
        customerDistanceLimitMeters: input.customerDistanceLimitMeters,
        preferredProviderDistanceLimitMeters: input.preferredProviderDistanceLimitMeters,
        currentLocationRecordedAt: input.currentLocationRecordedAt?.toISOString() ?? null,
      },
    },
  };
}

function isWorldBookingCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function nullableCoordinate(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}
