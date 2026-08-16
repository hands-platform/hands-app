import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AdminUserProvenance,
  AdminOperatorPermissionCategory,
  AccountingJournalSourceType,
  ManualWalletAdjustmentRequestStatus,
  MonthlyTaxClosingStatus,
  PrismaClient,
  ProviderWalletLedgerType,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const port = Number.parseInt(env.MANUAL_WALLET_ADJUSTMENT_SMOKE_PORT ?? '3004', 10);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;
const apiEntry = resolve(repoRoot, 'apps', 'api', 'dist', 'main.js');
const runId = `manual_wallet_smoke_${randomUUID()}`;
const closedPeriod = `${8000 + (Date.now() % 1000)}-11`;
const openPeriod = `${8000 + (Date.now() % 1000)}-10`;
const ids = {
  maker: `${runId}_maker`,
  approver: `${runId}_approver`,
  customerUser: `${runId}_customer_user`,
  customerProfile: `${runId}_customer_profile`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  monthlyClosing: `${runId}_monthly_closing`,
  openMonthlyClosing: `${runId}_open_monthly_closing`,
};
const prisma = new PrismaClient({ datasources: { db: { url: requiredEnv('DATABASE_URL') } } });
const executedRequestIds = [];
let apiProcess;
let apiErrorTail = '';

