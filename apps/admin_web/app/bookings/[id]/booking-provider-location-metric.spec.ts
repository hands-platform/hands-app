import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import {
  bookingDetailProviderLocationMetricHelper,
  bookingDetailProviderLocationMetricValue,
} from './booking-provider-location-metric';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-provider-location-metric',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    recordedAt: '2999-01-01T00:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('booking provider location metric copy', () => {
  it('returns missing copy when no provider location exists', () => {
    const input = booking({});

    expect(bookingDetailProviderLocationMetricValue(input)).toBe('Missing');
    expect(bookingDetailProviderLocationMetricHelper(input)).toBe('No Partner location shared yet');
  });

  it('uses the selected Partner latest location when available', () => {
    const input = booking({
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
        locationSnapshots: [location()],
      } as AdminBookingDetail['selectedProvider'],
    });

    expect(bookingDetailProviderLocationMetricValue(input)).toBe('Recent');
    expect(bookingDetailProviderLocationMetricHelper(input)).toBe('Updated just now');
  });
});
