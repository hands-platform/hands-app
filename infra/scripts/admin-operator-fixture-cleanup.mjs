import { AdminUserProvenance, PrismaClient, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

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
      roles: true,
      adminUserProvenance: true,
      fixtureKind: true,
      fixtureRunId: true,
      fixtureExpiresAt: true,
      adminOperatorPermission: { select: { id: true } },
      adminOperatorCredential: { select: { id: true } },
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
  const candidates = rows.map((row) => {
    const productRoles = row.roles.filter((role) => ![Role.ADMIN, Role.MASTER_ADMIN, Role.FINANCE_APPROVER].includes(role));
    const protectedDependencies =
      row._count.auditLogs +
      row._count.adminOperatorInvitationsCreated +
      row._count.adminOperatorInvitationsTargeted +
      row._count.financeApproverRequestsCreated +
      row._count.financeApproverRequestsDecided +
      row._count.financeApproverRequestsTargeted;
    return {
      id: row.id,
      provenance: row.adminUserProvenance,
      fixtureKind: row.fixtureKind,
      fixtureRunId: row.fixtureRunId,
      fixtureExpiresAt: row.fixtureExpiresAt,
      roles: row.roles,
      dependencies: row._count,
      permissionPresent: Boolean(row.adminOperatorPermission),
      credentialPresent: Boolean(row.adminOperatorCredential),
      decision: productRoles.length || protectedDependencies ? 'MANUAL_REVIEW' : 'DELETE_ELIGIBLE',
      reasons: [
        ...(productRoles.length ? [`Product roles present: ${productRoles.join(', ')}`] : []),
        ...(protectedDependencies ? ['Retained audit, invitation, or finance-governance dependencies exist'] : []),
      ],
    };
  });

  if (apply) {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { roles: true } });
    if (!actor?.roles.includes(Role.MASTER_ADMIN) || exactIds.has(actorId)) {
      throw new Error('Apply actor must be a non-target Master Admin');
    }
    const selected = candidates.filter((candidate) => exactIds.has(candidate.id));
    if (selected.length !== exactIds.size) throw new Error('Every apply ID must match the current exact fixture candidate query');
    if (selected.some((candidate) => candidate.decision !== 'DELETE_ELIGIBLE')) {
      throw new Error('Apply refused: one or more exact IDs require manual review');
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
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    exactCandidateIds: candidates.map((candidate) => candidate.id),
    candidates,
    rollback: 'Restore the database backup taken before apply. This tool does not perform soft deletion.',
    nextAction: 'Review exact IDs and dependencies. Apply is intentionally blocked without an explicit confirmation string, actor, and exact ID list.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}

