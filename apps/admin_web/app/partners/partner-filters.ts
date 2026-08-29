import { readSearchParam } from '../../lib/date-range';
import {
  adminQueueSlaFilterLabel,
  readAdminQueueAge,
  readAdminQueueSlaFilter,
  type AdminQueueAge,
  type AdminQueueSlaFilter,
} from '../../lib/admin-queue-list';

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
  age: AdminQueueAge;
  activity: string;
  approvalMissing: string;
  approvalRisk: string;
  city?: string;
  cursor?: string;
  cursorHistory?: string;
  page: number;
  pageSize: number;
  q: string;
  qualityRange?: string;
  verification: string;
  providerStatus: string;
  kyc: string;
  location: string;
  security: string;
  readiness: string;
  bookingFlow: string;
  review: string;
  serviceId?: string;
  sla?: AdminQueueSlaFilter;
  sort: string;
  walletStatus?: string;
};

export type PartnerDataHrefs = {
  readonly listHref: string;
  readonly listIsServerPaginated: boolean;
  readonly listUsesSnapshotCursor?: boolean;
  readonly summaryHref: string;
  readonly summaryMatchesVisibleFilter: boolean;
};

export function buildProviderFilters(params: Record<string, string | string[] | undefined>): ProviderFilters {
  const requestedReview = normalizePartnerReviewFilter(readParam(params.review));
  const legacyReadiness = requestedReview ? '' : normalizePartnerReadinessFilter(readParam(params.readiness));
  const review =
    requestedReview ||
    ({
      ready: 'ready-now',
      'push-missing': 'push',
      'needs-review': 'approval-incomplete',
    }[legacyReadiness] ??
      '');
  const approvalQueue = review === 'approval-pending';
  const onboardingQueue = review === 'unapproved';
  const walletDebtQueue = review === 'unsettled';
  const primaryTaskQueue = approvalQueue || onboardingQueue || walletDebtQueue;
  const approvedOffline = legacyReadiness === 'approved-offline';
  const requestedSort = readPartnerSort(readParam(params.sort));
  const walletDebtSnapshot = walletDebtQueue && requestedSort === 'wallet-debt';
  const cursor = walletDebtSnapshot ? readParam(params.cursor) : '';

  return {
    age: onboardingQueue || walletDebtQueue ? 'all' : readAdminQueueAge(params.age),
    activity:
      approvalQueue || walletDebtQueue ? '' : normalizePartnerActivityFilter(readParam(params.activity)),
    approvalMissing: approvalQueue ? normalizePartnerApprovalMissing(readParam(params.approvalMissing)) : '',
    approvalRisk: approvalQueue ? normalizePartnerApprovalRisk(readParam(params.approvalRisk)) : '',
    city: readParam(params.city),
    cursor,
    cursorHistory: cursor ? readParam(params.cursorHistory) : '',
    page: walletDebtSnapshot ? (cursor ? readPageNumber(params.page) : 1) : readPageNumber(params.page),
    pageSize: readPageSize(params.pageSize),
    q: readParam(params.q),
    qualityRange: normalizePartnerQualityRange(readParam(params.qualityRange)),
    verification:
      approvalQueue || walletDebtQueue ? '' : approvedOffline ? 'APPROVED' : readParam(params.verification),
    providerStatus: primaryTaskQueue
      ? ''
      : approvedOffline
        ? 'OFFLINE'
        : readProviderStatusFilter(readParam(params.providerStatus), readParam(params.onlineStatus)),
    kyc: approvalQueue || walletDebtQueue ? '' : approvedOffline ? 'APPROVED' : readParam(params.kyc),
    location: '',
    security: '',
    readiness: '',
    bookingFlow: primaryTaskQueue ? '' : normalizePartnerBookingFlowFilter(readParam(params.bookingFlow)),
    review,
    serviceId: readParam(params.serviceId),
    sla: review === 'approval-pending' ? readAdminQueueSlaFilter(params.sla) : 'all',
    sort: approvalQueue
      ? 'oldest'
      : requestedSort === 'wallet-debt'
        ? walletDebtQueue
          ? 'wallet-debt'
          : 'newest'
        : primaryTaskQueue && requestedSort === 'oldest'
          ? 'newest'
          : requestedSort,
    walletStatus: normalizePartnerWalletStatus(readParam(params.walletStatus)),
  };
}

