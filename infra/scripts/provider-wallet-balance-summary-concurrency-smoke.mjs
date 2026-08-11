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
const runId = `provider_wallet_summary_concurrency_${randomUUID()}`;
const ids = {
  providerProfile: `${runId}_provider`,
  providerUser: `${runId}_user`,
};
const clients = Array.from(
  { length: 8 },
  () => new PrismaClient({ datasources: { db: { url: databaseUrl } } }),
);
const owner = clients[0];

assertLocalDatabase(databaseUrl);

try {
  await cleanup();
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

  const updates = initialEntries.slice(0, 8);
  const deletes = initialEntries.slice(8, 16);
  const replacements = Array.from({ length: 8 }, (_, index) => ({
    amount: -(index + 1) * 2_500,
    id: `${runId}_replacement_${index}`,
    sourceKey: `${runId}:replacement:${index}`,
  }));
  await Promise.all([
    runConcurrently(updates, (client, entry, index) =>
      client.providerWalletLedgerEntry.update({
        where: { id: entry.id },
        data: { amount: -(index + 1) * 1_500 },
      }),
    ),
    runConcurrently(deletes, (client, entry) =>
      client.providerWalletLedgerEntry.delete({ where: { id: entry.id } }),
    ),
    runConcurrently(replacements, (client, entry) =>
      client.providerWalletLedgerEntry.create({
        data: {
          amount: entry.amount,
          currency: 'VND',
          id: entry.id,
          metadata: { localSmoke: true, runId },
          notes: 'Concurrent summary smoke replacement entry.',
          providerProfileId: ids.providerProfile,
          sourceKey: entry.sourceKey,
          type: ProviderWalletLedgerType.ADMIN_ADJUSTMENT,
        },
      }),
    ),
  ]);
  const result = await assertSummaryMatchesLedger('mixed concurrent mutations');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          concurrentInsertSummary: true,
          mixedMutationSummary: true,
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
  await cleanup().catch((error) => {
    console.error(
      `Provider wallet summary concurrency smoke cleanup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  });
  await Promise.all(clients.map((client) => client.$disconnect()));
}

function runConcurrently(entries, operation) {
  return Promise.all(entries.map((entry, index) => operation(clients[index % clients.length], entry, index)));
}

async function assertSummaryMatchesLedger(stage) {
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

async function cleanup() {
  await owner.providerWalletLedgerEntry.deleteMany({
    where: { providerProfileId: ids.providerProfile },
  });
  const summaryCount = await owner.providerWalletBalanceSummary.count({
    where: { providerProfileId: ids.providerProfile },
  });
  assertCondition(summaryCount === 0, 'Summary remained after all ledger entries were deleted.');
  await owner.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await owner.user.deleteMany({ where: { id: ids.providerUser } });
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

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
