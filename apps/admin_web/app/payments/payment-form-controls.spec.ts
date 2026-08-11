import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('payment cash debt evidence links', () => {
  it('keeps cash debt settlement mutations out of Payments', () => {
    const detailPageSource = readFileSync(
      join(process.cwd(), 'app/payments/[id]/page.tsx'),
      'utf8',
    );
    const actionsSource = readFileSync(
      join(process.cwd(), 'app/payments/actions.ts'),
      'utf8',
    );

    expect(detailPageSource).toContain('AdminEmptyState');
    expect(detailPageSource).toContain('AdminDisclosure');
    expect(detailPageSource).toContain('Review exact earning in Cash Settlements');
    expect(detailPageSource).toContain('Search Partner deposit evidence');
    expect(detailPageSource).toContain('/cash-settlements?review=${earningId}&q=${earningId}');
    expect(detailPageSource).toContain('/finance-tax/partner-bank-deposits?q=${encodeURIComponent(partnerId)}');
    expect(detailPageSource).not.toContain('<details className="admin-disclosure">');
    expect(detailPageSource).not.toContain('aria-label="Cash fee settlement reference"');
    expect(detailPageSource).not.toContain('<strong>No retained messages</strong>');
    expect(detailPageSource).not.toContain('<button type="submit">Settle cash fee debt</button>');
    expect(actionsSource).not.toContain('settleCashDebt');
    expect(actionsSource).not.toContain('/admin/cash-settlements');
  });
});
