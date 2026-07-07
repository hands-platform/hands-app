import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingOperatingBaseTimelineItems } from './booking-operating-base-timeline-items';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-base-timeline',
    participants: [],
    status: 'CREATED',
    updatedAt: '2026-06-14T02:00:00.000Z',
    ...input,
  } as AdminBookingDetail;
}

function message(input: Partial<AdminChatMessage>): AdminChatMessage {
  return {
    body: 'Hello from chat',
    createdAt: '2026-06-14T03:00:00.000Z',
    id: 'message-1',
    ...input,
  } as AdminChatMessage;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.762622,
    lng: 106.660172,
    providerProfileId: 'partner-1',
    recordedAt: '2026-06-14T04:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('bookingOperatingBaseTimelineItems', () => {
  it('adds booking creation and pending address items for a created booking', () => {
    const items = bookingOperatingBaseTimelineItems({
      booking: booking({
        customerProfile: {
          user: { phone: '+84900000001' },
        } as AdminBookingDetail['customerProfile'],
      }),
      addressLine: 'District 1 address',
      addressPin: '10.762622, 106.660172',
      messages: [],
    });

    expect(items).toEqual([
      expect.objectContaining({
        detail: '+84900000001 requested Service pending.',
        id: 'created-booking-base-timeline',
        status: 'Recorded',
        type: 'BOOK',
      }),
      expect.objectContaining({
        detail: 'This booking is still using older address data. Confirm before dispatch.',
        id: 'address-booking-base-timeline',
        status: 'Pending',
        type: 'ADDR',
      }),
    ]);
  });

  it('adds matching, participant, and customer selection items', () => {
    const items = bookingOperatingBaseTimelineItems({
      booking: booking({
        addressSnapshot: {
          addressText: 'District 2 address',
          id: 'address-snapshot-1',
        } as AdminBookingDetail['addressSnapshot'],
        openedAt: '2026-06-14T01:05:00.000Z',
        participants: [
          {
            distanceMeters: 500,
            id: 'participant-1',
            joinedAt: '2026-06-14T01:10:00.000Z',
            providerProfile: {
              displayName: 'Partner One',
              id: 'partner-1',
            },
            providerStatusAtJoin: 'AVAILABLE',
            respondedAt: '2026-06-14T01:12:00.000Z',
            status: 'ACCEPTED',
          },
        ] as AdminBookingDetail['participants'],
        preferredProvider: {
          displayName: 'Preferred Partner',
          id: 'partner-preferred',
        },
        selectedProvider: {
          displayName: 'Selected Partner',
          id: 'partner-selected',
        },
        status: 'MATCHED',
      }),
      addressLine: 'District 2 address',
      addressPin: '10.780000, 106.740000',
      messages: [],
    });

    expect(items.map((item) => item.type)).toContain('MATCH');
    expect(items.find((item) => item.id === 'matching-opened-booking-base-timeline')).toMatchObject({
      detail: 'First-pick Partner: Preferred Partner.',
    });
    expect(items.find((item) => item.id === 'participant-joined-participant-1')).toMatchObject({
      detail: 'ACCEPTED / 500 m / AVAILABLE',
      title: 'Partner One entered marketplace shortlist',
    });
    expect(items.find((item) => item.id === 'participant-responded-participant-1')).toMatchObject({
      detail: 'Partner response recorded as ACCEPTED.',
    });
    expect(items.find((item) => item.id === 'selected-partner-selected')).toMatchObject({
      detail: 'Selected Partner is the final customer-selected Partner.',
    });
    expect(items.find((item) => item.id === 'address-address-snapshot-1')).toMatchObject({
      detail: 'District 2 address / confirmed service address saved',
      title: 'Confirmed address locked',
    });
    expect(JSON.stringify(items)).not.toMatch(/service address snapshot/i);
    expect(JSON.stringify(items)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
  });

  it('adds chat ready, latest message, and latest location items when evidence exists', () => {
    const items = bookingOperatingBaseTimelineItems({
      booking: booking({
        chatRoom: { id: 'chat-room-1' },
        status: 'MATCHED',
      }),
      addressLine: 'District 3 address',
      addressPin: '10.790000, 106.750000',
      latestLocation: location(),
      messages: [
        message({
          body: 'A'.repeat(120),
          id: 'message-long',
          sender: { fullName: 'Customer One', id: 'customer-user' },
        }),
      ],
    });

    expect(items.find((item) => item.type === 'CHAT')).toMatchObject({
      detail: '1 message(s) are retained for admin support.',
      id: 'chat-ready-chat-room-1',
    });
    expect(items.find((item) => item.type === 'MSG')?.detail).toContain('Customer One: ');
    expect(items.find((item) => item.type === 'LOC')).toMatchObject({
      detail: expect.stringMatching(/^Location recorded without readable address \//),
      id: 'location-location-1',
      status: 'Location',
      title: 'Latest Partner location shared',
    });
    expect(JSON.stringify(items)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
  });

  it('adds pending chat and location items for active bookings without handoff evidence', () => {
    const items = bookingOperatingBaseTimelineItems({
      booking: booking({
        status: 'PROVIDER_ON_THE_WAY',
      }),
      addressLine: 'District 4 address',
      addressPin: '10.800000, 106.760000',
      messages: [],
    });

    expect(items.find((item) => item.type === 'CHAT')).toMatchObject({
      id: 'chat-missing-booking-base-timeline',
      status: 'Repair',
    });
    expect(items.find((item) => item.type === 'LOC')).toMatchObject({
      id: 'location-missing-booking-base-timeline',
      status: 'Pending',
    });
  });
});
