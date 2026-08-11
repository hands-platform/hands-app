import type { AdminPartnerCustomerReview, AdminReview } from '../../lib/admin-api';
import {
  buildPartnerCustomerReviewTableRows,
  buildPartnerCustomerEvaluationFilters,
  buildPartnerCustomerEvaluationListHref,
  buildPartnerCustomerReviewDataHrefs,
  buildReviewDataHrefs,
  buildReviewExportHref,
  buildReviewExportRows,
  buildReviewFilters,
  buildReviewListHref,
  buildReviewTableRows,
  buildSummary,
  filterPartnerCustomerReviews,
  filterReviews,
  paginateReviewRows,
  partnerCustomerReviewFilteredTotal,
  partnerCustomerReviewStatusLabel,
  reviewDateRangeError,
  reviewEmptyState,
  reviewFilterDescription,
  reviewMatchingCount,
  sortPartnerCustomerReviews,
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
    expect(
      buildReviewFilters({
        dateFrom: '2026-06-10',
        dateRange: 'custom',
        dateTo: '2026-06-17',
        page: '2',
        pageSize: '25',
        q: ' linh ',
        review: 'low-rating',
        sort: 'rating-asc',
      }),
    ).toEqual({
      dateFrom: '2026-06-10',
      dateRange: 'custom',
      dateTo: '2026-06-17',
      page: 2,
      pageSize: 25,
      q: 'linh',
      review: 'reported',
      sort: 'rating-asc',
    });
    expect(buildReviewFilters({ review: 'hidden' })).toMatchObject({ review: 'held' });
    expect(
      buildReviewFilters({
        dateFrom: 'bad',
        dateRange: 'bad',
        page: '-1',
        pageSize: '999',
        review: 'unknown',
        sort: 'bad',
      }),
    ).toEqual({
      dateFrom: '',
      dateRange: 'all',
      dateTo: '',
      page: 1,
      pageSize: 10,
      q: '',
      review: '',
      sort: 'newest',
    });
  });

  it('defaults review API requests to all dates and keeps a blank custom range open', () => {
    const hrefs = buildReviewDataHrefs(buildReviewFilters({}));
    const listUrl = new URL(hrefs.listHref, 'http://admin.local');
    const summaryUrl = new URL(hrefs.summaryHref, 'http://admin.local');

    expect(listUrl.pathname).toBe('/admin/reviews');
    expect(listUrl.searchParams.get('take')).toBe('10');
    expect(listUrl.searchParams.get('skip')).toBe('0');
    expect(listUrl.searchParams.has('from')).toBe(false);
    expect(listUrl.searchParams.has('to')).toBe(false);
    expect(summaryUrl.pathname).toBe('/admin/reviews/summary');
    expect(summaryUrl.searchParams.has('from')).toBe(false);
    expect(summaryUrl.searchParams.has('to')).toBe(false);
    expect(buildReviewFilters({ dateRange: 'custom' }).dateRange).toBe('custom');
  });

  it('supports open custom date bounds without inventing the missing edge', () => {
    const fromOnly = new URL(
      buildReviewDataHrefs(buildReviewFilters({ dateFrom: '2026-06-10', dateRange: 'custom' })).listHref,
      'http://admin.local',
    );
    const toOnly = new URL(
      buildReviewDataHrefs(buildReviewFilters({ dateRange: 'custom', dateTo: '2026-06-17' })).listHref,
      'http://admin.local',
    );

    expect(fromOnly.searchParams.has('from')).toBe(true);
    expect(fromOnly.searchParams.has('to')).toBe(false);
    expect(toOnly.searchParams.has('from')).toBe(false);
    expect(toOnly.searchParams.has('to')).toBe(true);
  });

  it('filters reviews by moderation queue, request date range, and search query', () => {
    const reviews = [
      review({
        booking: { openedAt: '2026-06-17T10:00:00.000Z' },
        createdAt: '2026-06-17T10:00:00.000Z',
        id: 'reported',
        reportReason: 'Customer asked for follow-up',
        status: 'REPORTED',
      }),
      review({
        booking: { openedAt: '2026-06-18T10:00:00.000Z' },
        createdAt: '2026-06-18T10:00:00.000Z',
        id: 'hidden',
        providerProfile: { displayName: 'Partner Linh' },
        status: 'HIDDEN',
      }),
      review({
        booking: { openedAt: '2026-06-19T10:00:00.000Z' },
        createdAt: '2026-06-19T10:00:00.000Z',
        comment: 'Great service',
        id: 'published',
        status: 'PUBLISHED',
      }),
    ];

    expect(filterReviews(reviews, filters({ review: 'reported' })).map((item) => item.id)).toEqual([
      'reported',
    ]);
    expect(filterReviews(reviews, filters({ review: 'held' })).map((item) => item.id)).toEqual(['hidden']);
    expect(filterReviews(reviews, filters({ q: 'linh' })).map((item) => item.id)).toEqual(['hidden']);
    expect(
      filterReviews(
        reviews,
        filters({
          dateFrom: '2026-06-18',
          dateRange: 'custom',
          dateTo: '2026-06-18',
        }),
      ).map((item) => item.id),
    ).toEqual(['hidden']);
    expect(filterReviews(reviews, filters({ review: '' }))).toHaveLength(3);
  });

  it('sorts reviews by the selected review sort mode', () => {
    const reviews = [
      review({ createdAt: '2026-06-20T10:00:00.000Z', id: 'newer', rating: 2 }),
      review({ createdAt: '2026-06-19T10:00:00.000Z', id: 'older', rating: 5 }),
    ];

    expect(sortReviews(reviews, 'oldest').map((item) => item.id)).toEqual(['older', 'newer']);
    expect(sortReviews(reviews, 'rating-desc').map((item) => item.id)).toEqual(['older', 'newer']);
    expect(sortReviews(reviews, 'rating-asc').map((item) => item.id)).toEqual(['newer', 'older']);
  });

  it('builds review summary counts', () => {
    const reviews = [
      review({ id: 'reported', rating: 3, reportReason: 'Needs support call', status: 'REPORTED' }),
      review({ id: 'hidden', rating: 4, status: 'HIDDEN' }),
      review({ id: 'published', rating: 5, status: 'PUBLISHED' }),
    ];

    expect(buildSummary(reviews)).toEqual({
      averageRating: '4.0',
      held: 1,
      published: 1,
      reported: 1,
      total: 3,
    });
  });

  it('builds table rows and action links without changing moderation behavior', () => {
    const rows = buildReviewTableRows([
      review({
        comment: 'Great service',
        booking: {
          id: 'booking-row-123456',
          openedAt: '2026-06-16T08:40:00.000Z',
        },
        createdAt: '2026-06-16T09:08:00.000Z',
        customerProfile: { id: 'customer-1', user: { fullName: 'Customer Mai', phone: '+8491' } },
        id: 'review-row-123456',
        providerProfile: { id: 'partner-1', displayName: 'Partner Linh' },
        reportReason: 'Needs follow-up',
        status: 'REPORTED',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Review actions for review-r',
      appVisibilityLabel: 'Not visible in app',
      bookingHref: '/bookings/booking-row-123456',
      bookingLabel: 'booking-',
      customerHref: '/customers/customer-1',
      commentLabel: 'Great service',
      commentValue: 'Great service',
      customerInitials: 'CM',
      customerLabel: 'Customer Mai',
      partnerHref: '/partners/partner-1',
      partnerInitials: 'PL',
      partnerLabel: 'Partner Linh',
      ratingLabel: '5/5',
      reportReasonLabel: 'Reason: Needs follow-up',
      status: 'REPORTED',
      statusClassName: 'review-status-chip review-status-reported',
      statusLabel: 'Needs review',
    });
    expect(rows[0]?.bookingRequestTimeLabel).toContain('16 Jun 2026');
    expect(rows[0]?.createdAt).toBe('2026-06-16T09:08:00.000Z');
    expect(rows[0]?.actions.map((action) => (action.kind === 'link' ? action.href : ''))).toEqual([
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=PUBLISHED',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=HIDDEN',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=REPORTED',
    ]);
  });

  it('builds text-only partner customer evaluation rows without rating actions', () => {
    const rows = buildPartnerCustomerReviewTableRows([
      partnerCustomerReview({
        booking: {
          id: 'booking-partner-eval-123456',
          openedAt: '2026-06-19T07:40:00.000Z',
          services: [{ service: { name: 'Deep Tissue' } }],
        },
        comment: 'Customer was ready at the service address and confirmed the finish time in chat.',
        createdAt: '2026-06-19T09:10:00.000Z',
        customerProfile: { id: 'customer-1', user: { fullName: 'Customer Hoa' } },
        id: 'partner-eval-123456',
        latestModeration: {
          actor: { fullName: 'Operator Linh' },
          createdAt: '2026-06-20T01:00:00.000Z',
          reason: 'Booking context requires verification',
        },
        providerProfile: { id: 'partner-1', displayName: 'Partner Minh' },
        reportReason: 'Booking context requires verification',
        status: 'REPORTED',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      bookingHref: '/bookings/booking-partner-eval-123456',
      bookingLabel: 'booking-',
      bookingRequestTimeLabel: expect.stringContaining('19 Jun 2026'),
      commentLabel: 'Customer was ready at the service address and confirmed the finish time in chat.',
      createdAt: '2026-06-19T09:10:00.000Z',
      customerHref: '/customers/customer-1',
      customerLabel: 'Customer Hoa',
      id: 'partner-eval-123456',
      lastReviewedAt: '2026-06-20T01:00:00.000Z',
      lastReviewedBy: 'Operator Linh',
      lastReviewReason: 'Booking context requires verification',
      partnerHref: '/partners/partner-1',
      partnerLabel: 'Partner Minh',
      reportReasonLabel: 'Booking context requires verification',
      serviceLabel: 'Deep Tissue',
      statusLabel: 'Needs review',
    });
    expect(rows[0]).not.toHaveProperty('rating');
    expect(rows[0]).not.toHaveProperty('actions');
  });

  it('filters and sorts partner customer evaluations by submitted createdAt and text search', () => {
    const rows = [
      partnerCustomerReview({
        booking: { id: 'older-booking', openedAt: '2026-06-20T07:40:00.000Z' },
        comment: 'Customer was ready at the lobby.',
        createdAt: '2026-06-18T07:40:00.000Z',
        id: 'older-evaluation',
        providerProfile: { displayName: 'Partner Hoa' },
      }),
      partnerCustomerReview({
        booking: { id: 'newer-booking', openedAt: '2026-06-17T07:40:00.000Z' },
        comment: 'Customer changed room after arrival.',
        createdAt: '2026-06-19T07:40:00.000Z',
        customerProfile: { user: { fullName: 'Customer Linh' } },
        id: 'newer-evaluation',
        status: 'HIDDEN',
      }),
    ];

    expect(sortPartnerCustomerReviews(rows).map((row) => row.id)).toEqual([
      'newer-evaluation',
      'older-evaluation',
    ]);
    expect(sortPartnerCustomerReviews(rows, 'oldest').map((row) => row.id)).toEqual([
      'older-evaluation',
      'newer-evaluation',
    ]);
    expect(filterPartnerCustomerReviews(rows, filters({ q: 'linh' })).map((row) => row.id)).toEqual([
      'newer-evaluation',
    ]);
    expect(
      filterPartnerCustomerReviews(rows, filters({ review: 'restricted' })).map((row) => row.id),
    ).toEqual(['newer-evaluation']);
    expect(
      filterPartnerCustomerReviews(
        rows,
        filters({ dateFrom: '2026-06-18', dateRange: 'custom', dateTo: '2026-06-18' }),
      ).map((row) => row.id),
    ).toEqual(['older-evaluation']);
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
    expect(
      buildReviewListHref(
        filters({ dateRange: '7d', pageSize: 25, q: 'mai', review: 'held', sort: 'rating-desc' }),
        { page: 2 },
      ),
    ).toBe('/reviews?q=mai&pageSize=25&review=held&dateRange=7d&sort=rating-desc&page=2');
    expect(
      buildReviewExportHref(
        filters({ dateRange: '7d', page: 2, pageSize: 25, q: 'mai', review: 'held', sort: 'rating-desc' }),
      ),
    ).toBe('/reviews/export?q=mai&review=held&dateRange=7d&sort=rating-desc');
  });

  it('builds stable partner customer evaluation filters and list hrefs', () => {
    const filters = buildPartnerCustomerEvaluationFilters({
      dateRange: '7d',
      page: '2',
      pageSize: '25',
      q: 'customer',
      status: 'restricted',
      sort: 'rating-desc',
    });

    expect(filters).toMatchObject({
      dateRange: '7d',
      page: 2,
      pageSize: 25,
      q: 'customer',
      review: 'restricted',
      sort: 'newest',
    });
    expect(buildPartnerCustomerEvaluationListHref(filters, { page: 2 })).toBe(
      '/reviews/partner-customer-evaluations?q=customer&pageSize=25&dateRange=7d&page=2&status=restricted',
    );
    expect(buildPartnerCustomerEvaluationListHref(filters, { sort: 'oldest' })).toBe(
      '/reviews/partner-customer-evaluations?q=customer&pageSize=25&dateRange=7d&sort=oldest&status=restricted',
    );
  });

  it('builds bounded Admin API hrefs for customer review pages', () => {
    const hrefs = buildReviewDataHrefs(
      filters({ dateRange: '7d', page: 2, pageSize: 25, q: 'mai', review: 'held', sort: 'rating-desc' }),
    );
    const listUrl = new URL(hrefs.listHref, 'http://admin.local');
    const summaryUrl = new URL(hrefs.summaryHref, 'http://admin.local');

    expect(listUrl.pathname).toBe('/admin/reviews');
    expect(listUrl.searchParams.get('take')).toBe('25');
    expect(listUrl.searchParams.get('skip')).toBe('25');
    expect(listUrl.searchParams.get('q')).toBe('mai');
    expect(listUrl.searchParams.get('review')).toBe('held');
    expect(listUrl.searchParams.get('sort')).toBe('rating-desc');
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(summaryUrl.pathname).toBe('/admin/reviews/summary');
    expect(summaryUrl.searchParams.get('q')).toBe('mai');
    expect(summaryUrl.searchParams.has('review')).toBe(false);
    expect(reviewMatchingCount({ held: 7, published: 11, reported: 2, totalCount: 20 }, 'held')).toBe(7);
  });

  it('builds bounded Admin API hrefs for partner customer evaluations', () => {
    const hrefs = buildPartnerCustomerReviewDataHrefs(
      filters({
        dateRange: 'today',
        page: 3,
        pageSize: 10,
        q: 'late',
        review: 'needs-review',
        sort: 'oldest',
      }),
    );
    const listUrl = new URL(hrefs.listHref, 'http://admin.local');
    const summaryUrl = new URL(hrefs.summaryHref, 'http://admin.local');

    expect(listUrl.pathname).toBe('/admin/partner-customer-reviews');
    expect(listUrl.searchParams.get('take')).toBe('10');
    expect(listUrl.searchParams.get('skip')).toBe('20');
    expect(listUrl.searchParams.get('q')).toBe('late');
    expect(listUrl.searchParams.get('sort')).toBe('oldest');
    expect(listUrl.searchParams.get('status')).toBe('needs-review');
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(summaryUrl.pathname).toBe('/admin/partner-customer-reviews/summary');
    expect(summaryUrl.searchParams.has('status')).toBe(false);
  });

  it('maps Partner note states and filtered summary totals to operator language', () => {
    const summary = { needsReview: 2, restricted: 3, retained: 5, totalCount: 10 };

    expect(partnerCustomerReviewStatusLabel('PUBLISHED')).toBe('Retained');
    expect(partnerCustomerReviewStatusLabel('REPORTED')).toBe('Needs review');
    expect(partnerCustomerReviewStatusLabel('HIDDEN')).toBe('Restricted');
    expect(partnerCustomerReviewFilteredTotal(summary, 'needs-review')).toBe(2);
    expect(partnerCustomerReviewFilteredTotal(summary, 'restricted')).toBe(3);
    expect(partnerCustomerReviewFilteredTotal(summary, 'retained')).toBe(5);
    expect(partnerCustomerReviewFilteredTotal(summary, '')).toBe(10);
  });

  it('keeps filter, export, and tone copy stable', () => {
    const exported = buildReviewExportRows([review({ comment: 'Nice', status: 'HIDDEN' })]);

    expect(reviewFilterDescription('published')).toBe('reviews currently visible in the app.');
    expect(reviewEmptyState(filters({ review: 'held' }))).toEqual({
      message: 'No reviews are currently hidden from the customer app. Current date range: All dates.',
      title: 'No hidden reviews',
    });
    expect(exported[0]).toMatchObject({
      'App Visibility': 'Not visible',
      'Created At': 'No date',
      Status: 'Hidden',
    });
  });

  it('reports reversed custom dates without silently swapping them', () => {
    const reversed = buildReviewFilters({
      dateFrom: '2026-06-20',
      dateRange: 'custom',
      dateTo: '2026-06-10',
    });

    expect(reviewDateRangeError(reversed)).toBe('From date must be on or before To date.');
  });
});

function filters(
  input: Partial<ReturnType<typeof buildReviewFilters>> = {},
): ReturnType<typeof buildReviewFilters> {
  const base: ReturnType<typeof buildReviewFilters> = {
    page: 1,
    pageSize: 10,
    q: '',
    review: '',
    dateFrom: '',
    dateRange: 'all',
    dateTo: '',
    sort: 'newest',
  };
  return { ...base, ...input };
}

function review(input: Partial<AdminReview>): AdminReview {
  return {
    id: 'review-1',
    rating: 5,
    status: 'PUBLISHED',
    ...input,
  } as AdminReview;
}

function partnerCustomerReview(input: Partial<AdminPartnerCustomerReview>): AdminPartnerCustomerReview {
  return {
    id: 'partner-evaluation-1',
    createdAt: '2026-06-18T00:00:00.000Z',
    status: 'PUBLISHED',
    ...input,
  };
}
