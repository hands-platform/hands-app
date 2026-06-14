import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { formatPolicyValue, policyDisplayValue } from './policy-value-display';

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
});
