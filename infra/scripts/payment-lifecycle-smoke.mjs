import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  AdminUserProvenance,
  AdminOperatorPermissionCategory,
  BookingSettlementStatus,
  BookingSettlementTaxStatus,
  BookingStatus,
  MonthlyTaxClosingStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProviderStatus,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { runAdminWebDirectSmoke } from './lib/admin-web-direct-smoke.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';
import { financeApproverSmokeAttestationEvents } from './lib/finance-approver-smoke-attestation.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const port = Number.parseInt(env.PAYMENT_LIFECYCLE_SMOKE_PORT ?? '3002', 10);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;
const apiEntry = resolve(repoRoot, 'apps', 'api', 'dist', 'main.js');
const adminEvidenceMode = process.argv.includes('--admin-evidence');
const runId = `payment_lifecycle_${Date.now()}`;
const closedMonthlyPeriod = `${8000 + (Date.now() % 1000)}-12`;
const ids = {
  actor: `${runId}_actor`,
  actorSession: `${runId}_actor_session`,
  approver: `${runId}_approver`,
  approverSession: `${runId}_approver_session`,
  customerUser: `${runId}_customer_user`,
  customerProfile: `${runId}_customer_profile`,
  monthlyClosing: `${runId}_monthly_closing`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
};
const methods = [PaymentMethod.MOMO, PaymentMethod.VNPAY, PaymentMethod.CARD];
const fixtures = methods.map((method) => ({
  method,
  bookingId: `${runId}_${method.toLowerCase()}_booking`,
  paymentId: `${runId}_${method.toLowerCase()}_payment`,
  providerRef: `${runId}_${method.toLowerCase()}_provider_ref`,
}));
const bookingIds = fixtures.map((fixture) => fixture.bookingId);
const paymentIds = fixtures.map((fixture) => fixture.paymentId);
const databaseUrl = requiredEnv('DATABASE_URL');
const redisUrl = requiredEnv('REDIS_URL');
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
let apiProcess;
let apiErrorTail = '';

