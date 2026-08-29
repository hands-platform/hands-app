import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

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

  it('keeps review filter panels on the shared filter surface without booking-monitor filter classes', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');

    expect(source).toContain('AdminFilterPanel');
    expect(source).toContain('className="vuexy-review-filter-card admin-mb-16"');
    expect(source).not.toContain('className="booking-monitor-filter-panel vuexy-review-filter-card admin-mb-16"');
  });

  it('keeps review filter actions grouped and prevents compact desktop label wrapping', () => {
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

    expect(source).toContain('AdminFormActionRow');
    expect(source).toContain('className="vuexy-review-filter-actions" wide={false}');
    expect(css).toContain('.reviews-page .vuexy-review-filter-actions > :is(a, button)');
    expect(css).toContain('white-space: nowrap');
    expect(css).toContain('@media (max-width: 1399px)');
    expect(css).toContain('grid-column: 1 / -1');
  });

  it('keeps the five review columns within the page instead of forcing a 1320px table', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');
    const reviewCss = css.slice(css.indexOf('.reviews-page .vuexy-review-filter-card'), css.indexOf('.review-edit-drawer'));

    expect(reviewCss).toContain('display: table-cell');
    expect(reviewCss).toContain('flex: 1 1 auto');
    expect(reviewCss).toContain('min-width: 0');
    expect(reviewCss).toContain('table-layout: fixed');
    expect(reviewCss).not.toContain('min-width: 1320px');
    expect(reviewCss).not.toContain('nth-child(6)');
  });

  it('renders the Vuexy customer review board with controls, rating, status, and action links', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      filters: filters(),
      matchingCount: 1,
      pagination: pagination([buildRow()]),
      rows: [buildRow()],
      summary: summary({ published: 1, totalCount: 1 }),
    });

    const rendered = normalizedText(section);
    const source = readFileSync(new URL('./reviews-table-section.tsx', import.meta.url), 'utf8');

    expect(rendered).toContain('Review controls');
    expect(source).toContain('placeholder="Search name, booking, review ID"');
    expect(source).toContain('label="Search reviews"');
    expect(rendered).toContain('All 1 Visible 1 Needs review 0 Hidden 0');
    expect(rendered).toContain('Visible');
    expect(rendered).toContain('Needs review');
    expect(rendered).toContain('Hidden');
    expect(rendered).not.toContain('Follow-up');
    expect(rendered).toContain('All dates');
    expect(rendered).toContain('Today');
    expect(rendered).toContain('Previous day');
    expect(rendered).toContain('Last 7 days');
    expect(rendered).toContain('Last month');
    expect(rendered).toContain('Custom dates');
    expect(rendered).toContain('Newest');
    expect(rendered).toContain('Oldest');
    expect(rendered).toContain('Highest rating');
    expect(rendered).toContain('Lowest rating');
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Review queue');
    expect(rendered).toContain('Submitted');
    expect(rendered).toContain('booking');
    expect(rendered).toContain('19 Jun 2026, 14:40');
    expect(rendered).toContain('23 Feb 2026, 16:08 Review review');
    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Customer One');
    expect(rendered).not.toContain('+84900000000');
    expect(rendered).toContain('The service arrived late but recovered well.');
    expect(rendered).toContain('Aromatherapy');
    expect(rendered).toContain('Visible');
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
        '/reviews?review=reported',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-form-search admin-directory-filter-search',
        'admin-form-select admin-form-control-labeled admin-directory-filter-select',
        'admin-form-control-button button button-primary admin-directory-filter-button',
        'admin-form-control-link button button-secondary admin-directory-filter-export',
        'card admin-filter-panel vuexy-review-filter-card admin-mb-16 admin-section',
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card admin-section',
        'admin-person-avatar-shell',
        'vuexy-booking-id-line vuexy-review-booking-line',
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
            href: '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN',
            label: 'Hide',
          }),
        ]),
        editReview: expect.objectContaining({
          canEdit: false,
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
      filters: filters({
        dateFrom: '2026-06-10',
        dateRange: 'custom',
        dateTo: '2026-06-17',
        q: 'mai',
        sort: 'rating-desc',
      }),
      matchingCount: 4,
      pagination: pagination([buildRow()]),
      rows: [buildRow()],
      summary: summary({ published: 4, totalCount: 4 }),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Custom: 2026-06-10 - 2026-06-17');
    expect(rendered).toContain('Sort: Highest rating');
    expect(rendered).toContain('Search: mai');
    expect(rendered).toContain('Apply dates');
    expect(hrefsIn(section)).toContain(
      '/reviews?q=mai&dateRange=custom&dateFrom=2026-06-10&dateTo=2026-06-17&sort=rating-desc',
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-directory-filter-form booking-custom-date-grid vuexy-review-custom-date-grid',
        'admin-form-control-button button button-primary booking-date-apply-button',
      ]),
    );
  });

  it('keeps the all-dates review filter visible and active after clearing date filters', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      filters: filters({ dateRange: 'all' }),
      matchingCount: 1,
      pagination: pagination([]),
      rows: [],
      summary: summary({ totalCount: 1 }),
    });
    const markup = renderToStaticMarkup(section);

    expect(normalizedText(section)).toContain('All dates');
    expect(markup).toContain('<option value="all" selected="">All dates</option>');
    expect(normalizedText(section)).not.toContain('Clear filters');
    expect(normalizedText(section)).not.toContain('View all reviews');
  });

  it('renders the empty state when there are no review rows', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      filters: filters({ review: 'held' }),
      matchingCount: 3,
      pagination: pagination([]),
      rows: [],
      summary: summary({ held: 3, totalCount: 3 }),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No reviews are currently hidden from the customer app. Current date range: All dates.');
    expect(rendered).toContain('3 matching');
    expect(rendered.match(/Clear filters/g)).toHaveLength(1);
    expect(rendered).not.toContain('View all reviews');
    expect(classNamesIn(section)).toContain(
      'admin-form-control-link button button-secondary admin-directory-filter-button is-ghost',
    );
    expect(rendered).toContain('No hidden reviews');
    expect(rendered).not.toContain('Showing 0 to 0 of 0 entries');
    expect(rendered).not.toContain('aria-label="Customer review pages"');
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
        description: 'Hide this review so it no longer appears in the app.',
        disabled: false,
        href: '/reviews?confirm=moderate&reviewId=review-1&status=HIDDEN',
        kind: 'link',
        label: 'Hide',
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
    customerLabel: 'Customer One',
    isAdminCreated: false,
    id: 'review-1',
    partnerHref: '/partners/partner-1',
    partnerInitials: 'MP',
    partnerLabel: 'Massage Partner',
    rating: 5,
    ratingLabel: '5/5',
    reportReasonLabel: '',
    reportReasonValue: '',
    reviewIdLabel: 'review',
    serviceLabel: 'Aromatherapy',
    showBookingRequestTime: true,
    status: 'PUBLISHED',
    statusClassName: 'review-status-chip review-status-published',
    statusLabel: 'Visible',
  };
}

function summary(input: Partial<{ averageRating: number; held: number; published: number; reported: number; totalCount: number }> = {}) {
  return {
    averageRating: 5,
    held: 0,
    published: 0,
    reported: 0,
    totalCount: 0,
    ...input,
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
