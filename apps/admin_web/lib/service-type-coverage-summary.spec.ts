import { serviceTypeCoverageSummary } from './service-type-coverage-summary';

describe('service type coverage summary', () => {
  it('summarizes service type coverage rows by tone and missing coverage', () => {
    const summary = serviceTypeCoverageSummary([
      {
        currency: 'VND',
        hiddenPartnerPriceCount: 2,
        missingBasePayoutCount: 1,
        missingDurations: [90, 120],
        netCompanyFee: 500,
        tone: 'pill-danger',
      },
      {
        currency: 'VND',
        hiddenPartnerPriceCount: 1,
        missingBasePayoutCount: 0,
        missingDurations: [120],
        netCompanyFee: 300,
        tone: 'pill-warn',
      },
      {
        currency: 'VND',
        hiddenPartnerPriceCount: 0,
        missingBasePayoutCount: 0,
        missingDurations: [],
        netCompanyFee: 200,
        tone: 'pill-success',
      },
    ]);

    expect(summary).toEqual({
      blockedCount: 1,
      currency: 'VND',
      hiddenPartnerPriceCount: 3,
      missingBasePayoutCount: 1,
      missingDurationCount: 3,
      netCompanyFee: 1000,
      readyCount: 1,
      warningCount: 1,
    });
  });

  it('returns empty VND totals when there are no rows', () => {
    expect(serviceTypeCoverageSummary([])).toEqual({
      blockedCount: 0,
      currency: 'VND',
      hiddenPartnerPriceCount: 0,
      missingBasePayoutCount: 0,
      missingDurationCount: 0,
      netCompanyFee: 0,
      readyCount: 0,
      warningCount: 0,
    });
  });
});
