import { readFileSync } from 'node:fs';

import { DEFAULT_REVIEW_PAGE_SIZE, type ReviewFilters, type ReviewPagination } from './review-page-model';
import { ReviewsTableSection, type ReviewTableRow } from './reviews-table-section';

describe('ReviewsTableSection', () => {
  const reviewRowActionsSource = readFileSync(new URL('./review-row-actions.tsx', import.meta.url), 'utf8');

  it('uses the shared StatusBadge atom for active filter labels', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).toContain('AdminFilterSummary');
    expect(source).not.toContain('<div className="vuexy-review-filter-summary">');
    expect(source).not.toContain('<span className="pill pill-warn" key={label}>');
  });

  it('uses the shared StatusBadge atom for review row statuses', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('pillClass={row.statusClassName}');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('<span className={row.statusClassName}>{row.statusLabel}</span>');
  });

  it('uses the shared Vuexy text link atom for review booking links', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('uses the shared table pagination footer while preserving review classes', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('className="vuexy-review-footer"');
    expect(source).toContain('paginationClassName="vuexy-review-pagination"');
    expect(source).toContain('pageLinkClassName="vuexy-review-page-link"');
    expect(source).not.toContain('<AdminTableFooter');
    expect(source).not.toContain(
      'booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card',
    );
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('uses the shared date time atom for review submitted timestamps', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');
    const modelSource = readFileSync(new URL('./review-page-model.ts', import.meta.url), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdAtLabel: string;');
    expect(source).not.toContain('Review submitted {row.createdAtLabel}');
    expect(modelSource).not.toContain('createdAtLabel: formatReviewDate(review.createdAt)');
  });

  it('uses shared Vuexy card atoms for review editor drawer cards', () => {
    expect(reviewRowActionsSource).toContain('AdminCard');
    expect(reviewRowActionsSource).toContain('admin-form-control-fluid');
    expect(reviewRowActionsSource).toContain('admin-grid-span-2');
    expect(reviewRowActionsSource).not.toContain('review-edit-form-field');
    expect(reviewRowActionsSource).toContain('labelVisibility="visible"');
    expect(reviewRowActionsSource).not.toContain('className="calendar-field');
    expect(reviewRowActionsSource).not.toContain('<section className="review-edit-original-card"');
    expect(reviewRowActionsSource).not.toContain('<section className="review-edit-form-card"');
  });

  it('renders the Vuexy customer review board with controls, rating, status, and action links', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      emptyMessage: 'No customer reviews loaded.',
      filters: filters(),
      pagination: pagination([buildRow()]),
      rows: [buildRow()],
      totalReviewCount: 1,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Review operation filters');
    expect(rendered).toContain('Search Review');
    expect(rendered).toContain('Published');
    expect(rendered).toContain('Held');
    expect(rendered).toContain('Follow-up');
    expect(rendered).toContain('Reported');
    expect(rendered).toContain('Today');
    expect(rendered).toContain('Previous day');
    expect(rendered).toContain('Last 7 days');
    expect(rendered).toContain('Last month');
    expect(rendered).toContain('Custom dates');
    expect(rendered).toContain('Newest request');
    expect(rendered).toContain('Oldest request');
    expect(rendered).toContain('Highest rating');
    expect(rendered).toContain('Lowest rating');
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Customer review list');
    expect(rendered).toContain('Request Time');
    expect(rendered).toContain('booking');
    expect(rendered).toContain('19 Jun 2026, 14:40');
    expect(rendered).toContain('Review submitted 23 Feb 2026, 16:08');
    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Visible review');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('The service arrived late but recovered well.');
    expect(rendered).toContain('Aromatherapy');
    expect(rendered).toContain('Published');
    expect(rendered).toContain('App visible');
    expect(rendered).not.toContain('Visible in app');
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
    expect(rendered).not.toContain('Partner customer evaluations');
    expect(rendered).not.toContain('Customer evaluation');
    expect(hrefsIn(section)).toContain('data:text/csv;charset=utf-8,Review');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings/booking-1',
        '/customers/customer-1',
        '/partners/partner-1',
        '/reviews',
        '/reviews?review=published',
        '/reviews?review=held',
        '/reviews?review=follow-up',
        '/reviews?review=reported',
        '/reviews?dateRange=today',
        '/reviews?dateRange=yesterday',
        '/reviews?dateRange=7d',
        '/reviews?dateRange=30d',
        '/reviews?dateRange=custom',
        '/reviews?sort=oldest',
        '/reviews?sort=rating-desc',
        '/reviews?sort=rating-asc',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-form-search admin-directory-filter-search',
        'admin-form-select admin-directory-filter-select',
        'admin-form-control-button button button-primary admin-directory-filter-button',
        'admin-form-control-link button button-secondary admin-directory-filter-export',
        'booking-date-filter-buttons vuexy-review-sort-buttons',
        'card admin-filter-panel booking-monitor-filter-panel vuexy-review-filter-card admin-mb-16 admin-section',
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card admin-section',
        'admin-person-avatar-shell',
        'admin-avatar-status-dot is-offline',
        'vuexy-booking-id-line',
        'vuexy-booking-person',
        'vuexy-booking-avatar is-partner',
        'vuexy-booking-avatar',
        'vuexy-review-visibility-cell',
      ]),
    );
    expect(rowActionPropsIn(section)).toEqual([
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            href: '/reviews?confirm=moderate&reviewId=review-1&status=PUBLISHED',
            label: 'Publish',
          }),
          expect.objectContaining({
            href: '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN&reportReason=Held+by+admin',
            label: 'Hold',
          }),
        ]),
        editReview: expect.objectContaining({
          commentLabel: 'The service arrived late but recovered well.',
          commentValue: 'The service arrived late but recovered well.',
          rating: 5,
          ratingLabel: '5/5',
          reportReasonValue: '',
          reviewId: 'review-1',
          status: 'PUBLISHED',
        }),
        label: 'Review actions for review',
      }),
    ]);
    expect(Object.keys(rowActionPropsIn(section)[0]?.editReview as Record<string, unknown>)).not.toEqual(
      expect.arrayContaining(['bookingHref', 'bookingLabel', 'customerLabel', 'partnerLabel', 'requestTimeLabel']),
    );
  });

  it('renders booking-style custom date controls and active filter summary', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      emptyMessage: 'No customer reviews loaded.',
      filters: filters({
        dateFrom: '2026-06-10',
        dateRange: 'custom',
        dateTo: '2026-06-17',
        q: 'mai',
        sort: 'rating-desc',
      }),
      pagination: pagination([buildRow()]),
      rows: [buildRow()],
      totalReviewCount: 4,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Custom: 2026-06-10 - 2026-06-17');
    expect(rendered).toContain('Sort: Highest rating');
    expect(rendered).toContain('Search: mai');
    expect(rendered).toContain('Apply dates');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/reviews?q=mai&dateRange=custom&dateFrom=2026-06-10&dateTo=2026-06-17',
        '/reviews?q=mai&dateRange=custom&dateFrom=2026-06-10&dateTo=2026-06-17&sort=oldest',
        '/reviews?q=mai&dateRange=custom&dateFrom=2026-06-10&dateTo=2026-06-17&sort=rating-asc',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'booking-custom-date-grid vuexy-review-custom-date-grid',
        'booking-date-filter-buttons vuexy-review-sort-buttons',
        'admin-form-control-button button button-primary booking-date-apply-button',
      ]),
    );
  });

  it('renders the empty state when there are no review rows', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      emptyMessage: 'No customer reviews currently match this queue.',
      filters: filters({ review: 'held' }),
      pagination: pagination([]),
      rows: [],
      totalReviewCount: 3,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No customer reviews currently match this queue.');
    expect(rendered).toContain('Showing 0 of 3');
    expect(rendered).toContain('reviews held from app visibility but retained for evidence.');
    expect(rendered).toContain('Clear filters');
    expect(classNamesIn(section)).toContain(
      'admin-form-control-link button button-secondary admin-directory-filter-button is-ghost',
    );
    expect(rendered).toContain('Showing 0 to 0 of 0 entries');
  });
});

