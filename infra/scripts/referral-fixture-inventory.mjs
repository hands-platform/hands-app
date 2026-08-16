import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

if (process.argv.includes('--apply')) {
  throw new Error('Referral fixture cleanup is dry-run only. Review the exact manifest before any separate cleanup approval.');
}

const envFile = process.env.HANDS_ENV_FILE ?? '.env';
const { env, envPath } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL is missing from ${envPath}.`);

const prisma = new PrismaClient();
const smoke = { path: ['smoke'], equals: 'referral-admin' };

try {
  const [codes, attributions, rewards, policies, policyAudit] = await Promise.all([
    prisma.referralCode.findMany({
      where: { metadata: smoke },
      orderBy: { createdAt: 'asc' },
      select: { id: true, audience: true, code: true, active: true, metadata: true, createdAt: true },
    }),
    prisma.referralAttribution.findMany({
      where: { OR: [{ metadata: smoke }, { referralCode: { metadata: smoke } }] },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        audience: true,
        referralCodeId: true,
        status: true,
        fraudReviewStatus: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.referralReward.findMany({
      where: {
        OR: [
          { metadata: smoke },
          { attribution: { OR: [{ metadata: smoke }, { referralCode: { metadata: smoke } }] } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        attributionId: true,
        sourceKey: true,
        amount: true,
        currency: true,
        status: true,
        metadata: true,
        qualifyingBookingId: true,
        walletLedgerReference: true,
        createdAt: true,
        customerWalletLedgerEntries: { select: { id: true, sourceKey: true } },
      },
    }),
    prisma.referralPolicy.findMany({
      orderBy: { audience: 'asc' },
      select: { id: true, audience: true, enabled: true, notes: true, metadata: true, updatedAt: true },
    }),
    prisma.adminAuditLog.findMany({
      where: { OR: [{ action: { contains: 'referral_policy' } }, { target: { contains: 'referral_policy' } }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, action: true, target: true, createdAt: true, metadata: true },
    }),
  ]);

  const providerLedgerEntries = rewards.length === 0
    ? []
    : await prisma.providerWalletLedgerEntry.findMany({
        where: { sourceKey: { in: rewards.map((reward) => `referral:wallet-credit:${reward.id}`) } },
        select: { id: true, sourceKey: true },
      });
  const providerLedgerBySource = new Map(providerLedgerEntries.map((entry) => [entry.sourceKey, entry.id]));
  const rewardRows = rewards.map((reward) => {
    const providerLedgerId = providerLedgerBySource.get(`referral:wallet-credit:${reward.id}`) ?? null;
    const hasLedger = Boolean(
      reward.walletLedgerReference || reward.customerWalletLedgerEntries.length > 0 || providerLedgerId,
    );
    return {
      ...reward,
      customerWalletLedgerEntries: reward.customerWalletLedgerEntries,
      providerWalletLedgerId: providerLedgerId,
      cleanupDisposition: hasLedger ? 'RETAIN_LEDGER_BEARING_FIXTURE' : 'REVIEW_EXACT_DELETE_CANDIDATE',
    };
  });
  const report = {
    mode: 'dry-run',
    generatedAt: new Date().toISOString(),
    cleanupApplied: false,
    policyRestoreApplied: false,
    summary: {
      codeCount: codes.length,
      attributionCount: attributions.length,
      rewardCount: rewardRows.length,
      ledgerBearingRewardCount: rewardRows.filter((reward) => reward.cleanupDisposition === 'RETAIN_LEDGER_BEARING_FIXTURE').length,
      totalRewardAmount: rewardRows.reduce((total, reward) => total + reward.amount, 0),
    },
    codes,
    attributions,
    rewards: rewardRows,
    policyReview: {
      current: policies,
      recentAudit: policyAudit,
      safeRestorePossible: false,
      reason: 'No original policy snapshot is available from the legacy smoke run. Automatic restore is unsafe.',
    },
  };
  const outputArg = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
  const outputPath = resolve(outputArg ?? `output/referral-fixture-inventory-${fileTimestamp(report.generatedAt)}.json`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ...report.summary, mode: report.mode, outputPath }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}

function fileTimestamp(value) {
  return value.replaceAll(':', '-').replaceAll('.', '-');
}