export function buildPartnerDataHrefs(filters: ProviderFilters): PartnerDataHrefs {
  const listParams = new URLSearchParams();
  const summaryParams = new URLSearchParams();
  const listIsServerPaginated = true;
  const summaryMatchesVisibleFilter = true;
  const listTake = filters.pageSize;
  const usesSnapshotCursor = filters.review === 'unsettled' && filters.sort === 'wallet-debt';

  listParams.set('take', String(listTake));
  if (usesSnapshotCursor) {
    if (filters.q) listParams.set('q', filters.q);
    if (filters.cursor) listParams.set('cursor', filters.cursor);
    summaryParams.set('review', 'unsettled');
    if (filters.q) summaryParams.set('q', filters.q);

    return {
      listHref: `/admin/partners/wallet-debt-page?${listParams.toString()}`,
      listIsServerPaginated,
      listUsesSnapshotCursor: true,
      summaryHref: `/admin/partners/list-providers/summary?${summaryParams.toString()}`,
      summaryMatchesVisibleFilter,
    };
  }

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
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'approvalMissing', filters.approvalMissing);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'approvalRisk', filters.approvalRisk);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'city', filters.city);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'serviceId', filters.serviceId);
  setPartnerDirectoryServerFilter(listParams, summaryParams, 'walletStatus', filters.walletStatus);
  if (filters.qualityRange && isQualityReview(filters.review)) {
    listParams.set('qualityRange', filters.qualityRange);
    summaryParams.set('qualityRange', filters.qualityRange);
  }
  if (isServerPartnerActivityFilter(filters.activity)) {
    listParams.set('activity', filters.activity);
    summaryParams.set('activity', filters.activity);
  }
  if (filters.age !== 'all') {
    listParams.set('age', filters.age);
    summaryParams.set('age', filters.age);
  }
  if (filters.sla && filters.sla !== 'all') {
    listParams.set('sla', filters.sla);
    summaryParams.set('sla', filters.sla);
  }
  if (filters.sort === 'name' || filters.sort === 'oldest' || filters.sort === 'wallet-debt') {
    listParams.set('sort', filters.sort);
  }

  if (isPrimaryPartnerReview(filters.review)) {
    listParams.set('review', filters.review);
    summaryParams.set('review', filters.review);
  }

  return {
    listHref: `/admin/partners/list-providers?${listParams.toString()}`,
    listIsServerPaginated,
    summaryHref:
      summaryMatchesVisibleFilter && summaryParams.toString()
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
  const merged: ProviderFilters = {
    ...filters,
    ...overrides,
    page: overrides.page ?? 1,
  };
  const next = buildProviderFilters(
    Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, String(value ?? '')])),
  );
  const params = new URLSearchParams();

  partnerFilterHrefParamKeys.forEach((key) => {
    const value = next[key];
    if (
      value &&
      !(key === 'age' && value === 'all') &&
      !(key === 'sla' && value === 'all') &&
      !(key === 'qualityRange' && !isQualityReview(next.review)) &&
      !(key === 'sort' && value === 'newest')
    ) {
      params.set(key, value);
    }
  });
  if (next.cursor) params.set('cursor', next.cursor);
  if (next.cursorHistory) params.set('cursorHistory', next.cursorHistory);
  if (next.pageSize !== DEFAULT_PARTNER_PAGE_SIZE) {
    params.set('pageSize', String(next.pageSize));
  }
  if (next.page > 1) {
    params.set('page', String(next.page));
  }

  const query = params.toString();
  return query ? `/partners?${query}` : '/partners';
}

