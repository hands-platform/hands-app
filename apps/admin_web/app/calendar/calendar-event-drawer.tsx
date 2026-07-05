'use client';

import type { ChangeEvent } from 'react';
import DatePicker from 'react-datepicker';
import { RotateCcw, Save, Trash2, X } from 'lucide-react';

import {
  AdminDrawerFormGridFields,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormDatePickerInput,
  AdminFormInput,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
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
      <AdminDrawerBackdropButton
        aria-label="Close event editor"
        onClick={onClose}
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
              <AdminFormControlButton
                className="button-danger calendar-icon-button calendar-icon-button-danger"
                onClick={onDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
                Delete
              </AdminFormControlButton>
            ) : null}
            <AdminFormControlButton
              aria-label="Close event drawer"
              className="button-secondary calendar-icon-button"
              onClick={onClose}
              title="Close event drawer"
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </AdminFormControlButton>
          </div>
        </div>

        <div className="calendar-drawer-body">
          {readonlyReason ? (
            <AdminInlineNotice className="calendar-readonly-notice" tone="warning">
              {readonlyReason}
            </AdminInlineNotice>
          ) : null}
          <AdminDrawerFormGridFields>
            <AdminFormInput
              className="admin-form-control-fluid"
              disabled={!canEdit}
              label="Title"
              labelVisibility="visible"
              onChange={updateField('title')}
              placeholder="Add event title"
              name="title"
              value={draft.title}
            />

            <AdminFormInput
              className="admin-form-control-fluid"
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
              customInput={
                <AdminFormDatePickerInput
                  className="calendar-datepicker-input"
                  disabled={!canEdit}
                  label="Start"
                />
              }
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
              wrapperClassName="admin-form-control-fluid calendar-datepicker-field"
            />

            <DatePicker
              calendarClassName="calendar-vuexy-datepicker"
              customInput={
                <AdminFormDatePickerInput
                  className="calendar-datepicker-input"
                  disabled={!canEdit}
                  label="End"
                />
              }
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
              wrapperClassName="admin-form-control-fluid calendar-datepicker-field"
            />

            <AdminFormCheckbox
              checked={draft.allDay}
              className="calendar-drawer-switch"
              disabled={!canEdit}
              label="All day"
              onChange={updateField('allDay')}
            >
              <span className="admin-form-label">All day</span>
            </AdminFormCheckbox>

            <AdminFormInput
              className="admin-form-control-fluid"
              disabled={!canEdit}
              label="Location"
              labelVisibility="visible"
              name="location"
              onChange={updateField('location')}
              placeholder="Workspace, queue, or district"
              value={draft.location}
            />

            <AdminFormInput
              className="admin-form-control-fluid"
              disabled={!canEdit}
              label="Link"
              labelVisibility="visible"
              name="url"
              onChange={updateField('url')}
              placeholder="https://..."
              value={draft.url}
            />

            <AdminFormTextarea
              className="admin-form-control-fluid admin-grid-span-2"
              disabled={!canEdit}
              label="Notes"
              labelVisibility="visible"
              name="description"
              onChange={updateField('description')}
              placeholder="Operational details, owner, or follow-up note"
              rows={5}
              value={draft.description}
            />
          </AdminDrawerFormGridFields>
        </div>

        {canEdit ? (
          <div className="calendar-drawer-footer">
            <AdminFormControlButton className="button-primary" onClick={onSubmit} type="button">
              <Save aria-hidden="true" size={16} />
              {mode === 'create' ? 'Add Event' : 'Update Event'}
            </AdminFormControlButton>
            <AdminFormControlButton className="button-secondary" onClick={onReset} type="button">
              <RotateCcw aria-hidden="true" size={16} />
              Reset
            </AdminFormControlButton>
          </div>
        ) : null}
      </aside>
    </>
  );
}

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
