export type BookingMatchingFlowTone = 'danger' | 'info' | 'ok' | 'warn';

export type BookingMatchingFlowMetric = {
  readonly label: string;
  readonly value: string;
};

export type BookingMatchingFlowStep<TBooking> = {
  readonly bookings: readonly TBooking[];
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly BookingMatchingFlowMetric[];
  readonly operatorAction: string;
  readonly stage: string;
  readonly status: string;
  readonly title: string;
  readonly tone: BookingMatchingFlowTone;
};

export type BookingMatchingFlowTimelineInput<TBooking> = {
  readonly backupAlerted: readonly TBooking[];
  readonly customerChoice: readonly TBooking[];
  readonly firstPickExpired: readonly TBooking[];
  readonly firstPickWaiting: readonly TBooking[];
  readonly liveHandoff: readonly TBooking[];
  readonly locationChecks: readonly TBooking[];
  readonly marketplaceVisible: readonly TBooking[];
  readonly matched: readonly TBooking[];
  readonly matchedWithoutChat: readonly TBooking[];
  readonly noSupply: readonly TBooking[];
};

export function buildBookingMatchingFlowTimeline<TBooking>(
  input: BookingMatchingFlowTimelineInput<TBooking>,
): readonly BookingMatchingFlowStep<TBooking>[] {
  return [
    {
      stage: 'Stage 1',
      title: 'Direct first-pick request',
      status: input.firstPickExpired.length ? 'Timer expired' : input.firstPickWaiting.length ? 'Waiting' : 'Clear',
      tone: input.firstPickExpired.length ? 'danger' : input.firstPickWaiting.length ? 'warn' : 'ok',
      detail:
        input.firstPickWaiting.length > 0
          ? 'Customer selected a preferred Partner and the first response window is running.'
          : 'No direct first-pick request is currently waiting.',
      operatorAction:
        'Monitor the 10-minute response window, Partner push delivery, and wallet/KYC gates before manually intervening.',
      href: input.firstPickExpired.length ? '/bookings?view=attention' : '/bookings?view=matching',
      metrics: [metric('waiting', input.firstPickWaiting.length), metric('expired', input.firstPickExpired.length)],
      bookings: input.firstPickExpired.length ? input.firstPickExpired : input.firstPickWaiting,
    },
    {
      stage: 'Stage 2',
      title: 'Marketplace participation',
      status: input.noSupply.length ? 'Supply gap' : input.marketplaceVisible.length ? 'Marketplace visible' : 'Clear',
      tone: input.noSupply.length ? 'warn' : input.marketplaceVisible.length ? 'info' : 'ok',
      detail:
        input.noSupply.length > 0
          ? 'Some open bookings have no marketplace Partner for the customer to choose.'
          : 'Marketplace Partners are visible or no participation lane is currently needed.',
      operatorAction:
        'Use marketplace-ready Partners, location freshness, alert delivery, and operating policy before widening rules.',
      href: input.noSupply.length ? '/partners?review=ready-now' : '/bookings?view=matching',
      metrics: [
        metric('no marketplace', input.noSupply.length),
        metric('visible', input.marketplaceVisible.length),
        metric('alerted', input.backupAlerted.length),
      ],
      bookings: input.noSupply.length ? input.noSupply : input.marketplaceVisible,
    },
    {
      stage: 'Stage 3',
      title: 'Customer fallback Partner choice',
      status: input.customerChoice.length ? 'Needs customer' : 'Clear',
      tone: input.customerChoice.length ? 'warn' : 'ok',
      detail:
        input.customerChoice.length > 0
          ? 'One or more Partners are ready after first-pick did not validly win under API rules, but the customer has not locked the fallback choice.'
          : 'No open booking is waiting on customer fallback selection.',
      operatorAction:
        'Prompt support to guide the customer while Partner availability and wait anxiety are still fresh.',
      href: '/bookings?view=matching',
      metrics: [metric('choice needed', input.customerChoice.length), metric('matched', input.matched.length)],
      bookings: input.customerChoice,
    },
    {
      stage: 'Stage 4',
      title: 'Chat and location handoff',
      status: input.matchedWithoutChat.length
        ? 'Repair chat'
        : input.locationChecks.length
          ? 'Location check'
          : 'Ready',
      tone: input.matchedWithoutChat.length
        ? 'danger'
        : input.locationChecks.length
          ? 'warn'
          : input.liveHandoff.length
            ? 'info'
            : 'ok',
      detail:
        input.matchedWithoutChat.length > 0
          ? 'A final Partner is selected, but the chat room is missing.'
          : input.locationChecks.length > 0
            ? 'A live booking has stale or missing Partner location.'
            : 'Matched and live bookings have no visible chat/location handoff blocker.',
      operatorAction:
        'Repair chat first, then confirm Partner location before arrival, service start, and payment closeout.',
      href: input.matchedWithoutChat.length ? '/bookings?view=attention' : '/bookings?view=location',
      metrics: [
        metric('chat repair', input.matchedWithoutChat.length),
        metric('location checks', input.locationChecks.length),
        metric('live handoff', input.liveHandoff.length),
      ],
      bookings: input.matchedWithoutChat.length ? input.matchedWithoutChat : input.locationChecks,
    },
  ];
}

function metric(label: string, value: number): BookingMatchingFlowMetric {
  return { label, value: value.toString() };
}
