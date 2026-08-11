import type { AdminNotification } from '../../lib/admin-api';
import { shortId } from '../../lib/admin-format';
import {
  isStaleNotificationPushDeviceDelivery,
} from '../../lib/admin-notification-push-device';
import { notificationDeliveryDisposition } from '../../lib/admin-notification-delivery';
import type { StatusBadgeTone } from '../../components/status-badge';
import {
  notificationDeliveryFailureCode,
} from './notification-delivery-response';
import { notificationReviewRunbook } from './notification-review-runbook';
import { readNotificationRetryDecision } from './notification-retry-decision';

export type NotificationConfirmationAction =
  | 'assign-finance-review'
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
  readonly age?: string;
  readonly booking?: string;
  readonly canRetry?: boolean;
  readonly channel?: string;
  readonly dataScope?: string;
  readonly financeAge?: string;
  readonly financeAssigneeAdminId?: string;
  readonly financeAssigneeOptions?: readonly { readonly label: string; readonly value: string }[];
  readonly financeOwner?: string;
  readonly failureCode?: string;
  readonly failureProvider?: string;
  readonly incidentState?: string;
  readonly issue?: string;
  readonly mode?: string;
  readonly page?: string;
  readonly q?: string;
  readonly range?: string;
  readonly recipientRole?: string;
  readonly review?: string;
  readonly sla?: string;
  readonly sort?: string;
  readonly scope?: string;
  readonly status?: string;
  readonly type?: string;
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

const FCM_SETUP_REVIEW_KEYS = new Set([
  'delivery-gap',
  'disabled-device',
  'failed',
  'fcm',
  'needs-retry',
  'no-push-path',
  'stale-device',
]);
const BACKGROUND_JOB_EVIDENCE_QUEUES = new Set([
  'bank-statement-escalation',
  'booking-timeouts',
  'notification-retry',
  'payment-status-check',
]);

const FCM_SETUP_SUPPORTING_LINK = {
  description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
  href: '/setup?commands=all#notifications',
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
    if (!values.canRetry) return null;
    return buildRetryConfirmation(notifications, values);
  }

  if (action === 'assign-finance-review') {
    return buildFinanceReviewAssignmentConfirmation(notifications, values);
  }

  if (action === 'review-legacy') {
    return buildLegacyReviewConfirmation(notifications, values);
  }

  return null;
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

  const disposition = notificationDeliveryDisposition(notification);
  if (disposition === 'delivered') {
    return null;
  }

  const decision = readNotificationRetryDecision(notification);
  if (decision.state !== 'allowed') return null;
  const evidence = notificationRetryEvidence(notification);
  if (evidence.eligibleCount === 0) return null;
  const latestDelivery = latestNotificationDelivery(notification);
  const reviewGuidance = notificationReviewGuidanceText(values.review);
  const copy = retryConfirmationCopy(
    notification,
    latestDelivery,
    `${decision.reason}${decision.evidence ? ` ${decision.evidence}` : ''} ${evidence.description}`,
    reviewGuidance,
    disposition,
  );
  const returnHref = notificationReturnHref(values);

  return {
    action: 'retry',
    cancelHref: returnHref,
    confirmLabel: 'Retry unresolved paths',
    description: copy.description,
    hiddenInputs: [
      { name: 'notificationId', value: notification.id },
      { name: 'returnHref', value: returnHref },
    ],
    id: notification.id,
    supportingLinks: [
      ...notificationSourceSupportingLinks(notification),
      {
        description: 'Open retry, delivery, and device recovery audit events before resending.',
        href: notificationAuditTrailHref(notification.id),
        label: 'Audit trail',
      },
      ...notificationReviewSupportingLinks(values.review),
    ],
    textInputs: [{
      label: 'Retry reason',
      maxLength: 500,
      minLength: 12,
      name: 'reason',
      placeholder: 'Why are the unresolved delivery paths safe to retry?',
      required: true,
    }],
    title: `Retry unresolved paths for ${shortId(notification.id)}?`,
    tone: copy.tone,
  };
}

function retryConfirmationCopy(
  notification: AdminNotification,
  latestDelivery: NotificationDelivery | undefined,
  evidence: string,
  reviewGuidance: string,
  disposition: ReturnType<typeof notificationDeliveryDisposition>,
): RetryConfirmationCopy {
  const id = shortId(notification.id);

  if (disposition === 'partial') {
    return {
      confirmLabel: 'Retry failed devices',
      description: `Notification ${id} has both successful and failed device paths. Retry keeps successful devices excluded and only attempts unresolved device paths. ${evidence}${reviewGuidance}`,
      tone: 'warning',
    };
  }

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

  return {
    confirmLabel: 'Retry notification',
    description: `Retry notification ${id} after reviewing duplicate-send risk. ${evidence}${reviewGuidance}`,
    tone: 'warning',
  };
}

function notificationReturnHref(context: NotificationActionReturnContext) {
  return notificationHref(notificationReturnQueryEntries(context));
}

