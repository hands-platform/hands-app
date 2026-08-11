import { Prisma } from '@prisma/client';
import type { PushDeliveryService } from './push-delivery.service';

const PARTNER_ALERT_TYPES = new Set([
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
]);

const PUSH_DATA_KEYS = new Set([
  'type',
  'notificationType',
  'bookingId',
  'chatRoomId',
  'providerProfileId',
  'destination',
  'appDestination',
  'notificationId',
  'paymentId',
  'earningId',
  'payoutBatchId',
  'fileId',
  'sanctionId',
]);

export type ChatNotificationRoutingData = {
  destination: 'chat';
  bookingId: string;
  chatRoomId: string;
};

export function chatNotificationRoutingData(input: {
  bookingId: string;
  chatRoomId: string;
}): ChatNotificationRoutingData {
  const bookingId = input.bookingId.trim();
  const chatRoomId = input.chatRoomId.trim();
  if (!bookingId || !chatRoomId) {
    throw new Error('Chat notification routing requires bookingId and chatRoomId');
  }

  return {
    destination: 'chat',
    bookingId,
    chatRoomId,
  };
}

export function isPartnerAlert(notificationType: string) {
  return PARTNER_ALERT_TYPES.has(notificationType);
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function notificationDeliveryResponse(
  result: Awaited<ReturnType<PushDeliveryService['send']>>,
  pushToken: string,
) {
  const response = result.failureCode
    ? { ...result.response, failureCode: result.failureCode }
    : result.response;
  return maskPushTokenInJson(response, pushToken);
}

export function maskPushTokenInJson(value: unknown, pushToken: string) {
  if (!pushToken) {
    return value;
  }
  return JSON.parse(JSON.stringify(value).split(pushToken).join('[masked]'));
}

export function toPushData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, entry]) => PUSH_DATA_KEYS.has(key) && isPushDataScalar(entry),
  );
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.map(([key, entry]) => [key, String(entry)]));
}

export function notificationPushData(notification: { id: string; type?: string; data?: unknown }) {
  return {
    ...(toPushData(notification.data) ?? {}),
    ...(notification.type ? { type: notification.type } : {}),
    notificationId: notification.id,
  };
}

function isPushDataScalar(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}
