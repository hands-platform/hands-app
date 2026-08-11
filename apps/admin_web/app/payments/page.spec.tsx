import { readFileSync } from 'node:fs';

const source = readFileSync('app/payments/page.tsx', 'utf8');

describe('PaymentsPage', () => {
  it('sets the Payments document title', () => {
    expect(source).toContain("title: { absolute: 'Payments | HANDS Admin' }");
  });

  it('keeps the first viewport focused on executable payment decisions', () => {
    expect(source).toContain("label: 'Capture ready'");
    expect(source).toContain("label: 'Release recommended'");
    expect(source).toContain("label: 'Evidence conflicts'");
    expect(source).toContain("label: 'Active cash'");
    expect(source).not.toContain("label: 'Needs action'");
    expect(source).not.toContain("label: 'Authorized'");
    expect(source).not.toContain('PaymentCallbackAttemptLedgerSection');
  });

  it('fails closed when totals or payment records cannot be loaded', () => {
    expect(source).toContain('adminGetResult<AdminPayment[]>');
    expect(source).toContain('Payment totals unavailable');
    expect(source).toContain('Payment records unavailable');
    expect(source).toContain('No action controls are rendered from fallback data.');
  });

  it('submits server-owned action evidence without exposing an approver selector', () => {
    expect(source).toContain("{ name: 'idempotencyKey', value: confirmation.idempotencyKey }");
    expect(source).toContain("{ name: 'policyVersion', value: confirmation.policyVersion }");
    expect(source).toContain("label: 'Operator reason'");
    expect(source).not.toContain('approvalAdminId');
    expect(source).not.toContain('finance-approver-directory');
  });

  it('preserves the current queue when opening confirmation or retrying', () => {
    expect(source).toContain('const currentHref = buildPaymentPageHref(filters, filters.page);');
    expect(source).toContain('const returnTo = paymentReturnTo');
    expect(source).toContain('action={<AdminTextLink href={currentHref}>Retry payment records</AdminTextLink>}');
  });
});
