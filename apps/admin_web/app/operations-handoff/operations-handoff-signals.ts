import type {
  AdminAppSession,
  AdminBooking,
  AdminCashSettlementSummary,
  AdminCustomer,
  AdminProvider,
} from '../../lib/admin-api';
import { partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';
import { formatMoney, formatRelativeTime, shortDisplayId } from '../../lib/admin-format';

type SignalTimeOptions = {
  readonly nowMs?: number;
};

export function buildChatSignals(
  bookings: readonly AdminBooking[],
  options: SignalTimeOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const withRooms = bookings.filter((booking) => booking.chatRoom?.id);
  const recentMessageCount = withRooms.reduce(
    (sum, booking) =>
      sum +
      ((booking.chatRoom as { messages?: Array<{ createdAt?: string }> } | null)?.messages ?? []).filter(
        (message) => recentlyChangedWithin(message.createdAt, nowMs),
      ).length,
    0,
  );
  return { roomCount: withRooms.length, recentMessageCount };
}

export function buildPresence(
  sessions: readonly AdminAppSession[],
  options: SignalTimeOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const customerSessions = sessions.filter((session) => session.role === 'CUSTOMER');
  const partnerSessions = sessions.filter(
    (session) => session.role === 'PROVIDER' || session.role === 'PARTNER',
  );
  return {
    customerLive: customerSessions.filter((session) => session.active).length,
    partnerLive: partnerSessions.filter((session) => session.active).length,
    customerRecent: customerSessions.filter((session) =>
      recentlyChangedWithin(session.lastSeenAt, nowMs, 30),
    ).length,
    partnerRecent: partnerSessions.filter((session) =>
      recentlyChangedWithin(session.lastSeenAt, nowMs, 30),
    ).length,
  };
}

export function buildCustomerSignals(customers: readonly AdminCustomer[]) {
  return customers
    .map((customer) => {
      const bookings = customer.bookings ?? [];
      const completed = bookings.filter((booking) => booking.status === 'COMPLETED');
      const lastWork = completed[0] ?? bookings[0] ?? null;
      const paidAmount = bookings.reduce((sum, booking) => sum + (booking.payment?.amount ?? 0), 0);
      return {
        id: customer.id,
        name: customer.user?.fullName ?? customer.user?.phone ?? 'Customer',
        completedCount: completed.length,
        detail: `${bookings.length} booking(s), ${formatMoney(paidAmount, 'VND')} payment total, ${
          customer.selectedLocations?.length ?? 0
        } saved location(s).`,
        lastWorkLabel: lastWork
          ? `Last booking ${shortDisplayId(lastWork.id)} / ${relativeTime(lastWork.updatedAt ?? lastWork.createdAt)}`
          : 'No booking yet',
        sortTime: dateValue(
          lastWork?.updatedAt ?? lastWork?.createdAt ?? customer.user?.updatedAt ?? customer.user?.createdAt,
        ),
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);
}

export function buildPartnerSignals(
  partners: readonly AdminProvider[],
  cashSummary: AdminCashSettlementSummary,
  options: SignalTimeOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const cashDebtPartnerIds = new Set(cashSummary.topProviderGroups.map((group) => group.providerProfileId));
  const rows = partners
    .map((partner) => {
      const hasCashDebt = cashDebtPartnerIds.has(partner.id);
      const hasKycPending = ['pending', 'PENDING', 'SUBMITTED'].includes(partner.kyc?.status ?? '');
      const hasBankPending = (partner.bankAccounts ?? []).some((account) =>
        ['pending', 'PENDING', 'SUBMITTED'].includes(account.status),
      );
      const hasFreshLocation = recentlyChangedWithin(partner.currentLocationUpdatedAt, nowMs, 30);
      const completed = (partner.selectedBookings ?? []).filter(
        (booking) => booking.status === 'COMPLETED',
      ).length;
      const status = hasCashDebt
        ? 'Cash settlement'
        : hasKycPending
          ? 'KYC review'
          : hasBankPending
            ? 'Bank review'
            : hasFreshLocation
              ? 'Location fresh'
              : 'Location stale';
      return {
        id: partner.id,
        name: operatorDisplayText(
          partner.displayName ?? partner.legalName ?? partner.user?.fullName ?? 'Partner',
        ),
        status,
        detail: `${completed} completed booking(s), ${partner.status}, location ${partner.currentLocationUpdatedAt ? relativeTime(partner.currentLocationUpdatedAt) : 'not shared'}.`,
        action: hasCashDebt
          ? 'Open cash settlement before marketplace alerts, participation, or payout release.'
          : hasKycPending
            ? 'Open Partner documents for review.'
            : hasBankPending
              ? 'Open payout account review.'
              : 'Continue normal operational watch.',
        className: hasCashDebt
          ? 'pill pill-danger'
          : hasKycPending || hasBankPending
            ? 'pill pill-warn'
            : 'pill pill-success',
        attention: hasCashDebt || hasKycPending || hasBankPending || !hasFreshLocation,
        sortPriority:
          (hasCashDebt ? 5 : 0) +
          (hasKycPending ? 3 : 0) +
          (hasBankPending ? 2 : 0) +
          (!hasFreshLocation ? 1 : 0),
      };
    })
    .sort((a, b) => b.sortPriority - a.sortPriority);
  return { rows, attentionCount: rows.filter((row) => row.attention).length };
}

function recentlyChangedWithin(value: string | null | undefined, nowMs: number, minutes = 120) {
  const timestamp = dateValue(value);
  if (!timestamp) return false;
  return nowMs - timestamp <= minutes * 60_000;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
