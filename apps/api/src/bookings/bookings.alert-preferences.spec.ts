import { describe, expect, it } from 'vitest';
import {
  normalizeProviderBookingAlertPreferences,
  providerBookingAlertMatches,
} from './bookings.alert-preferences';

describe('provider booking alert preferences', () => {
  it('matches saved marketplace alert conditions without affecting defaults', () => {
    expect(normalizeProviderBookingAlertPreferences(null)).toEqual({
      enabled: true,
      maxDistanceKm: null,
      customerGender: null,
      customerNationality: null,
      serviceIds: [],
    });
    expect(
      providerBookingAlertMatches(
        {
          enabled: true,
          maxDistanceKm: 5,
          customerGender: 'female',
          customerNationality: 'Vietnamese',
          serviceIds: ['service-1'],
        },
        {
          distanceMeters: 4200,
          serviceId: 'service-1',
          customerGender: 'FEMALE',
          customerNationality: 'vietnamese',
        },
      ),
    ).toBe(true);
    expect(
      providerBookingAlertMatches(
        { enabled: true, maxDistanceKm: 3 },
        { distanceMeters: 4200, serviceId: 'service-1' },
      ),
    ).toBe(false);
  });
});
