import {
  DEFAULT_REVIEW_PAGE_SIZE,
  type ReviewFilters,
  type ReviewPagination,
} from './review-page-model';
import { ReviewsTableSection, type ReviewTableRow } from './reviews-table-section';

describe('ReviewsTableSection', () => {
  it('renders the Vuexy customer review board with controls, rating, status, and action links', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      emptyMessage: 'No customer reviews loaded.',
      filters: filters(),
      pagination: pagination([buildRow()]),
      rows: [buildRow()],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Customer Review');
    expect(rendered).toContain('Search Review');
    expect(rendered).toContain('Export');
    expect(rendered).toContain('Massage Partner');
    expect(rendered).toContain('Visible review');
    expect(rendered).toContain('Customer One');
    expect(rendered).toContain('+84900000000');
    expect(rendered).toContain('The service arrived late but recovered well.');
    expect(rendered).toContain('Aromatherapy');
    expect(rendered).toContain('Published');
    expect(rendered).toContain('Visible in app');
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
    expect(hrefsIn(section)).toContain('data:text/csv;charset=utf-8,Review');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-form-search vuexy-review-search',
        'admin-form-select vuexy-review-select',
        'admin-form-control-button vuexy-review-button',
        'admin-form-control-link vuexy-review-export',
      ]),
    );
    expect(dropdownPropsIn(section)).toEqual([
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
        label: 'Review actions for review',
      }),
    ]);
  });

  it('renders the empty state when there are no review rows', () => {
    const section = ReviewsTableSection({
      csvHref: 'data:text/csv;charset=utf-8,Review',
      emptyMessage: 'No customer reviews currently match this queue.',
      filters: filters({ review: 'held' }),
      pagination: pagination([]),
      rows: [],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No customer reviews currently match this queue.');
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
    bookingLabel: 'booking',
    commentLabel: 'The service arrived late but recovered well.',
    createdAtLabel: '16:08 23/02/2026',
    customerInitials: 'CO',
    customerLabel: 'Customer One',
    customerPhone: '+84900000000',
    id: 'review-1',
    partnerHint: 'Visible review',
    partnerInitials: 'MP',
    partnerLabel: 'Massage Partner',
    rating: 5,
    ratingLabel: '5/5',
    reportReasonLabel: '',
    serviceLabel: 'Aromatherapy',
    shortIdLabel: 'review',
    statusClassName: 'review-status-chip review-status-published',
    statusLabel: 'Published',
    statusMeaning: 'Visible in app',
  };
}

function filters(input: Partial<ReviewFilters> = {}): ReviewFilters {
  return {
    page: 1,
    pageSize: DEFAULT_REVIEW_PAGE_SIZE,
    q: '',
    review: '',
    ...input,
  };
}

function pagination(rows: ReviewTableRow[]): ReviewPagination<ReviewTableRow> {
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

function dropdownPropsIn(value: unknown): Record<string, unknown>[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(dropdownPropsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  if (isReviewActionDropdown(record?.type)) {
    return props ? [props] : [];
  }
  return dropdownPropsIn(props?.children);
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' && !isReviewActionDropdown(record.type)
    ? resolveElement(record.type(props))
    : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isReviewActionDropdown(value: unknown) {
  return typeof value === 'function' && value.name === 'ReviewActionDropdown';
}
