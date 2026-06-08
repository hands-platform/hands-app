export type MarketplaceBookingCoverageSummaryRow = {
  participantCount: number;
  selectableCount: number;
  selectedPartnerPresent: boolean;
  chatRepairNeeded: boolean;
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
