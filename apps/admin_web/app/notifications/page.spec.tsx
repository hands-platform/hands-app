import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('notifications page access wiring', () => {
  const source = readFileSync(join(process.cwd(), 'app/notifications/page.tsx'), 'utf8');

  it('gates FCM diagnostics behind Developer/System operator access', () => {
    expect(source).toContain('getCurrentAdminOperatorAccess');
    expect(source).toContain('canViewAdminDeveloperSystem');
    expect(source).toContain('filterNotificationActionConfirmationSupportingLinks');
    expect(source).toContain('const confirmation = filterNotificationActionConfirmationSupportingLinks(');
    expect(source).toContain('canViewDiagnostics={canViewDiagnostics}');
    expect(source).toContain("requestedDiagnosticsMode === 'full' && canViewDiagnostics");
    expect(source).not.toContain("const diagnosticsMode = readSearchParam(params.diagnostics) === 'full' ? 'full' : 'compact';");
  });

  it('keeps system incident review separate from push delivery diagnostics', () => {
    expect(source).toContain("const isSystemIncidentReview = model.filters.review === 'system-incidents';");
    expect(source).toContain("const isFinanceOverdueReview = model.filters.review === 'finance-overdue';");
    expect(source).toContain("const isFinanceOverdueHistory = model.filters.review === 'finance-overdue-history';");
    expect(source).toContain('const visibleNotificationFilterLinks = isFinanceOverdueReview || isFinanceOverdueHistory');
    expect(source).toContain("link.review === 'finance-overdue-history'");
    expect(source).toContain('isSystemIncidentReview || isFinanceOverdueReview || isFinanceOverdueHistory');
    expect(source).toContain('{!isOperationalReview ? (');
    expect(source).toContain('Review open, recovered, and legacy Admin system incidents');
    expect(source).toContain('exceeded the 48-hour review SLA');
    expect(source).toContain('retained as audit history');
  });

  it('builds Finance owner workload filters from server summary and current operator access', () => {
    expect(source).toContain('notificationSummary?.financeReviewOwnerSummary');
    expect(source).toContain('findCurrentFinanceOwner(financeOwners, operatorAccess)');
    expect(source).toContain('buildFinanceOwnerLinks(model.filters, currentFinanceOwner?.id ?? null, ownerCounts)');
    expect(source).toContain('My reviews (');
    expect(source).toContain('Unassigned (');
    expect(source).toContain('financeOwnerLinks={financeOwnerLinks}');
  });

  it('wires audited Finance review ownership actions and explicit result notices', () => {
    expect(source).toContain('financeAssigneeAdminId: currentFinanceOwner?.id');
    expect(source).toContain('financeAssigneeOptions');
    expect(source).toContain("confirmation.action === 'assign-finance-review'");
    expect(source).toContain('? assignFinanceReview');
    expect(source).toContain('Finance review owner updated.');
    expect(source).toContain('Finance review assignment failed.');
    expect(source).toContain('selectInputs={confirmation.selectInputs}');
  });
});
