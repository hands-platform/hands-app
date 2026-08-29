import { createHash } from 'node:crypto';

import {
  AdminAuditArea,
  AdminAuditOutcome,
  AdminAuditSeverity,
  AdminUserProvenance,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN,
  knownFinanceGovernanceFixtureRetirementDecision,
} from './lib/admin-operator-fixture-cleanup.mjs';

const { env } = loadMergedEnv();
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=') || true];
}));
const apply = args.get('apply') === true;
const actorId = typeof args.get('actor-id') === 'string' ? args.get('actor-id') : null;
const confirmation = args.get('confirm');
const expectedHash = typeof args.get('expected-hash') === 'string' ? args.get('expected-hash') : null;
const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const observedAt = new Date();
const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
const deletedSuffixes = new Set(['grant-backup', 'rollback-target']);
const exactIds = run.suffixes
  .filter((suffix) => !deletedSuffixes.has(suffix))
  .map((suffix) => `${run.runId}:${suffix}`);

if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('This exact retirement is restricted to a local database target.');
}
if (apply && (
  confirmation !== 'RETIRE_EXACT_FINANCE_GOVERNANCE_FIXTURES' ||
  !actorId ||
  !expectedHash
)) {
  throw new Error('Apply requires --apply --confirm=RETIRE_EXACT_FINANCE_GOVERNANCE_FIXTURES --actor-id=<master-admin-id> --expected-hash=<dry-run-hash>.');
}

const prisma = new PrismaClient();
const candidateSelect = {
  id: true,
  email: true,
  fullName: true,
  roles: true,
  adminUserProvenance: true,
  fixtureKind: true,
  fixtureRunId: true,
  fixtureExpiresAt: true,
  adminOperatorPermission: { select: { id: true, categories: true, version: true } },
  adminOperatorCredential: {
    select: { id: true, disabledAt: true, lastLoginAt: true, setupCompletedAt: true },
  },
  adminWebSessions: {
    where: { revokedAt: null, expiresAt: { gt: observedAt } },
    select: { id: true },
  },
};

function projectCandidates(rows) {
  return rows.map((row) => {
    const projected = {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      roles: row.roles,
      adminUserProvenance: row.adminUserProvenance,
      fixtureKind: row.fixtureKind,
      fixtureRunId: row.fixtureRunId,
      fixtureExpiresAt: row.fixtureExpiresAt,
      adminOperatorPermission: row.adminOperatorPermission,
      adminOperatorCredential: row.adminOperatorCredential,
      activeAdminWebSessionCount: row.adminWebSessions.length,
    };
    return { ...projected, decision: knownFinanceGovernanceFixtureRetirementDecision(projected) };
  });
}

function candidateHash(candidates) {
  return createHash('sha256').update(JSON.stringify(candidates)).digest('hex');
}

try {
  const rows = await prisma.user.findMany({
    where: { id: { in: exactIds } },
    orderBy: { id: 'asc' },
    select: candidateSelect,
  });
  const candidates = projectCandidates(rows);
  const manifestHash = candidateHash(candidates);
  const allEligible = rows.length === exactIds.length && candidates.every((candidate) => candidate.decision.eligible);

  if (apply) {
    if (!allEligible) throw new Error('Apply refused: exact fixture retirement evidence is incomplete or conflicted.');
    if (manifestHash !== expectedHash) throw new Error('Apply refused: the dry-run manifest hash changed.');

    await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { roles: true } });
      if (!actor?.roles.includes(Role.MASTER_ADMIN) || exactIds.includes(actorId)) {
        throw new Error('Apply actor must be a non-target Master Admin.');
      }
      const lockedRows = await tx.user.findMany({
        where: { id: { in: exactIds } },
        orderBy: { id: 'asc' },
        select: candidateSelect,
      });
      const lockedCandidates = projectCandidates(lockedRows);
      if (candidateHash(lockedCandidates) !== expectedHash || lockedCandidates.some((candidate) => !candidate.decision.eligible)) {
        throw new Error('Apply refused: retirement evidence changed inside the transaction.');
      }

      for (const candidate of lockedCandidates) {
        await tx.adminOperatorCredential.updateMany({
          where: { userId: candidate.id },
          data: { disabledAt: observedAt },
        });
        const updated = await tx.user.updateMany({
          where: {
            id: candidate.id,
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: run.fixtureKind,
            fixtureRunId: run.runId,
          },
          data: {
            roles: { set: candidate.roles.filter((role) => ![Role.ADMIN, Role.MASTER_ADMIN, Role.FINANCE_APPROVER].includes(role)) },
          },
        });
        if (updated.count !== 1) throw new Error(`Concurrent update detected for ${candidate.id}.`);
        await tx.adminOperatorPermission.deleteMany({ where: { userId: candidate.id } });
        await tx.adminOperatorCredential.deleteMany({ where: { userId: candidate.id } });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'admin_operator.fixture.retired',
            target: `user:${candidate.id}`,
            objectType: 'User',
            objectId: candidate.id,
            objectLabelSnapshot: candidate.fullName,
            source: 'admin_operator_known_test_run_retire',
            area: AdminAuditArea.SECURITY,
            severity: AdminAuditSeverity.NOTICE,
            outcome: AdminAuditOutcome.SUCCEEDED,
            metadata: {
              approval: 'operations_policy_owner_explicit_continuation',
              fixtureRunId: run.runId,
              manifestHash: expectedHash,
              activeAdminWebSessionsVerified: 0,
              suspendedAt: observedAt.toISOString(),
              rolesBefore: candidate.roles,
              rolesAfter: candidate.roles.filter((role) => ![Role.ADMIN, Role.MASTER_ADMIN, Role.FINANCE_APPROVER].includes(role)),
              credentialRetained: false,
              permissionRetained: false,
              userAndBusinessEvidenceRetained: true,
            },
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'READ_ONLY_DRY_RUN',
    databaseTarget: `${databaseUrl.protocol}//${databaseUrl.hostname}:${databaseUrl.port || '5432'}/${databaseUrl.pathname.slice(1)}`,
    exactRunId: run.runId,
    exactCandidateCount: candidates.length,
    expectedCandidateCount: exactIds.length,
    exactIds,
    manifestHash,
    allEligible,
    candidates,
    mutation: apply
      ? '10 exact fixture operators retired; User and linked evidence retained'
      : 'none',
    rollback: 'Restore pre-exact-actions-massage_vn-2026-08-28-1932-ICT.dump before attempting any later lifecycle mutation.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
