import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { percentile } from './admin-api-read-budget.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const require = createRequire(import.meta.url);
const DEFAULT_SAMPLES = 20;
const P95_BUDGET_MS = 1_000;
const AUTOMATIC_SYNC_P95_BUDGET_MS = 5_000;
const DESIGN_DELIVERY_ROWS = 600_000;
const DESIGN_MATCHING_ROWS = 200_000;
const TABLES = ['Notification', 'NotificationDelivery', 'PushDevice'];

export function parseNotificationIncidentPerformanceArgs(argv) {
  const values = Object.fromEntries(
    argv.filter((value) => value.startsWith('--') && value.includes('='))
      .map((value) => value.slice(2).split(/=(.*)/s, 2)),
  );
  return {
    allowLocal: argv.includes('--allow-local'),
    dataScope: values['data-scope'] || 'synthetic',
    failureCode: values['failure-code'] || 'PERF_INVALID_ARGUMENT',
    observedAfter: optionalDate(values['observed-after']),
    output: values.output || null,
    provider: values.provider || 'FCM_HTTP_V1',
    samples: boundedInteger(values.samples, DEFAULT_SAMPLES, 20, 100),
    statementTimeoutMs: boundedInteger(values['statement-timeout-ms'], 60_000, 1_000, 300_000),
    useLocalPerformanceClone: argv.includes('--use-local-performance-clone'),
  };
}

export function notificationIncidentPerformanceTarget(databaseUrl, targetKind, allowLocal) {
  if (!databaseUrl) throw new Error('NOTIFICATION_INCIDENT_PERF_DATABASE_URL is required.');
  if (!['anonymized-staging', 'local', 'read-replica'].includes(targetKind)) {
    throw new Error(
      'NOTIFICATION_INCIDENT_PERF_TARGET_KIND must be read-replica, anonymized-staging, or local.',
    );
  }
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('NOTIFICATION_INCIDENT_PERF_DATABASE_URL must be a PostgreSQL URL.');
  }
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname);
  if (isLocal && (!allowLocal || targetKind !== 'local')) {
    throw new Error('Local measurement requires target kind local and --allow-local.');
  }
  if (!isLocal && targetKind === 'local') throw new Error('A remote target cannot be labeled local.');
  return {
    fingerprint: createHash('sha256')
      .update(`${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`)
      .digest('hex')
      .slice(0, 12),
    isLocal,
    kind: targetKind,
  };
}

export function notificationIncidentPerformanceDecision({
  deliveryRows, matchingRows, p95Ms, syncP95Ms = p95Ms, syncTempBlocks = 0,
  targetKind, tempBlocks,
}) {
  if (targetKind === 'local' && (deliveryRows < DESIGN_DELIVERY_ROWS || matchingRows < DESIGN_MATCHING_ROWS)) {
    return {
      outcome: 'insufficient-design-volume-evidence',
      reason: `Local capacity gate requires ${DESIGN_DELIVERY_ROWS} deliveries and ${DESIGN_MATCHING_ROWS} matching rows.`,
    };
  }
  if (
    p95Ms > P95_BUDGET_MS
    || tempBlocks > 0
    || syncP95Ms > AUTOMATIC_SYNC_P95_BUDGET_MS
    || syncTempBlocks > 0
  ) {
    return {
      outcome: 'query-or-index-review-required',
      reason: `Operator p95 ${p95Ms}ms/temp ${tempBlocks}; automatic sync p95 ${syncP95Ms}ms/temp ${syncTempBlocks}.`,
    };
  }
  return {
    outcome: targetKind === 'local'
      ? 'design-volume-performance-gate-pass'
      : 'production-sized-performance-gate-pass',
    reason: `Operator p95 ${p95Ms}ms is within ${P95_BUDGET_MS}ms; automatic sync p95 ${syncP95Ms}ms is within ${AUTOMATIC_SYNC_P95_BUDGET_MS}ms; no temp spill.`,
  };
}

