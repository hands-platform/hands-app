import type { AdminReview } from '../../lib/admin-api';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarSessionSignal,
  type AdminAvatarStatus,
} from '../../lib/admin-avatar-status';
import { shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { reviewModerationActionMenuItems } from './review-page-actions';
import type { ReviewTableRow } from './reviews-table-section';

export const DEFAULT_REVIEW_PAGE_SIZE = 10;
export const REVIEW_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
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
  'Created At',
  'Booking',
  'Service',
] as const;

export type ReviewCommandTone = 'warn' | 'info' | 'ok';

export type ReviewCommandItem = {
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly reviews: readonly AdminReview[];
  readonly status: string;
  readonly title: string;
  readonly tone: ReviewCommandTone;
};

type ReviewAvatarUserSignal = {
  readonly appSessions?: readonly AdminAvatarSessionSignal[];
  readonly pushDevices?: readonly AdminAvatarPushDeviceSignal[];
};

type ReviewAvatarProviderSignal = {
  readonly devices?: readonly AdminAvatarPushDeviceSignal[];
  readonly sessions?: readonly AdminAvatarSessionSignal[];
  readonly status?: string | null;
  readonly user?: ReviewAvatarUserSignal;
};

export type ReviewFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string;
  readonly review: string;
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

export function buildReviewTableRows(reviews: readonly AdminReview[]): ReviewTableRow[] {
  return reviews.map((review) => ({
    actionLabel: `Review actions for ${shortId(review.id)}`,
    actions: reviewModerationActionMenuItems(review),
    appVisibilityLabel: review.status === 'PUBLISHED' ? 'App visible' : 'Not visible in app',
    bookingLabel: review.booking?.id ? shortId(review.booking.id) : 'No booking link',
    commentLabel: review.comment?.trim() || 'No written review',
    createdAtLabel: formatReviewDate(review.createdAt),
    customerInitials: initials(review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone),
    customerLabel: review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown customer',
    customerAvatarStatus: reviewCustomerAvatarStatus(review),
    customerPhone: review.customerProfile?.user?.phone ?? 'No phone on file',
    id: review.id,
    partnerAvatarStatus: reviewPartnerAvatarStatus(review),
    partnerHint: partnerReviewHint(review),
    partnerInitials: initials(review.providerProfile?.displayName),
    partnerLabel: reviewProviderLabel(review),
    rating: review.rating,
    ratingLabel: `${review.rating}/5`,
    reportReasonLabel: review.reportReason?.trim() ? `Reason: ${review.reportReason}` : '',
    serviceLabel: reviewServiceLabel(review),
    shortIdLabel: shortId(review.id),
    statusClassName: reviewStatusClassName(review.status),
    statusLabel: reviewStatusLabel(review.status),
    statusMeaning: statusMeaning(review.status),
  }));
}

function reviewCustomerAvatarStatus(review: AdminReview): AdminAvatarStatus {
  const user = review.customerProfile?.user as ReviewAvatarUserSignal | undefined;

  return adminAvatarStatusFromSignals({
    devices: user?.pushDevices,
    sessions: user?.appSessions,
  });
}

function reviewPartnerAvatarStatus(review: AdminReview): AdminAvatarStatus {
  const provider = review.providerProfile as ReviewAvatarProviderSignal | undefined;

  return adminAvatarStatusFromSignals({
    devices: provider?.devices ?? provider?.user?.pushDevices,
    fallbackOnline: Boolean(provider?.status?.startsWith('ONLINE')),
    sessions: provider?.sessions ?? provider?.user?.appSessions,
  });
}

export function sortReviews(reviews: readonly AdminReview[]): AdminReview[] {
  return [...reviews].sort((left, right) => {
    const signalDiff = reviewPriority(left) - reviewPriority(right);
    if (signalDiff !== 0) {
      return signalDiff;
    }
    return dateMs(right.createdAt) - dateMs(left.createdAt);
  });
}

export function buildReviewCommandBoard(reviews: readonly AdminReview[]): ReviewCommandItem[] {
  const reported = reviews.filter((review) => review.status === 'REPORTED');
  const followUp = reviews.filter(
    (review) => review.status === 'REPORTED' || Boolean(review.reportReason?.trim()),
  );
  const held = reviews.filter((review) => review.status === 'HIDDEN');

  return [
    {
      title: 'Reported reviews',
      detail: 'Customer or operator reports need moderation, support notes, and a visibility decision.',
      status: 'Reported',
      operatorAction: 'Open reported rows first, then publish, hold, or keep under follow-up.',
      href: '/reviews?review=reported',
      tone: reported.length > 0 ? 'warn' : 'ok',
      reviews: reported,
    },
    {
      title: 'Service follow-up',
      detail: 'Records with report reasons need booking context, chat evidence, and support follow-up.',
      status: 'Follow-up',
      operatorAction: 'Check booking context, customer notes, and service evidence.',
      href: '/reviews?review=follow-up',
      tone: followUp.length > 0 ? 'warn' : 'ok',
      reviews: followUp,
    },
    {
      title: 'Held from app',
      detail: 'Held reviews are not shown in the app, but remain retained for support and Partner coaching.',
      status: 'Held',
      operatorAction: 'Make sure held rows have a clear reason and audit trail.',
      href: '/reviews?review=held',
      tone: held.length > 0 ? 'info' : 'ok',
      reviews: held,
    },
  ];
}

