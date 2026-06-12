import {
  bookingCommandCenterFromFacts,
  type BookingCommandCenterFacts,
} from './booking-command-center-board';

function commandCenterFacts(
  overrides: Partial<BookingCommandCenterFacts> = {},
): BookingCommandCenterFacts {
  return {
    active: [],
    backupSelected: [],
    cashDebt: [],
    chatEvidence: [],
    chatReady: [],
    closeoutChecks: [],
    evidenceMissing: [],
    expiredMatching: [],
    locationChecks: [],
    matchedWithoutChat: [],
    missingAuthorizedPaymentRefs: [],
    noShow: [],
    noSupply: [],
    open: [],
    paymentChecks: [],
    preferredPending: [],
    pricingChecks: [],
    quietChat: [],
    refundReview: [],
    ...overrides,
  };
}

describe('bookingCommandCenterFromFacts', () => {
  it('maps empty command facts to stable operator lanes', () => {
    const lanes = bookingCommandCenterFromFacts(commandCenterFacts());

    expect(
      lanes.map((lane) => ({
        href: lane.href,
        status: lane.status,
        title: lane.title,
        tone: lane.tone,
      })),
    ).toEqual([
      { href: '/bookings?view=active', status: 'Stable', title: 'Dispatch pressure', tone: 'ok' },
      {
        href: '/bookings?view=location',
        status: 'Clear',
        title: 'Customer protection',
        tone: 'ok',
      },
      {
        href: '/bookings?view=manual-decision',
        status: 'Clear',
        title: 'Evidence readiness',
        tone: 'ok',
      },
      { href: '/bookings?view=pricing', status: 'Ready', title: 'Payment closeout', tone: 'ok' },
      { href: '/bookings?view=chat', status: 'Clear', title: 'Handoff quality', tone: 'ok' },
    ]);
  });

  it('prioritizes urgent lane state, routes, and metric counts', () => {
    const item = {};
    const lanes = bookingCommandCenterFromFacts(
      commandCenterFacts({
        active: [item, item],
        cashDebt: [item],
        closeoutChecks: [item],
        evidenceMissing: [item],
        expiredMatching: [item],
        locationChecks: [item],
        matchedWithoutChat: [item],
        noSupply: [item],
        open: [item],
        paymentChecks: [item],
        quietChat: [item],
      }),
    );

    expect(
      lanes.map((lane) => ({
        href: lane.href,
        metrics: lane.metrics.map((metric) => `${metric.label}:${metric.value}`),
        status: lane.status,
        title: lane.title,
        tone: lane.tone,
      })),
    ).toEqual([
      {
        href: '/bookings?view=no-supply',
        metrics: ['active:2', 'open:1', 'no supply:1', 'preferred pending:0'],
        status: 'Action needed',
        title: 'Dispatch pressure',
        tone: 'danger',
      },
      {
        href: '/bookings?view=attention',
        metrics: ['expired:1', 'no chat:1', 'location checks:1', 'quiet chat:1'],
        status: 'Protect now',
        title: 'Customer protection',
        tone: 'danger',
      },
      {
        href: '/bookings?view=evidence-missing',
        metrics: ['chat evidence:0', 'evidence missing:1', 'refund review:0', 'quiet chat:1'],
        status: 'Needs records',
        title: 'Evidence readiness',
        tone: 'warn',
      },
      {
        href: '/bookings?view=closeout',
        metrics: [
          'payment:1',
          'closeout:1',
          'no-show:0',
          'pricing:0',
          'cash debt:1',
          'missing refs:0',
        ],
        status: 'Review',
        title: 'Payment closeout',
        tone: 'danger',
      },
      {
        href: '/bookings?view=location',
        metrics: ['location:1', 'marketplace chosen:0', 'chat live:0', 'quiet chat:1'],
        status: 'Monitor',
        title: 'Handoff quality',
        tone: 'warn',
      },
    ]);
  });
});
