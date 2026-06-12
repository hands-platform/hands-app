import type { BookingMonitorCheckFlagsInput } from '../../lib/booking-monitor-check-flags';

export type BookingMonitorCheckFlagsSignalInput = Omit<
  BookingMonitorCheckFlagsInput,
  'firstPickPending' | 'matchingChatReady' | 'matchingWindowExpired'
> & {
  readonly firstPickAwaitingDecision?: boolean;
  readonly responseWindowExpired?: boolean;
};

export function bookingMonitorCheckFlagsInput(
  input: BookingMonitorCheckFlagsSignalInput,
): BookingMonitorCheckFlagsInput {
  const { firstPickAwaitingDecision, responseWindowExpired, ...facts } = input;
  const openMatching = facts.status === 'OPEN_MATCHING';

  return {
    ...facts,
    firstPickPending: openMatching && Boolean(firstPickAwaitingDecision),
    matchingChatReady: facts.status === 'MATCHED' ? facts.hasChatRoom : true,
    matchingWindowExpired: openMatching && Boolean(responseWindowExpired),
  };
}
