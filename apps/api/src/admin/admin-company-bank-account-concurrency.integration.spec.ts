import { PrismaClient, Role } from '@prisma/client';

import { AdminService } from './admin.service';

const integrationDescribe =
  process.env.RUN_COMPANY_BANK_ACCOUNT_DB_INTEGRATION === '1' ? describe : describe.skip;

integrationDescribe('Company bank account PostgreSQL concurrency', () => {
  const prisma = new PrismaClient();
  const runId = `company-bank-concurrency-${Date.now()}`;
  const actorIds = [
    'company-bank-concurrency:maker-a',
    'company-bank-concurrency:maker-b',
    'company-bank-concurrency:checker',
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
      })),
      skipDuplicates: true,
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
