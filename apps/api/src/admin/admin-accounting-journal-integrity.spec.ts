import { describe, expect, it } from 'vitest';

import { buildAccountingJournalIntegrity } from './admin-accounting-journal-integrity';

describe('accounting journal integrity', () => {
  it.each([
    ['BOOKING_SETTLEMENT_REVERSAL', '2026-08', '2026-08', 'CLEAR', null],
    ['BOOKING_SETTLEMENT_REVERSAL', '2026-07', '2026-08', 'BLOCKED', 'PERIOD_MISMATCH'],
    ['BOOKING_SETTLEMENT_REVERSAL', '2026-08', null, 'UNKNOWN', 'PERIOD_EVIDENCE_MISSING'],
    ['BOOKING_SETTLEMENT', '2026-06', '2026-06', 'CLEAR', null],
  ])(
    'evaluates %s batch period %s against source-linked period %s',
    (sourceType, monthlyPeriod, linkedMonthlyPeriod, state, blockerCode) => {
      const integrity = buildAccountingJournalIntegrity({
        checkedAt: '2026-08-26T00:00:00.000Z',
        entryCount: 2,
        entryCredit: 500_000,
        entryDebit: 500_000,
        formulaDelta: 0,
        formulaEvidenceAvailable: true,
        headerCredit: 500_000,
        headerDebit: 500_000,
        linkedMonthlyPeriod,
        monthlyPeriod,
        sourceType,
        status: 'POSTED',
      });

      expect(integrity.state).toBe(state);
      if (blockerCode) expect(integrity.blockerCodes).toContain(blockerCode);
      else expect(integrity.blockerCodes).not.toContain('PERIOD_MISMATCH');
    },
  );

  it('blocks a header-balanced journal when entries and formula evidence disagree', () => {
    expect(
      buildAccountingJournalIntegrity({
        checkedAt: '2026-08-09T00:00:00.000Z',
        entryCount: 4,
        entryCredit: 390_000,
        entryDebit: 390_000,
        formulaDelta: 12_000,
        formulaEvidenceAvailable: true,
        headerCredit: 500_000,
        headerDebit: 500_000,
        linkedMonthlyPeriod: '2026-07',
        monthlyPeriod: '2026-07',
        sourceType: 'BOOKING_SETTLEMENT_REVERSAL',
        status: 'POSTED',
      }),
    ).toEqual(
      expect.objectContaining({
        blockerCodes: expect.arrayContaining(['HEADER_ENTRY_MISMATCH', 'FORMULA_DELTA']),
        checkedAt: '2026-08-09T00:00:00.000Z',
        discrepancyAmount: 110_000,
        state: 'BLOCKED',
      }),
    );
  });

  it('does not treat missing required settlement evidence as clear or zero', () => {
    expect(
      buildAccountingJournalIntegrity({
        checkedAt: '2026-08-09T00:00:00.000Z',
        entryCount: 2,
        entryCredit: 500_000,
        entryDebit: 500_000,
        formulaDelta: null,
        formulaEvidenceAvailable: false,
        headerCredit: 500_000,
        headerDebit: 500_000,
        linkedMonthlyPeriod: null,
        monthlyPeriod: '2026-07',
        sourceType: 'BOOKING_SETTLEMENT',
        status: 'POSTED',
      }),
    ).toEqual(
      expect.objectContaining({
        blockerCodes: expect.arrayContaining(['FORMULA_EVIDENCE_MISSING', 'PERIOD_EVIDENCE_MISSING']),
        state: 'UNKNOWN',
      }),
    );
  });

  it('clears a posted non-settlement journal only when header and entries agree', () => {
    expect(
      buildAccountingJournalIntegrity({
        checkedAt: '2026-08-09T00:00:00.000Z',
        entryCount: 2,
        entryCredit: 80_000,
        entryDebit: 80_000,
        formulaDelta: null,
        formulaEvidenceAvailable: false,
        headerCredit: 80_000,
        headerDebit: 80_000,
        linkedMonthlyPeriod: null,
        monthlyPeriod: '2026-07',
        sourceType: 'MANUAL_WALLET_ADJUSTMENT',
        status: 'POSTED',
      }),
    ).toEqual(expect.objectContaining({ blockerCodes: [], discrepancyAmount: 0, state: 'CLEAR' }));
  });

  it('marks a posted manual wallet adjustment without its required accounting month as unknown', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-26T00:00:00.000Z',
      entryCount: 2,
      entryCredit: 80_000,
      entryDebit: 80_000,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 80_000,
      headerDebit: 80_000,
      linkedMonthlyPeriod: null,
      monthlyPeriod: null,
      sourceType: 'MANUAL_WALLET_ADJUSTMENT',
      status: 'POSTED',
    });

    expect(integrity).toEqual(
      expect.objectContaining({
        blockerCodes: ['PERIOD_EVIDENCE_MISSING'],
        state: 'UNKNOWN',
      }),
    );
    expect(integrity.checks.monthlyPeriod).toBe('UNKNOWN');
  });

  it('keeps a draft manual wallet adjustment period check non-applicable', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-26T00:00:00.000Z',
      entryCount: 2,
      entryCredit: 80_000,
      entryDebit: 80_000,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 80_000,
      headerDebit: 80_000,
      linkedMonthlyPeriod: null,
      monthlyPeriod: null,
      sourceType: 'MANUAL_WALLET_ADJUSTMENT',
      status: 'DRAFT',
    });

    expect(integrity).toEqual(expect.objectContaining({ blockerCodes: [], state: 'CLEAR' }));
    expect(integrity.checks.monthlyPeriod).toBe('NOT_APPLICABLE');
  });

  it('requires the wallet action accounting month for posted referral reward journals', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-26T00:00:00.000Z',
      entryCount: 2,
      entryCredit: 80_000,
      entryDebit: 80_000,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 80_000,
      headerDebit: 80_000,
      linkedMonthlyPeriod: null,
      monthlyPeriod: null,
      sourceType: 'REFERRAL_REWARD',
      status: 'POSTED',
    });

    expect(integrity).toEqual(
      expect.objectContaining({
        blockerCodes: ['PERIOD_EVIDENCE_MISSING'],
        state: 'UNKNOWN',
      }),
    );
    expect(integrity.checks.monthlyPeriod).toBe('UNKNOWN');
  });

  it('blocks an entry debit and credit mismatch', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-09T00:00:00.000Z',
      entryCount: 2,
      entryCredit: 390_000,
      entryDebit: 400_000,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 400_000,
      headerDebit: 400_000,
      linkedMonthlyPeriod: null,
      monthlyPeriod: '2026-07',
      sourceType: 'MANUAL_WALLET_ADJUSTMENT',
      status: 'POSTED',
    });

    expect(integrity.state).toBe('BLOCKED');
    expect(integrity.blockerCodes).toContain('ENTRY_UNBALANCED');
    expect(integrity.checks.entriesBalanced).toBe('FAIL');
  });

  it('blocks a header debit that does not match entry debit', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-09T00:00:00.000Z',
      entryCount: 2,
      entryCredit: 500_000,
      entryDebit: 390_000,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 500_000,
      headerDebit: 500_000,
      linkedMonthlyPeriod: null,
      monthlyPeriod: '2026-07',
      sourceType: 'MANUAL_WALLET_ADJUSTMENT',
      status: 'POSTED',
    });

    expect(integrity.state).toBe('BLOCKED');
    expect(integrity.blockerCodes).toContain('HEADER_ENTRY_MISMATCH');
    expect(integrity.checks.headerMatchesEntries).toBe('FAIL');
  });

  it('blocks a header credit that does not match entry credit', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-09T00:00:00.000Z',
      entryCount: 2,
      entryCredit: 390_000,
      entryDebit: 500_000,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 500_000,
      headerDebit: 500_000,
      linkedMonthlyPeriod: null,
      monthlyPeriod: '2026-07',
      sourceType: 'MANUAL_WALLET_ADJUSTMENT',
      status: 'POSTED',
    });

    expect(integrity.state).toBe('BLOCKED');
    expect(integrity.blockerCodes).toContain('HEADER_ENTRY_MISMATCH');
    expect(integrity.checks.headerMatchesEntries).toBe('FAIL');
  });

  it('blocks a posted batch without journal entries', () => {
    const integrity = buildAccountingJournalIntegrity({
      checkedAt: '2026-08-09T00:00:00.000Z',
      entryCount: 0,
      entryCredit: 0,
      entryDebit: 0,
      formulaDelta: null,
      formulaEvidenceAvailable: false,
      headerCredit: 0,
      headerDebit: 0,
      linkedMonthlyPeriod: null,
      monthlyPeriod: '2026-07',
      sourceType: 'MANUAL_WALLET_ADJUSTMENT',
      status: 'POSTED',
    });

    expect(integrity.state).toBe('BLOCKED');
    expect(integrity.blockerCodes).toContain('POSTED_WITHOUT_ENTRIES');
    expect(integrity.checks.postedEntries).toBe('FAIL');
  });
});
