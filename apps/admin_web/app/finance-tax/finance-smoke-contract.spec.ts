import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('finance admin smoke contract', () => {
  it('checks Finance list pages and their first detail routes', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/admin-web-smoke.mjs'), 'utf8');

    expect(scriptSource).toContain('/cash-settlements');
    expect(scriptSource).toContain('/cash-settlements?view=full');
    expect(scriptSource).toContain('Open full operations view');
    expect(scriptSource).toContain('Cash settlement execution desk');
    expect(scriptSource).toContain('/finance-overview');
    expect(scriptSource).toContain('Finance Priority Desk');
    expect(scriptSource).toContain('Core Finance KPI');
    expect(scriptSource).toContain("'/finance-tax',");
    expect(scriptSource).toContain('Tax finance operating model');
    expect(scriptSource).toContain('Finance operations priority desk');
    expect(scriptSource).toContain('Finance tax workspaces');
    expect(scriptSource).toContain('/finance-tax/payment-clearing');
    expect(scriptSource).toContain('/finance-tax/general-ledger');
    expect(scriptSource).toContain('/finance-tax/bank-reconciliation');
    expect(scriptSource).toContain('/finance-tax/booking-settlement-audit');
    expect(scriptSource).toContain('/finance-tax/coupon-finance');
    expect(scriptSource).toContain('/finance-tax/settlement-reversals');
    expect(scriptSource).toContain('/finance-tax/monthly-tax-closing');
    expect(scriptSource).toContain('/finance-tax/platform-vat');
    expect(scriptSource).toContain('/finance-tax/payment-fees');
    expect(scriptSource).toContain('/finance-tax/partner-withholding-tax');
    expect(scriptSource).toContain('/finance-tax/finance-approvers');
    expect(scriptSource).toContain('Finance approver directory');
    expect(scriptSource).toContain('Dual-control guard');
    expect(scriptSource).toContain('Booking settlement records');
    expect(scriptSource).toContain('Coupon settlement rows');
    expect(scriptSource).toContain('Settlement reversal rows');
    expect(scriptSource).toContain('Stored monthly closing rows');
    expect(scriptSource).toContain('VAT rate breakdown');
    expect(scriptSource).toContain('Fees by payment method');
    expect(scriptSource).toContain('Partner monthly withholding rows');
    expect(scriptSource).toContain('runFinanceDetailRouteSmoke');
    expect(scriptSource).toContain('Payment Clearing Detail');
    expect(scriptSource).toContain('Clearing evidence hub');
    expect(scriptSource).toContain('General Ledger Detail');
    expect(scriptSource).toContain('Journal evidence hub');
    expect(scriptSource).toContain('Bank Reconciliation Detail');
    expect(scriptSource).toContain('Bank evidence hub');
    expect(scriptSource).toContain('Booking Settlement Audit Detail');
    expect(scriptSource).toContain('Settlement Reversal Detail');
    expect(scriptSource).toContain("smokePath: '/finance-tax/settlement-reversals'");
    expect(scriptSource).toContain("listPath: '/finance-tax/settlement-reversals?range=all'");
    expect(scriptSource).toContain('shouldRunDeepSection(target.smokePath ?? target.listPath)');
    expect(scriptSource).toContain('Settlement record overview');
    expect(scriptSource).toContain('Settlement evidence hub');
    expect(scriptSource).toContain('Accounting amount breakdown');
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/payment-clearing'), 'finance-tax/payment-clearing')");
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/general-ledger'), 'finance-tax/general-ledger')");
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/bank-reconciliation'), 'finance-tax/bank-reconciliation')");
    expect(scriptSource).toContain("firstDetailPath(pageBodies.get('/finance-tax/booking-settlement-audit'), 'finance-tax/booking-settlement-audit')");
    expect(scriptSource).toContain("routePrefix: 'finance-tax/settlement-reversals'");
    expect(scriptSource).toContain('ADMIN_WEB_SMOKE_DIRECT_PAGES');
    expect(scriptSource).toContain('parseDirectSmokePages');
    expect(scriptSource).toContain('runDirectSmoke');
    expect(scriptSource).toContain('visibleTextFromHtml(body)');
    expect(scriptSource).toContain('directSmokePages.map((page) => page.path)');
    expect(scriptSource).toContain('path must be a local admin route');
  });

  it('connects the CASH lifecycle to direct Finance evidence page assertions', () => {
    const scriptSource = readFileSync(
      resolve(root, 'infra/scripts/cash-booking-lifecycle-smoke.mjs'),
      'utf8',
    );

    expect(scriptSource).toContain("process.argv.includes('--admin-evidence')");
    expect(scriptSource).toContain('verifyAdminWebEvidence');
    expect(scriptSource).toContain('Partner Bank Deposit Detail');
    expect(scriptSource).toContain('General Ledger Detail');
    expect(scriptSource).toContain('Bank Reconciliation Detail');
    expect(scriptSource).toContain('Match approved by Cash Booking Smoke Finance Approver');
    expect(scriptSource).toContain('runAdminWebDirectSmoke');
    expect(scriptSource).toContain('settlementAuditLinked');
    expect(scriptSource).toContain('openPeriodRefundJournalLinked');
  });

  it('connects online payment clearing and reversal evidence to authenticated Admin details', () => {
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/payment-lifecycle-smoke.mjs'), 'utf8');
    const helperSource = readFileSync(
      resolve(root, 'infra/scripts/lib/admin-web-direct-smoke.mjs'),
      'utf8',
    );

    expect(scriptSource).toContain("process.argv.includes('--admin-evidence')");
    expect(scriptSource).toContain('Payment Clearing Detail');
    expect(scriptSource).toContain('Booking Settlement Audit Detail');
    expect(scriptSource).toContain('Settlement Reversal Detail');
    expect(scriptSource).toContain('paymentClearingLinked');
    expect(scriptSource).toContain('runAdminWebDirectSmoke');
    expect(helperSource).toContain('ADMIN_WEB_SMOKE_DIRECT_PAGES');
    expect(helperSource).toContain("stdio: 'inherit'");
  });

  it('connects Provider wallet withdrawal paid closeout to GL and bank reconciliation evidence', () => {
    const scriptSource = readFileSync(
      resolve(root, 'infra/scripts/provider-wallet-withdrawal-lifecycle-smoke.mjs'),
      'utf8',
    );

    expect(scriptSource).toContain("process.argv.includes('--admin-evidence')");
    expect(scriptSource).toContain('lockJournalImmutable');
    expect(scriptSource).toContain('paidJournalBalanced');
    expect(scriptSource).toContain('withdrawalRequestId');
    expect(scriptSource).toContain('accountingJournalEntryId');
    expect(scriptSource).toContain('General Ledger Detail');
    expect(scriptSource).toContain('Bank Reconciliation Detail');
    expect(scriptSource).toContain('runAdminWebDirectSmoke');
  });
});
