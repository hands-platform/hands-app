import type { AdminProvider } from '../../lib/admin-api';
import { DEFAULT_PROVIDER_OPS_POLICY, providerLocationStatus } from './partner-list-ops';

describe('partner list ops policy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the 90 minute low-cost location stale threshold by default', () => {
    const now = new Date('2026-06-07T10:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    expect(DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes).toBe(90);
    expect(
      providerLocationStatus(partnerAt('2026-06-07T08:31:00.000Z'), DEFAULT_PROVIDER_OPS_POLICY),
    ).toBe('recent');
    expect(
      providerLocationStatus(partnerAt('2026-06-07T08:29:00.000Z'), {
        ...DEFAULT_PROVIDER_OPS_POLICY,
        expiredLocationHours: 24,
      }),
    ).toBe('stale');
  });
});

function partnerAt(currentLocationUpdatedAt: string): AdminProvider {
  return {
    currentLat: 10.7769,
    currentLng: 106.7009,
    currentLocationUpdatedAt,
    id: `partner-${currentLocationUpdatedAt}`,
  } as AdminProvider;
}
