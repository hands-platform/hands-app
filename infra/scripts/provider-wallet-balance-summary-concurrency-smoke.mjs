import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { PrismaClient, ProviderWalletLedgerType, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(resolve(repoRoot, envFile));
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const databaseUrl = requiredDatabaseUrl();
assertLocalDatabase(databaseUrl);

const runId = `provider_wallet_summary_concurrency_${randomUUID()}`;
const schema = `provider_wallet_concurrency_${randomUUID().replaceAll('-', '')}`;
const smokeDatabaseUrl = databaseUrlWithSchema(databaseUrl, schema);
const ids = {
  providerProfile: `${runId}_provider`,
  providerUser: `${runId}_user`,
};
const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
let clients = [];
let owner;

try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA ${quotedSchema(schema)}`);
  deployMigrations(smokeDatabaseUrl);
  clients = Array.from(
    { length: 8 },
    () => new PrismaClient({ datasources: { db: { url: smokeDatabaseUrl } } }),
  );
  owner = clients[0];

  await owner.user.create({
    data: {
      id: ids.providerUser,
      fullName: 'Provider Wallet Summary Concurrency Smoke',
      phone: `+84967${String(Date.now()).slice(-6)}`,
      roles: [Role.PROVIDER],
    },
  });
  await owner.providerProfile.create({
    data: {
      displayName: 'Provider Wallet Summary Concurrency Smoke',
      id: ids.providerProfile,
      userId: ids.providerUser,
    },
  });

  const initialEntries = Array.from({ length: 24 }, (_, index) => ({
    amount: (index + 1) * 1_000,
    id: `${runId}_initial_${index}`,
    sourceKey: `${runId}:initial:${index}`,
  }));
  await runConcurrently(initialEntries, (client, entry) =>
    client.providerWalletLedgerEntry.create({
      data: {
        amount: entry.amount,
        currency: 'VND',
        id: entry.id,
        metadata: { localSmoke: true, runId },
        notes: 'Concurrent summary smoke initial entry.',
        providerProfileId: ids.providerProfile,
        sourceKey: entry.sourceKey,
        type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
      },
    }),
  );
  await assertSummaryMatchesLedger('concurrent inserts');

  const reversals = initialEntries.slice(0, 8).map((entry, index) => ({
    amount: -entry.amount,
    id: `${runId}_reversal_${index}`,
    sourceKey: `${runId}:reversal:${index}`,
  }));
  const adjustments = Array.from({ length: 8 }, (_, index) => ({
    amount: -(index + 1) * 2_500,
    id: `${runId}_adjustment_${index}`,
    sourceKey: `${runId}:adjustment:${index}`,
  }));
  await Promise.all([
    runConcurrently(reversals, (client, entry) =>
      client.providerWalletLedgerEntry.create({
        data: {
          amount: entry.amount,
          currency: 'VND',
          id: entry.id,
          metadata: { localSmoke: true, reversal: true, runId },
          notes: 'Concurrent summary smoke compensating reversal entry.',
          providerProfileId: ids.providerProfile,
          sourceKey: entry.sourceKey,
          type: ProviderWalletLedgerType.REFUND_REVERSAL,
        },
      }),
    ),
    runConcurrently(adjustments, (client, entry) =>
      client.providerWalletLedgerEntry.create({
        data: {
          amount: entry.amount,
          currency: 'VND',
          id: entry.id,
          metadata: { localSmoke: true, runId },
          notes: 'Concurrent summary smoke append-only adjustment entry.',
          providerProfileId: ids.providerProfile,
          sourceKey: entry.sourceKey,
          type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
        },
      }),
    ),
  ]);
  const result = await assertSummaryMatchesLedger('concurrent append-only corrections');

  await assertAppendOnlyRejection(() =>
    owner.providerWalletLedgerEntry.update({
      where: { id: initialEntries[0].id },
      data: { amount: initialEntries[0].amount + 1 },
    }),
  );
  await assertAppendOnlyRejection(() =>
    owner.providerWalletLedgerEntry.delete({ where: { id: initialEntries[1].id } }),
  );
  await assertSummaryMatchesLedger('rejected mutable operations');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          concurrentInsertSummary: true,
          appendOnlyCorrectionSummary: true,
          updateRejected: true,
          deleteRejected: true,
          finalBalance: result.balance.toString(),
          finalEntryCount: result.entryCount,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await Promise.all(clients.map((client) => client.$disconnect()));
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${quotedSchema(schema)} CASCADE`).catch((error) => {
    console.error(
      `Provider wallet summary concurrency smoke schema cleanup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  });
  await admin.$disconnect();
}

function runConcurrently(entries, operation) {
  return Promise.all(entries.map((entry, index) => operation(clients[index % clients.length], entry, index)));
}

async function assertSummaryMatchesLedger(stage) {
  assertCondition(owner, 'Disposable Prisma client is not initialized.');
  const [summary, ledger] = await Promise.all([
    owner.providerWalletBalanceSummary.findUnique({
      where: {
        providerProfileId_currency: {
          currency: 'VND',
          providerProfileId: ids.providerProfile,
        },
      },
    }),
    owner.providerWalletLedgerEntry.aggregate({
      where: { currency: 'VND', providerProfileId: ids.providerProfile },
      _count: { _all: true },
      _max: { createdAt: true },
      _sum: { amount: true },
    }),
  ]);
  const balance = BigInt(ledger._sum.amount ?? 0);
  assertCondition(summary !== null, `Summary is missing after ${stage}.`);
  assertCondition(summary.balance === balance, `Summary balance diverged after ${stage}.`);
  assertCondition(summary.entryCount === ledger._count._all, `Summary entry count diverged after ${stage}.`);
  assertCondition(
    summary.lastEntryAt?.getTime() === ledger._max.createdAt?.getTime(),
    `Summary last-entry timestamp diverged after ${stage}.`,
  );
  return { balance, entryCount: ledger._count._all };
}

async function assertAppendOnlyRejection(operation) {
  try {
    await operation();
  } catch (error) {
    assertCondition(
      error instanceof Error && error.message.includes('append-only'),
      `Expected append-only database rejection, received ${error instanceof Error ? error.message : String(error)}.`,
    );
    return;
  }
  throw new Error('Expected append-only database rejection, but the mutation succeeded.');
}

function requiredDatabaseUrl() {
  const value = env.DATABASE_URL?.trim();
  assertCondition(Boolean(value), 'DATABASE_URL is required for provider wallet summary smoke.');
  return value;
}

function assertLocalDatabase(value) {
  assertCondition(
    env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'production',
    'Provider wallet summary concurrency smoke cannot run in production.',
  );
  const url = new URL(value);
  assertCondition(
    new Set(['127.0.0.1', 'localhost', '::1']).has(url.hostname),
    'Provider wallet summary concurrency smoke refuses remote databases.',
  );
}

function databaseUrlWithSchema(value, schemaName) {
  const url = new URL(value);
  url.searchParams.set('schema', schemaName);
  return url.toString();
}

function deployMigrations(targetDatabaseUrl) {
  const prismaCli = resolve(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');
  const schemaPath = resolve(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: targetDatabaseUrl },
  });
  if (result.status !== 0) {
    throw new Error(`Disposable schema migration failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

function quotedSchema(value) {
  assertCondition(
    /^provider_wallet_concurrency_[a-f0-9]{32}$/u.test(value),
    'Refusing to use a non-disposable provider wallet concurrency schema.',
  );
  return `"${value}"`;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
