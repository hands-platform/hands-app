'use client';

import type { ChangeEvent } from 'react';

import { CALENDAR_CATEGORIES, type CalendarCategory, type CalendarEventDraft } from './calendar-model';

type CalendarEventDrawerProps = {
  readonly draft: CalendarEventDraft;
  readonly isOpen: boolean;
  readonly mode: 'create' | 'edit';
  readonly onChange: (draft: CalendarEventDraft) => void;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onReset: () => void;
  readonly onSubmit: () => void;
};

export function CalendarEventDrawer({
  draft,
  isOpen,
  mode,
  onChange,
  onClose,
  onDelete,
  onReset,
  onSubmit,
}: CalendarEventDrawerProps) {
  if (!isOpen) {
    return null;
  }

  const updateField =
    <Key extends keyof CalendarEventDraft>(key: Key) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const nextValue =
        key === 'allDay' ? String((event.target as HTMLInputElement).checked) : event.target.value;

      onChange({
        ...draft,
        [key]:
          key === 'allDay'
            ? nextValue === 'true'
            : key === 'category'
              ? (nextValue as CalendarCategory)
              : nextValue,
      });
    };

  return (
    <>
      <button
        aria-label="Close event editor"
        className="calendar-drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside aria-label="Event editor" className="calendar-drawer">
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">
              {mode === 'create' ? 'Add event' : 'Update event'}
            </span>
            <h2>{mode === 'create' ? 'Create calendar event' : 'Edit calendar event'}</h2>
          </div>
          <div className="calendar-drawer-header-actions">
            {mode === 'edit' ? (
              <button
                className="calendar-icon-button calendar-icon-button-danger"
                onClick={onDelete}
                type="button"
              >
                <i className="tabler-trash" aria-hidden="true" />
                Delete
              </button>
            ) : null}
            <button className="calendar-icon-button" onClick={onClose} type="button">
              <i className="tabler-x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="calendar-drawer-body">
          <div className="calendar-form-grid">
            <label className="calendar-field">
              <span>Title</span>
              <input onChange={updateField('title')} placeholder="Add event title" value={draft.title} />
            </label>

            <label className="calendar-field">
              <span>Category</span>
              <select onChange={updateField('category')} value={draft.category}>
                {CALENDAR_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="calendar-field">
              <span>Start</span>
              <input
                onChange={updateField('start')}
                type={draft.allDay ? 'date' : 'datetime-local'}
                value={toInputDateValue(draft.start, draft.allDay)}
              />
            </label>

            <label className="calendar-field">
              <span>End</span>
              <input
                onChange={updateField('end')}
                type={draft.allDay ? 'date' : 'datetime-local'}
                value={toInputDateValue(draft.end, draft.allDay)}
              />
            </label>

            <label className="calendar-field calendar-field-toggle">
              <span>All day</span>
              <input checked={draft.allDay} onChange={updateField('allDay')} type="checkbox" />
            </label>

            <label className="calendar-field">
              <span>Location</span>
              <input
                onChange={updateField('location')}
                placeholder="Workspace, queue, or district"
                value={draft.location}
              />
            </label>

            <label className="calendar-field">
              <span>Link</span>
              <input onChange={updateField('url')} placeholder="https://..." value={draft.url} />
            </label>

            <label className="calendar-field calendar-field-wide">
              <span>Notes</span>
              <textarea
                onChange={updateField('description')}
                placeholder="Operational details, owner, or follow-up note"
                rows={5}
                value={draft.description}
              />
            </label>
          </div>
        </div>

        <div className="calendar-drawer-footer">
          <button className="button button-primary" onClick={onSubmit} type="button">
            {mode === 'create' ? 'Add Event' : 'Update Event'}
          </button>
          <button className="button button-secondary" onClick={onReset} type="button">
            Reset
          </button>
        </div>
      </aside>
    </>
  );
}

function toInputDateValue(value: string, allDay: boolean) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (allDay) {
    return date.toISOString().slice(0, 10);
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}
