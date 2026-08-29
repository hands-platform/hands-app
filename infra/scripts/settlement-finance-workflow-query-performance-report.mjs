import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { percentile } from './admin-api-read-budget.mjs';
import { summarizeGeneralLedgerPlan } from './general-ledger-query-performance-report.mjs';

const require = createRequire(import.meta.url);
const DEFAULT_SAMPLES = 20;
const TABLES = [
  'AccountingJournalBatch',
  'AccountingJournalEntry',
  'BookingSettlementReversalEntry',
  'BookingSettlementSnapshot',
];

export function parseSettlementFinancePerformanceArgs(argv) {
  const values = Object.fromEntries(
    argv
      .filter((value) => value.startsWith('--') && value.includes('='))
      .map((value) => value.slice(2).split(/=(.*)/s, 2)),
  );
  const scope = values.scope || 'all';
  if (!['all', 'coupon', 'reversal'].includes(scope)) {
    throw new Error('scope must be all, coupon, or reversal.');
  }
  return {
    allowLocal: argv.includes('--allow-local'),
    concurrentPair: argv.includes('--concurrent-pair'),
    output: values.output || null,
    samples: boundedInteger(values.samples, DEFAULT_SAMPLES, 20, 100),
    scope,
    skip: boundedInteger(values.skip, 0, 0, 1_000_000),
    statementTimeoutMs: boundedInteger(values['statement-timeout-ms'], 60_000, 1_000, 300_000),
    take: boundedInteger(values.take, 25, 1, 100),
  };
}

