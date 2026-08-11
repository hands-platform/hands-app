import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AdminOperatorPermissionCategory, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type RequiredAdminCategory = AdminOperatorPermissionCategory;

type AdminRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  user?: AuthenticatedUser;
};

const ROUTE_ALLOWLIST = new Set([
  'GET /admin/users/admin-operator-access',
  'POST /admin/operator-activity',
]);

const CATEGORY_RULES: Array<{
  category: RequiredAdminCategory;
  patterns?: RegExp[];
  prefixes: string[];
}> = [
  { category: AdminOperatorPermissionCategory.DEVELOPER_HEALTH, prefixes: ['/admin/system/background-jobs'] },
  {
    category: AdminOperatorPermissionCategory.FINANCE_TAX,
    patterns: [/^\/admin\/(?:providers|partners)\/[^/]+\/tax-profile(?:\/|$)/u],
    prefixes: [],
  },
  {
    category: AdminOperatorPermissionCategory.PARTNERS_KYC,
    patterns: [/^\/admin\/(?:providers|partners)\/[^/]+\/kyc(?:\/|$)/u],
    prefixes: [],
  },
  {
    category: AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
    prefixes: ['/admin/dashboard', '/admin/vietnam-overview', '/admin/maps/vietnam-overview'],
  },
  { category: AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY, prefixes: ['/admin/usage-overview'] },
  { category: AdminOperatorPermissionCategory.PARTNERS_DIRECTORY, prefixes: ['/admin/partners/overview'] },
  { category: AdminOperatorPermissionCategory.FINANCE, prefixes: ['/admin/finance-overview'] },
  { category: AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER, prefixes: ['/admin/accounting-journal-batches'] },
  { category: AdminOperatorPermissionCategory.BOOKINGS_DETAIL, prefixes: ['/admin/chat-archive'] },
  {
    category: AdminOperatorPermissionCategory.DEVELOPER_APP_SESSIONS_DIAGNOSTICS,
    prefixes: ['/admin/app-sessions'],
  },
  { category: AdminOperatorPermissionCategory.BOOKINGS_DETAIL, prefixes: ['/admin/bookings'] },
  {
    category: AdminOperatorPermissionCategory.BOOKINGS_REALTIME,
    prefixes: ['/admin/operations-handoff', '/admin/calendar-events'],
  },
  { category: AdminOperatorPermissionCategory.CUSTOMERS_REVIEWS, prefixes: ['/admin/reviews'] },
  {
    category: AdminOperatorPermissionCategory.CUSTOMERS_REVIEWS,
    prefixes: ['/admin/partner-customer-reviews'],
  },
  { category: AdminOperatorPermissionCategory.CUSTOMERS_DETAIL, prefixes: ['/admin/customers'] },
  {
    category: AdminOperatorPermissionCategory.PARTNERS_KYC,
    prefixes: [
      '/admin/provider-documents',
      '/admin/partner-documents',
      '/admin/provider-bank-accounts',
      '/admin/partner-bank-accounts',
    ],
  },
  {
    category: AdminOperatorPermissionCategory.PARTNERS_DETAIL,
    prefixes: [
      '/admin/providers',
      '/admin/partners',
      '/admin/partner-controls',
      '/admin/files',
      '/admin/provider-reports',
      '/admin/partner-reports',
      '/admin/provider-sanctions',
      '/admin/partner-sanctions',
      '/admin/provider-devices',
      '/admin/partner-devices',
      '/admin/operations-policy/providers',
    ],
  },
  {
    category: AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
    prefixes: ['/admin/bank-reconciliation', '/admin/company-bank-accounts'],
  },
  {
    category: AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
    prefixes: ['/admin/booking-payment-clearing', '/admin/payment-callback-attempts', '/admin/payments'],
  },
  {
    category: AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
    prefixes: [
      '/admin/finance-approval-queue',
      '/admin/booking-settlement-gaps',
      '/admin/booking-settlements',
      '/admin/cash-settlements',
      '/admin/earnings',
      '/admin/payout-batches',
      '/admin/payouts',
      '/admin/provider-wallet/withdrawal-requests',
      '/admin/booking-settlement-snapshots',
      '/admin/booking-settlement-reversals',
      '/admin/cash-settlement-earnings',
      '/admin/cash-settlement-summary',
      '/admin/referrals/cashouts',
      '/admin/referrals/rewards',
      '/admin/refunds',
    ],
  },
  {
    category: AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
    prefixes: [
      '/admin/manual-wallet-adjustments',
      '/admin/provider-wallet/deposit-requests',
      '/admin/provider-wallet/deposits',
      '/admin/wallet-adjustments',
      '/admin/wallet-adjustment-requests',
      '/admin/wallet',
    ],
  },
  {
    category: AdminOperatorPermissionCategory.FINANCE_TAX,
    prefixes: [
      '/admin/finance',
      '/admin/monthly-tax-closings',
      '/admin/partner-withholding-tax',
      '/admin/platform-vat',
      '/admin/payment-fees',
      '/admin/tax-policy-versions',
      '/admin/tax-rules',
      '/admin/tax',
    ],
  },
  {
    category: AdminOperatorPermissionCategory.NOTIFICATIONS_TEMPLATES,
    prefixes: ['/admin/notifications/templates'],
  },
  {
    category: AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH,
    prefixes: ['/admin/notifications/push-campaigns'],
  },
  {
    category: AdminOperatorPermissionCategory.NOTIFICATIONS_RETRY,
    patterns: [/^\/admin\/notifications\/[^/]+\/retry$/u],
    prefixes: [],
  },
  {
    category: AdminOperatorPermissionCategory.DEVELOPER_SYSTEM,
    patterns: [/^\/admin\/notifications\/[^/]+\/review-legacy$/u],
    prefixes: [],
  },
  {
    category: AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY,
    prefixes: ['/admin/notifications', '/admin/push', '/admin/push-devices'],
  },
  { category: AdminOperatorPermissionCategory.GROWTH_MARKETING, prefixes: ['/admin/marketing'] },
  { category: AdminOperatorPermissionCategory.CUSTOMERS, prefixes: ['/admin/referrals/customers'] },
  { category: AdminOperatorPermissionCategory.PARTNERS, prefixes: ['/admin/referrals/partners'] },
  { category: AdminOperatorPermissionCategory.SYSTEM_AUDIT, prefixes: ['/admin/audit-logs'] },
  { category: AdminOperatorPermissionCategory.SYSTEM_COUPONS, prefixes: ['/admin/coupons'] },
  {
    category: AdminOperatorPermissionCategory.SYSTEM_POLICY,
    prefixes: [
      '/admin/operational-policy',
      '/admin/payment-fee-policies',
      '/admin/referrals/policies',
    ],
  },
  { category: AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS, prefixes: ['/admin/users'] },
  {
    category: AdminOperatorPermissionCategory.SYSTEM_SERVICES,
    prefixes: ['/admin/service-payout-rules', '/admin/services', '/services'],
  },
];

