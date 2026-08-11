import type { AdminReview } from '../../lib/admin-api';
import { reviewModerationActionMenuItems } from './review-page-actions';

describe('review page actions', () => {
  it('builds moderation action links and disabled states from review status', () => {
    const actions = reviewModerationActionMenuItems({
      id: 'review-action-123456',
      rating: 4,
      status: 'REPORTED',
    } as AdminReview);

    expect(actions.map((action) => action.label)).toEqual(['Publish', 'Hide', 'Needs review']);
    expect(actions.map((action) => action.disabled)).toEqual([false, false, true]);
    expect(actions.map((action) => (action.kind === 'link' ? action.href : ''))).toEqual([
      '/reviews?confirm=moderate&reviewId=review-action-123456&status=PUBLISHED',
      '/reviews?confirm=moderate&reviewId=review-action-123456&status=HIDDEN',
      '/reviews?confirm=moderate&reviewId=review-action-123456&status=REPORTED',
    ]);
  });
});
