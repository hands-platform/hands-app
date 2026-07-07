import { readSearchParam } from '../../lib/date-range';

export const DEFAULT_PARTNER_PAGE_SIZE = 10;
export const PARTNER_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type ProviderSecurityState =
  | 'clear'
  | 'account-blocked'
  | 'blocked'
  | 'session-check'
  | 'shared'
  | 'missing';

export type ProviderFilters = {
  activity: string;
  page: number;
  pageSize: number;
  q: string;
  verification: string;
  providerStatus: string;
  kyc: string;
  location: string;
  security: string;
  readiness: string;
  bookingFlow: string;
  review: string;
  sort: string;
};

export type PartnerDataHrefs = {
  readonly listHref: string;
  readonly listIsServerPaginated: boolean;
  readonly summaryHref: string;
  readonly summaryMatchesVisibleFilter: boolean;
};

export function buildProviderFilters(
  params: Record<string, string | string[] | undefined>,
): ProviderFilters {
  return {
    activity: normalizePartnerActivityFilter(readParam(params.activity)),
    page: readPageNumber(params.page),
    pageSize: readPageSize(params.pageSize),
    q: readParam(params.q),
    verification: readParam(params.verification),
    providerStatus: readProviderStatusFilter(readParam(params.providerStatus), readParam(params.onlineStatus)),
    kyc: readParam(params.kyc),
    location: readParam(params.location),
    security: normalizeProviderSecurityFilter(readParam(params.security)),
    readiness: readParam(params.readiness),
    bookingFlow: normalizePartnerBookingFlowFilter(readParam(params.bookingFlow)),
    review: normalizePartnerReviewFilter(readParam(params.review)),
    sort: readPartnerSort(readParam(params.sort)),
  };
}

export function buildPartnerDataHrefs(filters: ProviderFilters): PartnerDataHrefs {
  const listParams = new URLSearchParams();
  const summaryParams = new URLSearchParams();
  const listIsServerPaginated = canUsePartnerDirectoryServerPagination(filters);
  const summaryMatchesVisibleFilter = !hasLocalOnlyPartnerFilters(filters);
  const listTake = listIsServerPaginated
    ? filters.pageSize
    : PARTNER_LOCAL_FILTER_HYDRATION_LIMIT;

  listParams.set('take', String(listTake));
  if (listIsServerPaginated) {
    const skip = (filters.page - 1) * filters.pageSize;
    if (skip > 0) {
      listParams.set('skip', String(skip));
    }
  }

  if (filters.q) {
    listParams.set('q', filters.q);
    summaryParams.set('q', filters.q);
  }

  setPartnerDirectoryServerFilter(listParams, summaryParams, 'verification', filters.verification);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'providerStatus', filters.providerStatus);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'kyc', filters.kyc);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'bookingFlow', filters.bookingFlow);
  if (filters.sort === 'name') {
    listParams.set('sort', filters.sort);
  }

  if (isPrimaryPartnerReview(filters.review)) {
    listParams.set('review', filters.review);
    summaryParams.set('review', filters.review);
  }

  return {
    listHref: `/admin/partners/list-providers?${listParams.toString()}`,
    listIsServerPaginated,
    summaryHref: summaryMatchesVisibleFilter && summaryParams.toString()
      ? `/admin/partners/list-providers/summary?${summaryParams.toString()}`
      : '/admin/partners/list-providers/summary',
    summaryMatchesVisibleFilter,
  };
}

