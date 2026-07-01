import {
  buildCalendarTagFilters,
  buildCalendarMetrics,
  normalizeStoredCalendarEvent,
  createSeedEvents,
  filterCalendarEvents,
  parseCalendarTags,
  normalizeCalendarDraft,
} from './calendar-model';

describe('calendar-model', () => {
  it('filters events by selected hashtags', () => {
    const events = createSeedEvents(new Date('2026-06-16T09:00:00.000Z'));

    expect(filterCalendarEvents(events, ['finance']).map((event) => event.title)).toEqual(['Weekly finance closeout']);
    expect(filterCalendarEvents(events, []).length).toBe(events.length);
  });

  it('builds hashtag filters with counts across repeated tags', () => {
    const events = createSeedEvents(new Date('2026-06-16T09:00:00.000Z'));
    const filters = buildCalendarTagFilters([
      ...events,
      {
        ...events[0],
        id: 'extra',
        tags: ['handoff', 'ops'],
      },
    ]);

    expect(filters.find((filter) => filter.tag === 'handoff')?.count).toBe(2);
    expect(filters.map((filter) => filter.tag)).toContain('finance');
  });

  it('builds hashtag filters for the visible calendar month', () => {
    const events = [
      {
        ...createSeedEvents(new Date('2026-06-16T09:00:00.000Z'))[0],
        id: 'june-booking',
        start: '2026-06-16T10:00:00.000Z',
        end: '2026-06-16T11:00:00.000Z',
        tags: ['booking'],
      },
      {
        ...createSeedEvents(new Date('2026-07-16T09:00:00.000Z'))[0],
        id: 'july-booking',
        start: '2026-07-16T10:00:00.000Z',
        end: '2026-07-16T11:00:00.000Z',
        tags: ['booking'],
      },
    ];

    const juneFilters = buildCalendarTagFilters(events, new Date('2026-06-01'));
    const julyFilters = buildCalendarTagFilters(events, new Date('2026-07-01'));
    const augustFilters = buildCalendarTagFilters(events, new Date('2026-08-01'));

    expect(juneFilters.find((filter) => filter.tag === 'booking')?.count).toBe(1);
    expect(julyFilters.find((filter) => filter.tag === 'booking')?.count).toBe(1);
    expect(augustFilters.find((filter) => filter.tag === 'booking')).toBeUndefined();
  });

  it('normalizes free-form hashtags for event drafts', () => {
    expect(parseCalendarTags('#Finance #finance booking, 정산')).toEqual(['finance', 'booking', '정산']);
  });

  it('migrates legacy stored category events into tag and author records', () => {
    const event = normalizeStoredCalendarEvent(
      {
        id: 'legacy',
        title: 'Old booking block',
        start: '2026-06-16T10:00:00.000Z',
        end: '2026-06-16T11:00:00.000Z',
        allDay: false,
        category: 'Bookings',
        description: '',
        location: '',
        url: '',
      },
      { id: 'operator@hands.vn', name: 'Operator' },
    );

    expect(event).toMatchObject({
      authorId: 'operator@hands.vn',
      authorName: 'Operator',
      tags: ['bookings'],
    });
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
      authorId: 'operator@hands.vn',
      authorName: 'Operator',
      tags: ['ops'],
      description: '',
      location: '',
      url: '',
    });

    expect(draft.end).toBe(draft.start);
  });
});
