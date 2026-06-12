import { bookingMatchingEscalationNeedsOps } from './booking-matching-escalation-needs-ops';

describe('bookingMatchingEscalationNeedsOps', () => {
  it('keeps open matching bookings in the escalation queue', () => {
    expect(
      bookingMatchingEscalationNeedsOps(
        { status: 'OPEN_MATCHING' },
        { hasChatRoom: true, responseWindowExpired: false },
      ),
    ).toBe(true);
  });

  it('flags matched bookings only when chat handoff is missing', () => {
    expect(
      bookingMatchingEscalationNeedsOps(
        { status: 'MATCHED' },
        { hasChatRoom: false, responseWindowExpired: false },
      ),
    ).toBe(true);
    expect(
      bookingMatchingEscalationNeedsOps(
        { status: 'MATCHED' },
        { hasChatRoom: true, responseWindowExpired: false },
      ),
    ).toBe(false);
  });

  it('falls back to response window expiry for other statuses', () => {
    expect(
      bookingMatchingEscalationNeedsOps(
        { status: 'PROVIDER_ON_THE_WAY' },
        { hasChatRoom: true, responseWindowExpired: true },
      ),
    ).toBe(true);
    expect(
      bookingMatchingEscalationNeedsOps(
        { status: 'PROVIDER_ON_THE_WAY' },
        { hasChatRoom: true, responseWindowExpired: false },
      ),
    ).toBe(false);
  });
});
