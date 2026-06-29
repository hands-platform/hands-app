import type {
  AdminProviderWalletLedgerEntry,
} from '../../../lib/admin-api';

type WalletLedgerEntryWithMetadata = AdminProviderWalletLedgerEntry & {
  readonly metadata?: unknown;
};

export type PartnerWalletReviewTone = 'danger' | 'success' | 'warn';

export type PartnerWalletVisibleLedgerRow = {
  readonly id: string;
  readonly amount: number;
  readonly createdAt?: string;
  readonly currency: string;
  readonly notes?: string | null;
  readonly reference?: string | null;
  readonly type: string;
};

export type PartnerWalletSummary = {
  readonly appliedToNegativeWallet: number;
  readonly cashCompanyVatDeductions: number;
  readonly cashPartnerTaxDeductions: number;
  readonly cashPlatformFeeDeductions: number;
  readonly currency: string;
  readonly currentBalance: number;
  readonly manualAdjustmentCount: number;
  readonly manualBankDeposits: number;
  readonly negativeWalletReceivable: number;
  readonly partnerWalletLiability: number;
  readonly recordedAsPrepaidBalance: number;
  readonly reviewTone: PartnerWalletReviewTone;
  readonly visibleLedgerRows: readonly PartnerWalletVisibleLedgerRow[];
};

type PartnerWalletSummaryProvider = {
  readonly activitySummary?: {
    readonly [key: string]: unknown;
    readonly walletBalance?: number | string | null;
  };
  readonly earnings?: ReadonlyArray<{
    readonly walletLedgerEntries?: ReadonlyArray<WalletLedgerEntryWithMetadata>;
  }>;
};

const CASH_PLATFORM_FEE_DEDUCTION_TYPES = new Set<string>([
  'CASH_BOOKING_PLATFORM_FEE_DEDUCTED',
  'CASH_BOOKING_PLATFORM_FEE_CHARGE',
]);

const CASH_COMPANY_VAT_DEDUCTION_TYPES = new Set<string>([
  'CASH_BOOKING_COMPANY_OUTPUT_VAT_DEDUCTED',
  'CASH_BOOKING_COMPANY_OUTPUT_VAT_CHARGE',
]);

const CASH_PARTNER_TAX_DEDUCTION_TYPES = new Set<string>([
  'CASH_BOOKING_PARTNER_TAX_DEDUCTED',
  'CASH_BOOKING_PARTNER_TAX_CHARGE',
]);

const MANUAL_ADJUSTMENT_TYPES = new Set<string>([
  'ADMIN_ADJUSTMENT',
  'MANUAL_ADJUSTMENT_CREDIT',
  'MANUAL_ADJUSTMENT_DEBIT',
  'MANUAL_ADJUSTMENT_REVERSAL',
]);

export function buildPartnerWalletSummary(provider: PartnerWalletSummaryProvider): PartnerWalletSummary {
  const visibleLedgerRows = uniqueVisibleWalletLedgerRows(provider);
  const currency = visibleLedgerRows[0]?.currency ?? 'VND';
  const ledgerBalance = visibleLedgerRows.reduce((total, row) => total + row.amount, 0);
  const currentBalance = finiteNumber(provider.activitySummary?.walletBalance, ledgerBalance);
  const negativeWalletReceivable = Math.max(0, Math.abs(Math.min(0, currentBalance)));
  const partnerWalletLiability = Math.max(0, currentBalance);
  const manualAdjustmentCount = visibleLedgerRows.filter((row) =>
    MANUAL_ADJUSTMENT_TYPES.has(row.type),
  ).length;

  return {
    appliedToNegativeWallet: visibleLedgerRows.reduce(
      (total, row) => total + allocationAmount(row, 'amountAppliedToNegativeWallet'),
      0,
    ),
    cashCompanyVatDeductions: absoluteAmountForTypes(visibleLedgerRows, CASH_COMPANY_VAT_DEDUCTION_TYPES),
    cashPartnerTaxDeductions: absoluteAmountForTypes(visibleLedgerRows, CASH_PARTNER_TAX_DEDUCTION_TYPES),
    cashPlatformFeeDeductions: absoluteAmountForTypes(visibleLedgerRows, CASH_PLATFORM_FEE_DEDUCTION_TYPES),
    currency,
    currentBalance,
    manualAdjustmentCount,
    manualBankDeposits: visibleLedgerRows
      .filter((row) => row.type === 'PARTNER_BANK_DEPOSIT_RECEIVED')
      .reduce((total, row) => total + Math.abs(row.amount), 0),
    negativeWalletReceivable,
    partnerWalletLiability,
    recordedAsPrepaidBalance: visibleLedgerRows.reduce(
      (total, row) => total + allocationAmount(row, 'amountRecordedAsPrepaidBalance'),
      0,
    ),
    reviewTone: negativeWalletReceivable > 0 ? 'danger' : manualAdjustmentCount > 0 ? 'warn' : 'success',
    visibleLedgerRows,
  };
}

function uniqueVisibleWalletLedgerRows(provider: PartnerWalletSummaryProvider): PartnerWalletVisibleLedgerRow[] {
  const rowsById = new Map<string, WalletLedgerEntryWithMetadata>();
  for (const earning of provider.earnings ?? []) {
    for (const row of earning.walletLedgerEntries ?? []) {
      rowsById.set(row.id, row as WalletLedgerEntryWithMetadata);
    }
  }

  return Array.from(rowsById.values())
    .sort((left, right) => dateValue(right.createdAt) - dateValue(left.createdAt))
    .map((row) => ({
      id: row.id,
      amount: finiteNumber(row.amount),
      createdAt: row.createdAt,
      currency: row.currency ?? 'VND',
      notes: row.notes,
      reference: row.reference,
      type: row.type,
      metadata: row.metadata,
    })) as PartnerWalletVisibleLedgerRow[];
}

function absoluteAmountForTypes(
  rows: readonly PartnerWalletVisibleLedgerRow[],
  types: ReadonlySet<string>,
) {
  return rows
    .filter((row) => types.has(row.type))
    .reduce((total, row) => total + Math.abs(row.amount), 0);
}

function allocationAmount(row: PartnerWalletVisibleLedgerRow, key: string) {
  const rowWithMetadata = row as PartnerWalletVisibleLedgerRow & { readonly metadata?: unknown };
  const allocation = readRecord(readRecord(rowWithMetadata.metadata)?.allocation);
  return finiteNumber(allocation?.[key]);
}

function finiteNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
