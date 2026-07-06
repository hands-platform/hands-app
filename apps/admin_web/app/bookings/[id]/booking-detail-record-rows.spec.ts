import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  bookingDetailCustomerRows,
  bookingDetailHandoffRows,
  bookingDetailLocationTrailRows,
  bookingDetailServiceRows,
} from './booking-detail-record-rows';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-record-rows',
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

describe('booking detail record rows', () => {
  it('builds customer rows with address snapshot, opened, and expiry copy without exposing coordinates', () => {
    const rows = bookingDetailCustomerRows({
      booking: booking({
        customerProfile: {
          user: {
            fullName: 'Mai Customer',
            phone: '+84000000001',
          },
        } as AdminBookingDetail['customerProfile'],
        expiresAt: '2026-06-14T03:00:00.000Z',
        openedAt: '2026-06-14T01:15:00.000Z',
      }),
      addressLine: 'District service address',
      addressPin: '10.7627, 106.6603',
    });

    expect(rows).toEqual([
      { label: 'Name', value: 'Mai Customer' },
      { label: 'Phone', value: '+84000000001' },
      { label: 'Address', value: 'District service address' },
      { label: 'Address snapshot', value: 'Snapshot saved' },
      { label: 'Request opened', value: 'Not set', dateTimeValue: '2026-06-14T01:15:00.000Z' },
      { label: 'Expires', value: 'Not set', dateTimeValue: '2026-06-14T03:00:00.000Z' },
    ]);
    expect(rows.map((row) => row.value).join(' ')).not.toMatch(/\d{2}\.\d{4},\s*\d{3}\.\d{4}/);
  });

  it('builds handoff rows with preferred, final, phone, and latest location copy without exposing coordinates', () => {
    const latestLocation = location({ recordedAt: '2999-01-01T00:00:00.000Z' });
    const input = booking({
      preferredProvider: {
        id: 'partner-preferred',
        displayName: 'Preferred Partner',
      } as AdminBookingDetail['preferredProvider'],
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
        locationSnapshots: [latestLocation],
        user: { phone: '+84987654321' },
      } as AdminBookingDetail['selectedProvider'],
    });

    const rows = bookingDetailHandoffRows({
      booking: input,
      finalPartnerSummary: bookingFinalPartnerSummary(input),
      latestLocation,
    });

    expect(rows).toEqual([
      { label: 'Preferred', value: 'Preferred Partner' },
      { label: 'Final', value: 'Linh Partner' },
      { label: 'Final phone', value: '+84987654321' },
      { label: 'Latest Partner location', value: 'Location recorded without readable address' },
      { label: 'Latest location time', value: 'No location shared', dateTimeValue: '2999-01-01T00:00:00.000Z' },
      { label: 'Location freshness', value: 'Updated just now' },
    ]);
    expect(rows.map((row) => row.value).join(' ')).not.toMatch(/\d{2}\.\d{4},\s*\d{3}\.\d{4}/);
  });

  it('builds service rows from the loaded booking service snapshot', () => {
    const rows = bookingDetailServiceRows(
      booking({
        notes: 'Customer prefers quiet room',
        payment: { amount: 500000, currency: 'VND' } as AdminBookingDetail['payment'],
        services: [
          {
            price: 500000,
            service: {
              basePrice: 400000,
              durationMin: 90,
              name: 'Aromatherapy',
              payoutRules: [
                {
                  customerPrice: 500000,
                  providerPayoutAmount: 350000,
                  currency: 'VND',
                },
              ],
            },
          },
        ] as AdminBookingDetail['services'],
        updatedAt: '2026-06-14T02:30:00.000Z',
      }),
    );

    expect(rows).toEqual([
      { label: 'Option', value: 'Aromatherapy / 90 min' },
      { label: 'Name', value: 'Aromatherapy' },
      { label: 'Duration', value: '90 min' },
      { label: 'Notes', value: 'Customer prefers quiet room' },
      { label: 'Record time', value: '14 Jun 2026, 08:00 / updated 14 Jun 2026, 09:30' },
    ]);
  });

  it('formats location trail rows', () => {
    expect(bookingDetailLocationTrailRows([location({ id: 'trail-1' })], 'booking-detail-record-rows')).toEqual([
      {
        badge: 'Live',
        badgeTone: 'pill-neutral',
        coordinate: 'Location recorded without readable address',
        detail: 'Address not recorded for this location snapshot.',
        id: 'trail-1',
        label: 'Partner live snapshot',
        recordedAt: 'Not set',
        recordedAtValue: '2026-06-14T02:00:00.000Z',
      },
    ]);
  });

  it('formats booking action location rows with readable area labels', () => {
    expect(
      bookingDetailLocationTrailRows(
        [
          location({
            addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
            bookingId: 'booking-detail-record-rows',
            id: 'action-trail-1',
          }),
        ],
        'booking-detail-record-rows',
      ),
    ).toEqual([
      {
        badge: 'Action',
        badgeTone: 'pill-info',
        coordinate: 'District 1, Ho Chi Minh City',
        detail: 'Coordinate retained for distance checks.',
        id: 'action-trail-1',
        label: 'Booking action snapshot',
        recordedAt: 'Not set',
        recordedAtValue: '2026-06-14T02:00:00.000Z',
      },
    ]);
  });
});
