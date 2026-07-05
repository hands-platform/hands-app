import type { ActionMenuItem } from '../../../components/action-menu';
import {
  buildPartnerDeviceRows,
  buildPartnerSessionRows,
  buildPartnerSharedDeviceRows,
  displaySessionCheckText,
} from './partner-detail-device-session-model';

describe('partner detail device session model', () => {
  it('maps partner app devices with masked ids and provided actions', () => {
    const action: ActionMenuItem = {
      href: '/partners/1?deviceAction=block',
      kind: 'link',
      label: 'Block device',
    };

    expect(
      buildPartnerDeviceRows(
        {
          devices: [
            {
              appVersion: '1.2.3',
              blockReason: 'duplicate login',
              blockedAt: '2026-06-13T03:15:00.000Z',
              deviceId: 'device-abcdef-123456',
              enabled: true,
              id: 'device-1',
              lastSeenAt: '2026-06-13T03:16:00.000Z',
              platform: 'android',
            },
          ],
          id: 'provider-1',
        },
        () => [action],
      ),
    ).toEqual([
      expect.objectContaining({
        actionLabel: expect.stringContaining('Device actions for'),
        actions: [action],
        blockReason: 'duplicate login',
        blockedAt: '2026-06-13T03:15:00.000Z',
        id: 'device-1',
        lastSeenAt: '2026-06-13T03:16:00.000Z',
        statusLabel: 'BLOCKED',
        title: expect.stringContaining('devi'),
      }),
    ]);
    const [row] = buildPartnerDeviceRows(
      {
        devices: [
          {
            appVersion: '1.2.3',
            blockReason: 'duplicate login',
            blockedAt: '2026-06-13T03:15:00.000Z',
            deviceId: 'device-abcdef-123456',
            enabled: true,
            id: 'device-1',
            lastSeenAt: '2026-06-13T03:16:00.000Z',
            platform: 'android',
          },
        ],
        id: 'provider-1',
      },
      () => [action],
    );
    expect(row.detail).not.toContain('13 Jun 2026');
  });

  it('limits partner sessions and neutralizes risky wording in session notes', () => {
    const rows = buildPartnerSessionRows({
      id: 'provider-1',
      sessions: Array.from({ length: 7 }, (_, index) => ({
        appVersion: '2.0.0',
        deviceId: `session-device-${index}`,
        id: `session-${index}`,
        ipAddress: '127.0.0.1',
        lastSeenAt: '2026-06-13T03:16:00.000Z',
        loggedInAt: '2026-06-13T03:00:00.000Z',
        suspicious: index === 0,
        suspiciousReason: index === 0 ? 'Suspicious fraud misuse' : null,
      })),
    });

    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      id: 'session-0',
      lastSeenAt: '2026-06-13T03:16:00.000Z',
      loggedInAt: '2026-06-13T03:00:00.000Z',
      sessionNote: 'session check account review account review',
      statusLabel: 'CHECK',
    });
    expect(rows[0].detail).not.toContain('13 Jun 2026');
    expect(displaySessionCheckText('trusted partner abuse controls')).toBe(
      'active partner account controls',
    );
  });

  it('maps shared device matches with partner identity evidence', () => {
    const rows = buildPartnerSharedDeviceRows({
      id: 'provider-1',
      sharedDeviceMatches: [
        {
          blockedAt: null,
          deviceId: 'shared-device-123456',
          enabled: false,
          id: 'match-1',
          lastSeenAt: '2026-06-13T03:16:00.000Z',
          platform: 'android',
          providerProfile: {
            displayName: 'Other Provider',
            id: 'provider-2',
            user: { phone: '+84000000002' },
          },
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        detail: expect.stringContaining('Other Partner'),
        id: 'match-1',
        lastSeenAt: '2026-06-13T03:16:00.000Z',
        smallLabel: 'Disabled',
        title: expect.stringContaining('shar'),
      }),
    ]);
    expect(rows[0].detail).not.toContain('Provider');
    expect(rows[0].detail).not.toContain('13 Jun 2026');
  });
});
