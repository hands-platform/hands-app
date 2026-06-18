import type { AdminBooking } from '../../lib/admin-api';
import {
  isPostMatchCancellationAutoApproved,
  isPostMatchCancellationReviewBooking,
  postMatchCancellationFeeState,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
} from './booking-post-match-cancellations-model';

export type BookingPostMatchChatEvidenceRow = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
};

export function bookingPostMatchEvidenceLabel(booking: AdminBooking) {
  return booking.status === 'NO_SHOW' ? 'No-show evidence' : 'Post-match cancellation evidence';
}

export function bookingPostMatchChatEvidenceRows({
  booking,
  messageCount,
}: {
  readonly booking: AdminBooking;
  readonly messageCount?: number;
}): readonly BookingPostMatchChatEvidenceRow[] {
  if (!isPostMatchCancellationReviewBooking(booking)) {
    return [];
  }

  const autoApproved = isPostMatchCancellationAutoApproved(booking);
  const feeState = postMatchCancellationFeeState(booking);
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  const resolution = postMatchCancellationResolution(booking);
  const retainedMessageCount = messageCount ?? booking.chatRoom?.messages?.length ?? 0;

  return [
    {
      label: 'Review state',
      value: cancellationResolutionLabel(resolution, autoApproved),
      helper: `${cancellationMinutesLabel(minutesAfterMatch)} / ${cancellationFeeStateLabel(feeState)}`,
    },
    {
      label: 'Closure source',
      value: booking.closedByRole ? humanizeBookingToken(booking.closedByRole) : 'Not recorded',
      helper: booking.closedReason ? humanizeBookingToken(booking.closedReason) : 'No closure reason stored.',
    },
    {
      label: 'Retained chat',
      value: countLabel(retainedMessageCount, 'message'),
      helper:
        retainedMessageCount > 0
          ? 'Use this transcript before approving or holding the fee decision.'
          : 'No retained chat messages are attached to this booking.',
    },
    {
      label: 'Closure note',
      value: booking.closedNote?.trim() ? booking.closedNote.trim() : 'No note',
      helper: booking.status === 'NO_SHOW' ? 'No-show context for admin review.' : 'Partner cancellation context.',
    },
  ];
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function humanizeBookingToken(value: string) {
  const label = value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
  return label === 'Provider' ? 'Partner' : label;
}

function cancellationFeeStateLabel(feeState: ReturnType<typeof postMatchCancellationFeeState>) {
  switch (feeState) {
    case 'restored':
      return 'Fee restored';
    case 'held':
      return 'Fee held';
    default:
      return 'No earning';
  }
}

function cancellationMinutesLabel(minutesAfterMatch: number | null) {
  if (minutesAfterMatch === null) {
    return 'Match time missing';
  }
  return `${minutesAfterMatch}m after match`;
}

function cancellationResolutionLabel(
  resolution: ReturnType<typeof postMatchCancellationResolution>,
  autoApproved = false,
) {
  switch (resolution) {
    case 'approved':
      return autoApproved ? 'Auto-approved' : 'Approved';
    case 'held':
      return 'Held';
    default:
      return 'Pending admin decision';
  }
}
