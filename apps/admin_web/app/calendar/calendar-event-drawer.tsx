'use client';

import { forwardRef, type ChangeEvent } from 'react';
import DatePicker from 'react-datepicker';
import { RotateCcw, Save, Trash2, X } from 'lucide-react';

import {
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { calendarTagsToInputValue, parseCalendarTags, type CalendarEventDraft } from './calendar-model';

type CalendarEventDrawerProps = {
  readonly draft: CalendarEventDraft;
  readonly isOpen: boolean;
  readonly mode: 'create' | 'edit';
  readonly onChange: (draft: CalendarEventDraft) => void;
  readonly onClose: () => void;
  readonly onDelete: () => void;
  readonly onReset: () => void;
  readonly onSubmit: () => void;
  readonly canEdit: boolean;
  readonly currentOperatorName: string;
};

type CalendarDatePickerInputProps = {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick?: () => void;
  readonly value?: string;
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
  canEdit,
  currentOperatorName,
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
            : key === 'tags'
              ? parseCalendarTags(nextValue)
              : nextValue,
      });
    };
  const updateDateField = (key: 'start' | 'end') => (date: Date | null) => {
    if (!date) {
      return;
    }

    onChange({
      ...draft,
      [key]: toDraftIsoDate(date, draft.allDay),
    });
  };
  const readonlyReason =
    mode === 'edit' && !canEdit ? `Only ${draft.authorName} can update or delete this event.` : null;

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
            <p className="calendar-drawer-author">
              Author: <strong>{draft.authorName || currentOperatorName}</strong>
            </p>
          </div>
          <div className="calendar-drawer-header-actions">
            {mode === 'edit' && canEdit ? (
              <button
                className="calendar-icon-button calendar-icon-button-danger"
                onClick={onDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
                Delete
              </button>
            ) : null}
            <button
              aria-label="Close event drawer"
              className="calendar-icon-button"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        </div>

        <div className="calendar-drawer-body">
          {readonlyReason ? <div className="calendar-readonly-alert">{readonlyReason}</div> : null}
          <div className="calendar-form-grid">
            <AdminFormInput
              className="calendar-field"
              disabled={!canEdit}
              label="Title"
              labelVisibility="visible"
              onChange={updateField('title')}
              placeholder="Add event title"
              name="title"
              value={draft.title}
            />

            <AdminFormInput
              className="calendar-field"
              disabled={!canEdit}
              label="Hashtags"
              labelVisibility="visible"
              name="tags"
              onChange={updateField('tags')}
              placeholder="#booking #handoff"
              value={calendarTagsToInputValue(draft.tags)}
            />

            <DatePicker
              calendarClassName="calendar-vuexy-datepicker"
              customInput={<CalendarDatePickerInput disabled={!canEdit} label="Start" />}
              dateFormat={draft.allDay ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm aa'}
              disabled={!canEdit}
              onChange={updateDateField('start')}
              popperClassName="calendar-vuexy-datepicker-popper"
              popperPlacement="bottom-end"
              selected={toDateValue(draft.start)}
              selectsStart
              showTimeSelect={!draft.allDay}
              startDate={toDateValue(draft.start)}
              endDate={toDateValue(draft.end)}
              timeIntervals={30}
              wrapperClassName="calendar-field"
            />

            <DatePicker
              calendarClassName="calendar-vuexy-datepicker"
              customInput={<CalendarDatePickerInput disabled={!canEdit} label="End" />}
              dateFormat={draft.allDay ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm aa'}
              disabled={!canEdit}
              endDate={toDateValue(draft.end)}
              minDate={toDateValue(draft.start) ?? undefined}
              onChange={updateDateField('end')}
              popperClassName="calendar-vuexy-datepicker-popper"
              popperPlacement="bottom-end"
              selected={toDateValue(draft.end)}
              selectsEnd
              showTimeSelect={!draft.allDay}
              startDate={toDateValue(draft.start)}
              timeIntervals={30}
              wrapperClassName="calendar-field"
            />

            <AdminFormCheckbox
              checked={draft.allDay}
              className="calendar-field calendar-field-toggle"
              disabled={!canEdit}
              label="All day"
              onChange={updateField('allDay')}
            >
              <span className="admin-form-label">All day</span>
            </AdminFormCheckbox>

            <AdminFormInput
              className="calendar-field"
              disabled={!canEdit}
              label="Location"
              labelVisibility="visible"
              name="location"
              onChange={updateField('location')}
              placeholder="Workspace, queue, or district"
              value={draft.location}
            />

            <AdminFormInput
              className="calendar-field"
              disabled={!canEdit}
              label="Link"
              labelVisibility="visible"
              name="url"
              onChange={updateField('url')}
              placeholder="https://..."
              value={draft.url}
            />

            <AdminFormTextarea
              className="calendar-field calendar-field-wide"
              disabled={!canEdit}
              label="Notes"
              labelVisibility="visible"
              name="description"
              onChange={updateField('description')}
              placeholder="Operational details, owner, or follow-up note"
              rows={5}
              value={draft.description}
            />
          </div>
        </div>

        {canEdit ? (
          <div className="calendar-drawer-footer">
            <AdminFormControlButton className="button button-primary" onClick={onSubmit} type="button">
              <Save aria-hidden="true" size={16} />
              {mode === 'create' ? 'Add Event' : 'Update Event'}
            </AdminFormControlButton>
            <AdminFormControlButton className="button button-secondary" onClick={onReset} type="button">
              <RotateCcw aria-hidden="true" size={16} />
              Reset
            </AdminFormControlButton>
          </div>
        ) : null}
      </aside>
    </>
  );
}

const CalendarDatePickerInput = forwardRef<HTMLInputElement, CalendarDatePickerInputProps>(
  function CalendarDatePickerInput({ disabled, label, onClick, value }, ref) {
    return (
      <label className="admin-form-input admin-form-input-date-picker admin-form-control-labeled calendar-datepicker-input">
        <span className="admin-form-label">{label}</span>
        <input
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          readOnly
          ref={ref}
          value={value ?? ''}
        />
      </label>
    );
  },
);

function toDateValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toDraftIsoDate(value: Date, allDay: boolean) {
  if (allDay) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).toISOString();
  }

  return value.toISOString();
}
