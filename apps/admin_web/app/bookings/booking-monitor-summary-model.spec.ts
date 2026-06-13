import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorSummaryFact } from './booking-monitor-summary-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('buildBookingMonitorSummaryFact', () => {
  it('builds high priority first-pick summary facts from booking state', () => {
    expect(
      buildBookingMonitorSummaryFact(
        {
          expiresAt: '2026-06-07T09:45:00.000Z',
          id: 'expired-open-matching',
          participants: [],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toMatchObject({
      highPriorityCheck: true,
      stageKey: 'first-pick',
      status: 'OPEN_MATCHING',
    });
  });

  it('builds active handoff chat facts from booking state', () => {
    expect(
      buildBookingMonitorSummaryFact(
        {
          chatRoom: { id: 'chat-1', messages: [{ id: 'message-1' }] },
          id: 'matched',
          selectedProvider: { id: 'partner-1' },
          status: 'MATCHED',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toMatchObject({
      chatRepairNeedsOps: false,
      matchingChatReady: true,
      stageKey: 'handoff',
    });
  });
});
