import { readFileSync } from 'node:fs';

import { DEFAULT_REVIEW_PAGE_SIZE, type ReviewFilters, type ReviewPagination } from './review-page-model';
import {
  PartnerCustomerEvaluationsSection,
  type PartnerCustomerEvaluationTableRow,
} from './partner-customer-evaluations-section';

describe('PartnerCustomerEvaluationsSection', () => {
  it('uses the shared StatusBadge atom for active filter labels', () => {
    const source = readFileSync(
      new URL('./partner-customer-evaluations-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-warn" key={label}>');
  });

  it('uses the shared table pagination footer while preserving review classes', () => {
    const source = readFileSync(
      new URL('./partner-customer-evaluations-section.tsx', import.meta.url),
      'utf8',
    );

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

  it('uses the shared date time atom for evaluation submitted timestamps', () => {
    const source = readFileSync(
      new URL('./partner-customer-evaluations-section.tsx', import.meta.url),
      'utf8',
    );
    const modelSource = readFileSync(new URL('./review-page-model.ts', import.meta.url), 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdAtLabel: string;');
    expect(source).not.toContain('Evaluation submitted {row.createdAtLabel}');
    expect(modelSource).not.toContain('createdAtLabel: formatReviewDate(review.createdAt)');
  });

  it('uses the shared Vuexy text link atom for evaluation booking links', () => {
    const source = readFileSync(
      new URL('./partner-customer-evaluations-section.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders partner-written customer evaluations as a text-only review board', () => {
    const section = PartnerCustomerEvaluationsSection({
      filters: filters(),
      pagination: pagination([buildRow()]),
      rows: [buildRow()],
      totalEvaluationCount: 1,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner customer evaluation filters');
    expect(rendered).toContain('Partner customer evaluations');
    expect(rendered).toContain('Text-only notes Partners write about customers after a booking.');
    expect(rendered).toContain('Request Time');
    expect(rendered).toContain('Partner');
    expect(rendered).toContain('Customer');
    expect(rendered).toContain('Customer evaluation');
    expect(rendered).toContain('Customer arrived prepared and confirmed closeout in chat.');
    expect(rendered).toContain('This page is for admin review only.');
    expect(rendered).not.toContain('Rating');
    expect(rendered).not.toContain('Actions');
    expect(rendered).not.toContain('Visibility');
    expect(rendered).not.toContain('Publish');
    expect(rendered).not.toContain('Hide');
    expect(rendered).not.toContain('Hold');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings/booking-1',
        '/customers/customer-1',
        '/partners/partner-1',
        '/reviews/partner-customer-evaluations?dateRange=today',
        '/reviews/partner-customer-evaluations?dateRange=yesterday',
        '/reviews/partner-customer-evaluations?dateRange=7d',
        '/reviews/partner-customer-evaluations?dateRange=30d',
        '/reviews/partner-customer-evaluations?dateRange=custom',
        '/reviews/partner-customer-evaluations?sort=oldest',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel vuexy-review-filter-card admin-mb-16 admin-section',
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-review-card admin-section',
        'table vuexy-data-table vuexy-booking-table vuexy-review-table vuexy-partner-evaluation-table',
      ]),
    );
  });

  it('renders custom date apply controls through the shared Vuexy button atom', () => {
    const section = PartnerCustomerEvaluationsSection({
      filters: filters({
        dateFrom: '2026-06-10',
        dateRange: 'custom',
        dateTo: '2026-06-17',
      }),
      pagination: pagination([]),
      rows: [],
      totalEvaluationCount: 0,
    });

    expect(normalizedText(section)).toContain('Apply dates');
    expect(classNamesIn(section)).toContain(
      'admin-form-control-button button button-primary booking-date-apply-button',
    );
  });
});

function buildRow(): PartnerCustomerEvaluationTableRow {
  return {
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'booking',
    bookingRequestTimeLabel: '19 Jun 2026, 14:40',
    commentLabel: 'Customer arrived prepared and confirmed closeout in chat.',
    createdAt: '2026-02-23T09:12:00.000Z',
    customerAvatarStatus: 'offline',
    customerHref: '/customers/customer-1',
    customerInitials: 'CO',
    customerLabel: 'Customer One',
    customerPhone: '+84900000000',
    id: 'partner-evaluation-1',
    partnerAvatarStatus: 'offline',
    partnerHref: '/partners/partner-1',
    partnerHint: 'Text-only customer evaluation',
    partnerInitials: 'MP',
    partnerLabel: 'Massage Partner',
    serviceLabel: 'Aromatherapy',
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

function pagination<T extends PartnerCustomerEvaluationTableRow>(rows: T[]): ReviewPagination<T> {
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

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
