import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('calendar event drawer structure', () => {
  it('uses shared AdminForm atoms for drawer fields and primary actions', () => {
    const drawerSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-event-drawer.tsx'), 'utf8');

    expect(drawerSource).toContain('AdminFormInput');
    expect(drawerSource).toContain('AdminFormTextarea');
    expect(drawerSource).toContain('AdminFormControlButton');
    expect(drawerSource).toContain('Author:');
    expect(drawerSource).toContain('Hashtags');
    expect(drawerSource).toContain('Only ${draft.authorName} can update or delete this event.');
    expect(drawerSource).not.toContain('<input onChange={updateField');
    expect(drawerSource).not.toContain('<select onChange={updateField');
    expect(drawerSource).not.toContain('<textarea');
    expect(drawerSource).not.toContain('<button className="button button-primary"');
    expect(drawerSource).not.toContain('<button className="button button-secondary"');
    expect(drawerSource).not.toContain('Category');
    expect(drawerSource).not.toContain('AdminFormSelect');
  });
});
