import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin table panel CSS', () => {
  it('anchors shared table card chrome on the admin table atom while preserving booking aliases', () => {
    const cardIndex = globalsCss.indexOf('.admin-table-card,');
    const cardBlock = cssRuleBlockAt(cardIndex);

    expect(cardIndex).toBeGreaterThan(-1);
    expect(cardBlock).toContain('.vuexy-booking-table-card');
    expect(cardBlock).toContain('background: var(--admin-surface-raised)');
    expect(cardBlock).toContain('border-radius: var(--admin-radius)');
    expect(cardBlock).toContain('box-shadow: var(--admin-shadow-md)');
  });

  it('keeps booking monitor table scroll treatment available through the admin table atom', () => {
    const scrollIndex = globalsCss.indexOf('.booking-monitor .admin-table-card .admin-table-scroll,');
    const scrollBlock = cssRuleBlockAt(scrollIndex);

    expect(scrollIndex).toBeGreaterThan(-1);
    expect(scrollBlock).toContain('.booking-monitor .vuexy-booking-table-card .admin-table-scroll');
    expect(scrollBlock).toContain('border: 0');
    expect(scrollBlock).toContain('overflow-x: auto');
    expect(scrollBlock).toContain('overflow-y: visible');
  });

  it('anchors grouped table sections on the admin table group atom while preserving booking aliases', () => {
    const groupIndex = globalsCss.indexOf('.admin-table-group,');
    const groupBlock = cssRuleBlockAt(groupIndex);

    expect(groupIndex).toBeGreaterThan(-1);
    expect(groupBlock).toContain('.vuexy-booking-table-group');
    expect(groupBlock).toContain('background: var(--admin-surface-raised)');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
