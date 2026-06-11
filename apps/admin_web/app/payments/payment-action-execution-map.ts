import type { AdminPayment } from '../../lib/admin-api';
import type { PaymentActionExecutionRow } from './payment-operations-table-section';
import { paymentCashDebtNeedsSettlement } from './payment-page-rules';

const TERMINAL_PAYMENT_STATUSES = ['CAPTURED', 'REFUNDED', 'RELEASED'];
const CLOSED_WITHOUT_CAPTURE_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'NO_SHOW', 'REFUNDED'];

export function paymentActionExecutionMap(payment: AdminPayment): PaymentActionExecutionRow[] {
  const bookingStatus = payment.booking?.status ?? 'UNKNOWN';
  const hasGatewayReference = Boolean(payment.providerRef);
  const terminalPayment = TERMINAL_PAYMENT_STATUSES.includes(payment.status);
  const completedService = bookingStatus === 'COMPLETED';
  const closedWithoutCapture = CLOSED_WITHOUT_CAPTURE_BOOKING_STATUSES.includes(bookingStatus);
  const cashDebt = paymentCashDebtNeedsSettlement(payment);

  return [
    {
      action: 'Sync',
      operatorRule:
        'Use sync before manual money actions when a gateway reference exists. Sync should not decide service outcome.',
      pillClass: hasGatewayReference ? 'pill-success' : 'pill-neutral',
      reason: hasGatewayReference
        ? `Gateway reference ${payment.providerRef} is saved on this payment.`
        : 'No gateway reference is saved yet.',
      status: hasGatewayReference ? 'Available' : 'No gateway ref',
    },
    {
      action: 'Capture',
      operatorRule: 'Capture only after completed service evidence and payment ledger review.',
      pillClass: payment.status === 'AUTHORIZED' && completedService ? 'pill-warn' : 'pill-neutral',
      reason:
        payment.status === 'AUTHORIZED' && completedService
          ? 'The service is completed and the authorization hold is still active.'
          : terminalPayment
            ? `Payment is already ${payment.status}.`
            : payment.status === 'AUTHORIZED'
              ? `Booking is ${bookingStatus}; service completion evidence is not final yet.`
              : `Payment status is ${payment.status}.`,
      status:
        payment.status === 'AUTHORIZED' && completedService
          ? 'Review capture'
          : terminalPayment
            ? 'Locked'
            : payment.status === 'AUTHORIZED'
              ? 'Wait for completion'
              : 'Not authorized',
    },
    {
      action: 'Release',
      operatorRule: 'Release only when the booking outcome should not capture customer funds.',
      pillClass: payment.status === 'AUTHORIZED' && closedWithoutCapture ? 'pill-warn' : 'pill-neutral',
      reason:
        payment.status === 'AUTHORIZED' && closedWithoutCapture
          ? `Booking is ${bookingStatus}; release can close the authorization without capture.`
          : terminalPayment
            ? `Payment is already ${payment.status}.`
            : payment.status === 'AUTHORIZED'
              ? 'The hold is still active; check booking evidence before release.'
              : `Payment status is ${payment.status}.`,
      status:
        payment.status === 'AUTHORIZED' && closedWithoutCapture
          ? 'Review release'
          : terminalPayment
            ? 'Locked'
            : payment.status === 'AUTHORIZED'
              ? 'Hold active'
              : 'Not authorized',
    },
    {
      action: 'Refund',
      operatorRule: 'Refunds must preserve customer, partner, booking, payment, and chat evidence.',
      pillClass: payment.status === 'CAPTURED' ? 'pill-warn' : 'pill-neutral',
      reason:
        payment.status === 'CAPTURED'
          ? 'Captured money can be refunded only after admin decision evidence is recorded.'
          : payment.status === 'REFUNDED'
            ? 'Refund path has already started.'
            : payment.status === 'RELEASED'
              ? 'The authorization was released, so no captured money remains here.'
              : 'There is no captured payment to refund from this row.',
      status:
        payment.status === 'CAPTURED'
          ? 'Evidence required'
          : payment.status === 'REFUNDED'
            ? 'Already refunded'
            : payment.status === 'RELEASED'
              ? 'Released'
              : 'Not captured',
    },
    {
      action: 'Settle cash debt',
      operatorRule:
        'Settle with a deposit reference or approved admin offset before final acceptance, service start, or payout release.',
      pillClass: cashDebt ? 'pill-danger' : payment.method === 'CASH' ? 'pill-success' : 'pill-neutral',
      reason: cashDebt
        ? 'Cash was collected by the partner and the HANDS fee/tax debt is still open.'
        : payment.method === 'CASH'
          ? 'This cash payment has no open partner wallet debt on the linked earning.'
          : 'This payment is not a cash collection case.',
      status: cashDebt ? 'Evidence required' : payment.method === 'CASH' ? 'Clear' : 'Not cash',
    },
  ];
}
