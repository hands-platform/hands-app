import { formatDateTime as formatDate, formatMoney } from '../../lib/admin-format';
import type { AdminPageMetric } from '../../components/admin-page-template';
import type { AdminAvatarStatus } from '../../lib/admin-avatar-status';
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
  readonly avatarStatus: AdminAvatarStatus;
  readonly chatHref: string;
  readonly customerIdLabel: string;
  readonly detailHref: string;
  readonly deviceLanguageLabel: string;
  readonly email: string;
  readonly initials: string;
  readonly lastLoginAddressLabel: string;
  readonly lastLoginDateLabel: string;
  readonly joinedLabel: string;
  readonly name: string;
  readonly paymentsHref: string;
  readonly phone: string;
  readonly totalReservationsCompletedLabel: string;
  readonly totalWalletAmountLabel: string;
};

export function buildCustomerManagementMetrics(
  summary: CustomerSummary,
  totalCustomerCount: number,
): AdminPageMetric[] {
  return [
    {
      label: 'Total customers',
      value: totalCustomerCount,
      helper: 'Loaded customer profiles.',
    },
    {
      label: 'Active customers',
      value: summary.live,
      helper: 'Recent live sessions.',
    },
    {
      label: 'Completed reservations',
      value: summary.completedBookings,
      helper: 'Finished reservations.',
    },
    {
      label: 'Total wallet amount',
      value: formatMoney(summary.capturedSpend),
      helper: 'Captured customer wallet total.',
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

    return {
      avatarStatus: customerAvatarStatus(row),
      chatHref: `/chat-archive?q=${encodeURIComponent(row.id)}`,
      customerIdLabel,
      detailHref: `/customers/${row.id}`,
      deviceLanguageLabel: row.deviceLanguage,
      email: row.email,
      initials: readInitials(row.name),
      lastLoginAddressLabel: row.lastLoginAddress,
      lastLoginDateLabel: row.lastSeenAt ? formatDate(row.lastSeenAt) : 'Not captured',
      joinedLabel: row.joinedAt ? formatDate(row.joinedAt) : 'Join date missing',
      name: row.name,
      paymentsHref: `/payments?customer=${encodeURIComponent(row.id)}`,
      phone: row.phone,
      totalReservationsCompletedLabel: String(row.completedBookings),
      totalWalletAmountLabel: formatMoney(row.capturedSpend),
    };
  });
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

function compactText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function dateMs(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
