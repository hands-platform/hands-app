import type {
  AdminAppSession,
  AdminAppSessionSummary,
  AdminBooking,
  AdminCashSettlementSummary,
  AdminCustomerDirectoryRow,
  AdminProvider,
} from '../../lib/admin-api';
import { adminAvatarStatusFromSignals } from '../../lib/admin-avatar-status';
import { adminCountLabel, partnerDisplayText as operatorDisplayText } from '../../lib/admin-copy';
import { formatMoney, formatRelativeTime, shortDisplayId } from '../../lib/admin-format';

type SignalTimeOptions = {
  readonly appSessionSummary?: AdminAppSessionSummary | null;
  readonly nowMs?: number;
};

type PartnerSignalFacts = {
  readonly hasCashDebt: boolean;
  readonly hasKycPending: boolean;
  readonly hasBankPending: boolean;
  readonly hasFreshLocation: boolean;
};

const PENDING_REVIEW_STATUSES = new Set(['pending', 'PENDING', 'SUBMITTED']);
const MATCHING_PARTICIPANT_STATUSES = new Set(['INVITED', 'PENDING', 'REQUESTED']);

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
  if (options.appSessionSummary) {
    return {
      customerLive: options.appSessionSummary.liveCustomers,
      customerRecent: options.appSessionSummary.recentCustomers,
      partnerLive: options.appSessionSummary.livePartners,
      partnerRecent: options.appSessionSummary.recentPartners,
    };
  }

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

export function buildCustomerSignals(customers: readonly AdminCustomerDirectoryRow[]) {
  return customers
    .map((customer) => {
      const bookings = customer.bookings ?? [];
      const completed = bookings.filter((booking) => booking.status === 'COMPLETED');
      const lastWork = completed[0] ?? bookings[0] ?? null;
      const paidAmount = bookings.reduce((sum, booking) => sum + (booking.payment?.amount ?? 0), 0);
      return {
        id: customer.id,
        name: customer.user?.fullName ?? `Customer ${shortDisplayId(customer.id)}`,
        avatarStatus: adminAvatarStatusFromSignals({
          devices: customer.user?.pushDevices,
          sessions: customer.user?.appSessions,
        }),
        completedCount: completed.length,
        detail: `${adminCountLabel(bookings.length, 'booking')}, ${formatMoney(paidAmount, 'VND')} payment total, ${adminCountLabel(customer.selectedLocationCount, 'saved location')}.`,
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

export type CustomerSignalRow = ReturnType<typeof buildCustomerSignals>[number];

export function buildPartnerSignals(
  partners: readonly AdminProvider[],
  cashSummary: AdminCashSettlementSummary,
  options: SignalTimeOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const cashDebtPartnerIds = new Set(cashSummary.topProviderGroups.map((group) => group.providerProfileId));
  const rows = partners
    .map((partner) => {
      const facts = partnerSignalFacts(partner, cashDebtPartnerIds, nowMs);
      const posture = partnerSignalPosture(facts);
      const completed =
        partner.activitySummary?.completedWorkCount ??
        (partner.selectedBookings ?? []).filter((booking) => booking.status === 'COMPLETED').length;
      return {
        id: partner.id,
        name: operatorDisplayText(
          partner.displayName ?? partner.legalName ?? partner.user?.fullName ?? 'Partner',
        ),
        avatarStatus: partnerHandoffAvatarStatus(partner),
        status: posture.status,
        detail: `${adminCountLabel(completed, 'completed booking')}, ${partner.status}, location ${partner.currentLocationUpdatedAt ? relativeTime(partner.currentLocationUpdatedAt) : 'not shared'}.`,
        action: posture.action,
        className: posture.className,
        attention: posture.attention,
        sortPriority: posture.sortPriority,
      };
    })
    .sort((a, b) => b.sortPriority - a.sortPriority);
  return { rows, attentionCount: rows.filter((row) => row.attention).length };
}

export type PartnerSignalRow = ReturnType<typeof buildPartnerSignals>['rows'][number];

function partnerHandoffAvatarStatus(partner: AdminProvider) {
  return adminAvatarStatusFromSignals({
    devices: [...(partner.user?.pushDevices ?? []), ...(partner.devices ?? [])],
    fallbackOnline: partner.status === 'ONLINE_AVAILABLE' || partner.status === 'ONLINE_AVAILABLE_SOON',
    matching: (partner.participants ?? []).some((participant) =>
      MATCHING_PARTICIPANT_STATUSES.has(participant.status),
    ),
    sessions: partner.sessions,
    working: partner.status === 'ONLINE_BUSY',
  });
}

function partnerSignalFacts(
  partner: AdminProvider,
  cashDebtPartnerIds: ReadonlySet<string>,
  nowMs: number,
): PartnerSignalFacts {
  if (partner.attentionSignals) {
    return {
      hasCashDebt: partner.attentionSignals.cashDebt,
      hasKycPending: partner.attentionSignals.kycPending,
      hasBankPending: partner.attentionSignals.bankPending,
      hasFreshLocation: !partner.attentionSignals.locationStale,
    };
  }

  return {
    hasCashDebt: cashDebtPartnerIds.has(partner.id),
    hasKycPending: hasPendingReviewStatus(partner.kyc?.status),
    hasBankPending: (partner.bankAccounts ?? []).some((account) =>
      hasPendingReviewStatus(account.status),
    ),
    hasFreshLocation: recentlyChangedWithin(partner.currentLocationUpdatedAt, nowMs, 30),
  };
}

function partnerSignalPosture(facts: PartnerSignalFacts) {
  const sortPriority =
    (facts.hasCashDebt ? 5 : 0) +
    (facts.hasKycPending ? 3 : 0) +
    (facts.hasBankPending ? 2 : 0) +
    (!facts.hasFreshLocation ? 1 : 0);

  if (facts.hasCashDebt) {
    return {
      action: 'Open cash settlement before final acceptance, service start, or payout release.',
      attention: true,
      className: 'pill pill-danger',
      sortPriority,
      status: 'Cash settlement',
    };
  }

  if (facts.hasKycPending) {
    return {
      action: 'Open Partner documents for review.',
      attention: true,
      className: 'pill pill-warn',
      sortPriority,
      status: 'KYC review',
    };
  }

  if (facts.hasBankPending) {
    return {
      action: 'Open payout account review.',
      attention: true,
      className: 'pill pill-warn',
      sortPriority,
      status: 'Bank review',
    };
  }

  return {
    action: 'Continue normal operational watch.',
    attention: !facts.hasFreshLocation,
    className: 'pill pill-success',
    sortPriority,
    status: facts.hasFreshLocation ? 'Location fresh' : 'Location stale',
  };
}

function hasPendingReviewStatus(status?: string | null) {
  return PENDING_REVIEW_STATUSES.has(status ?? '');
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
