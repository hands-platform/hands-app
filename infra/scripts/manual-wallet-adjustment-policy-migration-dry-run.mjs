import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import { ManualWalletAdjustmentRequestStatus, PrismaClient } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envPath } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL is missing from ${envPath}.`);
if (process.argv.some((arg) => arg === '--apply' || arg === '--write')) {
  throw new Error('This command is read-only. --apply and --write are not supported.');
}

const policyModulePath = resolve(
  repoRoot,
  'apps',
  'api',
  'dist',
  'wallet-adjustments',
  'manual-wallet-adjustment-policy.js',
);
if (!existsSync(policyModulePath)) {
  throw new Error('API build is missing. Run the API build before this dry-run.');
}

const {
  assertManualWalletAdjustmentCombinationAllowed,
  assertManualWalletAdjustmentPeriodOpen,
  ManualWalletAdjustmentPolicyError,
} = await import(pathToFileURL(policyModulePath).href);
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

try {
  const [requests, periods] = await Promise.all([
    prisma.manualWalletAdjustmentRequest.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        adjustmentType: true,
        affects: true,
        attachmentFileId: true,
        attachmentUrl: true,
        createdAt: true,
        direction: true,
        id: true,
        monthlyPeriod: true,
        ownerId: true,
        ownerType: true,
        requiresAttachment: true,
      },
      where: { status: ManualWalletAdjustmentRequestStatus.REQUESTED },
    }),
    prisma.monthlyTaxClosing.findMany({
      select: { currency: true, period: true, status: true },
      where: { currency: 'VND' },
    }),
  ]);
  const periodStatus = new Map(periods.map((row) => [row.period, row.status]));
  const rows = requests.map((request) => classifyRequest(request, periodStatus));
  const summary = rows.reduce(
    (result, row) => {
      result[row.proposedAction] += 1;
      for (const blocker of row.blockers) {
        result.blockers[blocker.code] = (result.blockers[blocker.code] ?? 0) + 1;
      }
      return result;
    },
    { CANCEL_AND_RECREATE: 0, KEEP: 0, blockers: {} },
  );

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    requestCount: rows.length,
    rows,
    summary,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}

function classifyRequest(request, periodStatus) {
  const blockers = [];
  try {
    assertManualWalletAdjustmentCombinationAllowed({
      adjustmentType: request.adjustmentType,
      direction: request.direction,
      ownerType: request.ownerType,
      reversalOfRequestId: reversalSourceId(request.affects),
    });
  } catch (error) {
    blockers.push({
      code: 'POLICY_MIGRATION_REQUIRED',
      message: policyErrorMessage(error, 'The request does not match the current adjustment policy.'),
    });
  }

  try {
    assertManualWalletAdjustmentPeriodOpen({
      monthlyPeriod: request.monthlyPeriod,
      monthlyPeriodStatus: request.monthlyPeriod ? periodStatus.get(request.monthlyPeriod) ?? null : null,
    });
  } catch (error) {
    blockers.push({
      code: error instanceof ManualWalletAdjustmentPolicyError
        ? error.code
        : 'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN',
      message: policyErrorMessage(error, 'The accounting month cannot accept manual wallet entries.'),
    });
  }

  if (request.requiresAttachment && !request.attachmentFileId && !request.attachmentUrl) {
    blockers.push({ code: 'ATTACHMENT_REQUIRED', message: 'Required adjustment evidence is missing.' });
  }

  return {
    adjustmentType: request.adjustmentType,
    blockers,
    createdAt: request.createdAt.toISOString(),
    direction: request.direction,
    id: request.id,
    monthlyPeriod: request.monthlyPeriod,
    ownerId: request.ownerId,
    ownerType: request.ownerType,
    proposedAction: blockers.length ? 'CANCEL_AND_RECREATE' : 'KEEP',
  };
}

function reversalSourceId(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  return typeof value.reversalOfRequestId === 'string' && value.reversalOfRequestId.trim()
    ? value.reversalOfRequestId.trim()
    : null;
}

function policyErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}