assertLocalFixtureMode();
assertDisposableLifecycleTarget(databaseUrl, redisUrl);
assertCondition(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid payment smoke port.');
assertCondition(existsSync(apiEntry), 'API build is missing. Run the API build before payment lifecycle smoke.');

try {
  await assertPortIsFree();
  await cleanup();
  await seed();
  apiProcess = startApi();
  await waitForHealth();

  const actorToken = adminAccessToken(ids.actor, ids.actorSession);
  const approverToken = adminAccessToken(ids.approver, ids.approverSession);

  await captureMomo();
  await captureVnpay();
  await captureCard(actorToken);
  await seedSettlementSnapshots();
  const reversalReportingBaseline = await loadReversalReporting(actorToken);

  for (const fixture of fixtures) {
    await request(`/admin/payments/${fixture.paymentId}/refund-request`, {
      method: 'POST',
      token: actorToken,
      body: {
        idempotencyKey: `payment-smoke:refund-request:${fixture.paymentId}`,
        reason: `Payment lifecycle smoke ${fixture.method} refund`,
      },
    });
    await request(`/admin/payments/${fixture.paymentId}/refund`, {
      method: 'POST',
      token: approverToken,
      body: {},
    });
  }

  const verification = await verifyResults();
  const reversalReporting = await verifyClosedPeriodReversalReporting(
    actorToken,
    reversalReportingBaseline,
  );
  const withholdingCsv = adminEvidenceMode
    ? await verifyPartnerWithholdingCsv(
        reversalReporting.period,
        reversalReporting.withholdingPage,
      )
    : { exported: false, reason: 'Admin evidence mode disabled.' };
  const adminEvidence = adminEvidenceMode
    ? await verifyAdminWebEvidence(verification.evidence[PaymentMethod.CARD])
    : undefined;
  const checks = {
    ...verification.checks,
    reversalReporting,
    withholdingCsv,
    ...(adminEvidence ? { adminEvidence } : {}),
  };
  console.log(JSON.stringify({ ok: true, checks }, null, 2));
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

function assertLocalFixtureMode() {
  assertCondition(env.NODE_ENV !== 'production', 'Payment lifecycle smoke cannot run in production.');
  assertCondition(!enabled(env.MOMO_GATEWAY_ENABLED), 'Disable the real MoMo gateway before local payment smoke.');
  assertCondition(!enabled(env.VNPAY_GATEWAY_ENABLED), 'Disable the real VNPay gateway before local payment smoke.');
}

function startApi() {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      NODE_ENV: 'development',
      API_PORT: String(port),
      ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS: 'true',
      ALLOW_UNVERIFIED_PAYMENT_CALLBACKS: 'true',
      MOMO_GATEWAY_ENABLED: 'false',
      VNPAY_GATEWAY_ENABLED: 'false',
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
      throw new Error(`Port ${port} is already serving an API. Choose PAYMENT_LIFECYCLE_SMOKE_PORT.`);
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
      throw new Error('Payment smoke API exited before becoming healthy.');
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
  throw new Error('Timed out waiting for the isolated payment smoke API.');
}

async function seed() {
  const now = new Date();
  await prisma.user.createMany({
    data: [
      {
        id: ids.actor,
        phone: smokePhone('01'),
        fullName: 'Payment Smoke Actor',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Payment Smoke Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.PRODUCTION,
      },
      {
        id: ids.customerUser,
        phone: smokePhone('03'),
        fullName: 'Payment Smoke Customer',
        roles: [Role.CUSTOMER],
      },
      {
        id: ids.providerUser,
        phone: smokePhone('04'),
        fullName: 'Payment Smoke Partner',
        roles: [Role.PROVIDER],
      },
    ],
  });
  await prisma.adminOperatorPermission.createMany({
    data: [
      {
        userId: ids.actor,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_TAX,
        ],
      },
      {
        userId: ids.approver,
        categories: [
          AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_TAX,
        ],
      },
    ],
  });
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
    ],
  });
  await prisma.adminAuditLog.createMany({
    data: [
      ...financeApproverSmokeAttestationEvents({
        categories: [
          AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_TAX,
        ],
        checkerId: ids.approver,
        effectiveAt: now,
        runId: `${runId}_actor`,
        sourceReference: `disposable-payment-lifecycle:${runId}`,
        targetUserId: ids.actor,
      }),
      ...financeApproverSmokeAttestationEvents({
        categories: [
          AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING,
          AdminOperatorPermissionCategory.FINANCE_SETTLEMENTS,
          AdminOperatorPermissionCategory.FINANCE_TAX,
        ],
        checkerId: ids.actor,
        effectiveAt: now,
        runId: `${runId}_approver`,
        sourceReference: `disposable-payment-lifecycle:${runId}`,
        targetUserId: ids.approver,
      }),
    ],
  });
  await prisma.customerProfile.create({
    data: { id: ids.customerProfile, userId: ids.customerUser },
  });
  await prisma.providerProfile.create({
    data: {
      id: ids.providerProfile,
      userId: ids.providerUser,
      displayName: 'Payment Smoke Partner',
      status: ProviderStatus.OFFLINE,
    },
  });

  for (const fixture of fixtures) {
    await prisma.booking.create({
      data: {
        id: fixture.bookingId,
        customerProfileId: ids.customerProfile,
        selectedProviderId: ids.providerProfile,
        status: BookingStatus.COMPLETED,
        scheduledStartAt: new Date(Date.now() - 60 * 60_000),
        scheduledEndAt: new Date(Date.now() - 30 * 60_000),
        address: { addressText: 'Payment lifecycle smoke fixture' },
        lat: 10.7769,
        lng: 106.7009,
        metadata: { smoke: 'payment-lifecycle' },
      },
    });
    await prisma.payment.create({
      data: {
        id: fixture.paymentId,
        bookingId: fixture.bookingId,
        method: fixture.method,
        status: fixture.method === PaymentMethod.CARD ? PaymentStatus.AUTHORIZED : PaymentStatus.PENDING,
        amount: 300000,
        providerRef: fixture.providerRef,
        rawMeta: { smoke: 'payment-lifecycle' },
      },
    });
    if (fixture.method === PaymentMethod.CARD) {
      await prisma.paymentCallbackAttempt.create({
        data: {
          paymentId: fixture.paymentId,
          method: fixture.method,
          providerRef: fixture.providerRef,
          outcome: 'ACCEPTED',
          signatureVerified: true,
          verificationMode: 'disposable-provider-confirmed-fixture',
          providerStatus: PaymentStatus.AUTHORIZED,
          callbackAmount: 300000,
          rawPayload: { smoke: 'payment-lifecycle', providerConfirmed: true },
        },
      });
    }
  }
}

