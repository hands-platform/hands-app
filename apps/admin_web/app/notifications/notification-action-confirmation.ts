import type { AdminNotification } from '../../lib/admin-api';
import { formatDateTime, shortId } from '../../lib/admin-format';
import {
  isStaleNotificationPushDeviceDelivery,
  notificationPushDeviceFreshnessLabel,
} from '../../lib/admin-notification-push-device';
import type { StatusBadgeTone } from '../../components/status-badge';
import {
  notificationDeliveryFailureCode,
  notificationDeliveryRecoveryHint,
} from './notification-delivery-response';
import { notificationReviewRunbook } from './notification-review-runbook';

export type NotificationConfirmationAction =
  | 'assign-finance-review'
  | 'enable-device'
  | 'retry'
  | 'review-legacy';

export type NotificationActionConfirmation = {
  readonly action: NotificationConfirmationAction;
  readonly cancelHref: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly hiddenInputs: readonly { readonly name: string; readonly value: string }[];
  readonly id: string;
  readonly selectInputs?: readonly {
    readonly defaultValue?: string;
    readonly label: string;
    readonly name: string;
    readonly options: readonly { readonly label: string; readonly value: string }[];
    readonly required?: boolean;
  }[];
  readonly supportingLinks?: readonly {
    readonly description?: string;
    readonly href: string;
    readonly label: string;
  }[];
  readonly textInputs?: readonly {
    readonly label: string;
    readonly maxLength?: number;
    readonly minLength?: number;
    readonly name: string;
    readonly placeholder?: string;
    readonly required?: boolean;
  }[];
  readonly title: string;
  readonly tone: StatusBadgeTone;
};

export type NotificationActionReturnContext = {
  readonly booking?: string;
  readonly financeAge?: string;
  readonly financeAssigneeAdminId?: string;
  readonly financeAssigneeOptions?: readonly { readonly label: string; readonly value: string }[];
  readonly financeOwner?: string;
  readonly incidentState?: string;
  readonly range?: string;
  readonly review?: string;
  readonly user?: string;
};

type NotificationConfirmationValues = NotificationActionReturnContext & {
  readonly assigneeAdminId?: string;
  readonly notificationId: string;
  readonly pushDeviceId: string;
};

type NotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];
type RetryConfirmationCopy = {
  readonly confirmLabel: string;
  readonly description: string;
  readonly tone: StatusBadgeTone;
};

const FCM_SETUP_REVIEW_KEYS = new Set(['disabled-device', 'failed', 'fcm', 'needs-retry', 'stale-device']);
const BACKGROUND_JOB_EVIDENCE_QUEUES = new Set([
  'bank-statement-escalation',
  'booking-timeouts',
  'notification-retry',
  'payment-status-check',
]);

const FCM_SETUP_SUPPORTING_LINK = {
  description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
  href: '/setup#notifications',
  label: 'FCM setup',
} as const;

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

export function legacyReviewNotificationConfirmHref(
  notificationId: string,
  context: NotificationActionReturnContext = {},
) {
  return notificationHref([
    ...notificationReturnQueryEntries(context),
    ['confirm', 'review-legacy'],
    ['notificationId', notificationId],
  ]);
}

export function assignFinanceReviewConfirmHref(
  notificationId: string,
  assigneeAdminId: string | undefined,
  context: NotificationActionReturnContext = {},
) {
  return notificationHref([
    ...notificationReturnQueryEntries(context),
    ['confirm', 'assign-finance-review'],
    ['notificationId', notificationId],
    ['assigneeAdminId', assigneeAdminId],
  ]);
}

export function notificationBackgroundJobEvidenceHref(notification: AdminNotification) {
  if (!notification.type.startsWith('admin.system.background_job')) return null;
  const data = notificationDataRecord(notification.data);
  const queue = notificationDataString(data.queueName);
  const jobId = notificationDataString(data.jobId);
  if (!queue || !BACKGROUND_JOB_EVIDENCE_QUEUES.has(queue) || !jobId || jobId.length > 300) return null;
  const query = new URLSearchParams({
    jobId,
    queue,
    range: 'ALL',
    review: 'ALL',
  });
  return `/background-jobs?${query.toString()}`;
}

