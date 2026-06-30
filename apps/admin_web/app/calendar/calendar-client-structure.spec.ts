import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('calendar client structure', () => {
  it('uses shared AdminForm button atoms for primary calendar CTAs', () => {
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(clientSource).toContain('AdminFormControlButton');
    expect(clientSource).not.toContain('<button\n              className="button button-primary calendar-add-button"');
    expect(clientSource).not.toContain('<button\n              className="button button-secondary calendar-quick-add"');
  });

  it('uses shared AdminForm checkbox atoms for calendar filters', () => {
    const clientSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-client.tsx'), 'utf8');

    expect(clientSource).toContain('AdminFormCheckbox');
    expect(clientSource).not.toContain('<input\n                checked={selectedCategories.length === CALENDAR_CATEGORIES.length}');
    expect(clientSource).not.toContain('<input\n                      checked={active}');
  });
});
