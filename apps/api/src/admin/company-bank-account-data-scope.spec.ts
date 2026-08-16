import {
  CompanyBankAccountDataScope,
  CompanyBankAccountStatus,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  companyBankAccountDataScopeLifecycle,
  companyBankAccountOperationalScopeError,
  companyBankAccountProductionWhere,
} from './company-bank-account-data-scope';

describe('company bank account data scope', () => {
  it('uses an explicit positive production predicate', () => {
    expect(companyBankAccountProductionWhere(CompanyBankAccountStatus.ACTIVE)).toEqual({
      dataScope: CompanyBankAccountDataScope.PRODUCTION,
      status: CompanyBankAccountStatus.ACTIVE,
    });
  });

  it('blocks unknown and synthetic accounts from operational use', () => {
    expect(companyBankAccountOperationalScopeError(CompanyBankAccountDataScope.UNKNOWN)?.code)
      .toBe('COMPANY_BANK_ACCOUNT_DATA_SCOPE_BLOCKED');
    expect(companyBankAccountOperationalScopeError(CompanyBankAccountDataScope.SYNTHETIC)?.code)
      .toBe('COMPANY_BANK_ACCOUNT_DATA_SCOPE_BLOCKED');
    expect(companyBankAccountOperationalScopeError(CompanyBankAccountDataScope.PRODUCTION)).toBeNull();
  });

  it('maps remediation scopes to explicit lifecycle labels', () => {
    expect(companyBankAccountDataScopeLifecycle(CompanyBankAccountDataScope.UNKNOWN))
      .toBe('UNKNOWN_DATA_SCOPE');
    expect(companyBankAccountDataScopeLifecycle(CompanyBankAccountDataScope.SYNTHETIC))
      .toBe('SYNTHETIC');
    expect(companyBankAccountDataScopeLifecycle(CompanyBankAccountDataScope.PRODUCTION)).toBeNull();
  });
});
