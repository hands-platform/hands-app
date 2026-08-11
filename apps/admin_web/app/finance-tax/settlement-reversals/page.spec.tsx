import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('SettlementReversalsPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('uses the shared Vuexy text link atom for settlement reversal links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps the reversal queue compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Reversal command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('keeps list payloads light and routes full bank-return evidence to journal detail', () => {
    expect(source).toContain("q: 'reversal'");
    expect(source).toContain('Bank return evidence recorded');
    expect(source).toContain('Open reversal journal');
    expect(source).not.toContain('disbursementReversalEvidence');
  });
});
