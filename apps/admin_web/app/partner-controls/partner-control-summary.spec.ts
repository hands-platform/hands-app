import { buildPartnerControlSummaryFromServer } from './partner-control-summary';

describe('partner control server summary formatting', () => {
  it('keeps the metric order used by the partner control page header', () => {
    expect(
      buildPartnerControlSummaryFromServer({
        activeControls: 3,
        blockedAccounts: 2,
        locationGaps: 4,
        onboardingGaps: 5,
        openReports: 6,
        sharedDevices: 1,
        urgentMajorReports: 7,
        walletDebt: 8,
      }),
    ).toEqual([
      ['Open reports', '6'],
      ['Urgent / major', '7'],
      ['Active controls', '3'],
      ['Blocked accounts', '2'],
      ['Wallet debt', '8'],
      ['Location gaps', '4'],
      ['Shared devices', '1'],
      ['Onboarding gaps', '5'],
    ]);
  });

  it('lets the page fall back to list-derived metrics when the API is unavailable', () => {
    expect(buildPartnerControlSummaryFromServer(null)).toBeNull();
  });
});