export function summarizeNotificationIncidentPlan(planDocument) {
  const document = Array.isArray(planDocument) ? planDocument[0] : planDocument;
  const nodes = flattenPlan(document?.Plan);
  return {
    executionTimeMs: finiteNumber(document?.['Execution Time']),
    indexScans: nodes
      .filter((node) => String(node['Node Type'] ?? '').includes('Index'))
      .map((node) => ({
        indexName: node['Index Name'] ?? null,
        loops: finiteNumber(node['Actual Loops']),
        relation: node['Relation Name'] ?? null,
      })),
    planningTimeMs: finiteNumber(document?.['Planning Time']),
    rootBuffers: bufferSummary(document?.Plan),
    sequentialScans: nodes
      .filter((node) => node['Node Type'] === 'Seq Scan')
      .map((node) => ({
        actualRows: finiteNumber(node['Actual Rows']),
        relation: node['Relation Name'] ?? null,
        rowsRemovedByFilter: finiteNumber(node['Rows Removed by Filter']),
      })),
    sortMethods: [...new Set(nodes.map((node) => node['Sort Method']).filter(Boolean))],
    tempBlocks: nodes.reduce(
      (total, node) => total + finiteNumber(node['Temp Read Blocks']) + finiteNumber(node['Temp Written Blocks']),
      0,
    ),
  };
}

