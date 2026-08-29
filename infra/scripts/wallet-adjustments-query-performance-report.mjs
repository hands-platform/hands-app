import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, URL } from 'node:url';

import { ManualWalletAdjustmentRequestStatus, PrismaClient } from '@prisma/client';

import { percentile } from './admin-api-read-budget.mjs';

const require = createRequire(import.meta.url);
const CANDIDATE_LIMIT = 10_000;
const DEFAULT_SAMPLES = 20;
const P95_BUDGET_MS = 750;
const TABLES = [
  'CustomerProfile',
  'CustomerWalletLedgerEntry',
  'FileAsset',
  'ManualWalletAdjustmentRequest',
  'MonthlyTaxClosing',
  'ProviderProfile',
  'ProviderWalletLedgerEntry',
  'User',
];

export function parseWalletAdjustmentsPerformanceArgs(argv) {
  const values = Object.fromEntries(
    argv.filter((value) => value.startsWith('--') && value.includes('='))
      .map((value) => value.slice(2).split(/=(.*)/s, 2)),
  );
  return {
    allowLocal: argv.includes('--allow-local'),
    output: values.output || null,
    samples: boundedInteger(values.samples, DEFAULT_SAMPLES, 20, 100),
    statementTimeoutMs: boundedInteger(values['statement-timeout-ms'], 60_000, 1_000, 300_000),
  };
}

export function walletAdjustmentsPerformanceTarget(databaseUrl, targetKind, allowLocal) {
  if (!databaseUrl) throw new Error('WALLET_ADJUSTMENTS_PERF_DATABASE_URL is required.');
  if (!['anonymized-staging', 'local', 'read-replica'].includes(targetKind)) {
    throw new Error(
      'WALLET_ADJUSTMENTS_PERF_TARGET_KIND must be read-replica, anonymized-staging, or local.',
    );
  }
  const parsed = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('WALLET_ADJUSTMENTS_PERF_DATABASE_URL must be a PostgreSQL URL.');
  }
  const isLocal = ['127.0.0.1', '::1', 'localhost'].includes(parsed.hostname);
  if (isLocal && (!allowLocal || targetKind !== 'local')) {
    throw new Error(
      'Local measurement requires WALLET_ADJUSTMENTS_PERF_TARGET_KIND=local and --allow-local.',
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

export function summarizeWalletAdjustmentsPlan(planDocument) {
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
      (total, node) =>
        total + finiteNumber(node['Temp Read Blocks']) + finiteNumber(node['Temp Written Blocks']),
      0,
    ),
  };
}

export function walletAdjustmentsPerformanceDecision({ candidateCount, p95Ms, target }) {
  if (target.isLocal || candidateCount < CANDIDATE_LIMIT) {
    return {
      outcome: 'insufficient-production-sized-evidence',
      reason: `Decision requires a remote target with at least ${CANDIDATE_LIMIT} pending candidates.`,
    };
  }
  if (p95Ms > P95_BUDGET_MS) {
    return {
      outcome: 'approve-candidate-query-reduction',
      reason: `Hydration p95 ${p95Ms}ms exceeds the existing ${P95_BUDGET_MS}ms finance summary budget.`,
    };
  }
  return {
    outcome: 'retain-current-query-until-new-evidence',
    reason: `Hydration p95 ${p95Ms}ms is within the existing ${P95_BUDGET_MS}ms finance summary budget.`,
  };
}

