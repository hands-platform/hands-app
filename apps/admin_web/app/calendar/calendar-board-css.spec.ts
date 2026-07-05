import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

describe('Calendar board CSS', () => {
  it('keeps FullCalendar internal tables width-synced like Vuexy AppFullCalendar', () => {
    const widthSyncBlock = cssRuleBlockAt(
      globalsCss.indexOf('.calendar-board-surface .fc .fc-col-header,'),
    );

    expect(widthSyncBlock).toContain('.calendar-board-surface .fc .fc-daygrid-body');
    expect(widthSyncBlock).toContain('.calendar-board-surface .fc .fc-scrollgrid-sync-table');
    expect(widthSyncBlock).toContain('.calendar-board-surface .fc .fc-timegrid-body');
    expect(widthSyncBlock).toContain('width: 100% !important');
  });

  it('keeps Week and Day timegrid borders neutral on light and dark Vuexy surfaces', () => {
    const timegridHeaderBlock = cssRuleBlockAt(
      globalsCss.indexOf(
        '.calendar-board-surface .fc .fc-timegrid .fc-scrollgrid-section .fc-col-header-cell,',
      ),
    );
    const timegridSlotBlock = cssRuleBlockAt(
      globalsCss.indexOf('.calendar-board-surface .fc .fc-timegrid-slot {'),
    );
    const timegridDividerBlock = cssRuleBlockAt(
      globalsCss.indexOf('.calendar-board-surface .fc .fc-timegrid-divider {'),
    );

    expect(timegridHeaderBlock).toContain('background: transparent');
    expect(timegridHeaderBlock).toContain('border-color: var(--admin-border)');
    expect(timegridHeaderBlock).toContain('border-left: 0');
    expect(timegridHeaderBlock).toContain('border-right: 0');
    expect(timegridSlotBlock).toContain('border-color: var(--admin-border)');
    expect(timegridSlotBlock).toContain('height: 3rem');
    expect(timegridDividerBlock).toContain('display: none');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