export function buildPartnerExportHref(filters: ProviderFilters, snapshotCursor = filters.cursor) {
  const params = partnerFilterSearchParams(filters);
  if (filters.review === 'unsettled' && filters.sort === 'wallet-debt' && snapshotCursor) {
    params.set('cursor', snapshotCursor);
  }
  const query = params.toString();
  return query ? `/api/admin/partners/export?${query}` : '/api/admin/partners/export';
}

export function buildPartnerSnapshotFirstHref(filters: ProviderFilters, snapshotCursor = '') {
  return buildPartnerListHref(filters, { cursor: snapshotCursor, cursorHistory: '', page: 1 });
}

export function buildPartnerSnapshotNextHref(
  filters: ProviderFilters,
  nextCursor: string,
  currentCursor = filters.cursor || null,
) {
  const history = [...decodePartnerCursorHistory(filters.cursorHistory), currentCursor];
  return buildPartnerListHref(filters, {
    cursor: nextCursor,
    cursorHistory: encodePartnerCursorHistory(history),
    page: filters.page + 1,
  });
}

export function buildPartnerSnapshotPreviousHref(filters: ProviderFilters) {
  const history = decodePartnerCursorHistory(filters.cursorHistory);
  const previousCursor = history.at(-1) ?? '';
  const nextHistory = history.slice(0, -1);
  return buildPartnerListHref(filters, {
    cursor: previousCursor ?? '',
    cursorHistory: nextHistory.length > 0 ? encodePartnerCursorHistory(nextHistory) : '',
    page: Math.max(1, filters.page - 1),
  });
}

