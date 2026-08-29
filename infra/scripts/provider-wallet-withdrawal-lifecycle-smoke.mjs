import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AdminUserProvenance,
  AdminOperatorPermissionCategory,
  AccountingJournalSourceType,
  BankReconciliationStatus,
  CompanyBankAccountDataScope,
  CompanyBankAccountStatus,
  CompanyBankTransactionType,
  PrismaClient,
  ProviderBankAccountStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  ProviderWalletWithdrawalRequestStatus,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';
import IORedis from 'ioredis';

import { runAdminWebDirectSmoke } from './lib/admin-web-direct-smoke.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';
import { financeApproverSmokeAttestationEvents } from './lib/finance-approver-smoke-attestation.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const port = Number.parseInt(env.PROVIDER_WITHDRAWAL_SMOKE_PORT ?? '3004', 10);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;
const apiEntry = resolve(repoRoot, 'apps', 'api', 'dist', 'main.js');
const adminEvidenceMode = process.argv.includes('--admin-evidence');
const runId = `provider_withdrawal_${Date.now()}`;
const databaseUrl = requiredEnv('DATABASE_URL');
const redisUrl = requiredEnv('REDIS_URL');
assertDisposableLifecycleTarget(databaseUrl, redisUrl);
const mobileAuthEpoch = `${runId}_auth_epoch`;
const amount = 120_000;
const initialWalletBalance = 500_000;
const withdrawalIdempotencyKey = `${runId}:request`;
const ids = {
  actor: `${runId}_actor`,
  actorSession: `${runId}_actor_session`,
  approver: `${runId}_approver`,
  approverSession: `${runId}_approver_session`,
  reversalApprover: `${runId}_reversal_approver`,
  reversalApproverSession: `${runId}_reversal_approver_session`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  providerBankAccount: `${runId}_provider_bank_account`,
  companyBankAccount: `${runId}_company_bank_account`,
};
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const redis = new IORedis(redisUrl, { maxRetriesPerRequest: null });
let apiProcess;
let apiErrorTail = '';
let withdrawalRequestId;
let bankTransactionId;

assertLocalFixtureMode();
assertCondition(
  Number.isInteger(port) && port > 0 && port < 65536,
  'Invalid Provider withdrawal smoke port.',
);
assertCondition(
  existsSync(apiEntry),
  'API build is missing. Run the API build before Provider withdrawal smoke.',
);

