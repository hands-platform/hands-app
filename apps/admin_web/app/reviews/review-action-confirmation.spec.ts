import type { AdminReview } from '../../lib/admin-api';
import {
  buildReviewModerationConfirmation,
  readReviewModerationStatus,
  reviewModerationConfirmHref,
} from './review-action-confirmation';

const review = {
  id: 'review-feedback-123456',
  rating: 4,
  status: 'PUBLISHED',
  comment: 'Great service',
} as AdminReview;

describe('review action confirmation', () => {
  it('builds a hold confirmation with report reason evidence', () => {
    const confirmation = buildReviewModerationConfirmation([review], review.id, 'HIDDEN', 'Held by admin');

    expect(confirmation).toEqual({
      cancelHref: '/reviews',
      confirmLabel: 'Hold review',
      description: 'Hold review review-f from app visibility. Reason: Held by admin.',
      hiddenInputs: [
        { name: 'reviewId', value: review.id },
        { name: 'status', value: 'HIDDEN' },
        { name: 'reportReason', value: 'Held by admin' },
      ],
      reviewId: review.id,
      title: 'Hold review review-f?',
      tone: 'warning',
    });
  });

  it('builds a publish confirmation', () => {
    const confirmation = buildReviewModerationConfirmation([review], review.id, 'PUBLISHED', '');

    expect(confirmation?.confirmLabel).toBe('Publish review');
    expect(confirmation?.tone).toBe('success');
    expect(confirmation?.hiddenInputs).toContainEqual({ name: 'status', value: 'PUBLISHED' });
  });

  it('returns null for unsupported status or unloaded review', () => {
    expect(buildReviewModerationConfirmation([review], review.id, null, '')).toBeNull();
    expect(buildReviewModerationConfirmation([review], 'missing', 'REPORTED', '')).toBeNull();
  });

  it('reads only supported moderation statuses', () => {
    expect(readReviewModerationStatus('HIDDEN')).toBe('HIDDEN');
    expect(readReviewModerationStatus('PUBLISHED')).toBe('PUBLISHED');
    expect(readReviewModerationStatus('REPORTED')).toBe('REPORTED');
    expect(readReviewModerationStatus('DELETED')).toBeNull();
  });

  it('encodes moderation confirmation URL fields', () => {
    expect(reviewModerationConfirmHref('review 1', 'REPORTED', 'Needs review')).toBe(
      '/reviews?confirm=moderate&reviewId=review+1&status=REPORTED&reportReason=Needs+review',
    );
  });
});
