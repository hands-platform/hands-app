import { bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingProviderLocationMetricHelper } from '../../../lib/booking-provider-location-copy';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import {
  bookingAddressSnapshotLabel,
  bookingServiceOptionLabel,
  formatDate,
  money,
  shortId,
} from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingCustomerSelectableParticipantsForFinalChoice } from './booking-participant-rules';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';

export type BookingHandoffChecklistItem = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly href?: string;
};

export function bookingHandoffChecklist(
  booking: AdminBookingDetail,
  messageCount: number,
  latestLocation?: AdminLocationSnapshot,
): BookingHandoffChecklistItem[] {
  const participantCount = booking.participants?.length ?? 0;
  const selectableCount = bookingCustomerSelectableParticipantsForFinalChoice(booking).length;
  const finalPartner = bookingFinalPartnerSummary(booking);
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status} / ${money(booking.payment.amount, booking.payment.currency)}`
    : 'No payment record';
  const cashDebtLabel = bookingCashDebtNeedsSettlement(booking)
    ? 'Cash fee debt must be settled before final acceptance, service start, or payout release.'
    : 'No cash fee debt block on this booking.';
  const chatDetail = booking.chatRoom
    ? `${messageCount} retained message(s). Admin keeps the archive even if mobile hides chat after completion.`
    : 'No chat room is linked yet. Matched or active bookings should create one.';
  const locationDetail = latestLocation
    ? `${latestLocationLabel(latestLocation)} / ${bookingProviderLocationMetricHelper(latestLocation.recordedAt)}`
    : 'No Partner service location has been shared yet.';

  return [
    {
      id: 'booking-request',
      label: 'Request',
      title: bookingServiceOptionLabel(booking),
      detail: `${booking.status} / opened ${formatDate(bookingRequestOpenedAt(booking))} / ${bookingAddressSnapshotLabel(booking)}`,
      status: 'Booking facts',
      href: '#customer',
    },
    {
      id: 'partner-response',
      label: 'Partner',
      title: finalPartner.selected ? finalPartner.label : 'Waiting for Partner response',
      detail: `${participantCount} participant record(s) / ${selectableCount} customer-selectable. The customer remains the final decision maker.`,
      status: 'Customer shortlist',
      href: '#participants',
    },
    {
      id: 'customer-choice',
      label: 'Choice',
      title: finalPartner.selected ? 'Final Partner selected' : 'Customer choice pending',
      detail: finalPartner.selected
        ? `${finalPartner.label} is recorded as the final Partner.`
        : 'Keep the customer waiting screen synced with participating/accepted Partner options.',
      status: 'Customer screen',
      href: '#audit',
    },
    {
      id: 'chat-location',
      label: 'Chat',
      title: booking.chatRoom ? `Chat room ${shortId(booking.chatRoom.id)}` : 'Chat handoff pending',
      detail: `${chatDetail} ${locationDetail}`,
      status: 'Chat/location',
      href: '#structured-ops-status',
    },
    {
      id: 'finance-closeout',
      label: 'Finance',
      title: paymentLabel,
      detail: `${cashDebtLabel} ${booking.earning ? `Earning ledger: ${money(booking.earning.netAmount, booking.earning.currency)}.` : 'No earning ledger yet.'}`,
      status: 'Payment/wallet',
      href: '#finance',
    },
  ];
}

function latestLocationLabel(latestLocation: AdminLocationSnapshot) {
  const address = readAddressText(latestLocation);
  return address ? serviceAddressAreaLabel(address) : 'Location recorded without readable address';
}
