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

  it('removes the partial client-side disbursement slice and routes it to authoritative workspaces', () => {
    expect(source).not.toContain("q: 'reversal'");
    expect(source).not.toContain('.slice(0, 10)');
    expect(source).toContain('Related Partner Money reversals');
    expect(source).toContain('/payouts?view=reconciliation');
    expect(source).toContain('source=PROVIDER_PAYOUT_BATCH');
    expect(source).toContain('source=PROVIDER_WITHDRAWAL');
  });
});
