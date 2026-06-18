import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  PrismaClient,
  Role,
} from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const keep = process.argv.includes('--keep');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const apiBaseUrl = nonEmptyString(env.API_BASE_URL) ?? 'http://localhost:3000/api';
const adminAccessToken = nonEmptyString(env.ADMIN_ACCESS_TOKEN);
const adminPhone = nonEmptyString(env.ADMIN_DEMO_PHONE) ?? '+84900000099';
const adminOtp = nonEmptyString(env.ADMIN_DEMO_OTP) ?? '123456';

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for post-match cancellation smoke.');
}

const prisma = new PrismaClient();

const ids = {
  customerUser: 'smoke_post_match_customer_user',
  providerUser: 'smoke_post_match_provider_user',
  customerProfile: 'smoke_post_match_customer_profile',
  providerProfile: 'smoke_post_match_provider_profile',
  approveBooking: 'smoke_post_match_approve_booking',
  holdBooking: 'smoke_post_match_hold_booking',
  approveEarning: 'smoke_post_match_approve_earning',
  holdEarning: 'smoke_post_match_hold_earning',
  approveChatRoom: 'smoke_post_match_approve_chat_room',
  holdChatRoom: 'smoke_post_match_hold_chat_room',
};

const bookingIds = [ids.approveBooking, ids.holdBooking];
const earningIds = [ids.approveEarning, ids.holdEarning];
const smokeUserIds = [ids.customerUser, ids.providerUser];
const approvalSourceKey = `earning:${ids.approveEarning}:post-match-cancellation-approval`;
const holdSourceKey = `earning:${ids.holdEarning}:post-match-cancellation-approval`;

try {
  await cleanupSmokeData();
  await seedSmokeData();

  const accessToken = adminAccessToken ?? (await loginAsAdmin());
  await postDecision(accessToken, ids.approveBooking, 'approve', 'Smoke approve: chat evidence checked.');
  await postDecision(accessToken, ids.holdBooking, 'hold', 'Smoke hold: fee deduction remains.');

  const approve = await verifyApprovedBooking();
  const hold = await verifyHeldBooking();

  const result = {
    ok: true,
    apiBaseUrl,
    envFile: { path: envPath, exists: envFileExists },
    keep,
    checks: {
      approved: approve,
      held: hold,
    },
  };

  if (!keep) {
    await cleanupSmokeData();
    result.cleanup = 'completed';
  } else {
    result.cleanup = 'skipped (--keep)';
  }

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (!keep) {
    await cleanupSmokeData().catch(() => undefined);
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

async function loginAsAdmin() {
  const body = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: adminPhone, otp: adminOtp, role: Role.ADMIN }),
  });

  assertCondition(typeof body.accessToken === 'string' && body.accessToken.length > 0, 'Admin login did not return an access token.');
  return body.accessToken;
}

