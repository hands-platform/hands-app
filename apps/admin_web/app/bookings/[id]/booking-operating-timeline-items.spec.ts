import {
  createBookingOperatingTimelineCollector,
  type BookingOperatingTimelineItem,
} from './booking-operating-timeline-items';

function item(input: Partial<BookingOperatingTimelineItem>): BookingOperatingTimelineItem {
  return {
    detail: 'Timeline detail',
    id: 'timeline-item',
    status: 'Recorded',
    title: 'Timeline item',
    type: 'TEST',
    ...input,
  };
}

describe('booking operating timeline item collector', () => {
  it('keeps only the first item for a repeated id', () => {
    const collector = createBookingOperatingTimelineCollector();

    collector.addItem(item({ detail: 'First detail', id: 'same-id' }));
    collector.addItem(item({ detail: 'Second detail', id: 'same-id' }));

    expect(collector.build()).toEqual([expect.objectContaining({ detail: 'First detail' })]);
  });

  it('sorts dated items newest first and appends pending items after dated rows', () => {
    const collector = createBookingOperatingTimelineCollector();

    collector.addItem(item({ id: 'old', at: '2026-06-14T01:00:00.000Z' }));
    collector.addItem(item({ id: 'pending' }));
    collector.addItem(item({ id: 'new', at: '2026-06-14T02:00:00.000Z' }));

    expect(collector.build().map((row) => row.id)).toEqual(['new', 'old', 'pending']);
  });

  it('caps dated items before adding pending items and keeps the final total bounded', () => {
    const collector = createBookingOperatingTimelineCollector();

    for (let index = 0; index < 25; index += 1) {
      collector.addItem(
        item({
          id: `dated-${index}`,
          at: `2026-06-14T${String(index).padStart(2, '0')}:00:00.000Z`,
        }),
      );
    }
    for (let index = 0; index < 10; index += 1) {
      collector.addItem(item({ id: `pending-${index}` }));
    }

    const rows = collector.build();

    expect(rows).toHaveLength(22);
    expect(rows.slice(0, 18).every((row) => row.id.startsWith('dated-'))).toBe(true);
    expect(rows.slice(18).map((row) => row.id)).toEqual([
      'pending-0',
      'pending-1',
      'pending-2',
      'pending-3',
    ]);
  });
});
