import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import type { BookingActivityRecord } from './booking-activity-records';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingFinanceTrace } from './booking-finance-trace';
import type { bookingNotificationTrace } from './booking-notification-trace';
import { bookingDetailEvidenceBundleRows } from './booking-detail-evidence-bundle-rows';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-evidence-bundle-rows',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function message(input: Partial<AdminChatMessage> = {}): AdminChatMessage {
  return {
    body: 'Chat body',
    createdAt: '2026-06-14T01:05:00.000Z',
    id: 'message-1',
    ...input,
  } as AdminChatMessage;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    recordedAt: '2026-06-14T01:10:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

function activity(input: Partial<BookingActivityRecord> = {}): BookingActivityRecord {
  return {
    at: '2026-06-14T01:20:00.000Z',
    bucket: 'Booking',
    detail: 'Booking matched.',
    href: '#booking-activity',
    title: 'booking.matched',
    ...input,
  } as BookingActivityRecord;
}

function notificationTrace(input: Record<string, unknown> = {}) {
  return {
    backupBatches: [],
    metrics: [],
    rows: [],
    ...input,
  } as unknown as ReturnType<typeof bookingNotificationTrace>;
}

function financeTrace(input: Partial<ReturnType<typeof bookingFinanceTrace>> = {}) {
  return {
    customerPrice: '450.000 VND',
    providerPayout: '330.000 VND',
    walletLedger: 'No entry',
    ...input,
  } as unknown as ReturnType<typeof bookingFinanceTrace>;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    messages: [message({ id: 'message-1' }), message({ id: 'message-2' })],
    latestLocation: location(),
    locationTrailCount: 1,
    notificationTrace: notificationTrace({
      backupBatches: [{ id: 'batch-1' }],
      rows: [{ deliveryStatuses: ['FAILED'], isPartnerAlert: true }],
    }),
    financeTrace: financeTrace(),
    refundLedgerCount: 0,
    operatorNoteLines: ['Called customer and Partner.'],
    bookingActivityRecords: [activity()],
    finalPartnerSummary: bookingFinalPartnerSummary(input),
    customerChoiceCandidates: 1,
    failedAlertCount: 1,
    chatReady: true,
  };
}

describe('bookingDetailEvidenceBundleRows', () => {
  it('maps customer, Partner, chat, money, location, alert, and trail evidence', () => {
    const input = booking({
      addressSnapshot: {
        addressText: 'District 3 service address',
        latitude: 10.762622,
        longitude: 106.660172,
      } as AdminBookingDetail['addressSnapshot'],
      chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
      customerProfile: {
        id: 'customer-profile-1',
        user: {
          fullName: 'Mai Customer',
          phone: '+84000000001',
        },
      } as AdminBookingDetail['customerProfile'],
      payment: {
        id: 'payment-row-1234567890',
        method: 'CARD',
        status: 'AUTHORIZED',
      } as AdminBookingDetail['payment'],
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
      } as AdminBookingDetail['selectedProvider'],
    });

    const rows = bookingDetailEvidenceBundleRows(baseInput(input));

    expect(rows.map((row) => row.lane)).toEqual([
      'Customer',
      'Address',
      'Partner',
      'Chat',
      'Money',
      'Location',
      'Alerts',
      'Operator trail',
    ]);
    expect(rows.find((row) => row.lane === 'Customer')).toMatchObject({
      recordLabel: 'customer',
      status: 'Linked',
    });
    expect(rows.find((row) => row.lane === 'Partner')).toMatchObject({
      evidence: 'Linh Partner / Missing',
      href: '/partners/partner-selected',
      status: 'Selected',
    });
    expect(rows.find((row) => row.lane === 'Alerts')).toMatchObject({
      status: '1 failed',
      tone: 'pill-warn',
    });
    expect(rows.find((row) => row.lane === 'Location')).toMatchObject({
      evidence: '14 Jun 2026, 08:10',
      evidenceDateTimePrefix: 'Location recorded without readable address / ',
      evidenceDateTimeValue: '2026-06-14T01:10:00.000Z',
    });
    expect(rows.find((row) => row.lane === 'Chat')).toMatchObject({
      evidenceDateTimePrefix: '2 retained message(s), latest ',
      evidenceDateTimeValue: '2026-06-14T01:05:00.000Z',
    });
    expect(rows.find((row) => row.lane === 'Operator trail')).toMatchObject({
      evidence: '14 Jun 2026, 08:20',
      evidenceDateTimePrefix: 'booking.matched / ',
      evidenceDateTimeValue: '2026-06-14T01:20:00.000Z',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });

  it('keeps missing chat, money, and operator trail evidence visible', () => {
    const input = booking({
      payment: null,
      status: 'OPEN_MATCHING',
    });

    const rows = bookingDetailEvidenceBundleRows({
      ...baseInput(input),
      bookingActivityRecords: [],
      chatReady: false,
      customerChoiceCandidates: 0,
      failedAlertCount: 0,
      latestLocation: null,
      locationTrailCount: 0,
      messages: [],
      notificationTrace: notificationTrace(),
      operatorNoteLines: [],
    });

    expect(rows.find((row) => row.lane === 'Customer')).toMatchObject({
      recordLabel: 'Profile missing',
      status: 'Missing',
    });
    expect(rows.find((row) => row.lane === 'Chat')).toMatchObject({
      evidence: 'Chat opens after first-pick match or customer final selection.',
      status: 'Missing',
    });
    expect(rows.find((row) => row.lane === 'Money')).toMatchObject({
      recordLabel: 'No payment row',
      status: 'Missing',
    });
    expect(rows.find((row) => row.lane === 'Operator trail')).toMatchObject({
      evidence: 'No operator trail loaded',
      status: 'Empty',
    });
  });

  it('uses the service address record label instead of service address coordinates', () => {
    const input = booking({
      addressSnapshot: {
        addressText: 'District 3 service address',
        latitude: 10.762622,
        longitude: 106.660172,
      } as AdminBookingDetail['addressSnapshot'],
    });

    const rows = bookingDetailEvidenceBundleRows({
      ...baseInput(input),
      latestLocation: null,
      locationTrailCount: 0,
    });

    expect(rows.find((row) => row.lane === 'Location')).toMatchObject({
      evidence: 'Confirmed service address District 3 service address',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });
});