export function settlementFinancePerformanceTarget(databaseUrl, targetKind, allowLocal) {
  if (!databaseUrl) throw new Error('SETTLEMENT_FINANCE_PERF_DATABASE_URL is required.');
  if (!['anonymized-staging', 'local', 'read-replica'].includes(targetKind)) {
    throw new Error(
      'SETTLEMENT_FINANCE_PERF_TARGET_KIND must be read-replica, anonymized-staging, or local.',
    );
  }
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('SETTLEMENT_FINANCE_PERF_DATABASE_URL must be a PostgreSQL URL.');
  }
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname);
  if (isLocal && (!allowLocal || targetKind !== 'local')) {
    throw new Error(
      'Local measurement requires SETTLEMENT_FINANCE_PERF_TARGET_KIND=local and --allow-local.',
    );
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

export function settlementFinancePerformanceScenarios(scope = 'all') {
  const scenarios = [
    {
      name: 'reversal-integrity-needs-action',
      queryBuilder: 'reversal',
      options: {
        range: 'all',
        review: 'needs-action',
        sort: 'oldest',
        source: 'BOOKING_SETTLEMENT_REVERSAL',
      },
    },
    {
      name: 'reversal-integrity-all-records',
      queryBuilder: 'reversal',
      options: {
        range: 'all',
        review: 'all',
        sort: 'newest',
        source: 'BOOKING_SETTLEMENT_REVERSAL',
      },
    },
    {
      name: 'coupon-needs-action',
      queryBuilder: 'coupon',
      options: { range: 'all', review: 'needs-action', sort: 'oldest' },
    },
    {
      name: 'coupon-all-records',
      queryBuilder: 'coupon',
      options: { range: 'all', review: 'all', sort: 'newest' },
    },
    {
      name: 'coupon-reversed-corrected',
      queryBuilder: 'coupon',
      options: { range: 'all', review: 'reversed', sort: 'newest' },
    },
  ];
  return scope === 'all'
    ? scenarios
    : scenarios.filter((scenario) => scenario.queryBuilder === scope);
}

async function main() {
  const args = parseSettlementFinancePerformanceArgs(process.argv.slice(2));
  const databaseUrl = process.env.SETTLEMENT_FINANCE_PERF_DATABASE_URL?.trim();
  const targetKind = process.env.SETTLEMENT_FINANCE_PERF_TARGET_KIND?.trim();
  const target = settlementFinancePerformanceTarget(databaseUrl, targetKind, args.allowLocal);
  const outputPath = args.output ? safeOutputPath(args.output) : null;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const sourcePath = resolve('apps/api/src/admin/admin.service.ts');
    const distPath = resolve('apps/api/dist/admin/admin.service.js');
    const [sourceStat, distStat] = await Promise.all([stat(sourcePath), stat(distPath)]);
    if (distStat.mtimeMs < sourceStat.mtimeMs) {
      throw new Error('API dist is stale. Run the API build before this report.');
    }
    const source = require(distPath);
    const buildReversalQueries = source.adminAccountingJournalPerformanceQueries;
    const buildCouponQueries = source.adminCouponFinancePerformanceQueries;
    if (typeof buildReversalQueries !== 'function' || typeof buildCouponQueries !== 'function') {
      throw new Error('API dist is stale. Run the API build before this report.');
    }

    const database = await inspectDatabase(prisma, args.statementTimeoutMs);
    if (target.kind === 'read-replica' && !database.inRecovery) {
      throw new Error('The read-replica target is not in PostgreSQL recovery mode.');
    }

    const scenarios = [];
    for (const scenario of settlementFinancePerformanceScenarios(args.scope)) {
      const buildQueries = scenario.queryBuilder === 'reversal'
        ? buildReversalQueries
        : buildCouponQueries;
      const queries = buildQueries(scenario.options, args.take, args.skip);
      const results = [];
      for (const query of queries) {
        results.push(await measureQuery(prisma, query, args));
      }
      scenarios.push({
        name: scenario.name,
        queries: results,
        ...(args.concurrentPair && queries.length > 1
          ? { concurrentPair: await measureConcurrentQueries(prisma, queries, args) }
          : {}),
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
      target,
      scope: {
        concurrentPair: args.concurrentPair,
        samples: args.samples,
        scenarioScope: args.scope,
        skip: args.skip,
        statementTimeoutMs: args.statementTimeoutMs,
        take: args.take,
      },
      database,
      scenarios,
      limitations: [
        'p95 is client-observed sequential SQL latency for this target, not HTTP latency.',
        'EXPLAIN ANALYZE executes each SELECT once before its p95 samples.',
        'Samples are warm-cache observations; no cache flush is performed.',
        'No ANALYZE, schema change, index change, or data mutation is performed.',
        'The anonymized-staging target label is operator-declared and cannot be verified from SQL.',
        'Local results are diagnostics only and are not production-sized approval evidence.',
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

async function measureQuery(prisma, query, args) {
  return readOnlyTransaction(
    prisma,
    args.statementTimeoutMs,
    async (tx) => {
      const explainRows = await tx.$queryRawUnsafe(
        `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON) ${query.sql.text}`,
        ...query.sql.values,
      );
      const durations = [];
      for (let sample = 0; sample < args.samples; sample += 1) {
        const startedAt = performance.now();
        await tx.$queryRawUnsafe(query.sql.text, ...query.sql.values);
        durations.push(performance.now() - startedAt);
      }
      return {
        name: query.name,
        latencyMs: {
          max: rounded(Math.max(...durations)),
          median: rounded(percentile(durations, 0.5)),
          min: rounded(Math.min(...durations)),
          p95: rounded(percentile(durations, 0.95)),
          samples: durations.length,
        },
        plan: summarizeGeneralLedgerPlan(explainRows[0]?.['QUERY PLAN']),
      };
    },
    Math.max(300_000, args.statementTimeoutMs * (args.samples + 2)),
  );
}

async function measureConcurrentQueries(prisma, queries, args) {
  const pairDurations = [];
  const durationsByName = new Map(queries.map((query) => [query.name, []]));
  for (let sample = 0; sample < args.samples; sample += 1) {
    const pairStartedAt = performance.now();
    const durations = await Promise.all(
      queries.map((query) => readOnlyTransaction(
        prisma,
        args.statementTimeoutMs,
        async (tx) => {
          const startedAt = performance.now();
          await tx.$queryRawUnsafe(query.sql.text, ...query.sql.values);
          return performance.now() - startedAt;
        },
      )),
    );
    pairDurations.push(performance.now() - pairStartedAt);
    durations.forEach((duration, index) => durationsByName.get(queries[index].name).push(duration));
  }
  const latency = (durations) => ({
    max: rounded(Math.max(...durations)),
    median: rounded(percentile(durations, 0.5)),
    min: rounded(Math.min(...durations)),
    p95: rounded(percentile(durations, 0.95)),
    samples: durations.length,
  });
  return {
    latencyMs: latency(pairDurations),
    queries: queries.map((query) => ({
      name: query.name,
      latencyMs: latency(durationsByName.get(query.name)),
    })),
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
  if (pathFromRoot.startsWith('..') || candidate === outputRoot) {
    throw new Error('The report output must be a file under the repository output directory.');
  }
  return candidate;
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
