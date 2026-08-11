import { readFileSync } from 'node:fs';

describe('CalendarClient', () => {
  it('uses the shared Vuexy empty-state atom for hashtag filters', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<p className="calendar-empty-filter muted">No hashtags yet.</p>');
  });

  it('uses the shared Vuexy segmented control atom for calendar views', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('className="calendar-segmented-control" role="tablist"');
    expect(source).not.toContain('role="tab"');
  });

  it('uses the shared Vuexy button atom for calendar navigation controls', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n                  aria-label="Previous calendar period"');
    expect(source).not.toContain('<button\n                  className="calendar-icon-button"');
    expect(source).not.toContain('<button\n                  aria-label="Next calendar period"');
  });

  it('uses the shared Vuexy metric grid atom for calendar metrics', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('AdminMetricGrid');
    expect(source).toContain("scope: 'Current + future'");
    expect(source).toContain("scope: 'Today'");
    expect(source).toContain("scope: 'Next 7 days'");
    expect(source).toContain("scope: 'Next'");
    expect(source).not.toContain('<section className="admin-metric-grid"');
  });

  it('collapses an all-zero calendar summary without hiding load failures', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('const hasCurrentCalendarMetrics = metrics.total > 0 || metrics.today > 0 || metrics.upcoming > 0;');
    expect(source).toContain('{hasCurrentCalendarMetrics ? (');
    expect(source).toContain('No events today or in the next 7 days.');
    expect(source).toContain('role="alert" tone="danger"');
  });

  it('keeps non-default FullCalendar views out of the initial client bundle', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain("await import('@fullcalendar/timegrid')");
    expect(source).toContain("await import('@fullcalendar/list')");
    expect(source).not.toContain("import listPlugin from '@fullcalendar/list'");
    expect(source).not.toContain("import timeGridPlugin from '@fullcalendar/timegrid'");
  });

  it('loads the event drawer only after an operator opens it', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('const CalendarEventDrawer = dynamic<CalendarEventDrawerProps>(');
    expect(source).toContain("() => import('./calendar-event-drawer').then((module) => module.CalendarEventDrawer)");
    expect(source).toContain('{drawerOpen ? (');
    expect(source).not.toContain("import { CalendarEventDrawer } from './calendar-event-drawer'");
  });

  it('keeps the mini date picker out of the primary calendar client bundle', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('const CalendarMiniDatePicker = dynamic<CalendarMiniDatePickerProps>(');
    expect(source).toContain("() => import('./calendar-mini-date-picker').then((module) => module.CalendarMiniDatePicker)");
    expect(source).toContain('<CalendarMiniDatePicker currentDate={currentDate} onChange={handleJumpDate} />');
    expect(source).not.toContain("import DatePicker from 'react-datepicker'");
  });
});
