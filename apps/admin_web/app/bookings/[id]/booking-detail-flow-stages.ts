import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFlowStages as buildBookingFlowStages } from '../../../lib/booking-flow-stages';
import {
  bookingPartnerDecisionLabel,
  bookingPartnerHint,
} from '../../../lib/booking-partner-decision-copy';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { formatDate } from './booking-formatters';
import { bookingPreferredProviderId } from './booking-participant-rules';

export function bookingDetailFlowStages(booking: AdminBookingDetail) {
  const finalPartner = bookingFinalPartnerSummary(booking);

  return buildBookingFlowStages({
    createdAtLabel: formatDate(booking.createdAt),
    openedAtLabel: booking.openedAt ? formatDate(booking.openedAt) : null,
    hasOpened: Boolean(booking.openedAt),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    partnerDecisionLabel: bookingPartnerDecisionLabel(booking, bookingPreferredProviderId(booking)),
    partnerHint: bookingPartnerHint(booking),
    participantCount: booking.participants?.length ?? 0,
    bookingStatus: booking.status,
    selectedPartnerLabel: finalPartner.label,
    hasSelectedPartner: finalPartner.selected,
    hasChatRoom: Boolean(booking.chatRoom),
    paymentStatus: booking.payment?.status ?? 'NONE',
    paymentHint: bookingPaymentHint(booking, {
      cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    }),
  });
}
