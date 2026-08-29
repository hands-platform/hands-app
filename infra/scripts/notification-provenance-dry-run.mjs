import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Prisma, PrismaClient } from '@prisma/client';

import {
  buildNotificationProvenanceDryRunReport,
  classifyNotificationProvenanceEvidence,
  notificationIdSetSha256,
  sanitizedDatabaseTarget,
} from './lib/notification-provenance-dry-run.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = argumentValue('--env') ?? '.env';
const outputPath = argumentValue('--out');
const beforeExportPath = argumentValue('--before-export');
const apply = process.argv.includes('--apply');
const confirm = argumentValue('--confirm');
const expectedCount = optionalIntegerArgument('--expected-count', 0, 500);
const expectedHash = argumentValue('--expected-hash');
const reason = argumentValue('--reason');
const sampleLimit = integerArgument('--sample-limit', 20, 1, 100);
const { env } = loadMergedEnv(envFile);
const databaseUrl = env.DATABASE_URL?.trim();

assertCondition(databaseUrl, 'DATABASE_URL is required for Notification provenance dry-run.');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  const startedAt = performance.now();
  const snapshot = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    await transaction.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '30s'`);
    await transaction.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '2s'`);

    const [transactionState] = await transaction.$queryRaw(Prisma.sql`
      SELECT
        current_setting('transaction_read_only') AS "transactionReadOnly",
        txid_current_snapshot()::text AS "snapshotId"
    `);
    const [scopeCounts] = await transaction.$queryRaw(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(notification.data->>'dataScope', '')) = 'production'
            AND NOT (
              LOWER(COALESCE(notification.data->>'dataScope', '')) = 'synthetic'
              OR LOWER(COALESCE(notification.data->>'smokeFixture', 'false')) = 'true'
              OR LOWER(COALESCE(notification.data->>'smoke', 'false')) = 'true'
              OR LOWER(COALESCE(notification.data->>'fixture', 'false')) = 'true'
            )
        )::bigint AS production,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(notification.data->>'dataScope', '')) = 'synthetic'
            OR LOWER(COALESCE(notification.data->>'smokeFixture', 'false')) = 'true'
            OR LOWER(COALESCE(notification.data->>'smoke', 'false')) = 'true'
            OR LOWER(COALESCE(notification.data->>'fixture', 'false')) = 'true'
        )::bigint AS synthetic,
        COUNT(*) FILTER (
          WHERE LOWER(COALESCE(notification.data->>'dataScope', '')) NOT IN ('production', 'synthetic')
            AND LOWER(COALESCE(notification.data->>'smokeFixture', 'false')) <> 'true'
            AND LOWER(COALESCE(notification.data->>'smoke', 'false')) <> 'true'
            AND LOWER(COALESCE(notification.data->>'fixture', 'false')) <> 'true'
        )::bigint AS unknown
      FROM "Notification" notification
    `);
    const rows = await transaction.$queryRaw(Prisma.sql`
      SELECT
        notification.id,
        notification.type,
        notification."createdAt",
        COALESCE(NULLIF(LOWER(notification.data->>'dataScope'), ''), '<missing>') AS "rawScope",
        notification.data ? 'dataScope' AS "dataScopePresent",
        notification.data->'dataScope' AS "originalDataScope",
        (
          recipient."fixtureKind" IS NOT NULL
          OR recipient."fixtureRunId" IS NOT NULL
          OR recipient."fixtureExpiresAt" IS NOT NULL
          OR recipient."adminUserProvenance"::text = 'FIXTURE'
        ) AS "recipientFixture",
        (
          booking.id IS NOT NULL
          AND (
            UPPER(COALESCE(booking.metadata->>'dataOrigin', '')) = 'SYNTHETIC'
            OR LOWER(COALESCE(booking.metadata->>'smokeFixture', 'false')) = 'true'
            OR booking.metadata->>'auditFixture' IS NOT NULL
          )
        ) AS "bookingMetadataSynthetic",
        (
          booking.id IS NOT NULL
          AND UPPER(COALESCE(booking.metadata->>'dataOrigin', '')) = 'PRODUCTION'
        ) AS "bookingMetadataProduction",
        (
          booking.id IS NOT NULL
          AND (
            customer_user."fixtureKind" IS NOT NULL
            OR customer_user."fixtureRunId" IS NOT NULL
            OR customer_user."fixtureExpiresAt" IS NOT NULL
            OR customer_user."adminUserProvenance"::text = 'FIXTURE'
            OR preferred_user."fixtureKind" IS NOT NULL
            OR preferred_user."fixtureRunId" IS NOT NULL
            OR preferred_user."fixtureExpiresAt" IS NOT NULL
            OR preferred_user."adminUserProvenance"::text = 'FIXTURE'
            OR selected_user."fixtureKind" IS NOT NULL
            OR selected_user."fixtureRunId" IS NOT NULL
            OR selected_user."fixtureExpiresAt" IS NOT NULL
            OR selected_user."adminUserProvenance"::text = 'FIXTURE'
          )
        ) AS "bookingOwnerFixture",
        notification.data->>'bookingId' IS NOT NULL AS "hasBookingId",
        booking.id IS NOT NULL AS "bookingFound"
      FROM "Notification" notification
      INNER JOIN "User" recipient ON recipient.id = notification."userId"
      LEFT JOIN "Booking" booking ON booking.id = notification.data->>'bookingId'
      LEFT JOIN "CustomerProfile" customer ON customer.id = booking."customerProfileId"
      LEFT JOIN "User" customer_user ON customer_user.id = customer."userId"
      LEFT JOIN "ProviderProfile" preferred ON preferred.id = booking."preferredProviderId"
      LEFT JOIN "User" preferred_user ON preferred_user.id = preferred."userId"
      LEFT JOIN "ProviderProfile" selected ON selected.id = booking."selectedProviderId"
      LEFT JOIN "User" selected_user ON selected_user.id = selected."userId"
      WHERE LOWER(COALESCE(notification.data->>'dataScope', '')) NOT IN ('production', 'synthetic')
        AND LOWER(COALESCE(notification.data->>'smokeFixture', 'false')) <> 'true'
        AND LOWER(COALESCE(notification.data->>'smoke', 'false')) <> 'true'
        AND LOWER(COALESCE(notification.data->>'fixture', 'false')) <> 'true'
      ORDER BY notification.id ASC
    `);

    return { rows, scopeCounts, ...transactionState };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 45_000 });

  const report = buildNotificationProvenanceDryRunReport({
    databaseTarget: sanitizedDatabaseTarget(databaseUrl),
    generatedAt: new Date().toISOString(),
    rows: snapshot.rows,
    sampleLimit,
    scopeCounts: Object.fromEntries(
      Object.entries(snapshot.scopeCounts).map(([key, value]) => [key, Number(value)]),
    ),
    snapshotId: snapshot.snapshotId,
    transactionReadOnly: snapshot.transactionReadOnly,
  });
  report.queryDurationMs = Math.round((performance.now() - startedAt) * 100) / 100;

  if (apply) {
    assertApplyArguments({ beforeExportPath, confirm, expectedCount, expectedHash, reason });
    assertApplyTarget(databaseUrl, env);
    const candidates = snapshot.rows
      .filter((row) => classifyNotificationProvenanceEvidence(row).classification === 'synthetic')
      .sort((left, right) => left.id.localeCompare(right.id));
    const candidateHash = notificationIdSetSha256(candidates);
    assertCondition(candidates.length === expectedCount,
      `Synthetic candidate count changed: expected ${expectedCount}, received ${candidates.length}.`);
    assertCondition(candidateHash === expectedHash,
      `Synthetic candidate hash changed: expected ${expectedHash}, received ${candidateHash}.`);

    const runId = `notification-provenance-${new Date().toISOString().replace(/[:.]/gu, '-')}-${candidateHash.slice(0, 12)}`;
    const resolvedBeforeExportPath = path.resolve(process.cwd(), beforeExportPath);
    await mkdir(path.dirname(resolvedBeforeExportPath), { recursive: true });
    await writeFile(resolvedBeforeExportPath, `${JSON.stringify({
      mode: 'ROLLBACK_BEFORE_EXPORT',
      policyVersion: report.policyVersion,
      generatedAt: new Date().toISOString(),
      timeZone: 'Asia/Ho_Chi_Minh',
      runId,
      scopeTransition: { before: 'unknown', after: 'synthetic' },
      candidateCount: candidates.length,
      candidateIdSetSha256: candidateHash,
      rows: candidates.map((row) => ({
        id: row.id,
        dataScopePresent: row.dataScopePresent,
        originalDataScope: row.originalDataScope,
      })),
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });

    const appliedCount = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '30s'`);
      await transaction.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '2s'`);
      const ids = candidates.length > 0
        ? Prisma.join(candidates.map((row) => row.id))
        : Prisma.sql`NULL`;
      const updated = await transaction.$executeRaw(Prisma.sql`
        UPDATE "Notification" notification
        SET data = jsonb_set(
          COALESCE(notification.data, '{}'::jsonb),
          '{dataScope}',
          '"synthetic"'::jsonb,
          true
        )
        WHERE notification.id IN (${ids})
          AND LOWER(COALESCE(notification.data->>'dataScope', '')) NOT IN ('production', 'synthetic')
          AND LOWER(COALESCE(notification.data->>'smokeFixture', 'false')) <> 'true'
          AND LOWER(COALESCE(notification.data->>'smoke', 'false')) <> 'true'
          AND LOWER(COALESCE(notification.data->>'fixture', 'false')) <> 'true'
      `);
      assertCondition(updated === candidates.length,
        `Backfill update count changed inside the transaction: expected ${candidates.length}, received ${updated}.`);
      await transaction.adminAuditLog.create({
        data: {
          eventId: runId,
          occurredAt: new Date(),
          recordedAt: new Date(),
          source: 'notification-provenance-backfill',
          actorType: 'SYSTEM',
          actorKey: 'notification-provenance-backfill-v1',
          actorLabelSnapshot: 'Approved notification provenance backfill',
          action: 'notification.provenance_backfill',
          target: `notification_provenance_backfill:${runId}`,
          objectType: 'NotificationBackfillRun',
          objectId: runId,
          objectLabelSnapshot: 'Explicit synthetic notification provenance',
          area: 'SYSTEM',
          severity: 'NOTICE',
          outcome: 'SUCCEEDED',
          tags: ['notification', 'provenance', 'backfill', 'synthetic'],
          payloadHash: candidateHash,
          metadata: {
            policyVersion: report.policyVersion,
            reason,
            candidateCount: candidates.length,
            candidateIdSetSha256: candidateHash,
            beforeExportPath: path.relative(process.cwd(), resolvedBeforeExportPath).replaceAll('\\', '/'),
            scopeTransition: { before: 'unknown', after: 'synthetic' },
            evidenceRules: report.evidenceRules.filter((rule) => rule.count > 0),
            productionCandidatesApplied: 0,
            conflictsApplied: 0,
          },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 45_000 });

    report.decision.syntheticCandidatesApprovedForApply = true;
    report.decision.nextAction = 'Re-run the read-only collector and verify that the applied candidate set is empty.';
    report.mode = 'APPLY_EXPLICIT_SYNTHETIC';
    report.apply = {
      runId,
      appliedCount,
      candidateIdSetSha256: candidateHash,
      beforeExportPath: resolvedBeforeExportPath,
      auditActorType: 'SYSTEM',
      productionCandidatesApplied: 0,
      conflictsApplied: 0,
    };
  }

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
    await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, serialized, 'utf8');
  }
  process.stdout.write(serialized);
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function argumentValue(name) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)?.trim();
}

