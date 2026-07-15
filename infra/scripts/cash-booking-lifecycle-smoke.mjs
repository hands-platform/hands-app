import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingSettlementStatus,
  BookingStatus,
  EarningStatus,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  Role,
  VerificationStatus,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { runAdminWebDirectSmoke } from './lib/admin-web-direct-smoke.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const port = Number.parseInt(env.CASH_BOOKING_LIFECYCLE_SMOKE_PORT ?? '3003', 10);
const apiBaseUrl = `http://127.0.0.1:${port}/api`;
const apiEntry = resolve(repoRoot, 'apps', 'api', 'dist', 'main.js');
const previewMode = process.argv.includes('--preview');
const adminEvidenceMode = process.argv.includes('--admin-evidence');
const pairedE2eMode = process.argv.includes('--paired-e2e');
const runId = `cash_booking_lifecycle_${Date.now()}`;
const ids = {
  actor: `${runId}_admin_actor`,
  approver: `${runId}_finance_approver`,
  companyBankAccount: `${runId}_company_bank_account`,
  customerUser: `${runId}_customer_user`,
  customerProfile: `${runId}_customer_profile`,
  customerLocation: `${runId}_customer_location`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  providerVerification: `${runId}_provider_verification`,
  providerKyc: `${runId}_provider_kyc`,
  service: `${runId}_service`,
  providerService: `${runId}_provider_service`,
  payoutRule: `${runId}_payout_rule`,
};
const bankTransactionReference = `CASH-LIFECYCLE-DEPOSIT-${runId}`;
const documentTypes = [
  ProviderDocumentType.CCCD_FRONT,
  ProviderDocumentType.CCCD_BACK,
  ProviderDocumentType.SELFIE,
];
const documentFixtures = documentTypes.map((type) => ({
  type,
  fileAssetId: `${runId}_${type.toLowerCase()}_asset`,
  documentId: `${runId}_${type.toLowerCase()}_document`,
}));
const userIds = [ids.actor, ids.approver, ids.customerUser, ids.providerUser];
const prisma = new PrismaClient({ datasources: { db: { url: requiredEnv('DATABASE_URL') } } });
let apiProcess;
let apiErrorTail = '';
const createdBookingIds = [];

