import { createHash } from 'node:crypto';

import {
  AdminAuditArea,
  AdminAuditOutcome,
  AdminAuditSeverity,
  FinanceApproverAccessRequestStatus,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST,
  knownFinanceGovernancePendingRequestCloseDecision,
} from './lib/admin-operator-fixture-cleanup.mjs';

const { env } = loadMergedEnv();
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=') || true];
}));
const apply = args.get('apply') === true;
const actorId = typeof args.get('actor-id') === 'string' ? args.get('actor-id') : null;
const expectedHash = typeof args.get('expected-hash') === 'string' ? args.get('expected-hash') : null;
const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const exactIds = KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST.map((entry) => entry.id);
const expectedById = new Map(KNOWN_FINANCE_GOVERNANCE_PENDING_REQUEST_MANIFEST.map((entry) => [entry.id, entry]));

if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('This exact known-run request cleanup is restricted to a local database target.');
}
if (apply && (
  args.get('confirm') !== 'CLOSE_EXACT_KNOWN_TEST_RUN_PENDING_REQUESTS' ||
  !actorId ||
  !expectedHash
)) {
  throw new Error('Apply requires --apply --confirm=CLOSE_EXACT_KNOWN_TEST_RUN_PENDING_REQUESTS --actor-id=<master-admin-id> --expected-hash=<dry-run-hash>.');
}

const prisma = new PrismaClient();
const requestSelect = {
  id: true,
  targetUserId: true,
  requestedEnabled: true,
  previousEnabled: true,
  previousRoles: true,
  requestedByAdminId: true,
  requestedAt: true,
  expectedTargetUpdatedAt: true,
  status: true,
  decidedByAdminId: true,
  decidedAt: true,
  executedAt: true,
  idempotencyKey: true,
  pendingKey: true,
  requestedByAdmin: {
    select: { roles: true, adminUserProvenance: true, fixtureKind: true, fixtureRunId: true },
  },
  targetUser: {
    select: { roles: true, adminUserProvenance: true, fixtureKind: true, fixtureRunId: true },
  },
};

function project(rows) {
  return rows.map((row) => {
    const expected = expectedById.get(row.id);
    if (!expected) throw new Error(`Unexpected pending request ${row.id}.`);
    return { ...row, decision: knownFinanceGovernancePendingRequestCloseDecision(row, expected) };
  });
}

function manifestHash(rows) {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

try {
  const rows = await prisma.financeApproverAccessRequest.findMany({
    where: { id: { in: exactIds } },
    orderBy: { id: 'asc' },
    select: requestSelect,
  });
  const candidates = project(rows);
  const hash = manifestHash(candidates);
  const allEligible = rows.length === exactIds.length && candidates.every((candidate) => candidate.decision.eligible);

  if (apply) {
    if (!allEligible) throw new Error('Apply refused: exact pending fixture request evidence is incomplete or conflicted.');
    if (hash !== expectedHash) throw new Error('Apply refused: the dry-run manifest hash changed.');

    await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { roles: true } });
      if (!actor?.roles.includes(Role.MASTER_ADMIN)) throw new Error('Apply actor must be a Master Admin.');
      const lockedRows = await tx.financeApproverAccessRequest.findMany({
        where: { id: { in: exactIds } },
        orderBy: { id: 'asc' },
        select: requestSelect,
      });
      const lockedCandidates = project(lockedRows);
      if (manifestHash(lockedCandidates) !== expectedHash || lockedCandidates.some((candidate) => !candidate.decision.eligible)) {
        throw new Error('Apply refused: pending fixture request evidence changed inside the transaction.');
      }

      const decidedAt = new Date();
      for (const candidate of lockedCandidates) {
        const updated = await tx.financeApproverAccessRequest.updateMany({
          where: { id: candidate.id, status: FinanceApproverAccessRequestStatus.PENDING, pendingKey: candidate.pendingKey },
          data: {
            status: FinanceApproverAccessRequestStatus.REJECTED,
            pendingKey: null,
            decidedByAdminId: actorId,
            decisionReason: 'Closed as an exact retired finance governance integration fixture request.',
            decidedAt,
          },
        });
        if (updated.count !== 1) throw new Error(`Concurrent update detected for request ${candidate.id}.`);
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'admin_operator.fixture.finance_approver_request_closed',
            target: `finance_approver_access_request:${candidate.id}`,
            objectType: 'FinanceApproverAccessRequest',
            objectId: candidate.id,
            source: 'admin_operator_known_test_run_close_pending',
            area: AdminAuditArea.SECURITY,
            severity: AdminAuditSeverity.NOTICE,
            outcome: AdminAuditOutcome.SUCCEEDED,
            metadata: {
              approval: 'operations_policy_owner_explicit_continuation',
              manifestHash: expectedHash,
              statusBefore: FinanceApproverAccessRequestStatus.PENDING,
              statusAfter: FinanceApproverAccessRequestStatus.REJECTED,
              makerId: candidate.requestedByAdminId,
              targetUserId: candidate.targetUserId,
              requestAndUserEvidenceRetained: true,
            },
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'READ_ONLY_DRY_RUN',
    databaseTarget: `${databaseUrl.protocol}//${databaseUrl.hostname}:${databaseUrl.port || '5432'}/${databaseUrl.pathname.slice(1)}`,
    exactCandidateCount: candidates.length,
    expectedCandidateCount: exactIds.length,
    exactIds,
    manifestHash: hash,
    allEligible,
    candidates,
    mutation: apply ? '2 exact retired-fixture pending requests closed as REJECTED; request and User evidence retained' : 'none',
    rollback: 'Restore pre-exact-actions-massage_vn-2026-08-28-1932-ICT.dump before attempting any later lifecycle mutation.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
