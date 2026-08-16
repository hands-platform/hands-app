import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AdminUserProvenance,
  AdminOperatorPermissionCategory,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  BookingStatus,
  CompanyBankTransactionType,
  EarningStatus,
  PayoutBatchStatus,
  PrismaClient,
  ProviderAgreementType,
  ProviderBankAccountStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { runAdminWebDirectSmoke } from './lib/admin-web-direct-smoke.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const port = Number.parseInt(env.PROVIDER_PAYOUT_REVERSAL_SMOKE_PORT ?? '3005', 10);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;
const runningApiBaseUrl = env.ADMIN_API_BASE_URL ?? 'http://127.0.0.1:3000/api';
const apiEntry = resolve(repoRoot, 'apps', 'api', 'dist', 'main.js');
const adminEvidenceMode = process.argv.includes('--admin-evidence');
const runId = `provider_payout_reversal_${Date.now()}`;
const grossAmount = 500_000;
const platformFee = 50_000;
const withholdingAmount = 20_000;
const netAmount = grossAmount - platformFee - withholdingAmount;
const ids = {
  actor: `${runId}_actor`,
  approver: `${runId}_approver`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  providerBankAccount: `${runId}_provider_bank_account`,
  companyBankAccount: `${runId}_company_bank_account`,
  customerUser: `${runId}_customer_user`,
  customerProfile: `${runId}_customer_profile`,
  booking: `${runId}_booking`,
  earning: `${runId}_earning`,
  providerTaxLog: `${runId}_provider_tax_log`,
  openingWalletLedger: `${runId}_opening_wallet_ledger`,
};
const providerDisplayName = `Payout Reversal Smoke ${String(Date.now()).slice(-6)}`;
const prisma = new PrismaClient({ datasources: { db: { url: requiredEnv('DATABASE_URL') } } });
let apiProcess;
let apiErrorTail = '';
let payoutBatchId;
let paidBankTransactionId;
let returnBankTransactionId;