assertLocalFixtureMode();
assertCondition(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid cash booking smoke port.');
assertCondition(existsSync(apiEntry), 'API build is missing. Run the API build before cash booking lifecycle smoke.');

try {
  await assertPortIsFree();
  await cleanup();
  await seed();
  apiProcess = startApi();
  await waitForHealth();

  const customerToken = accessToken(ids.customerUser, Role.CUSTOMER);
  const providerToken = accessToken(ids.providerUser, Role.PROVIDER);
  const actorToken = accessToken(ids.actor, Role.ADMIN);
  const approverToken = accessToken(ids.approver, Role.ADMIN);

  if (pairedE2eMode) {
    const pairedLifecycle = await runCustomerPartnerPairedE2e({ customerToken, providerToken });
    console.log(JSON.stringify({ ok: true, mode: 'customer-partner-paired-e2e', checks: pairedLifecycle }, null, 2));
  } else {
  const paymentCatalog = await request('/customer/payment-methods', { token: customerToken });
  assertCondition(paymentCatalog.defaultMethod === PaymentMethod.CASH, 'CASH is not the default customer payment method.');
  assertCondition(
    Array.isArray(paymentCatalog.methods) &&
      paymentCatalog.methods.length === 1 &&
      paymentCatalog.methods[0]?.method === PaymentMethod.CASH,
    'Local customer payment catalog must expose CASH only.',
  );

  const cancelledBookingId = await createCashBooking(customerToken);
  await verifyOpenBooking(cancelledBookingId);
  await request(`/customer/bookings/${cancelledBookingId}/cancel`, {
    method: 'POST',
    token: customerToken,
  });
  const cancellation = await verifyPreMatchCancellation(cancelledBookingId);

  const noShowBookingId = await createCashBooking(customerToken);
  await verifyOpenBooking(noShowBookingId);
  await acceptFirstPick(noShowBookingId, providerToken);
  await request(`/admin/bookings/${noShowBookingId}/no-show`, {
    method: 'POST',
    token: actorToken,
    body: { reason: 'Lifecycle smoke no-show evidence review' },
  });
  const noShow = await verifyNoShowReview(noShowBookingId);

  const completedBookingId = await createCashBooking(customerToken);
  await verifyOpenBooking(completedBookingId);
  await acceptFirstPick(completedBookingId, providerToken);
  await request(`/provider/bookings/${completedBookingId}/start`, {
    method: 'POST',
    token: providerToken,
  });
  await assertBookingState(
    completedBookingId,
    BookingStatus.IN_SERVICE,
    'Partner could not start the matched booking.',
  );
  await request(`/provider/bookings/${completedBookingId}/complete`, {
    method: 'POST',
    token: providerToken,
    body: { lat: 10.7769, lng: 106.7009, addressText: 'District 1, Ho Chi Minh City' },
  });

  const completion = await verifyCompletedLifecycle(completedBookingId, customerToken);
  await request(`/admin/payments/${completion.paymentId}/refund`, {
    method: 'POST',
    token: actorToken,
    body: { approvalAdminId: ids.approver },
  });
  const refund = await verifyRefundLifecycle(completedBookingId, completion);

  const debtBookingId = await createCashBooking(customerToken);
  await verifyOpenBooking(debtBookingId);
  await acceptFirstPick(debtBookingId, providerToken);
  await request(`/provider/bookings/${debtBookingId}/start`, {
    method: 'POST',
    token: providerToken,
  });
  await request(`/provider/bookings/${debtBookingId}/complete`, {
    method: 'POST',
    token: providerToken,
    body: { lat: 10.7769, lng: 106.7009, addressText: 'District 1, Ho Chi Minh City' },
  });
  const debtCompletion = await verifyCompletedLifecycle(debtBookingId, customerToken);
  if (previewMode) {
    console.log(
      JSON.stringify(
        {
          preview: {
            runId,
            stage: 'open-cash-debt',
            routes: {
              booking: `/bookings/${debtBookingId}`,
              cashSettlements: `/cash-settlements?range=all&q=${encodeURIComponent(debtBookingId)}`,
            },
          },
        },
        null,
        2,
      ),
    );
    await holdPreviewFixtures('Press Enter after reviewing the open CASH debt to continue settlement.');
  }
  const debtSettlement = await settleCashBookingDebt({
    actorToken,
    approverToken,
    bookingId: debtBookingId,
    completion: debtCompletion,
  });
  const adminEvidence = adminEvidenceMode
    ? await verifyAdminWebEvidence({
        debtBookingId,
        debtSettlement,
        refund,
        refundedBookingId: completedBookingId,
      })
    : undefined;

  console.log(
    JSON.stringify(
      {
        ok: true,
        bookings: {
          cancelled: cancelledBookingId,
          noShow: noShowBookingId,
          refunded: completedBookingId,
          settledCashDebt: debtBookingId,
        },
        checks: { cancellation, noShow, completion, refund, debtSettlement, adminEvidence },
        ...(previewMode
          ? {
              preview: {
                runId,
                stage: 'reconciled-cash-debt',
                routes: {
                  bankReconciliation: `/finance-tax/bank-reconciliation/${debtSettlement.bankTransactionId}`,
                  booking: `/bookings/${debtBookingId}`,
                  generalLedger: `/finance-tax/general-ledger/${debtSettlement.depositJournalBatchId}`,
                  partnerBankDeposit: `/finance-tax/partner-bank-deposits/${debtSettlement.depositRequestId}`,
                },
              },
            }
          : {}),
      },
      null,
      2,
    ),
  );
  await holdPreviewFixtures('Press Enter after reviewing the reconciled evidence to remove every fixture.');
  }
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
    console.error(`Cash booking smoke cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
  await prisma.$disconnect();
}

function assertLocalFixtureMode() {
  assertCondition(env.NODE_ENV !== 'production', 'Cash booking lifecycle smoke cannot run in production.');
  assertCondition(!enabled(env.MOMO_GATEWAY_ENABLED), 'Disable the real MoMo gateway before local booking smoke.');
  assertCondition(!enabled(env.VNPAY_GATEWAY_ENABLED), 'Disable the real VNPay gateway before local booking smoke.');
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
      MOMO_GATEWAY_ENABLED: 'false',
      VNPAY_GATEWAY_ENABLED: 'false',
      CUSTOMER_APP_PAYMENT_REDIRECT_FLOW_ENABLED: 'false',
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
      throw new Error(`Port ${port} is already serving an API. Choose CASH_BOOKING_LIFECYCLE_SMOKE_PORT.`);
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
      throw new Error('Cash booking smoke API exited before becoming healthy.');
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
  throw new Error('Timed out waiting for the isolated cash booking smoke API.');
}

async function seed() {
  const now = new Date();
  await prisma.user.createMany({
    data: [
      {
        id: ids.actor,
        phone: smokePhone('01'),
        fullName: 'Cash Booking Smoke Admin',
        roles: [Role.ADMIN],
      },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Cash Booking Smoke Finance Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      },
      {
        id: ids.customerUser,
        phone: smokePhone('03'),
        fullName: 'Cash Booking Smoke Customer',
        roles: [Role.CUSTOMER],
      },
      {
        id: ids.providerUser,
        phone: smokePhone('04'),
        fullName: 'Cash Booking Smoke Partner',
        roles: [Role.PROVIDER],
      },
    ],
  });
  await prisma.customerProfile.create({
    data: { id: ids.customerProfile, userId: ids.customerUser },
  });
  await prisma.customerSelectedLocation.create({
    data: {
      id: ids.customerLocation,
      customerProfileId: ids.customerProfile,
      latitude: 10.7769,
      longitude: 106.7009,
      addressText: 'District 1, Ho Chi Minh City',
    },
  });
  await prisma.providerProfile.create({
    data: {
      id: ids.providerProfile,
      userId: ids.providerUser,
      displayName: 'Cash Booking Smoke Partner',
      status: ProviderStatus.ONLINE_AVAILABLE,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: now,
    },
  });
  await prisma.providerVerification.create({
    data: {
      id: ids.providerVerification,
      providerProfileId: ids.providerProfile,
      status: VerificationStatus.APPROVED,
      submittedAt: now,
      reviewedAt: now,
    },
  });
  await prisma.providerKyc.create({
    data: {
      id: ids.providerKyc,
      providerProfileId: ids.providerProfile,
      status: ProviderKycStatus.APPROVED,
      submittedAt: now,
      reviewedAt: now,
    },
  });
  await prisma.fileAsset.createMany({
    data: documentFixtures.map((fixture) => ({
      id: fixture.fileAssetId,
      key: `smoke/${runId}/${fixture.type.toLowerCase()}`,
      contentType: 'image/jpeg',
      purpose: FilePurpose.PROVIDER_VERIFICATION,
      visibility: FileVisibility.PRIVATE,
      uploadStatus: FileUploadStatus.UPLOADED,
      reviewStatus: FileReviewStatus.APPROVED,
      reviewedAt: now,
      uploadedAt: now,
      ownerUserId: ids.providerUser,
      providerVerificationId: ids.providerVerification,
    })),
  });
  await prisma.providerDocument.createMany({
    data: documentFixtures.map((fixture) => ({
      id: fixture.documentId,
      providerProfileId: ids.providerProfile,
      fileAssetId: fixture.fileAssetId,
      type: fixture.type,
      status: ProviderDocumentStatus.APPROVED,
      reviewedAt: now,
    })),
  });
  await prisma.massageService.create({
    data: {
      id: ids.service,
      name: 'Cash Booking Lifecycle Smoke Service',
      durationMin: 60,
      basePrice: 500_000,
      priceStep: 100_000,
      active: true,
    },
  });
  await prisma.providerService.create({
    data: {
      id: ids.providerService,
      providerProfileId: ids.providerProfile,
      serviceId: ids.service,
      price: 500_000,
      active: true,
    },
  });
  await prisma.servicePayoutRule.create({
    data: {
      id: ids.payoutRule,
      serviceId: ids.service,
      customerPrice: 500_000,
      providerPayoutAmount: 400_000,
      vatBps: 1_000,
      active: true,
      notes: 'Self-cleaning cash booking lifecycle smoke fixture',
    },
  });
  await prisma.companyBankAccount.create({
    data: {
      id: ids.companyBankAccount,
      name: 'Cash lifecycle smoke bank account',
      bankName: 'Local smoke bank',
      accountNumberMasked: '****1000',
      accountNumberLast4: '1000',
      currency: 'VND',
      metadata: { localSmoke: true, runId },
    },
  });
}

async function createCashBooking(customerToken) {
  const created = await request('/customer/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      serviceId: ids.service,
      providerId: ids.providerProfile,
      selectedLocationId: ids.customerLocation,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: new Date().toISOString(),
      paymentMethod: PaymentMethod.CASH,
    },
  });
  assertCondition(Boolean(created.id), 'Customer booking creation did not return an id.');
  createdBookingIds.push(created.id);
  return created.id;
}

async function createMarketplaceCashBooking(customerToken) {
  const created = await request('/customer/bookings', {
    method: 'POST',
    token: customerToken,
    body: {
      serviceId: ids.service,
      selectedLocationId: ids.customerLocation,
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: new Date().toISOString(),
      paymentMethod: PaymentMethod.CASH,
    },
  });
  assertCondition(Boolean(created.id), 'Customer marketplace booking creation did not return an id.');
  createdBookingIds.push(created.id);
  return created.id;
}

async function runCustomerPartnerPairedE2e({ customerToken, providerToken }) {
  const paymentCatalog = await request('/customer/payment-methods', { token: customerToken });
  assertCondition(paymentCatalog.defaultMethod === PaymentMethod.CASH, 'Customer app payment catalog default is not CASH.');

  const bookingId = await createMarketplaceCashBooking(customerToken);
  const openBooking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payment: true, addressSnapshot: true },
  });
  assertCondition(openBooking.status === BookingStatus.OPEN_MATCHING, 'Customer booking did not enter open matching.');
  assertCondition(openBooking.payment?.method === PaymentMethod.CASH, 'Customer booking payment method is not CASH.');
  assertCondition(
    openBooking.addressSnapshot?.selectedLocationId === ids.customerLocation,
    'Customer booking did not retain the selected location snapshot.',
  );

  const partnerOpenBookings = await request('/partner/bookings/open?take=20', { token: providerToken });
  assertCondition(
    Array.isArray(partnerOpenBookings) && partnerOpenBookings.some((item) => item.id === bookingId),
    'Partner app open request list did not include the Customer booking.',
  );

  await request(`/partner/bookings/${bookingId}/join`, { method: 'POST', token: providerToken });
  await request(`/partner/bookings/${bookingId}/accept`, { method: 'POST', token: providerToken });

  const acceptedParticipant = await prisma.bookingParticipant.findUnique({
    where: { bookingId_providerProfileId: { bookingId, providerProfileId: ids.providerProfile } },
  });
  assertCondition(
    acceptedParticipant?.status === ParticipantStatus.ACCEPTED,
    'Partner acceptance was not persisted before Customer selection.',
  );

  const matched = await request(`/customer/bookings/${bookingId}/select-provider`, {
    method: 'POST',
    token: customerToken,
    body: { providerId: ids.providerProfile },
  });
  const chatRoomId = matched?.booking?.chatRoom?.id;
  assertCondition(Boolean(chatRoomId), 'Customer final Partner selection did not create a chat room.');
  await assertBookingState(bookingId, BookingStatus.MATCHED, 'Customer final Partner selection did not match the booking.');

  const customerMatchedDetail = await request(`/customer/bookings/${bookingId}`, { token: customerToken });
  const partnerMatchedDetail = await request(`/partner/bookings/${bookingId}`, { token: providerToken });
  assertCondition(customerMatchedDetail.status === BookingStatus.MATCHED, 'Customer app detail is stale after matching.');
  assertCondition(partnerMatchedDetail.status === BookingStatus.MATCHED, 'Partner app detail is stale after matching.');

  const customerMessage = await request(`/chat/rooms/${chatRoomId}/messages`, {
    method: 'POST',
    token: customerToken,
    body: { body: 'Paired E2E customer message' },
  });
  const partnerMessages = await request(`/chat/rooms/${chatRoomId}/messages`, { token: providerToken });
  assertCondition(
    Array.isArray(partnerMessages) && partnerMessages.some((message) => message.id === customerMessage.id),
    'Partner app could not read the Customer chat message.',
  );

  const providerMessage = await request(`/chat/rooms/${chatRoomId}/messages`, {
    method: 'POST',
    token: providerToken,
    body: { body: 'Paired E2E partner message' },
  });
  const customerMessages = await request(`/chat/rooms/${chatRoomId}/messages`, { token: customerToken });
  assertCondition(
    Array.isArray(customerMessages) && customerMessages.some((message) => message.id === providerMessage.id),
    'Customer app could not read the Partner chat message.',
  );

  await request(`/partner/bookings/${bookingId}/start`, { method: 'POST', token: providerToken });
  await assertBookingState(bookingId, BookingStatus.IN_SERVICE, 'Partner app could not start the matched booking.');
  await request(`/partner/bookings/${bookingId}/complete`, {
    method: 'POST',
    token: providerToken,
    body: { lat: 10.7769, lng: 106.7009, addressText: 'District 1, Ho Chi Minh City' },
  });
  const completion = await verifyCompletedLifecycle(bookingId, customerToken);

  const [customerBookings, partnerBookings] = await Promise.all([
    request('/customer/bookings', { token: customerToken }),
    request('/partner/bookings', { token: providerToken }),
  ]);
  assertCondition(
    Array.isArray(customerBookings) &&
      customerBookings.some((booking) => booking.id === bookingId && booking.status === BookingStatus.COMPLETED),
    'Customer app booking history did not expose the completed booking.',
  );
  assertCondition(
    Array.isArray(partnerBookings) &&
      partnerBookings.some((booking) => booking.id === bookingId && booking.status === BookingStatus.COMPLETED),
    'Partner app job history did not expose the completed booking.',
  );

  return {
    bookingId,
    customer: { created: true, selectedPartner: true, chatReceived: true, completedVisible: true },
    partner: { requestVisible: true, joined: true, accepted: true, chatReceived: true, completed: true },
    accounting: {
      journalBalanced: completion.accountingJournalBalanced,
      cashPaymentCaptured: completion.cashPaymentCaptured,
      settlementSnapshotPosted: completion.settlementSnapshotPosted,
    },
  };
}

async function verifyOpenBooking(bookingId) {
  const opened = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payment: true, addressSnapshot: true, participants: true },
  });
  assertCondition(opened.status === BookingStatus.OPEN_MATCHING, 'CASH booking did not open matching.');
  assertCondition(opened.payment?.method === PaymentMethod.CASH, 'Booking payment method is not CASH.');
  assertCondition(opened.payment?.status === PaymentStatus.PENDING, 'CASH payment must remain pending before completion.');
  assertCondition(opened.payment?.amount === 500_000, 'CASH payment amount does not match the service price.');
  assertCondition(opened.addressSnapshot?.selectedLocationId === ids.customerLocation, 'Booking address snapshot is missing.');
  assertCondition(
    opened.participants.some(
      (participant) =>
        participant.providerProfileId === ids.providerProfile && participant.status === ParticipantStatus.JOINED,
    ),
    'Preferred Partner was not registered as the first-pick participant.',
  );
}

async function acceptFirstPick(bookingId, providerToken) {
  await request(`/provider/bookings/${bookingId}/accept`, { method: 'POST', token: providerToken });
  await assertBookingState(
    bookingId,
    BookingStatus.MATCHED,
    'Partner first-pick acceptance did not match the booking.',
  );
}

async function assertBookingState(bookingId, expected, message) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  assertCondition(booking?.status === expected, `${message} Actual: ${booking?.status ?? 'missing'}`);
}

async function verifyPreMatchCancellation(bookingId) {
  const [booking, earningCount, snapshotCount, journalCount, walletCount] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } }),
    prisma.providerEarning.count({ where: { bookingId } }),
    prisma.bookingSettlementSnapshot.count({ where: { bookingId } }),
    prisma.accountingJournalBatch.count({ where: { bookingId } }),
    prisma.providerWalletLedgerEntry.count({ where: { bookingId } }),
  ]);
  assertCondition(booking?.status === BookingStatus.CANCELLED, 'Pre-match cancellation did not close the booking.');
  assertCondition(booking?.payment?.status === PaymentStatus.RELEASED, 'Cancelled CASH payment was not released.');
  assertCondition(
    earningCount + snapshotCount + journalCount + walletCount === 0,
    'Pre-match cancellation must not create earnings or accounting records.',
  );
  return { accountingRows: 0, bookingStatus: booking.status, paymentStatus: booking.payment.status };
}

async function verifyNoShowReview(bookingId) {
  const [booking, payment, opsTask, auditCount, earningCount, journalCount] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    prisma.payment.findUnique({ where: { bookingId } }),
    prisma.bookingOpsTask.findUnique({
      where: { bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED } },
    }),
    prisma.adminAuditLog.count({
      where: { actorId: ids.actor, action: 'booking.no_show.mark', target: `booking:${bookingId}` },
    }),
    prisma.providerEarning.count({ where: { bookingId } }),
    prisma.accountingJournalBatch.count({ where: { bookingId } }),
  ]);
  assertCondition(booking?.status === BookingStatus.NO_SHOW, 'Admin no-show action did not close the booking.');
  assertCondition(payment?.status === PaymentStatus.PENDING, 'No-show review must not automatically refund CASH.');
  assertCondition(
    opsTask?.status === BookingOpsTaskStatus.BLOCKED && opsTask.actorId === ids.actor,
    'No-show did not create the blocked payment-review task.',
  );
  assertCondition(auditCount === 1, 'No-show admin action audit evidence is missing.');
  assertCondition(earningCount + journalCount === 0, 'No-show review must not create settlement accounting.');
  return {
    auditRecorded: true,
    bookingStatus: booking.status,
    paymentDecision: 'PENDING_REVIEW',
    paymentReviewTask: opsTask.status,
  };
}

async function verifyCompletedLifecycle(bookingId, customerToken) {
  const [booking, earning, snapshot, journal, cashClearingCount, locationCount, detail] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } }),
    prisma.providerEarning.findUnique({ where: { bookingId } }),
    prisma.bookingSettlementSnapshot.findUnique({ where: { bookingId } }),
    prisma.accountingJournalBatch.findUnique({
      where: { sourceKey: `accounting-journal:booking-settlement:${bookingId}` },
      include: { entries: true },
    }),
    prisma.bookingPaymentClearingEntry.count({ where: { bookingId } }),
    prisma.locationSnapshot.count({ where: { bookingId, providerProfileId: ids.providerProfile } }),
    request(`/customer/bookings/${bookingId}`, { token: customerToken }),
  ]);

  assertCondition(booking?.status === BookingStatus.COMPLETED, 'Booking was not completed.');
  assertCondition(booking?.payment?.status === PaymentStatus.CAPTURED, 'CASH payment was not captured on completion.');
  assertCondition(Boolean(earning), 'Completed booking did not create Partner earnings.');
  assertCondition((earning?.netAmount ?? 0) < 0, 'CASH booking must create Partner debt, not a wallet credit.');
  assertCondition(Boolean(snapshot), 'Completed booking did not create a settlement snapshot.');
  assertCondition(snapshot?.paymentMethod === PaymentMethod.CASH, 'Settlement snapshot lost the CASH payment method.');
  assertCondition(snapshot?.customerPaymentAmount === 500_000, 'Settlement snapshot customer amount is incorrect.');
  assertCondition(snapshot?.partnerPayoutAmount === 400_000, 'Settlement snapshot Partner payout is incorrect.');
  assertCondition(Boolean(journal), 'Completed booking did not create an accounting journal.');
  assertCondition(
    (journal?.totalDebit ?? 0) > 0 && journal?.totalDebit === journal?.totalCredit,
    'Booking settlement journal is not balanced.',
  );
  assertCondition(journal?.entries.length >= 2, 'Booking settlement journal entries are incomplete.');
  assertCondition(cashClearingCount === 0, 'CASH booking must not create online payment clearing.');
  assertCondition(locationCount >= 1, 'Partner completion location evidence was not stored.');

  const walletEntries = await prisma.providerWalletLedgerEntry.findMany({
    where: { bookingId, providerProfileId: ids.providerProfile },
  });
  const walletDelta = walletEntries.reduce((sum, entry) => sum + entry.amount, 0);
  assertCondition(walletEntries.length >= 2, 'CASH settlement wallet components are incomplete.');
  assertCondition(walletDelta === earning?.netAmount, 'Partner wallet ledger does not reconcile to earnings.');
  assertCondition(walletDelta < 0, 'CASH settlement wallet ledger must record money owed to HANDS.');

  assertCondition(detail.status === BookingStatus.COMPLETED, 'Customer booking detail is not current after completion.');
  assertCondition(detail.payment?.status === PaymentStatus.CAPTURED, 'Customer booking detail hides the captured payment state.');
  assertCondition(!Object.hasOwn(detail.payment ?? {}, 'rawMeta'), 'Customer booking detail exposes private payment rawMeta.');

  return {
    accountingJournalBalanced: true,
    cashPaymentCaptured: true,
    cashPaymentClearingRows: cashClearingCount,
    earningId: earning.id,
    paymentId: booking.payment.id,
    partnerWalletDelta: walletDelta,
    settlementSnapshotId: snapshot.id,
    settlementSnapshotPosted: true,
    storedCompletionLocation: true,
  };
}

async function verifyRefundLifecycle(bookingId, completion) {
  const [booking, refund, earning, snapshot, reversalEntry, reversalJournal, clearingCount, walletEntries] =
    await Promise.all([
      prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } }),
      prisma.refund.findUnique({ where: { paymentId: completion.paymentId } }),
      prisma.providerEarning.findUnique({ where: { bookingId } }),
      prisma.bookingSettlementSnapshot.findUnique({ where: { bookingId } }),
      prisma.bookingSettlementReversalEntry.findUnique({
        where: { originalSettlementSnapshotId: completion.settlementSnapshotId },
      }),
      prisma.accountingJournalBatch.findUnique({
        where: {
          sourceKey: `accounting-journal:booking-settlement-reversal:${completion.settlementSnapshotId}`,
        },
        include: { entries: true },
      }),
      prisma.bookingPaymentClearingEntry.count({ where: { bookingId } }),
      prisma.providerWalletLedgerEntry.findMany({
        where: { bookingId, providerProfileId: ids.providerProfile },
      }),
    ]);
  assertCondition(booking?.status === BookingStatus.REFUNDED, 'Refund did not update the booking status.');
  assertCondition(booking?.payment?.status === PaymentStatus.REFUNDED, 'Refund did not update the CASH payment.');
  assertCondition(refund?.status === 'COMPLETED', 'Refund request was not finalized.');
  assertCondition(
    earning?.status === EarningStatus.CANCELLED && earning.netAmount === 0,
    'Refund did not cancel the unpaid Partner earning.',
  );
  assertCondition(
    snapshot?.settlementStatus === BookingSettlementStatus.REVERSED,
    'Refund did not reverse the settlement snapshot.',
  );
  assertCondition(
    !reversalEntry,
    'Open-period CASH refund must update the snapshot and journal without a closed-period reversal entry.',
  );
  assertCondition(
    (reversalJournal?.totalDebit ?? 0) > 0 &&
      reversalJournal?.totalDebit === reversalJournal?.totalCredit &&
      reversalJournal.entries.length >= 2,
    'Refund reversal journal is missing or unbalanced.',
  );
  assertCondition(clearingCount === 0, 'CASH refund must not create online payment clearing.');
  const reversal = walletEntries.find((entry) => entry.type === ProviderWalletLedgerType.REFUND_REVERSAL);
  const finalWalletDelta = walletEntries.reduce((sum, entry) => sum + entry.amount, 0);
  assertCondition(
    reversal?.amount === -completion.partnerWalletDelta,
    'Refund wallet reversal does not offset the original CASH debt.',
  );
  assertCondition(finalWalletDelta === 0, 'Refund did not restore the Partner wallet to its pre-booking balance.');
  return {
    bookingStatus: booking.status,
    cashPaymentClearingRows: clearingCount,
    earningStatus: earning.status,
    partnerWalletDeltaAfterRefund: finalWalletDelta,
    refundStatus: refund.status,
    reversalJournalBalanced: true,
    reversalJournalBatchId: reversalJournal.id,
    settlementSnapshotId: snapshot.id,
    settlementStatus: snapshot.settlementStatus,
  };
}

async function settleCashBookingDebt({ actorToken, approverToken, bookingId, completion }) {
  const debtAmount = Math.abs(completion.partnerWalletDelta);
  assertCondition(debtAmount > 0, 'Completed CASH booking did not create collectible Partner debt.');

  const depositRequest = await request('/admin/provider-wallet/deposit-requests', {
    method: 'POST',
    token: actorToken,
    body: {
      providerProfileId: ids.providerProfile,
      amount: debtAmount,
      bankTransactionId: bankTransactionReference,
      depositDate: new Date().toISOString(),
      bankAccount: 'Local smoke bank evidence',
      attachmentUrl: `http://localhost:9000/cash-lifecycle-smoke/${runId}.pdf`,
      notes: 'Actual CASH booking debt recovery lifecycle smoke.',
    },
  });
  assertCondition(depositRequest.status === 'REQUESTED', 'Partner deposit request was not created as pending.');
  assertCondition(
    depositRequest.requestedByAdminId === ids.actor &&
      depositRequest.requestedReceivableRecovery === debtAmount,
    'Partner deposit request did not preserve maker or receivable evidence.',
  );

  const approval = await request(
    `/admin/provider-wallet/deposit-requests/${depositRequest.id}/approve`,
    { method: 'POST', token: approverToken },
  );
  assertCondition(
    approval.request?.status === 'EXECUTED' && approval.request?.approvedByAdminId === ids.approver,
    'Separate finance approver did not execute the Partner deposit.',
  );
  assertCondition(
    approval.ledger?.amount === debtAmount && approval.ledger?.providerProfileId === ids.providerProfile,
    'Approved deposit did not create the expected Partner wallet credit.',
  );

  const approvedDetail = await request(
    `/admin/provider-wallet/deposit-requests/${depositRequest.id}`,
    { token: actorToken },
  );
  const journalDebit = journalSideTotal(approvedDetail.journal?.entries ?? [], 'DEBIT');
  const journalCredit = journalSideTotal(approvedDetail.journal?.entries ?? [], 'CREDIT');
  assertCondition(
    journalDebit === debtAmount && journalCredit === debtAmount,
    'Partner deposit journal is missing or unbalanced.',
  );
  const bankCashJournalEntry = approvedDetail.journal.entries.find(
    (entry) => entry.side === 'DEBIT' && entry.accountCode === 'company_bank_cash',
  );
  assertCondition(Boolean(bankCashJournalEntry), 'Partner deposit journal has no company bank cash evidence.');

  const bankTransaction = await request('/admin/bank-reconciliation/transactions', {
    method: 'POST',
    token: actorToken,
    body: {
      approvalAdminId: ids.approver,
      amount: debtAmount,
      bankAccountId: ids.companyBankAccount,
      counterpartyName: 'Cash Booking Smoke Partner',
      currency: 'VND',
      description: 'Actual CASH booking Partner debt deposit evidence.',
      occurredAt: new Date().toISOString(),
      transferRef: bankTransactionReference,
      type: 'INFLOW',
      valueDate: new Date().toISOString(),
    },
  });
  assertCondition(bankTransaction.status === 'UNMATCHED', 'Bank deposit evidence was not opened for reconciliation.');

  const reconciliation = await request(
    `/admin/bank-reconciliation/${bankTransaction.id}/matches`,
    {
      method: 'POST',
      token: actorToken,
      body: {
        approvalAdminId: ids.approver,
        amount: debtAmount,
        currency: 'VND',
        notes: 'Link actual CASH booking debt deposit to approved journal evidence.',
        partnerBankDepositRequestId: depositRequest.id,
      },
    },
  );
  assertCondition(
    reconciliation.bankTransaction?.status === 'MATCHED' &&
      reconciliation.match?.accountingJournalEntryId === bankCashJournalEntry.id,
    'Bank transaction did not reconcile to the approved Partner deposit journal.',
  );

  const allocation = await request(
    `/admin/provider-wallet/deposit-requests/${depositRequest.id}/cash-debt-allocations`,
    {
      method: 'POST',
      token: actorToken,
      body: {
        earningId: completion.earningId,
        amount: debtAmount,
        notes: 'Allocate approved bank deposit to the actual CASH booking debt.',
      },
    },
  );
  assertCondition(
    allocation.cashDebtFullyAllocated === true &&
      allocation.remainingDebtAmount === 0 &&
      allocation.remainingReceivableRecovery === 0,
    'Approved Partner deposit was not fully allocated to the CASH booking debt.',
  );
  assertCondition(
    allocation.earning?.status === EarningStatus.PAID &&
      allocation.earning?.settlementMethod === 'PARTNER_DEPOSIT',
    'Cash debt earning did not retain Partner deposit settlement evidence.',
  );

  const [wallet, matchedBankTransaction, matchCount, allocationAuditCount, executionAuditCount] =
    await Promise.all([
      prisma.providerWalletLedgerEntry.aggregate({
        where: { providerProfileId: ids.providerProfile },
        _sum: { amount: true },
      }),
      prisma.companyBankTransaction.findUnique({ where: { id: bankTransaction.id } }),
      prisma.bankReconciliationMatch.count({
        where: {
          bankTransactionId: bankTransaction.id,
          accountingJournalEntryId: bankCashJournalEntry.id,
          amount: debtAmount,
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          actorId: ids.actor,
          action: 'partner_bank_deposit.cash_debt_allocate',
          target: `partner_bank_deposit_request:${depositRequest.id}`,
        },
      }),
      prisma.adminAuditLog.count({
        where: {
          actorId: ids.approver,
          action: 'partner_bank_deposit_request.execute',
          target: `partner_bank_deposit_request:${depositRequest.id}`,
        },
      }),
    ]);
  assertCondition((wallet._sum.amount ?? 0) === 0, 'Approved deposit did not restore the Partner wallet to zero.');
  assertCondition(matchedBankTransaction?.status === 'MATCHED' && matchCount === 1, 'Bank reconciliation evidence is incomplete.');
  assertCondition(
    allocationAuditCount === 1 && executionAuditCount === 1,
    'Deposit execution or cash-debt allocation audit evidence is missing.',
  );

  return {
    allocationAuditRecorded: true,
    bankTransactionId: bankTransaction.id,
    bankReconciliationStatus: matchedBankTransaction.status,
    cashDebtEarningStatus: allocation.earning.status,
    depositJournalBatchId: approvedDetail.journal.id,
    depositRequestId: depositRequest.id,
    depositJournalBalanced: true,
    depositStatus: approval.request.status,
    partnerWalletBalance: wallet._sum.amount ?? 0,
  };
}

