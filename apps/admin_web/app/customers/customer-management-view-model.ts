import { formatDateTime as formatDate, formatMoney } from '../../lib/admin-format';
import type { AdminPageMetric } from '../../components/admin-page-template';
import type { CustomerRow } from './customer-list-model';

type CustomerSummary = {
  total: number;
  live: number;
  recentJoins: number;
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
  latestBookingAt?: string | null;
  latestCompletedAt?: string | null;
};

export type CustomerManagementSpotlight = {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
};

export type CustomerManagementTableRow = {
  readonly activityDetail: string;
  readonly activityLabel: string;
  readonly addressLabel: string;
  readonly bookingLabel: string;
  readonly chatHref: string;
  readonly chatLabel: string;
  readonly closureLabel: string;
  readonly customerIdLabel: string;
  readonly detailHref: string;
  readonly email: string;
  readonly financeDetail: string;
  readonly financeLabel: string;
  readonly initials: string;
  readonly joinedLabel: string;
  readonly name: string;
  readonly opsDetail: string;
  readonly opsLabel: string;
  readonly paymentsHref: string;
  readonly patternDetail: string;
  readonly patternLabel: string;
  readonly phone: string;
  readonly reachabilityDetail: string;
  readonly reachabilityLabel: string;
  readonly sessionLabel: string;
};

export function buildCustomerManagementMetrics(
  summary: CustomerSummary,
  totalCustomerCount: number,
): AdminPageMetric[] {
  return [
    {
      label: 'Total customers',
      value: totalCustomerCount,
      helper: 'Loaded customer profiles in the current workspace.',
    },
    {
      label: 'In app now',
      value: summary.live,
      helper: 'Customer sessions active in the last 30 minutes.',
    },
    {
      label: 'Active bookings',
      value: summary.activeBookings,
      helper: 'Customers who currently need live ops attention.',
    },
    {
      label: 'Push ready',
      value: summary.pushReachable,
      helper: 'Customers with at least one enabled push device.',
    },
    {
      label: 'Completed work',
      value: summary.completedBookings,
      helper: 'Finished service records linked to these customers.',
    },
    {
      label: 'Captured spend',
      value: formatMoney(summary.capturedSpend),
      helper: 'Captured customer payments in this result.',
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
): CustomerManagementTableRow[] {
  return rows.map((row) => {
    const customerIdLabel = compactText(row.id, 12);
    const financeLabel = `${formatMoney(row.capturedSpend)} paid`;
    const financeDetail = `${formatMoney(row.refundAmount)} refunded / ${row.paymentCount} payment row(s)`;
    const activeDetail = row.lastBookingAt ? `Last booking ${formatDate(row.lastBookingAt)}` : 'No booking yet';
    const completedDetail = row.lastCompletedAt
      ? `Last completed ${formatDate(row.lastCompletedAt)}`
      : 'No completed work yet';
    const reachabilityDetail = row.pushReachable
      ? `${row.latestSessionPlatform} / push ready`
      : `${row.latestSessionPlatform} / no push device`;
    const opsDetail = `${row.chatRooms} chat room(s) / ${row.memoCount} memo(s) / ${row.paymentIssues} payment follow-up`;

    return {
      activityDetail: row.activeBookings > 0 ? activeDetail : completedDetail,
      activityLabel:
        row.activeBookings > 0
          ? `${row.activeBookings} active booking(s)`
          : row.completedBookings > 0
            ? `${row.completedBookings} completed work row(s)`
            : row.bookingCount > 0
              ? `${row.bookingCount} booking record(s)`
              : 'New customer profile',
      addressLabel:
        row.addressCount > 0
          ? `${row.addressCount} saved location(s)`
          : 'Needs saved location follow-up',
      bookingLabel: `${row.bookingCount} booking(s) / ${row.firstPickBookings} first-pick / ${row.customerChoiceBookings} final choice`,
      chatHref: `/chat-archive?q=${encodeURIComponent(row.id)}`,
      chatLabel: row.chatRooms > 0 ? `${row.chatRooms} retained room(s)` : 'No retained chat room',
      closureLabel: `${row.cancelledBookings} closed / ${row.noShowBookings} no-show`,
      customerIdLabel,
      detailHref: `/customers/${row.id}`,
      email: row.email,
      financeDetail,
      financeLabel,
      initials: readInitials(row.name),
      joinedLabel: row.joinedAt ? formatDate(row.joinedAt) : 'Join date missing',
      name: row.name,
      opsDetail,
      opsLabel: row.latestMemoTitle,
      paymentsHref: `/payments?customer=${encodeURIComponent(row.id)}`,
      patternDetail: `${row.commonArea} / repeated ${row.commonPartner}`,
      patternLabel: row.commonService,
      phone: row.phone,
      reachabilityDetail,
      reachabilityLabel: row.isLive ? 'In app now' : row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No app session',
      sessionLabel: row.latestSessionDevice,
    };
  });
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

function compactText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
