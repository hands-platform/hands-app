import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { adminHiddenRoutePolicy, adminHiddenRouteRoutes } from './admin-hidden-route-policy';
import { adminOperatorCategoryForPath } from './admin-operator-access-model';
import {
  adminNavIconKeys,
  groupAdminNavSearchResults,
  adminNavSearchEntries,
  adminNavSearchResults,
  adminNavSectionDestinations,
  adminNavSections,
  adminNavSectionsForAccess,
  adminNavWorkspaceDestinations,
  allAdminNavSections,
} from './admin-navigation';

describe('admin navigation', () => {
  it('organizes one direct Shift Command link and seven operator work areas', () => {
    expect(adminNavSections.map((section) => section.label)).toEqual([
      'Shift Command',
      'Booking Operations',
      'Customer Support',
      'Partner Operations',
      'Finance Operations',
      'Finance Records & Close',
      'Growth & Communications',
      'Administration & Settings',
    ]);
    expect(adminNavSections).toHaveLength(8);
    expect(adminNavSections[0]).toMatchObject({ href: '/', links: [] });
    expect(adminNavSections.slice(1).every((section) => section.links.length >= 1)).toBe(true);
    expect(adminNavSections.slice(1).every((section) => section.links.length <= 7)).toBe(true);
  });

  it('uses stable unique ids and explicit valid icon keys', () => {
    const items = adminNavSections.flatMap((section) => [
      section,
      ...section.links,
      ...section.links.flatMap((link) => link.searchEntries ?? []),
      ...(section.localGroups ?? []),
      ...(section.localGroups?.flatMap((group) => group.links) ?? []),
    ]);
    const ids = items.map((item) => item.id);

    expect(ids.length).toBe(new Set(ids).size);
    expect(items.every((item) => adminNavIconKeys.includes(item.iconKey))).toBe(true);
  });

  it('keeps direct sidebar destinations unique by exact href and pathname', () => {
    const hrefs = sidebarHrefs(adminNavSections);
    const pathnames = hrefs.map(normalizeMenuRoute);

    expect(hrefs.length).toBe(new Set(hrefs).size);
    expect(pathnames.length).toBe(new Set(pathnames).size);
  });

  it('places daily operating routes in their operator work areas', () => {
    const links = navLinkLabels(adminNavSections);

    expect(links.get('/cash-settlements')).toBe('Finance Operations: Cash Settlements');
    expect(links.get('/finance-closeout')).toBe('Finance Operations: Settlement Repair');
    expect(links.get('/partners/overview')).toBe('Partner Operations: Partner Operations');
    expect(links.get('/chat-archive')).toBe('Customer Support: Chat Evidence');
    expect(sidebarHrefs(adminNavSections)).not.toContain('/usage-overview');
    expect(links.get('/usage-overview')).toBe('Growth & Communications: Customer Usage');
    expect(adminNavWorkspaceDestinations()).toContain('/usage-overview');
  });

  it('keeps one representative sidebar link for each consolidated workspace', () => {
    const hrefs = sidebarHrefs(adminNavSections);

    expect(hrefs).toContain('/bookings/completed');
    expect(hrefs).not.toContain('/bookings/post-match-cancellations');
    expect(hrefs).toContain('/reviews');
    expect(hrefs).not.toContain('/reviews/partner-customer-evaluations');
    expect(hrefs).toContain('/notifications');
    expect(hrefs).not.toContain('/notifications/templates');
    expect(hrefs).toContain('/referrals/customers');
    expect(hrefs).not.toContain('/referrals/partners');
    expect(hrefs).toContain('/finance-tax/booking-settlement-audit');
    expect(hrefs).not.toContain('/finance-tax/settlement-reversals');
    expect(hrefs).toContain('/finance-tax');
    expect(hrefs).not.toContain('/finance-tax/monthly-tax-closing');
  });

  it('keeps legacy aliases out of the sidebar while preserving their route policies', () => {
    const hrefs = sidebarHrefs(allAdminNavSections);

    expect(hrefs).not.toContain('/providers');
    expect(hrefs).not.toContain('/files');
    expect(hrefs).not.toContain('/referrals');
    expect(adminHiddenRoutePolicy('/providers')).toBeTruthy();
    expect(adminHiddenRoutePolicy('/files')).toBeTruthy();
    expect(adminHiddenRoutePolicy('/referrals')).toBeTruthy();
  });

  it('filters direct links and local workspaces for operator access', () => {
    const shift = visibleNav({
      categories: ['BOOKINGS', 'CUSTOMERS_DIRECTORY', 'CUSTOMERS_REVIEWS', 'NOTIFICATIONS_DELIVERY'],
      roles: ['ADMIN'],
    });
    const partner = visibleNav({ categories: ['PARTNERS', 'CUSTOMERS_REVIEWS'], roles: ['ADMIN'] });
    const finance = visibleNav({ categories: ['FINANCE'], roles: ['ADMIN', 'FINANCE_APPROVER'] });
    const master = visibleNav({ categories: [], roles: ['ADMIN', 'MASTER_ADMIN'] });

    expect(shift.sidebarHrefs).toContain('/');
    expect(shift.sidebarHrefs).toContain('/bookings');
    expect(shift.sidebarHrefs).toContain('/customers');
    expect(shift.workspaceHrefs).toContain('/reviews/partner-customer-evaluations');
    expect(shift.sidebarHrefs).not.toContain('/partners');
    expect(shift.sidebarHrefs).not.toContain('/finance-overview');
    expect(shift.localGroups).not.toContain('System Health');

    expect(partner.sidebarHrefs).toContain('/partners/overview');
    expect(partner.sidebarHrefs).not.toContain('/partners');
    expect(partner.sidebarHrefs).not.toContain('/partner-controls');
    expect(partner.workspaceHrefs).toContain('/partners');
    expect(partner.workspaceHrefs).toContain('/partner-controls');
    expect(partner.sidebarHrefs).not.toContain('/customers');

    expect(finance.sidebarHrefs).toContain('/finance-overview');
    expect(finance.sidebarHrefs).toContain('/cash-settlements');
    expect(finance.workspaceHrefs).toContain('/earnings');
    expect(finance.workspaceHrefs).toContain('/finance-tax/monthly-tax-closing');
    expect(finance.workspaceHrefs).toContain('/finance-tax/payment-fees');
    expect(finance.workspaceHrefs).not.toContain('/finance-tax/payment-fees?settings=policy');
    expect(finance.sidebarHrefs).not.toContain('/finance-tax/company-bank-accounts');

    expect(master.allDestinations).toEqual(allAdminNavSections.flatMap(adminNavSectionDestinations));
    expect(master.localGroups).toContain('System Health');
  });

  it('keeps one Partner Directory item and searchable queue deep links', () => {
    const partnerLinks = adminNavSections.find((section) => section.id === 'partner-operations')?.links ?? [];
    const workspaceLinks = partnerLinks.filter((link) => link.href === '/partners/overview');
    const searchEntries = adminNavSearchEntries(adminNavSections);
    const findByLabel = (label: string) => searchEntries.find((entry) => entry.label === label);

    expect(workspaceLinks.map((link) => [link.href, link.label])).toEqual([
      ['/partners/overview', 'Partner Operations'],
    ]);
    expect(findByLabel('Partner Directory')?.href).toBe('/partners');
    expect(findByLabel('Partner Action Queue')?.href).toBe('/partner-controls');
    expect(findByLabel('Partner Approvals')?.href).toBe('/partners?review=approval-pending&sort=oldest');
    expect(findByLabel('Onboarding Blockers')?.href).toBe('/partners?review=unapproved');
    expect(findByLabel('Wallet Debt')?.href).toBe('/partners?review=unsettled');
  });

  it('ranks exact and Partner-title results ahead of description matches', () => {
    const partnerResults = adminNavSearchResults(adminNavSections, 'partner', Number.MAX_SAFE_INTEGER);
    const exactResults = adminNavSearchResults(
      adminNavSections,
      'Partner Directory',
      Number.MAX_SAFE_INTEGER,
    );

    expect(partnerResults.results[0]?.label).toBe('Partner Operations');
    expect(partnerResults.results.map((entry) => entry.label)).toContain('Partner Directory');
    expect(partnerResults.results.map((entry) => entry.label)).toContain('Partner Action Queue');
    expect(partnerResults.total).toBeGreaterThan(7);
    expect(exactResults.results[0]?.label).toBe('Partner Directory');
    expect(partnerResults.results.findIndex((entry) => entry.label === 'Live Bookings')).toBeGreaterThan(0);
    expect(
      partnerResults.results.findIndex((entry) => entry.label === 'Notification Delivery'),
    ).toBeGreaterThan(0);
  });

  it('uses representative destinations before a search and limits only after ranking', () => {
    const limited = adminNavSearchResults(adminNavSections, '');
    const all = adminNavSearchResults(adminNavSections, '', Number.MAX_SAFE_INTEGER);

    expect(limited.results).toHaveLength(7);
    expect(limited.total).toBe(8);
    expect(all.results.map((entry) => entry.label)).toEqual([
      'Shift Command',
      'Live Bookings',
      'Customers',
      'Partner Operations',
      'Finance Overview',
      'Payments',
      'Insights',
      'Operations Policy',
    ]);
  });

  it('groups expanded search results by section without changing rank order', () => {
    const ranked = adminNavSearchResults(adminNavSections, 'partner', Number.MAX_SAFE_INTEGER).results;
    const grouped = groupAdminNavSearchResults(ranked);

    expect(grouped.map((group) => group.sectionLabel)).toEqual([
      ...new Set(ranked.map((entry) => entry.sectionLabel)),
    ]);
    for (const group of grouped) {
      expect(group.entries.map((entry) => entry.id)).toEqual(
        ranked.filter((entry) => entry.sectionLabel === group.sectionLabel).map((entry) => entry.id),
      );
    }
  });

  it('keeps finance workspace labels precise and Wallet Adjustments visually distinct', () => {
    const financeOperations = adminNavSections.find((section) => section.id === 'finance-operations');
    const financeRecords = adminNavSections.find((section) => section.id === 'finance-records-close');
    const walletAdjustments = financeRecords?.links.find((link) => link.id === 'finance-records-wallet');
    const partnerMoney = financeRecords?.links.find((link) => link.id === 'finance-records-partner-money');

    expect(walletAdjustments?.iconKey).toBe('adjustments');
    expect(walletAdjustments?.iconKey).not.toBe(partnerMoney?.iconKey);
    expect(financeRecords?.links.find((link) => link.href === '/finance-tax')?.label).toBe(
      'Tax & Period Close',
    );
    expect(financeOperations?.links.filter((link) => link.label === 'Payment Matching')).toHaveLength(1);
    expect(financeOperations?.links.some((link) => link.label === 'Payment Clearing')).toBe(false);
    expect(
      adminNavSearchEntries(adminNavSections).find((entry) => entry.label === 'Payment Clearing')?.href,
    ).toBe('/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest');
    expect(
      adminNavSearchEntries(adminNavSections).find((entry) => entry.label === 'Payout / Withdrawal Risk')
        ?.href,
    ).toBe('/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests');
  });

  it('hides System Health for general operators and shows only authorized tools', () => {
    const general = visibleNav({ categories: ['SYSTEM_AUDIT'], roles: ['ADMIN'] });
    const appSessionsOnly = visibleNav({
      categories: ['DEVELOPER_APP_SESSIONS_DIAGNOSTICS'],
      roles: ['ADMIN'],
    });
    const master = visibleNav({ categories: [], roles: ['MASTER_ADMIN'] });

    expect(general.localGroups).not.toContain('System Health');
    expect(appSessionsOnly.sections).toEqual(['Administration & Settings']);
    expect(appSessionsOnly.localGroups).toEqual(['System Health']);
    expect(appSessionsOnly.localGroupHrefs).toEqual(['/app-sessions']);
    expect(master.localGroupHrefs).toEqual(['/setup', '/app-sessions', '/background-jobs']);
  });

  it('maps saved views and direct routes to the same permission source', () => {
    expect(adminOperatorCategoryForPath('/partners?review=approval-pending&sort=oldest')).toBe(
      'PARTNERS_UNAPPROVED',
    );
    expect(adminOperatorCategoryForPath('/partners')).toBe('PARTNERS_DIRECTORY');
    expect(adminOperatorCategoryForPath('/bookings/completed?dateRange=30d')).toBe('BOOKINGS_COMPLETED');
    expect(adminOperatorCategoryForPath('/bookings/post-match-cancellations?range=7d')).toBe(
      'BOOKINGS_CANCELLATIONS',
    );
    expect(adminOperatorCategoryForPath('/notifications/templates')).toBe('NOTIFICATIONS_TEMPLATES');
    expect(adminOperatorCategoryForPath('/notifications/push-send')).toBe('NOTIFICATIONS_PUSH');
    expect(adminOperatorCategoryForPath('/chat-archive')).toBe('BOOKINGS_DETAIL');
  });

  it('keeps every app page in sidebar, local workspace, search destination, or hidden policy', () => {
    const pageRoutes = collectPageRoutes();
    const navigationRoutes = new Set(
      allAdminNavSections.flatMap(adminNavSectionDestinations).map(normalizeMenuRoute),
    );
    const unclassifiedRoutes = pageRoutes.filter(
      (route) => !navigationRoutes.has(route) && !adminHiddenRoutePolicy(route),
    );
    const staleHiddenPolicies = adminHiddenRouteRoutes().filter((route) => !pageRoutes.includes(route));

    expect(unclassifiedRoutes).toEqual([]);
    expect(staleHiddenPolicies).toEqual([]);
  });

  it('keeps every navigation destination mapped to an operator permission category', () => {
    const hiddenOperatingRoutes = adminHiddenRouteRoutes().filter((route) => route !== '/login');
    const unmappedRoutes = [
      ...new Set([...allAdminNavSections.flatMap(adminNavSectionDestinations), ...hiddenOperatingRoutes]),
    ]
      .filter((route) => !adminOperatorCategoryForPath(route))
      .sort();

    expect(unmappedRoutes).toEqual([]);
  });
});

