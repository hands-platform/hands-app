import { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildPolicySupplySensitivity } from './policy-supply-sensitivity';

const now = Date.parse('2026-06-08T05:00:00.000Z');

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking_ho_chi_minh',
    status: 'OPEN_MATCHING',
    createdAt: '2026-06-08T04:30:00.000Z',
    lat: 10.7769,
    lng: 106.7009,
    ...overrides,
  };
}

function readyPartner(overrides: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner_ready',
    displayName: 'Ready Partner',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.7769,
    currentLng: 106.701,
    currentLocationUpdatedAt: '2026-06-08T04:50:00.000Z',
    verification: { id: 'verification', status: 'APPROVED' },
    kyc: { id: 'kyc', status: 'APPROVED' },
    documents: [
      { id: 'front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    bankAccounts: [
      {
        id: 'bank',
        bankName: 'VCB',
        accountHolderName: 'Ready Partner',
        status: 'APPROVED',
        isPrimary: true,
      },
    ],
    earnings: [],
    ...overrides,
  } as AdminProvider;
}

describe('policy supply sensitivity', () => {
  it('counts online and fresh partners as visible supply while keeping cash debt in final gate held', () => {
    const settings = [
      { key: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, value: 10000 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, value: 30 },
      { key: OPERATIONAL_POLICY_KEYS.walletNegativeGate, value: 'BLOCK_MARKETPLACE_PARTICIPATION' },
    ] as AdminOperationalPolicySetting[];
    const providers = [
      readyPartner({ id: 'fresh_inside' }),
      readyPartner({
        id: 'stale_inside',
        currentLocationUpdatedAt: '2026-06-08T03:50:00.000Z',
      }),
      readyPartner({
        id: 'negative_wallet',
        earnings: [{ id: 'earning_debt', netAmount: -12000 } as never],
      }),
      readyPartner({
        id: 'offline_inside',
        status: 'OFFLINE',
      }),
      readyPartner({
        id: 'far_partner',
        currentLat: 10.9,
        currentLng: 106.9,
      }),
    ];

    const sensitivity = buildPolicySupplySensitivity(settings, [booking()], providers, now);

    expect(sensitivity.referenceLabel).toBe('Booking booking_...minh');
    expect(sensitivity.currentPolicyLabel).toBe('10 km / 30m fresh');
    expect(sensitivity.summary).toEqual([
      {
        label: 'Coordinate sample',
        value: '5',
        helper: '5 total Partners, 5 Partners with saved coordinates.',
      },
      {
        label: 'Current visible supply',
        value: '2',
        helper: 'Online, marketplace eligible, inside radius, and fresh enough.',
      },
      {
        label: 'Final gate held in radius',
        value: '1',
        helper:
          'Final acceptance, service start, or payout release may wait for settlement, identity, or account controls.',
      },
      {
        label: 'Stale excluded',
        value: '1',
        helper: 'Could become usable by opening the Partner app and refreshing location.',
      },
    ]);
    expect(sensitivity.radiusRows.find((row) => row.radiusLabel === '10 km')).toMatchObject({
      eligible: 2,
      finalGateHeld: 1,
      pillClass: 'pill-info',
    });
    expect(sensitivity.freshnessRows.find((row) => row.freshnessLabel === '30 min')).toMatchObject({
      eligible: 2,
      staleExcluded: 1,
      pillClass: 'pill-info',
    });
  });
});
