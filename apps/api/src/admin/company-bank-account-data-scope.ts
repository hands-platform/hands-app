import {
  CompanyBankAccountDataScope,
  CompanyBankAccountStatus,
  Prisma,
} from '@prisma/client';

export function companyBankAccountProductionWhere(
  status?: CompanyBankAccountStatus,
): Prisma.CompanyBankAccountWhereInput {
  return {
    dataScope: CompanyBankAccountDataScope.PRODUCTION,
    ...(status ? { status } : {}),
  };
}

export function companyBankAccountScopeWhere(
  dataScope: CompanyBankAccountDataScope,
): Prisma.CompanyBankAccountWhereInput {
  return { dataScope };
}

export function companyBankAccountOperationalScopeError(
  dataScope: CompanyBankAccountDataScope,
) {
  if (dataScope === CompanyBankAccountDataScope.PRODUCTION) return null;
  return {
    code: 'COMPANY_BANK_ACCOUNT_DATA_SCOPE_BLOCKED',
    field: 'bankAccountId',
    message:
      dataScope === CompanyBankAccountDataScope.SYNTHETIC
        ? 'Synthetic company bank accounts cannot be used for Finance operations'
        : 'Company bank account classification must be approved before Finance operations',
  };
}

export function companyBankAccountDataScopeLifecycle(
  dataScope: CompanyBankAccountDataScope,
) {
  if (dataScope === CompanyBankAccountDataScope.SYNTHETIC) return 'SYNTHETIC';
  if (dataScope === CompanyBankAccountDataScope.UNKNOWN) return 'UNKNOWN_DATA_SCOPE';
  return null;
}
