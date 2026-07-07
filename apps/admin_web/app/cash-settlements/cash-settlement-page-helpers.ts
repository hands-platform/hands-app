import type { AdminEarning } from '../../lib/admin-api';
import { partnerDisplayText } from '../../lib/admin-copy';
import { shortRecordId } from '../../lib/admin-format';
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

export function cashSettlementReference(earning: AdminEarning) {
  return `HANDS-CASH-${shortRecordId(earning.bookingId).toUpperCase()}`;
}

export function cashDebtOriginLabel(earning: AdminEarning) {
  const method = earning.booking?.payment?.method ?? 'CASH';
  const service = bookingServiceLabel(earning);
  if (method === 'CASH') {
    return `${service}: Partner collected customer cash; HANDS fee/tax is still unpaid.`;
  }
  return `${service}: negative wallet row needs finance review because payment method is ${method}.`;
}

export function cashDebtEvidenceLabel(earning: AdminEarning) {
  if (earning.settlementRef) {
    return `Settlement reference recorded: ${earning.settlementRef}.`;
  }
  const ledgerRef = earning.walletLedgerEntries?.find((entry) => entry.reference)?.reference;
  if (ledgerRef) {
    return `Wallet impact reference exists: ${ledgerRef}. Confirm whether it is a deposit or offset.`;
  }
  return 'No deposit or approved offset reference is recorded yet.';
}

export function settlementMethodLabel(method?: string | null) {
  if (method === 'PARTNER_DEPOSIT') {
    return 'Partner deposit';
  }
  if (method === 'ADMIN_OFFSET') {
    return 'Admin offset';
  }
  return 'Not recorded yet';
}

export function cashSettlementRowAgeHours(row: CashSettlementRow) {
  const createdMs = Date.parse(row.earning.createdAt ?? '');
  if (!Number.isFinite(createdMs)) {
    return 0;
  }
  return (Date.now() - createdMs) / (60 * 60 * 1000);
}

export function providerSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}
