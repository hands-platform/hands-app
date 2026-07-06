import { renderToStaticMarkup } from 'react-dom/server';

import { AdminIconLink } from './admin-icon-link';

describe('AdminIconLink', () => {
  it('renders a shared Vuexy icon link atom with deduplicated topbar classes', () => {
    const html = renderToStaticMarkup(
      <AdminIconLink aria-label="Help" className="topbar-icon-chip topbar-icon-chip" href="/operations-policy">
        Icon
      </AdminIconLink>,
    );

    expect(html).toContain('aria-label="Help"');
    expect(html).toContain('href="/operations-policy"');
    expect(html).toContain('class="admin-icon-button topbar-icon-chip"');
  });
});
