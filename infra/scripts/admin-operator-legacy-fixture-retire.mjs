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
  LEGACY_ADMIN_ONLY_FIXTURE_MANIFEST,
  LEGACY_HIGH_PRIVILEGE_FIXTURE_MANIFEST,
  legacyAdminOnlyFixtureRetirementDecision,
  legacyHighPrivilegeFixtureRetirementDecision,
} from './lib/admin-operator-fixture-cleanup.mjs';

const { env } = loadMergedEnv();
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/u, '').split('=');
  return [key, rest.join('=') || true];
}));
const scope = args.get('scope');
const scopes = {
  'high-privilege': {
    manifest: LEGACY_HIGH_PRIVILEGE_FIXTURE_MANIFEST,
    decide: legacyHighPrivilegeFixtureRetirementDecision,
    confirmation: 'RETIRE_EXACT_LEGACY_HIGH_PRIVILEGE_FIXTURES',
    auditAction: 'admin_operator.fixture.legacy_high_privilege_retired',
  },
  'admin-only': {
    manifest: LEGACY_ADMIN_ONLY_FIXTURE_MANIFEST,
    decide: legacyAdminOnlyFixtureRetirementDecision,
    confirmation: 'RETIRE_EXACT_LEGACY_ADMIN_ONLY_FIXTURES',
    auditAction: 'admin_operator.fixture.legacy_admin_only_retired',
  },
};
const config = typeof scope === 'string' ? scopes[scope] : null;
if (!config) throw new Error('Use an exact --scope=high-privilege or --scope=admin-only manifest.');

const apply = args.get('apply') === true;
const actorId = typeof args.get('actor-id') === 'string' ? args.get('actor-id') : null;
const confirmation = args.get('confirm');
const expectedHash = typeof args.get('expected-hash') === 'string' ? args.get('expected-hash') : null;
const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const observedAt = new Date();
const exactIds = config.manifest.map((entry) => entry.id);
const expectedById = new Map(config.manifest.map((entry) => [entry.id, entry]));

if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
  throw new Error('This exact legacy fixture retirement is restricted to a local database target.');
}
if (apply && (confirmation !== config.confirmation || !actorId || !expectedHash)) {
  throw new Error(`Apply requires --apply --confirm=${config.confirmation} --actor-id=<master-admin-id> --expected-hash=<dry-run-hash>.`);
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
  customerProfile: { select: { id: true } },
  providerProfile: { select: { id: true } },
  adminOperatorPermission: { select: { id: true, categories: true, version: true } },
  adminOperatorCredential: { select: { id: true } },
  adminWebSessions: {
    where: { revokedAt: null, expiresAt: { gt: observedAt } },
    select: { id: true },
  },
};

function projectCandidates(rows) {
  return rows.map((row) => {
    const expected = expectedById.get(row.id);
    if (!expected) throw new Error(`Unexpected legacy fixture candidate ${row.id}.`);
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
      customerProfile: row.customerProfile,
      providerProfile: row.providerProfile,
      adminOperatorPermission: row.adminOperatorPermission,
      adminOperatorCredential: row.adminOperatorCredential,
      activeAdminWebSessionCount: row.adminWebSessions.length,
    };
    return {
      ...projected,
      proposedFixtureKind: expected.fixtureKind,
      proposedFixtureRunId: expected.fixtureRunId,
      decision: config.decide(projected, expected),
    };
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
    if (!allEligible) throw new Error('Apply refused: exact legacy fixture evidence is incomplete or conflicted.');
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
        throw new Error('Apply refused: legacy fixture evidence changed inside the transaction.');
      }

      for (const candidate of lockedCandidates) {
        const expected = expectedById.get(candidate.id);
        const fixtureExpiresAt = new Date(new Date(expected.createdAt).getTime() + 60 * 60_000);
        const updated = await tx.user.updateMany({
          where: {
            id: candidate.id,
            adminUserProvenance: null,
            fixtureKind: null,
            fixtureRunId: null,
            fixtureExpiresAt: null,
          },
          data: {
            roles: { set: [] },
            adminUserProvenance: AdminUserProvenance.FIXTURE,
            fixtureKind: expected.fixtureKind,
            fixtureRunId: expected.fixtureRunId,
            fixtureExpiresAt,
          },
        });
        if (updated.count !== 1) throw new Error(`Concurrent update detected for ${candidate.id}.`);
        await tx.adminOperatorPermission.deleteMany({ where: { userId: candidate.id } });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: config.auditAction,
            target: `user:${candidate.id}`,
            objectType: 'User',
            objectId: candidate.id,
            objectLabelSnapshot: candidate.fullName,
            source: 'admin_operator_legacy_fixture_retire',
            area: AdminAuditArea.SECURITY,
            severity: AdminAuditSeverity.NOTICE,
            outcome: AdminAuditOutcome.SUCCEEDED,
            metadata: {
              approval: 'operations_policy_owner_explicit_continuation',
              scope,
              manifestHash: expectedHash,
              evidence: {
                exactIdentityAndCreationTimeMatched: true,
                activeAdminWebSessionsVerified: 0,
                credentialVerifiedAbsent: true,
                customerOrPartnerProfileVerifiedAbsent: true,
              },
              fixtureKind: expected.fixtureKind,
              fixtureRunId: expected.fixtureRunId,
              rolesBefore: candidate.roles,
              rolesAfter: [],
              userAndLinkedEvidenceRetained: true,
            },
          },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'READ_ONLY_DRY_RUN',
    scope,
    databaseTarget: `${databaseUrl.protocol}//${databaseUrl.hostname}:${databaseUrl.port || '5432'}/${databaseUrl.pathname.slice(1)}`,
    exactCandidateCount: candidates.length,
    expectedCandidateCount: exactIds.length,
    exactIds,
    manifestHash,
    allEligible,
    candidates,
    mutation: apply
      ? `${exactIds.length} exact legacy fixture users classified and retired; User and linked evidence retained`
      : 'none',
    rollback: 'Restore pre-exact-actions-massage_vn-2026-08-28-1932-ICT.dump before attempting any later lifecycle mutation.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
