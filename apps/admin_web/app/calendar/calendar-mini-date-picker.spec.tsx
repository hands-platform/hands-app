import { readFileSync } from 'node:fs';

describe('CalendarMiniDatePicker', () => {
  it('keeps the Vuexy inline datepicker styling contract intact', () => {
    const source = readFileSync('app/calendar/calendar-mini-date-picker.tsx', 'utf8');

    expect(source).toContain("import DatePicker from 'react-datepicker'");
    expect(source).toContain('calendarClassName="calendar-vuexy-datepicker calendar-vuexy-datepicker-inline"');
    expect(source).toContain('inline');
    expect(source).toContain('selected={currentDate}');
    expect(source).toContain('onChange={onChange}');
  });
});
