import jwt from 'jsonwebtoken';
import { AdminUserProvenance, PrismaClient, Role } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { io } from 'socket.io-client';

import { loadMergedEnv } from './lib/env-file.mjs';

const { env } = loadMergedEnv('.env');

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const socketBaseUrl = process.env.SOCKET_BASE_URL ?? apiBaseUrl.replace(/\/api$/, '');

function jwtAccessSecret() {
  const configured = env.JWT_ACCESS_SECRET?.trim();
  if (configured && !['change-me', 'changeme', 'secret', 'password'].includes(configured.toLowerCase())) {
    return configured;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET must be configured before running realtime smoke in production.');
  }
  return 'dev-access-secret';
}

async function createSmokeAdminAccessToken() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: {
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        roles: { has: Role.MASTER_ADMIN },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!user) {
      throw new Error('Realtime smoke requires an explicit fixture MASTER_ADMIN account.');
    }
    return jwt.sign(
      { sub: user.id, activeRole: Role.ADMIN, roles: user.roles },
      jwtAccessSecret(),
      { expiresIn: '10m' },
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function selectSmokeProviderPhone() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.providerProfile.findFirst({
      where: {
        AND: ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'].map((type) => ({
          documents: { some: { deletedAt: null, status: 'APPROVED', type } },
        })),
        deletedAt: null,
        kyc: { is: { status: 'APPROVED' } },
        selectedBookings: {
          none: { status: { in: ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'] } },
        },
        user: { roles: { has: Role.PROVIDER } },
        verification: { is: { status: 'APPROVED' } },
        walletBalanceSummaries: { none: { currency: 'VND', balance: { lt: 0n } } },
      },
      orderBy: { updatedAt: 'desc' },
      select: { user: { select: { phone: true } } },
    });
    if (!provider) {
      throw new Error('Realtime smoke requires an idle provider with a non-negative VND wallet.');
    }
    return provider.user.phone;
  } finally {
    await prisma.$disconnect();
  }
}

