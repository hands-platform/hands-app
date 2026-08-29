import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('GeneralLedgerDetailPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
  const css = readFileSync(join(__dirname, '../../../globals.css'), 'utf8');

  it('uses the shared Vuexy text link atom for journal evidence links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('renders durable operator evidence instead of a raw reversal actor id', () => {
    expect(source).toContain('batch.operatorEvidence');
    expect(source).toContain('Approval evidence unavailable');
    expect(source).toContain('System or historical record');
    expect(source).not.toContain("value={reversalEvidence.createdById ?? 'System or historical record'}");
    expect(source).not.toContain('No canonical approval field is recorded on this reversal.');
  });

  it('renders legacy provider journal source enums as Partner copy', () => {
    expect(source).toContain("part === 'provider' ? 'Partner'");
  });

  it('renders the stored disbursement reversal reference when journal metadata provides it', () => {
    expect(source).toContain('readPlainRecord(batch.metadata)?.reversalReference');
    expect(source).toContain('label="Reversal reference"');
  });

  it('keeps long journal identifiers intact inside a local horizontal overflow boundary', () => {
    expect(source).toContain('general-ledger-technical-id');
    expect(source).toContain('general-ledger-technical-token');
    expect(source).toContain('general-ledger-account-code');
    expect(css).toMatch(/\.general-ledger-technical-id\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.general-ledger-technical-id\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(css).toMatch(/\.general-ledger-account-code\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(css).toMatch(/\.general-ledger-technical-token\s*\{[^}]*white-space:\s*nowrap;/s);
  });
});
