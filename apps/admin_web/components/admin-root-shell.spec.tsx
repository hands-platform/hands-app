import { readFileSync } from 'node:fs';
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
    expect(markup).toContain('class="admin-skip-link"');
    expect(markup).toContain('href="#admin-main-content"');
    expect(markup).toContain('<main class="content" id="admin-main-content" tabindex="-1">');
    expect(markup).toContain('class="sidebar"');
    expect(markup).toContain('id="admin-mobile-sidebar"');
    expect(markup).toContain('aria-label="Admin navigation"');
    expect(markup).toContain('class="sidebar-backdrop"');
    expect(markup).toContain('class="sidebar-close-button"');
    expect(markup).toContain('topbar-mobile-menu-button');
    expect(markup).toContain('aria-controls="admin-mobile-sidebar"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Workspace content');
    expect(markup).toContain('aria-label="Operations Policy"');
    expect(markup).toContain('aria-label="Operation alerts, 0"');
    expect(markup).not.toContain('aria-label="Help"');
    expect(markup).not.toContain('class="workspace-page-title"');
    expect(markup).toContain('Vietnam Operations Map');
    expect(markup).not.toContain('Live Workspace');
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

  it('restores focus to settlement repair triggers after route-based drawers close', () => {
    const source = readFileSync('components/admin-root-shell.tsx', 'utf8');

    expect(source).toContain("'repairBookingId'");
    expect(source).toContain("sessionStorage.setItem(");
    expect(source).toContain("link)?.focus()");
  });

  it('restores focus after Website Content confirmations close', () => {
    const source = readFileSync('components/admin-root-shell.tsx', 'utf8');

    expect(source).toContain("'confirmPublish'");
    expect(source).toContain("'discardDraft'");
    expect(source).toContain("'deletePageId'");
    expect(source).toContain("'deleteSectionId'");
    expect(source).toContain("'rollbackRevisionId'");
  });
});
