import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { DEFAULT_REVIEW_PAGE_SIZE, type ReviewFilters, type ReviewPagination } from './review-page-model';
import { ClientActionDropdownSurface } from '../../components/client-action-dropdown';
import {
  PartnerCustomerEvaluationsSection,
  type PartnerCustomerEvaluationTableRow,
} from './partner-customer-evaluations-section';

vi.mock('next/navigation', () => ({
  usePathname: () => '/reviews/partner-customer-evaluations',
}));

describe('PartnerCustomerEvaluationsSection', () => {
  it('uses the shared filter, details, table, and pagination atoms', () => {
    const source = readFileSync(
      new URL('./partner-customer-evaluations-section.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('ActionMenu');
    expect(source).toContain('AdminFilterPanel');
    expect(source).toContain('AdminDetails');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('DateTimeText');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain("open={filters.dateRange === 'custom' || undefined}");
    expect(source).not.toContain('customerPhone');
    expect(source).not.toContain('customerAvatarStatus');
    expect(source).not.toContain('Text-only customer evaluation');
  });

  it('renders immutable Partner notes with submitted date, state, audit metadata, and actions', () => {
    const section = PartnerCustomerEvaluationsSection({
      dateError: '',
      filters: filters(),
      pagination: pagination([buildRow()]),
      returnTo: '/reviews/partner-customer-evaluations',
      rows: [buildRow()],
      summary: summary(),
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner note search');
    expect(rendered).toContain('Partner notes');
    expect(rendered).toContain('Submitted');
    expect(rendered).toContain('Partner note');
    expect(rendered).toContain('Customer');
    expect(rendered).toContain('Context');
    expect(rendered).toContain('Note state');
    expect(rendered).toContain('Customer arrived prepared and confirmed closeout in chat.');
    expect(rendered).toContain('Needs review');
    expect(rendered).toContain('Booking context requires verification');
    expect(rendered).toContain('Operator Linh');
    expect(rendered).toContain('View full note and context');
    expect(rendered).toContain('Change note state');
    expect(rendered).toContain('View moderation history');
    expect(rendered).toContain('Retain');
    expect(rendered).toContain('Restrict');
    expect(rendered).toContain('Newest first');
    expect(rendered).toContain('Oldest first');
    expect(rendered).not.toContain('Most recently submitted');
    expect(rendered).not.toContain('Oldest submitted');
    expect(rendered).not.toContain('Rating');
    expect(rendered).not.toContain('+84900000000');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings/booking-1',
        '/customers/customer-1',
        '/partners/partner-1',
        '/reviews/partner-customer-evaluations',
        '/reviews/partner-customer-evaluations?dateRange=today',
        '/reviews/partner-customer-evaluations?dateRange=yesterday',
        '/reviews/partner-customer-evaluations?dateRange=7d',
        '/reviews/partner-customer-evaluations?dateRange=30d',
        '/reviews/partner-customer-evaluations?status=retained',
        '/reviews/partner-customer-evaluations?status=needs-review',
        '/reviews/partner-customer-evaluations?status=restricted',
        '/reviews/partner-customer-evaluations?sort=oldest',
      ]),
    );
    expect(renderToStaticMarkup(section)).toContain('partner-notes-table');
    expect(renderToStaticMarkup(section)).toContain('tabindex="-1"');
    expect(renderToStaticMarkup(section)).toContain('<h3>Full immutable note</h3>');
    expect(renderToStaticMarkup(section)).toContain('<h3>Context</h3>');
    expect(renderToStaticMarkup(section)).toContain('<h3>Moderation</h3>');
    expect(renderToStaticMarkup(section)).not.toContain('<h4>Full immutable note</h4>');
  });

  it('renders one managed button action trigger for each exact Partner note row', () => {
    const firstRow = buildRow();
    const secondRow = { ...buildRow(), id: 'partner-evaluation-2' };
    const markup = renderToStaticMarkup(
      PartnerCustomerEvaluationsSection({
        dateError: '',
        filters: filters(),
        pagination: pagination([firstRow, secondRow]),
        returnTo: '/reviews/partner-customer-evaluations',
        rows: [firstRow, secondRow],
        summary: summary({ totalCount: 2 }),
      }),
    );

    expect(markup).toContain('aria-label="Actions for Partner note partner-evaluation-1"');
    expect(markup).toContain('aria-label="Actions for Partner note partner-evaluation-2"');
    expect(markup.match(/aria-haspopup="menu"/g)).toHaveLength(2);
    expect(markup).not.toContain('<summary aria-label="Actions for Partner note');
  });

  it('renders visible custom date labels and rejects reversed dates inline', () => {
    const section = PartnerCustomerEvaluationsSection({
      dateError: 'From date must be on or before To date.',
      filters: filters({
        dateFrom: '2026-06-20',
        dateRange: 'custom',
        dateTo: '2026-06-10',
      }),
      pagination: pagination([]),
      returnTo: '/reviews/partner-customer-evaluations?dateRange=custom',
      rows: [],
      summary: summary({ totalCount: 0 }),
    });
    const rendered = normalizedText(section);
    const markup = renderToStaticMarkup(section);

    expect(rendered).toContain('From');
    expect(rendered).toContain('To');
    expect(markup).toContain('<span class="admin-form-label">From</span>');
    expect(markup).toContain('<span class="admin-form-label">To</span>');
    expect(markup).not.toContain('<span class="sr-only">From</span>');
    expect(markup).not.toContain('<span class="sr-only">To</span>');
    expect(rendered).toContain('Apply dates');
    expect(rendered).toContain('Submitted date is invalid');
    expect(rendered).toContain('From date must be on or before To date.');
    expect(rendered).not.toContain('Partner notes The original Partner note is immutable.');
    expect(classNamesIn(section)).toContain(
      'admin-form-control-button button button-primary booking-date-apply-button',
    );
  });

  it('keeps All dates explicit on the base route', () => {
    const section = PartnerCustomerEvaluationsSection({
      dateError: '',
      filters: filters({ dateRange: 'all' }),
      pagination: pagination([buildRow()]),
      returnTo: '/reviews/partner-customer-evaluations',
      rows: [buildRow()],
      summary: summary(),
    });
    const markup = renderToStaticMarkup(section);

    expect(normalizedText(section)).toContain('All dates');
    expect(markup).toContain(
      'aria-current="page" class="booking-date-filter-button is-active" href="/reviews/partner-customer-evaluations"',
    );
  });

  it('distinguishes empty scope from filtered no-match results', () => {
    const empty = PartnerCustomerEvaluationsSection({
      dateError: '',
      filters: filters(),
      pagination: pagination([]),
      returnTo: '/reviews/partner-customer-evaluations',
      rows: [],
      summary: summary({ totalCount: 0 }),
    });
    const noMatch = PartnerCustomerEvaluationsSection({
      dateError: '',
      filters: filters({ q: 'guaranteed-no-match' }),
      pagination: pagination([]),
      returnTo: '/reviews/partner-customer-evaluations?q=guaranteed-no-match',
      rows: [],
      summary: summary(),
    });

    expect(normalizedText(empty)).toContain('No Partner notes were submitted in this period.');
    expect(normalizedText(noMatch)).toContain('No Partner notes match the current filters.');
    expect(normalizedText(noMatch)).toContain('Clear filters');
  });

  it('uses a page-specific responsive table without a forced 1320px width', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');
    const tableCss = css.slice(
      css.indexOf('.partner-notes-table-scroll'),
      css.indexOf('.partner-notes-table-scroll') + 4_500,
    );

    expect(tableCss).toContain('overflow: visible');
    expect(tableCss).toContain('table-layout: fixed');
    expect(tableCss).toContain('min-width: 220px');
    expect(css).toContain(
      '.partner-notes-page :is(.vuexy-review-filter-card, .partner-notes-table-panel)',
    );
    expect(tableCss).toContain('@container partner-notes (max-width: 900px)');
    expect(tableCss).toContain('.partner-notes-table-scroll .partner-notes-table tbody td[data-label]');
    expect(tableCss).toContain('height: auto');
    expect(tableCss).toContain('width: auto !important');
    expect(tableCss).not.toContain('min-width: 1320px');
    expect(css).toMatch(
      /@media \(min-width: 1025px\)\s*{\s*\.admin-page-header:has\(\+ \.partner-notes-page\)\s*{[^}]*margin-bottom:\s*12px;[^}]*padding:\s*10px 20px;/s,
    );
    expect(css).toMatch(
      /\.admin-page-header:has\(\+ \.partner-notes-page\) \.admin-page-header-copy > p\s*{[^}]*margin-bottom:\s*0;/s,
    );
  });

  it('keeps Partner note moderation menu items at least 44px tall without changing global actions', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

    expect(css).toMatch(
      /\.partner-note-action-menu \.admin-action-item\s*{[^}]*min-height:\s*44px;/s,
    );
    expect(css).toContain('.admin-action-menu.partner-note-action-menu');
    expect(css).toContain('min-width: 220px');
  });

  it('keeps the desktop Partner note command bar scoped, single-line, and 44px tall', () => {
    const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

    expect(css).toMatch(
      /\.partner-notes-page \.partner-note-date-group,\s*\.partner-notes-page \.partner-note-sort-group\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\);/s,
    );
    expect(css).toMatch(
      /\.partner-notes-page\s*:is\(\.vuexy-review-date-buttons, \.vuexy-review-sort-buttons\)\s*{[^}]*flex-wrap:\s*nowrap;/s,
    );
    expect(css).toMatch(
      /\.partner-notes-page[\s\S]*?:is\(\.vuexy-review-date-buttons, \.vuexy-review-sort-buttons\)[\s\S]*?\.booking-date-filter-button\s*{[^}]*min-height:\s*44px;[^}]*white-space:\s*nowrap;/,
    );
    expect(css).toMatch(
      /\.partner-note-custom-dates\[open\]\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\);/s,
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
    customerHref: '/customers/customer-1',
    customerLabel: 'Customer One',
    id: 'partner-evaluation-1',
    isDefaultRetained: false,
    lastReviewedAt: '2026-02-24T09:12:00.000Z',
    lastReviewedBy: 'Operator Linh',
    lastReviewReason: 'Booking context requires verification',
    partnerHref: '/partners/partner-1',
    partnerLabel: 'Massage Partner',
    reportReasonLabel: 'Booking context requires verification',
    serviceLabel: 'Aromatherapy',
    status: 'REPORTED',
    statusClassName: 'review-status-chip review-status-reported',
    statusLabel: 'Needs review',
  };
}

function summary(
  input: Partial<{ needsReview: number; restricted: number; retained: number; totalCount: number }> = {},
) {
  return {
    needsReview: 1,
    restricted: 0,
    retained: 0,
    totalCount: 1,
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
  if (record?.type === ClientActionDropdownSurface) return [props?.title, props?.children];
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
