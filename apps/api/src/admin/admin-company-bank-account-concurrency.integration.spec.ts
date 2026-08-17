import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  PrismaClient,
  Role,
} from '@prisma/client';

import { disposableIntegrationDatabaseTarget } from '../common/disposable-integration-database';
import { AdminService } from './admin.service';
import { FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION } from './finance-approver-policy';

const integrationEnabled = process.env.RUN_COMPANY_BANK_ACCOUNT_DB_INTEGRATION === '1';
const integrationTarget = integrationEnabled
  ? disposableIntegrationDatabaseTarget(
      process.env.DATABASE_URL,
      process.env.INTEGRATION_DATABASE_ALLOWLIST,
    )
  : null;
const integrationDescribe = integrationEnabled ? describe : describe.skip;

integrationDescribe('Company bank account PostgreSQL concurrency', () => {
  const prisma = new PrismaClient({
    ...(integrationTarget ? { datasources: { db: { url: integrationTarget.databaseUrl } } } : {}),
  });
  const runId = `company-bank-concurrency-${Date.now()}`;
  const actorIds = [
    `${runId}-maker-a`,
    `${runId}-maker-b`,
    `${runId}-checker`,
  ];
  const last4 = String(Date.now()).slice(-4);
  const service = new AdminService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeAll(async () => {
    await prisma.user.createMany({
      data: actorIds.map((id, index) => ({
        id,
        fullName: `Company bank concurrency actor ${index + 1}`,
        phone: `admin:${id}`,
        roles: index === 2 ? [Role.ADMIN, Role.FINANCE_APPROVER] : [Role.ADMIN],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      })),
      skipDuplicates: true,
    });
    await prisma.adminOperatorCredential.upsert({
      where: { userId: actorIds[2] },
      create: {
        userId: actorIds[2],
        email: `${runId}.checker@hands.test`,
        passwordHash: 'integration-only-hash',
        passwordSalt: 'integration-only-salt',
        setupCompletedAt: new Date(),
        mfaState: 'VERIFIED',
      },
      update: {
        disabledAt: null,
        lockedUntil: null,
        setupCompletedAt: new Date(),
        mfaState: 'VERIFIED',
      },
    });
    await prisma.adminOperatorPermission.upsert({
      where: { userId: actorIds[2] },
      create: {
        userId: actorIds[2],
        categories: [AdminOperatorPermissionCategory.FINANCE],
      },
      update: {
        categories: { set: [AdminOperatorPermissionCategory.FINANCE] },
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        actorId: actorIds[0],
        action: FINANCE_APPROVER_LEGACY_ATTESTATION_ACTION,
        target: `finance_approver_attestation:${actorIds[2]}:${runId}`,
        metadata: {
          attestorId: actorIds[1],
          sourceReference: `disposable-integration:${runId}`,
        },
      },
    });
  });

  afterAll(async () => {
    const accounts = await prisma.companyBankAccount.findMany({
      where: { name: { startsWith: runId } },
      select: { id: true },
    });
    await prisma.companyBankAccount.deleteMany({ where: { id: { in: accounts.map((account) => account.id) } } });
    await prisma.$disconnect();
  });

  it('serializes different actors and idempotency keys for the same controlled identity', async () => {
    const request = (actorId: string, suffix: string) => service.createCompanyBankAccount(actorId, {
      accountNumberLast4: last4,
      bankCode: 'VCB',
      bankName: 'VCB',
      currency: 'VND',
      idempotencyKey: `${runId}:${suffix}`,
      name: `${runId} ${suffix}`,
      operatorReason: `Concurrent duplicate review evidence for ${suffix}`,
    });

    const outcomes = await Promise.allSettled([
      request(actorIds[0], 'request-a'),
      request(actorIds[1], 'request-b'),
    ]);
    const diagnostics = outcomes.map((outcome) => outcome.status === 'fulfilled'
      ? { status: outcome.status, id: outcome.value.id }
      : {
          status: outcome.status,
          code: errorCode(outcome.reason),
          message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          response: typeof outcome.reason?.getResponse === 'function' ? outcome.reason.getResponse() : null,
        });

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled'), JSON.stringify(diagnostics)).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' ? errorCode(rejected.reason) : null).toBe(
      'COMPANY_BANK_ACCOUNT_POTENTIAL_DUPLICATE',
    );
    await expect(
      prisma.companyBankAccount.count({ where: { name: { startsWith: runId } } }),
    ).resolves.toBe(1);
    const account = await prisma.companyBankAccount.findFirstOrThrow({
      where: { name: { startsWith: runId } },
      select: { id: true },
    });
    await expect(prisma.adminAuditLog.count({
      where: {
        action: 'company_bank_account.approval_requested',
        target: `company_bank_account:${account.id}`,
      },
    })).resolves.toBe(1);
  }, 30_000);
});

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'getResponse' in error) {
    const response = (error as { getResponse: () => unknown }).getResponse();
    if (response && typeof response === 'object' && 'code' in response) return response.code;
  }
  return null;
}
