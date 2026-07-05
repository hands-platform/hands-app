import { renderToStaticMarkup } from 'react-dom/server';

import { AdminIconButton } from './admin-icon-button';

describe('AdminIconButton', () => {
  it('renders a shared Vuexy icon button atom with default button semantics', () => {
    const html = renderToStaticMarkup(
      <AdminIconButton aria-label="Open alerts" className="topbar-icon-chip topbar-icon-button topbar-icon-chip">
        Icon
      </AdminIconButton>,
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Open alerts"');
    expect(html).toContain('class="admin-icon-button topbar-icon-chip topbar-icon-button"');
  });

  it('allows submit usage for icon-only logout forms without changing the visual atom', () => {
    const html = renderToStaticMarkup(
      <AdminIconButton aria-label="Sign out" className="topbar-icon-chip topbar-icon-button" type="submit">
        Icon
      </AdminIconButton>,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('class="admin-icon-button topbar-icon-chip topbar-icon-button"');
  });
});
