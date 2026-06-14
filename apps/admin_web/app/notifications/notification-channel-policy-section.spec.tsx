import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { classNamesIn, hrefsIn, normalizedText } from './notification-section-test-utils';

describe('NotificationChannelPolicySection', () => {
  it('renders partner alert routing policy and channel counts', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 7,
      fcmDeliveries: 2,
      fcmSmokeReadiness: fcmSmokeReadiness(),
      latestFcmSentAttemptLabel: '13 Jun 2026, 17:09',
      latestFcmSentDetail: 'Customer +84900000001 / android / Payment Updated notifica / device push-dev',
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
      'Customer +84900000001 / android / Payment Updated notifica / device push-dev',
    );
    expect(rendered).toContain('Live preflight ready');
    expect(rendered).toContain('Payment Updated notifica');
    expect(rendered).toContain('FCM_SMOKE_NOTIFICATION_ID="notification-row-123456"');
    expect(rendered).toContain('Credential issue: check setup.');
    expect(rendered).toContain('Disabled tokens');
    expect(rendered).toContain('Stale tokens');
    expect(rendered).toContain('Worker queue');
    expect(rendered).toContain(
      'After live push, rerun preflight and confirm retryAuditPreflight.evidence before broad FCM push.',
    );
    expect(rendered).toContain('Audit evidence');
    expect(rendered).toContain('Verify disabled or reinstalled app tokens before broad FCM push.');
    expect(rendered).toContain('npm.cmd run fcm:token-recovery-smoke');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-policy',
        '/setup#notifications',
        '/notifications?review=disabled-device',
        '/notifications?review=stale-device',
        '/notifications?review=pending',
        '/audit-log?bucket=Notification&q=notification-row-123456&range=all',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['command-copy-row', 'ops-task-card', 'pill pill-warn']),
    );
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

    expect(normalizedText(section)).toContain('No FCM SENT delivery recorded yet.');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-neutral']));
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
        preflightCommand:
          '$env:FCM_SMOKE_ROLE="PROVIDER"; $env:FCM_SMOKE_PHONE="+84900000002"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; $env:FCM_SMOKE_NOTIFICATION_ID="notification-earning"; npm.cmd run fcm:push-smoke -- --preflight',
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
      latestFcmSentDetail: 'Customer +84900000001 / android / Payment Updated notifica / device push-dev',
      partnerAlertCount: 1,
      partnerAlertSmokeFallback: null,
      policyLabel: 'FCM for all bookings',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Device warning');
    expect(rendered).toContain('Newer Customer android device device-new is disabled');
  });
});

function fcmSmokeReadiness(
  overrides: Partial<Parameters<typeof NotificationChannelPolicySection>[0]['fcmSmokeReadiness']> = {},
): Parameters<typeof NotificationChannelPolicySection>[0]['fcmSmokeReadiness'] {
  return {
    detail: 'Customer +84900000001 can reuse the enabled android device for preflight without sending FCM.',
    deviceWarningLabel: null,
    latestAttemptLabel: '13 Jun 2026, 17:09',
    preflightCommand:
      '$env:FCM_SMOKE_ROLE="CUSTOMER"; $env:FCM_SMOKE_PHONE="+84900000001"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; $env:FCM_SMOKE_NOTIFICATION_ID="notification-row-123456"; npm.cmd run fcm:push-smoke -- --preflight',
    pushDeviceLabel: 'android push-dev',
    selectedNotificationId: 'notification-row-123456',
    selectedNotificationLabel: 'Payment Updated notifica',
    status: 'ready',
    statusLabel: 'Live preflight ready',
    ...overrides,
  };
}
