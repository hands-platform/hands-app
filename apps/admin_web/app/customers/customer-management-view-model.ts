import { formatDateTime as formatDate } from '../../lib/admin-format';
import type { AdminPageMetric } from '../../components/admin-page-template';
import type { StatusBadgeTone } from '../../components/status-badge';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
import type { CustomerRow } from './customer-list-model';

type CustomerSummary = {
  total: number;
  live: number;
  recentJoins: number;
  genderBreakdown: CustomerGenderBreakdown;
  todayJoined: number;
  todayJoinedGenderBreakdown: CustomerGenderBreakdown;
  todaySeen: number;
  todaySeenGenderBreakdown: CustomerGenderBreakdown;
  monthSeen: number;
  monthSeenGenderBreakdown: CustomerGenderBreakdown;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  addresses: number;
  capturedSpend: number;
  refundAmount: number;
  pushReachable: number;
  chatRooms: number;
  missingAddress: number;
  paymentIssues: number;
  needsAction: number;
  latestBookingAt?: string | null;
  latestCompletedAt?: string | null;
};

type CustomerGenderBreakdown = {
  female: number;
  male: number;
  other: number;
  unknown: number;
};

export type CustomerManagementSpotlight = {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
};

export type CustomerManagementTableRow = {
  readonly avatarStatus: AdminAvatarStatus;
  readonly bookingStatusLabel: string;
  readonly bookingStatusTone: StatusBadgeTone;
  readonly bookingUpdatedAt: string | null;
  readonly bookingCount: number;
  readonly completedBookings: number;
  readonly customerWalletBalance: number;
  readonly detailHref: string | null;
  readonly id: string;
  readonly initials: string;
  readonly historySignals: readonly CustomerAttentionSignal[];
  readonly lastCompletedAt: string | null;
  readonly lastSeenAt: string | null;
  readonly name: string;
  readonly openSignals: readonly CustomerAttentionSignal[];
  readonly phone: string;
  readonly shortId: string;
  readonly totalPaid: number;
};

type CustomerAttentionSignal = {
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

export function buildCustomerManagementMetrics(summary: CustomerSummary): AdminPageMetric[] {
  return [
    {
      label: 'Needs attention',
      value: summary.needsAction,
      helper: 'Payment, refund, or reported-review issues.',
      kind: 'risk',
      scope: 'Needs action',
    },
    {
      label: 'Active booking',
      value: summary.activeBookings,
      helper: 'Matching or in service.',
      kind: 'live',
      scope: 'Live',
    },
    {
      label: 'New today',
      value: summary.todayJoined,
      helper: 'Profiles created today in Vietnam time.',
      kind: 'period',
      scope: 'Today',
    },
  ];
}

export function buildCustomerManagementSpotlights(
  summary: CustomerSummary,
  filteredCount: number,
  totalCount: number,
  activeFilterCount: number,
): CustomerManagementSpotlight[] {
  return [
    {
      label: 'Loaded rows',
      value: `${filteredCount}/${totalCount}`,
      detail:
        activeFilterCount > 0
          ? `${activeFilterCount} active filters are shaping this customer list.`
          : 'No active filters. The full customer directory is visible.',
    },
    {
      label: 'Address follow-up',
      value: String(summary.missingAddress),
      detail: 'Customer profiles without a saved location or selected map pin.',
    },
    {
      label: 'Payment follow-up',
      value: String(summary.paymentIssues),
      detail: 'Payment rows that are not yet authorized or captured.',
    },
    {
      label: 'Retained chat rooms',
      value: String(summary.chatRooms),
      detail: 'Customer and Partner chat archives currently retained for operators.',
    },
    {
      label: 'Latest booking pulse',
      value: summary.latestBookingAt ? formatDate(summary.latestBookingAt) : 'No booking',
      detail: 'Most recent customer-linked booking activity in the result set.',
    },
    {
      label: 'Latest completed work',
      value: summary.latestCompletedAt ? formatDate(summary.latestCompletedAt) : 'No completed work',
      detail: 'Newest completed service available in the filtered result.',
    },
  ];
}

export function buildCustomerManagementTableRows(
  rows: readonly CustomerRow[],
  returnTo = '/customers',
  canViewCustomerDetail = true,
): CustomerManagementTableRow[] {
  return rows.map((row) => {
    const bookingStatus = customerBookingStatus(row);
    return {
      avatarStatus: customerAvatarStatus(row),
      bookingStatusLabel: bookingStatus.label,
      bookingStatusTone: bookingStatus.tone,
      bookingUpdatedAt: row.currentBookingUpdatedAt ?? null,
      bookingCount: row.bookingCount,
      completedBookings: row.completedBookings,
      customerWalletBalance: row.customerWalletBalance,
      detailHref: canViewCustomerDetail
        ? `/customers/${row.id}?returnTo=${encodeURIComponent(returnTo)}`
        : null,
      id: row.id,
      initials: readInitials(row.name),
      historySignals: customerHistorySignals(row),
      lastCompletedAt: row.lastCompletedAt ?? null,
      lastSeenAt: row.lastSeenAt ?? null,
      name: row.name,
      openSignals: customerOpenSignals(row),
      phone: row.phone,
      shortId: shortCustomerId(row.id),
      totalPaid: row.capturedSpend,
    };
  });
}

function customerBookingStatus(row: CustomerRow): { label: string; tone: StatusBadgeTone } {
  if (row.serviceLiveBookings > 0) return { label: 'In service', tone: 'info' };
  if (row.openMatchingBookings > 0) return { label: 'Matching', tone: 'primary' };
  if (row.activeBookings > 0) return { label: 'Active booking', tone: 'info' };
  return { label: 'No open booking', tone: 'neutral' };
}

function customerOpenSignals(row: CustomerRow): CustomerAttentionSignal[] {
  const signals: CustomerAttentionSignal[] = [];
  if (row.paymentIssues > 0) {
    signals.push({ label: `Payment failed ${row.paymentIssues}`, tone: 'danger' });
  }
  if (row.refundRequests > 0) {
    signals.push({ label: `Refund requests ${row.refundRequests}`, tone: 'warning' });
  }
  if (row.reportedReviews > 0) {
    signals.push({ label: `Reported reviews ${row.reportedReviews}`, tone: 'danger' });
  }
  return signals;
}

function customerHistorySignals(row: CustomerRow): CustomerAttentionSignal[] {
  const signals: CustomerAttentionSignal[] = [];
  if (row.noShowBookings > 0) signals.push({ label: `No-show ${row.noShowBookings}`, tone: 'neutral' });
  if (row.customerClosedBookings > 0) {
    signals.push({ label: `Customer cancellations ${row.customerClosedBookings}`, tone: 'neutral' });
  }
  return signals;
}

function customerAvatarStatus(row: CustomerRow): AdminAvatarStatus {
  if (row.lastSeenAt && !row.pushReachable && Date.now() - dateMs(row.lastSeenAt) >= 30 * 24 * 60 * 60_000) {
    return 'app-deleted';
  }
  if (row.serviceLiveBookings > 0) {
    return 'working';
  }
  if (row.openMatchingBookings > 0 || row.firstPickBookings > 0) {
    return 'matching';
  }
  if (row.isLive) {
    return 'online';
  }
  return 'offline';
}

function readInitials(name: string) {
  const tokens = name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) {
    return 'CU';
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? '').join('');
}

function shortCustomerId(id: string) {
  return id.length <= 12 ? id : `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function dateMs(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
