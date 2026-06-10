import type { ActionMenuItem } from '../../components/action-menu';
import type { AdminReview } from '../../lib/admin-api';
import { reviewModerationConfirmHref } from './review-action-confirmation';

export function reviewModerationActionMenuItems(review: AdminReview): readonly ActionMenuItem[] {
  return [
    {
      description:
        review.status === 'PUBLISHED'
          ? 'Feedback is already published.'
          : 'Review before making this feedback visible.',
      disabled: review.status === 'PUBLISHED',
      href: reviewModerationConfirmHref(review.id, 'PUBLISHED'),
      kind: 'link',
      label: 'Publish',
      tone: 'info',
    },
    {
      description:
        review.status === 'HIDDEN'
          ? 'Feedback is already hidden.'
          : 'Review before removing this feedback from public visibility.',
      disabled: review.status === 'HIDDEN',
      href: reviewModerationConfirmHref(review.id, 'HIDDEN', 'Hidden by admin'),
      kind: 'link',
      label: 'Hide',
      tone: 'danger',
    },
    {
      description:
        review.status === 'REPORTED'
          ? 'Feedback is already marked for follow-up.'
          : 'Review before adding moderation follow-up.',
      disabled: review.status === 'REPORTED',
      href: reviewModerationConfirmHref(review.id, 'REPORTED', 'Marked for follow-up'),
      kind: 'link',
      label: 'Report',
      tone: 'warning',
    },
  ];
}