const PARENT_CATEGORIES: Partial<
  Record<AdminOperatorPermissionCategory, AdminOperatorPermissionCategory>
> = {
  [AdminOperatorPermissionCategory.BOOKINGS_REALTIME]: AdminOperatorPermissionCategory.BOOKINGS,
  [AdminOperatorPermissionCategory.BOOKINGS_IN_PROGRESS]: AdminOperatorPermissionCategory.BOOKINGS,
  [AdminOperatorPermissionCategory.BOOKINGS_COMPLETED]: AdminOperatorPermissionCategory.BOOKINGS,
  [AdminOperatorPermissionCategory.BOOKINGS_CANCELLATIONS]: AdminOperatorPermissionCategory.BOOKINGS,
  [AdminOperatorPermissionCategory.BOOKINGS_DETAIL]: AdminOperatorPermissionCategory.BOOKINGS,
  [AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY]: AdminOperatorPermissionCategory.CUSTOMERS,
  [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL]: AdminOperatorPermissionCategory.CUSTOMERS,
  [AdminOperatorPermissionCategory.CUSTOMERS_REVIEWS]: AdminOperatorPermissionCategory.CUSTOMERS,
  [AdminOperatorPermissionCategory.GROWTH_MARKETING]: AdminOperatorPermissionCategory.GROWTH,
  [AdminOperatorPermissionCategory.PARTNERS_DIRECTORY]: AdminOperatorPermissionCategory.PARTNERS,
  [AdminOperatorPermissionCategory.PARTNERS_UNAPPROVED]: AdminOperatorPermissionCategory.PARTNERS,
  [AdminOperatorPermissionCategory.PARTNERS_DETAIL]: AdminOperatorPermissionCategory.PARTNERS,
  [AdminOperatorPermissionCategory.PARTNERS_KYC]: AdminOperatorPermissionCategory.PARTNERS,
  [AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING]: AdminOperatorPermissionCategory.FINANCE,
  [AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER]: AdminOperatorPermissionCategory.FINANCE,
  [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION]: AdminOperatorPermissionCategory.FINANCE,
  [AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS]: AdminOperatorPermissionCategory.FINANCE,
  [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS]: AdminOperatorPermissionCategory.FINANCE,
  [AdminOperatorPermissionCategory.FINANCE_TAX]: AdminOperatorPermissionCategory.FINANCE,
  [AdminOperatorPermissionCategory.NOTIFICATIONS_TEMPLATES]: AdminOperatorPermissionCategory.NOTIFICATIONS,
  [AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH]: AdminOperatorPermissionCategory.NOTIFICATIONS,
  [AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY]: AdminOperatorPermissionCategory.NOTIFICATIONS,
  [AdminOperatorPermissionCategory.SYSTEM_SERVICES]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.SYSTEM_COUPONS]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.SYSTEM_POLICY]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.SYSTEM_AUDIT]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.SYSTEM_SETUP]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.CONTENT_VIEW]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.CONTENT_EDIT]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.CONTENT_PUBLISH]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.CONTENT_DELETE]: AdminOperatorPermissionCategory.SYSTEM,
  [AdminOperatorPermissionCategory.DEVELOPER_SETUP]: AdminOperatorPermissionCategory.DEVELOPER_SYSTEM,
  [AdminOperatorPermissionCategory.DEVELOPER_HEALTH]: AdminOperatorPermissionCategory.DEVELOPER_SYSTEM,
  [AdminOperatorPermissionCategory.DEVELOPER_APP_SESSIONS_DIAGNOSTICS]:
    AdminOperatorPermissionCategory.DEVELOPER_SYSTEM,
  [AdminOperatorPermissionCategory.DEVELOPER_ROUTE_COMPAT]: AdminOperatorPermissionCategory.DEVELOPER_SYSTEM,
};