async function captureMomo() {
  const fixture = fixtureFor(PaymentMethod.MOMO);
  const body = {
    amount: 300000,
    orderId: fixture.providerRef,
    resultCode: 0,
    transId: `${runId}_momo_transaction`,
  };
  const accepted = await request('/payments/MOMO/callback', { method: 'POST', body });
  const replay = await request('/payments/MOMO/callback', { method: 'POST', body });
  const storedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: fixture.paymentId } });
  assertCondition(
    accepted.ok === true && accepted.replay === false && storedPayment.status === PaymentStatus.CAPTURED,
    'MoMo callback was not captured.',
  );
  assertCondition(replay.ok === true && replay.replay === true, 'MoMo replay was not idempotent.');
}

async function captureVnpay() {
  const fixture = fixtureFor(PaymentMethod.VNPAY);
  const params = new URLSearchParams({
    vnp_Amount: '30000000',
    vnp_ResponseCode: '00',
    vnp_TxnRef: fixture.providerRef,
    vnp_TransactionNo: `${runId}_vnpay_transaction`,
  });
  const accepted = await request(`/payments/VNPAY/callback?${params}`);
  const replay = await request(`/payments/VNPAY/callback?${params}`);
  assertCondition(accepted.RspCode === '00', 'VNPay callback was not captured.');
  assertCondition(replay.RspCode === '02', 'VNPay replay was not acknowledged as already confirmed.');
}

async function captureCard(actorToken) {
  const fixture = fixtureFor(PaymentMethod.CARD);
  const captured = await request(`/admin/payments/${fixture.paymentId}/capture`, {
    method: 'POST',
    token: actorToken,
    body: {
      idempotencyKey: `payment-smoke:capture:${fixture.paymentId}`,
      reason: 'Disposable payment lifecycle CARD capture',
    },
  });
  assertCondition(
    captured.action === 'CAPTURE' && captured.after?.paymentStatus === PaymentStatus.CAPTURED,
    'CARD payment was not captured.',
  );
}

async function seedSettlementSnapshots() {
  const monthlyPeriod = vietnamMonthlyPeriod(new Date());
  for (const fixture of fixtures) {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: fixture.paymentId } });
    assertCondition(payment.status === PaymentStatus.CAPTURED, `${fixture.method} payment is not captured before settlement.`);
    await prisma.bookingSettlementSnapshot.create({
      data: {
        sourceKey: `booking-settlement:${fixture.bookingId}`,
        bookingId: fixture.bookingId,
        customerProfileId: ids.customerProfile,
        providerProfileId: ids.providerProfile,
        paymentId: fixture.paymentId,
        paymentMethod: fixture.method,
        customerPaymentAmount: 300000,
        partnerPayoutAmount: 210000,
        partnerTaxableRevenue: 240000,
        partnerVatAmount: 20000,
        partnerPitAmount: 10000,
        partnerWithholdingTotal: 30000,
        platformFeeGross: 60000,
        platformFeeNetRevenue: 60000,
        monthlyPeriod,
        metadata: { smoke: 'payment-lifecycle' },
      },
    });
  }

  const cardFixture = fixtureFor(PaymentMethod.CARD);
  const closedAt = new Date();
  await prisma.monthlyTaxClosing.create({
    data: {
      id: ids.monthlyClosing,
      period: closedMonthlyPeriod,
      currency: 'VND',
      status: MonthlyTaxClosingStatus.CLOSED,
      closedAt,
      closedById: ids.approver,
      createdById: ids.actor,
      reviewedById: ids.approver,
      settlementCount: 1,
      notes: 'Self-cleaning CARD closed-period reversal smoke fixture',
    },
  });
  await prisma.bookingSettlementSnapshot.update({
    where: { bookingId: cardFixture.bookingId },
    data: {
      closedAt,
      monthlyPeriod: closedMonthlyPeriod,
      monthlyClosingId: ids.monthlyClosing,
      taxStatus: BookingSettlementTaxStatus.CLOSED,
    },
  });
}

