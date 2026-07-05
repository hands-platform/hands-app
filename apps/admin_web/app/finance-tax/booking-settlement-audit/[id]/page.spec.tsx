import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('BookingSettlementAuditDetailPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('uses the shared Vuexy text link atom for settlement audit evidence links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });
});