async function main() {
  const args = parseWalletAdjustmentsPerformanceArgs(process.argv.slice(2));
  const databaseUrl = process.env.WALLET_ADJUSTMENTS_PERF_DATABASE_URL?.trim();
  const targetKind = process.env.WALLET_ADJUSTMENTS_PERF_TARGET_KIND?.trim();
  const target = walletAdjustmentsPerformanceTarget(databaseUrl, targetKind, args.allowLocal);
  const outputPath = args.output ? safeOutputPath(args.output) : null;
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: [{ emit: 'event', level: 'query' }],
  });
  let captureQueries = false;
  const queryTrace = [];
  prisma.$on('query', (event) => {
    if (captureQueries && /^\s*SELECT\b/i.test(event.query)) {
      queryTrace.push({
        durationMs: event.duration,
        params: revivePrismaParams(JSON.parse(event.params)),
        query: event.query,
      });
    }
  });

  try {
    const sourcePath = resolve('apps/api/src/admin/admin.service.ts');
    const distPath = resolve('apps/api/dist/admin/admin.service.js');
    const [sourceStat, distStat] = await Promise.all([stat(sourcePath), stat(distPath)]);
    if (distStat.mtimeMs < sourceStat.mtimeMs) {
      throw new Error('API dist is stale. Run the API build before this report.');
    }
    const preflight = require(distPath).manualWalletAdjustmentRequestPolicyPreflight;
    if (typeof preflight !== 'function') {
      throw new Error('API dist is stale. Run the API build before this report.');
    }

    const database = await inspectDatabase(prisma, args.statementTimeoutMs);
    if (target.kind === 'read-replica' && !database.inRecovery) {
      throw new Error('The read-replica target is not in PostgreSQL recovery mode.');
    }
    const totalPending = await readOnlyTransaction(prisma, args.statementTimeoutMs, (tx) =>
      tx.manualWalletAdjustmentRequest.count({
        where: { status: ManualWalletAdjustmentRequestStatus.REQUESTED },
      }),
    );

    const trace = await readOnlyTransaction(prisma, args.statementTimeoutMs, async (tx) => {
      captureQueries = true;
      try {
        return await hydratePendingRequests(tx, preflight);
      } finally {
        captureQueries = false;
      }
    });
    const plans = [];
    for (const [index, query] of queryTrace.entries()) {
      const explainRows = await readOnlyTransaction(prisma, args.statementTimeoutMs, (tx) =>
        tx.$queryRawUnsafe(
          `EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT JSON) ${query.query}`,
          ...query.params,
        ),
      );
      plans.push({
        name: queryName(query.query, index),
        observedDurationMs: query.durationMs,
        plan: summarizeWalletAdjustmentsPlan(explainRows[0]?.['QUERY PLAN']),
      });
    }
    const latencyMs = await sampleLatency(args.samples, () =>
      readOnlyTransaction(prisma, args.statementTimeoutMs, (tx) =>
        hydratePendingRequests(tx, preflight),
      ),
    );
    const decision = walletAdjustmentsPerformanceDecision({
      candidateCount: trace.candidateCount,
      p95Ms: latencyMs.p95,
      target,
    });
    const report = {
      generatedAt: new Date().toISOString(),
      target,
      scope: {
        candidateLimit: CANDIDATE_LIMIT,
        p95BudgetMs: P95_BUDGET_MS,
        samples: args.samples,
        statementTimeoutMs: args.statementTimeoutMs,
      },
      database,
      measurement: {
        totalPending,
        ...trace,
        fetchedPendingRowsPerBlockedPage: trace.candidateCount * 3,
        observedQueriesPerHydration: queryTrace.length,
        observedQueriesPerBlockedPage: queryTrace.length * 3 + 2,
        latencyMs,
        plans,
      },
      decision,
      limitations: [
        'p95 is client-observed read-only enrichment latency for one list/summary/workspace hydration, not HTTP latency.',
        'The current Blocked page runs three equivalent hydrations plus two count queries; endpoint calls may use separate pooled connections.',
        'EXPLAIN ANALYZE executes each captured SELECT once before latency samples.',
        'No cache flush, ANALYZE, schema change, index change, or data mutation is performed.',
      ],
    };
    const serialized = `${JSON.stringify(jsonSafe(report), null, 2)}\n`;
    if (outputPath) {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, serialized, 'utf8');
    }
    process.stdout.write(serialized);
  } finally {
    await prisma.$disconnect();
  }
}

