import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NotificationChannelPolicySection } from './notification-channel-policy-section';
import { classNamesIn, hrefsIn, normalizedText } from './notification-section-test-utils';

describe('NotificationChannelPolicySection', () => {
  it('renders only operator-facing routing status and observed channel activity', () => {
    const section = NotificationChannelPolicySection({
      canViewDiagnostics: false,
      inAppDeliveries: 7,
      fcmDeliveries: 2,
      policyLabel: 'In-app first',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Partner alert routing policy');
    expect(rendered).toContain('Current decision: In-app first');
    expect(rendered).toContain('In-app route observed');
    expect(rendered).toContain('Mobile push route observed');
    expect(rendered).not.toContain('FCM');
    expect(rendered).not.toContain('smoke');
    expect(rendered).not.toContain('preflight');
    expect(rendered).not.toContain('token recovery');
    expect(hrefsIn(section)).toEqual(['/operations-policy']);
  });

  it('uses neutral status when no delivery was observed in the selected range', () => {
    const section = NotificationChannelPolicySection({
      inAppDeliveries: 0,
      fcmDeliveries: 0,
      policyLabel: 'In-app only',
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('No in-app activity in range');
    expect(rendered).toContain('No mobile push activity in range');
    expect(classNamesIn(section)).toContain('pill pill-neutral');
  });

  it('routes Developer/System viewers to the existing setup workspace', () => {
    const section = NotificationChannelPolicySection({
      canViewDiagnostics: true,
      inAppDeliveries: 1,
      fcmDeliveries: 0,
      policyLabel: 'In-app first',
    });

    expect(normalizedText(section)).toContain('Open Developer setup');
    expect(hrefsIn(section)).toContain('/setup?commands=all#notifications');
    expect(hrefsIn(section)).not.toContain('/notifications?diagnostics=full');
  });

  it('does not embed FCM smoke commands in the operator notification component', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-channel-policy-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('FCM_TOKEN_RECOVERY_SMOKE_COMMAND');
    expect(source).not.toContain('CommandCopyRow');
    expect(source).not.toContain('NotificationFcmSmokeReadiness');
    expect(source).not.toContain('diagnostics=full');
  });
});