async function holdPreviewFixtures(message) {
  if (!previewMode) {
    return;
  }
  assertCondition(process.stdin.isTTY, 'Preview mode requires an interactive terminal so fixture cleanup cannot be skipped.');
  console.log(`Preview fixtures are available. ${message}`);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  await new Promise((resolvePreview) => process.stdin.once('data', resolvePreview));
  process.stdin.pause();
}

async function verifyAdminWebEvidence({ debtBookingId, debtSettlement, refund, refundedBookingId }) {
  const directPages = [
    {
      path: `/finance-tax/partner-bank-deposits/${debtSettlement.depositRequestId}`,
      markers: [
        'Partner Bank Deposit Detail',
        'Fully reconciled',
        'General ledger evidence',
        'Allocated cash debt',
        debtBookingId,
        debtSettlement.bankTransactionId,
        'Cash Booking Smoke Admin',
        'Cash Booking Smoke Finance Approver',
      ],
    },
    {
      path: `/finance-tax/general-ledger/${debtSettlement.depositJournalBatchId}`,
      markers: [
        'General Ledger Detail',
        'Journal batch overview',
        'Journal evidence hub',
        'Balanced',
        bankTransactionReference,
      ],
    },
    {
      path: `/finance-tax/bank-reconciliation/${debtSettlement.bankTransactionId}`,
      markers: [
        'Bank Reconciliation Detail',
        'MATCHED',
        'Match created',
        'Cash Booking Smoke Admin',
        'Match approved by Cash Booking Smoke Finance Approver',
        'Bank: UNMATCHED',
        debtSettlement.depositRequestId,
      ],
    },
    {
      path: `/finance-tax/booking-settlement-audit/${refund.settlementSnapshotId}`,
      markers: [
        'Booking Settlement Audit Detail',
        'Settlement record overview',
        'Settlement evidence hub',
        'Accounting amount breakdown',
        'CASH',
        'REVERSED',
        refundedBookingId,
        refund.reversalJournalBatchId,
      ],
    },
    {
      path: `/finance-tax/general-ledger/${refund.reversalJournalBatchId}`,
      markers: [
        'General Ledger Detail',
        'Journal batch overview',
        'Journal evidence hub',
        'Balanced',
        refundedBookingId,
        refund.settlementSnapshotId,
      ],
    },
  ];

  await runAdminWebDirectSmoke({ env, pages: directPages, repoRoot });

  return {
    checkedPages: directPages.length,
    depositEvidenceLinked: true,
    generalLedgerBalanced: true,
    reconciliationAuditLinked: true,
    openPeriodRefundJournalLinked: true,
    settlementAuditLinked: true,
  };
}