async function hydratePendingRequests(tx, preflight) {
  const requests = await tx.manualWalletAdjustmentRequest.findMany({
    where: { status: ManualWalletAdjustmentRequestStatus.REQUESTED },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: CANDIDATE_LIMIT,
    include: {
      attachmentFile: {
        select: {
          id: true,
          contentType: true,
          originalName: true,
          reviewStatus: true,
          sizeBytes: true,
          uploadStatus: true,
          uploadedAt: true,
        },
      },
    },
  });
  const customerOwnerIds = unique(
    requests.filter((request) => request.ownerType === 'CUSTOMER').map((request) => request.ownerId),
  );
  const providerOwnerIds = unique(
    requests.filter((request) => request.ownerType === 'PARTNER').map((request) => request.ownerId),
  );
  const adminIds = unique(
    requests.flatMap((request) => [
      request.requestedByAdminId,
      request.approvedByAdminId,
      request.rejectedByAdminId,
    ]),
  );
  const periodKeys = unique(
    requests
      .filter((request) => request.monthlyPeriod)
      .map((request) => `${request.monthlyPeriod}:${request.currency}`),
  );
  const [admins, customers, providers, customerBalances, providerBalances, periods] =
    await Promise.all([
      adminIds.length
        ? tx.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, email: true, fullName: true },
          })
        : [],
      customerOwnerIds.length
        ? tx.customerProfile.findMany({
            where: { id: { in: customerOwnerIds } },
            select: { id: true, user: { select: { fullName: true, phone: true } } },
          })
        : [],
      providerOwnerIds.length
        ? tx.providerProfile.findMany({
            where: { id: { in: providerOwnerIds } },
            select: {
              displayName: true,
              id: true,
              user: { select: { fullName: true, phone: true } },
            },
          })
        : [],
      customerOwnerIds.length
        ? tx.customerWalletLedgerEntry.groupBy({
            by: ['customerProfileId', 'currency'],
            where: { customerProfileId: { in: customerOwnerIds } },
            _sum: { amount: true },
          })
        : [],
      providerOwnerIds.length
        ? tx.providerWalletLedgerEntry.groupBy({
            by: ['providerProfileId', 'currency'],
            where: { providerProfileId: { in: providerOwnerIds } },
            _sum: { amount: true },
          })
        : [],
      periodKeys.length
        ? tx.monthlyTaxClosing.findMany({
            where: {
              OR: periodKeys.map((key) => {
                const separator = key.lastIndexOf(':');
                return { period: key.slice(0, separator), currency: key.slice(separator + 1) };
              }),
            },
            select: { currency: true, period: true, status: true },
          })
        : [],
    ]);
  const balances = new Map([
    ...customerBalances.map((row) => [
      `CUSTOMER:${row.customerProfileId}:${row.currency}`,
      row._sum.amount ?? 0,
    ]),
    ...providerBalances.map((row) => [
      `PARTNER:${row.providerProfileId}:${row.currency}`,
      row._sum.amount ?? 0,
    ]),
  ]);
  const periodStatuses = new Map(
    periods.map((period) => [`${period.period}:${period.currency}`, period.status]),
  );
  let preflightBlockerCount = 0;
  for (const request of requests) {
    const result = preflight({
      actorCanApprove: false,
      actorId: 'read-only-performance-actor',
      adjustmentType: request.adjustmentType,
      affects: request.affects,
      attachmentFileId: request.attachmentFileId,
      attachmentUrl: request.attachmentUrl,
      currentBalance: balances.get(`${request.ownerType}:${request.ownerId}:${request.currency}`) ?? 0,
      direction: request.direction,
      monthlyPeriod: request.monthlyPeriod,
      monthlyPeriodStatus: request.monthlyPeriod
        ? (periodStatuses.get(`${request.monthlyPeriod}:${request.currency}`) ?? null)
        : null,
      ownerType: request.ownerType,
      requestedBeforeBalance: request.requestedBeforeBalance,
      requestedByAdminId: request.requestedByAdminId,
      requestedWalletDelta: request.requestedWalletDelta,
      requiresAttachment: request.requiresAttachment,
    });
    preflightBlockerCount += result.blockers.length;
  }
  return {
    adminCount: admins.length,
    candidateCount: requests.length,
    customerOwnerCount: customers.length,
    periodCount: periods.length,
    preflightBlockerCount,
    providerOwnerCount: providers.length,
  };
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

async function readOnlyTransaction(prisma, statementTimeoutMs, action, timeout = 300_000) {
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

function queryName(query, index) {
  const relation = TABLES.find((table) => query.includes(`"${table}"`));
  return `${String(index + 1).padStart(2, '0')}-${relation ?? 'select'}`;
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

function revivePrismaParams(value) {
  if (Array.isArray(value)) return value.map(revivePrismaParams);
  if (!value || typeof value !== 'object') return value;
  if (value.prisma__type === 'date') return new Date(value.prisma__value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revivePrismaParams(item)]));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
