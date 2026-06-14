import {
  buildMarketplaceParticipantLedgerRows,
  buildMarketplaceParticipantLedgerPills,
  buildMarketplaceParticipantLedgerSummary,
} from './marketplace-participant-ledger';

type TestBooking = {
  readonly id: string;
};

type TestParticipant = {
  readonly id: string;
};

function ledgerInput(
  participantId: string,
  overrides: Partial<
    Parameters<typeof buildMarketplaceParticipantLedgerRows<TestBooking, TestParticipant>>[0][number]
  > = {},
): Parameters<typeof buildMarketplaceParticipantLedgerRows<TestBooking, TestParticipant>>[0][number] {
  return {
    alertLabel: 'No marketplace trace',
    alertTone: 'pill-neutral',
    booking: { id: 'booking-1' },
    bookingStatus: 'OPEN_MATCHING',
    customerSelectable: false,
    distanceMeters: null,
    hasChatRoom: false,
    joinedLabel: 'Participation time not saved',
    marketplaceRadiusMeters: 10_000,
    participant: { id: participantId },
    participantPartnerId: participantId,
    partnerLabel: `Partner ${participantId}`,
    preferredPartnerId: 'preferred',
    respondedLabel: 'No response time saved',
    selectedPartnerId: null,
    sortTimestamp: 100,
    status: 'JOINED',
    walletLabel: 'Wallet pending',
    walletTone: 'pill-neutral',
    windowLabel: '5m left',
    ...overrides,
  };
}

describe('marketplace participant ledger summary', () => {
  it('counts first-pick, marketplace, selected, waiting, and declined rows', () => {
    const summary = buildMarketplaceParticipantLedgerSummary([
      {
        choiceLabel: 'Selected by customer',
        roleLabel: 'First-pick Partner',
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
      { label: 'First-pick Partners 2', tone: 'pill-info' },
      { label: 'Marketplace participants 3', tone: 'pill-info' },
      { label: 'Selected marketplace Partner 1', tone: 'pill-success' },
      { label: 'Waiting customer choice 2', tone: 'pill-warn' },
      { label: 'Declined responses 1', tone: 'pill-info' },
    ]);
  });

  it('builds prioritized participant ledger rows from booking facts', () => {
    const rows = buildMarketplaceParticipantLedgerRows([
      ledgerInput('other', { customerSelectable: true, sortTimestamp: 300 }),
      ledgerInput('selected', {
        distanceMeters: 900,
        hasChatRoom: true,
        selectedPartnerId: 'selected',
        sortTimestamp: 10,
        status: 'SELECTED',
      }),
      ledgerInput('preferred', {
        participantPartnerId: 'preferred',
        preferredPartnerId: 'preferred',
        status: 'JOINED',
      }),
    ]);

    expect(rows.map((row) => [row.participant.id, row.roleLabel, row.choiceLabel])).toEqual([
      ['selected', 'Marketplace participant', 'Selected by customer'],
      ['other', 'Marketplace participant', 'Customer-selectable'],
      ['preferred', 'First-pick Partner', 'Evidence-only'],
    ]);
    expect(rows[0]).toMatchObject({
      chatHandoffLabel: 'Chat retained',
      distancePolicyLabel: 'Within booking radius',
      evidenceLabel: 'Final selected row',
      statusLabel: 'Selected',
    });
  });

  it('keeps declined rows as response evidence only', () => {
    const rows = buildMarketplaceParticipantLedgerRows([
      ledgerInput('declined', { status: 'REJECTED' }),
    ]);

    expect(rows[0]).toMatchObject({
      choiceLabel: 'Evidence-only',
      evidenceDetail: 'Decline is retained as response evidence, not as a customer-selectable Partner.',
      evidenceLabel: 'Declined response row',
      statusLabel: 'Declined',
    });
  });
});
