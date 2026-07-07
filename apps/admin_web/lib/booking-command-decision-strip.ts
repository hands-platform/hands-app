export type BookingCommandDecisionTone =
  | 'pill-danger'
  | 'pill-info'
  | 'pill-neutral'
  | 'pill-success'
  | 'pill-warn';

export type BookingCommandDecisionStripInput = {
  bookingStatus: string;
  hasAddressSnapshot: boolean;
  addressLabel: string;
  participantCount: number;
  customerChoiceCandidateCount: number;
  marketplaceEligibleCount: number;
  hasFinalPartner: boolean;
  hasChatRoom: boolean;
  messageCount: number;
  paymentMethod: string;
  paymentStatus: string;
  cashDebtNeedsSettlement: boolean;
  closeoutOpenItemCount: number;
};

export type BookingCommandDecisionRow = {
  lane: string;
  state: string;
  detail: string;
  href: string;
  tone: BookingCommandDecisionTone;
};

export type BookingCommandDecisionStrip = {
  status: string;
  tone: BookingCommandDecisionTone;
  primaryAction: string;
  primaryDetail: string;
  rows: BookingCommandDecisionRow[];
};

const activeStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function bookingCommandDecisionStrip(
  input: BookingCommandDecisionStripInput,
): BookingCommandDecisionStrip {
  const rows: BookingCommandDecisionRow[] = [
    addressRow(input),
    matchingRow(input),
    chatRow(input),
    financeRow(input),
  ];
  const primary = primaryDecision(input, rows);

  return {
    status: primary.status,
    tone: primary.tone,
    primaryAction: primary.primaryAction,
    primaryDetail: primary.primaryDetail,
    rows,
  };
}

function addressRow(input: BookingCommandDecisionStripInput): BookingCommandDecisionRow {
  if (!input.hasAddressSnapshot) {
    return {
      lane: 'Address',
      state: 'Missing snapshot',
      detail: 'Booking creation and marketplace distance decisions require a confirmed service address.',
      href: '#customer',
      tone: 'pill-danger',
    };
  }

  return {
    lane: 'Address',
    state: 'Snapshot ready',
    detail: input.addressLabel,
    href: '#address-radius-contract',
    tone: 'pill-success',
  };
}

function matchingRow(input: BookingCommandDecisionStripInput): BookingCommandDecisionRow {
  if (input.bookingStatus === 'OPEN_MATCHING' && input.customerChoiceCandidateCount > 0) {
    return {
      lane: 'Matching',
      state: 'Customer choice',
      detail: `${input.customerChoiceCandidateCount} customer-selectable Partner(s) / ${input.participantCount} actual participant row(s).`,
      href: '#participants',
      tone: 'pill-warn',
    };
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.marketplaceEligibleCount > 0) {
    return {
      lane: 'Matching',
      state: 'Marketplace open',
      detail: `${input.marketplaceEligibleCount} Partner(s) are inside the booking-address marketplace policy.`,
      href: '#marketplace-supply',
      tone: 'pill-info',
    };
  }

  if (input.hasFinalPartner) {
    return {
      lane: 'Matching',
      state: 'Final Partner selected',
      detail: 'Customer final Partner choice is recorded. There is no automatic assignment.',
      href: '#participants',
      tone: 'pill-success',
    };
  }

  return {
    lane: 'Matching',
    state: 'Waiting',
    detail: `${input.participantCount} actual participant row(s) retained for this booking.`,
    href: '#participants',
    tone: 'pill-neutral',
  };
}

function chatRow(input: BookingCommandDecisionStripInput): BookingCommandDecisionRow {
  if (activeStatuses.has(input.bookingStatus) && !input.hasChatRoom) {
    return {
      lane: 'Chat',
      state: 'Missing',
      detail: 'Matched and active bookings should have retained chat before service handoff.',
      href: '#chat',
      tone: 'pill-danger',
    };
  }

  if (input.hasChatRoom) {
    return {
      lane: 'Chat',
      state: 'Retained',
      detail: `${input.messageCount} message(s) kept for admin review after mobile closeout.`,
      href: '#chat',
      tone: 'pill-success',
    };
  }

  return {
    lane: 'Chat',
    state: 'Pending',
    detail: 'Chat opens after the customer chooses the final Partner.',
    href: '#chat',
    tone: 'pill-info',
  };
}