@Injectable()
export class AdminOperatorCategoryGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const method = request.method?.toUpperCase() ?? '';
    const path = normalizeAdminPath(request.originalUrl ?? request.url ?? '');
    if (!isAdminOperatorProtectedPath(method, path)) {
      return true;
    }
    if (ROUTE_ALLOWLIST.has(`${method} ${path}`)) {
      return true;
    }

    const requiredCategory = adminOperatorCategoryForRequest(method, path);
    if (!requiredCategory) {
      throw new ForbiddenException('Admin route has no permission category');
    }

    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Admin operator identity is required');
    }

    const storedAccess = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        roles: true,
        adminOperatorPermission: { select: { categories: true } },
      },
    });
    if (!storedAccess?.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Admin operator access has been revoked');
    }
    if (storedAccess.roles.includes(Role.MASTER_ADMIN)) {
      return true;
    }

    const categories = storedAccess.adminOperatorPermission?.categories ?? [];
    if (adminOperatorHasRequiredCategory(categories, requiredCategory)) {
      return true;
    }

    throw new ForbiddenException(`Admin operator lacks ${requiredCategory} access`);
  }
}

export function adminOperatorCategoryForWritePath(path: string): RequiredAdminCategory | null {
  return adminOperatorCategoryForRequest('POST', path);
}

