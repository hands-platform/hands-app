import { marketplaceDisplayText } from '../../../lib/admin-copy';
import type { AdminBookingDetail, AdminNotification } from '../../../lib/admin-api';
import { compactActivityText, safeTime } from './booking-formatters';
import {
  humanizeNotificationType,
  notificationDataBookingId,
} from './booking-notification-trace';
import {
  auditMetadataSummary,
  humanizeAuditAction,
} from './booking-operations-trace';
import type { BookingOperatingTimelineItem } from './booking-operating-timeline-items';

export function bookingOperatingActivityTimelineItems({
  booking,
  notifications,
}: {
  readonly booking: AdminBookingDetail;
  readonly notifications: readonly AdminNotification[];
}): BookingOperatingTimelineItem[] {
  const items: BookingOperatingTimelineItem[] = [];

  if (booking.review) {
    items.push({
      id: `review-${booking.review.id}`,
      type: 'REVIEW',
      title: 'Customer service feedback submitted',
      detail: `Saved numeric input ${booking.review.rating}/5.`,
      at: booking.review.createdAt,
      status: 'Feedback',
    });
  }

  const relatedNotifications = notifications
    .filter((notification) => notificationDataBookingId(notification) === booking.id)
    .sort((left, right) => safeTime(right.createdAt) - safeTime(left.createdAt))
    .slice(0, 4);
  for (const notification of relatedNotifications) {
    items.push({
      id: `notification-${notification.id}`,
      type: 'ALERT',
      title: marketplaceDisplayText(notification.title),
      detail: `${humanizeNotificationType(notification.type)} / ${marketplaceDisplayText(
        compactActivityText(notification.body, 90),
      )}`,
      at: notification.createdAt,
      status: 'Alert',
    });
  }

  for (const task of booking.opsTasks ?? []) {
    items.push({
      id: `ops-task-${task.id}`,
      type: 'OPS',
      title: `${humanizeAuditAction(task.type)} / ${task.status}`,
      detail: task.note ?? 'Operator checklist task updated.',
      at: task.updatedAt,
      status: task.status,
    });
  }

  for (const log of (booking.auditLogs ?? []).slice(0, 6)) {
    items.push({
      id: `audit-${log.id}`,
      type: 'AUDIT',
      title: humanizeAuditAction(log.action),
      detail: auditMetadataSummary(log.metadata) || log.target,
      at: log.createdAt,
      status: 'Audit',
    });
  }

  return items;
}
