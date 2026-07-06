import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
  AdminNotification,
} from '../../../lib/admin-api';
import {
  bookingCommunicationMovementHandoff,
  messageSenderLabel,
} from './booking-communication-movement-handoff';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-handoff',
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function message(input: Partial<AdminChatMessage>): AdminChatMessage {
  return {
    body: 'Hello from chat',
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'message-1',
    ...input,
  } as AdminChatMessage;
}

function notification(input: Partial<AdminNotification>): AdminNotification {
  return {
    body: 'Alert body',
    createdAt: '2026-06-14T02:00:00.000Z',
    data: { bookingId: 'booking-handoff' },
    id: 'notification-1',
    title: 'Booking alert',
    type: 'booking.matched',
    ...input,
  } as AdminNotification;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.762622,
    lng: 106.660172,
    providerProfileId: 'partner-1',
    recordedAt: '2026-06-14T03:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('bookingCommunicationMovementHandoff', () => {
  it('prioritizes chat repair when a matched booking has no retained chat room', () => {
    const handoff = bookingCommunicationMovementHandoff({
      booking: booking({ chatRoom: null }),
      messages: [],
      notifications: [],
    });

    expect(handoff).toMatchObject({
      href: '#chat',
      hrefLabel: 'Open chat section',
      nextAction: 'Repair booking chat handoff',
      noteClassName: 'ops-task-warning',
      status: 'Chat repair needed',
      tone: 'pill-warn',
    });
    expect(handoff.metrics.find((metric) => metric.label === 'Chat room')).toMatchObject({
      helper: 'Chat should be created once the booking is matched.',
      value: 'Missing',
    });
  });

  it('surfaces failed or disabled alert delivery after chat is retained', () => {
    const handoff = bookingCommunicationMovementHandoff({
      booking: booking({ chatRoom: { id: 'chat-room-1' } }),
      messages: [],
      notifications: [
        notification({
          deliveries: [
            {
              attemptedAt: '2026-06-14T02:01:00.000Z',
              provider: 'FCM',
              pushDevice: { enabled: false, id: 'device-1' },
              status: 'FAILED',
            },
          ],
        }),
      ],
    });

    expect(handoff).toMatchObject({
      href: '#alerts',
      nextAction: 'Review notification delivery',
      status: 'Alert delivery check',
      tone: 'pill-warn',
    });
    expect(handoff.metrics.find((metric) => metric.label === 'Delivery checks')).toMatchObject({
      helper: '1 disabled device(s) also found.',
      value: '1 failed / 0 pending',
    });
  });

  it('requests Partner location when an active booking has chat but no location', () => {
    const handoff = bookingCommunicationMovementHandoff({
      booking: booking({
        chatRoom: { id: 'chat-room-1' },
        status: 'IN_SERVICE',
      }),
      messages: [],
      notifications: [],
    });

    expect(handoff).toMatchObject({
      href: '#location',
      nextAction: 'Ask Partner to share current location',
      noteClassName: 'ops-task-info',
      status: 'Location check',
      tone: 'pill-info',
    });
  });

  it('builds a visible handoff with sorted chat, alert, and location events', () => {
    const handoff = bookingCommunicationMovementHandoff({
      booking: booking({
        chatRoom: { id: 'chat-room-1' },
        snapshots: [
          location({
            id: 'location-old',
            recordedAt: '2026-06-14T01:10:00.000Z',
          }),
          location({
            id: 'location-new',
            recordedAt: '2026-06-14T04:00:00.000Z',
          }),
        ],
        status: 'MATCHED',
      }),
      latestLocation: location({
        id: 'location-new',
        recordedAt: '2026-06-14T04:00:00.000Z',
      }),
      messages: [
        message({
          createdAt: '2026-06-14T03:00:00.000Z',
          id: 'message-1',
          sender: { fullName: 'Customer One', id: 'customer-user', roles: ['CUSTOMER'] },
        }),
      ],
      notifications: [
        notification({
          createdAt: '2026-06-14T02:00:00.000Z',
          id: 'notification-1',
        }),
      ],
    });

    expect(handoff.status).toBe('Handoff visible');
    expect(handoff.events.map((event) => event.id)).toEqual([
      'location-location-new',
      'message-message-1',
      'notification-notification-1',
      'location-location-old',
    ]);
    expect(handoff.metrics.find((metric) => metric.label === 'Movement rows')).toMatchObject({
      value: '2',
    });
    expect(handoff.metrics.find((metric) => metric.label === 'Latest message')).toMatchObject({
      dateTimeValue: '2026-06-14T03:00:00.000Z',
      value: '14 Jun 2026, 10:00',
    });
    expect(handoff.metrics.find((metric) => metric.label === 'Booking alerts')).toMatchObject({
      dateTimeValue: '2026-06-14T02:00:00.000Z',
      value: '1',
    });
    expect(handoff.events.find((event) => event.id === 'location-location-new')).toMatchObject({
      detail: expect.stringContaining('Location recorded without readable address / Updated'),
    });
    expect(
      [
        ...handoff.metrics.map((metric) => metric.helper),
        ...handoff.events.map((event) => event.detail),
      ].join(' '),
    ).not.toMatch(/\d{2}\.\d{4},\s*\d{3}\.\d{4}/);
  });
});

describe('messageSenderLabel', () => {
  it('labels known sender roles and falls back to available identity', () => {
    expect(
      messageSenderLabel(
        message({ sender: { fullName: 'Partner One', id: 'partner-user', roles: ['PROVIDER'] } }),
      ),
    ).toBe('Partner: Partner One');
    expect(messageSenderLabel(message({ sender: { id: 'unknown', phone: '+84900000001' } }))).toBe(
      '+84900000001',
    );
    expect(messageSenderLabel(message({ sender: undefined }))).toBe('Unknown sender');
  });
});
