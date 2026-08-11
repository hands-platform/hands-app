export type SettlementAuditState = 'CLEAR' | 'ACTION_REQUIRED' | 'REVERSED_CLEAR' | 'UNKNOWN';

export type SettlementAuditCheckState = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type SettlementAuditWorkflowState =
  | 'TAX_OPEN'
  | 'TAX_DECLARED'
  | 'TAX_PAID'
  | 'TAX_CLOSED'
  | 'REVERSED'
  | 'UNKNOWN';

export type SettlementAuditUrgency = 'NORMAL' | 'DUE_SOON' | 'OVERDUE' | 'BLOCKED' | 'UNKNOWN';

export type SettlementAuditBlockerCode =
  | 'ALLOCATION_DELTA'
  | 'CANONICAL_JOURNAL_MISSING'
  | 'CANONICAL_JOURNAL_NOT_POSTED'
  | 'CANONICAL_JOURNAL_DUPLICATE'
  | 'JOURNAL_HEADER_UNBALANCED'
  | 'JOURNAL_ENTRY_UNBALANCED'
  | 'JOURNAL_HEADER_ENTRY_MISMATCH'
  | 'RECONCILIATION_DELTA_ENTRY'
  | 'CANONICAL_CLEARING_DUPLICATE'
  | 'CANONICAL_CLEARING_MISSING'
  | 'CLEARING_AMOUNT_MISMATCH'
  | 'CLEARING_STILL_OPEN'
  | 'BANK_MATCH_INCOMPLETE'
  | 'PAYMENT_FEE_POLICY_MISSING'
  | 'COUPON_EVIDENCE_MISSING'
  | 'TAX_PERIOD_MISMATCH'
  | 'REVERSAL_JOURNAL_MISSING'
  | 'REVERSAL_CLEARING_MISSING'
  | 'REVERSAL_LEDGER_MISSING'
  | 'REVERSAL_AMOUNT_MISMATCH'
  | 'REVERSAL_EVIDENCE_INCONSISTENT';

export type SettlementAuditBlocker = {
  amount?: number;
  blockingCloseout: boolean;
  code: SettlementAuditBlockerCode;
  dueAt: string | null;
  nextAction: string;
  owner: 'Accounting' | 'Finance operations' | 'Tax & Period Close';
  ownerTeam: 'Accounting' | 'Finance operations' | 'Tax & Period Close';
  priority: number;
  remediationHref: string;
  severity: 'BLOCKER' | 'WARNING';
};

type AddSettlementAuditBlocker = (
  blocker: Omit<
    SettlementAuditBlocker,
    'blockingCloseout' | 'dueAt' | 'owner' | 'priority' | 'remediationHref'
  >,
) => void;

export type SettlementAuditEvidenceSummary = {
  count: number;
  ids: string[];
  state: SettlementAuditCheckState;
};

export type SettlementAuditHealth = {
  allocation: {
    companyCouponExpense: number;
    customerPaymentAmount: number;
    delta: number;
    partnerPayoutAmount: number;
    partnerWithholdingTotal: number;
    platformFeeGross: number;
  };
  blockers: SettlementAuditBlocker[];
  checkedAt: string;
  checks: {
    allocation: SettlementAuditCheckState;
    bankMatch: SettlementAuditCheckState;
    canonicalClearing: SettlementAuditCheckState;
    canonicalJournal: SettlementAuditCheckState;
    couponPolicy: SettlementAuditCheckState;
    paymentFeePolicy: SettlementAuditCheckState;
    reversal: SettlementAuditCheckState;
    reversalClearing: SettlementAuditCheckState;
    reversalLedger: SettlementAuditCheckState;
    taxPeriod: SettlementAuditCheckState;
  };
  evidence: {
    canonicalClearing: SettlementAuditEvidenceSummary & {
      matchedAmount: number;
      required: boolean;
      unmatchedAmount: number;
    };
    canonicalJournal: SettlementAuditEvidenceSummary;
    reversal: SettlementAuditEvidenceSummary & {
      clearingCount: number;
      clearingRequired: boolean;
      journalCount: number;
      ledgerEvidence: SettlementAuditCheckState;
      ledgerType: 'CASH_RECEIVABLE_JOURNAL' | 'CUSTOMER_WALLET_REFUND' | 'EXTERNAL_CLEARING' | 'NONE';
      lifecycle: 'NONE' | 'OPEN_PERIOD' | 'CLOSED_PERIOD';
      reason: string | null;
      reversedAt: string | null;
      reversalPeriod: string | null;
    };
  };
  formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1';
  state: SettlementAuditState;
  workflow: {
    dueAt: string | null;
    reason: string;
    state: SettlementAuditWorkflowState;
    urgency: SettlementAuditUrgency;
  };
};

