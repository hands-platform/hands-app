import {
  buildPartnerBookingArchive,
  buildPartnerChatRetentionRows,
  buildPartnerChatRetentionSummary,
  countDistinctActivePartnerBookings,
} from './partner-detail-booking-model';

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

  it('counts one active job even when the booking appears in several partner relations', () => {
    const activeBooking = booking({
      createdAt: '2026-06-10T08:00:00.000Z',
      id: 'booking-active',
      status: 'IN_SERVICE',
    });
    const archive = buildPartnerBookingArchive({
      participants: [{ booking: activeBooking, id: 'participant-1', status: 'JOINED' }],
      preferredBookings: [activeBooking],
      selectedBookings: [activeBooking],
    });

    expect(countDistinctActivePartnerBookings(archive)).toBe(1);
  });

  it('builds chat retention rows and summary for admin archive evidence', () => {
    const rows = buildPartnerChatRetentionRows([
      {
        booking: booking({
          chatRoom: {
            id: 'chat-active',
            messages: [
              {
                body: 'Customer says hello',
                createdAt: '2026-06-10T08:00:00.000Z',
                id: 'message-1',
                sender: { fullName: 'Mai Customer', roles: ['CUSTOMER'] },
              },
            ],
          },
          createdAt: '2026-06-10T07:00:00.000Z',
          customerProfile: { user: { fullName: 'Mai Customer' } },
          id: 'booking-active',
          services: [{ id: 'service-1', price: 100000, quantity: 1, service: { name: 'Thai Massage' } }],
          status: 'COMPLETED',
        }),
        lastMessage: 'Customer says hello',
        relation: 'Selected',
      },
      {
        booking: booking({
          createdAt: '2026-06-09T07:00:00.000Z',
          customerProfile: { user: { phone: '+84900000000' } },
          id: 'booking-missing-room',
          status: 'MATCHED',
        }),
        lastMessage: null,
        relation: 'Preferred',
      },
    ]);

    expect(rows[0]).toMatchObject({
      adminRetention: 'Admin archive retained',
      latestMessage: 'Customer says hello',
      latestSender: 'Customer: Mai Customer',
      mobileHidden: true,
      relation: 'Selected',
      roomStatus: '1 retained message(s)',
    });
    expect(rows[1]).toMatchObject({
      adminRetention: 'Admin repair needed',
      latestMessage: 'No retained message loaded',
      requiresRoom: true,
      roomStatus: 'Matched booking without room',
      serviceLabel: 'No service / customer +84900000000',
    });
    expect(buildPartnerChatRetentionSummary(rows).map((item) => [item.label, item.value])).toEqual([
      ['Retained rooms', '1'],
      ['Retained messages', '1'],
      ['Matched without room', '1'],
      ['Hidden in mobile', '1'],
    ]);
  });

  it('describes chat opening after first-pick match or customer final selection before match', () => {
    const rows = buildPartnerChatRetentionRows([
      {
        booking: booking({
          createdAt: '2026-06-10T07:00:00.000Z',
          id: 'booking-open',
          status: 'OPEN_MATCHING',
        }),
        lastMessage: null,
        relation: 'Preferred',
      },
    ]);

    expect(rows[0]).toMatchObject({
      mobileVisibility: 'Not visible yet',
      mobileVisibilityDetail: 'Chat opens after first-pick match or customer final selection.',
      roomStatus: 'No room required yet',
    });
  });
});

function booking(input: {
  readonly chatRoom?: {
    readonly id: string;
    readonly messages?: readonly {
      readonly body: string;
      readonly createdAt?: string;
      readonly id: string;
      readonly sender?: {
        readonly fullName?: string | null;
        readonly phone?: string | null;
        readonly roles?: readonly string[] | null;
      } | null;
    }[];
  } | null;
  readonly createdAt: string;
  readonly customerProfile?: { readonly user?: { readonly fullName?: string | null; readonly phone?: string | null } | null } | null;
  readonly id: string;
  readonly services?: readonly {
    readonly id: string;
    readonly price?: number;
    readonly quantity?: number;
    readonly service?: { readonly durationMin?: number | null; readonly name?: string } | null;
  }[];
  readonly status?: string;
}) {
  return {
    chatRoom: input.chatRoom,
    createdAt: input.createdAt,
    customerProfile: input.customerProfile,
    id: input.id,
    services: input.services,
    status: input.status,
  };
}
