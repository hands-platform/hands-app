import { bookingCustomerProtectionBoardFromFacts } from './booking-customer-protection-board';

describe('bookingCustomerProtectionBoardFromFacts', () => {
  it('maps customer protection facts to ordered closeout lanes', () => {
    const cancelled = { id: 'cancelled' };
    const noShow = { id: 'no-show' };
    const completed = { id: 'completed' };
    const cashDebt = { id: 'cash-debt' };

    const lanes = bookingCustomerProtectionBoardFromFacts({
      cancelledUnresolved: [cancelled],
      cashDebt: [cashDebt],
      completedCloseout: [completed],
      expiredUnresolved: [],
      noShowUnresolved: [noShow],
    });

    expect(
      lanes.map((lane) => ({
        bookings: lane.bookings.map((booking) => booking.id),
        href: lane.href,
        status: lane.status,
        title: lane.title,
        tone: lane.tone,
      })),
    ).toEqual([
      {
        bookings: ['cancelled'],
        href: '/bookings?view=payment',
        status: 'Release/refund',
        title: 'Cancelled payment release',
        tone: 'danger',
      },
      {
        bookings: [],
        href: '/bookings?view=expired',
        status: 'Clear',
        title: 'Expired matching closeout',
        tone: 'ok',
      },
      {
        bookings: ['no-show'],
        href: '/bookings?view=no-show',
        status: 'Evidence needed',
        title: 'No-show outcome',
        tone: 'warn',
      },
      {
        bookings: ['completed'],
        href: '/bookings?view=closeout',
        status: 'Closeout missing',
        title: 'Completed service reconciliation',
        tone: 'danger',
      },
      {
        bookings: ['cash-debt'],
        href: '/bookings?view=cash-debt',
        status: 'Partner blocked',
        title: 'Cash fee debt',
        tone: 'danger',
      },
    ]);
  });

  it('uses clear copy when every closeout lane is resolved', () => {
    const lanes = bookingCustomerProtectionBoardFromFacts({
      cancelledUnresolved: [],
      cashDebt: [],
      completedCloseout: [],
      expiredUnresolved: [],
      noShowUnresolved: [],
    });

    expect(lanes.every((lane) => lane.status === 'Clear')).toBe(true);
    expect(lanes.every((lane) => lane.tone === 'ok')).toBe(true);
    expect(lanes[0]?.detail).toContain('no unresolved payment hold');
    expect(lanes[0]?.detail).not.toContain('current snapshot');
    expect(lanes[2]?.detail).not.toContain('current snapshot');
    expect(lanes[4]?.detail).toContain('No cash booking');
  });
});
