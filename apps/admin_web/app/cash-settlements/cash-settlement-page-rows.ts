import { createElement, Fragment, type ReactNode } from 'react';

import { MoneyText } from '../../components/money-text';
import type { AdminEarning } from '../../lib/admin-api';
import { buildCashBookingAccountingPreview } from '../../lib/cash-booking-accounting-preview';
import { formatMoney, formatRelativeTime, shortRecordId } from '../../lib/admin-format';
import type {
  CashSettlementOpenDebtActionExecutionRow,
  CashSettlementOpenDebtTableRow,
} from './cash-settlement-open-debt-table-section';
import {
  bookingServiceLabel,
  CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  CASH_SETTLEMENT_STALE_HOURS,
  cashDebtEvidenceLabel,
  cashDebtOriginLabel,
  cashSettlementReference,
  cashSettlementRowAgeHours,
  isOpenCashDebt,
  providerDisplayName,
  settlementMethodLabel,
} from './cash-settlement-page-helpers';
import type {
  CashSettlementFilters,
  CashSettlementQueueFilter,
  CashSettlementRow,
  CashSettlementWalletDeductionBreakdown,
} from './cash-settlement-page-types';

export function buildCashSettlementRows(earnings: readonly AdminEarning[]): CashSettlementRow[] {
  return earnings
    .filter((earning) => isOpenCashDebt(earning))
    .map((earning) => {
      const walletDeductionBreakdown = cashCouponWalletDeductionBreakdown(earning);
      const debtAmount = Math.abs(earning.netAmount);
      const settlementReference = cashSettlementReference(earning);
      return {
        bookingAmount: earning.booking?.payment?.amount ?? earning.grossAmount,
        companyCouponOffset: walletDeductionBreakdown.companyCouponExpense,
        createdAtLabel: earning.createdAt ? formatRelativeTime(earning.createdAt) : 'No created date',
        debtAmount,
        debtOrigin: cashDebtOriginLabel(earning),
        earning,
        lastLedgerRef: earning.walletLedgerEntries?.[0]?.reference ?? null,
        nextAction: `Confirm Partner deposit or approved offset before settling ${settlementReference}.`,
        paymentMethod: earning.booking?.payment?.method ?? 'CASH',
        platformFee: earning.platformFee,
        providerName: providerDisplayName(earning),
        providerPhone: earning.providerProfile?.user?.phone ?? 'No phone on file',
        serviceLabel: bookingServiceLabel(earning),
        settlementEvidence: cashDebtEvidenceLabel(earning),
        settlementReference,
        taxAmount: earning.withholdingAmount ?? 0,
        walletDeductionBreakdown,
      };
    })
    .sort((left, right) => {
      if (left.debtAmount !== right.debtAmount) {
        return right.debtAmount - left.debtAmount;
      }
      return Date.parse(left.earning.createdAt ?? '') - Date.parse(right.earning.createdAt ?? '');
    });
}

export function applyCashSettlementRowFilters(
  rows: readonly CashSettlementRow[],
  filters: CashSettlementFilters,
): CashSettlementRow[] {
  const query = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (!cashSettlementRowMatchesQueue(row, filters.queue)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return cashSettlementSearchText(row).includes(query);
  });
}

export function cashSettlementRowMatchesQueue(row: CashSettlementRow, queue: CashSettlementQueueFilter) {
  switch (queue) {
    case 'stale':
      return cashSettlementRowAgeHours(row) >= CASH_SETTLEMENT_STALE_HOURS;
    case 'high-debt':
      return row.debtAmount >= CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD;
    case 'missing-ref':
      return !row.earning.settlementRef && !row.lastLedgerRef;
    case 'payment-check':
      return !row.earning.booking?.payment || row.paymentMethod !== 'CASH';
    case 'all':
    default:
      return true;
  }
}

