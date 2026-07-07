import {
  buildMarketplaceBookingCoverageRows,
  buildMarketplaceBookingCoveragePills,
  buildMarketplaceBookingCoverageSummary,
} from './marketplace-booking-coverage';

type TestBooking = {
  readonly id: string;
};

function coverageInput(
  id: string,
  overrides: Partial<Parameters<typeof buildMarketplaceBookingCoverageRows<TestBooking>>[0][number]> = {},
): Parameters<typeof buildMarketplaceBookingCoverageRows<TestBooking>>[0][number] {
  return {
    booking: { id },
    chatRepairNeeded: false,
    firstPickLabel: 'Open marketplace',
    firstPickTone: 'pill-neutral',
    marketplaceParticipantCount: 0,
    nextActionLabel: 'Monitor',
    nextActionTone: 'pill-info',
    participantCount: 0,
    selectableCount: 0,
    selectedPartnerLabel: null,
    sortTimestamp: 100,
    status: 'OPEN_MATCHING',
    traceBatchCount: 0,
    traceLastAge: null,
    traceLastStage: null,
    traceTotalNotified: 0,
    walletLabel: 'Wallet clear',
    walletTone: 'pill-success',
    ...overrides,
  };
}

describe('marketplace booking coverage summary', () => {
  it('counts participant history, customer choice, final selection, and chat repair lanes', () => {
    const summary = buildMarketplaceBookingCoverageSummary([
      {
        participantCount: 2,
        selectableCount: 1,
        selectedPartnerPresent: false,
        chatRepairNeeded: false,
      },
      {
        participantCount: 1,
        selectableCount: 0,
        selectedPartnerPresent: true,
        chatRepairNeeded: true,
      },
      {
        participantCount: 0,
        selectableCount: 0,
        selectedPartnerPresent: false,
        chatRepairNeeded: false,
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      withParticipants: 2,
      withoutParticipants: 1,
      selected: 1,
      waitingChoice: 1,
      chatRepair: 1,
    });
  });

  it('builds stable operator summary pills for the marketplace board', () => {
    const pills = buildMarketplaceBookingCoveragePills({
      chatRepair: 1,
      selected: 2,
      total: 4,
      waitingChoice: 0,
      withParticipants: 3,
      withoutParticipants: 1,
    });

    expect(pills).toEqual([
      { label: 'Bookings with participant history 3', tone: 'pill-info' },
      { label: 'Bookings without participants 1', tone: 'pill-warn' },
      { label: 'Waiting customer choice 0', tone: 'pill-neutral' },
      { label: 'Chat handoff repair 1', tone: 'pill-danger' },
    ]);
  });

  it('builds prioritized coverage rows from booking facts', () => {
    const rows = buildMarketplaceBookingCoverageRows([
      coverageInput('monitor', { sortTimestamp: 500 }),
      coverageInput('choice', {
        nextActionLabel: 'Customer final choice',
        nextActionTone: 'pill-warn',
        selectableCount: 2,
        traceBatchCount: 1,
        traceTotalNotified: 3,
      }),
      coverageInput('chat', {
        chatRepairNeeded: true,
        nextActionLabel: 'Repair chat handoff',
        nextActionTone: 'pill-danger',
        selectedPartnerLabel: 'Partner Linh',
        sortTimestamp: 10,
      }),
    ]);

    expect(rows.map((row) => [row.booking.id, row.selectedPartnerLabel, row.selectedPartnerTone])).toEqual([
      ['chat', 'Partner Linh', 'pill-success'],
      ['choice', 'Awaiting customer choice', 'pill-warn'],
      ['monitor', 'No final Partner', 'pill-neutral'],
    ]);
    expect(rows[1]).toMatchObject({
      alertLabel: '3 notified',
      alertTone: 'pill-success',
      selectedPartnerPresent: false,
    });
  });

  it('marks open matching rows without alert batches as dangerous', () => {
    const rows = buildMarketplaceBookingCoverageRows([coverageInput('missing-alert')]);

    expect(rows[0]).toMatchObject({
      alertDetail: 'Marketplace notification delivery is not recorded for this booking.',
      alertLabel: 'No alert batch',
      alertTone: 'pill-danger',
    });
    expect(`${rows[0].alertDetail} ${rows[0].alertLabel}`).not.toMatch(/trace/i);
  });
});
