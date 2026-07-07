import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AdminMiniMetricStrip,
  AdminOverviewCommandCard,
  AdminOverviewCommandGrid,
  AdminOverviewGrid,
  AdminOverviewGroup,
  AdminProfileOverviewCard,
  AdminSummaryCardGrid,
  AdminTraceSummary,
} from './admin-overview-card';

describe('AdminOverviewCommandCard', () => {
  it('renders the shared Vuexy overview command grid shell', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewCommandGrid ariaLabel="Finance command board" className="finance-list-command-board admin-mb-16">
        <span>Card slot</span>
      </AdminOverviewCommandGrid>,
    );

    expect(markup).toContain(
      'class="usage-overview-command-grid finance-list-command-board admin-mb-16"',
    );
    expect(markup).toContain('aria-label="Finance command board"');
    expect(markup).toContain('<span>Card slot</span>');
  });

  it('allows overview pages to supply a scoped command grid class', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewCommandGrid
        ariaLabel="Finance command board"
        baseClassName="finance-overview-command-grid"
        className="finance-overview-control-board"
      >
        <span>Card slot</span>
      </AdminOverviewCommandGrid>,
    );

    expect(markup).toContain(
      'class="finance-overview-command-grid finance-overview-control-board"',
    );
    expect(markup).not.toContain('usage-overview-command-grid');
    expect(markup).toContain('aria-label="Finance command board"');
  });

  it('renders shared overview grid variants for segment and insight layouts', () => {
    const segmentMarkup = renderToStaticMarkup(
      <AdminOverviewGrid ariaLabel="Customer segments" variant="segment">
        <span>Segment slot</span>
      </AdminOverviewGrid>,
    );
    const insightMarkup = renderToStaticMarkup(
      <AdminOverviewGrid ariaLabel="Partner quality" className="partner-overview-quality-grid" variant="insight">
        <span>Insight slot</span>
      </AdminOverviewGrid>,
    );

    expect(segmentMarkup).toContain('class="usage-overview-segment-grid"');
    expect(segmentMarkup).toContain('aria-label="Customer segments"');
    expect(insightMarkup).toContain('class="usage-overview-insight-grid partner-overview-quality-grid"');
    expect(insightMarkup).toContain('aria-label="Partner quality"');
  });

  it('renders the shared Vuexy overview command card structure', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewCommandCard
        className="is-primary"
        detail="Active customers in the selected range"
        icon={<svg aria-hidden="true" />}
        label="Active customers"
        value="42"
      />,
    );

    expect(markup).toContain('class="card admin-card usage-overview-command-card is-primary"');
    expect(markup).toContain('class="usage-overview-command-icon"');
    expect(markup).toContain('Active customers');
    expect(markup).toContain('<strong>42</strong>');
    expect(markup).toContain('<small>Active customers in the selected range</small>');
  });

  it('allows overview pages to supply scoped command card and icon classes', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewCommandCard
        baseClassName="partner-overview-command-card"
        iconClassName="partner-overview-command-icon"
        className="is-success"
        detail="Ready Partners in the selected range"
        icon={<svg aria-hidden="true" />}
        label="Ready supply"
        value="12"
      />,
    );

    expect(markup).toContain('class="card admin-card partner-overview-command-card is-success"');
    expect(markup).toContain('class="partner-overview-command-icon"');
    expect(markup).not.toContain('usage-overview-command-card');
    expect(markup).not.toContain('usage-overview-command-icon');
  });

  it('keeps optional action content inside the shared card body', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewCommandCard
        icon={<svg aria-hidden="true" />}
        label="Repeat customers"
        value="12"
      >
        <a href="/customers">Open list</a>
      </AdminOverviewCommandCard>,
    );

    expect(markup).toContain('class="card admin-card usage-overview-command-card"');
    expect(markup).not.toContain('<small>');
    expect(markup).toContain('<a href="/customers">Open list</a>');
  });

  it('renders a link card when an href is provided', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewCommandCard
        className="is-warning"
        detail="Open the bounded evidence list"
        href="/finance-tax/payment-clearing"
        icon={<svg aria-hidden="true" />}
        label="Payment clearing"
        trailing={<em>120.000 VND</em>}
        value="3"
      />,
    );

    expect(markup).toContain('class="card admin-card usage-overview-command-card is-warning"');
    expect(markup).toContain('href="/finance-tax/payment-clearing"');
    expect(markup).toContain('<strong>3</strong>');
    expect(markup).toContain('<em>120.000 VND</em>');
  });

  it('renders shared mini metric strips for overview cards', () => {
    const markup = renderToStaticMarkup(
      <AdminMiniMetricStrip
        className="usage-overview-payment-summary"
        itemClassName="usage-overview-mini-metric"
        metrics={[
          { label: 'Coupon bookings', tone: 'info', value: '12' },
          { label: 'Failed payments', tone: 'danger', value: '2' },
        ]}
      />,
    );

    expect(markup).toContain('class="admin-mini-metric-strip usage-overview-payment-summary"');
    expect(markup).toContain('class="admin-mini-metric usage-overview-mini-metric is-info"');
    expect(markup).toContain('<span>Coupon bookings</span>');
    expect(markup).toContain('<strong>12</strong>');
  });

  it('keeps shared mini metrics on the Vuexy compact surface token contract', () => {
    const globals = readFileSync('app/globals.css', 'utf8');
    const metricBlock = cssRuleBlock(globals, '.admin-mini-metric {');
    const metricLabelBlock = cssRuleBlock(globals, '.admin-mini-metric > span {');
    const metricValueBlock = cssRuleBlock(globals, '.admin-mini-metric > strong {');

    expect(metricBlock).toContain('background: rgb(var(--admin-surface-channel) / 0.7);');
    expect(metricBlock).toContain('border: 1px solid var(--admin-border);');
    expect(metricBlock).toContain('border-radius: var(--admin-radius-sm);');
    expect(metricBlock).toContain('display: grid;');
    expect(metricBlock).toContain('padding: 8px 10px;');
    expect(metricLabelBlock).toContain('color: var(--admin-muted);');
    expect(metricLabelBlock).toContain('font-size: 11px;');
    expect(metricValueBlock).toContain('font-feature-settings: "tnum" 1;');
    expect(metricValueBlock).toContain('font-variant-numeric: tabular-nums;');
    expect(cssRuleBlock(globals, '.admin-mini-metric span {')).toBe('');
    expect(cssRuleBlock(globals, '.admin-mini-metric strong {')).toBe('');
  });

  it('renders shared summary card grids with Vuexy card surfaces', () => {
    const markup = renderToStaticMarkup(
      <AdminSummaryCardGrid
        ariaLabel="Selected filters"
        className="vietnam-overview-filter-summary-grid"
        itemClassName="vietnam-overview-filter-summary-card"
        items={[
          { detail: 'Realtime dots stay current.', label: 'Range', tone: 'info', value: 'Today' },
          {
            href: '/vietnam-overview?signals=online',
            key: 'ready',
            label: 'Ready partners',
            overline: 'Realtime',
            tone: 'success',
            value: '42',
          },
        ]}
      />,
    );

    expect(markup).toContain('class="admin-summary-card-grid vietnam-overview-filter-summary-grid"');
    expect(markup).toContain(
      'class="card admin-card admin-summary-card vietnam-overview-filter-summary-card is-info"',
    );
    expect(markup).toContain('<span>Range</span><strong>Today</strong><small>Realtime dots stay current.</small>');
    expect(markup).toContain(
      'class="card admin-card admin-summary-card vietnam-overview-filter-summary-card is-success"',
    );
    expect(markup).toContain('href="/vietnam-overview?signals=online"');
    expect(markup).toContain('<small>Realtime</small><strong>42</strong><span>Ready partners</span>');
  });

  it('keeps shared summary cards on the Vuexy card rhythm token contract', () => {
    const globals = readFileSync('app/globals.css', 'utf8');
    const gridBlock = cssRuleBlock(globals, '.admin-summary-card-grid {');
    const cardBlock = cssRuleBlock(globals, '.admin-summary-card {');
    const textBlock = cssRuleBlock(globals, '.admin-summary-card > span,');
    const valueBlock = cssRuleBlock(globals, '.admin-summary-card > strong {');

    expect(gridBlock).toContain('display: grid;');
    expect(gridBlock).toContain('gap: 12px;');
    expect(gridBlock).toContain('grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));');
    expect(cardBlock).toContain('display: grid;');
    expect(cardBlock).toContain('gap: 6px;');
    expect(cardBlock).toContain('min-width: 0;');
    expect(textBlock).toContain('.admin-summary-card > small');
    expect(valueBlock).toContain('font-feature-settings: "tnum" 1;');
    expect(valueBlock).toContain('font-variant-numeric: tabular-nums;');
    expect(globals).not.toContain('.admin-summary-card strong {');
    expect(globals).not.toContain('.admin-summary-card span,\n.admin-summary-card small {');
  });

  it('renders summary card detail dates through the shared DateTimeText atom', () => {
    const source = readFileSync('components/admin-overview-card.tsx', 'utf8');
    const markup = renderToStaticMarkup(
      <AdminSummaryCardGrid
        items={[
          {
            detail: 'Latest not set.',
            detailDateTimePrefix: 'Latest ',
            detailDateTimeSuffix: '.',
            detailDateTimeValue: '2026-06-19T03:00:00.000Z',
            label: 'App sessions',
            value: '3',
          },
        ]}
      />,
    ).replace(/\s+/g, ' ');

    expect(source).toContain('summaryCardDetail(item)');
    expect(markup.match(/class="date-time-text"/g)).toHaveLength(1);
    expect(markup).toContain('<small>Latest <time');
    expect(markup).toContain('dateTime="2026-06-19T03:00:00.000Z"');
  });

  it('renders shared trace summary metrics for finance and operations strips', () => {
    const markup = renderToStaticMarkup(
      <AdminTraceSummary
        className="admin-mt-12"
        metrics={[
          { label: 'Gross', value: '1.200.000 VND', detail: 'Customer charge represented.' },
          { label: 'Cash debt', value: '80.000 VND' },
        ]}
      />,
    );

    expect(markup).toContain('class="service-trace-summary admin-mt-12"');
    expect(markup).toContain('<span>Gross</span>');
    expect(markup).toContain('<strong>1.200.000 VND</strong>');
    expect(markup).toContain('<small>Customer charge represented.</small>');
    expect(markup).toContain('<span>Cash debt</span>');
  });

  it('keeps shared trace summaries on the Vuexy linked card token contract', () => {
    const globals = readFileSync('app/globals.css', 'utf8');
    const itemBlock = cssRuleBlock(globals, '.service-trace-summary > div,\n.service-trace-summary > a {');
    const hoverBlock = cssRuleBlock(globals, '.service-trace-summary > a:hover,\n.service-trace-summary > a:focus-visible {');
    const valueBlock = cssRuleBlock(globals, '.service-trace-summary strong {');

    expect(itemBlock).toContain('min-width: 0;');
    expect(itemBlock).toContain('transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;');
    expect(hoverBlock).toContain('border-color: rgb(var(--admin-primary-channel) / 0.45);');
    expect(hoverBlock).toContain('box-shadow: var(--admin-shadow-md);');
    expect(hoverBlock).toContain('transform: translateY(-1px);');
    expect(valueBlock).toContain('font-feature-settings: "tnum" 1;');
    expect(valueBlock).toContain('font-variant-numeric: tabular-nums;');
  });

  it('renders trace summary metric dates through the shared DateTimeText atom', () => {
    const source = readFileSync('components/admin-overview-card.tsx', 'utf8');
    const markup = renderToStaticMarkup(
      <AdminTraceSummary
        metrics={[
          {
            detail: 'Oldest loaded: Not set',
            detailDateTimePrefix: 'Oldest loaded: ',
            detailDateTimeValue: '2026-06-19T01:00:00.000Z',
            label: 'Range',
            value: 'Not set',
            valueDateTimeValue: '2026-06-19T03:00:00.000Z',
          },
        ]}
      />,
    ).replace(/\s+/g, ' ');

    expect(source).toContain("import { DateTimeText } from './date-time-text';");
    expect(markup.match(/class="date-time-text"/g)).toHaveLength(2);
    expect(markup).toContain('<strong><time');
    expect(markup).toContain('dateTime="2026-06-19T03:00:00.000Z"');
    expect(markup).toContain('<small>Oldest loaded: <time');
    expect(markup).toContain('dateTime="2026-06-19T01:00:00.000Z"');
  });

  it('renders trace summary metrics as links when href is provided', () => {
    const markup = renderToStaticMarkup(
      <AdminTraceSummary
        metrics={[
          {
            detail: 'Jump to retained evidence.',
            href: '#booking-activity',
            label: 'Activity',
            value: '12',
          },
        ]}
      />,
    );

    expect(markup).toContain('class="service-trace-summary"');
    expect(markup).toContain('<a href="#booking-activity">');
    expect(markup).toContain('<span>Activity</span>');
    expect(markup).toContain('<strong>12</strong>');
    expect(markup).toContain('<small>Jump to retained evidence.</small>');
  });

  it('merges per-metric class names onto trace summary link items', () => {
    const markup = renderToStaticMarkup(
      <AdminTraceSummary
        itemClassName="ops-task-breakdown-item"
        metrics={[
          {
            className: 'ops-task-breakdown-danger',
            detail: 'Cash debt needs action.',
            href: '/partners?review=cash-debt',
            label: 'Cash debt',
            value: '2',
          },
        ]}
      />,
    );

    expect(markup).toContain(
      'class="ops-task-breakdown-item ops-task-breakdown-danger" href="/partners?review=cash-debt"',
    );
  });

  it('renders trace summary metric actions when provided', () => {
    const markup = renderToStaticMarkup(
      <AdminTraceSummary
        metrics={[
          {
            action: <a href="#record">Open</a>,
            detail: 'Connected record evidence.',
            label: 'Activity',
            value: '12',
          },
        ]}
      />,
    );

    expect(markup).toContain('class="service-trace-summary"');
    expect(markup).toContain('<small>Connected record evidence.</small>');
    expect(markup).toContain('<a href="#record">Open</a>');
  });

  it('renders shared overview groups with Vuexy heading structure', () => {
    const markup = renderToStaticMarkup(
      <AdminOverviewGroup
        eyebrow="Customer behavior"
        title="Who is active and who completed work"
      >
        <span>Ranking slot</span>
      </AdminOverviewGroup>,
    );

    expect(markup).toContain('class="usage-overview-group"');
    expect(markup).toContain('class="usage-overview-group-heading"');
    expect(markup).toContain('<span>Customer behavior</span>');
    expect(markup).toContain('<strong>Who is active and who completed work</strong>');
    expect(markup).toContain('<span>Ranking slot</span>');
  });

  it('renders a shared profile overview card shell', () => {
    const markup = renderToStaticMarkup(
      <AdminProfileOverviewCard className="customer-detail-overview-card">
        <span>Profile slot</span>
      </AdminProfileOverviewCard>,
    );

    expect(markup).toContain('class="card admin-card admin-profile-overview-card customer-detail-overview-card"');
    expect(markup).toContain('<span>Profile slot</span>');
  });
});

function cssRuleBlock(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|\\n)${escapedSelector}`).exec(source);
  if (!match || match.index < 0) {
    return '';
  }

  const index = match.index + (match[1] ? match[1].length : 0);
  const endIndex = source.indexOf('}', index);
  return source.slice(index, endIndex + 1);
}
