import type { AdminReview } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { reviewModerationActionMenuItems } from './review-page-actions';
import type { ReviewTableRow } from './reviews-table-section';

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

export type ReviewFilters = {
  readonly review: string;
};

export function buildReviewTableRows(reviews: readonly AdminReview[]): ReviewTableRow[] {
  return reviews.map((review) => ({
    actionLabel: `Feedback actions for ${shortId(review.id)}`,
    actions: reviewModerationActionMenuItems(review),
    commentLabel: review.comment?.trim() || 'No written review',
    customerLabel: review.customerProfile?.user?.fullName ?? review.customerProfile?.user?.phone ?? 'Unknown',
    customerPhone: review.customerProfile?.user?.phone ?? 'No phone on file',
    id: review.id,
    opsHint: opsHint(review),
    opsSignal: opsSignal(review),
    providerHint: providerReviewHint(review),
    providerLabel: review.providerProfile?.displayName ?? 'Unknown',
    reportReasonLabel: review.reportReason?.trim() ? `Report: ${review.reportReason}` : 'No report reason',
    shortIdLabel: shortId(review.id),
    signalClassName: signalClass(review),
    statusLabel: humanizeStatus(review.status),
    statusMeaning: statusMeaning(review.status),
  }));
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
  const hidden = reviews.filter((review) => review.status === 'HIDDEN');

  return [
    {
      title: 'Reported feedback',
      detail: 'Customer or operator reports need moderation, support notes, and public visibility decision.',
      status: 'Reported',
      operatorAction: 'Open reported rows first, then publish, hide, or keep under follow-up.',
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
      title: 'Hidden evidence',
      detail: 'Hidden reviews should not disappear operationally; they remain useful for disputes.',
      status: 'Hidden',
      operatorAction: 'Make sure hidden rows have a clear reason and audit trail.',
      href: '/reviews?review=hidden',
      tone: hidden.length > 0 ? 'info' : 'ok',
      reviews: hidden,
    },
  ];
}

export function buildReviewFilters(params: Record<string, string | string[] | undefined>): ReviewFilters {
  return {
    review: normalizeReviewFilter(readParam(params.review)),
  };
}

export function filterReviews(reviews: readonly AdminReview[], filters: ReviewFilters): AdminReview[] {
  if (!filters.review) {
    return [...reviews];
  }
  return reviews.filter((review) => reviewMatchesFilter(review, filters.review));
}

export function reviewFilterLinks() {
  return [
    { label: 'All feedback', href: '/reviews', review: '' },
    { label: 'Reported', href: '/reviews?review=reported', review: 'reported' },
    { label: 'Follow-up', href: '/reviews?review=follow-up', review: 'follow-up' },
    { label: 'Hidden', href: '/reviews?review=hidden', review: 'hidden' },
    { label: 'Published', href: '/reviews?review=published', review: 'published' },
  ] as const;
}

export function reviewFilterDescription(review: string) {
  if (review === 'reported') {
    return 'feedback records that need moderation follow-up.';
  }
  if (review === 'follow-up') {
    return 'feedback records with report reasons or moderation follow-up.';
  }
  if (review === 'hidden') {
    return 'feedback removed from public visibility but retained for evidence.';
  }
  if (review === 'published') {
    return 'feedback currently visible to customers.';
  }
  return 'all feedback records.';
}

export function emptyReviewMessage(review: string) {
  if (!review) {
    return 'No feedback records loaded.';
  }
  return `No feedback records currently match this queue. ${reviewFilterDescription(review)}`;
}

export function buildSummary(reviews: readonly AdminReview[]) {
  return {
    total: reviews.length,
    flagged: reviews.filter((review) => review.status === 'REPORTED' || review.status === 'HIDDEN').length,
    published: reviews.filter((review) => review.status === 'PUBLISHED').length,
    followUp: reviews.filter((review) => review.status === 'REPORTED' || Boolean(review.reportReason?.trim()))
      .length,
  };
}

export function reviewProviderLabel(review: AdminReview) {
  return review.providerProfile?.displayName ?? 'Unknown partner';
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
  if (filter === 'hidden') {
    return review.status === 'HIDDEN';
  }
  if (filter === 'published') {
    return review.status === 'PUBLISHED';
  }
  return true;
}

export function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusMeaning(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'Visible to customers';
    case 'HIDDEN':
      return 'Removed from public view';
    case 'REPORTED':
      return 'Needs moderation follow-up';
    default:
      return 'Feedback state under moderation';
  }
}

function providerReviewHint(review: AdminReview) {
  if (review.status === 'REPORTED' || review.reportReason?.trim()) {
    return 'Feedback has a follow-up marker';
  }
  return 'Use this record to track service feedback and booking context';
}

function signalClass(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'signal signal-warn';
  }
  if (review.status === 'PUBLISHED') {
    return 'signal signal-ok';
  }
  return 'signal signal-info';
}

function opsSignal(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'Needs moderation';
  }
  if (review.status === 'HIDDEN') {
    return 'Already hidden';
  }
  return 'Monitor';
}

function opsHint(review: AdminReview) {
  if (review.status === 'REPORTED') {
    return 'Review the text, confirm the report reason, and decide whether to keep it hidden.';
  }
  if (review.status === 'HIDDEN') {
    return 'Hidden feedback should still be documented for support or partner coaching.';
  }
  return 'Routine feedback row for customer sentiment and booking context.';
}

function dateMs(value?: string | null) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeReviewFilter(value: string) {
  if (value === 'low-rating' || value === 'service-recovery') {
    return 'follow-up';
  }
  return value;
}
