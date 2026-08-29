import { createHash } from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { URL } from 'node:url';
import { resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const FIXTURE_PREFIX = 'notif-incident-perf-';

export function parseNotificationIncidentSeedArgs(argv) {
  const values = Object.fromEntries(
    argv.filter((value) => value.startsWith('--') && value.includes('='))
      .map((value) => value.slice(2).split(/=(.*)/s, 2)),
  );
  return {
    attemptsPerNotification: boundedInteger(values.attempts, 3, 3, 10),
    notificationCount: boundedInteger(values.notifications, 200_000, 10_000, 1_000_000),
    useLocalPerformanceClone: argv.includes('--use-local-performance-clone'),
  };
}

export function notificationIncidentSeedTarget(databaseUrl) {
  if (!databaseUrl) throw new Error('NOTIFICATION_INCIDENT_PERF_DATABASE_URL is required.');
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Notification incident performance seed requires a PostgreSQL URL.');
  }
  if (!['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname)) {
    throw new Error('Notification incident performance seed is restricted to local PostgreSQL.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!databaseName.startsWith('massage_vn_perf_')) {
    throw new Error('Notification incident performance seed requires a massage_vn_perf_* database.');
  }
  return {
    databaseName,
    fingerprint: createHash('sha256')
      .update(`${parsed.hostname}:${parsed.port || '5432'}/${databaseName}`)
      .digest('hex')
      .slice(0, 12),
  };
}

async function main() {
  const args = parseNotificationIncidentSeedArgs(process.argv.slice(2));
  const databaseUrl = performanceDatabaseUrl(args.useLocalPerformanceClone);
  const target = notificationIncidentSeedTarget(databaseUrl);
  const expectedDeliveryCount = args.notificationCount * args.attemptsPerNotification;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const [identity] = await prisma.$queryRawUnsafe(`
      SELECT current_database() AS "databaseName", pg_is_in_recovery() AS "inRecovery"
    `);
    if (identity.databaseName !== target.databaseName || identity.inRecovery) {
      throw new Error('Notification incident performance seed target identity is invalid.');
    }
    const before = await fixtureCounts(prisma);
    if (before.notifications > 0 || before.deliveries > 0) {
      if (before.notifications !== args.notificationCount || before.deliveries !== expectedDeliveryCount) {
        throw new Error(
          `Partial performance fixture exists: notifications=${before.notifications}, deliveries=${before.deliveries}.`,
        );
      }
      process.stdout.write(`${JSON.stringify({
        mode: 'ALREADY_SEEDED', target, notificationCount: before.notifications,
        deliveryCount: before.deliveries, attemptsPerNotification: args.attemptsPerNotification,
      }, null, 2)}\n`);
      return;
    }

    const [device] = await prisma.$queryRawUnsafe(`
      SELECT device.id, device."userId"
      FROM "PushDevice" device
      WHERE device.enabled = true
      ORDER BY device."lastSeenAt" DESC, device.id
      LIMIT 1
    `);
    if (!device) throw new Error('The isolated performance database has no enabled PushDevice fixture.');

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL statement_timeout = '0'`);
      await transaction.$executeRawUnsafe(`SET LOCAL lock_timeout = '2s'`);
      await transaction.$executeRawUnsafe(`SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'`);
      await transaction.$executeRawUnsafe(`SET LOCAL synchronous_commit = off`);
      await transaction.$executeRawUnsafe(`
        INSERT INTO "Notification" (id, "userId", type, title, body, data, "createdAt")
        SELECT
          '${FIXTURE_PREFIX}notification-' || LPAD(series::text, 8, '0'),
          $1,
          'notification.incident.performance',
          'Performance fixture',
          'PII-free notification incident capacity evidence.',
          jsonb_build_object(
            'dataScope', 'synthetic',
            'deliveryIntent', 'PUSH',
            'performanceFixture', 'notification-incident-v1'
          ),
          TIMESTAMPTZ '2026-01-01 00:00:00+07' + series * INTERVAL '1 second'
        FROM generate_series(1, $2::integer) AS series
      `, device.userId, args.notificationCount);
      await transaction.$executeRawUnsafe(`
        INSERT INTO "NotificationDelivery" (
          id, "notificationId", "pushDeviceId", provider, status, response, "attemptedAt"
        )
        SELECT
          '${FIXTURE_PREFIX}delivery-' || LPAD(series::text, 8, '0') || '-' || attempt::text,
          '${FIXTURE_PREFIX}notification-' || LPAD(series::text, 8, '0'),
          $1,
          'FCM_HTTP_V1',
          CASE WHEN attempt = $3::integer THEN 'FAILED' WHEN attempt = 2 THEN 'SUCCEEDED' ELSE 'FAILED' END,
          CASE
            WHEN attempt = $3::integer THEN jsonb_build_object('failureCode', 'PERF_INVALID_ARGUMENT')
            WHEN attempt = 2 THEN jsonb_build_object('providerMessageId', 'perf-success')
            ELSE jsonb_build_object('failureCode', 'PERF_OLDER_FAILURE')
          END,
          TIMESTAMPTZ '2026-01-01 00:00:00+07'
            + series * INTERVAL '1 second'
            + attempt * INTERVAL '100 milliseconds'
        FROM generate_series(1, $2::integer) AS series
        CROSS JOIN generate_series(1, $3::integer) AS attempt
      `, device.id, args.notificationCount, args.attemptsPerNotification);
    }, { timeout: 300_000 });

    await prisma.$executeRawUnsafe('ANALYZE "Notification"');
    await prisma.$executeRawUnsafe('ANALYZE "NotificationDelivery"');
    const after = await fixtureCounts(prisma);
    if (after.notifications !== args.notificationCount || after.deliveries !== expectedDeliveryCount) {
      throw new Error('Notification incident performance seed verification failed.');
    }
    process.stdout.write(`${JSON.stringify({
      mode: 'SEEDED', target, notificationCount: after.notifications,
      deliveryCount: after.deliveries, attemptsPerNotification: args.attemptsPerNotification,
    }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

async function fixtureCounts(prisma) {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::integer FROM "Notification" WHERE id LIKE '${FIXTURE_PREFIX}%') AS notifications,
      (SELECT COUNT(*)::integer FROM "NotificationDelivery" WHERE id LIKE '${FIXTURE_PREFIX}%') AS deliveries
  `);
  return row;
}

function performanceDatabaseUrl(useLocalPerformanceClone) {
  const explicit = process.env.NOTIFICATION_INCIDENT_PERF_DATABASE_URL?.trim();
  if (explicit) return explicit;
  if (!useLocalPerformanceClone) {
    throw new Error('Provide NOTIFICATION_INCIDENT_PERF_DATABASE_URL or --use-local-performance-clone.');
  }
  const { env } = loadMergedEnv('.env');
  const parsed = new URL(env.DATABASE_URL);
  parsed.pathname = '/massage_vn_perf_local';
  return parsed.toString();
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}; received ${value}.`);
  }
  return parsed;
}

const isDirectExecution = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