export function buildCashSettlementOpenDebtTableRows(
  rows: readonly CashSettlementRow[],
): CashSettlementOpenDebtTableRow[] {
  return rows.map((row) => {
    const breakdown = row.walletDeductionBreakdown;
    return {
      actionRows: cashSettlementActionExecutionMap(row),
      bookingAmount: row.bookingAmount,
      bookingHref: `/bookings/${row.earning.bookingId}`,
      bookingLabel: shortRecordId(row.earning.bookingId),
      cashAccountingPreview: cashAccountingPreviewLabels(row, row.earning.currency),
      cashCouponOffsetAmount: breakdown.companyCouponExpense > 0 ? breakdown.companyCouponExpense : null,
      createdAtLabel: row.createdAtLabel,
      currency: row.earning.currency,
      debtAmount: row.debtAmount,
      depositAmountDefault: String(row.debtAmount),
      debtOrigin: row.debtOrigin,
      earningId: row.earning.id,
      lastLedgerRef: row.lastLedgerRef ?? null,
      nextAction: row.nextAction,
      partnerHref: `/partners/${row.earning.providerProfileId}`,
      paymentMethod: row.paymentMethod,
      platformFee: row.platformFee,
      providerProfileId: row.earning.providerProfileId,
      providerName: row.providerName,
      providerPhone: row.providerPhone,
      serviceLabel: row.serviceLabel,
      settlementEvidence: row.settlementEvidence,
      settlementMethodDefault: row.earning.settlementMethod ?? 'PARTNER_DEPOSIT',
      settlementMethodLabel: settlementMethodLabel(row.earning.settlementMethod),
      settlementNotesDefault: `Partner deposit or approved offset for ${formatMoney(
        row.debtAmount,
        row.earning.currency,
      )} using ${row.settlementReference}`,
      settlementReference: row.settlementReference,
      taxAmount: row.taxAmount,
      walletDeductionBreakdown: cashWalletDeductionLabels(breakdown, row.earning.currency),
    };
  });
}

export function cashSettlementActionExecutionMap(
  row: CashSettlementRow,
): CashSettlementOpenDebtActionExecutionRow[] {
  const hasPaymentEvidence = Boolean(row.earning.booking?.payment);
  const hasReference = Boolean(row.settlementReference);
  const hasLedgerReference = Boolean(row.lastLedgerRef);
  const isOldDebt = cashSettlementRowAgeHours(row) >= CASH_SETTLEMENT_STALE_HOURS;

  return [
    {
      action: 'Confirm cash collection',
      operatorRule: 'Open the booking detail before settlement if the payment method or amount is unclear.',
      pillClass: hasPaymentEvidence && row.paymentMethod === 'CASH' ? 'pill-success' : 'pill-warn',
      reason:
        hasPaymentEvidence && row.paymentMethod === 'CASH'
          ? detailWithMoney(
              'Booking payment is marked CASH and customer cash amount is ',
              moneyText(row.bookingAmount, row.earning.currency),
              '.',
            )
          : 'Payment evidence is missing or the booking payment method is not cash in the current payload.',
      status: hasPaymentEvidence && row.paymentMethod === 'CASH' ? 'Ready' : 'Check booking',
    },
    {
      action: 'Attach settlement reference',
      operatorRule: 'The backend requires a reference so finance can audit the wallet reopening decision.',
      pillClass: hasReference ? 'pill-success' : 'pill-danger',
      reason: hasReference
        ? `Use ${row.settlementReference} as the bank deposit or approved offset reference.`
        : 'No suggested settlement reference is available for this debt row.',
      status: hasReference ? 'Reference ready' : 'Reference needed',
    },
    {
      action: 'Settle wallet debt',
      operatorRule:
        'Settle only after deposit evidence or approved offset; final acceptance, service start, and payout release stay gated until cleared.',
      pillClass: row.debtAmount > 0 ? 'pill-danger' : 'pill-success',
      reason:
        row.debtAmount > 0
          ? detailWithMoney(
              moneyText(row.debtAmount, row.earning.currency),
              ' remains as HANDS fee/tax wallet debt.',
            )
          : 'No open wallet debt remains on this earning row.',
      status: row.debtAmount > 0 ? 'Debt open' : 'Clear',
    },
    {
      action: 'Wallet evidence',
      operatorRule: 'Keep the booking, payment, earning, and wallet impact references aligned.',
      pillClass: hasLedgerReference ? 'pill-info' : 'pill-neutral',
      reason: hasLedgerReference
        ? `Last wallet impact reference is ${row.lastLedgerRef}.`
        : 'No wallet impact reference has been recorded yet for this row.',
      status: hasLedgerReference ? 'Evidence exists' : 'No prior evidence',
    },
    {
      action: 'Aging follow-up',
      operatorRule: isOldDebt
        ? 'Prioritize Partner deposit confirmation or admin offset review.'
        : 'Keep in the normal settlement queue.',
      pillClass: isOldDebt ? 'pill-warn' : 'pill-success',
      reason: isOldDebt
        ? 'This cash debt has been open longer than 24 hours.'
        : 'This cash debt is still inside the first 24-hour finance follow-up window.',
      status: isOldDebt ? 'Over 24h' : 'Fresh',
    },
  ];
}

