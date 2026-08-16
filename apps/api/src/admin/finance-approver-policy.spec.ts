import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  Role,
} from '@prisma/client';

import {
  evaluateFinanceApproverPolicy,
  financeApproverPolicySnapshot,
  type FinanceApproverPolicyUser,
} from './finance-approver-policy';

describe('verified Finance approver policy', () => {
  const now = new Date('2026-08-14T10:00:00.000Z');

  it('allows a governed production approver with complete setup, active credential, MFA, role and category', () => {
    expect(evaluateFinanceApproverPolicy(approver(), { now }).ready).toBe(true);
  });

  it.each([
    ['TEST_OR_FIXTURE_ACCOUNT', { fixtureRunId: 'finance-governance-run' }],
    ['UNKNOWN_PROVENANCE', { adminUserProvenance: null }],
    ['CREDENTIAL_MISSING', { adminOperatorCredential: null }],
    ['SETUP_INCOMPLETE', { adminOperatorCredential: credential({ setupCompletedAt: null }) }],
    ['CREDENTIAL_DISABLED', { adminOperatorCredential: credential({ disabledAt: now }) }],
    ['ACCOUNT_LOCKED', { adminOperatorCredential: credential({ lockedUntil: new Date(now.getTime() + 60_000) }) }],
    ['MFA_NOT_VERIFIED', { adminOperatorCredential: credential({ mfaState: 'CONFIGURED' }) }],
    ['ROLE_MISSING', { roles: [Role.ADMIN] }],
    ['CATEGORY_NOT_ALLOWED', { adminOperatorPermission: { categories: [], updatedAt: now, version: 1 } }],
  ])('denies %s', (code, override) => {
    const result = evaluateFinanceApproverPolicy(approver(override), { now });
    expect(result.blockers.map((blocker) => blocker.code)).toContain(code);
    expect(result.ready).toBe(false);
  });

  it('allows an expired lock and denies maker-checker conflict', () => {
    const user = approver({
      adminOperatorCredential: credential({ lockedUntil: new Date(now.getTime() - 1) }),
    });
    expect(evaluateFinanceApproverPolicy(user, { now }).ready).toBe(true);
    expect(evaluateFinanceApproverPolicy(user, { makerId: user.id, now }).blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MAKER_CHECKER_CONFLICT' })]),
    );
  });

  it('fails closed for unattested legacy access and accepts independent attestation evidence', () => {
    const legacy = approver({ financeApproverRequestsTargeted: [] });
    expect(evaluateFinanceApproverPolicy(legacy, { now }).blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'LEGACY_ACCESS_UNATTESTED' })]),
    );
    expect(evaluateFinanceApproverPolicy(legacy, { legacyAttested: true, now })).toMatchObject({
      attestationStatus: 'ATTESTED',
      ready: true,
      source: 'LEGACY',
    });
  });

  it('denies stale permission versions', () => {
    expect(
      evaluateFinanceApproverPolicy(approver(), { expectedPermissionVersion: 2, now }).blockers,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'STALE_ROLE_VERSION' })]));
  });

  it('quarantines the explicitly inventoried polluted integration run', () => {
    const result = evaluateFinanceApproverPolicy(
      approver({
        id: 'finance-governance-1786644908414:maker',
        fixtureRunId: null,
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      }),
      { now },
    );

    expect(result.source).toBe('TEST_RUN');
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'TEST_OR_FIXTURE_ACCOUNT' })]),
    );
    expect(result.ready).toBe(false);
  });

  it('fails closed when a high-risk action has no recent reauthentication or session MFA receipt', async () => {
    const db = {
      adminWebSession: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { findFirst: vi.fn().mockResolvedValue(approver()) },
    };

    const result = await financeApproverPolicySnapshot(db as never, 'approver-1', {
      now,
      requireRecentReauthentication: true,
      requireSessionMfa: true,
      sessionId: 'session-1',
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RECENT_REAUTH_REQUIRED' }),
      expect.objectContaining({ code: 'SESSION_MFA_UNVERIFIED' }),
    ]));
  });

  it('accepts an active reauthenticated session with a recent trusted MFA receipt', async () => {
    const db = {
      adminWebSession: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date(now.getTime() + 60_000),
          mfaVerifiedAt: new Date(now.getTime() - 60_000),
          reauthenticatedAt: new Date(now.getTime() - 60_000),
          revokedAt: null,
          userId: 'approver-1',
        }),
      },
      user: { findFirst: vi.fn().mockResolvedValue(approver()) },
    };

    await expect(financeApproverPolicySnapshot(db as never, 'approver-1', {
      now,
      requireRecentReauthentication: true,
      requireSessionMfa: true,
      sessionId: 'session-1',
    })).resolves.toMatchObject({ ready: true });
  });

  it('does not let a caller-supplied MFA timestamp override a revoked database session', async () => {
    const db = {
      adminWebSession: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date(now.getTime() + 60_000),
          mfaVerifiedAt: null,
          reauthenticatedAt: new Date(now.getTime() - 60_000),
          revokedAt: new Date(now.getTime() - 1),
          userId: 'approver-1',
        }),
      },
      user: { findFirst: vi.fn().mockResolvedValue(approver()) },
    };

    const result = await financeApproverPolicySnapshot(db as never, 'approver-1', {
      now,
      requireSessionMfa: true,
      sessionId: 'session-1',
      sessionMfaVerifiedAt: new Date(now.getTime() - 60_000),
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SESSION_MFA_UNVERIFIED' })]),
    );
  });
});

function approver(override: Partial<FinanceApproverPolicyUser> = {}): FinanceApproverPolicyUser {
  return {
    id: 'approver-1',
    email: 'approver@hands.vn',
    fullName: 'Finance Approver',
    roles: [Role.ADMIN, Role.FINANCE_APPROVER],
    updatedAt: new Date('2026-08-14T09:00:00.000Z'),
    adminUserProvenance: AdminUserProvenance.PRODUCTION,
    fixtureKind: null,
    fixtureRunId: null,
    fixtureExpiresAt: null,
    adminOperatorCredential: credential(),
    adminOperatorPermission: {
      categories: [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS],
      updatedAt: new Date('2026-08-14T09:00:00.000Z'),
      version: 1,
    },
    financeApproverRequestsTargeted: [
      { executedAt: new Date('2026-08-14T08:00:00.000Z'), id: 'grant-1', requestedEnabled: true },
    ],
    ...override,
  };
}

function credential(
  override: Partial<NonNullable<FinanceApproverPolicyUser['adminOperatorCredential']>> = {},
) {
  return {
    disabledAt: null,
    lastLoginAt: new Date('2026-08-14T09:30:00.000Z'),
    lockedUntil: null,
    mfaState: 'VERIFIED',
    setupCompletedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...override,
  };
}
