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

  it('keeps table pagination footers on the Vuexy TablePagination rhythm', () => {
    const footerIndex = globalsCss.indexOf('.vuexy-booking-table-footer {');
    const footerBlock = cssRuleBlockAt(footerIndex);
    const summaryIndex = globalsCss.indexOf('.vuexy-booking-pagination-summary {');
    const summaryBlock = cssRuleBlockAt(summaryIndex);
    const pageLinkIndex = globalsCss.indexOf('.vuexy-booking-page-link {');
    const pageLinkBlock = cssRuleBlockAt(pageLinkIndex);

    expect(footerIndex).toBeGreaterThan(-1);
    expect(footerBlock).toContain('flex-wrap: wrap');
    expect(footerBlock).toContain('gap: 8px');
    expect(footerBlock).toContain('padding: 12px 24px');
    expect(footerBlock).not.toContain('gap: 18px');
    expect(summaryIndex).toBeGreaterThan(footerIndex);
    expect(summaryBlock).toContain('color: var(--admin-disabled)');
    expect(summaryBlock).toContain('font-size: 15px');
    expect(pageLinkBlock).toContain('font-weight: 500');
    expect(pageLinkBlock).not.toContain('font-weight: 700');
  });

  it('keeps table-owned empty rows quiet instead of rendering a nested framed box', () => {
    const emptyCellIndex = globalsCss.indexOf('.table.vuexy-data-table td.admin-data-table-empty-cell {');
    const emptyCellBlock = cssRuleBlockAt(emptyCellIndex);
    const emptyIndex = globalsCss.indexOf('.admin-data-table-empty {');
    const emptyBlock = cssRuleBlockAt(emptyIndex);
    const emptyMessageIndex = globalsCss.indexOf('.admin-data-table-empty .muted {');
    const emptyMessageBlock = cssRuleBlockAt(emptyMessageIndex);

    expect(emptyCellIndex).toBeGreaterThan(-1);
    expect(emptyCellBlock).toContain('padding: 24px');
    expect(emptyCellBlock).toContain('text-align: center');
    expect(emptyIndex).toBeGreaterThan(emptyCellIndex);
    expect(emptyBlock).toContain('display: grid');
    expect(emptyBlock).toContain('gap: 4px');
    expect(emptyBlock).toContain('justify-items: center');
    expect(emptyBlock).toContain('min-height: 54px');
    expect(emptyBlock).not.toContain('border:');
    expect(emptyBlock).not.toContain('border-radius');
    expect(emptyBlock).not.toContain('dashed');
    expect(emptyMessageIndex).toBeGreaterThan(emptyIndex);
    expect(emptyMessageBlock).toContain('font-size: 0.8125rem');
    expect(emptyMessageBlock).toContain('line-height: 1.45');
    expect(emptyMessageBlock).toContain('margin: 0');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
