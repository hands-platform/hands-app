import {
  BookingStatus,
  PrismaClient,
  Role,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile =
  process.argv
    .find((argument) => argument.startsWith('--env='))
    ?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const apiBaseUrl = env.API_BASE_URL ?? 'http://localhost:3000/api';
const prisma = new PrismaClient();
const runId = `provider-chat-unread-${Date.now()}`;
const startedAt = new Date(Date.now() - 1_000);
const smokeMessageBody = `HANDS provider chat unread smoke ${runId}`;
const activeStatuses = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];

assertLocalSmokeTarget(apiBaseUrl, env.NODE_ENV);

let booking;
let createdMessageId;
let syntheticNotificationId;
let baselineRoomNotificationIds = [];
let baselineUnreadCount;
let smokeResult;

try {
  await requireApiReady();
  booking = await findActiveChatBooking();
  baselineRoomNotificationIds = (
    await prisma.notification.findMany({
      where: providerUnreadChatWhere(
        booking.selectedProvider.userId,
        booking.chatRoom.id,
      ),
      select: { id: true },
    })
  ).map((notification) => notification.id);

  const [customerAuth, providerAuth] = await Promise.all([
    mobileAuth(booking.customerProfile.user.phone, Role.CUSTOMER),
    mobileAuth(booking.selectedProvider.user.phone, Role.PROVIDER),
  ]);
  assertCondition(
    customerAuth.user?.customerProfile?.id === booking.customerProfileId,
    'Customer OTP session resolved to an unexpected profile.',
  );
  assertCondition(
    providerAuth.user?.providerProfile?.id === booking.selectedProviderId,
    'Provider OTP session resolved to an unexpected profile.',
  );

  const before = await getJson(
    '/notifications/provider-chat/summary',
    providerAuth.accessToken,
  );
  const persistedBefore = await prisma.notification.count({
    where: providerUnreadChatWhere(booking.selectedProvider.userId),
  });
  baselineUnreadCount = persistedBefore;
  assertCount(before, persistedBefore, 'Initial unread summary');
  assertRoomsArray(before, 'Initial unread summary');

  const message = await postJson(
    `/chat/rooms/${booking.chatRoom.id}/messages`,
    customerAuth.accessToken,
    { body: smokeMessageBody },
  );
  createdMessageId = message.id;
  assertCondition(
    typeof createdMessageId === 'string' && createdMessageId.length > 0,
    'Chat message API did not return a message id.',
  );

  const providerMessages = await getJson(
    `/chat/rooms/${booking.chatRoom.id}/messages`,
    providerAuth.accessToken,
  );
  assertCondition(
    Array.isArray(providerMessages) &&
      providerMessages.some((item) => item?.id === createdMessageId),
    'Provider could not read the customer smoke message.',
  );

  const createdChatNotifications = await waitForCreatedChatNotifications(
    booking.selectedProvider.userId,
    booking.chatRoom.id,
  );
  const afterMessage = await getJson(
    '/notifications/provider-chat/summary',
    providerAuth.accessToken,
  );
  assertCount(
    afterMessage,
    persistedBefore + createdChatNotifications.length,
    'Unread summary after customer message',
  );
  assertRoomCount(
    afterMessage,
    booking.chatRoom.id,
    baselineRoomNotificationIds.length + createdChatNotifications.length,
    'Opened-room summary after customer message',
  );

  const syntheticNotification = await prisma.notification.create({
    data: {
      userId: booking.selectedProvider.userId,
      type: 'chat.message.created',
      title: 'Provider chat unread smoke',
      body: 'Temporary second-room unread evidence.',
      data: {
        fixture: true,
        targetRole: Role.PROVIDER,
        chatRoomId: `${runId}-other-room`,
        smokeRunId: runId,
      },
    },
    select: { id: true },
  });
  syntheticNotificationId = syntheticNotification.id;

  const afterSecondRoom = await getJson(
    '/notifications/provider-chat/summary',
    providerAuth.accessToken,
  );
  assertCount(
    afterSecondRoom,
    persistedBefore + createdChatNotifications.length + 1,
    'Unread summary after second room',
  );
  assertRoomCount(
    afterSecondRoom,
    booking.chatRoom.id,
    baselineRoomNotificationIds.length + createdChatNotifications.length,
    'Opened-room summary before read',
  );
  assertRoomCount(
    afterSecondRoom,
    `${runId}-other-room`,
    1,
    'Second-room summary before read',
  );

  const afterRead = await patchJson(
    '/notifications/provider-chat/read',
    providerAuth.accessToken,
    { chatRoomId: booking.chatRoom.id },
  );
  const expectedAfterRead =
    persistedBefore -
    baselineRoomNotificationIds.length +
    1;
  assertCount(afterRead, expectedAfterRead, 'Unread summary after opening chat');
  assertRoomCount(
    afterRead,
    booking.chatRoom.id,
    0,
    'Opened-room summary after read',
  );
  assertRoomCount(
    afterRead,
    `${runId}-other-room`,
    1,
    'Second-room summary after opening another chat',
  );
  assertCondition(
    afterRead.updated ===
      baselineRoomNotificationIds.length + createdChatNotifications.length,
    'Room read update did not match the unread rows for the opened chat.',
  );

  const preservedOtherRoom = await prisma.notification.findUnique({
    where: { id: syntheticNotificationId },
    select: { readAt: true },
  });
  assertCondition(
    preservedOtherRoom?.readAt === null,
    'Opening one chat incorrectly marked another room read.',
  );

  smokeResult = {
    ok: true,
    bookingStatus: booking.status,
    baselineUnread: persistedBefore,
    afterCustomerMessage: afterMessage.unreadCount,
    afterSecondRoom: afterSecondRoom.unreadCount,
    afterOpenedRoom: afterRead.unreadCount,
    openedRoomUpdated: afterRead.updated,
    providerMessageVisible: true,
    openedRoomBadgeCleared: true,
    otherRoomBadgePreserved: true,
    otherRoomPreserved: true,
  };
} finally {
  await cleanup();
  await prisma.$disconnect();
}