export function buildReviewFilters(params: Record<string, string | string[] | undefined>): ReviewFilters {
  return {
    page: normalizePage(readParam(params.page)),
    pageSize: normalizePageSize(readParam(params.pageSize)),
    q: readParam(params.q).trim(),
    review: normalizeReviewFilter(readParam(params.review)),
  };
}

export function filterReviews(reviews: readonly AdminReview[], filters: ReviewFilters): AdminReview[] {
  const query = filters.q.toLowerCase();

  return reviews.filter((review) => {
    if (filters.review && !reviewMatchesFilter(review, filters.review)) {
      return false;
    }
    if (query && !searchableReviewText(review).includes(query)) {
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

export function buildReviewListHref(filters: ReviewFilters, overrides: Partial<ReviewFilters> = {}) {
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
  if (next.page > 1) {
    params.set('page', String(next.page));
  }

  return params.size ? `/reviews?${params.toString()}` : '/reviews';
}

export function reviewFilterLinks() {
  return [
    { label: 'All reviews', href: '/reviews', review: '' },
    { label: 'Published', href: '/reviews?review=published', review: 'published' },
    { label: 'Held', href: '/reviews?review=held', review: 'held' },
    { label: 'Follow-up', href: '/reviews?review=follow-up', review: 'follow-up' },
    { label: 'Reported', href: '/reviews?review=reported', review: 'reported' },
  ] as const;
}

export function reviewFilterDescription(review: string) {
  if (review === 'reported') {
    return 'reviews that need moderation follow-up.';
  }
  if (review === 'follow-up') {
    return 'reviews with report reasons or moderation follow-up.';
  }
  if (review === 'held') {
    return 'reviews held from app visibility but retained for evidence.';
  }
  if (review === 'published') {
    return 'reviews currently visible in the app.';
  }
  return 'all customer reviews.';
}

export function emptyReviewMessage(review: string) {
  if (!review) {
    return 'No customer reviews loaded.';
  }
  return `No customer reviews currently match this queue. ${reviewFilterDescription(review)}`;
}

export function buildSummary(reviews: readonly AdminReview[]) {
  const rated = reviews.filter((review) => Number.isFinite(review.rating));

  return {
    averageRating:
      rated.length > 0
        ? (rated.reduce((sum, review) => sum + review.rating, 0) / rated.length).toFixed(1)
        : '0.0',
    held: reviews.filter((review) => review.status === 'HIDDEN').length,
    published: reviews.filter((review) => review.status === 'PUBLISHED').length,
    reported: reviews.filter((review) => review.status === 'REPORTED').length,
    followUp: reviews.filter((review) => review.status === 'REPORTED' || Boolean(review.reportReason?.trim()))
      .length,
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
    'Created At': formatReviewDate(review.createdAt),
    Booking: review.booking?.id ?? '',
    Service: reviewServiceLabel(review),
  }));
}

export function reviewProviderLabel(review: AdminReview) {
  return review.providerProfile?.displayName ?? 'Unknown Partner';
}

export function reviewToneClass(tone: ReviewCommandTone) {
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'ok') {
    return 'signal-ok';
  }
  return 'signal-info';
}

export function reviewToneLabel(tone: ReviewCommandTone) {
  if (tone === 'warn') {
    return 'Needs moderation';
  }
  if (tone === 'ok') {
    return 'Clear';
  }
  return 'Monitor';
}

export function humanizeStatus(status: string) {
  return reviewStatusLabel(status);
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
  if (filter === 'follow-up') {
    return review.status === 'REPORTED' || Boolean(review.reportReason?.trim());
  }
  if (filter === 'held') {
    return review.status === 'HIDDEN';
  }
  if (filter === 'published') {
    return review.status === 'PUBLISHED';
  }
  return true;
}

function reviewStatusLabel(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'Published';
    case 'HIDDEN':
      return 'Held';
    case 'REPORTED':
      return 'Follow-up';
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
  return 'review-status-chip review-status-follow-up';
}

function statusMeaning(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'Visible in app';
    case 'HIDDEN':
      return 'Held from app visibility';
    case 'REPORTED':
      return 'Moderation follow-up';
    default:
      return 'Review state under moderation';
  }
}

function partnerReviewHint(review: AdminReview) {
  if (review.status === 'REPORTED' || review.reportReason?.trim()) {
    return 'Follow-up marker';
  }
  if (review.status === 'HIDDEN') {
    return 'Not visible in app';
  }
  return 'Visible review';
}

function reviewServiceLabel(review: AdminReview) {
  const services = review.booking?.services
    ?.map((item) => item.service?.name)
    .filter((name): name is string => Boolean(name));

  return services?.length ? services.join(', ') : 'Service not attached';
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

function formatReviewDate(value?: string | null) {
  const timestamp = value ? new Date(value) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) {
    return 'No date';
  }

  return [
    `${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}`,
    `${pad(timestamp.getDate())}/${pad(timestamp.getMonth() + 1)}/${timestamp.getFullYear()}`,
  ].join(' ');
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
  if (value === 'low-rating' || value === 'service-recovery') {
    return 'follow-up';
  }
  if (value === 'hidden' || value === 'hold') {
    return 'held';
  }
  if (value === 'published' || value === 'held' || value === 'reported' || value === 'follow-up') {
    return value;
  }
  return '';
}

function dateMs(value?: string | null) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
