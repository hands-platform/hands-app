import type { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildPolicySimulation, formatDistance } from './policy-simulation';

describe('policy simulation builder', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-13T03:00:00.000Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds ready simulator rows from nearby fresh online Partners', () => {
    const settings = [
      setting(OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes, 10),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 5000),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes, 30),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit, 2),
      setting(OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, 'IMMEDIATE_WITHIN_WINDOW'),
      setting(OPERATIONAL_POLICY_KEYS.preferredAcceptMode, 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'),
      setting(OPERATIONAL_POLICY_KEYS.partnerAlertChannel, 'FCM_FOR_ALL_BOOKINGS', {
        label: 'FCM for all bookings',
      }),
    ];
    const bookings = [
      {
        createdAt: '2026-06-13T02:55:00.000Z',
        id: 'booking-reference-123456',
        lat: 10.7769,
        lng: 106.7009,
      },
    ] as unknown as AdminBooking[];
    const providers = [
      provider({
        currentLat: 10.7869,
        currentLng: 106.7009,
        currentLocationUpdatedAt: '2026-06-13T02:55:00.000Z',
        displayName: 'Partner One',
        id: 'provider-1',
      }),
      provider({
        currentLat: 10.8969,
        currentLng: 106.7009,
        currentLocationUpdatedAt: '2026-06-13T02:55:00.000Z',
        displayName: 'Far Partner',
        id: 'provider-far',
      }),
    ];

    const simulation = buildPolicySimulation(settings, bookings, providers);

    expect(simulation.ready).toBe(true);
    expect(simulation.partnerRows).toHaveLength(1);
    expect(simulation.partnerRows[0]).toMatchObject({
      id: 'provider-1',
      locationAgeLabel: '5m ago',
      name: 'Partner One',
      pillClass: 'pill-success',
      status: 'Fresh',
    });
    expect(simulation.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Reference location', value: 'Booking booking-...3456' }),
        expect.objectContaining({
          helper: '1 visible partner(s), 1 fresh location(s).',
          label: 'Marketplace policy',
          value: '5 km',
        }),
        expect.objectContaining({
          helper: 'FCM push plus in-app listing for eligible partners.',
          label: 'Partner alert routing',
          value: 'FCM for all bookings',
        }),
      ]),
    );
  });

  it('marks the simulator blocked when no fresh eligible Partner is inside radius', () => {
    const simulation = buildPolicySimulation(
      [setting(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters, 1000)],
      [],
      [provider({ currentLat: 10.9, currentLng: 106.7, id: 'provider-far' })],
    );

    expect(simulation.ready).toBe(false);
    expect(simulation.partnerRows).toHaveLength(0);
    expect(simulation.checks[0]).toMatchObject({
      className: 'ops-task-blocked',
      status: 'Needs supply',
    });
  });

  it('formats simulator distance labels consistently', () => {
    expect(formatDistance(500)).toBe('500 m');
    expect(formatDistance(12345)).toBe('12.3 km');
  });
});

function setting(
  key: string,
  value: string | number,
  options?: { readonly label: string },
): AdminOperationalPolicySetting {
  return {
    category: 'Matching',
    enforced: true,
    key,
    label: key,
    value,
    options: options
      ? [
          {
            label: options.label,
            tradeoff: 'Test tradeoff.',
            value: String(value),
          },
        ]
      : null,
  } as AdminOperationalPolicySetting;
}

function provider(overrides: Partial<AdminProvider>): AdminProvider {
  return {
    currentLat: null,
    currentLng: null,
    currentLocationUpdatedAt: '2026-06-13T02:55:00.000Z',
    displayName: 'Partner',
    id: 'provider',
    status: 'ONLINE_AVAILABLE',
    ...overrides,
  } as AdminProvider;
}