console.log(
  JSON.stringify(
    {
      ...smokeResult,
      cleanupVerified: true,
    },
    null,
    2,
  ),
);

async function cleanup() {
  if (booking) {
    await prisma.notification.deleteMany({
      where: {
        userId: booking.selectedProvider.userId,
        type: 'chat.message.created',
        createdAt: { gte: startedAt },
        data: {
          path: ['chatRoomId'],
          equals: booking.chatRoom.id,
        },
      },
    });
  }
  if (syntheticNotificationId) {
    await prisma.notification.deleteMany({
      where: { id: syntheticNotificationId },
    });
  }
  if (createdMessageId) {
    await prisma.chatMessage.deleteMany({
      where: { id: createdMessageId },
    });
  }
  if (baselineRoomNotificationIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: baselineRoomNotificationIds } },
      data: { readAt: null },
    });
  }
  if (booking && baselineUnreadCount !== undefined) {
    const [remainingMessages, remainingNotifications, restoredUnreadCount] =
      await Promise.all([
        prisma.chatMessage.count({
          where: { body: smokeMessageBody },
        }),
        prisma.notification.count({
          where: {
            userId: booking.selectedProvider.userId,
            OR: [
              {
                data: {
                  path: ['smokeRunId'],
                  equals: runId,
                },
              },
              {
                type: 'chat.message.created',
                createdAt: { gte: startedAt },
                data: {
                  path: ['chatRoomId'],
                  equals: booking.chatRoom.id,
                },
              },
            ],
          },
        }),
        prisma.notification.count({
          where: providerUnreadChatWhere(booking.selectedProvider.userId),
        }),
      ]);
    assertCondition(
      remainingMessages === 0 && remainingNotifications === 0,
      'Smoke cleanup left temporary chat evidence behind.',
    );
    assertCondition(
      restoredUnreadCount === baselineUnreadCount,
      'Smoke cleanup did not restore the original Provider unread count.',
    );
  }
}

async function findActiveChatBooking() {
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: activeStatuses },
      selectedProviderId: { not: null },
      chatRoom: { isNot: null },
      customerProfile: { user: { phone: { not: '' } } },
      selectedProvider: { user: { phone: { not: '' } } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      status: true,
      customerProfileId: true,
      selectedProviderId: true,
      chatRoom: { select: { id: true } },
      customerProfile: {
        select: {
          user: { select: { phone: true } },
        },
      },
      selectedProvider: {
        select: {
          userId: true,
          user: { select: { phone: true } },
        },
      },
    },
  });

  const candidate = candidates.find(
    (item) =>
      item.chatRoom &&
      item.customerProfile.user.phone &&
      item.selectedProvider?.user.phone,
  );
  if (!candidate?.chatRoom || !candidate.selectedProvider) {
    throw new Error(
      'An active booking with customer, Provider, and chat room is required.',
    );
  }
  return {
    ...candidate,
    chatRoom: candidate.chatRoom,
    selectedProvider: candidate.selectedProvider,
  };
}

async function waitForCreatedChatNotifications(userId, chatRoomId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const notifications = await prisma.notification.findMany({
      where: {
        ...providerUnreadChatWhere(userId, chatRoomId),
        createdAt: { gte: startedAt },
      },
      select: { id: true },
    });
    if (notifications.length > 0) {
      return notifications;
    }
    await sleep(100);
  }
  throw new Error('Customer chat message did not create a Provider notification.');
}

function providerUnreadChatWhere(userId, chatRoomId) {
  return {
    userId,
    type: 'chat.message.created',
    readAt: null,
    AND: [
      {
        data: {
          path: ['targetRole'],
          equals: Role.PROVIDER,
        },
      },
      ...(chatRoomId
        ? [
            {
              data: {
                path: ['chatRoomId'],
                equals: chatRoomId,
              },
            },
          ]
        : []),
    ],
  };
}

async function requireApiReady() {
  const health = await request('/health/ready');
  assertCondition(health.ok === true, 'API readiness check failed.');
}

function mobileAuth(phone, role) {
  return postJson('/auth/verify-otp', null, {
    phone,
    role,
    otp: env.DEV_OTP ?? '123456',
  });
}

function getJson(path, accessToken) {
  return request(path, {
    headers: accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : {},
  });
}

function postJson(path, accessToken, body) {
  return request(path, {
    method: 'POST',
    headers: accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : {},
    body: JSON.stringify(body),
  });
}

function patchJson(path, accessToken, body) {
  return request(path, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function assertCount(result, expected, label) {
  assertCondition(
    result?.unreadCount === expected,
    `${label} expected ${expected}, received ${result?.unreadCount}.`,
  );
}

function assertRoomsArray(result, label) {
  assertCondition(
    Array.isArray(result?.rooms),
    `${label} did not return room-level unread counts.`,
  );
}

function assertRoomCount(result, chatRoomId, expected, label) {
  assertRoomsArray(result, label);
  const row = result.rooms.find((item) => item?.chatRoomId === chatRoomId);
  const actual = row?.unreadCount ?? 0;
  assertCondition(
    actual === expected,
    `${label} expected ${expected}, received ${actual}.`,
  );
}

function assertLocalSmokeTarget(value, nodeEnv) {
  const host = new URL(value).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Provider chat unread smoke may only target a local API.');
  }
  if (nodeEnv === 'production') {
    throw new Error(
      'Provider chat unread smoke is disabled when NODE_ENV=production.',
    );
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
