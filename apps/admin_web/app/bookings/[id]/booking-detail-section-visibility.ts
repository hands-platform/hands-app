const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);
const LIVE_BOOKING_STATUSES = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export type BookingDetailSectionVisibilityInput = {
  readonly status: string;
  readonly hasChatMessages: boolean;
  readonly hasCloseoutExceptions: boolean;
  readonly hasEarning: boolean;
  readonly hasFinanceFlags: boolean;
  readonly hasMatchedAt: boolean;
  readonly hasNotifications: boolean;
  readonly hasOperatorNotes: boolean;
  readonly hasPayment: boolean;
  readonly hasPostMatchDecision: boolean;
  readonly hasSelectedPartner: boolean;
};

export type BookingDetailSectionVisibility = {
  readonly showCloseoutReadiness: boolean;
  readonly showDispatchDisclosure: boolean;
  readonly showEvidenceDisclosure: boolean;
  readonly showHistoryDisclosure: boolean;
  readonly showSettlementDisclosure: boolean;
};

export function bookingDetailSectionVisibility({
  status,
  hasChatMessages,
  hasCloseoutExceptions,
  hasEarning,
  hasFinanceFlags,
  hasMatchedAt,
  hasNotifications,
  hasOperatorNotes,
  hasPayment,
  hasPostMatchDecision,
  hasSelectedPartner,
}: BookingDetailSectionVisibilityInput): BookingDetailSectionVisibility {
  const isTerminal = TERMINAL_BOOKING_STATUSES.has(status);
  const hasLiveServiceState = LIVE_BOOKING_STATUSES.has(status);
  const hasPostMatchState = hasLiveServiceState || hasMatchedAt || hasSelectedPartner || status === 'COMPLETED';
  const hasDecisionEvidence = hasPostMatchDecision || hasOperatorNotes || hasChatMessages;
  const hasFinanceEvidence = hasPayment || hasEarning || hasFinanceFlags;

  return {
    showCloseoutReadiness: isTerminal || hasCloseoutExceptions || hasFinanceFlags,
    showDispatchDisclosure: !isTerminal,
    showEvidenceDisclosure: hasDecisionEvidence || status === 'NO_SHOW' || status === 'REFUNDED',
    showHistoryDisclosure: hasPostMatchState || hasChatMessages || hasNotifications,
    showSettlementDisclosure: isTerminal || hasFinanceEvidence,
  };
}
