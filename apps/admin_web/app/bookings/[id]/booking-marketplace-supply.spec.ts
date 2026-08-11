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

  it('keeps internal Partner status values out of operator copy', () => {
    const supply = bookingMarketplacePartnerSupply(
      booking(),
      [partner({ status: 'ONLINE_BUSY', verification: { status: 'DRAFT' } })],
      [],
    );

    expect(supply.rows[0]).toMatchObject({
      status: 'Busy with a booking',
      blockers: expect.arrayContaining([
        'verification Profile draft',
        'status Busy with a booking',
      ]),
    });
  });

  it('reports the evaluated total while limiting detailed supply rows to eight', () => {
    const partners = Array.from({ length: 40 }, (_, index) =>
      partner({
        displayName: `Partner ${index + 1}`,
        id: `partner-${index + 1}`,
        status: 'ONLINE_BUSY',
      }),
    );

    const supply = bookingMarketplacePartnerSupply(booking(), partners, []);

    expect(supply.evaluatedCount).toBe(40);
    expect(supply.eligibleCount).toBe(0);
    expect(supply.rows).toHaveLength(8);
  });
});
