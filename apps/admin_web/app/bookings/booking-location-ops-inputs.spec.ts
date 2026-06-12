import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingHasProviderLocation,
  bookingLocationNeedsOpsInput,
} from './booking-location-ops-inputs';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'PROVIDER_ON_THE_WAY',
    ...overrides,
  } as AdminBooking;
}

describe('booking location ops inputs', () => {
  it('detects selected provider coordinates', () => {
    expect(
      bookingHasProviderLocation(
        booking({
          selectedProvider: {
            currentLat: '10.7769',
            currentLng: '106.7009',
          } as AdminBooking['selectedProvider'],
        }),
      ),
    ).toBe(true);
  });

  it('detects participant provider coordinates when selected provider has none', () => {
    expect(
      bookingHasProviderLocation(
        booking({
          participants: [
            {
              providerProfile: {
                currentLat: 10.7769,
                currentLng: 106.7009,
              },
            },
          ] as AdminBooking['participants'],
        }),
      ),
    ).toBe(true);
  });

  it('maps missing provider location to booking location facts', () => {
    expect(bookingLocationNeedsOpsInput(booking(), nowMs)).toEqual({
      status: 'PROVIDER_ON_THE_WAY',
      hasProviderLocation: false,
      providerLocationFreshness: 'missing',
    });
  });

  it('maps selected provider freshness into location facts', () => {
    expect(
      bookingLocationNeedsOpsInput(
        booking({
          selectedProvider: {
            currentLat: '10.7769',
            currentLng: '106.7009',
            currentLocationUpdatedAt: '2026-06-07T09:45:00.000Z',
          } as AdminBooking['selectedProvider'],
        }),
        nowMs,
      ),
    ).toEqual({
      status: 'PROVIDER_ON_THE_WAY',
      hasProviderLocation: true,
      providerLocationFreshness: 'recent',
    });
  });
});