function notificationReturnQueryEntries(context: NotificationActionReturnContext) {
  return [
    ['mode', context.mode],
    ['issue', context.issue],
    ['status', context.status],
    ['recipientRole', context.recipientRole],
    ['channel', context.channel],
    ['dataScope', context.dataScope],
    ['q', context.q],
    ['type', context.type],
    ['range', context.range],
    ['review', context.review],
    ['age', context.age],
    ['sla', context.sla],
    ['sort', context.sort],
    ['page', context.page],
    ['financeAge', context.financeAge],
    ['financeOwner', context.financeOwner],
    ['incidentState', context.incidentState],
    ['failureProvider', context.failureProvider],
    ['failureCode', context.failureCode],
    ['scope', context.scope],
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

export function notificationRetryEvidence(notification: AdminNotification) {
  const latestByPath = latestNotificationDeliveryPaths(notification);
  const acceptedDeviceIds = new Set(
    newestNotificationDeliveries(notification)
      .filter((delivery) => delivery.status === 'SENT')
      .flatMap((delivery) => {
        const deviceId = delivery.pushDevice?.id ?? delivery.pushDeviceId;
        return deviceId ? [deviceId] : [];
      }),
  );
  const eligibleDevices = (notification.user?.pushDevices ?? [])
    .filter(
      (device) =>
        device.enabled === true && notificationDeviceMatchesTargetRole(notification, device.role),
    )
    .filter((device) => typeof device.id === 'string' && !acceptedDeviceIds.has(device.id));
  const failed = latestByPath.filter((delivery) => delivery.status === 'FAILED').length;
  const accepted = latestByPath.filter((delivery) => delivery.status === 'SENT').length;
  const unresolved = latestByPath.filter((delivery) => delivery.status !== 'SENT');
  const paths = unresolved.length > 0
    ? unresolved.slice(0, 4).map((delivery) => {
        const failureCode = notificationDeliveryFailureCode(delivery);
        return `${delivery.provider} ${maskedDeviceId(delivery.pushDevice?.id ?? delivery.pushDeviceId)} ${delivery.status}${failureCode ? ` (${failureCode})` : ''}`;
      }).join('; ')
    : eligibleDevices.slice(0, 4).map((device) => `${device.platform ?? 'device'} ${maskedDeviceId(device.id)} not attempted`).join('; ');
  const excluded = acceptedDeviceIds.size;
  return {
    description: `${notification.title} for ${notificationRecipientLabel(notification)} (${notificationTargetRoleLabel(notification)}). ${failed} failed · ${accepted} accepted · ${eligibleDevices.length} eligible for retry. Unresolved paths: ${paths || 'none loaded'}. ${excluded} successful path${excluded === 1 ? '' : 's'} excluded.`,
    eligibleCount: eligibleDevices.length,
  };
}

function latestNotificationDeliveryPaths(notification: AdminNotification) {
  const latest = new Map<string, NotificationDelivery>();
  for (const delivery of newestNotificationDeliveries(notification)) {
    const key = delivery.pushDevice?.id ?? delivery.pushDeviceId ?? `${delivery.provider}:without-device`;
    if (!latest.has(key)) latest.set(key, delivery);
  }
  return [...latest.values()];
}

function notificationSourceSupportingLinks(notification: AdminNotification) {
  const data = notificationDataRecord(notification.data);
  const bookingId = notificationDataString(data.bookingId);
  const recipientHref = notification.user?.providerProfile?.id
    ? `/partners/${notification.user.providerProfile.id}`
    : notification.user?.customerProfile?.id
      ? `/customers/${notification.user.customerProfile.id}`
      : null;
  return [
    ...(bookingId ? [{ href: `/bookings/${bookingId}`, label: 'Booking', description: 'Review the source booking before retrying.' }] : []),
    ...(recipientHref ? [{ href: recipientHref, label: 'Recipient', description: 'Open the recipient record and current contact context.' }] : []),
  ];
}

function notificationRecipientLabel(notification: AdminNotification) {
  return notification.user?.providerProfile?.displayName ?? notification.user?.fullName ?? `user ${shortId(notification.user?.id)}`;
}

function notificationTargetRoleLabel(notification: AdminNotification) {
  const targetRole = notificationDataString(notificationDataRecord(notification.data).targetRole)?.toUpperCase();
  if (targetRole === 'PROVIDER') return 'Partner';
  if (targetRole === 'CUSTOMER') return 'Customer';
  if ((notification.user?.roles ?? []).some((role) => role.toUpperCase() === 'PROVIDER')) return 'Partner';
  if ((notification.user?.roles ?? []).some((role) => role.toUpperCase() === 'ADMIN')) return 'Admin';
  return 'Customer';
}

function notificationDeviceMatchesTargetRole(notification: AdminNotification, deviceRole?: string | null) {
  const target = notificationTargetRoleLabel(notification);
  if (!deviceRole) return target !== 'Admin';
  return deviceRole.toUpperCase() === (target === 'Partner' ? 'PROVIDER' : target.toUpperCase());
}

function maskedDeviceId(value?: string | null) {
  return value ? `••••${value.slice(-4)}` : 'device unknown';
}

function latestNotificationDelivery(notification: AdminNotification) {
  return newestNotificationDeliveries(notification)[0];
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