function navLinkLabels(sections: typeof adminNavSections) {
  return new Map(
    sections.flatMap((section) =>
      section.links.flatMap((link) => [
        [link.href, `${section.label}: ${link.label}`] as const,
        ...(link.searchEntries?.map((entry) => [entry.href, `${section.label}: ${entry.label}`] as const) ??
          []),
      ]),
    ),
  );
}

function sidebarHrefs(sections: readonly (typeof adminNavSections)[number][]) {
  return sections.flatMap((section) => [
    ...(section.href ? [section.href] : []),
    ...section.links.map((link) => link.href),
  ]);
}

function visibleNav(access: { categories: string[]; roles: string[] }) {
  const sections = adminNavSectionsForAccess(access);
  return {
    allDestinations: sections.flatMap(adminNavSectionDestinations),
    localGroupHrefs: sections.flatMap(
      (section) => section.localGroups?.flatMap((group) => group.links.map((link) => link.href)) ?? [],
    ),
    localGroups: sections.flatMap((section) => section.localGroups?.map((group) => group.label) ?? []),
    sections: sections.map((section) => section.label),
    sidebarHrefs: sidebarHrefs(sections),
    workspaceHrefs: adminNavSearchEntries(sections).map((entry) => entry.href),
  };
}

function collectPageRoutes() {
  const appDirectory = path.join(process.cwd(), 'app');
  return collectPageFiles(appDirectory)
    .map((file) => pageFileToRoute(appDirectory, file))
    .sort();
}

function collectPageFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);
    return stats.isDirectory() ? collectPageFiles(entryPath) : entry === 'page.tsx' ? [entryPath] : [];
  });
}

function pageFileToRoute(appDirectory: string, filePath: string) {
  const routeSegments = path
    .relative(appDirectory, filePath)
    .split(path.sep)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith('('));
  return routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`;
}

function normalizeMenuRoute(href: string) {
  return href.split('?')[0] || '/';
}
