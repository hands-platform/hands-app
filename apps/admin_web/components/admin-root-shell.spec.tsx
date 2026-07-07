import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminNavSections } from '../lib/admin-navigation';
import { AdminRootShell } from './admin-root-shell';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => new URLSearchParams(),
}));

describe('AdminRootShell', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/bookings');
  });

  it('renders the operations shell for authenticated workspace pages', () => {
    const markup = renderToStaticMarkup(
      <AdminRootShell sections={adminNavSections}>
        <div>Workspace content</div>
      </AdminRootShell>,
    );

    expect(markup).toContain('class="shell"');
    expect(markup).toContain('class="sidebar"');
    expect(markup).toContain('id="admin-mobile-sidebar"');
    expect(markup).toContain('aria-label="Admin navigation"');
    expect(markup).toContain('class="sidebar-backdrop"');
    expect(markup).toContain('class="sidebar-close-button"');
    expect(markup).toContain('topbar-mobile-menu-button');
    expect(markup).toContain('aria-controls="admin-mobile-sidebar"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Workspace content');
  });

  it('renders login as an auth-only page without sidebar or navbar chrome', () => {
    mockUsePathname.mockReturnValue('/login');

    const markup = renderToStaticMarkup(
      <AdminRootShell sections={adminNavSections}>
        <div>Login content</div>
      </AdminRootShell>,
    );

    expect(markup).toContain('class="auth-shell"');
    expect(markup).toContain('Login content');
    expect(markup).not.toContain('class="sidebar"');
    expect(markup).not.toContain('aria-label="Admin navigation"');
    expect(markup).not.toContain('class="topbar vuexy-navbar"');
  });
});
