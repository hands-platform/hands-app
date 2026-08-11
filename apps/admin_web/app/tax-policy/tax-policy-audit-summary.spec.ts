import type { AdminAuditLog } from '../../lib/admin-api';
import { buildTaxPolicyAuditSummary } from './tax-policy-audit-summary';

describe('buildTaxPolicyAuditSummary', () => {
  it('summarizes policy and rule audit logs for operator review', () => {
    const summary = buildTaxPolicyAuditSummary([
      auditLog({
        action: 'tax_policy.update',
        actor: { fullName: 'Ops Lead', phone: '+84000000000' },
        createdAt: '2026-06-27T10:30:00.000Z',
        id: 'audit-policy',
        metadata: {
          approvalAdminId: 'finance-admin-2',
          deactivatedOtherActivePolicies: 1,
          operatorReason: 'Approved July withholding schedule.',
          status: 'ACTIVE',
        },
        target: 'tax_policy:policy-123456789',
      }),
      auditLog({
        action: 'tax_rule.create',
        createdAt: '2026-06-27T09:15:00.000Z',
        id: 'audit-rule',
        metadata: { policyVersionId: 'policy-123456789', rateBps: 500, scope: 'SERVICE_TYPE' },
        target: 'tax_rule:rule-abcdefghi',
      }),
      auditLog({
        action: 'booking.complete',
        createdAt: '2026-06-27T08:00:00.000Z',
        id: 'audit-other',
        target: 'booking:booking-1',
      }),
    ]);

    expect(summary.totalChangeCount).toBe(2);
    expect(summary.policyChangeCount).toBe(1);
    expect(summary.ruleChangeCount).toBe(1);
    expect(summary.rows).toEqual([
      {
        actionLabel: 'Policy updated',
        actorLabel: 'Ops Lead',
        createdAt: '2026-06-27T10:30:00.000Z',
        detail:
          'Status ACTIVE / 1 other active policy deactivated / Finance approval finance-... / Evidence: Approved July withholding schedule.',
        id: 'audit-policy',
        targetLabel: 'tax_policy:policy-1...',
        toneClassName: 'pill-success',
      },
      {
        actionLabel: 'Rule created',
        actorLabel: 'System',
        createdAt: '2026-06-27T09:15:00.000Z',
        detail: 'SERVICE_TYPE / 5%',
        id: 'audit-rule',
        targetLabel: 'tax_rule:rule-abc...',
        toneClassName: 'pill-info',
      },
    ]);
  });
});

function auditLog(overrides: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'tax_policy.update',
    createdAt: '2026-06-27T00:00:00.000Z',
    id: 'audit-1',
    target: 'tax_policy:policy-1',
    ...overrides,
  } as AdminAuditLog;
}
