import { buildPartnerControlPageMetrics } from './partner-control-page-metrics';

describe('partner control page metrics', () => {
  it('maps summary tuples to Admin page metrics with helper copy', () => {
    expect(
      buildPartnerControlPageMetrics([
        ['Open reports', '2'],
        ['Wallet debt', '1'],
      ]),
    ).toEqual([
      {
        helper: 'Reports still open or under investigation.',
        label: 'Open reports',
        value: '2',
      },
      {
        helper: 'Partners with cash fee debt requiring finance follow-up.',
        label: 'Wallet debt',
        value: '1',
      },
    ]);
  });

  it('keeps an explicit fallback for future summary labels', () => {
    expect(buildPartnerControlPageMetrics([['New metric', '3']])[0]).toEqual({
      helper: 'Partner control desk metric.',
      label: 'New metric',
      value: '3',
    });
  });

  it('keeps onboarding gaps focused on Level 2 readiness instead of wallet-only finance setup', () => {
    expect(buildPartnerControlPageMetrics([['Onboarding gaps', '4']])[0]).toEqual({
      helper: 'Partners missing KYC, required documents, service setup, or approval readiness.',
      label: 'Onboarding gaps',
      value: '4',
    });
  });
});
