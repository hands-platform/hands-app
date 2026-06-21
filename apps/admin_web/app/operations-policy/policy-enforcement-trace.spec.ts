import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildPolicyEnforcementTrace } from './policy-enforcement-trace';

describe('policy enforcement trace', () => {
  it('describes live API and server enforcement from current policy settings', () => {
    const settings = [
      { key: OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, value: 12 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, value: 15000 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, value: 45 },
      { key: OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, value: 'DELAYED_UNTIL_FIRST_PICK_EXPIRES' },
      { key: OPERATIONAL_POLICY_KEYS.preferredAcceptMode, value: 'AUTO_ASSIGN_AFTER_ACCEPT' },
      { key: OPERATIONAL_POLICY_KEYS.walletNegativeGate, value: 'BLOCK_MARKETPLACE_PARTICIPATION' },
    ] as AdminOperationalPolicySetting[];

    const trace = buildPolicyEnforcementTrace(settings);

    expect(trace).toHaveLength(6);
    expect(trace.map((row) => row.scope)).toEqual([
      'Booking create',
      'Marketplace participation',
      'Location gate',
      'Customer choice',
      'Marketplace timing',
      'Wallet gate',
    ]);
    expect(trace[0]).toMatchObject({
      title: '12 minute first-pick timer',
      api: 'POST /customer/bookings',
      server: 'BookingsService.createBooking -> MatchingService.openBooking',
    });
    expect(trace[1]).toMatchObject({
      title: '15 km marketplace alert policy',
      server: 'Marketplace eligibility pipeline -> visibility check -> booking-address radius gate',
    });
    expect(trace[2]).toMatchObject({
      title: '45 minute location freshness',
      detail:
        'Partners with stale or missing last location are flagged before distance-sensitive marketplace matching and shown as dispatch checks.',
    });
    expect(trace[3].title).toBe('Customer final selection policy conflict');
    expect(trace[4].title).toBe('Legacy delayed value normalized to immediate marketplace');
    expect(trace[5]).toMatchObject({
      title: 'Negative wallet gates final acceptance and service start',
      detail:
        'Cash-service company fee debt is enforced before final acceptance, service start, and payout release.',
      api: 'Partner final acceptance, service start, and admin payout batch endpoints',
    });
    expect(trace.map((row) => `${row.api} ${row.server}`).join(' ')).not.toContain('/provider');
    expect(trace.map((row) => `${row.api} ${row.server}`).join(' ')).not.toContain('select-provider');
  });
});
