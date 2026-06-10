import type { AdminNotification, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import type { ActionMenuItem } from '../../components/action-menu';
import { AdminPageTemplate } from '../../components/admin-page-template';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { formatDateTime, formatRelativeTime, shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import { enablePushDevice, retryNotification } from './actions';
import { NotificationCommandHeaderSection } from './notification-command-header-section';
import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { NotificationDeliveryOpsQueueSection } from './notification-delivery-ops-queue-section';
import {
  NotificationFilterBoardSection,
  type NotificationFilterLink,
} from './notification-filter-board-section';
import {
  buildNotificationChannelSummary,
  buildNotificationDeliveryOpsQueue,
  buildNotificationSummary,
  emptyNotificationMessage,
  filterNotifications,
  notificationFilterDescription,
} from './notification-page-model';
import {
  buildNotificationActionConfirmation,
  enablePushDeviceConfirmHref,
  readNotificationConfirmationAction,
  retryNotificationConfirmHref,
} from './notification-action-confirmation';
import {
  NotificationsTableSection,
  type NotificationDeliveryRow,
  type NotificationTableRow,
} from './notifications-table-section';

type NotificationsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: NotificationsPageSearchParams;
}) {
  const params = (await searchParams) ?? {};
  const filters = buildNotificationFilters(params);
  const [rawNotifications, operationalPolicies] = await Promise.all([
    adminGet<AdminNotification[]>('/admin/notifications', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const allNotifications = sortNotifications(rawNotifications);
  const notifications = filterNotifications(allNotifications, filters);
  const summary = buildNotificationSummary(allNotifications);
  const channelSummary = buildNotificationChannelSummary(allNotifications, operationalPolicies);
  const opsQueue = buildNotificationDeliveryOpsQueue(allNotifications);
  const notificationRows = buildNotificationTableRows(notifications);
  const activeFilter = notificationFilterLinks.find((item) => item.review === filters.review);
  const activeBookingId = filters.booking;
  const confirmation = buildNotificationActionConfirmation(
    allNotifications,
    readNotificationConfirmationAction(readSearchParam(params.confirm)),
    {
      notificationId: readSearchParam(params.notificationId),
      pushDeviceId: readSearchParam(params.pushDeviceId),
    },
  );

  return (
    <AdminPageTemplate
      description="Delivery board for push retries, disabled devices, and last-mile alert confidence."
      metrics={[
        { label: 'Total', value: allNotifications.length, helper: 'Notification rows loaded.' },
        { label: 'Needs retry', value: summary.needsRetry, helper: 'Failed or disabled delivery paths.' },
        { label: 'Sent', value: summary.sent, helper: 'Successful push delivery attempts.' },
        { label: 'Skipped', value: summary.skipped, helper: 'Intentionally skipped delivery attempts.' },
        { label: 'Failed', value: summary.failed, helper: 'Provider failures needing review.' },
        { label: 'Disabled devices', value: summary.disabledDevices, helper: 'Push devices disabled.' },
        { label: 'Payout setup', value: summary.payoutSetup, helper: 'Partner payout setup alerts.' },
        { label: 'Partner alerts', value: channelSummary.partnerAlertCount, helper: 'Partner-facing alerts.' },
        { label: 'No-show alerts', value: summary.noShow, helper: 'No-show support review alerts.' },
        { label: 'OneSignal route', value: channelSummary.oneSignalDeliveries, helper: 'OS push attempts.' },
      ]}
      title="Notifications"
    >
      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action === 'retry' ? retryNotification : enablePushDevice}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`notification-action-${confirmation.action}-${confirmation.id}`}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : null}

      <div className="card">
        <NotificationCommandHeaderSection />

        <NotificationChannelPolicySection
          inAppDeliveries={channelSummary.inAppDeliveries}
          oneSignalDeliveries={channelSummary.oneSignalDeliveries}
          partnerAlertCount={channelSummary.partnerAlertCount}
          policyLabel={channelSummary.policyLabel}
        />

        <NotificationDeliveryOpsQueueSection items={opsQueue} />

        <NotificationFilterBoardSection
          activeBookingLabel={activeBookingId ? shortId(activeBookingId) : null}
          activeFilterDescription={
            activeFilter?.review ? notificationFilterDescription(activeFilter.review) : null
          }
          activeFilterLabel={activeFilter?.review ? activeFilter.label : null}
          activeReview={filters.review}
          filteredCount={notifications.length}
          links={notificationFilterLinks}
          totalCount={allNotifications.length}
        />

        <NotificationsTableSection
          emptyMessage={emptyNotificationMessage(filters.review, filters.booking, shortId)}
          rows={notificationRows}
        />
      </div>
    </AdminPageTemplate>
  );
}

