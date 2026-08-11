import {
  bookingListStageFromFacts,
  type BookingListMatchingEvidence,
} from './booking-list-stage';

function matchingEvidence(
  overrides: Partial<BookingListMatchingEvidence> = {},
): BookingListMatchingEvidence {
  return {
    chatReady: false,
    finalSelection: 'FIRST_PICK_PENDING',
    marketplaceParticipantCount: 0,
    selectableParticipantCount: 0,
    ...overrides,
  };
}

function stageInput(
  overrides: Partial<Parameters<typeof bookingListStageFromFacts>[0]> = {},
): Parameters<typeof bookingListStageFromFacts>[0] {
  return {
    bookingId: 'booking-1',
    hasChatRoom: false,
    isHandoffStatus: false,
    isTerminalStatus: false,
    locationNeedsOps: false,
    marketplaceAlertNotifiedCount: 0,
    marketplaceCount: 0,
    responseWindowExpired: false,
    selectableCount: 0,
    selectedPartnerPresent: false,
    status: 'OPEN_MATCHING',
    ...overrides,
  };
}

describe('bookingListStageFromFacts', () => {
  it('builds closeout stages for terminal bookings', () => {
    expect(
      bookingListStageFromFacts(stageInput({ isTerminalStatus: true, status: 'COMPLETED' })),
    ).toMatchObject({
      key: 'closeout',
      label: 'Closeout',
      tone: 'ok',
      href: '/bookings/booking-1',
    });
  });

  it('prioritizes chat repair before normal handoff', () => {
    expect(
      bookingListStageFromFacts(
        stageInput({ isHandoffStatus: true, status: 'MATCHED', hasChatRoom: false }),
      ),
    ).toMatchObject({
      key: 'handoff-repair',
      label: 'Handoff repair',
      tone: 'danger',
      href: '/bookings/booking-1#chat',
    });
  });

  it('uses handoff warning when chat is ready but location needs review', () => {
    expect(
      bookingListStageFromFacts(
        stageInput({
          hasChatRoom: true,
          isHandoffStatus: true,
          locationNeedsOps: true,
          status: 'PROVIDER_ON_THE_WAY',
        }),
      ),
    ).toMatchObject({
      key: 'handoff',
      detail: 'Chat is ready, but Partner location needs review.',
      tone: 'warn',
    });
  });

  it('uses API matching evidence before local chat and participant fallbacks', () => {
    expect(
      bookingListStageFromFacts(
        stageInput({
          hasChatRoom: false,
          isHandoffStatus: true,
          matchingEvidence: matchingEvidence({ chatReady: true }),
          status: 'MATCHED',
        }),
      ),
    ).toMatchObject({
      key: 'handoff',
      label: 'Service handoff',
      tone: 'ok',
    });

    expect(
      bookingListStageFromFacts(
        stageInput({
          matchingEvidence: matchingEvidence({
            finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
            selectableParticipantCount: 2,
          }),
          selectableCount: 0,
        }),
      ),
    ).toMatchObject({
      key: 'customer-choice',
      detail: '2 customer-selectable Partner(s) are waiting for customer selection.',
      label: 'Customer choice',
    });

    expect(
      bookingListStageFromFacts(
        stageInput({
          matchingEvidence: matchingEvidence({ marketplaceParticipantCount: 3 }),
          marketplaceCount: 0,
        }),
      ),
    ).toMatchObject({
      key: 'marketplace',
      detail: '3 marketplace Partner(s) are visible while matching stays open.',
      label: 'Marketplace open',
    });
  });

  it('builds customer choice and marketplace stages from open matching facts', () => {
    expect(bookingListStageFromFacts(stageInput({ selectableCount: 2 }))).toMatchObject({
      key: 'customer-choice',
      label: 'Customer choice',
      tone: 'warn',
    });

    expect(
      bookingListStageFromFacts(
        stageInput({ marketplaceAlertNotifiedCount: 3, marketplaceCount: 4 }),
      ),
    ).toMatchObject({
      key: 'marketplace',
      action: 'Monitor marketplace alert delivery and customer choice list quality.',
      label: 'Marketplace open',
      tone: 'info',
    });
  });

  it('builds first-pick and intake fallback stages', () => {
    expect(bookingListStageFromFacts(stageInput({ responseWindowExpired: true }))).toMatchObject({
      key: 'first-pick',
      label: 'Preferred pending',
      tone: 'danger',
    });

    expect(bookingListStageFromFacts(stageInput({ status: 'PAYMENT_PENDING' }))).toMatchObject({
      key: 'intake',
      detail: 'Booking is payment pending.',
      label: 'Booking intake',
      tone: 'info',
    });
  });
});
