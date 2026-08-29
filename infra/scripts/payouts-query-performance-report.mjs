import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { PayoutBatchStatus, PrismaClient } from '@prisma/client';

import { percentile } from './admin-api-read-budget.mjs';

const require = createRequire(import.meta.url);
const DEFAULT_SAMPLES = 20;
const TABLES = [
  'AccountingJournalBatch',
  'ProviderEarning',
  'ProviderPayoutBatch',
  'ProviderWalletLedgerEntry',
  'WithholdingLog',
];

export function parsePayoutsPerformanceArgs(argv) {
  const values = Object.fromEntries(
    argv
      .filter((value) => value.startsWith('--') && value.includes('='))
      .map((value) => value.slice(2).split(/=(.*)/s, 2)),
  );
  return {
    allowLocal: argv.includes('--allow-local'),
    output: values.output || null,
    samples: boundedInteger(values.samples, DEFAULT_SAMPLES, 20, 100),
    statementTimeoutMs: boundedInteger(values['statement-timeout-ms'], 60_000, 1_000, 300_000),
    take: boundedInteger(values.take, 20, 1, 100),
  };
}

export function payoutsPerformanceTarget(databaseUrl, targetKind, allowLocal) {
  if (!databaseUrl) throw new Error('PAYOUTS_PERF_DATABASE_URL is required.');
  if (!['anonymized-staging', 'local', 'read-replica'].includes(targetKind)) {
    throw new Error('PAYOUTS_PERF_TARGET_KIND must be read-replica, anonymized-staging, or local.');
  }
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('PAYOUTS_PERF_DATABASE_URL must be a PostgreSQL URL.');
  }
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname);
  if (isLocal && (!allowLocal || targetKind !== 'local')) {
    throw new Error('Local measurement requires PAYOUTS_PERF_TARGET_KIND=local and --allow-local.');
  }
  if (!isLocal && targetKind === 'local') {
    throw new Error('A remote target cannot be labeled local.');
  }
  return {
    fingerprint: createHash('sha256')
      .update(`${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`)
      .digest('hex')
      .slice(0, 12),
    isLocal,
    kind: targetKind,
  };
}

export function summarizePayoutsPlan(planDocument) {
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
    tempBlocks: nodes.reduce(
      (total, node) =>
        total + finiteNumber(node['Temp Read Blocks']) + finiteNumber(node['Temp Written Blocks']),
      0,
    ),
  };
}

async function main() {
  const args = parsePayoutsPerformanceArgs(process.argv.slice(2));
  const databaseUrl = process.env.PAYOUTS_PERF_DATABASE_URL?.trim();
  const targetKind = process.env.PAYOUTS_PERF_TARGET_KIND?.trim();
  const target = payoutsPerformanceTarget(databaseUrl, targetKind, args.allowLocal);
  const outputPath = args.output ? safeOutputPath(args.output) : null;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const sourcePath = resolve('apps/api/src/earnings/earnings.service.ts');
    const distPath = resolve('apps/api/dist/earnings/earnings.service.js');
    const [sourceStat, distStat] = await Promise.all([stat(sourcePath), stat(distPath)]);
    if (distStat.mtimeMs < sourceStat.mtimeMs) {
      throw new Error('API dist is stale. Run the API build before this report.');
    }
    const { EarningsService, payoutBatchRepairEvidenceSql } = require(distPath);
    if (typeof EarningsService !== 'function' || typeof payoutBatchRepairEvidenceSql !== 'function') {
      throw new Error('API dist is stale. Run the API build before this report.');
    }

    const database = await inspectDatabase(prisma, args.statementTimeoutMs);
    if (target.kind === 'read-replica' && !database.inRecovery) {
      throw new Error('The read-replica target is not in PostgreSQL recovery mode.');
    }

    const measurement = await readOnlyTransaction(
      prisma,
      args.statementTimeoutMs,
      async (tx) => {
        const candidates = await tx.providerPayoutBatch.findMany({
          where: { status: PayoutBatchStatus.PAID },
          orderBy: { id: 'asc' },
          select: { id: true },
        });
        if (candidates.length === 0) throw new Error('No PAID payout batches are available to measure.');
        const candidateIds = candidates.map((candidate) => candidate.id);
        const sql = payoutBatchRepairEvidenceSql(candidateIds);
        const explainRows = await tx.$queryRawUnsafe(
          `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON) ${sql.text}`,
          ...sql.values,
        );
        const service = new EarningsService(tx);
        return {
          candidateCount: candidateIds.length,
          classifier: {
            latencyMs: await sampleLatency(args.samples, () => tx.$queryRawUnsafe(sql.text, ...sql.values)),
            plan: summarizePayoutsPlan(explainRows[0]?.['QUERY PLAN']),
          },
          listLatencyMs: await sampleLatency(args.samples, () =>
            service.listPayoutBatchesForAdmin({ queue: 'repair', range: 'all', take: args.take, view: 'summary' }),
          ),
          summaryLatencyMs: await sampleLatency(args.samples, () =>
            service.payoutBatchSummaryForAdmin({ queue: 'repair', range: 'all' }),
          ),
        };
      },
      Math.max(600_000, args.statementTimeoutMs * (args.samples * 3 + 4)),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      target,
      scope: {
        samples: args.samples,
        statementTimeoutMs: args.statementTimeoutMs,
        take: args.take,
      },
      database,
      measurement,
      limitations: [
        'Service p95 is client-observed sequential read latency on this target, not HTTP latency.',
        'EXPLAIN ANALYZE executes the set-based classifier once before latency samples.',
        'No cache flush, ANALYZE, schema change, index change, or data mutation is performed.',
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
  return readOnlyTransaction(prisma, statementTimeoutMs, async (tx) => {
    const [identity] = await tx.$queryRawUnsafe(`
      SELECT
        current_setting('transaction_read_only')::boolean AS "transactionReadOnly",
        pg_is_in_recovery() AS "inRecovery",
        current_setting('server_version') AS "serverVersion",
        pg_database_size(current_database())::bigint AS "databaseBytes"
    `);
    const relations = await tx.$queryRawUnsafe(
      `
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
      `,
      TABLES,
    );
    return jsonSafe({
      databaseBytes: identity.databaseBytes,
      inRecovery: identity.inRecovery,
      relations,
      serverVersion: identity.serverVersion,
      transactionReadOnly: identity.transactionReadOnly,
    });
  });
}

async function sampleLatency(samples, action) {
  const durations = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const startedAt = performance.now();
    await action();
    durations.push(performance.now() - startedAt);
  }
  return {
    max: rounded(Math.max(...durations)),
    median: rounded(percentile(durations, 0.5)),
    min: rounded(Math.min(...durations)),
    p95: rounded(percentile(durations, 0.95)),
    samples: durations.length,
  };
}

async function readOnlyTransaction(prisma, statementTimeoutMs, action, timeout = 60_000) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${statementTimeoutMs}ms'`);
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '2000ms'`);
      return action(tx);
    },
    { maxWait: 5_000, timeout },
  );
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

function safeOutputPath(value) {
  const outputRoot = resolve(process.cwd(), 'output');
  const candidate = resolve(process.cwd(), value);
  const pathFromRoot = relative(outputRoot, candidate);
  if (pathFromRoot.startsWith('..') || resolve(candidate) === resolve(outputRoot)) {
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
  return JSON.parse(
    JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? item.toString() : item)),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
