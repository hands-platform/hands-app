import { readFileSync } from 'node:fs';
import { hrefMatchesPath } from '../lib/admin-nav-match';
import { adminNavSections } from '../lib/admin-navigation';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminShellNav } from './admin-shell-nav';
import { AdminWorkspaceHeader } from './admin-workspace-header';

const workspaceHeaderSource = readFileSync('components/admin-workspace-header.tsx', 'utf8');
const topbarSearchInputSourcePath = 'components/admin-topbar-search-input.tsx';
const themeToggleSource = readFileSync('components/admin-theme-toggle.tsx', 'utf8');

vi.mock('next/navigation', () => ({
  usePathname: () => '/partners',
  useSearchParams: () => new URLSearchParams(),
}));

describe('admin shell navigation', () => {
  it('matches route links, detail pages, and query-specific entries', () => {
    expect(hrefMatchesPath('/', '/', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings/cmq123', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings', 'view=attention')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings', 'view=marketplace')).toBe(true);
    expect(hrefMatchesPath('/bookings?view=attention', '/bookings', 'view=attention')).toBe(true);
    expect(hrefMatchesPath('/bookings?view=attention', '/bookings', 'view=marketplace')).toBe(false);
    expect(hrefMatchesPath('/bookings', '/bookings/completed', '')).toBe(false);
    expect(hrefMatchesPath('/bookings/completed', '/bookings/completed', '')).toBe(true);
    expect(hrefMatchesPath('/bookings/completed', '/bookings/completed', 'view=closeout')).toBe(true);
    expect(hrefMatchesPath('/bookings/post-match-cancellations', '/bookings/post-match-cancellations', '')).toBe(true);
    expect(
      hrefMatchesPath(
        '/bookings/post-match-cancellations',
        '/bookings/post-match-cancellations',
        'view=no-show',
      ),
    ).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners', 'review=kyc')).toBe(false);
    expect(hrefMatchesPath('/partners/overview', '/partners/overview', 'range=7d')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners/overview', 'range=7d')).toBe(false);
    expect(hrefMatchesPath('/partners?review=unapproved', '/partners', 'review=unapproved')).toBe(true);
    expect(hrefMatchesPath('/partners?review=unapproved', '/partners', 'review=unsettled')).toBe(false);
  });

  it('renders Vuexy-style grouped parent navigation with active state', () => {
    const html = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    expect(html).toContain('aria-label="Admin navigation"');
    expect(html).toContain('nav-section-summary');
    expect(html).toContain('nav-section-count-slot');
    expect(html).toContain('nav-section-chevron');
    expect(html).not.toContain('items need review');
    expect(html).toContain('data-active="true"');
    expect(html).toContain('href="/partners"');
    expect(html).toContain('Partner Referrals');
    expect(html).toContain('Admin Operators');
    expect(html).toContain('lucide-calendar-clock');
    expect(html).toContain('lucide-users-round');
    expect(html).toContain('lucide-heart-handshake');
    expect(html).toContain('lucide-landmark');
    expect(html).toContain('lucide-credit-card');
    expect(html).toContain('lucide-send');
    expect(html).toContain('lucide-user-round-cog');
  });

  it('shows a section badge only when an operation count needs review', () => {
    const html = renderToStaticMarkup(
      <AdminShellNav
        sections={[
          {
            label: 'Command',
            description: 'Live work.',
            attentionCount: 3,
            links: [{ href: '/', label: 'Start Shift', description: 'Open dashboard.' }],
          },
        ]}
      />,
    );

    expect(html).toContain('3 items need review');
    expect(html).toContain('>3<');
  });

  it('keeps duplicate section labels and link hrefs on unique React keys during menu migrations', () => {
    const nav = AdminShellNav({
      sections: [
        {
          label: 'Finance',
          description: 'First finance group.',
          links: [
            { href: '/finance-tax', label: 'Tax Overview', description: 'Open tax overview.' },
            { href: '/finance-tax', label: 'Tax Overview', description: 'Open tax overview duplicate.' },
          ],
        },
        {
          label: 'Finance',
          description: 'Second finance group.',
          links: [{ href: '/finance-overview', label: 'Finance Overview', description: 'Open finance overview.' }],
        },
      ],
    });
    const sections = nav.props.children as Array<{ key: string; props: { children: unknown[] } }>;
    const firstSubmenu = sections[0].props.children[1] as { props: { children: Array<{ key: string }> } };

    expect(sections.map((section) => section.key)).toEqual(['Finance-0', 'Finance-1']);
    expect(firstSubmenu.props.children.map((link) => link.key)).toEqual(['/finance-tax-0', '/finance-tax-1']);
  });

  it('passes mobile drawer close callbacks to navigation links', () => {
    const onNavigate = vi.fn();
    const nav = AdminShellNav({
      onNavigate,
      sections: [
        {
          label: 'Command',
          description: 'Live work.',
          links: [{ href: '/', label: 'Start Shift', description: 'Open dashboard.' }],
        },
      ],
    });
    const section = (nav.props.children as Array<{ props: { children: unknown[] } }>)[0];
    const submenu = section.props.children[1] as { props: { children: Array<{ props: { onClick?: () => void } }> } };

    submenu.props.children[0].props.onClick?.();

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('renders workspace breadcrumbs and active page header from the active route', () => {
    const html = renderToStaticMarkup(<AdminWorkspaceHeader sections={adminNavSections} />);

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('HANDS');
    expect(html).toContain('Partners');
    expect(html).toContain('workspace-page-title');
    expect(html).toContain('Vietnam Operations');
    expect(html).toContain('Live Workspace');
    expect(html).toContain('action="/api/admin/session/logout"');
    expect(html).toContain('aria-label="Sign out"');
    expect(html).toContain('title="Sign out"');
    expect(html).toContain('lucide-log-out');
    expect(html).not.toContain('<span>Sign out</span>');
  });

  it('keeps the topbar search input as a labeled Vuexy navbar control', () => {
    expect(workspaceHeaderSource).toContain("import { AdminTopbarSearchInput } from './admin-topbar-search-input';");
    expect(workspaceHeaderSource).toContain('<AdminTopbarSearchInput');
    expect(workspaceHeaderSource).not.toContain('<input');

    const topbarSearchInputSource = readFileSync(topbarSearchInputSourcePath, 'utf8');

    expect(topbarSearchInputSource).toContain('AdminFormSearch');
    expect(topbarSearchInputSource).toContain('autoFocus={autoFocus}');
    expect(topbarSearchInputSource).toContain('className="topbar-dropdown-header"');
    expect(topbarSearchInputSource).not.toContain('<input');
    expect(topbarSearchInputSource).not.toContain('topbar-search-input');
  });

  it('keeps the topbar search trigger inside the shared Vuexy topbar button atom', () => {
    expect(workspaceHeaderSource).toContain("import { AdminTopbarButton } from './admin-topbar-button';");
    expect(workspaceHeaderSource).toContain('<AdminTopbarButton');
    expect(workspaceHeaderSource).not.toContain('<button');
  });

  it('keeps topbar notification counts inside the shared Vuexy badge atom', () => {
    expect(workspaceHeaderSource).toContain('AdminAttentionBadge');
    expect(workspaceHeaderSource).not.toContain('<span className="topbar-attention-badge">{totalAttentionCount}</span>');
  });

  it('keeps topbar icon buttons inside the shared Vuexy icon button atom', () => {
    expect(workspaceHeaderSource).toContain("import { AdminIconButton } from './admin-icon-button';");
    expect(workspaceHeaderSource).toContain("import { AdminIconLink } from './admin-icon-link';");
    expect(workspaceHeaderSource).toContain('<AdminIconButton');
    expect(workspaceHeaderSource).toContain('<AdminIconLink');
    expect(workspaceHeaderSource).not.toContain('<Link className="topbar-icon-chip" aria-label="Help"');
    expect(workspaceHeaderSource).not.toContain('<button className="topbar-icon-chip topbar-icon-button"');
    expect(workspaceHeaderSource).not.toContain('className="topbar-icon-chip topbar-icon-button" type="submit"');
  });

  it('keeps theme mode icon buttons inside the shared Vuexy icon button atom', () => {
    expect(themeToggleSource).toContain("import { AdminIconButton } from './admin-icon-button';");
    expect(themeToggleSource).toContain('<AdminIconButton');
    expect(themeToggleSource).not.toContain('<button');
  });

  it('keeps topbar empty states inside the shared Vuexy empty-state atom', () => {
    expect(workspaceHeaderSource).toContain('AdminEmptyState');
    expect(workspaceHeaderSource).not.toContain('<span className="topbar-empty">No matching admin pages</span>');
    expect(workspaceHeaderSource).not.toContain('<span className="topbar-empty">No operation alerts</span>');
  });

  it('keeps topbar dropdown links on stable keys during menu migrations', () => {
    expect(workspaceHeaderSource).toContain('filteredLinks.map((link, linkIndex) => (');
    expect(workspaceHeaderSource).toContain('key={`${link.sectionLabel}:${link.href}:${linkIndex}`}');
    expect(workspaceHeaderSource).toContain('attentionSections.map((section, sectionIndex) => (');
    expect(workspaceHeaderSource).toContain('key={`${section.label}:${sectionIndex}`}');
    expect(workspaceHeaderSource).not.toContain('filteredLinks.map((link) => (');
    expect(workspaceHeaderSource).not.toContain('attentionSections.map((section) => (');
    expect(workspaceHeaderSource).not.toContain('key={`${link.sectionLabel}:${link.href}`}');
    expect(workspaceHeaderSource).not.toContain('key={section.label}');
  });
});
