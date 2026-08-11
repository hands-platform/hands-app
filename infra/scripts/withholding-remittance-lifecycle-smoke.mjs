import { randomUUID } from 'node:crypto';

import {
  AccountingJournalSourceType,
  BookingStatus,
  MonthlyTaxClosingStatus,
  PaymentFeePayer,
  PaymentFeeRuleType,
  PaymentFeeTreatment,
  PaymentMethod,
  PrismaClient,
  Role,
  TaxPolicyStatus,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const apiBaseUrl = (env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
const runId = `withholding_smoke_${randomUUID()}`;
const year = 7000 + (Date.now() % 1000);
const period = `${year}-11`;
const currency = 'VND';
const partnerWithholdingTotal = 105_000;
const paidAt = `${period}-28T10:00:00.000Z`;
const evidenceUrl = `https://evidence.example.test/${runId}.pdf`;
const transferRef = `SMOKE-WHT-${randomUUID()}`;
const ids = {
  actor: `${runId}_actor`,
  approver: `${runId}_approver`,
  nonFinance: `${runId}_non_finance`,
  customerUser: `${runId}_customer_user`,
  customerProfile: `${runId}_customer_profile`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  booking: `${runId}_booking`,
  paymentFeePolicy: `${runId}_payment_fee_policy`,
  paymentFeeRule: `${runId}_payment_fee_rule`,
  reconciliationJournal: `${runId}_reconciliation_journal`,
  reversal: `${runId}_reversal`,
  settlement: `${runId}_settlement`,
};
const settlementSourceKey = `${runId}:settlement`;
const journalSourceKey = `accounting-journal:withholding-remittance:${period}:${currency}`;
const reconciliationJournalSourceKey = `${runId}:reconciliation-delta`;
const reversalSourceKey = `${runId}:reversal`;
const prisma = new PrismaClient({ datasources: { db: { url: requiredEnv('DATABASE_URL') } } });

assertLocalFixtureMode();

try {
  await request('/health');
  await cleanup();
  await seed();

  const actorToken = adminToken(ids.actor, [Role.ADMIN, Role.MASTER_ADMIN]);
  await updateStatus(actorToken, MonthlyTaxClosingStatus.REVIEWED, {
    notes: 'Local smoke withholding review.',
  });
  await updateStatus(actorToken, MonthlyTaxClosingStatus.DECLARED, {
    notes: 'Local smoke withholding declaration.',
  });

  await expectFailure(MonthlyTaxClosingStatus.PAID, actorToken, {
    approvalAdminId: ids.actor,
    notes: 'Same actor must not approve remittance.',
    paidAt,
    remittanceChannel: 'MANUAL_BANK_TRANSFER',
    remittanceEvidenceUrl: evidenceUrl,
    remittanceTransferRef: transferRef,
  }, 400);
  await expectFailure(MonthlyTaxClosingStatus.PAID, actorToken, {
    approvalAdminId: ids.nonFinance,
    notes: 'Non-finance actor must not approve remittance.',
    paidAt,
    remittanceChannel: 'MANUAL_BANK_TRANSFER',
    remittanceEvidenceUrl: evidenceUrl,
    remittanceTransferRef: transferRef,
  }, 400);

  const paid = await updateStatus(actorToken, MonthlyTaxClosingStatus.PAID, {
    approvalAdminId: ids.approver,
    notes: 'Local smoke withholding remittance paid.',
    paidAt,
    remittanceChannel: 'MANUAL_BANK_TRANSFER',
    remittanceEvidenceUrl: evidenceUrl,
    remittanceTransferRef: transferRef,
  });
  assertCondition(
    paid.status === MonthlyTaxClosingStatus.PAID &&
      paid.partnerWithholdingTotal === partnerWithholdingTotal &&
      paid.remittanceMetadata?.transferRef === transferRef &&
      paid.remittanceMetadata?.evidenceUrl === evidenceUrl &&
      paid.remittanceMetadata?.approvedByAdminId === ids.approver &&
      paid.remittanceMetadata?.remittedByAdminId === ids.actor,
    'Paid withholding closing response did not preserve approval and evidence.',
  );

  await expectFailure(MonthlyTaxClosingStatus.PAID, actorToken, {
    approvalAdminId: ids.approver,
    notes: 'Attempt to replace paid evidence.',
    paidAt,
    remittanceChannel: 'MANUAL_BANK_TRANSFER',
    remittanceEvidenceUrl: `${evidenceUrl}?replacement=true`,
    remittanceTransferRef: `${transferRef}-replacement`,
  }, 409);

  const beforeClose = await verifyPaidState();
  await prisma.accountingJournalBatch.update({
    where: { sourceKey: journalSourceKey },
    data: { status: 'DRAFT' },
  });
  const unpostedSummary = await request(
    `/admin/monthly-tax-closings/summary?period=${period}`,
    { token: actorToken },
  );
  assertCondition(
    unpostedSummary.preflight?.nextStatus === MonthlyTaxClosingStatus.CLOSED &&
      unpostedSummary.preflight?.ready === false &&
      hasPreflightBlocker(unpostedSummary, 'REMITTANCE_JOURNAL'),
    'Monthly close preflight did not expose the unposted remittance journal blocker.',
  );
  await expectFailure(
    MonthlyTaxClosingStatus.CLOSED,
    actorToken,
    { notes: 'Unposted withholding remittance journal must block close.' },
    400,
    'posted Partner withholding remittance journal',
  );
  await prisma.accountingJournalBatch.update({
    where: { sourceKey: journalSourceKey },
    data: { status: 'POSTED' },
  });

  await seedReversalAfterRemittance(paid.id);
  const reversalSummary = await request(`/admin/monthly-tax-closings/summary?period=${period}`, {
    token: actorToken,
  });
  assertCondition(
    reversalSummary.reversalCount === 1 &&
      reversalSummary.partnerWithholdingTotal === partnerWithholdingTotal - 10_500 &&
      reversalSummary.preflight?.ready === false &&
      hasPreflightBlocker(reversalSummary, 'REMITTANCE_AMOUNT_MISMATCH'),
    'Monthly close summary did not apply the reversal or expose its remittance mismatch blocker.',
  );
  await expectFailure(
    MonthlyTaxClosingStatus.CLOSED,
    actorToken,
    { notes: 'Reversal-adjusted withholding mismatch must block close.' },
    400,
    'current reversal-adjusted withholding balance',
  );
  await prisma.bookingSettlementReversalEntry.delete({ where: { id: ids.reversal } });

  const readySummary = await request(`/admin/monthly-tax-closings/summary?period=${period}`, {
    token: actorToken,
  });
  assertCondition(
    readySummary.preflight?.nextStatus === MonthlyTaxClosingStatus.CLOSED &&
      readySummary.preflight?.ready === true &&
      readySummary.preflight?.blockers?.length === 0,
    'Monthly close preflight did not become ready after remittance evidence and journal amounts matched.',
  );

  await seedReconciliationDeltaJournal();
  const reconciliationSummary = await request(
    `/admin/monthly-tax-closings/summary?period=${period}`,
    { token: actorToken },
  );
  assertCondition(
    reconciliationSummary.preflight?.ready === false &&
      hasPreflightBlocker(reconciliationSummary, 'POSTED_JOURNAL_DELTA'),
    'Monthly close preflight did not expose the posted journal reconciliation blocker.',
  );
  await expectFailure(
    MonthlyTaxClosingStatus.CLOSED,
    actorToken,
    { notes: 'Open reconciliation delta must block close.' },
    400,
    'posted journal reconciliation deltas',
  );
  await prisma.accountingJournalBatch.delete({ where: { id: ids.reconciliationJournal } });

  const closed = await updateStatus(actorToken, MonthlyTaxClosingStatus.CLOSED, {
    notes: 'Local smoke withholding period close.',
  });
  assertCondition(closed.status === MonthlyTaxClosingStatus.CLOSED, 'Paid withholding period did not close.');
  await expectFailure(MonthlyTaxClosingStatus.REVIEWED, actorToken, {
    notes: 'Closed period direct edit must fail.',
  }, 400);

  const finalSnapshot = await prisma.bookingSettlementSnapshot.findUnique({ where: { id: ids.settlement } });
  assertCondition(
    finalSnapshot?.taxStatus === 'CLOSED' && Boolean(finalSnapshot.monthlyClosingId),
    'Closed period did not retain the settlement closing link.',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          closedPeriodDirectEditBlocked: true,
          declaredPaidClosedInOrder: true,
          financeApproverRequired: true,
          journalBalanced: beforeClose.journalBalanced,
          paidEvidenceImmutable: true,
          remittanceEvidenceStored: true,
          sameActorApprovalBlocked: true,
          settlementTaxStatusClosed: finalSnapshot.taxStatus === 'CLOSED',
          withholdingPayableCleared: beforeClose.payableDebit === partnerWithholdingTotal,
          companyBankCashCredited: beforeClose.bankCredit === partnerWithholdingTotal,
          openReconciliationDeltaBlocked: true,
          preflightPostedJournalBlockerExposed: true,
          preflightReadyAfterEvidenceMatched: true,
          reversalAdjustedRemittanceMismatchBlocked: true,
          reversalAdjustedRemittanceMismatchExposed: true,
          reversalIncludedInPreflightSummary: true,
          unpostedRemittanceJournalBlocked: true,
          unpostedRemittanceJournalExposed: true,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => {
    console.error(`Withholding remittance smoke cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
  await prisma.$disconnect();
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: ids.actor, phone: smokePhone('01'), fullName: 'Withholding Smoke Master', roles: [Role.ADMIN, Role.MASTER_ADMIN] },
      { id: ids.approver, phone: smokePhone('02'), fullName: 'Withholding Smoke Finance Approver', roles: [Role.ADMIN, Role.FINANCE_APPROVER] },
      { id: ids.nonFinance, phone: smokePhone('03'), fullName: 'Withholding Smoke Non Finance', roles: [Role.ADMIN] },
      { id: ids.customerUser, phone: smokePhone('04'), fullName: 'Withholding Smoke Customer', roles: [Role.CUSTOMER] },
      { id: ids.providerUser, phone: smokePhone('05'), fullName: 'Withholding Smoke Partner', roles: [Role.PROVIDER] },
    ],
  });
  await prisma.customerProfile.create({ data: { id: ids.customerProfile, userId: ids.customerUser } });
  await prisma.providerProfile.create({
    data: { id: ids.providerProfile, userId: ids.providerUser, displayName: 'Withholding Smoke Partner' },
  });
  await prisma.booking.create({
    data: {
      id: ids.booking,
      address: { addressText: 'Local smoke settlement address' },
      customerProfileId: ids.customerProfile,
      lat: 10.7769,
      lng: 106.7009,
      scheduledStartAt: new Date(`${period}-15T03:00:00.000Z`),
      scheduledEndAt: new Date(`${period}-15T04:00:00.000Z`),
      selectedProviderId: ids.providerProfile,
      status: BookingStatus.COMPLETED,
    },
  });
  await prisma.paymentFeePolicyVersion.create({
    data: {
      effectiveFrom: new Date(`${period}-01T00:00:00.000Z`),
      effectiveTo: new Date(`${period}-30T23:59:59.999Z`),
      id: ids.paymentFeePolicy,
      name: `Local smoke payment fee ${period}`,
      notes: 'Temporary local withholding remittance evidence.',
      status: TaxPolicyStatus.ACTIVE,
      rules: {
        create: {
          active: true,
          feeType: PaymentFeeRuleType.RATE,
          fixedAmount: 0,
          id: ids.paymentFeeRule,
          method: PaymentMethod.CARD,
          payer: PaymentFeePayer.HANDS,
          rateBps: 0,
          treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
        },
      },
    },
  });
  await prisma.bookingSettlementSnapshot.create({
    data: {
      bookingId: ids.booking,
      companyOutputVat: 17_727,
      currency,
      customerPaymentAmount: 1_000_000,
      customerProfileId: ids.customerProfile,
      id: ids.settlement,
      metadata: { localSmoke: true, runId },
      monthlyPeriod: period,
      partnerPayoutAmount: 700_000,
      partnerPitAmount: 35_000,
      partnerPitRateBps: 500,
      partnerTaxableRevenue: 700_000,
      partnerVatAmount: 70_000,
      partnerVatRateBps: 1_000,
      partnerWithholdingTotal,
      paymentFeeFixedAmount: 0,
      paymentFeePayer: PaymentFeePayer.HANDS,
      paymentFeePolicyVersionId: ids.paymentFeePolicy,
      paymentFeeRateBps: 0,
      paymentFeeRuleSnapshot: {
        feeType: PaymentFeeRuleType.RATE,
        fixedAmount: 0,
        localSmoke: true,
        method: PaymentMethod.CARD,
        payer: PaymentFeePayer.HANDS,
        rateBps: 0,
        ruleId: ids.paymentFeeRule,
        treatment: PaymentFeeTreatment.OPERATING_EXPENSE,
      },
      paymentFeeTreatment: PaymentFeeTreatment.OPERATING_EXPENSE,
      paymentMethod: PaymentMethod.CARD,
      paymentProcessingFee: 0,
      platformFeeGross: 195_000,
      platformFeeNetRevenue: 177_273,
      platformVatRateBps: 1_000,
      providerProfileId: ids.providerProfile,
      sourceKey: settlementSourceKey,
    },
  });
}

async function updateStatus(token, status, input) {
  return request(`/admin/monthly-tax-closings/${period}/status`, {
    body: { status, ...input },
    method: 'PATCH',
    token,
  });
}

async function expectFailure(status, token, input, expectedStatus, expectedMessage) {
  const body = await requestFailure(`/admin/monthly-tax-closings/${period}/status`, {
    body: { status, ...input },
    expectedStatus,
    method: 'PATCH',
    token,
  });
  if (expectedMessage) {
    assertCondition(
      JSON.stringify(body).includes(expectedMessage),
      `Expected monthly close failure containing "${expectedMessage}", received ${JSON.stringify(body)}.`,
    );
  }
  return body;
}

async function seedReversalAfterRemittance(monthlyClosingId) {
  await prisma.bookingSettlementReversalEntry.create({
    data: {
      bookingId: ids.booking,
      companyOutputVat: -1_773,
      createdById: ids.actor,
      currency,
      customerPaymentAmount: -100_000,
      customerProfileId: ids.customerProfile,
      id: ids.reversal,
      monthlyPeriod: period,
      occurredAt: new Date(`${period}-29T03:00:00.000Z`),
      originalMonthlyClosingId: monthlyClosingId,
      originalMonthlyPeriod: period,
      originalSettlementSnapshotId: ids.settlement,
      partnerPitAmount: -3_500,
      partnerPayoutAmount: -70_000,
      partnerTaxableRevenue: -70_000,
      partnerVatAmount: -7_000,
      partnerWithholdingTotal: -10_500,
      paymentMethod: PaymentMethod.CARD,
      platformFeeGross: -19_500,
      platformFeeNetRevenue: -17_727,
      providerProfileId: ids.providerProfile,
      reason: 'Self-cleaning post-remittance reversal preflight fixture.',
      sourceKey: reversalSourceKey,
    },
  });
}

async function seedReconciliationDeltaJournal() {
  await prisma.accountingJournalBatch.create({
    data: {
      createdById: ids.actor,
      currency,
      id: ids.reconciliationJournal,
      metadata: { reconciliationDelta: 1, selfCleaningSmoke: true },
      monthlyPeriod: period,
      sourceId: ids.booking,
      sourceKey: reconciliationJournalSourceKey,
      sourceType: AccountingJournalSourceType.BOOKING_SETTLEMENT,
      status: 'POSTED',
      totalCredit: 0,
      totalDebit: 0,
    },
  });
}

async function verifyPaidState() {
  const [journal, closing, snapshot] = await Promise.all([
    prisma.accountingJournalBatch.findUnique({ where: { sourceKey: journalSourceKey }, include: { entries: true } }),
    prisma.monthlyTaxClosing.findUnique({ where: { period_currency: { period, currency } } }),
    prisma.bookingSettlementSnapshot.findUnique({ where: { id: ids.settlement } }),
  ]);
  const debit = journal?.entries.filter((entry) => entry.side === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const credit = journal?.entries.filter((entry) => entry.side === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const payableDebit = journal?.entries
    .filter((entry) => entry.side === 'DEBIT' && entry.accountCode === 'partner_vat_pit_payable')
    .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const bankCredit = journal?.entries
    .filter((entry) => entry.side === 'CREDIT' && entry.accountCode === 'company_bank_cash')
    .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
  const journalBalanced =
    debit === partnerWithholdingTotal &&
    credit === partnerWithholdingTotal &&
    journal?.totalDebit === debit &&
    journal?.totalCredit === credit;
  assertCondition(journal?.sourceType === AccountingJournalSourceType.WITHHOLDING_REMITTANCE, 'Withholding remittance journal source type mismatch.');
  assertCondition(journalBalanced, 'Withholding remittance journal is not balanced.');
  assertCondition(payableDebit === partnerWithholdingTotal, 'Withholding payable was not debited by the remitted amount.');
  assertCondition(bankCredit === partnerWithholdingTotal, 'Company bank cash was not credited by the remitted amount.');
  assertCondition(closing?.remittanceMetadata?.transferRef === transferRef, 'Paid evidence was replaced after closeout.');
  assertCondition(snapshot?.taxStatus === 'PAID' && snapshot.monthlyClosingId === closing?.id, 'Paid closing did not link its settlement snapshot.');
  return { bankCredit, journalBalanced, payableDebit };
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
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function requestFailure(path, options) {
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
  await prisma.accountingJournalBatch.deleteMany({
    where: { OR: [{ sourceKey: journalSourceKey }, { monthlyPeriod: period }] },
  });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: [ids.actor, ids.approver, ids.nonFinance] } } });
  await prisma.bookingSettlementReversalEntry.deleteMany({
    where: { OR: [{ id: ids.reversal }, { sourceKey: reversalSourceKey }] },
  });
  await prisma.bookingSettlementSnapshot.deleteMany({ where: { id: ids.settlement } });
  await prisma.monthlyTaxClosing.deleteMany({ where: { period, currency } });
  await prisma.paymentFeeRule.deleteMany({ where: { policyVersionId: ids.paymentFeePolicy } });
  await prisma.paymentFeePolicyVersion.deleteMany({ where: { id: ids.paymentFeePolicy } });
  await prisma.booking.deleteMany({ where: { id: ids.booking } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({
    where: { id: { in: [ids.actor, ids.approver, ids.nonFinance, ids.customerUser, ids.providerUser] } },
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
    'Withholding remittance smoke cannot run in production.',
  );
  const databaseUrl = new URL(requiredEnv('DATABASE_URL'));
  const apiUrl = new URL(apiBaseUrl);
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  assertCondition(localHosts.has(databaseUrl.hostname) && localHosts.has(apiUrl.hostname), 'Withholding smoke refuses remote targets.');
}

function smokePhone(suffix) {
  return `+84968${String(Date.now()).slice(-5)}${suffix}`;
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for withholding remittance smoke.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function hasPreflightBlocker(summary, code) {
  return summary.preflight?.blockers?.some((blocker) => blocker.code === code) === true;
}
