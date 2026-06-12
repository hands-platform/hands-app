import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchingFlowTimelineInput } from './booking-matching-flow-timeline-inputs';

function booking(id: string, status: string): AdminBooking {
  return { id, status } as AdminBooking;
}

describe('bookingMatchingFlowTimelineInput', () => {
  it('groups booking facts for matching flow timeline stages', () => {
    const expired = booking('expired', 'OPEN_MATCHING');
    const marketplace = booking('marketplace', 'OPEN_MATCHING');
    const matchedMissingChat = booking('matched-missing-chat', 'MATCHED');
    const onTheWay = booking('on-the-way', 'PROVIDER_ON_THE_WAY');

    expect(
      bookingMatchingFlowTimelineInput([
        {
          backupAlertNotifiedCount: 1,
          booking: expired,
          customerSelectableCount: 0,
          firstPickPending: true,
          hasChatRoom: false,
          isLiveHandoff: false,
          locationNeedsOps: false,
          marketplaceParticipantCount: 0,
          responseWindowExpired: true,
          status: 'OPEN_MATCHING',
        },
        {
          backupAlertNotifiedCount: 0,
          booking: marketplace,
          customerSelectableCount: 2,
          firstPickPending: false,
          hasChatRoom: false,
          isLiveHandoff: false,
          locationNeedsOps: false,
          marketplaceParticipantCount: 3,
          responseWindowExpired: false,
          status: 'OPEN_MATCHING',
        },
        {
          backupAlertNotifiedCount: 0,
          booking: matchedMissingChat,
          customerSelectableCount: 0,
          firstPickPending: false,
          hasChatRoom: false,
          isLiveHandoff: true,
          locationNeedsOps: false,
          marketplaceParticipantCount: 0,
          responseWindowExpired: false,
          status: 'MATCHED',
        },
        {
          backupAlertNotifiedCount: 0,
          booking: onTheWay,
          customerSelectableCount: 0,
          firstPickPending: false,
          hasChatRoom: true,
          isLiveHandoff: true,
          locationNeedsOps: true,
          marketplaceParticipantCount: 0,
          responseWindowExpired: false,
          status: 'PROVIDER_ON_THE_WAY',
        },
      ]),
    ).toEqual({
      backupAlerted: [expired],
      customerChoice: [marketplace],
      firstPickExpired: [expired],
      firstPickWaiting: [expired],
      liveHandoff: [matchedMissingChat, onTheWay],
      locationChecks: [onTheWay],
      marketplaceVisible: [marketplace],
      matched: [matchedMissingChat],
      matchedWithoutChat: [matchedMissingChat],
      noSupply: [expired],
    });
  });
});