async function expireBookingTimeoutNow(bookingId) {
  const prisma = new PrismaClient();
  const redis = new IORedis(env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue('booking-timeouts', { connection: redis });
  try {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const job = await queue.getJob(`booking-timeout-${bookingId}`);
    if (!job) {
      throw new Error(`Booking timeout job is missing for ${bookingId}`);
    }
    await job.promote();
  } finally {
    await queue.close();
    await prisma.$disconnect();
    if (redis.status !== 'end') {
      await redis.quit();
    }
  }
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

const postJson = (path, accessToken, body = {}) =>
  request(path, {
    method: 'POST',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    body: JSON.stringify(body),
  });

const getJson = (path, accessToken) =>
  request(path, {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });

function connectSocket(accessToken) {
  return new Promise((resolve, reject) => {
    const socket = io(socketBaseUrl, {
      auth: { token: accessToken },
      forceNew: true,
      timeout: 5000,
      transports: ['websocket'],
    });
    const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 7000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function handler(payload) {
      if (!predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }

    socket.on(event, handler);
  });
}

function emitAndWait(socket, event, payload, delayMs = 500) {
  socket.emit(event, payload);
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

const health = await request('/health/ready');
if (!health.ok) {
  throw new Error(`API is not ready: ${JSON.stringify(health)}`);
}

const customerAuth = await postJson('/auth/verify-otp', null, {
  phone: '+84900000001',
  otp: '123456',
  role: 'CUSTOMER',
});
const providerPhone = await selectSmokeProviderPhone();
const providerAuth = await postJson('/auth/verify-otp', null, {
  phone: providerPhone,
  otp: '123456',
  role: 'PROVIDER',
});
const adminAccessToken = await createSmokeAdminAccessToken();

await postJson(`/admin/providers/${providerAuth.user.providerProfile.id}/approve`, adminAccessToken);
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/unblock`, adminAccessToken);
const onlineProvider = await postJson('/provider/online', providerAuth.accessToken);
if (onlineProvider.status === 'OFFLINE') {
  throw new Error(`Provider failed to go online before realtime smoke: ${JSON.stringify(onlineProvider)}`);
}
await postJson('/provider/location', providerAuth.accessToken, { lat: 10.7769, lng: 106.7009 });

const providerSocket = await connectSocket(providerAuth.accessToken);
const customerSocket = await connectSocket(customerAuth.accessToken);
let smokeBookingId = null;
let smokeBookingMatched = false;

try {
  const services = await getJson('/services');
  const service = services[0];
  const createSmokeBooking = (label, providerId) =>
    postJson('/customer/bookings', customerAuth.accessToken, {
      serviceId: service.id,
      ...(providerId ? { providerId } : {}),
      address: { line1: `${label} ${Date.now()}` },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
    });

  const bookingOpened = waitForEvent(
    providerSocket,
    'booking.opened',
    (payload) => payload?.event === 'booking.opened' && payload?.status === 'OPEN_MATCHING',
  );
  const booking = await createSmokeBooking('Realtime marketplace smoke');
  smokeBookingId = booking.id;

  const openedPayload = await bookingOpened;
  if (openedPayload.bookingId !== booking.id) {
    throw new Error(`Provider received booking.opened for ${openedPayload.bookingId}, expected ${booking.id}`);
  }

  await emitAndWait(customerSocket, 'booking.join_room', { bookingId: booking.id });

  const providerJoined = waitForEvent(customerSocket, 'provider.joined', (payload) => payload.bookingId === booking.id);
  await postJson('/provider/online', providerAuth.accessToken);
  await postJson(`/provider/bookings/${booking.id}/join`, providerAuth.accessToken);
  await providerJoined;

  await emitAndWait(providerSocket, 'booking.join_room', { bookingId: booking.id });

  const bookingMatched = waitForEvent(customerSocket, 'booking.matched', (payload) => payload.bookingId === booking.id);
  await postJson(`/customer/bookings/${booking.id}/select-provider`, customerAuth.accessToken, {
    providerId: providerAuth.user.providerProfile.id,
  });
  smokeBookingMatched = true;
  const matchedPayload = await bookingMatched;
  const chatRoomId = matchedPayload.booking.chatRoom.id;

  const providerLocationUpdated = waitForEvent(
    customerSocket,
    'provider.location.updated',
    (payload) => payload.bookingId === booking.id && payload.providerProfileId === providerAuth.user.providerProfile.id,
  );
  providerSocket.emit('provider.location.update', {
    bookingId: booking.id,
    lat: 10.7769,
    lng: 106.7009,
  });
  const locationPayload = await providerLocationUpdated;

  await emitAndWait(customerSocket, 'chat.join_room', { chatRoomId });
  await emitAndWait(providerSocket, 'chat.join_room', { chatRoomId });
  const chatMessageCreated = waitForEvent(
    providerSocket,
    'chat.message.created',
    (payload) => payload.chatRoomId === chatRoomId && payload.body === 'Realtime hello',
  );
  customerSocket.emit('chat.message.create', { chatRoomId, text: 'Realtime hello' });
  const chatPayload = await chatMessageCreated;

  const cleanup = await postJson(`/provider/bookings/${booking.id}/cancel`, providerAuth.accessToken, {
    reasonCode: 'CUSTOMER_REQUESTED',
    note: 'Realtime smoke cleanup after successful contract verification.',
    lat: 10.7769,
    lng: 106.7009,
    addressText: 'Realtime smoke location',
  });
  smokeBookingId = null;
  if (cleanup.status !== 'CANCELLED') {
    throw new Error(`Realtime smoke cleanup returned ${cleanup.status}, expected CANCELLED`);
  }

  await postJson('/provider/online', providerAuth.accessToken);
  const preferredAcceptOpened = waitForEvent(
    providerSocket,
    'booking.opened',
    (payload) => payload?.event === 'booking.opened' && payload?.status === 'OPEN_MATCHING',
  );
  const preferredAcceptBooking = await createSmokeBooking(
    'Realtime preferred accept smoke',
    providerAuth.user.providerProfile.id,
  );
  smokeBookingId = preferredAcceptBooking.id;
  smokeBookingMatched = false;
  const preferredAcceptOpenedPayload = await preferredAcceptOpened;
  if (preferredAcceptOpenedPayload.bookingId !== preferredAcceptBooking.id) {
    throw new Error(
      `Provider received preferred booking.opened for ${preferredAcceptOpenedPayload.bookingId}, expected ${preferredAcceptBooking.id}`,
    );
  }
  await emitAndWait(customerSocket, 'booking.join_room', { bookingId: preferredAcceptBooking.id });
  const preferredAcceptedEvent = waitForEvent(
    customerSocket,
    'booking.matched',
    (payload) => payload?.bookingId === preferredAcceptBooking.id,
  );
  const preferredAccepted = await postJson(
    `/provider/bookings/${preferredAcceptBooking.id}/accept`,
    providerAuth.accessToken,
  );
  smokeBookingMatched = true;
  const preferredAcceptedPayload = await preferredAcceptedEvent;
  if (
    preferredAccepted.status !== 'IN_SERVICE' ||
    preferredAcceptedPayload.status !== 'IN_SERVICE' ||
    preferredAccepted.matchSource !== 'FIRST_PICK_ACCEPTED_FIRST'
  ) {
    throw new Error(`Preferred accept did not activate service: ${JSON.stringify(preferredAccepted)}`);
  }
  const preferredAcceptCleanup = await postJson(
    `/provider/bookings/${preferredAcceptBooking.id}/cancel`,
    providerAuth.accessToken,
    {
      reasonCode: 'CUSTOMER_REQUESTED',
      note: 'Realtime preferred accept smoke cleanup.',
      lat: 10.7769,
      lng: 106.7009,
      addressText: 'Realtime smoke location',
    },
  );
  smokeBookingId = null;
  if (preferredAcceptCleanup.status !== 'CANCELLED') {
    throw new Error(`Preferred accept cleanup returned ${preferredAcceptCleanup.status}, expected CANCELLED`);
  }

  await postJson('/provider/online', providerAuth.accessToken);
  const preferredRejectOpened = waitForEvent(
    providerSocket,
    'booking.opened',
    (payload) => payload?.event === 'booking.opened' && payload?.status === 'OPEN_MATCHING',
  );
  const preferredRejectBooking = await createSmokeBooking(
    'Realtime preferred reject smoke',
    providerAuth.user.providerProfile.id,
  );
  smokeBookingId = preferredRejectBooking.id;
  smokeBookingMatched = false;
  const preferredRejectOpenedPayload = await preferredRejectOpened;
  if (preferredRejectOpenedPayload.bookingId !== preferredRejectBooking.id) {
    throw new Error(
      `Provider received preferred booking.opened for ${preferredRejectOpenedPayload.bookingId}, expected ${preferredRejectBooking.id}`,
    );
  }
  await emitAndWait(customerSocket, 'booking.join_room', { bookingId: preferredRejectBooking.id });
  const preferredRejectedEvent = waitForEvent(
    customerSocket,
    'booking.expired',
    (payload) => payload?.id === preferredRejectBooking.id,
  );
  const preferredRejected = await postJson(
    `/provider/bookings/${preferredRejectBooking.id}/reject`,
    providerAuth.accessToken,
    {
      reasonCode: 'SCHEDULE_CONFLICT',
      reasonDetail: 'Realtime smoke preferred request rejection.',
    },
  );
  await preferredRejectedEvent;
  smokeBookingId = null;
  if (
    preferredRejected.status !== 'CANCELLED' ||
    preferredRejected.cancellation?.reasonCode !== 'PREFERRED_PARTNER_DECLINED'
  ) {
    throw new Error(`Preferred rejection returned an unexpected result: ${JSON.stringify(preferredRejected)}`);
  }

  await postJson('/provider/online', providerAuth.accessToken);
  const preferredNoResponseOpened = waitForEvent(
    providerSocket,
    'booking.opened',
    (payload) => payload?.event === 'booking.opened' && payload?.status === 'OPEN_MATCHING',
  );
  const preferredNoResponseBooking = await createSmokeBooking(
    'Realtime preferred no response smoke',
    providerAuth.user.providerProfile.id,
  );
  smokeBookingId = preferredNoResponseBooking.id;
  smokeBookingMatched = false;
  const preferredNoResponseOpenedPayload = await preferredNoResponseOpened;
  if (preferredNoResponseOpenedPayload.bookingId !== preferredNoResponseBooking.id) {
    throw new Error(
      `Provider received preferred booking.opened for ${preferredNoResponseOpenedPayload.bookingId}, expected ${preferredNoResponseBooking.id}`,
    );
  }
  await emitAndWait(customerSocket, 'booking.join_room', { bookingId: preferredNoResponseBooking.id });
  const preferredNoResponseEvent = waitForEvent(
    customerSocket,
    'booking.expired',
    (payload) => payload?.id === preferredNoResponseBooking.id,
    10_000,
  );
  await expireBookingTimeoutNow(preferredNoResponseBooking.id);
  const preferredNoResponsePayload = await preferredNoResponseEvent;
  smokeBookingId = null;
  if (
    preferredNoResponsePayload.status !== 'EXPIRED' ||
    preferredNoResponsePayload.closedReason !== 'preferred_provider_no_response'
  ) {
    throw new Error(`Preferred no-response returned an unexpected result: ${JSON.stringify(preferredNoResponsePayload)}`);
  }

  const prisma = new PrismaClient();
  let preferredRequestEvents;
  let preferredTerminalBookings;
  try {
    [preferredRequestEvents, preferredTerminalBookings] = await Promise.all([
      prisma.providerBookingRequestEvent.findMany({
        where: { bookingId: { in: [preferredRejectBooking.id, preferredNoResponseBooking.id] } },
        select: { bookingId: true, eventType: true, metadata: true },
      }),
      prisma.booking.findMany({
        where: { id: { in: [preferredRejectBooking.id, preferredNoResponseBooking.id] } },
        select: { id: true, status: true, closedReason: true },
      }),
    ]);
  } finally {
    await prisma.$disconnect();
  }
  const rejectionEvent = preferredRequestEvents.find(
    (event) => event.bookingId === preferredRejectBooking.id && event.eventType === 'PREFERRED_PROVIDER_REJECTED',
  );
  const noResponseEvent = preferredRequestEvents.find(
    (event) =>
      event.bookingId === preferredNoResponseBooking.id && event.eventType === 'PREFERRED_PROVIDER_NO_RESPONSE',
  );
  const rejectedTerminalBooking = preferredTerminalBookings.find((item) => item.id === preferredRejectBooking.id);
  const noResponseTerminalBooking = preferredTerminalBookings.find(
    (item) => item.id === preferredNoResponseBooking.id,
  );
  if (
    rejectionEvent?.metadata?.reasonCode !== 'SCHEDULE_CONFLICT' ||
    !noResponseEvent ||
    rejectedTerminalBooking?.closedReason !== 'preferred_provider_rejected' ||
    noResponseTerminalBooking?.closedReason !== 'preferred_provider_no_response'
  ) {
    throw new Error(`Preferred request audit events are incomplete: ${JSON.stringify(preferredRequestEvents)}`);
  }

  console.log({
    ok: true,
    bookingId: booking.id,
    chatRoomId,
    chatMessageId: chatPayload.id,
    openedEvent: openedPayload.status,
    joinedEvent: 'provider.joined',
    matchedEvent: matchedPayload.status,
    serviceActiveAtMatch: matchedPayload.status === 'IN_SERVICE',
    locationEvent: {
      lat: locationPayload.lat,
      lng: locationPayload.lng,
      recordedAt: locationPayload.recordedAt,
    },
    chatEvent: 'chat.message.created',
    cleanupStatus: cleanup.status,
    providerRoomBroadcast: true,
    preferredAccept: {
      bookingId: preferredAcceptBooking.id,
      status: preferredAccepted.status,
      matchSource: preferredAccepted.matchSource,
      cleanupStatus: preferredAcceptCleanup.status,
    },
    preferredReject: {
      bookingId: preferredRejectBooking.id,
      status: preferredRejected.status,
      closedReason: rejectedTerminalBooking.closedReason,
      reasonCode: rejectionEvent.metadata.reasonCode,
    },
    preferredNoResponse: {
      bookingId: preferredNoResponseBooking.id,
      status: preferredNoResponsePayload.status,
      closedReason: noResponseTerminalBooking.closedReason,
      eventType: noResponseEvent.eventType,
    },
  });
} finally {
  if (smokeBookingId) {
    try {
      if (smokeBookingMatched) {
        await postJson(`/provider/bookings/${smokeBookingId}/cancel`, providerAuth.accessToken, {
          reasonCode: 'CUSTOMER_REQUESTED',
          note: 'Realtime smoke cleanup after an interrupted verification.',
          lat: 10.7769,
          lng: 106.7009,
          addressText: 'Realtime smoke location',
        });
      } else {
        await postJson(`/customer/bookings/${smokeBookingId}/cancel`, customerAuth.accessToken);
      }
    } catch (error) {
      console.warn(`Realtime smoke cleanup failed for ${smokeBookingId}: ${error.message}`);
    }
  }
  providerSocket.disconnect();
  customerSocket.disconnect();
}
