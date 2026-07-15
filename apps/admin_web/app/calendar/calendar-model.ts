import type { EventInput } from '@fullcalendar/core';

import { formatDateTime as formatAdminDateTime } from '../../lib/admin-format';

export const CALENDAR_TAG_TONES = ['accent', 'info', 'success', 'warning', 'danger'] as const;

export type CalendarTagTone = (typeof CALENDAR_TAG_TONES)[number];

export type CalendarOperator = {
  readonly id: string;
  readonly name: string;
};

export type CalendarEventRange = {
  readonly from: string;
  readonly to: string;
};

export type CalendarEventRecord = {
  readonly allDay: boolean;
  readonly authorId: string;
  readonly authorName: string;
  readonly description: string;
  readonly end: string;
  readonly id: string;
  readonly location: string;
  readonly start: string;
  readonly tags: readonly string[];
  readonly title: string;
  readonly url: string;
};

export type CalendarEventDraft = Omit<CalendarEventRecord, 'id'>;

export function calendarMonthGridRange(date: Date): CalendarEventRange {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);

  return {
    from: gridStart.toISOString(),
    to: gridEnd.toISOString(),
  };
}

export function toCalendarEventInput(event: CalendarEventRecord): EventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    url: event.url || undefined,
    extendedProps: {
      authorId: event.authorId,
      authorName: event.authorName,
      description: event.description,
      location: event.location,
      tags: event.tags,
    },
  };
}

export function fromCalendarEventInput(event: EventInput, fallbackAuthor: CalendarOperator): CalendarEventRecord {
  const extendedProps = (event.extendedProps ?? {}) as {
    readonly authorId?: string;
    readonly authorName?: string;
    readonly category?: string;
    readonly description?: string;
    readonly location?: string;
    readonly tags?: readonly string[] | string;
  };

  return {
    id: String(event.id ?? ''),
    title: String(event.title ?? ''),
    start: toIsoString(event.start),
    end: toIsoString(event.end ?? event.start),
    allDay: Boolean(event.allDay),
    authorId: extendedProps.authorId || fallbackAuthor.id,
    authorName: extendedProps.authorName || fallbackAuthor.name,
    description: extendedProps.description ?? '',
    location: extendedProps.location ?? '',
    tags: normalizeCalendarTags(extendedProps.tags, extendedProps.category),
    url: typeof event.url === 'string' ? event.url : '',
  };
}

export function filterCalendarEvents(
  events: readonly CalendarEventRecord[],
  selectedTags: readonly string[],
): CalendarEventRecord[] {
  if (!selectedTags.length) {
    return [...events];
  }

  const selected = new Set(selectedTags.map(normalizeTag).filter(Boolean));

  return events.filter((event) => event.tags.some((tag) => selected.has(normalizeTag(tag))));
}

export function buildCalendarTagFilters(events: readonly CalendarEventRecord[], visibleMonth?: Date) {
  const counts = new Map<string, number>();
  const countableEvents = visibleMonth
    ? events.filter((event) => eventOverlapsMonth(event, visibleMonth))
    : events;

  for (const event of countableEvents) {
    for (const tag of event.tags) {
      const normalized = normalizeTag(tag);
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, tone: calendarTagTone(tag) }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}

function eventOverlapsMonth(event: CalendarEventRecord, visibleMonth: Date) {
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const nextMonthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end || event.start);

  return eventStart < nextMonthStart && eventEnd >= monthStart;
}

export function parseCalendarTags(value: string) {
  return uniqueTags(
    value
      .split(/[\s,]+/)
      .map((tag) => normalizeTag(tag))
      .filter(Boolean),
  );
}

export function calendarTagsToInputValue(tags: readonly string[]) {
  return tags.map((tag) => `#${tag}`).join(' ');
}

export function calendarTagTone(tag: string): CalendarTagTone {
  const normalized = normalizeTag(tag);
  if (!normalized) return 'accent';

  const index = [...normalized].reduce((sum, character) => sum + character.charCodeAt(0), 0);

  return CALENDAR_TAG_TONES[index % CALENDAR_TAG_TONES.length];
}

export function canEditCalendarEvent(event: CalendarEventRecord | null | undefined, operator: CalendarOperator) {
  return Boolean(event && event.authorId === operator.id);
}

export function normalizeStoredCalendarEvent(value: unknown, fallbackAuthor: CalendarOperator): CalendarEventRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Partial<CalendarEventRecord> & { readonly category?: string };
  const title = typeof event.title === 'string' ? event.title : '';
  const start = toIsoString(event.start);
  const end = toIsoString(event.end ?? event.start);

  if (!event.id || !title) {
    return null;
  }

  return {
    id: String(event.id),
    title,
    start,
    end,
    allDay: Boolean(event.allDay),
    authorId: typeof event.authorId === 'string' && event.authorId ? event.authorId : fallbackAuthor.id,
    authorName: typeof event.authorName === 'string' && event.authorName ? event.authorName : fallbackAuthor.name,
    description: typeof event.description === 'string' ? event.description : '',
    location: typeof event.location === 'string' ? event.location : '',
    tags: normalizeCalendarTags(event.tags, event.category),
    url: typeof event.url === 'string' ? event.url : '',
  };
}

