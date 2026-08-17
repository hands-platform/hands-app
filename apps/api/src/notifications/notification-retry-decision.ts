import { notificationDeliveryFailureCode } from './notification-delivery-failure';

export const NOTIFICATION_RETRY_COOLDOWN_MS = 60_000;
export const NOTIFICATION_RETRY_FAILURE_LIMIT = 3;

export type NotificationRetryDecision = {
  readonly evidence?: string;
  readonly failureClass: 'transient' | 'route-recovery' | 'payload-config' | 'unknown';
  readonly reason: string;
  readonly retryAfterAt?: string;
  readonly state: 'allowed' | 'conditional' | 'blocked';
};

type RetryDelivery = {
  readonly attemptedAt: Date | string;
  readonly pushDeviceId: string | null;
  readonly response: unknown;
  readonly status: string;
};

type RetryDevice = {
  readonly createdAt: Date | string;
  readonly id: string;
  readonly updatedAt: Date | string;
};

export function notificationRetryDecision(
  devices: readonly RetryDevice[],
  deliveries: readonly RetryDelivery[],
  now = new Date(),
): NotificationRetryDecision {
  const acceptedDeviceIds = new Set(
    deliveries
      .filter((delivery) => ['SENT', 'DELIVERED', 'SUCCESS'].includes(delivery.status) && delivery.pushDeviceId)
      .map((delivery) => delivery.pushDeviceId as string),
  );
  const unresolvedDevices = devices.filter((device) => !acceptedDeviceIds.has(device.id));
  if (unresolvedDevices.length === 0) {
    return blocked('unknown', 'No eligible unresolved push path remains.');
  }

  if (deliveries.length === 0) {
    return {
      evidence: 'No provider delivery attempt exists, so retrying cannot duplicate an accepted push.',
      failureClass: 'transient',
      reason: 'The notification was persisted but no provider delivery attempt was recorded.',
      state: 'allowed',
    };
  }

  const latestByDevice = latestDeliveriesByDevice(deliveries);
  const latestFailure = deliveries
    .filter((delivery) => delivery.status === 'FAILED')
    .sort((left, right) => dateMs(right.attemptedAt) - dateMs(left.attemptedAt))[0];
  if (!latestFailure) {
    return blocked('unknown', 'No classified delivery failure is available for a safe retry.');
  }

  const failureCode = notificationDeliveryFailureCode(latestFailure.response);
  const failureClass = notificationRetryFailureClass(failureCode);
  if (failureClass === 'payload-config') {
    return blocked(
      failureClass,
      'Retry is blocked until authoritative payload, template, target, or provider configuration recovery evidence exists.',
    );
  }
  if (failureClass === 'unknown') {
    return blocked(failureClass, 'Retry is blocked until the delivery failure is classified and recovery is verified.');
  }

  if (failureClass === 'route-recovery') {
    const failedAt = dateMs(latestFailure.attemptedAt);
    const recoveredRoute = unresolvedDevices.some((device) => {
      const deviceChangedAt = Math.max(dateMs(device.createdAt), dateMs(device.updatedAt));
      const latestDeviceDelivery = latestByDevice.get(device.id);
      return deviceChangedAt > failedAt && (!latestDeviceDelivery || dateMs(latestDeviceDelivery.attemptedAt) <= failedAt);
    });
    return recoveredRoute
      ? {
          evidence: 'An enabled target route was created or refreshed after the latest token failure.',
          failureClass,
          reason: 'Route recovery evidence is present and successful paths remain excluded.',
          state: 'allowed',
        }
      : blocked(failureClass, 'A new or refreshed enabled target route is required after the token failure.');
  }

  const latestFailureAt = dateMs(latestFailure.attemptedAt);
  const retryAfterAt = new Date(latestFailureAt + NOTIFICATION_RETRY_COOLDOWN_MS);
  if (now.getTime() < retryAfterAt.getTime()) {
    return {
      failureClass,
      reason: 'Wait for the transient provider cooldown before retrying.',
      retryAfterAt: retryAfterAt.toISOString(),
      state: 'conditional',
    };
  }

  const consecutiveFailureCount = consecutiveFailuresForDevice(
    deliveries,
    latestFailure.pushDeviceId,
  );
  if (consecutiveFailureCount >= NOTIFICATION_RETRY_FAILURE_LIMIT) {
    return blocked(
      failureClass,
      `Retry attempt limit reached for the unresolved path (${NOTIFICATION_RETRY_FAILURE_LIMIT} consecutive failures).`,
    );
  }

  return {
    evidence: 'Transient failure cooldown passed; successful paths remain excluded.',
    failureClass,
    reason: 'The unresolved transient failure is eligible for one controlled retry.',
    state: 'allowed',
  };
}

export function notificationRetryFailureClass(failureCode: string | null) {
  const normalized = failureCode?.trim().toLowerCase() ?? '';
  if (
    normalized === 'messaging/internal-error' ||
    normalized === 'messaging/server-unavailable' ||
    normalized === 'unavailable' ||
    normalized === 'fcm_delivery_unavailable' ||
    normalized === 'resource_exhausted' ||
    normalized === 'internal' ||
    normalized === 'http_429' ||
    /^http_5\d\d$/u.test(normalized) ||
    normalized.includes('timeout')
  ) {
    return 'transient' as const;
  }
  if (
    normalized === 'messaging/registration-token-not-registered' ||
    normalized === 'messaging/invalid-registration-token' ||
    normalized === 'unregistered'
  ) {
    return 'route-recovery' as const;
  }
  if (
    normalized === 'invalid_argument' ||
    normalized === 'messaging/invalid-argument' ||
    normalized === 'messaging/mismatched-credential' ||
    normalized === 'push_provider_not_configured' ||
    normalized.includes('credential')
  ) {
    return 'payload-config' as const;
  }
  return 'unknown' as const;
}

function latestDeliveriesByDevice(deliveries: readonly RetryDelivery[]) {
  const latest = new Map<string, RetryDelivery>();
  for (const delivery of [...deliveries].sort(
    (left, right) => dateMs(right.attemptedAt) - dateMs(left.attemptedAt),
  )) {
    if (delivery.pushDeviceId && !latest.has(delivery.pushDeviceId)) {
      latest.set(delivery.pushDeviceId, delivery);
    }
  }
  return latest;
}

function consecutiveFailuresForDevice(
  deliveries: readonly RetryDelivery[],
  pushDeviceId: string | null,
) {
  let count = 0;
  for (const delivery of [...deliveries]
    .filter((item) => item.pushDeviceId === pushDeviceId)
    .sort((left, right) => dateMs(right.attemptedAt) - dateMs(left.attemptedAt))) {
    if (delivery.status !== 'FAILED') break;
    count += 1;
  }
  return count;
}

function blocked(
  failureClass: NotificationRetryDecision['failureClass'],
  reason: string,
): NotificationRetryDecision {
  return { failureClass, reason, state: 'blocked' };
}

function dateMs(value: Date | string) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
