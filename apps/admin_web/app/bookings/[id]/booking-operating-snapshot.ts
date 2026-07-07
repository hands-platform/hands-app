import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { AttentionFlag } from '../../../lib/admin-attention-flags';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import { bookingCashDebtNeedsSettlement } from './booking-cash-wallet-gate';
import {
  compactActivityText,
  distanceLabel,
  formatDate,
  money,
  providerName,
} from './booking-formatters';
import { bookingOperatingNextAction } from './booking-operating-next-action';
import { bookingParticipantCounts } from './booking-participant-counts';
import { bookingCustomerSelectableParticipantsForFinalChoice } from './booking-participant-rules';
import { preferredParticipantState } from './booking-status-location';

type BookingOperatingSnapshotInput = {
  readonly booking: AdminBookingDetail;
  readonly addressLine: string;
  readonly addressPin: string;
  readonly attentionFlags: readonly AttentionFlag[];
  readonly messageCount: number;
  readonly notificationCount: number;
};

export function bookingOperatingSnapshot({
  booking,
  addressLine,
  addressPin,
  attentionFlags,
  messageCount,
  notificationCount,
}: BookingOperatingSnapshotInput) {
  const participantCounts = bookingParticipantCounts(booking);
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const preferredState = preferredParticipantState(booking);
  const paymentLabel = booking.payment
    ? `${booking.payment.method} / ${booking.payment.status}`
    : 'No payment';
  const walletLabel = bookingCashDebtNeedsSettlement(booking)
    ? `Debt ${money(Math.abs(booking.earning?.netAmount ?? 0), booking.earning?.currency)}`
    : booking.earning
      ? `Ledger ${money(booking.earning.netAmount, booking.earning.currency)}`
      : 'No earning yet';
  const finalPartnerLabel = booking.selectedProvider
    ? providerName(booking.selectedProvider)
    : booking.status === 'MATCHED'
      ? providerName(booking.preferredProvider)
      : 'Customer selection pending';
  const addressSource = booking.addressSnapshot
    ? `${booking.addressSnapshot.source ?? 'booking_confirmation'} / ${formatDate(booking.addressSnapshot.createdAt)}`
    : 'Stored booking address';
  const next = bookingOperatingNextAction(booking);
  const hasHighAttention = attentionFlags.some((check) => check.severity === 'high');
  const tone = hasHighAttention
    ? 'pill-danger'
    : attentionFlags.length
      ? 'pill-warn'
      : booking.status === 'COMPLETED'
        ? 'pill-success'
        : 'pill-info';

  return {
    status: booking.status,
    tone,
    noteClassName: hasHighAttention
      ? 'ops-task-danger'
      : attentionFlags.length
        ? 'ops-task-warning'
        : 'ops-task-info',
    nextAction: next.title,
    nextDetail: next.detail,
    href: next.href,
    hrefLabel: next.hrefLabel,
    facts: [
      {
        label: 'Confirmed address',
        value: compactActivityText(addressLine, 42),
        helper: `${serviceAddressSnapshotStateLabel(addressPin)} / ${addressSource}`,
      },
      {
        label: 'Customer final choice',
        value: compactActivityText(finalPartnerLabel, 34),
        helper: booking.selectedProvider
          ? 'Customer-selected final Partner is recorded.'
          : 'Customer choice remains the final handoff record.',
      },
      {
        label: 'Preferred Partner',
        value: compactActivityText(providerName(booking.preferredProvider), 34),
        helper: preferredState
          ? `${preferredState.status} / ${distanceLabel(preferredState.distanceMeters)}`
          : booking.preferredProvider
            ? 'Waiting for first Partner response.'
            : 'No first-pick Partner on this booking.',
      },
      {
        label: 'Marketplace supply',
        value: `${participantCounts.marketplace} marketplace / ${customerChoiceCandidates.length} selectable`,
        helper: `${participantCounts.total} total participant row(s). Actual rows stay as evidence; customer choices are deduped by Partner.`,
      },
      {
        label: 'Chat and alerts',
        value: booking.chatRoom ? `${messageCount} message(s)` : 'Chat not ready',
        helper: `${notificationCount} notification record(s) linked to this booking.`,
      },
      {
        label: 'Payment and wallet',
        value: paymentLabel,
        helper: walletLabel,
      },
    ],
  };
}

function serviceAddressSnapshotStateLabel(addressPin: string) {
  const address = readAddressText(addressPin);
  if (address) {
    return serviceAddressAreaLabel(address);
  }

  return addressPin === 'No pin' ? 'No service address location' : 'Confirmed service address saved';
}
