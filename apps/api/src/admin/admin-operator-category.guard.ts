import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AdminOperatorPermissionCategory, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type RequiredAdminCategory = AdminOperatorPermissionCategory;

type AdminRequest = {
  body?: Record<string, unknown>;
  method?: string;
  originalUrl?: string;
  url?: string;
  user?: AuthenticatedUser;
};

const ADMIN_RECENT_REAUTHENTICATION_WINDOW_MS = 10 * 60_000;

const RECENT_REAUTHENTICATION_ROUTES = [
  /^POST \/admin\/bank-reconciliation\/[^/]+\/ignore$/u,
  /^POST \/admin\/bank-reconciliation\/[^/]+\/matches$/u,
  /^POST \/admin\/bank-reconciliation\/[^/]+\/matches\/[^/]+\/reverse$/u,
  /^POST \/admin\/booking-settlement-gaps\/[^/]+\/repair$/u,
  /^POST \/admin\/company-bank-accounts\/[^/]+\/approval-decision$/u,
  /^POST \/admin\/payment-fee-policies\/[^/]+\/(?:approval-reject|activate)$/u,
  /^POST \/admin\/payments\/[^/]+\/(?:capture|refund|release)$/u,
  /^POST \/admin\/provider-wallet\/deposits$/u,
  /^POST \/admin\/provider-wallet\/deposit-requests\/[^/]+\/(?:approve|reject)$/u,
  /^POST \/admin\/provider-wallet\/withdrawal-requests\/[^/]+\/reversal$/u,
  /^POST \/admin\/payout-batches\/[^/]+\/reversal$/u,
  /^POST \/admin\/referrals\/rewards\/[^/]+\/cashout-paid$/u,
  /^POST \/admin\/wallet-adjustment-requests\/[^/]+\/(?:approve|reject)$/u,
  /^POST \/admin\/wallet-adjustments$/u,
] as const;

const ROUTE_ALLOWLIST = new Set([
  'GET /admin/users/admin-operator-access',
  'GET /admin/admin-operators/me/session',
  'GET /admin/admin-operators/me/mfa',
  'POST /admin/admin-operators/reauthenticate',
  'POST /admin/admin-operators/me/session/revoke',
  'POST /admin/admin-operators/me/mfa/enrollment',
  'POST /admin/admin-operators/me/mfa/verify',
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
    category: AdminOperatorPermissionCategory.DEVELOPER_SYSTEM,
    prefixes: ['/admin/operations-policy/matching-preview'],
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
      '/admin/tax-policy-approval-requests',
      '/admin/tax-policy-audit-logs',
      '/admin/tax-policy-capabilities',
      '/admin/tax-policy-integrity-records',
      '/admin/tax-policy-integrity-summary',
      '/admin/tax-policy-workspace-summary',
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
  { category: AdminOperatorPermissionCategory.DEVELOPER_SYSTEM, prefixes: ['/admin/referrals/customers/fixtures'] },
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
  {
    category: AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
    prefixes: [
      '/admin/users',
      '/admin/admin-operator-invitations',
      '/admin/admin-operator-history',
      '/admin/admin-operators',
      '/admin/finance-approver-governance',
    ],
  },
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

    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Admin operator identity is required');
    }
    if (user.adminMfaEnrollmentRequired) {
      await this.recordAuthorizationDenial(user, method, path, 'MFA_ENROLLMENT_REQUIRED');
      throw new ForbiddenException({
        code: 'MFA_ENROLLMENT_REQUIRED',
        message: 'MFA enrollment is required before using Admin operations',
      });
    }

    const requiredCategory = adminOperatorCategoryForRequest(method, path);
    if (!requiredCategory) {
      await this.recordAuthorizationDenial(user, method, path, 'UNMAPPED_ADMIN_ROUTE');
      throw new ForbiddenException('Admin route has no permission category');
    }

    const storedAccess = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        roles: true,
        adminOperatorPermission: { select: { categories: true } },
      },
    });
    if (!storedAccess?.roles.includes(Role.ADMIN)) {
      await this.recordAuthorizationDenial(user, method, path, 'ADMIN_ROLE_REVOKED', requiredCategory);
      throw new ForbiddenException('Admin operator access has been revoked');
    }
    const categories = storedAccess.adminOperatorPermission?.categories ?? [];
    if (
      !storedAccess.roles.includes(Role.MASTER_ADMIN) &&
      !adminOperatorHasRequiredCategory(categories, requiredCategory)
    ) {
      await this.recordAuthorizationDenial(user, method, path, 'CATEGORY_MISSING', requiredCategory);
      throw new ForbiddenException(`Admin operator lacks ${requiredCategory} access`);
    }

    if (requiresRecentAdminReauthentication(method, path, request.body)) {
      try {
        await this.assertRecentAdminReauthentication(user.id, user.sessionId);
      } catch (error) {
        await this.recordAuthorizationDenial(user, method, path, 'RECENT_REAUTH_REQUIRED', requiredCategory);
        throw error;
      }
    }

    return true;
  }

  private async assertRecentAdminReauthentication(userId: string, sessionId: string | undefined) {
    const now = new Date();
    const session = sessionId
      ? await this.prisma.adminWebSession.findUnique({
          where: { id: sessionId },
          select: {
            expiresAt: true,
            mfaVerifiedAt: true,
            reauthenticatedAt: true,
            revokedAt: true,
            userId: true,
          },
        })
      : null;
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime() ||
      !session.reauthenticatedAt ||
      now.getTime() - session.reauthenticatedAt.getTime() > ADMIN_RECENT_REAUTHENTICATION_WINDOW_MS ||
      !session.mfaVerifiedAt ||
      now.getTime() - session.mfaVerifiedAt.getTime() > ADMIN_RECENT_REAUTHENTICATION_WINDOW_MS
    ) {
      throw new ForbiddenException({
        code: 'RECENT_REAUTH_REQUIRED',
        message: 'Recent reauthentication is required for this finance action',
      });
    }
  }

  private async recordAuthorizationDenial(
    user: AuthenticatedUser,
    method: string,
    path: string,
    reason: string,
    requiredCategory?: RequiredAdminCategory,
  ) {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actorId: user.id,
          action: 'admin_operator.authorization.denied',
          target: `admin_route:${method}:${path}`,
          metadata: {
            authProvider: user.authProvider ?? null,
            reason,
            requiredCategory: requiredCategory ?? null,
            sessionId: user.sessionId ?? null,
          },
        },
      });
    } catch {
      // Authorization remains fail closed even if audit persistence is temporarily unavailable.
    }
  }
}