function financeRow(input: BookingCommandDecisionStripInput): BookingCommandDecisionRow {
  if (input.cashDebtNeedsSettlement) {
    return {
      lane: 'Finance',
      state: 'Settlement required',
      detail: 'Partner wallet debt blocks final acceptance, service start, and payout release until settled.',
      href: '#finance',
      tone: 'pill-danger',
    };
  }

  if (input.bookingStatus === 'COMPLETED' && input.paymentStatus === 'AUTHORIZED') {
    return {
      lane: 'Finance',
      state: 'Capture review',
      detail: 'Completed service still has an authorized payment; review capture or refund evidence.',
      href: '#payment',
      tone: 'pill-warn',
    };
  }

  if (input.closeoutOpenItemCount > 0) {
    return {
      lane: 'Finance',
      state: 'Closeout open',
      detail: `${input.closeoutOpenItemCount} closeout item(s) still need factual review.`,
      href: '#booking-closeout-readiness',
      tone: 'pill-warn',
    };
  }

  return {
    lane: 'Finance',
    state: `${input.paymentMethod} / ${input.paymentStatus}`,
    detail: 'No immediate wallet or payout release block is active from this strip.',
    href: '#finance',
    tone: 'pill-success',
  };
}

function primaryDecision(
  input: BookingCommandDecisionStripInput,
  rows: BookingCommandDecisionRow[],
): Pick<BookingCommandDecisionStrip, 'status' | 'tone' | 'primaryAction' | 'primaryDetail'> {
  if (!input.hasAddressSnapshot) {
    return {
      status: 'Address check',
      tone: 'pill-danger',
      primaryAction: 'Confirm service address',
      primaryDetail: rows[0].detail,
    };
  }

  if (activeStatuses.has(input.bookingStatus) && !input.hasChatRoom) {
    const chat = rows.find((row) => row.lane === 'Chat') ?? rows[2];
    return {
      status: 'Handoff repair',
      tone: 'pill-danger',
      primaryAction: 'Repair chat handoff',
      primaryDetail: chat.detail,
    };
  }

  if (input.cashDebtNeedsSettlement) {
    const finance = rows.find((row) => row.lane === 'Finance') ?? rows[3];
    return {
      status: 'Finance gate',
      tone: 'pill-danger',
      primaryAction: 'Settle Partner cash fee debt',
      primaryDetail: finance.detail,
    };
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.customerChoiceCandidateCount > 0) {
    const matching = rows.find((row) => row.lane === 'Matching') ?? rows[1];
    return {
      status: 'Customer choice',
      tone: 'pill-warn',
      primaryAction: 'Keep customer final choice visible',
      primaryDetail: matching.detail,
    };
  }

  if (input.bookingStatus === 'OPEN_MATCHING') {
    const matching = rows.find((row) => row.lane === 'Matching') ?? rows[1];
    return {
      status: 'Matching watch',
      tone: 'pill-info',
      primaryAction: 'Monitor marketplace participation',
      primaryDetail: matching.detail,
    };
  }

  if (input.bookingStatus === 'COMPLETED' && input.paymentStatus === 'AUTHORIZED') {
    const finance = rows.find((row) => row.lane === 'Finance') ?? rows[3];
    return {
      status: 'Payment review',
      tone: 'pill-warn',
      primaryAction: 'Capture or release payment',
      primaryDetail: finance.detail,
    };
  }

  if (input.closeoutOpenItemCount > 0) {
    const finance = rows.find((row) => row.lane === 'Finance') ?? rows[3];
    return {
      status: 'Closeout review',
      tone: 'pill-warn',
      primaryAction: 'Review open closeout items',
      primaryDetail: finance.detail,
    };
  }

  return {
    status: 'Monitoring',
    tone: 'pill-success',
    primaryAction: 'Continue normal monitoring',
    primaryDetail: 'No immediate booking command issue is active.',
  };
}
