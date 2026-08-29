import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import {
  type AdminVietnamOverviewRealtimePointFeed,
  type AdminVietnamOverviewSummary,
  adminGetResult,
} from '../../lib/admin-api';
import VietnamOverviewPage, { metadata } from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

vi.mock('./vietnam-overview-live-map', () => ({
  VietnamOverviewLiveMap: (props: { points: unknown[]; sampleCopy: string; signalFilters: Array<{ isActive: boolean; key: string }>; visibleCopy: string }) => (
    <div
      className="vietnam-maplibre-shell"
      data-active-layers={props.signalFilters.filter((item) => item.isActive).map((item) => item.key).join(',')}
      data-point-count={props.points.length}
      data-sample-copy={props.sampleCopy}
      data-visible-copy={props.visibleCopy}
    />
  ),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const cssSource = readFileSync('app/globals.css', 'utf8');

describe('VietnamOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (href) => ({
      data: href.includes('/summary') ? overviewFixture : realtimeFixture,
      ok: true,
      status: 200,
    }) as never);
  });

  it('defers the MapLibre live map bundle behind a dynamic boundary', () => {
    expect(pageSource).toContain("import dynamicComponent from 'next/dynamic';");
    expect(pageSource).toContain("import('./vietnam-overview-live-map')");
    expect(pageSource).not.toContain("import { VietnamOverviewLiveMap } from './vietnam-overview-live-map';");
  });

  it('loads one authoritative realtime payload for the map-first Live workspace', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({}) }),
    );

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/vietnam-overview/realtime-points?take=50',
      expect.any(Object),
    );
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(markup).toContain('Needs supply now');
    expect(markup).toContain('Ready Partners');
    expect(markup).toContain('Sampled supply gap');
    expect(markup).toContain('Operating map');
    expect(pageSource).toContain("const defaultLiveSignals: readonly VietnamOverviewMetricDotKey[] = ['needs-supply', 'online'];");
    expect(markup.indexOf('Operating map')).toBeLessThan(markup.indexOf('Regional location sample'));
    expect(markup).toContain('/bookings?view=matching');
    expect(markup).toContain('/bookings?view=matching-delays&amp;sla=overdue&amp;sort=oldest');
    expect(markup).toContain('/bookings?view=data-anomaly');
    expect(markup).not.toContain('/bookings?view=live&amp;region=');
    expect(markup).not.toContain('/partners?availability=');
    expect(markup).not.toContain('Work volume');
    expect(markup).not.toContain(`Load ${'sc'}${'ore'}`);
  });

  it('does not request or render realtime values in Period outcomes', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ range: 'today', view: 'period' }) }),
    );

    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(markup).toContain('Report period');
    expect(markup).toContain('Completed');
    expect(markup).toContain('Canceled');
    expect(markup).toContain('Cancellation share');
    expect(markup).toContain('Paid volume');
    expect(markup).not.toContain('Operating map');
    expect(markup).not.toContain('Realtime map signals');
    expect(markup).not.toContain('All customers');
    expect(markup).not.toContain('Ready Partners<!-- --> 0');
  });

  it('renders live endpoint failure as unavailable instead of zero KPI cards', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: realtimeFixture, ok: false, status: 503 } as never);
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain('Live operations unavailable');
    expect(markup).toContain('Retry before using this view for coverage decisions');
    expect(markup).not.toContain('Active bookings</span>');
    expect(markup).not.toContain('Ready Partners</span>');
  });

  it('shows generated time, manual refresh, and the Vietnam timezone honestly', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain('Generated');
    expect(markup).toContain('Manual refresh');
    expect(markup).toContain('Asia/Ho_Chi_Minh');
    expect(markup).not.toContain('Refreshes every');
    expect(markup.match(/Generated/g)).toHaveLength(1);
  });

  it('uses the root metadata template once and describes the sampled supply gap honestly', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({}) }),
    );

    expect(metadata.title).toBe('Vietnam Overview');
    expect(markup).toContain('Sampled supply gap');
    expect(markup).toContain('does not confirm assignment-engine matchability');
    expect(markup).not.toContain('Supply shortage');
    expect(markup).not.toContain('assignable Partner coverage');
  });

  it('separates the bounded source scope from points shown for current layers and focus', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain('Showing up to 4 recent mapped signals');
    expect(markup).toContain('2 shown for all regions and 2 selected layers.');
  });

  it('retains focused zero regions and customer-only regional coverage rows', async () => {
    const emptyHanoi = zeroRegion('hanoi', 'Hanoi', 'Hanoi');
    const customerOnlyDaNang = {
      ...zeroRegion('da-nang', 'Da Nang', 'Da Nang'),
      customerCount: 1,
    };
    mockedAdminGetResult.mockResolvedValue({
      data: {
        ...realtimeFixture,
        realtimePoints: [],
        regions: [emptyHanoi, customerOnlyDaNang],
      },
      ok: true,
      status: 200,
    } as never);

    const focusedMarkup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ region: 'hanoi' }) }),
    );
    const allMarkup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({}) }),
    );

    expect(focusedMarkup).toContain('Hanoi');
    expect(focusedMarkup).toContain('No sampled coverage records');
    expect(allMarkup).toContain('Da Nang');
    expect(allMarkup).toContain('Customer or Partner context sampled');
    expect(allMarkup).not.toContain('no sampled live records');
  });

  it('uses Vietnam local boundaries and end-exclusive wording for bounded reports', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ range: 'today', view: 'period' }) }),
    );

    expect(markup).toContain('From 06 Aug 2026, 00:00 to before 07 Aug 2026, 00:00');
    expect(markup).toContain('Asia/Ho_Chi_Minh');
  });

  it('keeps HCMC focus limited to period outcomes', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({
        searchParams: Promise.resolve({ range: 'today', region: 'hcm', view: 'period' }),
      }),
    );

    expect(markup).toContain('Report focus:');
    expect(markup).toContain('Ho Chi Minh City');
    expect(markup).toContain('Ho Chi Minh City period outcomes');
    expect(markup).not.toContain('Realtime map signals');
    expect(markup).not.toContain('Map focus: HCMC');
  });

  it('does not mix all-time inventory into the Period KPI band', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ view: 'period' }) }),
    );
    const metricBand = markup.slice(
      markup.indexOf('aria-label="Vietnam period outcomes"'),
      markup.indexOf('Regional outcome sample'),
    );

    expect(metricBand).not.toContain('Customer inventory');
    expect(metricBand).not.toContain('Partner inventory');
    expect(metricBand).not.toContain('Customers seen in 30 days');
    expect(metricBand).not.toContain('metric-card-scope');
  });

  it('marks bounded paid volume unavailable instead of attributing it to booking updates', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ view: 'period' }) }),
    );

    expect(markup).toContain('payments do not store a captured or released timestamp');
    expect(markup).toContain('Unavailable');
  });

  it('renders all-time paid volume only when the API marks it available', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: {
        ...overviewFixture,
        range: 'all',
        rangeLabel: 'All time',
        windowStartAt: null,
        windowEndAt: null,
        totals: { ...overviewFixture.totals, paidVolumeAvailable: true, revenueAmount: 12_500_000 },
      },
      ok: true,
      status: 200,
    } as never);
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ range: 'all', view: 'period' }) }),
    );

    expect(markup).toContain('12.500.000 VND');
    expect(markup).toContain('All stored outcomes · unbounded period');
  });

  it('labels regional values as samples and never invents a synthetic ranking', async () => {
    const markup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ view: 'period' }) }),
    );

    expect(markup).toContain('Regional outcome sample');
    expect(markup).toContain('bounded location sample');
    expect(markup).not.toContain('High load');
    expect(markup).not.toContain('Regional live load');
  });

  it('collapses zero-outcome regions while keeping a focused zero region visible', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: {
        ...overviewFixture,
        regions: [...overviewFixture.regions, zeroRegion('hanoi', 'Hanoi', 'Hanoi')],
      },
      ok: true,
      status: 200,
    } as never);

    const allMarkup = renderToStaticMarkup(
      await VietnamOverviewPage({ searchParams: Promise.resolve({ view: 'period' }) }),
    );
    const focusedMarkup = renderToStaticMarkup(
      await VietnamOverviewPage({
        searchParams: Promise.resolve({ region: 'hanoi', view: 'period' }),
      }),
    );

    expect(allMarkup).toContain('Show 1 region with no sampled outcomes');
    expect(allMarkup).toContain('<p>Hanoi</p>');
    expect(focusedMarkup).toContain('Hanoi period outcomes');
    expect(focusedMarkup).toContain('Current report');
    expect(focusedMarkup).not.toContain('View region report');
  });

  it('uses responsive KPI and table contracts without fixed six-column Vietnam layout', () => {
    expect(cssSource).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));');
    expect(cssSource).toContain('.vietnam-overview-table');
    expect(cssSource).toContain('table-layout: auto;');
    expect(cssSource).not.toMatch(/\.vietnam-overview-metric-grid\s*\{[^}]*repeat\(6,/s);
    expect(cssSource).not.toMatch(/\.vietnam-overview-table\s*\{[^}]*table-layout:\s*fixed/s);
    expect(cssSource).not.toMatch(/\.vietnam-overview-(?:coverage-strip|period-metrics)[^}]*overflow-wrap:\s*anywhere/s);
  });
});

