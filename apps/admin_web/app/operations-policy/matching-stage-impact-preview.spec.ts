import type { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildMatchingStageImpactPreview } from './matching-stage-impact-preview';

const now = Date.parse('2026-06-08T05:00:00.000Z');

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking_open',
    status: 'OPEN_MATCHING',
    createdAt: '2026-06-08T04:48:00.000Z',
    lat: 10.7769,
    lng: 106.7009,
    participants: [],
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

describe('matching stage impact preview', () => {
  it('classifies open matching stages and keeps negative-wallet partners in visible marketplace supply', () => {
    const settings = [
      { key: OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, value: 10 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, value: 10000 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, value: 30 },
      { key: OPERATIONAL_POLICY_KEYS.walletNegativeGate, value: 'BLOCK_MARKETPLACE_PARTICIPATION' },
    ] as AdminOperationalPolicySetting[];
    const providers = [
      readyPartner(),
      readyPartner({
        id: 'partner_negative_wallet',
        displayName: 'Negative Wallet Partner',
        currentLat: 10.95,
        currentLng: 106.95,
        earnings: [{ id: 'debt', netAmount: -12000 } as never],
      }),
    ];
    const bookings = [
      booking({ id: 'stage2_supply' }),
      booking({
        id: 'wallet_blocked_only',
        createdAt: '2026-06-08T04:59:00.000Z',
        lat: 10.95,
        lng: 106.95,
      }),
      booking({
        id: 'stage3_customer_choice',
        createdAt: '2026-06-08T04:59:00.000Z',
        participants: [{ id: 'participant_accepted', status: 'ACCEPTED' } as never],
      }),
      booking({
        id: 'chat_repair',
        status: 'MATCHED',
        chatRoom: null,
      }),
    ];

    const preview = buildMatchingStageImpactPreview(settings, bookings, providers, now);

    expect(preview.currentPolicyLabel).toBe('10m / 10 km / 30m fresh');
    expect(preview.openMatchingCount).toBe(3);
    expect(preview.summary).toEqual([
      {
        label: 'Open matching sample',
        value: '3',
        helper: 'Bookings currently waiting inside Stage 1, Stage 2, or Stage 3.',
      },
      {
        label: 'Current Stage 2 marketplace',
        value: '2',
        helper: 'Open bookings with usable marketplace partner supply under the current policy.',
      },
      {
        label: 'Current no supply',
        value: '0',
        helper: 'Open bookings that would show customer waiting without usable marketplace supply.',
      },
      {
        label: 'Stage 4 repair',
        value: '1',
        helper: '1 matched/live booking checked for missing chat handoff.',
      },
    ]);
    expect(preview.rows.find((row) => row.scenario === 'Marketplace policy' && row.value === '10 km')).toMatchObject({
      stage1: 0,
      stage2: 2,
      stage3: 1,
      repair: 1,
      noSupply: 0,
      overdue: 1,
      pillClass: 'pill-info',
    });
    expect(preview.rows.find((row) => row.scenario === 'Response window' && row.value === '15 min')).toMatchObject({
      overdue: 0,
      pillClass: 'pill-neutral',
    });
  });

  it('uses booking address snapshot coordinates when legacy booking coordinates are absent', () => {
    const settings = [
      { key: OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, value: 10 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, value: 10000 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, value: 30 },
    ] as AdminOperationalPolicySetting[];
    const providers = [readyPartner()];
    const bookings = [
      booking({
        lat: undefined,
        lng: undefined,
        addressSnapshot: {
          id: 'snapshot',
          bookingId: 'booking_open',
          customerProfileId: 'customer',
          latitude: 10.7769,
          longitude: 106.7009,
          addressText: 'District 1, Ho Chi Minh City, Vietnam',
        },
      }),
    ];

    const preview = buildMatchingStageImpactPreview(settings, bookings, providers, now);

    expect(preview.summary.find((item) => item.label === 'Current Stage 2 marketplace')).toMatchObject({
      value: '1',
    });
  });
});
