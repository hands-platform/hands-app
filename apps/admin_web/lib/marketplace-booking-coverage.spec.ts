import {
  buildMarketplaceBookingCoveragePills,
  buildMarketplaceBookingCoverageSummary,
} from './marketplace-booking-coverage';

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
});
