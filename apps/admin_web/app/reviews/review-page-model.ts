import type {
  AdminPartnerCustomerReview,
  AdminPartnerCustomerReviewSummary,
  AdminReview,
  AdminReviewSummary,
} from '../../lib/admin-api';
import { formatDateTime, shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { reviewModerationActionMenuItems } from './review-page-actions';
import type { PartnerCustomerEvaluationTableRow } from './partner-customer-evaluations-section';
import type { ReviewTableRow } from './reviews-table-section';

export const DEFAULT_REVIEW_PAGE_SIZE = 10;
export const REVIEW_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type ReviewDateRangeFilter = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
export type ReviewSortFilter = 'newest' | 'oldest' | 'rating-desc' | 'rating-asc';

export const REVIEW_DATE_RANGE_OPTIONS: readonly {
  readonly label: string;
  readonly value: ReviewDateRangeFilter;
}[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Previous day' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last month' },
  { value: 'custom', label: 'Custom dates' },
];

export const REVIEW_SORT_OPTIONS: readonly {
  readonly label: string;
  readonly value: ReviewSortFilter;
}[] = [
  { value: 'newest', label: 'Most recently submitted' },
  { value: 'oldest', label: 'Oldest submitted' },
  { value: 'rating-desc', label: 'Highest rating' },
  { value: 'rating-asc', label: 'Lowest rating' },
];
export const REVIEW_EXPORT_COLUMNS = [
  'Review ID',
  'Partner',
  'Customer',
  'Customer Phone',
  'Rating',
  'Status',
  'App Visibility',
  'Review',
  'Report Reason',
  'Request Time',
  'Created At',
  'Booking',
  'Service',
] as const;

export type ReviewFilters = {
  readonly dateFrom: string;
  readonly dateRange: ReviewDateRangeFilter;
  readonly dateTo: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q: string;
  readonly review: string;
  readonly sort: ReviewSortFilter;
};

