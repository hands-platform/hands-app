import type { AdminReview } from '../../lib/admin-api';
import {
  buildReviewModerationConfirmation,
  readReviewModerationStatus,
  reviewModerationConfirmHref,
  safeReviewReturnTo,
} from './review-action-confirmation';

const review = {
  id: 'review-feedback-123456',
  rating: 4,
  status: 'PUBLISHED',
  comment: 'Great service',
} as AdminReview;

describe('review action confirmation', () => {
  it('builds a hidden confirmation with required reason and list context', () => {
    const confirmation = buildReviewModerationConfirmation(
      review,
      'HIDDEN',
      'Customer dispute under review',
      '/reviews?dateRange=30d&page=2&q=mai',
    );

    expect(confirmation).toMatchObject({
      cancelHref: '/reviews?dateRange=30d&page=2&q=mai',
      confirmLabel: 'Hide review',
      nextStatusLabel: 'Hidden',
      review,
      reviewId: review.id,
      title: 'Hide review review-f?',
      tone: 'warning',
    });
    expect(confirmation?.reasonInput?.defaultValue).toBe('Customer dispute under review');
    expect(confirmation?.hiddenInputs).toContainEqual({ name: 'returnTo', value: '/reviews?dateRange=30d&page=2&q=mai' });
  });

  it('builds a publish confirmation', () => {
    const confirmation = buildReviewModerationConfirmation(review, 'PUBLISHED', 'Old reason');

    expect(confirmation?.confirmLabel).toBe('Publish review');
    expect(confirmation?.tone).toBe('success');
    expect(confirmation?.reasonInput).toBeNull();
    expect(confirmation?.hiddenInputs).toContainEqual({ name: 'reportReason', value: '' });
    expect(confirmation?.hiddenInputs).toContainEqual({ name: 'status', value: 'PUBLISHED' });
  });

  it('returns null for unsupported status or unloaded review', () => {
    expect(buildReviewModerationConfirmation(review, null, '')).toBeNull();
    expect(buildReviewModerationConfirmation(null, 'REPORTED', '')).toBeNull();
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

  it('accepts only an internal reviews return path', () => {
    expect(safeReviewReturnTo('/reviews?review=reported&page=2')).toBe('/reviews?review=reported&page=2');
    expect(safeReviewReturnTo('//evil.example/reviews')).toBe('/reviews');
    expect(safeReviewReturnTo('/partners')).toBe('/reviews');
    expect(safeReviewReturnTo('/reviews\\redirect')).toBe('/reviews');
  });
});
