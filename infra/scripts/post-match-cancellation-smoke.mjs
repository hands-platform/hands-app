import {
  AdminOperatorPermissionCategory,
  AdminUserProvenance,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  CustomerWalletLedgerType,
  EarningStatus,
  PaymentMethod,
  PaymentStatus,
  ParticipantStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  PrismaClient,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const seedOnly = process.argv.includes('--seed-only');
const keep = process.argv.includes('--keep') || seedOnly;
const adminVisible = process.argv.includes('--admin-visible');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const apiBaseUrl = nonEmptyString(env.API_BASE_URL) ?? 'http://localhost:3000/api';

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for post-match cancellation smoke.');
}
if (adminVisible && env.NODE_ENV === 'production') {
  fail('Admin-visible cancellation fixtures cannot run in production.');
}

const prisma = new PrismaClient();
const fixturePrefix = adminVisible ? 'audit_post_match' : 'smoke_post_match';
const fixtureLabel = adminVisible ? 'Audit' : 'Smoke';
const fixturePhonePrefix = adminVisible ? '+849000071' : '+849000070';
const fixtureMetadata = adminVisible
  ? { auditFixture: 'post-match-cancellation' }
  : { smoke: 'post-match-cancellation' };
const decisionReason = 'CUSTOMER_REQUESTED';

const ids = {
  adminActorUser: `${fixturePrefix}_admin_actor_user`,
  customerUser: `${fixturePrefix}_customer_user`,
  providerUser: `${fixturePrefix}_provider_user`,
  customerProfile: `${fixturePrefix}_customer_profile`,
  providerProfile: `${fixturePrefix}_provider_profile`,
  financeApproverUser: `${fixturePrefix}_finance_approver_user`,
};

const cancellationFixtures = [
  cancellationFixture('wallet-approve', PaymentMethod.CUSTOMER_WALLET, PaymentStatus.AUTHORIZED, 'approve', 10),
  cancellationFixture('wallet-hold', PaymentMethod.CUSTOMER_WALLET, PaymentStatus.AUTHORIZED, 'hold', 30),
  cancellationFixture('card-approve', PaymentMethod.CARD, PaymentStatus.AUTHORIZED, 'approve', 10),
  cancellationFixture('card-hold-captured', PaymentMethod.CARD, PaymentStatus.CAPTURED, 'hold', 30),
  cancellationFixture('cash-approve', PaymentMethod.CASH, PaymentStatus.PENDING, 'approve', 10),
  cancellationFixture('cash-hold', PaymentMethod.CASH, PaymentStatus.PENDING, 'hold', 30),
];
const bookingIds = cancellationFixtures.map((fixture) => fixture.bookingId);
const earningIds = cancellationFixtures.map((fixture) => fixture.earningId);
const paymentIds = cancellationFixtures.map((fixture) => fixture.paymentId);
const smokeUserIds = [
  ids.adminActorUser,
  ids.customerUser,
  ids.providerUser,
  ids.financeApproverUser,
];

