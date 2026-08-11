import { AdminOperatorPermissionCategory, Role } from '@prisma/client';
import {
  AdminOperatorCategoryGuard,
  adminOperatorCategoryForPath,
  adminOperatorCategoryForWritePath,
  isAllowlistedAdminRoute,
  isAllowlistedAdminWrite,
} from './admin-operator-category.guard';

describe('AdminOperatorCategoryGuard', () => {
  it('allows a stored parent category to authorize its write subcategory', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/bank-reconciliation/transaction-1/matches')),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'operator-user-1' },
      select: {
        roles: true,
        adminOperatorPermission: { select: { categories: true } },
      },
    });
  });

  it('allows Master Admin without category setup', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN, Role.MASTER_ADMIN],
      adminOperatorPermission: null,
    });

    await expect(
      guard.canActivate(contextFixture('PATCH', '/api/admin/users/operator-2/admin-operator-access')),
    ).resolves.toBe(true);
  });

  it('denies a categorized write when the operator lacks its category', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/payout-batches')),
    ).rejects.toThrow('Admin operator lacks FINANCE_SETTLEMENTS access');
  });

  it('denies unmapped Admin writes by default', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN, Role.MASTER_ADMIN],
      adminOperatorPermission: null,
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/new-unmapped-command')),
    ).rejects.toThrow('Admin route has no permission category');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('keeps the operator activity audit sink explicitly allowlisted', async () => {
    const { guard, prisma } = createGuard(null);

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/operator-activity')),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(isAllowlistedAdminWrite('POST', '/admin/operator-activity')).toBe(true);
  });

  it('allows assignable Developer categories without granting the broad System category', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.DEVELOPER_HEALTH] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/system/background-jobs/queue/job/resolve')),
    ).resolves.toBe(true);
  });

  it('keeps legacy System Setup access compatible with setup and health diagnostics', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_SETUP] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/system/background-jobs/queue/job/resolve')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFixture('GET', '/api/admin/app-sessions')),
    ).rejects.toThrow('Admin operator lacks DEVELOPER_APP_SESSIONS_DIAGNOSTICS access');
  });

  it('keeps restricted settings writes out of Finance-only access', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/company-bank-accounts')),
    ).rejects.toThrow('Admin operator lacks SYSTEM_POLICY access');
    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/payment-fee-policies')),
    ).rejects.toThrow('Admin operator lacks SYSTEM_POLICY access');
    await expect(
      guard.canActivate(
        contextFixture('POST', '/api/admin/company-bank-accounts/account-1/approval-decision'),
      ),
    ).resolves.toBe(true);
  });

  it('enforces category access on Admin read routes', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.PARTNERS] },
    });

    await expect(guard.canActivate(contextFixture('GET', '/api/admin/customers'))).rejects.toThrow(
      'Admin operator lacks CUSTOMERS_DETAIL access',
    );
  });

  it('allows the current operator access lookup without granting operator management', async () => {
    const { guard, prisma } = createGuard(null);

    await expect(
      guard.canActivate(contextFixture('GET', '/api/admin/users/admin-operator-access?identity=operator-user-1')),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(isAllowlistedAdminRoute('GET', '/admin/users/admin-operator-access')).toBe(true);
  });

  it('does not bypass categories for non admin-web tokens in development', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS] },
    });

    await expect(
      guard.canActivate(
        contextFixture('POST', '/api/admin/payout-batches', {
          authProvider: 'nest',
        }),
      ),
    ).rejects.toThrow('Admin operator lacks FINANCE_SETTLEMENTS access');
  });
});

describe('adminOperatorCategoryForWritePath', () => {
  it.each([
    ['/admin/bookings/booking-1/closeout', AdminOperatorPermissionCategory.BOOKINGS_DETAIL],
    ['/admin/customers/customer-1/ops-note', AdminOperatorPermissionCategory.CUSTOMERS_DETAIL],
    ['/admin/partners/partner-1/approve', AdminOperatorPermissionCategory.PARTNERS_DETAIL],
    ['/admin/reviews/review-1/moderate', AdminOperatorPermissionCategory.CUSTOMERS_REVIEWS],
    ['/admin/wallet-adjustments', AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS],
    [
      '/admin/cash-settlement-earnings/earning-1/allocations',
      AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
    ],
    ['/admin/bank-reconciliation/transaction-1/ignore', AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
    ['/admin/notifications/notification-1/retry', AdminOperatorPermissionCategory.NOTIFICATIONS_RETRY],
    ['/admin/coupons/coupon-1', AdminOperatorPermissionCategory.SYSTEM_COUPONS],
    ['/admin/site-pages/page-1/sections', AdminOperatorPermissionCategory.CONTENT_EDIT],
    ['/admin/site-pages/sections/section-1', AdminOperatorPermissionCategory.CONTENT_EDIT],
    ['/admin/company-bank-accounts', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/payment-fee-policies/policy-1/rules', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/tax-policy-versions', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/operational-policy/matching.provider_response_window_minutes', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/notifications/templates/booking.matched', AdminOperatorPermissionCategory.NOTIFICATIONS_TEMPLATES],
    ['/admin/notifications/push-campaigns', AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH],
  ])('maps %s to %s', (path, category) => {
    expect(adminOperatorCategoryForWritePath(path)).toBe(category);
  });

  it.each([
    ['/admin/dashboard/summary', AdminOperatorPermissionCategory.BOOKINGS_REALTIME],
    ['/admin/usage-overview', AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY],
    ['/admin/partners/overview', AdminOperatorPermissionCategory.PARTNERS_DIRECTORY],
    ['/admin/accounting-journal-batches', AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER],
    ['/admin/chat-archive', AdminOperatorPermissionCategory.BOOKINGS_DETAIL],
    ['/admin/providers/provider-1/kyc/approve', AdminOperatorPermissionCategory.PARTNERS_KYC],
    ['/admin/providers/provider-1/tax-profile/approve', AdminOperatorPermissionCategory.FINANCE_TAX],
    ['/admin/site-pages', AdminOperatorPermissionCategory.CONTENT_VIEW],
  ])('maps read or specialized path %s to %s', (path, category) => {
    expect(adminOperatorCategoryForPath(path)).toBe(category);
  });

  it('allows an editor to discard a Draft without route deletion permission', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CONTENT_EDIT] },
    });

    await expect(
      guard.canActivate(contextFixture('DELETE', '/admin/site-pages/page-1/draft')),
    ).resolves.toBe(true);
  });
});

function createGuard(storedAccess: unknown) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(storedAccess),
    },
  };
  return {
    guard: new AdminOperatorCategoryGuard(prisma as never),
    prisma,
  };
}

function contextFixture(
  method: string,
  originalUrl: string,
  overrides: Partial<{ authProvider: string }> = {},
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        originalUrl,
        user: {
          id: 'operator-user-1',
          roles: [Role.ADMIN],
          activeRole: Role.ADMIN,
          authProvider: 'admin-web',
          ...overrides,
        },
      }),
    }),
  } as never;
}
