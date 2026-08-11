import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { CalendarEventDrawer } from './calendar-event-drawer';

describe('CalendarEventDrawer', () => {
  it('uses shared Vuexy form atoms for editable event fields', () => {
    const markup = renderToStaticMarkup(
      <CalendarEventDrawer
        canEdit
        currentOperatorName="Master Admin"
        draft={{
          allDay: false,
          authorId: 'admin-1',
          authorName: 'Master Admin',
          description: 'Follow up with dispatch',
          end: '2026-07-03T04:30:00.000Z',
          location: 'Hanoi',
          start: '2026-07-03T03:00:00.000Z',
          tags: ['booking', 'handoff'],
          title: 'Booking handoff',
          url: '/bookings/booking-1',
        }}
        isOpen
        mode="edit"
        onChange={vi.fn()}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onReset={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(markup).toContain('admin-form-input admin-form-control-labeled admin-form-control-fluid');
    expect(markup).toContain(
      'admin-form-textarea admin-form-control-labeled admin-form-control-fluid admin-grid-span-2',
    );
    expect(markup).toContain('admin-form-checkbox admin-form-control-labeled calendar-drawer-switch');
    expect(markup).toContain('admin-form-control-fluid calendar-datepicker-field');
    expect(markup).not.toContain('calendar-drawer-field');
    expect(markup).not.toContain('calendar-field');
    expect(markup).not.toContain('<div class="calendar-field"><span>Title</span><label class="admin-form-input');
    expect(markup).not.toContain('<div class="calendar-field"><span>Hashtags</span><label class="admin-form-input');
    expect(markup).not.toContain('<label class="calendar-field calendar-field-toggle"><span>All day</span><input');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="calendar-event-drawer-title"');
    expect(markup).toContain('tabindex="-1"');
  });

  it('uses the shared Vuexy drawer form grid surface', () => {
    const source = readFileSync(join(process.cwd(), 'app/calendar/calendar-event-drawer.tsx'), 'utf8');

    expect(source).toContain('AdminDrawerFormGridFields');
    expect(source).not.toContain('<div className="calendar-form-grid">');
  });

  it('uses the shared Vuexy drawer backdrop atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/calendar/calendar-event-drawer.tsx'), 'utf8');

    expect(source).toContain('AdminDrawerBackdropButton');
    expect(source).not.toContain('<button\n        aria-label="Close event editor"');
  });

  it('uses the shared Vuexy drawer surface atom for the app side panel', () => {
    const source = readFileSync(join(process.cwd(), 'app/calendar/calendar-event-drawer.tsx'), 'utf8');

    expect(source).toContain('AdminDrawerSurface');
    expect(source).not.toContain('<aside aria-label="Event editor" className="calendar-drawer">');
    expect(source).toContain('useAdminModalFocus(drawerRef, onClose, undefined, isOpen)');
  });

  it('uses the shared Vuexy button atom for visible drawer header actions', () => {
    const source = readFileSync(join(process.cwd(), 'app/calendar/calendar-event-drawer.tsx'), 'utf8');

    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<button\n                className="calendar-icon-button calendar-icon-button-danger"');
    expect(source).not.toContain('<button\n              aria-label="Close event drawer"');
  });

  it('scopes drawer author typography to the direct author label slot', () => {
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(css).toContain('.calendar-drawer-author > strong');
    expect(css).not.toContain('.calendar-drawer-author strong {');
  });
});