type AuditJournalEntry = {
  accountCode: string;
  amount: number;
  side: string;
};

type AuditJournal = {
  entries?: AuditJournalEntry[];
  id: string;
  postedAt?: Date | string | null;
  sourceType: string;
  status: string;
  totalCredit: number;
  totalDebit: number;
};

type AuditClearing = {
  amount: number;
  bankReconciliationMatches?: Array<{
    amount: number;
    matchedAt?: Date | string | null;
    status: string;
  }>;
  id: string;
  occurredAt?: Date | string | null;
  status: string;
  type: string;
};

type AuditReversalEntry = {
  id: string;
  monthlyPeriod?: string | null;
  occurredAt?: Date | string | null;
  originalMonthlyPeriod?: string | null;
  reason?: string | null;
};

export type SettlementAuditHealthInput = {
  accountingJournalBatches?: AuditJournal[];
  bookingId?: string;
  checkedAt?: Date | string;
  closedAt?: Date | string | null;
  currency: string;
  customerPaymentAmount: number;
  metadata?: unknown;
  monthlyPeriod: string;
  id?: string;
  partnerPayoutAmount: number;
  partnerWithholdingTotal: number;
  paymentClearingEntries?: AuditClearing[];
  paymentFeePolicyVersionId?: string | null;
  paymentFeeRuleSnapshot?: unknown;
  paymentMethod: string;
  platformFeeGross: number;
  reversalEntries?: AuditReversalEntry[];
  reversalReason?: string | null;
  reversedById?: string | null;
  customerWalletRefundLedgerPresent?: boolean | null;
  settlementStatus: string;
  taxDueAt?: Date | string | null;
  taxStatus: string;
};

export type SettlementReversalEvidencePolicy = {
  externalClearingRequired: boolean;
  ledgerType: 'CASH_RECEIVABLE_JOURNAL' | 'CUSTOMER_WALLET_REFUND' | 'EXTERNAL_CLEARING';
};

export type SettlementAllocationIdentityInput = {
  readonly companyCouponExpense?: number;
  readonly customerPaymentAmount: number;
  readonly partnerPayoutAmount: number;
  readonly partnerWithholdingTotal: number;
  readonly platformFeeGross: number;
};

export function settlementAllocationIdentity(input: SettlementAllocationIdentityInput) {
  const companyCouponExpense = finiteNumber(input.companyCouponExpense);
  const customerPaymentAmount = finiteNumber(input.customerPaymentAmount);
  const partnerPayoutAmount = finiteNumber(input.partnerPayoutAmount);
  const partnerWithholdingTotal = finiteNumber(input.partnerWithholdingTotal);
  const platformFeeGross = finiteNumber(input.platformFeeGross);

  return {
    companyCouponExpense,
    customerPaymentAmount,
    delta:
      customerPaymentAmount +
      companyCouponExpense -
      partnerPayoutAmount -
      partnerWithholdingTotal -
      platformFeeGross,
    partnerPayoutAmount,
    partnerWithholdingTotal,
    platformFeeGross,
  };
}

const EXTERNAL_CLEARING_METHODS = new Set(['BANK_TRANSFER', 'CARD', 'MANUAL', 'MOMO', 'VNPAY']);
const PROCESSOR_FEE_METHODS = new Set(['CARD', 'MOMO', 'VNPAY']);
const TAX_DUE_SOON_WINDOW_MS = 72 * 60 * 60 * 1_000;

