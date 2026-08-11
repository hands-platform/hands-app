import type { AdminCashSettlementSummary } from '../../lib/admin-api';
import { formatRelativeTime } from '../../lib/admin-format';
import {
  CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  CASH_SETTLEMENT_STALE_MS,
} from './cash-settlement-page-helpers';
import type {
  CashSettlementRow,
  CashSettlementSummary,
} from './cash-settlement-page-types';

export function buildSummary(rows: readonly CashSettlementRow[]): CashSettlementSummary {
  const oldestMs = rows.reduce((oldest, row) => {
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    return Math.min(oldest, createdMs);
  }, Date.now());

  return {
    cashPaymentRowCount: rows.filter((row) => row.earning.booking?.payment?.method === 'CASH').length,
    companyCouponOffset: 0,
    currency: rows[0]?.earning.currency ?? 'VND',
    debtAmount: rows.reduce((sum, row) => sum + row.debtAmount, 0),
    highDebtProviderCount: highDebtProviderCount(rows),
    missingPaymentEvidenceCount: rows.filter((row) => !row.earning.booking?.payment).length,
    oldestOpenLabel: rows.length
      ? formatRelativeTime(new Date(oldestMs).toISOString(), {
          emptyFallback: '-',
          invalidFallback: '-',
        })
      : '-',
    platformFee: rows.reduce((sum, row) => sum + row.platformFee, 0),
    providerCount: new Set(rows.map((row) => row.earning.providerProfileId)).size,
    rowCount: rows.length,
    staleDebtRowCount: rows.filter((row) => {
      const createdMs = Date.parse(row.earning.createdAt ?? '');
      return Number.isFinite(createdMs) && Date.now() - createdMs > CASH_SETTLEMENT_STALE_MS;
    }).length,
    taxAmount: rows.reduce((sum, row) => sum + row.taxAmount, 0),
  };
}

function highDebtProviderCount(rows: readonly CashSettlementRow[]) {
  const exposureByPartner = new Map<string, number>();
  for (const row of rows) {
    const id = row.earning.providerProfileId;
    exposureByPartner.set(id, (exposureByPartner.get(id) ?? 0) + row.debtAmount);
  }
  return [...exposureByPartner.values()].filter(
    (amount) => amount >= CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  ).length;
}

export function mergeAuthoritativeSummary(
  visibleSummary: CashSettlementSummary,
  apiSummary: AdminCashSettlementSummary | null,
): CashSettlementSummary {
  if (!apiSummary) {
    return visibleSummary;
  }

  return {
    cashPaymentRowCount: apiSummary.cashPaymentRowCount,
    companyCouponOffset: apiSummary.totalCompanyCouponOffset,
    currency: apiSummary.currency,
    debtAmount: apiSummary.totalDebtAmount,
    highDebtProviderCount: apiSummary.highDebtProviderCount,
    missingPaymentEvidenceCount: apiSummary.missingPaymentEvidenceCount,
    oldestOpenLabel: apiSummary.oldestOpenAt
      ? formatRelativeTime(apiSummary.oldestOpenAt, {
          emptyFallback: '-',
          invalidFallback: '-',
        })
      : '-',
    platformFee: apiSummary.totalPlatformFee,
    providerCount: apiSummary.providerCount,
    rowCount: apiSummary.rowCount,
    staleDebtRowCount: apiSummary.staleDebtRowCount,
    taxAmount: apiSummary.totalTaxAmount,
  };
}
