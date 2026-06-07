import type { AdminBookingDetail, AdminOperationalPolicySetting } from '../../../lib/admin-api';
import { formatDate, providerName } from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  bookingCustomerSelectableParticipantsForFinalChoice,
} from './booking-participant-rules';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';
import { readOptionalNumber, readOptionalString } from './booking-readers';

type BookingCustomerWaitBackupSupply = {
  eligibleCount: number;
  decisionDetail: string;
};

type CustomerWaitCard = {
  title: string;
  status: string;
  detail: string;
  action: string;
  className: string;
  pillClass: string;
};

export function bookingCustomerWaitPanel(
  booking: AdminBookingDetail,
  backupSupply: BookingCustomerWaitBackupSupply,
  settings: AdminOperationalPolicySetting[],
) {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const responseWindowMinutes =
    savedPolicy.providerResponseWindowMinutes ??
    readOptionalNumber(byKey.get('matching.provider_response_window_minutes')?.value) ??
    10;
  const backupOpenMode =
    savedPolicy.backupOpenMode ?? readOptionalString(byKey.get('matching.backup_open_mode')?.value) ?? 'IMMEDIATE_WITHIN_WINDOW';
  const customerConfirmMode =
    (savedPolicy.preferredAcceptMode ??
      readOptionalString(byKey.get('matching.preferred_accept_mode')?.value)) ===
    'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
  const customerChoiceCandidates = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const rejectedParticipants = (booking.participants ?? []).filter(
    (participant) => participant.status === 'REJECTED',
  );
  const firstPick = booking.preferredProvider;
  const firstPickParticipant = (booking.participants ?? []).find(
    (participant) => participant.providerProfile?.id && participant.providerProfile.id === firstPick?.id,
  );
  const firstPickRejected = firstPickParticipant?.status === 'REJECTED';
  const finalPartner = bookingFinalPartnerSummary(booking);
  const selected = finalPartner.selected || booking.status === 'MATCHED';
  const selectedPartnerLabel = finalPartner.selected
    ? finalPartner.label
    : providerName(booking.preferredProvider);
  const expired = booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false;
  const customerPinReady = Number.isFinite(Number(booking.lat)) && Number.isFinite(Number(booking.lng));
  const backupWindowOpen = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW' || firstPickRejected || expired;
  const waitingForCustomerChoice = customerConfirmMode && customerChoiceCandidates.length > 0 && !selected;
  const waitingForPartnerJoin = booking.status === 'OPEN_MATCHING' && customerChoiceCandidates.length === 0;
  const timer = matchingTimerStatus(booking.expiresAt, responseWindowMinutes);

  let signalStatus = 'Monitor';
  let signalTone = 'pill-info';
  let headline = 'Booking is being monitored.';
  let detail = 'No same-shift matching handoff is visible.';
  let nextActionHref = `/bookings/${booking.id}`;
  let nextActionLabel = 'Stay on booking';

  if (expired && booking.status === 'OPEN_MATCHING') {
    signalStatus = 'Timer expired';
    signalTone = 'pill-danger';
    headline = 'The customer should stop waiting unless support manually recovers the request.';
    detail = 'Expire the booking or contact the customer before the open matching window stays visible.';
    nextActionLabel = 'Handle expiry below';
  } else if (!customerPinReady && booking.status === 'OPEN_MATCHING') {
    signalStatus = 'Missing pin';
    signalTone = 'pill-danger';
    headline = 'Distance-based partner matching cannot be confirmed yet.';
    detail = 'Confirm the customer address or selected pin before using marketplace participation decisions.';
  } else if (waitingForCustomerChoice) {
    signalStatus = 'Customer choice';
    signalTone = 'pill-warn';
    headline = 'A participating or accepted partner is ready for customer final selection.';
    detail =
      'Make sure the customer app shows the participating/accepted partner shortlist and opens matched chat after selection.';
    nextActionLabel = 'Check participants';
  } else if (waitingForPartnerJoin && backupSupply.eligibleCount === 0) {
    signalStatus = 'Supply gap';
    signalTone = 'pill-danger';
    headline = 'No fresh nearby partner can currently join under policy.';
    detail =
      'Ask partners to go online/refresh location, or review marketplace radius and location freshness policy.';
    nextActionHref = '/partners?review=marketplace-blocked';
    nextActionLabel = 'Open blocked partners';
  } else if (waitingForPartnerJoin && backupWindowOpen) {
    signalStatus = 'Nudge partners';
    signalTone = 'pill-warn';
    headline = 'Customer is waiting and marketplace partners can participate.';
    detail = `${backupSupply.eligibleCount} nearby partner(s) can be nudged into the customer shortlist.`;
    nextActionHref = '/partners?review=marketplace-ready';
    nextActionLabel = 'Open marketplace-ready partners';
  } else if (waitingForPartnerJoin) {
    signalStatus = 'First-pick wait';
    signalTone = 'pill-info';
    headline = 'Preferred partner still has the first response window.';
    detail = `Monitor ${providerName(firstPick)} for up to ${responseWindowMinutes} minutes while marketplace supply stays visible to operators.`;
  } else if (selected && booking.chatRoom) {
    signalStatus = 'Chat ready';
    signalTone = 'pill-success';
    headline = 'Final partner is selected and chat is ready.';
    detail = 'Monitor location sharing, arrival, service start, completion, and payment closeout.';
  } else if (selected && !booking.chatRoom) {
    signalStatus = 'Chat missing';
    signalTone = 'pill-danger';
    headline = 'Final partner is selected, but chat handoff is missing.';
    detail = 'Repair or create the chat room so the customer and partner can coordinate.';
  }

  const cards: CustomerWaitCard[] = [
    {
      title: 'First-pick response timer',
      status: timer.status,
      detail: timer.detail,
      action: firstPickParticipant
        ? `${providerName(firstPick)} responded as ${firstPickParticipant.status}.`
        : `${providerName(firstPick)} has not participated/responded yet.`,
      className: timer.className,
      pillClass: timer.pillClass,
    },
    {
      title: 'Customer final choice',
      status: selected ? 'Selected' : waitingForCustomerChoice ? 'Choose now' : 'Waiting',
      detail: selected
        ? `Final partner: ${selectedPartnerLabel}.`
        : waitingForCustomerChoice
          ? `${customerChoiceCandidates.length} participating/accepted partner(s) are ready for customer selection.`
          : 'No participating/accepted partner is ready for final customer selection yet.',
      action: customerConfirmMode
        ? 'Customer selects the final partner before matched chat opens.'
        : 'Policy conflicts with HANDS final-choice flow; return to customer-confirm mode.',
      className: selected
        ? 'ops-task-done'
        : waitingForCustomerChoice
          ? 'ops-task-pending'
          : 'ops-task-pending',
      pillClass: selected ? 'pill-success' : waitingForCustomerChoice ? 'pill-warn' : 'pill-info',
    },
    {
      title: 'Marketplace participation',
      status: backupWindowOpen ? 'Open' : 'Held',
      detail: backupWindowOpen
        ? `${backupSupply.eligibleCount} eligible marketplace partner(s) can participate under current/saved policy.`
        : 'Marketplace partners are held until first-pick delay, decline, or timeout.',
      action: firstPickRejected
        ? 'First-pick declined, so marketplace recovery should be active.'
        : backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'Policy allows marketplace partners during the first-pick window.'
          : 'Policy delays marketplace visibility while first-pick is deciding.',
      className: backupWindowOpen ? 'ops-task-done' : 'ops-task-pending',
      pillClass: backupWindowOpen ? 'pill-success' : 'pill-info',
    },
    {
      title: 'Nearby partner supply',
      status: backupSupply.eligibleCount ? 'Supply ready' : customerPinReady ? 'Supply low' : 'No pin',
      detail: backupSupply.decisionDetail,
      action: customerPinReady
        ? `${backupSupply.eligibleCount} eligible, ${rejectedParticipants.length} rejected, ${customerChoiceCandidates.length} selectable.`
        : 'Confirm customer pin before relying on radius search.',
      className: backupSupply.eligibleCount ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: backupSupply.eligibleCount ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Chat handoff',
      status: booking.chatRoom ? 'Ready' : selected ? 'Missing' : 'Locked',
      detail: booking.chatRoom
        ? `${booking.chatRoom.messages?.length ?? 0} message(s) are visible in the room.`
        : selected
          ? 'Final partner is selected, but no chat room is attached.'
          : 'Chat stays locked until the final partner is selected.',
      action: booking.chatRoom
        ? 'Monitor coordination and location sharing.'
        : 'Unlock/repair after final match.',
      className: booking.chatRoom ? 'ops-task-done' : selected ? 'ops-task-blocked' : 'ops-task-pending',
      pillClass: booking.chatRoom ? 'pill-success' : selected ? 'pill-danger' : 'pill-info',
    },
  ];

  const badges = [
    {
      label: `${customerChoiceCandidates.length} selectable`,
      tone: customerChoiceCandidates.length ? 'pill-success' : 'pill-neutral',
      detail: 'Partners who participated or accepted and can be shown for final customer choice.',
    },
    {
      label: `${rejectedParticipants.length} rejected`,
      tone: rejectedParticipants.length ? 'pill-warn' : 'pill-neutral',
      detail: 'Partners who rejected this booking request.',
    },
    {
      label: `${backupSupply.eligibleCount} marketplace ready`,
      tone: backupSupply.eligibleCount ? 'pill-success' : 'pill-warn',
      detail: backupSupply.decisionDetail,
    },
    {
      label: customerPinReady ? 'Service address pin ready' : 'Service address pin missing',
      tone: customerPinReady ? 'pill-success' : 'pill-danger',
      detail: customerPinReady
        ? 'Distance and radius checks can use the saved service address coordinates.'
        : 'Booking does not have usable service address coordinates.',
    },
  ];

  return {
    signalStatus,
    signalTone,
    headline,
    detail,
    nextActionHref,
    nextActionLabel,
    cards,
    badges,
  };
}

function matchingTimerStatus(value: string | null | undefined, responseWindowMinutes: number) {
  if (!value) {
    return {
      status: `${responseWindowMinutes}m policy`,
      detail: 'No booking expiry timestamp is saved; use the response-window policy and audit notes.',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    };
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return {
      status: 'Invalid',
      detail: 'Booking expiry timestamp cannot be parsed.',
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  const minutes = Math.ceil((timestamp - Date.now()) / 60_000);
  if (minutes <= 0) {
    return {
      status: 'Expired',
      detail: `Timer expired ${Math.abs(minutes)}m ago.`,
      className: 'ops-task-blocked',
      pillClass: 'pill-danger',
    };
  }

  return {
    status: `${minutes}m left`,
    detail: `Timer closes at ${formatDate(value)} using the ${responseWindowMinutes}m response-window policy.`,
    className: minutes <= 3 ? 'ops-task-pending' : 'ops-task-done',
    pillClass: minutes <= 3 ? 'pill-warn' : 'pill-success',
  };
}
