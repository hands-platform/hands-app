import type { AdminBookingDetail } from '../../../lib/admin-api';
import { providerName } from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
} from './booking-participant-rules';
import {
  bookingStatusHint,
  latestProviderLocationFreshness,
  preferredParticipantState,
} from './booking-status-location';

type BookingStageCustomerWaitPanel = {
  detail: string;
};

type BookingStageBackupSupply = {
  eligibleCount: number;
};

export type BookingStageSnapshot = {
  stage: string;
  pillClass: string;
  noteClassName: string;
  headline: string;
  detail: string;
  actionHref: string;
  actionLabel: string;
  metrics: Array<{ label: string; value: string; helper: string }>;
  badges: Array<{ label: string; tone: string }>;
};

export function bookingStageSnapshot(
  booking: AdminBookingDetail,
  customerWaitPanel: BookingStageCustomerWaitPanel,
  backupSupply: BookingStageBackupSupply,
): BookingStageSnapshot {
  const status = String(booking.status);
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const rejectedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'REJECTED',
  );
  const finalPartner = bookingFinalPartnerSummary(booking);
  const hasFinalPartner = finalPartner.selected || (status === 'MATCHED' && Boolean(booking.preferredProvider));
  const finalPartnerLabel = finalPartner.selected ? finalPartner.label : providerName(booking.preferredProvider);
  const preferredParticipant = preferredParticipantState(booking);
  const locationFreshness = latestProviderLocationFreshness(booking);
  const customerPinReady = Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng));
  const terminal = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'].includes(status);
  const chatReady = Boolean(booking.chatRoom);

  let stage = 'Stage 0 - Intake';
  let pillClass = 'pill-info';
  let noteClassName = 'ops-task-pending';
  let headline = 'Booking is created and waiting for operational movement.';
  let detail = 'Confirm service, customer pin, payment state, and the first partner before matching starts.';
  let actionHref = `/bookings/${booking.id}`;
  let actionLabel = 'Review booking';

  if (terminal) {
    stage = 'Closeout';
    pillClass = status === 'COMPLETED' ? 'pill-success' : 'pill-warn';
    noteClassName = status === 'COMPLETED' ? 'ops-task-done' : 'ops-task-pending';
    headline = 'This booking is in closeout.';
    detail =
      'Use finance, refund, no-show, audit, and feedback sections to confirm the operational record is clean.';
    actionHref = booking.payment?.id ? `/payments#payment-${booking.payment.id}` : `/bookings/${booking.id}`;
    actionLabel = booking.payment?.id ? 'Open payment trail' : 'Review closeout';
  } else if (hasFinalPartner && chatReady) {
    stage = 'Stage 4 - Chat handoff';
    pillClass = 'pill-success';
    noteClassName = 'ops-task-done';
    headline = 'Final partner is selected and chat is available.';
    detail =
      locationFreshness === 'recent'
        ? 'Chat and location handoff are live; monitor arrival, service start, completion, and payment closeout.'
        : 'Chat is ready; ask the partner to refresh location if the customer needs approach visibility.';
    actionHref = `/bookings/${booking.id}#chat`;
    actionLabel = 'Review chat';
  } else if (hasFinalPartner && !chatReady) {
    stage = 'Stage 4 - Handoff repair';
    pillClass = 'pill-danger';
    noteClassName = 'ops-task-blocked';
    headline = 'A final partner exists, but the chat handoff is missing.';
    detail = 'Repair the chat room before the customer and partner lose coordination after match.';
    actionHref = `/bookings/${booking.id}#chat`;
    actionLabel = 'Repair chat';
  } else if (status === 'OPEN_MATCHING' && customerChoiceCandidates.length > 0) {
    stage = 'Stage 3 - Customer choice';
    pillClass = 'pill-warn';
    noteClassName = 'ops-task-pending';
    headline = 'Participating or accepted partner(s) are waiting for customer final selection.';
    detail = customerWaitPanel.detail;
    actionHref = `/bookings/${booking.id}#participants`;
    actionLabel = 'Review shortlist';
  } else if (status === 'OPEN_MATCHING' && backupSupply.eligibleCount > 0) {
    stage = 'Stage 2 - Marketplace participation';
    pillClass = 'pill-warn';
    noteClassName = 'ops-task-pending';
    headline = 'The marketplace partner window has usable supply.';
    detail = `${backupSupply.eligibleCount} partner(s) can participate or be nudged while the customer waits.`;
    actionHref = '/partners?review=marketplace-ready';
    actionLabel = 'Open marketplace partners';
  } else if (status === 'OPEN_MATCHING') {
    stage = 'Stage 1 - First-pick response';
    pillClass = customerPinReady ? 'pill-info' : 'pill-danger';
    noteClassName = customerPinReady ? 'ops-task-pending' : 'ops-task-blocked';
    headline = customerPinReady
      ? 'Preferred partner is still in the first response window.'
      : 'Service address pin is missing, so radius matching is not reliable.';
    detail = customerPinReady
      ? customerWaitPanel.detail
      : 'Confirm the customer service location before using distance, marketplace, or dispatch decisions.';
    actionHref = customerPinReady
      ? `/bookings/${booking.id}#participants`
      : `/bookings/${booking.id}#customer`;
    actionLabel = customerPinReady ? 'Monitor first-pick' : 'Fix service address pin';
  }

  return {
    stage,
    pillClass,
    noteClassName,
    headline,
    detail,
    actionHref,
    actionLabel,
    metrics: [
      {
        label: 'Status',
        value: status,
        helper: bookingStatusHint(status),
      },
      {
        label: 'Preferred partner',
        value: providerName(booking.preferredProvider),
        helper: preferredParticipant
          ? `Partner response: ${preferredParticipant.status}.`
          : 'No partner response recorded yet.',
      },
      {
        label: 'Shortlist',
        value: `${customerChoiceCandidates.length} selectable`,
        helper: `${rejectedParticipants.length} rejected, ${backupSupply.eligibleCount} marketplace eligible.`,
      },
      {
        label: 'Handoff',
        value: chatReady ? 'Chat ready' : 'Chat locked',
        helper:
          locationFreshness === 'recent'
            ? 'Partner location is recent.'
            : `Partner location is ${locationFreshness}.`,
      },
    ],
    badges: [
      {
        label: customerPinReady ? 'Pin ready' : 'Pin missing',
        tone: customerPinReady ? 'pill-success' : 'pill-danger',
      },
      {
        label: `${backupSupply.eligibleCount} in marketplace policy`,
        tone: backupSupply.eligibleCount ? 'pill-success' : 'pill-warn',
      },
      { label: chatReady ? 'Chat ready' : 'Chat pending', tone: chatReady ? 'pill-success' : 'pill-info' },
      {
        label: hasFinalPartner ? finalPartnerLabel : providerName(booking.preferredProvider),
        tone: hasFinalPartner ? 'pill-success' : 'pill-neutral',
      },
    ],
  };
}
