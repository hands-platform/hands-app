import type { AdminReview } from '../../lib/admin-api';
import {
  buildReviewCommandBoard,
  buildReviewFilters,
  buildReviewTableRows,
  buildSummary,
  emptyReviewMessage,
  filterReviews,
  reviewFilterDescription,
  reviewToneClass,
  reviewToneLabel,
  sortReviews,
} from './review-page-model';

describe('review page model', () => {
  it('sorts moderation queues before published feedback', () => {
    const rows = sortReviews([
      review({ createdAt: '2026-06-08T10:00:00.000Z', id: 'published', status: 'PUBLISHED' }),
      review({ createdAt: '2026-06-07T10:00:00.000Z', id: 'reported', status: 'REPORTED' }),
      review({ createdAt: '2026-06-09T10:00:00.000Z', id: 'hidden', status: 'HIDDEN' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['reported', 'hidden', 'published']);
  });

  it('builds filters with legacy aliases mapped to follow-up', () => {
    expect(buildReviewFilters({ review: 'low-rating' })).toEqual({ review: 'follow-up' });
    expect(buildReviewFilters({ review: 'service-recovery' })).toEqual({ review: 'follow-up' });
    expect(buildReviewFilters({ review: 'hidden' })).toEqual({ review: 'hidden' });
  });

  it('filters feedback by moderation queue', () => {
    const reviews = [
      review({ id: 'reported', reportReason: 'Customer asked for follow-up', status: 'REPORTED' }),
      review({ id: 'hidden', status: 'HIDDEN' }),
      review({ id: 'published', status: 'PUBLISHED' }),
    ];

    expect(filterReviews(reviews, { review: 'follow-up' }).map((item) => item.id)).toEqual(['reported']);
    expect(filterReviews(reviews, { review: 'hidden' }).map((item) => item.id)).toEqual(['hidden']);
    expect(filterReviews(reviews, { review: '' })).toHaveLength(3);
  });

  it('builds summary and command board counts', () => {
    const reviews = [
      review({ id: 'reported', reportReason: 'Needs support call', status: 'REPORTED' }),
      review({ id: 'hidden', status: 'HIDDEN' }),
      review({ id: 'published', status: 'PUBLISHED' }),
    ];

    expect(buildSummary(reviews)).toEqual({
      flagged: 2,
      followUp: 1,
      published: 1,
      total: 3,
    });
    expect(buildReviewCommandBoard(reviews).map((item) => [item.title, item.reviews.length, item.tone])).toEqual([
      ['Reported feedback', 1, 'warn'],
      ['Service follow-up', 1, 'warn'],
      ['Hidden evidence', 1, 'info'],
    ]);
  });

  it('builds table rows and action links without changing moderation behavior', () => {
    const rows = buildReviewTableRows([
      review({
        comment: 'Great service',
        customerProfile: { user: { fullName: 'Customer Mai', phone: '+8491' } },
        id: 'review-row-123456',
        providerProfile: { displayName: 'Partner Linh' },
        reportReason: 'Needs follow-up',
        status: 'REPORTED',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Feedback actions for review-r',
      commentLabel: 'Great service',
      customerLabel: 'Customer Mai',
      providerLabel: 'Partner Linh',
      reportReasonLabel: 'Report: Needs follow-up',
      statusLabel: 'Reported',
    });
    expect(rows[0]?.actions.map((action) => action.kind === 'link' ? action.href : '')).toEqual([
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=PUBLISHED',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=HIDDEN&reportReason=Hidden+by+admin',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=REPORTED&reportReason=Marked+for+follow-up',
    ]);
  });

  it('keeps filter and tone copy stable', () => {
    expect(reviewFilterDescription('published')).toBe('feedback currently visible to customers.');
    expect(emptyReviewMessage('hidden')).toContain('feedback removed from public visibility');
    expect(reviewToneClass('warn')).toBe('signal-warn');
    expect(reviewToneLabel('ok')).toBe('Clear');
  });
});

function review(input: Partial<AdminReview>): AdminReview {
  return {
    id: 'review-1',
    rating: 5,
    status: 'PUBLISHED',
    ...input,
  } as AdminReview;
}
