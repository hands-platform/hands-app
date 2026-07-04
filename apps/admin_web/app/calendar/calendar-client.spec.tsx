import { readFileSync } from 'node:fs';

describe('CalendarClient', () => {
  it('uses the shared Vuexy empty-state atom for hashtag filters', () => {
    const source = readFileSync('app/calendar/calendar-client.tsx', 'utf8');

    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<p className="calendar-empty-filter muted">No hashtags yet.</p>');
  });
});
