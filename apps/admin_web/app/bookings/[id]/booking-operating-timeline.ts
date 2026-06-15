import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  AdminNotification,
} from '../../../lib/admin-api';
import { bookingOperatingActivityTimelineItems } from './booking-operating-activity-timeline-items';
import { bookingOperatingBaseTimelineItems } from './booking-operating-base-timeline-items';
import { bookingOperatingFinanceTimelineItems } from './booking-operating-finance-timeline-items';
import { createBookingOperatingTimelineCollector } from './booking-operating-timeline-items';

export function bookingOperatingTimeline({
  booking,
  addressLine,
  addressPin,
  latestLocation,
  messages,
  notifications,
}: {
  readonly booking: AdminBookingDetail;
  readonly addressLine: string;
  readonly addressPin: string;
  readonly latestLocation?: AdminLocationSnapshot;
  readonly messages: readonly AdminChatMessage[];
  readonly notifications: readonly AdminNotification[];
}) {
  const timelineItems = createBookingOperatingTimelineCollector();
  const addItem = timelineItems.addItem;

  for (const item of bookingOperatingBaseTimelineItems({
    booking,
    addressLine,
    addressPin,
    latestLocation,
    messages,
  })) {
    addItem(item);
  }

  for (const item of bookingOperatingFinanceTimelineItems(booking)) {
    addItem(item);
  }

  for (const item of bookingOperatingActivityTimelineItems({ booking, notifications })) {
    addItem(item);
  }

  return timelineItems.build();
}
