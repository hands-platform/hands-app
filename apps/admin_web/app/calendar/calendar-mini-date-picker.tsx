'use client';

import DatePicker from 'react-datepicker';

export type CalendarMiniDatePickerProps = {
  readonly currentDate: Date;
  readonly onChange: (date: Date | null) => void;
};

export function CalendarMiniDatePicker({ currentDate, onChange }: CalendarMiniDatePickerProps) {
  return (
    <DatePicker
      calendarClassName="calendar-vuexy-datepicker calendar-vuexy-datepicker-inline"
      inline
      onChange={onChange}
      selected={currentDate}
    />
  );
}
