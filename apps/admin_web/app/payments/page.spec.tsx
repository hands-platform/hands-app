import { readFileSync } from 'node:fs';

const source = readFileSync('app/payments/page.tsx', 'utf8');

describe('PaymentsPage', () => {
  it('scopes payment KPI cards by live holds, pending work, selected range, and records', () => {
    expect(source).toContain('const paymentRangeScope = model.dateRangeLabel;');
    expect(source).toContain("scope: 'Live'");
    expect(source).toContain("scope: 'Pending'");
    expect(source).toContain('scope: paymentRangeScope');
    expect(source).toContain("scope: 'Needs action'");
    expect(source).toContain("scope: 'Delivery records'");
    expect(source).toContain("kind: 'live'");
    expect(source).toContain("kind: 'risk'");
    expect(source).toContain("kind: 'period'");
    expect(source).toContain("kind: 'record'");
  });

  it('does not use vague current view copy in payment KPI helper text', () => {
    expect(source).not.toContain('current view');
  });

  it('uses the bounded Finance approver directory instead of a free-text id for refunds', () => {
    expect(source).toContain("'/admin/users?take=50&role=ADMIN&view=finance-approver-directory'");
    expect(source).toContain('buildFinanceApproverOptions');
    expect(source).toContain("label: 'Separate Finance approver'");
    expect(source).toContain("options: [{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions]");
    expect(source).not.toContain("label: 'Approving admin id'");
    expect(source).not.toContain("placeholder: 'Different admin user id'");
  });
});
