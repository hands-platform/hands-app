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
  | 'GROWTH'
  | 'GROWTH_MARKETING'
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
  | 'SYSTEM_SETUP'
  | 'DEVELOPER_SYSTEM'
  | 'DEVELOPER_SETUP'
  | 'DEVELOPER_HEALTH'
  | 'DEVELOPER_APP_SESSIONS_DIAGNOSTICS'
  | 'DEVELOPER_ROUTE_COMPAT';

export type AdminOperatorAccessLike = {
  readonly categories: readonly string[];
  readonly roles?: readonly string[];
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
    prefixes: ['/', '/bookings', '/vietnam-overview', '/calendar', '/operations-handoff'],
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
    prefixes: ['/customers', '/usage-overview'],
  },
  {
    category: 'GROWTH_MARKETING',
    prefixes: ['/marketing-analytics'],
  },
  {
    category: 'PARTNERS_UNAPPROVED',
    prefixes: ['/partners?review=unapproved'],
  },
  {
    category: 'PARTNERS_DIRECTORY',
    prefixes: ['/partners/overview'],
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
    category: 'FINANCE',
    prefixes: ['/finance-overview', '/finance-closeout'],
  },
  {
    category: 'FINANCE_SETTLEMENTS',
    prefixes: ['/finance-tax/approval-queue'],
  },
  {
    category: 'FINANCE_GENERAL_LEDGER',
    prefixes: ['/finance-tax/general-ledger'],
  },
  {
    category: 'SYSTEM_ADMIN_OPERATORS',
    prefixes: ['/finance-tax/finance-approvers'],
  },
  {
    category: 'FINANCE_BANK_RECONCILIATION',
    prefixes: ['/finance-tax/bank-reconciliation', '/finance-tax/company-bank-accounts'],
  },
  {
    category: 'FINANCE_TAX',
    prefixes: ['/finance-tax/coupon-finance'],
  },
  {
    category: 'FINANCE_WALLET_ADJUSTMENTS',
    prefixes: ['/finance-tax/partner-bank-deposits', '/wallet-adjustments'],
  },
  {
    category: 'FINANCE_SETTLEMENTS',
    prefixes: ['/cash-settlements', '/earnings', '/payouts', '/refunds', '/referrals/cashouts'],
  },
  {
    category: 'CUSTOMERS',
    prefixes: ['/referrals/customers'],
  },
  {
    category: 'PARTNERS',
    prefixes: ['/referrals/partners'],
  },
  {
    category: 'CUSTOMERS',
    prefixes: ['/referrals'],
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
    prefixes: ['/audit-log', '/chat-archive'],
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
    category: 'DEVELOPER_SETUP',
    prefixes: ['/setup'],
  },
  {
    category: 'DEVELOPER_APP_SESSIONS_DIAGNOSTICS',
    prefixes: ['/app-sessions'],
  },
  {
    category: 'DEVELOPER_HEALTH',
    prefixes: ['/background-jobs'],
  },
];

