import { describe, expect, it } from 'vitest';

import {
  settlementAuditHealth,
  settlementReversalEvidencePolicy,
  type SettlementAuditHealthInput,
} from './settlement-audit-health';

const baseInput: SettlementAuditHealthInput = {
  accountingJournalBatches: [
    {
      entries: [
        { accountCode: 'cash', amount: 600_000, side: 'DEBIT' },
        { accountCode: 'partner_payable', amount: 430_000, side: 'CREDIT' },
        { accountCode: 'tax_withheld', amount: 42_000, side: 'CREDIT' },
        { accountCode: 'platform_fee', amount: 128_000, side: 'CREDIT' },
      ],
      id: 'journal-settlement',
      sourceType: 'BOOKING_SETTLEMENT',
      status: 'POSTED',
      totalCredit: 600_000,
      totalDebit: 600_000,
    },
  ],
  checkedAt: '2026-08-09T00:00:00.000Z',
  currency: 'VND',
  customerPaymentAmount: 600_000,
  monthlyPeriod: '2026-08',
  partnerPayoutAmount: 430_000,
  partnerWithholdingTotal: 42_000,
  paymentClearingEntries: [
    {
      amount: 600_000,
      bankReconciliationMatches: [
        { amount: 600_000, matchedAt: '2026-08-09T01:00:00.000Z', status: 'MATCHED' },
      ],
      id: 'clearing-settlement',
      status: 'CLEARED',
      type: 'SETTLEMENT_POSTED',
    },
  ],
  paymentFeePolicyVersionId: 'fee-policy-1',
  paymentFeeRuleSnapshot: {},
  paymentMethod: 'CARD',
  platformFeeGross: 128_000,
  settlementStatus: 'POSTED',
  taxStatus: 'CLOSED',
};

function reversalJournal(paymentMethod: string) {
  const accountCode =
    paymentMethod === 'CASH'
      ? 'partner_receivable_negative_wallet'
      : paymentMethod === 'CUSTOMER_WALLET'
        ? 'customer_wallet_liability'
        : 'booking_payment_clearing';
  return {
    entries: [
      { accountCode: 'partner_payable', amount: 600_000, side: 'DEBIT' },
      { accountCode, amount: 600_000, side: 'CREDIT' },
    ],
    id: `journal-reversal-${paymentMethod.toLowerCase()}`,
    postedAt: '2026-08-10T00:00:00.000Z',
    sourceType: 'BOOKING_SETTLEMENT_REVERSAL',
    status: 'POSTED',
    totalCredit: 600_000,
    totalDebit: 600_000,
  };
}

function reversedInput(paymentMethod: string, lifecycle: 'OPEN_PERIOD' | 'CLOSED_PERIOD') {
  const externalClearingRequired = settlementReversalEvidencePolicy(paymentMethod).externalClearingRequired;
  return {
    ...baseInput,
    accountingJournalBatches: [...baseInput.accountingJournalBatches!, reversalJournal(paymentMethod)],
    customerWalletRefundLedgerPresent: paymentMethod === 'CUSTOMER_WALLET' ? true : null,
    paymentClearingEntries: [
      ...(externalClearingRequired ? baseInput.paymentClearingEntries! : []),
      ...(externalClearingRequired
        ? [
            {
              amount: -600_000,
              id: `clearing-reversal-${paymentMethod.toLowerCase()}`,
              occurredAt: '2026-08-10T00:00:00.000Z',
              status: 'REVERSED',
              type: 'REFUND_REVERSAL',
            },
          ]
        : []),
    ],
    paymentMethod,
    reversalEntries:
      lifecycle === 'CLOSED_PERIOD'
        ? [
            {
              id: `reversal-entry-${paymentMethod.toLowerCase()}`,
              monthlyPeriod: '2026-09',
              occurredAt: '2026-09-01T00:00:00.000Z',
              originalMonthlyPeriod: '2026-08',
              reason: 'Closed period refund',
            },
          ]
        : [],
    reversalReason: 'Customer refund',
    settlementStatus: 'REVERSED',
    taxStatus: 'REVERSED',
  } satisfies SettlementAuditHealthInput;
}

