export type PartnerControlSummaryResponse = {
  readonly activeControls?: number;
  readonly blockedAccounts?: number;
  readonly generatedAt?: string;
  readonly locationGaps?: number;
  readonly onboardingGaps?: number;
  readonly openReports?: number;
  readonly overdueReports?: number;
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
    ['Reports needing review', metricValue(summary.openReports)],
    ['Active restrictions', metricValue(summary.activeControls)],
    ['Debt gates', metricValue(summary.walletDebt)],
    ['Overdue', metricValue(summary.overdueReports)],
  ];
}

function metricValue(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : 'Unavailable';
}
