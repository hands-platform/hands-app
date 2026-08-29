import { AdminOperatorPermissionCategory, Role } from '@prisma/client';
import {
  AdminOperatorCategoryGuard,
  adminOperatorCategoryForPath,
  adminOperatorCategoryForWritePath,
  FINANCE_MONEY_MOVEMENT_PERMISSION_CATEGORIES,
  isAllowlistedAdminRoute,
  isAllowlistedAdminWrite,
  requiresRecentAdminReauthentication,
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

  it('reuses access loaded by Admin Web session authentication', async () => {
    const { guard, prisma } = createGuard(null);

    await expect(
      guard.canActivate(
        contextFixture('GET', '/api/admin/usage-overview', {
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY],
        }),
      ),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/payout-batches')),
    ).rejects.toThrow('Admin operator lacks FINANCE_SETTLEMENTS access');
    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin_operator.authorization.denied',
        actorId: 'operator-user-1',
        actorType: 'HUMAN',
        area: 'SECURITY',
        outcome: 'DENIED',
        severity: 'REVIEW',
        source: 'admin_permission_guard',
        metadata: expect.objectContaining({
          reason: 'CATEGORY_MISSING',
          requiredCategory: AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
        }),
        target: 'admin_route:POST:/admin/payout-batches',
      }),
    });
  });

  it('keeps authorization fail closed when denial evidence cannot be persisted', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS] },
    });
    prisma.adminAuditLog.create.mockRejectedValueOnce(new Error('audit persistence unavailable'));

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/payout-batches')),
    ).rejects.toThrow('Admin operator lacks FINANCE_SETTLEMENTS access');
  });

  it('requires FINANCE_TAX for referral tax decisions while keeping cashout approval in settlements', async () => {
    const settlements = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS] },
    });
    const tax = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE_TAX] },
    });
    const taxDecisionPath = '/api/admin/referrals/rewards/reward-1/tax-review-approve';

    expect(adminOperatorCategoryForWritePath(taxDecisionPath)).toBe(
      AdminOperatorPermissionCategory.FINANCE_TAX,
    );
    await expect(settlements.guard.canActivate(contextFixture('POST', taxDecisionPath))).rejects.toThrow(
      'Admin operator lacks FINANCE_TAX access',
    );
    await expect(tax.guard.canActivate(contextFixture('POST', taxDecisionPath))).resolves.toBe(true);
    expect(
      adminOperatorCategoryForWritePath('/api/admin/referrals/rewards/reward-1/cashout-approve'),
    ).toBe(AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS);
  });

  it('keeps marketing reads separate from manual spend management', async () => {
    const reader = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.GROWTH_MARKETING] },
    });
    const spendManager = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.GROWTH_MARKETING_SPEND] },
    });

    await expect(
      reader.guard.canActivate(contextFixture('GET', '/api/admin/marketing/summary')),
    ).resolves.toBe(true);
    await expect(
      reader.guard.canActivate(contextFixture('POST', '/api/admin/marketing/spend-daily')),
    ).rejects.toThrow('Admin operator lacks GROWTH_MARKETING_SPEND access');
    await expect(
      spendManager.guard.canActivate(contextFixture('POST', '/api/admin/marketing/spend-daily')),
    ).resolves.toBe(true);
  });

  it('requires the exact manual Push category instead of the Notifications parent', async () => {
    const parentOnly = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.NOTIFICATIONS] },
    });
    const pushOperator = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH] },
    });

    await expect(
      parentOnly.guard.canActivate(contextFixture('POST', '/api/admin/notifications/push-campaigns')),
    ).rejects.toThrow('Admin operator lacks NOTIFICATIONS_PUSH access');
    await expect(
      pushOperator.guard.canActivate(contextFixture('POST', '/api/admin/notifications/push-campaigns')),
    ).resolves.toBe(true);
    expect(pushOperator.prisma.adminWebSession.findUnique).toHaveBeenCalledTimes(1);
    expect(requiresRecentAdminReauthentication('POST', '/api/admin/notifications/push-campaigns')).toBe(true);
    expect(requiresRecentAdminReauthentication('POST', '/api/admin/notifications/push-campaigns/preview')).toBe(false);
  });

  it.each([
    ['stale', { reauthenticatedAt: new Date(Date.now() - 11 * 60_000), revokedAt: null, userId: 'operator-user-1' }],
    ['wrong-user', { reauthenticatedAt: new Date(), revokedAt: null, userId: 'operator-user-2' }],
    ['revoked', { reauthenticatedAt: new Date(), revokedAt: new Date(), userId: 'operator-user-1' }],
  ])('rejects Push confirm for a %s Admin Web session while leaving preview available', async (_case, session) => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH] },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      mfaVerifiedAt: new Date(),
      ...session,
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/notifications/push-campaigns')),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }) });
    prisma.adminWebSession.findUnique.mockClear();
    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/notifications/push-campaigns/preview')),
    ).resolves.toBe(true);
    expect(prisma.adminWebSession.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    [
      'stale password',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(Date.now() - 10 * 60_000 - 1_000),
        revokedAt: null,
        userId: 'operator-user-1',
      },
    ],
    [
      'stale MFA',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(Date.now() - 10 * 60_000 - 1_000),
        reauthenticatedAt: new Date(),
        revokedAt: null,
        userId: 'operator-user-1',
      },
    ],
    [
      'revoked',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(),
        revokedAt: new Date(),
        userId: 'operator-user-1',
      },
    ],
    [
      'wrong user',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(),
        revokedAt: null,
        userId: 'operator-user-2',
      },
    ],
  ])('rejects an operational policy PATCH with a %s reauthentication session', async (_case, session) => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_POLICY] },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue(session);

    await expect(
      guard.canActivate(
        contextFixture(
          'PATCH',
          '/api/admin/operational-policy/matching.provider_response_window_minutes',
        ),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }) });
  });

  it('allows the same Admin Web session inside the password and MFA reauthentication boundary', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_POLICY] },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      mfaVerifiedAt: new Date(Date.now() - 10 * 60_000 + 1_000),
      reauthenticatedAt: new Date(Date.now() - 10 * 60_000 + 1_000),
      revokedAt: null,
      userId: 'operator-user-1',
    });

    await expect(
      guard.canActivate(
        contextFixture(
          'PATCH',
          '/api/admin/operational-policy/matching.provider_response_window_minutes',
        ),
      ),
    ).resolves.toBe(true);
    expect(requiresRecentAdminReauthentication(
      'PATCH',
      '/api/admin/operational-policy/matching.provider_response_window_minutes',
    )).toBe(true);
  });

  it.each([
    ['missing', null],
    [
      'stale password',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(Date.now() - 11 * 60_000),
        revokedAt: null,
        userId: 'operator-user-1',
      },
    ],
    [
      'stale MFA',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(Date.now() - 11 * 60_000),
        reauthenticatedAt: new Date(),
        revokedAt: null,
        userId: 'operator-user-1',
      },
    ],
    [
      'revoked',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(),
        revokedAt: new Date(),
        userId: 'operator-user-1',
      },
    ],
    [
      'wrong session owner',
      {
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(),
        revokedAt: null,
        userId: 'operator-user-2',
      },
    ],
  ])('rejects a live service catalog intent with a %s proof', async (_case, session) => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_SERVICES] },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue(session);

    await expect(
      guard.canActivate(
        contextFixture(
          'PATCH',
          '/api/admin/services/groups/aroma_massage',
          {},
          { intent: 'PUBLISH' },
        ),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }),
    });
  });

  it('requires recent reauthentication only for allowlisted live service catalog intents', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_SERVICES] },
    });

    for (const intent of ['PUBLISH', 'HIDE', 'ARCHIVE'] as const) {
      await expect(
        guard.canActivate(
          contextFixture(
            'PATCH',
            '/api/admin/services/groups/aroma_massage',
            {},
            { intent },
          ),
        ),
      ).resolves.toBe(true);
    }
    expect(prisma.adminWebSession.findUnique).toHaveBeenCalledTimes(3);
    prisma.adminWebSession.findUnique.mockClear();

    for (const intent of ['SAVE_DRAFT', 'NOT_A_REAL_INTENT']) {
      await expect(
        guard.canActivate(
          contextFixture(
            'PATCH',
            '/api/admin/services/groups/aroma_massage',
            {},
            { intent },
          ),
        ),
      ).resolves.toBe(true);
    }
    expect(prisma.adminWebSession.findUnique).not.toHaveBeenCalled();
    expect(
      requiresRecentAdminReauthentication(
        'PATCH',
        '/api/admin/services/groups/aroma_massage',
        { intent: 'PUBLISH' },
      ),
    ).toBe(true);
    expect(
      requiresRecentAdminReauthentication(
        'PATCH',
        '/api/admin/services/groups/aroma_massage',
        { intent: 'SAVE_DRAFT' },
      ),
    ).toBe(false);
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

  it('allows an authenticated operator to reauthenticate their own session without a system category', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE] },
    });

    await expect(
      guard.canActivate(contextFixture('POST', '/api/admin/admin-operators/reauthenticate')),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(isAllowlistedAdminWrite('POST', '/admin/admin-operators/reauthenticate')).toBe(true);
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

  it('requires both System Policy and Bank Reconciliation for company bank account maker writes', async () => {
    const systemOnly = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_POLICY] },
    });
    const bankOnly = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
      },
    });
    const both = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [
          AdminOperatorPermissionCategory.SYSTEM_POLICY,
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
        ],
      },
    });
    const inheritedFinance = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [
          AdminOperatorPermissionCategory.SYSTEM_POLICY,
          AdminOperatorPermissionCategory.FINANCE,
        ],
      },
    });
    const master = createGuard({
      roles: [Role.ADMIN, Role.MASTER_ADMIN],
      adminOperatorPermission: null,
    });

    await expect(
      systemOnly.guard.canActivate(contextFixture('POST', '/api/admin/company-bank-accounts')),
    ).rejects.toThrow('Admin operator lacks FINANCE_BANK_RECONCILIATION access');
    await expect(
      bankOnly.guard.canActivate(contextFixture('POST', '/api/admin/company-bank-accounts')),
    ).rejects.toThrow('Admin operator lacks SYSTEM_POLICY access');
    await expect(
      both.guard.canActivate(contextFixture('POST', '/api/admin/company-bank-accounts')),
    ).resolves.toBe(true);
    await expect(
      systemOnly.guard.canActivate(
        contextFixture(
          'POST',
          '/api/admin/company-bank-accounts/account-1/evidence-review-requests',
        ),
      ),
    ).rejects.toThrow('Admin operator lacks FINANCE_BANK_RECONCILIATION access');
    await expect(
      both.guard.canActivate(
        contextFixture(
          'POST',
          '/api/admin/company-bank-accounts/account-1/evidence-review-requests',
        ),
      ),
    ).resolves.toBe(true);
    await expect(
      inheritedFinance.guard.canActivate(
        contextFixture('PATCH', '/api/admin/company-bank-accounts/account-1'),
      ),
    ).resolves.toBe(true);
    await expect(
      master.guard.canActivate(contextFixture('POST', '/api/admin/company-bank-accounts')),
    ).resolves.toBe(true);
  });

  it('maps finance approver reads, history, requests, and decisions to separate guard categories', async () => {
    expect(adminOperatorCategoryForPath('/admin/finance-approver-governance/operators')).toBe(
      AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
    );
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_AUDIT] },
    });
    await expect(
      guard.canActivate(contextFixture('GET', '/api/admin/finance-approver-governance/history')),
    ).resolves.toBe(true);
    expect(adminOperatorCategoryForWritePath('/admin/finance-approver-governance/requests')).toBe(
      AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
    );
    expect(
      adminOperatorCategoryForWritePath('/admin/finance-approver-governance/requests/request-1/decision'),
    ).toBe(AdminOperatorPermissionCategory.SYSTEM_POLICY);
  });

  it('enforces category access on Admin read routes', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.PARTNERS] },
    });

    await expect(guard.canActivate(contextFixture('GET', '/api/admin/customers'))).rejects.toThrow(
      'Admin operator lacks CUSTOMERS_DIRECTORY access',
    );
  });

  it('separates Customer directory collection reads from Customer detail access', async () => {
    const directory = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [AdminOperatorPermissionCategory.CUSTOMERS_DIRECTORY],
      },
    });
    const detail = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL] },
    });

    await expect(
      directory.guard.canActivate(contextFixture('GET', '/api/admin/customers')),
    ).resolves.toBe(true);
    await expect(
      directory.guard.canActivate(contextFixture('GET', '/api/admin/customers/summary')),
    ).resolves.toBe(true);
    await expect(
      directory.guard.canActivate(contextFixture('GET', '/api/admin/customers/customer-1')),
    ).rejects.toThrow('Admin operator lacks CUSTOMERS_DETAIL access');
    await expect(
      directory.guard.canActivate(
        contextFixture('GET', '/api/admin/customers/customer-1/wallet-ledger'),
      ),
    ).rejects.toThrow('Admin operator lacks CUSTOMERS_DETAIL access');
    await expect(
      detail.guard.canActivate(contextFixture('GET', '/api/admin/customers')),
    ).rejects.toThrow('Admin operator lacks CUSTOMERS_DIRECTORY access');
  });

  it('keeps scoped service evidence separate from the full audit log permission', async () => {
    const servicesOnly = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_SERVICES] },
    });
    const auditOnly = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.SYSTEM_AUDIT] },
    });
    const both = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [
          AdminOperatorPermissionCategory.SYSTEM_SERVICES,
          AdminOperatorPermissionCategory.SYSTEM_AUDIT,
        ],
      },
    });
    const master = createGuard({
      roles: [Role.ADMIN, Role.MASTER_ADMIN],
      adminOperatorPermission: null,
    });
    const neither = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS] },
    });
    const scopedPath = '/api/admin/services/groups/aroma_massage/audit-evidence';
    const fullAuditPath = '/api/admin/audit-logs';

    await expect(servicesOnly.guard.canActivate(contextFixture('GET', scopedPath))).resolves.toBe(true);
    await expect(servicesOnly.guard.canActivate(contextFixture('GET', fullAuditPath))).rejects.toThrow(
      'Admin operator lacks SYSTEM_AUDIT access',
    );
    await expect(auditOnly.guard.canActivate(contextFixture('GET', scopedPath))).rejects.toThrow(
      'Admin operator lacks SYSTEM_SERVICES access',
    );
    await expect(auditOnly.guard.canActivate(contextFixture('GET', fullAuditPath))).resolves.toBe(true);
    await expect(both.guard.canActivate(contextFixture('GET', scopedPath))).resolves.toBe(true);
    await expect(both.guard.canActivate(contextFixture('GET', fullAuditPath))).resolves.toBe(true);
    await expect(master.guard.canActivate(contextFixture('GET', scopedPath))).resolves.toBe(true);
    await expect(master.guard.canActivate(contextFixture('GET', fullAuditPath))).resolves.toBe(true);
    await expect(neither.guard.canActivate(contextFixture('GET', scopedPath))).rejects.toThrow(
      'Admin operator lacks SYSTEM_SERVICES access',
    );
    await expect(neither.guard.canActivate(contextFixture('GET', fullAuditPath))).rejects.toThrow(
      'Admin operator lacks SYSTEM_AUDIT access',
    );
  });

  it('protects exact wallet adjustment records with the wallet adjustment category', async () => {
    const unrelated = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS] },
    });
    const financeWallet = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS],
      },
    });

    await expect(
      unrelated.guard.canActivate(
        contextFixture('GET', '/api/admin/wallet-adjustments/customer-ledger-exact'),
      ),
    ).rejects.toThrow('Admin operator lacks FINANCE_WALLET_ADJUSTMENTS access');
    await expect(
      financeWallet.guard.canActivate(
        contextFixture('GET', '/api/admin/wallet-adjustments/customer-ledger-exact'),
      ),
    ).resolves.toBe(true);
  });

  it('keeps Partner report audit history inside the Partner detail permission boundary', async () => {
    const partnerOperator = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.PARTNERS_DETAIL] },
    });
    const customerOperator = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL] },
    });
    const path = '/api/admin/provider-reports/report-1/audit-history';

    expect(adminOperatorCategoryForPath(path)).toBe(AdminOperatorPermissionCategory.PARTNERS_DETAIL);
    await expect(partnerOperator.guard.canActivate(contextFixture('GET', path))).resolves.toBe(true);
    await expect(customerOperator.guard.canActivate(contextFixture('GET', path))).rejects.toThrow(
      'Admin operator lacks PARTNERS_DETAIL access',
    );
  });

  it('requires explicit Developer diagnostics access for customer detail diagnostics', async () => {
    const customerOperator = createGuard(null);
    const diagnosticsOperator = createGuard(null);
    const masterAdmin = createGuard({
      roles: [Role.ADMIN, Role.MASTER_ADMIN],
      adminOperatorPermission: null,
    });

    await expect(
      customerOperator.guard.canActivate(
        contextFixture('GET', '/api/admin/customers/customer-1', {
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL],
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      customerOperator.guard.canActivate(
        contextFixture('GET', '/api/admin/customers/customer-1?includeDiagnostics=false', {
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL],
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      customerOperator.guard.canActivate(
        contextFixture('GET', '/api/admin/customers/customer-1?includeDiagnostics=true', {
          adminPermissionCategories: [AdminOperatorPermissionCategory.CUSTOMERS_DETAIL],
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ADMIN_OPERATOR_ACCESS_DENIED',
        message: 'Admin operator access denied',
      },
    });
    expect(customerOperator.prisma.adminAuditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        action: 'admin_operator.authorization.denied',
        actorType: 'HUMAN',
        area: 'SECURITY',
        outcome: 'DENIED',
        severity: 'REVIEW',
        source: 'admin_permission_guard',
        metadata: expect.objectContaining({
          reason: 'CATEGORY_MISSING',
          requiredCategory: AdminOperatorPermissionCategory.DEVELOPER_APP_SESSIONS_DIAGNOSTICS,
        }),
        target: 'admin_route:GET:/admin/customers/customer-1',
      }),
    });
    expect(JSON.stringify(customerOperator.prisma.adminAuditLog.create.mock.calls)).not.toContain(
      'includeDiagnostics',
    );

    await expect(
      diagnosticsOperator.guard.canActivate(
        contextFixture('GET', '/api/admin/customers/customer-1?includeDiagnostics=true', {
          adminPermissionCategories: [
            AdminOperatorPermissionCategory.CUSTOMERS_DETAIL,
            AdminOperatorPermissionCategory.DEVELOPER_APP_SESSIONS_DIAGNOSTICS,
          ],
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      masterAdmin.guard.canActivate(
        contextFixture('GET', '/api/admin/customers/customer-1?includeDiagnostics=true'),
      ),
    ).resolves.toBe(true);
  });

  it('keeps the matching preview inside Developer/System diagnostics access', async () => {
    const diagnosticsOperator = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.DEVELOPER_SYSTEM] },
    });
    const partnerOperator = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.PARTNERS] },
    });

    await expect(
      diagnosticsOperator.guard.canActivate(
        contextFixture('GET', '/api/admin/operations-policy/matching-preview'),
      ),
    ).resolves.toBe(true);
    await expect(
      partnerOperator.guard.canActivate(
        contextFixture('GET', '/api/admin/operations-policy/matching-preview'),
      ),
    ).rejects.toThrow('Admin operator lacks DEVELOPER_SYSTEM access');
  });

  it('allows the current operator access lookup without granting operator management', async () => {
    const { guard, prisma } = createGuard(null);

    await expect(
      guard.canActivate(contextFixture('GET', '/api/admin/users/admin-operator-access?identity=operator-user-1')),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(isAllowlistedAdminRoute('GET', '/admin/users/admin-operator-access')).toBe(true);
  });

  it('limits an MFA enrollment session to the explicit enrollment allowlist', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.BOOKINGS] },
    });

    await expect(
      guard.canActivate(
        contextFixture('GET', '/api/admin/bookings', { adminMfaEnrollmentRequired: true }),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'MFA_ENROLLMENT_REQUIRED' }) });
    await expect(
      guard.canActivate(
        contextFixture('GET', '/api/admin/admin-operators/me/mfa', {
          adminMfaEnrollmentRequired: true,
        }),
      ),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
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

  it('requires recent reauthentication for high-risk finance actions', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS] },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      mfaVerifiedAt: new Date(),
      reauthenticatedAt: new Date(Date.now() - 11 * 60_000),
      revokedAt: null,
      userId: 'operator-user-1',
    });

    await expect(
      guard.canActivate(
        contextFixture('POST', '/api/admin/payout-batches/payout-1/reversal'),
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }) });
  });

  it.each([
    '/api/admin/providers/partner-1/sanctions',
    '/api/admin/provider-sanctions/sanction-1/lift',
  ])('requires recent password and MFA verification for Partner control mutation %s', async (path) => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.PARTNERS_DETAIL] },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      mfaVerifiedAt: new Date(),
      reauthenticatedAt: new Date(Date.now() - 11 * 60_000),
      revokedAt: null,
      userId: 'operator-user-1',
    });

    await expect(guard.canActivate(contextFixture('POST', path))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }),
    });
    expect(requiresRecentAdminReauthentication('POST', path)).toBe(true);
  });

  it.each([
    '/api/admin/bank-reconciliation/transaction-1/matches',
    '/api/admin/bank-reconciliation/transaction-1/matches/match-1/reverse',
    '/api/admin/bank-reconciliation/transaction-1/ignore',
  ])('requires recent reauthentication for bank reconciliation mutation %s', async (path) => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION],
      },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      mfaVerifiedAt: new Date(),
      reauthenticatedAt: new Date(Date.now() - 11 * 60_000),
      revokedAt: null,
      userId: 'operator-user-1',
    });

    await expect(guard.canActivate(contextFixture('POST', path))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }),
    });
    expect(requiresRecentAdminReauthentication('POST', path)).toBe(true);
  });

  it.each([
    '/api/admin/payments/payment-1/capture',
    '/api/admin/payments/payment-1/refund',
    '/api/admin/payments/payment-1/release',
    '/api/admin/provider-wallet/deposits',
    '/api/admin/wallet-adjustments',
  ])('requires recent reauthentication for direct money mutation %s', async (path) => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: {
        categories: [AdminOperatorPermissionCategory.FINANCE],
      },
    });
    prisma.adminWebSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      mfaVerifiedAt: new Date(),
      reauthenticatedAt: new Date(Date.now() - 11 * 60_000),
      revokedAt: null,
      userId: 'operator-user-1',
    });

    await expect(guard.canActivate(contextFixture('POST', path))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }),
    });
    expect(requiresRecentAdminReauthentication('POST', path)).toBe(true);
  });

  it('requires recent reauthentication only for the paid branch of shared finance routes', async () => {
    const { guard, prisma } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS] },
    });

    await expect(
      guard.canActivate(
        contextFixture('PATCH', '/api/admin/payout-batches/payout-1', {}, { status: 'PROCESSING' }),
      ),
    ).resolves.toBe(true);
    expect(prisma.adminWebSession.findUnique).not.toHaveBeenCalled();

    await expect(
      guard.canActivate(
        contextFixture('PATCH', '/api/admin/payout-batches/payout-1', {}, { status: 'PAID' }),
      ),
    ).resolves.toBe(true);
    expect(prisma.adminWebSession.findUnique).toHaveBeenCalledTimes(1);
    expect(requiresRecentAdminReauthentication('PATCH', '/admin/payout-batches/payout-1', { status: 'PAID' })).toBe(
      true,
    );
  });
});

