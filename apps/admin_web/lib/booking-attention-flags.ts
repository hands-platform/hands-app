import type { AttentionFlag } from './admin-attention-flags';

export type BookingAttentionFlagsInput = {
  bookingStatus: string;
  hasPayment: boolean;
  paymentStatus?: string | null;
  paymentProviderRef?: string | null;
  cashDebtNeedsSettlement: boolean;
  cashDebtPartnerLabel: string;
  cashDebtAmount: number;
  cashDebtCurrency?: string | null;
  matchingWindowExpired: boolean;
  expiresAtLabel: string;
  hasPreferredPartner: boolean;
  preferredPartnerLabel: string;
  participantCount: number;
  openedAgeMinutes: number | null;
  hasChatRoom: boolean;
  activeWithLocationNeed: boolean;
  hasLatestProviderLocation: boolean;
  latestProviderLocationFreshness?: string | null;
  providerLocationAgeLabel: string;
  messageCount: number;
  refundCount: number;
  formatMoney?: (amount?: number | null, currency?: string) => string;
};

const defaultMoney = (amount?: number | null, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount ?? 0);

const activeChatStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function bookingAttentionFlags(input: BookingAttentionFlagsInput): AttentionFlag[] {
  const flags: AttentionFlag[] = [];
  const paymentStatus = input.paymentStatus;
  const formatMoney = input.formatMoney ?? defaultMoney;

  if (
    input.bookingStatus === 'CANCELLED' &&
    input.hasPayment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({
      severity: 'high',
      title: 'Cancelled payment unresolved',
      detail: `Booking is cancelled but payment is still ${paymentStatus}.`,
      action: 'Release the authorization or refund before closing the ticket.',
    });
  }

  if (
    input.bookingStatus === 'EXPIRED' &&
    input.hasPayment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({
      severity: 'high',
      title: 'Expired payment unresolved',
      detail: `Booking is expired but payment is still ${paymentStatus}.`,
      action: 'Release the authorization or refund before closing the ticket.',
    });
  }

  if (
    input.bookingStatus === 'NO_SHOW' &&
    input.hasPayment &&
    !['RELEASED', 'REFUNDED'].includes(paymentStatus ?? '')
  ) {
    flags.push({
      severity: 'high',
      title: 'No-show payment unresolved',
      detail: `Booking is no-show but payment is still ${paymentStatus}.`,
      action: 'Decide whether to release, refund, or keep the fee according to the active operating policy.',
    });
  }

  if (input.bookingStatus === 'COMPLETED' && paymentStatus === 'AUTHORIZED') {
    flags.push({
      severity: 'high',
      title: 'Completed service still on hold',
      detail: 'The customer payment is authorized but not captured after completion.',
      action: 'Capture payment, or refund if there is an active dispute.',
    });
  }

  if (input.cashDebtNeedsSettlement) {
    flags.push({
      severity: 'high',
      title: 'Cash fee debt blocks partner',
      detail: `${input.cashDebtPartnerLabel} collected cash and still owes ${formatMoney(
        Math.abs(input.cashDebtAmount),
        input.cashDebtCurrency ?? 'VND',
      )}.`,
      action: 'Confirm the partner deposit or admin offset before marketplace participation or payout release resumes.',
    });
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.matchingWindowExpired) {
    flags.push({
      severity: 'high',
      title: 'Matching window expired',
      detail: `The request expired at ${input.expiresAtLabel} but is still open.`,
      action: 'Expire the booking and release or refund the payment hold.',
    });
  }

  if (
    input.bookingStatus === 'OPEN_MATCHING' &&
    input.hasPreferredPartner &&
    input.participantCount === 0 &&
    input.openedAgeMinutes !== null &&
    input.openedAgeMinutes >= 10
  ) {
    flags.push({
      severity: 'medium',
      title: 'Preferred partner slow',
      detail: `${input.preferredPartnerLabel} has not responded after ${input.openedAgeMinutes} minute(s).`,
      action: 'Encourage marketplace supply or contact the partner.',
    });
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.participantCount === 0) {
    flags.push({
      severity: 'medium',
      title: 'No partner supply',
      detail: 'No partner participation is recorded for the request yet.',
      action: 'Check nearby online partners and consider operational outreach.',
    });
  }

  if (input.bookingStatus === 'MATCHED' && !input.hasChatRoom) {
    flags.push({
      severity: 'high',
      title: 'Matched without chat',
      detail: 'A partner is selected but no chat room exists.',
      action: 'Retry chat room creation before the service starts.',
    });
  }

  if (input.activeWithLocationNeed && !input.hasLatestProviderLocation) {
    flags.push({
      severity: 'medium',
      title: 'No partner location record',
      detail: `Booking is ${input.bookingStatus}, but the partner has not shared a live pin.`,
      action: 'Ask the partner to share current location from the Partner app.',
    });
  }

  if (
    input.activeWithLocationNeed &&
    input.hasLatestProviderLocation &&
    input.latestProviderLocationFreshness !== 'recent'
  ) {
    flags.push({
      severity: 'medium',
      title: 'Partner location is stale',
      detail: `The latest partner pin is ${input.providerLocationAgeLabel.toLowerCase()}.`,
      action: 'Ask the partner to share location again from the Partner app.',
    });
  }

  if (input.hasChatRoom && input.messageCount === 0 && activeChatStatuses.has(input.bookingStatus)) {
    flags.push({
      severity: 'low',
      title: 'Chat quiet',
      detail: 'Chat is ready but no messages have been exchanged.',
      action: 'Monitor for first contact if the customer reports uncertainty.',
    });
  }

  if (paymentStatus === 'AUTHORIZED' && !input.paymentProviderRef) {
    flags.push({
      severity: 'medium',
      title: 'Payment reference missing',
      detail: 'The payment is authorized but has no gateway reference for reconciliation.',
      action: 'Sync payment before capture, release, or refund.',
    });
  }

  if (input.refundCount > 0 && paymentStatus && paymentStatus !== 'REFUNDED') {
    flags.push({
      severity: 'medium',
      title: 'Refund/payment mismatch',
      detail: `Refund records exist while payment status is ${paymentStatus}.`,
      action: 'Review gateway status and keep refund timeline aligned.',
    });
  }

  return flags;
}
