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
        'Preferred partner gets the first response window. Operators watch timer, alert delivery, wallet gate, and KYC readiness without auto assignment.',
      operatorAction:
        'If the first-pick timer is near expiry, prepare marketplace partner nudges and keep customer wait messaging accurate.',
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
        'When supply is thin, check location freshness, app presence, alert delivery, service price, and partner wallet gate before changing policy.',
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
        'Customer selects the final partner from ready participants. HANDS does not automatically assign the final partner.',
      operatorAction:
        'Support should guide the customer only when partner options are ready and the booking is still open.',
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
        'Final partner selection must create a retained chat room for customer and partner coordination.',
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
        'Negative wallet partners can see and participate in marketplace requests, but final acceptance, service start, and payout release wait for settlement. App message: Unpaid HANDS fees must be settled before final acceptance or service start.',
      operatorAction:
        'Confirm HANDS fee deposit or approved admin offset before final acceptance, service start, and payout release reopen.',
      href: cashDebtBookings.length ? '/cash-settlements' : '/bookings?view=cash-debt',
      bookings: cashDebtBookings,
    },
  ];
}
