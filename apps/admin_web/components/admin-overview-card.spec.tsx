import { renderToStaticMarkup } from 'react-dom/server';

import { AdminOverviewCommandCard } from './admin-overview-card';

describe('AdminOverviewCommandCard', () => {
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
});
