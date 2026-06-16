import type { EventInput } from '@fullcalendar/core';

export const CALENDAR_STORAGE_KEY = 'hands-admin-calendar-events-v1';

export const CALENDAR_CATEGORIES = ['Operations', 'Bookings', 'Partners', 'Customers', 'Finance'] as const;

export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export type CalendarEventRecord = {
  readonly allDay: boolean;
  readonly category: CalendarCategory;
  readonly description: string;
  readonly end: string;
  readonly id: string;
  readonly location: string;
  readonly start: string;
  readonly title: string;
  readonly url: string;
};

export type CalendarEventDraft = Omit<CalendarEventRecord, 'id'>;

export const CALENDAR_CATEGORY_COLORS: Record<CalendarCategory, string> = {
  Operations: 'accent',
  Bookings: 'info',
  Partners: 'success',
  Customers: 'warning',
  Finance: 'danger',
};

export function toCalendarEventInput(event: CalendarEventRecord): EventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    url: event.url || undefined,
    extendedProps: {
      category: event.category,
      description: event.description,
      location: event.location,
    },
  };
}

export function fromCalendarEventInput(event: EventInput): CalendarEventRecord {
  const extendedProps = (event.extendedProps ?? {}) as {
    readonly category?: CalendarCategory;
    readonly description?: string;
    readonly location?: string;
  };

  return {
    id: String(event.id ?? ''),
    title: String(event.title ?? ''),
    start: toIsoString(event.start),
    end: toIsoString(event.end ?? event.start),
    allDay: Boolean(event.allDay),
    category: isCalendarCategory(extendedProps.category) ? extendedProps.category : 'Operations',
    description: extendedProps.description ?? '',
    location: extendedProps.location ?? '',
    url: typeof event.url === 'string' ? event.url : '',
  };
}

export function filterCalendarEvents(
  events: readonly CalendarEventRecord[],
  categories: readonly CalendarCategory[],
): CalendarEventRecord[] {
  if (!categories.length) {
    return [];
  }

  const selected = new Set(categories);

  return events.filter((event) => selected.has(event.category));
}

export function buildCalendarMetrics(events: readonly CalendarEventRecord[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const upcoming = events.filter((event) => {
    const start = new Date(event.start);

    return start >= startOfToday && start <= endOfWeek;
  });

  const today = events.filter((event) => isSameDay(new Date(event.start), now));
  const nextEvent = [...events]
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())
    .find((event) => new Date(event.start) >= now);

  return {
    total: events.length,
    today: today.length,
    upcoming: upcoming.length,
    nextLabel: nextEvent ? `${nextEvent.title} · ${formatDateTime(nextEvent.start)}` : 'No upcoming event',
  };
}

export function createSeedEvents(now = new Date()): CalendarEventRecord[] {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);

  return [
    createSeedEvent(
      'ops-handoff',
      'Morning shift handoff',
      addHours(base, 0),
      addHours(base, 1),
      'Operations',
      {
        description: 'Review unresolved operator tasks and prepare the live queue.',
        location: 'Admin operations room',
      },
    ),
    createSeedEvent('booking-watch', 'Peak booking watch', addHours(base, 3), addHours(base, 5), 'Bookings', {
      description: 'Monitor supply response for midday reservations and customer-choice windows.',
      location: 'District cluster board',
    }),
    createSeedEvent(
      'partner-kyc',
      'Partner KYC review block',
      addDays(addHours(base, 28), 0),
      addDays(addHours(base, 30), 0),
      'Partners',
      {
        description: 'Process queued identity reviews and marketplace readiness holds.',
        location: 'Compliance queue',
      },
    ),
    createSeedEvent(
      'customer-health',
      'Customer support follow-up',
      addDays(addHours(base, 52), 0),
      addDays(addHours(base, 53), 0),
      'Customers',
      {
        description: 'Audit recent complaints, reviews on hold, and wallet-support cases.',
        location: 'Support desk',
      },
    ),
    createSeedEvent(
      'finance-close',
      'Weekly finance closeout',
      addDays(addHours(base, 76), 0),
      addDays(addHours(base, 78), 0),
      'Finance',
      {
        description: 'Reconcile manual adjustments, refunds, and partner cash debt.',
        location: 'Finance workspace',
      },
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

export function createCalendarEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `calendar-${Date.now()}`;
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
    category: 'Operations',
    description: '',
    location: '',
    url: '',
  };
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function createSeedEvent(
  id: string,
  title: string,
  start: Date,
  end: Date,
  category: CalendarCategory,
  options: { readonly description: string; readonly location: string },
): CalendarEventRecord {
  return {
    id,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    category,
    description: options.description,
    location: options.location,
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

function isCalendarCategory(value: string | undefined): value is CalendarCategory {
  return CALENDAR_CATEGORIES.includes(value as CalendarCategory);
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

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