async function main() {
  const args = parseNotificationIncidentPerformanceArgs(process.argv.slice(2));
  const configured = performanceConfiguration(args.useLocalPerformanceClone);
  const target = notificationIncidentPerformanceTarget(configured.databaseUrl, configured.targetKind, args.allowLocal);
  const outputPath = args.output ? safeOutputPath(args.output) : null;
  const prisma = new PrismaClient({ datasources: { db: { url: configured.databaseUrl } } });

  try {
    const sourcePath = resolve('apps/api/src/admin/admin-notification-delivery-incident.ts');
    const distPath = resolve('apps/api/dist/admin/admin-notification-delivery-incident.js');
    const [sourceStat, distStat] = await Promise.all([stat(sourcePath), stat(distPath)]);
    if (distStat.mtimeMs < sourceStat.mtimeMs) throw new Error('API dist is stale. Run the API build first.');
    const source = require(distPath);
    const buildQuery = source.notificationDeliveryIncidentFailureEvidenceSql;
    const buildAllGroupQuery = source.notificationDeliveryIncidentAllGroupEvidenceSql;
    if (typeof buildQuery !== 'function') throw new Error('API dist does not export the incident evidence SQL.');
    if (typeof buildAllGroupQuery !== 'function') {
      throw new Error('API dist does not export the all-group incident sync SQL.');
    }

    const database = await inspectDatabase(prisma, args.statementTimeoutMs);
    if (target.kind === 'read-replica' && !database.inRecovery) {
      throw new Error('The read-replica target is not in PostgreSQL recovery mode.');
    }
    const queries = [{
      name: 'current-failure-evidence',
      sql: buildQuery({ dataScope: args.dataScope, failureCode: args.failureCode, provider: args.provider }),
      workMem: '32MB',
    }];
    if (args.observedAfter) {
      queries.push({
        name: 'post-resolution-failure-evidence',
        sql: buildQuery(
          { dataScope: args.dataScope, failureCode: args.failureCode, provider: args.provider },
          args.observedAfter,
        ),
        workMem: '32MB',
      });
    }
    queries.push({
      name: 'automatic-all-group-sync-discovery',
      sql: buildAllGroupQuery({ groupLimit: 10, includeSynthetic: true }),
      workMem: '128MB',
    });
    const results = [];
    for (const query of queries) results.push(await measureQuery(prisma, query, args));
    const operatorResults = results.filter((result) => result.name !== 'automatic-all-group-sync-discovery');
    const syncResult = results.find((result) => result.name === 'automatic-all-group-sync-discovery');
    const worstP95 = Math.max(...operatorResults.map((result) => result.latencyMs.p95));
    const worstTempBlocks = Math.max(...operatorResults.map((result) => result.plan.tempBlocks));
    const matchingRows = Math.max(...results.map((result) => result.matchingRows));
    const decision = notificationIncidentPerformanceDecision({
      deliveryRows: database.exactRows.NotificationDelivery,
      matchingRows,
      p95Ms: worstP95,
      syncP95Ms: syncResult?.latencyMs.p95 ?? Number.POSITIVE_INFINITY,
      syncTempBlocks: syncResult?.plan.tempBlocks ?? Number.POSITIVE_INFINITY,
      targetKind: target.kind,
      tempBlocks: worstTempBlocks,
    });
    const report = {
      generatedAt: new Date().toISOString(),
      timeZone: 'Asia/Ho_Chi_Minh',
      target,
      scope: {
        dataScope: args.dataScope,
        failureCode: args.failureCode,
        observedAfter: args.observedAfter?.toISOString() ?? null,
        provider: args.provider,
        samples: args.samples,
        statementTimeoutMs: args.statementTimeoutMs,
      },
      budget: {
        source: 'Existing Admin notifications-summary p90 budget used as the combined evidence list+summary raw-SQL p95 ceiling.',
        p95Ms: P95_BUDGET_MS,
        automaticSyncP95Ms: AUTOMATIC_SYNC_P95_BUDGET_MS,
        designDeliveryRows: DESIGN_DELIVERY_ROWS,
        designMatchingRows: DESIGN_MATCHING_ROWS,
      },
      database,
      queries: results,
      decision,
      limitations: [
        'p95 is client-observed sequential read-only SQL latency, not HTTP latency.',
        'EXPLAIN ANALYZE executes each SELECT once before the p95 samples.',
        'No cache flush, ANALYZE, schema change, index change, incident mutation, Push send, or retry is performed.',
        'The operator evidence queries use transaction-local work_mem=32MB; the leased all-group background discovery uses 128MB. No global database setting changes.',
        target.kind === 'local'
          ? 'The isolated PII-free design-volume dataset is capacity evidence, not an anonymized production distribution.'
          : 'The target is expected to be an approved anonymized staging snapshot or read replica.',
      ],
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, 'utf8');
    }
    process.stdout.write(serialized);
  } finally {
    await prisma.$disconnect();
  }
}

