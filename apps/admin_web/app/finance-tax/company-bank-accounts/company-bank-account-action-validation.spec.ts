import {
  COMPANY_BANK_ACCOUNT_CREATE_INTENT,
  COMPANY_BANK_ACCOUNT_STATUS_INTENT,
  isConfirmedCompanyBankAccountAction,
} from './company-bank-account-action-validation';

describe('company bank account action validation', () => {
  it('requires the expected intent and meaningful evidence', () => {
    expect(
      isConfirmedCompanyBankAccountAction({
        confirmationIntent: COMPANY_BANK_ACCOUNT_CREATE_INTENT,
        evidence: 'Reviewed with treasury owner',
        expectedIntent: COMPANY_BANK_ACCOUNT_CREATE_INTENT,
      }),
    ).toBe(true);
    expect(
      isConfirmedCompanyBankAccountAction({
        confirmationIntent: COMPANY_BANK_ACCOUNT_CREATE_INTENT,
        evidence: 'short',
        expectedIntent: COMPANY_BANK_ACCOUNT_CREATE_INTENT,
      }),
    ).toBe(false);
  });

  it('binds update and status confirmation to the reviewed account', () => {
    expect(
      isConfirmedCompanyBankAccountAction({
        accountId: 'bank-1',
        confirmationAccountId: 'bank-1',
        confirmationIntent: COMPANY_BANK_ACCOUNT_STATUS_INTENT,
        evidence: 'Archive approved after treasury review',
        expectedIntent: COMPANY_BANK_ACCOUNT_STATUS_INTENT,
      }),
    ).toBe(true);
    expect(
      isConfirmedCompanyBankAccountAction({
        accountId: 'bank-1',
        confirmationAccountId: 'bank-2',
        confirmationIntent: COMPANY_BANK_ACCOUNT_STATUS_INTENT,
        evidence: 'Archive approved after treasury review',
        expectedIntent: COMPANY_BANK_ACCOUNT_STATUS_INTENT,
      }),
    ).toBe(false);
  });
});
