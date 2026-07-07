import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import type { BookingActivityRecord } from './booking-activity-records';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingFinanceTrace } from './booking-finance-trace';
import type { bookingNotificationTrace } from './booking-notification-trace';
import { bookingDetailCloseoutChecklist } from './booking-detail-closeout-checklist';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-closeout-checklist',
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
    notificationTrace: notificationTrace({
      rows: [{ deliveryStatuses: ['SENT'] }],
    }),
    financeTrace: financeTrace(),
    refundLedgerCount: 0,
    refundEvidence: 'No refund row',
    operatorNoteLines: ['Called customer and Partner.'],
    bookingActivityRecords: [activity()],
    finalPartnerSummary: bookingFinalPartnerSummary(input),
    customerChoiceCandidates: 1,
    failedAlertCount: 0,
    chatReady: true,
    cashFeeDebtNeedsSettlement: false,
    closeoutReadiness: {
      helper: 'Ready after payment capture.',
      openItems: [{ label: 'capture payment' }],
      status: 'Review',
      tone: 'pill-warn',
    },
  };
}

describe('bookingDetailCloseoutChecklist', () => {
  it('maps booking detail facts into closeout checklist rows', () => {
    const input = booking({
      addressSnapshot: {
        addressText: 'District service address',
        latitude: 10.762622,
        longitude: 106.660172,
      } as AdminBookingDetail['addressSnapshot'],
      chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
      payment: {
        method: 'CARD',
        status: 'AUTHORIZED',
      } as AdminBookingDetail['payment'],
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
      } as AdminBookingDetail['selectedProvider'],
    });

    const rows = bookingDetailCloseoutChecklist(baseInput(input));

    expect(rows.map((row) => row.title)).toEqual([
      'Confirmed service address',
      'Customer final Partner choice',
      'Chat record',
      'Money and wallet gate',
      'Manual outcome evidence',
      'Finance closeout',
      'Location and alert trail',
    ]);
    expect(rows.find((row) => row.title === 'Customer final Partner choice')).toMatchObject({
      href: '/partners/partner-selected',
      status: 'Selected',
    });
    expect(rows.find((row) => row.title === 'Chat record')).toMatchObject({
      detailDateTimeValue: '2026-06-14T01:05:00.000Z',
      status: 'Archived',
    });
    expect(rows.find((row) => row.title === 'Location and alert trail')).toMatchObject({
      detail: 'Location recorded without readable address',
      detailDateTimeValue: '2026-06-14T01:10:00.000Z',
      status: 'Movement saved',
    });
    expect(rows.find((row) => row.title === 'Location and alert trail')?.detail).not.toMatch(
      /\d{2}\.\d{4},\s*\d{3}\.\d{4}/,
    );
  });

  it('keeps repair and cash settlement blockers visible', () => {
    const input = booking({
      earning: {
        netAmount: -120000,
        status: 'PENDING',
      } as AdminBookingDetail['earning'],
      payment: {
        method: 'CASH',
        status: 'CAPTURED',
      } as AdminBookingDetail['payment'],
    });

    const rows = bookingDetailCloseoutChecklist({
      ...baseInput(input),
      cashFeeDebtNeedsSettlement: true,
      chatReady: false,
      customerChoiceCandidates: 0,
      financeTrace: financeTrace({
        walletLedger: '-120.000 VND / 1 entry',
      }),
      latestLocation: null,
      messages: [],
    });

    expect(rows.find((row) => row.title === 'Confirmed service address')).toMatchObject({
      className: 'ops-task-blocked',
      status: 'Repair needed',
    });
    expect(rows.find((row) => row.title === 'Chat record')).toMatchObject({
      href: '/chat-archive?status=missing-room',
      status: 'Repair needed',
    });
    expect(rows.find((row) => row.title === 'Money and wallet gate')).toMatchObject({
      href: '/cash-settlements',
      pillClass: 'pill-danger',
      status: 'Settlement needed',
    });
  });
});
