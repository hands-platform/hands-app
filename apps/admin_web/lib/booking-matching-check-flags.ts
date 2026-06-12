import {
  bookingCheckFlag,
  compactBookingCheckFlags,
  type BookingCheckLevelFlag,
} from './booking-check-level';

export type BookingMatchingCheckFlagsInput = {
  status?: string | null;
  matchingWindowExpired?: boolean;
  firstPickPending?: boolean;
  participantCount?: number | null;
  matchingChatReady?: boolean;
};

export function bookingMatchingCheckFlagsFromFacts(
  input: BookingMatchingCheckFlagsInput,
): BookingCheckLevelFlag[] {
  const status = input.status ?? '';
  const isOpenMatching = status === 'OPEN_MATCHING';

  return compactBookingCheckFlags([
    bookingCheckFlag(
      isOpenMatching && Boolean(input.matchingWindowExpired),
      'high',
      'Matching window expired',
    ),
    bookingCheckFlag(
      isOpenMatching && Boolean(input.firstPickPending),
      'medium',
      'First-pick partner pending',
    ),
    bookingCheckFlag(
      isOpenMatching && (input.participantCount ?? 0) === 0,
      'medium',
      'No partner supply',
    ),
    bookingCheckFlag(
      status === 'MATCHED' && input.matchingChatReady === false,
      'high',
      'Matched without chat',
    ),
  ]);
}
