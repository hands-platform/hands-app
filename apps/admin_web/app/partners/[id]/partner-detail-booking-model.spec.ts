import { buildPartnerBookingArchive } from './partner-detail-booking-model';

describe('partner detail booking model', () => {
  it('builds newest-first booking archive rows across partner roles', () => {
    const archive = buildPartnerBookingArchive({
      participants: [
        {
          booking: booking({
            chatRoom: {
              id: 'chat-joined',
              messages: [
                { body: 'Joined partner update that is long enough to trim in the archive row', id: 'm1' },
              ],
            },
            createdAt: '2026-06-09T08:00:00.000Z',
            id: 'booking-joined',
          }),
          id: 'participant-1',
          status: 'JOINED',
        },
      ],
      preferredBookings: [booking({ createdAt: '2026-06-10T08:00:00.000Z', id: 'booking-preferred' })],
      selectedBookings: [booking({ createdAt: '2026-06-11T08:00:00.000Z', id: 'booking-selected' })],
    });

    expect(archive.map((record) => [record.relation, record.booking.id])).toEqual([
      ['Selected', 'booking-selected'],
      ['Preferred', 'booking-preferred'],
      ['Joined', 'booking-joined'],
    ]);
    expect(archive[2]?.lastMessage).toBe('Joined partner update that is long enough to trim in the archive row');
  });

  it('deduplicates repeated booking ids per partner relation', () => {
    const repeatedBooking = booking({ createdAt: '2026-06-10T08:00:00.000Z', id: 'booking-repeat' });

    const archive = buildPartnerBookingArchive({
      participants: [
        { booking: repeatedBooking, id: 'participant-1', status: 'JOINED' },
        { booking: repeatedBooking, id: 'participant-2', status: 'JOINED' },
      ],
      preferredBookings: [repeatedBooking],
      selectedBookings: [],
    });

    expect(archive.map((record) => `${record.booking.id}:${record.relation}`)).toEqual([
      'booking-repeat:Preferred',
      'booking-repeat:Joined',
    ]);
  });
});

function booking(input: {
  readonly chatRoom?: {
    readonly id: string;
    readonly messages?: readonly { readonly body: string; readonly id: string }[];
  } | null;
  readonly createdAt: string;
  readonly id: string;
}) {
  return {
    id: input.id,
    chatRoom: input.chatRoom,
    createdAt: input.createdAt,
  };
}
