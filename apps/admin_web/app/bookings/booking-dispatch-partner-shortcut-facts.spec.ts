import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingDispatchPartnerShortcutBookingFact,
  bookingDispatchPartnerShortcutFacts,
} from './booking-dispatch-partner-shortcut-facts';

function booking(id: string, status: string): AdminBooking {
  return { id, status } as AdminBooking;
}

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('bookingDispatchPartnerShortcutFacts', () => {
  it('builds booking shortcut facts with open matching count gates', () => {
    expect(
      bookingDispatchPartnerShortcutBookingFact(booking('open', 'OPEN_MATCHING'), nowMs, {
        customerSelectableCount: 2,
        firstPickPending: true,
        marketplaceParticipantCount: 3,
      }),
    ).toMatchObject({
      cashDebtNeedsOps: false,
      customerSelectableCount: 2,
      firstPickPending: true,
      locationNeedsOps: false,
      marketplaceParticipantCount: 3,
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingDispatchPartnerShortcutBookingFact(booking('matched', 'MATCHED'), nowMs, {
        customerSelectableCount: 2,
        firstPickPending: true,
        marketplaceParticipantCount: 3,
      }),
    ).toMatchObject({
      customerSelectableCount: 0,
      firstPickPending: false,
      marketplaceParticipantCount: 0,
      status: 'MATCHED',
    });
  });

  it('groups bookings for partner dispatch shortcut counts', () => {
    const direct = booking('direct', 'OPEN_MATCHING');
    const supplyGap = booking('supply-gap', 'OPEN_MATCHING');
    const matchedDebt = booking('matched-debt', 'MATCHED');
    const liveLocation = booking('live-location', 'PROVIDER_ON_THE_WAY');

    expect(
      bookingDispatchPartnerShortcutFacts([
        {
          booking: direct,
          cashDebtNeedsOps: false,
          customerSelectableCount: 1,
          firstPickPending: true,
          locationNeedsOps: false,
          marketplaceParticipantCount: 2,
          status: 'OPEN_MATCHING',
        },
        {
          booking: supplyGap,
          cashDebtNeedsOps: false,
          customerSelectableCount: 0,
          firstPickPending: false,
          locationNeedsOps: false,
          marketplaceParticipantCount: 0,
          status: 'OPEN_MATCHING',
        },
        {
          booking: matchedDebt,
          cashDebtNeedsOps: true,
          customerSelectableCount: 0,
          firstPickPending: false,
          locationNeedsOps: false,
          marketplaceParticipantCount: 0,
          status: 'MATCHED',
        },
        {
          booking: liveLocation,
          cashDebtNeedsOps: false,
          customerSelectableCount: 0,
          firstPickPending: false,
          locationNeedsOps: true,
          marketplaceParticipantCount: 0,
          status: 'PROVIDER_ON_THE_WAY',
        },
      ]),
    ).toEqual({
      cashDebt: [matchedDebt],
      customerSelection: [direct],
      firstPickWaiting: [direct],
      locationChecks: [liveLocation],
      noPartnerSupply: [supplyGap],
      openMatching: [direct, supplyGap],
    });
  });
});
