import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingDetailLocationTrail } from './booking-detail-location-trail';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-location-trail',
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
    providerProfileId: 'partner-1',
    recordedAt: '2026-06-14T02:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('bookingDetailLocationTrail', () => {
  it('keeps explicit booking snapshots before provider latest fallback', () => {
    const explicitSnapshot = location({ id: 'booking-snapshot' });
    const providerSnapshot = location({ id: 'provider-snapshot' });

    expect(
      bookingDetailLocationTrail(
        booking({
          selectedProvider: {
            id: 'partner-1',
            displayName: 'Linh Partner',
            locationSnapshots: [providerSnapshot],
          } as AdminBookingDetail['selectedProvider'],
          snapshots: [explicitSnapshot],
        }),
      ),
    ).toEqual([explicitSnapshot]);
  });

  it('falls back to the latest provider location when booking snapshots are missing', () => {
    const providerSnapshot = location({ id: 'provider-snapshot' });

    expect(
      bookingDetailLocationTrail(
        booking({
          selectedProvider: {
            id: 'partner-1',
            displayName: 'Linh Partner',
            locationSnapshots: [providerSnapshot],
          } as AdminBookingDetail['selectedProvider'],
        }),
      ),
    ).toEqual([providerSnapshot]);
  });

  it('returns an empty trail when neither source exists', () => {
    expect(bookingDetailLocationTrail(booking({}))).toEqual([]);
  });
});
