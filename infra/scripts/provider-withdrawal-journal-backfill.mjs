import {
  AccountingJournalSourceType,
  MonthlyTaxClosingStatus,
  PrismaClient,
  ProviderWalletLedgerType,
  ProviderWalletWithdrawalRequestStatus,
  Role,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  buildProviderWithdrawalBackfillCandidate,
  providerWithdrawalJournalCreateData,
  vietnamMonthlyPeriod,
} from './lib/provider-withdrawal-journal-backfill.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const actorId = process.argv.find((arg) => arg.startsWith('--actor-id='))?.slice('--actor-id='.length)?.trim();
const apply = process.argv.includes('--apply');
const { env } = loadMergedEnv(envFile);
const databaseUrl = requiredEnv('DATABASE_URL');
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

assertLocalDatabase(databaseUrl);

try {
  if (apply) {
    assertCondition(Boolean(actorId), '--actor-id=<admin-user-id> is required with --apply.');
    const actor = await prisma.user.findFirst({
      where: { id: actorId, roles: { has: Role.ADMIN } },
      select: { id: true },
    });
    assertCondition(Boolean(actor), 'Backfill actor must be an existing Admin user.');
  }

  const requests = await prisma.providerWalletWithdrawalRequest.findMany({
    where: { status: ProviderWalletWithdrawalRequestStatus.PAID },
    orderBy: { createdAt: 'asc' },
    include: { providerProfile: { select: { userId: true } } },
  });
  const requestIds = requests.map((request) => request.id);
  const journalRows = requestIds.length
    ? await prisma.accountingJournalBatch.findMany({
        where: {
          sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
          sourceId: { in: requestIds },
        },
        select: { sourceId: true, sourceKey: true },
      })
    : [];
  const walletSourceKeys = requestIds.map((id) => `partner-wallet-withdrawal:${id}:paid`);
  const walletRows = walletSourceKeys.length
    ? await prisma.providerWalletLedgerEntry.findMany({
        where: { sourceKey: { in: walletSourceKeys } },
        select: { sourceKey: true, amount: true, currency: true, type: true },
      })
    : [];
  const relevantUserIds = new Set();
  for (const request of requests) {
    relevantUserIds.add(request.providerProfile.userId);
    const metadata = record(request.metadata);
    const bankPayout = record(metadata.bankPayout);
    const paidAdminId = text(bankPayout.completedByAdminId) ?? text(request.reviewedByAdminId);
    if (paidAdminId) relevantUserIds.add(paidAdminId);
  }
  const existingUsers = relevantUserIds.size
    ? await prisma.user.findMany({ where: { id: { in: [...relevantUserIds] } }, select: { id: true } })
    : [];
  const existingUserIds = new Set(existingUsers.map((user) => user.id));
  const periods = new Set();
  for (const request of requests) {
    const lockPeriod = vietnamMonthlyPeriod(request.createdAt);
    if (lockPeriod) periods.add(lockPeriod);
    const metadata = record(request.metadata);
    const bankPayout = record(metadata.bankPayout);
    const paidPeriod = vietnamMonthlyPeriod(bankPayout.bankTransferDate ?? request.paidAt ?? request.reviewedAt);
    if (paidPeriod) periods.add(paidPeriod);
  }
  const closedRows = periods.size
    ? await prisma.monthlyTaxClosing.findMany({
        where: {
          period: { in: [...periods] },
          currency: 'VND',
          status: MonthlyTaxClosingStatus.CLOSED,
        },
        select: { period: true },
      })
    : [];
  const closedPeriods = new Set(closedRows.map((row) => row.period));
  const phasesByRequest = new Map();
  for (const journal of journalRows) {
    const phases = phasesByRequest.get(journal.sourceId) ?? new Set();
    if (journal.sourceKey.endsWith(':lock')) phases.add('lock');
    if (journal.sourceKey.endsWith(':paid')) phases.add('paid');
    phasesByRequest.set(journal.sourceId, phases);
  }
  const walletBySourceKey = new Map(walletRows.map((row) => [row.sourceKey, row]));
  const plans = requests.map((request) => {
    const metadata = record(request.metadata);
    const bankPayout = record(metadata.bankPayout);
    const completedByAdminId = text(bankPayout.completedByAdminId) ?? text(request.reviewedByAdminId);
    const wallet = walletBySourceKey.get(`partner-wallet-withdrawal:${request.id}:paid`);
    const candidate = buildProviderWithdrawalBackfillCandidate({
      request,
      existingPhases: phasesByRequest.get(request.id) ?? new Set(),
      closedPeriods,
      paidAdminExists: Boolean(completedByAdminId && existingUserIds.has(completedByAdminId)),
      providerUserExists: existingUserIds.has(request.providerProfile.userId),
      walletLedgerValid:
        wallet?.type === ProviderWalletLedgerType.PARTNER_WALLET_WITHDRAWAL_PAID &&
        wallet.amount === -request.amount &&
        wallet.currency === request.currency,
    });
    return { candidate, request };
  });
  const eligible = plans.filter((plan) => plan.candidate.eligible);
  const blocked = plans.filter(
    (plan) => plan.candidate.missingPhases.length > 0 && plan.candidate.blockers.length > 0,
  );
  const complete = plans.filter((plan) => plan.candidate.missingPhases.length === 0);
  const report = {
    apply,
    paidWithdrawals: requests.length,
    eligible: eligible.length,
    blocked: blocked.length,
    complete: complete.length,
    plannedJournalBatches: eligible.reduce((sum, plan) => sum + plan.candidate.missingPhases.length, 0),
    rows: plans.map(({ candidate, request }) => ({
      id: request.id,
      amount: request.amount,
      currency: request.currency,
      missingPhases: candidate.missingPhases,
      blockers: candidate.blockers,
      lockPeriod: candidate.lockPeriod,
      paidPeriod: candidate.paidPeriod,
      hasAttachment: candidate.hasAttachment,
    })),
  };

  if (!apply) {
    console.log(JSON.stringify({ ok: true, dryRun: true, report }, null, 2));
  } else {
    assertCondition(blocked.length === 0, 'Backfill is blocked. Resolve every listed evidence issue first.');
    const backfilledAt = new Date();
    for (const { candidate, request } of eligible) {
      await prisma.$transaction(async (tx) => {
        const createdJournalIds = [];
        for (const phase of candidate.missingPhases) {
          const lock = phase === 'LOCK';
          const journal = await tx.accountingJournalBatch.create({
            data: providerWithdrawalJournalCreateData({
              amount: request.amount,
              backfilledAt,
              backfilledByAdminId: actorId,
              createdById: lock ? request.providerProfile.userId : candidate.completedByAdminId,
              currency: request.currency,
              monthlyPeriod: lock ? candidate.lockPeriod : candidate.paidPeriod,
              phase,
              postedAt: lock ? request.createdAt : candidate.paidAt,
              providerProfileId: request.providerProfileId,
              requestId: request.id,
              transferRef: candidate.transferRef,
            }),
          });
          createdJournalIds.push(journal.id);
        }
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'accounting.provider_withdrawal_journal.backfill',
            target: `provider_wallet_withdrawal_request:${request.id}`,
            metadata: {
              amount: request.amount,
              currency: request.currency,
              createdJournalIds,
              phases: candidate.missingPhases,
              historicalBackfill: true,
            },
          },
        });
      });
    }

    const verification = await verifyBackfill(requestIds);
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: false,
          report,
          applied: { withdrawals: eligible.length, journalBatches: report.plannedJournalBatches },
          verification,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function verifyBackfill(requestIds) {
  const journals = await prisma.accountingJournalBatch.findMany({
    where: {
      sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
      sourceId: { in: requestIds },
    },
    include: { entries: true },
  });
  const invalid = journals.filter((journal) => {
    const debit = journal.entries.filter((entry) => entry.side === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0);
    const credit = journal.entries.filter((entry) => entry.side === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0);
    return debit !== credit || debit !== journal.totalDebit || credit !== journal.totalCredit;
  });
  const phaseKeys = new Set(journals.map((journal) => journal.sourceKey));
  const incomplete = requestIds.filter(
    (id) =>
      !phaseKeys.has(`accounting-journal:provider-withdrawal:${id}:lock`) ||
      !phaseKeys.has(`accounting-journal:provider-withdrawal:${id}:paid`),
  );
  assertCondition(invalid.length === 0, 'Backfilled Provider withdrawal journals are unbalanced.');
  assertCondition(incomplete.length === 0, 'Some paid Provider withdrawals still have incomplete journals.');
  return { balancedJournalBatches: journals.length, incompleteWithdrawals: incomplete.length };
}

function assertLocalDatabase(value) {
  const url = new URL(value);
  assertCondition(
    ['127.0.0.1', 'localhost', '::1'].includes(url.hostname),
    'Provider withdrawal journal backfill refuses a remote database.',
  );
  assertCondition(env.NODE_ENV !== 'production', 'Provider withdrawal journal backfill refuses production mode.');
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for Provider withdrawal journal backfill.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
