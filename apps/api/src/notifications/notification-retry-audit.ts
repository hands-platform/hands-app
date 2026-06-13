export type NotificationRetryAuditLatestDelivery = {
  readonly id: string;
  readonly provider: string;
  readonly status: string;
  readonly attemptedAt: string;
  readonly failureCode: string | null;
  readonly pushDeviceId: string | null;
  readonly pushDeviceEnabled: boolean | null;
  readonly pushDevicePlatform: string | null;
};

type NotificationRetryAuditJobSummary = {
  readonly queueName: string;
  readonly jobName: string;
  readonly attempts: number;
  readonly backoffMs: number | null;
  readonly queuedJobId: string | null;
};

type NotificationRetryAuditResult = {
  readonly latestDelivery: NotificationRetryAuditLatestDelivery | null;
  readonly retryJob: NotificationRetryAuditJobSummary;
};

export type NotificationRetryAuditRisk =
  | 'DEVICE_DISABLED'
  | 'DUPLICATE_SEND_RISK'
  | 'FAILED_DELIVERY_RETRY'
  | 'NO_DELIVERY_EVIDENCE'
  | 'SKIPPED_DELIVERY_RETRY'
  | 'STANDARD_RETRY';

export function notificationRetryAuditMetadata(notificationId: string, result: NotificationRetryAuditResult) {
  const retryRisk = notificationRetryAuditRisk(result.latestDelivery);

  return {
    notificationId,
    latestDelivery: result.latestDelivery,
    retryJob: result.retryJob,
    retryAlreadyDelivered: result.latestDelivery?.status === 'SENT',
    retryRisk,
    operatorAction: notificationRetryAuditOperatorAction(retryRisk),
  };
}

function notificationRetryAuditRisk(
  latestDelivery: NotificationRetryAuditLatestDelivery | null,
): NotificationRetryAuditRisk {
  if (!latestDelivery) {
    return 'NO_DELIVERY_EVIDENCE';
  }
  if (latestDelivery.status === 'SENT') {
    return 'DUPLICATE_SEND_RISK';
  }
  if (latestDelivery.pushDeviceEnabled === false) {
    return 'DEVICE_DISABLED';
  }
  if (latestDelivery.status === 'FAILED') {
    return 'FAILED_DELIVERY_RETRY';
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
  if (risk === 'SKIPPED_DELIVERY_RETRY') {
    return 'Confirm the skipped delivery was expected before retrying.';
  }
  if (risk === 'NO_DELIVERY_EVIDENCE') {
    return 'Confirm notification workers and queue processing before retrying.';
  }
  return 'Review latest delivery evidence before retrying.';
}
