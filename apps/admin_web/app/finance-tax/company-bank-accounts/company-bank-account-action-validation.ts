export const COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH = 12;
export const COMPANY_BANK_ACCOUNT_CREATE_INTENT = 'company-bank-account-create';
export const COMPANY_BANK_ACCOUNT_CLASSIFICATION_INTENT = 'company-bank-account-classification';
export const COMPANY_BANK_ACCOUNT_UPDATE_INTENT = 'company-bank-account-update';
export const COMPANY_BANK_ACCOUNT_STATUS_INTENT = 'company-bank-account-status';

export function isConfirmedCompanyBankAccountAction(input: {
  readonly accountId?: string;
  readonly confirmationAccountId?: string;
  readonly confirmationIntent: string;
  readonly evidence: string;
  readonly expectedIntent: string;
}) {
  return (
    input.confirmationIntent === input.expectedIntent &&
    input.evidence.trim().length >= COMPANY_BANK_ACCOUNT_EVIDENCE_MIN_LENGTH &&
    (input.accountId === undefined || input.confirmationAccountId === input.accountId)
  );
}
