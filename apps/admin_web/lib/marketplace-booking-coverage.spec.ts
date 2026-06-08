import { buildMarketplaceBookingCoverageSummary } from './marketplace-booking-coverage';

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
});
