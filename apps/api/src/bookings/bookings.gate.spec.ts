import { BadRequestException } from '@nestjs/common';
import {
  BACKUP_OPEN_IMMEDIATE,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  type MatchingPolicy,
} from '../matching/matching.policy';
import {
  assertWorldBookingCoordinate,
  bookingDistanceGateLimits,
  bookingDistanceGateSnapshot,
  bookingGateRejectionAuditCreateInput,
  normalizeBookingAttemptCurrentLocation,
  preferredProviderBookingDistanceGateError,
} from './bookings.gate';

describe('booking gate helpers', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts finite coordinate ranges before Vietnam service-area validation', () => {
    expect(() => assertWorldBookingCoordinate(10.7769, 106.7009)).not.toThrow();
    expect(() => assertWorldBookingCoordinate(91, 106.7009)).toThrow(BadRequestException);
    expect(() => assertWorldBookingCoordinate(Number.NaN, 106.7009)).toThrow(BadRequestException);
  });

  it('normalizes a fresh customer app location', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T00:00:00.000Z'));

    expect(
      normalizeBookingAttemptCurrentLocation(
        {
          currentLat: 10.78,
          currentLng: 106.7,
          currentLocationUpdatedAt: '2026-06-10T23:55:00.000Z',
        },
        policy(),
      ),
    ).toEqual({
      lat: 10.78,
      lng: 106.7,
      recordedAt: new Date('2026-06-10T23:55:00.000Z'),
      ageMinutes: 5,
    });
  });

  it('ignores stale, future, invalid, and disabled customer app locations', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T00:00:00.000Z'));

    expect(
      normalizeBookingAttemptCurrentLocation(
        { currentLat: 10, currentLng: 106, currentLocationUpdatedAt: '2026-06-10T23:00:00.000Z' },
        policy(),
      ),
    ).toBeNull();
    expect(
      normalizeBookingAttemptCurrentLocation(
        { currentLat: 10, currentLng: 106, currentLocationUpdatedAt: '2026-06-11T00:02:00.000Z' },
        policy(),
      ),
    ).toBeNull();
    expect(
      normalizeBookingAttemptCurrentLocation(
        { currentLat: 99, currentLng: 106, currentLocationUpdatedAt: '2026-06-10T23:55:00.000Z' },
        policy(),
      ),
    ).toBeNull();
    expect(
      normalizeBookingAttemptCurrentLocation(
        { currentLat: 10, currentLng: 106, currentLocationUpdatedAt: '2026-06-10T23:55:00.000Z' },
        policy({ bookingDistanceGateEnabled: false }),
      ),
    ).toBeNull();
  });

  it('flags preferred partner distance gate failures only when the gate applies', () => {
    expect(preferredProviderBookingDistanceGateError(null, null, policy())).toBeNull();
    expect(preferredProviderBookingDistanceGateError({ id: 'partner-1' }, null, policy())).toEqual({
      limitMeters: 50000,
      message: 'Preferred partner must be within 50km of the booking address',
    });
    expect(preferredProviderBookingDistanceGateError({ id: 'partner-1' }, 60000, policy())).toEqual({
      limitMeters: 50000,
      message: 'Preferred partner must be within 50km of the booking address',
    });
    expect(
      preferredProviderBookingDistanceGateError(
        { id: 'partner-1' },
        60000,
        policy({ bookingDistanceGateEnabled: false }),
      ),
    ).toBeNull();
  });

  it('converts booking gate policy distances to meters', () => {
    expect(bookingDistanceGateLimits(policy())).toEqual({
      customerDistanceLimitMeters: 20000,
      preferredProviderDistanceLimitMeters: 50000,
    });
  });

  it('builds a Vietnam service area and distance gate snapshot', () => {
    const snapshot = bookingDistanceGateSnapshot({
      matchingPolicy: policy(),
      bookingLat: 10.7769,
      bookingLng: 106.7009,
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      customerCurrentLocation: {
        lat: 10.78,
        lng: 106.7,
        recordedAt: new Date('2026-06-10T23:55:00.000Z'),
        ageMinutes: 5.123,
      },
      customerToBookingDistanceMeters: 420,
      preferredProvider: {
        id: 'partner-1',
        currentLat: 10.77,
        currentLng: 106.7,
        currentLocationUpdatedAt: new Date('2026-06-10T23:58:00.000Z'),
      },
      preferredProviderDistanceMeters: 800,
    });

    expect(snapshot).toEqual({
      distanceGateEnabled: true,
      serviceAreaRequired: true,
      serviceArea: 'VIETNAM',
      serviceAreaValid: true,
      bookingAddress: {
        lat: 10.7769,
        lng: 106.7009,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
      },
      customerCurrentLocation: {
        lat: 10.78,
        lng: 106.7,
        recordedAt: '2026-06-10T23:55:00.000Z',
        ageMinutes: 5.12,
      },
      customerToBookingAddressDistanceMeters: 420,
      customerDistanceLimitMeters: 20000,
      preferredProviderId: 'partner-1',
      preferredProviderLocation: {
        lat: 10.77,
        lng: 106.7,
        updatedAt: '2026-06-10T23:58:00.000Z',
      },
      preferredProviderDistanceMeters: 800,
      preferredProviderDistanceLimitMeters: 50000,
      gatePassed: true,
    });
  });

  it('builds booking gate rejection audit create input', () => {
    expect(
      bookingGateRejectionAuditCreateInput({
        actorId: 'customer-user-1',
        customerProfileId: 'customer-1',
        serviceId: 'service-1',
        preferredProviderId: 'partner-1',
        reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
        reason: 'Preferred partner must be within 50km of the booking address',
        bookingLat: 10.7769,
        bookingLng: 106.7009,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
        customerDistanceMeters: null,
        preferredProviderDistanceMeters: 60000,
        customerDistanceLimitMeters: 20000,
        preferredProviderDistanceLimitMeters: 50000,
        currentLocationRecordedAt: new Date('2026-06-11T00:00:00.000Z'),
      }),
    ).toEqual({
      data: {
        actorId: 'customer-user-1',
        action: 'booking.create.rejected',
        target: 'customer:customer-1',
        metadata: {
          reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
          reason: 'Preferred partner must be within 50km of the booking address',
          customerProfileId: 'customer-1',
          serviceId: 'service-1',
          preferredProviderId: 'partner-1',
          bookingAddress: {
            lat: 10.7769,
            lng: 106.7009,
            addressText: 'District 1, Ho Chi Minh City, Vietnam',
          },
          customerDistanceMeters: null,
          preferredProviderDistanceMeters: 60000,
          customerDistanceLimitMeters: 20000,
          preferredProviderDistanceLimitMeters: 50000,
          currentLocationRecordedAt: '2026-06-11T00:00:00.000Z',
        },
      },
    });
  });
});

function policy(overrides: Partial<MatchingPolicy> = {}): MatchingPolicy {
  return {
    backupOpenMode: BACKUP_OPEN_IMMEDIATE,
    backupProviderInvitationLimit: 25,
    backupProviderLocationMaxAgeMinutes: 15,
    backupProviderRadiusMeters: 12000,
    bookingCurrentLocationFreshnessMinutes: 10,
    bookingDistanceGateEnabled: true,
    bookingMaxCustomerCurrentToAddressKm: 20,
    bookingMaxPreferredProviderDistanceKm: 50,
    bookingServiceAreaRequired: true,
    preferredAcceptMode: PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
    providerResponseWindowMinutes: 10,
    travelBufferMinutes: 30,
    ...overrides,
  };
}
