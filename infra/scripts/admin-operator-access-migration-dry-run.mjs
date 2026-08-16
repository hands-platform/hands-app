import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  PrismaClient,
  Role,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const { env } = loadMergedEnv();
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
const prisma = new PrismaClient();
const now = new Date();

try {
  const operatorWhere = { roles: { has: Role.ADMIN } };
  const [
    totalUsers,
    adminOperators,
    masterAdmins,
    financeApprovers,
    permissionRows,
    missingPermissionRows,
    credentials,
    activeAdminWebSessions,
    pendingInvitations,
    expiredInvitations,
    operatorRows,
    permissionValues,
    lifecycleActions,
    provenanceRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: operatorWhere }),
    prisma.user.count({ where: { ...operatorWhere, roles: { has: Role.MASTER_ADMIN } } }),
    prisma.user.count({ where: { ...operatorWhere, roles: { has: Role.FINANCE_APPROVER } } }),
    prisma.adminOperatorPermission.count(),
    prisma.user.count({ where: { ...operatorWhere, adminOperatorPermission: { is: null } } }),
    prisma.adminOperatorCredential.count(),
    prisma.adminWebSession.count({ where: { expiresAt: { gt: now }, revokedAt: null } }),
    prisma.adminOperatorInvitation.count({
      where: { acceptedAt: null, expiresAt: { gt: now }, revokedAt: null },
    }),
    prisma.adminOperatorInvitation.count({
      where: { acceptedAt: null, expiresAt: { lte: now }, revokedAt: null },
    }),
    prisma.user.findMany({
      where: operatorWhere,
      select: {
        adminOperatorPermission: { select: { categories: true } },
        adminUserProvenance: true,
        email: true,
        id: true,
      },
    }),
    prisma.adminOperatorPermission.findMany({ select: { categories: true, userId: true } }),
    prisma.adminAuditLog.groupBy({
      by: ['action'],
      where: { action: { startsWith: 'admin_operator.' } },
      _count: { _all: true },
      orderBy: { action: 'asc' },
    }),
    prisma.user.groupBy({
      by: ['adminUserProvenance'],
      where: operatorWhere,
      _count: { _all: true },
    }),
  ]);

  const normalizedEmailOwners = new Map();
  for (const row of operatorRows) {
    const normalizedEmail = row.email?.trim().toLowerCase();
    if (!normalizedEmail) continue;
    normalizedEmailOwners.set(normalizedEmail, [...(normalizedEmailOwners.get(normalizedEmail) ?? []), row.id]);
  }
  const duplicateNormalizedAdminEmails = [...normalizedEmailOwners.entries()]
    .filter(([, userIds]) => userIds.length > 1)
    .map(([email, userIds]) => ({ email, userIds }));
  const supportedPermissions = new Set(Object.values(AdminOperatorPermissionCategory));
  const unsupportedPermissions = permissionValues.flatMap((row) => row.categories
    .filter((category) => !supportedPermissions.has(category))
    .map((category) => ({ category, userId: row.userId })));

  const report = {
    mode: 'READ_ONLY_DRY_RUN',
    generatedAt: now.toISOString(),
    databaseTarget: sanitizedDatabaseTarget(env.DATABASE_URL),
    counts: {
      totalUsers,
      adminOperators,
      masterAdmins,
      financeApprovers,
      permissionRows,
      missingPermissionRows,
      explicitEmptyPermissionRows: operatorRows.filter((row) => row.adminOperatorPermission?.categories.length === 0).length,
      credentials,
      activeAdminWebSessions,
      pendingInvitations,
      expiredInvitations,
    },
    invariants: {
      hasMasterAdmin: masterAdmins > 0,
      duplicateNormalizedAdminEmails,
      unsupportedPermissions,
      suspendedWithActiveSession: 'Use the authenticated Operator Access directory for status/session correlation.',
    },
    migrationCandidates: operatorRows
      .filter((row) => !row.adminOperatorPermission)
      .map((row) => ({ id: row.id, provenance: row.adminUserProvenance })),
    provenance: Object.fromEntries(
      Object.values(AdminUserProvenance).map((value) => [
        value,
        provenanceRows.find((row) => row.adminUserProvenance === value)?._count._all ?? 0,
      ]),
    ),
    lifecycleActions: lifecycleActions.map((row) => ({ action: row.action, count: row._count._all })),
    nextAction: missingPermissionRows
      ? 'Review each migration candidate and assign explicit leaf permissions. This script intentionally performs no writes.'
      : 'No permission migration write is required.',
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}

function sanitizedDatabaseTarget(value) {
  if (!value) return 'DATABASE_URL_NOT_SET';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}:${url.port || 'default'}/${url.pathname.replace(/^\//u, '')}`;
  } catch {
    return 'DATABASE_URL_CONFIGURED';
  }
}
