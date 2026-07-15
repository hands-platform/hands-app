import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('BankReconciliationDetailPage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('uses the shared Vuexy text link atom for reconciliation evidence links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('accepts Partner deposit request evidence and links matched journals back to the deposit detail', () => {
    expect(source).toContain("{ label: 'Partner bank deposit request', value: 'partner-bank-deposit' }");
    expect(source).toContain("return 'partnerBankDepositRequestId';");
    expect(source).toContain('/finance-tax/partner-bank-deposits/');
    expect(source).toContain("entry.sourceType !== 'PROVIDER_BANK_DEPOSIT'");
  });

  it('offers approved ignore only for unmatched rows without clearing finance obligations', () => {
    expect(source).toContain("transaction.status === 'UNMATCHED' && !latestActiveMatch");
    expect(source).toContain('action={ignoreCompanyBankTransactionAction}');
    expect(source).toContain('title="Review ignored bank row"');
    expect(source).toContain('confirmLabel="Confirm ignore"');
    expect(source).toContain('/ignore`');
    expect(source).toContain('It does not settle Partner deposit, wallet, tax, or GL evidence.');
    expect(source).toContain('Separate Finance approver');
    expect(source).toContain('Ignore reason');
  });

  it('renders persisted reconciliation audit evidence instead of inferring it from the row status', () => {
    expect(source).toContain("readRecordString(record, 'auditAction')");
    expect(source).toContain("readRecordString(record, 'auditActorId')");
    expect(source).toContain("readRecordString(record, 'auditActorName')");
    expect(source).toContain("readRecordString(record, 'approvalAdminName')");
    expect(source).toContain("readRecordString(record, 'auditAt')");
    expect(source).toContain("Approved by {approverLabel}");
    expect(source).toContain("return 'Match created'");
    expect(source).toContain('<DateTimeText value={auditAt} />');
    expect(source).toContain("readRecordString(record, 'matchActorName')");
    expect(source).toContain("readRecordString(record, 'reversedByAdminName')");
    expect(source).toContain('Matched by {matchActorLabel}');
    expect(source).toContain('Match approved by {matchApproverLabel}');
    expect(source).toContain('Reversed by {reversedByLabel}');
    expect(source).toContain('Reversal approved by {reversalApproverLabel}');
    expect(source).toContain('Reversal reason: {reversalReason}');
  });

  it('shows bank row import and ignore operators from persisted evidence', () => {
    expect(source).toContain('label="Imported by"');
    expect(source).toContain('label="Import approved by"');
    expect(source).toContain('transaction.creationEvidence.importedBy');
    expect(source).toContain('transaction.creationEvidence.approvalAdmin');
    expect(source).toContain("label: 'Ignored by'");
    expect(source).toContain('transaction.ignoreEvidence?.ignoredBy');
    expect(source).toContain('transaction.ignoreEvidence?.approvalAdmin');
  });

  it('offers ranked PAID withdrawal candidates without automatic matching', () => {
    expect(source).toContain('Recommended withdrawal match');
    expect(source).toContain('A candidate is never matched automatically.');
    expect(source).toContain("transaction.type === 'OUTFLOW'");
    expect(source).toContain('withdrawalCandidates.map');
    expect(source).toContain('<input name="sourceType" type="hidden" value="withdrawal" />');
    expect(source).toContain('confirmLabel="Confirm withdrawal match"');
    expect(source).toContain('A different Finance approver is still required.');
    expect(source).toContain('withdrawalCandidateEvidence');
  });

  it('renders persisted review owner changes as a bounded SLA timeline', () => {
    expect(source).toContain('buildBankReconciliationAssignmentTimeline(transaction.assignmentHistory)');
    expect(source).toContain('title="Review owner history"');
    expect(source).toContain('<AdminBasicTimeline');
    expect(source).toContain("{ label: 'Assigned by', value: assignment.assignedByLabel }");
    expect(source).toContain("{ label: 'Previous owner', value: assignment.previousAssigneeLabel }");
    expect(source).toContain("{ label: 'SLA elapsed', value: assignment.elapsedLabel }");
    expect(source).toContain('No review owner has been assigned.');
  });

  it('reuses the protected review assignment API from a confirmation dialog', () => {
    expect(source).toContain("'/admin/users?take=50&role=ADMIN&view=finance-approver-directory'");
    expect(source).toContain("confirmAction === 'review-owner'");
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain("currentAssignment ? 'Reassign owner' : 'Assign owner'");
    expect(source).toContain("name: 'assigneeAdminId'");
    expect(source).toContain("name: 'reason'");
    expect(source).toContain('/review-assignment`');
    expect(source).toContain('isConfirmedBankReconciliationAction');
    expect(source).toContain("from '../bank-reconciliation-review-owner-model'");
  });

  it('requires a second review step and matching transaction evidence for money-changing actions', () => {
    expect(source).toContain('BankReconciliationConfirmationDisclosure');
    expect(source).toContain("from '../bank-reconciliation-confirmation-disclosure'");
    expect(source).toContain('name="confirmationBankTransactionId"');
    expect(source).toContain('title="Review payment clearing match"');
    expect(source).toContain('title="Review advanced source match"');
    expect(source).toContain('title="Review match reversal"');
    expect(source).toContain('BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH');
    expect(source).toContain('matchError=confirmation-required');
    expect(source).toContain('reverseError=confirmation-required');
    expect(source).toContain('ignoreError=confirmation-required');
    expect(source).toContain('buildFinanceApproverOptions');
    expect(source).toContain("options={[{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions]}");
    expect(source).not.toContain('Approving admin ID');
  });
});
