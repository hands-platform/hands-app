import { Buffer } from 'node:buffer';
import { PrismaClient, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const { env } = loadMergedEnv();
const prisma = new PrismaClient();

try {
  const email = requiredEnv('ADMIN_WEB_LOGIN_EMAIL').trim().toLowerCase();
  const passwordHash = requiredEnv('ADMIN_WEB_LOGIN_PASSWORD_HASH');
  const passwordSalt = requiredEnv('ADMIN_WEB_LOGIN_PASSWORD_SALT');
  const userId = resolveBootstrapUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, roles: true },
  });
  if (!user?.roles.includes(Role.ADMIN) || !user.roles.includes(Role.MASTER_ADMIN)) {
    throw new Error('Bootstrap target must be an existing ADMIN and MASTER_ADMIN user.');
  }

  await prisma.$transaction(async (tx) => {
    const conflictingCredential = await tx.adminOperatorCredential.findUnique({
      where: { email },
      select: { userId: true },
    });
    if (conflictingCredential && conflictingCredential.userId !== user.id) {
      throw new Error('ADMIN_WEB_LOGIN_EMAIL is already assigned to another operator.');
    }

    await tx.user.update({
      where: { id: user.id },
      data: { email },
    });
    await tx.adminOperatorCredential.upsert({
      where: { userId: user.id },
      create: { email, passwordHash, passwordSalt, userId: user.id },
      update: { email, passwordHash, passwordSalt },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: user.id,
        action: 'ADMIN_OPERATOR_CREDENTIAL_BOOTSTRAPPED',
        target: user.id,
        metadata: { source: 'explicit-bootstrap-script' },
      },
    });
  });

  console.log(`Admin operator credential is ready for MASTER_ADMIN ${user.id}.`);
} finally {
  await prisma.$disconnect();
}

function requiredEnv(name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function resolveBootstrapUserId() {
  const explicitUserId = env.ADMIN_OPERATOR_BOOTSTRAP_USER_ID?.trim();
  if (explicitUserId) {
    return explicitUserId;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('ADMIN_OPERATOR_BOOTSTRAP_USER_ID is required in production.');
  }

  const legacyToken = env.ADMIN_ACCESS_TOKEN?.trim();
  const payloadSegment = legacyToken?.split('.')[1];
  if (!payloadSegment) {
    throw new Error('ADMIN_OPERATOR_BOOTSTRAP_USER_ID is required when no local legacy token is available.');
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new Error('missing subject');
    }
    return payload.sub;
  } catch {
    throw new Error('ADMIN_ACCESS_TOKEN does not contain a usable local bootstrap subject.');
  }
}
