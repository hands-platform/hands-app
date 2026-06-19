import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingDetailLifecycleListRows } from './booking-detail-lifecycle-list-section';

describe('bookingDetailLifecycleListRows', () => {
  it('keeps realtime and post-match list rows for an in-progress booking detail', () => {
    const rows = bookingDetailLifecycleListRows(
      bookingFixture({ status: 'IN_SERVICE' }),
      new Date('2026-06-19T08:00:00.000Z').getTime(),
    );

    expect(rows.map((row) => row.groupKey)).toEqual(['pre-match', 'post-match-in-progress']);
    expect(rows[0]?.row.booking.status).toBe('OPEN_MATCHING');
    expect(rows[1]?.row.booking.status).toBe('IN_SERVICE');
  });

  it('adds the completed list row when the booking is completed', () => {
    const rows = bookingDetailLifecycleListRows(
      bookingFixture({
        closedAt: '2026-06-19T08:45:00.000Z',
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T08:45:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    expect(rows.map((row) => row.groupKey)).toEqual([
      'pre-match',
      'post-match-in-progress',
      'completed',
    ]);
  });

  it('adds the pending post-match cancellation review row when admin processing is required', () => {
    const rows = bookingDetailLifecycleListRows(
      bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        closedReason: 'partner_cancelled',
        status: 'CANCELLED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    expect(rows.map((row) => row.groupKey)).toEqual([
      'pre-match',
      'post-match-in-progress',
      'post-match-cancellations-pending',
    ]);
  });
});

function bookingFixture(input: Partial<AdminBookingDetail> = {}): AdminBookingDetail {
  return {
    id: 'booking-1',
    createdAt: '2026-06-19T07:00:00.000Z',
    customerProfileId: 'customer-profile-1',
    customerProfile: {
      id: 'customer-profile-1',
      user: {
        appSessions: [{ deviceLanguage: 'vi-VN' }],
        fullName: 'Customer Nguyen',
        phone: '+84900000000',
      },
    },
    lat: 21.036,
    lng: 105.782,
    matchedAt: '2026-06-19T08:00:00.000Z',
    participants: [
      {
        id: 'participant-1',
        providerProfileId: 'partner-1',
        providerProfile: {
          displayName: 'Partner Matched',
          id: 'partner-1',
          status: 'ONLINE_BUSY',
          user: { phone: '+84911111111' },
        },
        status: 'ACCEPTED',
      },
    ],
    selectedProvider: {
      displayName: 'Partner Matched',
      id: 'partner-1',
      status: 'ONLINE_BUSY',
      user: { phone: '+84911111111' },
    },
    selectedProviderId: 'partner-1',
    services: [
      {
        price: 500000,
        quantity: 1,
        service: {
          basePrice: 500000,
          durationMin: 90,
          name: 'Aromatherapy Massage',
        },
      },
    ],
    status: 'MATCHED',
    statusChangedAt: '2026-06-19T08:05:00.000Z',
    updatedAt: '2026-06-19T08:05:00.000Z',
    ...input,
  } as AdminBookingDetail;
}
