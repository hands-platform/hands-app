import {
  canCloseoutCompletedBooking,
  type BookingCloseoutPolicyInput,
} from './booking-closeout-policy';
import {
  bookingCheckFlag,
  compactBookingCheckFlags,
  type BookingCheckLevelFlag,
} from './booking-check-level';

export type BookingPaymentOpsInput = {
  status?: string | null;
  payment?: {
    status?: string | null;
    method?: string | null;
    providerRef?: string | null;
  } | null;
  completedCloseoutNeedsOps?: boolean;
  cashDebtNeedsOps?: boolean;
};

export type BookingRefundReviewOpsInput = {
  status?: string | null;
  payment?: {
    status?: string | null;
  } | null;
  refundCount?: number | null;
  paymentRefundCount?: number | null;
};

export type BookingManualDecisionOpsInput = {
  status?: string | null;
  completedCloseoutNeedsOps?: boolean;
  cashDebtNeedsOps?: boolean;
};

export type BookingPaymentOutcomeCheckFlagsInput = {
  status?: string | null;
  paymentStatus?: string | null;
  hasPayment?: boolean;
  completedCloseoutNeedsOps?: boolean;
  cashDebtNeedsOps?: boolean;
};

export type BookingPaymentReferenceCheckFlagsInput = {
  paymentStatus?: string | null;
  paymentProviderRef?: string | null;
};

const activePreCloseoutStatuses = new Set(['CREATED', 'OPEN_MATCHING', 'MATCHED']);
const manualDecisionStatuses = new Set(['CANCELLED', 'EXPIRED', 'NO_SHOW']);
const releaseCompletePaymentStatuses = new Set(['RELEASED', 'REFUNDED']);

function paymentIsReleaseComplete(status?: string | null) {
  return releaseCompletePaymentStatuses.has(status ?? '');
}

export function bookingPaymentOutcomeNeedsReview(status?: string | null) {
  return !paymentIsReleaseComplete(status);
}

export function bookingPaymentOutcomeCheckFlagsFromFacts(
  input: BookingPaymentOutcomeCheckFlagsInput,
): BookingCheckLevelFlag[] {
  const status = input.status ?? '';
  const paymentOutcomeNeedsOperatorReview =
    Boolean(input.hasPayment) && bookingPaymentOutcomeNeedsReview(input.paymentStatus);

  return compactBookingCheckFlags([
    bookingCheckFlag(
      status === 'CANCELLED' && paymentOutcomeNeedsOperatorReview,
      'high',
      'Cancelled payment unresolved',
    ),
    bookingCheckFlag(
      status === 'EXPIRED' && paymentOutcomeNeedsOperatorReview,
      'high',
      'Expired payment unresolved',
    ),
    bookingCheckFlag(
      status === 'COMPLETED' && input.paymentStatus === 'AUTHORIZED',
      'high',
      'Completed service still on hold',
    ),
    bookingCheckFlag(
      Boolean(input.completedCloseoutNeedsOps),
      'high',
      'Completed closeout incomplete',
    ),
    bookingCheckFlag(
      status === 'NO_SHOW' && paymentOutcomeNeedsOperatorReview,
      'high',
      'No-show payment unresolved',
    ),
    bookingCheckFlag(
      Boolean(input.cashDebtNeedsOps),
      'high',
      'Cash fee debt blocks marketplace alerts',
    ),
  ]);
}

export function bookingPaymentReferenceCheckFlagsFromFacts(
  input: BookingPaymentReferenceCheckFlagsInput,
): BookingCheckLevelFlag[] {
  return compactBookingCheckFlags([
    bookingCheckFlag(
      input.paymentStatus === 'AUTHORIZED' && !input.paymentProviderRef,
      'medium',
      'Payment reference missing',
    ),
  ]);
}

export function bookingCompletedCloseoutNeedsOpsFromFacts(
  booking: BookingCloseoutPolicyInput,
): boolean {
  return canCloseoutCompletedBooking(booking);
}

export function bookingPaymentNeedsOpsFromFacts(input: BookingPaymentOpsInput): boolean {
  const payment = input.payment;
  const status = input.status ?? '';

  if (!payment) {
    return activePreCloseoutStatuses.has(status);
  }
  if (manualDecisionStatuses.has(status) && !paymentIsReleaseComplete(payment.status)) {
    return true;
  }
  if (status === 'COMPLETED' && payment.status === 'AUTHORIZED') {
    return true;
  }
  if (input.completedCloseoutNeedsOps) {
    return true;
  }
  if (payment.status === 'AUTHORIZED' && !payment.providerRef) {
    return true;
  }
  if (payment.method === 'CASH' && payment.status === 'PENDING') {
    return true;
  }
  return Boolean(input.cashDebtNeedsOps);
}

export function bookingPaymentReleaseNeedsOpsFromFacts(input: {
  payment?: { status?: string | null } | null;
}): boolean {
  return Boolean(input.payment && !paymentIsReleaseComplete(input.payment.status));
}

export function bookingManualDecisionNeedsOpsFromFacts(
  input: BookingManualDecisionOpsInput,
): boolean {
  return Boolean(
    manualDecisionStatuses.has(input.status ?? '') ||
      input.cashDebtNeedsOps ||
      input.completedCloseoutNeedsOps,
  );
}

export function bookingRefundReviewNeedsOpsFromFacts(input: BookingRefundReviewOpsInput): boolean {
  const paymentStatus = input.payment?.status;
  const hasRefundRows = (input.refundCount ?? 0) > 0 || (input.paymentRefundCount ?? 0) > 0;

  if (hasRefundRows && paymentStatus !== 'REFUNDED') {
    return true;
  }
  if (manualDecisionStatuses.has(input.status ?? '') && input.payment) {
    return !paymentIsReleaseComplete(paymentStatus);
  }
  return false;
}