export function buildCalendarMetrics(events: readonly CalendarEventRecord[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const currentOrFutureEvents = events.filter((event) => new Date(event.end || event.start) >= now);

  const upcoming = events.filter((event) => {
    const start = new Date(event.start);

    return start >= startOfToday && start <= endOfWeek;
  });

  const today = events.filter((event) => isSameDay(new Date(event.start), now));
  const nextEvent = [...events]
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())
    .find((event) => new Date(event.start) >= now);

  return {
    total: currentOrFutureEvents.length,
    today: today.length,
    upcoming: upcoming.length,
    nextLabel: nextEvent ? `${nextEvent.title} · ${formatDateTime(nextEvent.start)}` : 'No upcoming event',
  };
}

export function createSeedEvents(now = new Date(), author: CalendarOperator = SYSTEM_CALENDAR_OPERATOR): CalendarEventRecord[] {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);

  return [
    createSeedEvent(
      'ops-handoff',
      'Morning shift handoff',
      addHours(base, 0),
      addHours(base, 1),
      {
        description: 'Review unresolved operator tasks and prepare the live queue.',
        tags: ['ops', 'handoff'],
        location: 'Admin operations room',
      },
      author,
    ),
    createSeedEvent('booking-watch', 'Peak booking watch', addHours(base, 3), addHours(base, 5), {
      description: 'Monitor supply response for midday reservations and customer-choice windows.',
      tags: ['booking', 'live'],
      location: 'District cluster board',
    }, author),
    createSeedEvent(
      'partner-kyc',
      'Partner KYC review block',
      addDays(addHours(base, 28), 0),
      addDays(addHours(base, 30), 0),
      {
        description: 'Process queued identity reviews and marketplace readiness holds.',
        tags: ['partner', 'kyc'],
        location: 'Compliance queue',
      },
      author,
    ),
    createSeedEvent(
      'customer-health',
      'Customer support follow-up',
      addDays(addHours(base, 52), 0),
      addDays(addHours(base, 53), 0),
      {
        description: 'Audit recent complaints, reviews on hold, and wallet-support cases.',
        tags: ['customer', 'support'],
        location: 'Support desk',
      },
      author,
    ),
    createSeedEvent(
      'finance-close',
      'Weekly finance closeout',
      addDays(addHours(base, 76), 0),
      addDays(addHours(base, 78), 0),
      {
        description: 'Reconcile manual adjustments, refunds, and partner cash debt.',
        tags: ['finance', 'closeout'],
        location: 'Finance workspace',
      },
      author,
    ),
  ];
}

export function normalizeCalendarDraft(draft: CalendarEventDraft): CalendarEventDraft {
  const start = new Date(draft.start);
  const end = new Date(draft.end);

  if (end < start) {
    return { ...draft, end: draft.start };
  }

  return draft;
}

export function createBlankDraft(date = new Date()): CalendarEventDraft {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    title: '',
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    authorId: SYSTEM_CALENDAR_OPERATOR.id,
    authorName: SYSTEM_CALENDAR_OPERATOR.name,
    description: '',
    location: '',
    tags: [],
    url: '',
  };
}

export function formatDateTime(value: string) {
  return formatAdminDateTime(value);
}

function createSeedEvent(
  id: string,
  title: string,
  start: Date,
  end: Date,
  options: { readonly description: string; readonly location: string; readonly tags: readonly string[] },
  author: CalendarOperator,
): CalendarEventRecord {
  return {
    id,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    authorId: author.id,
    authorName: author.name,
    description: options.description,
    location: options.location,
    tags: uniqueTags(options.tags.map(normalizeTag).filter(Boolean)),
    url: '',
  };
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
}

function addHours(date: Date, hours: number) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);

  return result;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function normalizeCalendarTags(tags: readonly string[] | string | undefined, legacyCategory?: string) {
  if (Array.isArray(tags)) {
    return uniqueTags(tags.map(normalizeTag).filter(Boolean));
  }

  if (typeof tags === 'string') {
    return parseCalendarTags(tags);
  }

  return legacyCategory ? parseCalendarTags(legacyCategory) : [];
}

function normalizeTag(tag: string) {
  return tag
    .trim()
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .toLowerCase();
}

function uniqueTags(tags: readonly string[]) {
  return [...new Set(tags)];
}

const SYSTEM_CALENDAR_OPERATOR: CalendarOperator = {
  id: 'hands-system',
  name: 'HANDS System',
};

function toIsoString(value: Date | number | readonly number[] | string | undefined | null) {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (Array.isArray(value)) {
    const [year, month = 0, day = 1, hours = 0, minutes = 0, seconds = 0] = value;

    return new Date(year, month, day, hours, minutes, seconds).toISOString();
  }

  return new Date(value as string).toISOString();
}
