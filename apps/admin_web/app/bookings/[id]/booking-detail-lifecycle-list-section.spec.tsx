import { readFileSync } from 'node:fs';
import type { AdminBookingDetail } from '../../../lib/admin-api';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BookingDetailLifecycleListSection,
  bookingDetailLifecycleListRows,
  bookingDetailLifecycleTimelineItems,
} from './booking-detail-lifecycle-list-section';

describe('bookingDetailLifecycleListRows', () => {
  it('uses shared Vuexy badge atoms instead of raw lifecycle pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-detail-lifecycle-list-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className="pill pill-info">{timelineItems.length} stage(s)</span>');
    expect(source).not.toContain('<span className={`pill ${timelinePillTone(item.tone)}`}>{item.statusLabel}</span>');
  });

  it('uses the shared DateTimeText atom for visible lifecycle timestamps', () => {
    const source = readFileSync('app/bookings/[id]/booking-detail-lifecycle-list-section.tsx', 'utf8');

    expect(source).toContain("import { DateTimeText } from '../../../components/date-time-text';");
    expect(source).toContain('readonly timeLabel: ReactNode;');
    expect(source).toContain('readonly meta: readonly { readonly label: string; readonly value: ReactNode }[];');
    expect(source).toContain('fallback={row.openedDateLabel}');
    expect(source).toContain('<DateTimeText value={booking.matchedAt ?? booking.statusChangedAt ?? booking.updatedAt} />');
    expect(source).toContain('<DateTimeText value={booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt} />');
    expect(source).toContain('Recorded <DateTimeText value={snapshot.recordedAt} />');
    expect(source).not.toContain('timeLabel: formatDate(');
    expect(source).not.toContain('capture: `Recorded ${formatDate(snapshot.recordedAt)}`');
  });

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
    expect(items[1]?.meta.find((meta) => meta.label === 'Partner gate')?.value).toBe(
      'Blocked until completion',
    );
    expect(items.at(-1)?.meta.map((meta) => meta.label)).toEqual([
      'Matched Partner',
      'Cancellation location',
      'Location capture',
      'Closed reason',
      'Partner gate',
      'Review',
    ]);
    expect(items.at(-1)?.meta.find((meta) => meta.label === 'Cancellation location')?.value).toBe(
      'Cau Giay, Ha Noi',
    );
    expect(items.at(-1)?.meta.find((meta) => meta.label === 'Partner gate')?.value).toBe(
      'Eligible during review',
    );
    expect(items.at(-1)?.detail).toContain(
      'Cancellation location is captured only when the Partner cancels after match.',
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
    expect(renderToStaticMarkup(<>{completed?.meta.find((meta) => meta.label === 'Location capture')?.value}</>)).toContain(
      '19 Jun 2026, 15:40',
    );
    expect(completed?.meta.find((meta) => meta.label === 'Partner gate')?.value).toBe(
      'Eligible after completion',
    );
    expect(completed?.detail).toContain('Completion location is captured only when the Partner taps complete.');
  });

  it('hides raw coordinate fallback for lifecycle checkpoint locations', () => {
    const items = bookingDetailLifecycleTimelineItems(
      bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        closedReason: 'partner_cancelled',
        snapshots: [
          {
            id: 'action-location-without-address',
            lat: 21.0245,
            lng: 105.8067,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-19T08:39:00.000Z',
          },
        ],
        status: 'CANCELLED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    expect(items.at(-1)?.meta.find((meta) => meta.label === 'Cancellation location')?.value).toBe(
      'Location recorded without readable address',
    );
    expect(JSON.stringify(items)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
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
    expect(rendered).toContain('card admin-section booking-detail-lifecycle-list admin-mb-16');
    expect(rendered).toContain('vuexy-basic-timeline');
    expect(rendered).toContain('Post-match cancellation needs admin review');
    expect(rendered).toContain('aria-label="Customer: Customer Nguyen"');
    expect(rendered).toContain('<span>Customer</span> <strong>Customer Nguyen</strong>');
    expect(rendered).not.toContain('<table');
  });

  it('keeps completed timeline copy concise for operators', () => {
    const items = bookingDetailLifecycleTimelineItems(
      bookingFixture({
        closedAt: '2026-06-19T08:40:00.000Z',
        closedNote: 'Service Completed / Smoke: service completed; closeout reconciliation still needs review.',
        closedReason: 'provider_closure',
        payment: { amount: 500000, method: 'MOMO', status: 'CAPTURED' },
        status: 'COMPLETED',
        statusChangedAt: '2026-06-19T08:40:00.000Z',
      }),
      new Date('2026-06-19T09:00:00.000Z').getTime(),
    );

    const completed = items.find((item) => item.groupKey === 'completed');

    expect(completed?.detail).toContain('Service completed; closeout reconciliation still needs review.');
    expect(completed?.detail).not.toContain('provider closure /');
    expect(completed?.detail).not.toContain('Smoke:');
    expect(completed?.meta.find((meta) => meta.label === 'Payment')?.value).toBe('500.000 VND / CAPTURED');
    expect(completed?.meta.map((meta) => meta.label)).toEqual([
      'Matched Partner',
      'Completion location',
      'Location capture',
      'Payment',
      'Partner gate',
    ]);
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
