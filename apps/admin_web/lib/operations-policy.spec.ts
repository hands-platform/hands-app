import type { AdminOperationalPolicySetting } from './admin-api';
import {
  OPERATIONAL_POLICY_KEYS,
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
      setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, '10000'),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 30),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit, '25'),
      setting(OPERATIONAL_POLICY_KEYS.backupOpenMode, ' IMMEDIATE '),
      setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, ' CUSTOMER_CONFIRM '),
      setting(OPERATIONAL_POLICY_KEYS.walletNegativeGate, ' BLOCK_MARKETPLACE_PARTICIPATION '),
    ];

    const policy = buildAdminLiveOperationsPolicy(settings);

    expect(policy.providerResponseWindowMinutes).toBe(10);
    expect(policy.marketplaceRadiusMeters).toBe(10000);
    expect(policy.marketplaceLocationFreshnessMinutes).toBe(30);
    expect(policy.marketplaceInvitationLimit).toBe(25);
    expect(policy.backupOpenMode).toBe('IMMEDIATE');
    expect(policy.preferredAcceptMode).toBe('CUSTOMER_CONFIRM');
    expect(policy.walletNegativeGate).toBe('BLOCK_MARKETPLACE_PARTICIPATION');
  });

  it('falls back to MVP authority defaults when settings are missing or invalid', () => {
    const policy = buildAdminLiveOperationsPolicy([
      setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 'bad-number'),
      setting(OPERATIONAL_POLICY_KEYS.backupOpenMode, '   '),
    ]);

    expect(policy.providerResponseWindowMinutes).toBe(10);
    expect(policy.marketplaceRadiusMeters).toBe(10000);
    expect(policy.marketplaceLocationFreshnessMinutes).toBe(30);
    expect(policy.marketplaceInvitationLimit).toBe(50);
    expect(policy.backupOpenMode).toBe('IMMEDIATE_WITHIN_WINDOW');
    expect(policy.preferredAcceptMode).toBe('CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT');
    expect(policy.walletNegativeGate).toBe('BLOCK_ACCEPTS_WHEN_NEGATIVE');
    expect(policy.cashSettlementClearance).toBe('DEPOSIT_OR_ADMIN_OFFSET_REQUIRED');
    expect(policy.payoutBatchCycle).toBe('WEEKLY_OR_MONTHLY_BATCH');
  });

  it('formats policy values for operator-facing summaries', () => {
    expect(formatPolicyDistance(10000)).toBe('10km');
    expect(formatPolicyDistance(1500)).toBe('1.5km');
    expect(formatPolicyDistance(900)).toBe('900m');
    expect(humanizePolicyValue('BLOCK_MARKETPLACE_PARTICIPATION')).toBe(
      'Block Marketplace Participation',
    );
  });

  it('does not return blank policy strings', () => {
    expect(readPolicyString([setting('empty', '   ')], 'empty')).toBeNull();
  });

  it('builds stable Operations Policy anchors from policy keys', () => {
    expect(operationalPolicyAnchor(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters)).toBe(
      'policy-matching-marketplace-provider-radius-meters',
    );
    expect(operationalPolicyHref(OPERATIONAL_POLICY_KEYS.walletNegativeGate)).toBe(
      '/operations-policy#policy-wallet-negative-balance-gate',
    );
  });
});