export function readNotificationConfirmationAction(value: string): NotificationConfirmationAction | null {
  if (
    value === 'assign-finance-review' ||
    value === 'enable-device' ||
    value === 'retry' ||
    value === 'review-legacy'
  ) {
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

  if (action === 'assign-finance-review') {
    return buildFinanceReviewAssignmentConfirmation(notifications, values);
  }

  if (action === 'review-legacy') {
    return buildLegacyReviewConfirmation(notifications, values);
  }

  return buildEnableDeviceConfirmation(notifications, values);
}

function buildFinanceReviewAssignmentConfirmation(
  notifications: readonly AdminNotification[],
  values: NotificationConfirmationValues,
): NotificationActionConfirmation | null {
  const notification = notifications.find((item) => item.id === values.notificationId);
  const source = notification ? financeReviewAssignmentSource(notification) : null;
  if (!notification || !source) return null;
  const data = notificationDataRecord(notification.data);
  if (notificationDataString(data.financeReviewStatus) === 'RESOLVED') return null;
  const currentOwner = notificationDataRecord(data.financeReviewOwner);
  const currentOwnerId = notificationDataString(currentOwner.id);
  if (currentOwnerId === values.assigneeAdminId) return null;
  const selectableOwners = (values.financeAssigneeOptions ?? []).filter(
    (option) => option.value && option.value !== currentOwnerId,
  );
  if (!values.assigneeAdminId && selectableOwners.length === 0) return null;
  const returnHref = notificationReturnHref(values);
  const destination = notificationDataString(data.destination);

  return {
    action: 'assign-finance-review',
    cancelHref: returnHref,
    confirmLabel: values.assigneeAdminId
      ? currentOwnerId ? 'Reassign to me' : 'Assign to me'
      : currentOwnerId ? 'Reassign owner' : 'Assign owner',
    description: currentOwnerId
      ? 'Transfer this overdue Finance review to another eligible operator. The original SLA start and prior assignment remain in the audit trail.'
      : 'Assign this overdue Finance review to an eligible operator. The original SLA start remains unchanged.',
    hiddenInputs: [
      ...(values.assigneeAdminId ? [{ name: 'assigneeAdminId', value: values.assigneeAdminId }] : []),
      { name: 'assignmentSourceId', value: source.id },
      { name: 'assignmentSourceKind', value: source.kind },
      { name: 'notificationId', value: notification.id },
      { name: 'returnHref', value: returnHref },
    ],
    id: notification.id,
    selectInputs: values.assigneeAdminId ? undefined : [{
      defaultValue: selectableOwners[0]?.value,
      label: 'Review owner',
      name: 'assigneeAdminId',
      options: selectableOwners,
      required: true,
    }],
    supportingLinks: [
      ...(destination?.startsWith('/finance-tax/bank-reconciliation')
        ? [{
            description: 'Open the source record before taking ownership if additional evidence is needed.',
            href: destination,
            label: 'Finance review',
          }]
        : []),
      {
        description: 'Review retained assignment and escalation evidence.',
        href: financeReviewAuditTrailHref(source.id),
        label: 'Audit trail',
      },
    ],
    textInputs: [{
      label: 'Assignment reason',
      maxLength: 500,
      minLength: 12,
      name: 'reason',
      placeholder: 'Why are you taking ownership of this Finance review?',
      required: true,
    }],
    title: `${currentOwnerId ? 'Reassign' : 'Assign'} Finance review ${shortId(notification.id)}?`,
    tone: 'warning',
  };
}

function buildLegacyReviewConfirmation(
  notifications: readonly AdminNotification[],
  values: NotificationConfirmationValues,
): NotificationActionConfirmation | null {
  const notification = notifications.find((item) => item.id === values.notificationId);
  if (!notification || !isLegacySystemNotificationReviewable(notification)) return null;
  const returnHref = notificationReturnHref(values);
  const jobEvidenceHref = notificationBackgroundJobEvidenceHref(notification);

  return {
    action: 'review-legacy',
    cancelHref: returnHref,
    confirmLabel: 'Mark reviewed',
    description:
      'Record that this unlinked legacy alert was manually reviewed. This does not mark a source incident recovered and does not retry notification delivery.',
    hiddenInputs: [
      { name: 'notificationId', value: notification.id },
      { name: 'returnHref', value: returnHref },
    ],
    id: notification.id,
    supportingLinks: [
      {
        description: 'Review existing notification audit evidence before completing the record.',
        href: notificationAuditTrailHref(notification.id),
        label: 'Audit trail',
      },
      {
        description: jobEvidenceHref
          ? 'Open the exact retained background job recorded by this legacy alert.'
          : 'Check current background-job failures before closing an old unlinked alert.',
        href: jobEvidenceHref ?? '/background-jobs?review=OPEN&range=ALL',
        label: jobEvidenceHref ? 'Job evidence' : 'Background Jobs',
      },
    ],
    textInputs: [
      {
        label: 'Review evidence',
        maxLength: 500,
        minLength: 12,
        name: 'reason',
        placeholder: 'What evidence was checked and why can this legacy alert be closed?',
        required: true,
      },
    ],
    title: `Mark legacy alert ${shortId(notification.id)} reviewed?`,
    tone: 'warning',
  };
}

export function filterNotificationActionConfirmationSupportingLinks(
  confirmation: NotificationActionConfirmation | null,
  canViewDiagnostics: boolean,
): NotificationActionConfirmation | null {
  if (!confirmation || canViewDiagnostics) {
    return confirmation;
  }

  const supportingLinks = confirmation.supportingLinks?.filter(
    (link) => link.href !== FCM_SETUP_SUPPORTING_LINK.href,
  );

  return {
    ...confirmation,
    supportingLinks: supportingLinks?.length ? supportingLinks : undefined,
  };
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
  const latestDelivery = latestNotificationDelivery(notification);
  const reviewGuidance = notificationReviewGuidanceText(values.review);
  const copy = retryConfirmationCopy(notification, latestDelivery, evidence, reviewGuidance);
  const returnHref = notificationReturnHref(values);

  return {
    action: 'retry',
    cancelHref: returnHref,
    confirmLabel: copy.confirmLabel,
    description: copy.description,
    hiddenInputs: [
      { name: 'notificationId', value: notification.id },
      { name: 'returnHref', value: returnHref },
    ],
    id: notification.id,
    supportingLinks: [
      {
        description: 'Open retry, delivery, and device recovery audit events before resending.',
        href: notificationAuditTrailHref(notification.id),
        label: 'Audit trail',
      },
      ...notificationRetryDeviceSupportingLinks(latestDelivery),
      ...notificationReviewSupportingLinks(values.review),
    ],
    title: `Retry notification ${shortId(notification.id)}?`,
    tone: copy.tone,
  };
}

function retryConfirmationCopy(
  notification: AdminNotification,
  latestDelivery: NotificationDelivery | undefined,
  evidence: string,
  reviewGuidance: string,
): RetryConfirmationCopy {
  const id = shortId(notification.id);

  if (!latestDelivery) {
    return {
      confirmLabel: 'Retry notification',
      description: `Retry notification ${id} only after confirming workers and queue processing. ${evidence}${reviewGuidance}`,
      tone: 'warning',
    };
  }

  if (latestDelivery.pushDevice?.enabled === false) {
    return {
      confirmLabel: 'Retry after device recovery',
      description: `Notification ${id} latest delivery used a disabled push device. Refresh or re-enable the device path before retrying. ${evidence}${reviewGuidance}`,
      tone: 'danger',
    };
  }

  if (latestDelivery.status === 'FAILED') {
    return {
      confirmLabel: 'Retry notification',
      description: `Retry notification ${id} after fixing the latest delivery failure. ${evidence}${reviewGuidance}`,
      tone: 'warning',
    };
  }

  if (isStaleNotificationPushDeviceDelivery(latestDelivery)) {
    return {
      confirmLabel: 'Retry after token refresh',
      description: `Notification ${id} latest delivery used an old FCM token timestamp. Ask the user to reopen the app or complete token recovery before retrying. ${evidence}${reviewGuidance}`,
      tone: 'warning',
    };
  }

  if (latestDelivery.status === 'SKIPPED') {
    return {
      confirmLabel: 'Retry notification',
      description: `Retry notification ${id} only after confirming the skipped delivery was expected. ${evidence}${reviewGuidance}`,
      tone: 'info',
    };
  }

  if (latestDelivery.status === 'SENT') {
    return {
      confirmLabel: 'Retry anyway',
      description: `Notification ${id} already has a successful latest delivery. Retry only if support confirmed the user still missed it. ${evidence}${reviewGuidance}`,
      tone: 'info',
    };
  }

  return {
    confirmLabel: 'Retry notification',
    description: `Retry notification ${id} after reviewing duplicate-send risk. ${evidence}${reviewGuidance}`,
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
  const reviewGuidance = notificationReviewGuidanceText(values.review);
  const returnHref = notificationReturnHref(values);

  return {
    action: 'enable-device',
    cancelHref: returnHref,
    confirmLabel: 'Re-enable device',
    description: `Re-enable ${match.platform} push device ${shortId(
      match.pushDeviceId,
    )} only after a fresh token or operator confirmation exists. Latest evidence: ${deliveryEvidenceSummary(
      match.delivery,
    )}.${reviewGuidance}`,
    hiddenInputs: [
      { name: 'pushDeviceId', value: match.pushDeviceId },
      { name: 'returnHref', value: returnHref },
    ],
    id: match.pushDeviceId,
    supportingLinks: [
      {
        description: 'Open device recovery audit events before re-enabling push delivery.',
        href: notificationAuditTrailHref(match.pushDeviceId),
        label: 'Audit trail',
      },
      ...notificationReviewSupportingLinks(values.review),
    ],
    title: `Re-enable device ${shortId(match.pushDeviceId)}?`,
    tone: 'danger',
  };
}

function notificationReturnHref(context: NotificationActionReturnContext) {
  return notificationHref(notificationReturnQueryEntries(context));
}

function notificationReturnQueryEntries(context: NotificationActionReturnContext) {
  return [
    ['range', context.range],
    ['review', context.review],
    ['financeAge', context.financeAge],
    ['financeOwner', context.financeOwner],
    ['incidentState', context.incidentState],
    ['booking', context.booking],
    ['user', context.user],
  ] as const;
}

function financeReviewAssignmentSource(notification: AdminNotification) {
  if (
    notification.type !== 'admin.finance.bank_statement_batch.escalated' &&
    notification.type !== 'admin.finance.bank_transaction.review_escalated'
  ) {
    return null;
  }
  const data = notificationDataRecord(notification.data);
  const bankTransactionId = notificationDataString(data.bankTransactionId);
  if (bankTransactionId) return { id: bankTransactionId, kind: 'bank-transaction' } as const;
  const batchImportId = notificationDataString(data.batchImportId);
  return batchImportId ? { id: batchImportId, kind: 'import-batch' } as const : null;
}

export function isLegacySystemNotificationReviewable(notification: AdminNotification) {
  if (!notification.type.startsWith('admin.system.')) return false;
  const data = notificationDataRecord(notification.data);
  return !notificationDataString(data.incidentId) && !notificationDataString(data.incidentStatus);
}

function notificationDataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function notificationDataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function notificationHref(entries: readonly (readonly [string, string | undefined])[]) {
  const query = entries
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `/notifications?${query}` : '/notifications';
}

function notificationAuditTrailHref(notificationId: string) {
  return `/audit-log?bucket=Notification&q=${encodeURIComponent(notificationId)}&range=all`;
}

function financeReviewAuditTrailHref(sourceId: string) {
  return `/audit-log?q=${encodeURIComponent(sourceId)}&range=all`;
}

function notificationRetryDeviceSupportingLinks(latestDelivery: NotificationDelivery | undefined) {
  const pushDeviceId = latestDelivery?.pushDevice?.id;
  if (!pushDeviceId || !notificationRetryNeedsDeviceEvidence(latestDelivery)) {
    return [];
  }

  return [
    {
      description: 'Open push device recovery and token change audit events before retrying.',
      href: notificationAuditTrailHref(pushDeviceId),
      label: 'Device audit',
    },
  ];
}

function notificationRetryNeedsDeviceEvidence(latestDelivery: NotificationDelivery) {
  return latestDelivery.pushDevice?.enabled === false || isStaleNotificationPushDeviceDelivery(latestDelivery);
}

function notificationReviewGuidanceText(review: string | undefined) {
  const runbook = notificationReviewRunbook(review ?? '');
  return runbook ? ` Runbook: ${runbook.title}. ${runbook.primaryAction}` : '';
}

function notificationReviewSupportingLinks(review: string | undefined) {
  return notificationReviewHasFcmSetupLink(review) ? [FCM_SETUP_SUPPORTING_LINK] : [];
}

function notificationReviewHasFcmSetupLink(review: string | undefined) {
  return Boolean(review && FCM_SETUP_REVIEW_KEYS.has(review));
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
  const recoveryHint = notificationDeliveryRecoveryHint(delivery);
  if (recoveryHint) {
    parts.push(`next ${recoveryHint}`);
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