const overviewFixture: AdminVietnamOverviewSummary = {
  generatedAt: '2026-08-06T03:00:00.000Z',
  refreshMode: 'manual',
  refreshSeconds: 0,
  source: 'stored-address-aggregates',
  timeZone: 'Asia/Ho_Chi_Minh',
  range: 'today',
  rangeLabel: 'Today',
  windowStartAt: '2026-08-05T17:00:00.000Z',
  windowEndAt: '2026-08-06T17:00:00.000Z',
  regionalSampleLimit: 50,
  partnerLocationFreshnessMinutes: 15,
  sample: {
    limitPerSource: 50,
    sources: [
      { key: 'customers', mappedPointCount: 1, returnedCount: 1, total: null, totalUnavailable: true, truncated: false },
      { key: 'partners', mappedPointCount: 1, returnedCount: 1, total: null, totalUnavailable: true, truncated: false },
      { key: 'period-bookings', mappedPointCount: 1, returnedCount: 1, total: null, totalUnavailable: true, truncated: false },
      { key: 'active-bookings', mappedPointCount: 1, returnedCount: 1, total: null, totalUnavailable: true, truncated: false },
    ],
  },
  totals: {
    activeBookingCount: 3,
    needsSupplyNowCount: 1,
    assignedOrInServiceCount: 1,
    staleActiveRecordCount: 1,
    supplyShortageCount: 0,
    activeCustomerCount: 8,
    customersSeenIn30DaysCount: 8,
    cancellationCount: 1,
    completedBookingCount: 9,
    currency: 'VND',
    customerCount: 320,
    onlinePartnerCount: 2,
    readyPartnerCount: 2,
    busyPartnerCount: 1,
    offlinePartnerCount: 4,
    stalePartnerCount: 3,
    paidVolumeAvailable: false,
    partnerCount: 140,
    revenueAmount: 0,
  },
  regions: [
    {
      activeBookingCount: 2,
      needsSupplyNowCount: 1,
      assignedOrInServiceCount: 1,
      staleActiveRecordCount: 0,
      supplyShortageCount: 0,
      activeCustomerCount: 4,
      customersSeenIn30DaysCount: 4,
      cancellationCount: 1,
      completedBookingCount: 7,
      currency: 'VND',
      customerCount: 10,
      onlinePartnerCount: 1,
      readyPartnerCount: 1,
      busyPartnerCount: 1,
      offlinePartnerCount: 2,
      stalePartnerCount: 1,
      paidVolumeAvailable: false,
      partnerCount: 8,
      regionCode: 'hcm',
      regionName: 'Ho Chi Minh City',
      revenueAmount: 0,
      shortName: 'HCMC',
    },
  ],
};

