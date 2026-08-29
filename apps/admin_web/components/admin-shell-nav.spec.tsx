import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { bestMatchingNavHref, hrefMatchesPath } from '../lib/admin-nav-match';
import { adminNavSections } from '../lib/admin-navigation';
import { AdminShellNav } from './admin-shell-nav';
import { AdminWorkspaceHeader, operationAlertMenuTargetIndex } from './admin-workspace-header';
import { AdminWorkspaceLocalNav } from './admin-workspace-local-nav';

const navigationState = vi.hoisted(() => ({ pathname: '/partners', search: '' }));
const workspaceHeaderSource = readFileSync('components/admin-workspace-header.tsx', 'utf8');
const shellNavSource = readFileSync('components/admin-shell-nav.tsx', 'utf8');
const localNavSource = readFileSync('components/admin-workspace-local-nav.tsx', 'utf8');
const topbarSearchInputSourcePath = 'components/admin-topbar-search-input.tsx';
const themeToggleSource = readFileSync('components/admin-theme-toggle.tsx', 'utf8');
const globalsCss = readFileSync('app/globals.css', 'utf8');

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

describe('admin shell navigation', () => {
  beforeEach(() => {
    navigationState.pathname = '/partners';
    navigationState.search = '';
  });

  it('matches detail pages and query-specific saved views', () => {
    expect(hrefMatchesPath('/', '/', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings/cmq123', '')).toBe(true);
    expect(hrefMatchesPath('/bookings', '/bookings/completed', '')).toBe(false);
    expect(hrefMatchesPath('/bookings/completed', '/bookings/completed', 'view=closeout')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners', 'review=kyc')).toBe(true);
    expect(hrefMatchesPath('/partners/overview', '/partners/overview', 'range=7d')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners/overview', 'range=7d')).toBe(false);
    expect(hrefMatchesPath('/partners?review=unapproved', '/partners', 'review=unapproved')).toBe(true);
    expect(
      bestMatchingNavHref(
        [
          '/payouts',
          '/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests',
        ],
        '/payouts',
        'range=all&withdrawalStatus=REVIEW_REQUIRED',
      ),
    ).toBe('/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests');
  });

  it('renders Shift Command once, seven work areas, and one System Health representative', () => {
    const html = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    expect(html).toContain('aria-label="Admin navigation"');
    expect(html.match(/>Shift Command</g)).toHaveLength(1);
    expect(html).toContain('class="nav-section-summary nav-direct-link"');
    expect(html.match(/<details/g)).toHaveLength(7);
    expect(html.match(/>Partner Operations</g)).toHaveLength(1);
    expect(html).not.toContain('>Partner workspace</');
    const partnerLinkIndexes = [
      'Overview',
      'Action Queue',
      'Approvals',
      'Onboarding Blockers',
      'Partner Blockers',
      'Reports',
      'Account Controls',
      'Directory',
    ].map((label) => html.indexOf(`>${label}</`));
    expect(partnerLinkIndexes.every((index) => index >= 0)).toBe(true);
    expect(partnerLinkIndexes).toEqual([...partnerLinkIndexes].sort((left, right) => left - right));
    expect(html).not.toContain('Partner Referrals');
    expect(html.match(/>System Health</g)).toHaveLength(1);
    expect(html).toContain('class="nav-link nav-local-group-link"');
    expect(html).toContain('href="/setup"');
    expect(html).toContain('lucide-sparkles');
    expect(html).toContain('lucide-calendar-clock');
    expect(html).toContain('lucide-heart-handshake');
    expect(html).toContain('lucide-banknote');
  });

  it('opens only the active accordion section and marks a deep route representative active', () => {
    navigationState.pathname = '/partners/overview';
    navigationState.search = 'range=7d';
    const html = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    expect(html.match(/<details[^>]* open=""/g)).toHaveLength(1);
    expect(html).toContain('class="nav-section" data-active="true" open=""');
    expect(html).toContain('aria-current="page" class="nav-link" data-active="true"');
    expect(html).toContain('href="/partners/overview"');
  });

  it.each([
    ['/partners/overview', 'range=7d', '/partners/overview'],
    ['/partner-controls', '', '/partner-controls'],
    ['/partner-controls', 'details=summary', '/partner-controls'],
    [
      '/partners',
      'review=approval-pending&sort=oldest&q=linh',
      '/partners?review=approval-pending&amp;sort=oldest',
    ],
    ['/partners', 'review=unapproved&q=linh', '/partners?review=unapproved'],
    ['/partner-controls', 'details=controls&review=location', '/partner-controls?details=controls'],
    ['/partner-controls', 'details=reports&status=RESOLVED', '/partner-controls?details=reports'],
    ['/partner-controls', 'details=sanctions&sanction=HISTORY', '/partner-controls?details=sanctions'],
    ['/partners', 'q=linh', '/partners'],
    ['/partners/partner-1', '', '/partners'],
  ])('marks one Partner Operations link current for %s?%s', (pathname, search, href) => {
    navigationState.pathname = pathname;
    navigationState.search = search;
    const html = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`aria-current="page"[^>]*href="${href.replace(/[?]/gu, '\\?')}"`));
  });

  it('visually activates representative items for saved views without claiming the current page', () => {
    navigationState.pathname = '/payouts';
    navigationState.search = 'range=all&withdrawalStatus=REVIEW_REQUIRED';
    const payoutHtml = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    navigationState.pathname = '/finance-tax/bank-reconciliation';
    navigationState.search = 'range=all&review=unmatched';
    const bankHtml = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    expect(payoutHtml).toMatch(/class="nav-link" data-active="true"[^>]*href="\/payouts"/);
    expect(payoutHtml).not.toMatch(/aria-current="page"[^>]*href="\/payouts"/);
    expect(bankHtml).toMatch(/class="nav-link" data-active="true"/);
    expect(bankHtml).not.toMatch(/aria-current="page"[^>]*href="\/finance-tax\/bank-reconciliation"/);
  });

  it('shows a section badge only when an operation count needs review', () => {
    const html = renderToStaticMarkup(
      <AdminShellNav
        sections={[
          {
            id: 'command',
            iconKey: 'bookings',
            label: 'Command',
            description: 'Live work.',
            attentionCount: 3,
            links: [
              {
                id: 'command-home',
                iconKey: 'command',
                href: '/',
                label: 'Start Shift',
                description: 'Open dashboard.',
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('3 items need review');
    expect(html).toContain('>3<');
  });

  it('labels the empty operation alert control without exposing menu semantics', () => {
    const html = renderToStaticMarkup(<AdminWorkspaceHeader sections={adminNavSections} />);

    expect(html).toContain('aria-label="Operation alerts, 0"');
    expect(html).not.toContain('aria-haspopup="menu"');
    expect(workspaceHeaderSource).toContain("role={hasOperationAlerts ? 'menu' : 'status'}");
    expect(workspaceHeaderSource).toContain(
      '<p className="topbar-notification-empty">No operation alerts</p>',
    );
  });

  it('preserves menu semantics when operation alerts are populated', () => {
    const html = renderToStaticMarkup(
      <AdminWorkspaceHeader
        sections={[
          {
            attentionCount: 2,
            description: 'Booking work.',
            href: '/bookings',
            iconKey: 'bookings',
            id: 'bookings',
            label: 'Bookings',
            links: [
              {
                description: 'Open bookings.',
                href: '/bookings',
                iconKey: 'bookings',
                id: 'bookings-home',
                label: 'Live bookings',
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('aria-label="Operation alerts, 2"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('keeps route-scoped accordion state and stable item ids without effect synchronization', () => {
    expect(shellNavSource).toContain('const [manualOpenSection, setManualOpenSection]');
    expect(shellNavSource).toContain('manualOpenSection?.routeKey === routeKey');
    expect(shellNavSource).toContain('open={openSectionId === section.id}');
    expect(shellNavSource).not.toContain('useEffect');
    expect(shellNavSource).toContain('key={section.id}');
    expect(shellNavSource).toContain('key={link.id}');
    expect(shellNavSource).not.toContain('key={`${section.label}-${index}`}');
    expect(shellNavSource).not.toContain('key={`${link.href}-${linkIndex}`}');
  });

  it('renders workspace breadcrumbs and active page title from the representative route', () => {
    const html = renderToStaticMarkup(<AdminWorkspaceHeader sections={adminNavSections} />);

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('HANDS');
    expect(html).toContain('Partner Operations');
    expect(html).toContain('aria-current="page">Directory</span>');
    expect(html).toContain('aria-label="Operations Policy"');
    expect(html).toContain('aria-label="Operation alerts, 0"');
    expect(html).toContain('action="/api/admin/session/logout"');
    expect(html).toContain('aria-label="Sign out"');
  });

  it('renders query-specific breadcrumb context from the central navigation resolver', () => {
    navigationState.pathname = '/payouts';
    navigationState.search = 'range=all&withdrawalStatus=REVIEW_REQUIRED';
    const payoutHtml = renderToStaticMarkup(<AdminWorkspaceHeader sections={adminNavSections} />);

    navigationState.pathname = '/partners';
    navigationState.search = 'review=approval-pending&sort=oldest';
    const partnerHtml = renderToStaticMarkup(<AdminWorkspaceHeader sections={adminNavSections} />);

    expect(payoutHtml).toContain('Finance Records &amp; Close');
    expect(payoutHtml).toContain('href="/payouts">Partner Money</a>');
    expect(payoutHtml).toContain('aria-current="page">Payout / Withdrawal Risk</span>');
    expect(partnerHtml).toContain('aria-current="page">Approvals</span>');
    expect(partnerHtml).not.toContain('href="/partners">Directory</a>');
    expect(partnerHtml).not.toContain('Partner workspace');
  });

  it('renders authorized local workspace navigation for existing URLs', () => {
    navigationState.pathname = '/notifications/templates';
    const messagingHtml = renderToStaticMarkup(<AdminWorkspaceLocalNav sections={adminNavSections} />);

    navigationState.pathname = '/referrals/partners';
    const referralHtml = renderToStaticMarkup(<AdminWorkspaceLocalNav sections={adminNavSections} />);

    expect(messagingHtml).toContain('aria-label="Messaging workspace"');
    expect(messagingHtml).toContain('href="/notifications"');
    expect(messagingHtml).toContain('href="/notifications/templates"');
    expect(messagingHtml).toContain('href="/notifications/push-send"');
    expect(messagingHtml).toMatch(/aria-current="page"[^>]*href="\/notifications\/templates"/);
    expect(referralHtml).toContain('aria-label="Referrals workspace"');
    expect(referralHtml).toContain('href="/referrals/customers"');
    expect(referralHtml).toContain('href="/referrals/partners"');
    expect(referralHtml).toContain('href="/referrals/cashouts"');
  });

  it('does not repeat Partner Operations in local workspace navigation', () => {
    navigationState.pathname = '/partners/overview';
    const overviewHtml = renderToStaticMarkup(<AdminWorkspaceLocalNav sections={adminNavSections} />);
    navigationState.pathname = '/partner-controls';
    const controlsHtml = renderToStaticMarkup(<AdminWorkspaceLocalNav sections={adminNavSections} />);

    expect(overviewHtml).toBe('');
    expect(controlsHtml).toBe('');
  });

  it.each([
    ['Booking Closeout', '/bookings/post-match-cancellations'],
    ['Customer Signals', '/reviews/partner-customer-evaluations'],
    ['Messaging', '/notifications/templates'],
    ['Referrals', '/referrals/partners'],
    ['Partner Money', '/earnings'],
    ['Settlement Records', '/finance-tax/settlement-reversals'],
    ['Tax & Period Close', '/finance-tax/platform-vat'],
    ['System Health', '/background-jobs'],
  ])('keeps %s workspace permissions, local navigation, and one current page', (label, pathname) => {
    navigationState.pathname = pathname;
    navigationState.search = '';
    const html = renderToStaticMarkup(<AdminWorkspaceLocalNav sections={adminNavSections} />);

    expect(html).toContain(`aria-label="${label.replace('&', '&amp;')} workspace"`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('keeps local workspace navigation inside the shared segmented control', () => {
    expect(localNavSource).toContain("import { AdminSegmentedControl } from './admin-segmented-control';");
    expect(localNavSource).toContain('<AdminSegmentedControl');
    expect(localNavSource).not.toContain('<a');
  });

  it('keeps the topbar search input as a labeled shared navbar control', () => {
    expect(workspaceHeaderSource).toContain(
      "import { AdminTopbarSearchInput } from './admin-topbar-search-input';",
    );
    expect(workspaceHeaderSource).toContain('<AdminTopbarSearchInput');
    expect(workspaceHeaderSource).not.toContain('<input');

    const topbarSearchInputSource = readFileSync(topbarSearchInputSourcePath, 'utf8');
    expect(topbarSearchInputSource).toContain('AdminFormSearch');
    expect(topbarSearchInputSource).toContain('autoFocus={autoFocus}');
  });

  it('shows ranked results on stable ids and exposes the overflow result count', () => {
    expect(workspaceHeaderSource).toContain('adminNavSearchResults');
    expect(workspaceHeaderSource).toContain('group.entries.map((link) => (');
    expect(workspaceHeaderSource).toContain('groupAdminNavSearchResults');
    expect(workspaceHeaderSource).toContain('key={link.id}');
    expect(workspaceHeaderSource).toContain('Show all results ({searchResults.total})');
    expect(workspaceHeaderSource).not.toContain('.filter((link) =>');
    expect(workspaceHeaderSource).not.toContain('searchText.includes(query)');
  });

  it('supports nonmodal search keyboard, focus return, outside click, and mutually exclusive alerts', () => {
    expect(workspaceHeaderSource).toContain("event.key.toLowerCase() === 'k'");
    expect(workspaceHeaderSource).toContain("event.key === 'Escape'");
    expect(workspaceHeaderSource).toContain("event.key !== 'ArrowDown' && event.key !== 'ArrowUp'");
    expect(workspaceHeaderSource).toContain("event.key === 'Enter'");
    expect(workspaceHeaderSource).toContain("document.addEventListener('pointerdown'");
    expect(workspaceHeaderSource).toContain('searchTriggerRef.current?.focus()');
    expect(workspaceHeaderSource).toContain('notificationTriggerRef.current?.focus()');
    expect(workspaceHeaderSource).toContain('searchResultsListRef.current.scrollTop = 0');
    expect(workspaceHeaderSource).toContain('closeNotifications(true)');
    expect(workspaceHeaderSource).toContain('role="search"');
    expect(workspaceHeaderSource).not.toContain('aria-haspopup="dialog"');
  });

  it.each([
    ['ArrowDown', -1, 3, 0],
    ['ArrowDown', 2, 3, 0],
    ['ArrowUp', 0, 3, 2],
    ['Home', 2, 3, 0],
    ['End', 0, 3, 2],
    ['Enter', 0, 3, null],
    ['ArrowDown', 0, 0, null],
  ])('moves operation alert focus for %s', (key, activeIndex, itemCount, expected) => {
    expect(operationAlertMenuTargetIndex(key, activeIndex, itemCount)).toBe(expected);
  });

  it.each(['/setup', '/app-sessions', '/background-jobs'])(
    'keeps one System Health representative active for %s while details stay in local navigation',
    (pathname) => {
      navigationState.pathname = '/operations-policy';
      const defaultHtml = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);
      navigationState.pathname = pathname;
      const activeHtml = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);
      const localHtml = renderToStaticMarkup(<AdminWorkspaceLocalNav sections={adminNavSections} />);

      expect(defaultHtml.match(/>System Health</g)).toHaveLength(1);
      expect(activeHtml).toMatch(
        /class="nav-link nav-local-group-link" data-active="true"[^>]*href="\/setup"/,
      );
      if (pathname === '/setup') {
        expect(activeHtml).toMatch(/aria-current="page"[^>]*href="\/setup"/);
      } else {
        expect(activeHtml).not.toMatch(/aria-current="page"[^>]*href="\/setup"/);
      }
      expect(localHtml).toContain('href="/setup"');
      expect(localHtml).toContain('href="/app-sessions"');
      expect(localHtml).toContain('href="/background-jobs"');
      expect(localHtml.match(/aria-current="page"/g)).toHaveLength(1);
    },
  );

  it('keeps a local booking representative visually active without claiming the current page', () => {
    navigationState.pathname = '/bookings/post-match-cancellations';
    const html = renderToStaticMarkup(<AdminShellNav sections={adminNavSections} />);

    expect(html).toMatch(/class="nav-link" data-active="true"[^>]*href="\/bookings\/completed"/);
    expect(html).not.toMatch(/aria-current="page"[^>]*href="\/bookings\/completed"/);
  });

  it('keeps shared topbar atoms for search, notification, theme, and icon actions', () => {
    expect(workspaceHeaderSource).toContain("import { AdminTopbarButton } from './admin-topbar-button';");
    expect(workspaceHeaderSource).toContain('AdminAttentionBadge');
    expect(workspaceHeaderSource).toContain("import { AdminIconButton } from './admin-icon-button';");
    expect(workspaceHeaderSource).toContain("import { AdminIconLink } from './admin-icon-link';");
    expect(themeToggleSource).toContain("import { AdminIconButton } from './admin-icon-button';");
    expect(themeToggleSource.match(/<AdminIconButton/g)).toHaveLength(1);
  });

  it('keeps sidebar and workspace controls readable on desktop', () => {
    expect(cssRuleBlockAt(globalsCss.indexOf('.nav-section-summary {'))).toContain(
      'grid-template-columns: 18px minmax(0, 1fr) auto 16px',
    );
    expect(globalsCss).toContain('.nav-direct-link {');
    expect(globalsCss).toContain('.nav-local-group-link {');
    expect(globalsCss).toContain('.admin-workspace-local-nav {');
    expect(globalsCss).toContain('.topbar-search-show-all {');
    expect(cssRuleBlockAt(globalsCss.indexOf('.topbar-search-menu {'))).toContain('overflow: hidden');
    expect(globalsCss).toContain('.topbar-search-menu > .topbar-dropdown-list {');
    expect(
      globalsCss.match(/--admin-sidebar-muted: rgb\(var\(--admin-main-channel\) \/ 0\.66\);/g),
    ).toHaveLength(2);
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) return '';
  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
