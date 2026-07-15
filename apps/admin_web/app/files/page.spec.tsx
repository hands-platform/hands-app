import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import FilesPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('FilesPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps file review hydration paged and renders the review queue on the shared Vuexy section surface', async () => {
    const page = await FilesPage({
      searchParams: Promise.resolve({ page: '3' }),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);
    const markup = renderToStaticMarkup(page);

    expect(hrefs).toContain('/admin/files/review-providers?take=10&skip=20');
    expect(hrefs).toContain('/admin/files/review-summary');
    expect(markup).toContain('Review queue');
    expect(markup).toContain('<span class="metric-card-scope is-record">All records</span>');
    expect(markup).toContain('<span class="metric-card-scope is-action">Pending</span>');
    expect(markup).toContain('<span class="metric-card-scope is-risk">Needs action</span>');
    expect(markup).toContain('card admin-section vuexy-booking-table-card vuexy-booking-table-group');
    expect(markup).toContain('No files match this queue.');
    expect(markup).toContain('class="empty-state');
  });

  it('uses the shared table pagination footer for file review pages', () => {
    expect(pageSource).toContain('AdminTableSection');
    expect(pageSource).not.toContain('className="vuexy-booking-table-card vuexy-booking-table-group"');
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('ariaLabel="File review provider pages"');
    expect(pageSource).not.toContain('import { AdminRoundedPagination }');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
  });

  it('uses the shared filter panel atoms directly for the file review filters', () => {
    expect(pageSource).toContain('AdminFilterPanel');
    expect(pageSource).toContain('AdminFilterSummary');
    expect(pageSource).toContain('AdminFormSearch');
    expect(pageSource).toContain('AdminFormGrid');
    expect(pageSource).toContain('AdminSegmentedControl');
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).not.toContain('AdminFilterChipGroup');
    expect(pageSource).not.toContain('StatusBadgeLink');
    expect(pageSource).not.toContain('FilterBar');
  });

  it('preserves search context and accepts legacy purpose query aliases in file filters', async () => {
    const page = await FilesPage({
      searchParams: Promise.resolve({ purpose: 'public-media', q: 'smoke' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('value="smoke"');
    expect(markup).toContain('Active file review filters');
    expect(markup).toContain('Queue: Public media');
    expect(markup).toContain('Page: 1');
    expect(markup).toContain('Rows: 10');
    expect(markup).toContain('Search: smoke');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('href="/files?q=smoke&amp;kind=public-media"');
    expect(markup).toContain('href="/files?q=smoke&amp;review=needs-review"');
    expect(markup).toContain('href="/files?q=smoke&amp;review=approved"');
    expect(markup).toContain('booking-date-filter-bar files-filter-group');
    expect(markup).toContain('booking-date-filter-buttons files-filter-buttons');
    expect(markup).toContain('booking-date-filter-button is-active');
  });

  it('uses the shared DateTimeText atom for uploaded file timestamps', () => {
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).not.toContain('<p className="muted">{formatDateTime(row.uploadedAt)}</p>');
  });

  it('uses the shared inline fallback atom for unavailable file links', () => {
    expect(pageSource).toContain('AdminInlineFallback');
    expect(pageSource).not.toContain('<span className="muted">No read URL</span>');
  });
});
