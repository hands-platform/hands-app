import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import UsageOverviewPage from './page';
import { emptyUsageOverview } from './usage-overview-model';
import { UsageOverviewTrendChart } from './usage-overview-trend-chart';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('UsageOverviewPage', () => {
  it('allows explicit aggregate fetch revalidation instead of forcing the whole route dynamic', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain("export const dynamic = 'force-dynamic'");
  });

  beforeEach(() => {
    mockedAdminGet.mockResolvedValue(emptyUsageOverview('7d'));
  });

  it('renders the bounded Vietnam-time usage report with the action board near the top', async () => {
    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/usage-overview?range=7d', null, {
      freshness: 'live',
    });
    expect(markup).toContain('Customer Usage');
    expect(markup).toContain('Applied dates use Asia/Ho_Chi_Minh');
    expect(markup).toContain('30 days');
    expect(markup).toContain('Custom');
    expect(markup).toContain('card admin-kpi-card usage-overview-kpi-card');
    expect(markup).toContain('Needs attention');
    expect(markup).toContain('Unique-customer reach');
    expect(markup).toContain('Booking outcomes');
    expect(markup).toContain('Current customer base · Usage data time unavailable');
    expect(markup).toContain('Cohort retention');
    expect(markup).toContain('Customer activity · Top 5');
    expect(markup).toContain('Partner discovery · Top 5');
    expect(markup).toContain('Open Vietnam Overview');
    expect(markup.indexOf('Needs attention')).toBeLessThan(markup.indexOf('Unique-customer reach'));
  });

  it('separates an API failure from a real zero report', async () => {
    mockedAdminGet.mockResolvedValue(null);
    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: 'today' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Usage data unavailable');
    expect(markup).toContain('No zero values are shown');
    expect(markup).not.toContain('aria-label="Usage overview key metrics"');
  });

  it('passes bounded custom dates to the API and renders shared date pickers', async () => {
    mockedAdminGet.mockResolvedValue(emptyUsageOverview('custom'));
    const page = await UsageOverviewPage({
      searchParams: Promise.resolve({ from: '2026-07-01', range: 'custom', to: '2026-07-19' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/usage-overview?range=custom&from=2026-07-01&to=2026-07-19',
      null,
      {
        freshness: 'live',
      },
    );
    expect(markup).toContain('usage-overview-custom-range');
    expect(markup).toContain('name="from"');
    expect(markup).toContain('name="to"');
    expect(markup).not.toContain('/vietnam-overview?view=period&amp;range=30d');
    expect(pageSource).toContain('AdminFormDate');
    expect(pageSource).not.toContain('type="date"');
  });

  it('links action signals to existing filtered operation pages', async () => {
    const overview = emptyUsageOverview('7d');
    mockedAdminGet.mockResolvedValue({
      ...overview,
      appliedRange: {
        dayCount: 7,
        fromDate: '2026-07-13',
        granularity: 'daily',
        toDate: '2026-07-19',
      },
      bookingQuality: {
        ...overview.bookingQuality,
        unresolvedCount: 2,
      },
      customerSegments: {
        ...overview.customerSegments,
        newUnbookedCustomerCount: 4,
      },
    });
    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(
      'href="/customers?view=all&amp;segment=usage-new-unbooked&amp;dateField=joined&amp;dateRange=custom&amp;dateFrom=2026-07-13&amp;dateTo=2026-07-19"',
    );
    expect(markup).toContain(
      'href="/bookings?dateFrom=2026-07-13&amp;dateRange=custom&amp;dateTo=2026-07-19&amp;sort=oldest&amp;view=usage-unresolved"',
    );
    expect(markup).toContain('Review 4 customers');
    expect(markup).toContain('Review 2 bookings');
    expect(markup).not.toContain('segment=issue');
    expect(markup).not.toContain('sort=profile-views');
    expect(markup).toContain('metric-card-scope is-risk">Review now');
  });

  it('shows a field error and does not call the API for a reversed custom range', async () => {
    mockedAdminGet.mockClear();
    const page = await UsageOverviewPage({
      searchParams: Promise.resolve({ from: '2026-07-19', range: 'custom', to: '2026-07-01' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).not.toHaveBeenCalled();
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('From must be on or before To.');
    expect(markup).toContain('Custom period not applied');
    expect(markup).toContain('Provenance not evaluated');
    expect(markup).not.toContain('Synthetic usage excluded');
    expect(markup).not.toContain('Usage provenance is incomplete');
  });

  it('shows production provenance only for a guaranteed API response and keeps scope metadata separate', async () => {
    const overview = emptyUsageOverview('30d');
    mockedAdminGet.mockResolvedValue({
      ...overview,
      freshness: {
        bookingActivityThroughAt: '2026-08-10T03:00:00.000Z',
        reportGeneratedAt: '2026-08-10T04:00:00.000Z',
        reviewActivityThroughAt: null,
        refundActivityThroughAt: null,
        usageAggregatedThroughAt: '2026-08-10T03:30:00.000Z',
        usageStatus: 'fresh',
      },
      provenance: {
        bookingFixtures: 'explicit-markers-excluded',
        unknownAggregateCount: 0,
        usageFixtures: 'guaranteed',
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '30d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Synthetic usage excluded');
    expect(markup).toContain('Report generated');
    expect(markup).toContain('Usage signals through');
    expect(markup).not.toContain('Usage provenance is incomplete');
    expect(pageSource).not.toContain("].join(' · ')");
  });

  it('shows delayed usage independently from incomplete provenance', async () => {
    const overview = emptyUsageOverview('30d');
    mockedAdminGet.mockResolvedValue({
      ...overview,
      freshness: {
        ...overview.freshness,
        reportGeneratedAt: '2026-08-10T04:00:00.000Z',
        usageAggregatedThroughAt: '2026-08-07T03:30:00.000Z',
        usageStatus: 'delayed',
      },
      provenance: {
        ...overview.provenance,
        unknownAggregateCount: 3,
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '30d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Usage provenance is incomplete');
    expect(markup).toContain('3 unknown aggregate rows are excluded');
    expect(markup).toContain('Production usage signals may be delayed');
    expect(markup).toContain('As of usage data through');
  });

  it('renders accessible trend summaries and exact chart data', () => {
    const markup = renderToStaticMarkup(
      <UsageOverviewTrendChart
        rows={[{
          appOpenCount: 4,
          bookingRequestCount: 2,
          completedBookingCount: 1,
          label: '08/10',
          periodStart: '2026-08-10T00:00:00.000Z',
          providerProfileViewCount: 3,
          sessionStartCount: 2,
        }]}
      />,
    );

    expect(markup).toContain('aria-describedby=');
    expect(markup).toContain('View chart data');
    expect(markup).toContain('admin-data-table');
    expect(markup).toContain('Customer activity exact values by reporting interval');
    expect(markup).toContain('Booking activity exact values by reporting interval');
  });

  it('uses shared surfaces and direct icon tone selectors', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    expect(pageSource).toContain('AdminOverviewCommandGrid');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminErrorState');
    expect(pageSource).toContain('usage-overview-service-row');
    expect(pageSource).toContain('usage-overview-region-row-v2');
    expect(pageSource).toContain('Closed issue outcomes');
    expect(pageSource).toContain('UsageOverviewRefreshButton');
    expect(readFileSync(new URL('./usage-overview-refresh-button.tsx', import.meta.url), 'utf8')).toContain('window.location.reload()');
    expect(css).toContain('.usage-overview-filter-panel > .admin-filter-panel-header {');
    expect(css).toContain('display: grid;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    for (const tone of ['primary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      expect(css).toContain(`.usage-overview-kpi-card.is-${tone} > .metric-card > .metric-card-icon`);
      expect(css).not.toContain(`.usage-overview-kpi-card.is-${tone} .metric-card-icon`);
    }
  });
});
