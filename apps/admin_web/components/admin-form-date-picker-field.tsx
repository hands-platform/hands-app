'use client';

import 'react-datepicker/dist/react-datepicker.css';
import {
  forwardRef,
  memo,
  useEffect,
  useRef,
  useState,
  type ChangeEventHandler,
  type FocusEventHandler,
  type KeyboardEvent,
  type KeyboardEventHandler,
} from 'react';
import DatePicker from 'react-datepicker';

type AdminFormDatePickerMode = 'date' | 'datetime-local' | 'month' | 'time';

const ADMIN_DATEPICKER_POPPER_PROPS = { strategy: 'fixed' as const };

type AdminFormDatePickerFieldProps = {
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
  readonly autoFocus?: boolean;
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
  readonly ariaDescribedBy?: string;
  readonly ariaInvalid?: boolean;
  readonly autoFocus?: boolean;
  readonly calendarOpen?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly labelVisibility?: 'hidden' | 'visible';
  readonly onBlur?: FocusEventHandler<HTMLInputElement>;
  readonly onChange?: ChangeEventHandler<HTMLInputElement>;
  readonly onClick?: () => void;
  readonly onFocus?: FocusEventHandler<HTMLInputElement>;
  readonly onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  readonly required?: boolean;
  readonly value?: string;
};

export const AdminFormDatePickerField = memo(function AdminFormDatePickerField({
  ariaDescribedBy,
  ariaInvalid,
  autoFocus,
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
  const datePickerRef = useRef<InstanceType<typeof DatePicker>>(null);
  const restoreFocusOnCloseRef = useRef(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
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
            ariaDescribedBy={ariaDescribedBy}
            ariaInvalid={ariaInvalid}
            autoFocus={autoFocus}
            calendarOpen={calendarOpen}
            disabled={disabled}
            label={label}
            labelVisibility={labelVisibility}
            required={required}
          />
        )}
        dateFormat={datePickerDisplayFormat(mode)}
        disabled={disabled}
        onCalendarClose={() => {
          setCalendarOpen(false);
          if (!restoreFocusOnCloseRef.current) return;
          restoreFocusOnCloseRef.current = false;
          requestAnimationFrame(() => requestAnimationFrame(() => datePickerRef.current?.setFocus()));
        }}
        onCalendarOpen={() => setCalendarOpen(true)}
        onChange={(date: Date | null) => setSelectedDate(date instanceof Date && Number.isFinite(date.getTime()) ? date : null)}
        onKeyDown={(event) => {
          restoreFocusOnCloseRef.current = event.key === 'Escape';
        }}
        popperClassName="calendar-vuexy-datepicker-popper"
        popperPlacement="bottom-end"
        popperProps={ADMIN_DATEPICKER_POPPER_PROPS}
        portalId="admin-datepicker-portal"
        preventOpenOnFocus
        required={required}
        ref={datePickerRef}
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
    {
      ariaDescribedBy,
      ariaInvalid,
      autoFocus,
      calendarOpen,
      disabled,
      label,
      labelVisibility = 'hidden',
      onBlur,
      onChange,
      onClick,
      onFocus,
      onKeyDown,
      required,
      value,
    },
    ref,
  ) {
    return (
      <label className="admin-form-input admin-form-date-picker admin-form-input-date-picker admin-form-control-labeled calendar-datepicker-input">
        <span className={labelVisibility === 'visible' ? 'admin-form-label' : 'sr-only'}>{label}</span>
        <input
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-label={label}
          autoFocus={autoFocus}
          className="admin-form-date-input"
          disabled={disabled}
          onBlur={onBlur}
          onChange={onChange}
          onClick={onClick}
          onFocus={onFocus}
          onKeyDown={(event) =>
            handleAdminDatePickerInputKeyDown(event, onClick, onKeyDown, calendarOpen)
          }
          readOnly
          ref={ref}
          required={required}
          value={value ?? ''}
        />
      </label>
    );
  },
);

export function handleAdminDatePickerInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  openCalendar?: () => void,
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>,
  calendarOpen?: boolean,
) {
  if (event.key === ' ') {
    event.preventDefault();
    if (!calendarOpen) openCalendar?.();
    return;
  }

  if (
    calendarOpen === false &&
    (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === 'ArrowUp')
  ) {
    event.preventDefault();
    openCalendar?.();
    return;
  }

  onKeyDown?.(event);
}

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

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  return validDateOrNull(
    new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0),
  );
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
