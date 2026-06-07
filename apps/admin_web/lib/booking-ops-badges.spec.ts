import { bookingOpsBadges, type BookingOpsBadgeInput } from './booking-ops-badges';

describe('booking ops badges', () => {
  it('shows a neutral monitor badge when no operational signal is active', () => {
    const booking: BookingOpsBadgeInput = {
      status: 'CREATED',
    };

    expect(bookingOpsBadges(booking)).toEqual([{ label: 'Monitor', tone: 'pill-neutral' }]);
  });

  it('prioritizes high attention flags over medium attention flags', () => {
    const booking: BookingOpsBadgeInput = {
      status: 'MATCHED',
    };

    expect(
      bookingOpsBadges(booking, {
        attentionFlags: [
          { severity: 'medium' },
          { severity: 'high' },
        ],
      }),
    ).toContainEqual({ label: 'Action needed', tone: 'pill-danger' });
  });

  it('includes payment, partner, chat, and location facts', () => {
    const booking: BookingOpsBadgeInput = {
      status: 'MATCHED',
      payment: { status: 'CAPTURED' },
      selectedProvider: { id: 'partner-1' },
      chatRoom: { id: 'room-1' },
    };

    expect(bookingOpsBadges(booking, { locationFreshness: 'recent' })).toEqual([
      { label: 'Captured', tone: 'pill-success' },
      { label: 'Partner selected', tone: 'pill-success' },
      { label: 'Chat ready', tone: 'pill-info' },
      { label: 'Location recent', tone: 'pill-success' },
    ]);
  });

  it('marks cash fee debt as a danger badge when wallet settlement is needed', () => {
    const booking: BookingOpsBadgeInput = {
      status: 'COMPLETED',
    };

    expect(
      bookingOpsBadges(booking, {
        cashDebtNeedsSettlement: true,
      }),
    ).toContainEqual({ label: 'Cash fee debt', tone: 'pill-danger' });
  });
});
