export type AccountingJournalIntegrityState = 'BLOCKED' | 'CLEAR' | 'UNKNOWN';

export type AccountingJournalIntegrityCheckState = 'FAIL' | 'NOT_APPLICABLE' | 'PASS' | 'UNKNOWN';

export type AccountingJournalIntegrityBlockerCode =
  | 'ENTRY_UNBALANCED'
  | 'FORMULA_DELTA'
  | 'FORMULA_EVIDENCE_MISSING'
  | 'HEADER_ENTRY_MISMATCH'
  | 'HEADER_UNBALANCED'
  | 'PERIOD_EVIDENCE_MISSING'
  | 'PERIOD_MISMATCH'
  | 'POSTED_WITHOUT_ENTRIES';

export type AccountingJournalIntegrityInput = {
  readonly checkedAt: string;
  readonly entryCount: number;
  readonly entryCredit: number;
  readonly entryDebit: number;
  readonly formulaDelta: number | null;
  readonly formulaEvidenceAvailable: boolean;
  readonly headerCredit: number;
  readonly headerDebit: number;
  readonly linkedMonthlyPeriod: string | null;
  readonly monthlyPeriod: string | null;
  readonly sourceType: string;
  readonly status: string;
};

export type AccountingJournalIntegrity = {
  readonly blockerCodes: AccountingJournalIntegrityBlockerCode[];
  readonly checkedAt: string;
  readonly checks: {
    readonly entriesBalanced: AccountingJournalIntegrityCheckState;
    readonly formula: AccountingJournalIntegrityCheckState;
    readonly headerBalanced: AccountingJournalIntegrityCheckState;
    readonly headerMatchesEntries: AccountingJournalIntegrityCheckState;
    readonly monthlyPeriod: AccountingJournalIntegrityCheckState;
    readonly postedEntries: AccountingJournalIntegrityCheckState;
  };
  readonly discrepancyAmount: number;
  readonly entryCount: number;
  readonly entryCredit: number;
  readonly entryDebit: number;
  readonly formulaDelta: number | null;
  readonly state: AccountingJournalIntegrityState;
};

const SETTLEMENT_SOURCE_TYPES = new Set(['BOOKING_SETTLEMENT', 'BOOKING_SETTLEMENT_REVERSAL']);

export function buildAccountingJournalIntegrity(
  input: AccountingJournalIntegrityInput,
): AccountingJournalIntegrity {
  const headerDelta = Math.abs(input.headerDebit - input.headerCredit);
  const entryDelta = Math.abs(input.entryDebit - input.entryCredit);
  const headerEntryDelta = Math.max(
    Math.abs(input.headerDebit - input.entryDebit),
    Math.abs(input.headerCredit - input.entryCredit),
  );
  const formulaRequired = SETTLEMENT_SOURCE_TYPES.has(input.sourceType);
  const formulaDelta = input.formulaDelta === null ? null : Math.abs(input.formulaDelta);
  const blockerCodes: AccountingJournalIntegrityBlockerCode[] = [];

  if (headerDelta > 0) blockerCodes.push('HEADER_UNBALANCED');
  if (entryDelta > 0) blockerCodes.push('ENTRY_UNBALANCED');
  if (headerEntryDelta > 0) blockerCodes.push('HEADER_ENTRY_MISMATCH');
  if (input.status === 'POSTED' && input.entryCount === 0) blockerCodes.push('POSTED_WITHOUT_ENTRIES');
  if (formulaRequired && !input.formulaEvidenceAvailable) {
    blockerCodes.push('FORMULA_EVIDENCE_MISSING');
  } else if (formulaRequired && (formulaDelta ?? 0) > 0) {
    blockerCodes.push('FORMULA_DELTA');
  }
  if (formulaRequired && (input.monthlyPeriod === null || input.linkedMonthlyPeriod === null)) {
    blockerCodes.push('PERIOD_EVIDENCE_MISSING');
  } else if (
    formulaRequired &&
    input.monthlyPeriod !== null &&
    input.linkedMonthlyPeriod !== input.monthlyPeriod
  ) {
    blockerCodes.push('PERIOD_MISMATCH');
  }

  const hasUnknown = blockerCodes.some(
    (code) => code === 'FORMULA_EVIDENCE_MISSING' || code === 'PERIOD_EVIDENCE_MISSING',
  );
  const hasFailure = blockerCodes.some(
    (code) => code !== 'FORMULA_EVIDENCE_MISSING' && code !== 'PERIOD_EVIDENCE_MISSING',
  );

  return {
    blockerCodes,
    checkedAt: input.checkedAt,
    checks: {
      entriesBalanced: entryDelta === 0 ? 'PASS' : 'FAIL',
      formula: !formulaRequired
        ? 'NOT_APPLICABLE'
        : !input.formulaEvidenceAvailable
          ? 'UNKNOWN'
          : (formulaDelta ?? 0) === 0
            ? 'PASS'
            : 'FAIL',
      headerBalanced: headerDelta === 0 ? 'PASS' : 'FAIL',
      headerMatchesEntries: headerEntryDelta === 0 ? 'PASS' : 'FAIL',
      monthlyPeriod: !formulaRequired
        ? 'NOT_APPLICABLE'
        : input.monthlyPeriod === null || input.linkedMonthlyPeriod === null
          ? 'UNKNOWN'
          : input.monthlyPeriod === null || input.linkedMonthlyPeriod === input.monthlyPeriod
            ? 'PASS'
            : 'FAIL',
      postedEntries:
        input.status !== 'POSTED' ? 'NOT_APPLICABLE' : input.entryCount > 0 ? 'PASS' : 'FAIL',
    },
    discrepancyAmount: Math.max(headerDelta, entryDelta, headerEntryDelta, formulaDelta ?? 0),
    entryCount: input.entryCount,
    entryCredit: input.entryCredit,
    entryDebit: input.entryDebit,
    formulaDelta,
    state: hasFailure ? 'BLOCKED' : hasUnknown ? 'UNKNOWN' : 'CLEAR',
  };
}
