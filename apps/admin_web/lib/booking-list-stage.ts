export type BookingListStageKey =
  | 'intake'
  | 'first-pick'
  | 'marketplace'
  | 'customer-choice'
  | 'handoff'
  | 'handoff-repair'
  | 'closeout';

export type BookingListStageTone = 'danger' | 'info' | 'ok' | 'warn';

export type BookingListStage = {
  readonly action: string;
  readonly detail: string;
  readonly href: string;
  readonly key: BookingListStageKey;
  readonly label: string;
  readonly tone: BookingListStageTone;
};

export type BookingListStageInput = {
  readonly bookingId: string;
  readonly hasChatRoom: boolean;
  readonly isHandoffStatus: boolean;
  readonly isTerminalStatus: boolean;
  readonly locationNeedsOps: boolean;
  readonly marketplaceAlertNotifiedCount: number;
  readonly marketplaceCount: number;
  readonly responseWindowExpired: boolean;
  readonly selectableCount: number;
  readonly selectedPartnerPresent: boolean;
  readonly status: string;
};

export function bookingListStageFromFacts(input: BookingListStageInput): BookingListStage {
  if (input.isTerminalStatus) {
    return {
      action: 'Confirm payment, refund, review, no-show, and audit trail before archiving.',
      detail: `Closed as ${input.status}.`,
      href: `/bookings/${input.bookingId}`,
      key: 'closeout',
      label: 'Closeout',
      tone: input.status === 'COMPLETED' ? 'ok' : 'warn',
    };
  }

  if (input.isHandoffStatus && !input.hasChatRoom) {
    return {
      action: 'Repair chat before the partner moves further through the service flow.',
      detail: 'Final partner exists, but chat is not ready.',
      href: `/bookings/${input.bookingId}#chat`,
      key: 'handoff-repair',
      label: 'Stage 4 repair',
      tone: 'danger',
    };
  }

  if (input.isHandoffStatus) {
    return {
      action: 'Track location, arrival, service start, completion, and closeout.',
      detail: input.locationNeedsOps
        ? 'Chat is ready, but partner location needs review.'
        : 'Chat and service handoff are available.',
      href: `/bookings/${input.bookingId}#chat`,
      key: 'handoff',
      label: 'Stage 4 handoff',
      tone: input.locationNeedsOps ? 'warn' : 'ok',
    };
  }

  if (input.status === 'OPEN_MATCHING' && input.selectableCount > 0 && !input.selectedPartnerPresent) {
    return {
      action: 'Prompt customer support to help the customer choose the final partner.',
      detail: `${input.selectableCount} customer-selectable partner(s) are waiting for customer selection.`,
      href: `/bookings/${input.bookingId}#participants`,
      key: 'customer-choice',
      label: 'Stage 3 choice',
      tone: 'warn',
    };
  }

  if (input.status === 'OPEN_MATCHING' && input.marketplaceCount > 0) {
    return {
      action:
        input.marketplaceAlertNotifiedCount > 0
          ? 'Monitor marketplace alert delivery and customer choice list quality.'
          : 'Nudge eligible partners or check marketplace alert creation.',
      detail: `${input.marketplaceCount} marketplace partner(s) are visible while matching stays open.`,
      href: `/bookings/${input.bookingId}#participants`,
      key: 'marketplace',
      label: 'Stage 2 marketplace',
      tone: 'info',
    };
  }

  if (input.status === 'OPEN_MATCHING') {
    return {
      action: input.responseWindowExpired
        ? 'Escalate marketplace supply or close/extend the request intentionally.'
        : 'Monitor partner response, wallet gate, push delivery, and KYC status.',
      detail: input.responseWindowExpired
        ? 'The first response window is overdue and no usable marketplace partner is visible.'
        : 'Preferred partner is inside the first response window.',
      href: `/bookings/${input.bookingId}#participants`,
      key: 'first-pick',
      label: 'Stage 1 first-pick',
      tone: input.responseWindowExpired ? 'danger' : 'warn',
    };
  }

  return {
    action: 'Confirm service, customer location, payment state, and first partner before opening matching.',
    detail: `Booking is ${input.status.toLowerCase().replaceAll('_', ' ')}.`,
    href: `/bookings/${input.bookingId}`,
    key: 'intake',
    label: 'Stage 0 intake',
    tone: 'info',
  };
}
