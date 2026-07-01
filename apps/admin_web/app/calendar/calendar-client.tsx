'use client';

import 'react-datepicker/dist/react-datepicker.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import DatePicker from 'react-datepicker';
import type { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, SquarePen } from 'lucide-react';

import { AdminFormCheckbox, AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { MetricCard } from '../../components/metric-card';
import {
  buildCalendarMetrics,
  buildCalendarTagFilters,
  calendarTagTone,
  canEditCalendarEvent,
  CALENDAR_STORAGE_KEY,
  createBlankDraft,
  createCalendarEventId,
  createSeedEvents,
  filterCalendarEvents,
  fromCalendarEventInput,
  normalizeStoredCalendarEvent,
  normalizeCalendarDraft,
  toCalendarEventInput,
  type CalendarEventDraft,
  type CalendarEventRecord,
  type CalendarOperator,
  type CalendarTagTone,
} from './calendar-model';
import { CalendarEventDrawer } from './calendar-event-drawer';

type CalendarViewName = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listMonth';

type CalendarClientProps = {
  readonly currentOperator: CalendarOperator;
};

export function CalendarClient({ currentOperator }: CalendarClientProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewName>('dayGridMonth');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalendarEventDraft>(createBlankDraft(new Date()));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const storedEvents = globalThis.localStorage?.getItem(CALENDAR_STORAGE_KEY);

      if (storedEvents) {
        try {
          const parsed = JSON.parse(storedEvents) as unknown;
          const nextEvents = Array.isArray(parsed)
            ? parsed
                .map((event) => normalizeStoredCalendarEvent(event, currentOperator))
                .filter((event): event is CalendarEventRecord => Boolean(event))
            : [];
          setEvents(nextEvents);
          setHydrated(true);
          return;
        } catch {
          globalThis.localStorage.removeItem(CALENDAR_STORAGE_KEY);
        }
      }

      const seedEvents = createSeedEvents(new Date(), currentOperator);
      setEvents(seedEvents);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [currentOperator]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    globalThis.localStorage?.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
  }, [events, hydrated]);

  const visibleEvents = useMemo(
    () => filterCalendarEvents(events, selectedTags),
    [events, selectedTags],
  );
  const tagFilters = useMemo(() => buildCalendarTagFilters(events), [events]);
  const metrics = useMemo(() => buildCalendarMetrics(visibleEvents, new Date()), [visibleEvents]);
  const calendarEvents = useMemo(() => visibleEvents.map(toCalendarEventInput), [visibleEvents]);
  const editingEvent = editingEventId ? (events.find((event) => event.id === editingEventId) ?? null) : null;
  const canEditSelectedEvent = editingEventId ? canEditCalendarEvent(editingEvent, currentOperator) : true;

  const openCreateDrawer = (date: Date) => {
    setEditingEventId(null);
    setDraft({
      ...createBlankDraft(date),
      authorId: currentOperator.id,
      authorName: currentOperator.name,
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (event: CalendarEventRecord) => {
    setEditingEventId(event.id);
    setDraft({
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      authorId: event.authorId,
      authorName: event.authorName,
      description: event.description,
      location: event.location,
      tags: event.tags,
      url: event.url,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingEventId(null);
  };

  const handleDateClick = (info: DateClickArg) => {
    openCreateDrawer(info.date);
  };

  const handleEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    openEditDrawer(
      fromCalendarEventInput(info.event.toPlainObject({ collapseExtendedProps: false }) as EventInput, currentOperator),
    );
  };

  const handleEventMutation = (payload: EventDropArg | EventResizeDoneArg) => {
    const next = fromCalendarEventInput(
      payload.event.toPlainObject({ collapseExtendedProps: false }) as EventInput,
      currentOperator,
    );

    if (!canEditCalendarEvent(events.find((event) => event.id === next.id), currentOperator)) {
      payload.revert();
      return;
    }

    setEvents((current) => current.map((event) => (event.id === next.id ? next : event)));
  };

  const handleSubmit = () => {
    const normalized = normalizeCalendarDraft(fromInputDraft(draft));

    if (!normalized.title.trim()) {
      return;
    }

    if (editingEventId) {
      if (!canEditCalendarEvent(editingEvent, currentOperator)) {
        return;
      }

      setEvents((current) =>
        current.map((event) =>
          event.id === editingEventId
            ? {
                id: editingEventId,
                ...normalized,
                authorId: event.authorId,
                authorName: event.authorName,
              }
            : event,
        ),
      );
    } else {
      setEvents((current) => [
        ...current,
        {
          id: createCalendarEventId(),
          ...normalized,
          authorId: currentOperator.id,
          authorName: currentOperator.name,
        },
      ]);
    }

    closeDrawer();
  };

  const handleDelete = () => {
    if (!editingEventId) {
      closeDrawer();
      return;
    }

    if (canEditCalendarEvent(editingEvent, currentOperator)) {
      setEvents((current) => current.filter((event) => event.id !== editingEventId));
    }
    closeDrawer();
  };

  const handleReset = () => {
    if (editingEvent) {
      openEditDrawer(editingEvent);
      return;
    }

    setDraft({
      ...createBlankDraft(new Date(draft.start)),
      authorId: currentOperator.id,
      authorName: currentOperator.name,
    });
  };

  const handleJumpDate = (date: Date | null) => {
    if (!date) {
      return;
    }

    setCurrentDate(date);
    calendarRef.current?.getApi().gotoDate(date);
  };

  const changeView = (view: CalendarViewName) => {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  };

  const navigateCalendar = (direction: 'prev' | 'next' | 'today') => {
    const api = calendarRef.current?.getApi();

    if (!api) {
      return;
    }

    if (direction === 'prev') {
      api.prev();
    } else if (direction === 'next') {
      api.next();
    } else {
      api.today();
    }

    setCurrentDate(api.getDate());
    setCurrentView(api.view.type as CalendarViewName);
  };

  return (
    <div className="calendar-page">
      <section className="admin-metric-grid">
        <MetricCard
          helper="Filtered across the active calendar categories."
          label="Visible events"
          value={metrics.total}
        />
        <MetricCard helper="Events scheduled for the current day." label="Today" value={metrics.today} />
        <MetricCard
          helper="Upcoming working blocks and operator reminders."
          label="Next 7 days"
          value={metrics.upcoming}
        />
        <MetricCard helper="The next visible event on the board." label="Next up" value={metrics.nextLabel} />
      </section>

      <div className="calendar-shell">
        <aside className="calendar-sidebar card">
          <div className="calendar-sidebar-section">
            <AdminFormControlButton
              className="button button-primary calendar-add-button"
              onClick={() => openCreateDrawer(new Date())}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Add Event
            </AdminFormControlButton>
          </div>

          <div className="calendar-sidebar-section">
            <AdminSectionHeader title="Mini calendar" description={formatMonthLabel(currentDate)} />
            <div className="calendar-mini-picker">
              <DatePicker
                calendarClassName="calendar-vuexy-datepicker calendar-vuexy-datepicker-inline"
                inline
                onChange={handleJumpDate}
                selected={currentDate}
              />
            </div>
          </div>

          <div className="calendar-sidebar-section">
            <AdminSectionHeader title="Event Filters" />
            <AdminFormCheckbox
              className={`calendar-filter-row calendar-filter-row-all ${
                selectedTags.length === 0 ? 'is-active' : ''
              }`}
              checked={selectedTags.length === 0}
              label="View all calendar hashtags"
              onChange={() => setSelectedTags([])}
            >
              <span>View all</span>
            </AdminFormCheckbox>
            <div className="calendar-filter-list">
              {tagFilters.length ? (
                tagFilters.map((filter) => {
                  const active = selectedTags.includes(filter.tag);

                  return (
                    <AdminFormCheckbox
                      checked={active}
                      className={active ? 'calendar-filter-row is-active' : 'calendar-filter-row'}
                      key={filter.tag}
                      label={`View #${filter.tag} calendar events`}
                      onChange={() =>
                        setSelectedTags((current) =>
                          current.includes(filter.tag)
                            ? current.filter((value) => value !== filter.tag)
                            : [...current, filter.tag],
                        )
                      }
                    >
                      <span className={`pill pill-${filter.tone}`}>#{filter.tag}</span>
                      <span className="calendar-filter-count">({filter.count})</span>
                    </AdminFormCheckbox>
                  );
                })
              ) : (
                <p className="calendar-empty-filter muted">No hashtags yet.</p>
              )}
            </div>
          </div>
        </aside>

        <section className="calendar-board card">
          <div className="calendar-board-toolbar">
            <div>
              <span className="calendar-board-eyebrow">Shared operations planning</span>
              <h2>{formatMonthLabel(currentDate)}</h2>
            </div>
            <div className="calendar-toolbar-actions">
              <div className="calendar-segmented-control" role="tablist" aria-label="Calendar views">
                {[
                  ['dayGridMonth', 'Month'],
                  ['timeGridWeek', 'Week'],
                  ['timeGridDay', 'Day'],
                  ['listMonth', 'List'],
                ].map(([view, label]) => (
                  <button
                    aria-selected={currentView === view}
                    className={currentView === view ? 'is-active' : undefined}
                    key={view}
                    onClick={() => changeView(view as CalendarViewName)}
                    role="tab"
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="calendar-nav-buttons">
                <button
                  aria-label="Previous calendar period"
                  className="calendar-icon-button"
                  onClick={() => navigateCalendar('prev')}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>
                <button
                  className="calendar-icon-button"
                  onClick={() => navigateCalendar('today')}
                  type="button"
                >
                  <CalendarDays aria-hidden="true" size={16} />
                  Today
                </button>
                <button
                  aria-label="Next calendar period"
                  className="calendar-icon-button"
                  onClick={() => navigateCalendar('next')}
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="calendar-board-surface">
            <FullCalendar
              ref={calendarRef}
              events={calendarEvents}
              plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView={currentView}
              headerToolbar={false}
              dayMaxEvents={2}
              editable
              eventResizableFromStart
              navLinks
              height="auto"
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventContent={(info) => {
                const authorName = String(info.event.extendedProps.authorName ?? 'Unknown');

                return (
                  <div className="calendar-event-content">
                    <span className="calendar-event-title">{info.event.title}</span>
                    <span className="calendar-event-author">{authorName}</span>
                  </div>
                );
              }}
              eventDrop={handleEventMutation}
              eventResize={handleEventMutation}
              datesSet={(info) => {
                setCurrentDate(info.view.currentStart);
                setCurrentView(info.view.type as CalendarViewName);
              }}
              eventClassNames={(info) => {
                const tags = info.event.extendedProps.tags as readonly string[] | undefined;
                const tone: CalendarTagTone = tags?.[0] ? calendarTagTone(tags[0]) : 'accent';
                const canEdit = info.event.extendedProps.authorId === currentOperator.id;
                return [`calendar-event`, `calendar-event-${tone}`, canEdit ? 'calendar-event-owned' : 'calendar-event-locked'];
              }}
            />
          </div>

          <div className="calendar-board-footer">
            <span className="muted">Drag, resize, or click an event to update it.</span>
            <AdminFormControlButton
              className="button button-secondary calendar-quick-add"
              onClick={() => openCreateDrawer(new Date())}
              type="button"
            >
              <SquarePen aria-hidden="true" size={15} />
              Quick add
            </AdminFormControlButton>
          </div>
        </section>
      </div>

      <CalendarEventDrawer
        draft={draft}
        isOpen={drawerOpen}
        mode={editingEventId ? 'edit' : 'create'}
        onChange={setDraft}
        onClose={closeDrawer}
        onDelete={handleDelete}
        onReset={handleReset}
        onSubmit={handleSubmit}
        canEdit={canEditSelectedEvent}
        currentOperatorName={currentOperator.name}
      />
    </div>
  );
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function fromInputDraft(draft: CalendarEventDraft): CalendarEventDraft {
  if (draft.allDay) {
    return {
      ...draft,
      start: new Date(`${readDatePart(draft.start)}T00:00:00`).toISOString(),
      end: new Date(`${readDatePart(draft.end)}T00:00:00`).toISOString(),
    };
  }

  return {
    ...draft,
    start: new Date(draft.start).toISOString(),
    end: new Date(draft.end).toISOString(),
  };
}

function readDatePart(value: string) {
  return value.includes('T') ? value.slice(0, 10) : value;
}
