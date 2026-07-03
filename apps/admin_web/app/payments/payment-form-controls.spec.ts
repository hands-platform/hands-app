import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('payment cash debt form controls', () => {
  it('keeps payment cash debt settlement forms on shared AdminForm atoms', () => {
    const detailPageSource = readFileSync(
      join(process.cwd(), 'app/payments/[id]/page.tsx'),
      'utf8',
    );
    const presenterSource = readFileSync(
      join(process.cwd(), 'app/payments/payment-page-presenters.tsx'),
      'utf8',
    );

    expect(detailPageSource).toContain('AdminFormInput');
    expect(detailPageSource).toContain('AdminFormControlButton');
    expect(presenterSource).toContain('AdminFormInput');
    expect(presenterSource).toContain('AdminFormControlButton');
    expect(detailPageSource).toContain('<details className="admin-disclosure">');
    expect(presenterSource).toContain('<details className="admin-disclosure admin-mt-8">');
    expect(detailPageSource).not.toContain('aria-label="Cash fee settlement reference"');
    expect(presenterSource).not.toContain('aria-label="Cash debt settlement reference"');
    expect(detailPageSource).not.toContain('<button type="submit">Settle cash fee debt</button>');
    expect(presenterSource).not.toContain('<button type="submit">Settle cash debt</button>');
  });
});
