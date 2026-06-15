import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingOperatingNextAction } from './booking-operating-next-action';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-next-action',
    status: 'CREATED',
    ...input,
  } as AdminBookingDetail;
}

describe('bookingOperatingNextAction', () => {
  it('prioritizes cash fee debt before status-specific actions', () => {
    const action = bookingOperatingNextAction(
      booking({
        earning: {
          currency: 'VND',
          netAmount: -120000,
          status: 'PENDING',
        } as AdminBookingDetail['earning'],
        payment: {
          method: 'CASH',
          status: 'PENDING',
        } as AdminBookingDetail['payment'],
        status: 'OPEN_MATCHING',
      }),
    );

    expect(action).toMatchObject({
      href: '#finance',
      hrefLabel: 'Open finance',
      title: 'Settle cash fee debt',
    });
  });

  it('guides matching by participant visibility', () => {
    expect(
      bookingOperatingNextAction(
        booking({
          participants: [],
          status: 'OPEN_MATCHING',
        }),
      ).title,
    ).toBe('Monitor Partner participation');

    expect(
      bookingOperatingNextAction(
        booking({
          participants: [{ id: 'participant-1' }] as AdminBookingDetail['participants'],
          status: 'OPEN_MATCHING',
        }),
      ).title,
    ).toBe('Monitor customer final selection');
  });

  it('routes matched bookings without chat to chat repair', () => {
    expect(
      bookingOperatingNextAction(
        booking({
          chatRoom: null,
          status: 'MATCHED',
        }),
      ),
    ).toMatchObject({
      href: '#chat',
      hrefLabel: 'Open chat',
      title: 'Create or recover chat room',
    });
  });

  it('routes active bookings with chat to location handoff tracking', () => {
    expect(
      bookingOperatingNextAction(
        booking({
          chatRoom: { id: 'chat-room-1' },
          status: 'MATCHED',
        }),
      ),
    ).toMatchObject({
      href: '#location',
      hrefLabel: 'Open location',
      title: 'Track handoff and service progress',
    });
  });

  it('routes completed and closed states to their closeout areas', () => {
    expect(bookingOperatingNextAction(booking({ status: 'COMPLETED' }))).toMatchObject({
      href: '#finance',
      title: 'Reconcile completed booking',
    });

    expect(bookingOperatingNextAction(booking({ status: 'CANCELLED' }))).toMatchObject({
      href: '#payment',
      title: 'Close customer and finance loop',
    });
  });

  it('uses normal monitoring for states without immediate operator action', () => {
    expect(bookingOperatingNextAction(booking({ status: 'CREATED' }))).toMatchObject({
      href: '#booking-activity',
      hrefLabel: 'Open timeline',
      title: 'Continue normal monitoring',
    });
  });
});
