import { bookingDispatchChecklist } from './booking-dispatch-checklist';

const baseInput = {
  bookingStatus: 'OPEN_MATCHING',
  attentionFlagCount: 0,
  payment: null,
  selectedPartner: null,
  preferredPartner: null,
  isPreferredAwaitingDecision: false,
  participantCount: 1,
  hasChatRoom: false,
  chatRoomId: null,
  messageCount: 0,
  activeWithLocationNeed: false,
  hasLatestProviderLocation: false,
  latestProviderLocationFreshness: null,
  providerLocationAgeLabel: 'Updated 20m ago',
};

describe('bookingDispatchChecklist', () => {
  it('prioritizes unresolved cancelled payments', () => {
    const steps = bookingDispatchChecklist({
      ...baseInput,
      bookingStatus: 'CANCELLED',
      payment: {
        id: 'pay_1',
        status: 'AUTHORIZED',
        href: '/payments#payment-pay_1',
        hint: 'Payment is still authorized.',
        terminal: false,
      },
    });

    expect(steps[0]).toEqual({
      priority: 'Now',
      title: 'Resolve cancelled payment',
      detail:
        'Booking is cancelled but payment is still AUTHORIZED. Release the hold or refund before closing.',
      owner: 'Payments operator',
      tone: 'pill-danger',
      actionHref: '/payments#payment-pay_1',
      actionLabel: 'Open payment',
    });
  });

  it('prioritizes preferred partner response during first-pick', () => {
    const steps = bookingDispatchChecklist({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      preferredPartner: { label: 'Linh Wellness', phone: '0865907184' },
      isPreferredAwaitingDecision: true,
      participantCount: 0,
    });

    expect(steps.map((step) => step.title)).toEqual(['Preferred partner response', 'Supply monitor']);
    expect(steps[0]).toMatchObject({
      priority: 'Now',
      actionHref: 'tel:0865907184',
      actionLabel: 'Call partner',
    });
  });

  it('adds chat recovery for matched bookings without chat', () => {
    const steps = bookingDispatchChecklist({
      ...baseInput,
      bookingStatus: 'MATCHED',
      selectedPartner: { label: 'Linh Wellness', phone: null },
      hasChatRoom: false,
    });

    expect(steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          priority: 'Now',
          title: 'Recover chat room',
          owner: 'Support operator',
        }),
      ]),
    );
  });

  it('asks for partner location during active handoff when no pin exists', () => {
    const steps = bookingDispatchChecklist({
      ...baseInput,
      bookingStatus: 'PROVIDER_ON_THE_WAY',
      activeWithLocationNeed: true,
      selectedPartner: { label: 'Linh Wellness', phone: '0865907184' },
    });

    expect(steps[0]).toEqual(
      expect.objectContaining({
        priority: 'Now',
        title: 'Request partner location',
        actionHref: 'tel:0865907184',
      }),
    );
  });

  it('monitors stale partner location without replacing the active booking state', () => {
    const steps = bookingDispatchChecklist({
      ...baseInput,
      bookingStatus: 'ARRIVED',
      activeWithLocationNeed: true,
      hasLatestProviderLocation: true,
      latestProviderLocationFreshness: 'stale',
      providerLocationAgeLabel: 'Updated 45m ago',
      selectedPartner: { label: 'Linh Wellness', phone: '0865907184' },
    });

    expect(steps[0]).toMatchObject({
      priority: 'Monitor',
      title: 'Refresh stale location',
      detail: 'Updated 45m ago. Ask the partner to share current location again if the customer asks.',
    });
  });

  it('adds done state and normal monitoring when the booking has no active checks', () => {
    const steps = bookingDispatchChecklist({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      selectedPartner: { label: 'Linh Wellness', phone: '0865907184' },
      hasChatRoom: true,
      chatRoomId: 'chat_1',
      messageCount: 2,
      payment: {
        id: 'pay_1',
        status: 'CAPTURED',
        href: '/payments#payment-pay_1',
        hint: 'Payment captured.',
        terminal: true,
      },
    });

    expect(steps.map((step) => step.title)).toEqual([
      'Partner handoff locked',
      'Chat room ready',
      'Payment state',
      'Normal monitoring',
    ]);
  });
});
