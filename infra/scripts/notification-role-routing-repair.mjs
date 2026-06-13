import { PrismaClient } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const apply = process.argv.includes('--apply');
const limit = positiveIntegerArg('--limit=', 100);
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for notification role routing repair.');
}

const prisma = new PrismaClient();

try {
  const invalidEnabledDevices = await prisma.pushDevice.findMany({
    where: { enabled: true },
    orderBy: { lastSeenAt: 'desc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      role: true,
      platform: true,
      lastSeenAt: true,
      user: { select: { roles: true } },
    },
  });

  const candidates = invalidEnabledDevices
    .filter((device) => !device.user.roles.includes(device.role))
    .map((device) => ({
      pushDeviceId: device.id,
      userId: device.userId,
      pushDeviceRole: device.role,
      userRoles: device.user.roles,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
    }));

  let disabled = 0;
  if (apply && candidates.length > 0) {
    const result = await prisma.pushDevice.updateMany({
      where: {
        enabled: true,
        id: { in: candidates.map((candidate) => candidate.pushDeviceId) },
      },
      data: {
        enabled: false,
        lastSeenAt: new Date(),
      },
    });
    disabled = result.count;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: apply ? 'apply' : 'dry-run',
        envFile: { path: envPath, exists: envFileExists },
        scannedEnabledDevices: invalidEnabledDevices.length,
        candidateCount: candidates.length,
        disabled,
        candidates: candidates.slice(0, 25),
        nextActions:
          apply || candidates.length === 0
            ? ['Run npm.cmd run notifications:role-audit to confirm current enabled-device state.']
            : ['Run npm.cmd run notifications:role-repair -- --apply to disable these mismatched enabled devices.'],
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

function positiveIntegerArg(prefix, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${prefix}${raw} must be a positive integer.`);
  }
  return value;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
