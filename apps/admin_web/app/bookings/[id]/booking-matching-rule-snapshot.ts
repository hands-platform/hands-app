import type { AdminBookingDetail } from '../../../lib/admin-api';
import { formatDistanceMeters } from '../../../lib/admin-format';
import { bookingCustomerWaitPanel } from './booking-customer-wait-panel';
import { providerName } from './booking-formatters';
import { bookingMarketplacePartnerSupply } from './booking-marketplace-supply';
import { bookingNotificationTrace } from './booking-notification-trace';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
} from './booking-participant-rules';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';

export type BookingDetailMatchingRuleSnapshot = {
  status: string;
  tone: string;
  summary: string;
  rows: Array<{ label: string; value: string; helper: string }>;
  actions: Array<{ label: string; href: string }>;
};

export function bookingDetailMatchingRuleSnapshot({
  booking,
  marketplaceSupply,
  customerWaitPanel,
  notificationTrace,
  walletBlocked,
}: {
  booking: AdminBookingDetail;
  marketplaceSupply: ReturnType<typeof bookingMarketplacePartnerSupply>;
  customerWaitPanel: ReturnType<typeof bookingCustomerWaitPanel>;
  notificationTrace: ReturnType<typeof bookingNotificationTrace>;
  walletBlocked: boolean;
}): BookingDetailMatchingRuleSnapshot {
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const hasSavedPolicy = Object.values(savedPolicy).some((value) => value !== null);
  const participants = booking.participants ?? [];
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const rejectedParticipants = participants.filter((participant) => participant.status === 'REJECTED');
  const finalPartner =
    booking.selectedProvider ?? (booking.status === 'MATCHED' ? booking.preferredProvider : null);
  const responseWindowMinutes = savedPolicy.providerResponseWindowMinutes ?? 10;
  const radiusMeters = savedPolicy.backupProviderRadiusMeters ?? marketplaceSupply.radiusMeters;
  const partnerAlerts = notificationTrace.rows.filter((row) => row.isPartnerAlert).length;

  const status = finalPartner
    ? booking.chatRoom
      ? 'Final Partner and chat ready'
      : 'Final Partner, chat missing'
    : customerChoiceCandidates.length
      ? 'Customer final choice pending'
      : booking.status === 'OPEN_MATCHING'
        ? customerWaitPanel.signalStatus
        : booking.status;
  const tone = finalPartner
    ? booking.chatRoom
      ? 'pill-success'
      : 'pill-danger'
    : customerChoiceCandidates.length
      ? 'pill-warn'
      : customerWaitPanel.signalTone;

  const nextAction =
    finalPartner && !booking.chatRoom
      ? 'Repair chat before service handoff.'
      : finalPartner
        ? 'Use chat, location, payment, and closeout evidence for the next operation.'
        : customerChoiceCandidates.length
          ? 'Customer fallback selection is required because first-pick did not validly win; operators should not assign one for them.'
          : booking.status === 'OPEN_MATCHING'
            ? 'Monitor first-pick, marketplace participants, and Partner alert evidence.'
            : 'Continue from the current booking status and retained evidence.';

  return {
    status,
    tone,
    summary: `${hasSavedPolicy ? 'Saved booking policy' : 'Live MVP default'} is being used for this evidence readout. ${nextAction}`,
    rows: [
      {
        label: 'Policy basis',
        value: hasSavedPolicy ? 'Saved policy' : 'Live default',
        helper: hasSavedPolicy
          ? 'This booking carries matching policy metadata captured at creation/open time.'
          : 'Older or seeded bookings may fall back to the current operations policy.',
      },
      {
        label: 'First-pick',
        value: booking.preferredProvider ? `${responseWindowMinutes}m window` : 'No preferred Partner',
        helper: booking.preferredProvider
          ? `${providerName(booking.preferredProvider)} gets the first response window.`
          : 'Marketplace-only or older booking without a preferred Partner record.',
      },
      {
        label: 'Marketplace radius',
        value: formatDistanceMeters(radiusMeters),
        helper: `${marketplaceSupply.eligibleCount} eligible Partner(s), ${participants.length} participant row(s), ${customerChoiceCandidates.length} customer-selectable.`,
      },
      {
        label: 'Customer choice',
        value: finalPartner ? providerName(finalPartner) : `${customerChoiceCandidates.length} selectable`,
        helper: finalPartner
          ? 'Final Partner choice is recorded.'
          : 'Fallback Partner choice remains customer-selected; no automatic assignment is used.',
      },
      {
        label: 'Partner alerts',
        value: `${partnerAlerts} alert(s)`,
        helper: `${notificationTrace.backupBatches.length} marketplace batch(es), ${rejectedParticipants.length} rejected participant(s).`,
      },
      {
        label: 'Chat handoff',
        value: booking.chatRoom ? `${booking.chatRoom.messages?.length ?? 0} message(s)` : 'Not ready',
        helper: booking.chatRoom
          ? 'Admin keeps the chat record even after mobile hides completed-service chats.'
          : 'Matched bookings should create a chat room before service coordination.',
      },
      {
        label: 'Wallet gate',
        value: walletBlocked ? 'Settlement needed' : 'Clear',
        helper: walletBlocked
          ? 'Negative cash-fee debt can block final acceptance, service start, and payout release until settled or offset.'
          : 'No cash-fee debt block is visible for this booking.',
      },
    ],
    actions: [
      { label: 'Open policy controls', href: '/operations-policy' },
      { label: 'Open marketplace supply', href: '#marketplace-supply' },
      { label: 'Open alerts', href: '#alerts' },
      { label: 'Open chat evidence', href: '#chat' },
    ],
  };
}
