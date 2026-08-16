import {
  adminMarketingDateWhere,
  adminMarketingPreviousRangeWindow,
  adminMarketingRangeWindow,
  buildMarketingComparison,
  buildMarketingActionSummary,
  buildMarketingAttributionQuality,
  buildMarketingCampaignEfficiency,
  buildMarketingDecisionReadiness,
  buildMarketingDimensionRows,
  buildMarketingFunnel,
  buildMarketingInsights,
  buildMarketingRegionRows,
  buildMarketingSpendCoverage,
  canonicalMarketingCampaignKey,
  emptyMarketingStats,
  normalizeAdminMarketingRange,
  normalizeMarketingFunnelCohort,
  normalizeMarketingPlatform,
  normalizeMarketingSource,
  normalizeMarketingUnknownAttributionReason,
  withMarketingRates,
} from './admin-marketing-analytics';

describe('admin marketing analytics helpers', () => {
  const now = new Date('2026-06-22T10:20:30.000Z');

  it('normalizes supported ranges and keeps marketing ranges bounded', () => {
    expect(normalizeAdminMarketingRange(undefined)).toBe('7d');
    expect(normalizeAdminMarketingRange('today')).toBe('today');
    expect(normalizeAdminMarketingRange('yesterday')).toBe('yesterday');
    expect(normalizeAdminMarketingRange('7d')).toBe('7d');
    expect(normalizeAdminMarketingRange('30d')).toBe('30d');
    expect(normalizeAdminMarketingRange('all')).toBe('7d');

    expect(adminMarketingRangeWindow('today', now)).toMatchObject({
      range: 'today',
      label: 'Today',
      startAt: new Date('2026-06-21T17:00:00.000Z'),
      endAt: new Date('2026-06-22T17:00:00.000Z'),
    });
    expect(adminMarketingRangeWindow('30d', now)).toMatchObject({
      range: '30d',
      label: 'Last 30 days',
      startAt: new Date('2026-05-23T17:00:00.000Z'),
      endAt: new Date('2026-06-22T17:00:00.000Z'),
    });
    expect(adminMarketingDateWhere(adminMarketingRangeWindow('yesterday', now))).toEqual({
      gte: new Date('2026-06-20T17:00:00.000Z'),
      lt: new Date('2026-06-21T17:00:00.000Z'),
    });
  });

  it('normalizes unknown attribution reasons without accepting arbitrary values', () => {
    expect(normalizeMarketingUnknownAttributionReason('NO_CUSTOMER_SESSION')).toBe(
      'NO_CUSTOMER_SESSION',
    );
    expect(normalizeMarketingUnknownAttributionReason('UNSUPPORTED_SOURCE')).toBe(
      'UNSUPPORTED_SOURCE',
    );
    expect(normalizeMarketingUnknownAttributionReason('unexpected')).toBe(
      'NO_MARKETING_METADATA',
    );
  });

  it('compares today with the same elapsed Vietnam-time window yesterday', () => {
    const comparisonNow = new Date('2026-06-22T05:00:00.000Z');
    const window = adminMarketingRangeWindow('today', comparisonNow);

    expect(adminMarketingPreviousRangeWindow(window, comparisonNow)).toEqual({
      label: 'Yesterday by now',
      startAt: new Date('2026-06-20T17:00:00.000Z'),
      endAt: new Date('2026-06-21T05:00:00.000Z'),
    });
  });

  it.each([
    ['00:01', '2026-06-21T17:01:00.000Z', '2026-06-20T17:00:00.000Z', '2026-06-20T17:01:00.000Z'],
    ['12:00', '2026-06-22T05:00:00.000Z', '2026-06-20T17:00:00.000Z', '2026-06-21T05:00:00.000Z'],
    ['23:59', '2026-06-22T16:59:00.000Z', '2026-06-20T17:00:00.000Z', '2026-06-21T16:59:00.000Z'],
  ])('keeps Today comparison aligned at %s Vietnam time', (_, nowIso, startIso, endIso) => {
    const comparisonNow = new Date(nowIso);

    expect(
      adminMarketingPreviousRangeWindow(
        adminMarketingRangeWindow('today', comparisonNow),
        comparisonNow,
      ),
    ).toEqual({
      label: 'Yesterday by now',
      startAt: new Date(startIso),
      endAt: new Date(endIso),
    });
  });

  it.each([
    ['yesterday', 'Previous day', '2026-06-19T17:00:00.000Z', '2026-06-20T17:00:00.000Z'],
    ['7d', 'Previous 7 days', '2026-06-08T17:00:00.000Z', '2026-06-15T17:00:00.000Z'],
    ['30d', 'Previous 30 days', '2026-04-23T17:00:00.000Z', '2026-05-23T17:00:00.000Z'],
  ] as const)(
    'uses a non-overlapping equal-length previous window for %s',
    (range, label, startIso, endIso) => {
      expect(adminMarketingPreviousRangeWindow(adminMarketingRangeWindow(range, now), now)).toEqual({
        label,
        startAt: new Date(startIso),
        endAt: new Date(endIso),
      });
    },
  );

  it('builds finite previous-period deltas without inventing a percentage from zero', () => {
    const current = {
      ...emptyMarketingStats(),
      firstOpens: 10,
      signups: 2,
      bookingCompleted: 3,
      adSpend: 150_000,
      platformFeeRevenue: 240_000,
    };
    const previous = {
      ...emptyMarketingStats(),
      firstOpens: 8,
      signups: 0,
      bookingCompleted: 4,
      adSpend: 100_000,
      platformFeeRevenue: 300_000,
    };

    expect(buildMarketingComparison(current, previous, 'Previous 7 days')).toEqual({
      previousRangeLabel: 'Previous 7 days',
      firstOpens: { current: 10, previous: 8, delta: 2, deltaPercent: 25 },
      signups: { current: 2, previous: 0, delta: 2, deltaPercent: null },
      bookingCompleted: { current: 3, previous: 4, delta: -1, deltaPercent: -25 },
      adSpend: {
        current: 150_000,
        previous: 100_000,
        delta: 50_000,
        deltaPercent: 50,
      },
      platformFeeRevenue: {
        current: 240_000,
        previous: 300_000,
        delta: -60_000,
        deltaPercent: -20,
      },
    });
  });

  it('normalizes platform and source values without Android-only assumptions', () => {
    expect(normalizeMarketingPlatform('ANDROID')).toBe('android');
    expect(normalizeMarketingPlatform('ios-fcm')).toBe('ios');
    expect(normalizeMarketingPlatform('web')).toBe('web');
    expect(normalizeMarketingPlatform('random')).toBe('unknown');

    expect(normalizeMarketingSource('instagram-cpc')).toBe('meta');
    expect(normalizeMarketingSource('Google Ads')).toBe('google');
    expect(normalizeMarketingSource('referral_link')).toBe('referral');
    expect(normalizeMarketingSource('bad-channel')).toBe('unknown');
  });

  it('keeps conversion and cost metrics finite for empty data', () => {
    const stats = withMarketingRates(emptyMarketingStats());

    expect(stats.conversionRates.signupRate).toBe(0);
    expect(stats.conversionRates.cpi).toBeNull();
    expect(stats.conversionRates.cpa).toBeNull();
    expect(stats.conversionRates.cpaSignup).toBeNull();
    expect(stats.conversionRates.cpaBookingCreated).toBeNull();
    expect(stats.conversionRates.cpaBookingCompleted).toBeNull();
    expect(stats.conversionRates.roas).toBeNull();
    expect(stats.conversionRates.platformFeeRoas).toBeNull();
  });

  it('calculates spend efficiency from completed bookings and gross booking value', () => {
    const stats = withMarketingRates({
      ...emptyMarketingStats(),
      firstOpens: 100,
      signups: 20,
      bookingCreated: 10,
      bookingCompleted: 4,
      grossBookingValue: 2_000_000,
      platformFeeRevenue: 400_000,
      adSpend: 1_000_000,
    });

    expect(stats.conversionRates.cpi).toBe(10_000);
    expect(stats.conversionRates.cpaSignup).toBe(50_000);
    expect(stats.conversionRates.cpaBookingCreated).toBe(100_000);
    expect(stats.conversionRates.cpaBookingCompleted).toBe(250_000);
    expect(stats.conversionRates.cpa).toBe(250_000);
    expect(stats.conversionRates.roas).toBe(2);
    expect(stats.conversionRates.platformFeeRoas).toBe(0.4);
  });

  it('aggregates source, campaign, and region rows without personal fields', () => {
    const bySource = buildMarketingDimensionRows([
      {
        source: 'unknown',
        platform: 'android',
        stats: { firstOpens: 10, signups: 3, bookingCompleted: 1, platformFeeRevenue: 100000 },
      },
      {
        source: 'referral',
        platform: 'ios',
        campaignId: 'ref-smoke',
        campaignName: 'Referral smoke',
        stats: { signups: 2, firstBookingCompleted: 1, platformFeeRevenue: 50000 },
      },
    ]);

    expect(bySource).toHaveLength(2);
    expect(bySource[0]).not.toHaveProperty('phone');
    expect(bySource.find((row) => row.source === 'unknown')).toMatchObject({
      firstOpens: 10,
      signups: 3,
      conversionRates: { signupRate: 30 },
    });

    const byRegion = buildMarketingRegionRows([
      {
        regionValues: ['Cầu Giấy, Hà Nội'],
        stats: { addressSaves: 1 },
      },
      {
        regionValues: ['22 Le Thanh Ton, District 1, Ho Chi Minh City'],
        coordinates: { latitude: 10.7769, longitude: 106.7009 },
        stats: { bookingCreated: 2 },
      },
    ]);

    expect(byRegion.find((row) => row.regionCode === 'hanoi')).toMatchObject({ addressSaves: 1 });
    expect(byRegion.find((row) => row.regionCode === 'hcm')).toMatchObject({ bookingCreated: 2 });
    expect(byRegion.find((row) => row.regionCode === 'hcm')).not.toHaveProperty('latitude');
  });

  it('separates attributed and unknown customer acquisition coverage', () => {
    expect(
      buildMarketingAttributionQuality([
        {
          source: 'google',
          stats: { firstOpens: 8, signups: 4 },
        },
        {
          source: 'referral',
          stats: { firstOpens: 2, signups: 2 },
        },
        {
          source: 'unknown',
          stats: { firstOpens: 10, signups: 4 },
        },
      ]),
    ).toEqual({
      attributedFirstOpens: 10,
      unknownFirstOpens: 10,
      firstOpenCoverageRate: 50,
      attributedSignups: 6,
      unknownSignups: 4,
      signupCoverageRate: 60,
    });
  });

  it.each([
    { expected: null, known: 0, unknown: 0 },
    { expected: 0, known: 0, unknown: 4 },
    { expected: 25, known: 1, unknown: 3 },
    { expected: 100, known: 4, unknown: 0 },
  ])('returns $expected signup coverage for $known known and $unknown unknown signups', ({ expected, known, unknown }) => {
    expect(
      buildMarketingAttributionQuality([
        { source: 'google', stats: { signups: known } },
        { source: 'unknown', stats: { signups: unknown } },
      ]).signupCoverageRate,
    ).toBe(expected);
  });

  it('merges campaign activity and spend across platform rows before calculating efficiency', () => {
    const rows = buildMarketingCampaignEfficiency(
      [
        {
          campaignId: 'summer',
          campaignName: 'Summer',
          platform: 'android',
          source: 'google',
          stats: { bookingCompleted: 2, platformFeeRevenue: 300_000 },
        },
        {
          campaignId: 'SUMMER',
          campaignName: 'Summer',
          platform: 'ios',
          source: 'google',
          stats: { bookingCompleted: 1, platformFeeRevenue: 100_000 },
        },
      ],
      [
        {
          campaignId: 'summer',
          campaignName: 'Summer',
          platform: 'unknown',
          source: 'google',
          stats: { adSpend: 200_000 },
        },
      ],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      adSpend: 200_000,
      bookingCompleted: 3,
      campaignId: 'summer',
      platformFeeRevenue: 400_000,
      source: 'google',
      conversionRates: {
        cpaBookingCompleted: 66_667,
        platformFeeRoas: 2,
      },
    });
    expect(rows[0].platform).toBeUndefined();
  });

  it('uses one canonical campaign key across case and surrounding whitespace', () => {
    expect(canonicalMarketingCampaignKey('  Summer-HCM  ')).toBe('summer-hcm');
    expect(canonicalMarketingCampaignKey('   ')).toBeNull();
    expect(
      buildMarketingCampaignEfficiency(
        [{ campaignId: ' SUMMER-HCM ', stats: { signups: 2 } }],
        [{ campaignId: 'summer-hcm', stats: { adSpend: 100_000 } }],
        null,
      ),
    ).toMatchObject([
      {
        campaignId: 'summer-hcm',
        signups: 2,
        adSpend: 100_000,
      },
    ]);
  });

  it('distinguishes missing spend evidence from an explicit zero ledger row', () => {
    const window = adminMarketingRangeWindow('today', now);
    const missing = buildMarketingSpendCoverage({
      window,
      recordedDates: [],
      totalSpendAmount: null,
      now,
    });
    const explicitZero = buildMarketingSpendCoverage({
      window,
      recordedDates: ['2026-06-22'],
      totalSpendAmount: 0,
      hasExplicitZeroRows: true,
      now,
    });

    expect(missing).toMatchObject({ status: 'MISSING', totalSpendAmount: null });
    expect(explicitZero).toMatchObject({
      status: 'COMPLETE',
      totalSpendAmount: 0,
      hasExplicitZeroRows: true,
    });
  });

  it('marks incomplete evidence as partial and complete joined evidence as ready', () => {
    const totals = withMarketingRates({
      ...emptyMarketingStats(),
      signups: 4,
      bookingCreated: 2,
      bookingCompleted: 1,
      adSpend: 100_000,
    });
    const quality = {
      attributedFirstOpens: 4,
      unknownFirstOpens: 0,
      firstOpenCoverageRate: 100,
      attributedSignups: 4,
      unknownSignups: 0,
      signupCoverageRate: 100,
    };
    const partialCoverage = buildMarketingSpendCoverage({
      window: adminMarketingRangeWindow('7d', now),
      recordedDates: ['2026-06-22'],
      totalSpendAmount: 100_000,
      attributionCampaignIds: ['launch'],
      spendCampaignIds: ['LAUNCH'],
      now,
    });
    const readyCoverage = buildMarketingSpendCoverage({
      window: adminMarketingRangeWindow('today', now),
      recordedDates: ['2026-06-22'],
      totalSpendAmount: 100_000,
      attributionCampaignIds: ['launch'],
      spendCampaignIds: ['LAUNCH'],
      now,
    });

    expect(buildMarketingDecisionReadiness({ attributionQuality: quality, spendCoverage: partialCoverage, totals }))
      .toMatchObject({ status: 'PARTIAL', reasons: expect.arrayContaining(['INCOMPLETE_SPEND_DAYS']) });
    expect(buildMarketingDecisionReadiness({ attributionQuality: quality, spendCoverage: readyCoverage, totals }))
      .toMatchObject({ status: 'READY', reasons: [] });
  });

  it('counts risks across the campaign universe while returning only the visible action slice', () => {
    const totals = withMarketingRates({
      ...emptyMarketingStats(),
      signups: 6,
      bookingCreated: 6,
      adSpend: 600_000,
    });
    const attributionQuality = {
      attributedFirstOpens: 6,
      unknownFirstOpens: 0,
      firstOpenCoverageRate: 100,
      attributedSignups: 6,
      unknownSignups: 0,
      signupCoverageRate: 100,
    };
    const spendCoverage = buildMarketingSpendCoverage({
      window: adminMarketingRangeWindow('today', now),
      recordedDates: ['2026-06-22'],
      totalSpendAmount: 600_000,
      now,
      paidScopeExpected: false,
    });
    const readiness = buildMarketingDecisionReadiness({ attributionQuality, spendCoverage, totals });
    const campaigns = Array.from({ length: 6 }, (_, index) => ({
      key: `campaign-${index}`,
      campaignId: `campaign-${index}`,
      campaignName: `Campaign ${index}`,
      ...withMarketingRates({ ...emptyMarketingStats(), adSpend: 100_000 }),
    }));
    const actions = buildMarketingActionSummary({
      attributionQuality,
      campaignEfficiency: campaigns,
      comparison: buildMarketingComparison(totals, emptyMarketingStats(), 'Previous day'),
      readiness,
      spendCoverage,
      totals,
      visibleLimit: 4,
      generatedAt: now,
    });

    expect(actions).toMatchObject({ totalCount: 6, visibleCount: 4, hiddenCount: 2 });
    expect(actions.items).toHaveLength(4);
  });

  it('builds funnel steps and operator insights from safe aggregate counts', () => {
    const stats = {
      ...emptyMarketingStats(),
      firstOpens: 20,
      signups: 10,
      addressSaves: 8,
      bookingCreated: 4,
      bookingCompleted: 2,
      firstBookingCompleted: 1,
    };
    const funnel = buildMarketingFunnel(stats);
    const insights = buildMarketingInsights(stats, [
      {
        key: 'unknown',
        source: 'unknown',
        ...withMarketingRates(stats),
      },
    ]);

    expect(funnel.map((step) => step.key)).toEqual([
      'app_first_open',
      'signup_completed',
      'address_saved',
      'booking_created',
      'booking_completed',
      'repeat_booking_completed',
    ]);
    expect(funnel.map((step) => step.label)).toEqual([
      'Tracked customer entry',
      'New customer signup',
      'Address ready',
      'First booking created',
      'First booking completed',
      'Repeat booking completed',
    ]);
    expect(funnel[1]).toMatchObject({ rateFromPrevious: 50 });
    expect(insights.some((insight) => insight.includes('un-attributed'))).toBe(true);
  });

  it('keeps the customer cohort monotonic when legacy event totals are inconsistent', () => {
    const stats = {
      ...emptyMarketingStats(),
      firstOpens: 2,
      signups: 1,
      addressSaves: 2,
      bookingCreated: 24,
      bookingCompleted: 4,
      bookingCancelled: 8,
      firstBookingCompleted: 4,
      repeatBookingCompleted: 3,
    };

    expect(normalizeMarketingFunnelCohort(stats)).toMatchObject({
      firstOpens: 2,
      signups: 1,
      addressSaves: 1,
      bookingCreated: 1,
      bookingCompleted: 1,
      bookingCancelled: 1,
      firstBookingCompleted: 1,
      repeatBookingCompleted: 1,
    });
    const rates = withMarketingRates(stats).conversionRates;
    expect([
      rates.signupRate,
      rates.addressSaveRate,
      rates.bookingCreateRate,
      rates.bookingCompleteRate,
      rates.cancellationRate,
      rates.firstBookingRate,
      rates.repeatBookingRate,
    ].every((value) => value <= 100)).toBe(true);
    expect(buildMarketingFunnel(stats).every(
      (step) => step.rateFromPrevious === null || step.rateFromPrevious <= 100,
    )).toBe(true);
  });
});
