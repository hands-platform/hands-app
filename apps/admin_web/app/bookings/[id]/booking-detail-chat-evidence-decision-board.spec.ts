import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingDetailChatEvidenceDecisionBoard } from './booking-detail-chat-evidence-decision-board';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-chat-board',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function message(input: Partial<AdminChatMessage>): AdminChatMessage {
  return {
    body: 'I am on the way',
    createdAt: '2026-06-14T02:00:00.000Z',
    id: 'message-1',
    sender: {
      fullName: 'Linh Partner',
      id: 'partner-user-1',
      roles: ['PROVIDER'],
    },
    ...input,
  } as AdminChatMessage;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    providerProfileId: 'partner-1',
    recordedAt: '2026-06-14T02:10:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('booking detail chat evidence decision board', () => {
  it('builds retained chat, message, location, alert, and note inputs for the board', () => {
    const board = bookingDetailChatEvidenceDecisionBoard({
      booking: booking({
        auditLogs: [{ id: 'audit-1' }] as AdminBookingDetail['auditLogs'],
        chatRoom: { id: 'chat-room-1234567890' } as AdminBookingDetail['chatRoom'],
      }),
      latestLocation: location(),
      messages: [message({ body: 'I am close to the address' })],
      notificationCount: 2,
      operatorNoteLines: ['Customer confirmed the lobby.'],
    });

    expect(board.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Chat room',
          value: 'chat-roo',
        }),
        expect.objectContaining({
          label: 'Latest message',
          dateTimeValue: '2026-06-14T02:00:00.000Z',
          helper: 'Partner: Linh Partner: I am close to the address',
          value: '14 Jun 2026, 09:00',
        }),
        expect.objectContaining({
          label: 'Location handoff',
          dateTimeValue: '2026-06-14T02:10:00.000Z',
          helper: 'Location recorded without readable address latest Partner location.',
          value: '14 Jun 2026, 09:10',
        }),
        expect.objectContaining({
          label: 'Alerts and notes',
          helper: 'Customer confirmed the lobby.',
          value: '2 alert(s) / 1 note(s)',
        }),
      ]),
    );
    expect(board.rows).toContainEqual(
      expect.objectContaining({
        lane: 'Admin retained context',
        record: '2 notification row(s), 1 audit row(s), 1 note(s).',
      }),
    );
    expect(JSON.stringify(board)).not.toMatch(/\d{1,3}\.\d{4},\s*\d{1,3}\.\d{4}/);
  });
});
