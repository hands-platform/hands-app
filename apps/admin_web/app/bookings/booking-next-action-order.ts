import { commandToneWeight, type BookingCommandTone } from './booking-command-display';

export type BookingNextActionOrderFact = {
  readonly sortTimestampMs?: number | null;
  readonly tone: BookingCommandTone;
};

export function orderedBookingNextActions<T extends { readonly tone: BookingCommandTone }>(
  actions: readonly T[],
  readSortTimestampMs: (action: T) => number | null | undefined,
  limit = 5,
) {
  return [...actions]
    .sort((left, right) =>
      compareBookingNextActionOrder(
        { sortTimestampMs: readSortTimestampMs(left), tone: left.tone },
        { sortTimestampMs: readSortTimestampMs(right), tone: right.tone },
      ),
    )
    .slice(0, limit);
}

export function compareBookingNextActionOrder(
  left: BookingNextActionOrderFact,
  right: BookingNextActionOrderFact,
) {
  const toneDelta = commandToneWeight(right.tone) - commandToneWeight(left.tone);
  if (toneDelta !== 0) {
    return toneDelta;
  }
  return (right.sortTimestampMs ?? 0) - (left.sortTimestampMs ?? 0);
}
