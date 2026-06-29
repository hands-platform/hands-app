import { formatMoney } from './admin-format';

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

  const lines = [`Dr Partner receivable ${formatMoney(input.debtAmount, input.currency)}`];

  if (platformNetRevenue > 0) {
    lines.push(`Cr Platform fee net revenue ${formatMoney(platformNetRevenue, input.currency)}`);
  }
  if (companyOutputVat > 0) {
    lines.push(`Cr Company output VAT payable ${formatMoney(companyOutputVat, input.currency)}`);
  }
  if (partnerTaxPayable > 0) {
    lines.push(`Cr Partner withholding tax payable ${formatMoney(partnerTaxPayable, input.currency)}`);
  }
  if (companyCouponOffset > 0) {
    lines.push(`Coupon offset already applied ${formatMoney(companyCouponOffset, input.currency)}`);
  }

  return lines;
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
