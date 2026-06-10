import type { AdminNotification } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import type { StatusBadgeTone } from '../../components/status-badge';

export type NotificationConfirmationAction = 'enable-device' | 'retry';

export type NotificationActionConfirmation = {
  readonly action: NotificationConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly id: string;
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export function retryNotificationConfirmHref(notificationId: string) {
  return `/notifications?confirm=retry&notificationId=${encodeURIComponent(notificationId)}`;
}

export function enablePushDeviceConfirmHref(pushDeviceId: string) {
  return `/notifications?confirm=enable-device&pushDeviceId=${encodeURIComponent(pushDeviceId)}`;
}

export function readNotificationConfirmationAction(value: string): NotificationConfirmationAction | null {
  if (value === 'enable-device' || value === 'retry') {
    return value;
  }
  return null;
}

export function buildNotificationActionConfirmation(
  notifications: readonly AdminNotification[],
  action: NotificationConfirmationAction | null,
  values: { readonly notificationId: string; readonly pushDeviceId: string },
): NotificationActionConfirmation | null {
  if (!action) {
    return null;
  }

  if (action === 'retry') {
    return buildRetryConfirmation(notifications, values.notificationId);
  }

  return buildEnableDeviceConfirmation(notifications, values.pushDeviceId);
}

function buildRetryConfirmation(
  notifications: readonly AdminNotification[],
  notificationId: string,
): NotificationActionConfirmation | null {
  const notification = notifications.find((item) => item.id === notificationId);
  if (!notification) {
    return null;
  }

  return {
    action: 'retry',
    cancelHref: '/notifications',
    confirmLabel: 'Retry notification',
    description: `Retry notification ${shortId(
      notification.id,
    )} after reviewing delivery failures, token health, and duplicate-send risk.`,
    hiddenInputs: [{ name: 'notificationId', value: notification.id }],
    id: notification.id,
    title: `Retry notification ${shortId(notification.id)}?`,
    tone: 'warning',
  };
}

function buildEnableDeviceConfirmation(
  notifications: readonly AdminNotification[],
  pushDeviceId: string,
): NotificationActionConfirmation | null {
  const match = findNotificationPushDevice(notifications, pushDeviceId);
  if (!match) {
    return null;
  }

  return {
    action: 'enable-device',
    cancelHref: '/notifications',
    confirmLabel: 'Re-enable device',
    description: `Re-enable ${match.platform} push device ${shortId(
      match.pushDeviceId,
    )} only after a fresh token or operator confirmation exists.`,
    hiddenInputs: [{ name: 'pushDeviceId', value: match.pushDeviceId }],
    id: match.pushDeviceId,
    title: `Re-enable device ${shortId(match.pushDeviceId)}?`,
    tone: 'danger',
  };
}

function findNotificationPushDevice(notifications: readonly AdminNotification[], pushDeviceId: string) {
  for (const notification of notifications) {
    for (const delivery of notification.deliveries ?? []) {
      if (delivery.pushDevice?.id === pushDeviceId) {
        return {
          platform: delivery.pushDevice.platform ?? 'unknown',
          pushDeviceId,
        };
      }
    }
  }
  return null;
}
