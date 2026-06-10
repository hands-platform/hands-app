export type MarketplaceParticipantLedgerSummaryRow = {
  readonly choiceLabel: string;
  readonly roleLabel: string;
  readonly statusLabel: string;
};

export type MarketplaceParticipantLedgerSummary = ReturnType<typeof buildMarketplaceParticipantLedgerSummary>;

export type MarketplaceParticipantLedgerPill = {
  readonly label: string;
  readonly tone: 'pill-info' | 'pill-success' | 'pill-warn';
};

export function buildMarketplaceParticipantLedgerSummary(
  rows: readonly MarketplaceParticipantLedgerSummaryRow[],
) {
  return {
    declined: rows.filter((row) => row.statusLabel === 'Declined').length,
    firstPick: rows.filter((row) => row.roleLabel === 'First-pick partner').length,
    marketplace: rows.filter((row) => row.roleLabel === 'Marketplace participant').length,
    selected: rows.filter((row) => row.choiceLabel === 'Selected by customer').length,
    total: rows.length,
    waitingChoice: rows.filter((row) => row.choiceLabel === 'Customer-selectable').length,
  };
}

export function buildMarketplaceParticipantLedgerPills(
  summary: MarketplaceParticipantLedgerSummary,
): readonly MarketplaceParticipantLedgerPill[] {
  return [
    { label: `First-pick partners ${summary.firstPick}`, tone: 'pill-info' },
    { label: `Marketplace participants ${summary.marketplace}`, tone: 'pill-info' },
    { label: `Selected marketplace partner ${summary.selected}`, tone: 'pill-success' },
    { label: `Waiting customer choice ${summary.waitingChoice}`, tone: 'pill-warn' },
    { label: `Declined responses ${summary.declined}`, tone: 'pill-info' },
  ];
}
