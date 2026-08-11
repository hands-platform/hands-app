import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildBookingActivityRecords, buildBookingActivitySummary } from './booking-activity-records';

function booking(input: Partial<AdminBookingDetail> = {}): AdminBookingDetail {
  return {
    createdAt: '2026-06-19T01:00:00.000Z',
    id: 'booking-action-location',
    participants: [],
    status: 'COMPLETED',
    updatedAt: '2026-06-19T02:00:00.000Z',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    providerProfileId: 'partner-1',
    recordedAt: '2026-06-19T03:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function recordsFor(input: {
  booking?: Partial<AdminBookingDetail>;
  locationSnapshots?: AdminLocationSnapshot[];
}) {
  const targetBooking = booking(input.booking);

  return buildBookingActivityRecords({
    auditMetadataSummary: () => '',
    booking: targetBooking,
    closureSummary: { detail: 'Closed', status: 'Closed' },
    humanizeAuditAction: (action) => action,
    humanizeNotificationType: (type) => type,
    locationSnapshots: input.locationSnapshots ?? [],
    notificationDataBookingId: () => null,
    notifications: [],
  });
}

describe('buildBookingActivityRecords', () => {
  it('labels booking-linked Partner action locations with readable area text', () => {
    const records = recordsFor({
      locationSnapshots: [
        location({
          addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
          bookingId: 'booking-action-location',
          id: 'action-location',
        }),
      ],
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: 'Booking action record / District 1, Ho Chi Minh City',
          href: '#location',
          id: 'action-location',
          title: 'Partner booking action location',
          type: 'LOCATION',
        }),
      ]),
    );
  });

  it('hides raw coordinates for general Partner location records without readable addresses', () => {
    const records = recordsFor({
      locationSnapshots: [
        location({
          bookingId: null,
          id: 'general-location',
          lat: 10,
          lng: 106,
        }),
      ],
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: 'Location recorded without readable address',
          id: 'general-location',
          title: 'Partner location record',
        }),
      ]),
    );
    expect(JSON.stringify(records)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
  });

  it('summarizes action and general location evidence together', () => {
    const records = recordsFor({
      locationSnapshots: [
        location({ bookingId: 'booking-action-location', id: 'action-location' }),
        location({ bookingId: null, id: 'general-location' }),
      ],
    });

    expect(buildBookingActivitySummary(records)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          helper: 'Booking action and Partner location records linked to this booking.',
          label: 'Location',
          value: '2',
        }),
      ]),
    );
  });

  it('shows preferred rejection reasons and response timing in the operator timeline', () => {
    const records = recordsFor({
      booking: {
        openedAt: '2026-06-19T01:00:00.000Z',
        preferredProviderId: 'partner-1',
        providerRequestEvents: [
          {
            bookingId: 'booking-action-location',
            createdAt: '2026-06-19T01:02:00.000Z',
            eventType: 'PREFERRED_PROVIDER_REJECTED',
            id: 'request-event-1',
            metadata: { reasonCode: 'TOO_FAR', reasonDetail: 'Traffic is too heavy.' },
            providerProfile: { id: 'partner-1', displayName: 'Mai' },
            providerProfileId: 'partner-1',
          },
        ],
      },
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: 'Preferred request / reason TOO_FAR / Traffic is too heavy. / response 120s after opening',
          title: 'Mai declined the preferred request',
          type: 'REQUEST',
        }),
      ]),
    );
  });

  it('uses operator-facing labels for marketplace participant statuses', () => {
    const records = recordsFor({
      booking: {
        participants: [
          {
            id: 'participant-1',
            joinedAt: '2026-06-19T01:01:00.000Z',
            providerStatusAtJoin: 'ONLINE_AVAILABLE',
            respondedAt: '2026-06-19T01:02:00.000Z',
            status: 'SELECTED',
          },
        ],
      },
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ detail: 'Selected / No distance / Ready now' }),
        expect.objectContaining({
          detail: 'Selected / customer can select from participating or accepted Partners.',
        }),
      ]),
    );
    expect(JSON.stringify(records)).not.toContain('ONLINE_AVAILABLE');
  });

  it('shows pre-match customer cancellation deadline, participants, and payment outcome', () => {
    const records = recordsFor({
      booking: {
        closedAt: '2026-06-19T01:04:00.000Z',
        closedByRole: 'CUSTOMER',
        closedReason: 'customer_cancelled',
        expiresAt: '2026-06-19T01:10:00.000Z',
        participants: [{ id: 'participant-1', status: 'EXPIRED' }],
        payment: { amount: 120000, method: 'WALLET', status: 'RELEASED' },
        status: 'CANCELLED',
      },
    });

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail:
            '360s remained / preferred request waiting / 1 marketplace participant(s) / payment RELEASED',
          title: 'Customer cancelled before final match',
          type: 'CANCELLATION',
        }),
      ]),
    );
  });

  it('keeps raw range timestamps for shared trace summary date atoms', () => {
    const summary = buildBookingActivitySummary([
      {
        at: '2026-06-19T03:00:00.000Z',
        detail: 'Latest event',
        id: 'latest',
        title: 'Latest',
        type: 'BOOKING',
      },
      {
        at: '2026-06-19T01:00:00.000Z',
        detail: 'Oldest event',
        id: 'oldest',
        title: 'Oldest',
        type: 'AUDIT',
      },
    ]);

    expect(summary[0]).toMatchObject({
      detailDateTimePrefix: 'Oldest loaded: ',
      detailDateTimeValue: '2026-06-19T01:00:00.000Z',
      label: 'Range',
      valueDateTimeValue: '2026-06-19T03:00:00.000Z',
    });
  });

  it('keeps payment activity money on the shared MoneyText atom while preserving CSV detail text', () => {
    const records = recordsFor({
      booking: {
        payment: {
          amount: 120000,
          currency: 'VND',
          id: 'payment-1',
          method: 'CARD',
          providerRef: 'gateway-ref-1',
          status: 'PAID',
        },
      },
    });

    const paymentRecord = records.find((record) => record.id === 'payment-1');

    expect(paymentRecord).toMatchObject({
      detail: '120.000 VND / ref gateway-ref-1',
      title: 'PAID CARD payment',
      type: 'PAYMENT',
    });
    expect(renderToStaticMarkup(paymentRecord?.detailNode)).toContain(
      'class="money-text money-text-positive"',
    );
    expect(renderToStaticMarkup(paymentRecord?.detailNode)).toContain('120.000 VND');
  });
});
