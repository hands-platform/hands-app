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

    expect(markup).toContain('admin-form-grid form-grid marketing-analytics-campaign-form');
    expect(markup).toContain('admin-form-grid form-grid marketing-spend-form');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).toContain('marketing-analytics-apply-button');
    expect(markup).not.toContain('booking-date-apply-button');
    expect(markup).toContain('admin-form-control-labeled');
    expect(markup).toContain('admin-form-label');
    expect(markup).toContain('admin-grid-span-2');
    expect(markup).not.toContain('marketing-analytics-form-field');
    expect(markup).not.toContain('marketing-spend-notes');
    expect(pageSource).not.toContain('marketing-analytics-form-field');
    expect(pageSource).not.toContain('marketing-spend-notes');
    expect(markup).not.toContain('calendar-field');
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

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('class="marketing-analytics-page"');
    expect(markup).not.toContain('usage-overview-page');
    expect(markup).toContain('card admin-section marketing-analytics-filter-panel');
    expect(markup).not.toContain('usage-overview-filter-panel marketing-analytics-filter-panel');
    expect(markup).toContain('booking-date-filter-buttons marketing-analytics-range-buttons');
    expect(markup).not.toContain('booking-date-filter-buttons usage-overview-range-buttons');
    expect(markup).toContain('card admin-section marketing-spend-panel');
    expect(markup).toContain('card admin-kpi-card marketing-analytics-metric');
    expect(markup).not.toContain('vietnam-overview-metric');
    expect(markup).toContain('class="metric-card"');
    expect(markup).not.toContain('<article class="card admin-kpi-card metric-card marketing-analytics-metric');
    expect(pageSource).toContain('AdminMetricGrid');
    expect(pageSource).not.toContain('AdminKpiCard');
    expect(pageSource).not.toContain('vietnam-overview-metric-grid');
    expect(markup).not.toContain('card admin-filter-panel usage-overview-filter-panel marketing-analytics-filter-panel');
    expect(markup).not.toContain('card admin-filter-panel marketing-spend-panel');
    expect(markup).toContain('card admin-section marketing-funnel-card');
    expect(markup).toContain('admin-section-body marketing-funnel-list');
    expect(markup).toContain('card admin-section marketing-insight-card');
    expect(markup).toContain('admin-section-body marketing-insight-list');
    expect(markup).toContain('card admin-section marketing-table-card');
    expect(markup).not.toContain('usage-overview-ranking-card marketing-funnel-card');
    expect(markup).not.toContain('usage-overview-ranking-card marketing-insight-card');
    expect(markup).not.toContain('usage-overview-ranking-card marketing-table-card');
    expect(markup).toContain('marketing-analytics-grid');
    expect(markup).not.toContain('usage-overview-grid marketing-analytics-grid');
    expect(markup).toContain('admin-section-body marketing-breakdown-loader-body');
    expect(markup).toContain('empty-state marketing-breakdown-loader-empty');
    expect(markup).toContain('admin-form-control-link button button-primary');
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).toContain('AdminOverviewGrid');
    expect(pageSource).not.toContain('<section className="usage-overview-grid');
    expect(pageSource).not.toContain('<a className="button button-primary"');
    expect(pageSource).not.toContain('bodyClassName="empty-state"');
  });

  it('uses shared Vuexy badge atoms instead of raw marketing pill spans', () => {
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).not.toContain('const generatedAt = formatDateTime(overview.generatedAt);');
    expect(pageSource).not.toContain('Generated {generatedAt}');
    expect(pageSource).not.toContain('function formatDateTime(value: string)');
    expect(pageSource).not.toContain('<span className="pill pill-success">No live ad API</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {generatedAt}</span>');
    expect(pageSource).not.toContain('actions={<span className="pill pill-info">{overview.rangeLabel}</span>}');
    expect(pageSource).not.toContain('actions={<span className="pill pill-warning">Manual input</span>}');
    expect(pageSource).not.toContain('<span className="pill pill-info">');
  });

  it('renders breakdown tables with shared Vuexy table atoms when requested', async () => {
    const page = await MarketingAnalyticsPage({
      searchParams: Promise.resolve({
        breakdowns: '1',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('table vuexy-data-table vuexy-booking-table marketing-analytics-table');
    expect(markup).toContain('admin-table-scroll marketing-analytics-table-wrap');
    expect(markup).not.toContain('usage-overview-table marketing-analytics-table');
    expect(markup).not.toContain('usage-overview-table-wrap');
    expect(markup).not.toContain('usage-overview-name-cell');
    expect(markup).not.toContain('usage-overview-avatar');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('marketing-analytics-name-cell');
    expect(pageSource).toContain('marketing-analytics-avatar');
    expect(pageSource).not.toContain('<div className="empty-state">');
    expect(pageSource).not.toContain('<table className="table vuexy-data-table vuexy-booking-table usage-overview-table marketing-analytics-table">');
    expect(pageSource).not.toContain('usage-overview-table-wrap');
    expect(pageSource).not.toContain('usage-overview-name-cell');
    expect(pageSource).not.toContain('usage-overview-avatar');
  });

  it('uses the shared table pagination footer for breakdown tables', () => {
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('ariaLabel={`${title} pagination`}');
    expect(pageSource).not.toContain('import { AdminRoundedPagination }');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
  });

  it('uses the shared money atom for visible breakdown table amounts', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).toContain('value: <MoneyText amount={overview.totals.adSpend} />');
    expect(pageSource).toContain(
      'value: <MoneyText amount={overview.totals.conversionRates.cpaBookingCompleted} fallback="n/a" />',
    );
    expect(pageSource).toContain('value: <MoneyText amount={overview.totals.platformFeeRevenue} />');
    expect(pageSource).toContain('Gross <MoneyText amount={overview.totals.grossBookingValue} />');
    expect(pageSource).toContain('<MoneyText amount={row.adSpend} />');
    expect(pageSource).toContain(
      '<MoneyText amount={row.conversionRates.cpaBookingCompleted} fallback="n/a" />',
    );
    expect(pageSource).toContain('<MoneyText amount={row.platformFeeRevenue} />');
    expect(pageSource).not.toContain('value: formatCurrency(overview.totals.adSpend)');
    expect(pageSource).not.toContain('value: formatNullableCurrency(overview.totals.conversionRates.cpaBookingCompleted)');
    expect(pageSource).not.toContain('value: formatCurrency(overview.totals.platformFeeRevenue)');
    expect(pageSource).not.toContain('detail: `Gross ${formatCurrency(overview.totals.grossBookingValue)}`');
    expect(pageSource).not.toContain('<td>{formatCurrency(row.adSpend)}</td>');
    expect(pageSource).not.toContain('<td>{formatNullableCurrency(row.conversionRates.cpaBookingCompleted)}</td>');
    expect(pageSource).not.toContain('<td>{formatCurrency(row.platformFeeRevenue)}</td>');
  });
});
