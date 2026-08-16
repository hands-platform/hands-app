import type { AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildBookingAcceptanceMatrix } from './booking-acceptance-matrix';

describe('booking acceptance matrix builder', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-13T03:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds aligned control cards and current Partner readiness impact', () => {
    const matrix = buildBookingAcceptanceMatrix(
      [
        setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 10),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 10000),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 90),
        setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, 'IMMEDIATE_WITHIN_WINDOW'),
        setting(OPERATIONAL_POLICY_KEYS.partnerAlertChannel, 'FCM_FOR_ALL_BOOKINGS'),
        setting(OPERATIONAL_POLICY_KEYS.walletNegativeGate, 'BLOCK_MARKETPLACE_PARTICIPATION'),
      ],
      [
        provider({
          bankAccounts: [{ status: 'APPROVED' }],
          currentLocationUpdatedAt: '2026-06-13T02:55:00.000Z',
          documents: [
            { status: 'APPROVED', type: 'CCCD_FRONT' },
            { status: 'APPROVED', type: 'CCCD_BACK' },
            { status: 'APPROVED', type: 'SELFIE' },
          ],
          earnings: [{ netAmount: 0 }],
          id: 'ready-partner',
          kyc: { status: 'APPROVED' },
          user: { pushDevices: [{ enabled: true }] },
          verification: { status: 'APPROVED' },
        }),
        provider({
          bankAccounts: [],
          blockedAt: '2026-06-13T02:00:00.000Z',
          id: 'blocked-partner',
          user: { pushDevices: [] },
        }),
      ],
    );

    expect(matrix.blockingCount).toBe(0);
    expect(matrix.sampledPartnerCount).toBe(2);
    expect(matrix.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'First-pick timer', value: '10 min' }),
        expect.objectContaining({ label: 'Marketplace policy', value: '10 km' }),
        expect.objectContaining({ label: 'Final match', value: 'Customer chooses' }),
      ]),
    );
    expect(matrix.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operatorAction:
            'Monitor delivery failures, disabled devices, stale tokens, and retry audit evidence on the Notifications board.',
          pillClass: 'pill-success',
          status: 'Push enabled',
          title: 'Partner alert delivery',
        }),
        expect.objectContaining({
          pillClass: 'pill-success',
          status: 'Final gate hold',
          title: 'Negative wallet gate',
        }),
      ]),
    );
    expect(matrix.impact).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'record', label: 'Marketplace ready', scope: 'Sample result', value: '1' }),
        expect.objectContaining({ label: 'Final gate held', value: '1' }),
        expect.objectContaining({ label: 'Push gap', value: '1' }),
      ]),
    );
  });

  it('flags policy conflicts when timer, marketplace, accept mode, and wallet gate drift', () => {
    const matrix = buildBookingAcceptanceMatrix(
      [
        setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 5),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 5000),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 45),
        setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'AUTO_MATCH_ON_ACCEPT'),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, 'CUSTOM_DELAYED_MODE'),
        setting(OPERATIONAL_POLICY_KEYS.walletNegativeGate, 'LEGACY_ALLOW_WITH_DEBT'),
      ],
      [],
    );

    expect(matrix.blockingCount).toBe(6);
    expect(matrix.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Marketplace policy', value: '5 km' }),
        expect.objectContaining({ label: 'Final match', value: 'Policy conflict' }),
      ]),
    );
    expect(matrix.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'Owner override', title: 'First-pick response window' }),
        expect.objectContaining({ status: 'Customer-choice conflict', title: 'Customer final selection' }),
        expect.objectContaining({
          detail:
            'FCM readiness is not verified in this workspace; Partner booking and marketplace alerts stay in-app until monitoring evidence is available and the owner enables push routing.',
          operatorAction:
            'Keep this on in-app-first while operators watch notification monitoring and retry audit evidence; SMS stays under the deferred Phone Auth step.',
          status: 'In-app first',
          title: 'Partner alert delivery',
        }),
        expect.objectContaining({ status: 'Historical setting review', title: 'Negative wallet gate' }),
      ]),
    );
    const alertCard = matrix.cards.find((card) => card.title === 'Partner alert delivery');
    expect(alertCard?.operatorAction).not.toContain('production SMS credentials');
  });

  it('describes bank gaps as wallet review follow-up instead of paid work blocking', () => {
    const matrix = buildBookingAcceptanceMatrix(
      [
        setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 10),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 10000),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 90),
        setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'),
        setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, 'IMMEDIATE_WITHIN_WINDOW'),
        setting(OPERATIONAL_POLICY_KEYS.partnerAlertChannel, 'IN_APP_ONLY'),
        setting(OPERATIONAL_POLICY_KEYS.walletNegativeGate, 'BLOCK_MARKETPLACE_PARTICIPATION'),
      ],
      [provider({ bankAccounts: [] })],
    );

    expect(matrix.impact).toContainEqual(
      expect.objectContaining({
        helper: 'Bank details are reviewed when the Partner requests wallet withdrawal or deposit support.',
        label: 'Bank review',
        value: '1',
      }),
    );
  });
});

function setting(key: string, value: string | number): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    enforced: true,
    key,
    label: key,
    value,
  } as AdminOperationalPolicySetting;
}

function provider(overrides: Record<string, unknown>): AdminProvider {
  return {
    bankAccounts: [],
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt: '2026-06-13T02:55:00.000Z',
    displayName: 'Partner',
    documents: [],
    earnings: [],
    id: 'partner',
    kyc: { status: 'PENDING' },
    status: 'ONLINE_AVAILABLE',
    user: { pushDevices: [] },
    verification: { status: 'PENDING' },
    ...overrides,
  } as unknown as AdminProvider;
}
