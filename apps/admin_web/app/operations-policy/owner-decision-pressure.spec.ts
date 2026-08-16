import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import { buildOwnerDecisionPressure } from './owner-decision-pressure';
import type { PolicySupplySensitivity } from './policy-supply-sensitivity';

describe('buildOwnerDecisionPressure', () => {
  it('summarizes owner pressure from bookings, supply, gates, and push coverage', () => {
    const bookings = [
      {
        participants: [
          {
            providerProfile: { id: 'marketplace-partner' },
            status: 'ACCEPTED',
          },
        ],
        preferredProvider: { id: 'preferred-partner' },
        selectedProvider: null,
        status: 'OPEN_MATCHING',
      },
      { status: 'IN_SERVICE' },
    ] as unknown as AdminBooking[];
    const providers = [
      { status: 'ONLINE', user: { pushDevices: [{ enabled: true }] } },
      { status: 'ONLINE', user: { pushDevices: [] } },
    ] as unknown as AdminProvider[];
    const supplySensitivity = {
      currentPolicyLabel: '10 km / 30m fresh',
      freshnessRows: [],
      radiusRows: [],
      referenceLabel: 'Booking sample',
      summary: [
        { helper: '', label: 'Current visible supply', value: '0' },
        { helper: '', label: 'Stale excluded', value: '2' },
        { helper: '', label: 'Final gate held in radius', value: '3' },
      ],
    } satisfies PolicySupplySensitivity;

    const pressure = buildOwnerDecisionPressure(bookings, providers, supplySensitivity, {
      blockingCount: 4,
    });

    expect(pressure.alertCount).toBe(5);
    expect(pressure.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Open matching', value: '1' }),
        expect.objectContaining({ label: 'Active service flow', value: '2' }),
        expect.objectContaining({ label: 'Final gate pressure', value: '7' }),
      ]),
    );
    expect(pressure.cards[0].detail).toContain('first-pick Partner');
    expect(pressure.cards[1].detail).toContain('0 visible Partners');
    expect(pressure.cards[3]).toMatchObject({
      title: 'Wallet final gate pressure',
      operatorAction:
        'Keep marketplace visibility open while finance and Partner controls clear final acceptance, service start, and payout release holds.',
    });
    expect(pressure.cards[4].detail).toContain('1/2 online Partners');
  });
});
