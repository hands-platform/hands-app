import { describe, expect, it } from 'vitest';
import { partnerControlImpact } from './partner-control-policy';

describe('Partner Control policy', () => {
  it('keeps wallet debt visible while gating acceptance, service start, and payout release', () => {
    const policy = partnerControlImpact('NEGATIVE_WALLET');

    expect(policy.detail).toContain('remain visible');
    expect(policy.impacts).toEqual(['Acceptance', 'Service start', 'Payout release']);
  });

  it('does not turn optional tax records into an operating gate', () => {
    const policy = partnerControlImpact('OPTIONAL_TAX');

    expect(policy.impacts).toEqual(['No operating gate']);
    expect(policy.detail).toContain('does not block');
  });
});
