import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import {
  adminHiddenRoutePolicy,
  adminHiddenRouteRoutes,
} from './admin-hidden-route-policy';
import { adminOperatorCategoryForPath } from './admin-operator-access-model';
import {
  adminNavSections,
  adminNavSectionsForAccess,
  allAdminNavSections,
} from './admin-navigation';

describe('admin navigation', () => {
  it('organizes the sidebar into operation-focused categories', () => {
    expect(adminNavSections.map((section) => section.label)).toEqual([
      'Command Center',
      'Bookings',
      'Customers',
      'Partners',
      'Analytics',
      'Growth & Communications',
      'Finance',
      'Tax & Accounting',
      'Policies',
      'Admin Control',
    ]);
  });

  it('keeps daily operator shortcuts in operation-facing categories', () => {
    const linksByHref = new Map(
      adminNavSections.flatMap((section) =>
        section.links.map((link) => [link.href, `${section.label}: ${link.label}`] as const),
      ),
    );

    expect(linksByHref.get('/')).toBe('Command Center: Start Shift');
    expect(linksByHref.get('/calendar')).toBe('Command Center: Calendar');
    expect(linksByHref.get('/operations-handoff')).toBe('Command Center: Handoff');
    expect(linksByHref.get('/app-sessions')).toBeUndefined();
    expect(linksByHref.get('/setup')).toBeUndefined();

    expect(linksByHref.get('/vietnam-overview')).toBe('Analytics: Vietnam Overview');
    expect(linksByHref.get('/usage-overview')).toBe('Customers: Usage Overview');
    expect(linksByHref.get('/partners/overview')).toBe('Partners: Partner Overview');
    expect(linksByHref.get('/marketing-analytics')).toBe('Growth & Communications: Marketing Analytics');

    expect(linksByHref.get('/bookings')).toBe('Bookings: All Bookings');
    expect(linksByHref.get('/customers')).toBe('Customers: Customers');
    expect(linksByHref.get('/reviews')).toBe('Customers: Customer Reviews');
    expect(linksByHref.get('/reviews/partner-customer-evaluations')).toBe('Customers: Partner Evaluations');
    expect(linksByHref.get('/partners')).toBe('Partners: Partners');
    expect(linksByHref.get('/files')).toBe('Partners: Files');

    expect(linksByHref.get('/finance-overview')).toBe('Finance: Finance Overview');
    expect(linksByHref.get('/finance-closeout')).toBe('Finance: Finance Closeout');
    expect(linksByHref.get('/payments')).toBe('Finance: Payments');
    expect(linksByHref.get('/finance-tax/payment-clearing')).toBe('Finance: Payment Clearing');
    expect(linksByHref.get('/cash-settlements')).toBe('Finance: Cash Debt');
    expect(linksByHref.get('/wallet-adjustments')).toBe('Finance: Wallet Adjustments');
    expect(linksByHref.get('/earnings')).toBe('Finance: Earnings');
    expect(linksByHref.get('/payouts')).toBe('Finance: Payouts');
    expect(linksByHref.get('/referrals/cashouts')).toBe('Finance: Referral Cashouts');
    expect(linksByHref.get('/refunds')).toBe('Finance: Refunds');

    expect(linksByHref.get('/finance-tax')).toBe('Tax & Accounting: Tax Overview');
    expect(linksByHref.get('/finance-tax/general-ledger')).toBe('Tax & Accounting: General Ledger');
    expect(linksByHref.get('/finance-tax/bank-reconciliation')).toBe('Tax & Accounting: Bank Reconciliation');
    expect(linksByHref.get('/finance-tax/booking-settlement-audit')).toBe(
      'Tax & Accounting: Booking Settlement Audit',
    );
    expect(linksByHref.get('/finance-tax/settlement-reversals')).toBe(
      'Tax & Accounting: Settlement Reversals',
    );
    expect(linksByHref.get('/finance-tax/monthly-tax-closing')).toBe('Tax & Accounting: Monthly Tax Closing');
    expect(linksByHref.get('/finance-tax/platform-vat')).toBe('Tax & Accounting: Platform VAT');
    expect(linksByHref.get('/finance-tax/partner-withholding-tax')).toBe(
      'Tax & Accounting: Partner Withholding Tax',
    );
    expect(linksByHref.get('/finance-tax/payment-fees')).toBe('Tax & Accounting: Payment Fees');
    expect(linksByHref.get('/finance-tax/coupon-finance')).toBe('Tax & Accounting: Coupon Finance');
    expect(linksByHref.get('/finance-tax/finance-approvers')).toBe('Admin Control: Finance Approvers');
    expect(linksByHref.get('/tax-policy')).toBe('Tax & Accounting: Tax Policy');

    expect(linksByHref.get('/notifications')).toBe('Growth & Communications: Notifications');
    expect(linksByHref.get('/notifications/templates')).toBe('Growth & Communications: Notification Templates');
    expect(linksByHref.get('/notifications/push-send')).toBe('Growth & Communications: Push Send');

    expect(linksByHref.get('/operations-policy')).toBe('Policies: Operations Policy');
    expect(linksByHref.get('/services')).toBe('Policies: Service Catalog');
    expect(linksByHref.get('/coupons')).toBe('Growth & Communications: Coupons');

    expect(linksByHref.get('/admin-operators')).toBe('Admin Control: Admin Operators');
    expect(linksByHref.get('/finance-tax/finance-approvers')).toBe('Admin Control: Finance Approvers');
    expect(linksByHref.get('/audit-log')).toBe('Admin Control: Audit Log');
  });

  it('keeps Developer/System diagnostics out of the default operator sidebar', () => {
    const defaultLinks = adminNavSections.flatMap((section) => section.links.map((link) => link.href));
    const masterSections = adminNavSectionsForAccess({ categories: [], roles: ['MASTER_ADMIN'] });
    const developerSections = adminNavSectionsForAccess({
      categories: ['DEVELOPER_APP_SESSIONS_DIAGNOSTICS'],
      roles: ['ADMIN'],
    });
    const masterLinks = masterSections.flatMap((section) =>
      section.links.map((link) => `${section.label}: ${link.label} -> ${link.href}`),
    );

    expect(defaultLinks).not.toContain('/setup');
    expect(defaultLinks).not.toContain('/app-sessions');
    expect(masterSections.map((section) => section.label)).toContain('Developer / System');
    expect(masterLinks).toContain('Developer / System: Setup Readiness -> /setup');
    expect(masterLinks).toContain('Developer / System: App Session Diagnostics -> /app-sessions');
    expect(developerSections.map((section) => section.label)).toContain('Developer / System');
  });

  it('keeps developer/system wording out of operation-facing sidebar descriptions', () => {
    const operatorDescriptions = adminNavSections.flatMap((section) => [
      `${section.label}: ${section.description}`,
      ...section.links.map((link) => `${section.label}: ${link.label}: ${link.description}`),
    ]);
    const developerTerms = /\b(readiness|snapshots?|setup|trace|debug|raw|diagnostics|health)\b/iu;

    expect(operatorDescriptions.filter((description) => developerTerms.test(description))).toEqual([]);
  });

  it('keeps booking filter views inside the bookings workspace instead of repeating sidebar links', () => {
    const bookingSection = adminNavSections.find((section) => section.label === 'Bookings');

    expect(bookingSection?.links.map((link) => link.href)).toEqual([
      '/bookings',
      '/bookings/completed',
      '/bookings/post-match-cancellations',
    ]);
    expect(bookingSection?.links[0]?.description).toContain('request intake');
    expect(bookingSection?.links[2]?.description).toContain('Post-match cancellation');
    expect(bookingSection?.links[1]?.description).toContain('closeout');
  });

  it('does not repeat the same route across nav categories', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const section of adminNavSections) {
      for (const link of section.links) {
        const firstLabel = seen.get(link.href);

        if (firstLabel) {
          duplicates.push(`${firstLabel} / ${section.label}: ${link.label} -> ${link.href}`);
          continue;
        }

        seen.set(link.href, `${section.label}: ${link.label}`);
      }
    }

    expect(duplicates).toEqual([]);
  });

  it('separates user records, partner operations, finance flow, and tax accounting', () => {
    const userSection = adminNavSections.find((section) => section.label === 'Customers');
    const partnerSection = adminNavSections.find((section) => section.label === 'Partners');
    const financeSection = adminNavSections.find((section) => section.label === 'Finance');
    const taxSection = adminNavSections.find((section) => section.label === 'Tax & Accounting');

    expect(userSection?.links.map((link) => link.href)).toEqual([
      '/customers',
      '/usage-overview',
      '/referrals/customers',
      '/reviews',
      '/reviews/partner-customer-evaluations',
    ]);
    expect(partnerSection?.links.map((link) => link.href)).toEqual([
      '/partners/overview',
      '/partners',
      '/partners?review=unapproved',
      '/partners?review=unsettled',
      '/referrals/partners',
      '/files',
    ]);
    expect(financeSection?.links.map((link) => link.href)).toContain('/finance-tax/payment-clearing');
    expect(financeSection?.links.map((link) => link.href)).not.toContain('/finance-tax/monthly-tax-closing');
    expect(taxSection?.links.map((link) => link.href)).toContain('/finance-tax/monthly-tax-closing');
    expect(taxSection?.links.map((link) => link.href)).toContain('/finance-tax/general-ledger');
    expect(taxSection?.links.find((link) => link.href === '/finance-tax/bank-reconciliation')?.description).toContain(
      'company bank accounts',
    );
    expect(taxSection?.links.map((link) => link.href)).toContain('/finance-tax/company-bank-accounts');
    expect(taxSection?.links.map((link) => link.href)).toContain('/finance-tax/coupon-finance');
    expect(taxSection?.links.map((link) => link.href)).not.toContain('/finance-tax/finance-approvers');
    expect(adminNavSections.find((section) => section.label === 'Admin Control')?.links.map((link) => link.href)).toEqual([
      '/admin-operators',
      '/finance-tax/finance-approvers',
      '/audit-log',
    ]);
    expect(adminNavSections.flatMap((section) => section.links.map((link) => link.href))).not.toContain(
      '/app-sessions?role=CUSTOMER&state=live',
    );
  });

  it('keeps every app page either in the sidebar menu or an intentional hidden route policy', () => {
    const pageRoutes = collectPageRoutes();
    const menuRoutes = new Set(
      allAdminNavSections.flatMap((section) =>
        section.links.map((link) => normalizeMenuRoute(link.href)),
      ),
    );
    const unclassifiedRoutes = pageRoutes.filter(
      (route) => !menuRoutes.has(route) && !intentionalHiddenRoutePolicy(route),
    );
    const staleHiddenPolicies = adminHiddenRouteRoutes().filter(
      (route) => !pageRoutes.includes(route),
    );

    expect(unclassifiedRoutes).toEqual([]);
    expect(staleHiddenPolicies).toEqual([]);
  });

  it('keeps sidebar and hidden operating pages mapped to an operator permission category', () => {
    const menuRoutes = allAdminNavSections.flatMap((section) =>
      section.links.map((link) => normalizeMenuRoute(link.href)),
    );
    const hiddenOperatingRoutes = adminHiddenRouteRoutes().filter((route) => route !== '/login');
    const unmappedRoutes = [...new Set([...menuRoutes, ...hiddenOperatingRoutes])]
      .filter((route) => !adminOperatorCategoryForPath(route))
      .sort();

    expect(unmappedRoutes).toEqual([]);
  });
});

function collectPageRoutes() {
  const appDirectory = path.join(process.cwd(), 'app');
  const pageFiles = collectPageFiles(appDirectory);

  return pageFiles.map((file) => pageFileToRoute(appDirectory, file)).sort();
}

function collectPageFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectPageFiles(entryPath);
    }

    return entry === 'page.tsx' ? [entryPath] : [];
  });
}

function pageFileToRoute(appDirectory: string, filePath: string) {
  const relativePath = path.relative(appDirectory, filePath);
  const routeSegments = relativePath
    .split(path.sep)
    .slice(0, -1)
    .filter((segment) => !segment.startsWith('('));

  return routeSegments.length === 0 ? '/' : `/${routeSegments.join('/')}`;
}

function normalizeMenuRoute(href: string) {
  return href.split('?')[0] || '/';
}

function intentionalHiddenRoutePolicy(route: string) {
  return Boolean(adminHiddenRoutePolicy(route));
}
