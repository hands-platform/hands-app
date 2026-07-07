export type BookingDecisionNotePreset = {
  id: string;
  label: string;
  title: string;
  detail: string;
  preset: string;
};

export type BookingDecisionNotePresetsInput = {
  bookingStatus: string;
  messageCount: number;
  hasLatestLocation: boolean;
  notificationCount: number;
  operatorNoteCount: number;
  paymentMethod: string;
  paymentStatus: string;
  refundRowCount: number;
  cashFeeDebtNeedsSettlement: boolean;
  closeoutOpenItemLabels: string[];
};

const ACTIVE_OR_TERMINAL_STATUSES = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
]);

const LOCATION_EXPECTED_STATUSES = new Set([
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
  'COMPLETED',
  'NO_SHOW',
]);

const MONEY_REVIEW_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'NO_SHOW']);

export function bookingDecisionNotePresets(
  input: BookingDecisionNotePresetsInput,
): BookingDecisionNotePreset[] {
  const presets: BookingDecisionNotePreset[] = [];
  const activeOrTerminal = ACTIVE_OR_TERMINAL_STATUSES.has(input.bookingStatus);
  const moneyReviewNeeded =
    input.paymentStatus !== 'NONE' &&
    (MONEY_REVIEW_STATUSES.has(input.bookingStatus) ||
      input.refundRowCount > 0 ||
      input.paymentStatus === 'AUTHORIZED');

  if (activeOrTerminal && input.messageCount === 0) {
    presets.push({
      id: 'chat-empty-note',
      label: 'Chat',
      title: 'Chat evidence is empty',
      detail: 'Use when a manual outcome is being reviewed but no customer/Partner messages are loaded.',
      preset:
        'Manual decision evidence note: chat archive is present/checked but has no retained customer or Partner messages for this booking.',
    });
  }

  if (LOCATION_EXPECTED_STATUSES.has(input.bookingStatus) && !input.hasLatestLocation) {
    presets.push({
      id: 'location-empty-note',
      label: 'Location',
      title: 'Partner location is not retained',
      detail:
        'Use before arrival, no-show, service completion, or refund review when no Partner pin is loaded.',
      preset:
        'Manual decision evidence note: no Partner location snapshot is retained for this booking at the time of operator review.',
    });
  }

  if (activeOrTerminal && input.notificationCount === 0) {
    presets.push({
      id: 'alert-empty-note',
      label: 'Alerts',
      title: 'Notification trail is empty',
      detail: 'Use when customer/Partner alert records are not available for this booking.',
      preset:
        'Manual decision evidence note: no customer or Partner notification delivery rows are loaded for this booking.',
    });
  }

  if (input.operatorNoteCount === 0) {
    presets.push({
      id: 'operator-note-needed',
      label: 'Note',
      title: 'Operator context not recorded yet',
      detail: 'Use when support has reviewed the booking and needs to leave a factual handling note.',
      preset:
        'Operator context note: booking reviewed for current status, customer/Partner handoff, chat, payment, and closeout readiness.',
    });
  }

  if (moneyReviewNeeded) {
    presets.push({
      id: 'payment-review-note',
      label: 'Money',
      title: 'Payment or refund review',
      detail: `${input.paymentMethod} / ${input.paymentStatus} / ${input.refundRowCount} refund row(s).`,
      preset: `Payment review note: booking ${input.bookingStatus}, payment ${input.paymentStatus}, method ${input.paymentMethod}, refund rows ${input.refundRowCount}.`,
    });
  }

  if (input.cashFeeDebtNeedsSettlement) {
    presets.push({
      id: 'cash-debt-note',
      label: 'Cash',
      title: 'Cash fee settlement needed',
      detail:
        'Use when cash collection created a Partner wallet debt that should be cleared by deposit or offset.',
      preset:
        'Cash settlement note: Partner cash-fee debt remains open; final acceptance, service start, and payout release should stay blocked until company deposit or admin offset is verified.',
    });
  }

  if (input.closeoutOpenItemLabels.length > 0) {
    const labels = input.closeoutOpenItemLabels.join(', ');
    presets.push({
      id: 'closeout-open-items-note',
      label: 'Closeout',
      title: 'Closeout has open items',
      detail: labels,
      preset: `Closeout status note: open factual items - ${labels}.`,
    });
  }

  if (presets.length === 0) {
    presets.push({
      id: 'evidence-reviewed-note',
      label: 'Clear',
      title: 'Evidence reviewed',
      detail: 'Use when the operator checked the factual evidence bundle and no immediate gap is visible.',
      preset:
        'Manual decision evidence note: chat, alerts, location, payment, and closeout records reviewed; no immediate evidence gap visible for current booking stage.',
    });
  }

  return presets;
}
