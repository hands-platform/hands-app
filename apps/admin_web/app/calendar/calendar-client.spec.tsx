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
});
