export const intentionallyUnlistedPageRoutes = {
  '/bookings/[id]': 'Booking detail opens from booking lists and evidence links.',
  '/chat-archive': 'Audit search page is intentionally kept out of the sidebar and opened from detail evidence links.',
  '/customers/[id]': 'Customer detail opens from customer lists, booking detail, and evidence links.',
  '/finance-tax/bank-reconciliation/[id]': 'Bank transaction detail opens from reconciliation and finance evidence links.',
  '/finance-tax/booking-settlement-audit/[id]': 'Settlement snapshot detail opens from audit and reversal evidence links.',
  '/finance-tax/general-ledger/[id]': 'Journal detail opens from ledger and reversal evidence links.',
  '/finance-tax/payment-clearing/[id]': 'Payment clearing detail opens from clearing and reversal evidence links.',
  '/finance-tax/settlement-reversals/[id]': 'Reversal detail opens from settlement reversal lists and finance evidence links.',
  '/login': 'Public admin login page is outside the authenticated sidebar shell.',
  '/partner-controls': 'Partner controls are deep operational evidence opened from partner and payout contexts.',
  '/partners/[id]': 'Partner detail opens from partner lists, bookings, and finance evidence links.',
  '/payments/[id]': 'Payment detail opens from payment lists and booking finance evidence links.',
  '/providers': 'Legacy provider alias is kept for compatibility; primary navigation uses Partners.',
  '/providers/[id]': 'Legacy provider detail alias is kept for compatibility; primary navigation uses Partner detail.',
  '/referrals': 'Referral hub is intentionally hidden; sidebar links point to customer, partner, and cashout lanes.',
  '/referrals/customers/[id]': 'Customer referral parent detail opens from customer referral lists.',
  '/referrals/partners/[id]': 'Partner referral parent detail opens from partner referral lists.',
} as const;

export type AdminHiddenRoute = keyof typeof intentionallyUnlistedPageRoutes;

export function adminHiddenRoutePolicy(route: string) {
  return intentionallyUnlistedPageRoutes[route as AdminHiddenRoute] ?? null;
}

export function adminHiddenRouteRoutes() {
  return Object.keys(intentionallyUnlistedPageRoutes).sort();
}
