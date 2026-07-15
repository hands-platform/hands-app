export const BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH = 12;
export const MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT = 'manual-bank-transaction-import';

export function isConfirmedBankReconciliationAction(input: {
  readonly bankTransactionId: string;
  readonly confirmationBankTransactionId: string;
  readonly evidence: string;
}) {
  return Boolean(
    input.bankTransactionId &&
    input.confirmationBankTransactionId === input.bankTransactionId &&
    input.evidence.trim().length >= BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH
  );
}

export function isConfirmedManualBankTransactionImport(input: {
  readonly confirmationIntent: string;
  readonly evidence: string;
}) {
  return Boolean(
    input.confirmationIntent === MANUAL_BANK_TRANSACTION_CONFIRMATION_INTENT &&
    input.evidence.trim().length >= BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH
  );
}
