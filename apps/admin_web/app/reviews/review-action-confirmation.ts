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
    confirmLabel: 'Hold review',
    description: (review, reportReason) =>
      `Hold review ${shortId(review.id)} from app visibility. Reason: ${reportReason || 'Held by admin'}.`,
    title: (review) => `Hold review ${shortId(review.id)}?`,
    tone: 'warning',
  },
  PUBLISHED: {
    confirmLabel: 'Publish review',
    description: (review) =>
      `Publish review ${shortId(review.id)} so it can appear in the app and count toward Partner rating.`,
    title: (review) => `Publish review ${shortId(review.id)}?`,
    tone: 'success',
  },
  REPORTED: {
    confirmLabel: 'Mark for follow-up',
    description: (review, reportReason) =>
      `Mark review ${shortId(review.id)} for moderation follow-up. Reason: ${
        reportReason || 'Marked for follow-up'
      }.`,
    title: (review) => `Mark review ${shortId(review.id)} for follow-up?`,
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
