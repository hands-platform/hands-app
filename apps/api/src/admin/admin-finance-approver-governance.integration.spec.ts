import { randomUUID } from 'node:crypto';

import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  PrismaClient,
  Role,
} from '@prisma/client';

import { AdminService } from './admin.service';
import {
  financeApproverIntegrationDatabaseTarget,
  quotedDisposableSchema,
} from './finance-approver-integration-db-guard';

const integrationEnabled = process.env.RUN_FINANCE_APPROVER_DB_INTEGRATION === '1';
const integrationTarget = integrationEnabled
  ? financeApproverIntegrationDatabaseTarget(
      process.env.DATABASE_URL,
      process.env.FINANCE_APPROVER_INTEGRATION_DATABASE_ALLOWLIST,
    )
  : null;
const integrationDescribe = integrationEnabled ? describe : describe.skip;

integrationDescribe('Finance approver governance fixture isolation', () => {
  const prisma = new PrismaClient({
    ...(integrationTarget ? { datasources: { db: { url: integrationTarget.databaseUrl } } } : {}),
  });
  const testRunId = `finance-governance-${randomUUID()}`;
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  afterAll(async () => {
    if (integrationTarget) {
      await prisma.$executeRawUnsafe(`DROP SCHEMA ${quotedDisposableSchema(integrationTarget)} CASCADE`);
    }
    await prisma.$disconnect();
  });

  it('excludes explicit fixture operators from the operational Admin directory and KPI snapshot', async () => {
    const fixture = await createOperator('directory-fixture', [Role.ADMIN, Role.MASTER_ADMIN]);

    const directory = await service.listAdminOperators({}, fixture.id);

    expect(directory.items).toHaveLength(0);
    expect(directory.summary.total).toBe(0);
    expect(await prisma.user.count({ where: { fixtureRunId: testRunId } })).toBe(1);
  });

  it('fails closed when fixture actors attempt production finance governance', async () => {
    const maker = await createOperator('maker', [Role.ADMIN, Role.MASTER_ADMIN]);
    const target = await createOperator('target', [Role.ADMIN]);

    await expect(service.createFinanceApproverAccessRequest(maker.id, {
      targetUserId: target.id,
      requestedEnabled: true,
      operatorReason: 'Attempt production finance access from an isolated fixture actor',
      idempotencyKey: `${testRunId}:blocked-request`,
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TEST_OR_FIXTURE_ACCOUNT' }),
    });
    expect(await prisma.financeApproverAccessRequest.count({
      where: { idempotencyKey: `${testRunId}:blocked-request` },
    })).toBe(0);
  });

  it('enforces append-only audit parity inside the disposable schema', async () => {
    const actor = await createOperator('append-only-actor', [Role.ADMIN]);
    const event = await prisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        action: 'admin_user.finance_approver.integration_append_only_probe',
        target: `finance_approver_integration:${testRunId}`,
      },
    });

    await expect(prisma.adminAuditLog.delete({ where: { id: event.id } })).rejects.toBeTruthy();
    await expect(prisma.adminAuditLog.findUnique({ where: { id: event.id } })).resolves.not.toBeNull();
  });

  it('rolls back a role change when the same transaction cannot persist its audit', async () => {
    const target = await createOperator('rollback-target', [Role.ADMIN]);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: target.id },
          data: { roles: { set: [Role.ADMIN, Role.FINANCE_APPROVER] } },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: `${testRunId}:missing-actor`,
            action: 'admin_user.finance_approver.grant',
            target: `user:${target.id}`,
          },
        });
      }),
    ).rejects.toBeTruthy();

    const persisted = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: { roles: true } });
    expect(persisted.roles).toEqual([Role.ADMIN]);
  });

  async function createOperator(suffix: string, roles: Role[]) {
    const id = `${testRunId}:${suffix}`;
    return prisma.user.create({
      data: {
        id,
        phone: `admin:${id}`,
        email: `${suffix}.${testRunId}@hands.test`,
        fullName: `Finance governance fixture ${suffix}`,
        roles,
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'FINANCE_APPROVER_GOVERNANCE_INTEGRATION',
        fixtureRunId: testRunId,
        fixtureExpiresAt: new Date(Date.now() + 60 * 60_000),
        adminOperatorPermission: {
          create: {
            categories: roles.includes(Role.MASTER_ADMIN)
              ? [
                  AdminOperatorPermissionCategory.SYSTEM_ADMIN_OPERATORS,
                  AdminOperatorPermissionCategory.FINANCE,
                ]
              : [AdminOperatorPermissionCategory.FINANCE],
          },
        },
        adminOperatorCredential: {
          create: {
            email: `${suffix}.${testRunId}@hands.test`,
            mfaState: 'VERIFIED',
            passwordHash: 'integration-only-hash',
            passwordSalt: 'integration-only-salt',
            setupCompletedAt: new Date(),
          },
        },
      },
    });
  }

});
