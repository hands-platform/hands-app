import { createHash } from 'node:crypto';

import { AdminUserProvenance, Prisma, PrismaClient, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN,
  knownFinanceGovernanceFixtureRepairDecision,
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
const run = KNOWN_FINANCE_GOVERNANCE_FIXTURE_RUN;
const exactIds = run.suffixes.map((suffix) => `${run.runId}:${suffix}`);
const fixtureExpiresAt = new Date(Number(run.runId.slice('finance-governance-'.length)) + 60 * 60_000);

if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('This exact repair is restricted to a local database target.');
}
if (apply && (
  confirmation !== 'CLASSIFY_EXACT_FINANCE_GOVERNANCE_FIXTURES' ||
  !actorId ||
  !expectedHash
)) {
  throw new Error('Apply requires --apply --confirm=CLASSIFY_EXACT_FINANCE_GOVERNANCE_FIXTURES --actor-id=<master-admin-id> --expected-hash=<dry-run-hash>.');
}

const prisma = new PrismaClient();
const candidateSelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  roles: true,
  createdAt: true,
  adminUserProvenance: true,
  fixtureKind: true,
  fixtureRunId: true,
  fixtureExpiresAt: true,
  adminOperatorCredential: {
    select: { id: true, lastLoginAt: true, setupCompletedAt: true },
  },
  _count: { select: { adminWebSessions: true } },
};

function projectCandidates(rows) {
  return rows.map((row) => {
    const projected = {
      id: row.id,
      phone: row.phone,
      email: row.email,
      fullName: row.fullName,
      roles: row.roles,
      createdAt: row.createdAt,
      adminUserProvenance: row.adminUserProvenance,
      fixtureKind: row.fixtureKind,
      fixtureRunId: row.fixtureRunId,
      fixtureExpiresAt: row.fixtureExpiresAt,
      adminOperatorCredential: row.adminOperatorCredential,
      adminWebSessionCount: row._count.adminWebSessions,
    };
    return { ...projected, decision: knownFinanceGovernanceFixtureRepairDecision(projected) };
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
    if (!allEligible) throw new Error('Apply refused: the exact known-run evidence manifest is incomplete or has conflicts.');
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
        throw new Error('Apply refused: candidate evidence changed inside the transaction.');
      }

      for (const candidate of lockedCandidates) {
        const updated = await tx.user.updateMany({
          where: {
            id: candidate.id,
            adminUserProvenance: AdminUserProvenance.PRODUCTION,
            fixtureKind: null,
            fixtureRunId: null,
            fixtureExpiresAt: null,
          },
          data: {
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: run.fixtureKind,
            fixtureRunId: run.runId,
            fixtureExpiresAt,
          },
        });
        if (updated.count !== 1) throw new Error(`Concurrent update detected for ${candidate.id}.`);
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'admin_operator.fixture.provenance_repaired',
            target: `user:${candidate.id}`,
            source: 'admin_operator_known_test_run_repair',
            metadata: {
              approval: 'operations_policy_owner_explicit_continuation',
              before: { provenance: AdminUserProvenance.PRODUCTION, fixtureKind: null, fixtureRunId: null },
              after: { provenance: AdminUserProvenance.FIXTURE, fixtureKind: run.fixtureKind, fixtureRunId: run.runId },
              evidence: {
                exactKnownTestRunId: run.runId,
                manifestHash: expectedHash,
                originalCreatedAt: candidate.createdAt.toISOString(),
              },
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
    proposedClassification: {
      adminUserProvenance: AdminUserProvenance.FIXTURE,
      fixtureKind: run.fixtureKind,
      fixtureRunId: run.runId,
      fixtureExpiresAt,
    },
    candidates,
    mutation: apply ? '12 exact User provenance/fixture marker updates and 12 append-only audit events' : 'none',
    rollback: 'Restore pre-exact-actions-massage_vn-2026-08-28-1932-ICT.dump before attempting any later lifecycle mutation.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
