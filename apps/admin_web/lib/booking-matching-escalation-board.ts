export type BookingMatchingEscalationTone = 'danger' | 'info' | 'ok' | 'warn';

export type BookingMatchingEscalationMetric = {
  readonly label: string;
  readonly value: string;
};

export type BookingMatchingEscalationLane<TBooking> = {
  readonly bookings: readonly TBooking[];
  readonly detail: string;
  readonly href: string;
  readonly metrics: readonly BookingMatchingEscalationMetric[];
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
  readonly tone: BookingMatchingEscalationTone;
};

type BookingMatchingEscalationBoardInput<TBooking> = {
  readonly chatReady: readonly TBooking[];
  readonly customerFinalSelection: readonly TBooking[];
  readonly expiredWindow: readonly TBooking[];
  readonly firstPickWaiting: readonly TBooking[];
  readonly marketplaceReady: readonly TBooking[];
  readonly matchedWithoutChat: readonly TBooking[];
  readonly noMarketplaceSupply: readonly TBooking[];
};

export function buildBookingMatchingEscalationBoard<TBooking>(
  input: BookingMatchingEscalationBoardInput<TBooking>,
): readonly BookingMatchingEscalationLane<TBooking>[] {
  return [
    {
      title: 'First-pick response window',
      status: input.expiredWindow.length > 0 ? 'Expired window' : input.firstPickWaiting.length ? 'Waiting' : 'Clear',
      tone: input.expiredWindow.length > 0 ? 'danger' : input.firstPickWaiting.length ? 'warn' : 'ok',
      detail:
        input.firstPickWaiting.length > 0
          ? 'Preferred partners have the first chance before the customer reviews marketplace supply.'
          : 'No preferred partner is currently blocking a direct request.',
      operatorAction:
        'If the timer is near expiry, prepare marketplace participant reminders and keep the customer waiting screen honest.',
      href: input.expiredWindow.length > 0 ? '/bookings?view=attention' : '/bookings?view=matching',
      bookings: input.firstPickWaiting,
      metrics: [metric('waiting', input.firstPickWaiting.length), metric('expired', input.expiredWindow.length)],
    },
    {
      title: 'Marketplace participant supply',
      status: input.noMarketplaceSupply.length > 0 ? 'Needs supply' : input.marketplaceReady.length ? 'Ready' : 'Clear',
      tone: input.noMarketplaceSupply.length > 0 ? 'warn' : input.marketplaceReady.length ? 'info' : 'ok',
      detail:
        input.noMarketplaceSupply.length > 0
          ? 'Some open requests have no marketplace participant visible to the customer yet.'
          : 'Marketplace participants are already visible for open requests that need options.',
      operatorAction:
        'Check partner availability, location freshness, push delivery, wallet debt, and online state before extending wait time.',
      href: input.noMarketplaceSupply.length > 0 ? '/bookings?view=no-supply' : '/bookings?view=matching',
      bookings: input.noMarketplaceSupply.length > 0 ? input.noMarketplaceSupply : input.marketplaceReady,
      metrics: [
        metric('no marketplace', input.noMarketplaceSupply.length),
        metric('marketplace ready', input.marketplaceReady.length),
      ],
    },
    {
      title: 'Customer final selection',
      status: input.customerFinalSelection.length > 0 ? 'Customer decision' : 'Clear',
      tone: input.customerFinalSelection.length > 0 ? 'warn' : 'ok',
      detail:
        input.customerFinalSelection.length > 0
          ? 'At least one partner is participating or accepted; the customer still needs to lock the final partner.'
          : 'No open request is waiting on customer final selection.',
      operatorAction:
        'Guide support to nudge the customer when participating/accepted partners are waiting and the booking is still open.',
      href: '/bookings?view=matching',
      bookings: input.customerFinalSelection,
      metrics: [
        metric('accepted options', input.customerFinalSelection.length),
        metric('marketplace options', input.marketplaceReady.length),
      ],
    },
    {
      title: 'Chat handoff after match',
      status: input.matchedWithoutChat.length > 0 ? 'Repair chat' : input.chatReady.length ? 'Chat live' : 'Clear',
      tone: input.matchedWithoutChat.length > 0 ? 'danger' : input.chatReady.length ? 'info' : 'ok',
      detail:
        input.matchedWithoutChat.length > 0
          ? 'A final partner is selected, but chat is missing and service coordination can stall.'
          : 'Matched bookings have chat or no active handoff blocker is visible.',
      operatorAction:
        'Repair chat room creation before the partner moves to service start, arrival, or payment closeout.',
      href: input.matchedWithoutChat.length > 0 ? '/bookings?view=attention' : '/bookings?view=chat',
      bookings: input.matchedWithoutChat,
      metrics: [
        metric('missing chat', input.matchedWithoutChat.length),
        metric('chat ready', input.chatReady.length),
      ],
    },
  ];
}

function metric(label: string, value: number): BookingMatchingEscalationMetric {
  return { label, value: value.toString() };
}