describe('settlementAuditHealth', () => {
  it.each([
    ['OPEN', '2026-08-20T00:00:00.000Z', 'TAX_OPEN', 'NORMAL'],
    ['DECLARED', '2026-08-11T00:00:00.000Z', 'TAX_DECLARED', 'DUE_SOON'],
    ['OPEN', '2026-08-08T00:00:00.000Z', 'TAX_OPEN', 'OVERDUE'],
    ['DECLARED', null, 'TAX_DECLARED', 'UNKNOWN'],
  ] as const)(
    'keeps %s tax workflow separate from integrity with %s due evidence',
    (taxStatus, taxDueAt, workflowState, urgency) => {
      const health = settlementAuditHealth({ ...baseInput, taxDueAt, taxStatus });

      expect(health.checks.taxPeriod).toBe('PASS');
      expect(health.state).toBe('CLEAR');
      expect(health.workflow).toMatchObject({ dueAt: taxDueAt, state: workflowState, urgency });
      expect(health.blockers.some((blocker) => blocker.code === 'TAX_PERIOD_MISMATCH')).toBe(false);
    },
  );

  it('blocks an invalid settlement period without treating normal tax progress as the integrity error', () => {
    const health = settlementAuditHealth({
      ...baseInput,
      monthlyPeriod: '2026-13',
      taxDueAt: '2026-08-20T00:00:00.000Z',
      taxStatus: 'OPEN',
    });

    expect(health.state).toBe('ACTION_REQUIRED');
    expect(health.checks.taxPeriod).toBe('FAIL');
    expect(health.workflow).toMatchObject({ state: 'TAX_OPEN', urgency: 'BLOCKED' });
    expect(health.blockers.map((blocker) => blocker.code)).toContain('TAX_PERIOD_MISMATCH');
  });

  it.each(
    ['CASH', 'CUSTOMER_WALLET', 'MOMO', 'CARD', 'VNPAY'].flatMap((paymentMethod) =>
      (['OPEN_PERIOD', 'CLOSED_PERIOD'] as const).map((lifecycle) => [paymentMethod, lifecycle] as const),
    ),
  )('applies the %s reversal evidence policy in %s', (paymentMethod, lifecycle) => {
    const health = settlementAuditHealth(reversedInput(paymentMethod, lifecycle));
    const externalClearingRequired = settlementReversalEvidencePolicy(paymentMethod).externalClearingRequired;

    expect(health.checks.reversal).toBe('PASS');
    expect(health.checks.reversalClearing).toBe(externalClearingRequired ? 'PASS' : 'NOT_APPLICABLE');
    expect(health.evidence.reversal).toMatchObject({
      clearingRequired: externalClearingRequired,
      lifecycle,
      state: 'PASS',
    });
    expect(health.state).toBe('REVERSED_CLEAR');
  });

  it.each(
    ['MOMO', 'CARD', 'VNPAY'].flatMap((paymentMethod) =>
      (['OPEN_PERIOD', 'CLOSED_PERIOD'] as const).map((lifecycle) => [paymentMethod, lifecycle] as const),
    ),
  )('fails %s %s reversal when external refund clearing is missing', (paymentMethod, lifecycle) => {
    const input = reversedInput(paymentMethod, lifecycle);
    const health = settlementAuditHealth({
      ...input,
      paymentClearingEntries: baseInput.paymentClearingEntries,
    });

    expect(health.checks.reversalClearing).toBe('FAIL');
    expect(health.checks.reversal).toBe('FAIL');
    expect(health.blockers.map((blocker) => blocker.code)).toContain('REVERSAL_CLEARING_MISSING');
  });

  it('fails a customer wallet reversal when the wallet refund ledger is missing', () => {
    const health = settlementAuditHealth({
      ...reversedInput('CUSTOMER_WALLET', 'OPEN_PERIOD'),
      customerWalletRefundLedgerPresent: false,
    });

    expect(health.checks.reversalClearing).toBe('NOT_APPLICABLE');
    expect(health.checks.reversalLedger).toBe('FAIL');
    expect(health.blockers.map((blocker) => blocker.code)).toContain('REVERSAL_LEDGER_MISSING');
  });

  it('keeps a passed reversal separate from other integrity blockers', () => {
    const health = settlementAuditHealth({
      ...reversedInput('CARD', 'OPEN_PERIOD'),
      partnerPayoutAmount: 429_999,
    });

    expect(health.checks.reversal).toBe('PASS');
    expect(health.state).toBe('ACTION_REQUIRED');
    expect(health.blockers.map((blocker) => blocker.code)).toContain('ALLOCATION_DELTA');
  });

  it('classifies duplicate canonical clearing as an actionable blocker', () => {
    const originalClearing = baseInput.paymentClearingEntries![0]!;
    const health = settlementAuditHealth({
      ...baseInput,
      paymentClearingEntries: [
        originalClearing,
        { ...originalClearing, id: 'clearing-settlement-duplicate' },
      ],
    });

    expect(health.checks.canonicalClearing).toBe('FAIL');
    expect(health.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CANONICAL_CLEARING_DUPLICATE', ownerTeam: 'Finance operations' }),
      ]),
    );
  });

  it('uses the coupon-aware allocation formula without subtracting payment processing fees', () => {
    const health = settlementAuditHealth({
      ...baseInput,
      customerPaymentAmount: 540_000,
      metadata: {
        companyCouponExpense: 60_000,
        couponAccountingTreatmentSnapshot: 'MARKETING_EXPENSE',
        couponCodeSnapshot: 'WELCOME60',
        couponFundingSourceSnapshot: 'COMPANY',
        settlementBaseAmount: 600_000,
        settlementBasePolicySnapshot: 'PRE_COUPON_SERVICE_AMOUNT',
      },
    });

    expect(health.allocation).toMatchObject({ companyCouponExpense: 60_000, delta: 0 });
    expect(health.checks.allocation).toBe('PASS');
    expect(health.checks.couponPolicy).toBe('PASS');
    expect(health.formulaVersion).toBe('CUSTOMER_PLUS_COMPANY_COUPON_V1');
  });

  it('keeps canonical settlement evidence separate from open-period reversal evidence', () => {
    const health = settlementAuditHealth({
      ...baseInput,
      accountingJournalBatches: [
        ...baseInput.accountingJournalBatches!,
        {
          entries: [
            { accountCode: 'partner_payable', amount: 600_000, side: 'DEBIT' },
            { accountCode: 'cash', amount: 600_000, side: 'CREDIT' },
          ],
          id: 'journal-reversal',
          postedAt: '2026-08-10T00:00:00.000Z',
          sourceType: 'BOOKING_SETTLEMENT_REVERSAL',
          status: 'POSTED',
          totalCredit: 600_000,
          totalDebit: 600_000,
        },
      ],
      paymentClearingEntries: [
        ...baseInput.paymentClearingEntries!,
        {
          amount: -600_000,
          id: 'clearing-reversal',
          occurredAt: '2026-08-10T00:00:00.000Z',
          status: 'REVERSED',
          type: 'REFUND_REVERSAL',
        },
      ],
      reversalEntries: [],
      reversalReason: 'Customer refund',
      settlementStatus: 'REVERSED',
      taxStatus: 'REVERSED',
    });

    expect(health.state).toBe('REVERSED_CLEAR');
    expect(health.evidence.canonicalJournal.ids).toEqual(['journal-settlement']);
    expect(health.evidence.canonicalClearing.ids).toEqual(['clearing-settlement']);
    expect(health.evidence.reversal).toMatchObject({
      clearingCount: 1,
      journalCount: 1,
      lifecycle: 'OPEN_PERIOD',
      state: 'PASS',
    });
    expect(health.checks.taxPeriod).toBe('NOT_APPLICABLE');
  });

  it('supports closed-period reversal entries and never clears incomplete reversal evidence', () => {
    const closedPeriod = settlementAuditHealth({
      ...baseInput,
      accountingJournalBatches: [
        ...baseInput.accountingJournalBatches!,
        {
          entries: [
            { accountCode: 'partner_payable', amount: 600_000, side: 'DEBIT' },
            { accountCode: 'cash', amount: 600_000, side: 'CREDIT' },
          ],
          id: 'journal-reversal',
          sourceType: 'BOOKING_SETTLEMENT_REVERSAL',
          status: 'POSTED',
          totalCredit: 600_000,
          totalDebit: 600_000,
        },
      ],
      paymentClearingEntries: [
        ...baseInput.paymentClearingEntries!,
        { amount: -600_000, id: 'clearing-reversal', status: 'REVERSED', type: 'REFUND_REVERSAL' },
      ],
      reversalEntries: [
        {
          id: 'reversal-entry-1',
          monthlyPeriod: '2026-09',
          occurredAt: '2026-09-01T00:00:00.000Z',
          originalMonthlyPeriod: '2026-08',
          reason: 'Closed period refund',
        },
      ],
      settlementStatus: 'REVERSED',
      taxStatus: 'REVERSED',
    });
    const incomplete = settlementAuditHealth({
      ...baseInput,
      reversalReason: 'Refund without accounting evidence',
      settlementStatus: 'REVERSED',
      taxStatus: 'REVERSED',
    });

    expect(closedPeriod.state).toBe('REVERSED_CLEAR');
    expect(closedPeriod.evidence.reversal.lifecycle).toBe('CLOSED_PERIOD');
    expect(incomplete.state).toBe('ACTION_REQUIRED');
    expect(incomplete.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(['REVERSAL_JOURNAL_MISSING', 'REVERSAL_CLEARING_MISSING']),
    );
  });

  it('treats customer wallet clearing and no coupon as neutral policy states', () => {
    const health = settlementAuditHealth({
      ...baseInput,
      paymentClearingEntries: [],
      paymentFeePolicyVersionId: null,
      paymentMethod: 'CUSTOMER_WALLET',
    });

    expect(health.checks.canonicalClearing).toBe('NOT_APPLICABLE');
    expect(health.checks.bankMatch).toBe('NOT_APPLICABLE');
    expect(health.checks.couponPolicy).toBe('NOT_APPLICABLE');
    expect(health.checks.paymentFeePolicy).toBe('NOT_APPLICABLE');
  });

  it('blocks incomplete bank matches, journal delta entries, and missing coupon evidence', () => {
    const health = settlementAuditHealth({
      ...baseInput,
      accountingJournalBatches: [
        {
          ...baseInput.accountingJournalBatches![0]!,
          entries: [
            ...baseInput.accountingJournalBatches![0]!.entries!,
            { accountCode: 'settlement_reconciliation_delta', amount: 0, side: 'DEBIT' },
          ],
        },
      ],
      metadata: { companyCouponExpense: 10_000 },
      paymentClearingEntries: [
        {
          ...baseInput.paymentClearingEntries![0]!,
          bankReconciliationMatches: [{ amount: 500_000, status: 'MATCHED' }],
          status: 'PARTIALLY_CLEARED',
        },
      ],
    });

    expect(health.state).toBe('ACTION_REQUIRED');
    expect(health.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining([
        'BANK_MATCH_INCOMPLETE',
        'CLEARING_STILL_OPEN',
        'COUPON_EVIDENCE_MISSING',
        'RECONCILIATION_DELTA_ENTRY',
      ]),
    );
  });
});
