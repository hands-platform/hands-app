export type BookingFinalGateReasonInput = {
  cashDebt: boolean;
  walletLedgerLabel: string;
  hasAddressSnapshot: boolean;
  bookingStatus: string;
  hasPreferredPartner: boolean;
  preferredAwaitingDecision: boolean;
  customerChoiceCandidates: number;
  marketplaceParticipants: number;
  selected: boolean;
  hasChatRoom: boolean;
};

export type BookingFinalGateReason = {
  title: string;
  detail: string;
  operatorRule: string;
  className: 'ops-task-done' | 'ops-task-warning' | 'ops-task-blocked';
  pillClass: 'pill-success' | 'pill-warn' | 'pill-danger';
};

export type BookingFinalGateReasonPresentation = {
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: BookingFinalGateReason['pillClass'];
};

export function bookingFinalGateReason(input: BookingFinalGateReasonInput): BookingFinalGateReason {
  if (input.cashDebt) {
    return {
      title: 'Wallet debt gate',
      detail: `${input.walletLedgerLabel}. Partner can see marketplace requests, but final acceptance, service start, and payout release wait for settlement or approved offset.`,
      operatorRule:
        'Collect the HANDS cash fee deposit or approve a documented offset before final acceptance, service start, or payout release.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  if (!input.hasAddressSnapshot) {
    return {
      title: 'Confirmed address gate',
      detail:
        'Confirmed service address is missing. Marketplace radius and dispatch evidence should use the booked service address, not a moving customer GPS point.',
      operatorRule: 'Repair or verify the confirmed service address before relying on distance-based dispatch decisions.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  if (
    input.bookingStatus === 'OPEN_MATCHING' &&
    input.hasPreferredPartner &&
    input.preferredAwaitingDecision
  ) {
    return {
      title: 'First-pick window',
      detail:
        'The preferred Partner is still inside the first response window. Nearby marketplace Partners can express intent, but the system must not auto-assign anyone.',
      operatorRule:
        'Watch Partner alerts and response time; customer final choice remains the only final matching action.',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    };
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.customerChoiceCandidates > 0 && !input.selected) {
    return {
      title: 'Customer final choice',
      detail: `${input.customerChoiceCandidates} Partner(s) can be selected by the customer, including ${input.marketplaceParticipants} marketplace participant(s). Chat opens only after the customer chooses the final Partner.`,
      operatorRule: 'Support the customer decision step; do not assign a Partner automatically.',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    };
  }

  if (input.bookingStatus === 'OPEN_MATCHING') {
    return {
      title: 'Partner supply wait',
      detail:
        'No participating/accepted Partner is selectable yet. Check 10km marketplace eligibility, Partner app inbox, push delivery, and latest saved locations.',
      operatorRule: 'Use factual alert, location, and participant records before support follow-up.',
      className: 'ops-task-warning',
      pillClass: 'pill-warn',
    };
  }

  if (input.bookingStatus === 'MATCHED' && !input.hasChatRoom) {
    return {
      title: 'Chat handoff gate',
      detail:
        'Customer final Partner is locked, but the chat room is missing. Service coordination should wait until chat is repaired.',
      operatorRule: 'Repair chat creation or open a support record before Partner movement handoff.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  if (input.bookingStatus === 'MATCHED') {
    return {
      title: 'Final Partner locked',
      detail:
        'Customer final choice is complete. Continue monitoring chat, Partner location handoff, and service progress.',
      operatorRule: 'Use the retained booking record for operations follow-up.',
      className: 'ops-task-done',
      pillClass: 'pill-success',
    };
  }

  return {
    title: 'Gate clear',
    detail:
      'No marketplace or payout blocker is visible on this booking. Continue using factual payment, chat, location, and closeout records.',
    operatorRule: 'Keep manual outcomes evidence-based; do not introduce judgment labels or automatic Partner assignment.',
    className: 'ops-task-done',
    pillClass: 'pill-success',
  };
}

export function bookingFinalGateReasonPresentation({
  bookingId,
  reason,
}: {
  readonly bookingId: string;
  readonly reason: BookingFinalGateReason;
}): BookingFinalGateReasonPresentation {
  return {
    detail: reason.detail,
    href: bookingFinalGateReasonHref(reason.title, bookingId),
    label: reason.title,
    tone: reason.pillClass,
  };
}

function bookingFinalGateReasonHref(title: string, bookingId: string) {
  if (title === 'Wallet debt gate') {
    return '/cash-settlements';
  }
  if (title === 'Confirmed address gate') {
    return '/bookings?view=address';
  }
  if (title === 'First-pick window') {
    return '/bookings?view=first-pick';
  }
  if (title === 'Customer final choice') {
    return '/bookings?view=customer-choice';
  }
  if (title === 'Partner supply wait') {
    return '/bookings?view=no-supply';
  }
  if (title === 'Chat handoff gate') {
    return '/bookings?view=chat-repair';
  }
  return `/bookings/${bookingId}`;
}