async function postDecision(accessToken, bookingId, action, note) {
  return request(`/admin/bookings/${bookingId}/post-match-cancellation/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ note }),
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

async function seedSmokeData() {
  await prisma.user.create({
    data: {
      id: ids.customerUser,
      phone: '+84900007001',
      fullName: 'Smoke Customer',
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
      phone: '+84900007002',
      fullName: 'Smoke Partner',
      roles: [Role.PROVIDER],
      providerProfile: {
        create: {
          id: ids.providerProfile,
          displayName: 'Smoke Partner',
          city: 'Ho Chi Minh City',
          status: ProviderStatus.ONLINE_BUSY,
          serviceArea: { cities: ['Ho Chi Minh City'] },
        },
      },
    },
  });

  await createCancellationBooking({
    bookingId: ids.approveBooking,
    earningId: ids.approveEarning,
    chatRoomId: ids.approveChatRoom,
    matchedAt: new Date('2026-06-13T03:00:00.000Z'),
    closedAt: new Date('2026-06-13T03:10:00.000Z'),
  });

  await createCancellationBooking({
    bookingId: ids.holdBooking,
    earningId: ids.holdEarning,
    chatRoomId: ids.holdChatRoom,
    matchedAt: new Date('2026-06-13T04:00:00.000Z'),
    closedAt: new Date('2026-06-13T04:30:00.000Z'),
  });
}

async function createCancellationBooking({ bookingId, earningId, chatRoomId, matchedAt, closedAt }) {
  const address = {
    addressText: '22 Le Thanh Ton, District 1, Ho Chi Minh City',
    detail: 'Smoke booking address',
    city: 'Ho Chi Minh City',
    country: 'VN',
  };

  await prisma.booking.create({
    data: {
      id: bookingId,
      customerProfileId: ids.customerProfile,
      selectedProviderId: ids.providerProfile,
      status: BookingStatus.CANCELLED,
      scheduledStartAt: new Date('2026-06-13T05:00:00.000Z'),
      scheduledEndAt: new Date('2026-06-13T06:00:00.000Z'),
      address,
      lat: 10.7769,
      lng: 106.7009,
      notes: 'Smoke seed: post-match cancellation from Partner chat.',
      metadata: { smoke: 'post-match-cancellation' },
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
          messages: {
            create: [
              {
                senderId: ids.providerUser,
                body: 'Smoke evidence: Partner requested cancellation after match.',
                createdAt: closedAt,
              },
              {
                senderId: ids.customerUser,
                body: 'Smoke evidence: customer acknowledged the cancellation.',
                createdAt: new Date(closedAt.getTime() + 60_000),
              },
            ],
          },
        },
      },
      earning: {
        create: {
          id: earningId,
          providerProfileId: ids.providerProfile,
          grossAmount: 400000,
          platformFee: 30000,
          netAmount: -30000,
          status: EarningStatus.PENDING,
        },
      },
    },
  });
}

async function verifyApprovedBooking() {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: ids.approveBooking },
    include: {
      earning: true,
      opsTasks: true,
      walletLedgerEntries: true,
    },
  });
  const auditLog = await prisma.adminAuditLog.findFirst({
    where: {
      action: 'booking.post_match_cancellation.approve',
      target: `booking:${ids.approveBooking}`,
    },
    orderBy: { createdAt: 'desc' },
  });
  const ledger = await prisma.providerWalletLedgerEntry.findUnique({
    where: { sourceKey: approvalSourceKey },
  });

  assertCondition(booking.closedByRole === Role.ADMIN, 'Approved booking was not closed by ADMIN.');
  assertCondition(booking.closedReason === 'post_match_cancellation_approved', 'Approved booking closedReason mismatch.');
  assertCondition(booking.closedNote === 'Smoke approve: chat evidence checked.', 'Approved booking closedNote mismatch.');
  assertCondition(booking.earning?.status === EarningStatus.CANCELLED, 'Approved booking earning was not cancelled.');
  assertCondition(booking.earning?.netAmount === 0, 'Approved booking earning was not restored to zero.');
  assertCondition(ledger?.type === ProviderWalletLedgerType.REFUND_REVERSAL, 'Approved booking refund reversal ledger missing.');
  assertCondition(ledger?.amount === 30000, 'Approved booking refund reversal ledger amount mismatch.');
  assertPaymentReviewedTask(booking.opsTasks, 'Smoke approve: chat evidence checked.');
  assertCondition(auditLog?.metadata?.decision === 'APPROVED', 'Approved booking audit decision missing.');
  assertCondition(auditLog?.metadata?.autoApprovalWindow === true, 'Approved booking audit autoApprovalWindow mismatch.');

  return {
    bookingId: booking.id,
    closedReason: booking.closedReason,
    earningStatus: booking.earning?.status,
    earningNetAmount: booking.earning?.netAmount,
    ledgerAmount: ledger?.amount,
    auditAction: auditLog?.action,
  };
}

async function verifyHeldBooking() {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: ids.holdBooking },
    include: {
      earning: true,
      opsTasks: true,
      walletLedgerEntries: true,
    },
  });
  const auditLog = await prisma.adminAuditLog.findFirst({
    where: {
      action: 'booking.post_match_cancellation.hold',
      target: `booking:${ids.holdBooking}`,
    },
    orderBy: { createdAt: 'desc' },
  });
  const ledger = await prisma.providerWalletLedgerEntry.findUnique({
    where: { sourceKey: holdSourceKey },
  });

  assertCondition(booking.closedByRole === Role.ADMIN, 'Held booking was not closed by ADMIN.');
  assertCondition(booking.closedReason === 'post_match_cancellation_fee_held', 'Held booking closedReason mismatch.');
  assertCondition(booking.closedNote === 'Smoke hold: fee deduction remains.', 'Held booking closedNote mismatch.');
  assertCondition(booking.earning?.status === EarningStatus.PENDING, 'Held booking earning status should remain pending.');
  assertCondition(booking.earning?.netAmount === -30000, 'Held booking fee deduction should remain.');
  assertCondition(!ledger, 'Held booking should not create a refund reversal ledger.');
  assertPaymentReviewedTask(booking.opsTasks, 'Smoke hold: fee deduction remains.');
  assertCondition(auditLog?.metadata?.decision === 'HELD', 'Held booking audit decision missing.');
  assertCondition(auditLog?.metadata?.autoApprovalWindow === false, 'Held booking audit autoApprovalWindow mismatch.');

  return {
    bookingId: booking.id,
    closedReason: booking.closedReason,
    earningStatus: booking.earning?.status,
    earningNetAmount: booking.earning?.netAmount,
    ledgerAmount: null,
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
        { sourceKey: { in: [approvalSourceKey, holdSourceKey] } },
      ],
    },
  });
  await prisma.bookingOpsTask.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.adminAuditLog.deleteMany({
    where: { target: { in: bookingIds.map((bookingId) => `booking:${bookingId}`) } },
  });
  await prisma.bookingAddressSnapshot.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.providerEarning.deleteMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { id: { in: earningIds } }] },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({ where: { id: { in: smokeUserIds } } });
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