const apiCategoryRules: Array<{
  readonly category: AdminOperatorPermissionCategory;
  readonly prefixes: readonly string[];
}> = [
  {
    category: 'DEVELOPER_HEALTH',
    prefixes: ['/admin/system/background-jobs'],
  },
  {
    category: 'BOOKINGS_DETAIL',
    prefixes: ['/admin/bookings'],
  },
  {
    category: 'BOOKINGS_REALTIME',
    prefixes: ['/admin/operations-handoff', '/admin/calendar-events'],
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
    category: 'PARTNERS_KYC',
    prefixes: ['/admin/partner-documents', '/admin/partner-bank-accounts'],
  },
  {
    category: 'PARTNERS_DETAIL',
    prefixes: [
      '/admin/providers',
      '/admin/partners',
      '/admin/partner-controls',
      '/admin/files',
      '/admin/provider-reports',
      '/admin/provider-sanctions',
      '/admin/partner-devices',
    ],
  },
  {
    category: 'FINANCE_BANK_RECONCILIATION',
    prefixes: ['/admin/bank-reconciliation', '/admin/company-bank-accounts'],
  },
  {
    category: 'FINANCE_PAYMENT_CLEARING',
    prefixes: ['/admin/booking-payment-clearing', '/admin/payments'],
  },
  {
    category: 'FINANCE_SETTLEMENTS',
    prefixes: [
      '/admin/finance-approval-queue',
      '/admin/booking-settlement-gaps',
      '/admin/booking-settlements',
      '/admin/cash-settlements',
      '/admin/earnings',
      '/admin/payout-batches',
      '/admin/payouts',
      '/admin/provider-wallet/withdrawal-requests',
      '/admin/referrals/cashouts',
      '/admin/referrals/rewards',
      '/admin/refunds',
    ],
  },
  {
    category: 'FINANCE_WALLET_ADJUSTMENTS',
    prefixes: [
      '/admin/manual-wallet-adjustments',
      '/admin/provider-wallet/deposit-requests',
      '/admin/provider-wallet/deposits',
      '/admin/wallet',
      '/admin/wallet-adjustments',
      '/admin/wallet-adjustment-requests',
    ],
  },
  {
    category: 'FINANCE_TAX',
    prefixes: [
      '/admin/finance',
      '/admin/monthly-tax-closings',
      '/admin/payment-fee-policies',
      '/admin/tax-policy-versions',
      '/admin/tax-rules',
      '/admin/tax',
      '/admin/wallet',
    ],
  },
  {
    category: 'NOTIFICATIONS_DELIVERY',
    prefixes: ['/admin/notifications', '/admin/push', '/admin/push-devices'],
  },
  {
    category: 'GROWTH_MARKETING',
    prefixes: ['/admin/marketing'],
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
    prefixes: ['/admin/operational-policy', '/admin/referrals/policies'],
  },
  {
    category: 'SYSTEM_ADMIN_OPERATORS',
    prefixes: ['/admin/users'],
  },
  {
    category: 'SYSTEM_SERVICES',
    prefixes: [
      '/admin/service-payout-rules',
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
  DEVELOPER_APP_SESSIONS_DIAGNOSTICS: 'DEVELOPER_SYSTEM',
  DEVELOPER_HEALTH: 'DEVELOPER_SYSTEM',
  DEVELOPER_ROUTE_COMPAT: 'DEVELOPER_SYSTEM',
  DEVELOPER_SETUP: 'DEVELOPER_SYSTEM',
  FINANCE_BANK_RECONCILIATION: 'FINANCE',
  FINANCE_GENERAL_LEDGER: 'FINANCE',
  FINANCE_PAYMENT_CLEARING: 'FINANCE',
  FINANCE_SETTLEMENTS: 'FINANCE',
  FINANCE_TAX: 'FINANCE',
  FINANCE_WALLET_ADJUSTMENTS: 'FINANCE',
  GROWTH_MARKETING: 'GROWTH',
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

const legacyCategoryAliases: Partial<Record<AdminOperatorPermissionCategory, readonly AdminOperatorPermissionCategory[]>> = {
  SYSTEM_SETUP: ['DEVELOPER_SETUP', 'DEVELOPER_HEALTH', 'DEVELOPER_ROUTE_COMPAT'],
};

const uncategorizedWriteApiAllowlist: Record<string, string> = {
  'POST /admin/operator-activity': 'Operator activity is the audit sink used to record access decisions.',
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

export function adminOperatorUncategorizedWriteApiAllowlistReason(
  method: 'DELETE' | 'PATCH' | 'POST',
  path: string,
) {
  return uncategorizedWriteApiAllowlist[`${method} ${normalizePath(path)}`] ?? null;
}

export function hasAdminOperatorCategory(
  access: AdminOperatorAccessLike,
  category: AdminOperatorPermissionCategory,
) {
  if (access?.roles?.includes('MASTER_ADMIN')) {
    return true;
  }

  const parentCategory = parentCategories[category];
  return Boolean(
    accessIncludesCategory(access?.categories ?? [], category) ||
      (parentCategory && accessIncludesCategory(access?.categories ?? [], parentCategory)),
  );
}

function accessIncludesCategory(categories: readonly string[], category: AdminOperatorPermissionCategory) {
  return categories.some(
    (candidate) =>
      candidate === category ||
      legacyCategoryAliases[candidate as AdminOperatorPermissionCategory]?.includes(category),
  );
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
