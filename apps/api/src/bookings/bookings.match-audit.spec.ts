import { MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER } from '../matching/matching.policy';
import { bookingMatchedAuditCreateInput } from './bookings.match-audit';

describe('booking match audit helpers', () => {
  it('builds admin audit create input for matched booking decisions', () => {
    expect(
      bookingMatchedAuditCreateInput({
        actorId: 'actor-1',
        action: 'booking.matched.customer_selected',
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
        matchSource: MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
      }),
    ).toEqual({
      data: {
        actorId: 'actor-1',
        action: 'booking.matched.customer_selected',
        target: 'booking:booking-1',
        metadata: {
          bookingId: 'booking-1',
          providerProfileId: 'partner-1',
          matchSource: MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
        },
      },
    });
  });
});
