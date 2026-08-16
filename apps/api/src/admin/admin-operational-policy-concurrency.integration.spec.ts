import { Prisma, PrismaClient, Role } from '@prisma/client';

import { AdminService } from './admin.service';

const integrationDescribe =
  process.env.RUN_OPERATIONAL_POLICY_DB_INTEGRATION === '1' ? describe : describe.skip;

integrationDescribe('Operational policy PostgreSQL concurrency', () => {
  const prisma = new PrismaClient();
  const runId = `operations-policy-concurrency-${Date.now()}`;
  const key = 'matching.provider_response_window_minutes';
  const actorIds = [`${runId}-actor-a`, `${runId}-actor-b`];
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeAll(async () => {
    // `prisma db push` cannot materialize the migration-owned dbgenerated() default in a disposable DB.
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AdminAuditLog" ALTER COLUMN "timelineAt" SET DEFAULT CURRENT_TIMESTAMP',
    );
    await prisma.user.createMany({
      data: actorIds.map((id, index) => ({
        id,
        phone: `+8499${Date.now()}${index}`,
        fullName: `Concurrency Actor ${index + 1}`,
        roles: [Role.ADMIN],
      })),
    });
    await prisma.operationalPolicySetting.create({
      data: {
        key,
        category: 'Matching',
        label: 'First-pick Partner response window',
        value: 10,
        recommendedValue: 10,
        requiresRestart: false,
        updatedById: actorIds[0],
      },
    });
  });

  afterAll(async () => {
    await prisma.operationalPolicySetting.deleteMany({ where: { key } });
    await prisma.$disconnect();
  });

  it('commits exactly one value and one audit when two requests share the same expected value', async () => {
    const auditCountBefore = await prisma.adminAuditLog.count({
      where: { action: 'operational_policy.update', target: `operational_policy:${key}` },
    });
    const outcomes = await Promise.allSettled([
      service.updateOperationalPolicySetting(actorIds[0], key, {
        expectedValue: 10,
        reason: 'Concurrent operator A reviewed matching queue evidence',
        value: 12,
      }),
      service.updateOperationalPolicySetting(actorIds[1], key, {
        expectedValue: 10,
        reason: 'Concurrent operator B reviewed matching queue evidence',
        value: 15,
      }),
    ]);

    const outcomeSummary = outcomes.map((outcome) =>
      outcome.status === 'fulfilled'
        ? { status: outcome.status, value: outcome.value.value }
        : { status: outcome.status, reason: String(outcome.reason), response: outcome.reason?.response },
    );
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled'), JSON.stringify(outcomeSummary)).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason?.getStatus?.() : null).toBe(409);

    const setting = await prisma.operationalPolicySetting.findUniqueOrThrow({ where: { key } });
    expect([12, 15]).toContain(setting.value);
    await expect(
      prisma.adminAuditLog.count({
        where: { action: 'operational_policy.update', target: `operational_policy:${key}` },
      }),
    ).resolves.toBe(auditCountBefore + 1);
  });

  it('commits exactly one value and one audit when two requests race from the default without a row', async () => {
    await prisma.operationalPolicySetting.deleteMany({ where: { key } });
    const auditCountBefore = await prisma.adminAuditLog.count({
      where: { action: 'operational_policy.update', target: `operational_policy:${key}` },
    });

    const outcomes = await Promise.allSettled([
      service.updateOperationalPolicySetting(actorIds[0], key, {
        expectedValue: 10,
        reason: 'Default-row race operator A reviewed matching queue evidence',
        value: 11,
      }),
      service.updateOperationalPolicySetting(actorIds[1], key, {
        expectedValue: 10,
        reason: 'Default-row race operator B reviewed matching queue evidence',
        value: 13,
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' ? rejected.reason?.getStatus?.() : null).toBe(409);

    const setting = await prisma.operationalPolicySetting.findUniqueOrThrow({ where: { key } });
    expect([11, 13]).toContain(setting.value);
    await expect(
      prisma.adminAuditLog.count({
        where: { action: 'operational_policy.update', target: `operational_policy:${key}` },
      }),
    ).resolves.toBe(auditCountBefore + 1);
  });

  it('returns missing-source history only from the legacy unknown audit filter', async () => {
    await prisma.adminAuditLog.createMany({
      data: [
        {
          action: 'operational_policy.update',
          target: 'operational_policy:legacy-source-test',
          metadata: Prisma.DbNull,
        },
        {
          action: 'operational_policy.update',
          target: 'operational_policy:operator-source-test',
          metadata: { source: 'operator' },
        },
        {
          action: 'operational_policy.update',
          target: 'operational_policy:smoke-source-test',
          metadata: { source: 'automated_smoke' },
        },
      ],
    });

    const legacy = await service.listOperationalPolicyAudit({ source: 'legacy_unknown' });
    const operator = await service.listOperationalPolicyAudit({ source: 'operator' });

    expect(legacy.items.map((item) => item.target)).toContain('operational_policy:legacy-source-test');
    expect(legacy.items.map((item) => item.target)).not.toContain('operational_policy:operator-source-test');
    expect(operator.items.map((item) => item.target)).toContain('operational_policy:operator-source-test');
    expect(operator.items.map((item) => item.target)).not.toContain('operational_policy:legacy-source-test');
  });
});