export function adminOperatorCategoryForPath(path: string): RequiredAdminCategory | null {
  const normalizedPath = normalizeAdminPath(path);
  if (normalizedPath === '/admin/site-pages' || normalizedPath.startsWith('/admin/site-pages/')) {
    return AdminOperatorPermissionCategory.CONTENT_VIEW;
  }
  return (
    CATEGORY_RULES.find((rule) =>
      rule.patterns?.some((pattern) => pattern.test(normalizedPath)) ||
      rule.prefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)),
    )?.category ?? null
  );
}

function adminOperatorCategoryForRequest(method: string, path: string): RequiredAdminCategory | null {
  const normalizedPath = normalizeAdminPath(path);
  if (normalizedPath === '/admin/site-pages' || normalizedPath.startsWith('/admin/site-pages/')) {
    if (method === 'GET') return AdminOperatorPermissionCategory.CONTENT_VIEW;
    if (method === 'DELETE' && normalizedPath.endsWith('/draft')) {
      return AdminOperatorPermissionCategory.CONTENT_EDIT;
    }
    if (method === 'DELETE') return AdminOperatorPermissionCategory.CONTENT_DELETE;
    if (normalizedPath.endsWith('/publish') || normalizedPath.endsWith('/rollback')) {
      return AdminOperatorPermissionCategory.CONTENT_PUBLISH;
    }
    return AdminOperatorPermissionCategory.CONTENT_EDIT;
  }
  if (
    method !== 'GET' &&
    (normalizedPath.startsWith('/admin/payment-fee-policies') ||
      normalizedPath === '/admin/company-bank-accounts' ||
      /^\/admin\/company-bank-accounts\/[^/]+$/u.test(normalizedPath) ||
      normalizedPath.startsWith('/admin/tax-policy-versions')) &&
    !normalizedPath.endsWith('/approval-decision')
  ) {
    return AdminOperatorPermissionCategory.SYSTEM_POLICY;
  }

  return adminOperatorCategoryForPath(normalizedPath);
}

export function isAllowlistedAdminWrite(method: string, path: string) {
  return isAllowlistedAdminRoute(method, path);
}

export function isAllowlistedAdminRoute(method: string, path: string) {
  return ROUTE_ALLOWLIST.has(`${method.toUpperCase()} ${normalizeAdminPath(path)}`);
}

export function adminOperatorHasRequiredCategory(
  categories: readonly AdminOperatorPermissionCategory[],
  requiredCategory: RequiredAdminCategory,
) {
  const parent = PARENT_CATEGORIES[requiredCategory];
  const legacySystemSetup =
    categories.includes(AdminOperatorPermissionCategory.SYSTEM_SETUP) &&
    ([
      AdminOperatorPermissionCategory.DEVELOPER_SETUP,
      AdminOperatorPermissionCategory.DEVELOPER_HEALTH,
      AdminOperatorPermissionCategory.DEVELOPER_ROUTE_COMPAT,
    ] as RequiredAdminCategory[]).includes(requiredCategory);
  const legacyContentPolicy =
    categories.includes(AdminOperatorPermissionCategory.SYSTEM_POLICY) &&
    ([
      AdminOperatorPermissionCategory.CONTENT_VIEW,
      AdminOperatorPermissionCategory.CONTENT_EDIT,
      AdminOperatorPermissionCategory.CONTENT_PUBLISH,
      AdminOperatorPermissionCategory.CONTENT_DELETE,
    ] as RequiredAdminCategory[]).includes(requiredCategory);
  return categories.includes(requiredCategory) || Boolean(parent && categories.includes(parent)) || legacySystemSetup || legacyContentPolicy;
}

function normalizeAdminPath(value: string) {
  const [pathOnly] = value.split('?');
  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const withoutApiPrefix = withLeadingSlash.replace(/^\/api(?=\/)/u, '');
  return withoutApiPrefix.replace(/\/+$/u, '') || '/';
}

function isAdminOperatorProtectedPath(method: string, path: string) {
  return path === '/admin' || path.startsWith('/admin/') || (method === 'POST' && path === '/services');
}
