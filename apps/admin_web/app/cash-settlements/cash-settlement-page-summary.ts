import type { AdminCashSettlementSummary } from '../../lib/admin-api';
import { formatRelativeTime } from '../../lib/admin-format';
import {
  CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  CASH_SETTLEMENT_STALE_MS,
  providerSettlementReference,
} from './cash-settlement-page-helpers';
import type {
  CashSettlementProviderGroup,
  CashSettlementRow,
  CashSettlementSummary,
} from './cash-settlement-page-types';

export function buildProviderGroups(rows: readonly CashSettlementRow[]): CashSettlementProviderGroup[] {
  const grouped = new Map<string, CashSettlementProviderGroup>();

  rows.forEach((row) => {
    const providerProfileId = row.earning.providerProfileId;
    const existing = grouped.get(providerProfileId);
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    const item = existing ?? {
      currency: row.earning.currency,
      debtAmount: 0,
      oldestOpenLabel: formatRelativeTime(row.earning.createdAt, {
        emptyFallback: '-',
        invalidFallback: '-',
      }),
      oldestOpenMs: createdMs,
      platformFee: 0,
      providerName: row.providerName,
      providerProfileId,
      rowCount: 0,
      settlementReference: providerSettlementReference(providerProfileId),
      taxAmount: 0,
    };

    item.rowCount += 1;
    item.debtAmount += row.debtAmount;
    item.platformFee += row.platformFee;
    item.taxAmount += row.taxAmount;
    if (createdMs < item.oldestOpenMs) {
      item.oldestOpenMs = createdMs;
      item.oldestOpenLabel = formatRelativeTime(row.earning.createdAt, {
        emptyFallback: '-',
        invalidFallback: '-',
      });
    }

    grouped.set(providerProfileId, item);
  });

  return [...grouped.values()].sort((left, right) => right.debtAmount - left.debtAmount);
}

export function buildSummary(
  rows: readonly CashSettlementRow[],
  providers: readonly CashSettlementProviderGroup[],
): CashSettlementSummary {
  const oldestMs = rows.reduce((oldest, row) => {
    const createdMs = Date.parse(row.earning.createdAt ?? '') || Date.now();
    return Math.min(oldest, createdMs);
  }, Date.now());

  return {
    cashPaymentRowCount: rows.filter((row) => row.earning.booking?.payment?.method === 'CASH').length,
    currency: rows[0]?.earning.currency ?? 'VND',
    debtAmount: rows.reduce((sum, row) => sum + row.debtAmount, 0),
    highDebtProviderCount: providers.filter(
      (provider) => provider.debtAmount >= CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
    ).length,
    missingPaymentEvidenceCount: rows.filter((row) => !row.earning.booking?.payment).length,
    oldestOpenLabel: rows.length
      ? formatRelativeTime(new Date(oldestMs).toISOString(), {
          emptyFallback: '-',
          invalidFallback: '-',
        })
      : '-',
    platformFee: rows.reduce((sum, row) => sum + row.platformFee, 0),
    providerCount: providers.length,
    rowCount: rows.length,
    staleDebtRowCount: rows.filter((row) => {
      const createdMs = Date.parse(row.earning.createdAt ?? '');
      return Number.isFinite(createdMs) && Date.now() - createdMs > CASH_SETTLEMENT_STALE_MS;
    }).length,
    taxAmount: rows.reduce((sum, row) => sum + row.taxAmount, 0),
  };
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
