import { hrefMatchesPath } from '../lib/admin-nav-match';
import { adminNavSections } from '../lib/admin-navigation';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminShellNav } from './admin-shell-nav';
import { AdminWorkspaceHeader } from './admin-workspace-header';

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

  it('renders workspace breadcrumbs and active page header from the active route', () => {
    const html = renderToStaticMarkup(<AdminWorkspaceHeader sections={adminNavSections} />);

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('HANDS');
    expect(html).toContain('Partners');
    expect(html).toContain('workspace-page-title');
    expect(html).toContain('Vietnam Operations');
    expect(html).toContain('Live Workspace');
  });
});
