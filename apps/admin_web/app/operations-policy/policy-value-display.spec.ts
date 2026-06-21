import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { formatPolicyValue, policyDisplayByKey, policyDisplayValue } from './policy-value-display';

describe('policy value display helpers', () => {
  it('formats distance and duration policy values for operators', () => {
    expect(formatPolicyValue(12500, 'meters')).toBe('12.5 km');
    expect(formatPolicyValue(10, 'minutes')).toBe('10 min');
  });

  it('uses configured option labels before raw enum text', () => {
    const setting = {
      key: 'matching.preferred_accept_mode',
      value: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
      recommendedValue: 'FIRST_ACCEPTED_AUTO_MATCH',
      options: [
        {
          label: 'Customer final confirm after accept',
          tradeoff: 'Customer chooses from accepted Partners.',
          value: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
        },
        {
          label: 'First accepted auto match',
          tradeoff: 'Fastest accepted Partner wins automatically.',
          value: 'FIRST_ACCEPTED_AUTO_MATCH',
        },
      ],
    } as AdminOperationalPolicySetting;

    expect(policyDisplayValue(setting)).toBe('Customer final confirm after accept');
    expect(policyDisplayValue(setting, true)).toBe('First accepted auto match');
  });

  it('shows saved wallet gate values as final gate controls', () => {
    const setting = {
      key: 'wallet.negative_balance_gate',
      value: 'BLOCK_MARKETPLACE_PARTICIPATION',
      recommendedValue: 'BLOCK_MARKETPLACE_PARTICIPATION',
      options: [
        {
          label: 'Block Marketplace Participation',
          tradeoff: 'Historical copy from the old marketplace blocking policy.',
          value: 'BLOCK_MARKETPLACE_PARTICIPATION',
        },
      ],
    } as AdminOperationalPolicySetting;

    expect(policyDisplayValue(setting)).toBe('Final Gate Hold');
    expect(policyDisplayValue(setting, true)).toBe('Final Gate Hold');
  });

  it('reads display values by canonical or legacy policy key', () => {
    const settings = [
      {
        key: 'matching.backup_provider_radius_meters',
        label: 'Legacy radius',
        unit: 'meters',
        value: 5000,
      },
    ] as AdminOperationalPolicySetting[];

    expect(policyDisplayByKey(settings, 'matching.marketplace_partner_radius_meters')).toBe('5 km');
    expect(policyDisplayByKey([], 'missing.policy')).toBe('Not configured');
  });
});
