export type BookingFlowStagesInput = {
  createdAtLabel: string;
  openedAtLabel?: string | null;
  hasOpened: boolean;
  hasPreferredPartner: boolean;
  partnerDecisionLabel: string;
  partnerHint: string;
  participantCount: number;
  bookingStatus: string;
  selectedPartnerLabel: string;
  hasSelectedPartner: boolean;
  hasChatRoom: boolean;
  paymentStatus: string;
  paymentHint: string;
};

export type BookingFlowStage = {
  label: string;
  value: string;
  hint: string;
  done: boolean;
};

const partnerReplyDoneStatuses = new Set(['MATCHED', 'IN_SERVICE', 'COMPLETED']);
const terminalPaymentStatuses = new Set(['CAPTURED', 'RELEASED', 'REFUNDED']);

export function bookingFlowStages(input: BookingFlowStagesInput): BookingFlowStage[] {
  return [
    {
      label: 'Created',
      value: input.createdAtLabel,
      hint: 'Customer selected service and address.',
      done: true,
    },
    {
      label: 'Opened',
      value: input.hasOpened ? input.openedAtLabel ?? 'Not opened' : 'Not opened',
      hint: input.hasPreferredPartner
        ? 'Direct request sent to preferred Partner.'
        : 'Open matching started.',
      done: input.hasOpened,
    },
    {
      label: 'Partner reply',
      value: input.partnerDecisionLabel,
      hint: input.partnerHint,
      done: input.participantCount > 0 || partnerReplyDoneStatuses.has(input.bookingStatus),
    },
    {
      label: 'Matched',
      value: input.selectedPartnerLabel,
      hint: input.hasChatRoom ? 'Chat room is ready.' : 'Waiting for final Partner selection.',
      done: input.hasSelectedPartner,
    },
    {
      label: 'Payment',
      value: input.paymentStatus,
      hint: input.paymentHint,
      done: terminalPaymentStatuses.has(input.paymentStatus),
    },
  ];
}