function buildNotificationTableRows(notifications: readonly AdminNotification[]): NotificationTableRow[] {
  return notifications.map((notification) => {
    const partnerProfile = notification.user?.providerProfile;
    const partnerLabel = partnerProfile
      ? `Partner ${
          partnerProfile.displayName
            ? marketplaceDisplayText(partnerProfile.displayName)
            : shortId(partnerProfile.id)
        }`
      : null;

    return {
      actionLabel: `Notification actions for ${shortId(notification.id)}`,
      actions: notificationActionMenuItems(notification),
      body: marketplaceDisplayText(notification.body),
      bookingDataHint: notificationDataHint(notification),
      createdAtLabel: formatDateTime(notification.createdAt),
      deliveryRows: buildNotificationDeliveryRows(notification),
      id: notification.id,
      opsHint: opsHint(notification),
      opsSignal: opsSignal(notification),
      partnerHref: partnerProfile ? `/partners/${partnerProfile.id}` : null,
      partnerLabel,
      partnerStatus: partnerProfile?.status ?? null,
      relativeCreatedAtLabel: formatRelativeTime(notification.createdAt, { justNow: 'Updated just now' }),
      signalClassName: signalClass(notification),
      title: marketplaceDisplayText(notification.title),
      typeLabel: marketplaceDisplayText(humanizeType(notification.type)),
      typeMeaning: typeMeaning(notification.type),
      userLabel: notificationUserLabel(notification),
      userPhone: notification.user?.phone ?? 'No phone on file',
    };
  });
}

function buildNotificationDeliveryRows(notification: AdminNotification): NotificationDeliveryRow[] {
  return (notification.deliveries ?? []).map((delivery) => ({
    attemptedAtLabel: formatDateTime(delivery.attemptedAt),
    deviceStateLabel: delivery.pushDevice?.enabled === false ? 'Device disabled' : 'Device enabled',
    enableDeviceHref:
      delivery.pushDevice?.enabled === false && delivery.pushDevice.id
        ? enablePushDeviceConfirmHref(delivery.pushDevice.id)
        : null,
    failureCodeLabel: readFailureCode(delivery) ?? '-',
    failureReasonLabel: readFailureReason(delivery) ?? '-',
    httpStatusLabel: String(delivery.response?.statusCode ?? '-'),
    id: delivery.id ?? `${notification.id}-${delivery.attemptedAt}`,
    platformLabel: delivery.pushDevice?.platform ?? 'device',
    provider: delivery.provider,
    status: delivery.status,
  }));
}

