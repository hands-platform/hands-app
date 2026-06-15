import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import { bookingAttentionFlags as buildBookingAttentionFlags } from '../../../lib/booking-attention-flags';
import {
  bookingDispatchChecklist,
  type DispatchStep,
} from '../../../lib/booking-dispatch-checklist';
import { bookingPaymentHint } from '../../../lib/booking-payment-hint';
import {
  isPreferredAwaitingDecision as isPreferredAwaitingDecisionFromStatus,
} from '../../../lib/booking-status-location-helpers';
import { bookingProviderLocationMetricHelper } from '../../../lib/booking-provider-location-copy';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  formatDate,
  isTerminalPayment,
  minutesSince,
  money,
  providerName,
} from './booking-formatters';
import {
  latestProviderLocation,
  latestProviderLocationFreshness,
  preferredParticipantState,
} from './booking-status-location';

const activeLocationStatuses = new Set(['PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function bookingDetailAttentionFlags(booking: AdminBookingDetail): AttentionFlag[] {
  const paymentStatus = booking.payment?.status;
  const status = booking.status;
  const participantCount = booking.participants?.length ?? 0;
  const messages = booking.chatRoom?.messages ?? [];
  const openedAge = minutesSince(booking.openedAt ?? booking.createdAt);
  const expired = booking.expiresAt ? new Date(booking.expiresAt).getTime() < Date.now() : false;
  const activeWithLocationNeed = activeLocationStatuses.has(status);
  const finalPartner = bookingFinalPartnerSummary(booking);

  return buildBookingAttentionFlags({
    bookingStatus: status,
    hasPayment: Boolean(booking.payment),
    paymentStatus,
    paymentProviderRef: booking.payment?.providerRef ?? null,
    cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
    cashDebtPartnerLabel: finalPartner.selected ? finalPartner.label : providerName(booking.preferredProvider),
    cashDebtAmount: Math.abs(booking.earning?.netAmount ?? 0),
    cashDebtCurrency: booking.earning?.currency ?? 'VND',
    matchingWindowExpired: expired,
    expiresAtLabel: formatDate(booking.expiresAt),
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredPartnerLabel: providerName(booking.preferredProvider),
    participantCount,
    openedAgeMinutes: openedAge,
    hasChatRoom: Boolean(booking.chatRoom),
    activeWithLocationNeed,
    hasLatestProviderLocation: Boolean(latestProviderLocation(booking)),
    latestProviderLocationFreshness: latestProviderLocationFreshness(booking),
    providerLocationAgeLabel: providerLocationMetricHelper(booking),
    messageCount: messages.length,
    refundCount: booking.refunds?.length ?? 0,
    formatMoney: money,
  });
}

export function bookingDetailDispatchChecklist(booking: AdminBookingDetail): DispatchStep[] {
  const flags = bookingDetailAttentionFlags(booking);
  const paymentHref = booking.payment?.id ? `/payments#payment-${booking.payment.id}` : undefined;
  const activeWithLocationNeed = activeLocationStatuses.has(booking.status);

  return bookingDispatchChecklist({
    bookingStatus: booking.status,
    attentionFlagCount: flags.length,
    payment: booking.payment
      ? {
          id: booking.payment.id,
          status: booking.payment.status,
          href: paymentHref,
          hint: bookingPaymentHint(booking, {
            cashDebtNeedsSettlement: bookingCashDebtNeedsSettlement(booking),
          }),
          terminal: isTerminalPayment(booking.payment.status),
        }
      : null,
    selectedPartner: booking.selectedProvider
      ? { label: providerName(booking.selectedProvider), phone: booking.selectedProvider.user?.phone }
      : null,
    preferredPartner: booking.preferredProvider
      ? { label: providerName(booking.preferredProvider), phone: booking.preferredProvider.user?.phone }
      : null,
    isPreferredAwaitingDecision: isPreferredAwaitingDecision(booking),
    participantCount: booking.participants?.length ?? 0,
    hasChatRoom: Boolean(booking.chatRoom),
    chatRoomId: booking.chatRoom?.id ?? null,
    messageCount: booking.chatRoom?.messages?.length ?? 0,
    activeWithLocationNeed,
    hasLatestProviderLocation: Boolean(latestProviderLocation(booking)),
    latestProviderLocationFreshness: latestProviderLocationFreshness(booking),
    providerLocationAgeLabel: providerLocationMetricHelper(booking),
  });
}

function isPreferredAwaitingDecision(booking: AdminBookingDetail) {
  const participant = preferredParticipantState(booking);

  return isPreferredAwaitingDecisionFromStatus({
    finalSelection: booking.matchingEvidence?.finalSelection,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredParticipantStatus: participant?.status ?? null,
  });
}

function providerLocationMetricHelper(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricHelper(latestProviderLocation(booking)?.recordedAt);
}
