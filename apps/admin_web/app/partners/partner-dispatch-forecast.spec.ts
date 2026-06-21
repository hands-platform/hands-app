import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY } from './partner-list-ops';
import { buildPartnerDispatchForecast } from './partner-dispatch-forecast';

function partner(input: Partial<AdminProvider>): AdminProvider {
  return {
    id: 'partner-1',
    displayName: 'Partner',
    status: 'OFFLINE',
    city: 'Ho Chi Minh City',
    verification: { id: 'verification-1', status: 'APPROVED' },
    ...input,
  } as AdminProvider;
}

describe('partner dispatch forecast', () => {
  it('summarizes ready supply, recoverable partners, blockers, and city lanes', () => {
    const ready = partner({
      id: 'ready',
      displayName: 'Ready Partner',
      status: 'ONLINE_AVAILABLE',
      city: 'Ho Chi Minh City',
    });
    const offline = partner({
      id: 'offline',
      displayName: 'Offline Partner',
      status: 'OFFLINE',
      city: 'Ho Chi Minh City',
    });
    const blocked = partner({
      id: 'blocked',
      displayName: 'Blocked Partner',
      status: 'ONLINE_AVAILABLE',
      city: 'Da Nang',
      verification: { id: 'verification-2', status: 'PENDING' },
    });

    const forecast = buildPartnerDispatchForecast(
      [ready, offline, blocked],
      DEFAULT_PROVIDER_OPS_POLICY,
      {
        dispatchReady: (item) => item.id === 'ready',
        hasHardAcceptanceBlocker: (item) => item.id === 'blocked',
      },
    );

    expect(forecast.totals.map((item) => [item.label, item.value])).toEqual([
      ['Ready now', '1/3'],
      ['Recoverable today', '1'],
      ['Online capacity', '2/2'],
      ['Hard blockers', '1'],
    ]);
    expect(forecast.totals.find((item) => item.label === 'Online capacity')?.detail).toContain(
      'identity and account gates',
    );
    expect(forecast.totals.find((item) => item.label === 'Hard blockers')?.detail).not.toContain('bank');
    expect(forecast.blockers.find((item) => item.label === 'Wallet setup')?.detail).toContain(
      'withdrawal/deposit follow-up',
    );
    expect(forecast.blockers.find((item) => item.label === 'Location refresh')).toMatchObject({
      count: 3,
      tone: 'warn',
    });
    expect(forecast.blockers.find((item) => item.label === 'Push alerts missing')).toMatchObject({
      count: 3,
      tone: 'warn',
    });
    expect(forecast.supplyLanes).toEqual([
      {
        city: 'Ho Chi Minh City',
        total: 2,
        ready: 1,
        online: 1,
        locationNeedsRefresh: 2,
        blocked: 0,
      },
      {
        city: 'Da Nang',
        total: 1,
        ready: 0,
        online: 1,
        locationNeedsRefresh: 1,
        blocked: 1,
      },
    ]);
  });
});
