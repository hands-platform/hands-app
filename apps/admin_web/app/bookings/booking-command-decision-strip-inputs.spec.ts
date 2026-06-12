import type { AdminBooking } from '../../lib/admin-api';
import { bookingCommandDecisionStripInput } from './booking-command-decision-strip-inputs';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    ...overrides,
  } as AdminBooking;
}

describe('bookingCommandDecisionStripInput', () => {
  it('maps booking state and command signals to strip input', () => {
    const item = booking({
      addressSnapshot: { id: 'address-1' } as AdminBooking['addressSnapshot'],
      chatRoom: {
        messages: [{ id: 'message-1' }, { id: 'message-2' }],
      } as AdminBooking['chatRoom'],
      participants: [{ id: 'participant-1' }, { id: 'participant-2' }] as AdminBooking['participants'],
      payment: {
        method: 'CARD',
        status: 'AUTHORIZED',
      } as AdminBooking['payment'],
      status: 'MATCHED',
    });

    expect(
      bookingCommandDecisionStripInput(item, {
        addressLabel: 'Confirmed service address',
        cashDebtNeedsSettlement: true,
        closeoutNeedsOps: true,
        customerChoiceCandidateCount: 1,
        hasChatRoom: true,
        hasFinalPartner: true,
        marketplaceEligibleCount: 3,
      }),
    ).toEqual({
      bookingStatus: 'MATCHED',
      hasAddressSnapshot: true,
      addressLabel: 'Confirmed service address',
      participantCount: 2,
      customerChoiceCandidateCount: 1,
      marketplaceEligibleCount: 3,
      hasFinalPartner: true,
      hasChatRoom: true,
      messageCount: 2,
      paymentMethod: 'CARD',
      paymentStatus: 'AUTHORIZED',
      cashDebtNeedsSettlement: true,
      closeoutOpenItemCount: 1,
    });
  });

  it('uses empty-state fallbacks for missing optional booking records', () => {
    expect(
      bookingCommandDecisionStripInput(booking(), {
        addressLabel: 'Address missing',
        cashDebtNeedsSettlement: false,
        closeoutNeedsOps: false,
        customerChoiceCandidateCount: 0,
        hasChatRoom: false,
        hasFinalPartner: false,
        marketplaceEligibleCount: 0,
      }),
    ).toMatchObject({
      hasAddressSnapshot: false,
      participantCount: 0,
      messageCount: 0,
      paymentMethod: 'NONE',
      paymentStatus: 'NONE',
      closeoutOpenItemCount: 0,
    });
  });
});
