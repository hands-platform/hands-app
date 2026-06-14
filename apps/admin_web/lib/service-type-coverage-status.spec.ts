import { serviceTypeCoverageStatus } from './service-type-coverage-status';

describe('service type coverage status', () => {
  it('prioritizes missing base payout as a blocking state', () => {
    expect(
      serviceTypeCoverageStatus({
        belowMinimumCount: 2,
        lowCommissionCount: 2,
        missingBasePayoutCount: 1,
        missingDurations: [90],
        missingPayoutPriceCount: 2,
      }),
    ).toEqual({
      nextAction: 'Add payout rules at the minimum customer price for every active duration option.',
      statusLabel: 'Base payout missing',
      tone: 'pill-danger',
    });
  });

  it('blocks Partner prices below the admin minimum before warning on missing payout prices', () => {
    expect(
      serviceTypeCoverageStatus({
        belowMinimumCount: 1,
        lowCommissionCount: 0,
        missingBasePayoutCount: 0,
        missingDurations: [],
        missingPayoutPriceCount: 2,
      }),
    ).toEqual({
      nextAction: 'Raise Partner prices below the admin minimum or intentionally lower the service minimum.',
      statusLabel: 'Partner price blocked',
      tone: 'pill-danger',
    });
  });

  it('warns on hidden Partner prices, low commission, then duration gaps', () => {
    expect(
      serviceTypeCoverageStatus({
        belowMinimumCount: 0,
        lowCommissionCount: 0,
        missingBasePayoutCount: 0,
        missingDurations: [],
        missingPayoutPriceCount: 1,
      }),
    ).toMatchObject({
      statusLabel: 'Partner price hidden',
      tone: 'pill-warn',
    });

    expect(
      serviceTypeCoverageStatus({
        belowMinimumCount: 0,
        lowCommissionCount: 1,
        missingBasePayoutCount: 0,
        missingDurations: [90],
        missingPayoutPriceCount: 0,
      }),
    ).toMatchObject({
      statusLabel: 'Commission check',
      tone: 'pill-warn',
    });

    expect(
      serviceTypeCoverageStatus({
        belowMinimumCount: 0,
        lowCommissionCount: 0,
        missingBasePayoutCount: 0,
        missingDurations: [120],
        missingPayoutPriceCount: 0,
      }),
    ).toMatchObject({
      statusLabel: 'Duration gap',
      tone: 'pill-warn',
    });
  });

  it('returns ready when coverage has no blocking or warning signal', () => {
    expect(
      serviceTypeCoverageStatus({
        belowMinimumCount: 0,
        lowCommissionCount: 0,
        missingBasePayoutCount: 0,
        missingDurations: [],
        missingPayoutPriceCount: 0,
      }),
    ).toEqual({
      nextAction: 'Ready for customer booking with configured duration and payout coverage.',
      statusLabel: 'Ready',
      tone: 'pill-success',
    });
  });
});
