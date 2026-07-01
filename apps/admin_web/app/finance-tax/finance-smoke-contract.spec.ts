import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('finance admin smoke contract', () => {
  it('checks Finance list pages and their first detail routes', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/admin-web-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('/finance-tax/payment-clearing');
    expect(scriptSource).toContain('/finance-tax/general-ledger');
    expect(scriptSource).toContain('/finance-tax/bank-reconciliation');
    expect(scriptSource).toContain('runFinanceDetailRouteSmoke');
    expect(scriptSource).toContain('Payment Clearing Detail');
    expect(scriptSource).toContain('General Ledger Detail');
    expect(scriptSource).toContain('Bank Reconciliation Detail');
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/payment-clearing'), 'finance-tax/payment-clearing')");
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/general-ledger'), 'finance-tax/general-ledger')");
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/bank-reconciliation'), 'finance-tax/bank-reconciliation')");
  });
});
