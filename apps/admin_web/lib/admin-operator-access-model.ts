export type AdminOperatorPermissionCategory =
  | 'BOOKINGS'
  | 'BOOKINGS_REALTIME'
  | 'BOOKINGS_IN_PROGRESS'
  | 'BOOKINGS_COMPLETED'
  | 'BOOKINGS_CANCELLATIONS'
  | 'BOOKINGS_DETAIL'
  | 'CUSTOMERS'
  | 'CUSTOMERS_DIRECTORY'
  | 'CUSTOMERS_DETAIL'
  | 'CUSTOMERS_REVIEWS'
  | 'PARTNERS'
  | 'PARTNERS_DIRECTORY'
  | 'PARTNERS_UNAPPROVED'
  | 'PARTNERS_DETAIL'
  | 'PARTNERS_KYC'
  | 'FINANCE'
  | 'FINANCE_PAYMENT_CLEARING'
  | 'FINANCE_GENERAL_LEDGER'
  | 'FINANCE_BANK_RECONCILIATION'
  | 'FINANCE_WALLET_ADJUSTMENTS'
  | 'FINANCE_SETTLEMENTS'
  | 'FINANCE_TAX'
  | 'NOTIFICATIONS'
  | 'NOTIFICATIONS_TEMPLATES'
  | 'NOTIFICATIONS_PUSH'
  | 'NOTIFICATIONS_DELIVERY'
  | 'SYSTEM'
  | 'SYSTEM_SERVICES'
  | 'SYSTEM_COUPONS'
  | 'SYSTEM_ADMIN_OPERATORS'
  | 'SYSTEM_POLICY'
  | 'SYSTEM_AUDIT'
  | 'SYSTEM_SETUP';

export type AdminOperatorAccessLike = {
  readonly categories: readonly string[];
} | null;

const pageCategoryRules: Array<{
  readonly category: AdminOperatorPermissionCategory;
  readonly prefixes: readonly string[];
}> = [
  {
    category: 'BOOKINGS_DETAIL',
    prefixes: ['/bookings/*'],
  },
  {
    category: 'BOOKINGS_REALTIME',
    prefixes: ['/bookings'],
  },
  {
    category: 'CUSTOMERS_DETAIL',
    prefixes: ['/customers/*'],
  },
  {
    category: 'CUSTOMERS_REVIEWS',
    prefixes: ['/reviews'],
  },
  {
    category: 'CUSTOMERS_DIRECTORY',
    prefixes: ['/customers'],
  },
  {
    category: 'PARTNERS_UNAPPROVED',
    prefixes: ['/partners?review=unapproved'],
  },
  {
    category: 'PARTNERS_DETAIL',
    prefixes: ['/partners/*', '/providers/*', '/partner-controls', '/files'],
  },
  {
    category: 'PARTNERS_DIRECTORY',
    prefixes: ['/partners', '/providers'],
  },
  {
    category: 'FINANCE_PAYMENT_CLEARING',
    prefixes: ['/finance-tax/payment-clearing', '/payments'],
  },
  {
    category: 'FINANCE_GENERAL_LEDGER',
    prefixes: ['/finance-tax/general-ledger'],
  },
  {
    category: 'FINANCE_BANK_RECONCILIATION',
    prefixes: ['/finance-tax/bank-reconciliation'],
  },
  {
    category: 'FINANCE_WALLET_ADJUSTMENTS',
    prefixes: ['/wallet-adjustments'],
  },
  {
    category: 'FINANCE_SETTLEMENTS',
    prefixes: ['/cash-settlements', '/earnings', '/payouts', '/refunds'],
  },
  {
    category: 'FINANCE_TAX',
    prefixes: ['/finance-tax'],
  },
  {
    category: 'NOTIFICATIONS_PUSH',
    prefixes: ['/notifications/push-send'],
  },
  {
    category: 'NOTIFICATIONS_DELIVERY',
    prefixes: ['/notifications'],
  },
  {
    category: 'SYSTEM_ADMIN_OPERATORS',
    prefixes: ['/admin-operators'],
  },
  {
    category: 'SYSTEM_AUDIT',
    prefixes: ['/audit-log'],
  },
  {
    category: 'SYSTEM_POLICY',
    prefixes: ['/operations-policy', '/tax-policy'],
  },
  {
    category: 'SYSTEM_SERVICES',
    prefixes: ['/services'],
  },
  {
    category: 'SYSTEM_COUPONS',
    prefixes: ['/coupons'],
  },
  {
    category: 'SYSTEM_SETUP',
    prefixes: ['/setup', '/usage-overview', '/vietnam-overview', '/marketing-analytics'],
  },
];

