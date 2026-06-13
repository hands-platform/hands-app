import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { classNamesIn, hrefsIn, normalizedText } from './notification-section-test-utils';

describe('NotificationChannelPolicySection', () => {
  it('renders partner alert routing policy and channel counts', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 7,
      fcmDeliveries: 2,
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
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/operations-policy']));
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['ops-task-card', 'pill pill-warn']));
  });

  it('uses a neutral FCM badge when no FCM push deliveries exist', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 3,
      fcmDeliveries: 0,
      partnerAlertCount: 3,
      partnerAlertSmokeFallback: null,
      policyLabel: 'In-app only',
    });

    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-neutral']));
  });

  it('shows the suggested non partner-alert smoke id when partner-alert policy blocks FCM', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 4,
      fcmDeliveries: 3,
      partnerAlertCount: 2,
      partnerAlertSmokeFallback: {
        detail: 'Use FCM_SMOKE_NOTIFICATION_ID=notification-earning for the same Partner/phone FCM smoke preflight.',
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
});
