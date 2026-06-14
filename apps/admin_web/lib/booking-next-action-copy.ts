export type BookingNextActionCopyInput = {
  readonly backupSelected: boolean;
  readonly cashDebtNeedsOps: boolean;
  readonly completedCloseoutNeedsOps: boolean;
  readonly hasPayment: boolean;
  readonly hasPreferredPartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly paymentStatus: string | null;
  readonly preferredAwaitingDecision: boolean;
  readonly status: string;
};

export function bookingNextActionCopy(input: BookingNextActionCopyInput) {
  if (input.status === 'NO_SHOW') {
    return input.hasPayment && !['RELEASED', 'REFUNDED'].includes(input.paymentStatus ?? '')
      ? 'No-show is marked. Decide payment release, refund, or fee handling before closing.'
      : 'No-show is marked and payment outcome is already closed. Confirm customer and Partner notes.';
  }
  if (input.status === 'EXPIRED') {
    return input.paymentStatus === 'RELEASED'
      ? 'Matching expired and the payment hold is released. Confirm customer communication.'
      : 'Matching expired. Release or refund the linked payment before closing.';
  }
  if (input.status === 'CANCELLED') {
    return input.paymentStatus === 'RELEASED'
      ? 'Customer cancelled before completion. Payment hold is released; confirm notifications were delivered.'
      : 'Customer cancelled. Review the linked payment and release or refund before closing the case.';
  }
  if (input.status === 'REFUNDED') {
    return 'Refund is recorded. Check the refund board and customer communication.';
  }
  if (input.cashDebtNeedsOps) {
    return 'Partner collected cash. Finance must settle the HANDS fee debt before this Partner participates in marketplace bookings again or receives payout release.';
  }
  if (
    input.status === 'OPEN_MATCHING' &&
    input.hasPreferredPartner &&
    input.preferredAwaitingDecision
  ) {
    return 'Wait for the first-pick Partner, but monitor marketplace Partner supply.';
  }
  if (input.status === 'OPEN_MATCHING' && input.marketplaceParticipantCount === 0) {
    return 'Check notifications and nearby Partner supply.';
  }
  if (input.status === 'OPEN_MATCHING' && input.marketplaceParticipantCount > 0) {
    return 'Customer can keep waiting or switch to a marketplace Partner.';
  }
  if (input.status === 'MATCHED' && input.backupSelected) {
    return 'Customer switched away from the first-pick Partner. Confirm chat, route, and Partner handoff.';
  }
  if (input.status === 'MATCHED') {
    return 'Customer selection is locked. Check chat creation, route tracking, and Partner departure.';
  }
  if (input.status === 'PROVIDER_ON_THE_WAY') {
    return 'Monitor live location and arrival progress.';
  }
  if (input.status === 'IN_SERVICE') {
    return 'Track completion and payment capture.';
  }
  if (input.completedCloseoutNeedsOps) {
    return 'Completed service needs closeout reconciliation for payment, earning, tax, and wallet records.';
  }
  if (input.status === 'COMPLETED') {
    return 'Review payment, customer feedback, and closeout records.';
  }
  return 'Normal operating state.';
}
