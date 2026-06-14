export type PrimaryBookingOpsInstructionInput = {
  status?: string | null;
  payment?: { status?: string | null } | null;
  chatRoom?: unknown;
};

export type PrimaryBookingOpsInstructionOptions = {
  cashDebtNeedsSettlement?: boolean;
};

export function primaryBookingOpsInstruction(
  booking: PrimaryBookingOpsInstructionInput,
  options: PrimaryBookingOpsInstructionOptions = {},
) {
  if (booking.status === 'EXPIRED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Matching expired and the payment hold is released. Confirm customer communication before closing.'
      : 'Matching expired but payment still needs review. Release or refund before closing.';
  }
  if (booking.status === 'NO_SHOW') {
    return 'Booking is marked no-show. Review customer communication, payment release/refund, and any Partner fee impact before closing.';
  }
  if (booking.status === 'CANCELLED') {
    return booking.payment?.status === 'RELEASED'
      ? 'Booking is cancelled and the payment hold is already released. Confirm customer messaging only.'
      : 'Booking is cancelled, but payment still needs operator review. Release or refund before closing.';
  }
  if (booking.payment?.status === 'AUTHORIZED' && booking.status === 'COMPLETED') {
    return 'Service is complete. Capture the authorized payment or refund if there was a dispute.';
  }
  if (options.cashDebtNeedsSettlement) {
    return 'Cash was collected by the Partner. Finance must settle the HANDS fee debt before this Partner participates in marketplace bookings again or receives payout release.';
  }
  if (booking.payment?.status === 'AUTHORIZED') {
    return 'Payment hold is live. Keep it authorized until service completion or cancellation.';
  }
  if (booking.status === 'OPEN_MATCHING') {
    return 'Monitor Partner response speed and marketplace supply. Customer is still waiting.';
  }
  if (booking.status === 'MATCHED') {
    return 'Partner is selected. Monitor chat readiness, location sharing, and arrival progression.';
  }
  if (booking.chatRoom && booking.status === 'IN_SERVICE') {
    return 'Service is live. Keep chat and location visible until completion.';
  }
  return 'No same-shift action is required. Continue monitoring this booking from the timeline.';
}
