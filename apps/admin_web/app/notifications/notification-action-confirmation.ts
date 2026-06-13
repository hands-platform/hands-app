import type { AdminNotification } from '../../lib/admin-api';
import { formatDateTime, shortId } from '../../lib/admin-format';
import { notificationPushDeviceFreshnessLabel } from '../../lib/admin-notification-push-device';
import type { StatusBadgeTone } from '../../components/status-badge';
import { notificationDeliveryFailureCode } from './notification-delivery-response';

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

export type NotificationActionReturnContext = {
  readonly booking?: string;
  readonly review?: string;
};

type NotificationConfirmationValues = NotificationActionReturnContext & {
  readonly notificationId: string;
  readonly pushDeviceId: string;
};

type NotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];

export function retryNotificationConfirmHref(
  notificationId: string,
  context: NotificationActionReturnContext = {},
) {
  return notificationHref([
    ...notificationReturnQueryEntries(context),
    ['confirm', 'retry'],
    ['notificationId', notificationId],
  ]);
}

export function enablePushDeviceConfirmHref(
  pushDeviceId: string,
  context: NotificationActionReturnContext = {},
) {
  return notificationHref([
    ...notificationReturnQueryEntries(context),
    ['confirm', 'enable-device'],
    ['pushDeviceId', pushDeviceId],
  ]);
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
  values: NotificationConfirmationValues,
): NotificationActionConfirmation | null {
  if (!action) {
    return null;
  }

  if (action === 'retry') {
    return buildRetryConfirmation(notifications, values);
  }

  return buildEnableDeviceConfirmation(notifications, values);
}

function buildRetryConfirmation(
  notifications: readonly AdminNotification[],
  values: NotificationConfirmationValues,
): NotificationActionConfirmation | null {
  const { notificationId } = values;
  const notification = notifications.find((item) => item.id === notificationId);
  if (!notification) {
    return null;
  }

  const evidence = notificationRetryEvidence(notification);

  return {
    action: 'retry',
    cancelHref: notificationReturnHref(values),
    confirmLabel: 'Retry notification',
    description: `Retry notification ${shortId(
      notification.id,
    )} after reviewing duplicate-send risk. ${evidence}`,
    hiddenInputs: [{ name: 'notificationId', value: notification.id }],
    id: notification.id,
    title: `Retry notification ${shortId(notification.id)}?`,
    tone: 'warning',
  };
}

function buildEnableDeviceConfirmation(
  notifications: readonly AdminNotification[],
  values: NotificationConfirmationValues,
): NotificationActionConfirmation | null {
  const { pushDeviceId } = values;
  const match = findNotificationPushDevice(notifications, pushDeviceId);
  if (!match) {
    return null;
  }

  return {
    action: 'enable-device',
    cancelHref: notificationReturnHref(values),
    confirmLabel: 'Re-enable device',
    description: `Re-enable ${match.platform} push device ${shortId(
      match.pushDeviceId,
    )} only after a fresh token or operator confirmation exists. Latest evidence: ${deliveryEvidenceSummary(
      match.delivery,
    )}.`,
    hiddenInputs: [{ name: 'pushDeviceId', value: match.pushDeviceId }],
    id: match.pushDeviceId,
    title: `Re-enable device ${shortId(match.pushDeviceId)}?`,
    tone: 'danger',
  };
}

function notificationReturnHref(context: NotificationActionReturnContext) {
  return notificationHref(notificationReturnQueryEntries(context));
}

function notificationReturnQueryEntries(context: NotificationActionReturnContext) {
  return [
    ['review', context.review],
    ['booking', context.booking],
  ] as const;
}

function notificationHref(entries: readonly (readonly [string, string | undefined])[]) {
  const query = entries
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `/notifications?${query}` : '/notifications';
}

function findNotificationPushDevice(notifications: readonly AdminNotification[], pushDeviceId: string) {
  for (const notification of notifications) {
    for (const delivery of notificationDeliveries(notification)) {
      if (delivery.pushDevice?.id === pushDeviceId) {
        return {
          delivery,
          platform: delivery.pushDevice.platform ?? 'unknown',
          pushDeviceId,
        };
      }
    }
  }
  return null;
}

function notificationRetryEvidence(notification: AdminNotification) {
  const latest = latestNotificationDelivery(notification);
  if (!latest) {
    return 'No delivery attempt is captured yet; confirm workers before retrying.';
  }
  return `Latest evidence: ${deliveryEvidenceSummary(latest)}.`;
}

function latestNotificationDelivery(notification: AdminNotification) {
  return newestNotificationDeliveries(notification)[0];
}

function deliveryEvidenceSummary(delivery: NotificationDelivery) {
  const parts = [
    `${delivery.provider} ${delivery.status}`,
    delivery.pushDevice?.platform ? `platform ${delivery.pushDevice.platform}` : 'platform unknown',
    `attempted ${formatDateTime(delivery.attemptedAt)}`,
    delivery.pushDevice?.enabled === false ? 'device disabled' : 'device enabled',
    notificationPushDeviceFreshnessLabel(delivery).toLowerCase(),
  ];
  const failureCode = notificationDeliveryFailureCode(delivery);
  if (failureCode) {
    parts.push(`failure ${failureCode}`);
  }
  return parts.join('; ');
}

function deliveryAttemptMs(delivery: NotificationDelivery) {
  const value = Date.parse(delivery.attemptedAt);
  return Number.isFinite(value) ? value : 0;
}

function newestNotificationDeliveries(notification: AdminNotification) {
  return [...notificationDeliveries(notification)].sort(
    (left, right) => deliveryAttemptMs(right) - deliveryAttemptMs(left),
  );
}

function notificationDeliveries(notification: AdminNotification): readonly NotificationDelivery[] {
  return notification.deliveries ?? [];
}
