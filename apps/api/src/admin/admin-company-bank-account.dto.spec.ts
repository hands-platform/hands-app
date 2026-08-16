import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { CreateCompanyBankAccountDto } from './admin.dto';

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
