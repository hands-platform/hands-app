'use client';

import 'react-datepicker/dist/react-datepicker.css';

import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import DatePicker from 'react-datepicker';
import type { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, SquarePen } from 'lucide-react';

import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFormCheckbox, AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminSegmentedControl } from '../../components/admin-segmented-control';
import { AdminAsideCard, AdminCard, AdminKpiCard } from '../../components/admin-surface';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import {
  buildCalendarMetrics,
  buildCalendarTagFilters,
  calendarTagTone,
  canEditCalendarEvent,
  createBlankDraft,
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
  readonly initialEvents: readonly CalendarEventRecord[];
};

const calendarViewOptions: ReadonlyArray<{
  readonly label: string;
  readonly value: CalendarViewName;
}> = [
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'Week', value: 'timeGridWeek' },
  { label: 'Day', value: 'timeGridDay' },
  { label: 'List', value: 'listMonth' },
];

export function CalendarClient({ currentOperator, initialEvents }: CalendarClientProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [events, setEvents] = useState<CalendarEventRecord[]>(() =>
    initialEvents
      .map((event) => normalizeStoredCalendarEvent(event, currentOperator))
      .filter((event): event is CalendarEventRecord => Boolean(event)),
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewName>('dayGridMonth');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalendarEventDraft>(createBlankDraft(new Date()));
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visibleEvents = useMemo(
    () => filterCalendarEvents(events, selectedTags),
    [events, selectedTags],
  );
  const tagFilters = useMemo(() => buildCalendarTagFilters(events, currentDate), [events, currentDate]);
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

  const handleEventMutation = async (payload: EventDropArg | EventResizeDoneArg) => {
    const next = fromCalendarEventInput(
      payload.event.toPlainObject({ collapseExtendedProps: false }) as EventInput,
      currentOperator,
    );

    if (!canEditCalendarEvent(events.find((event) => event.id === next.id), currentOperator)) {
      payload.revert();
      return;
    }

    setMutationError(null);
    try {
      const savedEvent = await updateCalendarEvent(next.id, calendarEventPayload(next));
      setEvents((current) => current.map((event) => (event.id === next.id ? savedEvent : event)));
    } catch {
      payload.revert();
      setMutationError('Calendar event could not be saved. Check author permissions and try again.');
    }
  };

  const handleSubmit = async () => {
    const normalized = normalizeCalendarDraft(fromInputDraft(draft));

    if (!normalized.title.trim()) {
      return;
    }

    setMutationError(null);
    setSubmitting(true);

    if (editingEventId) {
      if (!canEditCalendarEvent(editingEvent, currentOperator)) {
        setSubmitting(false);
        return;
      }

      try {
        const savedEvent = await updateCalendarEvent(editingEventId, calendarEventPayload(normalized));
        setEvents((current) => current.map((event) => (event.id === editingEventId ? savedEvent : event)));
        closeDrawer();
      } catch {
        setMutationError('Calendar event could not be updated. Check author permissions and try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const savedEvent = await createCalendarEvent(calendarEventPayload(normalized));
      setEvents((current) => [...current, savedEvent]);
      closeDrawer();
    } catch {
      setMutationError('Calendar event could not be created. Check required fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEventId) {
      closeDrawer();
      return;
    }

    if (canEditCalendarEvent(editingEvent, currentOperator)) {
      setMutationError(null);
      try {
        await deleteCalendarEvent(editingEventId);
        setEvents((current) => current.filter((event) => event.id !== editingEventId));
      } catch {
        setMutationError('Calendar event could not be deleted. Check author permissions and try again.');
        return;
      }
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
        <AdminKpiCard
          helper="Filtered across the active calendar categories."
          label="Visible events"
          value={metrics.total}
        />
        <AdminKpiCard helper="Events scheduled for the current day." label="Today" value={metrics.today} />
        <AdminKpiCard
          helper="Upcoming working blocks and operator reminders."
          label="Next 7 days"
          value={metrics.upcoming}
        />
        <AdminKpiCard helper="The next visible event on the board." label="Next up" value={metrics.nextLabel} />
      </section>

      {mutationError ? (
        <AdminInlineNotice className="calendar-error-banner" role="alert" tone="danger">
          {mutationError}
        </AdminInlineNotice>
      ) : null}

      <div className="calendar-shell">
        <AdminAsideCard className="calendar-sidebar">
          <div className="calendar-sidebar-section">
            <AdminFormControlButton
              className="button-primary calendar-add-button"
              onClick={() => openCreateDrawer(new Date())}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              Add Event
            </AdminFormControlButton>
          </div>

          <div className="calendar-sidebar-section">
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
                      <StatusBadge tone={calendarFilterBadgeTone(filter.tone)}>#{filter.tag}</StatusBadge>
                      <span className="calendar-filter-count">({filter.count})</span>
                    </AdminFormCheckbox>
                  );
                })
              ) : (
                <AdminEmptyState
                  className="calendar-empty-filter"
                  message="No hashtags yet."
                  title={null}
                />
              )}
            </div>
          </div>
        </AdminAsideCard>

        <AdminCard className="calendar-board">
          <div className="calendar-board-toolbar">
            <div>
              <span className="calendar-board-eyebrow">Shared operations planning</span>
              <h2>{formatMonthLabel(currentDate)}</h2>
            </div>
            <div className="calendar-toolbar-actions">
              <AdminSegmentedControl
                activeValue={currentView}
                ariaLabel="Calendar views"
                className="calendar-segmented-control"
                options={calendarViewOptions.map((option) => ({
                  href: `#calendar-view-${option.value}`,
                  label: option.label,
                  onClick: (event) => {
                    event.preventDefault();
                    changeView(option.value);
                  },
                  value: option.value,
                }))}
              />
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
              className="button-secondary calendar-quick-add"
              onClick={() => openCreateDrawer(new Date())}
              type="button"
            >
              <SquarePen aria-hidden="true" size={15} />
              Quick add
            </AdminFormControlButton>
          </div>
        </AdminCard>
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
        canEdit={canEditSelectedEvent && !submitting}
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

function calendarEventPayload(event: CalendarEventDraft | CalendarEventRecord) {
  return {
    allDay: event.allDay,
    description: event.description,
    end: event.end,
    location: event.location,
    start: event.start,
    tags: event.tags,
    title: event.title,
    url: event.url,
  };
}

async function createCalendarEvent(payload: ReturnType<typeof calendarEventPayload>) {
  return calendarEventRequest('/api/admin/calendar-events', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}

async function updateCalendarEvent(id: string, payload: ReturnType<typeof calendarEventPayload>) {
  return calendarEventRequest(`/api/admin/calendar-events/${encodeURIComponent(id)}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
  });
}

async function deleteCalendarEvent(id: string) {
  await calendarEventRequest(`/api/admin/calendar-events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

async function calendarEventRequest(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error('Calendar request failed');
  }

  return (await response.json()) as CalendarEventRecord;
}

function calendarFilterBadgeTone(tone: CalendarTagTone): StatusBadgeTone {
  return tone === 'accent' ? 'primary' : tone;
}
