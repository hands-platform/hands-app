import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import {
  marketplaceParticipantLedgerBoundaryCopy,
  participantReadableDecision,
} from '../../../lib/admin-participant-ledger-copy';
import { participantChatHandoffState } from '../../../lib/admin-participant-chat-handoff';
import { participantDistancePolicy } from '../../../lib/admin-distance-policy';
import { formatDistanceMeters } from '../../../lib/admin-format';
import { distanceLabel, formatDate, providerName, shortId } from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import {
  bookingParticipantProviderId,
  bookingCustomerSelectableParticipantsForFinalChoice,
  bookingPreferredProviderId,
  bookingSelectedProviderId,
  type BookingDetailParticipant,
  isCustomerSelectableParticipantForFinalChoice,
} from './booking-participant-rules';

type BookingParticipantLedgerMarketplaceSupply = {
  radiusMeters: number;
  eligibleCount: number;
};

type BookingParticipantLedgerNotificationTrace = {
  backupBatches: unknown[];
};

export function bookingParticipantLedger(
  booking: AdminBookingDetail,
  marketplaceSupply: BookingParticipantLedgerMarketplaceSupply,
  notificationTrace: BookingParticipantLedgerNotificationTrace,
) {
  const participants = booking.participants ?? [];
  const preferredProviderId = bookingPreferredProviderId(booking);
  const selectedProviderId = bookingSelectedProviderId(booking);
  const customerSelectableParticipants = bookingCustomerSelectableParticipantsForFinalChoice(booking);
  const rejectedParticipants = participants.filter((participant) => participant.status === 'REJECTED');
  const marketplaceParticipants = participants.filter(
    (participant) => bookingParticipantProviderId(participant) !== preferredProviderId,
  );
  const marketplaceCustomerSelectable = customerSelectableParticipants.filter(
    (participant) => bookingParticipantProviderId(participant) !== preferredProviderId,
  );
  const marketplaceEvidenceOnly = marketplaceParticipants.filter(
    (participant) =>
      !isCustomerSelectableParticipantForFinalChoice(participant, preferredProviderId) &&
      participant.status !== 'SELECTED',
  );
  const acceptedParticipants = participants.filter((participant) => participant.status === 'ACCEPTED');
  const joinedParticipants = participants.filter((participant) => participant.status === 'JOINED');
  const firstPickParticipant = participants.find(
    (participant) => bookingParticipantProviderId(participant) === preferredProviderId,
  );
  const selectedParticipant = participants.find(
    (participant) => bookingParticipantProviderId(participant) === selectedProviderId,
  );
  const finalPartner = bookingFinalPartnerSummary(booking);
  const finalPartnerRecorded = finalPartner.selected;
  const firstPickSelectable = firstPickParticipant
    ? isCustomerSelectableParticipantForFinalChoice(firstPickParticipant, preferredProviderId)
    : false;
  const selectedFromMarketplace = Boolean(selectedProviderId && selectedProviderId !== preferredProviderId);
  const chatRequired = Boolean(
    finalPartnerRecorded ||
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status),
  );
  const chatMessageCount = booking.chatRoom?.messages?.length ?? 0;
  const status = finalPartnerRecorded
    ? 'Final choice recorded'
    : customerSelectableParticipants.length
      ? 'Customer choice pending'
      : participants.length
        ? 'Shortlist active'
        : 'Waiting for participants';
  const tone = finalPartnerRecorded
    ? 'pill-success'
    : customerSelectableParticipants.length
      ? 'pill-warn'
      : participants.length
        ? 'pill-info'
        : 'pill-neutral';

  return {
    status,
    tone,
    boundary: marketplaceParticipantLedgerBoundaryCopy(),
    cards: [
      {
        label: 'First-pick Partner',
        value: booking.preferredProvider ? providerName(booking.preferredProvider) : 'Not set',
        helper: firstPickParticipant
          ? `${firstPickParticipant.status} / participated ${formatDate(firstPickParticipant.joinedAt)}`
          : booking.preferredProvider
            ? 'Waiting for the first-pick Partner response window.'
            : 'This booking was not opened with a preferred Partner.',
        href: booking.preferredProvider?.id ? `/partners/${booking.preferredProvider.id}` : '#participants',
      },
      {
        label: 'Marketplace participants',
        value: `${marketplaceParticipants.length} participant row(s)`,
        helper: `${marketplaceCustomerSelectable.length} customer-selectable / ${marketplaceEvidenceOnly.length} evidence-only / ${rejectedParticipants.length} rejected row(s).`,
        href: '#participants',
      },
      {
        label: 'Customer final choice',
        value: finalPartner.label,
        helper: selectedParticipant
          ? `${selectedParticipant.status} participant row retained.`
          : 'Customer final choice is required unless first-pick already matched first.',
        href: finalPartner.href,
      },
      {
        label: 'Booking-address radius',
        value: formatDistanceMeters(marketplaceSupply.radiusMeters),
        helper: `${marketplaceSupply.eligibleCount} currently eligible Partner(s) / ${notificationTrace.backupBatches.length} alert batch(es).`,
        href: '#marketplace-supply',
      },
      {
        label: 'Chat archive',
        value: booking.chatRoom ? `${chatMessageCount} message(s)` : chatRequired ? 'Missing' : 'Not opened',
        helper: booking.chatRoom
          ? 'Admin retains the booking chat even after mobile hides completed-service chat.'
          : chatRequired
            ? 'Matched bookings should create a retained chat archive for operations evidence.'
            : 'Chat opens after first-pick match or customer final selection and service handoff.',
        href: '#chat',
      },
    ],
    selectionTrace: [
      {
        label: '1. First-pick requirement',
        status: booking.preferredProvider
          ? firstPickParticipant
            ? firstPickParticipant.status
            : 'Requested'
          : 'Not used',
        tone: booking.preferredProvider
          ? firstPickSelectable || selectedProviderId === preferredProviderId
            ? 'pill-success'
            : firstPickParticipant?.status === 'REJECTED'
              ? 'pill-warn'
              : 'pill-info'
          : 'pill-neutral',
        value: booking.preferredProvider ? providerName(booking.preferredProvider) : 'No preferred Partner',
        helper: firstPickSelectable
          ? 'Preferred Partner accepted and can be chosen by the customer.'
          : firstPickParticipant?.status === 'JOINED'
            ? 'Preferred Partner is recorded as first-pick evidence, but is not customer-selectable until acceptance.'
            : firstPickParticipant?.status === 'REJECTED'
              ? 'Preferred Partner declined; marketplace Partners remain as customer options.'
              : booking.preferredProvider
                ? 'Waiting for the first-pick Partner response window.'
                : 'Booking was opened without a first-pick Partner.',
      },
      {
        label: '2. Marketplace participation',
        status: marketplaceParticipants.length ? 'Participants recorded' : 'Waiting',
        tone: marketplaceParticipants.length ? 'pill-info' : 'pill-neutral',
        value: `${marketplaceParticipants.length} actual row(s)`,
        helper: `${formatDistanceMeters(marketplaceSupply.radiusMeters)} booking-address radius / ${notificationTrace.backupBatches.length} alert batch(es).`,
      },
      {
        label: '3. Customer choice list',
        status: customerSelectableParticipants.length ? 'Selectable' : 'Not ready',
        tone: customerSelectableParticipants.length ? 'pill-warn' : 'pill-info',
        value: `${customerSelectableParticipants.length} customer-selectable`,
        helper:
          'Selectable means a marketplace participant, a legacy accepted first-pick fallback, or the retained final selected row. Evidence-only rows are not customer choices.',
      },
      {
        label: '4. Final match',
        status: finalPartnerRecorded ? 'Customer selected' : 'Pending',
        tone: finalPartnerRecorded ? 'pill-success' : 'pill-neutral',
        value: finalPartnerRecorded ? finalPartner.label : 'No final Partner yet',
        helper: finalPartnerRecorded
          ? selectedFromMarketplace
            ? 'Customer selected a marketplace participant instead of the first-pick Partner.'
            : 'First-pick Partner is retained as the final matched Partner.'
          : 'Customer final choice is required unless first-pick already matched first.',
      },
    ],
    lifecycleRows: [
      {
        stage: '1. First-pick response',
        scope: 'Preferred Partner receives the first response window; marketplace may still collect options.',
        status: booking.preferredProvider
          ? firstPickParticipant
            ? firstPickParticipant.status
            : 'Waiting'
          : 'Not used',
        tone: booking.preferredProvider
          ? firstPickParticipant?.status === 'REJECTED'
            ? 'pill-warn'
            : firstPickParticipant
              ? 'pill-info'
              : 'pill-neutral'
          : 'pill-neutral',
        evidence: booking.preferredProvider
          ? firstPickParticipant
            ? `${providerName(firstPickParticipant.providerProfile)} / participated ${formatDate(
                firstPickParticipant.joinedAt,
              )} / responded ${formatDate(firstPickParticipant.respondedAt)}`
            : `${providerName(booking.preferredProvider)} has no participant response row yet.`
          : 'This booking does not have a preferred Partner row.',
        operatorUse:
          'Confirm first-pick response evidence without manually overriding the API matching decision.',
      },
      {
        stage: '2. Marketplace participation',
        scope: 'Only Partners who actually join, accept, reject, or are selected are stored as rows.',
        status: marketplaceParticipants.length
          ? `${marketplaceParticipants.length} marketplace row(s)`
          : 'No marketplace row',
        tone: marketplaceParticipants.length ? 'pill-info' : 'pill-neutral',
        evidence: `${marketplaceCustomerSelectable.length} customer-selectable / ${acceptedParticipants.length} accepted / ${joinedParticipants.length} participating / ${rejectedParticipants.length} rejected.`,
        operatorUse:
          'Use the rows below as the factual list of Partners who entered the booking; marketplace visibility is not retained as activity.',
      },
      {
        stage: '3. Customer final choice',
        scope: 'Customer selection is the fallback authority when first-pick does not validly match first.',
        status: finalPartnerRecorded
          ? 'Selected'
          : customerSelectableParticipants.length
            ? 'Waiting customer'
            : 'Not ready',
        tone: finalPartnerRecorded
          ? 'pill-success'
          : customerSelectableParticipants.length
            ? 'pill-warn'
            : 'pill-neutral',
        evidence: finalPartnerRecorded
          ? `${finalPartner.label} is saved as the selected Partner.`
          : `${customerSelectableParticipants.length} customer-selectable Partner(s) available.`,
        operatorUse:
          'If final Partner is missing, check customer app shortlist visibility instead of manually choosing for the customer.',
      },
      {
        stage: '4. Chat and service handoff',
        scope: 'Chat must open after first-pick match or customer final selection and stay retained in Admin as evidence.',
        status: booking.chatRoom ? 'Chat retained' : chatRequired ? 'Chat missing' : 'Not opened yet',
        tone: booking.chatRoom ? 'pill-success' : chatRequired ? 'pill-danger' : 'pill-neutral',
        evidence: booking.chatRoom
          ? `Room ${shortId(booking.chatRoom.id)} / ${chatMessageCount} message(s).`
          : chatRequired
            ? 'Final/matched service flow exists but no chat room is attached.'
            : 'Waiting for first-pick match or customer final choice before chat opens.',
        operatorUse:
          'Use chat evidence for cancellation, no-show, dispute, and service handoff review.',
      },
    ],
    rows: [...participants].sort(sortBookingParticipantsForOps(preferredProviderId, selectedProviderId)).map((participant) => {
      const partnerId = bookingParticipantProviderId(participant);
      const isPreferred = partnerId === preferredProviderId;
      const isFinal = partnerId === selectedProviderId;
      const role = isFinal ? 'Final Partner' : isPreferred ? 'First-pick' : 'Marketplace';
      const roleTone = isFinal ? 'pill-success' : isPreferred ? 'pill-info' : 'pill-neutral';
      const customerSelectable = isCustomerSelectableParticipantForFinalChoice(participant, preferredProviderId);
      const statusTone =
        participant.status === 'REJECTED'
          ? 'pill-warn'
          : participant.status === 'SELECTED'
            ? 'pill-success'
            : customerSelectable
              ? 'pill-info'
              : 'pill-neutral';
      const choiceState = isFinal
        ? 'Customer final choice'
        : customerSelectable
          ? 'Customer-selectable'
          : 'Evidence-only';
      const choiceTone = isFinal ? 'pill-success' : customerSelectable ? 'pill-info' : 'pill-neutral';
      const chatHandoff = participantChatHandoffState({
        chatRequired,
        customerSelectable,
        finalPartnerRecorded,
        hasChatRoom: Boolean(booking.chatRoom),
        isFinal,
        status: participant.status,
      });
      const readableDecision = participantReadableDecision({
        isFinal,
        isPreferred,
        status: participant.status,
        customerSelectable,
      });
      const providerStatus =
        participant.providerStatusAtJoin ?? participant.providerProfile?.status ?? 'status unknown';
      const eligibility = bookingParticipantEligibilityState({
        isFinal,
        isPreferred,
        participant,
        customerSelectable,
      });
      const distancePolicy = participantDistancePolicy(participant.distanceMeters, marketplaceSupply.radiusMeters);
      const joinedAtLabel = formatDate(participant.joinedAt);
      const respondedAtLabel = formatDate(participant.respondedAt);

      return {
        id: participant.id,
        partner: providerName(participant.providerProfile),
        avatarStatus: bookingParticipantLedgerAvatarStatus(booking, participant, isFinal),
        identity: `${participant.providerProfile?.user?.phone ?? 'No phone'} / ${providerStatus}`,
        href: partnerId ? `/partners/${partnerId}` : null,
        ...bookingParticipantEvidenceState({
          isFinal,
          isPreferred,
          status: participant.status,
        }),
        role,
        roleTone,
        status: participant.status,
        statusTone,
        choiceState,
        choiceTone,
        operatorStatus: readableDecision.title,
        decision: readableDecision.decision,
        eligibilityLabel: eligibility.label,
        eligibilityTone: eligibility.tone,
        eligibilityReason: eligibility.reason,
        eligibilityNextStep: eligibility.nextStep,
        distance: distanceLabel(participant.distanceMeters),
        distancePolicyLabel: distancePolicy.label,
        distancePolicyTone: distancePolicy.tone,
        distancePolicyHelper: distancePolicy.helper,
        facts: [
          { label: 'Source', value: role, tone: roleTone },
          { label: 'Decision', value: participant.status, tone: statusTone },
          { label: 'Customer choice', value: choiceState, tone: choiceTone },
          { label: 'Distance', value: distancePolicy.label, tone: distancePolicy.tone },
          { label: 'Chat handoff', value: chatHandoff.label, tone: chatHandoff.tone },
        ],
        timing: `Participated ${joinedAtLabel} / responded ${respondedAtLabel}`,
        timingJoinedAtLabel: joinedAtLabel,
        timingJoinedAtValue: participant.joinedAt,
        timingRespondedAtLabel: respondedAtLabel,
        timingRespondedAtValue: participant.respondedAt,
        operatorUse: `Participant ${shortId(participant.id)} is retained as actual booking evidence. ${
          readableDecision.nextStep
        }`,
      };
    }),
  };
}

