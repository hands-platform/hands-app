import { bookingClosureSummary, humanizeClosureReason, type BookingClosureSummaryInput } from './booking-closure-summary';

describe('booking closure summary helpers', () => {
  it('marks non-terminal bookings as open when there is no closure stamp', () => {
    const booking: BookingClosureSummaryInput = {
      status: 'MATCHED',
    };

    expect(bookingClosureSummary(booking)).toEqual({
      status: 'Open',
      detail: 'No closure has been recorded yet.',
    });
  });

  it('flags terminal bookings without a closure stamp', () => {
    const booking: BookingClosureSummaryInput = {
      status: 'NO_SHOW',
    };

    expect(bookingClosureSummary(booking)).toEqual({
      status: 'Terminal without closure stamp',
      detail: 'This booking is terminal but has no explicit closure actor/reason saved.',
    });
  });

  it('formats a stamped closure with actor, reason, and note', () => {
    const booking: BookingClosureSummaryInput = {
      status: 'CANCELLED',
      closedAt: '2026-06-07T04:20:00.000Z',
      closedByRole: 'ADMIN',
      closedReason: 'customer_requested_cancel',
      closedNote: 'Confirmed in chat transcript.',
    };

    const summary = bookingClosureSummary(booking);

    expect(summary.status).not.toBe('Not set');
    expect(summary.detail).toBe(
      'admin closure / Customer Requested Cancel / Confirmed in chat transcript.',
    );
  });

  it('humanizes underscore, dash, and whitespace separated reasons', () => {
    expect(humanizeClosureReason('partner-no_show manual')).toBe('Partner No Show Manual');
  });
});
