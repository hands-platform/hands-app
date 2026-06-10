import type { AdminProvider } from '../../lib/admin-api';
import {
  buildPartnerPushDeviceActionConfirmation,
  partnerPushDeviceActionConfirmHref,
  readPartnerPushDeviceConfirmationAction,
} from './partner-push-device-action-confirmation';

const providers = [
  {
    id: 'partner-push-123456',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    user: {
      pushDevices: [
        { id: 'push-disabled-123456', enabled: false, platform: 'android' },
        { id: 'push-enabled-123456', enabled: true, platform: 'ios' },
      ],
    },
  },
] as readonly AdminProvider[];

describe('partner push device action confirmation', () => {
  it('builds a re-enable confirmation for a disabled Partner push device', () => {
    const confirmation = buildPartnerPushDeviceActionConfirmation(
      providers,
      'enable-device',
      'push-disabled-123456',
    );

    expect(confirmation).toEqual({
      action: 'enable-device',
      cancelHref: '/partners',
      confirmLabel: 'Re-enable device',
      description:
        'Re-enable android push device push-dis for Partner Linh Wellness after token health or operator confirmation is reviewed.',
      disabled: false,
      hiddenInputs: [{ name: 'pushDeviceId', value: 'push-disabled-123456' }],
      pushDeviceId: 'push-disabled-123456',
      title: 'Re-enable device push-dis?',
      tone: 'danger',
    });
  });

  it('disables confirmation when the device is already enabled', () => {
    const confirmation = buildPartnerPushDeviceActionConfirmation(
      providers,
      'enable-device',
      'push-enabled-123456',
    );

    expect(confirmation?.description).toBe('Push device is already enabled.');
    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.tone).toBe('neutral');
  });

  it('returns null for unsupported actions or missing devices', () => {
    expect(buildPartnerPushDeviceActionConfirmation(providers, null, 'push-disabled-123456')).toBeNull();
    expect(buildPartnerPushDeviceActionConfirmation(providers, 'enable-device', 'missing')).toBeNull();
  });

  it('reads supported actions and encodes confirmation URLs', () => {
    expect(readPartnerPushDeviceConfirmationAction('enable-device')).toBe('enable-device');
    expect(readPartnerPushDeviceConfirmationAction('retry')).toBeNull();
    expect(partnerPushDeviceActionConfirmHref('push device 1')).toBe(
      '/partners?pushAction=enable-device&pushDeviceId=push%20device%201',
    );
  });
});
