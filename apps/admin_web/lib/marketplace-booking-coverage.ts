export type MarketplaceBookingCoverageSummaryRow = {
  participantCount: number;
  selectableCount: number;
  selectedPartnerPresent: boolean;
  chatRepairNeeded: boolean;
};

export type MarketplaceBookingCoverageSummary = ReturnType<typeof buildMarketplaceBookingCoverageSummary>;

export type MarketplaceBookingCoveragePill = {
  readonly label: string;
  readonly tone: 'pill-danger' | 'pill-info' | 'pill-neutral' | 'pill-success' | 'pill-warn';
};

export function buildMarketplaceBookingCoverageSummary(rows: MarketplaceBookingCoverageSummaryRow[]) {
  return {
    total: rows.length,
    withParticipants: rows.filter((row) => row.participantCount > 0).length,
    withoutParticipants: rows.filter((row) => row.participantCount === 0).length,
    selected: rows.filter((row) => row.selectedPartnerPresent).length,
    waitingChoice: rows.filter((row) => row.selectableCount > 0 && !row.selectedPartnerPresent).length,
    chatRepair: rows.filter((row) => row.chatRepairNeeded).length,
  };
}

export function buildMarketplaceBookingCoveragePills(
  summary: MarketplaceBookingCoverageSummary,
): readonly MarketplaceBookingCoveragePill[] {
  return [
    {
      label: `Bookings with participant history ${summary.withParticipants}`,
      tone: 'pill-info',
    },
    {
      label: `Bookings without participants ${summary.withoutParticipants}`,
      tone: summary.withoutParticipants > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      label: `Waiting customer choice ${summary.waitingChoice}`,
      tone: summary.waitingChoice > 0 ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: `Chat handoff repair ${summary.chatRepair}`,
      tone: summary.chatRepair > 0 ? 'pill-danger' : 'pill-success',
    },
  ];
}