try {
  await assertPortIsFree();
  await prepareAuthenticationState();
  await cleanup();
  await seed();
  apiProcess = startApi();
  await waitForHealth();

  const actorToken = adminToken(ids.actor, ids.actorSession);
  const approverToken = adminToken(ids.approver, ids.approverSession);
  const reversalApproverToken = adminToken(ids.reversalApprover, ids.reversalApproverSession);
  const providerToken = mobileToken(ids.providerUser, Role.PROVIDER);

  const created = await request('/partner/earnings/wallet-withdrawal-requests', {
    method: 'POST',
    token: providerToken,
    body: {
      amount,
      bankAccountId: ids.providerBankAccount,
      idempotencyKey: withdrawalIdempotencyKey,
      requestNote: 'Local Partner withdrawal accounting lifecycle smoke.',
    },
  });
  withdrawalRequestId = created.id;
  assertCondition(
    created.status === ProviderWalletWithdrawalRequestStatus.REQUESTED && created.amount === amount,
    'Partner API did not create the expected withdrawal request.',
  );
  const replayed = await request('/partner/earnings/wallet-withdrawal-requests', {
    method: 'POST',
    token: providerToken,
    body: {
      amount,
      bankAccountId: ids.providerBankAccount,
      idempotencyKey: withdrawalIdempotencyKey,
      requestNote: 'Local Partner withdrawal accounting lifecycle smoke.',
    },
  });
  assertCondition(
    replayed.id === withdrawalRequestId,
    'Partner withdrawal idempotent retry created a second request.',
  );

  const lockJournal = await journalFor('lock');
  assertBalancedJournal(lockJournal, {
    debitAccount: 'partner_wallet_liability',
    creditAccount: 'partner_withdrawal_payable',
  });
  const originalLockEvidence = {
    createdById: lockJournal.createdById,
    postedAt: lockJournal.postedAt.toISOString(),
  };

  const approved = await request(`/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`, {
    method: 'PATCH',
    token: actorToken,
    body: { status: ProviderWalletWithdrawalRequestStatus.APPROVED, adminNote: 'Smoke approval.' },
  });
  assertCondition(
    approved.status === ProviderWalletWithdrawalRequestStatus.APPROVED,
    'Withdrawal approval failed.',
  );

  const transferRef = `LOCAL-WITHDRAWAL-${Date.now()}`;
  const transferDate = new Date().toISOString();
  const transferEvidenceUrl = `http://localhost:9000/provider-withdrawal-smoke/${runId}.pdf`;
  const pending = await request(`/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`, {
    method: 'PATCH',
    token: actorToken,
    body: {
      status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      transferRef,
      bankTransferDate: transferDate,
      attachmentUrl: transferEvidenceUrl,
      adminNote: 'Local bank transfer prepared.',
    },
  });
  assertCondition(
    pending.status === ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
    'Withdrawal did not enter bank-transfer pending state.',
  );

  const paidRequestBody = {
    status: ProviderWalletWithdrawalRequestStatus.PAID,
  };
  await expectRequestFailure(
    `/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`,
    { method: 'PATCH', token: actorToken, body: paidRequestBody },
    'Withdrawal maker was allowed to approve its own paid closeout.',
  );
  const paid = await request(`/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`, {
    method: 'PATCH',
    token: approverToken,
    body: paidRequestBody,
  });
  assertCondition(
    paid.status === ProviderWalletWithdrawalRequestStatus.PAID,
    'Withdrawal paid closeout failed.',
  );

  await expectRequestFailure(
    `/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`,
    { method: 'PATCH', token: approverToken, body: paidRequestBody },
    'Repeated withdrawal paid closeout was not rejected.',
  );
  const [paidLedgerCount, withdrawalJournalCount] = await Promise.all([
    prisma.providerWalletLedgerEntry.count({
      where: { sourceKey: `partner-wallet-withdrawal:${withdrawalRequestId}:paid` },
    }),
    prisma.accountingJournalBatch.count({
      where: {
        sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL,
        providerProfileId: ids.providerProfile,
      },
    }),
  ]);
  assertCondition(
    paidLedgerCount === 1 && withdrawalJournalCount === 2,
    'Repeated withdrawal paid closeout created duplicate wallet or journal side effects.',
  );

  const [storedLockJournal, paidJournal, walletLedger, walletBalance] = await Promise.all([
    journalFor('lock'),
    journalFor('paid'),
    prisma.providerWalletLedgerEntry.findUnique({
      where: { sourceKey: `partner-wallet-withdrawal:${withdrawalRequestId}:paid` },
    }),
    prisma.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId: ids.providerProfile },
      _sum: { amount: true },
    }),
  ]);
  assertCondition(
    storedLockJournal.createdById === originalLockEvidence.createdById &&
      storedLockJournal.postedAt.toISOString() === originalLockEvidence.postedAt,
    'Posted withdrawal lock journal was mutated during paid closeout.',
  );
  assertBalancedJournal(paidJournal, {
    debitAccount: 'partner_withdrawal_payable',
    creditAccount: 'company_bank_cash',
  });
  assertCondition(
    walletLedger?.type === ProviderWalletLedgerType.PARTNER_WALLET_WITHDRAWAL_PAID &&
      walletLedger.amount === -amount &&
      walletBalance._sum.amount === initialWalletBalance - amount,
    'Provider wallet ledger did not preserve the expected paid withdrawal balance.',
  );
  const paidBankCashEntry = paidJournal.entries.find(
    (entry) => entry.side === 'CREDIT' && entry.accountCode === 'company_bank_cash',
  );
  assertCondition(Boolean(paidBankCashEntry), 'Withdrawal paid journal has no company bank cash credit.');

  const bankTransaction = await request('/admin/bank-reconciliation/transactions', {
    method: 'POST',
    token: actorToken,
    body: {
      approvalAdminId: ids.approver,
      amount,
      bankAccountId: ids.companyBankAccount,
      counterpartyName: 'Partner Withdrawal Smoke Partner',
      currency: 'VND',
      description: 'Local Partner wallet withdrawal bank outflow evidence.',
      operatorReason: 'Record Partner wallet withdrawal bank evidence.',
      occurredAt: transferDate,
      sourceKey: `local-smoke:provider-withdrawal:${runId}:bank-outflow`,
      transferRef,
      type: CompanyBankTransactionType.OUTFLOW,
      valueDate: transferDate,
    },
  });
  bankTransactionId = bankTransaction.id;
  assertCondition(
    bankTransaction.status === BankReconciliationStatus.UNMATCHED,
    'Bank outflow was not opened.',
  );
  await request(`/admin/bank-reconciliation/${bankTransactionId}/review-assignment`, {
    method: 'POST',
    token: actorToken,
    body: {
      assigneeAdminId: ids.actor,
      reason: 'Assign Partner withdrawal bank evidence review.',
    },
  });

  const reconciliation = await request(`/admin/bank-reconciliation/${bankTransactionId}/matches`, {
    method: 'POST',
    token: approverToken,
    body: {
      approvalAdminId: ids.approver,
      amount,
      currency: 'VND',
      notes: 'Match paid withdrawal to its company bank cash journal.',
      withdrawalRequestId,
    },
  });
  assertCondition(
    reconciliation.bankTransaction?.status === BankReconciliationStatus.MATCHED &&
      reconciliation.match?.withdrawalRequestId === withdrawalRequestId &&
      reconciliation.match?.accountingJournalEntryId === paidBankCashEntry.id,
    'Bank outflow did not reconcile to both the withdrawal request and paid GL entry.',
  );

  const detail = await prisma.companyBankTransaction.findUnique({
    where: { id: bankTransactionId },
    include: { reconciliationMatches: true },
  });
  assertCondition(
    detail?.status === BankReconciliationStatus.MATCHED &&
      detail.reconciliationMatches.length === 1 &&
      detail.reconciliationMatches[0]?.status === BankReconciliationStatus.MATCHED,
    'Stored bank reconciliation evidence is incomplete.',
  );

  const reversalReference = `LOCAL-WITHDRAWAL-REVERSAL-${Date.now()}`;
  const reversalRequestBody = {
    approvalAdminId: ids.reversalApprover,
    reason: 'Local smoke confirms a returned Partner withdrawal is restored through reversal.',
    reversalReference,
    attachmentUrl: `http://localhost:9000/provider-withdrawal-smoke/${runId}-reversal.pdf`,
  };
  const reversed = await request(
    `/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}/reversal`,
    {
      method: 'POST',
      token: reversalApproverToken,
      body: reversalRequestBody,
    },
  );
  assertCondition(
    reversed.withdrawalRequest?.status === ProviderWalletWithdrawalRequestStatus.REVERSED,
    'Paid withdrawal reversal did not move the request to REVERSED.',
  );
  const replayedReversal = await request(
    `/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}/reversal`,
    {
      method: 'POST',
      token: reversalApproverToken,
      body: reversalRequestBody,
    },
  );
  const [reversalJournal, reversalLedger, restoredWalletBalance, reversalJournalCount, reversalLedgerCount] =
    await Promise.all([
      prisma.accountingJournalBatch.findUnique({
        where: {
          sourceKey: `accounting-journal:provider-withdrawal:${withdrawalRequestId}:reversal`,
        },
        include: { entries: true },
      }),
      prisma.providerWalletLedgerEntry.findUnique({
        where: { sourceKey: `provider-wallet-withdrawal:${withdrawalRequestId}:reversal` },
      }),
      prisma.providerWalletLedgerEntry.aggregate({
        where: { providerProfileId: ids.providerProfile },
        _sum: { amount: true },
      }),
      prisma.accountingJournalBatch.count({
        where: {
          sourceKey: `accounting-journal:provider-withdrawal:${withdrawalRequestId}:reversal`,
        },
      }),
      prisma.providerWalletLedgerEntry.count({
        where: { sourceKey: `provider-wallet-withdrawal:${withdrawalRequestId}:reversal` },
      }),
    ]);
  assertCondition(Boolean(reversalJournal), 'Withdrawal reversal journal is missing.');
  assertExactOppositeJournal(reversalJournal, [storedLockJournal, paidJournal]);
  assertCondition(
    replayedReversal.withdrawalRequest?.status === ProviderWalletWithdrawalRequestStatus.REVERSED &&
      reversalLedger?.type === ProviderWalletLedgerType.ADMIN_ADJUSTMENT &&
      reversalLedger.amount === amount &&
      restoredWalletBalance._sum.amount === initialWalletBalance &&
      reversalJournalCount === 1 &&
      reversalLedgerCount === 1,
    'Withdrawal reversal did not restore the wallet exactly once.',
  );
  const reversalListPath = '/admin/accounting-journal-batches?q=reversal&range=today&take=20';
  const isolatedReversalJournals = await request(reversalListPath, { token: actorToken });
  assertCondition(
    containsJournal(isolatedReversalJournals, reversalJournal.id),
    'The isolated API reversal list does not include the posted withdrawal reversal journal.',
  );

  const adminEvidence = adminEvidenceMode
    ? await verifyAdminWebEvidence({
        bankTransactionId,
        lockJournalId: storedLockJournal.id,
        paidJournalId: paidJournal.id,
        providerProfileId: ids.providerProfile,
        reversalJournalId: reversalJournal.id,
        reversalReference,
        transferRef,
        withdrawalRequestId,
      })
    : undefined;

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          bankOutflowMatched: true,
          dualApprovalApplied: true,
          duplicatePaidReplayIdempotent: true,
          lockJournalImmutable: true,
          paidJournalBalanced: true,
          reversalJournalExactOpposite: true,
          reversalReplayIdempotent: true,
          walletLedgerBalanceAfterPaid: walletBalance._sum.amount,
          walletLedgerBalanceAfterReversal: restoredWalletBalance._sum.amount,
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
    console.error(
      JSON.stringify(
        {
          ok: false,
          phase: 'cleanup',
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          residualFixtureIds: Object.values(ids),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
  await prisma.$disconnect();
  await redis.quit();
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
    if (response)
      throw new Error(`Port ${port} is already serving an API. Choose PROVIDER_WITHDRAWAL_SMOKE_PORT.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already serving')) throw error;
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (apiProcess?.exitCode !== null)
      throw new Error('Provider withdrawal smoke API exited before becoming healthy.');
    try {
      const response = await fetch(`${apiBaseUrl}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The isolated API is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error('Timed out waiting for the isolated Provider withdrawal smoke API.');
}

async function seed() {
  await prisma.user.createMany({
    data: [
      {
        id: ids.actor,
        phone: smokePhone('01'),
        fullName: 'Withdrawal Smoke Actor',
        roles: [Role.ADMIN],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Withdrawal Smoke Finance Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      },
      {
        id: ids.reversalApprover,
        phone: smokePhone('03'),
        fullName: 'Withdrawal Smoke Reversal Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      },
      {
        id: ids.providerUser,
        phone: smokePhone('04'),
        fullName: 'Withdrawal Smoke Partner',
        roles: [Role.PROVIDER],
      },
    ],
  });
  const now = new Date();
  await prisma.adminOperatorCredential.createMany({
    data: [
      {
        userId: ids.actor,
        email: `${runId}.actor@hands.test`,
        passwordHash: 'disposable-smoke-only-hash',
        passwordSalt: 'disposable-smoke-only-salt',
        setupCompletedAt: now,
        mfaState: 'VERIFIED',
      },
      {
        userId: ids.approver,
        email: `${runId}.approver@hands.test`,
        passwordHash: 'disposable-smoke-only-hash',
        passwordSalt: 'disposable-smoke-only-salt',
        setupCompletedAt: now,
        mfaState: 'VERIFIED',
      },
      {
        userId: ids.reversalApprover,
        email: `${runId}.reversal-approver@hands.test`,
        passwordHash: 'disposable-smoke-only-hash',
        passwordSalt: 'disposable-smoke-only-salt',
        setupCompletedAt: now,
        mfaState: 'VERIFIED',
      },
    ],
  });
  await prisma.adminWebSession.createMany({
    data: [
      {
        id: ids.actorSession,
        userId: ids.actor,
        expiresAt: new Date(now.getTime() + 30 * 60_000),
        lastSeenAt: now,
        reauthenticatedAt: now,
        mfaVerifiedAt: now,
      },
      {
        id: ids.approverSession,
        userId: ids.approver,
        expiresAt: new Date(now.getTime() + 30 * 60_000),
        lastSeenAt: now,
        reauthenticatedAt: now,
        mfaVerifiedAt: now,
      },
      {
        id: ids.reversalApproverSession,
        userId: ids.reversalApprover,
        expiresAt: new Date(now.getTime() + 30 * 60_000),
        lastSeenAt: now,
        reauthenticatedAt: now,
        mfaVerifiedAt: now,
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
        ],
      },
      {
        userId: ids.approver,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
        ],
      },
      {
        userId: ids.reversalApprover,
        categories: [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS],
      },
    ],
  });
  await prisma.adminAuditLog.createMany({
    data: [
      ...financeApproverSmokeAttestationEvents({
        categories: [
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
        ],
        checkerId: ids.actor,
        effectiveAt: now,
        runId: `${runId}_approver`,
        sourceReference: `disposable-lifecycle:${runId}`,
        targetUserId: ids.approver,
      }),
      ...financeApproverSmokeAttestationEvents({
        categories: [AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS],
        checkerId: ids.actor,
        effectiveAt: now,
        runId: `${runId}_reversal_approver`,
        sourceReference: `disposable-lifecycle:${runId}`,
        targetUserId: ids.reversalApprover,
      }),
    ],
  });
  await prisma.providerProfile.create({
    data: {
      id: ids.providerProfile,
      userId: ids.providerUser,
      displayName: 'Withdrawal Smoke Partner',
      status: ProviderStatus.OFFLINE,
    },
  });
  await prisma.providerBankAccount.create({
    data: {
      id: ids.providerBankAccount,
      providerProfileId: ids.providerProfile,
      accountHolderName: 'Withdrawal Smoke Partner',
      accountNumberLast4: '4404',
      accountNumberMasked: '****4404',
      bankName: 'Local Smoke Bank',
      isPrimary: true,
      reviewedAt: new Date(),
      status: ProviderBankAccountStatus.APPROVED,
    },
  });
  await prisma.providerWalletLedgerEntry.create({
    data: {
      providerProfileId: ids.providerProfile,
      type: ProviderWalletLedgerType.PARTNER_BANK_DEPOSIT_RECEIVED,
      sourceKey: `local-smoke:provider-withdrawal:${runId}:wallet-credit`,
      amount: initialWalletBalance,
      currency: 'VND',
      reference: `LOCAL-CREDIT-${runId}`,
      notes: 'Local-only Partner withdrawal lifecycle starting balance.',
      metadata: { localSmoke: true, runId },
    },
  });
  await prisma.companyBankAccount.create({
    data: {
      id: ids.companyBankAccount,
      name: 'Partner Withdrawal Smoke VND Account',
      bankName: 'Local Smoke Bank',
      accountNumberMasked: '****9911',
      accountNumberLast4: '9911',
      currency: 'VND',
      dataScope: CompanyBankAccountDataScope.PRODUCTION,
      status: CompanyBankAccountStatus.ACTIVE,
      metadata: { localSmoke: true, runId },
    },
  });
}

async function journalFor(phase) {
  const journal = await prisma.accountingJournalBatch.findUnique({
    where: { sourceKey: `accounting-journal:provider-withdrawal:${withdrawalRequestId}:${phase}` },
    include: { entries: true },
  });
  assertCondition(Boolean(journal), `Provider withdrawal ${phase} journal is missing.`);
  return journal;
}

function assertBalancedJournal(journal, { debitAccount, creditAccount }) {
  const debit = journal.entries
    .filter((entry) => entry.side === 'DEBIT')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const credit = journal.entries
    .filter((entry) => entry.side === 'CREDIT')
    .reduce((sum, entry) => sum + entry.amount, 0);
  assertCondition(
    journal.sourceType === AccountingJournalSourceType.PROVIDER_WITHDRAWAL &&
      journal.totalDebit === amount &&
      journal.totalCredit === amount &&
      debit === amount &&
      credit === amount &&
      journal.entries.some((entry) => entry.side === 'DEBIT' && entry.accountCode === debitAccount) &&
      journal.entries.some((entry) => entry.side === 'CREDIT' && entry.accountCode === creditAccount),
    `Provider withdrawal journal ${journal.id} is incomplete or unbalanced.`,
  );
}

function assertExactOppositeJournal(reversalJournal, originalJournals) {
  const expectedEntries = originalJournals
    .flatMap((journal) =>
      journal.entries.map((entry) => ({
        accountCode: entry.accountCode,
        amount: entry.amount,
        side: entry.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
      })),
    )
    .sort(compareJournalEntry);
  const actualEntries = reversalJournal.entries
    .map((entry) => ({
      accountCode: entry.accountCode,
      amount: entry.amount,
      side: entry.side,
    }))
    .sort(compareJournalEntry);
  const expectedTotal = originalJournals.reduce((sum, journal) => sum + journal.totalDebit, 0);
  assertCondition(
    reversalJournal.status === 'POSTED' &&
      reversalJournal.totalDebit === expectedTotal &&
      reversalJournal.totalCredit === expectedTotal &&
      JSON.stringify(actualEntries) === JSON.stringify(expectedEntries),
    'Withdrawal reversal journal is not the exact opposite of the original LOCK and PAID journals.',
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
      path:
        `/payouts?range=today&withdrawalStatus=REVERSED&pageSize=10&withdrawalPartnerId=` +
        encodeURIComponent(evidence.providerProfileId),
      markers: [
        'Payouts',
        'Partner wallet withdrawal requests',
        'Withdrawal Smoke Partner',
        'Reversed to Partner wallet',
        evidence.reversalReference,
      ],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.lockJournalId}`,
      markers: [
        'Journal Batch Detail',
        'Journal batch overview',
        'CLEAR',
        evidence.withdrawalRequestId,
        'partner_withdrawal_payable',
      ],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.paidJournalId}`,
      markers: [
        'Journal Batch Detail',
        'Journal batch overview',
        'CLEAR',
        evidence.withdrawalRequestId,
        'company_bank_cash',
      ],
    },
    {
      path: `/finance-tax/bank-reconciliation/${evidence.bankTransactionId}`,
      markers: [
        'Bank Reconciliation Detail',
        'Bank evidence hub',
        'MATCHED',
        'company_bank_cash',
        evidence.transferRef,
        evidence.paidJournalId,
      ],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.reversalJournalId}`,
      markers: [
        'Journal Batch Detail',
        'Journal batch overview',
        'Entry debit = credit · Pass',
        evidence.withdrawalRequestId,
        evidence.reversalReference,
      ],
    },
    {
      path: '/finance-tax/settlement-reversals',
      markers: [
        'Closed-period Settlement Reversals',
        'Related Partner Money reversals',
        'Open withdrawal journals',
      ],
    },
  ];
  await runAdminWebDirectSmoke({
    env,
    pages: directPages,
    repoRoot,
    session: { sessionId: ids.actorSession, userId: ids.actor },
  });
  return {
    checkedPages: directPages.length,
    payoutLinked: true,
    journalsLinked: true,
    reconciliationLinked: true,
    reversalLinked: true,
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
  // Financial and audit rows are append-only. The enclosing disposable schema is the cleanup boundary.
}

async function prepareAuthenticationState() {
  await redis.set('auth:mobile:epoch', mobileAuthEpoch);
}

function mobileToken(userId, role) {
  return jwt.sign(
    {
      sub: userId,
      activeRole: role,
      roles: [role],
      authEpoch: mobileAuthEpoch,
      familyId: `${runId}_${role.toLowerCase()}_family`,
    },
    jwtAccessSecret(),
    { expiresIn: '10m' },
  );
}

function adminToken(userId, sessionId) {
  return jwt.sign(
    {
      sub: userId,
      typ: 'admin-web-api',
      aud: 'hands-api',
      scope: 'admin:api',
      role: Role.ADMIN,
      jti: sessionId,
    },
    adminWebApiTokenSecret(),
    { expiresIn: '10m' },
  );
}

function assertLocalFixtureMode() {
  assertCondition(env.NODE_ENV !== 'production', 'Provider withdrawal smoke cannot run in production.');
}

function assertDisposableLifecycleTarget(targetDatabaseUrl, targetRedisUrl) {
  let database;
  let redisTarget;
  try {
    database = new URL(targetDatabaseUrl);
    redisTarget = new URL(targetRedisUrl);
  } catch {
    throw new Error('Provider withdrawal smoke requires valid DATABASE_URL and REDIS_URL values.');
  }
  const databaseName = decodeURIComponent(database.pathname.replace(/^\/+|\/+$/gu, ''));
  const schema = database.searchParams.get('schema')?.trim() ?? '';
  const exactDatabaseTarget = `${databaseName}:${schema}`;
  const databaseAllowed =
    /^(?:(?:hands|finance[_-]approver)[_-](?:it|integration))_[a-z0-9_-]+$/u.test(databaseName) &&
    /^hands_(?:it|integration)_[a-z0-9_]+$/u.test(schema);
  assertCondition(
    databaseAllowed && allowlist(env.INTEGRATION_DATABASE_ALLOWLIST).has(exactDatabaseTarget),
    `Refusing Provider withdrawal smoke writes to non-disposable target ${exactDatabaseTarget}`,
  );
  assertCondition(
    ['127.0.0.1', 'localhost', '::1'].includes(redisTarget.hostname),
    'Provider withdrawal smoke Redis must use a loopback host.',
  );
  const normalizedRedisTarget = targetRedisUrl.replace(/\/$/u, '');
  assertCondition(
    allowlist(env.INTEGRATION_REDIS_ALLOWLIST).has(normalizedRedisTarget),
    `Provider withdrawal smoke Redis target ${normalizedRedisTarget} is not explicitly allowlisted`,
  );
}

function allowlist(value) {
  return new Set(
    String(value ?? '')
      .split(',')
      .map((item) => item.trim().replace(/\/$/u, ''))
      .filter(Boolean),
  );
}

function smokePhone(suffix) {
  return `+84977${String(Date.now()).slice(-5)}${suffix}`;
}

function jwtAccessSecret() {
  return env.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function adminWebApiTokenSecret() {
  return env.ADMIN_WEB_API_TOKEN_SECRET?.trim() || 'dev-admin-web-api-token-secret';
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for Provider withdrawal lifecycle smoke.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
