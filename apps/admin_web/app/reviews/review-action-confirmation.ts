import type { AdminReview } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type ReviewModerationStatus = 'HIDDEN' | 'PUBLISHED' | 'REPORTED';

export type ReviewModerationConfirmation = {
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly impact: string;
  readonly nextStatusLabel: string;
  readonly reasonInput: {
    readonly defaultValue: string;
    readonly options: readonly { readonly label: string; readonly value: string }[];
  } | null;
  readonly review: AdminReview;
  readonly reviewId: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

type ReviewModerationMetadata = {
  readonly confirmLabel: string;
  readonly description: (review: AdminReview, reportReason: string) => string;
  readonly title: (review: AdminReview) => string;
  readonly tone: StatusBadgeTone;
};

const reviewModerationMetadata: Record<ReviewModerationStatus, ReviewModerationMetadata> = {
  HIDDEN: {
    confirmLabel: 'Hide review',
    description: (review) => `Hide review ${shortId(review.id)} from customer app visibility.`,
    title: (review) => `Hide review ${shortId(review.id)}?`,
    tone: 'warning',
  },
  PUBLISHED: {
    confirmLabel: 'Publish review',
    description: (review) => `Publish review ${shortId(review.id)} so it can appear in the customer app.`,
    title: (review) => `Publish review ${shortId(review.id)}?`,
    tone: 'success',
  },
  REPORTED: {
    confirmLabel: 'Send to Needs review',
    description: (review) =>
      `Remove review ${shortId(review.id)} from the customer app until moderation is resolved.`,
    title: (review) => `Send review ${shortId(review.id)} to Needs review?`,
    tone: 'info',
  },
};

export function reviewModerationConfirmHref(
  reviewId: string,
  status: ReviewModerationStatus,
  reportReason = '',
) {
  const params = new URLSearchParams({
    confirm: 'moderate',
    reviewId,
    status,
  });

  if (reportReason) {
    params.set('reportReason', reportReason);
  }

  return `/reviews?${params.toString()}`;
}

export function readReviewModerationStatus(value: string): ReviewModerationStatus | null {
  if (value === 'HIDDEN' || value === 'PUBLISHED' || value === 'REPORTED') {
    return value;
  }
  return null;
}

export function buildReviewModerationConfirmation(
  review: AdminReview | null,
  status: ReviewModerationStatus | null,
  reportReason: string,
  returnTo = '/reviews',
): ReviewModerationConfirmation | null {
  if (!status || !review) {
    return null;
  }

  const metadata = reviewModerationMetadata[status];
  const safeReturnTo = safeReviewReturnTo(returnTo);
  const reasonInput = status === 'PUBLISHED'
    ? null
    : {
        defaultValue: reportReason,
        options: REVIEW_MODERATION_REASON_OPTIONS,
      };

  return {
    cancelHref: safeReturnTo,
    confirmLabel: metadata.confirmLabel,
    description: metadata.description(review, reportReason),
    hiddenInputs: [
      { name: 'reviewId', value: review.id },
      { name: 'status', value: status },
      { name: 'returnTo', value: safeReturnTo },
      ...(status === 'PUBLISHED'
        ? [
            { name: 'reportReason', value: '' },
            { name: 'reason', value: 'Restored app visibility' },
          ]
        : []),
    ],
    impact: reviewModerationImpact(status),
    nextStatusLabel: reviewModerationStatusLabel(status),
    reasonInput,
    review,
    reviewId: review.id,
    title: metadata.title(review),
    tone: metadata.tone,
  };
}

export function safeReviewReturnTo(value: string) {
  if (!value || /[\r\n\\]/.test(value)) {
    return '/reviews';
  }
  try {
    const url = new URL(value, 'http://admin.local');
    return url.origin === 'http://admin.local' && url.pathname === '/reviews'
      ? `${url.pathname}${url.search}${url.hash}`
      : '/reviews';
  } catch {
    return '/reviews';
  }
}

export function reviewModerationStatusLabel(status: string) {
  if (status === 'PUBLISHED') return 'Visible';
  if (status === 'HIDDEN') return 'Hidden';
  if (status === 'REPORTED') return 'Needs review';
  return status;
}

const REVIEW_MODERATION_REASON_OPTIONS = [
  { label: 'Select a reason', value: '' },
  { label: 'Inappropriate or abusive content', value: 'Inappropriate or abusive content' },
  { label: 'Personal information exposed', value: 'Personal information exposed' },
  { label: 'Spam or fraudulent content', value: 'Spam or fraudulent content' },
  { label: 'Customer dispute under review', value: 'Customer dispute under review' },
  { label: 'Does not describe the completed service', value: 'Does not describe the completed service' },
] as const;

function reviewModerationImpact(status: ReviewModerationStatus) {
  if (status === 'PUBLISHED') return 'The review becomes visible in the customer app and counts toward Partner rating.';
  if (status === 'HIDDEN') return 'The review stays retained for audit but is not visible in the customer app.';
  return 'The review is removed from the customer app until an operator resolves it.';
}
