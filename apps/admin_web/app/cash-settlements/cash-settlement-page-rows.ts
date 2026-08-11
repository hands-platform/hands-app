import type { AdminEarning } from '../../lib/admin-api';
import { formatRelativeTime, shortRecordId } from '../../lib/admin-format';
import type { CashSettlementOpenDebtTableRow } from './cash-settlement-open-debt-table-section';
import {
  bookingServiceLabel,
  CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD,
  CASH_SETTLEMENT_STALE_HOURS,
  cashDebtEvidenceLabel,
  cashSettlementRowAgeHours,
  isOpenCashDebt,
  providerDisplayName,
} from './cash-settlement-page-helpers';
import type {
  CashSettlementFilters,
  CashSettlementQueueFilter,
  CashSettlementRow,
} from './cash-settlement-page-types';

export function buildCashSettlementRows(earnings: readonly AdminEarning[]): CashSettlementRow[] {
  return earnings.flatMap((earning) => {
    if (!isOpenCashDebt(earning)) return [];

    const originalDebtAmount = earning.originalDebtAmount ?? Math.abs(earning.netAmount);
    const allocatedAmount =
      earning.allocatedAmount ??
      (earning.bankDepositCashDebtAllocations?.reduce((sum, allocation) => sum + allocation.amount, 0) ?? 0);
    const remainingDebtAmount =
      earning.remainingDebtAmount ?? Math.max(0, originalDebtAmount - allocatedAmount);
    if (remainingDebtAmount <= 0) return [];

    return [{
      allocatedAmount,
      createdAtLabel: earning.createdAt ? formatRelativeTime(earning.createdAt) : 'Created time unavailable',
      debtAmount: remainingDebtAmount,
      earning,
      originalDebtAmount,
      paymentMethod: earning.booking?.payment?.method ?? 'Payment record missing',
      platformFee: earning.platformFee,
      providerName: providerDisplayName(earning),
      providerPhone: earning.providerProfile?.user?.phone ?? 'Phone unavailable',
      serviceLabel: bookingServiceLabel(earning),
      settlementEvidence: cashDebtEvidenceLabel(earning),
      taxAmount: earning.withholdingAmount ?? 0,
    }];
  });
}

export function applyCashSettlementRowFilters(
  rows: readonly CashSettlementRow[],
  filters: CashSettlementFilters,
): CashSettlementRow[] {
  const query = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (!cashSettlementRowMatchesQueue(row, filters.queue)) return false;
    return !query || cashSettlementSearchText(row).includes(query);
  });
}

export function cashSettlementRowMatchesQueue(row: CashSettlementRow, queue: CashSettlementQueueFilter) {
  switch (queue) {
    case 'stale':
      return cashSettlementRowAgeHours(row) >= CASH_SETTLEMENT_STALE_HOURS;
    case 'high-debt':
      return row.debtAmount >= CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD;
    case 'missing-evidence':
      return row.allocatedAmount === 0;
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
  return rows.map((row) => ({
    allocatedAmount: row.allocatedAmount,
    bookingHref: `/bookings/${row.earning.bookingId}`,
    bookingLabel: shortRecordId(row.earning.bookingId),
    createdAtLabel: row.createdAtLabel,
    currency: row.earning.currency,
    earningId: row.earning.id,
    isOverdue: cashSettlementRowAgeHours(row) >= CASH_SETTLEMENT_STALE_HOURS,
    nextAction: cashSettlementNextAction(row),
    originalDebtAmount: row.originalDebtAmount,
    partnerHref: `/partners/${row.earning.providerProfileId}`,
    paymentMethod: row.paymentMethod,
    providerName: row.providerName,
    providerPhone: row.providerPhone,
    remainingDebtAmount: row.debtAmount,
    serviceLabel: row.serviceLabel,
    settlementEvidence: row.settlementEvidence,
  }));
}

function cashSettlementNextAction(row: CashSettlementRow) {
  if (!row.earning.booking?.payment || row.paymentMethod !== 'CASH') return 'Review booking payment';
  if (row.allocatedAmount > 0) return 'Review partial recovery';
  if (cashSettlementRowAgeHours(row) >= CASH_SETTLEMENT_STALE_HOURS) return 'Find approved deposit';
  return 'Monitor deposit evidence';
}

function cashSettlementSearchText(row: CashSettlementRow) {
  return [
    row.providerName,
    row.providerPhone,
    row.earning.providerProfileId,
    row.earning.bookingId,
    row.earning.id,
    row.earning.settlementRef,
    row.paymentMethod,
    row.serviceLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
