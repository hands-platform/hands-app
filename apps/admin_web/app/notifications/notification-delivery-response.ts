import type { AdminNotification } from '../../lib/admin-api';

export type NotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];

export function notificationDeliveryFailureCode(delivery: NotificationDelivery) {
  const body = asRecord(delivery.response?.body);
  const error = asRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = asRecord(details[0]);
  return (
    readString(delivery.response?.failureCode) ??
    readString(firstDetail?.errorCode) ??
    readString(body?.code) ??
    readString(error?.code)
  );
}

export function notificationDeliveryFailureReason(delivery: NotificationDelivery) {
  const body = asRecord(delivery.response?.body);
  const error = asRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = asRecord(details[0]);
  const errors = Array.isArray(body?.errors) ? body.errors.map(String).join(', ') : undefined;
  return (
    readString(delivery.response?.reason) ??
    readString(delivery.response?.message) ??
    readString(body?.reason) ??
    readString(body?.message) ??
    readString(error?.message) ??
    readString(firstDetail?.errorMessage) ??
    readString(firstDetail?.errorCode) ??
    errors
  );
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
