import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchingEscalationBoardInput } from './booking-matching-escalation-board-inputs';

function booking(id: string, status: string): AdminBooking {
  return { id, status } as AdminBooking;
}

describe('bookingMatchingEscalationBoardInput', () => {
  it('groups visible booking facts for matching escalation board lanes', () => {
    const expired = booking('expired', 'OPEN_MATCHING');
    const choice = booking('choice', 'OPEN_MATCHING');
    const noSupply = booking('no-supply', 'OPEN_MATCHING');
    const matchedMissingChat = booking('matched-missing-chat', 'MATCHED');
    const matchedWithChat = booking('matched-with-chat', 'MATCHED');

    expect(
      bookingMatchingEscalationBoardInput([
        {
          booking: expired,
          customerSelectableCount: 0,
          firstPickPending: true,
          hasChatRoom: false,
          marketplaceParticipantCount: 0,
          responseWindowExpired: true,
          status: 'OPEN_MATCHING',
        },
        {
          booking: choice,
          customerSelectableCount: 1,
          firstPickPending: false,
          hasChatRoom: false,
          marketplaceParticipantCount: 2,
          responseWindowExpired: false,
          status: 'OPEN_MATCHING',
        },
        {
          booking: noSupply,
          customerSelectableCount: 0,
          firstPickPending: false,
          hasChatRoom: false,
          marketplaceParticipantCount: 0,
          responseWindowExpired: false,
          status: 'OPEN_MATCHING',
        },
        {
          booking: matchedMissingChat,
          customerSelectableCount: 0,
          firstPickPending: false,
          hasChatRoom: false,
          marketplaceParticipantCount: 0,
          responseWindowExpired: false,
          status: 'MATCHED',
        },
        {
          booking: matchedWithChat,
          customerSelectableCount: 0,
          firstPickPending: false,
          hasChatRoom: true,
          marketplaceParticipantCount: 0,
          responseWindowExpired: false,
          status: 'MATCHED',
        },
      ]),
    ).toEqual({
      chatReady: [matchedWithChat],
      customerFinalSelection: [choice],
      expiredWindow: [expired],
      firstPickWaiting: [expired],
      marketplaceReady: [choice],
      matchedWithoutChat: [matchedMissingChat],
      noMarketplaceSupply: [expired, noSupply],
    });
  });
});