async function inspectDatabase(prisma, statementTimeoutMs) {
  return readOnlyTransaction(prisma, statementTimeoutMs, async (transaction) => {
    const [identity] = await transaction.$queryRawUnsafe(`
      SELECT
        current_setting('transaction_read_only')::boolean AS "transactionReadOnly",
        pg_is_in_recovery() AS "inRecovery",
        current_setting('server_version') AS "serverVersion",
        pg_database_size(current_database())::bigint AS "databaseBytes"
    `);
    const relations = await transaction.$queryRawUnsafe(`
      SELECT
        relation.relname AS name,
        relation.reltuples::bigint AS "estimatedRows",
        pg_total_relation_size(relation.oid)::bigint AS "totalBytes",
        stats.last_analyze AS "lastAnalyze",
        stats.last_autoanalyze AS "lastAutoAnalyze"
      FROM pg_class relation
      LEFT JOIN pg_stat_user_tables stats ON stats.relid = relation.oid
      WHERE relation.relkind = 'r' AND relation.relname = ANY($1::text[])
      ORDER BY relation.relname
    `, TABLES);
    const [counts] = await transaction.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::integer FROM "Notification") AS "Notification",
        (SELECT COUNT(*)::integer FROM "NotificationDelivery") AS "NotificationDelivery",
        (SELECT COUNT(*)::integer FROM "PushDevice") AS "PushDevice"
    `);
    return jsonSafe({
      databaseBytes: identity.databaseBytes,
      exactRows: counts,
      inRecovery: identity.inRecovery,
      relations,
      serverVersion: identity.serverVersion,
      transactionReadOnly: identity.transactionReadOnly,
    });
  });
}

async function measureQuery(prisma, query, args) {
  return readOnlyTransaction(prisma, args.statementTimeoutMs, async (transaction) => {
    const explainRows = await transaction.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON) ${query.sql.text}`,
      ...query.sql.values,
    );
    const durations = [];
    let matchingRows = 0;
    let returnedRows = 0;
    for (let sample = 0; sample < args.samples; sample += 1) {
      const startedAt = performance.now();
      const rows = await transaction.$queryRawUnsafe(query.sql.text, ...query.sql.values);
      durations.push(performance.now() - startedAt);
      if (sample === 0) {
        returnedRows = rows.length;
        matchingRows = Number(rows[0]?.totalCount ?? 0);
      }
    }
    return {
      name: query.name,
      workMem: query.workMem,
      latencyMs: {
        max: rounded(Math.max(...durations)),
        median: rounded(percentile(durations, 0.5)),
        min: rounded(Math.min(...durations)),
        p95: rounded(percentile(durations, 0.95)),
        samples: durations.length,
      },
      matchingRows,
      returnedRows,
      plan: summarizeNotificationIncidentPlan(explainRows[0]?.['QUERY PLAN']),
    };
  }, Math.max(300_000, args.statementTimeoutMs * (args.samples + 2)), query.workMem);
}

async function readOnlyTransaction(prisma, statementTimeoutMs, action, timeout = 60_000, workMem = '32MB') {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await transaction.$executeRawUnsafe(`SET LOCAL work_mem = '${workMem}'`);
    await transaction.$executeRawUnsafe(`SET LOCAL statement_timeout = '${statementTimeoutMs}ms'`);
    await transaction.$executeRawUnsafe(`SET LOCAL lock_timeout = '2000ms'`);
    return action(transaction);
  }, { maxWait: 5_000, timeout });
}

function performanceConfiguration(useLocalPerformanceClone) {
  const explicit = process.env.NOTIFICATION_INCIDENT_PERF_DATABASE_URL?.trim();
  const explicitKind = process.env.NOTIFICATION_INCIDENT_PERF_TARGET_KIND?.trim();
  if (explicit || explicitKind) return { databaseUrl: explicit, targetKind: explicitKind };
  if (!useLocalPerformanceClone) {
    throw new Error('Provide Notification incident performance target variables or --use-local-performance-clone.');
  }
  const { env } = loadMergedEnv('.env');
  const parsed = new URL(env.DATABASE_URL);
  parsed.pathname = '/massage_vn_perf_local';
  return { databaseUrl: parsed.toString(), targetKind: 'local' };
}

function flattenPlan(root) {
  if (!root || typeof root !== 'object') return [];
  return [root, ...(root.Plans ?? []).flatMap(flattenPlan)];
}

function bufferSummary(node) {
  return {
    sharedHit: finiteNumber(node?.['Shared Hit Blocks']),
    sharedRead: finiteNumber(node?.['Shared Read Blocks']),
    tempRead: finiteNumber(node?.['Temp Read Blocks']),
    tempWritten: finiteNumber(node?.['Temp Written Blocks']),
  };
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}; received ${value}.`);
  }
  return parsed;
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid observed-after date: ${value}.`);
  return date;
}

function safeOutputPath(value) {
  const outputRoot = resolve(process.cwd(), 'output');
  const candidate = resolve(process.cwd(), value);
  const pathFromRoot = relative(outputRoot, candidate);
  if (pathFromRoot.startsWith('..') || candidate === outputRoot) {
    throw new Error('The report output must be a file under the repository output directory.');
  }
  return candidate;
}

function finiteNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item));
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
