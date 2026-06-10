import type { AdminReview } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type ReviewModerationStatus = 'HIDDEN' | 'PUBLISHED' | 'REPORTED';

export type ReviewModerationConfirmation = {
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
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
    confirmLabel: 'Hide feedback',
    description: (review, reportReason) =>
      `Hide feedback ${shortId(review.id)} from public visibility. Reason: ${reportReason || 'Hidden by admin'}.`,
    title: (review) => `Hide feedback ${shortId(review.id)}?`,
    tone: 'danger',
  },
  PUBLISHED: {
    confirmLabel: 'Publish feedback',
    description: (review) =>
      `Publish feedback ${shortId(review.id)} so it can be visible to customers and operational review.`,
    title: (review) => `Publish feedback ${shortId(review.id)}?`,
    tone: 'info',
  },
  REPORTED: {
    confirmLabel: 'Mark for follow-up',
    description: (review, reportReason) =>
      `Mark feedback ${shortId(review.id)} for moderation follow-up. Reason: ${
        reportReason || 'Marked for follow-up'
      }.`,
    title: (review) => `Report feedback ${shortId(review.id)}?`,
    tone: 'warning',
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
  reviews: readonly AdminReview[],
  reviewId: string,
  status: ReviewModerationStatus | null,
  reportReason: string,
): ReviewModerationConfirmation | null {
  if (!status) {
    return null;
  }

  const review = reviews.find((item) => item.id === reviewId);
  if (!review) {
    return null;
  }

  const metadata = reviewModerationMetadata[status];

  return {
    cancelHref: '/reviews',
    confirmLabel: metadata.confirmLabel,
    description: metadata.description(review, reportReason),
    hiddenInputs: [
      { name: 'reviewId', value: review.id },
      { name: 'status', value: status },
      { name: 'reportReason', value: reportReason },
    ],
    reviewId: review.id,
    title: metadata.title(review),
    tone: metadata.tone,
  };
}
