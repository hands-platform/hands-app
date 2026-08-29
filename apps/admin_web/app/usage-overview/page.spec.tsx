import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import UsageOverviewPage from './page';
import { emptyUsageOverview } from './usage-overview-model';
import { UsageOverviewTrendChart } from './usage-overview-trend-chart';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

vi.mock('next/navigation', () => ({
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
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
    expect(markup).toContain('Most active customers · Top 5');
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

  it('redirects a bare custom range to an explicit default window', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
    }).format(new Date());
    const to = new Date(`${today}T00:00:00.000Z`);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 6);

    await expect(UsageOverviewPage({
      searchParams: Promise.resolve({ range: 'custom' }),
    })).rejects.toThrow(
      `NEXT_REDIRECT:/usage-overview?range=custom&from=${from.toISOString().slice(0, 10)}&to=${today}`,
    );
    expect(mockedAdminGet).not.toHaveBeenCalled();
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

  it('preserves a partial custom range and leaves the missing date empty', async () => {
    mockedAdminGet.mockClear();
    const page = await UsageOverviewPage({
      searchParams: Promise.resolve({ from: '2026-07-01', range: 'custom' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).not.toHaveBeenCalled();
    expect(markup).toContain('value="2026-07-01"');
    expect(markup).toContain('Enter valid From and To dates.');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('name="to" value=""');
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
        booking: 'guaranteed',
        unknownBookingCount: 0,
        unknownUsageAggregateCount: 0,
        usage: 'guaranteed',
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '30d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Production verified');
    expect(markup).toContain('Explicit production origin required');
    expect(markup).toContain('Report generated');
    expect(markup).toContain('Through');
    expect(markup).not.toContain('Verification incomplete');
    expect(markup).not.toContain('usage-overview-data-health-item is-warning');
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
        unknownUsageAggregateCount: 3,
        usage: 'incomplete',
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '30d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Verification incomplete');
    expect(markup).toContain('3 unknown rows excluded');
    expect(markup).toContain('Usage exceeds the 48-hour freshness threshold');
    expect(markup).toContain('Delayed');
    expect(markup).toContain('usage-overview-data-health-item is-warning');
    expect(markup).toContain('aria-hidden="true"');
  });

  it('limits every booking-derived zero to the verified subset when booking provenance is incomplete', async () => {
    const overview = emptyUsageOverview('30d');
    mockedAdminGet.mockResolvedValue({
      ...overview,
      customerLifecycle: {
        ...overview.customerLifecycle,
        newCustomerCount: 1,
      },
      freshness: {
        ...overview.freshness,
        usageAggregatedThroughAt: '2026-08-26T03:30:00.000Z',
        usageStatus: 'fresh',
      },
      provenance: {
        booking: 'incomplete',
        unknownBookingCount: 646,
        unknownUsageAggregateCount: 0,
        usage: 'guaranteed',
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '30d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('Cohort reconciled');
    expect(markup).toContain('Verified cohort only');
    expect(markup).not.toMatch(/Booking records created[\s\S]{0,500}No change vs previous equal period/);
    expect(markup).not.toMatch(/Unresolved booking records[\s\S]{0,500}No change vs previous equal period/);
    expect(markup).not.toContain('>Never booked<');
    expect(markup).not.toContain('>No service demand in this period.<');
    expect(markup).not.toContain('>No regional booking demand in this period.<');
    expect(markup).toContain('No verified production booking');
    expect(markup).toContain('No verified production service demand in this period.');
    expect(markup).toContain('No verified production regional booking demand in this period.');
    expect(markup).toContain('Verified subset only · 646 unverified records excluded');
    expect(markup).toContain('Source incomplete · 646 unverified records excluded');
    expect(markup).toContain('0 verified');
    expect(markup).toContain('usage-overview-data-health-item is-warning');
  });

  it('keeps established booking copy unchanged when booking provenance is guaranteed', async () => {
    const overview = emptyUsageOverview('30d');
    mockedAdminGet.mockResolvedValue({
      ...overview,
      customerLifecycle: {
        ...overview.customerLifecycle,
        newCustomerCount: 1,
      },
      provenance: {
        ...overview.provenance,
        booking: 'guaranteed',
        unknownBookingCount: 0,
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '30d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Cohort reconciled');
    expect(markup).toContain('No change vs previous equal period');
    expect(markup).toContain('>Never booked<');
    expect(markup).toContain('>No service demand in this period.<');
    expect(markup).toContain('>No regional booking demand in this period.<');
    expect(markup).not.toContain('Verified cohort only');
    expect(markup).not.toContain('0 verified');
  });

  it.each([
    ['usage unavailable with booking guaranteed', 'failed', 'guaranteed', false, true],
    ['usage available with booking incomplete', 'fresh', 'incomplete', true, false],
    ['usage unavailable with booking incomplete', 'failed', 'incomplete', false, false],
    ['usage available with booking guaranteed', 'fresh', 'guaranteed', true, true],
  ] as const)(
    'keeps usage availability independent from booking provenance: %s',
    async (_label, usageStatus, booking, showsUsageValue, showsReconciledCohort) => {
      const overview = emptyUsageOverview('7d');
      mockedAdminGet.mockResolvedValue({
        ...overview,
        freshness: {
          ...overview.freshness,
          usageAggregatedThroughAt: usageStatus === 'fresh' ? '2026-08-26T03:30:00.000Z' : null,
          usageStatus,
        },
        provenance: {
          booking,
          unknownBookingCount: booking === 'incomplete' ? 9 : 0,
          unknownUsageAggregateCount: usageStatus === 'failed' ? 2 : 0,
          usage: usageStatus === 'failed' ? 'incomplete' : 'guaranteed',
        },
        totals: {
          ...overview.totals,
          activeCustomerCount: 17,
        },
      });

      const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
      const markup = renderToStaticMarkup(page);

      expect(markup.includes('>17<')).toBe(showsUsageValue);
      expect(markup.includes('Cohort reconciled')).toBe(showsReconciledCohort);
      expect(markup.includes('Verified cohort only')).toBe(!showsReconciledCohort);
    },
  );

  it('renders usage values as unavailable while retaining independent booking activity', async () => {
    const overview = emptyUsageOverview('7d');
    mockedAdminGet.mockResolvedValue({
      ...overview,
      behavior: {
        ...overview.behavior,
        trend: [{
          appOpenCount: 0,
          completedBookingCount: 1,
          createdBookingCount: 4,
          label: '08/10',
          periodStart: '2026-08-10T00:00:00.000Z',
          preferredRequestCount: 2,
          providerProfileViewCount: 0,
          sessionStartCount: 0,
        }],
      },
      freshness: {
        ...overview.freshness,
        reportGeneratedAt: '2026-08-10T04:00:00.000Z',
        usageStatus: 'failed',
      },
      totals: {
        ...overview.totals,
        activeCustomerCount: 17,
        partnerProfileViewCount: 33,
      },
    });

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range: '7d' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Usage telemetry');
    expect(markup).toContain('Data unavailable');
    expect(markup).not.toContain('>17<');
    expect(markup).not.toContain('>33<');
    expect(markup).toContain('Bookings created');
    expect(markup).toContain('Preferred Partner requests');
    expect(markup).toContain('Completed during period');
  });

  it('renders accessible trend summaries and exact chart data', () => {
    const markup = renderToStaticMarkup(
      <UsageOverviewTrendChart
        rows={[{
          appOpenCount: 4,
          completedBookingCount: 1,
          createdBookingCount: 3,
          label: '08/10',
          periodStart: '2026-08-10T00:00:00.000Z',
          preferredRequestCount: 2,
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
    expect(markup).toContain('Bookings created');
    expect(markup).toContain('Preferred Partner requests');
    expect(markup).toContain('Completed during period');
  });

  it('limits an empty booking trend to the verified subset when provenance is incomplete', () => {
    const markup = renderToStaticMarkup(
      <UsageOverviewTrendChart
        bookingAvailable={false}
        bookingExcludedCount={646}
        rows={[]}
        usageAvailable={false}
      />,
    );

    expect(markup).toContain('No verified production booking activity in this period');
    expect(markup).toContain('Source incomplete · 646 unverified records excluded.');
    expect(markup).not.toContain('No activity in this period');
  });

  it.each([
    ['today', 'Use last 7 days', '/usage-overview?range=7d'],
    ['yesterday', 'Use last 7 days', '/usage-overview?range=7d'],
    ['7d', 'Try 30 days', '/usage-overview?range=30d'],
  ] as const)('uses a different empty-state destination for %s', async (range, label, href) => {
    mockedAdminGet.mockResolvedValue(emptyUsageOverview(range));

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(label);
    expect(markup).toContain(`href="${href.replaceAll('&', '&amp;')}"`);
    expect(href).not.toBe(`/usage-overview?range=${range}`);
  });

  it.each(['30d', 'month'] as const)('omits an empty-state self-link for %s', async (range) => {
    mockedAdminGet.mockResolvedValue(emptyUsageOverview(range));

    const page = await UsageOverviewPage({ searchParams: Promise.resolve({ range }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).not.toContain('Use last 7 days');
    expect(markup).not.toContain('Try 30 days');
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
    expect(css).toContain('.usage-overview-v2 .usage-overview-data-health {');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(css).toContain('display: grid;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    for (const tone of ['primary', 'info', 'success', 'warning', 'danger', 'neutral']) {
      expect(css).toContain(`.usage-overview-kpi-card.is-${tone} > .metric-card > .metric-card-icon`);
      expect(css).not.toContain(`.usage-overview-kpi-card.is-${tone} .metric-card-icon`);
    }
  });
});