export type PartnerPagination<T> = {
  readonly from: number;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export function paginatePartnerRows<T>(
  rows: readonly T[],
  filters: Pick<ProviderFilters, 'page' | 'pageSize'>,
): PartnerPagination<T> {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;
  const paginatedRows = rows.slice(start, start + filters.pageSize);

  return {
    from: totalRows === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows: paginatedRows,
    to: Math.min(start + filters.pageSize, totalRows),
    totalPages,
    totalRows,
  };
}

export function partnerRowsPagination<T>(
  rows: readonly T[],
  filters: Pick<ProviderFilters, 'page' | 'pageSize'>,
  options: { readonly serverPaginated?: boolean; readonly totalRows?: number } = {},
): PartnerPagination<T> {
  if (!options.serverPaginated) {
    return paginatePartnerRows(rows, filters);
  }

  const totalRows = Math.max(0, Math.trunc(options.totalRows ?? rows.length));
  const totalPages = Math.max(1, Math.ceil(totalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: totalRows === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows,
    to: Math.min(start + rows.length, totalRows),
    totalPages,
    totalRows,
  };
}

export function buildPartnerListHref(filters: ProviderFilters, overrides: Partial<ProviderFilters> = {}) {
  const next: ProviderFilters = {
    ...filters,
    ...overrides,
    page: overrides.page ?? 1,
  };
  const params = new URLSearchParams();

  partnerFilterHrefParamKeys.forEach((key) => {
    const value = next[key];
    if (value && !(key === 'sort' && value === 'ops-priority')) {
      params.set(key, value);
    }
  });
  if (next.pageSize !== DEFAULT_PARTNER_PAGE_SIZE) {
    params.set('pageSize', String(next.pageSize));
  }
  if (next.page > 1) {
    params.set('page', String(next.page));
  }

  const query = params.toString();
  return query ? `/partners?${query}` : '/partners';
}

export function buildProviderActiveFilters(filters: ProviderFilters) {
  return [
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Partner list is narrowed by name, phone, location, service, report, or control text.',
        }
      : null,
    filters.verification
      ? {
          kind: 'verification',
          value: filters.verification,
          label: `Verification: ${filters.verification}`,
          description: providerFilterDescription('verification', filters.verification),
        }
      : null,
    filters.providerStatus
      ? {
          kind: 'providerStatus',
          value: filters.providerStatus,
          label: `State: ${partnerProviderStatusFilterLabel(filters.providerStatus)}`,
          description: providerFilterDescription('providerStatus', filters.providerStatus),
        }
      : null,
    filters.kyc
      ? {
          kind: 'kyc',
          value: filters.kyc,
          label: `KYC: ${filters.kyc}`,
          description: providerFilterDescription('kyc', filters.kyc),
        }
      : null,
    filters.location
      ? {
          kind: 'location',
          value: filters.location,
          label: `Location: ${filters.location}`,
          description: providerFilterDescription('location', filters.location),
        }
      : null,
    filters.security
      ? {
          kind: 'security',
          value: filters.security,
          label: `Device/session: ${providerSecurityLabel(filters.security as ProviderSecurityState)}`,
          description: providerFilterDescription('security', filters.security),
        }
      : null,
    filters.readiness
      ? {
          kind: 'readiness',
          value: filters.readiness,
          label: `Readiness: ${filters.readiness}`,
          description: providerFilterDescription('readiness', filters.readiness),
        }
      : null,
    filters.activity
      ? {
          kind: 'activity',
          value: filters.activity,
          label: `Activity: ${partnerActivityFilterLabel(filters.activity)}`,
          description: providerFilterDescription('activity', filters.activity),
        }
      : null,
    filters.bookingFlow
      ? {
          kind: 'bookingFlow',
          value: filters.bookingFlow,
          label: `Booking flow: ${partnerBookingFlowFilterLabel(filters.bookingFlow)}`,
          description: providerFilterDescription('bookingFlow', filters.bookingFlow),
        }
      : null,
    filters.review
      ? {
          kind: 'review',
          value: filters.review,
          label: `Review: ${partnerReviewFilterLabel(filters.review)}`,
          description: providerFilterDescription('review', filters.review),
        }
      : null,
    filters.sort !== 'ops-priority'
      ? {
          kind: 'sort',
          value: filters.sort,
          label: `Sort: ${partnerSortLabel(filters.sort)}`,
          description: 'Partner list sort order is changed for a specific checklist review.',
        }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string; label: string; description: string }>;
}

export function providerFilterDescription(kind: string, value: string) {
  if (kind === 'verification' && value === 'SUBMITTED') {
    return 'Submitted identity files are waiting for admin approval or rejection.';
  }
  if (kind === 'verification' && value === 'APPROVED') {
    return 'Approved partners can progress toward dispatch if other readiness checks pass.';
  }
  if (kind === 'verification' && value === 'BLOCKED') {
    return 'Blocked partner accounts cannot receive customer requests.';
  }
  if (kind === 'providerStatus') {
    return 'Partner availability is narrowed to the selected online/offline state.';
  }
  if (kind === 'kyc') {
    return 'KYC review is narrowed to the selected identity state.';
  }
  if (kind === 'location') {
    return 'Location freshness is narrowed so dispatch can check stale or missing partner pins.';
  }
  if (kind === 'security') {
    return 'Device/session review is narrowed to device, session, or account control state.';
  }
  if (kind === 'readiness') {
    return 'Readiness shows whether a Partner can safely appear in customer discovery and dispatch.';
  }
  if (kind === 'activity' && value === 'never-online') {
    return 'Activity is narrowed to approved Partners without a recorded app session.';
  }
  if (kind === 'activity' && value === 'inactive-7d') {
    return 'Activity is narrowed to Partners without factual activity in the last 7 days.';
  }
  if (kind === 'activity' && value === 'inactive-30d') {
    return 'Activity is narrowed to Partners without factual activity in the last 30 days.';
  }
  if (kind === 'bookingFlow' && value === 'active-booking') {
    return 'Booking flow is narrowed to Partners with live or in-progress booking records.';
  }
  if (kind === 'bookingFlow' && value === 'first-pick') {
    return 'Booking flow is narrowed to Partners that were the preferred first-pick Partner.';
  }
  if (kind === 'bookingFlow' && value === 'marketplace-joined') {
    return 'Booking flow is narrowed to Partners that participated in an open matching request.';
  }
  if (kind === 'bookingFlow' && value === 'final-partner') {
    return 'Booking flow is narrowed to Partners selected by the customer as final Partner.';
  }
  if (kind === 'bookingFlow' && value === 'chat-live') {
    return 'Booking flow is narrowed to partners with retained booking chat rooms.';
  }
  if (kind === 'bookingFlow' && value === 'chat-missing') {
    return 'Booking flow is narrowed to matched or service-stage rows where chat room evidence is missing.';
  }
  if (kind === 'bookingFlow' && value === 'completed-work') {
    return 'Booking flow is narrowed to partners with completed work records.';
  }
  if (kind === 'bookingFlow' && value === 'no-work') {
    return 'Booking flow is narrowed to partners with no completed work yet.';
  }
  if (kind === 'review' && value === 'push') {
    return 'Push readiness highlights partners whose devices cannot reliably receive booking alerts.';
  }
  if (kind === 'review' && value === 'reports') {
    return 'Report review highlights partners with open reports or active account controls.';
  }
  if (kind === 'review' && value === 'public-media') {
    return 'Public media review highlights uploaded partner photos that are pending or rejected.';
  }
  if (kind === 'review' && value === 'bank') {
    return 'Withdrawal detail review highlights bank details submitted for wallet withdrawal or manual settlement, not Level 2 matching approval.';
  }
  if (kind === 'review' && value === 'payout-setup') {
    return 'First earning payout profile highlights partners who have earned revenue but still need withdrawal address or payout agreement follow-up.';
  }
  if (kind === 'review' && value === 'cash-debt') {
    return 'Cash fee debt highlights Partners whose final acceptance, service start, and payout release wait for HANDS commission settlement.';
  }
  if (kind === 'review' && value === 'tax') {
    return 'Tax profile optional highlights submitted legacy records only; tax profile registration is not required for Vietnam MVP.';
  }
  if (kind === 'review' && value === 'unapproved') {
    return 'Unapproved Partners combines registration, KYC, required documents, public media, and hold items that need admin approval from the Partner detail page.';
  }
  if (kind === 'review' && value === 'unsettled') {
    return 'Unsettled Partners shows Partners whose wallet balance is negative and need settlement before final acceptance, service start, or payout release.';
  }
  if (kind === 'review' && value === 'acceptance-blocked') {
    return 'Direct request held highlights partners still waiting on account, identity, device, location, or alert gates before preferred direct requests.';
  }
  if (kind === 'review' && value === 'direct-ready') {
    return 'Direct request ready highlights partners who can receive a preferred customer request immediately.';
  }
  if (kind === 'review' && value === 'marketplace-ready') {
    return 'Marketplace ready highlights partners who can receive availability alerts and join customer choice lists.';
  }
  if (kind === 'review' && value === 'marketplace-blocked') {
    return 'Dispatch repair highlights Partners who need location, status, identity, or alert fixes before operators rely on booking participation.';
  }
  if (kind === 'review') {
    return 'Review queue focuses the table on one operational approval lane.';
  }
  return 'Partner list is narrowed by the active filter.';
}

export function emptyProviderMessage(activeFilters: Array<{ description: string }>) {
  if (activeFilters.length === 0) {
    return 'No partners loaded. Start the API and seed data to populate this table.';
  }
  return 'No partners match the active filters. Clear filters or switch to another review lane.';
}

export function partnerHasAdvancedOperationalFilters(filters: ProviderFilters) {
  return Boolean(
    filters.location ||
      filters.security ||
      filters.activity ||
      (filters.review && !isPrimaryPartnerReview(filters.review)),
  );
}

export function partnerSortLabel(sort: string) {
  if (sort === 'last-work') return 'last completed work';
  if (sort === 'booking-count') return 'booking count';
  if (sort === 'completed-count') return 'completed work count';
  if (sort === 'gross-revenue') return 'gross revenue';
  if (sort === 'pending-payout') return 'pending payout';
  if (sort === 'available-payout') return 'available payout';
  if (sort === 'last-activity') return 'last app activity';
  if (sort === 'location-freshness') return 'location freshness';
  if (sort === 'wallet-debt') return 'wallet debt first';
  if (sort === 'name') return 'name';
  return 'checklist order';
}

export function partnerReviewFilterLabel(review: string) {
  const labels: Record<string, string> = {
    unapproved: 'Unapproved Partners',
    unsettled: 'Unsettled Partners',
    kyc: 'KYC updates',
    documents: 'Document review',
    'public-media': 'Public media review',
    bank: 'Withdrawal detail review',
    'payout-setup': 'First earning payout profile',
    'cash-debt': 'Cash fee debt',
    tax: 'Tax profile optional',
    security: 'Device/session check',
    reports: 'Reports/controls',
    blocked: 'Account blocks',
    location: 'Location freshness',
    push: 'Push alert readiness',
    'acceptance-blocked': 'Direct request held',
    'direct-ready': 'Direct request ready',
    'marketplace-ready': 'Marketplace ready',
    'marketplace-blocked': 'Dispatch repair',
  };
  return labels[review] ?? review;
}

export function partnerBookingFlowFilterLabel(flow: string) {
  const labels: Record<string, string> = {
    'active-booking': 'Has active booking',
    'first-pick': 'First-pick booking',
    'marketplace-joined': 'Marketplace participant',
    'final-partner': 'Customer final choice',
    'chat-live': 'Chat room opened',
    'chat-missing': 'Matched but chat missing',
    'completed-work': 'Completed work',
    'no-work': 'No completed work',
  };
  return labels[flow] ?? flow;
}

export function partnerActivityFilterLabel(activity: string) {
  const labels: Record<string, string> = {
    'never-online': 'Never online',
    'inactive-7d': 'Inactive 7D',
    'inactive-30d': 'Inactive 30D',
  };
  return labels[activity] ?? activity;
}

export function partnerProviderStatusFilterLabel(status: string) {
  const labels: Record<string, string> = {
    ONLINE_AVAILABLE: 'Online available',
    ONLINE_BUSY: 'Online busy',
    ONLINE_AVAILABLE_SOON: 'Available soon',
    OFFLINE: 'Offline',
  };
  return labels[status] ?? status;
}

export function buildPartnerExportSlug(filters: ProviderFilters) {
  const parts = [
    filters.q ? 'search' : '',
    filters.activity ? `activity-${filters.activity}` : '',
    filters.bookingFlow ? `flow-${filters.bookingFlow}` : '',
    filters.review ? `review-${filters.review}` : '',
    filters.providerStatus ? `status-${filters.providerStatus.toLowerCase()}` : '',
    filters.verification ? `verification-${filters.verification.toLowerCase()}` : '',
    filters.kyc ? `kyc-${filters.kyc.toLowerCase()}` : '',
    filters.location ? `location-${filters.location}` : '',
    filters.security ? `device-${filters.security}` : '',
    filters.readiness ? `readiness-${filters.readiness}` : '',
    filters.sort ? `sort-${filters.sort}` : '',
  ].filter(Boolean);

  return (parts.length > 0 ? parts.join('-') : 'all')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function providerSecurityLabel(status: ProviderSecurityState) {
  if (status === 'account-blocked') return 'Account blocked';
  if (status === 'blocked') return 'Device blocked';
  if (status === 'session-check') return 'Session check';
  if (status === 'shared') return 'Shared device';
  if (status === 'missing') return 'No app device';
  return 'Device clear';
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function readPageNumber(value: string | string[] | undefined) {
  const parsed = readPositiveNumber(value);
  return parsed && parsed > 0 ? parsed : 1;
}

function readPageSize(value: string | string[] | undefined) {
  const parsed = readPositiveNumber(value);
  return parsed && PARTNER_PAGE_SIZE_OPTIONS.includes(parsed as (typeof PARTNER_PAGE_SIZE_OPTIONS)[number])
    ? parsed
    : DEFAULT_PARTNER_PAGE_SIZE;
}

function readPositiveNumber(value: string | string[] | undefined) {
  const raw = readSearchParam(value).replaceAll(',', '');
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function normalizePartnerReviewFilter(value: string) {
  if (value === 'backup-ready') return 'marketplace-ready';
  if (value === 'backup-blocked') return 'marketplace-blocked';
  return value;
}

function normalizeProviderSecurityFilter(value: string) {
  if (value === 'suspicious') return 'session-check';
  return value;
}

function normalizePartnerActivityFilter(value: string) {
  return ['never-online', 'inactive-7d', 'inactive-30d'].includes(value) ? value : '';
}

function readProviderStatusFilter(providerStatus: string, onlineStatus: string) {
  if (providerStatus) {
    return providerStatus;
  }

  const aliases: Record<string, string> = {
    available: 'ONLINE_AVAILABLE',
    busy: 'ONLINE_BUSY',
    offline: 'OFFLINE',
    online_available: 'ONLINE_AVAILABLE',
    online_busy: 'ONLINE_BUSY',
    online_available_soon: 'ONLINE_AVAILABLE_SOON',
    soon: 'ONLINE_AVAILABLE_SOON',
  };
  const normalized = onlineStatus.trim().toLowerCase();

  return aliases[normalized] ?? '';
}

function normalizePartnerBookingFlowFilter(value: string) {
  const allowed = [
    'active-booking',
    'first-pick',
    'marketplace-joined',
    'final-partner',
    'chat-live',
    'chat-missing',
    'completed-work',
    'no-work',
  ];
  return allowed.includes(value) ? value : '';
}

function hasLocalOnlyPartnerFilters(filters: ProviderFilters) {
  return Boolean(
    filters.location ||
      filters.security ||
      filters.readiness ||
      filters.activity ||
      (filters.review && !isPrimaryPartnerReview(filters.review)),
  );
}

function canUsePartnerDirectoryServerPagination(filters: ProviderFilters) {
  return !hasLocalOnlyPartnerFilters(filters) && ['ops-priority', 'name'].includes(filters.sort);
}

function readPartnerSort(value: string) {
  return [
    'ops-priority',
    'last-work',
    'booking-count',
    'completed-count',
    'gross-revenue',
    'pending-payout',
    'available-payout',
    'last-activity',
    'location-freshness',
    'wallet-debt',
    'name',
  ].includes(value)
    ? value
    : 'ops-priority';
}

function isPrimaryPartnerReview(value: string) {
  return [
    'unapproved',
    'unsettled',
    'blocked',
    'documents',
    'public-media',
    'bank',
    'tax',
    'reports',
    'kyc',
    'push',
    'cash-debt',
  ].includes(value);
}

const partnerFilterHrefParamKeys = [
  'q',
  'verification',
  'providerStatus',
  'kyc',
  'location',
  'security',
  'readiness',
  'activity',
  'bookingFlow',
  'review',
  'sort',
] as const satisfies readonly (keyof ProviderFilters)[];

const PARTNER_LOCAL_FILTER_HYDRATION_LIMIT = 50;

function setPartnerDirectoryServerFilter(
  listParams: URLSearchParams,
  summaryParams: URLSearchParams,
  key: 'verification' | 'providerStatus' | 'kyc' | 'bookingFlow',
  value: string,
) {
  if (!value) {
    return;
  }

  listParams.set(key, value);
  summaryParams.set(key, value);
}
