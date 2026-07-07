import { bookingChatEvidenceDecisionBoard } from './booking-chat-evidence-decision-board';

const baseInput = {
  bookingId: 'booking_123',
  bookingStatus: 'CREATED',
  hasChatRoom: false,
  chatRoomShortId: null,
  messageCount: 0,
  latestMessageAtLabel: null,
  latestMessagePreview: null,
  hasLatestLocation: false,
  latestLocationAtLabel: null,
  latestLocationCoordinateLabel: null,
  alertCount: 0,
  auditLogCount: 0,
  operatorNoteLines: [],
};

describe('bookingChatEvidenceDecisionBoard', () => {
  it('keeps chat locked before customer final Partner selection', () => {
    const board = bookingChatEvidenceDecisionBoard(baseInput);

    expect(board.status).toBe('Chat locked until match');
    expect(board.tone).toBe('pill-info');
    expect(board.metrics[0]).toMatchObject({
      label: 'Chat room',
      value: 'No room',
      helper: 'Chat is not expected before final Partner selection.',
    });
  });

  it('requires chat repair after a booking is matched without a retained room', () => {
    const board = bookingChatEvidenceDecisionBoard({
      ...baseInput,
      bookingStatus: 'MATCHED',
    });

    expect(board.status).toBe('Chat repair needed');
    expect(board.tone).toBe('pill-danger');
    expect(board.rows[0]).toMatchObject({
      lane: 'Chat room creation',
      state: 'Repair needed',
      tone: 'pill-danger',
      record: 'No retained room attached to a matched or service-stage booking.',
    });
  });

  it('summarizes retained chat, latest message, and Partner location context', () => {
    const board = bookingChatEvidenceDecisionBoard({
      ...baseInput,
      bookingStatus: 'IN_SERVICE',
      hasChatRoom: true,
      chatRoomShortId: 'room123',
      messageCount: 3,
      latestMessageAtLabel: '07 Jun 2026 10:30',
      latestMessagePreview: 'Partner: I am on the way.',
      hasLatestLocation: true,
      latestLocationAtLabel: '07 Jun 2026 10:31',
      latestLocationCoordinateLabel: 'District 1, Ho Chi Minh City',
      alertCount: 2,
      auditLogCount: 1,
      operatorNoteLines: ['Customer asked for arrival update.'],
    });

    expect(board.status).toBe('Chat evidence ready');
    expect(board.tone).toBe('pill-success');
    expect(board.metrics[1]).toMatchObject({
      label: 'Latest message',
      value: '07 Jun 2026 10:30',
      helper: 'Partner: I am on the way.',
    });
    expect(board.metrics[2]).toMatchObject({
      label: 'Location handoff',
      value: '07 Jun 2026 10:31',
      helper: 'District 1, Ho Chi Minh City latest Partner location.',
    });
    expect(board.rows[2]).toMatchObject({
      lane: 'Movement evidence',
      record: 'District 1, Ho Chi Minh City / 07 Jun 2026 10:31',
    });
    expect(board.rows[3]).toMatchObject({
      lane: 'Retained review context',
      state: 'Context loaded',
      record: '2 notification row(s), 1 audit row(s), 1 note(s).',
    });
    expect(JSON.stringify(board)).not.toMatch(/\bpin\b/i);
  });

  it('keeps closed mobile chat available in the admin archive', () => {
    const board = bookingChatEvidenceDecisionBoard({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      hasChatRoom: true,
      chatRoomShortId: 'room999',
      messageCount: 1,
    });

    expect(board.summary).toBe(
      'This booking can hide chat in mobile after closeout, but admin keeps the retained transcript for operations review.',
    );
  });

  it('does not echo raw coordinate labels in movement evidence', () => {
    const board = bookingChatEvidenceDecisionBoard({
      ...baseInput,
      bookingStatus: 'IN_SERVICE',
      hasChatRoom: true,
      hasLatestLocation: true,
      latestLocationAtLabel: '07 Jun 2026 10:31',
      latestLocationCoordinateLabel: '10.7769, 106.7009',
    });

    expect(board.metrics[2]).toMatchObject({
      label: 'Location handoff',
      helper: 'Latest Partner location is saved for dispatch checks.',
    });
    expect(board.rows[2]).toMatchObject({
      lane: 'Movement evidence',
      record: 'Latest Partner location saved / 07 Jun 2026 10:31',
    });
    expect(JSON.stringify(board)).not.toMatch(/\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/);
  });
});
