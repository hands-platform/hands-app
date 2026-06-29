export type PartnerControlSummaryResponse = {
  readonly activeControls?: number;
  readonly blockedAccounts?: number;
  readonly locationGaps?: number;
  readonly onboardingGaps?: number;
  readonly openReports?: number;
  readonly sharedDevices?: number;
  readonly urgentMajorReports?: number;
  readonly walletDebt?: number;
};

export function buildPartnerControlSummaryFromServer(
  summary: PartnerControlSummaryResponse | null,
): readonly (readonly [string, string])[] | null {
  if (!summary) {
    return null;
  }

  return [
    ['Open reports', metricValue(summary.openReports)],
    ['Urgent / major', metricValue(summary.urgentMajorReports)],
    ['Active controls', metricValue(summary.activeControls)],
    ['Blocked accounts', metricValue(summary.blockedAccounts)],
    ['Wallet debt', metricValue(summary.walletDebt)],
    ['Location gaps', metricValue(summary.locationGaps)],
    ['Shared devices', metricValue(summary.sharedDevices)],
    ['Onboarding gaps', metricValue(summary.onboardingGaps)],
  ];
}

function metricValue(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : '0';
}
