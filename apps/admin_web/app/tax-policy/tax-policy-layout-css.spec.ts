import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

describe('Tax Policy layout CSS', () => {
  it('keeps the compact policy status title and detail visually separated', () => {
    const selector = '.tax-policy-compact-status .admin-notice-card-message {';
    const index = globalsCss.indexOf(selector);
    const block = cssRuleBlockAt(index);

    expect(index).toBeGreaterThan(-1);
    expect(block).toContain('display: grid');
    expect(block).toContain('gap: 4px 12px');
    expect(block).toContain('grid-template-columns: max-content minmax(0, 1fr)');
  });

  it('stacks primary and supporting history evidence within each table cell', () => {
    const selector = '.tax-policy-history-section .admin-data-table :is(th, td) > :is(strong, small) {';
    const index = globalsCss.indexOf(selector);
    const block = cssRuleBlockAt(index);
    const cellSelector = '.tax-policy-history-section .admin-data-table :is(th, td) {';
    const cellIndex = globalsCss.indexOf(cellSelector);
    const cellBlock = cssRuleBlockAt(cellIndex);
    const pillSelector = '.tax-policy-history-section .admin-data-table .pill {';
    const pillIndex = globalsCss.indexOf(pillSelector);
    const pillBlock = cssRuleBlockAt(pillIndex);

    expect(index).toBeGreaterThan(-1);
    expect(block).toContain('display: block');
    expect(block).toContain('white-space: normal');
    expect(cellIndex).toBeGreaterThan(-1);
    expect(cellBlock).toContain('white-space: normal');
    expect(pillIndex).toBeGreaterThan(-1);
    expect(pillBlock).toContain('white-space: normal');
  });

  it('keeps production draft helpers grouped with their controls and hash targets visible below sticky tabs', () => {
    expect(globalsCss).toContain('.tax-policy-field-group {');
    expect(globalsCss).toContain('.tax-policy-field-group.is-wide {');
    expect(globalsCss).toContain('.tax-policy-audit-event {');
    expect(globalsCss).toContain('scroll-margin-top: 96px');
  });

  it('keeps filtered integrity evidence and its action in a five-column desktop table', () => {
    expect(globalsCss).toContain('.tax-policy-integrity-queue .admin-data-table {');
    expect(globalsCss).toContain('table-layout: fixed');
    expect(globalsCss).toContain('.tax-policy-integrity-queue .admin-data-table :is(th, td):nth-child(5)');
    expect(globalsCss).toContain('.tax-policy-integrity-queue .admin-data-table :is(th, td, code, .pill) {');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
