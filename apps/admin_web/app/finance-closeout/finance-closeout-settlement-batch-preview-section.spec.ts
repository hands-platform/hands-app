import { financeCloseoutSettlementReviewReasons } from './finance-closeout-settlement-batch-preview-section';

describe('financeCloseoutSettlementReviewReasons', () => {
  it('deduplicates the same blocker and policy message while preserving both codes', () => {
    const reasons = financeCloseoutSettlementReviewReasons({
      blockers: [{ code: 'COMPLETION_TIME_EVIDENCE_MISSING', message: 'Completion evidence is missing.' }],
      policyExceptionCodes: ['TECHNICAL_ELIGIBILITY_V1'],
      policyReasons: ['Completion evidence is missing.'],
    });

    expect(reasons).toEqual([
      expect.objectContaining({
        codes: ['COMPLETION_TIME_EVIDENCE_MISSING', 'TECHNICAL_ELIGIBILITY_V1'],
        message: 'Completion evidence is missing.',
      }),
    ]);
  });

  it('deduplicates different codes with case and whitespace-equivalent operator messages', () => {
    const reasons = financeCloseoutSettlementReviewReasons({
      blockers: [{ code: 'PAYMENT_MISSING', message: ' Payment evidence   is missing. ' }],
      policyExceptionCodes: ['PAYMENT_POLICY_BLOCKED'],
      policyReasons: ['payment evidence is missing.'],
    });

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatchObject({
      codes: ['PAYMENT_MISSING', 'PAYMENT_POLICY_BLOCKED'],
      message: 'Payment evidence is missing.',
    });
  });

  it('keeps genuinely different operator reasons separate', () => {
    const reasons = financeCloseoutSettlementReviewReasons({
      blockers: [{ code: 'PAYMENT_MISSING', message: 'Payment evidence is missing.' }],
      policyExceptionCodes: ['MONTHLY_PERIOD_FINALIZED'],
      policyReasons: ['Monthly close is finalized.'],
    });

    expect(reasons.map((reason) => reason.message)).toEqual([
      'Payment evidence is missing.',
      'Monthly close is finalized.',
    ]);
  });
});
