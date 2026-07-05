import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import UsageOverviewPage from './page';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('UsageOverviewPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('renders usage overview from the bounded summary API with shared Vuexy section surfaces', async () => {
    const page = await UsageOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/usage-overview?range=7d', expect.any(Object));
    expect(markup).toContain('Usage Overview');
    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('Customer app-to-booking funnel');
    expect(markup).toContain('Customer segments');
    expect(markup).toContain('Action priorities');
    expect(markup).toContain('card admin-section usage-overview-filter-panel');
    expect(markup).not.toContain('card admin-filter-panel usage-overview-filter-panel');
    expect(markup).toContain('card admin-section usage-overview-funnel-card');
    expect(markup).toContain('admin-section-body usage-overview-funnel-steps');
    expect(markup).toContain('card admin-card usage-overview-funnel-step');
    expect(markup).not.toContain('<article class="usage-overview-funnel-step');
    expect(markup).toContain('card admin-section usage-overview-segment-board-card');
    expect(markup).toContain('admin-section-body usage-overview-segment-board-grid');
    expect(markup).toContain('card admin-card usage-overview-segment-board-item');
    expect(markup).not.toContain('<article class="usage-overview-segment-board-item');
    expect(markup).toContain('card admin-section usage-overview-action-card');
    expect(markup).toContain('admin-section-body usage-overview-action-list');
    expect(markup).toContain('card admin-card usage-overview-action-item');
    expect(markup).not.toContain('<article class="card admin-card usage-overview-action-item');
    expect(markup).toContain('card admin-card usage-overview-command-card');
    expect(markup).not.toContain('<article class="card admin-card usage-overview-command-card');
    expect(markup).toContain('card admin-section usage-overview-platform-card');
    expect(markup).toContain('card admin-section usage-overview-discovery-card');
    expect(markup).toContain('card admin-section usage-overview-behavior-card');
    expect(markup).toContain('card admin-section usage-overview-insight-card');
    expect(markup).toContain('card admin-section usage-overview-ranking-card');
    expect(pageSource).not.toContain('<article key={label} className={`usage-overview-segment-board-item');
    expect(pageSource).not.toContain('<article key={row.platform} className="usage-overview-platform-row"');
    expect(pageSource).not.toContain('<article key={row.id} className="usage-overview-discovery-row"');
    expect(pageSource).not.toContain('<article key={row.id} className="usage-overview-service-row"');
    expect(pageSource).not.toContain('<article key={row.hour} className="usage-overview-hour-row"');
    expect(pageSource).not.toContain('<article key={row.regionCode} className="usage-overview-region-row"');
    expect(pageSource).not.toContain('<article key={`${title}-${row.id}`} className="usage-overview-ranking-row"');
    expect(pageSource).toContain('AdminEmptyState');
    expect(pageSource).toContain('AdminOverviewCommandCard');
    expect(pageSource).toContain('AdminOverviewCommandGrid');
    expect(pageSource).toContain('AdminOverviewGrid');
    expect(pageSource).toContain('AdminMiniMetricStrip');
    expect(pageSource).not.toContain('<div className="usage-overview-mini-metric');
    expect(pageSource).not.toContain('<div className="usage-overview-discovery-metrics"');
    expect(pageSource).not.toContain('<div className="usage-overview-service-metrics"');
    expect(pageSource).not.toContain('<div className="usage-overview-hour-metrics"');
    expect(pageSource).not.toContain('<div className="usage-overview-region-metrics"');
    expect(pageSource).not.toContain('<section className="usage-overview-grid"');
    expect(pageSource).not.toContain('<section className="usage-overview-command-grid"');
    expect(pageSource).not.toContain('<section className="usage-overview-segment-grid"');
    expect(pageSource).not.toContain('<section className="usage-overview-insight-grid"');
    expect(pageSource).not.toContain('<section className="usage-overview-behavior-grid"');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('formatDateTime,');
    expect(pageSource).not.toContain('function formatDateTime(value: string)');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${tone}`}');
    expect(pageSource).not.toContain('<span className="pill pill-success">Vietnam only</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {generatedAt}</span>');
    expect(pageSource).not.toContain('empty-state usage-overview-empty-state');
    expect(pageSource).not.toContain('<div className="empty-state');
  });
});
