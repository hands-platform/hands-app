import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingLocationPillLabel,
  bookingLocationSignalLabel,
  bookingLocationToneClass,
  providerLocationFreshness,
} from './booking-location-display';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking location display helpers', () => {
  const nowMs = Date.parse('2026-06-12T10:00:00.000Z');

  it('describes missing provider location', () => {
    const item = booking({});

    expect(bookingLocationSignalLabel(item, nowMs)).toBe('Partner location: not shared yet');
    expect(bookingLocationPillLabel(item, nowMs)).toBe('No location');
    expect(bookingLocationToneClass(item, nowMs)).toBe('pill-neutral');
    expect(providerLocationFreshness(item, nowMs)).toBe('missing');
  });

  it('uses selected provider location when available', () => {
    const item = booking({
      selectedProvider: {
        currentLat: '10.1',
        currentLng: '106.1',
        currentLocationUpdatedAt: '2026-06-12T09:45:00.000Z',
      } as AdminBooking['selectedProvider'],
    });

    expect(bookingLocationSignalLabel(item, nowMs)).toBe('Partner location: updated 15m ago');
    expect(bookingLocationPillLabel(item, nowMs)).toBe('Location recent');
    expect(bookingLocationToneClass(item, nowMs)).toBe('pill-success');
    expect(providerLocationFreshness(item, nowMs)).toBe('recent');
  });

  it('falls back to participant provider location and labels stale state', () => {
    const item = booking({
      participants: [
        {
          providerProfile: {
            currentLat: '10.2',
            currentLng: '106.2',
            currentLocationUpdatedAt: '2026-06-12T09:10:00.000Z',
          },
        },
      ] as AdminBooking['participants'],
    });

    expect(bookingLocationSignalLabel(item, nowMs)).toBe('Partner location: updated 50m ago');
    expect(bookingLocationPillLabel(item, nowMs)).toBe('Location stale');
    expect(bookingLocationToneClass(item, nowMs)).toBe('pill-warn');
    expect(providerLocationFreshness(item, nowMs)).toBe('stale');
  });
});
