import type { AdminReview } from '../../lib/admin-api';
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
  emptyReviewMessage,
  filterPartnerCustomerReviews,
  filterReviews,
  paginateReviewRows,
  reviewFilterDescription,
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
      review: 'follow-up',
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
      dateRange: 'today',
      dateTo: '',
      page: 1,
      pageSize: 10,
      q: '',
      review: '',
      sort: 'newest',
    });
  });

  it('defaults review API requests to today instead of loading the full history', () => {
    const hrefs = buildReviewDataHrefs(buildReviewFilters({}));
    const listUrl = new URL(hrefs.listHref, 'http://admin.local');
    const summaryUrl = new URL(hrefs.summaryHref, 'http://admin.local');

    expect(listUrl.pathname).toBe('/admin/reviews');
    expect(listUrl.searchParams.get('take')).toBe('10');
    expect(listUrl.searchParams.get('skip')).toBe('0');
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(summaryUrl.pathname).toBe('/admin/reviews/summary');
    expect(Number.isFinite(Date.parse(summaryUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(summaryUrl.searchParams.get('to') ?? ''))).toBe(true);
  });

  it('filters reviews by moderation queue, request date range, and search query', () => {
    const reviews = [
      review({
        booking: { openedAt: '2026-06-17T10:00:00.000Z' },
        id: 'reported',
        reportReason: 'Customer asked for follow-up',
        status: 'REPORTED',
      }),
      review({
        booking: { openedAt: '2026-06-18T10:00:00.000Z' },
        id: 'hidden',
        providerProfile: { displayName: 'Partner Linh' },
        status: 'HIDDEN',
      }),
      review({
        booking: { openedAt: '2026-06-19T10:00:00.000Z' },
        comment: 'Great service',
        id: 'published',
        status: 'PUBLISHED',
      }),
    ];

    expect(filterReviews(reviews, filters({ review: 'follow-up' })).map((item) => item.id)).toEqual([
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
      followUp: 1,
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
      reportReasonValue: 'Needs follow-up',
      reportReasonLabel: 'Reason: Needs follow-up',
      status: 'REPORTED',
      statusClassName: 'review-status-chip review-status-reported',
      statusLabel: 'Reported',
    });
    expect(rows[0]?.bookingRequestTimeLabel).toContain('16 Jun 2026');
    expect(rows[0]?.createdAt).toBe('2026-06-16T09:08:00.000Z');
    expect(rows[0]?.actions.map((action) => (action.kind === 'link' ? action.href : ''))).toEqual([
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=PUBLISHED',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=HIDDEN&reportReason=Held+by+admin',
      '/reviews?confirm=moderate&reviewId=review-row-123456&status=REPORTED&reportReason=Marked+for+follow-up',
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
        customerProfile: { id: 'customer-1', user: { fullName: 'Customer Hoa', phone: '+8492' } },
        id: 'partner-eval-123456',
        providerProfile: { id: 'partner-1', displayName: 'Partner Minh' },
      }),
    ]);

    expect(rows[0]).toMatchObject({
      bookingHref: '/bookings/booking-partner-eval-123456',
      bookingLabel: 'booking-',
      bookingRequestTimeLabel: expect.stringContaining('19 Jun 2026'),
      commentLabel: 'Customer was ready at the service address and confirmed the finish time in chat.',
      createdAt: '2026-06-19T09:10:00.000Z',
      customerHref: '/customers/customer-1',
      customerInitials: 'CH',
      customerLabel: 'Customer Hoa',
      customerPhone: '+8492',
      id: 'partner-eval-123456',
      partnerHref: '/partners/partner-1',
      partnerInitials: 'PM',
      partnerLabel: 'Partner Minh',
      serviceLabel: 'Deep Tissue',
    });
    expect(rows[0]).not.toHaveProperty('rating');
    expect(rows[0]).not.toHaveProperty('actions');
  });

  it('filters and sorts partner customer evaluations by request date and text search', () => {
    const rows = [
      partnerCustomerReview({
        booking: { id: 'older-booking', openedAt: '2026-06-18T07:40:00.000Z' },
        comment: 'Customer was ready at the lobby.',
        id: 'older-evaluation',
        providerProfile: { displayName: 'Partner Hoa' },
      }),
      partnerCustomerReview({
        booking: { id: 'newer-booking', openedAt: '2026-06-19T07:40:00.000Z' },
        comment: 'Customer changed room after arrival.',
        customerProfile: { user: { fullName: 'Customer Linh' } },
        id: 'newer-evaluation',
      }),
    ];

    expect(sortPartnerCustomerReviews(rows).map((row) => row.id)).toEqual(['newer-evaluation', 'older-evaluation']);
    expect(sortPartnerCustomerReviews(rows, 'oldest').map((row) => row.id)).toEqual([
      'older-evaluation',
      'newer-evaluation',
    ]);
    expect(filterPartnerCustomerReviews(rows, filters({ q: 'linh' })).map((row) => row.id)).toEqual([
      'newer-evaluation',
    ]);
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
      review: 'held',
      sort: 'rating-desc',
    });

    expect(filters).toMatchObject({
      dateRange: '7d',
      page: 2,
      pageSize: 25,
      q: 'customer',
      review: '',
      sort: 'newest',
    });
    expect(buildPartnerCustomerEvaluationListHref(filters, { page: 2 })).toBe(
      '/reviews/partner-customer-evaluations?q=customer&pageSize=25&dateRange=7d&page=2',
    );
    expect(buildPartnerCustomerEvaluationListHref(filters, { sort: 'oldest' })).toBe(
      '/reviews/partner-customer-evaluations?q=customer&pageSize=25&dateRange=7d&sort=oldest',
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
    expect(summaryUrl.searchParams.get('review')).toBe('held');
  });

  it('builds bounded Admin API hrefs for partner customer evaluations', () => {
    const hrefs = buildPartnerCustomerReviewDataHrefs(
      filters({ dateRange: 'today', page: 3, pageSize: 10, q: 'late', sort: 'oldest' }),
    );
    const listUrl = new URL(hrefs.listHref, 'http://admin.local');
    const summaryUrl = new URL(hrefs.summaryHref, 'http://admin.local');

    expect(listUrl.pathname).toBe('/admin/partner-customer-reviews');
    expect(listUrl.searchParams.get('take')).toBe('10');
    expect(listUrl.searchParams.get('skip')).toBe('20');
    expect(listUrl.searchParams.get('q')).toBe('late');
    expect(listUrl.searchParams.get('sort')).toBe('oldest');
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(listUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(summaryUrl.pathname).toBe('/admin/partner-customer-reviews/summary');
  });

  it('keeps filter, export, and tone copy stable', () => {
    const exported = buildReviewExportRows([review({ comment: 'Nice', status: 'HIDDEN' })]);

    expect(reviewFilterDescription('published')).toBe('reviews currently visible in the app.');
    expect(emptyReviewMessage('held')).toContain('held from app visibility');
    expect(exported[0]).toMatchObject({
      'App Visibility': 'Not visible',
      'Created At': 'No date',
      Status: 'Held',
    });
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

function partnerCustomerReview(input: Record<string, unknown>) {
  return {
    id: 'partner-evaluation-1',
    status: 'INTERNAL',
    ...input,
  };
}