function cashSettlementSearchText(row: CashSettlementRow) {
  return [
    row.providerName,
    row.providerPhone,
    row.earning.providerProfileId,
    row.earning.bookingId,
    row.earning.id,
    row.settlementReference,
    row.earning.settlementRef,
    row.lastLedgerRef,
    row.paymentMethod,
    row.serviceLabel,
    row.debtOrigin,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function cashCouponWalletDeductionBreakdown(earning: AdminEarning): CashSettlementWalletDeductionBreakdown {
  const metadata =
    earning.walletLedgerEntries
      ?.map((entry) => readRecord(entry.metadata))
      .find((entryMetadata) => numberValue(entryMetadata?.totalPartnerDueToCompany) > 0) ?? null;

  return {
    companyCouponExpense: numberValue(metadata?.cashBookingCompanyCouponExpense),
    walletDeductionCompanyOutputVat: numberValue(metadata?.walletDeductionCompanyOutputVat),
    walletDeductionPartnerTaxPayable: numberValue(metadata?.walletDeductionPartnerTaxPayable),
    walletDeductionPlatformFeeNetRevenue: numberValue(metadata?.walletDeductionPlatformFeeNetRevenue),
  };
}

function cashWalletDeductionLabels(breakdown: CashSettlementWalletDeductionBreakdown, currency: string) {
  if (
    breakdown.walletDeductionPlatformFeeNetRevenue <= 0 &&
    breakdown.walletDeductionCompanyOutputVat <= 0 &&
    breakdown.walletDeductionPartnerTaxPayable <= 0
  ) {
    return [];
  }

  return [
    detailWithMoney(
      'Platform net wallet deduction ',
      moneyText(breakdown.walletDeductionPlatformFeeNetRevenue, currency),
    ),
    detailWithMoney('Company VAT wallet deduction ', moneyText(breakdown.walletDeductionCompanyOutputVat, currency)),
    detailWithMoney(
      'Partner tax wallet deduction ',
      moneyText(breakdown.walletDeductionPartnerTaxPayable, currency),
    ),
  ];
}

function cashAccountingPreviewLabels(row: CashSettlementRow, currency: string) {
  return buildCashBookingAccountingPreview({
    companyCouponOffset: row.walletDeductionBreakdown.companyCouponExpense,
    currency,
    debtAmount: row.debtAmount,
    platformFee: row.platformFee,
    taxAmount: row.taxAmount,
    walletLedgerMetadata: row.earning.walletLedgerEntries?.map((entry) => entry.metadata),
  });
}

function detailWithMoney(...children: ReactNode[]): ReactNode {
  return createElement(Fragment, null, ...children);
}

function moneyText(amount: number, currency: string): ReactNode {
  return createElement(MoneyText, { amount, currency });
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