async function verifyResults() {
  const checks = {};
  const evidence = {};
  for (const fixture of fixtures) {
    const [payment, refundCount, snapshot, clearing, reversalEntry] = await Promise.all([
      prisma.payment.findUnique({ where: { id: fixture.paymentId } }),
      prisma.refund.count({ where: { paymentId: fixture.paymentId, status: 'COMPLETED' } }),
      prisma.bookingSettlementSnapshot.findUnique({ where: { bookingId: fixture.bookingId } }),
      prisma.bookingPaymentClearingEntry.findUnique({
        where: { sourceKey: `booking-payment-clearing:${fixture.bookingId}:refund-reversal` },
      }),
      prisma.bookingSettlementReversalEntry.findFirst({ where: { bookingId: fixture.bookingId } }),
    ]);
    assertCondition(payment?.status === PaymentStatus.REFUNDED, `${fixture.method} payment was not refunded.`);
    assertCondition(refundCount === 1, `${fixture.method} refund was not unique and completed.`);
    const closedPeriodFixture = fixture.method === PaymentMethod.CARD;
    if (closedPeriodFixture) {
      assertCondition(
        snapshot?.settlementStatus === BookingSettlementStatus.POSTED &&
          snapshot.taxStatus === BookingSettlementTaxStatus.CLOSED &&
          snapshot.monthlyClosingId === ids.monthlyClosing,
        'CARD closed-period refund mutated the immutable original settlement snapshot.',
      );
      assertCondition(
        reversalEntry?.settlementStatus === BookingSettlementStatus.REVERSED,
        'CARD closed-period refund did not create a reversal entry.',
      );
    } else {
      assertCondition(
        snapshot?.settlementStatus === BookingSettlementStatus.REVERSED,
        `${fixture.method} open-period snapshot was not reversed.`,
      );
      assertCondition(
        !reversalEntry,
        `${fixture.method} open-period refund unexpectedly created a closed-period reversal entry.`,
      );
    }

    const storedJournal = await prisma.accountingJournalBatch.findFirst({
      where: {
        bookingId: fixture.bookingId,
        sourceType: 'BOOKING_SETTLEMENT_REVERSAL',
        ...(snapshot ? { sourceKey: `accounting-journal:booking-settlement-reversal:${snapshot.id}` } : {}),
      },
    });
    assertCondition(
      Boolean(storedJournal) && storedJournal.totalDebit > 0 && storedJournal.totalDebit === storedJournal.totalCredit,
      `${fixture.method} reversal journal is not balanced.`,
    );
    assertCondition(
      clearing?.amount === -300000 && clearing.status === 'REVERSED',
      `${fixture.method} refund clearing reversal is incomplete.`,
    );
    checks[fixture.method] = {
      callbackReplay: fixture.method === PaymentMethod.CARD ? 'not-applicable' : 'verified',
      closedPeriodOriginalLocked: closedPeriodFixture,
      journalBalanced: true,
      refundCompleted: true,
      settlementReversed: true,
    };
    if (closedPeriodFixture) {
      evidence[fixture.method] = {
        bookingId: fixture.bookingId,
        clearingEntryId: clearing.id,
        paymentId: fixture.paymentId,
        reversalEntryId: reversalEntry.id,
        reversalJournalBatchId: storedJournal.id,
        settlementSnapshotId: snapshot.id,
      };
    }
  }

  const callbackOutcomes = await prisma.paymentCallbackAttempt.groupBy({
    by: ['method', 'outcome'],
    where: { paymentId: { in: paymentIds } },
    _count: true,
  });
  for (const method of [PaymentMethod.MOMO, PaymentMethod.VNPAY]) {
    assertCondition(
      callbackOutcomes.some((row) => row.method === method && row.outcome === 'ACCEPTED' && row._count === 1),
      `${method} accepted callback evidence is missing.`,
    );
    assertCondition(
      callbackOutcomes.some((row) => row.method === method && row.outcome === 'REPLAY' && row._count === 1),
      `${method} replay callback evidence is missing.`,
    );
  }

  return { checks, evidence };
}

async function loadReversalReporting(actorToken) {
  const period = vietnamMonthlyPeriod(new Date());
  const [monthlySummary, withholdingSummary] = await Promise.all([
    request(`/admin/monthly-tax-closings/summary?period=${period}`, { token: actorToken }),
    request(`/admin/partner-withholding-tax/summary?period=${period}`, { token: actorToken }),
  ]);

  return { monthlySummary, period, withholdingSummary };
}

