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

  it('defers the MapLibre live map bundle behind a dynamic boundary', () => {
    expect(pageSource).toContain("import dynamicComponent from 'next/dynamic';");
    expect(pageSource).toContain("import type { VietnamOverviewLiveMapProps } from './vietnam-overview-live-map';");
    expect(pageSource).toContain('const VietnamOverviewLiveMap = dynamicComponent<VietnamOverviewLiveMapProps>(');
    expect(pageSource).toContain("() => import('./vietnam-overview-live-map').then((mod) => mod.VietnamOverviewLiveMap)");
    expect(pageSource).not.toContain("import { VietnamOverviewLiveMap } from './vietnam-overview-live-map';");
  });

  it('renders the realtime map and period report with shared Vuexy section surfaces', async () => {
    const page = await VietnamOverviewPage({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/vietnam-overview/summary?range=today', expect.any(Object));
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/vietnam-overview/realtime-points?take=50', expect.any(Object));
    expect(markup).toContain('Vietnam Overview');
    expect(markup).toContain('admin-page-header admin-page-header-toolbar');
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
    expect(markup).toContain('card admin-filter-panel vietnam-overview-filter-panel admin-section');
    expect(markup).toContain('card admin-card admin-summary-card vietnam-overview-filter-summary-card');
    expect(markup).not.toContain('<article class="vietnam-overview-filter-summary-card');
    expect(pageSource).toContain('AdminSummaryCardGrid');
    expect(pageSource).not.toContain('<div className="vietnam-overview-filter-summary-grid"');
    expect(pageSource).not.toContain('<div className="vietnam-region-focus-summary-items is-realtime">');
    expect(pageSource).not.toContain('<div className="vietnam-region-focus-summary-items is-period">');
    expect(markup).not.toContain('card admin-section vietnam-overview-filter-panel');
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

  it('scopes realtime dashboard typography to direct Vuexy card slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-realtime-chart-header > div > h2');
    expect(css).toContain('.vietnam-realtime-chart-header > div > p');
    expect(css).toContain('.vietnam-realtime-widget-copy > span');
    expect(css).toContain('.vietnam-realtime-widget-copy > strong');
    expect(css).toContain('.vietnam-realtime-widget-copy > small');
    expect(css).toContain('.vietnam-realtime-signal-label > span');
    expect(css).toContain('.vietnam-realtime-signal-label > strong');
    expect(css).toContain('.vietnam-realtime-region-row > span');
    expect(css).toContain('.vietnam-realtime-region-row > div');
    expect(css).toContain('.vietnam-realtime-region-row > div > strong');
    expect(css).toContain('.vietnam-realtime-region-row > div > small');
    expect(css).toContain('.vietnam-realtime-region-row > em');
    expect(css).not.toContain('.vietnam-realtime-chart-header h2');
    expect(css).not.toContain('.vietnam-realtime-chart-header p');
    expect(css).not.toContain('.vietnam-realtime-widget-copy span {');
    expect(css).not.toContain('.vietnam-realtime-widget-copy strong {');
    expect(css).not.toContain('.vietnam-realtime-widget-copy small {');
    expect(css).not.toContain('.vietnam-realtime-signal-label span {');
    expect(css).not.toContain('.vietnam-realtime-signal-label strong {');
    expect(css).not.toContain('.vietnam-realtime-region-row span {');
    expect(css).not.toContain('.vietnam-realtime-region-row div {');
    expect(css).not.toContain('.vietnam-realtime-region-row strong {');
    expect(css).not.toContain('.vietnam-realtime-region-row small {');
    expect(css).not.toContain('.vietnam-realtime-region-row em {');
  });

  it('scopes realtime widget tones to direct icon and meter slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-realtime-widget-meter > i');
    expect(css).not.toContain('.vietnam-realtime-widget-meter i {');

    for (const tone of ['success', 'warning', 'danger', 'info', 'neutral']) {
      expect(css).toContain(`.vietnam-realtime-widget.is-${tone} > .vietnam-realtime-widget-icon`);
      expect(css).toContain(`.vietnam-realtime-widget.is-${tone} > .vietnam-realtime-widget-meter > i`);
      expect(css).not.toContain(`.vietnam-realtime-widget.is-${tone} .vietnam-realtime-widget-icon`);
      expect(css).not.toContain(`.vietnam-realtime-widget.is-${tone} .vietnam-realtime-widget-meter i`);
    }
  });

  it('scopes region load typography and meter tones to direct slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-region-load-header > span');
    expect(css).toContain('.vietnam-region-load-header > strong');
    expect(css).toContain('.vietnam-region-load-bar > i');
    expect(css).not.toContain('.vietnam-region-load-header span {');
    expect(css).not.toContain('.vietnam-region-load-header strong {');
    expect(css).not.toContain('.vietnam-region-load-bar i {');

    for (const tone of ['high', 'medium', 'low']) {
      expect(css).toContain(`.vietnam-region-load.is-${tone} > .vietnam-region-load-header > span`);
      expect(css).toContain(`.vietnam-region-load.is-${tone} > .vietnam-region-load-bar > i`);
      expect(css).not.toContain(`.vietnam-region-load.is-${tone} .vietnam-region-load-header span`);
      expect(css).not.toContain(`.vietnam-region-load.is-${tone} .vietnam-region-load-bar i`);
    }
  });

  it('scopes map legend and cluster drawer typography to direct children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-map-dot-legend-header > div');
    expect(css).toContain('.vietnam-map-dot-legend-header > div > strong');
    expect(css).toContain('.vietnam-map-dot-legend-header > div > span');
    expect(css).toContain('.vietnam-map-dot-legend-header > small');
    expect(css).toContain('.vietnam-map-signal-filter-copy > span');
    expect(css).toContain('.vietnam-map-signal-filter-copy > small');
    expect(css).toContain('.vietnam-map-signal-filter > strong');
    expect(css).toContain('.vietnam-map-cluster-operator-read > span');
    expect(css).toContain('.vietnam-map-cluster-operator-read > strong');
    expect(css).toContain('.vietnam-map-cluster-operator-read > small');
    expect(css).toContain('.vietnam-map-cluster-latest > div');
    expect(css).toContain('.vietnam-map-cluster-latest > div > small');
    expect(css).toContain('.vietnam-map-cluster-latest > div > strong');
    expect(css).toContain('.vietnam-map-cluster-latest > div > span');
    expect(css).toContain('.vietnam-map-cluster-summary-card > span');
    expect(css).toContain('.vietnam-map-cluster-summary-card > strong');
    expect(css).toContain('.vietnam-map-cluster-events-header > div');
    expect(css).toContain('.vietnam-map-cluster-events-header > div > strong');
    expect(css).toContain('.vietnam-map-cluster-events-header > div > span');
    expect(css).toContain('.vietnam-map-cluster-events-header > small');
    expect(css).toContain('.vietnam-map-cluster-event > div');
    expect(css).toContain('.vietnam-map-cluster-event > div > strong');
    expect(css).toContain('.vietnam-map-cluster-event > div > span');
    expect(css).toContain('.vietnam-map-cluster-event > div > small');
    expect(css).toContain('.vietnam-map-cluster-event > div > p');
    expect(css).toContain('.vietnam-map-cluster-event-meta > span');

    expect(css).not.toContain('.vietnam-map-dot-legend-header div {');
    expect(css).not.toContain('.vietnam-map-dot-legend-header strong {');
    expect(css).not.toContain('.vietnam-map-dot-legend-header span,');
    expect(css).not.toContain('.vietnam-map-dot-legend-header small {');
    expect(css).not.toContain('.vietnam-map-signal-filter-copy span {');
    expect(css).not.toContain('.vietnam-map-signal-filter-copy small {');
    expect(css).not.toContain('.vietnam-map-signal-filter strong {');
    expect(css).not.toContain('.vietnam-map-cluster-operator-read span {');
    expect(css).not.toContain('.vietnam-map-cluster-operator-read strong {');
    expect(css).not.toContain('.vietnam-map-cluster-operator-read small {');
    expect(css).not.toContain('.vietnam-map-cluster-latest div {');
    expect(css).not.toContain('.vietnam-map-cluster-latest strong {');
    expect(css).not.toContain('.vietnam-map-cluster-latest span {');
    expect(css).not.toContain('.vietnam-map-cluster-summary-card span {');
    expect(css).not.toContain('.vietnam-map-cluster-summary-card strong {');
    expect(css).not.toContain('.vietnam-map-cluster-events-header div {');
    expect(css).not.toContain('.vietnam-map-cluster-events-header strong {');
    expect(css).not.toContain('.vietnam-map-cluster-events-header span,');
    expect(css).not.toContain('.vietnam-map-cluster-events-header small {');
    expect(css).not.toContain('.vietnam-map-cluster-event div {');
    expect(css).not.toContain('.vietnam-map-cluster-event strong {');
    expect(css).not.toContain('.vietnam-map-cluster-event span {');
    expect(css).not.toContain('.vietnam-map-cluster-event small {');
    expect(css).not.toContain('.vietnam-map-cluster-event p {');
    expect(css).not.toContain('.vietnam-map-cluster-event-meta span {');
  });

  it('scopes map cluster context and empty-state typography to direct slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-map-cluster-context-card > span');
    expect(css).toContain('.vietnam-map-cluster-context-card > strong');
    expect(css).toContain('.vietnam-map-cluster-context-card > strong > svg');
    expect(css).toContain('.vietnam-map-cluster-context-card > small');
    expect(css).toContain('.vietnam-map-empty-stats > span');
    expect(css).toContain('.vietnam-map-empty-stats > span > strong');
    expect(css).not.toContain('.vietnam-map-cluster-context-card span {');
    expect(css).not.toContain('.vietnam-map-cluster-context-card strong {');
    expect(css).not.toContain('.vietnam-map-cluster-context-card strong svg {');
    expect(css).not.toContain('.vietnam-map-cluster-context-card small {');
    expect(css).not.toContain('.vietnam-map-empty-stats span {');
    expect(css).not.toContain('.vietnam-map-empty-stats strong {');
    expect(css).not.toContain('.vietnam-map-empty-stats span,');
  });

  it('scopes regional table signal chips to direct slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-region-signal-row > span');
    expect(css).toContain('.vietnam-region-signal-row > span > strong');
    expect(css).toContain('.vietnam-region-signal-row > span > small');
    expect(css).toContain('.vietnam-region-signal-row > span > i');
    expect(css).not.toContain('.vietnam-region-signal-row span {');
    expect(css).not.toContain('.vietnam-region-signal-row strong {');
    expect(css).not.toContain('.vietnam-region-signal-row small {');
    expect(css).not.toContain('.vietnam-region-signal-row i {');

    for (const tone of ['active', 'online', 'bookings']) {
      expect(css).toContain(`.vietnam-region-signal-row > .is-${tone}`);
      expect(css).toContain(`.vietnam-region-signal-row > .is-${tone} > i`);
      expect(css).not.toContain(`.vietnam-region-signal-row .is-${tone} {`);
      expect(css).not.toContain(`.vietnam-region-signal-row .is-${tone} i`);
    }
  });

  it('scopes region focus and insight card typography to direct slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-region-focus-summary-group-label > strong');
    expect(css).toContain('.vietnam-region-focus-summary-group-label > span');
    expect(css).toContain('.vietnam-region-focus-summary-item > small');
    expect(css).toContain('.vietnam-region-focus-summary-item > strong');
    expect(css).toContain('.vietnam-region-focus-summary-item > span');
    expect(css).toContain('.vietnam-overview-region-insight-card > span');
    expect(css).toContain('.vietnam-overview-region-insight-card > strong');
    expect(css).toContain('.vietnam-overview-region-insight-card > small');
    expect(css).toContain('.vietnam-region-number-cell > strong');
    expect(css).not.toContain('.vietnam-region-focus-summary-group-label strong {');
    expect(css).not.toContain('.vietnam-region-focus-summary-group-label span {');
    expect(css).not.toContain('.vietnam-region-focus-summary-item small {');
    expect(css).not.toContain('.vietnam-region-focus-summary-item strong {');
    expect(css).not.toContain('.vietnam-region-focus-summary-item span {');
    expect(css).not.toContain('.vietnam-overview-region-insight-card span {');
    expect(css).not.toContain('.vietnam-overview-region-insight-card strong {');
    expect(css).not.toContain('.vietnam-overview-region-insight-card small {');
    expect(css).not.toContain('.vietnam-region-number-cell strong {');
  });

  it('scopes realtime signal dot and track tones to direct slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.vietnam-realtime-signal-label > i');
    expect(css).toContain('.vietnam-realtime-signal-track > i');
    expect(css).not.toContain('.vietnam-realtime-signal-label i {');
    expect(css).not.toContain('.vietnam-realtime-signal-track i {');

    for (const tone of ['active', 'customers', 'online', 'stale-partners', 'offline-partners', 'bookings']) {
      expect(css).toContain(`.vietnam-realtime-signal-row.is-${tone} > .vietnam-realtime-signal-label > i`);
      expect(css).toContain(`.vietnam-realtime-signal-row.is-${tone} > .vietnam-realtime-signal-track > i`);
      expect(css).not.toContain(`.vietnam-realtime-signal-row.is-${tone} .vietnam-realtime-signal-label i`);
      expect(css).not.toContain(`.vietnam-realtime-signal-row.is-${tone} .vietnam-realtime-signal-track i`);
    }
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
  regionalSampleLimit: 50,
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
