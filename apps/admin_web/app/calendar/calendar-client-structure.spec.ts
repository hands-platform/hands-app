import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('calendar client structure', () => {
  it('uses shared AdminForm button atoms for primary calendar CTAs', () => {
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(clientSource).toContain('AdminFormControlButton');
    expect(clientSource).not.toContain('<button\n              className="button button-primary calendar-add-button"');
    expect(clientSource).not.toContain('<button\n              className="button button-secondary calendar-quick-add"');
  });

  it('uses shared AdminForm checkbox atoms for hashtag calendar filters', () => {
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(clientSource).toContain('AdminFormCheckbox');
    expect(clientSource).toContain('StatusBadge');
    expect(clientSource).toContain('calendarFilterBadgeTone');
    expect(clientSource).not.toContain('PillClassBadge');
    expect(clientSource).toContain('buildCalendarTagFilters');
    expect(clientSource).toContain('selectedTags');
    expect(clientSource).toContain('calendar-filter-count');
    expect(clientSource).not.toContain('<span className={`pill pill-${filter.tone}`}>#{filter.tag}</span>');
    expect(clientSource).not.toContain('title="Mini calendar"');
    expect(clientSource).not.toContain('description={formatMonthLabel(currentDate)}');
    expect(clientSource).not.toContain('<input\n                checked={selectedCategories.length === CALENDAR_CATEGORIES.length}');
    expect(clientSource).not.toContain('<input\n                      checked={active}');
    expect(clientSource).not.toContain('CALENDAR_CATEGORIES.map');
  });

  it('uses shared Vuexy card surfaces for the calendar shell panels', () => {
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(clientSource).toContain('AdminAsideCard');
    expect(clientSource).toContain('AdminCard');
    expect(clientSource).not.toContain('<aside className="calendar-sidebar card">');
    expect(clientSource).not.toContain('<section className="calendar-board card">');
  });

  it('renders author metadata and blocks non-author mutations', () => {
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(clientSource).toContain('currentOperator');
    expect(clientSource).toContain('canEditCalendarEvent');
    expect(clientSource).toContain('payload.revert()');
    expect(clientSource).toContain('calendar-event-author');
    expect(clientSource).toContain('calendar-event-locked');
  });

  it('keeps the operations calendar backed by persistent Admin API events', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/calendar/page.tsx'), 'utf8');
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(pageSource).toContain("adminGet<AdminCalendarEvent[]>('/admin/calendar-events?take=200', [])");
    expect(clientSource).toContain("calendarEventRequest('/api/admin/calendar-events'");
    expect(clientSource).toContain("calendarEventRequest(`/api/admin/calendar-events/${encodeURIComponent(id)}`");
    expect(clientSource).not.toMatch(/\b(?:localStorage|sessionStorage)\b/);
  });

  it('does not render implementation explainer copy above the Vuexy calendar app surface', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/calendar/page.tsx'), 'utf8');

    expect(pageSource).not.toContain('Vuexy-style shared calendar');
    expect(pageSource).not.toContain('description=');
  });
});