describe('adminOperatorCategoryForWritePath', () => {
  it('keeps Finance summary coverage aligned with the money-movement route categories', () => {
    const routedCategories = new Set([
      adminOperatorCategoryForWritePath('/admin/payments/payment-1/capture'),
      adminOperatorCategoryForWritePath('/admin/accounting-journal-batches/batch-1/reverse'),
      adminOperatorCategoryForWritePath('/admin/bank-reconciliation/transaction-1/ignore'),
      adminOperatorCategoryForWritePath('/admin/wallet-adjustments'),
      adminOperatorCategoryForWritePath('/admin/payout-batches/batch-1/reversal'),
      adminOperatorCategoryForWritePath('/admin/tax-policy-approval-requests/request-1/decision'),
    ]);

    expect(routedCategories).toEqual(new Set(FINANCE_MONEY_MOVEMENT_PERMISSION_CATEGORIES));
  });

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
    ['/admin/notification-delivery-incidents', AdminOperatorPermissionCategory.NOTIFICATIONS_INCIDENTS],
    ['/admin/notification-delivery-incidents/incident-1/resolve', AdminOperatorPermissionCategory.NOTIFICATIONS_INCIDENTS],
    ['/admin/coupons/coupon-1/activate', AdminOperatorPermissionCategory.SYSTEM_COUPONS],
    ['/admin/site-pages/page-1/sections', AdminOperatorPermissionCategory.CONTENT_EDIT],
    ['/admin/site-pages/sections/section-1', AdminOperatorPermissionCategory.CONTENT_EDIT],
    ['/admin/site-pages/page-1/take-offline', AdminOperatorPermissionCategory.CONTENT_PUBLISH],
    ['/admin/site-pages/page-1/cache-invalidation', AdminOperatorPermissionCategory.CONTENT_PUBLISH],
    ['/admin/company-bank-accounts', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/payment-fee-policies/policy-1/rules', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/tax-policy-versions', AdminOperatorPermissionCategory.FINANCE_TAX],
    ['/admin/tax-policy-approval-requests/request-1/decision', AdminOperatorPermissionCategory.FINANCE_TAX],
    ['/admin/operational-policy/matching.provider_response_window_minutes', AdminOperatorPermissionCategory.SYSTEM_POLICY],
    ['/admin/notifications/templates/booking.matched', AdminOperatorPermissionCategory.NOTIFICATIONS_TEMPLATES],
    ['/admin/notifications/push-campaigns', AdminOperatorPermissionCategory.NOTIFICATIONS_PUSH],
    ['/admin/marketing/spend-daily', AdminOperatorPermissionCategory.GROWTH_MARKETING_SPEND],
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
    ['/admin/tax-policy-audit-logs', AdminOperatorPermissionCategory.FINANCE_TAX],
    ['/admin/tax-policy-integrity-summary', AdminOperatorPermissionCategory.FINANCE_TAX],
    ['/admin/tax-policy-approval-requests', AdminOperatorPermissionCategory.FINANCE_TAX],
    ['/admin/site-pages', AdminOperatorPermissionCategory.CONTENT_VIEW],
    ['/admin/operations-policy/matching-preview', AdminOperatorPermissionCategory.DEVELOPER_SYSTEM],
    ['/admin/referrals/customers/fixtures', AdminOperatorPermissionCategory.DEVELOPER_SYSTEM],
    ['/admin/notification-delivery-incidents', AdminOperatorPermissionCategory.NOTIFICATIONS_DELIVERY],
    ['/health/external', AdminOperatorPermissionCategory.DEVELOPER_HEALTH],
  ])('maps read or specialized path %s to %s', (path, category) => {
    expect(adminOperatorCategoryForPath(path)).toBe(category);
  });

  it('requires Developer Health access for detailed external readiness', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.DEVELOPER_HEALTH] },
    });

    await expect(guard.canActivate(contextFixture('GET', '/health/external'))).resolves.toBe(true);
  });

  it('denies detailed external readiness to unrelated admin categories', async () => {
    const { guard } = createGuard({
      roles: [Role.ADMIN],
      adminOperatorPermission: { categories: [AdminOperatorPermissionCategory.BOOKINGS] },
    });

    await expect(guard.canActivate(contextFixture('GET', '/health/external'))).rejects.toThrow(
      'Admin operator lacks DEVELOPER_HEALTH access',
    );
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
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-denial-1' }),
    },
    adminWebSession: {
      findUnique: vi.fn().mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        mfaVerifiedAt: new Date(),
        reauthenticatedAt: new Date(),
        revokedAt: null,
        userId: 'operator-user-1',
      }),
    },
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
  overrides: Partial<{
    adminMfaEnrollmentRequired: boolean;
    adminPermissionCategories: AdminOperatorPermissionCategory[];
    authProvider: string;
  }> = {},
  body?: Record<string, unknown>,
) {
  const query = Object.fromEntries(new URL(originalUrl, 'http://localhost').searchParams);
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        originalUrl,
        body,
        query,
        user: {
          id: 'operator-user-1',
          roles: [Role.ADMIN],
          activeRole: Role.ADMIN,
          authProvider: 'admin-web',
          sessionId: 'admin-session-1',
          ...overrides,
        },
      }),
    }),
  } as never;
}
