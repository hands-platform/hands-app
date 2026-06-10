import { bookingListStageFromFacts } from './booking-list-stage';

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
      label: 'Stage 4 repair',
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
      detail: 'Chat is ready, but partner location needs review.',
      tone: 'warn',
    });
  });

  it('builds customer choice and marketplace stages from open matching facts', () => {
    expect(bookingListStageFromFacts(stageInput({ selectableCount: 2 }))).toMatchObject({
      key: 'customer-choice',
      label: 'Stage 3 choice',
      tone: 'warn',
    });

    expect(
      bookingListStageFromFacts(
        stageInput({ marketplaceAlertNotifiedCount: 3, marketplaceCount: 4 }),
      ),
    ).toMatchObject({
      key: 'marketplace',
      action: 'Monitor marketplace alert delivery and customer choice list quality.',
      label: 'Stage 2 marketplace',
      tone: 'info',
    });
  });

  it('builds first-pick and intake fallback stages', () => {
    expect(bookingListStageFromFacts(stageInput({ responseWindowExpired: true }))).toMatchObject({
      key: 'first-pick',
      label: 'Stage 1 first-pick',
      tone: 'danger',
    });

    expect(bookingListStageFromFacts(stageInput({ status: 'PAYMENT_PENDING' }))).toMatchObject({
      key: 'intake',
      detail: 'Booking is payment pending.',
      label: 'Stage 0 intake',
      tone: 'info',
    });
  });
});
