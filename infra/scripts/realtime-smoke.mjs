import { io } from 'socket.io-client';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const socketBaseUrl = process.env.SOCKET_BASE_URL ?? apiBaseUrl.replace(/\/api$/, '');

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
const providerAuth = await postJson('/auth/verify-otp', null, {
  phone: '+84900000002',
  otp: '123456',
  role: 'PROVIDER',
});
const adminAuth = await postJson('/auth/verify-otp', null, {
  phone: '+84900000099',
  otp: '123456',
  role: 'ADMIN',
});

await postJson(`/admin/providers/${providerAuth.user.providerProfile.id}/approve`, adminAuth.accessToken);
await postJson(`/admin/partners/${providerAuth.user.providerProfile.id}/unblock`, adminAuth.accessToken);
const onlineProvider = await postJson('/provider/online', providerAuth.accessToken);
if (onlineProvider.status === 'OFFLINE') {
  throw new Error(`Provider failed to go online before realtime smoke: ${JSON.stringify(onlineProvider)}`);
}
await postJson('/provider/location', providerAuth.accessToken, { lat: 10.7769, lng: 106.7009 });

const providerSocket = await connectSocket(providerAuth.accessToken);
const customerSocket = await connectSocket(customerAuth.accessToken);

try {
  const services = await getJson('/services');
  const service = services[0];

  const uniqueAddressLine = `Realtime smoke ${Date.now()}`;
  const bookingOpened = waitForEvent(
    providerSocket,
    'booking.opened',
    (payload) => payload?.input?.booking?.address?.line1 === uniqueAddressLine,
  );
  const booking = await postJson('/customer/bookings', customerAuth.accessToken, {
    serviceId: service.id,
    scheduledStartAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    address: { line1: uniqueAddressLine },
    lat: 10.7769,
    lng: 106.7009,
    paymentMethod: 'CASH',
  });

  const openedPayload = await bookingOpened;
  if (openedPayload.id !== booking.id) {
    throw new Error(`Provider received booking.opened for ${openedPayload.id}, expected ${booking.id}`);
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
  const matchedPayload = await bookingMatched;
  const chatRoomId = matchedPayload.booking.chatRoom.id;

  const serviceStarted = waitForEvent(
    customerSocket,
    'service.started',
    (payload) => payload?.id === booking.id || payload?.bookingId === booking.id,
  );
  await postJson(`/provider/bookings/${booking.id}/start`, providerAuth.accessToken);
  const serviceStartedPayload = await serviceStarted;

  const providerLocationUpdated = waitForEvent(
    customerSocket,
    'provider.location.updated',
    (payload) => payload.bookingId === booking.id && payload.providerProfileId === providerAuth.user.providerProfile.id,
  );
  providerSocket.emit('provider.location.update', {
    bookingId: booking.id,
    lat: 10.7777,
    lng: 106.7011,
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

  console.log({
    ok: true,
    bookingId: booking.id,
    chatRoomId,
    chatMessageId: chatPayload.id,
    openedEvent: openedPayload.status,
    joinedEvent: 'provider.joined',
    matchedEvent: matchedPayload.status,
    serviceStartedEvent: serviceStartedPayload.status,
    locationEvent: {
      lat: locationPayload.lat,
      lng: locationPayload.lng,
      recordedAt: locationPayload.recordedAt,
    },
    chatEvent: 'chat.message.created',
    providerRoomBroadcast: true,
  });
} finally {
  providerSocket.disconnect();
  customerSocket.disconnect();
}
