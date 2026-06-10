import {
  buildMarketplaceParticipantLedgerPills,
  buildMarketplaceParticipantLedgerSummary,
} from './marketplace-participant-ledger';

describe('marketplace participant ledger summary', () => {
  it('counts first-pick, marketplace, selected, waiting, and declined rows', () => {
    const summary = buildMarketplaceParticipantLedgerSummary([
      {
        choiceLabel: 'Selected by customer',
        roleLabel: 'First-pick partner',
        statusLabel: 'Accepted',
      },
      {
        choiceLabel: 'Customer-selectable',
        roleLabel: 'Marketplace participant',
        statusLabel: 'Joined',
      },
      {
        choiceLabel: 'Not selectable',
        roleLabel: 'Marketplace participant',
        statusLabel: 'Declined',
      },
    ]);

    expect(summary).toEqual({
      declined: 1,
      firstPick: 1,
      marketplace: 2,
      selected: 1,
      total: 3,
      waitingChoice: 1,
    });
  });

  it('builds stable operator summary pills', () => {
    expect(
      buildMarketplaceParticipantLedgerPills({
        declined: 1,
        firstPick: 2,
        marketplace: 3,
        selected: 1,
        total: 5,
        waitingChoice: 2,
      }),
    ).toEqual([
      { label: 'First-pick partners 2', tone: 'pill-info' },
      { label: 'Marketplace participants 3', tone: 'pill-info' },
      { label: 'Selected marketplace partner 1', tone: 'pill-success' },
      { label: 'Waiting customer choice 2', tone: 'pill-warn' },
      { label: 'Declined responses 1', tone: 'pill-info' },
    ]);
  });
});