async function findPartnerWithholdingRow(actorToken, period) {
  const take = 100;
  for (let page = 1; page <= 20; page += 1) {
    const skip = (page - 1) * take;
    const rows = await request(
      `/admin/partner-withholding-tax?period=${period}&take=${take}&skip=${skip}`,
      { token: actorToken },
    );
    const row = rows.find((candidate) => candidate.providerProfileId === ids.providerProfile);
    if (row) {
      return { page, row };
    }
    if (rows.length < take) {
      break;
    }
  }

  return { page: 1, row: null };
}

async function verifyClosedPeriodReversalReporting(actorToken, baseline) {
  const { monthlySummary, period, withholdingSummary } = await loadReversalReporting(actorToken);
  const { page: withholdingPage, row: partnerRow } = await findPartnerWithholdingRow(
    actorToken,
    period,
  );

  assertCondition(
    monthlySummary.settlementCount - baseline.monthlySummary.settlementCount === -2,
    'Reversal-period monthly close did not remove the two open-period reversed snapshots.',
  );
  assertCondition(
    monthlySummary.reversalCount - baseline.monthlySummary.reversalCount === 1,
    'Reversal-period monthly close did not count the closed-period reversal entry.',
  );
  assertCondition(
    monthlySummary.customerPaymentAmountTotal - baseline.monthlySummary.customerPaymentAmountTotal ===
      -900000 &&
      monthlySummary.partnerPayoutTotal - baseline.monthlySummary.partnerPayoutTotal === -630000 &&
      monthlySummary.partnerWithholdingTotal - baseline.monthlySummary.partnerWithholdingTotal ===
        -90000 &&
      monthlySummary.platformFeeGrossTotal - baseline.monthlySummary.platformFeeGrossTotal === -180000,
    'Reversal-period monthly close totals did not net the closed-period reversal.',
  );
  assertCondition(
    monthlySummary.reconciliationDelta === baseline.monthlySummary.reconciliationDelta &&
      monthlySummary.netRevenueDelta === baseline.monthlySummary.netRevenueDelta,
    'Reversal-period monthly close changed the existing reconciliation balance.',
  );
  assertCondition(
    withholdingSummary.postedSettlementCount - baseline.withholdingSummary.postedSettlementCount ===
      -2 &&
      withholdingSummary.reversalCount - baseline.withholdingSummary.reversalCount === 1 &&
      withholdingSummary.taxableBookingCount - baseline.withholdingSummary.taxableBookingCount === -3 &&
      withholdingSummary.totalPartnerTaxWithheld -
        baseline.withholdingSummary.totalPartnerTaxWithheld ===
        -90000,
    'Partner withholding summary did not net the closed-period reversal.',
  );
  assertCondition(
    partnerRow?.postedSettlementCount === 0 &&
      partnerRow.reversalCount === 1 &&
      partnerRow.completedBookingCount === -1 &&
      partnerRow.grossServiceRevenue === -240000 &&
      partnerRow.totalPartnerTaxWithheld === -30000,
    'Partner withholding register did not expose the reversal row.',
  );

  return {
    monthlyCloseBalanced: true,
    partnerRegisterNetted: true,
    period,
    reversalCount: monthlySummary.reversalCount,
    withholdingPage,
  };
}

