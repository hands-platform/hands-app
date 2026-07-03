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
    expect(markup).toContain('card admin-section vietnam-overview-map-card');
    expect(markup).toContain('card admin-section vietnam-overview-filter-panel');
    expect(markup).not.toContain('card admin-filter-panel vietnam-overview-filter-panel');
    expect(markup).toContain('card admin-section vietnam-realtime-chart-card');
    expect(markup).toContain('card admin-section vietnam-overview-period-report-card');
    expect(markup).toContain('card admin-kpi-card vietnam-overview-metric');
    expect(markup).toContain('class="metric-card"');
    expect(markup).not.toContain('<article class="card admin-kpi-card metric-card vietnam-overview-metric');
    expect(markup).toContain('card admin-section vietnam-overview-region-card');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table vietnam-overview-table');
    expect(pageSource).toContain('AdminDataTable');
    expect(pageSource).toContain('AdminTableScroll');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('AdminKpiCard');
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