export function settlementReversalEvidencePolicy(paymentMethod: string): SettlementReversalEvidencePolicy {
  if (paymentMethod === 'CASH') {
    return { externalClearingRequired: false, ledgerType: 'CASH_RECEIVABLE_JOURNAL' };
  }
  if (paymentMethod === 'CUSTOMER_WALLET') {
    return { externalClearingRequired: false, ledgerType: 'CUSTOMER_WALLET_REFUND' };
  }
  return { externalClearingRequired: true, ledgerType: 'EXTERNAL_CLEARING' };
}

export function settlementAuditHealth(input: SettlementAuditHealthInput): SettlementAuditHealth {
  const checkedAt = toIsoString(input.checkedAt) ?? new Date().toISOString();
  const metadata = jsonRecord(input.metadata);
  const customerPaymentAmount = finiteNumber(input.customerPaymentAmount);
  const partnerPayoutAmount = finiteNumber(input.partnerPayoutAmount);
  const partnerWithholdingTotal = finiteNumber(input.partnerWithholdingTotal);
  const platformFeeGross = finiteNumber(input.platformFeeGross);
  const companyCouponExpense = nonNegativeNumber(metadata?.companyCouponExpense);
  const allocation = settlementAllocationIdentity({
    companyCouponExpense,
    customerPaymentAmount,
    partnerPayoutAmount,
    partnerWithholdingTotal,
    platformFeeGross,
  });
  const allocationDelta = allocation.delta;
  const blockers: SettlementAuditBlocker[] = [];
  const addBlocker: AddSettlementAuditBlocker = (blocker) => {
    if (!blockers.some((item) => item.code === blocker.code)) {
      blockers.push({
        ...blocker,
        blockingCloseout: blocker.severity === 'BLOCKER',
        dueAt: null,
        owner: blocker.ownerTeam,
        priority: settlementAuditBlockerPriority(blocker.code),
        remediationHref: settlementAuditRemediationHref(blocker.code, input),
      });
    }
  };

  const canonicalJournals = (input.accountingJournalBatches ?? []).filter(
    (journal) => journal.sourceType === 'BOOKING_SETTLEMENT',
  );
  const reversalJournals = (input.accountingJournalBatches ?? []).filter(
    (journal) => journal.sourceType === 'BOOKING_SETTLEMENT_REVERSAL',
  );
  const canonicalClearings = (input.paymentClearingEntries ?? []).filter(
    (entry) => entry.type === 'SETTLEMENT_POSTED' || entry.type === 'CUSTOMER_PAYMENT_CAPTURED',
  );
  const reversalClearings = (input.paymentClearingEntries ?? []).filter(
    (entry) => entry.type === 'REFUND_REVERSAL',
  );
  const reversalEntries = input.reversalEntries ?? [];
  const reversalSignal =
    input.settlementStatus === 'REVERSED' ||
    input.taxStatus === 'REVERSED' ||
    reversalEntries.length > 0 ||
    reversalJournals.length > 0 ||
    reversalClearings.length > 0 ||
    Boolean(input.reversalReason || input.reversedById);

  const allocationState = allocationDelta === 0 ? 'PASS' : 'FAIL';
  if (allocationState === 'FAIL') {
    addBlocker({
      amount: Math.abs(allocationDelta),
      code: 'ALLOCATION_DELTA',
      nextAction: 'Review settlement amounts and coupon allocation.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
  }

  const canonicalJournal = journalCheck(canonicalJournals, false, addBlocker);
  const clearingRequired = EXTERNAL_CLEARING_METHODS.has(input.paymentMethod);
  const canonicalClearingResult = canonicalClearingCheck(
    canonicalClearings,
    clearingRequired,
    customerPaymentAmount,
    addBlocker,
  );
  const couponPolicy = couponCheck(metadata, companyCouponExpense, addBlocker);
  const paymentFeePolicy = paymentFeeCheck(input, addBlocker);
  const taxResult = taxCheck(input, metadata, checkedAt, reversalSignal, addBlocker);
  const reversalPolicy = settlementReversalEvidencePolicy(input.paymentMethod);
  const reversalResult = reversalCheck(
    {
      customerPaymentAmount,
      customerWalletRefundLedgerPresent: input.customerWalletRefundLedgerPresent,
      paymentMethod: input.paymentMethod,
      policy: reversalPolicy,
      reversalClearings,
      reversalEntries,
      reversalJournals,
      reversalReason: input.reversalReason,
      reversalSignal,
    },
    addBlocker,
  );

  const checks = {
    allocation: allocationState,
    bankMatch: canonicalClearingResult.bankMatch,
    canonicalClearing: canonicalClearingResult.state,
    canonicalJournal,
    couponPolicy,
    paymentFeePolicy,
    reversal: reversalResult.state,
    reversalClearing: reversalResult.clearingState,
    reversalLedger: reversalResult.ledgerState,
    taxPeriod: taxResult.check,
  } satisfies SettlementAuditHealth['checks'];
  const hasUnknown = Object.values(checks).includes('UNKNOWN');
  const state: SettlementAuditState = blockers.some((blocker) => blocker.severity === 'BLOCKER')
    ? 'ACTION_REQUIRED'
    : reversalSignal && reversalResult.state === 'PASS'
      ? 'REVERSED_CLEAR'
      : hasUnknown
        ? 'UNKNOWN'
        : 'CLEAR';

  return {
    allocation,
    blockers: blockers.sort((left, right) => left.priority - right.priority || left.code.localeCompare(right.code)),
    checkedAt,
    checks,
    evidence: {
      canonicalClearing: {
        count: canonicalClearings.length,
        ids: canonicalClearings.map((entry) => entry.id),
        matchedAmount: canonicalClearingResult.matchedAmount,
        required: clearingRequired,
        state: canonicalClearingResult.state,
        unmatchedAmount: canonicalClearingResult.unmatchedAmount,
      },
      canonicalJournal: {
        count: canonicalJournals.length,
        ids: canonicalJournals.map((journal) => journal.id),
        state: canonicalJournal,
      },
      reversal: {
        clearingCount: reversalClearings.length,
        clearingRequired: reversalPolicy.externalClearingRequired,
        count: reversalEntries.length || Math.max(reversalJournals.length, reversalClearings.length),
        ids: reversalEntries.map((entry) => entry.id),
        journalCount: reversalJournals.length,
        ledgerEvidence: reversalResult.ledgerState,
        ledgerType: reversalSignal ? reversalPolicy.ledgerType : 'NONE',
        lifecycle: reversalResult.lifecycle,
        reason: stringValue(reversalEntries[0]?.reason) ?? stringValue(input.reversalReason),
        reversedAt:
          toIsoString(reversalEntries[0]?.occurredAt) ??
          toIsoString(reversalJournals[0]?.postedAt) ??
          toIsoString(reversalClearings[0]?.occurredAt) ??
          toIsoString(input.closedAt),
        reversalPeriod: stringValue(reversalEntries[0]?.monthlyPeriod),
        state: reversalResult.state,
      },
    },
    formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1',
    state,
    workflow: taxResult.workflow,
  };
}

export function settlementAuditBlockerPriority(code: SettlementAuditBlockerCode) {
  if (
    code === 'ALLOCATION_DELTA' ||
    code === 'JOURNAL_HEADER_UNBALANCED' ||
    code === 'JOURNAL_ENTRY_UNBALANCED' ||
    code === 'JOURNAL_HEADER_ENTRY_MISMATCH' ||
    code === 'RECONCILIATION_DELTA_ENTRY'
  ) {
    return 10;
  }
  if (code.startsWith('REVERSAL_')) return 20;
  if (code.includes('JOURNAL')) return 30;
  if (code.includes('CLEARING') || code === 'BANK_MATCH_INCOMPLETE') return 40;
  if (code === 'PAYMENT_FEE_POLICY_MISSING') return 50;
  if (code === 'COUPON_EVIDENCE_MISSING') return 60;
  return 70;
}

function settlementAuditRemediationHref(
  code: SettlementAuditBlockerCode,
  input: Pick<SettlementAuditHealthInput, 'bookingId' | 'id' | 'monthlyPeriod'>,
) {
  const bookingId = input.bookingId ? encodeURIComponent(input.bookingId) : null;
  const snapshotId = input.id ? encodeURIComponent(input.id) : null;
  if (code.includes('CLEARING') || code === 'BANK_MATCH_INCOMPLETE') {
    return `/finance-tax/payment-clearing${bookingId ? `?bookingId=${bookingId}` : ''}`;
  }
  if (code === 'PAYMENT_FEE_POLICY_MISSING') {
    return `/finance-tax/payment-fees${bookingId ? `?bookingId=${bookingId}` : ''}`;
  }
  if (code === 'COUPON_EVIDENCE_MISSING') {
    return `/finance-tax/coupon-finance${bookingId ? `?bookingId=${bookingId}` : ''}`;
  }
  if (code === 'TAX_PERIOD_MISMATCH') {
    return `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(input.monthlyPeriod)}`;
  }
  return snapshotId
    ? `/finance-tax/booking-settlement-audit/${snapshotId}`
    : '/finance-tax/booking-settlement-audit';
}

function journalCheck(
  journals: AuditJournal[],
  reversal: boolean,
  addBlocker: AddSettlementAuditBlocker,
): SettlementAuditCheckState {
  const missingCode = reversal ? 'REVERSAL_JOURNAL_MISSING' : 'CANONICAL_JOURNAL_MISSING';
  if (journals.length === 0) {
    addBlocker({
      code: missingCode,
      nextAction: reversal ? 'Review the refund reversal journal.' : 'Review the booking settlement journal.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
    return 'FAIL';
  }
  if (journals.length > 1) {
    addBlocker({
      code: reversal ? 'REVERSAL_EVIDENCE_INCONSISTENT' : 'CANONICAL_JOURNAL_DUPLICATE',
      nextAction: 'Review duplicate journal evidence before closeout.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
  }

  const journal = journals[0];
  if (!journal) return 'UNKNOWN';
  let failed = journals.length > 1;
  if (journal.status !== 'POSTED') {
    addBlocker({
      code: reversal ? 'REVERSAL_EVIDENCE_INCONSISTENT' : 'CANONICAL_JOURNAL_NOT_POSTED',
      nextAction: 'Review the journal posting state.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
    failed = true;
  }
  if (journal.totalDebit !== journal.totalCredit) {
    addBlocker({
      amount: Math.abs(journal.totalDebit - journal.totalCredit),
      code: 'JOURNAL_HEADER_UNBALANCED',
      nextAction: 'Review journal header debit and credit totals.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
    failed = true;
  }

  const entries = journal.entries ?? [];
  if (entries.length === 0) {
    addBlocker({
      code: 'JOURNAL_HEADER_ENTRY_MISMATCH',
      nextAction: 'Review missing journal line evidence.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
    failed = true;
  } else {
    const debit = entries.filter((entry) => entry.side === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0);
    const credit = entries.filter((entry) => entry.side === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0);
    if (debit !== credit) {
      addBlocker({
        amount: Math.abs(debit - credit),
        code: 'JOURNAL_ENTRY_UNBALANCED',
        nextAction: 'Review journal line debit and credit totals.',
        ownerTeam: 'Accounting',
        severity: 'BLOCKER',
      });
      failed = true;
    }
    if (debit !== journal.totalDebit || credit !== journal.totalCredit) {
      addBlocker({
        amount: Math.max(Math.abs(debit - journal.totalDebit), Math.abs(credit - journal.totalCredit)),
        code: 'JOURNAL_HEADER_ENTRY_MISMATCH',
        nextAction: 'Reconcile journal header totals with journal lines.',
        ownerTeam: 'Accounting',
        severity: 'BLOCKER',
      });
      failed = true;
    }
    if (entries.some((entry) => entry.accountCode === 'settlement_reconciliation_delta')) {
      addBlocker({
        code: 'RECONCILIATION_DELTA_ENTRY',
        nextAction: 'Review the explicit settlement reconciliation delta account.',
        ownerTeam: 'Accounting',
        severity: 'BLOCKER',
      });
      failed = true;
    }
  }
  return failed ? 'FAIL' : 'PASS';
}

function canonicalClearingCheck(
  clearings: AuditClearing[],
  required: boolean,
  expectedAmount: number,
  addBlocker: AddSettlementAuditBlocker,
) {
  if (!required) {
    return { bankMatch: 'NOT_APPLICABLE', matchedAmount: 0, state: 'NOT_APPLICABLE', unmatchedAmount: 0 } as const;
  }
  if (clearings.length === 0) {
    addBlocker({
      amount: expectedAmount,
      code: 'CANONICAL_CLEARING_MISSING',
      nextAction: 'Review payment clearing evidence.',
      ownerTeam: 'Finance operations',
      severity: 'BLOCKER',
    });
    return { bankMatch: 'FAIL', matchedAmount: 0, state: 'FAIL', unmatchedAmount: expectedAmount } as const;
  }

  const clearing = clearings[0];
  if (!clearing) {
    return { bankMatch: 'UNKNOWN', matchedAmount: 0, state: 'UNKNOWN', unmatchedAmount: expectedAmount } as const;
  }
  let failed = clearings.length > 1;
  if (clearings.length > 1) {
    addBlocker({
      code: 'CANONICAL_CLEARING_DUPLICATE',
      nextAction: 'Review duplicate canonical clearing evidence before closeout.',
      ownerTeam: 'Finance operations',
      severity: 'BLOCKER',
    });
  }
  if (clearing.amount !== expectedAmount) {
    addBlocker({
      amount: Math.abs(clearing.amount - expectedAmount),
      code: 'CLEARING_AMOUNT_MISMATCH',
      nextAction: 'Reconcile the clearing amount with the customer payment.',
      ownerTeam: 'Finance operations',
      severity: 'BLOCKER',
    });
    failed = true;
  }
  if (clearing.status !== 'CLEARED') {
    addBlocker({
      amount: expectedAmount,
      code: 'CLEARING_STILL_OPEN',
      nextAction: 'Complete payment clearing and bank reconciliation.',
      ownerTeam: 'Finance operations',
      severity: 'BLOCKER',
    });
    failed = true;
  }
  const matchedAmount = (clearing.bankReconciliationMatches ?? [])
    .filter((match) => match.status === 'MATCHED')
    .reduce((sum, match) => sum + Math.abs(match.amount), 0);
  const unmatchedAmount = Math.max(0, expectedAmount - matchedAmount);
  const bankMatch = unmatchedAmount === 0 ? 'PASS' : 'FAIL';
  if (bankMatch === 'FAIL') {
    addBlocker({
      amount: unmatchedAmount,
      code: 'BANK_MATCH_INCOMPLETE',
      nextAction: 'Match the remaining clearing amount to bank evidence.',
      ownerTeam: 'Finance operations',
      severity: 'BLOCKER',
    });
    failed = true;
  }
  return {
    bankMatch: bankMatch as SettlementAuditCheckState,
    matchedAmount,
    state: (failed ? 'FAIL' : 'PASS') as SettlementAuditCheckState,
    unmatchedAmount,
  };
}

function reversalCheck(
  input: {
    customerPaymentAmount: number;
    customerWalletRefundLedgerPresent?: boolean | null;
    paymentMethod: string;
    policy: SettlementReversalEvidencePolicy;
    reversalClearings: AuditClearing[];
    reversalEntries: AuditReversalEntry[];
    reversalJournals: AuditJournal[];
    reversalReason?: string | null;
    reversalSignal: boolean;
  },
  addBlocker: AddSettlementAuditBlocker,
) {
  if (!input.reversalSignal) {
    return {
      clearingState: 'NOT_APPLICABLE',
      ledgerState: 'NOT_APPLICABLE',
      lifecycle: 'NONE',
      state: 'NOT_APPLICABLE',
    } as const;
  }
  const lifecycle = input.reversalEntries.length > 0 ? 'CLOSED_PERIOD' : 'OPEN_PERIOD';
  const journalState = journalCheck(input.reversalJournals, true, addBlocker);
  let failed = journalState !== 'PASS';
  let clearingState: SettlementAuditCheckState = 'NOT_APPLICABLE';
  if (input.policy.externalClearingRequired) {
    const clearing = input.reversalClearings[0];
    if (!clearing) {
      addBlocker({
        amount: input.customerPaymentAmount,
        code: 'REVERSAL_CLEARING_MISSING',
        nextAction: 'Open payment clearing and attach the external refund evidence.',
        ownerTeam: 'Finance operations',
        severity: 'BLOCKER',
      });
      clearingState = 'FAIL';
      failed = true;
    } else if (clearing.amount !== -input.customerPaymentAmount || clearing.status !== 'REVERSED') {
      addBlocker({
        amount: Math.abs(clearing.amount + input.customerPaymentAmount),
        code: 'REVERSAL_AMOUNT_MISMATCH',
        nextAction: 'Reconcile the external refund amount and reversal status.',
        ownerTeam: 'Finance operations',
        severity: 'BLOCKER',
      });
      clearingState = 'FAIL';
      failed = true;
    } else {
      clearingState = 'PASS';
    }
  }

  let ledgerState: SettlementAuditCheckState = 'NOT_APPLICABLE';
  const reversalAccounts = new Set(
    input.reversalJournals.flatMap((journal) => (journal.entries ?? []).map((entry) => entry.accountCode)),
  );
  if (input.policy.ledgerType === 'CASH_RECEIVABLE_JOURNAL') {
    ledgerState =
      reversalAccounts.has('partner_receivable_negative_wallet') ||
      reversalAccounts.has('partner_wallet_liability')
        ? 'PASS'
        : 'FAIL';
  } else if (input.policy.ledgerType === 'CUSTOMER_WALLET_REFUND') {
    const reversalJournalPresent = reversalAccounts.has('customer_wallet_liability');
    ledgerState =
      input.customerWalletRefundLedgerPresent === null || input.customerWalletRefundLedgerPresent === undefined
        ? 'UNKNOWN'
        : reversalJournalPresent && input.customerWalletRefundLedgerPresent
          ? 'PASS'
          : 'FAIL';
  }
  if (ledgerState === 'FAIL') {
    addBlocker({
      amount: input.customerPaymentAmount,
      code: 'REVERSAL_LEDGER_MISSING',
      nextAction:
        input.paymentMethod === 'CUSTOMER_WALLET'
          ? 'Review the customer wallet refund ledger and reversal journal.'
          : 'Review the cash receivable reversal journal.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
    failed = true;
  }
  if (input.reversalClearings.length > 1 || input.reversalEntries.length > 1) {
    addBlocker({
      code: 'REVERSAL_EVIDENCE_INCONSISTENT',
      nextAction: 'Review duplicate reversal evidence.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
    failed = true;
  }
  const unknown = ledgerState === 'UNKNOWN';
  return {
    clearingState,
    ledgerState,
    lifecycle,
    state: failed ? 'FAIL' : unknown ? 'UNKNOWN' : 'PASS',
  } as const;
}

function couponCheck(
  metadata: Record<string, unknown> | null,
  companyCouponExpense: number,
  addBlocker: AddSettlementAuditBlocker,
): SettlementAuditCheckState {
  if (companyCouponExpense === 0) return 'NOT_APPLICABLE';
  const complete = Boolean(
    (stringValue(metadata?.couponId) || stringValue(metadata?.couponCodeSnapshot)) &&
      stringValue(metadata?.couponFundingSourceSnapshot) === 'COMPANY' &&
      stringValue(metadata?.couponAccountingTreatmentSnapshot) &&
      stringValue(metadata?.settlementBasePolicySnapshot) &&
      nonNegativeNumber(metadata?.settlementBaseAmount) > 0 &&
      !stringValue(metadata?.couponReviewFlag),
  );
  if (!complete) {
    addBlocker({
      amount: companyCouponExpense,
      code: 'COUPON_EVIDENCE_MISSING',
      nextAction: 'Review the coupon reference, funding, accounting, and settlement-base evidence.',
      ownerTeam: 'Accounting',
      severity: 'BLOCKER',
    });
  }
  return complete ? 'PASS' : 'FAIL';
}

function paymentFeeCheck(
  input: SettlementAuditHealthInput,
  addBlocker: AddSettlementAuditBlocker,
): SettlementAuditCheckState {
  if (!PROCESSOR_FEE_METHODS.has(input.paymentMethod)) return 'NOT_APPLICABLE';
  const fallbackReason = stringValue(jsonRecord(input.paymentFeeRuleSnapshot)?.reason);
  if (!input.paymentFeePolicyVersionId || fallbackReason) {
    addBlocker({
      code: 'PAYMENT_FEE_POLICY_MISSING',
      nextAction: 'Review the retained payment fee policy evidence.',
      ownerTeam: 'Finance operations',
      severity: 'BLOCKER',
    });
    return 'FAIL';
  }
  return 'PASS';
}

function taxCheck(
  input: SettlementAuditHealthInput,
  metadata: Record<string, unknown> | null,
  checkedAt: string,
  reversal: boolean,
  addBlocker: AddSettlementAuditBlocker,
): {
  check: SettlementAuditCheckState;
  workflow: SettlementAuditHealth['workflow'];
} {
  if (reversal) {
    return {
      check: 'NOT_APPLICABLE',
      workflow: {
        dueAt: null,
        reason: 'The settlement was reversed; tax closeout no longer applies to the original record.',
        state: 'REVERSED',
        urgency: 'NORMAL',
      },
    };
  }

  const dueAt =
    toIsoString(input.taxDueAt) ??
    toIsoString(stringValue(metadata?.taxDueAt)) ??
    toIsoString(stringValue(metadata?.taxDueDate));
  const workflowState = taxWorkflowState(input.taxStatus);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.monthlyPeriod)) {
    addBlocker({
      code: 'TAX_PERIOD_MISMATCH',
      nextAction: 'Review the settlement accounting period.',
      ownerTeam: 'Tax & Period Close',
      severity: 'BLOCKER',
    });
    return {
      check: 'FAIL',
      workflow: {
        dueAt,
        reason: 'The settlement period is invalid and must be corrected before closeout.',
        state: workflowState,
        urgency: 'BLOCKED',
      },
    };
  }
  if (input.taxStatus === 'OPEN' || input.taxStatus === 'DECLARED') {
    const urgency = taxWorkflowUrgency(checkedAt, dueAt);
    return {
      check: 'PASS',
      workflow: {
        dueAt,
        reason:
          urgency === 'UNKNOWN'
            ? 'The tax due date is not recorded, so urgency cannot be confirmed.'
            : urgency === 'OVERDUE'
              ? 'The tax workflow is still open after its recorded due date.'
              : urgency === 'DUE_SOON'
                ? 'The recorded tax due date is within 72 hours.'
                : input.taxStatus === 'OPEN'
                  ? 'Tax evidence is progressing within the recorded closeout window.'
                  : 'The declaration is recorded and the workflow is progressing within its due date.',
        state: workflowState,
        urgency,
      },
    };
  }
  if (input.taxStatus === 'PAID' || input.taxStatus === 'CLOSED') {
    return {
      check: 'PASS',
      workflow: {
        dueAt,
        reason: input.taxStatus === 'PAID' ? 'Tax payment is recorded.' : 'Tax closeout is complete.',
        state: workflowState,
        urgency: 'NORMAL',
      },
    };
  }
  return {
    check: 'UNKNOWN',
    workflow: {
      dueAt,
      reason: 'The tax workflow status is not recognized and requires verification.',
      state: 'UNKNOWN',
      urgency: 'UNKNOWN',
    },
  };
}

function taxWorkflowState(taxStatus: string): SettlementAuditWorkflowState {
  if (taxStatus === 'OPEN') return 'TAX_OPEN';
  if (taxStatus === 'DECLARED') return 'TAX_DECLARED';
  if (taxStatus === 'PAID') return 'TAX_PAID';
  if (taxStatus === 'CLOSED') return 'TAX_CLOSED';
  if (taxStatus === 'REVERSED') return 'REVERSED';
  return 'UNKNOWN';
}

function taxWorkflowUrgency(checkedAt: string, dueAt: string | null): SettlementAuditUrgency {
  if (!dueAt) return 'UNKNOWN';
  const remainingMs = new Date(dueAt).getTime() - new Date(checkedAt).getTime();
  if (remainingMs <= 0) return 'OVERDUE';
  return remainingMs <= TAX_DUE_SOON_WINDOW_MS ? 'DUE_SOON' : 'NORMAL';
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeNumber(value: unknown) {
  return Math.max(0, finiteNumber(value));
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