function buildRow(): ReviewTableRow {
  return {
    actionLabel: 'Review actions for review',
    actions: [
      {
        description: 'Publish this review so it can appear in the app.',
        disabled: false,
        href: '/reviews?confirm=moderate&reviewId=review-1&status=PUBLISHED',
        kind: 'link',
        label: 'Publish',
        tone: 'success',
      },
      {
        description: 'Hold this review so it no longer appears in the app.',
        disabled: false,
        href: '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN&reportReason=Held+by+admin',
        kind: 'link',
        label: 'Hold',
        tone: 'warning',
      },
    ],
    appVisibilityLabel: 'App visible',
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'booking',
    bookingRequestTimeLabel: '19 Jun 2026, 14:40',
    commentLabel: 'The service arrived late but recovered well.',
    commentValue: 'The service arrived late but recovered well.',
    createdAt: '2026-02-23T09:08:00.000Z',
    customerHref: '/customers/customer-1',
    customerInitials: 'CO',
    customerAvatarStatus: 'offline',
    customerLabel: 'Customer One',
    customerPhone: '+84900000000',
    id: 'review-1',
    partnerAvatarStatus: 'offline',
    partnerHref: '/partners/partner-1',
    partnerHint: 'Visible review',
    partnerInitials: 'MP',
    partnerLabel: 'Massage Partner',
    rating: 5,
    ratingLabel: '5/5',
    reportReasonValue: '',
    reportReasonLabel: '',
    serviceLabel: 'Aromatherapy',
    status: 'PUBLISHED',
    statusClassName: 'review-status-chip review-status-published',
    statusLabel: 'Published',
  };
}

function filters(input: Partial<ReviewFilters> = {}): ReviewFilters {
  const base: ReviewFilters = {
    page: 1,
    pageSize: DEFAULT_REVIEW_PAGE_SIZE,
    q: '',
    review: '',
    dateFrom: '',
    dateRange: 'all',
    dateTo: '',
    sort: 'newest',
  };
  return { ...base, ...input };
}

function pagination<T extends ReviewTableRow>(rows: T[]): ReviewPagination<T> {
  return {
    from: rows.length ? 1 : 0,
    page: 1,
    pageSize: DEFAULT_REVIEW_PAGE_SIZE,
    rows,
    to: rows.length,
    totalPages: 1,
    totalRows: rows.length,
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function normalizedText(value: unknown) {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
}

function rowActionPropsIn(value: unknown): Record<string, unknown>[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(rowActionPropsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  if (isReviewRowActions(record?.type)) {
    return props ? [props] : [];
  }
  return rowActionPropsIn(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' && !isReviewRowActions(record.type)
    ? resolveElement(record.type(props))
    : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isReviewRowActions(value: unknown) {
  return typeof value === 'function' && value.name === 'ReviewRowActions';
}
