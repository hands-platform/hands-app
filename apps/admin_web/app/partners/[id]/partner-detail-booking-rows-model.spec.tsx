import {
  buildPartnerBookingChatRecordRows,
  buildPartnerBookingEvidenceRows,
  buildPartnerBookingJourneyRows,
  buildPartnerEarningsByBookingId,
} from './partner-detail-booking-rows-model';
import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import type { PartnerDetailBooking } from './partner-detail-record-helpers';
import type { PartnerDispatchPolicy, ProviderDetail } from './partner-detail-types';

type BookingRecord = PartnerBookingArchiveRecord<PartnerDetailBooking>;

describe('partner detail booking rows model', () => {
  it('maps retained chat, customer, payment, and closure evidence without changing record links', () => {
    const rows = buildPartnerBookingChatRecordRows([
      bookingRecord({
        chatRoom: {
          id: 'chat-1',
          messages: [
            chatMessage('message-4', 'System evidence', '2026-07-20T10:04:00.000Z'),
            chatMessage('message-2', 'Partner response', '2026-07-20T10:02:00.000Z', ['PROVIDER']),
            chatMessage('message-3', 'Admin note', '2026-07-20T10:03:00.000Z', ['ADMIN']),
            chatMessage('message-1', 'Customer request', '2026-07-20T10:01:00.000Z', ['CUSTOMER']),
          ],
        },
        closedAt: '2026-07-20T11:00:00.000Z',
        closedByRole: 'CUSTOMER',
        closedReason: 'CHANGED_MIND',
        customerProfile: {
          user: { fullName: 'Customer One', phone: '+84000000001' },
        },
        customerProfileId: 'customer-1',
        payment: {
          amount: 420000,
          currency: 'VND',
          method: 'CARD',
          status: 'REFUNDED',
        },
        status: 'CANCELLED',
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      bookingHref: '/bookings/booking-1',
      chatHref: '/chat-archive?q=booking-1',
      customerHref: '/customers/customer-1',
      hasChatRoom: true,
      relation: 'Selected',
    });
    expect(rows[0]?.chatMessages.map((message) => message.role)).toEqual([
      'CUSTOMER',
      'PROVIDER',
      'ADMIN',
      'SYSTEM',
    ]);
    expect(rows[0]?.closureLine).toContain('customer closure / CHANGED MIND');
    expect(rows[0]?.paymentLine).toContain('CARD');
  });

  it('connects booking evidence to the matching earning and wallet ledger rows', () => {
    const provider = providerFixture({
      currentLocationUpdatedAt: '2026-07-20T09:30:00.000Z',
      id: 'partner-1',
    });
    const booking = bookingRecord({
      addressSnapshot: {
        addressText: '12 Nguyen Hue, District 1',
        id: 'address-1',
        latitude: 10.775,
        longitude: 106.7,
      },
      chatRoom: {
        id: 'chat-evidence-1',
        messages: [chatMessage('message-evidence-1', 'On my way', '2026-07-20T10:05:00.000Z', ['PROVIDER'])],
      },
      participants: [
        {
          id: 'participant-1',
          joinedAt: '2026-07-20T09:55:00.000Z',
          providerProfileId: 'partner-1',
          respondedAt: '2026-07-20T09:57:00.000Z',
          status: 'ACCEPTED',
        },
      ],
      payment: {
        amount: 420000,
        currency: 'VND',
        method: 'MOMO',
        status: 'PAID',
      },
      status: 'COMPLETED',
    });
    const earningsByBookingId = buildPartnerEarningsByBookingId([
      {
        bookingId: 'booking-1',
        createdAt: '2026-07-20T11:00:00.000Z',
        currency: 'VND',
        grossAmount: 420000,
        id: 'earning-1',
        netAmount: 330000,
        platformFee: 70000,
        providerProfileId: 'partner-1',
        status: 'AVAILABLE',
        withholdingAmount: 20000,
        walletLedgerEntries: [
          {
            amount: 330000,
            currency: 'VND',
            id: 'wallet-entry-1',
            sourceKey: 'booking-1',
            type: 'BOOKING_EARNING',
          },
        ],
      },
      {
        bookingId: '',
        currency: 'VND',
        grossAmount: 0,
        id: 'earning-without-booking',
        netAmount: 0,
        platformFee: 0,
        providerProfileId: 'partner-1',
        status: 'PENDING',
        withholdingAmount: 0,
      },
    ]);

    const rows = buildPartnerBookingEvidenceRows(provider, [booking], earningsByBookingId);

    expect(earningsByBookingId.size).toBe(1);
    expect(rows[0]).toMatchObject({
      chatHref: '/chat-archive?q=booking-1',
      chatStatus: '1 message(s)',
      customerDetail: expect.stringContaining('12 Nguyen Hue'),
      customerHref: '/customers/customer-1',
      moneyStatus: 'AVAILABLE',
      opsStatus: 'Records linked',
      roleStatus: 'Final partner',
      status: 'COMPLETED',
    });
    expect(rows[0]?.moneyDetail).toContain('1 wallet row(s)');
    expect(rows[0]?.opsDetail).toContain('Latest Partner location saved for dispatch checks.');
  });

  it('builds the operator journey with dispatch policy, latest activity, and connected records', () => {
    const provider = providerFixture({ id: 'partner-1' });
    const record = bookingRecord(
      {
        chatRoom: {
          id: 'chat-journey-1',
          messages: [
            chatMessage('message-journey-1', 'Arrived', '2026-07-20T10:15:00.000Z', ['PROVIDER']),
          ],
        },
        participants: [
          {
            id: 'participant-journey-1',
            joinedAt: '2026-07-20T09:55:00.000Z',
            providerProfileId: 'partner-1',
            status: 'JOINED',
          },
        ],
        status: 'MATCHED',
      },
      'Joined',
    );
    const policy: PartnerDispatchPolicy = {
      backupRadiusMeters: 5000,
      locationFreshnessMinutes: 15,
      responseWindowMinutes: 3,
    };

    const rows = buildPartnerBookingJourneyRows(
      provider,
      [record],
      policy,
      buildPartnerEarningsByBookingId([]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.latestAt).toBe('2026-07-20T10:15:00.000Z');
    expect(rows[0]?.links).toEqual([
      { href: '/bookings/booking-1', label: 'Open booking' },
      { href: '/customers/customer-1', label: 'Open customer' },
      { href: '/chat-archive?q=booking-1', label: 'Open chat archive' },
    ]);
    expect(rows[0]?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Open matching',
          value: expect.stringContaining('Within'),
        }),
        expect.objectContaining({ label: 'Chat', value: '1 retained' }),
      ]),
    );
  });
});

function providerFixture(overrides: Partial<ProviderDetail> = {}): ProviderDetail {
  return overrides as ProviderDetail;
}

function bookingRecord(
  overrides: Partial<PartnerDetailBooking> = {},
  relation: BookingRecord['relation'] = 'Selected',
): BookingRecord {
  return {
    booking: {
      createdAt: '2026-07-20T09:45:00.000Z',
      customerProfile: {
        user: { fullName: 'Customer One', phone: '+84000000001' },
      },
      customerProfileId: 'customer-1',
      id: 'booking-1',
      services: [
        {
          id: 'booking-service-1',
          price: 420000,
          quantity: 1,
          service: { durationMin: 60, name: 'Aroma massage' },
        },
      ],
      ...overrides,
    },
    lastMessage: overrides.chatRoom?.messages?.[0]?.body ?? null,
    relation,
  };
}

function chatMessage(
  id: string,
  body: string,
  createdAt: string,
  roles: string[] = [],
) {
  return {
    body,
    createdAt,
    id,
    sender: {
      fullName: `${roles[0] ?? 'SYSTEM'} sender`,
      roles,
    },
  };
}
