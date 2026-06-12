import { bookingMonitorCheckFlagsInput } from './booking-monitor-check-flags-inputs';

const pricingPolicy = {
  label: 'Pricing ready',
  status: 'ready',
  tone: 'pill-success',
} as const;

function input(overrides: Partial<Parameters<typeof bookingMonitorCheckFlagsInput>[0]> = {}) {
  return bookingMonitorCheckFlagsInput({
    cashDebtNeedsOps: false,
    chatMessageCount: 0,
    completedCloseoutNeedsOps: false,
    firstPickAwaitingDecision: false,
    hasChatRoom: false,
    hasPayment: false,
    hasProviderLocation: false,
    participantCount: 0,
    paymentProviderRef: null,
    paymentStatus: null,
    pricingPolicy,
    providerLocationFreshness: 'missing',
    responseWindowExpired: false,
    status: 'OPEN_MATCHING',
    ...overrides,
  });
}

describe('bookingMonitorCheckFlagsInput', () => {
  it('enables matching timer facts only for open matching bookings', () => {
    expect(
      input({
        firstPickAwaitingDecision: true,
        responseWindowExpired: true,
        status: 'OPEN_MATCHING',
      }),
    ).toMatchObject({
      firstPickPending: true,
      matchingWindowExpired: true,
    });

    expect(
      input({
        firstPickAwaitingDecision: true,
        responseWindowExpired: true,
        status: 'MATCHED',
      }),
    ).toMatchObject({
      firstPickPending: false,
      matchingWindowExpired: false,
    });
  });

  it('requires chat readiness only for matched bookings', () => {
    expect(input({ hasChatRoom: false, status: 'MATCHED' })).toMatchObject({
      matchingChatReady: false,
    });
    expect(input({ hasChatRoom: false, status: 'OPEN_MATCHING' })).toMatchObject({
      matchingChatReady: true,
    });
  });
});