function sortNotifications(notifications: AdminNotification[]) {
  return [...notifications].sort((left, right) => {
    const signalDiff = notificationPriority(right) - notificationPriority(left);
    if (signalDiff !== 0) {
      return signalDiff;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function notificationPriority(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 4;
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 3;
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED')) {
    return 2;
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 1;
  }
  return 0;
}

const notificationFilterLinks: NotificationFilterLink[] = [
  { label: 'All notifications', href: '/notifications', review: '' },
  { label: 'Failed sends', href: '/notifications?review=failed', review: 'failed' },
  {
    label: 'Disabled devices',
    href: '/notifications?review=disabled-device',
    review: 'disabled-device',
  },
  { label: 'Needs retry', href: '/notifications?review=needs-retry', review: 'needs-retry' },
  { label: 'Skipped', href: '/notifications?review=skipped', review: 'skipped' },
  { label: 'Sent', href: '/notifications?review=sent', review: 'sent' },
  { label: 'Pending', href: '/notifications?review=pending', review: 'pending' },
  {
    label: 'Payout setup',
    href: '/notifications?review=payout-setup',
    review: 'payout-setup',
  },
  {
    label: 'Partner alerts',
    href: '/notifications?review=partner-alerts',
    review: 'partner-alerts',
  },
  { label: 'No-show', href: '/notifications?review=no-show', review: 'no-show' },
  { label: 'OneSignal', href: '/notifications?review=onesignal', review: 'onesignal' },
  { label: 'In-app route', href: '/notifications?review=in-app-route', review: 'in-app-route' },
];

function buildNotificationFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readParam(params.review),
    booking: readParam(params.booking),
  };
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function notificationActionMenuItems(notification: AdminNotification): readonly ActionMenuItem[] {
  const bookingId = notificationBookingId(notification);
  const partnerId = notification.user?.providerProfile?.id ?? '';
  const actions: ActionMenuItem[] = [];

  if (bookingId) {
    actions.push({
      href: `/bookings/${bookingId}`,
      kind: 'link',
      label: 'Open booking',
      tone: 'neutral',
    });
  }

  if (partnerId) {
    actions.push({
      href: `/partners/${partnerId}`,
      kind: 'link',
      label: 'Open Partner',
      tone: 'neutral',
    });
  }

  actions.push({
    description: needsRetry(notification)
      ? 'Review the delivery issue before retrying this notification.'
      : 'Retry only if operations needs to resend this alert.',
    href: retryNotificationConfirmHref(notification.id),
    kind: 'link',
    label: 'Retry',
    tone: needsRetry(notification) ? 'warning' : 'info',
  });

  return actions;
}

function readFailureCode(delivery: NonNullable<AdminNotification['deliveries']>[number]) {
  const body = asRecord(delivery.response?.body);
  const error = asRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = asRecord(details[0]);
  return readString(firstDetail?.errorCode) ?? readString(body?.code) ?? readString(error?.code);
}

function readFailureReason(delivery: NonNullable<AdminNotification['deliveries']>[number]) {
  const body = asRecord(delivery.response?.body);
  const error = asRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = asRecord(details[0]);
  const errors = Array.isArray(body?.errors) ? body.errors.map(String).join(', ') : undefined;
  return (
    readString(body?.reason) ??
    readString(body?.message) ??
    readString(error?.message) ??
    readString(firstDetail?.errorMessage) ??
    readString(firstDetail?.errorCode) ??
    errors
  );
}

function humanizeType(type: string) {
  return type
    .toLowerCase()
    .split(/[_\-.]/g)
    .map((part) => (part === 'backup' ? 'Marketplace' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function notificationUserLabel(notification: AdminNotification) {
  const label = notification.user?.fullName ?? notification.user?.phone ?? '-';
  return notification.user?.providerProfile ? marketplaceDisplayText(label) : label;
}

function typeMeaning(type: string) {
  if (type.includes('no_show')) {
    return 'No-show support review alert';
  }
  if (type.includes('booking')) {
    return 'Booking lifecycle alert';
  }
  if (type.includes('payment')) {
    return 'Payment or refund alert';
  }
  if (type.includes('payout') || type.includes('tax')) {
    return 'Partner tax or payout setup alert';
  }
  if (type.includes('chat')) {
    return 'Realtime conversation alert';
  }
  return 'Operational customer or partner alert';
}

function notificationDataHint(notification: AdminNotification) {
  const data = asRecord(notification.data);
  if (isPartnerAlert(notification.type) || data?.bookingId) {
    const parts = [];
    if (data?.bookingId) {
      parts.push(`booking ${shortId(String(data.bookingId))}`);
    }
    if (data?.providerProfileId) {
      parts.push(`partner ${shortId(String(data.providerProfileId))}`);
    }
    if (data?.distanceMeters !== undefined && data?.distanceMeters !== null) {
      parts.push(`distance ${formatMeters(data.distanceMeters)}`);
    }
    if (data?.backupProviderRadiusMeters !== undefined && data?.backupProviderRadiusMeters !== null) {
      parts.push(`marketplace radius ${formatMeters(data.backupProviderRadiusMeters)}`);
    }
    if (data?.backupOpenMode) {
      parts.push(`marketplace mode ${String(data.backupOpenMode)}`);
    }
    if (parts.length > 0) {
      return parts.join(' / ');
    }
  }

  if (notification.type !== 'provider.payout_setup_required') {
    return null;
  }
  const missing = asRecord(data?.missing);
  if (!missing) {
    return 'Missing payout setup details were not included.';
  }
  const parts = [];
  if (missing.taxProfileApproved === true) {
    parts.push('tax profile approval');
  }
  if (missing.residentialAddress === true) {
    parts.push('residential address');
  }
  if (Array.isArray(missing.agreements) && missing.agreements.length > 0) {
    parts.push(`agreements: ${missing.agreements.map(String).join(', ')}`);
  }
  return parts.length ? `Missing: ${parts.join(' / ')}` : 'Payout setup appears complete.';
}

function notificationBookingId(notification: AdminNotification) {
  const data = asRecord(notification.data);
  return readString(data?.bookingId) ?? '';
}

function formatMeters(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(amount).toLocaleString()} m`;
}

function needsRetry(notification: AdminNotification) {
  return (notification.deliveries ?? []).some(
    (delivery) => delivery.status === 'FAILED' || delivery.pushDevice?.enabled === false,
  );
}

function signalClass(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 'signal signal-warn';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 'signal signal-warn';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 'signal signal-ok';
  }
  return 'signal signal-info';
}

function opsSignal(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 'Retry needed';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 'Device disabled';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED')) {
    return 'Skipped delivery';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 'Delivered';
  }
  return 'Pending';
}

function opsHint(notification: AdminNotification) {
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED')) {
    return 'Review failure code, confirm token health, then retry only after the device path makes sense.';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false)) {
    return 'This user has at least one disabled push device. Re-enable only if a fresh token arrives.';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED')) {
    return 'Skipped alerts usually mean no available push path or a delivery decision to avoid duplicate sends.';
  }
  if ((notification.deliveries ?? []).some((delivery) => delivery.status === 'SENT')) {
    return 'Delivery path is healthy. Use this row as a reference if the user still reports a miss.';
  }
  return 'Notification exists, but no delivery attempt was captured yet.';
}

function isPartnerAlert(type: string) {
  return [
    'booking.requested',
    'booking.backup_available',
    'booking.matched',
    'provider.payout_setup_required',
  ].includes(type);
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

