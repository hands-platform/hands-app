import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingDetailFlowStages } from './booking-detail-flow-stages';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-flow-stages',
    participants: [],
    status: 'CREATED',
    ...input,
  } as AdminBookingDetail;
}

describe('bookingDetailFlowStages', () => {
  it('maps unopened bookings into the stable five-stage timeline', () => {
    const stages = bookingDetailFlowStages(booking({}));

    expect(stages.map((stage) => stage.label)).toEqual([
      'Created',
      'Opened',
      'Partner reply',
      'Matched',
      'Payment',
    ]);
    expect(stages[0]).toMatchObject({
      done: true,
      hint: 'Customer selected service and address.',
    });
    expect(stages[1]).toMatchObject({
      done: false,
      hint: 'Open matching started.',
      value: 'Not opened',
    });
  });

  it('uses preferred Partner direct request copy and preferred decision state', () => {
    const stages = bookingDetailFlowStages(
      booking({
        openedAt: '2026-06-14T01:05:00.000Z',
        participants: [
          {
            providerProfileId: 'partner-preferred',
            status: 'JOINED',
          },
        ] as AdminBookingDetail['participants'],
        preferredProvider: {
          id: 'partner-preferred',
          displayName: 'Preferred Partner',
        } as AdminBookingDetail['preferredProvider'],
        preferredProviderId: 'partner-preferred',
        status: 'OPEN_MATCHING',
      }),
    );

    expect(stages[1]).toMatchObject({
      done: true,
      hint: 'Direct request sent to preferred Partner.',
    });
    expect(stages[2]).toMatchObject({
      done: true,
      hint: 'Shortlist has Partners ready for customer decision.',
      value: 'JOINED',
    });
  });

  it('marks selected Partner, chat, and captured payment as complete', () => {
    const stages = bookingDetailFlowStages(
      booking({
        chatRoom: { id: 'chat-room-1' } as AdminBookingDetail['chatRoom'],
        payment: {
          method: 'CARD',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
        } as AdminBookingDetail['selectedProvider'],
        status: 'COMPLETED',
      }),
    );

    expect(stages[2]).toMatchObject({
      done: true,
    });
    expect(stages[3]).toMatchObject({
      done: true,
      hint: 'Chat room is ready.',
      value: 'Linh Partner',
    });
    expect(stages[4]).toMatchObject({
      done: true,
      hint: 'Payment captured.',
      value: 'CAPTURED',
    });
  });

  it('surfaces cash debt payment hint in the payment stage', () => {
    const stages = bookingDetailFlowStages(
      booking({
        earning: {
          currency: 'VND',
          netAmount: -120000,
          status: 'PENDING',
        } as AdminBookingDetail['earning'],
        payment: {
          method: 'CASH',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        status: 'COMPLETED',
      }),
    );

    expect(stages[4]).toMatchObject({
      hint: 'Cash fee debt is still unsettled; marketplace alerts, participation, and payout release are blocked.',
      value: 'CAPTURED',
    });
  });
});
