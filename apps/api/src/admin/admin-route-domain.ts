export type AdminRouteDomain =
  | 'IDENTITY'
  | 'CUSTOMER'
  | 'ANALYTICS'
  | 'REFERRAL'
  | 'PARTNER'
  | 'BOOKING'
  | 'FINANCE'
  | 'CATALOG'
  | 'TRUST'
  | 'GOVERNANCE'
  | 'NOTIFICATION';

const ADMIN_ROUTE_DOMAIN_RULES: ReadonlyArray<{
  domain: AdminRouteDomain;
  matches: (path: string) => boolean;
}> = [
  {
    domain: 'IDENTITY',
    matches: prefixMatcher(
      'users',
      'operator-activity',
      'calendar-events',
      'app-sessions',
      'finance-approver-governance',
      'admin-operator-invitations',
      'admin-operators',
      'admin-operator-history',
    ),
  },
  {
    domain: 'CUSTOMER',
    matches: prefixMatcher('customers'),
  },
  {
    domain: 'ANALYTICS',
    matches: prefixMatcher(
      'dashboard',
      'vietnam-overview',
      'maps/vietnam-overview',
      'usage-overview',
      'partners/overview',
      'marketing',
    ),
  },
  {
    domain: 'REFERRAL',
    matches: prefixMatcher('referrals'),
  },
  {
    domain: 'PARTNER',
    matches: prefixMatcher(
      'providers',
      'partners',
      'operations-policy/providers',
      'operations-policy/matching-preview',
      'operations-handoff/providers',
      'partner-controls',
      'push-devices',
      'provider-devices',
      'partner-devices',
      'provider-reports',
      'partner-reports',
      'provider-sanctions',
      'partner-sanctions',
      'files',
    ),
  },
  {
    domain: 'BOOKING',
    matches: prefixMatcher('bookings', 'chat-archive'),
  },
  {
    domain: 'FINANCE',
    matches: prefixMatcher(
      'payments',
      'payment-callback-attempts',
      'refunds',
      'finance-overview',
      'finance-approval-queue',
      'earnings',
      'cash-settlement',
      'booking-settlement',
      'partner-withholding-tax',
      'monthly-tax-closings',
      'platform-vat',
      'payment-fee',
      'payment-fees',
      'accounting-journal-batches',
      'booking-payment-clearing',
      'company-bank-accounts',
      'bank-reconciliation',
      'provider-wallet',
      'wallet-adjustments',
      'wallet-adjustment-requests',
      'payout-batches',
    ),
  },
  {
    domain: 'CATALOG',
    matches: prefixMatcher('services', 'service-payout-rules', 'coupons', 'site-pages'),
  },
  {
    domain: 'TRUST',
    matches: prefixMatcher('reviews', 'partner-customer-reviews'),
  },
  {
    domain: 'GOVERNANCE',
    matches: prefixMatcher('audit-logs', 'operations-handoff', 'operational-policy'),
  },
  {
    domain: 'NOTIFICATION',
    matches: prefixMatcher('notifications'),
  },
];

export function adminRouteDomain(path: string): AdminRouteDomain | null {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  return ADMIN_ROUTE_DOMAIN_RULES.find((rule) => rule.matches(normalizedPath))?.domain ?? null;
}

function prefixMatcher(...prefixes: string[]) {
  return (path: string) =>
    prefixes.some(
      (prefix) =>
        path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}-`),
    );
}
