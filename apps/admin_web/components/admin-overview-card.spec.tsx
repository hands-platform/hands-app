import { renderToStaticMarkup } from 'react-dom/server';

import { AdminOverviewCommandCard, AdminOverviewCommandGrid, AdminOverviewGrid } from './admin-overview-card';

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
});
