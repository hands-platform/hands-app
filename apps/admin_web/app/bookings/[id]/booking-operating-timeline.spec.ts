import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminNotification,
} from '../../../lib/admin-api';
import { bookingOperatingTimeline } from './booking-operating-timeline';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-operating-timeline',
    participants: [],
    status: 'COMPLETED',
    updatedAt: '2026-06-14T02:00:00.000Z',
    ...input,
  } as AdminBookingDetail;
}

function message(input: Partial<AdminChatMessage>): AdminChatMessage {
  return {
    body: 'Customer message',
    createdAt: '2026-06-14T03:00:00.000Z',
    id: 'message-1',
    ...input,
  } as AdminChatMessage;
}

function notification(input: Partial<AdminNotification>): AdminNotification {
  return {
    body: 'Notification body',
    createdAt: '2026-06-14T05:00:00.000Z',
    data: { bookingId: 'booking-operating-timeline' },
    id: 'notification-1',
    title: 'Booking alert',
    type: 'booking.matched',
    ...input,
  } as AdminNotification;
}

describe('bookingOperatingTimeline', () => {
  it('composes base, finance, and activity timeline items in newest-first order with pending rows last', () => {
    const rows = bookingOperatingTimeline({
      booking: booking({
        chatRoom: { id: 'chat-room-1' },
        earning: {
          createdAt: '2026-06-14T04:00:00.000Z',
          currency: 'VND',
          id: 'earning-1',
          netAmount: 240000,
          platformFee: 60000,
          status: 'PAID',
        } as AdminBookingDetail['earning'],
        payment: {
          amount: 300000,
          currency: 'VND',
          id: 'payment-1',
          method: 'CARD',
          status: 'CAPTURED',
        } as AdminBookingDetail['payment'],
        review: {
          createdAt: '2026-06-14T06:00:00.000Z',
          id: 'review-1',
          rating: 5,
          status: 'PUBLISHED',
        },
      }),
      addressLine: 'District 1 address',
      addressPin: '10.762622, 106.660172',
      messages: [message({})],
      notifications: [notification({})],
    });

    expect(rows.map((row) => row.id)).toEqual([
      'review-review-1',
      'notification-notification-1',
      'earning-earning-1',
      'chat-ready-chat-room-1',
      'chat-last-message-1',
      'payment-payment-1',
      'created-booking-operating-timeline',
      'matching-opened-booking-operating-timeline',
      'address-booking-operating-timeline',
    ]);
    expect(rows.find((row) => row.id === 'payment-payment-1')).toMatchObject({
      detail: 'CARD / 300.000 VND / no gateway ref',
      type: 'PAY',
    });
    expect(rows.at(-1)).toMatchObject({
      status: 'Pending',
      type: 'ADDR',
    });
  });

  it('keeps activity notifications scoped to the current booking', () => {
    const rows = bookingOperatingTimeline({
      booking: booking({}),
      addressLine: 'District 2 address',
      addressPin: '10.780000, 106.740000',
      messages: [],
      notifications: [
        notification({ id: 'current-alert' }),
        notification({
          data: { bookingId: 'other-booking' },
          id: 'other-alert',
        }),
      ],
    });

    expect(rows.some((row) => row.id === 'notification-current-alert')).toBe(true);
    expect(rows.some((row) => row.id === 'notification-other-alert')).toBe(false);
  });
});
