import type { AdminBooking } from '../../lib/admin-api';
import { bookingChatMessageCount } from './booking-chat-message-count';
import {
  isPostMatchCancellationAutoApproved,
  isPostMatchCancellationReviewBooking,
  postMatchCancellationFeeState,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
} from './booking-post-match-cancellations-model';
import {
  postMatchCancellationFeeStateLabel,
  postMatchCancellationMinutesLabel,
  postMatchCancellationResolutionLabel,
} from './booking-post-match-cancellation-display';

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
  const retainedMessageCount = messageCount ?? bookingChatMessageCount(booking);

  return [
    {
      label: 'Review state',
      value: postMatchCancellationResolutionLabel(resolution, autoApproved),
      helper: `${postMatchCancellationMinutesLabel(minutesAfterMatch)} / ${postMatchCancellationFeeStateLabel(feeState)}`,
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
