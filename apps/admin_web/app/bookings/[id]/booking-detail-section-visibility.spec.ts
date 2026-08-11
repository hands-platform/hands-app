import { bookingDetailSectionVisibility, type BookingDetailSectionVisibilityInput } from './booking-detail-section-visibility';

function input(overrides: Partial<BookingDetailSectionVisibilityInput> = {}): BookingDetailSectionVisibilityInput {
  return {
    hasChatMessages: false,
    hasCloseoutExceptions: false,
    hasEarning: false,
    hasFinanceFlags: false,
    hasMatchedAt: false,
    hasNotifications: false,
    hasOperatorNotes: false,
    hasPayment: false,
    hasPostMatchDecision: false,
    hasSelectedPartner: false,
    status: 'OPEN_MATCHING',
    ...overrides,
  };
}

describe('bookingDetailSectionVisibility', () => {
  it('keeps pre-match booking detail focused on dispatch only', () => {
    expect(bookingDetailSectionVisibility(input())).toEqual({
      showCloseoutReadiness: false,
      showDispatchDisclosure: true,
      showEvidenceDisclosure: false,
      showHistoryDisclosure: false,
      showSettlementDisclosure: false,
    });
  });

  it('shows history for matched bookings without exposing settlement-only records', () => {
    expect(
      bookingDetailSectionVisibility(
        input({
          hasChatMessages: true,
          hasMatchedAt: true,
          hasSelectedPartner: true,
          status: 'IN_SERVICE',
        }),
      ),
    ).toEqual({
      showCloseoutReadiness: false,
      showDispatchDisclosure: true,
      showEvidenceDisclosure: false,
      showHistoryDisclosure: true,
      showSettlementDisclosure: false,
    });
  });

  it('does not show terminal closeout panels while a booking is still live', () => {
    expect(
      bookingDetailSectionVisibility(
        input({
          hasCloseoutExceptions: true,
          hasFinanceFlags: true,
          hasMatchedAt: true,
          hasSelectedPartner: true,
          status: 'IN_SERVICE',
        }),
      ),
    ).toMatchObject({
      showCloseoutReadiness: false,
      showDispatchDisclosure: true,
    });
  });

  it('keeps healthy completed bookings focused on review and settlement records', () => {
    expect(
      bookingDetailSectionVisibility(
        input({
          hasEarning: true,
          hasMatchedAt: true,
          hasPayment: true,
          hasSelectedPartner: true,
          status: 'COMPLETED',
        }),
      ),
    ).toEqual({
      showCloseoutReadiness: false,
      showDispatchDisclosure: false,
      showEvidenceDisclosure: false,
      showHistoryDisclosure: true,
      showSettlementDisclosure: true,
    });
  });

  it('keeps completed closeout issues inside the completed review flow', () => {
    expect(
      bookingDetailSectionVisibility(
        input({
          hasCloseoutExceptions: true,
          hasEarning: true,
          hasMatchedAt: true,
          hasPayment: true,
          hasSelectedPartner: true,
          status: 'COMPLETED',
        }),
      ),
    ).toMatchObject({
      showCloseoutReadiness: false,
      showSettlementDisclosure: true,
    });
  });

  it('shows decision evidence for post-match cancellation review', () => {
    expect(
      bookingDetailSectionVisibility(
        input({
          hasChatMessages: true,
          hasFinanceFlags: true,
          hasPostMatchDecision: true,
          hasSelectedPartner: true,
          status: 'CANCELLED',
        }),
      ),
    ).toEqual({
      showCloseoutReadiness: true,
      showDispatchDisclosure: false,
      showEvidenceDisclosure: true,
      showHistoryDisclosure: true,
      showSettlementDisclosure: true,
    });
  });
});
