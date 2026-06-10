export type BookingMatchingEscalationRowTone = 'danger' | 'info' | 'warn';

export type BookingMatchingEscalationRowInput<TBooking> = {
  readonly booking: TBooking;
  readonly hasChatRoom: boolean;
  readonly hasPreferredPartner: boolean;
  readonly marketplaceCount: number;
  readonly needsOps: boolean;
  readonly preferredAwaitingDecision: boolean;
  readonly responseWindowExpired: boolean;
  readonly selectableCount: number;
  readonly selectionLabel: string;
  readonly selectionPathLabel: string;
  readonly sortTimestamp: number;
  readonly status: string;
  readonly windowLabel: string;
};

export type BookingMatchingEscalationRow<TBooking> = {
  readonly booking: TBooking;
  readonly detail: string;
  readonly operatorAction: string;
  readonly tags: readonly string[];
  readonly title: string;
  readonly tone: BookingMatchingEscalationRowTone;
};

type SortableBookingMatchingEscalationRow<TBooking> = BookingMatchingEscalationRow<TBooking> & {
  readonly sortTimestamp: number;
};

export function buildBookingMatchingEscalationRows<TBooking>(
  inputs: readonly BookingMatchingEscalationRowInput<TBooking>[],
): readonly BookingMatchingEscalationRow<TBooking>[] {
  return inputs
    .map(toSortableEscalationRow)
    .filter((row): row is SortableBookingMatchingEscalationRow<TBooking> => row !== null)
    .sort((left, right) => {
      const toneDelta = toneWeight(right.tone) - toneWeight(left.tone);
      if (toneDelta !== 0) {
        return toneDelta;
      }
      return right.sortTimestamp - left.sortTimestamp;
    })
    .map(toEscalationRow);
}

function toSortableEscalationRow<TBooking>(
  input: BookingMatchingEscalationRowInput<TBooking>,
): SortableBookingMatchingEscalationRow<TBooking> | null {
  if (!input.needsOps) {
    return null;
  }

  if (input.status === 'OPEN_MATCHING' && input.responseWindowExpired) {
    return row(input, {
      detail: 'The booking is still open after its saved response window.',
      operatorAction:
        'Close or extend matching intentionally, then release payment if no final partner can be selected.',
      tags: baseTags(input),
      title: 'Response window expired',
      tone: 'danger',
    });
  }

  if (input.status === 'OPEN_MATCHING' && input.selectableCount > 0) {
    return row(input, {
      detail:
        'One or more Partners are ready after first-pick did not validly win, but the booking has not moved to final match.',
      operatorAction: 'Ask support to prompt the customer to choose a final partner from the waiting list.',
      tags: [...baseTags(input), input.selectionPathLabel],
      title: 'Customer fallback partner selection needed',
      tone: 'warn',
    });
  }

  if (
    input.status === 'OPEN_MATCHING' &&
    input.hasPreferredPartner &&
    input.preferredAwaitingDecision &&
    input.marketplaceCount === 0
  ) {
    return row(input, {
      detail: 'The preferred partner is still deciding and no marketplace partner participation is recorded.',
      operatorAction:
        'Check push delivery and eligible partners within the configured radius before the customer loses patience.',
      tags: [...baseTags(input), 'customer waiting'],
      title: 'First-pick pending with no marketplace option',
      tone: 'warn',
    });
  }

  if (
    input.status === 'OPEN_MATCHING' &&
    input.hasPreferredPartner &&
    input.preferredAwaitingDecision &&
    input.marketplaceCount > 0
  ) {
    return row(input, {
      detail: 'Marketplace partners are visible while the preferred partner still has first chance.',
      operatorAction:
        'Let the timer run or guide the customer to select a marketplace partner when wait time is becoming visible.',
      tags: [...baseTags(input), input.selectionPathLabel],
      title: 'First-pick pending with marketplace ready',
      tone: 'info',
    });
  }

  if (input.status === 'OPEN_MATCHING' && input.marketplaceCount === 0) {
    return row(input, {
      detail: 'No partner participation is recorded for the request yet.',
      operatorAction: 'Review location, service price, radius policy, and partner alert delivery.',
      tags: baseTags(input),
      title: 'Open request has no partner supply',
      tone: 'warn',
    });
  }

  if (input.status === 'MATCHED' && !input.hasChatRoom) {
    return row(input, {
      detail: 'The final partner is selected, but customer and partner cannot coordinate in chat.',
      operatorAction: 'Repair chat room creation before allowing service progress.',
      tags: [input.status, input.selectionLabel, 'chat missing'],
      title: 'Matched booking missing chat',
      tone: 'danger',
    });
  }

  return null;
}

function row<TBooking>(
  input: BookingMatchingEscalationRowInput<TBooking>,
  output: Omit<BookingMatchingEscalationRow<TBooking>, 'booking'>,
): SortableBookingMatchingEscalationRow<TBooking> {
  return {
    ...output,
    booking: input.booking,
    sortTimestamp: input.sortTimestamp,
  };
}

function baseTags(input: BookingMatchingEscalationRowInput<unknown>): readonly string[] {
  return [
    input.status,
    input.windowLabel,
    `${input.marketplaceCount} marketplace`,
    `${input.selectableCount} selectable`,
  ];
}

function toEscalationRow<TBooking>(
  row: SortableBookingMatchingEscalationRow<TBooking>,
): BookingMatchingEscalationRow<TBooking> {
  return {
    booking: row.booking,
    detail: row.detail,
    operatorAction: row.operatorAction,
    tags: row.tags,
    title: row.title,
    tone: row.tone,
  };
}

function toneWeight(tone: BookingMatchingEscalationRowTone) {
  if (tone === 'danger') {
    return 4;
  }
  if (tone === 'warn') {
    return 3;
  }
  return 2;
}
