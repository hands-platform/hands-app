import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingMonitorMatchingEscalationBoard,
  buildBookingMonitorMatchingEscalationFacts,
  buildBookingMonitorMatchingEscalationRows,
} from './booking-monitor-matching-escalation-model';

const nowMs = new Date('2026-06-12T09:45:00.000Z').getTime();

describe('booking monitor matching escalation model', () => {
  it('builds expired first-pick and no-supply board facts from bookings', () => {
    const booking = {
      expiresAt: '2026-06-12T09:35:00.000Z',
      id: 'expired-open-matching',
      participants: [],
      preferredProvider: { id: 'preferred-1' },
      preferredProviderId: 'preferred-1',
      status: 'OPEN_MATCHING',
    } as unknown as AdminBooking;

    const facts = buildBookingMonitorMatchingEscalationFacts([booking], nowMs);

    expect(facts.expiredWindow).toEqual([booking]);
    expect(facts.firstPickWaiting).toEqual([booking]);
    expect(facts.noMarketplaceSupply).toEqual([booking]);
  });

  it('builds matching escalation board lanes from booking facts', () => {
    const lanes = buildBookingMonitorMatchingEscalationBoard(
      [
        {
          expiresAt: '2026-06-12T09:35:00.000Z',
          id: 'expired-open-matching',
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
      ],
      nowMs,
    );

    expect(lanes[0]).toMatchObject({
      href: '/bookings?view=attention',
      status: 'Expired window',
      title: 'First-pick response window',
      tone: 'danger',
    });
  });

  it('builds escalation rows from selectable marketplace participants', () => {
    const rows = buildBookingMonitorMatchingEscalationRows(
      [
        {
          createdAt: '2026-06-12T09:40:00.000Z',
          id: 'customer-choice',
          participants: [
            { providerProfile: { id: 'partner-1' }, status: 'JOINED' },
            { providerProfile: { id: 'partner-2' }, status: 'ACCEPTED' },
          ],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
      ],
      nowMs,
    );

    expect(rows[0]).toMatchObject({
      title: 'Customer fallback partner selection needed',
      tone: 'warn',
    });
  });
});
