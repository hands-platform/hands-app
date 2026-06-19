import type { AdminBookingDetail } from '../../../lib/admin-api';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BookingDetailLifecycleListSection,
  bookingDetailLifecycleListRows,
  bookingDetailLifecycleTimelineItems,
} from './booking-detail-lifecycle-list-section';

describe('bookingDetailLifecycleListRows', () => {
  it('keeps realtime and post-match list rows for an in-progress booking detail', () => {
    const rows = bookingDetailLifecycleListRows(
      bookingFixture({ status: 'IN_SERVICE' }),
      new Date('2026-06-19T08:00:00.000Z').getTime(),
    );

    expect(rows.map((row) => row.groupKey)).toEqual(['pre-match', 'post-match-in-progress']);
    expect(rows[0]?.row.booking.status).toBe('OPEN_MATCHING');
    expect(rows[1]?.row.booking.status).toBe('IN_SERVICE');
  });

  it('adds the completed list row when the booking is completed', () => {
    const rows = bookingDetailLifecycleListRows(
      bookingFixture({
        closedAt: '2026-06-19T08:45:00.000Z',
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T08:45:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    expect(rows.map((row) => row.groupKey)).toEqual(['pre-match', 'post-match-in-progress', 'completed']);
  });

  it('adds the pending post-match cancellation review row when admin processing is required', () => {
    const rows = bookingDetailLifecycleListRows(
      bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        closedReason: 'partner_cancelled',
        status: 'CANCELLED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    expect(rows.map((row) => row.groupKey)).toEqual([
      'pre-match',
      'post-match-in-progress',
      'post-match-cancellations-pending',
    ]);
  });

  it('builds compact timeline items instead of repeating full table rows', () => {
    const items = bookingDetailLifecycleTimelineItems(
      bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        closedReason: 'partner_cancelled',
        snapshots: [
          {
            addressText: 'Cau Giay, Ha Noi',
            id: 'location-cancel',
            lat: 21.0362,
            lng: 105.7822,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T08:39:00.000Z',
          },
        ],
        status: 'CANCELLED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    expect(items.map((item) => item.title)).toEqual([
      'Realtime booking request',
      'Partner matched and service is moving',
      'Post-match cancellation needs admin review',
    ]);
    expect(items[0]?.meta.find((meta) => meta.label === 'Service')?.value).toBe(
      'Aromatherapy Massage / 90 min / 500.000 VND',
    );
    expect(items[0]?.meta.find((meta) => meta.label === 'Requested')?.value).toBe('Not selected');
    expect(items[1]?.meta.find((meta) => meta.label === 'Participating')?.value).toBe('1 Partner');
    expect(items.at(-1)?.meta.map((meta) => meta.label)).toEqual([
      'Matched Partner',
      'Cancellation location',
      'Location capture',
      'Closed reason',
      'Review',
    ]);
    expect(items.at(-1)?.meta.find((meta) => meta.label === 'Cancellation location')?.value).toBe(
      'Cau Giay, Ha Noi',
    );
    expect(items.at(-1)?.detail).toContain(
      'Cancellation location is the Partner snapshot nearest the cancellation state.',
    );
  });

  it('prefers booking action location snapshots over generic Partner locations around closeout', () => {
    const items = bookingDetailLifecycleTimelineItems(
      bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        snapshots: [
          {
            addressText: 'Ng. 91 P. Chua Lang, Lang, Ha Noi, Vietnam',
            bookingId: 'booking-1',
            id: 'action-location-after-closeout',
            lat: 21.0245,
            lng: 105.8067,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T08:40:30.000Z',
          },
        ],
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
        selectedProvider: {
          displayName: 'Partner Matched',
          id: 'partner-1',
          locationSnapshots: [
            {
              addressText: '33 Nguyen Dinh Chieu, Sai Gon, Ho Chi Minh City, Vietnam',
              id: 'generic-location-before-closeout',
              lat: 10.7823,
              lng: 106.6978,
              providerProfileId: 'partner-1',
              recordedAt: '2026-06-19T08:39:50.000Z',
            },
          ],
          status: 'ONLINE_BUSY',
          user: { phone: '+84911111111' },
        },
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    const completed = items.find((item) => item.groupKey === 'completed');

    expect(completed?.meta.find((meta) => meta.label === 'Completion location')?.value).toBe('Lang, Ha Noi');
    expect(completed?.meta.find((meta) => meta.label === 'Location capture')?.value).toContain(
      '19 Jun 2026, 15:40',
    );
  });

  it('renders Vuexy-style lifecycle timeline markup', () => {
    const rendered = renderToStaticMarkup(
      <BookingDetailLifecycleListSection
        booking={bookingFixture({
          closedAt: '2026-06-19T08:40:00.000Z',
          closedReason: 'partner_cancelled',
          status: 'CANCELLED',
          statusChangedAt: '2026-06-19T08:40:00.000Z',
        })}
      />,
    );

    expect(rendered).toContain('Booking lifecycle timeline');
    expect(rendered).toContain('vuexy-basic-timeline');
    expect(rendered).toContain('Post-match cancellation needs admin review');
    expect(rendered).not.toContain('<table');
  });
});

function bookingFixture(input: Partial<AdminBookingDetail> = {}): AdminBookingDetail {
  return {
    id: 'booking-1',
    createdAt: '2026-06-19T07:00:00.000Z',
    customerProfileId: 'customer-profile-1',
    customerProfile: {
      id: 'customer-profile-1',
      user: {
        appSessions: [{ deviceLanguage: 'vi-VN' }],
        fullName: 'Customer Nguyen',
        phone: '+84900000000',
      },
    },
    lat: 21.036,
    lng: 105.782,
    matchedAt: '2026-06-19T08:00:00.000Z',
    participants: [
      {
        id: 'participant-1',
        providerProfileId: 'partner-1',
        providerProfile: {
          displayName: 'Partner Matched',
          id: 'partner-1',
          status: 'ONLINE_BUSY',
          user: { phone: '+84911111111' },
        },
        status: 'ACCEPTED',
      },
    ],
    selectedProvider: {
      displayName: 'Partner Matched',
      id: 'partner-1',
      status: 'ONLINE_BUSY',
      user: { phone: '+84911111111' },
    },
    selectedProviderId: 'partner-1',
    services: [
      {
        price: 500000,
        quantity: 1,
        service: {
          basePrice: 500000,
          durationMin: 90,
          name: 'Aromatherapy Massage',
        },
      },
    ],
    status: 'MATCHED',
    statusChangedAt: '2026-06-19T08:05:00.000Z',
    updatedAt: '2026-06-19T08:05:00.000Z',
    ...input,
  } as AdminBookingDetail;
}
