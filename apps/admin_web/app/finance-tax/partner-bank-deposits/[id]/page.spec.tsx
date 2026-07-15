import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('PartnerBankDepositDetailPage evidence links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('shows the bank reconciliation state from the company bank cash journal debit', () => {
    expect(source).toContain("entry.accountCode === 'company_bank_cash'");
    expect(source).toContain('Bank reconciliation evidence');
    expect(source).toContain('/finance-tax/bank-reconciliation/');
    expect(source).toContain("match.status !== 'REVERSED'");
    expect(source).toContain("kind: remainingReconciliationAmount > 0 ? 'risk' : 'record'");
    expect(source).toContain('label="Bank transfer reference"');
    expect(source).toContain('Find or import bank transaction');
    expect(source).toContain("review: 'unmatched'");
  });

  it('renders request decisions and cash-debt allocation operators with hydrated identities', () => {
    expect(source).toContain('adminIdentityLabel(request.requestedBy, request.requestedByAdminId)');
    expect(source).toContain('adminIdentityLabel(request.approvedBy, request.approvedByAdminId)');
    expect(source).toContain('adminIdentityLabel(request.rejectedBy, request.rejectedByAdminId)');
    expect(source).toContain('adminIdentityLabel(allocation.allocatedBy, allocation.allocatedByAdminId)');
    expect(source).toContain('label="Approved & executed by"');
    expect(source).toContain('label="Decision reason"');
    expect(source).toContain('request.rejectedAt');
    expect(source).not.toContain('value={request.requestedByAdminId}');
    expect(source).not.toContain('<td>{allocation.allocatedByAdminId}</td>');
  });

  it('requires an explicit review dialog and audit reason before cash-debt allocation', () => {
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain('PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT');
    expect(source).toContain("confirm: 'allocate'");
    expect(source).toContain("name: 'notes'");
    expect(source).toContain('minLength: 12');
    expect(source).toContain("allocation.notes ?? 'No reason stored'");
    expect(source).not.toContain('<AdminFormShell action={allocatePartnerBankDepositCashDebt}>');
  });
});