export function buildProviderActiveFilters(filters: ProviderFilters) {
  return [
    filters.age !== 'all'
      ? {
          kind: 'age',
          value: filters.age,
          label: `Age: ${filters.age}`,
          description: 'Partner approval work is narrowed by the active submission timestamp.',
        }
      : null,
    filters.sla && filters.sla !== 'all'
      ? {
          kind: 'sla',
          value: filters.sla,
          label: `SLA: ${adminQueueSlaFilterLabel(filters.sla)}`,
          description: 'Partner approval work is narrowed by the live operational SLA policy.',
        }
      : null,
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Partner list is narrowed by name, phone, location, service, report, or control text.',
        }
      : null,
    filters.city
      ? {
          kind: 'city',
          value: filters.city,
          label: `City / area: ${filters.city}`,
          description: 'Partner list is narrowed to the same city or area scope used by Partner Operations.',
        }
      : null,
    filters.serviceId
      ? {
          kind: 'serviceId',
          value: filters.serviceId,
          label: `Service: ${filters.serviceId}`,
          description: 'Partner list is narrowed to Partners with this active service.',
        }
      : null,
    filters.walletStatus
      ? {
          kind: 'walletStatus',
          value: filters.walletStatus,
          label: `Wallet: ${filters.walletStatus}`,
          description: 'Partner list uses the current canonical VND wallet balance state.',
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
          label: `Readiness: ${partnerReadinessFilterLabel(filters.readiness)}`,
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
    filters.approvalMissing
      ? {
          kind: 'approvalMissing',
          value: filters.approvalMissing,
          label: `Missing: ${partnerApprovalMissingLabel(filters.approvalMissing)}`,
          description: 'Partner approvals are narrowed by the evidence missing from the submitted dossier.',
        }
      : null,
    filters.approvalRisk
      ? {
          kind: 'approvalRisk',
          value: filters.approvalRisk,
          label: `Risk: ${partnerApprovalRiskLabel(filters.approvalRisk)}`,
          description: 'Partner approvals are narrowed by rejected evidence or prior correction context.',
        }
      : null,
    filters.qualityRange && isQualityReview(filters.review)
      ? {
          kind: 'qualityRange',
          value: filters.qualityRange,
          label: `Quality range: ${partnerQualityRangeLabel(filters.qualityRange)}`,
          description: 'Cancellation, no-show, and low-review evidence uses this Vietnam-time range.',
        }
      : null,
    filters.sort !== 'newest' && !(filters.review === 'approval-pending' && filters.sort === 'oldest')
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
  if (kind === 'activity' && value === 'app-active-7d') {
    return 'Partner App telemetry shows an app open or authenticated session within the last 7 days.';
  }
  if (kind === 'activity' && value === 'app-inactive-7d') {
    return 'Partner App telemetry exists, but the latest recorded app activity is at least 7 days old.';
  }
  if (kind === 'activity' && value === 'app-not-tracked') {
    return 'No Partner App activity aggregate has been recorded for this account yet.';
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
    return 'Onboarding blockers combines verification, KYC, required evidence, and account holds that need operator or Partner follow-up.';
  }
  if (kind === 'review' && value === 'approval-pending') {
    return 'Submitted verification or KYC records that are waiting for an admin decision.';
  }
  if (kind === 'review' && value === 'approval-incomplete') {
    return 'Partners whose verification or KYC approval is incomplete.';
  }
  if (kind === 'review' && value === 'ready-now') {
    return 'Approved Partners who are online, location-fresh, service-ready, unblocked, and wallet eligible.';
  }
  if (kind === 'review' && value === 'available-blocked') {
    return 'Approved Partners marked online available whose location, service, account, or wallet gate prevents booking acceptance.';
  }
  if (kind === 'review' && value === 'available-blocked-location') {
    return 'Approved, online-available Partners whose saved location is missing or older than the current matching freshness policy.';
  }
  if (kind === 'review' && value === 'available-blocked-service') {
    return 'Approved, online-available Partners who do not have an active customer-facing service.';
  }
  if (kind === 'review' && value === 'available-blocked-wallet') {
    return 'Approved, online-available Partners whose negative VND wallet balance blocks booking acceptance.';
  }
  if (kind === 'review' && value === 'available-blocked-account') {
    return 'Approved, online-available Partners with an active account block.';
  }
  if (kind === 'review' && value === 'customer-visible-now') {
    return 'Partners currently visible in Customer App discovery because public identity, payout account, required documents, active service, and fresh location gates all pass.';
  }
  if (kind === 'review' && value === 'customer-visibility-location') {
    return 'Approved Partners marked available now or soon who are hidden from the Customer App because saved coordinates are missing or stale.';
  }
  if (kind === 'review' && value === 'customer-visibility-service') {
    return 'Approved Partners marked available now or soon who are hidden from the Customer App because no active customer-facing catalog service exists.';
  }
  if (kind === 'review' && value === 'customer-visibility-bank') {
    return 'Approved Partners marked available now or soon who are hidden from the Customer App because no approved payout bank account exists.';
  }
  if (kind === 'review' && value === 'customer-visibility-documents') {
    return 'Approved Partners marked available now or soon who are hidden from the Customer App because at least one required identity document is not approved.';
  }
  if (kind === 'review' && value === 'unsettled') {
    return 'Wallet debt shows Partners whose canonical VND wallet balance is negative and need settlement before final acceptance, service start, or payout release.';
  }
  if (kind === 'review' && value === 'high-cancellation') {
    return 'Partners whose cancellation share is at least 20% in the selected quality range.';
  }
  if (kind === 'review' && value === 'no-show-risk') {
    return 'Partners with open no-show reports in the selected quality range.';
  }
  if (kind === 'review' && value === 'quality-risk') {
    return 'Partners with a published low review in range or a current rating below 3.';
  }
  if (kind === 'review' && value === 'quality-all') {
    return 'Partners with high cancellation, open no-show evidence, or low-rating evidence in range.';
  }
  if (kind === 'review' && value === 'payout-blocked') {
    return 'Partners whose negative wallet or incomplete tax profile blocks payout review.';
  }
  if (kind === 'review' && value === 'tax-info-missing') {
    return 'Partners whose tax profile is missing or not approved.';
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
    return 'No partner records are available yet.';
  }
  return 'No partners match the active filters. Clear filters or switch to another review lane.';
}

export function partnerHasAdvancedOperationalFilters(filters: ProviderFilters) {
  return Boolean(
    filters.bookingFlow ||
    filters.city ||
    filters.location ||
    filters.serviceId ||
    filters.security ||
    filters.readiness ||
    filters.walletStatus ||
    (filters.review && !isPrimaryPartnerReview(filters.review)),
  );
}

export function partnerSortLabel(sort: string) {
  if (sort === 'name') return 'name';
  if (sort === 'oldest') return 'oldest first';
  if (sort === 'wallet-debt') return 'debt high to low';
  return 'newest first';
}

export function partnerReviewFilterLabel(review: string) {
  const labels: Record<string, string> = {
    'approval-pending': 'Approval pending',
    'approval-incomplete': 'Approval incomplete',
    'ready-now': 'Ready now',
    'available-blocked': 'Available but blocked',
    'available-blocked-location': 'Stale location',
    'available-blocked-service': 'No active service',
    'available-blocked-wallet': 'Negative wallet while available',
    'available-blocked-account': 'Account blocked while available',
    'customer-visible-now': 'Customer App visible now',
    'customer-visibility-location': 'Customer visibility: location',
    'customer-visibility-service': 'Customer visibility: service',
    'customer-visibility-bank': 'Customer visibility: bank',
    'customer-visibility-documents': 'Customer visibility: documents',
    unapproved: 'Onboarding blockers',
    unsettled: 'Wallet debt',
    kyc: 'KYC updates',
    documents: 'Document review',
    'public-media': 'Public media review',
    bank: 'Withdrawal detail review',
    'payout-setup': 'First earning payout profile',
    'cash-debt': 'Cash fee debt',
    tax: 'Tax profile optional',
    security: 'Device/session check',
    reports: 'Reports/controls',
    'high-cancellation': 'High cancellation',
    'no-show-risk': 'No-show risk',
    'quality-risk': 'Low rating',
    'quality-all': 'All quality risks',
    'payout-blocked': 'Payout blocked',
    'tax-info-missing': 'Tax info missing',
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

export function partnerQualityRangeLabel(range: string) {
  if (range === 'today') return 'Today';
  if (range === '7d') return 'Last 7 days';
  if (range === '90d') return 'Last 90 days';
  return 'Last 30 days';
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
    'app-active-7d': 'App active 7D',
    'app-inactive-7d': 'App inactive 7D+',
    'app-not-tracked': 'App not tracked',
    'never-online': 'Never online',
    'inactive-7d': 'Inactive 7D',
    'inactive-30d': 'Inactive 30D',
  };
  return labels[activity] ?? activity;
}

export function partnerReadinessFilterLabel(readiness: string) {
  const labels: Record<string, string> = {
    'approved-offline': 'Approved but offline',
    'needs-review': 'Needs review',
    'push-missing': 'Push missing',
    ready: 'Dispatch ready',
  };
  return labels[readiness] ?? readiness;
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
    filters.age !== 'all' ? `age-${filters.age}` : '',
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
  const aliases: Record<string, string> = {
    'backup-ready': 'ready-now',
    'backup-blocked': 'available-blocked',
    'direct-ready': 'ready-now',
    'marketplace-ready': 'ready-now',
    'acceptance-blocked': 'available-blocked',
    'marketplace-blocked': 'available-blocked',
    location: 'available-blocked-location',
  };
  const normalized = aliases[value] ?? value;
  return isPrimaryPartnerReview(normalized) ? normalized : '';
}

function normalizePartnerActivityFilter(value: string) {
  return [
    'app-active-7d',
    'app-inactive-7d',
    'app-not-tracked',
    'never-online',
    'inactive-7d',
    'inactive-30d',
  ].includes(value)
    ? value
    : '';
}

function normalizePartnerApprovalMissing(value: string) {
  return ['identity-documents', 'public-media'].includes(value) ? value : '';
}

function normalizePartnerApprovalRisk(value: string) {
  return ['rejected-evidence', 'previous-hold'].includes(value) ? value : '';
}

function partnerApprovalMissingLabel(value: string) {
  return value === 'identity-documents' ? 'Identity documents' : 'Public profile media';
}

function partnerApprovalRiskLabel(value: string) {
  return value === 'rejected-evidence' ? 'Rejected evidence' : 'Previous hold / correction';
}

function normalizePartnerReadinessFilter(value: string) {
  return ['ready', 'approved-offline', 'push-missing', 'needs-review'].includes(value) ? value : '';
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

function normalizePartnerQualityRange(value: string) {
  return ['today', '7d', '30d', '90d'].includes(value) ? value : '30d';
}

function isServerPartnerActivityFilter(value: string) {
  return [
    'app-active-7d',
    'app-inactive-7d',
    'app-not-tracked',
    'never-online',
    'inactive-7d',
    'inactive-30d',
  ].includes(value);
}

function readPartnerSort(value: string) {
  return ['newest', 'name', 'oldest', 'wallet-debt'].includes(value) ? value : 'newest';
}

function decodePartnerCursorHistory(value: string | undefined): Array<string | null> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string | null => item === null || typeof item === 'string').slice(-20)
      : [];
  } catch {
    return [];
  }
}

