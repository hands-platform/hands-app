import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  CreateCompanyBankAccountDto,
  CreateCompanyBankAccountEvidenceReviewDto,
} from './admin.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true });

const validRequest = {
  accountNumberLast4: '5678',
  bankCode: 'VCB',
  bankName: 'Vietcombank',
  currency: 'VND',
  idempotencyKey: 'company-bank-request-1',
  name: 'Collections account',
  operatorReason: 'Reviewed legal ownership evidence',
};

async function validationResponse(input: Record<string, unknown>) {
  try {
    await pipe.transform(input, {
      metatype: CreateCompanyBankAccountDto,
      type: 'body',
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      return error.getResponse();
    }
    throw error;
  }
  throw new Error('Expected company bank account validation to fail');
}

describe('CreateCompanyBankAccountDto', () => {
  it('accepts exactly four ASCII digits without a client-provided mask', async () => {
    await expect(
      pipe.transform(validRequest, {
        metatype: CreateCompanyBankAccountDto,
        type: 'body',
      }),
    ).resolves.toMatchObject(validRequest);
  });

  it('does not accept maker-owned verification outcomes or evidence references', async () => {
    const result = await pipe.transform(
      {
        ...validRequest,
        evidenceObjectId: 'restricted/company-bank/evidence-1',
        statementImportTestedAt: '2026-08-14T00:00:00.000Z',
        verificationMethod: 'maker-entered',
        verificationStatus: 'VERIFIED',
      },
      { metatype: CreateCompanyBankAccountDto, type: 'body' },
    );

    expect(result).not.toHaveProperty('evidenceObjectId');
    expect(result).not.toHaveProperty('statementImportTestedAt');
    expect(result).not.toHaveProperty('verificationMethod');
    expect(result).not.toHaveProperty('verificationStatus');
  });

  it.each([
    '12345678',
    '1234 5678',
    '1234-5678',
    '1234.5678',
    '1234/5678',
    '1234(5678)',
    '1234A5678',
    '1234\u00A05678',
    '１２３４５６７８',
  ])('rejects unsafe last-four input without echoing it: %s', async (unsafeValue) => {
    const response = await validationResponse({
      ...validRequest,
      accountNumberLast4: unsafeValue,
    });

    expect(JSON.stringify(response)).toContain('exactly four ASCII digits');
    expect(JSON.stringify(response)).not.toContain(unsafeValue);
  });

  it.each([
    '12345678',
    '1234 5678',
    '1234-5678',
    '1234.5678',
    '1234/5678',
    '1234(5678)',
    '1234A5678',
    '1234\u00A05678',
    '１２３４５６７８',
  ])('rejects client-managed masks without echoing them: %s', async (unsafeValue) => {
    const response = await validationResponse({
      ...validRequest,
      accountNumberMasked: unsafeValue,
    });

    expect(JSON.stringify(response)).toContain('accountNumberMasked is server-managed');
    expect(JSON.stringify(response)).not.toContain(unsafeValue);
  });
});

describe('CreateCompanyBankAccountEvidenceReviewDto', () => {
  const request = {
    expectedAccountUpdatedAt: '2026-08-28T05:00:00.000Z',
    fileAssetId: 'finance-evidence-file-1',
    idempotencyKey: 'company-bank-evidence-1',
    intent: 'CLASSIFY_PRODUCTION',
    operatorReason: 'Reviewed corporate ownership evidence',
  };

  it('accepts the two explicit non-operational evidence review intents', async () => {
    for (const intent of ['CLASSIFY_PRODUCTION', 'VERIFY_STATEMENT']) {
      await expect(
        pipe.transform(
          { ...request, intent },
          { metatype: CreateCompanyBankAccountEvidenceReviewDto, type: 'body' },
        ),
      ).resolves.toMatchObject({ ...request, intent });
    }
  });

  it('rejects forged evidence outcomes and malformed account versions', async () => {
    await expect(
      pipe.transform(
        {
          ...request,
          expectedAccountUpdatedAt: 'not-a-date',
          intent: 'ACTIVATE',
          verificationStatus: 'VERIFIED',
        },
        { metatype: CreateCompanyBankAccountEvidenceReviewDto, type: 'body' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
