import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  AdminNotification,
} from '../../../lib/admin-api';
import {
  bookingProviderLocationMetricHelper,
  bookingProviderLocationMetricValue,
} from '../../../lib/booking-provider-location-copy';
import { bookingLocationTrail } from '../../../lib/booking-status-location-helpers';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import {
  compactActivityText,
  formatDate,
  safeTime,
} from './booking-formatters';
import {
  bookingNotificationTraceRow,
  humanizeNotificationType,
  notificationDataBookingId,
} from './booking-notification-trace';
import { latestProviderLocationFreshness } from './booking-status-location';

type CommunicationMovementEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at: string;
};

export function bookingCommunicationMovementHandoff({
  booking,
  latestLocation,
  messages,
  notifications,
}: {
  readonly booking: AdminBookingDetail;
  readonly latestLocation?: AdminLocationSnapshot;
  readonly messages: readonly AdminChatMessage[];
  readonly notifications: readonly AdminNotification[];
}) {
  const relatedNotifications = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt));
  const deliveries = relatedNotifications.flatMap((notification) => notification.deliveries ?? []);
  const failedDeliveries = deliveries.filter((delivery) => delivery.status === 'FAILED').length;
  const pendingDeliveries =
    deliveries.filter((delivery) => delivery.status === 'SKIPPED').length +
    relatedNotifications.filter((notification) => (notification.deliveries ?? []).length === 0).length;
  const disabledDevices = deliveries.filter((delivery) => delivery.pushDevice?.enabled === false).length;
  const lastMessage = messages[messages.length - 1];
  const latestAlert = relatedNotifications[0];
  const movementFreshness = latestProviderLocationFreshness(booking);
  const locationRows = bookingLocationTrail(booking.snapshots, latestLocation ?? null);
  const activeNeedsLocation = ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status);
  const chatShouldExist = ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(
    booking.status,
  );
  const note =
    !booking.chatRoom && chatShouldExist
      ? {
          status: 'Chat repair needed',
          tone: 'pill-warn',
          noteClassName: 'ops-task-warning',
          nextAction: 'Repair booking chat handoff',
          nextDetail: 'Matched or active booking has no retained chat room attached.',
          href: '#chat',
          hrefLabel: 'Open chat section',
        }
      : failedDeliveries || disabledDevices
        ? {
            status: 'Alert delivery check',
            tone: 'pill-warn',
            noteClassName: 'ops-task-warning',
            nextAction: 'Review notification delivery',
            nextDetail: 'One or more booking alerts failed or targeted a disabled device.',
            href: '#alerts',
            hrefLabel: 'Open alert records',
          }
        : activeNeedsLocation && !latestLocation
          ? {
              status: 'Location check',
              tone: 'pill-info',
              noteClassName: 'ops-task-info',
              nextAction: 'Ask Partner to share current location',
              nextDetail: 'The booking is active but no Partner location record is linked yet.',
              href: '#location',
              hrefLabel: 'Open location trail',
            }
          : {
              status: 'Handoff visible',
              tone: 'pill-success',
              noteClassName: 'ops-task-success',
              nextAction: 'Continue normal monitoring',
              nextDetail: 'Chat, alert, and movement evidence can be reviewed from this record.',
              href: '#booking-activity',
              hrefLabel: 'Open full activity',
            };

  const locationAgeLabel = bookingProviderLocationMetricHelper(latestLocation?.recordedAt);
  const events: CommunicationMovementEvent[] = [
    ...messages.slice(-5).map((message) => ({
      id: `message-${message.id}`,
      type: 'CHAT',
      title: messageSenderLabel(message),
      detail: compactActivityText(message.body, 120),
      at: message.createdAt,
    })),
    ...relatedNotifications.slice(0, 5).map((notification) => {
      const row = bookingNotificationTraceRow(notification);
      return {
        id: `notification-${notification.id}`,
        type: 'ALERT',
        title: row.signal,
        detail: `${row.title} / ${compactActivityText(row.detail, 110)}`,
        at: notification.createdAt,
      };
    }),
    ...locationRows.slice(-4).map((snapshot) => ({
      id: `location-${snapshot.id}`,
      type: 'LOC',
      title: 'Partner location record',
      detail: `${partnerLocationSnapshotLabel(snapshot)} / ${locationAgeLabel}`,
      at: snapshot.recordedAt,
    })),
  ]
    .filter((event) => Boolean(event.at))
    .sort((left, right) => safeTime(right.at) - safeTime(left.at))
    .slice(0, 10);

  return {
    ...note,
    metrics: [
      {
        label: 'Chat room',
        value: booking.chatRoom ? 'Retained' : 'Missing',
        helper: booking.chatRoom
          ? `${messages.length} message(s) kept in admin archive.`
          : 'Chat should be created once the booking is matched.',
      },
      {
        label: 'Latest message',
        value: lastMessage ? formatDate(lastMessage.createdAt) : 'No message',
        dateTimeValue: lastMessage?.createdAt ?? null,
        helper: lastMessage
          ? `${messageSenderLabel(lastMessage)} / ${compactActivityText(lastMessage.body, 72)}`
          : 'No Customer or Partner message yet.',
      },
      {
        label: 'Booking alerts',
        value: `${relatedNotifications.length}`,
        dateTimeValue: latestAlert?.createdAt ?? null,
        helper: latestAlert
          ? `Latest ${humanizeNotificationType(latestAlert.type)} at ${formatDate(latestAlert.createdAt)}.`
          : 'No booking notification row linked yet.',
      },
      {
        label: 'Delivery checks',
        value: `${failedDeliveries} failed / ${pendingDeliveries} pending`,
        helper: disabledDevices
          ? `${disabledDevices} disabled device(s) also found.`
          : 'No disabled device in linked alerts.',
      },
      {
        label: 'Partner location',
        value: bookingProviderLocationMetricValue(movementFreshness),
        helper:
          movementFreshness === 'missing'
            ? 'No Partner movement record yet.'
            : `${locationAgeLabel} / ${partnerLocationSnapshotLabel(latestLocation)}`,
      },
      {
        label: 'Movement rows',
        value: `${locationRows.length}`,
        helper: locationRows.length
          ? 'Saved Partner location records linked to this booking.'
          : 'No movement row linked yet.',
      },
    ],
    events,
  };
}

function partnerLocationSnapshotLabel(snapshot?: AdminLocationSnapshot | null) {
  const address = readAddressText(snapshot);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}

export function messageSenderLabel(message: AdminChatMessage) {
  if (message.sender?.roles?.includes('PROVIDER')) {
    return `Partner: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  if (message.sender?.roles?.includes('CUSTOMER')) {
    return `Customer: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  if (message.sender?.roles?.includes('ADMIN')) {
    return `Admin: ${message.sender.fullName ?? message.sender.phone ?? 'Unknown'}`;
  }
  return message.sender?.fullName ?? message.sender?.phone ?? 'Unknown sender';
}
