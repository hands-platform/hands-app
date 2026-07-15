import type { AdminProvider } from '../../../lib/admin-api';
import {
  buildPartnerDeviceActionConfirmation,
  partnerDeviceActionConfirmHref,
  readPartnerDeviceConfirmationAction,
} from './partner-detail-device-action-confirmation';

const partner = {
  id: 'partner-detail-123456',
  displayName: 'Linh Wellness',
  status: 'ONLINE_AVAILABLE',
  devices: [
    {
      id: 'device-row-123456',
      deviceId: 'android-device-token-123456',
      enabled: true,
      platform: 'android',
    },
    {
      id: 'blocked-device-123456',
      blockedAt: '2026-06-01T00:00:00.000Z',
      deviceId: 'ios-device-token-123456',
      enabled: false,
      platform: 'ios',
    },
  ],
} as AdminProvider;

describe('partner detail device action confirmation', () => {
  it('builds a block confirmation with a required reason', () => {
    const confirmation = buildPartnerDeviceActionConfirmation(partner, 'block-device', 'device-row-123456');

    expect(confirmation).toEqual({
      action: 'block-device',
      cancelHref: '/partners/partner-detail-123456?section=access&access=diagnostics#app-activity',
      confirmLabel: 'Block device',
      description:
        'Block Partner device andr...3456 for Linh Wellness. This prevents the device from being trusted for Partner app activity.',
      disabled: false,
      hiddenInputs: [
        { name: 'providerId', value: partner.id },
        { name: 'providerDeviceId', value: 'device-row-123456' },
      ],
      providerDeviceId: 'device-row-123456',
      providerId: partner.id,
      textInputs: [
        {
          label: 'Reason',
          maxLength: 500,
          minLength: 12,
          name: 'reason',
          placeholder: 'Device block reason',
          required: true,
        },
      ],
      title: 'Block device device-r?',
      tone: 'danger',
    });
  });

  it('builds an unblock confirmation for a blocked or disabled device', () => {
    const confirmation = buildPartnerDeviceActionConfirmation(
      partner,
      'unblock-device',
      'blocked-device-123456',
    );

    expect(confirmation?.confirmLabel).toBe('Unblock device');
    expect(confirmation?.disabled).toBe(false);
    expect(confirmation?.textInputs).toEqual([]);
    expect(confirmation?.tone).toBe('warning');
  });

  it('disables block or unblock when the current device state already matches', () => {
    expect(
      buildPartnerDeviceActionConfirmation(partner, 'block-device', 'blocked-device-123456')?.disabled,
    ).toBe(true);
    expect(
      buildPartnerDeviceActionConfirmation(partner, 'unblock-device', 'device-row-123456')?.disabled,
    ).toBe(true);
  });

  it('returns null for unsupported actions or missing devices', () => {
    expect(buildPartnerDeviceActionConfirmation(partner, null, 'device-row-123456')).toBeNull();
    expect(buildPartnerDeviceActionConfirmation(partner, 'block-device', 'missing')).toBeNull();
  });

  it('reads supported actions and encodes confirmation URLs', () => {
    expect(readPartnerDeviceConfirmationAction('block-device')).toBe('block-device');
    expect(readPartnerDeviceConfirmationAction('unblock-device')).toBe('unblock-device');
    expect(readPartnerDeviceConfirmationAction('delete-device')).toBeNull();
    expect(partnerDeviceActionConfirmHref('partner 1', 'block-device', 'device 1')).toBe(
      '/partners/partner%201?access=diagnostics&deviceAction=block-device&providerDeviceId=device+1&section=access',
    );
  });
});
