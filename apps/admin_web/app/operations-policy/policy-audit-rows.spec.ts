import type { AdminAuditLog } from '../../lib/admin-api';
import { operationalPolicyAuditRows } from './policy-audit-rows';

describe('operations policy audit row builder', () => {
  it('reads the API before/after metadata contract and exposes operator context', () => {
    const rows = operationalPolicyAuditRows([
      {
        action: 'operational_policy.update',
        actor: { fullName: 'Ops Lead' },
        createdAt: '2026-06-13T03:05:00.000Z',
        id: 'audit-policy-1',
        policyDefinition: { category: 'Notification delivery', label: 'Partner alert channel' },
        metadata: {
          enforced: true,
          key: 'notification.partner_alert_channel',
          before: 'IN_APP_WITH_PUSH_LATER',
          after: 'FCM_FOR_ALL_BOOKINGS',
          environment: 'production',
          reason: 'FCM rollout',
          source: 'operator',
        },
        target: 'operational_policy:notification.partner_alert_channel',
      },
    ]);

    expect(rows[0]).toMatchObject({
      key: 'notification.partner_alert_channel',
      label: 'Partner alert channel',
      policyContext: 'Notification delivery',
      previousValue: 'In App With Push Later',
      reason: 'FCM rollout',
      value: 'FCM For All Bookings',
      source: 'operator',
    });
  });

  it('keeps legacy previousValue/value audit rows readable', () => {
    const rows = operationalPolicyAuditRows([
      auditLog({
        metadata: {
          key: 'matching.provider_response_window_minutes',
          previousValue: 10,
          value: 12,
        },
      }),
    ]);

    expect(rows[0]).toMatchObject({ previousValue: '10', value: '12' });
  });

  it('normalizes raw policy keys inside audit reasons', () => {
    const rows = operationalPolicyAuditRows([
      {
        action: 'operational_policy.update',
        actor: { fullName: 'Ops Lead' },
        createdAt: '2026-06-13T03:05:00.000Z',
        id: 'audit-policy-2',
        metadata: {
          enforced: true,
          key: 'matching.marketplace_open_mode',
          reason: 'Automated smoke coverage for matching.marketplace_open_mode',
        },
        target: 'operational_policy:matching.marketplace_open_mode',
      },
    ]);

    expect(rows[0]?.reason).toBe('Automated smoke coverage for Matching / marketplace open mode');
  });

  it('humanizes internal enum values in policy audit rows', () => {
    const rows = operationalPolicyAuditRows([
      {
        action: 'operational_policy.update',
        actor: { fullName: 'Ops Lead' },
        createdAt: '2026-06-13T03:05:00.000Z',
        id: 'audit-policy-3',
        metadata: {
          key: 'decision.admin_fee_after_match',
          previousValue: 'ADMIN_FEE_REVIEW_AFTER_MATCH',
          value: 'ADMIN_REVIEW_FOR_MVP',
        },
        target: 'operational_policy:decision.admin_fee_after_match',
      },
    ]);

    expect(rows[0]).toMatchObject({
      previousValue: 'Admin Fee Review After Match',
      value: 'Admin Review For MVP',
    });
  });

  it('preserves trusted source metadata and classifies missing metadata as legacy unknown', () => {
    const logs = [
      auditLog({
        id: 'operator-row',
        metadata: { key: 'matching.provider_response_window_minutes', source: 'operator' },
      }),
      auditLog({
        id: 'smoke-row',
        metadata: {
          environment: 'test',
          key: 'matching.provider_response_window_minutes',
          restoration: true,
          runId: 'run-123',
          source: 'automated_smoke',
        },
      }),
    ];

    expect(operationalPolicyAuditRows(logs).map((row) => row.source)).toEqual([
      'operator',
      'automated_smoke',
    ]);
    expect(operationalPolicyAuditRows([logs[1]!])[0]).toMatchObject({
      environment: 'test',
      id: 'smoke-row',
      restoration: true,
      runId: 'run-123',
      source: 'automated_smoke',
    });
    expect(operationalPolicyAuditRows([auditLog({ id: 'legacy-row' })])[0]?.source).toBe('legacy_unknown');
  });

  it('sorts server-filtered audit rows newest first without client-side truncation', () => {
    const rows = operationalPolicyAuditRows(
      Array.from({ length: 10 }, (_, index) =>
        auditLog({
          createdAt: `2026-06-13T03:${String(index).padStart(2, '0')}:00.000Z`,
          id: `audit-policy-${index}`,
        }),
      ),
    );

    expect(rows).toHaveLength(10);
    expect(rows[0]?.id).toBe('audit-policy-9');
    expect(rows.at(-1)?.id).toBe('audit-policy-0');
  });
});

function auditLog(overrides: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'operational_policy.update',
    createdAt: '2026-06-13T03:00:00.000Z',
    id: 'audit-policy',
    metadata: { key: 'matching.provider_response_window_minutes' },
    target: 'operational_policy:matching.provider_response_window_minutes',
    ...overrides,
  };
}
