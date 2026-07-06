import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { type AdminBookingDetail, type AdminNotification } from '../../../lib/admin-api';
import { formatDistanceMeters, readPlainRecord } from '../../../lib/admin-format';
import {
  isStaleNotificationPushDeviceDelivery,
  notificationPushDeviceFreshnessLabel,
} from '../../../lib/admin-notification-push-device';
import { formatDate, shortId } from './booking-formatters';
import { readOptionalNumber, readOptionalString } from './booking-readers';

export function bookingNotificationTrace(booking: AdminBookingDetail, notifications: AdminNotification[]) {
  const backupBatches = bookingBackupNotificationTraceBatches(booking);
  const rows = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((notification) => bookingNotificationTraceRow(notification));
  const deliveries = rows.flatMap((row) => row.deliveryStatuses);
  const partnerAlerts = rows.filter((row) => row.isPartnerAlert).length;
  const noShowAlerts = rows.filter((row) => row.type === 'booking.no_show').length;
  const failed = deliveries.filter((status) => status === 'FAILED').length;
  const skippedOrPending =
    deliveries.filter((status) => status === 'SKIPPED').length +
    rows.filter((row) => row.deliveryStatuses.length === 0).length;
  const disabledDevices = rows.reduce((total, row) => total + row.disabledDeviceCount, 0);
  const staleDevices = rows.reduce((total, row) => total + row.staleDeviceCount, 0);

  return {
    rows,
    backupBatches,
    metrics: [
      {
        label: 'Related alerts',
        value: `${rows.length}`,
        helper: 'Notification rows carrying this booking id.',
      },
      {
        label: 'No-show alerts',
        value: `${noShowAlerts}`,
        helper: noShowAlerts
          ? 'Customer or Partner was notified about the no-show review.'
          : 'No no-show communication row for this booking.',
      },
      {
        label: 'Partner alerts',
        value: `${partnerAlerts}`,
        helper: 'First-pick, marketplace, and matched Partner notices.',
      },
      {
        label: 'Failed sends',
        value: `${failed}`,
        helper: failed ? 'Open the notification board before retry.' : 'No captured send failures.',
      },
      {
        label: 'Skipped / pending',
        value: `${skippedOrPending}`,
        helper: 'In-app-only routing, no device path, or no attempt yet.',
      },
      {
        label: 'Disabled devices',
        value: `${disabledDevices}`,
        helper: disabledDevices ? 'Fresh device token is needed before re-enable.' : 'No disabled devices.',
      },
      {
        label: 'Stale devices',
        value: `${staleDevices}`,
        helper: staleDevices ? 'App should refresh FCM token before retry.' : 'No old token timestamps.',
      },
      {
        label: 'Marketplace alert batches',
        value: `${backupBatches.length}`,
        helper: backupBatches.length
          ? 'Stored invite batches on the booking record.'
          : 'No marketplace invite batch recorded.',
      },
      {
        label: 'Last marketplace invite',
        value: backupBatches[0]?.notifiedCountLabel ?? '0',
        helper: backupBatches[0]?.detail ?? 'No Partner was invited from a marketplace batch yet.',
      },
    ],
  };
}

