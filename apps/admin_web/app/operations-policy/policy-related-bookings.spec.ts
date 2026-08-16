import type { AdminBooking } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { policyRelatedBookingRecords } from './policy-related-bookings';

describe('policyRelatedBookingRecords', () => {
  it('builds marketplace records from participants, snapshots, or coordinates', () => {
    const bookings = [
      {
        customerProfile: { user: { fullName: 'Customer One' } },
        id: 'marketplace-booking-123456',
        lat: '10.7769',
        lng: '106.7009',
        participants: [{ providerProfile: { displayName: 'Partner One' }, status: 'ACCEPTED' }],
        services: [{ service: { durationMin: 45, name: 'Foot Massage' } }],
        status: 'OPEN_MATCHING',
      },
    ] as unknown as AdminBooking[];

    const records = policyRelatedBookingRecords(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, bookings);

    expect(records.title).toBe('Marketplace participation records');
    expect(records.recordCount).toBe('1 record');
    expect(records.rows[0]).toEqual(
      expect.objectContaining({
        href: '/bookings/marketplace-booking-123456',
        subtitle: 'Customer One / Partner One',
        title: 'Foot Massage (45 min) / marketpl...3456',
      }),
    );
  });

  it('uses Partner-facing empty text and active fallback records', () => {
    const customerChoiceRecords = policyRelatedBookingRecords('matching.preferred_accept_mode', []);
    const fallbackRecords = policyRelatedBookingRecords('unknown.policy', [
      {
        id: 'active-booking-123456',
        participants: [{}],
        status: 'MATCHED',
      },
    ] as unknown as AdminBooking[]);

    expect(customerChoiceRecords.emptyText).toBe(
      'No accepted Partner is currently waiting for customer final choice.',
    );
    expect(fallbackRecords.title).toBe('Active booking records');
    expect(fallbackRecords.rows[0].pills).toEqual(
      expect.arrayContaining([{ className: 'pill-neutral', label: 'Participating Partner' }]),
    );
  });
});
