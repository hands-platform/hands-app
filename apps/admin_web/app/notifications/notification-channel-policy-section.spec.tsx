import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { classNamesIn, hrefsIn, normalizedText } from './notification-section-test-utils';
import { buildFcmPushSmokeCommand } from './fcm-smoke-commands';

describe('NotificationChannelPolicySection', () => {
  it('renders partner alert routing policy and channel counts', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 7,
      fcmDeliveries: 2,
      fcmSmokeReadiness: fcmSmokeReadiness(),
      latestFcmSentAttemptLabel: '13 Jun 2026, 17:09',
      latestFcmSentDetail: 'Customer +84900000001 / android / Service Completed notifica / device push-dev',
      partnerAlertCount: 5,
      partnerAlertSmokeFallback: null,
      policyLabel: 'In-app first',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner alert routing policy');
    expect(rendered).toContain('Current decision: In-app first');
    expect(rendered).toContain('Partner booking alerts');
    expect(rendered).toContain('5');
    expect(rendered).toContain('In-app route');
    expect(rendered).toContain('7');
    expect(rendered).toContain('FCM route');
    expect(rendered).toContain('2');
    expect(rendered).toContain('Recent FCM SENT: 13 Jun 2026, 17:09');
    expect(rendered).toContain(
      'Customer +84900000001 / android / Service Completed notifica / device push-dev',
    );
    expect(rendered).toContain('Live preflight ready');
    expect(rendered).toContain('Service Completed notifica');
    expect(rendered).toContain('FCM_SMOKE_NOTIFICATION_ID="notification-row-123456"');
    expect(rendered).toContain(
      'After live push, rerun preflight and confirm retryAuditPreflight.evidence before broad FCM push.',
    );
    expect(rendered).toContain('Audit evidence');
    expect(rendered).not.toContain('Credential issue: check setup.');
    expect(rendered).not.toContain('Disabled tokens');
    expect(rendered).not.toContain('Stale tokens');
    expect(rendered).not.toContain('Worker queue');
    expect(rendered).not.toContain('Verify disabled or reinstalled app tokens before broad FCM push.');
    expect(rendered).not.toContain('npm.cmd run fcm:token-recovery-smoke');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-policy',
        '/audit-log?bucket=Notification&q=notification-row-123456&range=all',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section soft-card admin-mb-16',
        'ops-section-header admin-section-header',
        'command-copy-row',
        'ops-task-card',
        'pill pill-warn',
      ]),
    );
    expect(classNamesIn(section)).not.toContain('card soft-card admin-mb-16');
  });

  it('uses a neutral FCM badge when no FCM push deliveries exist', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 3,
      fcmDeliveries: 0,
      fcmSmokeReadiness: fcmSmokeReadiness({
        preflightCommand: null,
        selectedNotificationLabel: null,
        status: 'needs-notification',
        statusLabel: 'Needs FCM delivery',
      }),
      latestFcmSentAttemptLabel: null,
      latestFcmSentDetail: null,
      partnerAlertCount: 3,
      partnerAlertSmokeFallback: null,
      policyLabel: 'In-app only',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No FCM SENT delivery recorded yet.');
    expect(rendered).toContain('Credential issue: check setup.');
    expect(rendered).toContain('Disabled tokens');
    expect(rendered).toContain('Stale tokens');
    expect(rendered).toContain('Worker queue');
    expect(rendered).toContain('npm.cmd run fcm:token-recovery-smoke');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/setup#notifications',
        '/notifications?review=disabled-device',
        '/notifications?review=stale-device',
        '/notifications?review=pending',
      ]),
    );
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['empty-state', 'pill pill-neutral']));
  });

  it('shows the suggested standard notification smoke id when partner-alert policy blocks FCM', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 4,
      fcmDeliveries: 3,
      fcmSmokeReadiness: fcmSmokeReadiness(),
      latestFcmSentAttemptLabel: '13 Jun 2026, 17:09',
      latestFcmSentDetail: 'Partner +84900000002 / android / Earning Created notifica / device push-dev',
      partnerAlertCount: 2,
      partnerAlertSmokeFallback: {
        detail:
          'Use FCM_SMOKE_NOTIFICATION_ID=notification-earning for the same Partner/phone FCM smoke preflight.',
        partnerAlertNotificationId: 'notification-payout',
        partnerAlertType: 'provider.payout_batch.updated',
        partnerAlertTypeLabel: 'Partner Payout Batch Updated',
        preflightCommand: buildFcmPushSmokeCommand({
          notificationId: 'notification-earning',
          phone: '+84900000002',
          platform: 'android',
          preflight: true,
          role: 'PROVIDER',
          useRegisteredDevice: true,
        }),
        suggestedNotificationId: 'notification-earning',
        suggestedType: 'earning.created',
      },
      policyLabel: 'In-app first',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('FCM smoke fallback');
    expect(rendered).toContain('earning.created');
    expect(rendered).toContain('FCM_SMOKE_NOTIFICATION_ID=notification-earning');
    expect(rendered).toContain('npm.cmd run fcm:push-smoke -- --preflight');
    expect(rendered).toContain('Partner Payout Batch Updated');
    expect(rendered).not.toContain('provider.payout_batch.updated');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['command-copy-row']));
  });

  it('renders an FCM device warning when the reusable device is not the newest app device', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 1,
      fcmDeliveries: 4,
      fcmSmokeReadiness: fcmSmokeReadiness({
        deviceWarningLabel:
          'Newer Customer android device device-new is disabled; preflight reuses older enabled device device-old. Refresh the app FCM token before broad push.',
      }),
      latestFcmSentAttemptLabel: '13 Jun 2026, 17:09',
      latestFcmSentDetail: 'Customer +84900000001 / android / Service Completed notifica / device push-dev',
      partnerAlertCount: 1,
      partnerAlertSmokeFallback: null,
      policyLabel: 'FCM for all bookings',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Device warning');
    expect(rendered).toContain('Newer Customer android device device-new is disabled');
    expect(rendered).toContain('Credential issue: check setup.');
    expect(rendered).toContain('Disabled tokens');
  });

  it('uses shared badge atoms for channel policy pills and diagnosis links', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-channel-policy-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTaskCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('fcmSmokeReadinessTone');
    expect(source).not.toContain('<div className="ops-task-card"');
    expect(source).not.toContain('<span className="pill pill-info">Partner alerts {partnerAlertCount}</span>');
    expect(source).not.toContain('<span className="pill pill-success">In-app {inAppDeliveries}</span>');
    expect(source).not.toContain('<span className="pill pill-info">Partner booking alerts</span>');
    expect(source).not.toContain('<span className="pill pill-success">In-app route</span>');
    expect(source).not.toContain('<Link className="pill pill-neutral" href="/notifications?diagnostics=full">');
    expect(source).not.toContain('<Link className="pill pill-info" href="/setup#notifications">');
    expect(source).not.toContain('<span className="pill pill-warn">FCM smoke fallback</span>');
    expect(source).not.toContain('<div className="ops-task-grid"');
  });

  it('uses the shared AdminFormControlLink atom for policy actions', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-channel-policy-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });
});

function fcmSmokeReadiness(
  overrides: Partial<Parameters<typeof NotificationChannelPolicySection>[0]['fcmSmokeReadiness']> = {},
): Parameters<typeof NotificationChannelPolicySection>[0]['fcmSmokeReadiness'] {
  return {
    detail: 'Customer +84900000001 can reuse the enabled android device for preflight without sending FCM.',
    deviceWarningLabel: null,
    latestAttemptLabel: '13 Jun 2026, 17:09',
    preflightCommand: buildFcmPushSmokeCommand({
      notificationId: 'notification-row-123456',
      phone: '+84900000001',
      platform: 'android',
      preflight: true,
      role: 'CUSTOMER',
      useRegisteredDevice: true,
    }),
    pushDeviceLabel: 'android push-dev',
    selectedNotificationId: 'notification-row-123456',
    selectedNotificationLabel: 'Service Completed notifica',
    status: 'ready',
    statusLabel: 'Live preflight ready',
    ...overrides,
  };
}