assertLocalFixtureMode();
assertCondition(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid payout reversal smoke port.');
assertCondition(existsSync(apiEntry), 'API build is missing. Run the API build before payout reversal smoke.');

try {
  await assertPortIsFree();
  await cleanup();
  await seed();
  apiProcess = startApi();
  await waitForHealth();

  const actorToken = adminToken(ids.actor, [Role.ADMIN]);
  const approverToken = adminToken(ids.approver, [Role.ADMIN, Role.FINANCE_APPROVER]);
  const monthlyPeriod = vietnamMonthlyPeriod(new Date());
  const monthlyClosingBaseline = await request(
    `/admin/monthly-tax-closings/summary?period=${encodeURIComponent(monthlyPeriod)}`,
    { token: actorToken },
  );
  const transferRef = `LOCAL-PAYOUT-${Date.now()}`;
  const created = await request('/admin/payout-batches', {
    method: 'POST',
    token: actorToken,
    body: {
      providerProfileId: ids.providerProfile,
      transferRef,
      notes: 'Local payout reversal lifecycle smoke.',
    },
  });
  payoutBatchId = created.id;
  assertCondition(
    created.status === PayoutBatchStatus.DRAFT &&
      created.totalNetAmount === netAmount &&
      created.earnings?.length === 1 &&
      created.withholdingLogs?.length === 1 &&
      created.withholdingLogs[0]?.status === 'PENDING',
    'Payout batch did not capture the eligible earning and withholding evidence.',
  );

  const processing = await request(`/admin/payout-batches/${payoutBatchId}`, {
    method: 'PATCH',
    token: actorToken,
    body: {
      status: PayoutBatchStatus.PROCESSING,
      transferRef,
      notes: 'Bank transfer is being processed.',
    },
  });
  assertCondition(
    processing.status === PayoutBatchStatus.PROCESSING,
    'Payout batch did not enter PROCESSING.',
  );

  const paidRequestBody = {
    status: PayoutBatchStatus.PAID,
  };
  await expectRequestFailure(
    `/admin/payout-batches/${payoutBatchId}`,
    { method: 'PATCH', token: actorToken, body: paidRequestBody },
    'Payout paid closeout accepted the maker as its own approver.',
  );
  const paid = await request(`/admin/payout-batches/${payoutBatchId}`, {
    method: 'PATCH',
    token: approverToken,
    body: paidRequestBody,
  });
  assertCondition(
    paid.status === PayoutBatchStatus.PAID &&
      paid.earnings?.every((earning) => earning.status === EarningStatus.PAID) &&
      paid.withholdingLogs?.every((log) => log.status === 'PAID'),
    'Payout paid closeout did not settle earning and withholding records.',
  );

  await expectRequestFailure(
    `/admin/payout-batches/${payoutBatchId}`,
    { method: 'PATCH', token: approverToken, body: paidRequestBody },
    'Repeated payout paid closeout was not rejected.',
  );
  const [paidJournal, paidLedger, paidLedgerCount, paidJournalCount, walletBalanceAfterPaid] =
    await Promise.all([
      payoutJournal('paid'),
      prisma.providerWalletLedgerEntry.findFirst({
        where: {
          payoutBatchId,
          type: ProviderWalletLedgerType.PAYOUT_PAID,
        },
      }),
      prisma.providerWalletLedgerEntry.count({
        where: {
          payoutBatchId,
          type: ProviderWalletLedgerType.PAYOUT_PAID,
        },
      }),
      prisma.accountingJournalBatch.count({
        where: {
          sourceKey: `accounting-journal:provider-payout-batch:${payoutBatchId}:paid`,
        },
      }),
      providerWalletBalance(),
    ]);
  assertPaidJournal(paidJournal);
  assertCondition(
    paidLedger?.amount === -netAmount &&
      paidLedgerCount === 1 &&
      paidJournalCount === 1 &&
      walletBalanceAfterPaid === 0,
    'Repeated payout paid closeout created duplicate evidence or an incorrect wallet balance.',
  );
  const paidBankCashEntry = paidJournal.entries.find(
    (entry) => entry.side === 'CREDIT' && entry.accountCode === 'company_bank_cash',
  );
  assertCondition(Boolean(paidBankCashEntry), 'Payout paid journal has no company bank cash credit.');

  const payoutTransferOccurredAt = new Date().toISOString();
  const paidBankTransaction = await request('/admin/bank-reconciliation/transactions', {
    method: 'POST',
    token: actorToken,
    body: {
      approvalAdminId: ids.approver,
      operatorReason: 'Record local payout bank outflow evidence.',
      amount: netAmount,
      bankAccountId: ids.companyBankAccount,
      counterpartyName: providerDisplayName,
      currency: 'VND',
      description: 'Local Partner payout bank outflow evidence.',
      occurredAt: payoutTransferOccurredAt,
      sourceKey: `local-smoke:provider-payout:${runId}:outflow`,
      transferRef,
      type: CompanyBankTransactionType.OUTFLOW,
      valueDate: payoutTransferOccurredAt,
    },
  });
  paidBankTransactionId = paidBankTransaction.id;
  assertCondition(
    paidBankTransaction.status === BankReconciliationStatus.UNMATCHED,
    'Payout bank outflow was not opened for reconciliation.',
  );
  await request(`/admin/bank-reconciliation/${paidBankTransactionId}/review-assignment`, {
    method: 'POST',
    token: actorToken,
    body: {
      assigneeAdminId: ids.actor,
      reason: 'Assign payout bank outflow review.',
    },
  });
  const monthlyClosingWithOpenPayoutOutflow = await request(
    `/admin/monthly-tax-closings/summary?period=${encodeURIComponent(monthlyPeriod)}`,
    { token: actorToken },
  );
  assertCondition(
    monthlyClosingWithOpenPayoutOutflow.payoutBankOutflowReconciliationOpenCount ===
      monthlyClosingBaseline.payoutBankOutflowReconciliationOpenCount + 1 &&
      monthlyClosingWithOpenPayoutOutflow.payoutBankOutflowReconciliationOpenAmount ===
        monthlyClosingBaseline.payoutBankOutflowReconciliationOpenAmount + netAmount,
    'Monthly close did not expose the unmatched payout bank outflow.',
  );
  const paidBankMatch = await request(`/admin/bank-reconciliation/${paidBankTransactionId}/matches`, {
    method: 'POST',
    token: approverToken,
    body: {
      approvalAdminId: ids.approver,
      amount: netAmount,
      currency: 'VND',
      notes: 'Match paid payout to the payout batch and company bank cash credit.',
      payoutBatchId,
    },
  });
  assertCondition(
    paidBankMatch.bankTransaction?.status === BankReconciliationStatus.MATCHED &&
      paidBankMatch.match?.payoutBatchId === payoutBatchId &&
      paidBankMatch.match?.accountingJournalEntryId === paidBankCashEntry.id,
    'Payout bank outflow did not reconcile to both the payout batch and paid GL entry.',
  );
  const monthlyClosingAfterPayoutOutflowMatch = await request(
    `/admin/monthly-tax-closings/summary?period=${encodeURIComponent(monthlyPeriod)}`,
    { token: actorToken },
  );
  assertCondition(
    monthlyClosingAfterPayoutOutflowMatch.payoutBankOutflowReconciliationOpenCount ===
      monthlyClosingBaseline.payoutBankOutflowReconciliationOpenCount &&
      monthlyClosingAfterPayoutOutflowMatch.payoutBankOutflowReconciliationOpenAmount ===
        monthlyClosingBaseline.payoutBankOutflowReconciliationOpenAmount,
    'Monthly close did not clear the reconciled payout bank outflow.',
  );

  const reversalReference = `LOCAL-PAYOUT-REVERSAL-${Date.now()}`;
  const reversalReason =
    'Local smoke confirms a returned Partner payout is restored through an immutable reversal.';
  const reversalRequestBody = {
    approvalAdminId: ids.approver,
    reason: reversalReason,
    reversalReference,
    attachmentUrl: `http://localhost:9000/provider-payout-smoke/${runId}-reversal.pdf`,
  };
  await expectRequestFailure(
    `/admin/payout-batches/${payoutBatchId}/reversal`,
    {
      method: 'POST',
      token: actorToken,
      body: { ...reversalRequestBody, approvalAdminId: ids.actor },
    },
    'Payout reversal accepted the maker as its own approver.',
  );

  const reversed = await request(`/admin/payout-batches/${payoutBatchId}/reversal`, {
    method: 'POST',
    token: actorToken,
    body: reversalRequestBody,
  });
  const replayedReversal = await request(`/admin/payout-batches/${payoutBatchId}/reversal`, {
    method: 'POST',
    token: actorToken,
    body: reversalRequestBody,
  });
  const [
    storedBatch,
    storedEarning,
    storedWithholdingLog,
    reversalJournal,
    reversalLedger,
    reversalJournalCount,
    reversalLedgerCount,
    walletBalanceAfterReversal,
  ] = await Promise.all([
    prisma.providerPayoutBatch.findUnique({ where: { id: payoutBatchId } }),
    prisma.providerEarning.findUnique({ where: { id: ids.earning } }),
    prisma.withholdingLog.findFirst({ where: { payoutBatchId } }),
    payoutJournal('reversal'),
    prisma.providerWalletLedgerEntry.findUnique({
      where: { sourceKey: `provider-payout-batch:${payoutBatchId}:reversal` },
    }),
    prisma.accountingJournalBatch.count({
      where: {
        sourceKey: `accounting-journal:provider-payout-batch:${payoutBatchId}:reversal`,
      },
    }),
    prisma.providerWalletLedgerEntry.count({
      where: { sourceKey: `provider-payout-batch:${payoutBatchId}:reversal` },
    }),
    providerWalletBalance(),
  ]);
  assertExactOppositeJournal(reversalJournal, paidJournal);
  assertCondition(
    reversed.payoutBatch?.status === PayoutBatchStatus.PAID &&
      replayedReversal.reversalJournalBatch?.id === reversed.reversalJournalBatch?.id &&
      storedBatch?.status === PayoutBatchStatus.PAID &&
      storedEarning?.status === EarningStatus.PAID &&
      storedWithholdingLog?.status === 'PAID' &&
      reversalLedger?.type === ProviderWalletLedgerType.ADMIN_ADJUSTMENT &&
      reversalLedger.amount === netAmount &&
      reversalJournalCount === 1 &&
      reversalLedgerCount === 1 &&
      walletBalanceAfterReversal === netAmount,
    'Payout reversal did not restore the wallet exactly once while preserving paid source records.',
  );
  const reversalBankCashEntry = reversalJournal.entries.find(
    (entry) => entry.side === 'DEBIT' && entry.accountCode === 'company_bank_cash',
  );
  assertCondition(Boolean(reversalBankCashEntry), 'Payout reversal journal has no company bank cash debit.');

  const returnTransferOccurredAt = new Date(Date.now() + 1000).toISOString();
  const returnBankTransaction = await request('/admin/bank-reconciliation/transactions', {
    method: 'POST',
    token: actorToken,
    body: {
      approvalAdminId: ids.approver,
      operatorReason: 'Record local returned payout bank inflow.',
      amount: netAmount,
      bankAccountId: ids.companyBankAccount,
      counterpartyName: providerDisplayName,
      currency: 'VND',
      description: 'Local returned Partner payout bank inflow evidence.',
      occurredAt: returnTransferOccurredAt,
      sourceKey: `local-smoke:provider-payout:${runId}:return-inflow`,
      transferRef: reversalReference,
      type: CompanyBankTransactionType.INFLOW,
      valueDate: returnTransferOccurredAt,
    },
  });
  returnBankTransactionId = returnBankTransaction.id;
  assertCondition(
    returnBankTransaction.status === BankReconciliationStatus.UNMATCHED,
    'Returned payout bank inflow was not opened for reconciliation.',
  );
  await request(`/admin/bank-reconciliation/${returnBankTransactionId}/review-assignment`, {
    method: 'POST',
    token: actorToken,
    body: {
      assigneeAdminId: ids.actor,
      reason: 'Assign returned payout bank inflow review.',
    },
  });
  const monthlyClosingWithOpenPayoutReturn = await request(
    `/admin/monthly-tax-closings/summary?period=${encodeURIComponent(monthlyPeriod)}`,
    { token: actorToken },
  );
  assertCondition(
    monthlyClosingWithOpenPayoutReturn.payoutReturnInflowReconciliationOpenCount ===
      monthlyClosingBaseline.payoutReturnInflowReconciliationOpenCount + 1 &&
      monthlyClosingWithOpenPayoutReturn.payoutReturnInflowReconciliationOpenAmount ===
        monthlyClosingBaseline.payoutReturnInflowReconciliationOpenAmount + netAmount,
    'Monthly close did not expose the unmatched returned payout bank inflow.',
  );
  const returnBankMatch = await request(
    `/admin/bank-reconciliation/${returnBankTransactionId}/matches`,
    {
      method: 'POST',
      token: approverToken,
      body: {
        accountingJournalEntryId: reversalBankCashEntry.id,
        approvalAdminId: ids.approver,
        amount: netAmount,
        currency: 'VND',
        notes: 'Match returned payout inflow to the immutable payout reversal journal.',
      },
    },
  );
  assertCondition(
    returnBankMatch.bankTransaction?.status === BankReconciliationStatus.MATCHED &&
      returnBankMatch.match?.payoutBatchId === payoutBatchId &&
      returnBankMatch.match?.accountingJournalEntryId === reversalBankCashEntry.id,
    'Returned payout inflow did not reconcile to both the payout batch and reversal GL entry.',
  );
  const monthlyClosingAfterPayoutReturnMatch = await request(
    `/admin/monthly-tax-closings/summary?period=${encodeURIComponent(monthlyPeriod)}`,
    { token: actorToken },
  );
  assertCondition(
    monthlyClosingAfterPayoutReturnMatch.payoutReturnInflowReconciliationOpenCount ===
      monthlyClosingBaseline.payoutReturnInflowReconciliationOpenCount &&
      monthlyClosingAfterPayoutReturnMatch.payoutReturnInflowReconciliationOpenAmount ===
        monthlyClosingBaseline.payoutReturnInflowReconciliationOpenAmount,
    'Monthly close did not clear the reconciled returned payout bank inflow.',
  );

  const [storedPaidBankTransaction, storedReturnBankTransaction] = await Promise.all([
    prisma.companyBankTransaction.findUnique({
      where: { id: paidBankTransactionId },
      include: { reconciliationMatches: true },
    }),
    prisma.companyBankTransaction.findUnique({
      where: { id: returnBankTransactionId },
      include: { reconciliationMatches: true },
    }),
  ]);
  assertCondition(
    storedPaidBankTransaction?.status === BankReconciliationStatus.MATCHED &&
      storedPaidBankTransaction.reconciliationMatches.length === 1 &&
      storedReturnBankTransaction?.status === BankReconciliationStatus.MATCHED &&
      storedReturnBankTransaction.reconciliationMatches.length === 1,
    'Stored payout bank reconciliation evidence is incomplete.',
  );

  const reversalListPath = '/admin/accounting-journal-batches?q=reversal&range=today&take=20';
  const [isolatedReversalJournals, runningReversalJournals] = await Promise.all([
    request(reversalListPath, { token: actorToken }),
    requestAgainst(runningApiBaseUrl, reversalListPath, { token: actorToken }),
  ]);
  assertCondition(
    containsJournal(isolatedReversalJournals, reversalJournal.id),
    'The isolated API reversal list does not include the payout reversal journal.',
  );
  assertCondition(
    containsJournal(runningReversalJournals, reversalJournal.id),
    'The running API reversal list does not include the payout reversal journal.',
  );

  const adminEvidence = adminEvidenceMode
    ? await verifyAdminWebEvidence({
        paidJournalId: paidJournal.id,
        paidBankTransactionId,
        payoutBatchId,
        providerDisplayName,
        returnBankTransactionId,
        reversalJournalId: reversalJournal.id,
        reversalReason,
        reversalReference,
        transferRef,
      })
    : undefined;

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          dualApprovalApplied: true,
          earningRemainedPaid: true,
          withholdingRemainedPaid: true,
          duplicatePaidReplayIdempotent: true,
          monthlyClosePayoutBankOutflowGate: true,
          monthlyClosePayoutReturnInflowGate: true,
          paidBankOutflowMatched: true,
          paidJournalBalanced: true,
          returnedBankInflowMatched: true,
          reversalJournalExactOpposite: true,
          reversalReplayIdempotent: true,
          walletLedgerBalanceAfterPaid: walletBalanceAfterPaid,
          walletLedgerBalanceAfterReversal: walletBalanceAfterReversal,
          ...(adminEvidence ? { adminEvidence } : {}),
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
  try {
    await cleanup();
  } catch (cleanupError) {
    console.error(JSON.stringify({
      ok: false,
      phase: 'cleanup',
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      residualFixtureIds: Object.values(ids),
    }, null, 2));
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

function startApi() {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      NODE_ENV: 'development',
      API_PORT: String(port),
      REDIS_URL: env.REDIS_URL || 'redis://127.0.0.1:6379',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  child.stderr?.on('data', (chunk) => {
    apiErrorTail = `${apiErrorTail}${String(chunk)}`.slice(-4000);
  });
  return child;
}

async function stopApi() {
  if (!apiProcess || apiProcess.exitCode !== null) return;
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
      throw new Error(`Port ${port} is already serving an API. Choose PROVIDER_PAYOUT_REVERSAL_SMOKE_PORT.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already serving')) throw error;
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (apiProcess?.exitCode !== null) {
      throw new Error('Payout reversal smoke API exited before becoming healthy.');
    }
    try {
      const response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The isolated API is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error('Timed out waiting for the isolated payout reversal smoke API.');
}

async function seed() {
  const now = new Date();
  await prisma.user.createMany({
    data: [
      {
        id: ids.actor,
        phone: smokePhone('01'),
        fullName: 'Payout Smoke Actor',
        roles: [Role.ADMIN],
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'PAYOUT_REVERSAL_SMOKE',
        fixtureRunId: runId,
      },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Payout Smoke Finance Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'PAYOUT_REVERSAL_SMOKE',
        fixtureRunId: runId,
      },
      {
        id: ids.providerUser,
        phone: smokePhone('03'),
        fullName: providerDisplayName,
        roles: [Role.PROVIDER],
      },
      {
        id: ids.customerUser,
        phone: smokePhone('04'),
        fullName: 'Payout Smoke Customer',
        roles: [Role.CUSTOMER],
      },
    ],
  });
  await prisma.adminOperatorPermission.createMany({
    data: [
      {
        userId: ids.actor,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
          AdminOperatorPermissionCategory.FINANCE_GENERAL_LEDGER,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_TAX,
        ],
      },
      {
        userId: ids.approver,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
        ],
      },
    ],
  });
  await prisma.customerProfile.create({
    data: {
      id: ids.customerProfile,
      userId: ids.customerUser,
    },
  });
  await prisma.providerProfile.create({
    data: {
      id: ids.providerProfile,
      userId: ids.providerUser,
      displayName: providerDisplayName,
      residentialAddress: 'Local payout reversal smoke address',
      status: ProviderStatus.OFFLINE,
    },
  });
  await prisma.providerBankAccount.create({
    data: {
      id: ids.providerBankAccount,
      providerProfileId: ids.providerProfile,
      accountHolderName: providerDisplayName,
      accountNumberLast4: '5505',
      accountNumberMasked: '****5505',
      bankName: 'Local Smoke Bank',
      isPrimary: true,
      reviewedAt: now,
      status: ProviderBankAccountStatus.APPROVED,
    },
  });
  await prisma.companyBankAccount.create({
    data: {
      id: ids.companyBankAccount,
      name: 'Partner Payout Reversal Smoke VND Account',
      bankName: 'Local Smoke Bank',
      accountNumberMasked: '****7755',
      accountNumberLast4: '7755',
      currency: 'VND',
      metadata: { localSmoke: true, runId },
    },
  });
  await prisma.providerAgreement.createMany({
    data: Object.values(ProviderAgreementType).map((type) => ({
      providerProfileId: ids.providerProfile,
      type,
      version: 'smoke-2026-07',
      acceptedAt: now,
    })),
  });
  await prisma.booking.create({
    data: {
      id: ids.booking,
      customerProfileId: ids.customerProfile,
      selectedProviderId: ids.providerProfile,
      status: BookingStatus.COMPLETED,
      scheduledStartAt: new Date(now.getTime() - 90 * 60_000),
      scheduledEndAt: new Date(now.getTime() - 30 * 60_000),
      address: {
        city: 'Ho Chi Minh City',
        detail: 'Local payout reversal smoke address',
      },
      lat: 10.7769,
      lng: 106.7009,
      openedAt: new Date(now.getTime() - 120 * 60_000),
      matchedAt: new Date(now.getTime() - 110 * 60_000),
      closedAt: new Date(now.getTime() - 25 * 60_000),
      closedByRole: Role.PROVIDER,
      closedReason: 'LOCAL_PAYOUT_REVERSAL_SMOKE',
    },
  });
  await prisma.providerEarning.create({
    data: {
      id: ids.earning,
      providerProfileId: ids.providerProfile,
      bookingId: ids.booking,
      grossAmount,
      platformFee,
      withholdingAmount,
      netAmount,
      currency: 'VND',
      status: EarningStatus.AVAILABLE,
      availableAt: now,
    },
  });
  await prisma.providerTaxLog.create({
    data: {
      id: ids.providerTaxLog,
      providerProfileId: ids.providerProfile,
      bookingId: ids.booking,
      earningId: ids.earning,
      grossAmount,
      taxableAmount: grossAmount,
      withholdingAmount,
      currency: 'VND',
      ruleSnapshot: {
        localSmoke: true,
        runId,
      },
    },
  });
  await prisma.providerWalletLedgerEntry.create({
    data: {
      id: ids.openingWalletLedger,
      providerProfileId: ids.providerProfile,
      bookingId: ids.booking,
      earningId: ids.earning,
      type: ProviderWalletLedgerType.BOOKING_EARNING,
      sourceKey: `local-smoke:provider-payout:${runId}:earning-credit`,
      amount: netAmount,
      currency: 'VND',
      reference: ids.booking,
      notes: 'Local-only payout reversal lifecycle starting balance.',
      metadata: { localSmoke: true, runId },
    },
  });
}

async function payoutJournal(phase) {
  const journal = await prisma.accountingJournalBatch.findUnique({
    where: {
      sourceKey: `accounting-journal:provider-payout-batch:${payoutBatchId}:${phase}`,
    },
    include: { entries: true },
  });
  assertCondition(Boolean(journal), `Provider payout ${phase} journal is missing.`);
  return journal;
}

async function providerWalletBalance() {
  const balance = await prisma.providerWalletLedgerEntry.aggregate({
    where: { providerProfileId: ids.providerProfile },
    _sum: { amount: true },
  });
  return balance._sum.amount ?? 0;
}

function assertPaidJournal(journal) {
  const debit = journal.entries
    .filter((entry) => entry.side === 'DEBIT')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const credit = journal.entries
    .filter((entry) => entry.side === 'CREDIT')
    .reduce((sum, entry) => sum + entry.amount, 0);
  assertCondition(
    journal.sourceType === AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH &&
      journal.totalDebit === netAmount &&
      journal.totalCredit === netAmount &&
      debit === netAmount &&
      credit === netAmount &&
      journal.entries.some(
        (entry) => entry.side === 'DEBIT' && entry.accountCode === 'partner_wallet_liability',
      ) &&
      journal.entries.some(
        (entry) => entry.side === 'CREDIT' && entry.accountCode === 'company_bank_cash',
      ),
    'Provider payout paid journal is incomplete or unbalanced.',
  );
}

function assertExactOppositeJournal(reversalJournal, originalJournal) {
  const expectedEntries = originalJournal.entries
    .map((entry) => ({
      accountCode: entry.accountCode,
      amount: entry.amount,
      side: entry.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
    }))
    .sort(compareJournalEntry);
  const actualEntries = reversalJournal.entries
    .map((entry) => ({
      accountCode: entry.accountCode,
      amount: entry.amount,
      side: entry.side,
    }))
    .sort(compareJournalEntry);
  assertCondition(
    reversalJournal.status === 'POSTED' &&
      reversalJournal.totalDebit === netAmount &&
      reversalJournal.totalCredit === netAmount &&
      JSON.stringify(actualEntries) === JSON.stringify(expectedEntries),
    'Payout reversal journal is not the exact opposite of the paid journal.',
  );
}

function compareJournalEntry(left, right) {
  return (
    left.accountCode.localeCompare(right.accountCode) ||
    left.side.localeCompare(right.side) ||
    left.amount - right.amount
  );
}

async function verifyAdminWebEvidence(evidence) {
  const directPages = [
    {
      path: '/payouts?range=today&pageSize=50',
      markers: [
        'Payouts',
        evidence.providerDisplayName,
        evidence.transferRef,
        'Paid',
      ],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.paidJournalId}`,
      markers: [
        'Journal Batch Detail',
        'Journal batch overview',
        'Balanced',
        evidence.payoutBatchId,
        'partner_wallet_liability',
        'company_bank_cash',
      ],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.reversalJournalId}`,
      markers: [
        'Journal Batch Detail',
        'Journal batch overview',
        'Balanced',
        evidence.payoutBatchId,
        evidence.reversalReference,
        evidence.reversalReason,
      ],
    },
    {
      path: `/finance-tax/bank-reconciliation/${evidence.paidBankTransactionId}`,
      markers: [
        'Bank Reconciliation Detail',
        'Bank evidence hub',
        'MATCHED',
        'company_bank_cash',
        evidence.transferRef,
        `Payout ${evidence.payoutBatchId.slice(0, 8)}`,
        evidence.paidJournalId,
      ],
    },
    {
      path: `/finance-tax/bank-reconciliation/${evidence.returnBankTransactionId}`,
      markers: [
        'Bank Reconciliation Detail',
        'Bank evidence hub',
        'MATCHED',
        'company_bank_cash',
        evidence.reversalReference,
        `Payout ${evidence.payoutBatchId.slice(0, 8)}`,
        evidence.reversalJournalId,
      ],
    },
    {
      path: '/finance-tax/settlement-reversals',
      markers: [
        'Settlement Reversals',
        'Payout and withdrawal reversal journals',
        evidence.providerDisplayName,
        'Payout batch reversal',
      ],
    },
  ];
  await runAdminWebDirectSmoke({ env, pages: directPages, repoRoot });
  return {
    checkedPages: directPages.length,
    paidBankOutflowLinked: true,
    payoutLinked: true,
    paidJournalLinked: true,
    returnedBankInflowLinked: true,
    reversalJournalLinked: true,
  };
}

async function request(path, options = {}) {
  return requestAgainst(apiBaseUrl, path, options);
}

async function requestAgainst(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
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

async function expectRequestFailure(path, options, failureMessage) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  assertCondition(response.status >= 400 && response.status < 500, failureMessage);
}

function containsJournal(value, journalId) {
  return Array.isArray(value) && value.some((journal) => journal?.id === journalId);
}

async function cleanup() {
  await prisma.bankReconciliationMatch.deleteMany({
    where: {
      OR: [
        { bankTransactionId: paidBankTransactionId ?? '__missing__' },
        { bankTransactionId: returnBankTransactionId ?? '__missing__' },
        { payoutBatch: { is: { providerProfileId: ids.providerProfile } } },
      ],
    },
  });
  await prisma.companyBankTransaction.deleteMany({
    where: { bankAccountId: ids.companyBankAccount },
  });
  await prisma.accountingJournalBatch.deleteMany({
    where: {
      sourceType: AccountingJournalSourceType.PROVIDER_PAYOUT_BATCH,
      providerProfileId: ids.providerProfile,
    },
  });
  await prisma.notification.deleteMany({ where: { userId: ids.providerUser } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: [ids.actor, ids.approver] } } });
  await prisma.withholdingLog.deleteMany({
    where: {
      OR: [
        { payoutBatch: { is: { providerProfileId: ids.providerProfile } } },
        { providerTaxLog: { is: { providerProfileId: ids.providerProfile } } },
      ],
    },
  });
  await prisma.providerTaxLog.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerWalletLedgerEntry.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerEarning.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerPayoutBatch.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.booking.deleteMany({ where: { id: ids.booking } });
  await prisma.providerAgreement.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerBankAccount.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.companyBankAccount.deleteMany({ where: { id: ids.companyBankAccount } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [ids.actor, ids.approver, ids.providerUser, ids.customerUser],
      },
    },
  });
}

function adminToken(userId, roles) {
  return jwt.sign({ sub: userId, activeRole: Role.ADMIN, roles }, jwtAccessSecret(), {
    expiresIn: '10m',
  });
}

function assertLocalFixtureMode() {
  assertCondition(env.NODE_ENV !== 'production', 'Payout reversal smoke cannot run in production.');
  const databaseUrl = new URL(requiredEnv('DATABASE_URL'));
  assertCondition(
    ['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname),
    'Payout reversal smoke refuses a remote database.',
  );
}

function smokePhone(suffix) {
  return `+84978${String(Date.now()).slice(-5)}${suffix}`;
}

function jwtAccessSecret() {
  return env.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function vietnamMonthlyPeriod(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  assertCondition(Boolean(year && month), 'Unable to resolve the Vietnam monthly period.');
  return `${year}-${month}`;
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for payout reversal lifecycle smoke.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
