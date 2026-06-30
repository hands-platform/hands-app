import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('calendar event drawer structure', () => {
  it('uses shared AdminForm atoms for drawer fields and primary actions', () => {
    const drawerSource = readFileSync(join(process.cwd(), 'app/calendar/calendar-event-drawer.tsx'), 'utf8');

    expect(drawerSource).toContain('AdminFormInput');
    expect(drawerSource).toContain('AdminFormSelect');
    expect(drawerSource).toContain('AdminFormTextarea');
    expect(drawerSource).toContain('AdminFormControlButton');
    expect(drawerSource).not.toContain('<input onChange={updateField');
    expect(drawerSource).not.toContain('<select onChange={updateField');
    expect(drawerSource).not.toContain('<textarea');
    expect(drawerSource).not.toContain('<button className="button button-primary"');
    expect(drawerSource).not.toContain('<button className="button button-secondary"');
  });
});