export type ReviewPagination<T> = {
  readonly from: number;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export type ReviewDataHrefs = {
  readonly listHref: string;
  readonly summaryHref: string;
};

export function buildReviewTableRows(reviews: readonly AdminReview[]): ReviewTableRow[] {
  return reviews.map((review) => ({
    actionLabel: `Review actions for ${shortId(review.id)}`,
    actions: reviewModerationActionMenuItems(review),
    appVisibilityLabel: review.status === 'PUBLISHED' ? 'App visible' : 'Not visible in app',
    bookingHref: review.booking?.id ? `/bookings/${review.booking.id}` : null,
    bookingLabel: review.booking?.id ? shortId(review.booking.id) : 'No booking link',
    bookingRequestTimeLabel: reviewBookingRequestTimeLabel(review),
    commentLabel: review.comment?.trim() || 'No written review',
    commentValue: review.comment?.trim() ?? '',
    createdAt: review.createdAt ?? null,
    customerHref: review.customerProfile?.id
      ? `/customers/${review.customerProfile.id}`
      : review.customerProfileId
        ? `/customers/${review.customerProfileId}`
        : null,
    customerInitials: initials(review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone),
    customerLabel:
      review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown customer',
    isAdminCreated: Boolean(review.createdByAdminId),
    id: review.id,
    partnerHref: review.providerProfile?.id
      ? `/partners/${review.providerProfile.id}`
      : review.providerProfileId
        ? `/partners/${review.providerProfileId}`
        : null,
    partnerInitials: initials(review.providerProfile?.displayName),
    partnerLabel: reviewProviderLabel(review),
    rating: review.rating,
    ratingLabel: `${review.rating}/5`,
    reportReasonValue: review.reportReason?.trim() ?? '',
    reportReasonLabel:
      (review.status === 'HIDDEN' || review.status === 'REPORTED') && review.reportReason?.trim()
        ? `Reason: ${review.reportReason}`
        : '',
    reviewIdLabel: shortId(review.id),
    serviceLabel: reviewServiceLabel(review),
    showBookingRequestTime: reviewRequestMs(review) !== Date.parse(review.createdAt ?? ''),
    status: review.status,
    statusClassName: reviewStatusClassName(review.status),
    statusLabel: reviewStatusLabel(review.status),
  }));
}

export function buildPartnerCustomerReviewTableRows(
  reviews: readonly AdminPartnerCustomerReview[],
): PartnerCustomerEvaluationTableRow[] {
  return reviews.map((review) => {
    const status = review.status ?? 'PUBLISHED';
    const latestModeration = review.latestModeration;

    return {
      bookingHref: review.booking?.id ? `/bookings/${review.booking.id}` : null,
      bookingLabel: review.booking?.id ? shortId(review.booking.id) : 'No booking link',
      bookingRequestTimeLabel: partnerCustomerReviewRequestTimeLabel(review),
      commentLabel: review.comment?.trim() || 'No written note',
      createdAt: review.createdAt ?? null,
      customerHref: review.customerProfile?.id
        ? `/customers/${review.customerProfile.id}`
        : review.customerProfileId
          ? `/customers/${review.customerProfileId}`
          : null,
      customerLabel: review.customerProfile?.user?.fullName ?? 'Unknown customer',
      id: review.id,
      isDefaultRetained: status === 'PUBLISHED' && !latestModeration,
      lastReviewedAt: latestModeration?.createdAt ?? null,
      lastReviewedBy:
        latestModeration?.actor?.fullName ?? latestModeration?.actor?.email ?? 'Unknown operator',
      lastReviewReason: latestModeration?.reason?.trim() || review.reportReason?.trim() || 'No review reason',
      partnerHref: review.providerProfile?.id
        ? `/partners/${review.providerProfile.id}`
        : review.providerProfileId
          ? `/partners/${review.providerProfileId}`
          : null,
      partnerLabel: review.providerProfile?.displayName ?? 'Unknown Partner',
      reportReasonLabel: review.reportReason?.trim() || '',
      serviceLabel: partnerCustomerReviewServiceLabel(review),
      status,
      statusClassName:
        status === 'PUBLISHED' && !latestModeration
          ? 'review-status-chip review-status-default'
          : partnerCustomerReviewStatusClassName(status),
      statusLabel: partnerCustomerReviewStatusLabel(status),
    };
  });
}

export function sortReviews(
  reviews: readonly AdminReview[],
  sort: ReviewSortFilter = 'newest',
): AdminReview[] {
  const requestMs = new Map<AdminReview, number>();
  const priority = new Map<AdminReview, number>();
  const rating = new Map<AdminReview, number>();
  const requestTime = (review: AdminReview) => cachedValue(requestMs, review, reviewRequestMs);
  const priorityValue = (review: AdminReview) => cachedValue(priority, review, reviewPriority);
  const ratingValue = (review: AdminReview) => cachedValue(rating, review, ratingSortValue);

  return [...reviews].sort((left, right) => {
    if (sort === 'oldest') {
      return requestTime(left) - requestTime(right);
    }
    if (sort === 'rating-desc') {
      return ratingValue(right) - ratingValue(left) || requestTime(right) - requestTime(left);
    }
    if (sort === 'rating-asc') {
      return ratingValue(left) - ratingValue(right) || requestTime(right) - requestTime(left);
    }

    const signalDiff = priorityValue(left) - priorityValue(right);
    return signalDiff || requestTime(right) - requestTime(left);
  });
}

export function sortPartnerCustomerReviews(
  reviews: readonly AdminPartnerCustomerReview[],
  sort: ReviewSortFilter = 'newest',
): AdminPartnerCustomerReview[] {
  const requestMs = new Map<AdminPartnerCustomerReview, number>();
  const requestTime = (review: AdminPartnerCustomerReview) =>
    cachedValue(requestMs, review, partnerCustomerReviewRequestMs);

  return [...reviews].sort((left, right) => {
    if (sort === 'oldest') {
      return requestTime(left) - requestTime(right);
    }
    return requestTime(right) - requestTime(left);
  });
}

export function buildReviewFilters(params: Record<string, string | string[] | undefined>): ReviewFilters {
  const dateFrom = normalizeDateParam(readParam(params.dateFrom));
  const dateTo = normalizeDateParam(readParam(params.dateTo));
  const requestedDateRange = normalizeReviewDateRange(readParam(params.dateRange));

  return {
    dateFrom,
    dateRange: requestedDateRange,
    dateTo,
    page: normalizePage(readParam(params.page)),
    pageSize: normalizePageSize(readParam(params.pageSize)),
    q: readParam(params.q).trim(),
    review: normalizeReviewFilter(readParam(params.review)),
    sort: normalizeReviewSort(readParam(params.sort)),
  };
}

export function buildPartnerCustomerEvaluationFilters(
  params: Record<string, string | string[] | undefined>,
): ReviewFilters {
  const filters = buildReviewFilters(params);

  return {
    ...filters,
    review: normalizePartnerCustomerReviewStatus(readParam(params.status)),
    sort: filters.sort === 'oldest' ? 'oldest' : 'newest',
  };
}

export function filterReviews(reviews: readonly AdminReview[], filters: ReviewFilters): AdminReview[] {
  const query = filters.q.toLowerCase();
  const dateBounds = reviewDateRangeBoundsForFilter(filters);

  return reviews.filter((review) => {
    if (filters.review && !reviewMatchesFilter(review, filters.review)) {
      return false;
    }
    if (!reviewMatchesDateRange(review, dateBounds)) {
      return false;
    }
    if (query && !searchableReviewText(review).includes(query)) {
      return false;
    }
    return true;
  });
}

export function filterPartnerCustomerReviews(
  reviews: readonly AdminPartnerCustomerReview[],
  filters: ReviewFilters,
): AdminPartnerCustomerReview[] {
  const query = filters.q.toLowerCase();
  const dateBounds = reviewDateRangeBoundsForFilter(filters);

  return reviews.filter((review) => {
    if (filters.review && !partnerCustomerReviewMatchesStatus(review, filters.review)) {
      return false;
    }
    if (!partnerCustomerReviewMatchesDateRange(review, dateBounds)) {
      return false;
    }
    if (query && !searchablePartnerCustomerReviewText(review).includes(query)) {
      return false;
    }
    return true;
  });
}

export function paginateReviewRows<T>(rows: readonly T[], filters: ReviewFilters): ReviewPagination<T> {
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

export function buildServerReviewPagination<T>(
  rows: readonly T[],
  filters: ReviewFilters,
  totalRows: number,
): ReviewPagination<T> {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

export function buildReviewListHref(filters: ReviewFilters, overrides: Partial<ReviewFilters> = {}) {
  return buildReviewHref('/reviews', filters, overrides);
}

export function buildReviewExportHref(filters: ReviewFilters) {
  return buildReviewHref('/reviews/export', filters, {
    page: 1,
    pageSize: DEFAULT_REVIEW_PAGE_SIZE,
  });
}

export function buildPartnerCustomerEvaluationListHref(
  filters: ReviewFilters,
  overrides: Partial<ReviewFilters> = {},
) {
  const nextOverrides: Partial<ReviewFilters> = {
    ...overrides,
    ...(overrides.sort ? { sort: overrides.sort === 'oldest' ? 'oldest' : 'newest' } : {}),
  };
  const href = buildReviewHref('/reviews/partner-customer-evaluations', filters, nextOverrides);
  const url = new URL(href, 'http://admin.local');
  const status = url.searchParams.get('review');
  url.searchParams.delete('review');
  if (status) {
    url.searchParams.set('status', status);
  }
  return `${url.pathname}${url.search}`;
}

export function buildReviewDataHrefs(filters: ReviewFilters): ReviewDataHrefs {
  return buildReviewDataHrefPair('/admin/reviews', '/admin/reviews/summary', filters, {
    includeReviewFilter: true,
    includeSummaryReviewFilter: false,
  });
}

export function reviewMatchingCount(summary: AdminReviewSummary, review: string) {
  if (review === 'published') return summary.published ?? 0;
  if (review === 'reported') return summary.reported ?? 0;
  if (review === 'held') return summary.held ?? 0;
  return summary.totalCount;
}

export function buildPartnerCustomerReviewDataHrefs(filters: ReviewFilters): ReviewDataHrefs {
  return buildReviewDataHrefPair(
    '/admin/partner-customer-reviews',
    '/admin/partner-customer-reviews/summary',
    filters,
    { includeReviewFilter: true, includeSummaryReviewFilter: false, reviewParam: 'status' },
  );
}

function buildReviewHref(basePath: string, filters: ReviewFilters, overrides: Partial<ReviewFilters> = {}) {
  const next: ReviewFilters = {
    ...filters,
    ...overrides,
    page: overrides.page ?? 1,
  };
  const params = new URLSearchParams();

  if (next.q) {
    params.set('q', next.q);
  }
  if (next.pageSize !== DEFAULT_REVIEW_PAGE_SIZE) {
    params.set('pageSize', String(next.pageSize));
  }
  if (next.review) {
    params.set('review', next.review);
  }
  if (next.dateRange !== 'all') {
    params.set('dateRange', next.dateRange);
  }
  if (next.dateRange === 'custom' && next.dateFrom) {
    params.set('dateFrom', next.dateFrom);
  }
  if (next.dateRange === 'custom' && next.dateTo) {
    params.set('dateTo', next.dateTo);
  }
  if (next.sort !== 'newest') {
    params.set('sort', next.sort);
  }
  if (next.page > 1) {
    params.set('page', String(next.page));
  }

  return params.size ? `${basePath}?${params.toString()}` : basePath;
}

function buildReviewDataHrefPair(
  listPath: string,
  summaryPath: string,
  filters: ReviewFilters,
  options: {
    readonly includeReviewFilter: boolean;
    readonly includeSummaryReviewFilter?: boolean;
    readonly reviewParam?: string;
  },
): ReviewDataHrefs {
  const listParams = reviewDataQueryParams(filters, options);
  listParams.set('take', String(filters.pageSize));
  listParams.set('skip', String((filters.page - 1) * filters.pageSize));

  const summaryParams = reviewDataQueryParams(filters, {
    ...options,
    includeReviewFilter: options.includeSummaryReviewFilter ?? options.includeReviewFilter,
  });

  return {
    listHref: `${listPath}?${listParams.toString()}`,
    summaryHref: summaryParams.size ? `${summaryPath}?${summaryParams.toString()}` : summaryPath,
  };
}

function reviewDataQueryParams(
  filters: ReviewFilters,
  options: { readonly includeReviewFilter: boolean; readonly reviewParam?: string },
) {
  const params = new URLSearchParams();
  const bounds = reviewDateRangeBoundsForFilter(filters);

  if (filters.q) {
    params.set('q', filters.q);
  }
  if (options.includeReviewFilter && filters.review) {
    params.set(options.reviewParam ?? 'review', filters.review);
  }
  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }
  if (bounds && bounds.startMs !== Number.NEGATIVE_INFINITY) {
    params.set('from', new Date(bounds.startMs).toISOString());
  }
  if (bounds && bounds.endMs !== Number.POSITIVE_INFINITY) {
    params.set('to', new Date(bounds.endMs + 1).toISOString());
  }

  return params;
}

export function reviewFilterDescription(review: string) {
  if (review === 'reported') {
    return 'reviews removed from the app until moderation is resolved.';
  }
  if (review === 'held') {
    return 'reviews hidden from the app and retained for audit evidence.';
  }
  if (review === 'published') {
    return 'reviews currently visible in the app.';
  }
  return 'all customer reviews.';
}

export function reviewDateRangeLabel(filters: ReviewFilters) {
  if (filters.dateRange === 'today') {
    return 'Today';
  }
  if (filters.dateRange === 'yesterday') {
    return 'Previous day';
  }
  if (filters.dateRange === '7d') {
    return 'Last 7 days';
  }
  if (filters.dateRange === '30d') {
    return 'Last month';
  }
  if (filters.dateRange === 'custom') {
    const from = filters.dateFrom || 'Any start';
    const to = filters.dateTo || 'Any end';
    return `Custom: ${from} - ${to}`;
  }
  return '';
}

export function reviewSortLabel(sort: ReviewSortFilter) {
  return REVIEW_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Most recently submitted';
}

export function reviewDateRangeError(filters: ReviewFilters) {
  if (filters.dateRange !== 'custom' || !filters.dateFrom || !filters.dateTo) {
    return '';
  }
  return filters.dateFrom > filters.dateTo ? 'From date must be on or before To date.' : '';
}

export function reviewEmptyState(filters: ReviewFilters) {
  const range = reviewDateRangeLabel(filters) || 'All dates';
  if (filters.review === 'reported') {
    return {
      message: `No reviews are currently waiting for a moderation decision. Current date range: ${range}.`,
      title: 'No reviews need moderation',
    };
  }
  if (filters.review === 'held') {
    return {
      message: `No reviews are currently hidden from the customer app. Current date range: ${range}.`,
      title: 'No hidden reviews',
    };
  }
  if (filters.review === 'published') {
    return {
      message: 'No reviews currently match the selected filters and date range.',
      title: 'No visible reviews',
    };
  }
  if (filters.q || filters.dateRange !== 'all') {
    return {
      message: 'No customer reviews match the selected filters and date range.',
      title: 'No reviews match these filters',
    };
  }
  return {
    message: 'Customer reviews will appear here after completed bookings receive feedback.',
    title: 'No customer reviews yet',
  };
}

export function buildSummary(reviews: readonly AdminReview[]) {
  let held = 0;
  let published = 0;
  let reported = 0;
  let ratingCount = 0;
  let ratingTotal = 0;

  for (const review of reviews) {
    if (Number.isFinite(review.rating)) {
      ratingCount += 1;
      ratingTotal += review.rating;
    }
    if (review.status === 'HIDDEN') {
      held += 1;
    }
    if (review.status === 'PUBLISHED') {
      published += 1;
    }
    if (review.status === 'REPORTED') {
      reported += 1;
    }
  }

  return {
    averageRating: ratingCount > 0 ? (ratingTotal / ratingCount).toFixed(1) : '—',
    held,
    published,
    reported,
    total: reviews.length,
  };
}

export function buildReviewExportRows(reviews: readonly AdminReview[]) {
  return reviews.map((review) => ({
    'Review ID': review.id,
    Partner: reviewProviderLabel(review),
    Customer: review.customerProfile?.user?.fullName ?? 'Unknown customer',
    'Customer Phone': review.customerProfile?.user?.phone ?? '',
    Rating: review.rating,
    Status: reviewStatusLabel(review.status),
    'App Visibility': review.status === 'PUBLISHED' ? 'Visible' : 'Not visible',
    Review: review.comment?.trim() || '',
    'Report Reason': review.reportReason?.trim() || '',
    'Request Time': reviewBookingRequestTimeLabel(review),
    'Created At': formatReviewDate(review.createdAt),
    Booking: review.booking?.id ?? '',
    Service: reviewServiceLabel(review),
  }));
}

export function reviewProviderLabel(review: AdminReview) {
  return review.providerProfile?.displayName ?? 'Unknown Partner';
}

function reviewPriority(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 0;
  }
  if (review.status === 'HIDDEN') {
    return 1;
  }
  if (review.status === 'PUBLISHED') {
    return 3;
  }
  return 4;
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function reviewMatchesFilter(review: AdminReview, filter: string) {
  if (filter === 'reported') {
    return review.status === 'REPORTED';
  }
  if (filter === 'held') {
    return review.status === 'HIDDEN';
  }
  if (filter === 'published') {
    return review.status === 'PUBLISHED';
  }
  return true;
}

function partnerCustomerReviewMatchesStatus(review: AdminPartnerCustomerReview, filter: string) {
  return normalizePartnerCustomerReviewStatus(review.status ?? '') === filter;
}

export function partnerCustomerReviewStatusLabel(status: string) {
  if (status === 'PUBLISHED') return 'Retained';
  if (status === 'REPORTED') return 'Needs review';
  if (status === 'HIDDEN') return 'Restricted';
  return 'Unknown';
}

export function partnerCustomerReviewStatusClassName(status: string) {
  if (status === 'PUBLISHED') return 'review-status-chip review-status-published';
  if (status === 'REPORTED') return 'review-status-chip review-status-reported';
  if (status === 'HIDDEN') return 'review-status-chip review-status-held';
  return 'review-status-chip review-status-follow-up';
}

export function partnerCustomerReviewFilteredTotal(
  summary: AdminPartnerCustomerReviewSummary,
  status: string,
) {
  if (status === 'retained') return summary.retained;
  if (status === 'needs-review') return summary.needsReview;
  if (status === 'restricted') return summary.restricted;
  return summary.totalCount;
}

function reviewStatusLabel(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'Visible';
    case 'HIDDEN':
      return 'Hidden';
    case 'REPORTED':
      return 'Needs review';
    default:
      return status
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
}

function reviewStatusClassName(status: string) {
  if (status === 'PUBLISHED') {
    return 'review-status-chip review-status-published';
  }
  if (status === 'HIDDEN') {
    return 'review-status-chip review-status-held';
  }
  if (status === 'REPORTED') {
    return 'review-status-chip review-status-reported';
  }
  return 'review-status-chip review-status-follow-up';
}

function statusMeaning(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'Visible in app';
    case 'HIDDEN':
      return 'Hidden from app visibility';
    case 'REPORTED':
      return 'Removed from the app until resolved';
    default:
      return 'Review state under moderation';
  }
}

function reviewServiceLabel(review: AdminReview) {
  const services = review.booking?.services
    ?.map((item) => item.service?.name)
    .filter((name): name is string => Boolean(name));

  return services?.length ? services.join(', ') : 'Service not attached';
}

function partnerCustomerReviewServiceLabel(review: AdminPartnerCustomerReview) {
  const services = review.booking?.services
    ?.map((item) => item.service?.name)
    .filter((name): name is string => Boolean(name));

  return services?.length ? services.join(', ') : 'Service not attached';
}

function reviewBookingRequestTimeLabel(review: AdminReview) {
  return formatDateTime(
    review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt,
    'No request time',
  );
}

function partnerCustomerReviewRequestTimeLabel(review: AdminPartnerCustomerReview) {
  return formatDateTime(
    review.booking?.openedAt ?? review.booking?.createdAt ?? review.createdAt,
    'No request time',
  );
}

type ReviewDateRangeBounds = {
  readonly startMs: number;
  readonly endMs: number;
};

function reviewDateRangeBoundsForFilter(filters: ReviewFilters): ReviewDateRangeBounds | null {
  if (filters.dateRange === 'all') {
    return null;
  }
  return reviewDateRangeBounds(filters);
}

function reviewMatchesDateRange(review: AdminReview, bounds: ReviewDateRangeBounds | null) {
  if (!bounds) {
    return true;
  }

  const timestamp = reviewRequestTimestamp(review);
  if (timestamp === null) {
    return false;
  }

  return timestamp >= bounds.startMs && timestamp <= bounds.endMs;
}

function partnerCustomerReviewMatchesDateRange(
  review: AdminPartnerCustomerReview,
  bounds: ReviewDateRangeBounds | null,
) {
  if (!bounds) {
    return true;
  }

  const timestamp = partnerCustomerReviewRequestTimestamp(review);
  if (timestamp === null) {
    return false;
  }

  return timestamp >= bounds.startMs && timestamp <= bounds.endMs;
}

function reviewDateRangeBounds(filters: ReviewFilters) {
  const todayStartMs = startOfLocalDay(Date.now());
  const todayEndMs = endOfLocalDay(todayStartMs);

  switch (filters.dateRange) {
    case 'today':
      return { startMs: todayStartMs, endMs: todayEndMs };
    case 'yesterday': {
      const startMs = addDays(todayStartMs, -1);
      return { startMs, endMs: endOfLocalDay(startMs) };
    }
    case '7d':
      return { startMs: addDays(todayStartMs, -6), endMs: todayEndMs };
    case '30d':
      return { startMs: addDays(todayStartMs, -29), endMs: todayEndMs };
    case 'custom':
      return customDateRangeBounds(filters.dateFrom, filters.dateTo);
    default:
      return { startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY };
  }
}

function customDateRangeBounds(dateFrom: string, dateTo: string) {
  const from = parseDateInput(dateFrom);
  const to = parseDateInput(dateTo);

  if (from === null && to === null) {
    return { startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY };
  }

  const startMs = from ?? Number.NEGATIVE_INFINITY;
  const endMs = to === null ? Number.POSITIVE_INFINITY : endOfLocalDay(to);

  return { startMs, endMs };
}

function searchableReviewText(review: AdminReview) {
  return [
    review.id,
    reviewProviderLabel(review),
    review.customerProfile?.user?.fullName ?? '',
    review.customerProfile?.user?.phone ?? '',
    review.comment ?? '',
    review.reportReason ?? '',
    reviewStatusLabel(review.status),
    statusMeaning(review.status),
    reviewServiceLabel(review),
    review.booking?.id ?? '',
    String(review.rating),
  ]
    .join(' ')
    .toLowerCase();
}

function searchablePartnerCustomerReviewText(review: AdminPartnerCustomerReview) {
  return [
    review.id,
    review.providerProfile?.displayName ?? '',
    review.customerProfile?.user?.fullName ?? '',
    review.comment ?? '',
    review.reportReason ?? '',
    partnerCustomerReviewStatusLabel(review.status ?? ''),
    partnerCustomerReviewServiceLabel(review),
    review.booking?.id ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

function formatReviewDate(value?: string | null) {
  return formatDateTime(value, 'No date');
}

function initials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) {
    return 'NA';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function normalizePage(value: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSize(value: string) {
  const pageSize = Number(value);
  return REVIEW_PAGE_SIZE_OPTIONS.includes(pageSize as (typeof REVIEW_PAGE_SIZE_OPTIONS)[number])
    ? pageSize
    : DEFAULT_REVIEW_PAGE_SIZE;
}

function normalizeReviewFilter(value: string) {
  if (value === 'follow-up' || value === 'low-rating' || value === 'service-recovery') {
    return 'reported';
  }
  if (value === 'hidden' || value === 'hold') {
    return 'held';
  }
  if (value === 'published' || value === 'held' || value === 'reported') {
    return value;
  }
  return '';
}

function normalizePartnerCustomerReviewStatus(value: string) {
  if (value === 'published' || value === 'retained' || value === 'PUBLISHED') return 'retained';
  if (value === 'reported' || value === 'needs-review' || value === 'REPORTED') return 'needs-review';
  if (value === 'hidden' || value === 'restricted' || value === 'HIDDEN') return 'restricted';
  return '';
}

function normalizeReviewDateRange(value: string): ReviewDateRangeFilter {
  return REVIEW_DATE_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as ReviewDateRangeFilter)
    : 'all';
}

function normalizeReviewSort(value: string): ReviewSortFilter {
  return REVIEW_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as ReviewSortFilter)
    : 'newest';
}

function normalizeDateParam(value: string) {
  return parseDateInput(value) === null ? '' : value;
}

function reviewRequestMs(review: AdminReview) {
  return reviewRequestTimestamp(review) ?? 0;
}

function partnerCustomerReviewRequestMs(review: AdminPartnerCustomerReview) {
  return partnerCustomerReviewRequestTimestamp(review) ?? 0;
}

function reviewRequestTimestamp(review: AdminReview) {
  return safeDateMs(review.createdAt);
}

function partnerCustomerReviewRequestTimestamp(review: AdminPartnerCustomerReview) {
  return safeDateMs(review.createdAt);
}

function safeDateMs(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ratingSortValue(review: AdminReview) {
  return Number.isFinite(review.rating) ? review.rating : -1;
}

function cachedValue<T extends object>(cache: Map<T, number>, item: T, calculate: (item: T) => number) {
  const existing = cache.get(item);
  if (existing !== undefined) {
    return existing;
  }
  const value = calculate(item);
  cache.set(item, value);
  return value;
}

function parseDateInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
    ? date.getTime()
    : null;
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(startMs: number) {
  return addDays(startMs, 1) - 1;
}

function addDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}
