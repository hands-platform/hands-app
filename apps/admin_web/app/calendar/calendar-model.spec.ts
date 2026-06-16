import {
  buildCalendarMetrics,
  createSeedEvents,
  filterCalendarEvents,
  normalizeCalendarDraft,
} from './calendar-model';

describe('calendar-model', () => {
  it('filters events by selected categories', () => {
    const events = createSeedEvents(new Date('2026-06-16T09:00:00.000Z'));

    expect(filterCalendarEvents(events, ['Operations', 'Finance']).map((event) => event.category)).toEqual([
      'Operations',
      'Finance',
    ]);
  });

  it('builds summary metrics from the visible events', () => {
    const events = createSeedEvents(new Date('2026-06-16T09:00:00.000Z'));
    const metrics = buildCalendarMetrics(events, new Date('2026-06-16T09:15:00.000Z'));

    expect(metrics.total).toBe(events.length);
    expect(metrics.today).toBeGreaterThan(0);
    expect(metrics.upcoming).toBeGreaterThan(0);
    expect(metrics.nextLabel).not.toBe('No upcoming event');
  });

  it('keeps event end date aligned after invalid edits', () => {
    const draft = normalizeCalendarDraft({
      title: 'Broken range',
      start: '2026-06-16T10:00:00.000Z',
      end: '2026-06-16T08:00:00.000Z',
      allDay: false,
      category: 'Operations',
      description: '',
      location: '',
      url: '',
    });

    expect(draft.end).toBe(draft.start);
  });
});