const realtimeFixture: AdminVietnamOverviewRealtimePointFeed = {
  generatedAt: '2026-08-06T03:00:00.000Z',
  refreshMode: 'manual',
  refreshSeconds: 0,
  source: 'stored-address-aggregates',
  timeZone: 'Asia/Ho_Chi_Minh',
  range: 'today',
  rangeLabel: 'Today',
  windowStartAt: '2026-08-05T17:00:00.000Z',
  windowEndAt: '2026-08-06T17:00:00.000Z',
  partnerLocationFreshnessMinutes: 15,
  sample: overviewFixture.sample,
  totals: overviewFixture.totals,
  regions: overviewFixture.regions,
  realtimePoints: [
    {
      id: 'booking:cms-booking-1',
      kind: 'needs-supply',
      label: 'Booking cms-booking-1',
      latitude: 10.7769,
      longitude: 106.7009,
      occurredAt: '2026-08-06T02:50:00.000Z',
      createdAt: '2026-08-06T02:45:00.000Z',
      locationOccurredAt: '2026-08-06T02:45:00.000Z',
      regionCode: 'hcm',
      source: 'booking-address-snapshot',
      bookingId: 'cms-booking-1',
      status: 'OPEN_MATCHING',
    },
    {
      id: 'partner:cms-partner-1',
      kind: 'online',
      label: 'Linh Wellness',
      latitude: 10.7869,
      longitude: 106.7109,
      occurredAt: '2026-08-06T02:55:00.000Z',
      locationOccurredAt: '2026-08-06T02:55:00.000Z',
      regionCode: 'hcm',
      source: 'partner-ready-status-last-location',
      providerProfileId: 'cms-partner-1',
      status: 'ONLINE_AVAILABLE',
    },
  ],
};

function zeroRegion(regionCode: string, regionName: string, shortName: string) {
  return {
    ...overviewFixture.regions[0],
    activeBookingCount: 0,
    activeCustomerCount: 0,
    assignedOrInServiceCount: 0,
    busyPartnerCount: 0,
    cancellationCount: 0,
    completedBookingCount: 0,
    customerCount: 0,
    customersSeenIn30DaysCount: 0,
    needsSupplyNowCount: 0,
    offlinePartnerCount: 0,
    onlinePartnerCount: 0,
    partnerCount: 0,
    readyPartnerCount: 0,
    regionCode,
    regionName,
    shortName,
    staleActiveRecordCount: 0,
    stalePartnerCount: 0,
    supplyShortageCount: 0,
  };
}
