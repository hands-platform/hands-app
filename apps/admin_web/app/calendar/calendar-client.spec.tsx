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
    expect(source).not.toContain('<section className="admin-metric-grid"');
  });

  it('keeps non-default FullCalendar views out of the initial client bundle', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain("await import('@fullcalendar/timegrid')");
    expect(source).toContain("await import('@fullcalendar/list')");
    expect(source).not.toContain("import listPlugin from '@fullcalendar/list'");
    expect(source).not.toContain("import timeGridPlugin from '@fullcalendar/timegrid'");
  });
});
