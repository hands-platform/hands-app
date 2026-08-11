import type { AdminBookingMatchingEvidence } from './admin-api';

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

export type BookingListMatchingEvidence = Pick<
  AdminBookingMatchingEvidence,
  'chatReady' | 'finalSelection' | 'marketplaceParticipantCount' | 'selectableParticipantCount'
>;

export type BookingListStageInput = {
  readonly bookingId: string;
  readonly hasChatRoom: boolean;
  readonly isHandoffStatus: boolean;
  readonly isTerminalStatus: boolean;
  readonly locationNeedsOps: boolean;
  readonly matchingEvidence?: BookingListMatchingEvidence | undefined;
  readonly marketplaceAlertNotifiedCount: number;
  readonly marketplaceCount: number;
  readonly responseWindowExpired: boolean;
  readonly selectableCount: number;
  readonly selectedPartnerPresent: boolean;
  readonly status: string;
};

export function bookingListStageFromFacts(input: BookingListStageInput): BookingListStage {
  const finalSelection = input.matchingEvidence?.finalSelection;
  const chatReady = input.matchingEvidence?.chatReady ?? input.hasChatRoom;
  const marketplaceCount = input.matchingEvidence?.marketplaceParticipantCount ?? input.marketplaceCount;
  const selectableCount = input.matchingEvidence?.selectableParticipantCount ?? input.selectableCount;
  const selectedPartnerPresent =
    input.selectedPartnerPresent ||
    finalSelection === 'FIRST_PICK_ACCEPTED' ||
    finalSelection === 'CUSTOMER_SELECTED_PARTNER';

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

  if (input.isHandoffStatus && !chatReady) {
    return {
      action: 'Repair chat before the Partner moves further through the service flow.',
      detail: 'Final Partner exists, but chat is not ready.',
      href: `/bookings/${input.bookingId}#chat`,
      key: 'handoff-repair',
      label: 'Handoff repair',
      tone: 'danger',
    };
  }

  if (input.isHandoffStatus) {
    return {
      action: 'Track location, arrival, service start, completion, and closeout.',
      detail: input.locationNeedsOps
        ? 'Chat is ready, but Partner location needs review.'
        : 'Chat and service handoff are available.',
      href: `/bookings/${input.bookingId}#chat`,
      key: 'handoff',
      label: 'Service handoff',
      tone: input.locationNeedsOps ? 'warn' : 'ok',
    };
  }

  if (input.status === 'OPEN_MATCHING' && selectableCount > 0 && !selectedPartnerPresent) {
    return {
      action: 'Prompt customer support to help the customer choose the final Partner.',
      detail: `${selectableCount} customer-selectable Partner(s) are waiting for customer selection.`,
      href: `/bookings/${input.bookingId}#participants`,
      key: 'customer-choice',
      label: 'Customer choice',
      tone: 'warn',
    };
  }

  if (input.status === 'OPEN_MATCHING' && marketplaceCount > 0) {
    return {
      action:
        input.marketplaceAlertNotifiedCount > 0
          ? 'Monitor marketplace alert delivery and customer choice list quality.'
          : 'Nudge eligible Partners or check marketplace alert creation.',
      detail: `${marketplaceCount} marketplace Partner(s) are visible while matching stays open.`,
      href: `/bookings/${input.bookingId}#participants`,
      key: 'marketplace',
      label: 'Marketplace open',
      tone: 'info',
    };
  }

  if (input.status === 'OPEN_MATCHING') {
    return {
      action: input.responseWindowExpired
        ? 'Escalate marketplace supply or close/extend the request intentionally.'
        : 'Monitor Partner response, wallet gate, push delivery, and KYC status.',
      detail: input.responseWindowExpired
        ? 'The booking deadline is overdue and no usable marketplace Partner is visible.'
        : 'Preferred Partner and marketplace response are inside the same deadline.',
      href: `/bookings/${input.bookingId}#participants`,
      key: 'first-pick',
      label: 'Preferred pending',
      tone: input.responseWindowExpired ? 'danger' : 'warn',
    };
  }

  return {
    action: 'Confirm service, customer location, payment state, and first Partner before opening matching.',
    detail: `Booking is ${input.status.toLowerCase().replaceAll('_', ' ')}.`,
    href: `/bookings/${input.bookingId}`,
    key: 'intake',
    label: 'Booking intake',
    tone: 'info',
  };
}
