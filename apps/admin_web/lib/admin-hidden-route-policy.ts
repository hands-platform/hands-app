export type AdminHiddenRoutePolicyKind =
  | 'AUDIT_SEARCH'
  | 'AUTH_BOUNDARY'
  | 'DEEP_OPERATIONAL_EVIDENCE'
  | 'DETAIL_PAGE'
  | 'HIDDEN_HUB'
  | 'LEGACY_ALIAS';

export type AdminHiddenRoutePolicyDetails = {
  readonly kind: AdminHiddenRoutePolicyKind;
  readonly primaryRoutes: readonly string[];
  readonly reason: string;
};

export const intentionallyUnlistedPageRoutes = {
  '/background-jobs/incidents/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/background-jobs'],
    reason: 'Background job incident detail opens from retained system incident and job evidence links.',
  },
  '/bookings/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/bookings'],
    reason: 'Booking detail opens from booking lists and evidence links.',
  },
  '/customers/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/customers', '/bookings/[id]'],
    reason: 'Customer detail opens from customer lists, booking detail, and evidence links.',
  },
  '/finance-tax/bank-reconciliation/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/bank-reconciliation'],
    reason: 'Bank transaction detail opens from reconciliation and finance evidence links.',
  },
  '/finance-tax/bank-reconciliation/import-batches/[batchImportId]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/bank-reconciliation'],
    reason: 'Bank statement import batch detail opens from the reconciliation import history.',
  },
  '/finance-tax/booking-settlement-audit/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/booking-settlement-audit', '/finance-tax/settlement-reversals'],
    reason: 'Settlement record detail opens from audit and reversal evidence links.',
  },
  '/finance-tax/general-ledger/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/general-ledger', '/finance-tax/settlement-reversals'],
    reason: 'Journal detail opens from ledger and reversal evidence links.',
  },
  '/finance-tax/payment-clearing/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/payment-clearing'],
    reason: 'Payment clearing detail opens from clearing and reversal evidence links.',
  },
  '/finance-tax/partner-bank-deposits/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/partner-bank-deposits', '/cash-settlements'],
    reason: 'Partner bank deposit detail opens from deposit history, approval, and cash-debt evidence links.',
  },
  '/finance-tax/settlement-reversals/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/settlement-reversals'],
    reason: 'Reversal detail opens from settlement reversal lists and finance evidence links.',
  },
  '/files': {
    kind: 'LEGACY_ALIAS',
    primaryRoutes: ['/partners/[id]'],
    reason:
      'Legacy file review route is preserved for compatibility; Partner documents and public media are reviewed from Partner detail.',
  },
  '/login': {
    kind: 'AUTH_BOUNDARY',
    primaryRoutes: ['/'],
    reason: 'Public admin login page is outside the authenticated sidebar shell.',
  },
  '/partners/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/partners', '/bookings/[id]'],
    reason: 'Partner detail opens from partner lists, bookings, and finance evidence links.',
  },
  '/payments/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/payments', '/bookings/[id]'],
    reason: 'Payment detail opens from payment lists and booking finance evidence links.',
  },
  '/providers': {
    kind: 'LEGACY_ALIAS',
    primaryRoutes: ['/partners'],
    reason: 'Legacy provider alias is kept for compatibility; primary navigation uses Partners.',
  },
  '/providers/[id]': {
    kind: 'LEGACY_ALIAS',
    primaryRoutes: ['/partners/[id]'],
    reason: 'Legacy provider detail alias is kept for compatibility; primary navigation uses Partner detail.',
  },
  '/referrals': {
    kind: 'HIDDEN_HUB',
    primaryRoutes: ['/referrals/customers', '/referrals/partners', '/referrals/cashouts'],
    reason: 'Referral hub is intentionally hidden; sidebar links point to customer, partner, and cashout lanes.',
  },
  '/referrals/customers/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/referrals/customers'],
    reason: 'Customer referral parent detail opens from customer referral lists.',
  },
  '/referrals/partners/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/referrals/partners'],
    reason: 'Partner referral parent detail opens from partner referral lists.',
  },
} as const;

export type AdminHiddenRoute = keyof typeof intentionallyUnlistedPageRoutes;

export function adminHiddenRoutePolicy(route: string) {
  return adminHiddenRoutePolicyDetails(route)?.reason ?? null;
}

export function adminHiddenRoutePolicyDetails(route: string): AdminHiddenRoutePolicyDetails | null {
  return intentionallyUnlistedPageRoutes[route as AdminHiddenRoute] ?? null;
}

export function adminHiddenRouteRoutes() {
  return Object.keys(intentionallyUnlistedPageRoutes).sort();
}
