import type { AdminBooking } from '../../lib/admin-api';
import { buildPolicyDrilldown } from './policy-drilldown';

describe('buildPolicyDrilldown', () => {
  it('builds policy review drill-down rows from open and wallet-risk bookings', () => {
    const bookings = [
      {
        createdAt: '2026-01-02T00:00:00.000Z',
        customerProfile: { user: { fullName: 'Customer One' } },
        expiresAt: '2026-01-02T00:10:00.000Z',
        id: 'open-booking-123456',
        participants: [{ providerProfile: { displayName: 'Partner One' } }],
        services: [{ service: { durationMin: 45, name: 'Foot Massage' } }],
        status: 'OPEN_MATCHING',
      },
      {
        createdAt: '2026-01-01T00:00:00.000Z',
        earning: { walletLedgerEntries: [{ amount: '-5000' }] },
        id: 'wallet-booking-123456',
        payment: { method: 'CASH', status: 'PENDING' },
        preferredProvider: { displayName: 'Partner Debt' },
        services: [{ service: { name: 'Aroma Massage' } }],
        status: 'MATCHED',
      },
    ] as unknown as AdminBooking[];

    const drilldown = buildPolicyDrilldown(bookings, []);

    expect(drilldown.totalCount).toBe(2);
    expect(drilldown.lists.map((list) => list.title)).toEqual([
      'Open matching queue',
      'Snapshot drift',
      'Wallet gate queue',
    ]);
    expect(drilldown.lists[0].rows[0]).toEqual(
      expect.objectContaining({
        href: '/bookings/open-booking-123456',
        subtitle: 'Partner One / Customer One',
        title: 'Foot Massage (45 min) / open-boo...3456',
      }),
    );
    expect(drilldown.lists[2].rows[0].title).toBe('Partner Debt / wallet-b...3456');
    expect(drilldown.lists[2].rows[0].pills[0]).toEqual({
      className: 'pill-danger',
      label: '-5.000 VND',
    });
    expect(drilldown.lists[2].helper).toBe(
      'Partners with negative recent wallet impact entries that may hold final acceptance, service start, or payout release.',
    );
    expect(drilldown.lists[2].rows[0].operatorAction).toBe(
      'Recent wallet entries are negative. Confirm settlement before final acceptance, service start, or payout release.',
    );
  });
});
