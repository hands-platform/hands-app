import { bookingMonitorCheckFlagsFromFacts } from './booking-monitor-check-flags';

const readyPricingPolicy = {
  status: 'ready',
  label: 'Pricing ready',
  tone: 'pill-success',
} as const;

describe('bookingMonitorCheckFlagsFromFacts', () => {
  it('composes open matching checks in operator priority order', () => {
    expect(
      bookingMonitorCheckFlagsFromFacts({
        status: 'OPEN_MATCHING',
        hasPayment: true,
        paymentStatus: 'AUTHORIZED',
        paymentProviderRef: null,
        completedCloseoutNeedsOps: true,
        cashDebtNeedsOps: true,
        pricingPolicy: { status: 'blocked', label: 'Price missing', tone: 'pill-danger' },
        matchingWindowExpired: true,
        firstPickPending: true,
        participantCount: 0,
        matchingChatReady: true,
        hasProviderLocation: false,
        providerLocationFreshness: 'missing',
        hasChatRoom: false,
        chatMessageCount: 0,
      }),
    ).toEqual([
      { severity: 'high', title: 'Completed closeout incomplete' },
      { severity: 'high', title: 'Cash fee debt blocks marketplace alerts' },
      { severity: 'high', title: 'Price missing' },
      { severity: 'high', title: 'Matching window expired' },
      { severity: 'medium', title: 'First-pick partner pending' },
      { severity: 'medium', title: 'No partner supply' },
      { severity: 'medium', title: 'Payment reference missing' },
    ]);
  });

  it('includes live handoff location and quiet chat checks', () => {
    expect(
      bookingMonitorCheckFlagsFromFacts({
        status: 'ARRIVED',
        hasPayment: true,
        paymentStatus: 'CAPTURED',
        paymentProviderRef: 'capture-ref',
        completedCloseoutNeedsOps: false,
        cashDebtNeedsOps: false,
        pricingPolicy: readyPricingPolicy,
        matchingWindowExpired: false,
        firstPickPending: false,
        participantCount: 1,
        matchingChatReady: true,
        hasProviderLocation: true,
        providerLocationFreshness: 'stale',
        hasChatRoom: true,
        chatMessageCount: 0,
      }),
    ).toEqual([
      { severity: 'medium', title: 'Partner location is stale' },
      { severity: 'low', title: 'Chat quiet' },
    ]);
  });

  it('returns no checks when all booking facts are healthy', () => {
    expect(
      bookingMonitorCheckFlagsFromFacts({
        status: 'COMPLETED',
        hasPayment: true,
        paymentStatus: 'RELEASED',
        paymentProviderRef: 'release-ref',
        completedCloseoutNeedsOps: false,
        cashDebtNeedsOps: false,
        pricingPolicy: readyPricingPolicy,
        matchingWindowExpired: false,
        firstPickPending: false,
        participantCount: 1,
        matchingChatReady: true,
        hasProviderLocation: false,
        providerLocationFreshness: 'missing',
        hasChatRoom: true,
        chatMessageCount: 2,
      }),
    ).toEqual([]);
  });
});
