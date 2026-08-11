import { buildPartnerControlSummaryFromServer } from './partner-control-summary';

describe('partner control server summary formatting', () => {
  it('keeps only the four decision metrics in the header', () => {
    expect(
      buildPartnerControlSummaryFromServer({
        activeControls: 3,
        blockedAccounts: 2,
        locationGaps: 4,
        onboardingGaps: 5,
        openReports: 6,
        overdueReports: 9,
        sharedDevices: 1,
        urgentMajorReports: 7,
        walletDebt: 8,
      }),
    ).toEqual([
      ['Reports needing review', '6'],
      ['Active restrictions', '3'],
      ['Debt gates', '8'],
      ['Overdue', '9'],
    ]);
  });

  it('does not turn a missing aggregate into a zero', () => {
    expect(buildPartnerControlSummaryFromServer({})).toEqual([
      ['Reports needing review', 'Unavailable'],
      ['Active restrictions', 'Unavailable'],
      ['Debt gates', 'Unavailable'],
      ['Overdue', 'Unavailable'],
    ]);
    expect(buildPartnerControlSummaryFromServer(null)).toBeNull();
  });
});
