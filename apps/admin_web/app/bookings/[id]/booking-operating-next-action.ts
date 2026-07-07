import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';

export type BookingOperatingNextAction = {
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly hrefLabel: string;
};

export function bookingOperatingNextAction(
  booking: AdminBookingDetail,
): BookingOperatingNextAction {
  if (bookingCashDebtNeedsSettlement(booking)) {
    return {
      title: 'Settle cash fee debt',
      detail:
        'Partner collected cash. Confirm company fee deposit or admin offset before final acceptance, service start, or payout release resumes.',
      href: '#finance',
      hrefLabel: 'Open finance',
    };
  }
  if (booking.status === 'OPEN_MATCHING') {
    return {
      title: booking.participants?.length
        ? 'Monitor customer final selection'
        : 'Monitor Partner participation',
      detail: booking.participants?.length
        ? 'Participating or accepted Partners should be visible to the customer so the customer can choose the final Partner.'
        : 'Keep the first-pick window and marketplace participation visible until a Partner participates or the booking expires.',
      href: '#alerts',
      hrefLabel: 'Open matching',
    };
  }
  if (booking.status === 'MATCHED' && !booking.chatRoom) {
    return {
      title: 'Create or recover chat room',
      detail: 'A matched booking must have chat before Partner handoff and service coordination.',
      href: '#chat',
      hrefLabel: 'Open chat',
    };
  }
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    return {
      title: 'Track handoff and service progress',
      detail: 'Confirm chat, Partner location record, arrival state, and service lifecycle events.',
      href: '#location',
      hrefLabel: 'Open location',
    };
  }
  if (booking.status === 'COMPLETED') {
    return {
      title: 'Reconcile completed booking',
      detail: 'Confirm payment capture, wallet impact, tax/fee logs, review state, and closeout notes.',
      href: '#finance',
      hrefLabel: 'Open finance',
    };
  }
  if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(booking.status)) {
    return {
      title: 'Close customer and finance loop',
      detail: 'Confirm refund/release, customer communication, Partner communication, and audit note.',
      href: '#payment',
      hrefLabel: 'Open payment',
    };
  }
  return {
    title: 'Continue normal monitoring',
    detail: 'No immediate operator action is required beyond timeline and communication review.',
    href: '#booking-activity',
    hrefLabel: 'Open timeline',
  };
}
