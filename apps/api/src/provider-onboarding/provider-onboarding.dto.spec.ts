import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ProviderOnboardingController } from './provider-onboarding.controller';

describe('provider onboarding request DTO validation', () => {
  function bodyMetatype(methodName: keyof ProviderOnboardingController, parameterIndex: number) {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      ProviderOnboardingController.prototype,
      methodName,
    ) as unknown[];
    return paramTypes?.[parameterIndex] as object | undefined;
  }

  it('uses concrete DTOs for provider onboarding payloads', () => {
    expect((bodyMetatype('updateBasicProfile', 1) as { name?: string })?.name).toBe(
      'UpdateProviderBasicProfileDto',
    );
    expect((bodyMetatype('submitKyc', 1) as { name?: string })?.name).toBe('SubmitProviderKycDto');
    expect((bodyMetatype('createBankAccount', 1) as { name?: string })?.name).toBe(
      'CreateProviderBankAccountDto',
    );
    expect((bodyMetatype('upsertTaxProfile', 1) as { name?: string })?.name).toBe(
      'UpsertProviderTaxProfileDto',
    );
    expect((bodyMetatype('acceptAgreement', 2) as { name?: string })?.name).toBe(
      'AcceptProviderAgreementDto',
    );
  });

  it('uses concrete DTOs for tax policy administration payloads', () => {
    expect((bodyMetatype('createTaxPolicyVersion', 1) as { name?: string })?.name).toBe(
      'CreateTaxPolicyVersionDto',
    );
    expect((bodyMetatype('updateTaxPolicyVersion', 2) as { name?: string })?.name).toBe(
      'UpdateTaxPolicyVersionDto',
    );
    expect((bodyMetatype('createTaxRule', 2) as { name?: string })?.name).toBe('CreateTaxRuleDto');
    expect((bodyMetatype('updateTaxRule', 2) as { name?: string })?.name).toBe('UpdateTaxRuleDto');
  });

  it('normalizes basic profile fields and strips unsupported data', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        legalName: '  Nguyen Thi Linh  ',
        displayName: '  Linh Wellness  ',
        experienceYears: '4',
        city: ' Ho Chi Minh City ',
        walletBalance: -100000,
      },
      { type: 'body', metatype: bodyMetatype('updateBasicProfile', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('legalName', 'Nguyen Thi Linh');
    expect(transformed).toHaveProperty('experienceYears', 4);
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('validates nested KYC documents', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        cccdNumber: ' 079123456789 ',
        documents: [{ fileId: ' file-1 ', type: 'CCCD_FRONT', localPath: 'private.jpg' }],
      },
      { type: 'body', metatype: bodyMetatype('submitKyc', 1) as never, data: '' },
    );

    expect(transformed.documents?.[0]).toHaveProperty('fileId', 'file-1');
    expect(transformed.documents?.[0]).not.toHaveProperty('localPath');

    await expect(
      pipe.transform(
        { documents: [{ fileId: 'file-1', type: 'PASSPORT' }] },
        { type: 'body', metatype: bodyMetatype('submitKyc', 1) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('validates tax rule numbers and enum scopes before policy logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        active: true,
        approvalAdminId: 'finance-admin-2',
        minGrossAmount: '500000',
        operatorReason: 'Approved against the current withholding schedule.',
        private: true,
        rateBps: '500',
        scope: 'AMOUNT_BAND',
      },
      { type: 'body', metatype: bodyMetatype('createTaxRule', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('minGrossAmount', 500000);
    expect(transformed).toHaveProperty('approvalAdminId', 'finance-admin-2');
    expect(transformed).not.toHaveProperty('private');

    await expect(
      pipe.transform(
        {
          approvalAdminId: 'finance-admin-2',
          operatorReason: 'Approved against the current withholding schedule.',
          scope: 'AUTO',
          rateBps: 500,
        },
        { type: 'body', metatype: bodyMetatype('createTaxRule', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('requires separate finance approval evidence for tax policy writes', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          name: 'Vietnam withholding',
        },
        { type: 'body', metatype: bodyMetatype('createTaxPolicyVersion', 1) as never, data: '' },
      ),
    ).rejects.toThrow();
  });
});
