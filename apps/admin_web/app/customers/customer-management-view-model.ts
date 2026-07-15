import { formatDateTime as formatDate } from '../../lib/admin-format';
import type { AdminPageMetric } from '../../components/admin-page-template';
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
  readonly chatHref: string;
  readonly completedBookings: number;
  readonly countryFlag: string | null;
  readonly countryFlagLabel: string;
  readonly countryLabel: string;
  readonly customerIdLabel: string;
  readonly detailHref: string;
  readonly deviceLanguageLabel: string;
  readonly email: string;
  readonly genderLabel: string;
  readonly id: string;
  readonly initials: string;
  readonly joinedAt: string | null;
  readonly lastCompletedAt: string | null;
  readonly lastLoginAddressLabel: string;
  readonly lastSeenAt: string | null;
  readonly name: string;
  readonly paymentsHref: string;
  readonly phone: string;
  readonly totalWalletAmount: number;
};

export function buildCustomerManagementMetrics(summary: CustomerSummary): AdminPageMetric[] {
  return [
    {
      label: 'Total customers',
      value: summary.total,
      helper: genderBreakdownLabel(summary.genderBreakdown),
      kind: 'record',
      scope: 'All records',
    },
    {
      label: 'Joined today',
      value: summary.todayJoined,
      helper: genderBreakdownLabel(summary.todayJoinedGenderBreakdown),
      kind: 'period',
      scope: 'Today',
    },
    {
      label: 'Active today',
      value: summary.todaySeen,
      helper: genderBreakdownLabel(summary.todaySeenGenderBreakdown),
      kind: 'live',
      scope: 'Today',
    },
    {
      label: 'Active in 30 days',
      value: summary.monthSeen,
      helper: genderBreakdownLabel(summary.monthSeenGenderBreakdown),
      kind: 'period',
      scope: 'Last 30 days',
    },
    {
      label: 'Customer attention',
      value: summary.missingAddress + summary.paymentIssues,
      helper: `Missing address ${summary.missingAddress} / payment issues ${summary.paymentIssues}`,
      kind: 'risk',
      scope: 'Needs action',
    },
    {
      label: 'Push reachable',
      value: summary.pushReachable,
      helper: 'Customers with enabled push devices.',
      kind: 'live',
      scope: 'Live segment',
    },
    {
      label: 'Booking history',
      value: summary.completedBookings,
      helper: 'Completed customer booking records.',
      kind: 'record',
      scope: 'All records',
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

export function buildCustomerManagementTableRows(rows: readonly CustomerRow[]): CustomerManagementTableRow[] {
  return rows.map((row) => {
    const customerIdLabel = compactText(row.id, 12);
    const countryCode = row.deviceLanguageCountryCode;
    const countryLabel = row.deviceLanguageCountryLabel;

    return {
      avatarStatus: customerAvatarStatus(row),
      chatHref: `/chat-archive?q=${encodeURIComponent(row.id)}`,
      completedBookings: row.completedBookings,
      countryFlag: countryCode === 'UNKNOWN' ? null : countryFlagFromRegion(countryCode),
      countryFlagLabel: countryCode === 'UNKNOWN' ? 'Unknown country' : `${countryLabel} flag`,
      countryLabel,
      customerIdLabel,
      detailHref: `/customers/${row.id}`,
      deviceLanguageLabel: row.deviceLanguage,
      email: row.email,
      genderLabel: row.genderLabel,
      id: row.id,
      initials: readInitials(row.name),
      joinedAt: row.joinedAt ?? null,
      lastCompletedAt: row.lastCompletedAt ?? null,
      lastLoginAddressLabel: row.lastLoginAddress,
      lastSeenAt: row.lastSeenAt ?? null,
      name: row.name,
      paymentsHref: `/payments?customer=${encodeURIComponent(row.id)}`,
      phone: row.phone,
      totalWalletAmount: row.capturedSpend,
    };
  });
}

function genderBreakdownLabel(breakdown: CustomerGenderBreakdown) {
  return [
    `Female ${breakdown.female}`,
    `Male ${breakdown.male}`,
    `Other ${breakdown.other}`,
    `Not captured ${breakdown.unknown}`,
  ].join(' / ');
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

function countryFlagFromRegion(region: string) {
  if (!/^[A-Z]{2}$/.test(region)) {
    return null;
  }

  return String.fromCodePoint(...region.split('').map((letter) => 127397 + letter.charCodeAt(0)));
}

function dateMs(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