function bookingBackupNotificationTraceBatches(booking: AdminBookingDetail) {
  const metadata = readPlainRecord(booking.metadata);
  const rawBatches = Array.isArray(metadata?.backupNotificationTraces)
    ? metadata.backupNotificationTraces
    : [];

  return rawBatches
    .map((value, index) => {
      const batch = readPlainRecord(value);
      if (!batch) {
        return null;
      }
      const providers = Array.isArray(batch.providers) ? batch.providers : [];
      const createdAt = readOptionalString(batch.createdAt);
      const stage = readOptionalString(batch.stage) ?? 'backup_invite';
      const notifiedCount = readOptionalNumber(batch.notifiedCount) ?? providers.length;
      const websocketTargetCount = readOptionalNumber(batch.websocketTargetCount);
      const marketplaceFields = readMarketplaceTraceFields(batch);
      const providerSummary = providers
        .map((providerValue) => {
          const provider = readPlainRecord(providerValue);
          if (!provider) {
            return null;
          }
          const providerProfileId = readOptionalString(provider.providerProfileId);
          const notificationId = readOptionalString(provider.notificationId);
          const distance = readOptionalNumber(provider.distanceMeters);
          return [
            providerProfileId ? `Partner ${shortId(providerProfileId)}` : null,
            distance !== null ? formatDistanceMeters(distance) : null,
            notificationId ? `alert ${shortId(notificationId)}` : null,
          ]
            .filter(Boolean)
            .join(' / ');
        })
        .filter(Boolean)
        .slice(0, 8)
        .join(' | ');

      return {
        id: `${createdAt ?? 'batch'}-${stage}-${index}`,
        createdAtLabel: createdAt ? formatDate(createdAt) : 'Not set',
        createdAtTime: createdAt ? Date.parse(createdAt) : 0,
        createdAtValue: createdAt,
        signal: notifiedCount > 0 ? 'Marketplace invited' : 'No marketplace sent',
        title: `${humanizeNotificationType(stage)} / ${notifiedCount} Partner(s)`,
        notifiedCountLabel: `${notifiedCount}`,
        detail:
          notifiedCount > 0
            ? `${notifiedCount} Partner(s) were sent marketplace availability alerts.`
            : 'The marketplace batch ran, but no eligible Partner was available under the saved policy.',
        meta: [
          websocketTargetCount !== null ? `websocket targets ${websocketTargetCount}` : null,
          marketplaceFields.radius !== null ? `radius ${formatDistanceMeters(marketplaceFields.radius)}` : null,
          marketplaceFields.invitationLimit !== null ? `invite cap ${marketplaceFields.invitationLimit}` : null,
          marketplaceFields.openMode ? `mode ${marketplaceFields.openMode}` : null,
        ]
          .filter(Boolean)
          .join(' / '),
        providers: providerSummary ? `Invited: ${providerSummary}` : '',
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => right.createdAtTime - left.createdAtTime)
    .map((batch) => ({
      id: batch.id,
      createdAtLabel: batch.createdAtLabel,
      createdAtValue: batch.createdAtValue,
      signal: batch.signal,
      title: batch.title,
      notifiedCountLabel: batch.notifiedCountLabel,
      detail: batch.detail,
      meta: batch.meta,
      providers: batch.providers,
    }));
}

export function bookingNotificationTraceRow(notification: AdminNotification) {
  const data = readPlainRecord(notification.data);
  const deliveries = notification.deliveries ?? [];
  const failed = deliveries.some((delivery) => delivery.status === 'FAILED');
  const disabled = deliveries.some((delivery) => delivery.pushDevice?.enabled === false);
  const skipped = deliveries.some((delivery) => delivery.status === 'SKIPPED');
  const sent = deliveries.some((delivery) => delivery.status === 'SENT');
  const partner = notification.user?.providerProfile;
  const target =
    partner?.displayName ??
    notification.user?.fullName ??
    notification.user?.phone ??
    (partner?.id ? `Partner ${shortId(partner.id)}` : 'Unknown target');
  const providerProfileId = readOptionalString(data?.providerProfileId);
  const marketplaceFields = readMarketplaceTraceFields(data);
  const distance = readOptionalNumber(data?.distanceMeters);
  const deliveryStatuses = deliveries.map((delivery) => delivery.status);

  return {
    id: notification.id,
    type: notification.type,
    isPartnerAlert: isPartnerNotificationType(notification.type),
    deliveryStatuses,
    disabledDeviceCount: deliveries.filter((delivery) => delivery.pushDevice?.enabled === false).length,
    staleDeviceCount: deliveries.filter(isStaleNotificationPushDeviceDelivery).length,
    createdAtLabel: formatDate(notification.createdAt),
    createdAtValue: notification.createdAt,
    signal: failed
      ? 'Retry needed'
      : disabled
        ? 'Device disabled'
        : skipped
          ? 'Skipped'
          : sent
            ? 'Delivered'
            : 'Pending',
    signalClass: failed || disabled ? 'signal-warn' : sent ? 'signal-ok' : 'signal-info',
    title: `${marketplaceDisplayText(notification.title)} / ${marketplaceDisplayText(target)}`,
    detail: marketplaceDisplayText(notification.body),
    meta: [
      humanizeNotificationType(notification.type),
      providerProfileId ? `Partner ${shortId(providerProfileId)}` : null,
      distance !== null ? `distance ${formatDistanceMeters(distance)}` : null,
      marketplaceFields.radius !== null
        ? `marketplace radius ${formatDistanceMeters(marketplaceFields.radius)}`
        : null,
      marketplaceFields.invitationLimit !== null ? `invite cap ${marketplaceFields.invitationLimit}` : null,
      marketplaceFields.openMode ? `marketplace mode ${marketplaceFields.openMode}` : null,
      data?.noShowPolicy ? `no-show policy ${String(data.noShowPolicy)}` : null,
      data?.reason ? `reason ${String(data.reason)}` : null,
    ]
      .filter(Boolean)
      .join(' / '),
    delivery:
      deliveries.length > 0
        ? deliveries
            .map(
              (delivery) =>
                `${delivery.provider} ${delivery.status} (${delivery.pushDevice?.platform ?? 'device'}, ${formatDate(
                  delivery.attemptedAt,
                )}, ${notificationPushDeviceFreshnessLabel(delivery)})`,
            )
            .join(' / ')
        : 'No delivery attempt captured.',
  };
}

function readMarketplaceTraceFields(data: ReturnType<typeof readPlainRecord> | undefined) {
  return {
    radius:
      readOptionalNumber(data?.marketplaceRadiusMeters) ??
      readOptionalNumber(data?.marketplacePartnerRadiusMeters) ??
      readOptionalNumber(data?.backupProviderRadiusMeters),
    invitationLimit:
      readOptionalNumber(data?.marketplaceInvitationLimit) ??
      readOptionalNumber(data?.marketplacePartnerInvitationLimit) ??
      readOptionalNumber(data?.backupProviderInvitationLimit),
    openMode: readOptionalString(data?.marketplaceOpenMode) ?? readOptionalString(data?.backupOpenMode),
  };
}

export function notificationDataBookingId(notification: AdminNotification) {
  const data = readPlainRecord(notification.data);
  return readOptionalString(data?.bookingId);
}

function isPartnerNotificationType(type: string) {
  return [
    'booking.requested',
    'booking.backup_available',
    'booking.matched',
    'provider.payout_setup_required',
  ].includes(type);
}

export function humanizeNotificationType(type: string) {
  return marketplaceDisplayText(
    type
      .toLowerCase()
      .split(/[_\-.]/g)
      .map((part) => (part === 'backup' ? 'Marketplace' : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(' '),
  );
}