const apiCategoryRules: Array<{
  readonly category: AdminOperatorPermissionCategory;
  readonly prefixes: readonly string[];
}> = [
  {
    category: 'BOOKINGS_DETAIL',
    prefixes: ['/admin/bookings'],
  },
  {
    category: 'CUSTOMERS_REVIEWS',
    prefixes: ['/admin/reviews'],
  },
  {
    category: 'CUSTOMERS_DETAIL',
    prefixes: ['/admin/customers', '/admin/reviews'],
  },
  {
    category: 'PARTNERS_DETAIL',
    prefixes: ['/admin/providers', '/admin/partner-controls', '/admin/files'],
  },
  {
    category: 'FINANCE_BANK_RECONCILIATION',
    prefixes: ['/admin/bank-reconciliation'],
  },
  {
    category: 'FINANCE_PAYMENT_CLEARING',
    prefixes: ['/admin/booking-payment-clearing', '/admin/payments'],
  },
  {
    category: 'FINANCE_SETTLEMENTS',
    prefixes: [
      '/admin/booking-settlements',
      '/admin/cash-settlements',
      '/admin/earnings',
      '/admin/payouts',
      '/admin/refunds',
    ],
  },
  {
    category: 'FINANCE_WALLET_ADJUSTMENTS',
    prefixes: ['/admin/manual-wallet-adjustments', '/admin/wallet'],
  },
  {
    category: 'FINANCE_TAX',
    prefixes: [
      '/admin/finance',
      '/admin/monthly-tax-closings',
      '/admin/tax',
      '/admin/wallet',
    ],
  },
  {
    category: 'NOTIFICATIONS_DELIVERY',
    prefixes: ['/admin/notifications', '/admin/push'],
  },
  {
    category: 'SYSTEM_AUDIT',
    prefixes: ['/admin/audit-logs'],
  },
  {
    category: 'SYSTEM_COUPONS',
    prefixes: ['/admin/coupons'],
  },
  {
    category: 'SYSTEM_POLICY',
    prefixes: ['/admin/operational-policy'],
  },
  {
    category: 'SYSTEM_ADMIN_OPERATORS',
    prefixes: ['/admin/operator-activity', '/admin/users'],
  },
  {
    category: 'SYSTEM_SERVICES',
    prefixes: [
      '/admin/services',
    ],
  },
];

const parentCategories: Partial<Record<AdminOperatorPermissionCategory, AdminOperatorPermissionCategory>> = {
  BOOKINGS_REALTIME: 'BOOKINGS',
  BOOKINGS_IN_PROGRESS: 'BOOKINGS',
  BOOKINGS_COMPLETED: 'BOOKINGS',
  BOOKINGS_CANCELLATIONS: 'BOOKINGS',
  BOOKINGS_DETAIL: 'BOOKINGS',
  CUSTOMERS_DIRECTORY: 'CUSTOMERS',
  CUSTOMERS_DETAIL: 'CUSTOMERS',
  CUSTOMERS_REVIEWS: 'CUSTOMERS',
  FINANCE_BANK_RECONCILIATION: 'FINANCE',
  FINANCE_GENERAL_LEDGER: 'FINANCE',
  FINANCE_PAYMENT_CLEARING: 'FINANCE',
  FINANCE_SETTLEMENTS: 'FINANCE',
  FINANCE_TAX: 'FINANCE',
  FINANCE_WALLET_ADJUSTMENTS: 'FINANCE',
  NOTIFICATIONS_DELIVERY: 'NOTIFICATIONS',
  NOTIFICATIONS_PUSH: 'NOTIFICATIONS',
  NOTIFICATIONS_TEMPLATES: 'NOTIFICATIONS',
  PARTNERS_DETAIL: 'PARTNERS',
  PARTNERS_DIRECTORY: 'PARTNERS',
  PARTNERS_KYC: 'PARTNERS',
  PARTNERS_UNAPPROVED: 'PARTNERS',
  SYSTEM_ADMIN_OPERATORS: 'SYSTEM',
  SYSTEM_AUDIT: 'SYSTEM',
  SYSTEM_COUPONS: 'SYSTEM',
  SYSTEM_POLICY: 'SYSTEM',
  SYSTEM_SERVICES: 'SYSTEM',
  SYSTEM_SETUP: 'SYSTEM',
};

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
  const parentCategory = parentCategories[category];
  return Boolean(access?.categories.includes(category) || (parentCategory && access?.categories.includes(parentCategory)));
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
    rule.prefixes.some((prefix) => {
      if (prefix.endsWith('/*')) {
        const parentPrefix = prefix.slice(0, -2);
        return normalizedPathname.startsWith(`${parentPrefix}/`);
      }

      return normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`);
    }),
  );

  return matched?.category ?? null;
}

function normalizePath(pathname: string) {
  const [pathOnly] = pathname.split('?');
  const normalized = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return normalized.replace(/\/+$/u, '') || '/';
}
