import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorMatchingRuleSnapshot } from './booking-monitor-matching-rule-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('buildBookingMonitorMatchingRuleSnapshot', () => {
  it('builds the default MVP rule snapshot for open bookings without marketplace supply', () => {
    const snapshot = buildBookingMonitorMatchingRuleSnapshot(
      {
        id: 'open-no-supply',
        participants: [],
        status: 'OPEN_MATCHING',
      } as unknown as AdminBooking,
      nowMs,
    );

    expect(snapshot).toMatchObject({
      sourceLabel: 'Default MVP rule',
      sourceTone: 'pill-warn',
      supplyLabel: 'Marketplace supply: 0 participants / 0 selectable / 0 notified',
    });
    expect(snapshot.operatorAction).toBe(
      'No marketplace supply is visible yet. Check Partner radius, location freshness, and notification trace.',
    );
  });

  it('uses selected Partner display copy for matched booking snapshots', () => {
    const snapshot = buildBookingMonitorMatchingRuleSnapshot(
      {
        chatRoom: { id: 'chat-1' },
        id: 'matched-1',
        selectedProvider: { displayName: 'Provider Linh' },
        status: 'MATCHED',
      } as unknown as AdminBooking,
      nowMs,
    );

    expect(snapshot.customerChoiceLabel).toBe(
      'Customer final choice: Partner Linh; no automatic assignment',
    );
    expect(snapshot.operatorAction).toBe(
      'Chat is ready. Continue service handoff and closeout from booking detail.',
    );
  });
});
