import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { type AdminVietnamOverviewSummary, adminGet } from '../../lib/admin-api';
import VietnamOverviewPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('./vietnam-overview-live-map', () => ({
  VietnamOverviewLiveMap: () => <div className="vietnam-maplibre-shell" />,
}));

const mockedAdminGet = vi.mocked(adminGet);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const mapClustersSource = readFileSync(
  new URL('./vietnam-overview-map-clusters.tsx', import.meta.url),
  'utf8',
);

describe('VietnamOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders the realtime map and period report with shared Vuexy section surfaces', async () => {
    const page = await VietnamOverviewPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/vietnam-overview/summary?range=today', expect.any(Object));
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/vietnam-overview/realtime-points?take=50', expect.any(Object));
    expect(markup).toContain('Vietnam Overview');
    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('card admin-card vietnam-realtime-widget');
    expect(markup).not.toContain('<article class="vietnam-realtime-widget');
    expect(pageSource).toContain('AdminOverviewGrid');
    expect(pageSource).toContain('AdminCardGrid');
    expect(pageSource).not.toContain('<div className="vietnam-realtime-widget-grid">');
    expect(pageSource).not.toContain('<div className="vietnam-realtime-analytics-grid">');
    expect(pageSource).not.toContain(
      '<section className="vietnam-realtime-dashboard" aria-label="Realtime Vietnam operations dashboard">',
    );
    expect(markup).toContain('card admin-section vietnam-overview-map-card');
    expect(markup).toContain('card admin-section vietnam-overview-filter-panel');
    expect(markup).toContain('card admin-card admin-summary-card vietnam-overview-filter-summary-card');
    expect(markup).not.toContain('<article class="vietnam-overview-filter-summary-card');
    expect(pageSource).toContain('AdminSummaryCardGrid');
    expect(pageSource).not.toContain('<div className="vietnam-overview-filter-summary-grid"');
    expect(pageSource).not.toContain('<div className="vietnam-region-focus-summary-items is-realtime">');
    expect(pageSource).not.toContain('<div className="vietnam-region-focus-summary-items is-period">');
    expect(markup).not.toContain('card admin-filter-panel vietnam-overview-filter-panel');
    expect(markup).toContain('card admin-section vietnam-realtime-chart-card');
    expect(pageSource).toContain('AdminRowLink');
    expect(pageSource).not.toContain('<a key={region.regionCode} className="vietnam-realtime-region-row" href={href}>');
    expect(markup).toContain('card admin-section vietnam-overview-period-report-card');
    expect(markup).toContain('card admin-kpi-card vietnam-overview-metric');
    expect(markup).toContain('class="metric-card"');
    expect(markup).not.toContain('<article class="card admin-kpi-card metric-card vietnam-overview-metric');
    expect(markup).toContain('card admin-section vietnam-overview-region-card');
    expect(markup).toContain('card admin-card admin-summary-card vietnam-overview-region-insight-card');
    expect(markup).not.toContain('<article class="vietnam-overview-region-insight-card');
    expect(pageSource).not.toContain('<div className="vietnam-overview-region-insight-grid"');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table admin-data-table vietnam-overview-table');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('AdminKpiCard');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).toContain('formatWholeNumber as formatNumber');
    expect(pageSource).not.toContain('formatPendingDateTime as formatDateTime');
    expect(pageSource).not.toContain('const lastGeneratedAt = formatDateTime(overview.generatedAt);');
    expect(pageSource).not.toContain('`${formatDateTime(overview.windowStartAt)} - ${formatDateTime(overview.windowEndAt)}`');
    expect(pageSource).not.toContain('function formatNumber(value: number)');
    expect(pageSource).not.toContain('function formatDateTime(value: string)');
    expect(mapClustersSource).toContain('AdminSummaryCardGrid');
    expect(markup).toContain('empty-state vietnam-realtime-empty');
    expect(mapClustersSource).not.toContain('<article key={item.key} className={`vietnam-map-cluster-summary-card');
    expect(mapClustersSource).not.toContain('<article className="vietnam-map-cluster-context-card');
    expect(mapClustersSource).not.toContain('<div className="vietnam-map-cluster-summary-grid">');
    expect(mapClustersSource).not.toContain('<div className="vietnam-map-cluster-context-grid"');
    expect(pageSource).not.toContain('<div className="vietnam-realtime-empty">');
    expect(pageSource).not.toContain('<div className="empty-state">');
    expect(pageSource).not.toContain('<table className="table vuexy-data-table vietnam-overview-table">');
  });

  it('renders a focused region summary with the shared Vuexy section surface', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/vietnam-overview/summary?range=today') {
        return vietnamOverviewWithRegion;
      }

      return fallback;
    });
    const page = await VietnamOverviewPage({
      searchParams: Promise.resolve({ range: 'today', region: 'hcm' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Ho Chi Minh metrics');
    expect(markup).toContain('card admin-section vietnam-region-focus-summary-card');
    expect(markup).toContain('card admin-card admin-summary-card vietnam-region-focus-summary-item');
    expect(markup).not.toContain('<article class="vietnam-region-focus-summary-item');
  });

  it('uses shared badge atoms for Vietnam overview status chips', () => {
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('StatusBadgeLink');
    expect(pageSource).not.toContain('PillClassBadge');
    expect(pageSource).not.toContain('PillClassBadgeLink');
    expect(mapClustersSource).toContain('StatusBadge');
    expect(mapClustersSource).not.toContain('PillClassBadge');
    expect(pageSource).not.toContain('<span className="pill pill-success">Vietnam only</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Refreshes every {overview.refreshSeconds}s</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {lastGeneratedAt}</span>');
    expect(pageSource).not.toContain('<span className="pill pill-success">Stored totals</span>');
    expect(pageSource).not.toContain('<a className="pill pill-primary vietnam-overview-clear-focus" href={clearRegionHref}>');
    expect(mapClustersSource).not.toContain('<span className="vietnam-map-cluster-panel-badge">Live now</span>');
    expect(mapClustersSource).not.toContain('<span className="vietnam-map-cluster-panel-badge is-region">');
  });

  it('uses the shared money atom for Vietnam paid volume values', () => {
    expect(pageSource).toContain('MoneyText');
    expect(pageSource).toContain('<MoneyText amount={metricTotals.revenueAmount} currency={metricTotals.currency} />');
    expect(pageSource).toContain('<MoneyText amount={region.revenueAmount} currency={region.currency} />');
    expect(pageSource).not.toContain('function formatCurrency(value: number, currency: string)');
    expect(pageSource).not.toContain('value={formatCurrency(region.revenueAmount, region.currency)}');
  });

  it('scopes filter summary typography to direct summary-card children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-overview-filter-summary-card > span');
    expect(css).toContain('.vietnam-overview-filter-summary-card > strong');
    expect(css).toContain('.vietnam-overview-filter-summary-card > small');
    expect(css).not.toContain('.vietnam-overview-filter-summary-card span {');
    expect(css).not.toContain('.vietnam-overview-filter-summary-card strong {');
    expect(css).not.toContain('.vietnam-overview-filter-summary-card small {');
  });
});

const vietnamOverviewWithRegion: AdminVietnamOverviewSummary = {
  generatedAt: new Date(0).toISOString(),
  range: 'today',
  rangeLabel: 'Today',
  refreshSeconds: 60,
  source: 'stored-address-aggregates',
  windowEndAt: null,
  windowStartAt: null,
  points: [],
  regions: [
    {
      activeBookingCount: 1,
      activeCustomerCount: 2,
      cancellationCount: 0,
      completedBookingCount: 3,
      currency: 'VND',
      customerCount: 10,
      onlinePartnerCount: 4,
      partnerCount: 8,
      regionCode: 'hcm',
      regionName: 'Ho Chi Minh',
      revenueAmount: 300_000,
      shortName: 'HCM',
    },
  ],
  totals: {
    activeBookingCount: 1,
    activeCustomerCount: 2,
    cancellationCount: 0,
    completedBookingCount: 3,
    currency: 'VND',
    customerCount: 10,
    onlinePartnerCount: 4,
    partnerCount: 8,
    revenueAmount: 300_000,
  },
};
