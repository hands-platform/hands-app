import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCashBookingAccountingPreview,
  buildCashBookingAccountingPreviewText,
} from './cash-booking-accounting-preview';

describe('buildCashBookingAccountingPreview', () => {
  it('builds visible accounting preview lines with shared money atoms', () => {
    const source = readFileSync(join(process.cwd(), 'lib/cash-booking-accounting-preview.ts'), 'utf8');
    const lines = buildCashBookingAccountingPreview({
      companyCouponOffset: 60_000,
      currency: 'VND',
      debtAmount: 110_000,
      platformFee: 170_000,
      taxAmount: 42_000,
      walletLedgerMetadata: [
        {
          totalPartnerDueToCompany: 110_000,
          walletDeductionCompanyOutputVat: 9_481,
          walletDeductionPartnerTaxPayable: 42_000,
          walletDeductionPlatformFeeNetRevenue: 58_519,
        },
      ],
    });

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
    expect(lines.map((line) => textContent(line).replace(/\s+/g, ' ').trim())).toEqual([
      'Dr Partner receivable 110.000 VND',
      'Cr Platform fee net revenue 58.519 VND',
      'Cr Company output VAT payable 9.481 VND',
      'Cr Partner withholding tax payable 42.000 VND',
      'Coupon offset already applied 60.000 VND',
    ]);
  });

  it('builds matching plain text lines for action confirmation copy', () => {
    expect(
      buildCashBookingAccountingPreviewText({
        currency: 'VND',
        debtAmount: 30_000,
        platformFee: 25_000,
        taxAmount: 5_000,
      }),
    ).toEqual([
      'Dr Partner receivable 30.000 VND',
      'Cr Platform fee net revenue 25.000 VND',
      'Cr Partner withholding tax payable 5.000 VND',
    ]);
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
