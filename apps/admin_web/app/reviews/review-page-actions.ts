import type { AdminReview } from '../../lib/admin-api';
import { reviewModerationConfirmHref } from './review-action-confirmation';

export type ReviewActionItem = {
  readonly description: string;
  readonly disabled: boolean;
  readonly href: string;
  readonly kind: 'link';
  readonly label: string;
  readonly tone: 'info' | 'success' | 'warning';
};

export function reviewModerationActionMenuItems(review: AdminReview): readonly ReviewActionItem[] {
  return [
    {
      description:
        review.status === 'PUBLISHED'
          ? 'Review is already published and visible in the app.'
          : 'Publish this review so it can appear in the app.',
      disabled: review.status === 'PUBLISHED',
      href: reviewModerationConfirmHref(review.id, 'PUBLISHED'),
      kind: 'link',
      label: 'Publish',
      tone: 'success',
    },
    {
      description:
        review.status === 'HIDDEN'
          ? 'Review is already hidden from app visibility.'
          : 'Hide this review so it no longer appears in the app.',
      disabled: review.status === 'HIDDEN',
      href: reviewModerationConfirmHref(review.id, 'HIDDEN'),
      kind: 'link',
      label: 'Hide',
      tone: 'warning',
    },
    {
      description:
        review.status === 'REPORTED'
          ? 'Review is already in Needs review.'
          : 'Remove this review from the app until moderation is resolved.',
      disabled: review.status === 'REPORTED',
      href: reviewModerationConfirmHref(review.id, 'REPORTED'),
      kind: 'link',
      label: 'Needs review',
      tone: 'info',
    },
  ];
}
