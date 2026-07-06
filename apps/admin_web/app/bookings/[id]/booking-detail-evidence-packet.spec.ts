import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import type { BookingRefundLedgerRow } from '../../../lib/booking-refund-ledger';
import type { BookingActivityRecord } from './booking-activity-records';
import { bookingDetailEvidencePacket } from './booking-detail-evidence-packet';
import type { bookingFinanceTrace } from './booking-finance-trace';
import type { bookingNotificationTrace } from './booking-notification-trace';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    address: 'District 1 service address',
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-evidence-packet',
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
    walletLedger: 'No entry',
    ...input,
  } as unknown as ReturnType<typeof bookingFinanceTrace>;
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

describe('bookingDetailEvidencePacket', () => {
  it('maps retained chat, location, alert, refund, finance, and audit evidence', () => {
    const latestLocation = location();
    const packet = bookingDetailEvidencePacket({
      booking: booking({
        addressSnapshot: {
          addressText: 'District 3 service address',
          latitude: 10.762622,
          longitude: 106.660172,
        } as AdminBookingDetail['addressSnapshot'],
        auditLogs: [{ id: 'audit-1' }] as unknown as AdminBookingDetail['auditLogs'],
        chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
        opsTasks: [{ id: 'task-1' }] as unknown as AdminBookingDetail['opsTasks'],
        payment: {
          amount: 450000,
          currency: 'VND',
          method: 'CARD',
          refunds: [
            {
              amount: 120000,
              createdAt: '2026-06-14T01:15:00.000Z',
              id: 'refund-1',
              status: 'PENDING',
            },
          ],
          status: 'AUTHORIZED',
        } as AdminBookingDetail['payment'],
        selectedProvider: {
          id: 'partner-selected',
          locationSnapshots: [latestLocation],
        } as AdminBookingDetail['selectedProvider'],
      }),
      bookingActivityRecords: [activity()],
      financeTrace: financeTrace({
        customerPrice: '450.000 VND customer price',
        walletLedger: '120.000 VND / 1 entry',
      }),
      latestLocation,
      messages: [
        message({ createdAt: '2026-06-14T01:01:00.000Z', id: 'message-1' }),
        message({ createdAt: '2026-06-14T01:05:00.000Z', id: 'message-2' }),
      ],
      notificationTrace: notificationTrace({
        backupBatches: [{ id: 'batch-1' }],
        rows: [
          { deliveryStatuses: ['FAILED'] },
          { deliveryStatuses: ['SENT'] },
        ],
      }),
      operatorNoteLines: ['Called customer and Partner.'],
      refundLedgerRows: [
        {
          amount: 120000,
          id: 'refund-1',
          payment: { currency: 'VND' },
          status: 'PENDING',
        } as BookingRefundLedgerRow,
      ],
    });

    expect(packet.status).toBe('Evidence ready');
    expect(packet.metrics.find((metric) => metric.label === 'Chat evidence')).toMatchObject({
      value: '2 message(s)',
    });
    expect(packet.metrics.find((metric) => metric.label === 'Location evidence')).toMatchObject({
      dateTimeValue: '2026-06-14T01:10:00.000Z',
      helper: 'Location recorded without readable address latest Partner location.',
    });
    expect(packet.metrics.find((metric) => metric.label === 'Refund evidence')).toMatchObject({
      helper: 'PENDING 120.000 VND',
    });
    expect(packet.metrics.find((metric) => metric.label === 'Alert evidence')).toMatchObject({
      helper: '1 failed delivery row(s), 1 marketplace batch(es).',
      value: '2 alert(s)',
    });
    expect(packet.records.find((record) => record.id === 'payment-evidence')).toMatchObject({
      evidence: '450.000 VND customer price / 120.000 VND / 1 entry wallet impact.',
    });
    expect(packet.records.find((record) => record.id === 'audit-evidence')?.evidence).toContain(
      '14 Jun 2026',
    );
    expect(packet.records.find((record) => record.id === 'chat-evidence')).toMatchObject({
      evidenceDateTimePrefix: 'Latest message: ',
      evidenceDateTimeValue: '2026-06-14T01:05:00.000Z',
    });
    expect(packet.records.find((record) => record.id === 'location-evidence')).toMatchObject({
      evidenceDateTimePrefix: 'Recorded ',
      evidenceDateTimeValue: '2026-06-14T01:10:00.000Z',
    });
    expect(packet.records.find((record) => record.id === 'audit-evidence')).toMatchObject({
      evidenceDateTimePrefix: 'Latest event: booking.matched / ',
      evidenceDateTimeValue: '2026-06-14T01:20:00.000Z',
    });
    expect(packet.records.find((record) => record.id === 'address-evidence')).toMatchObject({
      evidence: 'Address snapshot District 3 service address',
    });
    expect(JSON.stringify(packet)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });

  it('keeps missing evidence visible before manual outcome changes', () => {
    const packet = bookingDetailEvidencePacket({
      booking: booking({
        payment: null,
        status: 'OPEN_MATCHING',
      }),
      bookingActivityRecords: [],
      financeTrace: financeTrace({
        customerPrice: 'No customer price',
        walletLedger: 'No wallet impact',
      }),
      latestLocation: null,
      messages: [],
      notificationTrace: notificationTrace(),
      operatorNoteLines: [],
      refundLedgerRows: [],
    });

    expect(packet.status).toBe('Needs evidence');
    expect(packet.tone).toBe('pill-warn');
    expect(packet.summary).toBe(
      'No chat, alert, location, or operator note evidence is attached yet; add a note before manual outcome changes.',
    );
    expect(packet.records.find((record) => record.id === 'note-evidence')).toMatchObject({
      evidence: 'Use operator notes before manual cancellation, no-show, or refund decisions.',
    });
  });
});
