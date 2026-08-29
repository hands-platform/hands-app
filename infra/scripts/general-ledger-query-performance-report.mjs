import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { percentile } from './admin-api-read-budget.mjs';

const require = createRequire(import.meta.url);
const DEFAULT_SAMPLES = 20;
const TABLES = [
  'AccountingJournalBatch',
  'AccountingJournalEntry',
  'BookingSettlementReversalEntry',
  'BookingSettlementSnapshot',
  'CustomerWalletLedgerEntry',
  'ProviderWalletLedgerEntry',
];

export function parseGeneralLedgerPerformanceArgs(argv) {
  const values = Object.fromEntries(
    argv
      .filter((value) => value.startsWith('--') && value.includes('='))
      .map((value) => value.slice(2).split(/=(.*)/s, 2)),
  );
  return {
    allowLocal: argv.includes('--allow-local'),
    output: values.output || null,
    samples: boundedInteger(values.samples, DEFAULT_SAMPLES, 20, 100),
    scenario: values.scenario || null,
    skip: boundedInteger(values.skip, 0, 0, 1_000_000),
    statementTimeoutMs: boundedInteger(values['statement-timeout-ms'], 60_000, 1_000, 300_000),
    take: boundedInteger(values.take, 10, 1, 100),
  };
}

export function generalLedgerPerformanceTarget(databaseUrl, targetKind, allowLocal) {
  if (!databaseUrl) throw new Error('GENERAL_LEDGER_PERF_DATABASE_URL is required.');
  if (!['anonymized-staging', 'local', 'read-replica'].includes(targetKind)) {
    throw new Error(
      'GENERAL_LEDGER_PERF_TARGET_KIND must be read-replica, anonymized-staging, or local.',
    );
  }
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('GENERAL_LEDGER_PERF_DATABASE_URL must be a PostgreSQL URL.');
  }
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname);
  if (isLocal && (!allowLocal || targetKind !== 'local')) {
    throw new Error(
      'Local measurement requires GENERAL_LEDGER_PERF_TARGET_KIND=local and --allow-local.',
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

export function generalLedgerPerformanceScenarios(representative = {}) {
  return [
    {
      name: 'needs-action-no-search',
      options: { range: 'all', review: 'needs-action', sort: 'oldest' },
    },
    {
      name: 'recent-30d-no-search',
      options: { range: '30d', review: 'all', sort: 'newest' },
    },
    {
      name: 'all-records-no-search',
      options: { range: 'all', review: 'all', sort: 'newest' },
    },
    ...(representative.batchId
      ? [{
          name: 'exact-id-search',
          options: { q: representative.batchId, range: 'all', review: 'all', sort: 'newest' },
        }]
      : []),
    ...(representative.accountCode
      ? [{
          name: 'account-search',
          options: { q: representative.accountCode, range: 'all', review: 'all', sort: 'newest' },
        }]
      : []),
  ];
}

export function summarizeGeneralLedgerPlan(planDocument) {
  const document = Array.isArray(planDocument) ? planDocument[0] : planDocument;
  const nodes = flattenPlan(document?.Plan);
  return {
    executionTimeMs: finiteNumber(document?.['Execution Time']),
    planningTimeMs: finiteNumber(document?.['Planning Time']),
    rootBuffers: bufferSummary(document?.Plan),
    settings: document?.Settings ?? {},
    nodes: nodes.map((node) => ({
      actualLoops: finiteNumber(node['Actual Loops']),
      actualRows: finiteNumber(node['Actual Rows']),
      indexName: node['Index Name'] ?? null,
      joinType: node['Join Type'] ?? null,
      nodeType: node['Node Type'] ?? null,
      planRows: finiteNumber(node['Plan Rows']),
      relation: node['Relation Name'] ?? null,
      rowsRemovedByFilter: finiteNumber(node['Rows Removed by Filter']),
      sharedHitBlocks: finiteNumber(node['Shared Hit Blocks']),
      sharedReadBlocks: finiteNumber(node['Shared Read Blocks']),
      sortMethod: node['Sort Method'] ?? null,
      tempReadBlocks: finiteNumber(node['Temp Read Blocks']),
      tempWrittenBlocks: finiteNumber(node['Temp Written Blocks']),
      workersLaunched: finiteNumber(node['Workers Launched']),
      workersPlanned: finiteNumber(node['Workers Planned']),
    })),
    tempBlocks: nodes.reduce(
      (total, node) =>
        total + finiteNumber(node['Temp Read Blocks']) + finiteNumber(node['Temp Written Blocks']),
      0,
    ),
  };
}

async function main() {
  const args = parseGeneralLedgerPerformanceArgs(process.argv.slice(2));
  const databaseUrl = process.env.GENERAL_LEDGER_PERF_DATABASE_URL?.trim();
  const targetKind = process.env.GENERAL_LEDGER_PERF_TARGET_KIND?.trim();
  const target = generalLedgerPerformanceTarget(databaseUrl, targetKind, args.allowLocal);
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
    const buildQueries = source.adminAccountingJournalPerformanceQueries;
    if (typeof buildQueries !== 'function') {
      throw new Error('API dist is stale. Run the API build before this report.');
    }

    const database = await inspectDatabase(prisma, args.statementTimeoutMs);
    if (target.kind === 'read-replica' && !database.inRecovery) {
      throw new Error('The read-replica target is not in PostgreSQL recovery mode.');
    }
    const representative = await selectRepresentativeSearches(prisma, args.statementTimeoutMs);
    const scenarioDefinitions = generalLedgerPerformanceScenarios(representative).filter(
      (scenario) => !args.scenario || scenario.name === args.scenario,
    );
    if (scenarioDefinitions.length === 0) {
      throw new Error(`Unknown General Ledger performance scenario: ${args.scenario}.`);
    }
    const scenarios = [];
    for (const scenario of scenarioDefinitions) {
      const queries = buildQueries(scenario.options, args.take, args.skip);
      const results = [];
      for (const query of queries) {
        results.push(await measureQuery(prisma, query, args));
      }
      scenarios.push({ name: scenario.name, queries: results });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
      target,
      scope: {
        samples: args.samples,
        scenario: args.scenario,
        skip: args.skip,
        statementTimeoutMs: args.statementTimeoutMs,
        take: args.take,
      },
      database,
      representativeSearches: {
        accountCodeAvailable: Boolean(representative.accountCode),
        batchIdAvailable: Boolean(representative.batchId),
        valuesRedacted: true,
      },
      scenarios,
      limitations: [
        'p95 is client-observed sequential SQL latency for this target, not HTTP latency.',
        'EXPLAIN ANALYZE executes each SELECT once before its p95 samples.',
        'Samples are warm-cache observations; no cache flush is performed.',
        'No ANALYZE, schema change, index change, or data mutation is performed.',
        'Search representatives are selected read-only and their values are omitted from this report.',
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

async function selectRepresentativeSearches(prisma, statementTimeoutMs) {
  return readOnlyTransaction(prisma, statementTimeoutMs, async (tx) => {
    const [batch, entry] = await Promise.all([
      tx.accountingJournalBatch.findFirst({ orderBy: { id: 'asc' }, select: { id: true } }),
      tx.accountingJournalEntry.findFirst({
        orderBy: { id: 'asc' },
        select: { accountCode: true },
        where: { accountCode: { not: '' } },
      }),
    ]);
    return { accountCode: entry?.accountCode ?? null, batchId: batch?.id ?? null };
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
