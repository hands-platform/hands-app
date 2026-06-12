import {
  bookingLocationCheckFlagsFromFacts,
  bookingLocationNeedsOpsFromFacts,
  bookingLocationNeedsOpsFromProvider,
  bookingLocationTrail,
  hasProviderCoordinate,
  isPreferredAwaitingDecision,
  providerLocationFreshnessFromTimestamp,
} from './booking-status-location-helpers';

describe('booking status location helpers', () => {
  it('treats a preferred partner with no participant status as awaiting decision', () => {
    expect(isPreferredAwaitingDecision({ hasPreferredPartner: true, preferredParticipantStatus: null })).toBe(
      true,
    );
  });

  it('stops waiting when the preferred participant accepted, selected, or rejected', () => {
    for (const preferredParticipantStatus of ['ACCEPTED', 'SELECTED', 'REJECTED']) {
      expect(
        isPreferredAwaitingDecision({
          hasPreferredPartner: true,
          preferredParticipantStatus,
        }),
      ).toBe(false);
    }
  });

  it('keeps waiting for an undecided preferred participant', () => {
    expect(
      isPreferredAwaitingDecision({
        hasPreferredPartner: true,
        preferredParticipantStatus: 'JOINED',
      }),
    ).toBe(true);
  });

  it('uses API final selection before local preferred participant status', () => {
    expect(
      isPreferredAwaitingDecision({
        finalSelection: 'FIRST_PICK_PENDING',
        hasPreferredPartner: false,
        preferredParticipantStatus: 'REJECTED',
      }),
    ).toBe(true);

    expect(
      isPreferredAwaitingDecision({
        finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
        hasPreferredPartner: true,
        preferredParticipantStatus: 'JOINED',
      }),
    ).toBe(false);

    expect(
      isPreferredAwaitingDecision({
        finalSelection: 'FIRST_PICK_ACCEPTED',
        hasPreferredPartner: true,
        preferredParticipantStatus: null,
      }),
    ).toBe(false);
  });

  it('returns explicit booking snapshots before falling back to latest provider location', () => {
    const explicitSnapshot = { id: 'snapshot-1' };
    const latestPartnerSnapshot = { id: 'snapshot-2' };

    expect(bookingLocationTrail([explicitSnapshot], latestPartnerSnapshot)).toEqual([
      explicitSnapshot,
    ]);
  });

  it('falls back to the latest provider location when explicit snapshots are missing', () => {
    const latestPartnerSnapshot = { id: 'snapshot-2' };

    expect(bookingLocationTrail([], latestPartnerSnapshot)).toEqual([latestPartnerSnapshot]);
  });

  it('returns an empty trail when neither explicit snapshots nor latest location exist', () => {
    expect(bookingLocationTrail([], null)).toEqual([]);
  });

  it('detects usable partner coordinate pairs from numeric or string coordinates', () => {
    expect(hasProviderCoordinate({ currentLat: 10.7769, currentLng: 106.7009 })).toBe(true);
    expect(hasProviderCoordinate({ currentLat: '10.7769', currentLng: '106.7009' })).toBe(true);
    expect(hasProviderCoordinate({ currentLat: null, currentLng: '106.7009' })).toBe(false);
    expect(hasProviderCoordinate({ currentLat: 'not-a-number', currentLng: '106.7009' })).toBe(false);
  });

  it('classifies partner location freshness from the last update timestamp', () => {
    const now = new Date('2026-06-07T10:00:00.000Z').getTime();

    expect(providerLocationFreshnessFromTimestamp('2026-06-07T09:45:00.000Z', now)).toBe('recent');
    expect(providerLocationFreshnessFromTimestamp('2026-06-07T09:20:00.000Z', now)).toBe('stale');
    expect(providerLocationFreshnessFromTimestamp('2026-06-06T08:00:00.000Z', now)).toBe('expired');
    expect(providerLocationFreshnessFromTimestamp(null, now)).toBe('missing');
    expect(providerLocationFreshnessFromTimestamp('bad-date', now)).toBe('missing');
  });

  it('requires operations location review only for live handoff states with missing or stale location', () => {
    expect(
      bookingLocationNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        hasProviderLocation: false,
        providerLocationFreshness: 'missing',
      }),
    ).toBe(false);
    expect(
      bookingLocationNeedsOpsFromFacts({
        status: 'PROVIDER_ON_THE_WAY',
        hasProviderLocation: false,
        providerLocationFreshness: 'missing',
      }),
    ).toBe(true);
    expect(
      bookingLocationNeedsOpsFromFacts({
        status: 'IN_SERVICE',
        hasProviderLocation: true,
        providerLocationFreshness: 'stale',
      }),
    ).toBe(true);
    expect(
      bookingLocationNeedsOpsFromFacts({
        status: 'ARRIVED',
        hasProviderLocation: true,
        providerLocationFreshness: 'recent',
      }),
    ).toBe(false);
  });

  it('builds location check flags from live handoff facts', () => {
    expect(
      bookingLocationCheckFlagsFromFacts({
        status: 'PROVIDER_ON_THE_WAY',
        hasProviderLocation: false,
        providerLocationFreshness: 'missing',
      }),
    ).toEqual([{ severity: 'medium', title: 'No partner location record' }]);

    expect(
      bookingLocationCheckFlagsFromFacts({
        status: 'ARRIVED',
        hasProviderLocation: true,
        providerLocationFreshness: 'stale',
      }),
    ).toEqual([{ severity: 'medium', title: 'Partner location is stale' }]);

    expect(
      bookingLocationCheckFlagsFromFacts({
        status: 'OPEN_MATCHING',
        hasProviderLocation: false,
        providerLocationFreshness: 'missing',
      }),
    ).toEqual([]);
  });

  it('derives live handoff location review from the selected partner coordinate and timestamp', () => {
    const now = new Date('2026-06-07T10:00:00.000Z').getTime();

    expect(
      bookingLocationNeedsOpsFromProvider({
        status: 'PROVIDER_ON_THE_WAY',
        provider: {
          currentLat: '10.7769',
          currentLng: '106.7009',
          currentLocationUpdatedAt: '2026-06-07T09:45:00.000Z',
        },
        nowMs: now,
      }),
    ).toBe(false);

    expect(
      bookingLocationNeedsOpsFromProvider({
        status: 'ARRIVED',
        provider: {
          currentLat: '10.7769',
          currentLng: '106.7009',
          currentLocationUpdatedAt: '2026-06-07T09:20:00.000Z',
        },
        nowMs: now,
      }),
    ).toBe(true);

    expect(
      bookingLocationNeedsOpsFromProvider({
        status: 'IN_SERVICE',
        provider: {
          currentLat: null,
          currentLng: '106.7009',
          currentLocationUpdatedAt: '2026-06-07T09:45:00.000Z',
        },
        nowMs: now,
      }),
    ).toBe(true);

    expect(
      bookingLocationNeedsOpsFromProvider({
        status: 'MATCHED',
        provider: null,
        nowMs: now,
      }),
    ).toBe(false);
  });
});
