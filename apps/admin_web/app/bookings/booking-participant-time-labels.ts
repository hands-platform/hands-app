import {
  formatBookingDate,
  relativeTimeLabel,
} from './booking-list-time';

type BookingParticipantTimeFact = {
  readonly joinedAt?: string | null;
  readonly respondedAt?: string | null;
};

export function bookingParticipantJoinedLabel(
  participant: BookingParticipantTimeFact,
  nowMs: number,
): string {
  return participant.joinedAt
    ? `${formatBookingDate(participant.joinedAt)} / ${relativeTimeLabel(participant.joinedAt, nowMs)}`
    : 'Participation time not saved';
}

export function bookingParticipantRespondedLabel(
  participant: BookingParticipantTimeFact,
): string {
  return participant.respondedAt
    ? `Responded ${formatBookingDate(participant.respondedAt)}`
    : 'No response time saved';
}

export function bookingParticipantTimestamp(participant: BookingParticipantTimeFact): number {
  const value = participant.respondedAt ?? participant.joinedAt;
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
