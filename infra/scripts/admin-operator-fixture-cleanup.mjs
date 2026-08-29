import { createHash } from 'node:crypto';

import { AdminUserProvenance, PrismaClient, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  ADMIN_OPERATOR_FIXTURE_DECISIONS,
  adminOperatorFixtureDecision,
} from './lib/admin-operator-fixture-cleanup.mjs';

const { env } = loadMergedEnv();
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=') || true];
}));
const apply = args.get('apply') === true;
const confirmation = args.get('confirm');
const actorId = typeof args.get('actor-id') === 'string' ? args.get('actor-id') : null;
const exactIds = new Set(typeof args.get('ids') === 'string' ? args.get('ids').split(',').filter(Boolean) : []);
if (apply && (
  confirmation !== 'DELETE_EXACT_ADMIN_OPERATOR_FIXTURES' ||
  !actorId ||
  exactIds.size === 0
)) {
  throw new Error('Apply requires --apply --confirm=DELETE_EXACT_ADMIN_OPERATOR_FIXTURES --actor-id=<master-admin-id> --ids=<exact,id,list>');
}

const prisma = new PrismaClient();
try {
  const observedAt = new Date();
  const ownedLifecycleConstraints = new Set([
    'AdminOperatorCredential_userId_fkey',
    'AdminOperatorPermission_userId_fkey',
    'AdminWebSession_userId_fkey',
  ]);
  const userForeignKeys = (await prisma.$queryRaw`
    SELECT
      constraint_row.conname AS "constraintName",
      child_table.relname AS "tableName",
      child_column.attname AS "columnName",
      constraint_row.confdeltype AS "deleteAction"
    FROM pg_constraint constraint_row
    INNER JOIN pg_class child_table ON child_table.oid = constraint_row.conrelid
    INNER JOIN pg_attribute child_column
      ON child_column.attrelid = constraint_row.conrelid
      AND child_column.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = '"User"'::regclass
      AND cardinality(constraint_row.conkey) = 1
      AND cardinality(constraint_row.confkey) = 1
    ORDER BY constraint_row.conname ASC
  `).filter((foreignKey) => !ownedLifecycleConstraints.has(foreignKey.constraintName));
  const rows = await prisma.user.findMany({
    where: {
      roles: { has: Role.ADMIN },
      OR: [
        { adminUserProvenance: AdminUserProvenance.FIXTURE },
        { fixtureKind: { not: null } },
        { fixtureRunId: { not: null } },
        { fixtureExpiresAt: { not: null } },
        { id: { startsWith: 'finance-governance-' } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
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
        select: {
          id: true,
          disabledAt: true,
          lockedUntil: true,
          mfaState: true,
          setupCompletedAt: true,
        },
      },
      adminWebSessions: {
        where: { revokedAt: null, expiresAt: { gt: observedAt } },
        orderBy: [{ expiresAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { id: true },
      },
      _count: {
        select: {
          adminWebSessions: true,
          adminOperatorInvitationsCreated: true,
          adminOperatorInvitationsTargeted: true,
          auditLogs: true,
          financeApproverRequestsCreated: true,
          financeApproverRequestsDecided: true,
          financeApproverRequestsTargeted: true,
        },
      },
    },
  });
  const candidates = [];
  for (const row of rows) {
    const userReferences = {};
    for (const foreignKey of userForeignKeys) {
      const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS "count" FROM ${quoteIdentifier(foreignKey.tableName)} WHERE ${quoteIdentifier(foreignKey.columnName)} = $1`,
        row.id,
      );
      userReferences[foreignKey.constraintName] = result[0]?.count ?? 0;
    }
    const decision = adminOperatorFixtureDecision({
      ...row,
      dependencies: row._count,
      userReferences,
    });
    candidates.push({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      provenance: row.adminUserProvenance,
      fixtureKind: row.fixtureKind,
      fixtureRunId: row.fixtureRunId,
      fixtureExpiresAt: row.fixtureExpiresAt,
      roles: row.roles,
      patternEvidence: { financeGovernanceIdPrefix: row.id.startsWith('finance-governance-') },
      permission: {
        present: Boolean(row.adminOperatorPermission),
        categories: row.adminOperatorPermission?.categories ?? [],
        version: row.adminOperatorPermission?.version ?? null,
      },
      credential: {
        present: Boolean(row.adminOperatorCredential),
        disabledAt: row.adminOperatorCredential?.disabledAt ?? null,
        lockedUntil: row.adminOperatorCredential?.lockedUntil ?? null,
        mfaState: row.adminOperatorCredential?.mfaState ?? null,
        setupCompletedAt: row.adminOperatorCredential?.setupCompletedAt ?? null,
      },
      sessions: {
        anyPresent: row._count.adminWebSessions > 0,
        activePresent: row.adminWebSessions.length > 0,
        totalCount: row._count.adminWebSessions,
      },
      dependencySummary: {
        retainedCount: decision.retainedDependencyCount,
        counts: row._count,
        allUserReferences: userReferences,
      },
      recommendation: decision.recommendation,
      reason: decision.reason,
      ...(decision.productRoles.length ? { productRoles: decision.productRoles } : {}),
      retirementPlan:
        decision.recommendation === 'RETIRE_OPERATOR'
          ? [
              'Suspend the operator credential and revoke active sessions.',
              'Remove Finance Approver authority through the governed maker-checker flow when applicable.',
              'Complete Admin operator offboarding while retaining the User record and dependent audit/finance evidence.',
            ]
          : null,
    });
  }
  const manifestFingerprint = createHash('sha256').update(JSON.stringify(candidates)).digest('hex');

  if (apply) {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { roles: true } });
    if (!actor?.roles.includes(Role.MASTER_ADMIN) || exactIds.has(actorId)) {
      throw new Error('Apply actor must be a non-target Master Admin');
    }
    const selected = candidates.filter((candidate) => exactIds.has(candidate.id));
    if (selected.length !== exactIds.size) throw new Error('Every apply ID must match the current exact fixture candidate query');
    if (selected.some((candidate) => candidate.recommendation !== 'DELETE_FIXTURE')) {
      throw new Error('Apply refused: every exact ID must have a deterministic DELETE_FIXTURE recommendation');
    }
    await prisma.$transaction(async (tx) => {
      for (const candidate of selected) {
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'admin_operator.fixture.cleanup',
            target: `user:${candidate.id}`,
            metadata: {
              fixtureKind: candidate.fixtureKind,
              fixtureRunId: candidate.fixtureRunId,
              provenance: candidate.provenance,
              source: 'exact_admin_operator_fixture_cleanup',
            },
          },
        });
        await tx.user.delete({ where: { id: candidate.id } });
      }
    });
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'READ_ONLY_DRY_RUN',
    observedAt: observedAt.toISOString(),
    manifestVersion: 1,
    manifestFingerprint,
    decisionValues: ADMIN_OPERATOR_FIXTURE_DECISIONS,
    candidateCount: candidates.length,
    exactCandidateIds: candidates.map((candidate) => candidate.id),
    retainedUserForeignKeyCoverage: userForeignKeys,
    candidates,
    rollback: 'Restore the database backup taken before apply. This tool does not perform soft deletion.',
    nextAction: 'Review the exact decision manifest. Pattern evidence alone cannot authorize deletion, and RETIRE_OPERATOR preserves dependency-bearing User records.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
