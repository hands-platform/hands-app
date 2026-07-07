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
  '/bookings/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/bookings'],
    reason: 'Booking detail opens from booking lists and evidence links.',
  },
  '/chat-archive': {
    kind: 'AUDIT_SEARCH',
    primaryRoutes: ['/bookings/[id]', '/customers/[id]', '/partners/[id]'],
    reason: 'Audit search page is intentionally kept out of the sidebar and opened from detail evidence links.',
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
  '/finance-tax/settlement-reversals/[id]': {
    kind: 'DETAIL_PAGE',
    primaryRoutes: ['/finance-tax/settlement-reversals'],
    reason: 'Reversal detail opens from settlement reversal lists and finance evidence links.',
  },
  '/login': {
    kind: 'AUTH_BOUNDARY',
    primaryRoutes: ['/'],
    reason: 'Public admin login page is outside the authenticated sidebar shell.',
  },
  '/partner-controls': {
    kind: 'DEEP_OPERATIONAL_EVIDENCE',
    primaryRoutes: ['/partners/[id]', '/cash-settlements', '/payouts'],
    reason: 'Partner controls are deep operational evidence opened from partner and payout contexts.',
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