function integerArgument(name, fallback, minimum, maximum) {
  const value = argumentValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  assertCondition(
    Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum,
    `${name} must be an integer from ${minimum} to ${maximum}.`,
  );
  return parsed;
}

function optionalIntegerArgument(name, minimum, maximum) {
  const value = argumentValue(name);
  if (!value) return null;
  const parsed = Number(value);
  assertCondition(
    Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum,
    `${name} must be an integer from ${minimum} to ${maximum}.`,
  );
  return parsed;
}

function assertApplyArguments({ beforeExportPath: exportPath, confirm: confirmation, expectedCount: count, expectedHash: hash, reason: operatorReason }) {
  assertCondition(
    confirmation === 'CLASSIFY_EXPLICIT_SYNTHETIC_NOTIFICATION_PROVENANCE',
    'Apply requires --confirm=CLASSIFY_EXPLICIT_SYNTHETIC_NOTIFICATION_PROVENANCE.',
  );
  assertCondition(exportPath, 'Apply requires --before-export=<path>.');
  assertCondition(count !== null, 'Apply requires --expected-count=<dry-run count>.');
  assertCondition(/^[a-f0-9]{64}$/u.test(hash ?? ''), 'Apply requires --expected-hash=<dry-run SHA-256>.');
  assertCondition(operatorReason?.length >= 20, 'Apply requires --reason with at least 20 characters.');
}

function assertApplyTarget(value, environment) {
  const database = new URL(value);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(database.hostname);
  if (local && environment.NODE_ENV !== 'production') return;
  assertCondition(
    environment.NOTIFICATION_PROVENANCE_BACKFILL_REMOTE_CONFIRM ===
      'CLASSIFY_EXPLICIT_SYNTHETIC_NOTIFICATION_PROVENANCE',
    'Remote or production apply requires NOTIFICATION_PROVENANCE_BACKFILL_REMOTE_CONFIRM.',
  );
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