function encodePartnerCursorHistory(value: Array<string | null>) {
  return Buffer.from(JSON.stringify(value.slice(-20))).toString('base64url');
}

function isPrimaryPartnerReview(value: string) {
  return [
    'approval-pending',
    'approval-incomplete',
    'ready-now',
    'available-blocked',
    'available-blocked-location',
    'available-blocked-service',
    'available-blocked-wallet',
    'available-blocked-account',
    'customer-visible-now',
    'customer-visibility-location',
    'customer-visibility-service',
    'customer-visibility-bank',
    'customer-visibility-documents',
    'unapproved',
    'unsettled',
    'blocked',
    'documents',
    'public-media',
    'bank',
    'tax',
    'reports',
    'high-cancellation',
    'no-show-risk',
    'quality-risk',
    'quality-all',
    'payout-blocked',
    'tax-info-missing',
    'kyc',
    'push',
    'cash-debt',
    'security',
  ].includes(value);
}

function isQualityReview(value: string) {
  return ['high-cancellation', 'no-show-risk', 'quality-risk', 'quality-all'].includes(value);
}

const partnerFilterHrefParamKeys = [
  'age',
  'sla',
  'q',
  'approvalMissing',
  'approvalRisk',
  'city',
  'qualityRange',
  'verification',
  'providerStatus',
  'kyc',
  'location',
  'security',
  'readiness',
  'activity',
  'bookingFlow',
  'review',
  'serviceId',
  'sort',
  'walletStatus',
] as const satisfies readonly (keyof ProviderFilters)[];

