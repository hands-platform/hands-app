import { createElement, Fragment, type ReactNode } from 'react';

import { MoneyText } from '../components/money-text';

type CashBookingAccountingPreviewInput = {
  readonly companyCouponOffset?: number;
  readonly currency: string;
  readonly debtAmount: number;
  readonly platformFee: number;
  readonly taxAmount: number;
  readonly walletLedgerMetadata?: readonly unknown[];
};

export function buildCashBookingAccountingPreview(input: CashBookingAccountingPreviewInput) {
  const metadata = cashBookingWalletMetadata(input.walletLedgerMetadata);
  const companyCouponOffset =
    numberValue(metadata?.cashBookingCompanyCouponExpense) || Math.max(0, input.companyCouponOffset ?? 0);
  const companyOutputVat = numberValue(metadata?.walletDeductionCompanyOutputVat);
  const platformNetRevenue =
    numberValue(metadata?.walletDeductionPlatformFeeNetRevenue) || Math.max(0, input.platformFee);
  const partnerTaxPayable =
    numberValue(metadata?.walletDeductionPartnerTaxPayable) || Math.max(0, input.taxAmount);

  const lines = [previewLine('Dr Partner receivable ', input.debtAmount, input.currency)];

  if (platformNetRevenue > 0) {
    lines.push(previewLine('Cr Platform fee net revenue ', platformNetRevenue, input.currency));
  }
  if (companyOutputVat > 0) {
    lines.push(previewLine('Cr Company output VAT payable ', companyOutputVat, input.currency));
  }
  if (partnerTaxPayable > 0) {
    lines.push(previewLine('Cr Partner withholding tax payable ', partnerTaxPayable, input.currency));
  }
  if (companyCouponOffset > 0) {
    lines.push(previewLine('Coupon offset already applied ', companyCouponOffset, input.currency));
  }

  return lines;
}

export function buildCashBookingAccountingPreviewText(input: CashBookingAccountingPreviewInput) {
  return buildCashBookingAccountingPreview(input)
    .map((line) => textContent(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function previewLine(label: string, amount: number, currency: string): ReactNode {
  return createElement(Fragment, null, label, createElement(MoneyText, { amount, currency }));
}

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

function cashBookingWalletMetadata(metadataEntries: readonly unknown[] | undefined) {
  return (
    metadataEntries
      ?.map((entry) => readRecord(entry))
      .find((entryMetadata) => numberValue(entryMetadata?.totalPartnerDueToCompany) > 0) ?? null
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
