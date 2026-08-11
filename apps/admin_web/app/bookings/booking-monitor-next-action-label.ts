import type { AdminBooking } from '../../lib/admin-api';
import { bookingNextActionCopy } from '../../lib/booking-next-action-copy';
import { bookingNextActionCopyInputFromBooking } from './booking-next-action-inputs';
import type { BookingPageView } from './booking-page-params';
import { bookingPricingPolicySignalInput } from './booking-pricing-policy-inputs';
import { bookingPricingPolicySignalFromFacts } from '../../lib/booking-pricing-policy-signal';
import { bookingPaymentExceptionFacts } from './booking-payment-closeout-facts';

export function bookingMonitorNextAction(
  booking: AdminBooking,
  nowMs: number,
  view?: BookingPageView,
) {
  const fallbackHelper = bookingNextActionCopy(bookingNextActionCopyInputFromBooking(booking));
  const queueAction = bookingCloseoutQueueAction(booking, view);
  if (queueAction) return queueAction;

  if (booking.status === 'OPEN_MATCHING') {
    const openedAt = booking.statusChangedAt ?? booking.openedAt ?? booking.createdAt ?? booking.updatedAt;
    const stalled = openedAt ? nowMs - Date.parse(openedAt) >= 30 * 60_000 : false;
    return stalled
      ? {
          helper: 'Check Partner participation and contact the customer if needed.',
          label: 'Review stalled matching',
        }
      : {
          helper: 'Customer may keep waiting or switch to Marketplace.',
          label: 'Monitor matching',
        };
  }

  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return {
      helper: 'Confirm the selected Partner and create or restore the chat room.',
      label: 'Repair chat handoff',
    };
  }

  if (booking.status === 'IN_SERVICE') {
    const delayed = booking.scheduledEndAt ? Date.parse(booking.scheduledEndAt) < nowMs : false;
    return delayed
      ? {
          helper: 'Confirm completion, then verify payment capture.',
          label: 'Contact Partner',
        }
      : {
          helper: 'No action unless the expected end time is exceeded.',
          label: 'Monitor service completion',
        };
  }

  const labels: Record<string, string> = {
    ARRIVED: 'Monitor service start',
    CANCELLED: 'Review payment outcome',
    COMPLETED: 'Review closeout',
    EXPIRED: 'Review payment hold',
    MATCHED: 'Monitor Partner handoff',
    NO_SHOW: 'Decide no-show outcome',
    PROVIDER_ON_THE_WAY: 'Monitor arrival',
    REFUNDED: 'Confirm customer notice',
  };

  return { helper: fallbackHelper, label: labels[booking.status] ?? 'Open booking' };
}

function bookingCloseoutQueueAction(booking: AdminBooking, view?: BookingPageView) {
  if (view === 'payment') {
    const facts = bookingPaymentExceptionFacts(booking);
    if (facts.paymentMissing) {
      return action('Review payment record', 'Open booking finance evidence and confirm the terminal payment outcome.');
    }
    if (facts.gatewayRefMissing) {
      return action('Add gateway reference', 'Open booking finance evidence and attach the missing gateway reference.');
    }
    if (facts.authorizationPending) {
      return action('Resolve authorization', 'Open booking finance evidence and verify capture or release of the authorization.');
    }
    if (facts.cashStatusPending) {
      return action('Confirm cash status', 'Open booking finance evidence and verify cash collection and commission debt.');
    }
    if (facts.refundMismatch) {
      return action('Review refund mismatch', 'Open booking finance evidence and compare refund records with the payment outcome.');
    }
    if (facts.cashCommissionDue) {
      return action('Settle cash commission', 'Open booking finance evidence and reconcile the commission owed to HANDS.');
    }
    if (facts.paymentReleasePending) {
      return action('Review payment hold', 'Open booking finance evidence and verify release or refund of the retained payment.');
    }
    return action('Review payment exception', 'Open booking finance evidence and verify why this record remains in the queue.');
  }

  if (view === 'closeout') {
    if (!booking.earning) {
      return action('Review missing earning', 'Open booking finance evidence and verify the missing Partner earning.');
    }
    if (!booking.earning.platformFeeLogs?.length) {
      return action('Review platform fee record', 'Open booking finance evidence and verify the missing platform fee record.');
    }
    if (!booking.earning.taxLogs?.length) {
      return action('Review tax record', 'Open booking finance evidence and verify the missing Partner withholding record.');
    }
    if (!booking.earning.walletLedgerEntries?.length) {
      return action('Review wallet record', 'Open booking finance evidence and verify the missing Partner wallet record.');
    }
    return action('Review closeout evidence', 'Open booking finance evidence and compare payment, earning, fee, tax, and wallet records.');
  }

  if (view === 'pricing') {
    const pricing = bookingPricingPolicySignalFromFacts(bookingPricingPolicySignalInput(booking));
    return pricing.label === 'Active payout rule missing'
      ? action('Review payout rule', 'Open booking finance evidence and verify the active payout rule for the booked price.')
      : action('Review booked price', `Open booking finance evidence and verify the pricing signal: ${pricing.label}.`);
  }

  if (view === 'refund-review') {
    return action(
      'Review refund mismatch',
      'Open booking finance evidence and compare refund records with the payment outcome.',
    );
  }

  if (view === 'expired') {
    return action('Open expired record', 'Review retained terminal evidence. Expiry alone does not assign a closeout action.');
  }

  if (view === 'cash-debt') {
    return action('Settle cash commission', 'Open booking finance evidence and reconcile the Partner commission owed to HANDS.');
  }

  return null;
}

function action(label: string, helper: string) {
  return { helper, label };
}
