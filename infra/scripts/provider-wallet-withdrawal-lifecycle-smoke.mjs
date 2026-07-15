import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AccountingJournalSourceType,
  BankReconciliationStatus,
  CompanyBankTransactionType,
  PrismaClient,
  ProviderBankAccountStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  ProviderWalletWithdrawalRequestStatus,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { runAdminWebDirectSmoke } from './lib/admin-web-direct-smoke.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const port = Number.parseInt(env.PROVIDER_WITHDRAWAL_SMOKE_PORT ?? '3004', 10);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;
const apiEntry = resolve(repoRoot, 'apps', 'api', 'dist', 'main.js');
const adminEvidenceMode = process.argv.includes('--admin-evidence');
const runId = `provider_withdrawal_${Date.now()}`;
const amount = 120_000;
const initialWalletBalance = 500_000;
const ids = {
  actor: `${runId}_actor`,
  approver: `${runId}_approver`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  providerBankAccount: `${runId}_provider_bank_account`,
  companyBankAccount: `${runId}_company_bank_account`,
};
const prisma = new PrismaClient({ datasources: { db: { url: requiredEnv('DATABASE_URL') } } });
let apiProcess;
let apiErrorTail = '';
let withdrawalRequestId;
let bankTransactionId;

assertLocalFixtureMode();
assertCondition(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid Provider withdrawal smoke port.');
assertCondition(existsSync(apiEntry), 'API build is missing. Run the API build before Provider withdrawal smoke.');

try {
  await assertPortIsFree();
  await cleanup();
  await seed();
  apiProcess = startApi();
  await waitForHealth();

  const actorToken = adminToken(ids.actor, [Role.ADMIN]);
  const providerToken = jwt.sign(
    { sub: ids.providerUser, activeRole: Role.PROVIDER, roles: [Role.PROVIDER] },
    jwtAccessSecret(),
    { expiresIn: '10m' },
  );

  const created = await request('/partner/earnings/wallet-withdrawal-requests', {
    method: 'POST',
    token: providerToken,
    body: {
      amount,
      bankAccountId: ids.providerBankAccount,
      requestNote: 'Local Partner withdrawal accounting lifecycle smoke.',
    },
  });
  withdrawalRequestId = created.id;
  assertCondition(
    created.status === ProviderWalletWithdrawalRequestStatus.REQUESTED && created.amount === amount,
    'Partner API did not create the expected withdrawal request.',
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
  assertCondition(approved.status === ProviderWalletWithdrawalRequestStatus.APPROVED, 'Withdrawal approval failed.');

  const transferRef = `LOCAL-WITHDRAWAL-${Date.now()}`;
  const pending = await request(`/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`, {
    method: 'PATCH',
    token: actorToken,
    body: {
      status: ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
      transferRef,
      adminNote: 'Local bank transfer prepared.',
    },
  });
  assertCondition(
    pending.status === ProviderWalletWithdrawalRequestStatus.BANK_TRANSFER_PENDING,
    'Withdrawal did not enter bank-transfer pending state.',
  );

  const transferDate = new Date().toISOString();
  const paid = await request(`/admin/provider-wallet/withdrawal-requests/${withdrawalRequestId}`, {
    method: 'PATCH',
    token: actorToken,
    body: {
      status: ProviderWalletWithdrawalRequestStatus.PAID,
      approvalAdminId: ids.approver,
      transferRef,
      bankTransferDate: transferDate,
      attachmentUrl: `http://localhost:9000/provider-withdrawal-smoke/${runId}.pdf`,
      adminNote: 'Local transfer evidence confirmed.',
    },
  });
  assertCondition(paid.status === ProviderWalletWithdrawalRequestStatus.PAID, 'Withdrawal paid closeout failed.');

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
      occurredAt: transferDate,
      sourceKey: `local-smoke:provider-withdrawal:${runId}:bank-outflow`,
      transferRef,
      type: CompanyBankTransactionType.OUTFLOW,
      valueDate: transferDate,
    },
  });
  bankTransactionId = bankTransaction.id;
  assertCondition(bankTransaction.status === BankReconciliationStatus.UNMATCHED, 'Bank outflow was not opened.');

  const reconciliation = await request(`/admin/bank-reconciliation/${bankTransactionId}/matches`, {
    method: 'POST',
    token: actorToken,
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

  const adminEvidence = adminEvidenceMode
    ? await verifyAdminWebEvidence({
        bankTransactionId,
        lockJournalId: storedLockJournal.id,
        paidJournalId: paidJournal.id,
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
          lockJournalImmutable: true,
          paidJournalBalanced: true,
          walletLedgerBalance: walletBalance._sum.amount,
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
  await cleanup().catch(() => undefined);
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
    if (response) throw new Error(`Port ${port} is already serving an API. Choose PROVIDER_WITHDRAWAL_SMOKE_PORT.`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already serving')) throw error;
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (apiProcess?.exitCode !== null) throw new Error('Provider withdrawal smoke API exited before becoming healthy.');
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
      { id: ids.actor, phone: smokePhone('01'), fullName: 'Withdrawal Smoke Actor', roles: [Role.ADMIN] },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Withdrawal Smoke Finance Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      },
      {
        id: ids.providerUser,
        phone: smokePhone('03'),
        fullName: 'Withdrawal Smoke Partner',
        roles: [Role.PROVIDER],
      },
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
  const debit = journal.entries.filter((entry) => entry.side === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0);
  const credit = journal.entries.filter((entry) => entry.side === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0);
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

async function verifyAdminWebEvidence(evidence) {
  const directPages = [
    {
      path: '/payouts?range=today&withdrawalStatus=PAID&pageSize=10',
      markers: ['Payouts', 'Partner wallet withdrawal requests', 'Withdrawal Smoke Partner', 'Paid', evidence.transferRef],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.lockJournalId}`,
      markers: ['General Ledger Detail', 'Journal batch overview', 'Balanced', evidence.withdrawalRequestId, 'partner_withdrawal_payable'],
    },
    {
      path: `/finance-tax/general-ledger/${evidence.paidJournalId}`,
      markers: ['General Ledger Detail', 'Journal batch overview', 'Balanced', evidence.withdrawalRequestId, 'company_bank_cash'],
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
  ];
  await runAdminWebDirectSmoke({ env, pages: directPages, repoRoot });
  return { checkedPages: directPages.length, payoutLinked: true, journalsLinked: true, reconciliationLinked: true };
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
    throw new Error(`${options.method ?? 'GET'} ${path.split('?')[0]} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function cleanup() {
  await prisma.bankReconciliationMatch.deleteMany({
    where: {
      OR: [
        { withdrawalRequestId: withdrawalRequestId ?? '__missing__' },
        { bankTransactionId: bankTransactionId ?? '__missing__' },
      ],
    },
  });
  await prisma.companyBankTransaction.deleteMany({ where: { bankAccountId: ids.companyBankAccount } });
  await prisma.accountingJournalBatch.deleteMany({
    where: { sourceType: AccountingJournalSourceType.PROVIDER_WITHDRAWAL, providerProfileId: ids.providerProfile },
  });
  await prisma.providerWalletLedgerEntry.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerWalletWithdrawalRequest.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerBankAccount.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.companyBankAccount.deleteMany({ where: { id: ids.companyBankAccount } });
  await prisma.notification.deleteMany({ where: { userId: ids.providerUser } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: [ids.actor, ids.approver] } } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.actor, ids.approver, ids.providerUser] } } });
}

function adminToken(userId, roles) {
  return jwt.sign({ sub: userId, activeRole: Role.ADMIN, roles }, jwtAccessSecret(), { expiresIn: '10m' });
}

function assertLocalFixtureMode() {
  assertCondition(env.NODE_ENV !== 'production', 'Provider withdrawal smoke cannot run in production.');
  const databaseUrl = new URL(requiredEnv('DATABASE_URL'));
  assertCondition(
    ['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname),
    'Provider withdrawal smoke refuses a remote database.',
  );
}

function smokePhone(suffix) {
  return `+84977${String(Date.now()).slice(-5)}${suffix}`;
}

function jwtAccessSecret() {
  return env.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for Provider withdrawal lifecycle smoke.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
