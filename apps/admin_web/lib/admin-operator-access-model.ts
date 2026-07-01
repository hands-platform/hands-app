export type AdminOperatorPermissionCategory =
  | 'BOOKINGS'
  | 'CUSTOMERS'
  | 'PARTNERS'
  | 'FINANCE'
  | 'NOTIFICATIONS'
  | 'SYSTEM';

export type AdminOperatorAccessLike = {
  readonly categories: readonly string[];
} | null;

const pageCategoryRules: Array<{
  readonly category: AdminOperatorPermissionCategory;
  readonly prefixes: readonly string[];
}> = [
  {
    category: 'BOOKINGS',
    prefixes: ['/bookings'],
  },
  {
    category: 'CUSTOMERS',
    prefixes: ['/customers', '/reviews'],
  },
  {
    category: 'PARTNERS',
    prefixes: ['/partners', '/providers', '/partner-controls', '/files'],
  },
  {
    category: 'FINANCE',
    prefixes: ['/finance-tax', '/cash-settlements', '/wallet-adjustments', '/earnings', '/payments', '/payouts', '/refunds'],
  },
  {
    category: 'NOTIFICATIONS',
    prefixes: ['/notifications'],
  },
  {
    category: 'SYSTEM',
    prefixes: ['/admin-operators', '/audit-log', '/operations-policy', '/services', '/tax-policy', '/coupons', '/setup'],
  },
];

const apiCategoryRules: Array<{
  readonly category: AdminOperatorPermissionCategory;
  readonly prefixes: readonly string[];
}> = [
  {
    category: 'BOOKINGS',
    prefixes: ['/admin/bookings'],
  },
  {
    category: 'CUSTOMERS',
    prefixes: ['/admin/customers', '/admin/reviews'],
  },
  {
    category: 'PARTNERS',
    prefixes: ['/admin/providers', '/admin/partner-controls', '/admin/files'],
  },
  {
    category: 'FINANCE',
    prefixes: [
      '/admin/bank-reconciliation',
      '/admin/booking-payment-clearing',
      '/admin/booking-settlements',
      '/admin/cash-settlements',
      '/admin/earnings',
      '/admin/finance',
      '/admin/manual-wallet-adjustments',
      '/admin/monthly-tax-closings',
      '/admin/payments',
      '/admin/payouts',
      '/admin/refunds',
      '/admin/tax',
      '/admin/wallet',
    ],
  },
  {
    category: 'NOTIFICATIONS',
    prefixes: ['/admin/notifications', '/admin/push'],
  },
  {
    category: 'SYSTEM',
    prefixes: [
      '/admin/audit-logs',
      '/admin/coupons',
      '/admin/operational-policy',
      '/admin/operator-activity',
      '/admin/services',
      '/admin/users',
    ],
  },
];

export function adminOperatorCategoryForPath(pathname: string): AdminOperatorPermissionCategory | null {
  return categoryForPath(pathname, pageCategoryRules);
}

export function adminOperatorCategoryForAdminApiPath(
  method: 'DELETE' | 'PATCH' | 'POST',
  path: string,
): AdminOperatorPermissionCategory | null {
  if (!['DELETE', 'PATCH', 'POST'].includes(method)) {
    return null;
  }

  return categoryForPath(path, apiCategoryRules);
}

export function hasAdminOperatorCategory(
  access: AdminOperatorAccessLike,
  category: AdminOperatorPermissionCategory,
) {
  return Boolean(access?.categories.includes(category));
}

function categoryForPath(
  pathname: string,
  rules: Array<{
    readonly category: AdminOperatorPermissionCategory;
    readonly prefixes: readonly string[];
  }>,
) {
  const normalizedPathname = normalizePath(pathname);
  const matched = rules.find((rule) =>
    rule.prefixes.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`)),
  );

  return matched?.category ?? null;
}

function normalizePath(pathname: string) {
  const [pathOnly] = pathname.split('?');
  const normalized = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return normalized.replace(/\/+$/u, '') || '/';
}
