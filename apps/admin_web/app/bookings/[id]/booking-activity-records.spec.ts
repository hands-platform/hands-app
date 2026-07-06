import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
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
          detail: 'Booking action snapshot / District 1, Ho Chi Minh City',
          href: '#location',
          id: 'action-location',
          title: 'Partner booking action location',
          type: 'LOCATION',
        }),
      ]),
    );
  });

  it('hides raw coordinates for general Partner location snapshots without readable addresses', () => {
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
          title: 'Partner location snapshot',
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
          helper: 'Booking action and Partner location snapshots linked to this booking.',
          label: 'Location',
          value: '2',
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
});
