import type { PartnerBookingArchiveRecord } from './partner-detail-booking-model';
import { buildPartnerActivityRecords } from './partner-detail-activity-records-model';
import type { PartnerDetailBooking } from './partner-detail-record-helpers';
import type { ProviderDetail } from './partner-detail-types';

type BookingRecord = PartnerBookingArchiveRecord<PartnerDetailBooking>;

describe('partner detail activity records model', () => {
  it('combines booking, chat, finance, location, and booking gate evidence in newest-first order', () => {
    const provider = providerFixture({
      auditLogs: [
        {
          action: 'booking.create.rejected',
          createdAt: '2026-07-20T12:00:00.000Z',
          id: 'audit-gate-1',
          metadata: {
            bookingAddress: { addressText: '12 Nguyen Hue' },
            preferredProviderDistanceMeters: 6200,
            reasonCode: 'PREFERRED_PROVIDER_TOO_FAR',
          },
          target: 'provider',
        },
      ],
      earnings: [
        {
          bookingId: 'booking-1',
          createdAt: '2026-07-20T11:30:00.000Z',
          currency: 'VND',
          grossAmount: 420000,
          id: 'earning-1',
          netAmount: 330000,
          platformFee: 70000,
          providerProfileId: 'partner-1',
          status: 'AVAILABLE',
          withholdingAmount: 20000,
        },
      ],
      id: 'partner-1',
      locationSnapshots: [
        {
          id: 'location-1',
          lat: 10.775,
          lng: 106.7,
          recordedAt: '2026-07-20T11:45:00.000Z',
        },
      ],
      user: {
        createdAt: '2026-07-01T08:00:00.000Z',
        id: 'user-1',
        phone: '+84000000001',
      },
    });
    const booking = bookingRecord({
      chatRoom: {
        id: 'chat-1',
        messages: [
          {
            body: 'Please cancel this booking.',
            createdAt: '2026-07-20T10:30:00.000Z',
            id: 'message-1',
            sender: { fullName: 'Customer One', roles: ['CUSTOMER'] },
          },
        ],
      },
      closedAt: '2026-07-20T11:00:00.000Z',
      closedByRole: 'CUSTOMER',
      closedReason: 'CHANGED_MIND',
      notes: 'Initial note\nOperator reviewed cancellation.',
      status: 'CANCELLED',
      updatedAt: '2026-07-20T11:05:00.000Z',
    });

    const rows = buildPartnerActivityRecords(provider, [booking]);

    expect(rows[0]).toMatchObject({
      at: '2026-07-20T12:00:00.000Z',
      id: 'audit-gate-1',
      title: expect.stringContaining('Booking create stopped'),
      type: 'OPS',
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'booking-1', type: 'BOOKING' }),
        expect.objectContaining({ id: 'booking-1-closure', type: 'BOOKING' }),
        expect.objectContaining({ id: 'message-1', type: 'CHAT' }),
        expect.objectContaining({ id: 'booking-1-booking-note', type: 'OPS' }),
        expect.objectContaining({ id: 'earning-1', type: 'EARNING' }),
        expect.objectContaining({ id: 'location-1', type: 'LOCATION' }),
        expect.objectContaining({ id: 'user-1', type: 'ACCOUNT' }),
      ]),
    );
    expect(rows.find((row) => row.id === 'booking-1-booking-note')?.detail).toBe(
      'Operator reviewed cancellation.',
    );
  });

  it('drops records without a usable date while retaining dated KYC and control history', () => {
    const provider = providerFixture({
      bankAccounts: [
        {
          accountHolderName: 'Tran Linh',
          bankName: 'Vietcombank',
          id: 'bank-undated',
          isPrimary: true,
          status: 'PENDING',
        },
      ],
      id: 'partner-2',
      kyc: {
        cccdNumberLast4: '1234',
        id: 'kyc-1',
        status: 'PENDING',
        submittedAt: '2026-07-19T08:00:00.000Z',
      },
      sanctions: [
        {
          createdAt: '2026-07-19T09:00:00.000Z',
          id: 'sanction-1',
          providerProfileId: 'partner-2',
          reason: 'Manual review',
          startsAt: '2026-07-19T09:00:00.000Z',
          status: 'ACTIVE',
          type: 'WARNING',
        },
      ],
    });

    const rows = buildPartnerActivityRecords(provider, []);

    expect(rows.map((row) => row.id)).toEqual(['sanction-1', 'kyc-1-submitted']);
    expect(rows.some((row) => row.id === 'bank-undated')).toBe(false);
  });
});

function providerFixture(overrides: Partial<ProviderDetail> = {}): ProviderDetail {
  return overrides as ProviderDetail;
}

function bookingRecord(overrides: Partial<PartnerDetailBooking> = {}): BookingRecord {
  return {
    booking: {
      createdAt: '2026-07-20T10:00:00.000Z',
      customerProfile: {
        user: { fullName: 'Customer One', phone: '+84000000002' },
      },
      customerProfileId: 'customer-1',
      id: 'booking-1',
      services: [
        {
          id: 'service-row-1',
          price: 420000,
          quantity: 1,
          service: { name: 'Aroma massage' },
        },
      ],
      ...overrides,
    },
    lastMessage: null,
    relation: 'Selected',
  };
}
