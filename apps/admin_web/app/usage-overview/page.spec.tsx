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
    expect(pageSource).toContain('baseClassName="usage-overview-segment-board-item"');
    expect(pageSource).not.toContain('<AdminCard key={label} className={`usage-overview-segment-board-item');
    expect(markup).toContain('card admin-section usage-overview-action-card');
    expect(markup).toContain('admin-section-body usage-overview-action-list');
    expect(markup).toContain('card admin-card usage-overview-action-item');
    expect(markup).not.toContain('<article class="card admin-card usage-overview-action-item');
    expect(pageSource).toContain('baseClassName="usage-overview-action-item"');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-action-item');
    expect(markup).toContain('card admin-kpi-card usage-overview-kpi-card');
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
    expect(pageSource).not.toContain('<section className="usage-overview-group"');
    expect(pageSource).toContain('AdminCardGrid');
    expect(pageSource).not.toContain('<div className="usage-overview-payment-mix"');
    expect(pageSource).not.toContain('<div key={row.method} className="usage-overview-payment-row"');
    expect(pageSource).toContain('AdminOverviewGroup');
    expect(pageSource).toContain('StatusBadge');
    expect(pageSource).toContain('DateTimeText');
    expect(pageSource).toContain('AdminTextLink');
    expect(pageSource).not.toContain('<a href={row.href}>{row.label}</a>');
    expect(pageSource).not.toContain('formatDateTime,');
    expect(pageSource).not.toContain('const generatedAt = formatDateTime(overview.generatedAt);');
    expect(pageSource).not.toContain('Last active ${formatDateTime(row.lastActivityAt)}');
    expect(pageSource).not.toContain('<time>{row.lastActivityAt ? formatDateTime(row.lastActivityAt) :');
    expect(pageSource).not.toContain('function formatDateTime(value: string)');
    expect(pageSource).not.toContain('<AdminCard className={`usage-overview-command-card is-${tone}`}');
    expect(pageSource).not.toContain('<span className="pill pill-success">Vietnam only</span>');
    expect(pageSource).not.toContain('<span className="pill pill-info">Generated {generatedAt}</span>');
    expect(pageSource).not.toContain('empty-state usage-overview-empty-state');
    expect(pageSource).not.toContain('<div className="empty-state');
  });

  it('renders usage summary and segment KPIs through the shared AdminKpiCard surface', async () => {
    const page = await UsageOverviewPage({
      searchParams: Promise.resolve({ range: '7d' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(pageSource).toContain('AdminKpiCard');
    expect(pageSource).toContain('<AdminKpiCard');
    expect(markup).toContain('card admin-kpi-card usage-overview-kpi-card');
    expect(markup).not.toContain('aria-label="Usage command summary"><div class="card admin-card usage-overview-command-card');
    expect(markup).not.toContain('aria-label="Customer usage segments"><div class="card admin-card usage-overview-command-card');
  });

  it('scopes mini metric typography and tones to direct metric children', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.usage-overview-mini-metric > span');
    expect(css).toContain('.usage-overview-mini-metric > strong');
    expect(css).toContain('.usage-overview-mini-metric.is-primary > strong');
    expect(css).toContain('.usage-overview-mini-metric.is-danger > strong');
    expect(css).not.toContain('.usage-overview-mini-metric span {');
    expect(css).not.toContain('.usage-overview-mini-metric strong {');
    expect(css).not.toContain('.usage-overview-mini-metric.is-primary strong');
    expect(css).not.toContain('.usage-overview-mini-metric.is-danger strong');
  });

  it('scopes platform, payment, and service row typography to their direct Vuexy slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.usage-overview-platform-main > div > strong');
    expect(css).toContain('.usage-overview-platform-main > div > small');
    expect(css).toContain('.usage-overview-platform-value > strong');
    expect(css).toContain('.usage-overview-platform-value > span');
    expect(css).toContain('.usage-overview-payment-row > div:first-child > span');
    expect(css).toContain('.usage-overview-payment-row > strong');
    expect(css).toContain('.usage-overview-payment-row > small');
    expect(css).toContain('.usage-overview-service-main > div > strong');
    expect(css).toContain('.usage-overview-service-main > div > small');
    expect(css).toContain('.usage-overview-service-metrics .admin-mini-metric > strong');

    expect(css).not.toContain('.usage-overview-platform-main strong {');
    expect(css).not.toContain('.usage-overview-platform-main small {');
    expect(css).not.toContain('.usage-overview-platform-value strong {');
    expect(css).not.toContain('.usage-overview-platform-value span {');
    expect(css).not.toContain('.usage-overview-payment-row span {');
    expect(css).not.toContain('.usage-overview-payment-row strong {');
    expect(css).not.toContain('.usage-overview-payment-row small {');
    expect(css).not.toContain('.usage-overview-service-main strong {');
    expect(css).not.toContain('.usage-overview-service-main small {');
    expect(css).not.toContain('.usage-overview-service-metrics strong {');
  });

  it('scopes discovery, ranking, region, and hourly row typography to direct Vuexy slots', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.usage-overview-discovery-rates > span');
    expect(css).toContain('.usage-overview-discovery-metrics .admin-mini-metric > strong');
    expect(css).toContain('.usage-overview-discovery-row > time');
    expect(css).toContain('.usage-overview-group-heading > span');
    expect(css).toContain('.usage-overview-group-heading > strong');
    expect(css).toContain('.usage-overview-row-value > strong');
    expect(css).toContain('.usage-overview-row-value > span');
    expect(css).toContain('.usage-overview-ranking-row > time');
    expect(css).toContain('.usage-overview-region-metrics .admin-mini-metric > strong');
    expect(css).toContain('.usage-overview-hour-row > div:first-child > strong');
    expect(css).toContain('.usage-overview-hour-row > div:first-child > span');

    expect(css).not.toContain('.usage-overview-discovery-rates span {');
    expect(css).not.toContain('.usage-overview-discovery-metrics strong {');
    expect(css).not.toContain('.usage-overview-discovery-row time {');
    expect(css).not.toContain('.usage-overview-group-heading span {');
    expect(css).not.toContain('.usage-overview-group-heading strong {');
    expect(css).not.toContain('.usage-overview-row-value strong {');
    expect(css).not.toContain('.usage-overview-row-value span,');
    expect(css).not.toContain('.usage-overview-ranking-row time {');
    expect(css).not.toContain('.usage-overview-region-metrics strong {');
    expect(css).not.toContain('.usage-overview-hour-row > div:first-child strong {');
    expect(css).not.toContain('.usage-overview-hour-row > div:first-child span {');
  });
});
