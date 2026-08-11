import type { AdminBookingDetail, AdminChatMessage, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import { canCloseoutCompletedBooking } from '../../../lib/booking-closeout-policy';
import { bookingOperatorCommandQueue as buildBookingOperatorCommandQueue } from '../../../lib/booking-operator-command-queue';
import { canMarkNoShow } from '../../../lib/booking-operator-action-rules';
import { bookingOpsTaskCards as buildBookingOpsTaskCards } from '../../../lib/booking-ops-task-cards';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { formatDate } from './booking-formatters';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
  bookingDetailExpiryEligibility,
} from './booking-participant-rules';
import { bookingDetailProviderLocationMetricHelper } from './booking-provider-location-metric';
import { latestProviderLocationFreshness } from './booking-status-location';

export function bookingDetailOpsTaskCards(booking: AdminBookingDetail) {
  return buildBookingOpsTaskCards(booking.opsTasks, { formatDate });
}

export function bookingDetailOperatorCommandQueue({
  booking,
  attentionFlags,
  messages,
  latestLocation,
}: {
  booking: AdminBookingDetail;
  attentionFlags: readonly AttentionFlag[];
  messages: readonly AdminChatMessage[];
  latestLocation?: AdminLocationSnapshot | null;
}) {
  const finalPartner = bookingFinalPartnerSummary(booking);
  const partnerLabel = finalPartner.selected ? finalPartner.label : 'No final Partner';
  const pendingTasks = bookingDetailOpsTaskCards(booking).filter((task) => task.status !== 'DONE');

  return buildBookingOperatorCommandQueue({
    bookingStatus: booking.status,
    participantCount: booking.participants?.length ?? 0,
    customerChoiceCandidateCount: bookingCustomerSelectableParticipantsForFinalChoice(booking).length,
    partnerLabel,
    hasFinalPartner: finalPartner.selected,
    hasChatRoom: Boolean(booking.chatRoom),
    messageCount: messages.length,
    hasLatestLocation: Boolean(latestLocation),
    latestLocationFreshness: latestProviderLocationFreshness(booking),
    providerLocationHelper: bookingDetailProviderLocationMetricHelper(booking),
    paymentStatus: booking.payment?.status ?? 'NONE',
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    closeoutAvailable: canCloseoutCompletedBooking(booking),
    canExpire: bookingDetailExpiryEligibility(booking).allowed,
    canMarkNoShow: canMarkNoShow(booking.status),
    attentionFlagCount: attentionFlags.length,
    pendingTask: pendingTasks[0] ?? null,
  });
}