function bookingParticipantLedgerAvatarStatus(
  booking: AdminBookingDetail,
  participant: BookingDetailParticipant,
  isFinal: boolean,
): AdminAvatarStatus {
  if (isFinal || participant.status === 'SELECTED') {
    return 'working';
  }
  if (['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status)) {
    return 'offline';
  }
  if (booking.status === 'OPEN_MATCHING' && ['ACCEPTED', 'JOINED'].includes(participant.status)) {
    return 'matching';
  }
  const providerStatus = participant.providerStatusAtJoin ?? participant.providerProfile?.status;
  if (providerStatus === 'ONLINE_BUSY') {
    return 'working';
  }
  if (providerStatus === 'ONLINE_AVAILABLE' || providerStatus === 'ONLINE_AVAILABLE_SOON') {
    return 'online';
  }
  return 'offline';
}

function bookingParticipantEligibilityState(input: {
  isFinal: boolean;
  isPreferred: boolean;
  participant: BookingDetailParticipant;
  customerSelectable: boolean;
}) {
  if (input.isFinal || input.participant.status === 'SELECTED') {
    return {
      label: 'Final selected by customer',
      tone: 'pill-success',
      reason: 'Customer already selected this Partner as the final match; the row stays in the archive.',
      nextStep: 'Keep chat, payment, location, and closeout evidence linked to this selected row.',
    };
  }

  if (input.customerSelectable) {
    return {
      label: 'Customer-selectable',
      tone: 'pill-info',
      reason:
        'Customer-selectable reason: this Partner has an eligible participation status for the shortlist.',
      nextStep: 'Wait for the customer final choice; operators must not assign the final Partner manually.',
    };
  }

  if (input.participant.status === 'REJECTED') {
    return {
      label: 'Not customer-selectable',
      tone: 'pill-neutral',
      reason: 'Why not selectable: the Partner declined or could not take this booking.',
      nextStep: 'Keep the row as response evidence only.',
    };
  }

  if (input.isPreferred && input.participant.status === 'JOINED') {
    return {
      label: 'Not customer-selectable yet',
      tone: 'pill-warn',
      reason:
        'Why not selectable: first-pick participation is retained, but the Partner must accept before customer choice.',
      nextStep: 'Monitor the first-pick response window and marketplace shortlist visibility.',
    };
  }

  if (!bookingParticipantProviderId(input.participant)) {
    return {
      label: 'Not customer-selectable',
      tone: 'pill-neutral',
      reason: 'Why not selectable: this participant row is missing a linked Partner profile.',
      nextStep: 'Inspect the booking participant data before exposing the row to the customer.',
    };
  }

  return {
    label: 'Not customer-selectable',
    tone: 'pill-neutral',
    reason: `Why not selectable: status ${input.participant.status} is retained as evidence only.`,
    nextStep: 'Wait for a customer-selectable participant status or a retained final selected row.',
  };
}

function sortBookingParticipantsForOps(
  preferredProviderId?: string | null,
  selectedProviderId?: string | null,
) {
  return (left: BookingDetailParticipant, right: BookingDetailParticipant) => {
    const leftRank = bookingParticipantOpsRank(left, preferredProviderId, selectedProviderId);
    const rightRank = bookingParticipantOpsRank(right, preferredProviderId, selectedProviderId);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return bookingParticipantEventTime(right) - bookingParticipantEventTime(left);
  };
}

function bookingParticipantEvidenceState(input: {
  isFinal: boolean;
  isPreferred: boolean;
  status: string;
}) {
  if (input.isFinal || input.status === 'SELECTED') {
    return {
      evidenceLabel: 'Final selected row',
      evidenceDetail:
        'Customer chose this Partner; the participant row stays in the booking archive after matching.',
      evidenceTone: 'pill-success',
    };
  }

  if (input.status === 'REJECTED') {
    return {
      evidenceLabel: 'Declined response row',
      evidenceDetail:
        'Decline is retained as response evidence, not as a customer-selectable marketplace option.',
      evidenceTone: 'pill-info',
    };
  }

  if (input.isPreferred) {
    return {
      evidenceLabel: 'First-pick response row',
      evidenceDetail: 'Preferred Partner evidence from the 10-minute first-pick response window.',
      evidenceTone: 'pill-info',
    };
  }

  return {
    evidenceLabel: 'Marketplace participation row',
    evidenceDetail:
      'Partner entered the customer choice list from booking-address marketplace participation.',
    evidenceTone: 'pill-info',
  };
}

function bookingParticipantOpsRank(
  participant: BookingDetailParticipant,
  preferredProviderId?: string | null,
  selectedProviderId?: string | null,
) {
  const partnerId = bookingParticipantProviderId(participant);
  if (partnerId === selectedProviderId || participant.status === 'SELECTED') {
    return 0;
  }
  if (partnerId === preferredProviderId) {
    return 1;
  }
  if (isCustomerSelectableParticipantForFinalChoice(participant, preferredProviderId)) {
    return 2;
  }
  if (participant.status === 'REJECTED') {
    return 3;
  }
  return 4;
}

function bookingParticipantEventTime(participant: BookingDetailParticipant) {
  const raw = participant.respondedAt ?? participant.joinedAt;
  const parsed = raw ? Date.parse(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
