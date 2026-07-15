import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const smokeSource = readFileSync(
  resolve(process.cwd(), '../../infra/scripts/partner-bank-deposit-allocation-smoke.mjs'),
  'utf8',
);

describe('Partner bank deposit allocation HTTP smoke contract', () => {
  it('is local-only and always cleans up its fixture', () => {
    expect(smokeSource).toContain('localHosts.has(parsedDatabaseUrl.hostname)');
    expect(smokeSource).toContain("env.NODE_ENV === 'production'");
    expect(smokeSource).toContain('finally {');
    expect(smokeSource).toContain('await cleanupFixture');
    expect(smokeSource).toContain('tx.monthlyTaxClosing.deleteMany');
    expect(smokeSource).toContain('closingCount === 0');
  });

  it('covers request, separate approval, detail, history, and evidence allocation APIs', () => {
    expect(smokeSource).toContain("'/admin/provider-wallet/deposit-requests'");
    expect(smokeSource).toContain('/approve`');
    expect(smokeSource).toContain('/cash-debt-allocations`');
    expect(smokeSource).toContain('/deposit-requests/history?');
    expect(smokeSource).toContain('expectedStatus: 400');
    expect(smokeSource).toContain('expectedStatus: 409');
  });

  it('links the approved deposit journal to an explicit company bank inflow', () => {
    expect(smokeSource).toContain("'/admin/bank-reconciliation/transactions'");
    expect(smokeSource).toContain('partnerBankDepositRequestId: request.id');
    expect(smokeSource).toContain("entry.accountCode === 'company_bank_cash'");
    expect(smokeSource).toContain('accountingJournalEntryId === bankCashJournalEntry.id');
    expect(smokeSource).toContain('bankReconciliationLinked: true');
  });

  it('covers split evidence, reversal restoration, approved ignore, replacement evidence, and monthly close risk totals', () => {
    expect(smokeSource).toContain("reconciliationStatus === 'PARTIALLY_MATCHED'");
    expect(smokeSource).toContain("blockedPotentialDuplicate.code === 'BANK_TRANSACTION_POTENTIAL_DUPLICATE'");
    expect(smokeSource).toContain('confirmPotentialDuplicate: true');
    expect(smokeSource).toContain('bankImportDuplicateReviewGuard: true');
    expect(smokeSource).toContain('/matches/${secondReconciliation.match.id}/reverse`');
    expect(smokeSource).toContain('monthlySummaryAfterReversal.partnerDepositReconciliationOpenAmount');
    expect(smokeSource).toContain('/ignore`');
    expect(smokeSource).toContain("ignoredBankTransactionDetail.status === 'IGNORED'");
    expect(smokeSource).toContain('ignoreDoesNotClearDepositObligation: true');
    expect(smokeSource).toContain('replacementBankTransaction');
    expect(smokeSource).toContain('bankReconciliationPartialMatch: true');
    expect(smokeSource).toContain('bankReconciliationReversalRestore: true');
  });

  it('proves the monthly close declaration guard against unresolved Partner deposits over HTTP', () => {
    expect(smokeSource).toContain('isolatedMonthlyClosingPeriod(runId)');
    expect(smokeSource).toContain("status: 'REVIEWED'");
    expect(smokeSource).toContain("status: 'DECLARED'");
    expect(smokeSource).toContain("expectedStatus: 400");
    expect(smokeSource).toContain(
      'executed Partner bank deposit(s) without complete bank reconciliation',
    );
    expect(smokeSource).toContain('monthlyCloseDepositGuardLive: true');
  });

  it('asserts balanced accounting and no duplicate Wallet or GL evidence', () => {
    expect(smokeSource).toContain('journalDebit === debtTotal && journalCredit === debtTotal');
    expect(smokeSource).toContain('evidenceCountsBeforeAllocation');
    expect(smokeSource).toContain('evidenceCountsAfterAllocation');
    expect(smokeSource).toContain('createsWalletLedgerEntry === false');
    expect(smokeSource).toContain('createsAccountingJournalEntry === false');
  });
});
