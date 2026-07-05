import { renderToStaticMarkup } from 'react-dom/server';

import { AdminTopbarButton } from './admin-topbar-button';

describe('AdminTopbarButton', () => {
  it('renders the shared Vuexy navbar button atom with default button semantics', () => {
    const html = renderToStaticMarkup(
      <AdminTopbarButton className="topbar-search topbar-search-trigger topbar-search" aria-label="Search pages">
        Search
      </AdminTopbarButton>,
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Search pages"');
    expect(html).toContain('class="admin-topbar-button topbar-search topbar-search-trigger"');
  });
});