async function verifyPartnerWithholdingCsv(period, page) {
  const adminBaseUrl = (env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3101').replace(/\/$/, '');
  const cookieName = env.ADMIN_WEB_SESSION_COOKIE_NAME?.trim() || 'hands_admin_session';
  const response = await fetch(
    `${adminBaseUrl}/api/admin/finance-tax/partner-withholding-tax/export?period=${period}&take=100&page=${page}`,
    {
      headers: { cookie: `${cookieName}=${adminSessionCookie()}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  const csv = await response.text();

  assertCondition(response.status === 200, `Partner withholding CSV returned ${response.status}.`);
  assertCondition(
    response.headers.get('content-type')?.includes('text/csv'),
    'Partner withholding export did not return CSV.',
  );
  assertCondition(
    csv.includes('"posted_settlement_count","reversal_count"'),
    'Partner withholding CSV is missing posted and reversal columns.',
  );
  assertCondition(
    csv.includes(`"${ids.providerProfile}","${period}","VND"`),
    `Partner withholding CSV page ${page} is missing the smoke partner row.`,
  );
  assertCondition(
    csv.includes('"\'-1","0","1","\'-240000"'),
    'Partner withholding CSV did not preserve formula-safe posted, reversal, and net values.',
  );

  return {
    exported: true,
    reversalColumnsPresent: true,
  };
}

async function verifyAdminWebEvidence(evidence) {
  assertCondition(Boolean(evidence), 'CARD Admin evidence identifiers are missing.');
  const directPages = [
    {
      path: `/finance-tax/payment-clearing/${evidence.clearingEntryId}`,
      markers: [
        'Payment Clearing Detail',
        'Clearing overview',
        'Clearing evidence hub',
        'REFUND_REVERSAL',
        'REVERSED',
        evidence.bookingId,
        evidence.paymentId,
        evidence.settlementSnapshotId,
        evidence.reversalEntryId,
      ],
    },
    {
      path: `/finance-tax/booking-settlement-audit/${evidence.settlementSnapshotId}`,
      markers: [
        'Booking Settlement Audit Detail',
        'Identity',
        'Canonical evidence',
        'Allocation equation',
        'CARD',
        'Reversal evidence incomplete',
        evidence.bookingId,
        evidence.clearingEntryId,
        evidence.reversalEntryId,
      ],
    },
    {
      path: `/finance-tax/settlement-reversals/${evidence.reversalEntryId}`,
      markers: [
        'Settlement Reversal Detail',
        'Paid payout refund',
        'Original settlement lock',
        'Reversal accounting impact',
        'CARD',
        evidence.bookingId,
        evidence.clearingEntryId,
        evidence.reversalJournalBatchId,
        evidence.settlementSnapshotId,
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
    paymentClearingLinked: true,
    settlementAuditLinked: true,
    settlementReversalLinked: true,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path.split('?')[0]} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function cleanup() {
  // Financial and audit rows are append-only. The disposable schema is the cleanup boundary.
}

function fixtureFor(method) {
  return fixtures.find((fixture) => fixture.method === method);
}

function vietnamMonthlyPeriod(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

function smokePhone(suffix) {
  return `+84988${String(Date.now()).slice(-5)}${suffix}`;
}

function adminAccessToken(userId, sessionId) {
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

function adminWebApiTokenSecret() {
  return env.ADMIN_WEB_API_TOKEN_SECRET?.trim() || 'dev-admin-web-api-token-secret';
}

function adminSessionCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      exp: now + 300,
      iat: now,
      jti: ids.actorSession,
      role: 'ADMIN',
      sessionVersion: 1,
      sub: ids.actor,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', requiredEnv('ADMIN_WEB_SESSION_COOKIE_SECRET'))
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function assertDisposableLifecycleTarget(targetDatabaseUrl, targetRedisUrl) {
  let database;
  let redisTarget;
  try {
    database = new URL(targetDatabaseUrl);
    redisTarget = new URL(targetRedisUrl);
  } catch {
    throw new Error('Payment lifecycle smoke requires valid DATABASE_URL and REDIS_URL values.');
  }
  const databaseName = decodeURIComponent(database.pathname.replace(/^\/+|\/+$/gu, ''));
  const schema = database.searchParams.get('schema')?.trim() ?? '';
  const databaseAllowed =
    /^(?:(?:hands|finance[_-]approver)[_-](?:it|integration))_[a-z0-9_-]+$/u.test(databaseName) &&
    /^hands_(?:it|integration)_[a-z0-9_]+$/u.test(schema);
  const exactDatabaseTarget = `${databaseName}:${schema}`;
  assertCondition(
    databaseAllowed && allowlist(env.INTEGRATION_DATABASE_ALLOWLIST).has(exactDatabaseTarget),
    `Refusing payment lifecycle smoke writes to non-disposable target ${exactDatabaseTarget}`,
  );

  assertCondition(
    ['127.0.0.1', 'localhost', '::1'].includes(redisTarget.hostname),
    'Payment lifecycle smoke Redis must use a loopback host.',
  );
  const normalizedRedisTarget = targetRedisUrl.replace(/\/$/u, '');
  assertCondition(
    allowlist(env.INTEGRATION_REDIS_ALLOWLIST).has(normalizedRedisTarget),
    `Payment lifecycle smoke Redis target ${normalizedRedisTarget} is not explicitly allowlisted`,
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

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for payment lifecycle smoke.`);
  return value;
}

function enabled(value) {
  return value?.trim().toLowerCase() === 'true';
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
