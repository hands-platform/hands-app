import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import type { bookingNotificationTrace } from './booking-notification-trace';
import { bookingDetailActionEvidenceGate } from './booking-detail-action-evidence-gate';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    expiresAt: '2026-06-14T01:45:00.000Z',
    id: 'booking-detail-action-evidence-gate',
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

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    messages: [message(), message({ id: 'message-2' })],
    latestLocation: location(),
    notificationTrace: notificationTrace({
      rows: [{ deliveryStatuses: ['SENT'] }],
    }),
    operatorNoteLines: ['Called customer and Partner.'],
    refundLedgerCount: 0,
    cashDebt: false,
    closeoutReadiness: {
      helper: 'All evidence is reconciled.',
      openItems: [],
      status: 'Ready',
      tone: 'pill-success',
    },
  };
}

describe('bookingDetailActionEvidenceGate', () => {
  it('marks completed authorized payment capture as evidence ready with retained chat', () => {
    const input = booking({
      chatRoom: { id: 'chat-room-retained' } as AdminBookingDetail['chatRoom'],
      payment: {
        id: 'payment-1',
        providerRef: 'momo-ref-1',
        status: 'AUTHORIZED',
      } as AdminBookingDetail['payment'],
      status: 'COMPLETED',
    });

    const gate = bookingDetailActionEvidenceGate(baseInput(input));

    expect(gate.rows.find((row) => row.action === 'Payment capture')).toMatchObject({
      className: 'ops-task-done',
      pillClass: 'pill-success',
      status: 'Evidence ready',
    });
    expect(gate.rows.find((row) => row.action === 'Release or refund')?.evidence).toContain(
      '2 chat message(s)',
    );
  });

  it('keeps missing decision evidence and cash debt blockers visible', () => {
    const input = booking({
      earning: {
        netAmount: -120000,
        status: 'PENDING',
      } as AdminBookingDetail['earning'],
      payment: {
        id: 'payment-cash',
        method: 'CASH',
        status: 'AUTHORIZED',
      } as AdminBookingDetail['payment'],
    });

    const gate = bookingDetailActionEvidenceGate({
      ...baseInput(input),
      cashDebt: true,
      latestLocation: null,
      messages: [],
      notificationTrace: notificationTrace(),
      operatorNoteLines: [],
    });

    expect(gate.rows.find((row) => row.action === 'Release or refund')).toMatchObject({
      className: 'ops-task-warning',
      status: 'Needs evidence',
    });
    expect(gate.rows.find((row) => row.action === 'Cash fee settlement')).toMatchObject({
      className: 'ops-task-blocked',
      href: '/cash-settlements',
      pillClass: 'pill-danger',
      status: 'Evidence required',
    });
  });

  it('keeps matching expiry time available for shared date rendering', () => {
    const input = booking({
      addressSnapshot: null,
      payment: null,
      status: 'OPEN_MATCHING',
    });

    const gate = bookingDetailActionEvidenceGate({
      ...baseInput(input),
      latestLocation: null,
      messages: [],
      notificationTrace: notificationTrace(),
      operatorNoteLines: [],
    });

    expect(gate.rows.find((row) => row.action === 'Expire matching')).toMatchObject({
      evidence: '14 Jun 2026, 08:45',
      evidenceDateTimePrefix: 'Address snapshot missing / expires ',
      evidenceDateTimeValue: '2026-06-14T01:45:00.000Z',
    });
  });
});
