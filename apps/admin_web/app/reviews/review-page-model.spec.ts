import type { AdminReview } from '../../lib/admin-api';
import {
  buildReviewCommandBoard,
  buildReviewExportRows,
  buildReviewFilters,
  buildReviewListHref,
  buildReviewTableRows,
  buildSummary,
  emptyReviewMessage,
  filterReviews,
  paginateReviewRows,
  reviewFilterDescription,
  reviewToneClass,
  reviewToneLabel,
  sortReviews,
} from './review-page-model';

describe('review page model', () => {
  it('sorts moderation queues before published reviews', () => {
    const rows = sortReviews([
      review({ createdAt: '2026-06-08T10:00:00.000Z', id: 'published', status: 'PUBLISHED' }),
      review({ createdAt: '2026-06-07T10:00:00.000Z', id: 'reported', status: 'REPORTED' }),
      review({ createdAt: '2026-06-09T10:00:00.000Z', id: 'hidden', status: 'HIDDEN' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['reported', 'hidden', 'published']);
  });

  it('builds filters with review aliases, search, page, and page size', () => {
    expect(buildReviewFilters({ page: '2', pageSize: '25', q: ' linh ', review: 'low-rating' })).toEqual({
      page: 2,
      pageSize: 25,
      q: 'linh',
      review: 'follow-up',
    });
    expect(buildReviewFilters({ review: 'hidden' })).toMatchObject({ review: 'held' });
    expect(buildReviewFilters({ page: '-1', pageSize: '999', review: 'unknown' })).toEqual({
      page: 1,
      pageSize: 10,
      q: '',
      review: '',
    });
  });

  it('filters reviews by moderation queue and search query', () => {
    const reviews = [
      review({ id: 'reported', reportReason: 'Customer asked for follow-up', status: 'REPORTED' }),
      review({ id: 'hidden', providerProfile: { displayName: 'Partner Linh' }, status: 'HIDDEN' }),
      review({ id: 'published', comment: 'Great service', status: 'PUBLISHED' }),
    ];

    expect(filterReviews(reviews, filters({ review: 'follow-up' })).map((item) => item.id)).toEqual(['reported']);
    expect(filterReviews(reviews, filters({ review: 'held' })).map((item) => item.id)).toEqual(['hidden']);
    expect(filterReviews(reviews, filters({ q: 'linh' })).map((item) => item.id)).toEqual(['hidden']);
    expect(filterReviews(reviews, filters({ review: '' }))).toHaveLength(3);
  });

  it('builds summary and command board counts', () => {
    const reviews = [
      review({ id: 'reported', rating: 3, reportReason: 'Needs support call', status: 'REPORTED' }),
      review({ id: 'hidden', rating: 4, status: 'HIDDEN' }),
      review({ id: 'published', rating: 5, status: 'PUBLISHED' }),
    ];

    expect(buildSummary(reviews)).toEqual({
      averageRating: '4.0',
      held: 1,
      followUp: 1,
      published: 1,
      reported: 1,
      total: 3,
    });
    expect(buildReviewCommandBoard(reviews).map((item) => [item.title, item.reviews.length, item.tone])).toEqual([
      ['Reported reviews', 1, 'warn'],
      ['Service follow-up', 1, 'warn'],
      ['Held from app', 1, 'info'],
    ]);
  });

  it('builds table rows and action links without changing moderation behavior', () => {
    const rows = buildReviewTableRows([
      review({
        comment: 'Great service',
        createdAt: '2026-06-16T09:08:00.000Z',
        customerProfile: { user: { fullName: 'Customer Mai', phone: '+8491' } },
        id: 'review-row-123456',
        providerProfile: { displayName: 'Partner Linh' },
        reportReason: 'Needs follow-up',
        status: 'REPORTED',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Review actions for review-r',
      appVisibilityLabel: 'Not visible in app',
      commentLabel: 'Great service',
      customerInitials: 'CM',
      customerLabel: 'Customer Mai',
      partnerInitials: 'PL',
      partnerLabel: 'Partner Linh',
      ratingLabel: '5/5',
      reportReasonLabel: 'Reason: Needs follow-up',
      statusLabel: 'Follow-up',
      statusMeaning: 'Moderation follow-up',
    });
    expect(rows[0]?.actions.map((action) => (action.kind === 'link' ? action.href : ''))).toEqual([
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=PUBLISHED',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=HIDDEN&reportReason=Held+by+admin',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=REPORTED&reportReason=Marked+for+follow-up',
    ]);
  });

  it('paginates rows and builds stable list hrefs', () => {
    const rows = ['a', 'b', 'c', 'd'];
    const pagination = paginateReviewRows(rows, filters({ page: 2, pageSize: 2, q: 'mai', review: 'held' }));

    expect(pagination).toMatchObject({
      from: 3,
      page: 2,
      pageSize: 2,
      rows: ['c', 'd'],
      to: 4,
      totalPages: 2,
      totalRows: 4,
    });
    expect(buildReviewListHref(filters({ pageSize: 25, q: 'mai', review: 'held' }), { page: 2 })).toBe(
      '/reviews?q=mai&pageSize=25&review=held&page=2',
    );
  });

  it('keeps filter, export, and tone copy stable', () => {
    const exported = buildReviewExportRows([review({ comment: 'Nice', status: 'HIDDEN' })]);

    expect(reviewFilterDescription('published')).toBe('reviews currently visible in the app.');
    expect(emptyReviewMessage('held')).toContain('held from app visibility');
    expect(reviewToneClass('warn')).toBe('signal-warn');
    expect(reviewToneLabel('ok')).toBe('Clear');
    expect(exported[0]).toMatchObject({ 'App Visibility': 'Not visible', Status: 'Held' });
  });
});

function filters(input: Partial<ReturnType<typeof buildReviewFilters>> = {}) {
  return {
    page: 1,
    pageSize: 10,
    q: '',
    review: '',
    ...input,
  };
}

function review(input: Partial<AdminReview>): AdminReview {
  return {
    id: 'review-1',
    rating: 5,
    status: 'PUBLISHED',
    ...input,
  } as AdminReview;
}
