import type { AdminProvider } from '../../lib/admin-api';
import {
  partnerSecurityPillClass,
  partnerSecurityStatus,
  sharedPartnerDeviceIds,
} from './partner-security-facts';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-001',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    ...input,
  } as AdminProvider;
}

function device(input: { id: string; deviceId: string; blockedAt?: string | null }) {
  return {
    platform: 'android',
    enabled: true,
    blockedAt: null,
    ...input,
  };
}

describe('partner security facts', () => {
  it('prioritizes account blocks before device or session facts', () => {
    expect(
      partnerSecurityStatus(
        partner({
          blockedAt: '2026-05-21T08:00:00.000Z',
          devices: [device({ id: 'device-1', deviceId: 'phone-1' })],
          sessions: [{ id: 'session-1', suspicious: true }],
        }),
      ),
    ).toBe('account-blocked');
  });

  it('identifies blocked devices, suspicious sessions, shared devices, missing devices, and clear partners', () => {
    expect(
      partnerSecurityStatus(
        partner({
          devices: [
            device({
              id: 'device-1',
              deviceId: 'phone-1',
              blockedAt: '2026-05-21T08:00:00.000Z',
            }),
          ],
        }),
      ),
    ).toBe('blocked');

    expect(
      partnerSecurityStatus(partner({ sessions: [{ id: 'session-1', suspicious: true }] })),
    ).toBe('session-check');

    expect(
      partnerSecurityStatus(
        partner({
          devices: [device({ id: 'device-1', deviceId: 'phone-1' })],
          sharedDeviceMatches: [device({ id: 'shared-1', deviceId: 'phone-1' })],
        }),
      ),
    ).toBe('shared');

    expect(partnerSecurityStatus(partner())).toBe('missing');

    expect(
      partnerSecurityStatus(
        partner({
          devices: [device({ id: 'device-1', deviceId: 'phone-1' })],
          sessions: [{ id: 'session-1', suspicious: false }],
        }),
      ),
    ).toBe('clear');
  });

  it('returns shared device ids and matching pill classes', () => {
    expect(
      Array.from(
        sharedPartnerDeviceIds(
          partner({
            sharedDeviceMatches: [
              device({ id: 'shared-1', deviceId: 'phone-1' }),
              device({ id: 'shared-2', deviceId: '' }),
              device({ id: 'shared-3', deviceId: 'phone-2' }),
            ],
          }),
        ),
      ),
    ).toEqual(['phone-1', 'phone-2']);

    expect(partnerSecurityPillClass('clear')).toBe('pill-success');
    expect(partnerSecurityPillClass('missing')).toBe('pill-neutral');
    expect(partnerSecurityPillClass('blocked')).toBe('pill-danger');
  });
});
