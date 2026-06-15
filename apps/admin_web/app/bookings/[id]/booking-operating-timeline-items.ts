import { safeTime } from './booking-formatters';

export type BookingOperatingTimelineItem = {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly detail: string;
  readonly at?: string | null;
  readonly status: string;
};

export function createBookingOperatingTimelineCollector() {
  const datedItems: BookingOperatingTimelineItem[] = [];
  const pendingItems: BookingOperatingTimelineItem[] = [];
  const seenItemIds = new Set<string>();

  return {
    addItem(item: BookingOperatingTimelineItem) {
      if (seenItemIds.has(item.id)) {
        return;
      }
      seenItemIds.add(item.id);
      if (item.at) {
        datedItems.push(item);
        return;
      }
      pendingItems.push(item);
    },
    build() {
      const sorted = datedItems.sort((left, right) => safeTime(right.at) - safeTime(left.at));
      return [...sorted.slice(0, 18), ...pendingItems].slice(0, 22);
    },
  };
}
