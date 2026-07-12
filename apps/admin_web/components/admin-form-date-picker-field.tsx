'use client';

import { forwardRef, memo, useEffect, useState, type ChangeEventHandler, type MouseEventHandler } from 'react';
import DatePicker from 'react-datepicker';

type AdminFormDatePickerMode = 'date' | 'datetime-local' | 'month' | 'time';

type AdminFormDatePickerFieldProps = {
  readonly className: string;
  readonly defaultValue?: string | number | readonly string[];
  readonly disabled?: boolean;
  readonly label: string;
  readonly labelVisibility?: 'hidden' | 'visible';
  readonly mode: AdminFormDatePickerMode;
  readonly name: string;
  readonly required?: boolean;
  readonly value?: string | number | readonly string[];
};

type AdminDatePickerTextInputProps = {
  readonly disabled?: boolean;
  readonly label: string;
  readonly labelVisibility?: 'hidden' | 'visible';
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly onClick?: MouseEventHandler<HTMLInputElement>;
  readonly required?: boolean;
  readonly value?: string;
};

export const AdminFormDatePickerField = memo(function AdminFormDatePickerField({
  className,
  defaultValue,
  disabled,
  label,
  labelVisibility = 'hidden',
  mode,
  name,
  required,
  value,
}: AdminFormDatePickerFieldProps) {
  const rawValue = stringValue(value ?? defaultValue);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => parseDatePickerValue(rawValue, mode));

  useEffect(() => {
    setSelectedDate(parseDatePickerValue(rawValue, mode));
  }, [mode, rawValue]);

  const formValue = selectedDate ? formatDatePickerValue(selectedDate, mode) : '';

  return (
    <>
      <DatePicker
        calendarClassName="calendar-vuexy-datepicker"
        customInput={(
          <AdminDatePickerTextInput
            disabled={disabled}
            label={label}
            labelVisibility={labelVisibility}
            required={required}
          />
        )}
        dateFormat={datePickerDisplayFormat(mode)}
        disabled={disabled}
        onChange={(date: Date | null) => setSelectedDate(date instanceof Date && Number.isFinite(date.getTime()) ? date : null)}
        popperClassName="calendar-vuexy-datepicker-popper"
        popperPlacement="bottom-end"
        required={required}
        selected={selectedDate}
        showMonthYearPicker={mode === 'month'}
        showTimeSelect={mode === 'datetime-local'}
        showTimeSelectOnly={mode === 'time'}
        timeIntervals={30}
        wrapperClassName={className}
      />
      <input
        aria-hidden="true"
        className="admin-form-date-hidden-input"
        disabled={disabled}
        name={name}
        type="hidden"
        value={formValue}
      />
    </>
  );
});

const AdminDatePickerTextInput = forwardRef<HTMLInputElement, AdminDatePickerTextInputProps>(
  function AdminDatePickerTextInput(
    { disabled, label, labelVisibility = 'hidden', onChange, onClick, required, value },
    ref,
  ) {
    return (
      <label className="admin-form-input admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled calendar-datepicker-input">
        <span className={labelVisibility === 'visible' ? 'admin-form-label' : 'sr-only'}>{label}</span>
        <input
          aria-label={label}
          className="admin-form-date-input"
          disabled={disabled}
          onChange={onChange}
          onClick={onClick}
          readOnly
          ref={ref}
          required={required}
          value={value ?? ''}
        />
      </label>
    );
  },
);

function stringValue(value: string | number | readonly string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value == null ? '' : String(value);
}

function parseDatePickerValue(value: string, mode: AdminFormDatePickerMode) {
  if (!value) {
    return null;
  }

  if (mode === 'month') {
    const [year, month] = value.split('-').map(Number);
    return validDateOrNull(new Date(year, (month || 1) - 1, 1, 12, 0, 0, 0));
  }

  if (mode === 'date') {
    const [year, month, day] = value.split('-').map(Number);
    return validDateOrNull(new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0));
  }

  if (mode === 'time') {
    const [hour, minute] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hour || 0, minute || 0, 0, 0);
    return validDateOrNull(date);
  }

  return validDateOrNull(new Date(value));
}

function validDateOrNull(value: Date) {
  return Number.isFinite(value.getTime()) ? value : null;
}

function formatDatePickerValue(value: Date, mode: AdminFormDatePickerMode) {
  if (mode === 'month') {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
  }

  if (mode === 'date') {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (mode === 'time') {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(
    value.getMinutes(),
  )}`;
}

function datePickerDisplayFormat(mode: AdminFormDatePickerMode) {
  if (mode === 'month') {
    return 'yyyy-MM';
  }

  if (mode === 'time') {
    return 'HH:mm';
  }

  return mode === 'datetime-local' ? 'yyyy-MM-dd h:mm aa' : 'yyyy-MM-dd';
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}
