export type MarketplaceOperatingQueueTone = 'danger' | 'info' | 'ok' | 'warn';

export type MarketplaceOperatingQueueItem<TBooking> = {
  readonly bookings: TBooking[];
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly status: string;
  readonly step: string;
  readonly title: string;
  readonly tone: MarketplaceOperatingQueueTone;
  readonly value: string;
};

type MarketplaceOperatingQueueInput<TBooking> = {
  readonly cashDebtBookings: TBooking[];
  readonly customerChoiceWaiting: TBooking[];
  readonly firstPickExpired: TBooking[];
  readonly firstPickWaiting: TBooking[];
  readonly marketplaceJoined: TBooking[];
  readonly matchedWithoutChat: TBooking[];
  readonly noJoinedSupply: TBooking[];
};

export type MarketplaceOperatingQueueBookingFact<TBooking> = {
  readonly booking: TBooking;
  readonly cashDebtNeedsOps: boolean;
  readonly chatRepairNeedsOps: boolean;
  readonly hasCustomerSelectablePartner: boolean;
  readonly hasPreferredPartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly preferredAwaitingDecision: boolean;
  readonly responseWindowExpired: boolean;
  readonly status: string;
};

export function buildMarketplaceOperatingQueueBuckets<TBooking>(
  bookings: readonly MarketplaceOperatingQueueBookingFact<TBooking>[],
): MarketplaceOperatingQueueInput<TBooking> {
  const openBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const firstPickWaiting = openBookings.filter(
    (booking) => booking.hasPreferredPartner && booking.preferredAwaitingDecision,
  );

  return {
    cashDebtBookings: bookings.filter((booking) => booking.cashDebtNeedsOps).map((booking) => booking.booking),
    customerChoiceWaiting: openBookings
      .filter((booking) => booking.hasCustomerSelectablePartner)
      .map((booking) => booking.booking),
    firstPickExpired: firstPickWaiting
      .filter((booking) => booking.responseWindowExpired)
      .map((booking) => booking.booking),
    firstPickWaiting: firstPickWaiting.map((booking) => booking.booking),
    marketplaceJoined: openBookings
      .filter((booking) => booking.marketplaceParticipantCount > 0)
      .map((booking) => booking.booking),
    matchedWithoutChat: bookings.filter((booking) => booking.chatRepairNeedsOps).map((booking) => booking.booking),
    noJoinedSupply: openBookings
      .filter(
        (booking) => booking.marketplaceParticipantCount === 0 && !booking.hasCustomerSelectablePartner,
      )
      .map((booking) => booking.booking),
  };
}

export function buildMarketplaceOperatingQueueItems<TBooking>({
  cashDebtBookings,
  customerChoiceWaiting,
  firstPickExpired,
  firstPickWaiting,
  marketplaceJoined,
  matchedWithoutChat,
  noJoinedSupply,
}: MarketplaceOperatingQueueInput<TBooking>): MarketplaceOperatingQueueItem<TBooking>[] {
  return [
    {
      step: '1. First-pick timer control',
      title: 'First-pick timer control',
      value: `${firstPickWaiting.length} waiting`,
      status: firstPickExpired.length ? 'Timer review' : firstPickWaiting.length ? 'Running' : 'Clear',
      tone: firstPickExpired.length ? 'danger' : firstPickWaiting.length ? 'warn' : 'ok',
      detail:
        'Preferred Partner gets the first response window. Operators watch timer, alert delivery, wallet gate, and KYC readiness without auto assignment.',
      operatorAction:
        'If the first-pick timer is near expiry, prepare marketplace Partner nudges and keep customer wait messaging accurate.',
      href: firstPickExpired.length ? '/bookings?view=attention' : '/bookings?view=first-pick',
      bookings: firstPickExpired.length ? firstPickExpired : firstPickWaiting,
    },
    {
      step: '2. Partner participation pool',
      title: 'Partner participation pool',
      value: `${marketplaceJoined.length} with participant records`,
      status: noJoinedSupply.length ? 'Supply gap' : marketplaceJoined.length ? 'Visible' : 'Clear',
      tone: noJoinedSupply.length ? 'warn' : marketplaceJoined.length ? 'info' : 'ok',
      detail:
        'Partners inside the booking-address marketplace radius can participate. Participating, accepted, declined, and selected rows stay as operations evidence.',
      operatorAction:
        'When supply is thin, check location freshness, app presence, alert delivery, service price, and Partner wallet gate before changing policy.',
      href: noJoinedSupply.length ? '/bookings?view=no-supply' : '/bookings?view=marketplace',
      bookings: noJoinedSupply.length ? noJoinedSupply : marketplaceJoined,
    },
    {
      step: '3. Customer final selection lane',
      title: 'Customer final selection lane',
      value: `${customerChoiceWaiting.length} waiting`,
      status: customerChoiceWaiting.length ? 'Customer decision' : 'Clear',
      tone: customerChoiceWaiting.length ? 'warn' : 'ok',
      detail:
        'Customer selects the final Partner from ready participants. HANDS does not automatically assign the final Partner.',
      operatorAction:
        'Support should guide the customer only when Partner options are ready and the booking is still open.',
      href: '/bookings?view=customer-choice',
      bookings: customerChoiceWaiting,
    },
    {
      step: '4. Chat handoff lane',
      title: 'Chat handoff lane',
      value: `${matchedWithoutChat.length} repair`,
      status: matchedWithoutChat.length ? 'Repair needed' : 'Ready',
      tone: matchedWithoutChat.length ? 'danger' : 'ok',
      detail:
        'Final Partner selection must create a retained chat room for customer and Partner coordination.',
      operatorAction:
        'Repair missing chat before arrival, service start, completion, or any manual outcome decision.',
      href: matchedWithoutChat.length ? '/bookings?view=chat-repair' : '/bookings?view=chat',
      bookings: matchedWithoutChat,
    },
    {
      step: '5. Wallet unblock lane',
      title: 'Wallet unblock lane',
      value: `${cashDebtBookings.length} blocked`,
      status: cashDebtBookings.length ? 'Fee settlement' : 'Clear',
      tone: cashDebtBookings.length ? 'danger' : 'ok',
      detail:
        'Negative wallet Partners can see and participate in marketplace requests, but final acceptance, service start, and payout release wait for settlement. App message: Unpaid HANDS fees must be settled before final acceptance or service start.',
      operatorAction:
        'Confirm HANDS fee deposit or approved admin offset before final acceptance, service start, and payout release reopen.',
      href: cashDebtBookings.length ? '/cash-settlements' : '/bookings?view=cash-debt',
      bookings: cashDebtBookings,
    },
  ];
}
