export type NotificationRetryAuditLatestDelivery = {
  readonly id: string;
  readonly provider: string;
  readonly status: string;
  readonly attemptedAt: string;
  readonly failureCode: string | null;
  readonly pushDeviceId: string | null;
  readonly pushDeviceEnabled: boolean | null;
  readonly pushDeviceLastSeenAt: string | null;
  readonly pushDevicePlatform: string | null;
};

export type NotificationRetryAuditJobSummary = {
  readonly queueName: string;
  readonly jobName: string;
  readonly attempts: number;
  readonly backoffMs: number | null;
  readonly queuedJobId: string | null;
};

export type NotificationRetryAuditResult = {
  readonly latestDelivery: NotificationRetryAuditLatestDelivery | null;
  readonly retryJob: NotificationRetryAuditJobSummary;
  readonly retrySnapshot?: {
    readonly accepted: number;
    readonly eligibleDeviceCount: number;
    readonly eligibleDeviceIds: readonly (string | null)[];
    readonly failed: number;
    readonly failureCodes: readonly string[];
    readonly skipped: number;
    readonly skippedSuccessfulDeviceCount: number;
    readonly targetRole: string | null;
    readonly unattempted: number;
  };
};

export type NotificationRetryAuditRisk =
  | 'DEVICE_DISABLED'
  | 'DUPLICATE_SEND_RISK'
  | 'FAILED_DELIVERY_RETRY'
  | 'NO_DELIVERY_EVIDENCE'
  | 'STALE_PUSH_TOKEN'
  | 'SKIPPED_DELIVERY_RETRY'
  | 'STANDARD_RETRY';

const STALE_PUSH_DEVICE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function notificationRetryAuditMetadata(
  notificationId: string,
  result: NotificationRetryAuditResult,
  operator?: { readonly actorId: string; readonly reason: string },
) {
  const latestDelivery = normalizeNotificationRetryAuditLatestDelivery(result.latestDelivery);
  const retryRisk = notificationRetryAuditRisk(latestDelivery);

  return {
    notificationId,
    ...(operator ? { actorId: operator.actorId, reason: operator.reason } : {}),
    latestDelivery,
    retryJob: result.retryJob,
    ...(result.retrySnapshot
      ? {
          retrySnapshot: {
            ...result.retrySnapshot,
            eligibleDeviceIds: result.retrySnapshot.eligibleDeviceIds.map(maskPushDeviceId),
          },
          enqueueOutcome: 'QUEUED',
        }
      : {}),
    retryAlreadyDelivered: latestDelivery?.status === 'SENT',
    retryRisk,
    operatorAction: notificationRetryAuditOperatorAction(retryRisk),
  };
}

function normalizeNotificationRetryAuditLatestDelivery(
  latestDelivery: NotificationRetryAuditLatestDelivery | null,
): NotificationRetryAuditLatestDelivery | null {
  if (!latestDelivery) {
    return null;
  }

  return {
    id: latestDelivery.id,
    provider: latestDelivery.provider,
    status: latestDelivery.status,
    attemptedAt: latestDelivery.attemptedAt,
    failureCode: latestDelivery.failureCode ?? null,
    pushDeviceId: maskPushDeviceId(latestDelivery.pushDeviceId),
    pushDeviceEnabled: latestDelivery.pushDeviceEnabled ?? null,
    pushDeviceLastSeenAt: latestDelivery.pushDeviceLastSeenAt ?? null,
    pushDevicePlatform: latestDelivery.pushDevicePlatform ?? null,
  };
}

function maskPushDeviceId(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function notificationRetryAuditRisk(
  latestDelivery: NotificationRetryAuditLatestDelivery | null,
): NotificationRetryAuditRisk {
  if (!latestDelivery) {
    return 'NO_DELIVERY_EVIDENCE';
  }
  if (latestDelivery.pushDeviceEnabled === false) {
    return 'DEVICE_DISABLED';
  }
  if (latestDelivery.status === 'FAILED') {
    return 'FAILED_DELIVERY_RETRY';
  }
  if (hasStalePushTokenTimestamp(latestDelivery)) {
    return 'STALE_PUSH_TOKEN';
  }
  if (latestDelivery.status === 'SENT') {
    return 'DUPLICATE_SEND_RISK';
  }
  if (latestDelivery.status === 'SKIPPED') {
    return 'SKIPPED_DELIVERY_RETRY';
  }
  return 'STANDARD_RETRY';
}

function notificationRetryAuditOperatorAction(risk: NotificationRetryAuditRisk) {
  if (risk === 'DUPLICATE_SEND_RISK') {
    return 'Retry only after support confirms the user missed the latest delivered alert.';
  }
  if (risk === 'DEVICE_DISABLED') {
    return 'Refresh or re-enable the push device before relying on retry delivery.';
  }
  if (risk === 'FAILED_DELIVERY_RETRY') {
    return 'Fix the latest delivery failure before retrying.';
  }
  if (risk === 'STALE_PUSH_TOKEN') {
    return 'Refresh the app FCM token before relying on retry delivery.';
  }
  if (risk === 'SKIPPED_DELIVERY_RETRY') {
    return 'Confirm the skipped delivery was expected before retrying.';
  }
  if (risk === 'NO_DELIVERY_EVIDENCE') {
    return 'Confirm notification workers and queue processing before retrying.';
  }
  return 'Review latest delivery evidence before retrying.';
}

function hasStalePushTokenTimestamp(delivery: NotificationRetryAuditLatestDelivery) {
  if (delivery.pushDeviceEnabled === false) {
    return false;
  }

  const attemptedAt = Date.parse(delivery.attemptedAt);
  const lastSeenAt = Date.parse(delivery.pushDeviceLastSeenAt ?? '');
  if (!Number.isFinite(attemptedAt) || !Number.isFinite(lastSeenAt)) {
    return false;
  }
  return attemptedAt - lastSeenAt >= STALE_PUSH_DEVICE_AGE_MS;
}
