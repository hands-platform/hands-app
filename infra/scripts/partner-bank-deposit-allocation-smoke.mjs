import { createHash, randomUUID } from 'node:crypto';

import {
  AdminOperatorPermissionCategory,
  BookingStatus,
  EarningStatus,
  PrismaClient,
  ProviderWalletLedgerType,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const databaseUrl = process.env.DATABASE_URL;
const apiBaseUrl = env.API_BASE_URL ?? 'http://localhost:3000/api';
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for Partner bank deposit allocation smoke.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
const parsedApiUrl = new URL(apiBaseUrl);
if (
  !localHosts.has(parsedDatabaseUrl.hostname) ||
  !localHosts.has(parsedApiUrl.hostname) ||
  env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'production'
) {
  throw new Error(
    'Partner bank deposit allocation smoke is local-only and refuses production or remote targets.',
  );
}

function jwtAccessSecret() {
  const configured = env.JWT_ACCESS_SECRET?.trim();
  if (configured && !['change-me', 'changeme', 'secret', 'password'].includes(configured.toLowerCase())) {
    return configured;
  }
  return 'dev-access-secret';
}

function adminToken(user) {
  return jwt.sign({ sub: user.id, activeRole: Role.ADMIN, roles: user.roles }, jwtAccessSecret(), {
    expiresIn: '10m',
  });
}

async function requestJson(path, token, { body, method = 'GET', expectedStatus } = {}) {
  const successStatus = expectedStatus ?? (method === 'POST' ? 201 : 200);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (response.status !== successStatus) {
    throw new Error(
      `${method} ${path} returned ${response.status}; expected ${successStatus}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function assert(condition, message, evidence) {
  if (!condition) {
    throw new Error(`${message}${evidence === undefined ? '' : `: ${JSON.stringify(evidence)}`}`);
  }
}

function journalSideTotal(entries, side) {
  return entries.filter((entry) => entry.side === side).reduce((total, entry) => total + entry.amount, 0);
}

function isolatedMonthlyClosingPeriod(runId) {
  const seed = Number.parseInt(runId.replaceAll('-', '').slice(0, 8), 16);
  const year = 2080 + (seed % 20);
  const month = 1 + (Math.floor(seed / 20) % 12);
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function createFixture(prisma, runId) {
  const phoneSuffix = runId.replaceAll('-', '').slice(0, 10);
  const [maker, approver, providerUser, customerUser] = await prisma.$transaction([
    prisma.user.create({
      data: {
        phone: `+84910${phoneSuffix}1`,
        fullName: 'Deposit Allocation Smoke Maker',
        roles: [Role.ADMIN],
      },
    }),
    prisma.user.create({
      data: {
        phone: `+84910${phoneSuffix}2`,
        fullName: 'Deposit Allocation Smoke Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      },
    }),
    prisma.user.create({
      data: {
        phone: `+84910${phoneSuffix}3`,
        fullName: 'Deposit Allocation Smoke Partner',
        roles: [Role.PROVIDER],
        providerProfile: { create: { displayName: 'Deposit Allocation Smoke Partner' } },
      },
      include: { providerProfile: true },
    }),
    prisma.user.create({
      data: {
        phone: `+84910${phoneSuffix}4`,
        fullName: 'Deposit Allocation Smoke Customer',
        roles: [Role.CUSTOMER],
        customerProfile: { create: {} },
      },
      include: { customerProfile: true },
    }),
  ]);

  const providerProfileId = providerUser.providerProfile.id;
  const customerProfileId = customerUser.customerProfile.id;
  await prisma.adminOperatorPermission.createMany({
    data: [
      {
        userId: maker.id,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_TAX,
          AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
        ],
      },
      {
        userId: approver.id,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_BANK_RECONCILIATION,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_WALLET_ADJUSTMENTS,
        ],
      },
    ],
  });
  const companyBankAccount = await prisma.companyBankAccount.create({
    data: {
      name: 'Local deposit allocation smoke account',
      bankName: 'Local smoke bank',
      accountNumberMasked: '****0001',
      accountNumberLast4: '0001',
      currency: 'VND',
      metadata: { localSmoke: true, runId },
    },
  });
  const debtAmounts = [60_000, 90_000];
  const bookings = [];

  for (const [index, debtAmount] of debtAmounts.entries()) {
    const scheduledStartAt = new Date(Date.now() - (index + 2) * 60 * 60 * 1000);
    const booking = await prisma.booking.create({
      data: {
        customerProfileId,
        selectedProviderId: providerProfileId,
        status: BookingStatus.COMPLETED,
        scheduledStartAt,
        scheduledEndAt: new Date(scheduledStartAt.getTime() + 60 * 60 * 1000),
        address: { line1: `Local Partner deposit allocation smoke ${index + 1}` },
        lat: 10.7769,
        lng: 106.7009,
        closedAt: new Date(),
        earning: {
          create: {
            providerProfileId,
            grossAmount: 1_000_000,
            platformFee: debtAmount,
            withholdingAmount: 0,
            netAmount: -debtAmount,
            status: EarningStatus.AVAILABLE,
            availableAt: new Date(),
          },
        },
      },
      include: { earning: true },
    });
    await prisma.providerWalletLedgerEntry.create({
      data: {
        providerProfileId,
        bookingId: booking.id,
        earningId: booking.earning.id,
        type: ProviderWalletLedgerType.CASH_BOOKING_PLATFORM_FEE_DEDUCTED,
        sourceKey: `local-smoke:partner-bank-deposit:${runId}:debt:${index + 1}`,
        amount: -debtAmount,
        currency: 'VND',
        reference: `LOCAL-DEBT-${runId}-${index + 1}`,
        notes: 'Local-only Partner bank deposit allocation smoke debt.',
        metadata: { localSmoke: true, runId },
      },
    });
    bookings.push(booking);
  }

  return {
    adminUserIds: [maker.id, approver.id],
    allUserIds: [maker.id, approver.id, providerUser.id, customerUser.id],
    approver,
    bookings,
    companyBankAccount,
    customerProfileId,
    maker,
    providerProfileId,
  };
}

async function cleanupFixture(prisma, fixture, runId, bankTransactionId, closingPeriod) {
  const providerProfileId = fixture?.providerProfileId;
  const bookingIds = fixture?.bookings?.map((booking) => booking.id) ?? [];
  const earningIds = fixture?.bookings?.map((booking) => booking.earning.id) ?? [];
  const adminUserIds = fixture?.adminUserIds ?? [];
  const allUserIds = fixture?.allUserIds ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.monthlyTaxClosing.deleteMany({
      where: { period: closingPeriod, currency: 'VND' },
    });
    const requests = providerProfileId
      ? await tx.partnerBankDepositRequest.findMany({
          where: { providerProfileId, bankTransactionId },
          select: { id: true, journalBatchId: true, ledgerEntryId: true },
        })
      : [];
    const requestIds = requests.map((request) => request.id);
    const journalBatchIds = requests.flatMap((request) =>
      request.journalBatchId ? [request.journalBatchId] : [],
    );
    const journalEntryIds = journalBatchIds.length
      ? (
          await tx.accountingJournalEntry.findMany({
            where: { batchId: { in: journalBatchIds } },
            select: { id: true },
          })
        ).map((entry) => entry.id)
      : [];
    const companyBankTransactionIds = fixture?.companyBankAccount?.id
      ? (
          await tx.companyBankTransaction.findMany({
            where: { bankAccountId: fixture.companyBankAccount.id },
            select: { id: true },
          })
        ).map((transaction) => transaction.id)
      : [];

    if (journalEntryIds.length || companyBankTransactionIds.length) {
      await tx.bankReconciliationMatch.deleteMany({
        where: {
          OR: [
            ...(journalEntryIds.length ? [{ accountingJournalEntryId: { in: journalEntryIds } }] : []),
            ...(companyBankTransactionIds.length
              ? [{ bankTransactionId: { in: companyBankTransactionIds } }]
              : []),
          ],
        },
      });
    }
    if (companyBankTransactionIds.length) {
      await tx.companyBankTransaction.deleteMany({ where: { id: { in: companyBankTransactionIds } } });
    }

    if (requestIds.length || earningIds.length) {
      await tx.partnerBankDepositCashDebtAllocation.deleteMany({
        where: {
          OR: [
            ...(requestIds.length ? [{ partnerBankDepositRequestId: { in: requestIds } }] : []),
            ...(earningIds.length ? [{ providerEarningId: { in: earningIds } }] : []),
          ],
        },
      });
    }
    if (requestIds.length) {
      await tx.partnerBankDepositRequest.deleteMany({ where: { id: { in: requestIds } } });
    }
    if (journalBatchIds.length) {
      await tx.accountingJournalBatch.deleteMany({ where: { id: { in: journalBatchIds } } });
    }
    if (fixture?.companyBankAccount?.id) {
      await tx.companyBankAccount.deleteMany({ where: { id: fixture.companyBankAccount.id } });
    }
    if (providerProfileId) {
      await tx.providerWalletLedgerEntry.deleteMany({ where: { providerProfileId } });
    }
    if (earningIds.length) {
      await tx.providerEarning.deleteMany({ where: { id: { in: earningIds } } });
    }
    if (bookingIds.length) {
      await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (adminUserIds.length) {
      await tx.notification.deleteMany({ where: { userId: { in: adminUserIds } } });
    }
    if (adminUserIds.length || requestIds.length) {
      await tx.adminAuditLog.deleteMany({
        where: {
          OR: [
            ...(adminUserIds.length ? [{ actorId: { in: adminUserIds } }] : []),
            ...requestIds.map((requestId) => ({ target: `partner_bank_deposit_request:${requestId}` })),
          ],
        },
      });
    }
    if (providerProfileId) {
      await tx.providerProfile.deleteMany({ where: { id: providerProfileId } });
    }
    if (fixture?.customerProfileId) {
      await tx.customerProfile.deleteMany({ where: { id: fixture.customerProfileId } });
    }
    if (allUserIds.length) {
      await tx.user.deleteMany({ where: { id: { in: allUserIds } } });
    }
  });

  const [requestCount, userCount, bankAccountCount, closingCount] = await Promise.all([
    prisma.partnerBankDepositRequest.count({ where: { bankTransactionId } }),
    allUserIds.length ? prisma.user.count({ where: { id: { in: allUserIds } } }) : 0,
    fixture?.companyBankAccount?.id
      ? prisma.companyBankAccount.count({ where: { id: fixture.companyBankAccount.id } })
      : 0,
    prisma.monthlyTaxClosing.count({ where: { period: closingPeriod, currency: 'VND' } }),
  ]);
  assert(
    requestCount === 0 && userCount === 0 && bankAccountCount === 0 && closingCount === 0,
    'Smoke fixture cleanup was incomplete',
    { bankAccountCount, closingCount, requestCount, userCount },
  );
}

const prisma = new PrismaClient();
const runId = randomUUID();
const bankTransactionId = `LOCAL-DEPOSIT-SMOKE-${runId}`;
const period = isolatedMonthlyClosingPeriod(runId);
const isolatedDepositDate = new Date(`${period}-15T05:00:00.000Z`);
let fixture;
let completed = false;

try {
  await requestJson('/health', '', { expectedStatus: 200 });
  await prisma.monthlyTaxClosing.deleteMany({ where: { period, currency: 'VND' } });
  fixture = await createFixture(prisma, runId);
  const makerAccessToken = adminToken(fixture.maker);
  const approverAccessToken = adminToken(fixture.approver);
  const monthlySummaryBefore = await requestJson(
    `/admin/monthly-tax-closings/summary?period=${period}`,
    makerAccessToken,
  );
  const debtTotal = fixture.bookings.reduce(
    (total, booking) => total + Math.abs(booking.earning.netAmount),
    0,
  );
  const firstBankEvidenceAmount = Math.max(1, Math.floor(debtTotal / 2));
  const remainingBankEvidenceAmount = debtTotal - firstBankEvidenceAmount;
  const attachmentUrl = `http://localhost:9000/local-smoke-evidence/${runId}.pdf`;

  const request = await requestJson('/admin/provider-wallet/deposit-requests', makerAccessToken, {
    method: 'POST',
    body: {
      providerProfileId: fixture.providerProfileId,
      amount: debtTotal,
      bankTransactionId,
      depositDate: isolatedDepositDate.toISOString(),
      bankAccount: 'Local smoke bank evidence',
      attachmentUrl,
      notes: 'Local-only full HTTP deposit allocation smoke.',
    },
  });
  assert(request.status === 'REQUESTED', 'Deposit request was not persisted as pending', request);
  assert(
    request.requestedReceivableRecovery === debtTotal,
    'Deposit preview did not recover receivable first',
    request,
  );
  await prisma.partnerBankDepositRequest.update({
    where: { id: request.id },
    data: { attachmentFileId: null, attachmentUrl: null },
  });
  const [makerApprovalQueue, approverApprovalQueue] = await Promise.all([
    requestJson('/admin/finance-approval-queue?take=10', makerAccessToken),
    requestJson('/admin/finance-approval-queue?take=10', approverAccessToken),
  ]);
  const makerDepositRequest = makerApprovalQueue.partnerBankDepositRequests?.find(
    (item) => item.id === request.id,
  );
  const approverDepositRequest = approverApprovalQueue.partnerBankDepositRequests?.find(
    (item) => item.id === request.id,
  );
  assert(
    makerDepositRequest?.preflight?.canApprove === false &&
      makerDepositRequest.preflight.blockers.some(
        (blocker) => blocker.code === 'MAKER_CANNOT_APPROVE',
      ),
    'Maker approval queue did not expose the dual-approval blocker',
    makerDepositRequest,
  );
  assert(
    approverDepositRequest?.preflight?.ready === false &&
      approverDepositRequest.preflight.canApprove === false &&
      approverDepositRequest.preflight.blockers.some(
        (blocker) => blocker.code === 'BANK_EVIDENCE_NOT_ATTACHED',
      ),
    'Finance approver queue did not block a deposit without attached bank evidence',
    approverDepositRequest,
  );

  await requestJson(`/admin/provider-wallet/deposit-requests/${request.id}/approve`, makerAccessToken, {
    method: 'POST',
    expectedStatus: 400,
  });
  await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}/approve`,
    approverAccessToken,
    { method: 'POST', expectedStatus: 400 },
  );
  const [requestAfterMissingEvidenceApproval, ledgerCountAfterMissingEvidenceApproval] =
    await Promise.all([
      prisma.partnerBankDepositRequest.findUnique({ where: { id: request.id } }),
      prisma.providerWalletLedgerEntry.count({
        where: {
          sourceKey: `partner-bank-deposit:${fixture.providerProfileId}:${bankTransactionId}`,
        },
      }),
    ]);
  assert(
    requestAfterMissingEvidenceApproval?.status === 'REQUESTED' &&
      ledgerCountAfterMissingEvidenceApproval === 0,
    'Missing bank evidence approval changed the request or wallet ledger',
    {
      ledgerCountAfterMissingEvidenceApproval,
      status: requestAfterMissingEvidenceApproval?.status,
    },
  );

  await prisma.partnerBankDepositRequest.update({
    where: { id: request.id },
    data: { attachmentUrl },
  });
  const approvalQueueWithEvidence = await requestJson(
    '/admin/finance-approval-queue?take=10',
    approverAccessToken,
  );
  const approverDepositRequestWithEvidence =
    approvalQueueWithEvidence.partnerBankDepositRequests?.find((item) => item.id === request.id);
  assert(
    approverDepositRequestWithEvidence?.preflight?.ready === true &&
      approverDepositRequestWithEvidence.preflight.canApprove === true,
    'Finance approver queue did not become ready after bank evidence was attached',
    approverDepositRequestWithEvidence,
  );

  const approval = await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}/approve`,
    approverAccessToken,
    { method: 'POST' },
  );
  assert(
    approval.request.status === 'EXECUTED',
    'Separate approver did not execute deposit request',
    approval,
  );
  assert(
    approval.ledger.amount === debtTotal,
    'Approved deposit wallet amount is incorrect',
    approval.ledger,
  );

  const approvedDetail = await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}`,
    makerAccessToken,
  );
  const journalDebit = journalSideTotal(approvedDetail.journal.entries, 'DEBIT');
  const journalCredit = journalSideTotal(approvedDetail.journal.entries, 'CREDIT');
  assert(
    journalDebit === debtTotal && journalCredit === debtTotal,
    'Approved deposit journal is not balanced',
    { journalCredit, journalDebit },
  );
  assert(
    approvedDetail.remainingReceivableRecovery === debtTotal,
    'Approved deposit should remain unallocated before evidence linking',
    approvedDetail,
  );

  const [openDepositQueue, monthlySummaryWithOpenDeposit] = await Promise.all([
    requestJson(
      `/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=${period}&q=${request.id}`,
      makerAccessToken,
    ),
    requestJson(`/admin/monthly-tax-closings/summary?period=${period}`, makerAccessToken),
  ]);
  assert(
    openDepositQueue.pagination.total === 1 &&
      openDepositQueue.items[0]?.id === request.id &&
      openDepositQueue.items[0]?.reconciliationStatus === 'UNMATCHED' &&
      openDepositQueue.items[0]?.reconciliationRemainingAmount === debtTotal,
    'Executed deposit did not enter the unresolved bank reconciliation queue',
    openDepositQueue,
  );
  assert(
    monthlySummaryWithOpenDeposit.partnerDepositReconciliationOpenCount ===
      monthlySummaryBefore.partnerDepositReconciliationOpenCount + 1 &&
      monthlySummaryWithOpenDeposit.partnerDepositReconciliationOpenAmount ===
        monthlySummaryBefore.partnerDepositReconciliationOpenAmount + debtTotal,
    'Monthly closing summary did not expose the unresolved Partner deposit',
    monthlySummaryWithOpenDeposit,
  );
  const reviewedClosing = await requestJson(
    `/admin/monthly-tax-closings/${period}/status`,
    makerAccessToken,
    {
      method: 'PATCH',
      body: {
        status: 'REVIEWED',
        notes: 'Local smoke review before Partner deposit bank reconciliation.',
      },
    },
  );
  assert(reviewedClosing.status === 'REVIEWED', 'Isolated monthly closing did not enter review', reviewedClosing);
  const blockedDeclaration = await requestJson(
    `/admin/monthly-tax-closings/${period}/status`,
    makerAccessToken,
    {
      method: 'PATCH',
      expectedStatus: 400,
      body: {
        status: 'DECLARED',
        notes: 'This declaration must remain blocked while Partner deposit evidence is open.',
      },
    },
  );
  assert(
    String(blockedDeclaration?.message ?? '').includes(
      'executed Partner bank deposit(s) without complete bank reconciliation',
    ),
    'Monthly closing declaration was not blocked by unresolved Partner deposit evidence',
    blockedDeclaration,
  );

  const importedBankTransaction = await requestJson('/admin/bank-reconciliation/transactions', makerAccessToken, {
    method: 'POST',
    body: {
      approvalAdminId: fixture.approver.id,
      amount: firstBankEvidenceAmount,
      bankAccountId: fixture.companyBankAccount.id,
      counterpartyName: 'Deposit Allocation Smoke Partner',
      currency: 'VND',
      description: 'Local-only Partner deposit bank inflow reconciliation smoke.',
      operatorReason: 'Record Partner deposit bank inflow evidence.',
      occurredAt: new Date().toISOString(),
      transferRef: bankTransactionId,
      type: 'INFLOW',
      valueDate: new Date().toISOString(),
    },
  });
  assert(importedBankTransaction.status === 'UNMATCHED', 'Imported bank inflow was not open for matching', importedBankTransaction);

  const bankCashJournalEntry = approvedDetail.journal.entries.find(
    (entry) => entry.side === 'DEBIT' && entry.accountCode === 'company_bank_cash',
  );
  assert(bankCashJournalEntry, 'Approved deposit does not expose a company bank cash debit entry', approvedDetail.journal);
  await requestJson(
    `/admin/bank-reconciliation/${importedBankTransaction.id}/review-assignment`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        assigneeAdminId: fixture.maker.id,
        reason: 'Assign Partner deposit bank evidence review.',
      },
    },
  );

  const reconciliation = await requestJson(
    `/admin/bank-reconciliation/${importedBankTransaction.id}/matches`,
    approverAccessToken,
    {
      method: 'POST',
      body: {
        approvalAdminId: fixture.approver.id,
        amount: firstBankEvidenceAmount,
        currency: 'VND',
        notes: 'Local-only Partner deposit reconciliation evidence.',
        partnerBankDepositRequestId: request.id,
      },
    },
  );
  assert(
    reconciliation.bankTransaction?.status === 'MATCHED' &&
      reconciliation.match?.accountingJournalEntryId === bankCashJournalEntry.id,
    'First split bank evidence did not resolve to the Partner deposit bank cash debit',
    reconciliation,
  );

  const [partiallyReconciledQueue, monthlySummaryAfterPartialMatch] = await Promise.all([
    requestJson(
      `/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=${period}&q=${request.id}`,
      makerAccessToken,
    ),
    requestJson(`/admin/monthly-tax-closings/summary?period=${period}`, makerAccessToken),
  ]);
  assert(
    partiallyReconciledQueue.pagination.total === 1 &&
      partiallyReconciledQueue.items[0]?.reconciliationStatus === 'PARTIALLY_MATCHED' &&
      partiallyReconciledQueue.items[0]?.reconciliationMatchedAmount === firstBankEvidenceAmount &&
      partiallyReconciledQueue.items[0]?.reconciliationRemainingAmount === remainingBankEvidenceAmount,
    'Split bank evidence did not leave the correct Partner deposit reconciliation remainder',
    partiallyReconciledQueue,
  );
  assert(
    monthlySummaryAfterPartialMatch.partnerDepositReconciliationOpenAmount ===
      monthlySummaryBefore.partnerDepositReconciliationOpenAmount + remainingBankEvidenceAmount,
    'Monthly closing summary did not reduce the open Partner deposit amount after partial matching',
    monthlySummaryAfterPartialMatch,
  );

  const secondSplitBankTransactionInput = {
    approvalAdminId: fixture.approver.id,
    amount: remainingBankEvidenceAmount,
    bankAccountId: fixture.companyBankAccount.id,
    counterpartyName: 'Deposit Allocation Smoke Partner',
    currency: 'VND',
    description: 'Second split Partner deposit bank inflow evidence.',
    operatorReason: 'Record second split Partner deposit bank evidence.',
    occurredAt: new Date().toISOString(),
    transferRef: `${bankTransactionId}-SPLIT-2`,
    type: 'INFLOW',
    valueDate: new Date().toISOString(),
  };
  const blockedPotentialDuplicate = await requestJson(
    '/admin/bank-reconciliation/transactions',
    makerAccessToken,
    {
      method: 'POST',
      expectedStatus: 409,
      body: secondSplitBankTransactionInput,
    },
  );
  assert(
    blockedPotentialDuplicate.code === 'BANK_TRANSACTION_POTENTIAL_DUPLICATE' &&
      blockedPotentialDuplicate.candidates?.some((candidate) => candidate.id === importedBankTransaction.id),
    'Potential duplicate bank evidence was not blocked with candidate details',
    blockedPotentialDuplicate,
  );
  const batchPreview = await requestJson(
    '/admin/bank-reconciliation/transactions/batch-preview',
    makerAccessToken,
    {
      method: 'POST',
      body: {
        rows: [
          {
            ...secondSplitBankTransactionInput,
            amount: String(secondSplitBankTransactionInput.amount),
            rowNumber: 2,
          },
          {
            amount: String(firstBankEvidenceAmount),
            bankAccountId: fixture.companyBankAccount.id,
            currency: 'VND',
            occurredAt: importedBankTransaction.occurredAt,
            rowNumber: 3,
            transferRef: bankTransactionId,
            type: 'INFLOW',
          },
          {
            amount: 'invalid-amount',
            bankAccountId: fixture.companyBankAccount.id,
            occurredAt: 'invalid-date',
            rowNumber: 4,
            type: 'INFLOW',
          },
          {
            amount: '1.234.567 VND',
            bankAccountId: fixture.companyBankAccount.id,
            occurredAt: '14/07/2026 08:30:15',
            rowNumber: 5,
            transferRef: `${bankTransactionId}-LOCAL-FORMAT`,
            type: 'INFLOW',
          },
        ],
      },
    },
  );
  assert(
      batchPreview.summary?.potentialDuplicate === 1 &&
      batchPreview.summary?.exactDuplicate === 1 &&
      batchPreview.summary?.invalid === 1 &&
      batchPreview.summary?.new === 1 &&
      batchPreview.rows?.find((row) => row.rowNumber === 2)?.classification === 'POTENTIAL_DUPLICATE' &&
      batchPreview.rows?.find((row) => row.rowNumber === 3)?.classification === 'EXACT_DUPLICATE' &&
      batchPreview.rows?.find((row) => row.rowNumber === 4)?.classification === 'INVALID' &&
      batchPreview.rows?.find((row) => row.rowNumber === 5)?.normalized?.amount === 1234567 &&
      batchPreview.rows?.find((row) => row.rowNumber === 5)?.normalized?.occurredAt ===
        '2026-07-14T01:30:15.000Z',
    'Bank statement batch preview did not classify potential, exact, and invalid rows',
    batchPreview,
  );
  const batchSourceFileName = 'hands-finance-smoke-bank-statement.csv';
  const batchSourceFileSha256 = createHash('sha256').update(`finance-smoke:${runId}`).digest('hex');
  const batchImport = await requestJson(
    '/admin/bank-reconciliation/transactions/batch-import',
    makerAccessToken,
    {
      method: 'POST',
      body: {
        mappingPreset: 'GENERIC',
        operatorReason: 'Import reviewed split Partner deposit bank evidence.',
        rows: [
          {
            ...secondSplitBankTransactionInput,
            amount: String(secondSplitBankTransactionInput.amount),
            confirmPotentialDuplicate: true,
            rowNumber: 2,
          },
        ],
        sourceFileName: batchSourceFileName,
        sourceFileSha256: batchSourceFileSha256,
      },
    },
  );
  assert(
    batchImport.batchImportId &&
      batchImport.importedCount === 1 &&
      batchImport.skippedCount === 0 &&
      batchImport.results?.[0]?.transactionId,
    'Reviewed bank statement batch row was not imported',
    batchImport,
  );
  const [batchImportedTransactionEvidence, batchImportAudit] = await Promise.all([
    prisma.companyBankTransaction.findUnique({
      where: { id: batchImport.results[0].transactionId },
      select: { metadata: true },
    }),
    prisma.adminAuditLog.findFirst({
      where: {
        action: 'company_bank_transaction.batch_import',
        target: `company_bank_transaction_batch:${batchImport.batchImportId}`,
      },
      select: { metadata: true },
    }),
  ]);
  assert(
    batchImportedTransactionEvidence?.metadata?.batchImportId === batchImport.batchImportId &&
      batchImportedTransactionEvidence.metadata.csvRowNumber === 2 &&
      batchImportedTransactionEvidence.metadata.mappingPreset === 'GENERIC' &&
      batchImportedTransactionEvidence.metadata.sourceFileName === batchSourceFileName &&
      batchImportedTransactionEvidence.metadata.sourceFileSha256 === batchSourceFileSha256 &&
      batchImportAudit?.metadata?.batchImportId === batchImport.batchImportId &&
      batchImportAudit.metadata.sourceFileName === batchSourceFileName &&
      batchImportAudit.metadata.sourceFileSha256 === batchSourceFileSha256,
    'Bank statement batch provenance was not persisted consistently',
    { batchImportAudit, batchImportedTransactionEvidence },
  );
  const batchImportHistory = await requestJson(
    '/admin/bank-reconciliation/import-batches?take=10&skip=0',
    makerAccessToken,
  );
  const retainedBatchHistory = batchImportHistory.items?.find(
    (item) => item.batchImportId === batchImport.batchImportId,
  );
  assert(
    retainedBatchHistory?.sourceFileName === batchSourceFileName &&
      retainedBatchHistory.sourceFileSha256 === batchSourceFileSha256 &&
      retainedBatchHistory.mappingPreset === 'GENERIC' &&
      retainedBatchHistory.importedCount === 1 &&
      retainedBatchHistory.reconciliationNeedsActionCount === 1 &&
      retainedBatchHistory.reconciliationProgressPercent === 0 &&
      retainedBatchHistory.reconciliationTransactionCount === 1 &&
      retainedBatchHistory.reconciledTransactionCount === 0 &&
      retainedBatchHistory.operator?.id === fixture.maker.id &&
      retainedBatchHistory.approver === null &&
      batchImportHistory.pagination?.take === 10,
    'Bank statement batch history did not retain maker-only provenance before assignment',
    batchImportHistory,
  );
  const openBatchImportHistory = await requestJson(
    '/admin/bank-reconciliation/import-batches?take=10&skip=0&review=needs-reconciliation',
    makerAccessToken,
  );
  assert(
    openBatchImportHistory.items?.some((item) => item.batchImportId === batchImport.batchImportId) &&
      openBatchImportHistory.items.find((item) => item.batchImportId === batchImport.batchImportId)
        ?.reconciliationNeedsActionCount === 1,
    'Bank statement batch reconciliation filter did not retain the open batch',
    openBatchImportHistory,
  );
  const staleBatchImportHistory = await requestJson(
    '/admin/bank-reconciliation/import-batches?take=10&skip=0&range=all&review=stale',
    makerAccessToken,
  );
  assert(
    Array.isArray(staleBatchImportHistory.items) &&
      Number.isInteger(staleBatchImportHistory.pagination?.total) &&
      !staleBatchImportHistory.items.some((item) => item.batchImportId === batchImport.batchImportId),
    'Fresh bank statement import appeared in the over-24-hours reconciliation queue',
    staleBatchImportHistory,
  );
  const escalatedBatchImportHistory = await requestJson(
    '/admin/bank-reconciliation/import-batches?take=10&skip=0&range=all&review=escalated',
    makerAccessToken,
  );
  assert(
    Array.isArray(escalatedBatchImportHistory.items) &&
      Number.isInteger(escalatedBatchImportHistory.pagination?.total) &&
      !escalatedBatchImportHistory.items.some((item) => item.batchImportId === batchImport.batchImportId),
    'Fresh bank statement import appeared in the over-48-hours escalation queue',
    escalatedBatchImportHistory,
  );
  const batchImportSummary = await requestJson(
    '/admin/bank-reconciliation/import-batches/summary',
    makerAccessToken,
  );
  assert(
    batchImportSummary.batchCount >= 1 &&
      Number.isInteger(batchImportSummary.escalatedNeedsReconciliationCount) &&
      batchImportSummary.needsReconciliationCount >= 1 &&
      Number.isInteger(batchImportSummary.staleNeedsReconciliationCount) &&
      batchImportSummary.oldestOpenImportedAt,
    'Bank statement batch summary did not expose the open import work queue',
    batchImportSummary,
  );
  const batchImportDetail = await requestJson(
    `/admin/bank-reconciliation/import-batches/${batchImport.batchImportId}`,
    makerAccessToken,
  );
  assert(
    batchImportDetail.batchImportId === batchImport.batchImportId &&
      batchImportDetail.rows?.length === 1 &&
      batchImportDetail.rows[0]?.rowNumber === 2 &&
      batchImportDetail.rows[0]?.status === 'IMPORTED' &&
      batchImportDetail.rows[0]?.transactionId === batchImport.results[0].transactionId &&
      batchImportDetail.rows[0]?.transaction?.id === batchImport.results[0].transactionId &&
      batchImportDetail.reconciliationNeedsActionCount === 1 &&
      batchImportDetail.reconciliationProgressPercent === 0,
    'Bank statement batch detail did not retain the imported CSV row outcome',
    batchImportDetail,
  );
  const batchAssignment = await requestJson(
    `/admin/bank-reconciliation/import-batches/${batchImport.batchImportId}/assignment`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        assigneeAdminId: fixture.approver.id,
        reason: 'Own the Finance smoke reconciliation batch',
      },
    },
  );
  const [assignedBatchDetail, assignmentAudit, assignmentNotification] = await Promise.all([
    requestJson(
      `/admin/bank-reconciliation/import-batches/${batchImport.batchImportId}`,
      makerAccessToken,
    ),
    prisma.adminAuditLog.findFirst({
      where: {
        action: 'company_bank_transaction.batch_assignment',
        target: `company_bank_transaction_batch:${batchImport.batchImportId}`,
      },
      select: { actorId: true, metadata: true },
    }),
    prisma.notification.findFirst({
      where: {
        type: 'admin.finance.bank_statement_batch.assigned',
        userId: fixture.approver.id,
      },
      orderBy: { createdAt: 'desc' },
      select: { data: true, id: true },
    }),
  ]);
  assert(
    batchAssignment.assignee?.id === fixture.approver.id &&
      batchAssignment.notification?.inAppOnly === true &&
      assignedBatchDetail.assignee?.id === fixture.approver.id &&
      assignedBatchDetail.assigneeAdminId === fixture.approver.id &&
      assignmentAudit?.actorId === fixture.maker.id &&
      assignmentAudit.metadata?.reason === 'Own the Finance smoke reconciliation batch' &&
      assignmentNotification?.data?.batchImportId === batchImport.batchImportId,
    'Bank statement batch assignment did not retain owner, audit, and in-app notification evidence',
    { assignedBatchDetail, assignmentAudit, assignmentNotification, batchAssignment },
  );
  await requestJson(
    `/admin/bank-reconciliation/import-batches/${batchImport.batchImportId}/assignment`,
    makerAccessToken,
    {
      method: 'POST',
      expectedStatus: 409,
      body: {
        assigneeAdminId: fixture.approver.id,
        reason: 'Duplicate assignment must be blocked',
      },
    },
  );
  const secondImportedBankTransaction = await requestJson(
    `/admin/bank-reconciliation/${batchImport.results[0].transactionId}`,
    makerAccessToken,
  );
  await requestJson(
    `/admin/bank-reconciliation/${secondImportedBankTransaction.id}/review-assignment`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        assigneeAdminId: fixture.maker.id,
        reason: 'Assign split Partner deposit transaction review.',
      },
    },
  );
  const secondReconciliation = await requestJson(
    `/admin/bank-reconciliation/${secondImportedBankTransaction.id}/matches`,
    approverAccessToken,
    {
      method: 'POST',
      body: {
        approvalAdminId: fixture.approver.id,
        amount: remainingBankEvidenceAmount,
        currency: 'VND',
        notes: 'Second split Partner deposit reconciliation evidence.',
        partnerBankDepositRequestId: request.id,
      },
    },
  );

  const [bankTransactionDetail, reconciledDepositDetail] = await Promise.all([
    requestJson(`/admin/bank-reconciliation/${importedBankTransaction.id}`, approverAccessToken),
    requestJson(`/admin/provider-wallet/deposit-requests/${request.id}`, makerAccessToken),
  ]);
  assert(
    bankTransactionDetail.reconciliationMatches?.some(
      (match) =>
        match.accountingJournalEntryId === bankCashJournalEntry.id &&
        match.accountingJournalEntry?.metadata?.partnerBankDepositRequestId === request.id,
    ),
    'Bank transaction detail does not expose the Partner deposit journal evidence',
    bankTransactionDetail,
  );
  assert(
    bankTransactionDetail.preflight?.remainingAmount === 0 &&
      bankTransactionDetail.preflight.actions.createMatch.allowed === false &&
      bankTransactionDetail.preflight.actions.ignore.allowed === false &&
      bankTransactionDetail.preflight.actions.reverse.allowedMatchIds.length > 0,
    'Fully reconciled bank detail did not expose authoritative final-action preflight',
    bankTransactionDetail.preflight,
  );
  assert(
    reconciledDepositDetail.journal.entries.some((entry) =>
      entry.bankReconciliationMatches?.some(
        (match) =>
          [importedBankTransaction.id, secondImportedBankTransaction.id].includes(match.bankTransactionId) &&
          match.status === 'MATCHED',
      ),
    ),
    'Partner deposit detail does not expose the matched bank inflow',
    reconciledDepositDetail,
  );
  const [resolvedDepositQueue, monthlySummaryAfterMatch] = await Promise.all([
    requestJson(
      `/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=${period}&q=${request.id}`,
      makerAccessToken,
    ),
    requestJson(`/admin/monthly-tax-closings/summary?period=${period}`, makerAccessToken),
  ]);
  assert(
    resolvedDepositQueue.pagination.total === 0 && resolvedDepositQueue.items.length === 0,
    'Fully matched Partner deposit remained in the unresolved reconciliation queue',
    resolvedDepositQueue,
  );
  assert(
    monthlySummaryAfterMatch.partnerDepositReconciliationOpenCount ===
      monthlySummaryBefore.partnerDepositReconciliationOpenCount &&
      monthlySummaryAfterMatch.partnerDepositReconciliationOpenAmount ===
        monthlySummaryBefore.partnerDepositReconciliationOpenAmount,
    'Monthly closing summary did not clear the fully matched Partner deposit',
    monthlySummaryAfterMatch,
  );

  await requestJson(
    `/admin/bank-reconciliation/${secondImportedBankTransaction.id}/matches/${secondReconciliation.match.id}/reverse`,
    approverAccessToken,
    {
      method: 'POST',
      body: {
        approvalAdminId: fixture.approver.id,
        reason: 'Local smoke reversal of incorrect split evidence.',
      },
    },
  );
  const [reopenedDepositQueue, monthlySummaryAfterReversal] = await Promise.all([
    requestJson(
      `/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=${period}&q=${request.id}`,
      makerAccessToken,
    ),
    requestJson(`/admin/monthly-tax-closings/summary?period=${period}`, makerAccessToken),
  ]);
  assert(
    reopenedDepositQueue.pagination.total === 1 &&
      reopenedDepositQueue.items[0]?.reconciliationStatus === 'PARTIALLY_MATCHED' &&
      reopenedDepositQueue.items[0]?.reconciliationRemainingAmount === remainingBankEvidenceAmount,
    'Reversed bank evidence did not restore the Partner deposit reconciliation remainder',
    reopenedDepositQueue,
  );
  assert(
    monthlySummaryAfterReversal.partnerDepositReconciliationOpenAmount ===
      monthlySummaryBefore.partnerDepositReconciliationOpenAmount + remainingBankEvidenceAmount,
    'Monthly closing summary did not restore the reversed Partner deposit evidence amount',
    monthlySummaryAfterReversal,
  );

  const ignoredReversedBankTransaction = await requestJson(
    `/admin/bank-reconciliation/${secondImportedBankTransaction.id}/ignore`,
    approverAccessToken,
    {
      method: 'POST',
      body: {
        approvalAdminId: fixture.approver.id,
        reason: 'Local smoke duplicate bank evidence after reconciliation reversal.',
      },
    },
  );
  assert(
    ignoredReversedBankTransaction.bankTransaction?.status === 'IGNORED',
    'Reversed unmatched bank evidence was not ignored with approval',
    ignoredReversedBankTransaction,
  );
  await requestJson(
    `/admin/bank-reconciliation/${secondImportedBankTransaction.id}/matches`,
    approverAccessToken,
    {
      method: 'POST',
      expectedStatus: 400,
      body: {
        approvalAdminId: fixture.approver.id,
        amount: remainingBankEvidenceAmount,
        currency: 'VND',
        notes: 'Ignored evidence must not be reusable for reconciliation.',
        partnerBankDepositRequestId: request.id,
      },
    },
  );
  const [ignoredBankTransactionDetail, ignoredDepositQueue, monthlySummaryAfterIgnore] = await Promise.all([
    requestJson(`/admin/bank-reconciliation/${secondImportedBankTransaction.id}`, makerAccessToken),
    requestJson(
      `/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=${period}&q=${request.id}`,
      makerAccessToken,
    ),
    requestJson(`/admin/monthly-tax-closings/summary?period=${period}`, makerAccessToken),
  ]);
  assert(
    ignoredBankTransactionDetail.status === 'IGNORED' &&
      ignoredBankTransactionDetail.ignoreEvidence?.approvalAdminId === fixture.approver.id &&
      typeof ignoredBankTransactionDetail.ignoreEvidence?.reason === 'string' &&
      ignoredBankTransactionDetail.metadata === undefined,
    'Ignored bank transaction detail did not retain approval and reason evidence',
    ignoredBankTransactionDetail,
  );
  assert(
    ignoredBankTransactionDetail.preflight?.actions.createMatch.allowed === false &&
      ignoredBankTransactionDetail.preflight.actions.ignore.allowed === false,
    'Ignored bank detail did not remain blocked in authoritative preflight',
    ignoredBankTransactionDetail.preflight,
  );
  assert(
    ignoredDepositQueue.pagination.total === 1 &&
      ignoredDepositQueue.items[0]?.reconciliationRemainingAmount === remainingBankEvidenceAmount,
    'Ignoring bank evidence incorrectly cleared the Partner deposit obligation',
    ignoredDepositQueue,
  );
  assert(
    monthlySummaryAfterIgnore.partnerDepositReconciliationOpenAmount ===
      monthlySummaryAfterReversal.partnerDepositReconciliationOpenAmount,
    'Ignoring bank evidence incorrectly changed the monthly close Partner deposit risk',
    monthlySummaryAfterIgnore,
  );

  const replacementBankTransaction = await requestJson(
    '/admin/bank-reconciliation/transactions',
    makerAccessToken,
    {
      method: 'POST',
      body: {
        approvalAdminId: fixture.approver.id,
        amount: remainingBankEvidenceAmount,
        bankAccountId: fixture.companyBankAccount.id,
        counterpartyName: 'Deposit Allocation Smoke Partner',
        confirmPotentialDuplicate: true,
        currency: 'VND',
        description: 'Replacement Partner deposit bank inflow evidence after reversal.',
        operatorReason: 'Record replacement Partner deposit bank evidence.',
        occurredAt: new Date().toISOString(),
        transferRef: `${bankTransactionId}-REPLACEMENT`,
        type: 'INFLOW',
        valueDate: new Date().toISOString(),
      },
    },
  );
  await requestJson(
    `/admin/bank-reconciliation/${replacementBankTransaction.id}/review-assignment`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        assigneeAdminId: fixture.maker.id,
        reason: 'Assign replacement Partner deposit evidence review.',
      },
    },
  );
  await requestJson(
    `/admin/bank-reconciliation/${replacementBankTransaction.id}/matches`,
    approverAccessToken,
    {
      method: 'POST',
      body: {
        approvalAdminId: fixture.approver.id,
        amount: remainingBankEvidenceAmount,
        currency: 'VND',
        notes: 'Replacement Partner deposit reconciliation evidence.',
        partnerBankDepositRequestId: request.id,
      },
    },
  );
  const finalResolvedDepositQueue = await requestJson(
    `/admin/provider-wallet/deposit-requests/history?take=25&skip=0&review=needs-reconciliation&period=${period}&q=${request.id}`,
    makerAccessToken,
  );
  assert(
    finalResolvedDepositQueue.pagination.total === 0,
    'Replacement evidence did not clear the Partner deposit reconciliation queue',
    finalResolvedDepositQueue,
  );
  const declaredClosing = await requestJson(
    `/admin/monthly-tax-closings/${period}/status`,
    makerAccessToken,
    {
      method: 'PATCH',
      body: {
        status: 'DECLARED',
        notes: 'Local smoke declaration after complete Partner deposit bank reconciliation.',
      },
    },
  );
  assert(
    declaredClosing.status === 'DECLARED',
    'Monthly closing declaration did not advance after Partner deposit evidence was resolved',
    declaredClosing,
  );

  const evidenceCountsBeforeAllocation = {
    journals: await prisma.accountingJournalBatch.count({
      where: { providerProfileId: fixture.providerProfileId },
    }),
    journalEntries: await prisma.accountingJournalEntry.count({
      where: { batch: { providerProfileId: fixture.providerProfileId } },
    }),
    walletEntries: await prisma.providerWalletLedgerEntry.count({
      where: { providerProfileId: fixture.providerProfileId },
    }),
  };

  const firstEarning = fixture.bookings[0].earning;
  const firstAllocation = await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}/cash-debt-allocations`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        earningId: firstEarning.id,
        amount: Math.abs(firstEarning.netAmount),
        notes: 'First local smoke evidence allocation.',
      },
    },
  );
  assert(
    firstAllocation.cashDebtFullyAllocated === true,
    'First cash debt was not fully linked',
    firstAllocation,
  );
  assert(
    firstAllocation.remainingReceivableRecovery === debtTotal - Math.abs(firstEarning.netAmount),
    'Partial request allocation remainder is incorrect',
    firstAllocation,
  );

  await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}/cash-debt-allocations`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        earningId: firstEarning.id,
        amount: 1,
        notes: 'Duplicate allocation must remain blocked by the business guard.',
      },
      expectedStatus: 409,
    },
  );

  const secondEarning = fixture.bookings[1].earning;
  const secondAllocation = await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}/cash-debt-allocations`,
    makerAccessToken,
    {
      method: 'POST',
      body: {
        earningId: secondEarning.id,
        amount: Math.abs(secondEarning.netAmount),
        notes: 'Final local smoke evidence allocation.',
      },
    },
  );
  assert(
    secondAllocation.remainingReceivableRecovery === 0,
    'Deposit was not fully allocated',
    secondAllocation,
  );

  const finalDetail = await requestJson(
    `/admin/provider-wallet/deposit-requests/${request.id}`,
    makerAccessToken,
  );
  const history = await requestJson(
    `/admin/provider-wallet/deposit-requests/history?status=EXECUTED&q=${encodeURIComponent(bankTransactionId)}&take=10&skip=0`,
    makerAccessToken,
  );
  assert(
    finalDetail.request.cashDebtAllocations.length === 2,
    'Detail does not show both allocations',
    finalDetail,
  );
  assert(
    finalDetail.remainingReceivableRecovery === 0,
    'Detail still shows unallocated recovery',
    finalDetail,
  );
  assert(
    finalDetail.availableCashDebts.length === 0,
    'Fully allocated debts remain in the open queue',
    finalDetail,
  );
  assert(
    history.pagination.total === 1 && history.items[0]?.allocatedCashDebtAmount === debtTotal,
    'History does not expose the fully allocated deposit',
    history,
  );

  const [walletBalance, evidenceCountsAfterAllocation, paidEarnings, allocationAuditLogs] = await Promise.all(
    [
      prisma.providerWalletLedgerEntry.aggregate({
        where: { providerProfileId: fixture.providerProfileId },
        _sum: { amount: true },
      }),
      Promise.all([
        prisma.accountingJournalBatch.count({ where: { providerProfileId: fixture.providerProfileId } }),
        prisma.accountingJournalEntry.count({
          where: { batch: { providerProfileId: fixture.providerProfileId } },
        }),
        prisma.providerWalletLedgerEntry.count({ where: { providerProfileId: fixture.providerProfileId } }),
      ]),
      prisma.providerEarning.findMany({
        where: { id: { in: [firstEarning.id, secondEarning.id] } },
        select: { id: true, settlementMethod: true, status: true },
      }),
      prisma.adminAuditLog.findMany({
        where: {
          action: 'partner_bank_deposit.cash_debt_allocate',
          target: `partner_bank_deposit_request:${request.id}`,
        },
        select: { metadata: true },
      }),
    ],
  );
  assert(
    walletBalance._sum.amount === 0,
    'Approved deposit did not clear the fixture wallet debt',
    walletBalance,
  );
  assert(
    evidenceCountsAfterAllocation[0] === evidenceCountsBeforeAllocation.journals &&
      evidenceCountsAfterAllocation[1] === evidenceCountsBeforeAllocation.journalEntries &&
      evidenceCountsAfterAllocation[2] === evidenceCountsBeforeAllocation.walletEntries,
    'Cash-debt evidence allocation created duplicate Wallet or GL evidence',
    { evidenceCountsAfterAllocation, evidenceCountsBeforeAllocation },
  );
  assert(
    paidEarnings.length === 2 &&
      paidEarnings.every(
        (earning) => earning.status === 'PAID' && earning.settlementMethod === 'PARTNER_DEPOSIT',
      ),
    'Fully allocated cash debts were not closed with Partner deposit evidence',
    paidEarnings,
  );
  assert(
    allocationAuditLogs.length === 2 &&
      allocationAuditLogs.every(
        (log) =>
          log.metadata?.createsWalletLedgerEntry === false &&
          log.metadata?.createsAccountingJournalEntry === false,
      ),
    'Allocation audit evidence does not explicitly prove non-duplication',
    allocationAuditLogs,
  );

  completed = true;
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        checks: {
          cleanup: 'pending',
          dualApproval: true,
          fullAllocation: true,
          historyAndDetail: true,
          journalBalanced: true,
          bankReconciliationLinked: true,
          bankReconciliationQueue: true,
          bankReconciliationPartialMatch: true,
          bankImportDuplicateReviewGuard: true,
          bankStatementBatchPreviewAndImport: true,
          bankStatementBatchProvenance: true,
          bankStatementBatchHistory: true,
          bankStatementBatchDetail: true,
          bankStatementBatchAssignmentAndNotification: true,
          bankReconciliationReversalRestore: true,
          ignoredReversedBankEvidence: true,
          ignoreDoesNotClearDepositObligation: true,
          monthlyCloseDepositGateSummary: true,
          monthlyCloseDepositGuardLive: true,
          noDuplicateWalletOrJournal: true,
          partialAllocation: true,
        },
      },
      null,
      2,
    ),
  );
} finally {
  try {
    await cleanupFixture(prisma, fixture, runId, bankTransactionId, period);
    if (completed) {
      console.log(JSON.stringify({ status: 'cleanup-passed' }));
    }
  } finally {
    await prisma.$disconnect();
  }
}
