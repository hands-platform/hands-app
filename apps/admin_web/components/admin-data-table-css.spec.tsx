import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin data table CSS', () => {
  it('keeps shared Vuexy data table cells vertically centered for scan-friendly rows', () => {
    const cellIndex = globalsCss.indexOf('.table.vuexy-data-table th,\n.table.vuexy-data-table td {');
    const cellBlock = cssRuleBlockAt(cellIndex);

    expect(cellIndex).toBeGreaterThan(-1);
    expect(cellBlock).toContain('vertical-align: middle');
    expect(cellBlock).not.toContain('vertical-align: top');
  });

  it('keeps outer table columns on the Vuexy card edge padding rhythm', () => {
    const firstColumnIndex = globalsCss.indexOf('.table.vuexy-data-table th:first-child,');
    const firstColumnBlock = cssRuleBlockAt(firstColumnIndex);
    const lastColumnIndex = globalsCss.indexOf('.table.vuexy-data-table th:last-child,');
    const lastColumnBlock = cssRuleBlockAt(lastColumnIndex);

    expect(firstColumnIndex).toBeGreaterThan(-1);
    expect(lastColumnIndex).toBeGreaterThan(firstColumnIndex);
    expect(firstColumnBlock).toContain('padding: 8px 16px 8px 24px');
    expect(lastColumnBlock).toContain('padding: 8px 24px 8px 16px');
  });

  it('keeps wide table scrollbars on the Vuexy card surface', () => {
    const scrollIndex = globalsCss.indexOf('.admin-table-scroll {');
    const scrollBlock = cssRuleBlockAt(scrollIndex);
    const scrollbarIndex = globalsCss.indexOf('.admin-table-scroll::-webkit-scrollbar {');
    const scrollbarTrackIndex = globalsCss.indexOf('.admin-table-scroll::-webkit-scrollbar-track {');
    const scrollbarThumbIndex = globalsCss.indexOf('.admin-table-scroll::-webkit-scrollbar-thumb {');
    const scrollbarBlock = cssRuleBlockAt(scrollbarIndex);
    const scrollbarTrackBlock = cssRuleBlockAt(scrollbarTrackIndex);
    const scrollbarThumbBlock = cssRuleBlockAt(scrollbarThumbIndex);

    expect(scrollIndex).toBeGreaterThan(-1);
    expect(scrollbarIndex).toBeGreaterThan(scrollIndex);
    expect(scrollbarTrackIndex).toBeGreaterThan(scrollbarIndex);
    expect(scrollbarThumbIndex).toBeGreaterThan(scrollbarTrackIndex);
    expect(scrollBlock).toContain('scrollbar-color: rgb(var(--admin-main-channel) / 0.28) transparent');
    expect(scrollbarBlock).toContain('height: 8px');
    expect(scrollbarTrackBlock).toContain('background: var(--admin-surface)');
    expect(scrollbarThumbBlock).toContain('background: rgb(var(--admin-main-channel) / 0.34)');
    expect(scrollbarThumbBlock).toContain('border-radius: 10px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
