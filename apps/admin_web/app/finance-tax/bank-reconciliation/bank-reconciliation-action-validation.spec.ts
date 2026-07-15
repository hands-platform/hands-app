import { describe, expect, it } from 'vitest';

import {
  BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH,
  MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT,
  isConfirmedBankReconciliationAction,
  isConfirmedManualBankTransactionImport,
} from './bank-reconciliation-action-validation';

describe('bank reconciliation action confirmation', () => {
  it('accepts matching transaction evidence at the minimum length', () => {
    expect(isConfirmedBankReconciliationAction({
      bankTransactionId: 'bank-transaction-1',
      confirmationBankTransactionId: 'bank-transaction-1',
      evidence: 'x'.repeat(BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH),
    })).toBe(true);
  });

  it('rejects stale confirmation for a different transaction', () => {
    expect(isConfirmedBankReconciliationAction({
      bankTransactionId: 'bank-transaction-1',
      confirmationBankTransactionId: 'bank-transaction-2',
      evidence: 'Reviewed against bank evidence',
    })).toBe(false);
  });

  it('rejects short or blank accounting evidence', () => {
    expect(isConfirmedBankReconciliationAction({
      bankTransactionId: 'bank-transaction-1',
      confirmationBankTransactionId: 'bank-transaction-1',
      evidence: 'too short',
    })).toBe(false);
    expect(isConfirmedBankReconciliationAction({
      bankTransactionId: 'bank-transaction-1',
      confirmationBankTransactionId: 'bank-transaction-1',
      evidence: '             ',
    })).toBe(false);
  });

  it('requires explicit manual transaction import intent and evidence', () => {
    expect(isConfirmedManualBankTransactionImport({
      confirmationIntent: MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT,
      evidence: 'Reviewed the original bank statement row',
    })).toBe(true);
    expect(isConfirmedManualBankTransactionImport({
      confirmationIntent: 'other-action',
      evidence: 'Reviewed the original bank statement row',
    })).toBe(false);
  });
});
