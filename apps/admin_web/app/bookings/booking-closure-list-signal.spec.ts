import type { AdminBooking } from '../../lib/admin-api';
import { bookingClosureListSignal } from './booking-closure-list-signal';

function booking(overrides: Partial<AdminBooking>): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    ...overrides,
  } as AdminBooking;
}

describe('bookingClosureListSignal', () => {
  const options = { formatDate: (value: string) => `formatted:${value}` };

  it('formats explicit closure evidence for list rows', () => {
    expect(
      bookingClosureListSignal(
        booking({
          closedAt: '2026-06-07T04:20:00.000Z',
          closedByRole: 'ADMIN',
          closedNote: 'Confirmed in chat.',
          closedReason: 'customer_requested_cancel',
          status: 'CANCELLED',
        }),
        options,
      ),
    ).toEqual({
      detail: 'admin closure / Customer Requested Cancel / Confirmed in chat.',
      label: 'Closed formatted:2026-06-07T04:20:00.000Z',
      tone: 'pill-info',
    });
  });

  it('marks no-show closures as danger', () => {
    expect(
      bookingClosureListSignal(
        booking({
          closedAt: '2026-06-07T04:20:00.000Z',
          status: 'NO_SHOW',
        }),
        options,
      ),
    ).toMatchObject({
      detail: 'actor missing closure / reason not saved',
      tone: 'pill-danger',
    });
  });

  it('shows terminal bookings without closure evidence', () => {
    expect(bookingClosureListSignal(booking({ status: 'EXPIRED' }), options)).toEqual({
      detail: 'Terminal booking has no explicit closure actor/reason saved yet.',
      label: 'Terminal',
      tone: 'pill-warn',
    });
  });

  it('returns no list signal for non-terminal open bookings', () => {
    expect(bookingClosureListSignal(booking({ status: 'OPEN_MATCHING' }), options)).toBeNull();
  });
});
