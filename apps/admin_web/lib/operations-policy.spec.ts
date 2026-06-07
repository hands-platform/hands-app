import type { AdminOperationalPolicySetting } from './admin-api';
import {
  OPERATIONAL_POLICY_KEYS,
  adminWalletGateBlocksMarketplaceParticipation,
  buildAdminPartnerMarketplaceReadiness,
  buildAdminLiveOperationsPolicy,
  formatPolicyDistance,
  humanizePolicyValue,
  operationalPolicyAnchor,
  operationalPolicyHref,
  readPolicyString,
} from './operations-policy';

function setting(key: string, value: unknown): AdminOperationalPolicySetting {
  return { key, value } as AdminOperationalPolicySetting;
}

describe('admin live operations policy helpers', () => {
  it('normalizes configured marketplace policy values and trims string policies', () => {
    const settings = [
      setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, '10'),
      setting(OPERATIONAL_POLICY_KEYS.travelBufferMinutes, '45'),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, '10000'),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 30),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit, '25'),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, ' IMMEDIATE '),
      setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, ' CUSTOMER_CONFIRM '),
      setting(OPERATIONAL_POLICY_KEYS.walletNegativeGate, ' BLOCK_MARKETPLACE_PARTICIPATION '),
    ];

    const policy = buildAdminLiveOperationsPolicy(settings);

    expect(policy.providerResponseWindowMinutes).toBe(10);
    expect(policy.travelBufferMinutes).toBe(45);
    expect(policy.marketplaceRadiusMeters).toBe(10000);
    expect(policy.marketplaceLocationFreshnessMinutes).toBe(30);
    expect(policy.marketplaceInvitationLimit).toBe(25);
    expect(policy.marketplaceOpenMode).toBe('IMMEDIATE');
    expect(policy.preferredAcceptMode).toBe('CUSTOMER_CONFIRM');
    expect(policy.walletNegativeGate).toBe('BLOCK_MARKETPLACE_PARTICIPATION');
  });

  it('falls back to MVP authority defaults when settings are missing or invalid', () => {
    const policy = buildAdminLiveOperationsPolicy([
      setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 'bad-number'),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, '   '),
    ]);

    expect(policy.providerResponseWindowMinutes).toBe(10);
    expect(policy.travelBufferMinutes).toBe(30);
    expect(policy.marketplaceRadiusMeters).toBe(10000);
    expect(policy.marketplaceLocationFreshnessMinutes).toBe(30);
    expect(policy.marketplaceInvitationLimit).toBe(50);
    expect(policy.marketplaceOpenMode).toBe('IMMEDIATE_WITHIN_WINDOW');
    expect(policy.preferredAcceptMode).toBe('CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT');
    expect(policy.walletNegativeGate).toBe('BLOCK_MARKETPLACE_PARTICIPATION');
    expect(policy.cashSettlementClearance).toBe('DEPOSIT_OR_ADMIN_OFFSET_REQUIRED');
    expect(policy.payoutBatchCycle).toBe('WEEKLY_OR_MONTHLY_BATCH');
  });

  it('formats policy values for operator-facing summaries', () => {
    expect(formatPolicyDistance(10000)).toBe('10km');
    expect(formatPolicyDistance(1500)).toBe('1.5km');
    expect(formatPolicyDistance(900)).toBe('900m');
    expect(humanizePolicyValue('BLOCK_MARKETPLACE_PARTICIPATION')).toBe('Block Marketplace Participation');
  });

  it('does not return blank policy strings', () => {
    expect(readPolicyString([setting('empty', '   ')], 'empty')).toBeNull();
  });

  it('keeps all MVP wallet policy values compatible with marketplace participation blocking', () => {
    expect(adminWalletGateBlocksMarketplaceParticipation('BLOCK_MARKETPLACE_PARTICIPATION')).toBe(true);
    expect(adminWalletGateBlocksMarketplaceParticipation('BLOCK_ACCEPTS_WHEN_NEGATIVE')).toBe(true);
    expect(adminWalletGateBlocksMarketplaceParticipation('ALLOW_ONE_RECOVERY_BOOKING')).toBe(true);
  });

  it('builds stable Operations Policy anchors from policy keys', () => {
    expect(operationalPolicyAnchor(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters)).toBe(
      'policy-matching-marketplace-provider-radius-meters',
    );
    expect(operationalPolicyHref(OPERATIONAL_POLICY_KEYS.walletNegativeGate)).toBe(
      '/operations-policy#policy-wallet-negative-balance-gate',
    );
  });

  it('marks a fully prepared online partner as marketplace ready', () => {
    const readiness = buildAdminPartnerMarketplaceReadiness({
      provider: {
        status: 'ONLINE_AVAILABLE',
        verification: { id: 'verification-1', status: 'APPROVED' },
        kyc: { id: 'kyc-1', status: 'APPROVED' },
        documents: [
          { id: 'doc-1', type: 'CCCD_FRONT', status: 'APPROVED' },
          { id: 'doc-2', type: 'CCCD_BACK', status: 'APPROVED' },
          { id: 'doc-3', type: 'SELFIE', status: 'APPROVED' },
        ],
        bankAccounts: [
          {
            id: 'bank-1',
            bankName: 'VCB',
            accountHolderName: 'Linh Nguyen',
            status: 'APPROVED',
            isPrimary: true,
          },
        ],
        earnings: [{ netAmount: 250000 }],
        currentLat: 10.7769,
        currentLng: 106.7009,
        currentLocationUpdatedAt: new Date().toISOString(),
        user: { pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }] },
      },
      freshnessMinutes: 30,
      hardWalletBlock: true,
    });

    expect(readiness.marketplaceBlocked).toBe(false);
    expect(readiness.finalGateHeld).toBe(false);
    expect(readiness.canCompleteFinalGate).toBe(true);
    expect(readiness.walletBalance).toBe(250000);
  });

  it('keeps negative-wallet partners visible but blocks marketplace participation and final gate', () => {
    const readiness = buildAdminPartnerMarketplaceReadiness({
      provider: {
        status: 'ONLINE_AVAILABLE',
        verification: { id: 'verification-1', status: 'APPROVED' },
        kyc: { id: 'kyc-1', status: 'APPROVED' },
        documents: [
          { id: 'doc-1', type: 'CCCD_FRONT', status: 'APPROVED' },
          { id: 'doc-2', type: 'CCCD_BACK', status: 'APPROVED' },
          { id: 'doc-3', type: 'SELFIE', status: 'APPROVED' },
        ],
        bankAccounts: [
          {
            id: 'bank-1',
            bankName: 'VCB',
            accountHolderName: 'Linh Nguyen',
            status: 'APPROVED',
            isPrimary: true,
          },
        ],
        earnings: [{ netAmount: -120000 }],
        currentLat: 10.7769,
        currentLng: 106.7009,
        currentLocationUpdatedAt: new Date().toISOString(),
        user: { pushDevices: [{ id: 'push-1', platform: 'android', enabled: true }] },
      },
      freshnessMinutes: 30,
      hardWalletBlock: true,
    });

    expect(readiness.marketplaceBlocked).toBe(true);
    expect(readiness.finalGateHeld).toBe(true);
    expect(readiness.canCompleteFinalGate).toBe(false);
    expect(readiness.walletBalance).toBe(-120000);
  });

  it('separates account, identity, bank, location, and push readiness reasons', () => {
    const readiness = buildAdminPartnerMarketplaceReadiness({
      provider: {
        status: 'ONLINE_AVAILABLE',
        verification: { id: 'verification-1', status: 'APPROVED' },
        kyc: { id: 'kyc-1', status: 'PENDING' },
        documents: [{ id: 'doc-1', type: 'CCCD_FRONT', status: 'APPROVED' }],
        bankAccounts: [
          {
            id: 'bank-1',
            bankName: 'VCB',
            accountHolderName: 'Linh Nguyen',
            status: 'PENDING',
            isPrimary: true,
          },
        ],
        devices: [{ id: 'device-1', deviceId: 'a', enabled: false }],
        earnings: [{ netAmount: 0 }],
        currentLat: 10.7769,
        currentLng: null,
        user: { pushDevices: [] },
      },
      freshnessMinutes: 30,
      hardWalletBlock: true,
    });

    expect(readiness.accountNeedsFollowUp).toBe(true);
    expect(readiness.identityReady).toBe(false);
    expect(readiness.bankReady).toBe(false);
    expect(readiness.locationFresh).toBe(false);
    expect(readiness.pushEnabled).toBe(false);
    expect(readiness.marketplaceBlocked).toBe(true);
    expect(readiness.finalGateHeld).toBe(true);
  });
});
