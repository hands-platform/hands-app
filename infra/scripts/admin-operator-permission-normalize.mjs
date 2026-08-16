import { AdminOperatorPermissionCategory, PrismaClient, Role } from '@prisma/client';
import { readFile } from 'node:fs/promises';

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
if (apply && (confirmation !== 'NORMALIZE_ADMIN_OPERATOR_PERMISSIONS' || !actorId)) {
  throw new Error('Apply requires --apply --confirm=NORMALIZE_ADMIN_OPERATOR_PERMISSIONS --actor-id=<master-admin-id>');
}

const manifest = JSON.parse(await readFile(
  new URL('../../apps/api/src/admin/admin-operator-permission-manifest.json', import.meta.url),
  'utf8',
));
const leafCategories = new Set(manifest.categories.map(({ key }) => key));
const legacyGroups = manifest.legacyGroups;
const normalizeCategories = (categories) => [...new Set(categories.flatMap((category) =>
  leafCategories.has(category) ? [category] : legacyGroups[category] ?? [category],
))];
const prisma = new PrismaClient();

try {
  const rows = await prisma.adminOperatorPermission.findMany({
    orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      categories: true,
      version: true,
      user: { select: { adminUserProvenance: true, fixtureKind: true, fixtureRunId: true } },
    },
  });
  const candidates = rows.map((row) => {
    const normalized = normalizeCategories(row.categories);
    const unsupported = normalized.filter((category) => !leafCategories.has(category));
    const changed = unsupported.length === 0 && JSON.stringify(normalized) !== JSON.stringify(row.categories);
    return {
      id: row.id,
      userId: row.userId,
      provenance: row.user.adminUserProvenance,
      fixtureKind: row.user.fixtureKind,
      fixtureRunId: row.user.fixtureRunId,
      stored: row.categories,
      normalized,
      unsupported,
      version: row.version,
      changed,
    };
  });

  if (apply) {
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { roles: true } });
    if (!actor?.roles.includes(Role.MASTER_ADMIN)) throw new Error('Apply actor must be a Master Admin');
    const applicable = candidates.filter((candidate) => candidate.changed);
    await prisma.$transaction(async (tx) => {
      for (const candidate of applicable) {
        const updated = await tx.adminOperatorPermission.updateMany({
          where: { id: candidate.id, version: candidate.version },
          data: { categories: { set: candidate.normalized }, version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new Error(`Concurrent permission change for ${candidate.id}`);
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'admin_operator.permission.normalize',
            target: `user:${candidate.userId}`,
            metadata: {
              before: candidate.stored,
              after: candidate.normalized,
              permissionId: candidate.id,
              source: 'admin_operator_permission_leaf_normalization',
            },
          },
        });
      }
    });
  }

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'READ_ONLY_DRY_RUN',
    generatedAt: new Date().toISOString(),
    total: candidates.length,
    changed: candidates.filter((candidate) => candidate.changed).length,
    unsupported: candidates.filter((candidate) => candidate.unsupported.length > 0),
    candidates: candidates.filter((candidate) => candidate.changed),
    idempotency: candidates.every((candidate) =>
      JSON.stringify(candidate.normalized) === JSON.stringify(normalizeCategories(candidate.normalized))),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