function partnerFilterSearchParams(filters: ProviderFilters) {
  const params = new URLSearchParams();

  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  if (filters.pageSize !== DEFAULT_PARTNER_PAGE_SIZE) {
    params.set('pageSize', String(filters.pageSize));
  }
  partnerFilterHrefParamKeys.forEach((key) => {
    const value = filters[key];
    if (
      value &&
      !(key === 'age' && value === 'all') &&
      !(key === 'sla' && value === 'all') &&
      !(key === 'qualityRange' && !isQualityReview(filters.review)) &&
      !(key === 'sort' && value === 'newest')
    ) {
      params.set(key, value);
    }
  });

  return params;
}

function setPartnerDirectoryServerFilter(
  listParams: URLSearchParams,
  summaryParams: URLSearchParams,
  key:
    | 'verification'
    | 'providerStatus'
    | 'kyc'
    | 'bookingFlow'
    | 'approvalMissing'
    | 'approvalRisk'
    | 'city'
    | 'serviceId'
    | 'walletStatus',
  value: string | undefined,
) {
  if (!value) {
    return;
  }

  listParams.set(key, value);
  summaryParams.set(key, value);
}

function normalizePartnerWalletStatus(value: string) {
  return value === 'negative' || value === 'positive' || value === 'zero' ? value : '';
}
