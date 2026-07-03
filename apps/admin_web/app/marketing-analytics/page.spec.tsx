import { vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

import { adminGet } from '../../lib/admin-api';
import MarketingAnalyticsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('MarketingAnalyticsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('loads summary only by default', async () => {
    await MarketingAnalyticsPage({ searchParams: Promise.resolve({}) });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/marketing/summary?range=7d');
    expect(hrefs.some((href) => String(href).includes('/admin/marketing/dimensions/'))).toBe(false);
  });

  it('uses independent server paging for requested breakdown dimensions', async () => {
    await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        breakdowns: '1',
        regionPage: '2',
        sourcePage: '3',
      }),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/marketing/dimensions/source?range=7d&take=10&skip=20');
    expect(hrefs).toContain('/admin/marketing/dimensions/region?range=7d&take=10&skip=10');
    expect(hrefs).toContain('/admin/marketing/dimensions/campaign?range=7d&take=10&skip=0');
    expect(hrefs).toContain('/admin/marketing/dimensions/platform?range=7d&take=10&skip=0');
  });

  it('uses shared admin form atoms for campaign and manual spend controls', async () => {
    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).not.toContain('<div class="calendar-field"><span>Date</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Campaign ID</span>');
    expect(markup).not.toContain('<div class="calendar-field"><span>Spend amount</span>');
    expect(markup).not.toContain('<label><span>Date</span><input');
    expect(markup).not.toContain('<label><span>Source</span><select');
    expect(markup).not.toContain('<label><span>Campaign ID</span><input');
  });

  it('renders marketing evidence cards with shared Vuexy section surfaces', async () => {
    const page = await MarketingAnalyticsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('card admin-section usage-overview-filter-panel marketing-analytics-filter-panel');
    expect(markup).toContain('card admin-section marketing-spend-panel');
    expect(markup).toContain('card admin-kpi-card metric-card vietnam-overview-metric');
    expect(markup).not.toContain('card admin-filter-panel usage-overview-filter-panel marketing-analytics-filter-panel');
    expect(markup).not.toContain('card admin-filter-panel marketing-spend-panel');
    expect(markup).toContain('card admin-section usage-overview-ranking-card marketing-funnel-card');
    expect(markup).toContain('admin-section-body marketing-funnel-list');
    expect(markup).toContain('card admin-section usage-overview-ranking-card marketing-insight-card');
    expect(markup).toContain('admin-section-body marketing-insight-list');
    expect(markup).toContain('card admin-section usage-overview-ranking-card marketing-table-card');
    expect(markup).toContain('admin-section-body marketing-breakdown-loader-body');
    expect(markup).toContain('empty-state marketing-breakdown-loader-empty');
    expect(pageSource).not.toContain('bodyClassName="empty-state"');
  });

  it('renders breakdown tables with shared Vuexy table atoms when requested', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        breakdowns: '1',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('table vuexy-data-table vuexy-booking-table usage-overview-table marketing-analytics-table');
    expect(markup).toContain('admin-table-scroll usage-overview-table-wrap');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).not.toContain('<div className="empty-state">');
    expect(pageSource).not.toContain('<table className="table vuexy-data-table vuexy-booking-table usage-overview-table marketing-analytics-table">');
  });
});
