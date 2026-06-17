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

import { AdminSectionHeader } from '../../components/admin-page-template';
import {
  buildCalendarMetrics,
  CALENDAR_CATEGORIES,
  CALENDAR_CATEGORY_COLORS,
  CALENDAR_STORAGE_KEY,
  createBlankDraft,
  createCalendarEventId,
  createSeedEvents,
  filterCalendarEvents,
  formatDateTime,
  fromCalendarEventInput,
  normalizeCalendarDraft,
  toCalendarEventInput,
  type CalendarCategory,
  type CalendarEventDraft,
  type CalendarEventRecord,
} from './calendar-model';
import { CalendarEventDrawer } from './calendar-event-drawer';

type CalendarViewName = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listMonth';

export function CalendarClient() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<CalendarCategory[]>([...CALENDAR_CATEGORIES]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewName>('dayGridMonth');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalendarEventDraft>(createBlankDraft(new Date()));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedEvents = globalThis.localStorage?.getItem(CALENDAR_STORAGE_KEY);

    if (storedEvents) {
      try {
        setEvents(JSON.parse(storedEvents) as CalendarEventRecord[]);
        setHydrated(true);
        return;
      } catch {
        globalThis.localStorage.removeItem(CALENDAR_STORAGE_KEY);
      }
    }

    const seedEvents = createSeedEvents(new Date());
    setEvents(seedEvents);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    globalThis.localStorage?.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events));
  }, [events, hydrated]);

  const visibleEvents = useMemo(
    () => filterCalendarEvents(events, selectedCategories),
    [events, selectedCategories],
  );
  const metrics = useMemo(() => buildCalendarMetrics(visibleEvents, new Date()), [visibleEvents]);
  const calendarEvents = useMemo(() => visibleEvents.map(toCalendarEventInput), [visibleEvents]);
  const editingEvent = editingEventId ? (events.find((event) => event.id === editingEventId) ?? null) : null;

  const openCreateDrawer = (date: Date) => {
    setEditingEventId(null);
    setDraft(createBlankDraft(date));
    setDrawerOpen(true);
  };

  const openEditDrawer = (event: CalendarEventRecord) => {
    setEditingEventId(event.id);
    setDraft({
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      category: event.category,
      description: event.description,
      location: event.location,
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
      fromCalendarEventInput(info.event.toPlainObject({ collapseExtendedProps: false }) as EventInput),
    );
  };

  const handleEventMutation = (payload: EventDropArg | EventResizeDoneArg) => {
    const next = fromCalendarEventInput(
      payload.event.toPlainObject({ collapseExtendedProps: false }) as EventInput,
    );

    setEvents((current) => current.map((event) => (event.id === next.id ? next : event)));
  };

  const handleSubmit = () => {
    const normalized = normalizeCalendarDraft(fromInputDraft(draft));

    if (!normalized.title.trim()) {
      return;
    }

    if (editingEventId) {
      setEvents((current) =>
        current.map((event) =>
          event.id === editingEventId
            ? {
                id: editingEventId,
                ...normalized,
              }
            : event,
        ),
      );
    } else {
      setEvents((current) => [...current, { id: createCalendarEventId(), ...normalized }]);
    }

    closeDrawer();
  };

  const handleDelete = () => {
    if (!editingEventId) {
      closeDrawer();
      return;
    }

    setEvents((current) => current.filter((event) => event.id !== editingEventId));
    closeDrawer();
  };

  const handleReset = () => {
    if (editingEvent) {
      openEditDrawer(editingEvent);
      return;
    }

    setDraft(createBlankDraft(new Date(draft.start)));
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
        <article className="card">
          <span className="metric-label">Visible events</span>
          <strong className="admin-summary-card-value">{metrics.total}</strong>
          <p className="muted">Filtered across the active calendar categories.</p>
        </article>
        <article className="card">
          <span className="metric-label">Today</span>
          <strong className="admin-summary-card-value">{metrics.today}</strong>
          <p className="muted">Events scheduled for the current day.</p>
        </article>
        <article className="card">
          <span className="metric-label">Next 7 days</span>
          <strong className="admin-summary-card-value">{metrics.upcoming}</strong>
          <p className="muted">Upcoming working blocks and operator reminders.</p>
        </article>
        <article className="card">
          <span className="metric-label">Next up</span>
          <strong className="calendar-next-label">{metrics.nextLabel}</strong>
          <p className="muted">The next visible event on the board.</p>
        </article>
      </section>

      <div className="calendar-shell">
        <aside className="calendar-sidebar card">
          <div className="calendar-sidebar-section">
            <button
              className="button button-primary calendar-add-button"
              onClick={() => openCreateDrawer(new Date())}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Add Event
            </button>
          </div>

          <div className="calendar-sidebar-section">
            <AdminSectionHeader title="Mini calendar" description={formatMonthLabel(currentDate)} />
            <div className="calendar-mini-picker">
              <DatePicker inline onChange={handleJumpDate} selected={currentDate} />
            </div>
          </div>

          <div className="calendar-sidebar-section">
            <AdminSectionHeader title="Event Filters" />
            <label
              className={`calendar-filter-row calendar-filter-row-all ${
                selectedCategories.length === CALENDAR_CATEGORIES.length ? 'is-active' : ''
              }`}
            >
              <input
                checked={selectedCategories.length === CALENDAR_CATEGORIES.length}
                onChange={(event) =>
                  setSelectedCategories(event.target.checked ? [...CALENDAR_CATEGORIES] : [])
                }
                type="checkbox"
              />
              <span>View all</span>
            </label>
            <div className="calendar-filter-list">
              {CALENDAR_CATEGORIES.map((category) => {
                const active = selectedCategories.includes(category);

                return (
                  <label className={active ? 'calendar-filter-row is-active' : 'calendar-filter-row'} key={category}>
                    <input
                      checked={active}
                      onChange={() =>
                        setSelectedCategories((current) =>
                          current.includes(category)
                            ? current.filter((value) => value !== category)
                            : [...current, category],
                        )
                      }
                      type="checkbox"
                    />
                    <span className={`pill pill-${CALENDAR_CATEGORY_COLORS[category]}`}>{category}</span>
                  </label>
                );
              })}
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
              eventDrop={handleEventMutation}
              eventResize={handleEventMutation}
              datesSet={(info) => {
                setCurrentDate(info.view.currentStart);
                setCurrentView(info.view.type as CalendarViewName);
              }}
              eventClassNames={(info) => {
                const category = info.event.extendedProps.category as CalendarCategory;
                return [`calendar-event`, `calendar-event-${CALENDAR_CATEGORY_COLORS[category]}`];
              }}
            />
          </div>

          <div className="calendar-board-footer">
            <span className="muted">Drag, resize, or click an event to update it.</span>
            <button
              className="button button-secondary calendar-quick-add"
              onClick={() => openCreateDrawer(new Date())}
              type="button"
            >
              <SquarePen aria-hidden="true" size={15} />
              Quick add
            </button>
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
