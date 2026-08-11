import type { AdminBookingDetail, AdminChatMessage, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import {
  bookingDetailOperatorCommandQueue,
  bookingDetailOpsTaskCards,
} from './booking-detail-operator-command-queue';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-operator-command-queue',
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    recordedAt: '2999-01-01T00:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function attentionFlag(title: string): AttentionFlag {
  return {
    action: 'Review booking evidence.',
    detail: 'Booking needs operator review.',
    severity: 'medium',
    title,
  };
}

describe('booking detail operator command queue', () => {
  it('formats booking ops task cards with booking detail date copy', () => {
    const cards = bookingDetailOpsTaskCards(
      booking({
        opsTasks: [
          {
            actor: { fullName: 'Admin One' },
            note: '  Customer confirmed address  ',
            status: 'DONE',
            type: 'CUSTOMER_CONTACTED',
            updatedAt: '2026-06-07T10:00:00.000Z',
          },
        ] as AdminBookingDetail['opsTasks'],
      }),
    );

    expect(cards[0]).toEqual(
      expect.objectContaining({
        note: 'Customer confirmed address',
        status: 'DONE',
        updatedBy: 'Updated 7 Jun 2026, 17:00 by Admin One',
      }),
    );
    expect(cards[1]).toEqual(
      expect.objectContaining({
        status: 'PENDING',
        updatedBy: 'Not checked yet',
      }),
    );
  });

  it('builds open matching commands from booking evidence', () => {
    const queue = bookingDetailOperatorCommandQueue({
      attentionFlags: [attentionFlag('Payment reference missing')],
      booking: booking({ status: 'OPEN_MATCHING' }),
      latestLocation: null,
      messages: [] as AdminChatMessage[],
    });

    expect(queue.status).toBe('2 action(s)');
    expect(queue.labels.find((label) => label.label === 'Attention flags')).toMatchObject({
      value: '1',
    });
    expect(queue.commands.map((command) => command.id)).toEqual([
      'matching-watch',
      'partner-supply',
      'no-show-option',
      'ops-task-next',
    ]);
  });

  it('uses final Partner, chat, message, and location evidence for active bookings', () => {
    const latestLocation = location();
    const queue = bookingDetailOperatorCommandQueue({
      attentionFlags: [],
      booking: booking({
        chatRoom: { id: 'chat-room-1' } as AdminBookingDetail['chatRoom'],
        participants: [{ id: 'participant-1' }] as AdminBookingDetail['participants'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
          locationSnapshots: [latestLocation],
        } as AdminBookingDetail['selectedProvider'],
        status: 'PROVIDER_ON_THE_WAY',
      }),
      latestLocation,
      messages: [{ id: 'message-1' }] as AdminChatMessage[],
    });

    expect(queue.labels.find((label) => label.label === 'Partner')).toMatchObject({
      helper: 'Preferred/final Partner context.',
      value: 'Linh Partner',
    });
    expect(queue.labels.find((label) => label.label === 'Chat')).toMatchObject({
      helper: '1 message(s) in admin archive.',
      value: 'Retained',
    });
    expect(queue.commands.map((command) => command.id)).toEqual(['no-show-option', 'ops-task-next']);
  });
});