export function requiresRecentAdminReauthentication(
  method: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const route = `${method.toUpperCase()} ${normalizeAdminPath(path)}`;
  if (RECENT_REAUTHENTICATION_ROUTES.some((pattern) => pattern.test(route))) {
    return true;
  }
  return (
    (/^PATCH \/admin\/monthly-tax-closings\/[^/]+\/status$/u.test(route) ||
      /^PATCH \/admin\/provider-wallet\/withdrawal-requests\/[^/]+$/u.test(route) ||
      /^PATCH \/admin\/payout-batches\/[^/]+$/u.test(route)) &&
    body?.status === 'PAID'
  );
}

export function adminOperatorCategoryForWritePath(path: string): RequiredAdminCategory | null {
  return adminOperatorCategoryForRequest('POST', path);
}

export function adminOperatorCategoryForPath(path: string): RequiredAdminCategory | null {
  const normalizedPath = normalizeAdminPath(path);
  if (normalizedPath === '/health/external') {
    return AdminOperatorPermissionCategory.DEVELOPER_HEALTH;
  }
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
  if (method !== 'GET' && normalizedPath === '/admin/marketing/spend-daily') {
    return AdminOperatorPermissionCategory.GROWTH_MARKETING_SPEND;
  }
  if (normalizedPath === '/admin/finance-approver-governance/history') {
    return AdminOperatorPermissionCategory.SYSTEM_AUDIT;
  }
  if (/^\/admin\/finance-approver-governance\/requests\/[^/]+\/decision$/u.test(normalizedPath)) {
    return AdminOperatorPermissionCategory.SYSTEM_POLICY;
  }
  if (normalizedPath === '/admin/site-pages' || normalizedPath.startsWith('/admin/site-pages/')) {
    if (method === 'GET') return AdminOperatorPermissionCategory.CONTENT_VIEW;
    if (method === 'DELETE' && normalizedPath.endsWith('/draft')) {
      return AdminOperatorPermissionCategory.CONTENT_EDIT;
    }
    if (method === 'DELETE') return AdminOperatorPermissionCategory.CONTENT_DELETE;
    if (
      normalizedPath.endsWith('/publish') ||
      normalizedPath.endsWith('/rollback') ||
      normalizedPath.endsWith('/take-offline')
    ) {
      return AdminOperatorPermissionCategory.CONTENT_PUBLISH;
    }
    return AdminOperatorPermissionCategory.CONTENT_EDIT;
  }
  if (
    method !== 'GET' &&
    (normalizedPath.startsWith('/admin/payment-fee-policies') ||
      normalizedPath === '/admin/company-bank-accounts' ||
      /^\/admin\/company-bank-accounts\/[^/]+$/u.test(normalizedPath)) &&
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
  if (requiredCategory === AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH) {
    return categories.includes(AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH);
  }
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
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    (method === 'POST' && path === '/services') ||
    (method === 'GET' && path === '/health/external')
  );
}