try {
  await cleanupSmokeData();
  await seedSmokeData();

  if (seedOnly) {
    console.log(JSON.stringify({
      ok: true,
      apiBaseUrl,
      adminVisible,
      seedOnly,
      fixtures: cancellationFixtures.map(({ bookingId, decision, key, paymentMethod, paymentStatus }) => ({
        bookingId,
        decision,
        key,
        paymentMethod,
        paymentStatus,
      })),
      cleanup: 'skipped (--seed-only)',
    }, null, 2));
  } else {
    const accessToken = adminJwt(ids.adminActorUser);
    const financeApproverAccessToken = adminJwt(ids.financeApproverUser);
    for (const fixture of cancellationFixtures) {
      await postDecision(accessToken, fixture.bookingId, fixture.decision, fixture.note);
    }

    const checks = {};
    for (const fixture of cancellationFixtures) {
      checks[fixture.key] = await verifyCancellationFixture(fixture);
    }
    const capturedCardFixture = cancellationFixtures.find(
      (fixture) => fixture.paymentStatus === PaymentStatus.CAPTURED,
    );
    assertCondition(capturedCardFixture, 'Captured card cancellation fixture is missing.');
    const capturedCardRefund = await finalizeCapturedCardRefund(
      financeApproverAccessToken,
      capturedCardFixture,
    );

    const result = {
      ok: true,
      apiBaseUrl,
      envFile: { path: envPath, exists: envFileExists },
      keep,
      adminVisible,
      pages: [
        '/bookings?dateRange=today&view=all',
        '/bookings/post-match-cancellations?dateRange=today',
      ],
      checks,
      capturedCardRefund,
    };

    if (!keep) {
      await cleanupSmokeData();
      result.cleanup = 'completed';
    } else {
      result.cleanup = 'skipped (--keep)';
    }

    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  if (!keep) {
    try {
      await cleanupSmokeData();
    } catch (cleanupError) {
      console.error(JSON.stringify({
        ok: false,
        phase: 'cleanup',
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        residualFixtureIds: smokeUserIds,
      }, null, 2));
      process.exitCode = 1;
    }
  }
  console.error(
    JSON.stringify(
      {
        ok: false,
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function postDecision(accessToken, bookingId, action, note) {
  return request(`/admin/bookings/${bookingId}/post-match-cancellation/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ reason: decisionReason, note }),
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

async function requestFailure(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} unexpectedly succeeded: ${JSON.stringify(body)}`);
  }
  return { status: response.status, body };
}

async function seedSmokeData() {
  await prisma.user.create({
    data: {
      id: ids.adminActorUser,
      phone: `${fixturePhonePrefix}00`,
      fullName: `${fixtureLabel} Admin Maker`,
      roles: [Role.ADMIN],
      adminUserProvenance: AdminUserProvenance.FIXTURE,
      fixtureKind: 'POST_MATCH_CANCELLATION_SMOKE',
      fixtureRunId: fixturePrefix,
    },
  });

  await prisma.user.create({
    data: {
      id: ids.customerUser,
      phone: `${fixturePhonePrefix}01`,
      fullName: `${fixtureLabel} Cancellation Customer`,
      roles: [Role.CUSTOMER],
      customerProfile: {
        create: {
          id: ids.customerProfile,
          addresses: [
            {
              label: 'Home',
              addressText: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
              lat: 10.7769,
              lng: 106.7009,
            },
          ],
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      id: ids.providerUser,
      phone: `${fixturePhonePrefix}02`,
      fullName: `${fixtureLabel} Cancellation Partner`,
      roles: [Role.PROVIDER],
      providerProfile: {
        create: {
          id: ids.providerProfile,
          displayName: `${fixtureLabel} Cancellation Partner`,
          city: 'Ho Chi Minh City',
          status: ProviderStatus.ONLINE_BUSY,
          serviceArea: { cities: ['Ho Chi Minh City'] },
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      id: ids.financeApproverUser,
      phone: `${fixturePhonePrefix}03`,
      fullName: `${fixtureLabel} Finance Approver`,
      roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      adminUserProvenance: AdminUserProvenance.FIXTURE,
      fixtureKind: 'POST_MATCH_CANCELLATION_SMOKE',
      fixtureRunId: fixturePrefix,
    },
  });
  await prisma.adminOperatorPermission.createMany({
    data: [
      {
        userId: ids.adminActorUser,
        categories: [AdminOperatorPermissionCategory.BOOKINGS_DETAIL],
      },
      {
        userId: ids.financeApproverUser,
        categories: [AdminOperatorPermissionCategory.FINANCE_PAYMENT_CLEARING],
      },
    ],
  });

  for (const fixture of cancellationFixtures) {
    await createCancellationBooking(fixture);
  }
}

async function createCancellationBooking({
  bookingId,
  earningId,
  chatRoomId,
  matchedAt,
  closedAt,
  paymentId,
  paymentMethod,
  paymentStatus,
  key,
}) {
  const missingChatEvidence = seedOnly && key === 'wallet-hold';
  const noPartnerFee = seedOnly && key === 'cash-approve';
  const address = {
    addressText: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
    detail: `${fixtureLabel} booking address`,
    city: 'Ho Chi Minh City',
    country: 'VN',
  };

  await prisma.booking.create({
    data: {
      id: bookingId,
      customerProfileId: ids.customerProfile,
      selectedProviderId: ids.providerProfile,
      status: BookingStatus.CANCELLED,
      scheduledStartAt: adminVisible
        ? new Date(matchedAt.getTime() + 30 * 60_000)
        : new Date('2026-06-13T05:00:00.000Z'),
      scheduledEndAt: adminVisible
        ? new Date(matchedAt.getTime() + 90 * 60_000)
        : new Date('2026-06-13T06:00:00.000Z'),
      address,
      lat: 10.7769,
      lng: 106.7009,
      notes: `${fixtureLabel} seed: post-match cancellation from Partner chat.`,
      metadata: fixtureMetadata,
      matchedAt,
      matchSource: 'CUSTOMER_SELECTED_PARTNER',
      closedAt,
      closedByRole: Role.PROVIDER,
      closedReason: 'partner_cancelled',
      closedNote: 'Partner cancelled from chat.',
      addressSnapshot: {
        create: {
          customerProfileId: ids.customerProfile,
          address,
          addressText: address.addressText,
          latitude: 10.7769,
          longitude: 106.7009,
        },
      },
      participants: {
        create: {
          providerProfileId: ids.providerProfile,
          status: ParticipantStatus.SELECTED,
          providerStatusAtJoin: ProviderStatus.ONLINE_BUSY,
          joinedAt: matchedAt,
          respondedAt: matchedAt,
        },
      },
      chatRoom: {
        create: {
          id: chatRoomId,
          messages: missingChatEvidence ? undefined : {
            create: [
              {
                senderId: ids.providerUser,
                body: `${fixtureLabel} evidence: Partner requested cancellation after match.`,
                createdAt: closedAt,
              },
              {
                senderId: ids.customerUser,
                body: `${fixtureLabel} evidence: customer acknowledged the cancellation.`,
                createdAt: new Date(closedAt.getTime() + 60_000),
              },
            ],
          },
        },
      },
      earning: noPartnerFee ? undefined : {
        create: {
          id: earningId,
          providerProfileId: ids.providerProfile,
          grossAmount: 400000,
          platformFee: 30000,
          netAmount: -30000,
          status: EarningStatus.PENDING,
        },
      },
      payment: {
        create: {
          id: paymentId,
          method: paymentMethod,
          status: paymentStatus,
          amount: 400000,
          currency: 'VND',
          providerRef:
            paymentMethod === PaymentMethod.CARD ? `${fixturePrefix}-card-${bookingId}` : null,
          rawMeta: {
            ...fixtureMetadata,
            fixture: key,
          },
        },
      },
    },
  });

  if (paymentMethod === PaymentMethod.CUSTOMER_WALLET) {
    await prisma.customerWalletLedgerEntry.create({
      data: {
        amount: -400000,
        bookingId,
        currency: 'VND',
        customerProfileId: ids.customerProfile,
        metadata: {
          bookingId,
          paymentId,
          paymentMethod,
          reservationState: 'HELD',
          ...fixtureMetadata,
        },
        notes: `${fixtureLabel} customer wallet reservation for post-match cancellation.`,
        reference: paymentId,
        sourceKey: customerWalletReservationSourceKey(bookingId),
        type: CustomerWalletLedgerType.CUSTOMER_WALLET_PAYMENT,
      },
    });
  }
}

async function finalizeCapturedCardRefund(financeApproverAccessToken, fixture) {
  const requestedRefund = await prisma.refund.findUniqueOrThrow({
    where: { paymentId: fixture.paymentId },
  });
  assertCondition(
    requestedRefund.status === 'REQUESTED',
    'Captured card refund must start as REQUESTED.',
  );

  await request(`/admin/payments/${fixture.paymentId}/refund`, {
    method: 'POST',
    headers: { authorization: `Bearer ${financeApproverAccessToken}` },
    body: JSON.stringify({}),
  });

  const [payment, booking, earning, refund, refundLedger, refundAudit, settlementCount, journalCount] =
    await Promise.all([
      prisma.payment.findUniqueOrThrow({ where: { id: fixture.paymentId } }),
      prisma.booking.findUniqueOrThrow({ where: { id: fixture.bookingId } }),
      prisma.providerEarning.findUniqueOrThrow({ where: { id: fixture.earningId } }),
      prisma.refund.findUniqueOrThrow({ where: { paymentId: fixture.paymentId } }),
      prisma.providerWalletLedgerEntry.findUnique({
        where: { sourceKey: `earning:${fixture.earningId}:refund-reversal` },
      }),
      prisma.adminAuditLog.findFirst({
        where: {
          action: 'payment.refund',
          target: `payment:${fixture.paymentId}`,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bookingSettlementSnapshot.count({ where: { bookingId: fixture.bookingId } }),
      prisma.accountingJournalBatch.count({ where: { bookingId: fixture.bookingId } }),
    ]);

  assertCondition(
    payment.status === PaymentStatus.REFUNDED,
    'Captured card payment was not finalized as REFUNDED.',
  );
  assertCondition(refund.status === 'COMPLETED', 'Captured card refund was not finalized as COMPLETED.');
  assertCondition(booking.status === BookingStatus.REFUNDED, 'Refunded cancellation booking status mismatch.');
  assertCondition(
    booking.closedReason === 'post_match_cancellation_fee_held',
    'Refund finalization changed the post-match fee-hold decision.',
  );
  assertCondition(
    earning.status === EarningStatus.PENDING,
    'Held Partner fee earning status changed during refund.',
  );
  assertCondition(earning.netAmount === -30000, 'Held Partner fee amount changed during refund.');
  assertCondition(!refundLedger, 'Held Partner fee created an unwanted refund reversal ledger.');
  assertCondition(settlementCount === 0, 'Refunded cancellation created a settlement snapshot.');
  assertCondition(journalCount === 0, 'Refunded cancellation created an accounting journal.');
  assertCondition(
    refundAudit?.metadata?.approvalAdminId === ids.financeApproverUser,
    'Refund audit is missing the finance approver.',
  );

  const beforeDuplicate = await refundLifecycleCounts(fixture);
  const duplicate = await requestFailure(`/admin/payments/${fixture.paymentId}/refund`, {
    method: 'POST',
    headers: { authorization: `Bearer ${financeApproverAccessToken}` },
    body: JSON.stringify({}),
  });
  assertCondition(duplicate.status === 409, `Duplicate refund returned ${duplicate.status} instead of 409.`);
  const afterDuplicate = await refundLifecycleCounts(fixture);
  assertCondition(
    JSON.stringify(afterDuplicate) === JSON.stringify(beforeDuplicate),
    'Duplicate refund changed persisted refund or ledger counts.',
  );

  return {
    paymentId: fixture.paymentId,
    paymentStatus: payment.status,
    refundId: refund.id,
    refundStatus: refund.status,
    bookingStatus: booking.status,
    closedReason: booking.closedReason,
    earningStatus: earning.status,
    earningNetAmount: earning.netAmount,
    financeApproverId: refundAudit?.metadata?.approvalAdminId,
    duplicateStatus: duplicate.status,
    persistedCounts: afterDuplicate,
  };
}

async function refundLifecycleCounts(fixture) {
  const [refundCount, providerLedgerCount, settlementCount, journalCount] = await Promise.all([
    prisma.refund.count({ where: { paymentId: fixture.paymentId } }),
    prisma.providerWalletLedgerEntry.count({ where: { bookingId: fixture.bookingId } }),
    prisma.bookingSettlementSnapshot.count({ where: { bookingId: fixture.bookingId } }),
    prisma.accountingJournalBatch.count({ where: { bookingId: fixture.bookingId } }),
  ]);
  return { refundCount, providerLedgerCount, settlementCount, journalCount };
}

async function verifyCancellationFixture(fixture) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: fixture.bookingId },
    include: {
      earning: true,
      opsTasks: true,
      payment: true,
      walletLedgerEntries: true,
    },
  });
  const auditLog = await prisma.adminAuditLog.findFirst({
    where: {
      action: `booking.post_match_cancellation.${fixture.decision}`,
      target: `booking:${fixture.bookingId}`,
    },
    orderBy: { createdAt: 'desc' },
  });
  const ledger = await prisma.providerWalletLedgerEntry.findUnique({
    where: { sourceKey: providerFeeReversalSourceKey(fixture.earningId) },
  });
  const refund = await prisma.refund.findUnique({
    where: { paymentId: fixture.paymentId },
  });
  const walletReservation = await prisma.customerWalletLedgerEntry.findUnique({
    where: { sourceKey: customerWalletReservationSourceKey(fixture.bookingId) },
  });
  const walletRelease = await prisma.customerWalletLedgerEntry.findUnique({
    where: { sourceKey: customerWalletReleaseSourceKey(fixture.bookingId) },
  });
  const [settlementCount, journalCount] = await Promise.all([
    prisma.bookingSettlementSnapshot.count({ where: { bookingId: fixture.bookingId } }),
    prisma.accountingJournalBatch.count({ where: { bookingId: fixture.bookingId } }),
  ]);
  const paymentResolution = auditLog?.metadata?.paymentResolution;
  const approved = fixture.decision === 'approve';
  const refundExpected = fixture.paymentStatus === PaymentStatus.CAPTURED;
  const expectedDecisionNote = `Customer request confirmed: ${fixture.note}`;

  assertCondition(booking.closedByRole === Role.ADMIN, `${fixture.key}: booking was not closed by ADMIN.`);
  assertCondition(
    booking.closedReason ===
      (approved ? 'post_match_cancellation_approved' : 'post_match_cancellation_fee_held'),
    `${fixture.key}: booking closedReason mismatch.`,
  );
  assertCondition(booking.closedNote === expectedDecisionNote, `${fixture.key}: booking closedNote mismatch.`);
  assertPaymentReviewedTask(booking.opsTasks, expectedDecisionNote);
  assertCondition(
    auditLog?.metadata?.decision === (approved ? 'APPROVED' : 'HELD'),
    `${fixture.key}: audit decision missing.`,
  );
  assertCondition(
    auditLog?.metadata?.decisionReason === decisionReason,
    `${fixture.key}: audit decision reason missing.`,
  );
  assertCondition(
    auditLog?.metadata?.autoApprovalWindow === approved,
    `${fixture.key}: audit autoApprovalWindow mismatch.`,
  );
  assertCondition(
    paymentResolution?.paymentId === fixture.paymentId,
    `${fixture.key}: payment resolution audit missing.`,
  );
  assertCondition(
    paymentResolution?.previousStatus === fixture.paymentStatus,
    `${fixture.key}: previous payment status audit mismatch.`,
  );
  assertCondition(settlementCount === 0, `${fixture.key}: cancellation created a settlement snapshot.`);
  assertCondition(journalCount === 0, `${fixture.key}: cancellation created an accounting journal.`);

  if (approved) {
    assertCondition(booking.earning?.status === EarningStatus.CANCELLED, `${fixture.key}: earning was not cancelled.`);
    assertCondition(booking.earning?.netAmount === 0, `${fixture.key}: earning was not restored to zero.`);
    assertCondition(
      ledger?.type === ProviderWalletLedgerType.REFUND_REVERSAL && ledger.amount === 30000,
      `${fixture.key}: Partner fee reversal ledger mismatch.`,
    );
  } else {
    assertCondition(booking.earning?.status === EarningStatus.PENDING, `${fixture.key}: earning should remain pending.`);
    assertCondition(booking.earning?.netAmount === -30000, `${fixture.key}: Partner fee deduction should remain.`);
    assertCondition(!ledger, `${fixture.key}: held decision must not create a Partner fee reversal ledger.`);
  }

  if (refundExpected) {
    assertCondition(booking.payment?.status === PaymentStatus.CAPTURED, `${fixture.key}: captured payment status changed early.`);
    assertCondition(refund?.status === 'REQUESTED', `${fixture.key}: refund request was not created.`);
    assertCondition(refund?.amount === 400000, `${fixture.key}: refund request amount mismatch.`);
    assertCondition(paymentResolution?.refundRequested === true, `${fixture.key}: refund audit flag missing.`);
    assertCondition(paymentResolution?.refundId === refund?.id, `${fixture.key}: refund audit id mismatch.`);
  } else {
    assertCondition(booking.payment?.status === PaymentStatus.RELEASED, `${fixture.key}: payment was not released.`);
    assertCondition(!refund, `${fixture.key}: non-captured payment must not create a refund.`);
    assertCondition(paymentResolution?.released === true, `${fixture.key}: release audit flag missing.`);
    assertCondition(paymentResolution?.status === PaymentStatus.RELEASED, `${fixture.key}: release audit status mismatch.`);
  }

  if (fixture.paymentMethod === PaymentMethod.CUSTOMER_WALLET) {
    assertCondition(walletReservation?.amount === -400000, `${fixture.key}: wallet reservation missing.`);
    assertCondition(walletRelease?.amount === 400000, `${fixture.key}: wallet release ledger mismatch.`);
    assertCondition(
      (walletReservation?.amount ?? 0) + (walletRelease?.amount ?? 0) === 0,
      `${fixture.key}: wallet reservation was not restored exactly.`,
    );
  } else {
    assertCondition(!walletReservation && !walletRelease, `${fixture.key}: non-wallet cancellation touched customer wallet.`);
  }

  return {
    bookingId: booking.id,
    decision: fixture.decision,
    method: fixture.paymentMethod,
    paymentStatus: booking.payment?.status,
    refundStatus: refund?.status ?? null,
    earningStatus: booking.earning?.status,
    earningNetAmount: booking.earning?.netAmount,
    partnerFeeReversalAmount: ledger?.amount ?? null,
    walletReleaseAmount: walletRelease?.amount ?? null,
    settlementCount,
    journalCount,
    auditAction: auditLog?.action,
  };
}

function assertPaymentReviewedTask(tasks, note) {
  const paymentReviewed = tasks.find((task) => task.type === BookingOpsTaskType.PAYMENT_REVIEWED);
  assertCondition(paymentReviewed?.status === BookingOpsTaskStatus.DONE, 'PAYMENT_REVIEWED ops task was not marked done.');
  assertCondition(paymentReviewed?.note === note, 'PAYMENT_REVIEWED ops task note mismatch.');
}

async function cleanupSmokeData() {
  const chatRooms = await prisma.chatRoom.findMany({
    where: { bookingId: { in: bookingIds } },
    select: { id: true },
  });
  const chatRoomIds = chatRooms.map((room) => room.id);

  await prisma.chatMessage.deleteMany({ where: { chatRoomId: { in: chatRoomIds } } });
  await prisma.chatRoom.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.providerWalletLedgerEntry.deleteMany({
    where: {
      OR: [
        { bookingId: { in: bookingIds } },
        { earningId: { in: earningIds } },
        { sourceKey: { in: earningIds.map(providerFeeReversalSourceKey) } },
      ],
    },
  });
  await prisma.customerWalletLedgerEntry.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingOpsTask.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.adminAuditLog.deleteMany({
    where: {
      target: {
        in: [
          ...bookingIds.map((bookingId) => `booking:${bookingId}`),
          ...paymentIds.map((paymentId) => `payment:${paymentId}`),
        ],
      },
    },
  });
  await prisma.accountingJournalBatch.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingSettlementSnapshot.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingAddressSnapshot.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.refund.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await prisma.providerEarning.deleteMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { id: { in: earningIds } }] },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.notificationDelivery.deleteMany({
    where: { notification: { userId: { in: smokeUserIds } } },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: smokeUserIds } } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({ where: { id: { in: smokeUserIds } } });
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function cancellationFixture(key, paymentMethod, paymentStatus, decision, minutesAfterMatch) {
  const matchedAt = adminVisible
    ? new Date(Date.now() - (decision === 'approve' ? 40 : 90) * 60_000)
    : new Date(`2026-06-13T${decision === 'approve' ? '03' : '04'}:00:00.000Z`);
  return {
    key,
    bookingId: `${fixturePrefix}_${key}_booking`,
    earningId: `${fixturePrefix}_${key}_earning`,
    chatRoomId: `${fixturePrefix}_${key}_chat_room`,
    paymentId: `${fixturePrefix}_${key}_payment`,
    paymentMethod,
    paymentStatus,
    decision,
    note:
      decision === 'approve'
        ? `${fixtureLabel} ${key}: evidence approved.`
        : `${fixtureLabel} ${key}: Partner fee hold remains.`,
    matchedAt,
    closedAt: new Date(matchedAt.getTime() + minutesAfterMatch * 60_000),
  };
}

function providerFeeReversalSourceKey(earningId) {
  return `earning:${earningId}:post-match-cancellation-approval`;
}

function customerWalletReservationSourceKey(bookingId) {
  return `customer-wallet-payment:${bookingId}:settlement`;
}

function customerWalletReleaseSourceKey(bookingId) {
  return `customer-wallet-payment:${bookingId}:release`;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function adminJwt(userId) {
  return jwt.sign(
    { sub: userId, activeRole: Role.ADMIN, roles: [Role.ADMIN] },
    nonEmptyString(env.JWT_ACCESS_SECRET) ?? 'dev-access-secret',
    { expiresIn: '10m' },
  );
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
