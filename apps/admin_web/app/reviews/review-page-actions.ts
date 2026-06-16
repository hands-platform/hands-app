import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminReview } from '../../lib/admin-api';
import { reviewModerationConfirmHref } from './review-action-confirmation';

export function reviewModerationActionMenuItems(review: AdminReview): readonly ActionMenuItem[] {
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
          ? 'Review is already held from app visibility.'
          : 'Hold this review so it no longer appears in the app.',
      disabled: review.status === 'HIDDEN',
      href: reviewModerationConfirmHref(review.id, 'HIDDEN', 'Held by admin'),
      kind: 'link',
      label: 'Hold',
      tone: 'warning',
    },
    {
      description:
        review.status === 'REPORTED'
          ? 'Review is already marked for moderation follow-up.'
          : 'Mark this review for moderation follow-up without publishing it immediately.',
      disabled: review.status === 'REPORTED',
      href: reviewModerationConfirmHref(review.id, 'REPORTED', 'Marked for follow-up'),
      kind: 'link',
      label: 'Follow-up',
      tone: 'info',
    },
  ];
}
