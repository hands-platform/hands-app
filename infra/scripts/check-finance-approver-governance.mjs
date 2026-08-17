import { AdminUserProvenance, PrismaClient, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const releaseMode = process.argv.includes('--release');
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        mode: releaseMode ? 'release' : 'environment',
        environment: env.NODE_ENV ?? 'development',
        errorCode: 'FINANCE_APPROVER_GOVERNANCE_DATABASE_URL_REQUIRED',
        mutation: 'none',
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const highPrivilegeWhere = {
    roles: { hasSome: [Role.FINANCE_APPROVER, Role.MASTER_ADMIN] },
  };
  const [
    highPrivilegeTotal,
    productionCount,
    fixtureCount,
    unknownCount,
    pendingRequestCount,
    releaseBlockingAccounts,
  ] =
    await Promise.all([
      prisma.user.count({ where: highPrivilegeWhere }),
      prisma.user.count({
        where: { ...highPrivilegeWhere, adminUserProvenance: AdminUserProvenance.PRODUCTION },
      }),
      prisma.user.count({
        where: { ...highPrivilegeWhere, adminUserProvenance: AdminUserProvenance.FIXTURE },
      }),
      prisma.user.count({ where: { ...highPrivilegeWhere, adminUserProvenance: null } }),
      prisma.financeApproverAccessRequest.count({ where: { status: 'PENDING' } }),
      prisma.user.findMany({
        orderBy: { id: 'asc' },
        select: {
          adminUserProvenance: true,
          fixtureExpiresAt: true,
          fixtureKind: true,
          fixtureRunId: true,
          id: true,
          roles: true,
        },
        where: {
          ...highPrivilegeWhere,
          OR: [
            { adminUserProvenance: AdminUserProvenance.FIXTURE },
            { adminUserProvenance: null },
          ],
        },
      }),
    ]);
  const productionViolationCount = fixtureCount + unknownCount;
  const enforcementEnabled = releaseMode || env.NODE_ENV === 'production';
  const result = {
    ok: !enforcementEnabled || productionViolationCount === 0,
    mode: releaseMode ? 'release' : 'environment',
    environment: env.NODE_ENV ?? 'development',
    highPrivilegeTotal,
    productionCount,
    fixtureCount,
    unknownCount,
    pendingRequestCount,
    productionViolationCount,
    releaseBlockingAccounts: releaseBlockingAccounts.map((account) => ({
      id: account.id,
      roles: account.roles,
      provenance: account.adminUserProvenance ?? 'UNKNOWN',
      fixtureKind: account.fixtureKind,
      fixtureRunId: account.fixtureRunId,
      fixtureExpiresAt: account.fixtureExpiresAt?.toISOString() ?? null,
      recommendedAction:
        account.adminUserProvenance === AdminUserProvenance.FIXTURE
          ? 'Remove with the owning fixture cleanup after verifying the run reference.'
          : 'Classify as PRODUCTION or FIXTURE only after an owner verifies the account evidence.',
    })),
    mutation: 'none',
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
} catch {
  console.log(
    JSON.stringify(
      {
        ok: false,
        mode: releaseMode ? 'release' : 'environment',
        environment: env.NODE_ENV ?? 'development',
        errorCode: 'FINANCE_APPROVER_GOVERNANCE_UNAVAILABLE',
        mutation: 'none',
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
