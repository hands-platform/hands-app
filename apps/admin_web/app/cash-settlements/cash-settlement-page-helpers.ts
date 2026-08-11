import type { AdminEarning } from '../../lib/admin-api';
import { partnerDisplayText } from '../../lib/admin-copy';
import { isPostMatchCancellationEarning } from '../bookings/booking-post-match-cancellation-earning';
import type { CashSettlementRow } from './cash-settlement-page-types';

export const CASH_SETTLEMENT_HIGH_DEBT_THRESHOLD = 500_000;
export const CASH_SETTLEMENT_STALE_HOURS = 24;
export const CASH_SETTLEMENT_STALE_MS = CASH_SETTLEMENT_STALE_HOURS * 60 * 60 * 1000;

export function isOpenCashDebt(earning: AdminEarning) {
  if (earning.status === 'PAID' || earning.status === 'CANCELLED') {
    return false;
  }
  if (isPostMatchCancellationEarning(earning)) {
    return false;
  }
  return earning.netAmount < 0 && (earning.booking?.payment?.method === 'CASH' || earning.platformFee > 0);
}

export function providerDisplayName(earning: AdminEarning) {
  return partnerDisplayText(
    earning.providerProfile?.displayName ?? earning.providerProfile?.user?.fullName ?? 'Unknown Partner',
  );
}

export function bookingServiceLabel(earning: AdminEarning) {
  const service = earning.booking?.services?.[0]?.service;
  if (!service) {
    return 'Unlinked service option';
  }
  return `${service.name} / ${service.durationMin} min`;
}

export function cashDebtEvidenceLabel(earning: AdminEarning) {
  const allocations = earning.bankDepositCashDebtAllocations ?? [];
  if (allocations.length > 0) {
    const amount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    return `${allocations.length} approved deposit allocation(s) linked · ${amount.toLocaleString('vi-VN')} ${earning.currency}.`;
  }
  return 'No approved settlement evidence is linked.';
}

export function cashSettlementRowAgeHours(row: CashSettlementRow) {
  const createdMs = Date.parse(row.earning.createdAt ?? '');
  if (!Number.isFinite(createdMs)) {
    return 0;
  }
  return (Date.now() - createdMs) / (60 * 60 * 1000);
}