function journalSideTotal(entries, side) {
  return entries.filter((entry) => entry.side === side).reduce((total, entry) => total + entry.amount, 0);
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
  const bookingIds = (
    await prisma.booking.findMany({
      where: {
        OR: [
          { id: { in: createdBookingIds } },
          { customerProfileId: ids.customerProfile },
        ],
      },
      select: { id: true },
    })
  ).map((booking) => booking.id);
  const targetBookingIds = bookingIds.length > 0 ? bookingIds : [`${runId}_missing_booking`];
  const targetPaymentIds = (
    await prisma.payment.findMany({ where: { bookingId: { in: targetBookingIds } }, select: { id: true } })
  ).map((payment) => payment.id);
  const depositRequests = await prisma.partnerBankDepositRequest.findMany({
    where: {
      providerProfileId: ids.providerProfile,
      bankTransactionId: bankTransactionReference,
    },
    select: { id: true, journalBatchId: true },
  });
  const depositRequestIds = depositRequests.map((request) => request.id);
  const depositJournalBatchIds = depositRequests.flatMap((request) =>
    request.journalBatchId ? [request.journalBatchId] : [],
  );
  const companyBankTransactionIds = (
    await prisma.companyBankTransaction.findMany({
      where: { bankAccountId: ids.companyBankAccount },
      select: { id: true },
    })
  ).map((transaction) => transaction.id);

  await prisma.notificationDelivery.deleteMany({ where: { notification: { userId: { in: userIds } } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.bankReconciliationMatch.deleteMany({
    where: { bankTransactionId: { in: companyBankTransactionIds } },
  });
  await prisma.companyBankTransaction.deleteMany({
    where: { id: { in: companyBankTransactionIds } },
  });
  await prisma.partnerBankDepositCashDebtAllocation.deleteMany({
    where: { partnerBankDepositRequestId: { in: depositRequestIds } },
  });
  await prisma.partnerBankDepositRequest.deleteMany({ where: { id: { in: depositRequestIds } } });
  await prisma.accountingJournalBatch.deleteMany({ where: { id: { in: depositJournalBatchIds } } });
  await prisma.bookingPaymentClearingEntry.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.accountingJournalBatch.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.bookingSettlementReversalEntry.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.bookingSettlementSnapshot.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.withholdingLog.deleteMany({ where: { providerTaxLog: { bookingId: { in: targetBookingIds } } } });
  await prisma.providerTaxLog.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.providerPlatformFeeLog.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.providerWalletLedgerEntry.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.providerEarning.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.locationSnapshot.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.chatMessage.deleteMany({ where: { chatRoom: { bookingId: { in: targetBookingIds } } } });
  await prisma.chatRoom.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.providerBookingRequestEvent.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.bookingOpsTask.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.bookingService.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.paymentCallbackAttempt.deleteMany({ where: { paymentId: { in: targetPaymentIds } } });
  await prisma.refund.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.payment.deleteMany({ where: { bookingId: { in: targetBookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: targetBookingIds } } });

  await prisma.providerService.deleteMany({ where: { id: ids.providerService } });
  await prisma.servicePayoutRule.deleteMany({ where: { id: ids.payoutRule } });
  await prisma.massageService.deleteMany({ where: { id: ids.service } });
  await prisma.providerDocument.deleteMany({ where: { id: { in: documentFixtures.map((item) => item.documentId) } } });
  await prisma.fileAsset.deleteMany({ where: { id: { in: documentFixtures.map((item) => item.fileAssetId) } } });
  await prisma.providerKyc.deleteMany({ where: { id: ids.providerKyc } });
  await prisma.providerVerification.deleteMany({ where: { id: ids.providerVerification } });
  await prisma.companyBankAccount.deleteMany({ where: { id: ids.companyBankAccount } });
  await prisma.customerSelectedLocation.deleteMany({ where: { id: ids.customerLocation } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

function accessToken(userId, role) {
  return jwt.sign({ sub: userId, activeRole: role, roles: [role] }, jwtAccessSecret(), {
    expiresIn: '10m',
  });
}

function smokePhone(suffix) {
  return `+84987${String(Date.now()).slice(-6)}${suffix}`;
}

function jwtAccessSecret() {
  return env.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for cash booking lifecycle smoke.`);
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