assertLocalFixtureMode();
assertCondition(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid manual wallet smoke port.');
assertCondition(existsSync(apiEntry), 'API build is missing. Run the API build before manual wallet smoke.');

try {
  await assertPortIsFree();
  await cleanup();
  await seed();
  apiProcess = startApi();
  await waitForHealth();

  const makerToken = adminToken(ids.maker, [Role.ADMIN, Role.MASTER_ADMIN]);
  const approverToken = adminToken(ids.approver, [Role.ADMIN, Role.FINANCE_APPROVER]);

  const customerCompensation = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'CUSTOMER_COMPENSATION',
      amount: 10_000,
      direction: 'CREDIT',
      ownerId: ids.customerProfile,
      ownerType: 'CUSTOMER',
      reason: 'Local smoke customer compensation approval request.',
    },
    { beforeBalance: 0, afterBalance: 10_000, sameAdminGuard: true },
  );
  await assertStoredAdjustment(customerCompensation, { expectedBalance: 10_000 });

  const customerPromotion = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'PROMOTION_CREDIT',
      amount: 100_000,
      direction: 'CREDIT',
      ownerId: ids.customerProfile,
      ownerType: 'CUSTOMER',
      reason: 'Local smoke customer promotion credit.',
    },
    { beforeBalance: 10_000, afterBalance: 110_000, sameAdminGuard: true },
  );
  await assertStoredAdjustment(customerPromotion, { expectedBalance: 110_000 });

  const customerDebit = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'ERROR_CORRECTION',
      amount: 40_000,
      direction: 'DEBIT',
      ownerId: ids.customerProfile,
      ownerType: 'CUSTOMER',
      reason: 'Local smoke customer mistaken credit correction.',
    },
    { beforeBalance: 110_000, afterBalance: 70_000 },
  );
  await assertStoredAdjustment(customerDebit, { expectedBalance: 70_000 });

  const partnerCompensation = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'CUSTOMER_COMPENSATION',
      amount: 100_000,
      direction: 'CREDIT',
      ownerId: ids.providerProfile,
      ownerType: 'PARTNER',
      reason: 'Local smoke Partner compensation against negative wallet.',
    },
    { beforeBalance: -170_000, afterBalance: -70_000 },
  );
  assertCondition(
    partnerCompensation.preview.partnerReceivableDecrease === 100_000 &&
      partnerCompensation.preview.walletLiabilityIncrease === 0,
    'Partner credit did not reduce receivable before creating wallet liability.',
  );
  await assertStoredAdjustment(partnerCompensation, { expectedBalance: -70_000 });

  const partnerBonus = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'PARTNER_BONUS',
      amount: 200_000,
      direction: 'CREDIT',
      ownerId: ids.providerProfile,
      ownerType: 'PARTNER',
      reason: 'Local smoke Partner bonus crossing receivable into wallet liability.',
    },
    { beforeBalance: -70_000, afterBalance: 130_000 },
  );
  assertCondition(
    partnerBonus.preview.partnerReceivableDecrease === 70_000 &&
      partnerBonus.preview.walletLiabilityIncrease === 130_000,
    'Partner bonus did not split receivable recovery and wallet liability.',
  );
  await assertStoredAdjustment(partnerBonus, { expectedBalance: 130_000 });

  const partnerPenalty = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'PENALTY',
      amount: 200_000,
      direction: 'DEBIT',
      ownerId: ids.providerProfile,
      ownerType: 'PARTNER',
      reason: 'Local smoke Partner penalty crossing liability into receivable.',
    },
    { beforeBalance: 130_000, afterBalance: -70_000 },
  );
  assertCondition(
    partnerPenalty.preview.walletLiabilityDecrease === 130_000 &&
      partnerPenalty.preview.partnerReceivableIncrease === 70_000 &&
      partnerPenalty.preview.platformRevenueAmount === 0 &&
      partnerPenalty.preview.companyOutputVat === 0,
    'Partner penalty did not split liability and receivable without platform revenue or VAT.',
  );
  await assertStoredAdjustment(partnerPenalty, { expectedBalance: -70_000 });

  const rejected = await createRequest(makerToken, {
    adjustmentType: 'ERROR_CORRECTION',
    amount: 5_000,
    direction: 'CREDIT',
    ownerId: ids.providerProfile,
    ownerType: 'PARTNER',
    reason: 'Local smoke rejected adjustment.',
  });
  const rejectedResult = await request(`/admin/wallet-adjustment-requests/${rejected.id}/reject`, {
    body: { reason: 'Smoke rejection must not touch the wallet.' },
    method: 'POST',
    token: approverToken,
  });
  assertCondition(
    rejectedResult.status === ManualWalletAdjustmentRequestStatus.REJECTED &&
      (await manualAdjustmentLedgerCount(rejected.id)) === 0,
    'Rejected wallet adjustment created a ledger side effect.',
  );

  const highAmountBody = {
    adjustmentType: 'PARTNER_BONUS',
    amount: 10_000_000,
    direction: 'CREDIT',
    ownerId: ids.providerProfile,
    ownerType: 'PARTNER',
    monthlyPeriod: openPeriod,
    reason: 'Local smoke high amount attachment guard.',
  };
  const highAmountPreview = await request('/admin/wallet-adjustments/preview', {
    body: highAmountBody,
    method: 'POST',
    token: makerToken,
  });
  assertCondition(
    highAmountPreview.requiresAttachment === true,
    'High amount adjustment did not require evidence.',
  );
  await expectFailure('/admin/wallet-adjustment-requests', {
    body: highAmountBody,
    expectedStatus: 400,
    method: 'POST',
    token: makerToken,
  });

  await expectFailure('/admin/wallet-adjustments/preview', {
    body: {
      adjustmentType: 'ERROR_CORRECTION',
      amount: 10_000,
      direction: 'DEBIT',
      monthlyPeriod: closedPeriod,
      ownerId: ids.customerProfile,
      ownerType: 'CUSTOMER',
      reason: 'Local smoke closed-period direct edit must fail.',
    },
    expectedStatus: 400,
    method: 'POST',
    token: makerToken,
  });

  const reversibleCustomerPromotion = await executeApprovedAdjustment(
    makerToken,
    approverToken,
    {
      adjustmentType: 'PROMOTION_CREDIT',
      amount: 25_000,
      direction: 'CREDIT',
      ownerId: ids.customerProfile,
      ownerType: 'CUSTOMER',
      reason: 'Local smoke promotion that must be reversed exactly.',
    },
    { beforeBalance: 70_000, afterBalance: 95_000 },
  );
  await assertStoredAdjustment(reversibleCustomerPromotion, { expectedBalance: 95_000 });

  const reversalBody = {
    adjustmentType: 'MANUAL_REVERSAL',
    amount: reversibleCustomerPromotion.preview.amount,
    direction: 'DEBIT',
    ownerId: ids.customerProfile,
    ownerType: 'CUSTOMER',
    reason: 'Local smoke exact reversal of customer promotion.',
    reversalOfRequestId: reversibleCustomerPromotion.request.id,
  };
  await expectFailure('/admin/wallet-adjustments/preview', {
    body: { ...reversalBody, monthlyPeriod: closedPeriod },
    expectedStatus: 400,
    method: 'POST',
    token: makerToken,
  });
  await expectFailure('/admin/wallet-adjustments/preview', {
    body: { ...reversalBody, ownerId: ids.providerProfile, ownerType: 'PARTNER' },
    expectedStatus: 400,
    method: 'POST',
    token: makerToken,
  });

  const customerPromotionReversal = await executeApprovedAdjustment(makerToken, approverToken, reversalBody, {
    beforeBalance: 95_000,
    afterBalance: 70_000,
  });
  await assertStoredAdjustment(customerPromotionReversal, { expectedBalance: 70_000 });
  assertCondition(
    JSON.stringify(customerPromotionReversal.preview.accountingEntries) ===
      JSON.stringify(
        reversibleCustomerPromotion.preview.accountingEntries.map((entry) => ({
          accountCredit: entry.accountDebit,
          accountDebit: entry.accountCredit,
          amount: entry.amount,
        })),
      ),
    'Manual reversal did not persist the exact inverse of the original accounting entries.',
  );
  await expectFailure('/admin/wallet-adjustments/preview', {
    body: reversalBody,
    expectedStatus: 400,
    method: 'POST',
    token: makerToken,
  });

  const [customerBalance, partnerBalance, customerNotifications, listedCustomerRows, listedPartnerRows] =
    await Promise.all([
      walletBalance('CUSTOMER', ids.customerProfile),
      walletBalance('PARTNER', ids.providerProfile),
      prisma.notification.count({ where: { userId: ids.customerUser } }),
      request(
        `/admin/wallet-adjustments?ownerType=CUSTOMER&ownerId=${encodeURIComponent(ids.customerProfile)}&take=20`,
        { token: makerToken },
      ),
      request(
        `/admin/wallet-adjustments?ownerType=PARTNER&ownerId=${encodeURIComponent(ids.providerProfile)}&take=20`,
        { token: makerToken },
      ),
    ]);
  assertCondition(customerBalance === 70_000, 'Final customer wallet balance mismatch.');
  assertCondition(partnerBalance === -70_000, 'Final Partner wallet balance mismatch.');
  assertCondition(
    customerNotifications === 5,
    'Customer wallet adjustments did not create one notification each.',
  );
  assertCondition(
    listedCustomerRows.length === 5,
    'Customer adjustment history did not expose all executed rows.',
  );
  assertCondition(
    listedPartnerRows.length === 3,
    'Partner adjustment history did not expose all executed rows.',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          bankOrCashUntouched: true,
          closedPeriodDirectEditBlocked: true,
          customerAdjustmentRequiredDualApproval: true,
          customerFinalBalance: customerBalance,
          customerNotifications,
          dualApprovalApplied: true,
          duplicateApprovalBlocked: true,
          highAmountAttachmentRequired: true,
          journalsBalanced: true,
          manualReversalClosedTargetBlocked: true,
          manualReversalDuplicateBlocked: true,
          manualReversalExactAccounting: true,
          manualReversalOwnerMismatchBlocked: true,
          partnerFinalBalance: partnerBalance,
          partnerBalanceSummarySynchronized: true,
          partnerReceivableAndLiabilitySplit: true,
          rejectedRequestHasNoLedger: true,
          taxAndPlatformRevenueUntouched: true,
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
        apiError: apiErrorTail.trim() || undefined,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await stopApi();
  await cleanup().catch((error) => {
    console.error(
      `Manual wallet adjustment smoke cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
  await prisma.$disconnect();
}

function startApi() {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      API_PORT: String(port),
      NODE_ENV: 'development',
      REDIS_URL: env.REDIS_URL || 'redis://127.0.0.1:6379',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  child.stderr?.on('data', (chunk) => {
    apiErrorTail = `${apiErrorTail}${String(chunk)}`.slice(-5000);
  });
  return child;
}

async function stopApi() {
  if (!apiProcess || apiProcess.exitCode !== null) {
    return;
  }
  apiProcess.kill();
  await Promise.race([
    new Promise((resolveExit) => apiProcess.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3000)),
  ]);
}

async function assertPortIsFree() {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(500) });
    if (response) {
      throw new Error(`Port ${port} is already serving an API. Choose MANUAL_WALLET_ADJUSTMENT_SMOKE_PORT.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already serving')) {
      throw error;
    }
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (apiProcess?.exitCode !== null) {
      throw new Error('Manual wallet smoke API exited before becoming healthy.');
    }
    try {
      const response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        return;
      }
    } catch {
      // The isolated API is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error('Timed out waiting for the isolated manual wallet smoke API.');
}

async function seed() {
  await prisma.user.createMany({
    data: [
      {
        id: ids.maker,
        phone: smokePhone('01'),
        fullName: 'Manual Wallet Smoke Master',
        roles: [Role.ADMIN, Role.MASTER_ADMIN],
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'MANUAL_WALLET_SMOKE',
        fixtureRunId: runId,
      },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Manual Wallet Smoke Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'MANUAL_WALLET_SMOKE',
        fixtureRunId: runId,
      },
      {
        id: ids.customerUser,
        phone: smokePhone('03'),
        fullName: 'Manual Wallet Smoke Customer',
        roles: [Role.CUSTOMER],
      },
      {
        id: ids.providerUser,
        phone: smokePhone('04'),
        fullName: 'Manual Wallet Smoke Partner',
        roles: [Role.PROVIDER],
      },
    ],
  });
  await prisma.adminOperatorPermission.create({
    data: {
      userId: ids.approver,
      categories: [
        AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
        AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
      ],
    },
  });
  await prisma.customerProfile.create({ data: { id: ids.customerProfile, userId: ids.customerUser } });
  await prisma.providerProfile.create({
    data: { id: ids.providerProfile, userId: ids.providerUser, displayName: 'Manual Wallet Smoke Partner' },
  });
  await prisma.providerWalletLedgerEntry.create({
    data: {
      amount: -170_000,
      currency: 'VND',
      metadata: { localSmoke: true, runId },
      notes: 'Local smoke opening Partner receivable.',
      providerProfileId: ids.providerProfile,
      reference: runId,
      sourceKey: `${runId}:partner-opening-receivable`,
      type: ProviderWalletLedgerType.CASH_BOOKING_PLATFORM_FEE_DEDUCTED,
    },
  });
  await prisma.monthlyTaxClosing.create({
    data: {
      id: ids.monthlyClosing,
      closedAt: new Date(),
      closedById: ids.approver,
      createdById: ids.maker,
      currency: 'VND',
      notes: 'Local smoke immutable period.',
      period: closedPeriod,
      reviewedById: ids.approver,
      status: MonthlyTaxClosingStatus.CLOSED,
    },
  });
  await prisma.monthlyTaxClosing.create({
    data: {
      id: ids.openMonthlyClosing,
      createdById: ids.maker,
      currency: 'VND',
      notes: 'Local smoke open wallet adjustment period.',
      period: openPeriod,
      status: MonthlyTaxClosingStatus.DRAFT,
    },
  });
}

async function executeApprovedAdjustment(makerToken, approverToken, body, expected) {
  const requestBody = { ...body, monthlyPeriod: body.monthlyPeriod ?? openPeriod };
  const preview = await request('/admin/wallet-adjustments/preview', {
    body: requestBody,
    method: 'POST',
    token: makerToken,
  });
  assertCondition(
    preview.beforeBalance === expected.beforeBalance && preview.afterBalance === expected.afterBalance,
    `Adjustment preview balance mismatch for ${requestBody.adjustmentType}.`,
  );
  assertCondition(
    preview.affects.bankCash === false && preview.affects.taxPayable === false,
    'Preview touched bank/cash or tax payable.',
  );
  const created = await createRequest(makerToken, requestBody);
  const [makerQueue, approverQueue] = await Promise.all([
    request('/admin/finance-approval-queue?take=25', { token: makerToken }),
    request('/admin/finance-approval-queue?take=25', { token: approverToken }),
  ]);
  const makerQueueItem = makerQueue.walletAdjustmentRequests?.find((item) => item.id === created.id);
  const approverQueueItem = approverQueue.walletAdjustmentRequests?.find((item) => item.id === created.id);
  assertCondition(
    makerQueueItem?.preflight?.canApprove === false &&
      makerQueueItem.preflight.blockers.some((blocker) => blocker.code === 'MAKER_CANNOT_APPROVE'),
    `Maker queue did not expose the independent approval blocker for ${created.id}.`,
  );
  assertCondition(
    approverQueueItem?.preflight?.ready === true && approverQueueItem.preflight.canApprove === true,
    `Finance approver queue did not expose a ready wallet preflight for ${created.id}.`,
  );
  if (expected.sameAdminGuard) {
    await expectFailure(`/admin/wallet-adjustment-requests/${created.id}/approve`, {
      expectedStatus: 400,
      method: 'POST',
      token: makerToken,
    });
  }
  const result = await request(`/admin/wallet-adjustment-requests/${created.id}/approve`, {
    method: 'POST',
    token: approverToken,
  });
  executedRequestIds.push(created.id);
  await expectFailure(`/admin/wallet-adjustment-requests/${created.id}/approve`, {
    expectedStatus: 409,
    method: 'POST',
    token: approverToken,
  });
  return result;
}

function createRequest(token, body) {
  return request('/admin/wallet-adjustment-requests', { body, method: 'POST', token });
}

async function assertStoredAdjustment(result, { expectedBalance }) {
  const requestId = result.request.id;
  const adjustmentSourceKey = result.preview.reversalOfRequestId
    ? `manual-wallet-adjustment:reversal:${result.preview.reversalOfRequestId}`
    : `manual-wallet-adjustment:${result.preview.ownerType}:${result.preview.ownerId}:${requestId}`;
  const journal = await prisma.accountingJournalBatch.findUnique({
    where: { sourceKey: `accounting-journal:${adjustmentSourceKey}` },
    include: { entries: true },
  });
  const debit =
    journal?.entries
      .filter((entry) => entry.side === 'DEBIT')
      .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const credit =
    journal?.entries
      .filter((entry) => entry.side === 'CREDIT')
      .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const accountCodes = journal?.entries.map((entry) => entry.accountCode) ?? [];
  assertCondition(
    result.request.status === ManualWalletAdjustmentRequestStatus.EXECUTED &&
      result.ledger.amount === result.preview.walletDelta &&
      journal?.sourceType === AccountingJournalSourceType.MANUAL_WALLET_ADJUSTMENT &&
      debit > 0 &&
      debit === credit &&
      journal.totalDebit === journal.totalCredit &&
      !accountCodes.some((code) =>
        ['company_bank_cash', 'company_output_vat_payable', 'platform_fee_revenue'].includes(code),
      ),
    `Stored manual wallet adjustment ${requestId} is incomplete or unbalanced.`,
  );
  assertCondition(
    (await walletBalance(result.preview.ownerType, result.preview.ownerId)) === expectedBalance,
    `Stored wallet balance mismatch after ${requestId}.`,
  );
  if (result.preview.ownerType === 'PARTNER') {
    await assertProviderWalletBalanceSummary(result.preview.ownerId, expectedBalance, requestId);
  }
}

async function walletBalance(ownerType, ownerId) {
  const aggregate =
    ownerType === 'CUSTOMER'
      ? await prisma.customerWalletLedgerEntry.aggregate({
          where: { customerProfileId: ownerId },
          _sum: { amount: true },
        })
      : await prisma.providerWalletLedgerEntry.aggregate({
          where: { providerProfileId: ownerId },
          _sum: { amount: true },
        });
  return aggregate._sum.amount ?? 0;
}

async function assertProviderWalletBalanceSummary(providerProfileId, expectedBalance, requestId) {
  const [summary, ledger] = await Promise.all([
    prisma.providerWalletBalanceSummary.findUnique({
      where: { providerProfileId_currency: { providerProfileId, currency: 'VND' } },
    }),
    prisma.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId, currency: 'VND' },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  assertCondition(
    summary !== null &&
      summary.balance === BigInt(expectedBalance) &&
      summary.entryCount === ledger._count._all &&
      summary.lastEntryAt?.getTime() === ledger._max.createdAt?.getTime(),
    `Provider wallet balance summary mismatch after ${requestId}.`,
  );
}

function manualAdjustmentLedgerCount(requestId) {
  return Promise.all([
    prisma.customerWalletLedgerEntry.count({ where: { sourceKey: { endsWith: `:${requestId}` } } }),
    prisma.providerWalletLedgerEntry.count({ where: { sourceKey: { endsWith: `:${requestId}` } } }),
  ]).then(([customerCount, providerCount]) => customerCount + providerCount);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path.split('?')[0]} failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function expectFailure(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  assertCondition(
    response.status === options.expectedStatus,
    `Expected ${options.expectedStatus} from ${path}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function cleanup() {
  await prisma.notification.deleteMany({ where: { userId: { in: [ids.customerUser, ids.providerUser] } } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: [ids.maker, ids.approver] } } });
  await prisma.accountingJournalBatch.deleteMany({
    where: {
      sourceType: AccountingJournalSourceType.MANUAL_WALLET_ADJUSTMENT,
      OR: [{ customerProfileId: ids.customerProfile }, { providerProfileId: ids.providerProfile }],
    },
  });
  await prisma.manualWalletAdjustmentRequest.deleteMany({
    where: {
      OR: [
        { ownerType: 'CUSTOMER', ownerId: ids.customerProfile },
        { ownerType: 'PARTNER', ownerId: ids.providerProfile },
      ],
    },
  });
  await prisma.customerWalletLedgerEntry.deleteMany({ where: { customerProfileId: ids.customerProfile } });
  await prisma.providerWalletLedgerEntry.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.monthlyTaxClosing.deleteMany({ where: { id: { in: [ids.monthlyClosing, ids.openMonthlyClosing] } } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.maker, ids.approver, ids.customerUser, ids.providerUser] } },
  });
}

function adminToken(userId, roles) {
  return jwt.sign({ sub: userId, activeRole: Role.ADMIN, roles }, jwtAccessSecret(), { expiresIn: '10m' });
}

function jwtAccessSecret() {
  return env.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function assertLocalFixtureMode() {
  assertCondition(
    env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'production',
    'Manual wallet adjustment smoke cannot run in production.',
  );
  const databaseUrl = new URL(requiredEnv('DATABASE_URL'));
  const apiUrl = new URL(apiBaseUrl);
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  assertCondition(
    localHosts.has(databaseUrl.hostname) && localHosts.has(apiUrl.hostname),
    'Manual wallet adjustment smoke refuses remote targets.',
  );
}

function smokePhone(suffix) {
  return `+84966${String(Date.now()).slice(-5)}${suffix}`;
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for manual wallet adjustment smoke.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
