import { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';

function booking(overrides = {}) {
  return {
    id: 'booking-1',
    lat: 10.7769,
    lng: 106.7009,
    addressSnapshot: {
      latitude: 10.7769,
      longitude: 106.7009,
      source: 'booking_confirmation',
      createdAt: '2026-06-07T00:00:00.000Z',
    },
    participants: [],
    preferredProviderId: null,
    selectedProviderId: null,
    ...overrides,
  } as never;
}

function partner(overrides = {}) {
  return {
    id: 'partner-1',
    displayName: 'Linh Wellness',
    status: 'ONLINE_AVAILABLE',
    currentLat: 10.777,
    currentLng: 106.701,
    currentLocationUpdatedAt: '2026-06-07T00:00:00.000Z',
    verification: { status: 'APPROVED' },
    earnings: [],
    ...overrides,
  } as never;
}

describe('booking marketplace supply', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-07T00:05:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps negative-wallet partners visible while marking the final gate hold', () => {
    const supply = bookingMarketplacePartnerSupply(
      booking(),
      [
        partner({
          earnings: [{ netAmount: -120000 }],
        }),
      ],
      [],
    );

    expect(supply.eligibleCount).toBe(0);
    expect(supply.rows).toHaveLength(1);
    expect(supply.policyPin).toMatchObject({
      label: 'Service address record saved',
      source: 'BookingAddressSnapshot',
    });
    expect(JSON.stringify(supply)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
    expect(supply.rows[0]).toMatchObject({
      blockers: expect.arrayContaining(['final gate settlement required']),
      eligible: false,
      name: 'Linh Wellness',
    });
    expect(supply.excludedGroups.find((group) => group.label === 'Wallet settlement required')).toBeUndefined();
    expect(supply.metrics.find((metric) => metric.label === 'Wallet gate boundary')).toMatchObject({
      value: 'Final gate only',
      helper: expect.stringContaining('stay visible'),
    });
  });
});
