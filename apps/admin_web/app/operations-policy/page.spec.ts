import type { AdminAuditLog } from '../../lib/admin-api';
import { operationalPolicyAuditRows } from './page';

describe('operations policy page model', () => {
  it('keeps raw policy keys internal while exposing an operator policy context', () => {
    const rows = operationalPolicyAuditRows([
      {
        action: 'operational_policy.update',
        actor: { fullName: 'Ops Lead' },
        createdAt: '2026-06-13T03:05:00.000Z',
        id: 'audit-policy-1',
        metadata: {
          enforced: true,
          key: 'notification.partner_alert_channel',
          previousValue: 'IN_APP_WITH_PUSH_LATER',
          reason: 'FCM rollout',
          value: 'FCM_FOR_ALL_BOOKINGS',
        },
        target: 'operational_policy:notification.partner_alert_channel',
      },
    ]);

    expect(rows[0]).toMatchObject({
      key: 'notification.partner_alert_channel',
      label: 'Notification / partner alert channel',
      policyContext: 'Controls partner booking alert delivery route',
      reason: 'FCM rollout',
    });
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
});
