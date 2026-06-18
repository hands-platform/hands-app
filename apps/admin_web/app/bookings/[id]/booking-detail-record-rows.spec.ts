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
  it('builds customer rows with address, pin, opened, and expiry copy', () => {
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
      { label: 'Pin', value: '10.7627, 106.6603' },
      { label: 'Request opened', value: '14 Jun 2026, 08:15' },
      { label: 'Expires', value: '14 Jun 2026, 10:00' },
    ]);
  });

  it('builds handoff rows with preferred, final, phone, and latest location copy', () => {
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
      { label: 'Latest Partner pin', value: '10.7627, 106.6603' },
      { label: 'Latest pin time', value: '1 Jan 2999, 07:00' },
      { label: 'Location freshness', value: 'Updated just now' },
    ]);
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
    expect(bookingDetailLocationTrailRows([location({ id: 'trail-1' })])).toEqual([
      {
        coordinate: '10.7627, 106.6603',
        id: 'trail-1',
        recordedAt: '14 Jun 2026, 09:00',
      },
    ]);
  });
});
