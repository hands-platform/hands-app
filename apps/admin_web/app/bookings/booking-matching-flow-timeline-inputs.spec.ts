import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMatchingFlowTimelineBookingFact,
  bookingMatchingFlowTimelineInput,
} from './booking-matching-flow-timeline-inputs';

function booking(id: string, status: string): AdminBooking {
  return { id, status } as AdminBooking;
}

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('bookingMatchingFlowTimelineInput', () => {
  it('builds open matching facts from booking and matching counts', () => {
    const item = {
      id: 'open-1',
      expiresAt: '2026-06-07T09:45:00.000Z',
      metadata: {
        backupNotificationTraces: [{ notifiedCount: 3 }],
      },
      status: 'OPEN_MATCHING',
    } as AdminBooking;

    expect(
      bookingMatchingFlowTimelineBookingFact(item, nowMs, {
        customerSelectableCount: 2,
        firstPickPending: true,
        marketplaceParticipantCount: 4,
      }),
    ).toMatchObject({
      backupAlertNotifiedCount: 3,
      booking: item,
      customerSelectableCount: 2,
      firstPickPending: true,
      hasChatRoom: false,
      isLiveHandoff: false,
      locationNeedsOps: false,
      marketplaceParticipantCount: 4,
      responseWindowExpired: true,
      status: 'OPEN_MATCHING',
    });
  });

  it('gates count facts away from non-open matching bookings', () => {
    expect(
      bookingMatchingFlowTimelineBookingFact(
        {
          id: 'matched-1',
          chatRoom: { id: 'chat-1', messages: [] },
          status: 'MATCHED',
        } as AdminBooking,
        nowMs,
        {
          customerSelectableCount: 2,
          firstPickPending: true,
          marketplaceParticipantCount: 4,
        },
      ),
    ).toMatchObject({
      backupAlertNotifiedCount: 0,
      customerSelectableCount: 0,
      firstPickPending: false,
      hasChatRoom: true,
      isLiveHandoff: true,
      marketplaceParticipantCount: 0,
      responseWindowExpired: false,
      status: 'MATCHED',
    });
  });

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
