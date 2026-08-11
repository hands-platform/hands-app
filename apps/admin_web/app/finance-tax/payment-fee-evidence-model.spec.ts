import { describe, expect, it } from 'vitest';

import { paymentFeeEvidenceState } from './payment-fee-evidence-model';

describe('payment fee evidence model', () => {
  it('flags posted settlements without a retained policy version', () => {
    expect(
      paymentFeeEvidenceState({
        paymentMethod: 'CARD',
        paymentFeePolicyVersionId: null,
        paymentFeeRuleSnapshot: { reason: 'No active payment fee policy matched CARD.' },
      }),
    ).toEqual({
      detail: 'No active payment fee policy matched CARD.',
      label: 'Policy missing',
      reason: 'No active payment fee policy matched CARD.',
      tone: 'warning',
    });
  });

  it('flags a retained policy that used a fallback rule', () => {
    expect(
      paymentFeeEvidenceState({
        paymentMethod: 'MOMO',
        paymentFeePolicyVersionId: 'policy-1',
        paymentFeeRuleSnapshot: { reason: 'MOMO rule was not configured.' },
      }),
    ).toMatchObject({ label: 'Rule fallback', tone: 'warning' });
  });

  it('accepts a retained policy without a fallback reason', () => {
    expect(
      paymentFeeEvidenceState({
        paymentMethod: 'MOMO',
        paymentFeePolicyVersionId: 'policy-1',
        paymentFeeRuleSnapshot: { method: 'MOMO', ruleId: 'rule-1' },
      }),
    ).toEqual({
      detail: 'Policy policy-1 is retained on the settlement.',
      label: 'Policy linked',
      reason: null,
      tone: 'success',
    });
  });

  it('does not flag cash or wallet settlements as missing processor fee policy', () => {
    expect(
      paymentFeeEvidenceState({
        paymentFeePolicyVersionId: null,
        paymentFeeRuleSnapshot: null,
        paymentMethod: 'CASH',
      }),
    ).toMatchObject({ label: 'Not applicable', tone: 'success' });

    expect(
      paymentFeeEvidenceState({
        paymentFeePolicyVersionId: null,
        paymentFeeRuleSnapshot: null,
        paymentMethod: 'CUSTOMER_WALLET',
      }),
    ).toMatchObject({ label: 'Not applicable', tone: 'success' });
  });
});
